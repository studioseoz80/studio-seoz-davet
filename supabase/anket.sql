-- =============================================================================
-- STUDIO SEOZ — ANKET SİSTEMİ ("Studio SEOZ sistemi" yanıt yöntemi)
-- -----------------------------------------------------------------------------
-- Ne kurar:
--   • poll_surveys    : davetiyedeki her anket (davetiye + katman) için bir kayıt: sorular, açık/kapalı,
--                       sonuç paneli anahtarının ÖZETİ
--   • poll_responses  : katılımcı yanıtları (her tarayıcı tek yanıt; yeniden gönderince güncellenir)
--   • Güvenli fonksiyonlar: yanıt gönder (sunucu tarafında doğrulama), Studio SEOZ senkronu,
--     sonuç paneli (canlı özet, yanıt listesi, aç/kapat, yanıt sil)
--
-- Ne YAPMAZ:
--   • Katılım Bildir (rsvp_*), masa planı (seating_*), published_invitations ve vitrin tablolarına DOKUNMAZ.
--   • Google Drive / Google Form kullanmaz.
--
-- Güvenlik modeli (Katılım sistemiyle aynı):
--   • RLS AÇIK; katılımcının (anon) tablolara doğrudan erişimi YOK. Yalnızca poll_submit çağrılabilir.
--   • Yanıtlar sunucuda anketin kendi sorularına göre doğrulanır (bilinmeyen soru/seçenek, zorunlu soru, uzunluk).
--   • Sonuç paneline yalnızca gizli link (anket-panel.html#k=...) ile girilir; anahtarın SHA-256 özeti saklanır.
--
-- Ön koşul: katilim-faz-a.sql (seoz_private.new_token / hash_token).
-- Nasıl çalıştırılır: Supabase → SQL Editor → tamamını yapıştır → Run. Tekrar çalıştırmak güvenlidir.
-- Geri almak için: anket-geri-al.sql
-- =============================================================================

begin;

do $$
begin
  if to_regclass('public.published_invitations') is null then raise exception 'published_invitations bulunamadı.'; end if;
  if to_regprocedure('public.seoz_is_owner()') is null then raise exception 'seoz_is_owner() bulunamadı.'; end if;
  if to_regprocedure('seoz_private.new_token()') is null or to_regprocedure('seoz_private.hash_token(text)') is null then
    raise exception 'Önce katilim-faz-a.sql çalıştırılmalı (seoz_private.new_token / hash_token).';
  end if;
end $$;

-- 1) Tablolar -----------------------------------------------------------------
create table if not exists public.poll_surveys (
  id                      uuid primary key default gen_random_uuid(),
  invitation_slug         text not null check (char_length(invitation_slug) between 3 and 120),
  layer_id                text not null check (char_length(layer_id) between 1 and 120),
  form_schema             jsonb not null default '{}'::jsonb,
  is_open                 boolean not null default true,
  max_responses           integer not null default 5000 check (max_responses between 1 and 50000),
  panel_token_hash        text unique,
  panel_token_rotated_at  timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (invitation_slug, layer_id)
);
create table if not exists public.poll_responses (
  id                uuid primary key default gen_random_uuid(),
  survey_id         uuid not null references public.poll_surveys(id) on delete cascade,
  voter_token_hash  text not null,
  answers           jsonb not null default '{}'::jsonb,
  comments          jsonb not null default '{}'::jsonb,
  participant_name  text check (participant_name is null or char_length(participant_name) <= 120),
  update_count      integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (survey_id, voter_token_hash)
);
create index if not exists poll_responses_survey_idx on public.poll_responses (survey_id, created_at desc);

alter table public.poll_surveys   enable row level security;
alter table public.poll_responses enable row level security;
revoke all on public.poll_surveys, public.poll_responses from public, anon, authenticated;
grant select on public.poll_surveys, public.poll_responses to authenticated;
drop policy if exists "sahip okur" on public.poll_surveys;
drop policy if exists "sahip okur" on public.poll_responses;
create policy "sahip okur" on public.poll_surveys   for select to authenticated using (public.seoz_is_owner());
create policy "sahip okur" on public.poll_responses for select to authenticated using (public.seoz_is_owner());

-- 2) Yanıtı anketin sorularına göre doğrular; temiz { answers, comments, name } döndürür ----------
create or replace function seoz_private.poll_build(p_form jsonb, p_payload jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare q jsonb; a jsonb; v jsonb; opts jsonb; c jsonb; t text;
        ans jsonb := '{}'::jsonb; com jsonb := '{}'::jsonb; nm text; req boolean; typ text;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or pg_column_size(p_payload) > 40000 then raise exception 'invalid_payload'; end if;
  a := coalesce(p_payload->'answers', '{}'::jsonb);
  if jsonb_typeof(a) <> 'object' then raise exception 'invalid_payload'; end if;
  for q in select * from jsonb_array_elements(coalesce(p_form->'questions', '[]'::jsonb)) loop
    typ := coalesce(q->>'type', 'choice');
    req := coalesce((q->>'required')::boolean, true);
    opts := coalesce((select jsonb_agg(o->>'id') from jsonb_array_elements(coalesce(q->'options', '[]'::jsonb)) o), '[]'::jsonb);
    v := a->(q->>'id');
    if v is null or v = 'null'::jsonb or v = '[]'::jsonb or v = '""'::jsonb then
      if req then raise exception 'required:%', q->>'id'; end if;
      continue;
    end if;
    if typ = 'multi' then
      if jsonb_typeof(v) <> 'array' or jsonb_array_length(v) > 50 then raise exception 'invalid:%', q->>'id'; end if;
      if exists (select 1 from jsonb_array_elements(v) x where jsonb_typeof(x) <> 'string' or not (opts ? (x #>> '{}'))) then raise exception 'invalid:%', q->>'id'; end if;
      ans := ans || jsonb_build_object(q->>'id', (select jsonb_agg(distinct x) from jsonb_array_elements(v) x));
    else
      if jsonb_typeof(v) <> 'string' or not (opts ? (v #>> '{}')) then raise exception 'invalid:%', q->>'id'; end if;
      ans := ans || jsonb_build_object(q->>'id', v);
    end if;
  end loop;
  for c in select * from jsonb_array_elements(coalesce(p_form->'comments', '[]'::jsonb)) loop
    t := btrim(coalesce(p_payload->'comments'->>(c->>'id'), ''));
    if t <> '' then com := com || jsonb_build_object(c->>'id', left(t, 1000)); end if;
  end loop;
  nm := nullif(left(btrim(coalesce(p_payload->>'name', '')), 120), '');
  if coalesce(p_form->>'collectName', 'off') = 'required' and nm is null then raise exception 'required:name'; end if;
  if coalesce(p_form->>'collectName', 'off') = 'off' then nm := null; end if;
  return jsonb_build_object('answers', ans, 'comments', com, 'name', nm);
end $$;

create or replace function seoz_private.survey_by_token(p_token text)
returns public.poll_surveys language sql stable security definer set search_path = '' as $$
  select s.* from public.poll_surveys s
  where p_token is not null and char_length(p_token) between 20 and 200 and s.panel_token_hash = seoz_private.hash_token(p_token)
$$;
revoke all on function seoz_private.poll_build(jsonb, jsonb) from public, anon, authenticated;
revoke all on function seoz_private.survey_by_token(text)    from public, anon, authenticated;

-- 3) Katılımcı: yanıt gönder / güncelle -------------------------------------------------------
create or replace function public.poll_submit(p_slug text, p_layer_id text, p_payload jsonb, p_voter_token text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare sv public.poll_surveys%rowtype; b jsonb; v_token text := null; v_hash text; r_id uuid; n integer;
begin
  select * into sv from public.poll_surveys where invitation_slug = p_slug and layer_id = p_layer_id;
  if sv.id is null then raise exception 'survey_not_found'; end if;
  if not sv.is_open then raise exception 'closed'; end if;
  b := seoz_private.poll_build(sv.form_schema, p_payload);
  if p_voter_token is not null and char_length(p_voter_token) between 20 and 200 then
    v_hash := seoz_private.hash_token(p_voter_token);
    update public.poll_responses set answers = b->'answers', comments = b->'comments', participant_name = b->>'name',
           update_count = update_count + 1, updated_at = now()
     where survey_id = sv.id and voter_token_hash = v_hash returning id into r_id;
    if r_id is not null then return jsonb_build_object('ok', true, 'updated', true); end if;
  end if;
  select count(*) into n from public.poll_responses where survey_id = sv.id;
  if n >= sv.max_responses then raise exception 'full'; end if;
  v_token := seoz_private.new_token();
  insert into public.poll_responses (survey_id, voter_token_hash, answers, comments, participant_name)
  values (sv.id, seoz_private.hash_token(v_token), b->'answers', b->'comments', b->>'name');
  return jsonb_build_object('ok', true, 'updated', false, 'voter_token', v_token);
end $$;

-- Katılımcı: KENDİ önceki yanıtını görür (yalnızca kendi tarayıcısındaki gizli anahtarla)
create or replace function public.poll_get_own(p_slug text, p_layer_id text, p_voter_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r public.poll_responses%rowtype;
begin
  if p_voter_token is null or char_length(p_voter_token) not between 20 and 200 then return null; end if;
  select x.* into r from public.poll_responses x join public.poll_surveys s on s.id = x.survey_id
   where s.invitation_slug = p_slug and s.layer_id = p_layer_id and x.voter_token_hash = seoz_private.hash_token(p_voter_token);
  if r.id is null then return null; end if;
  return jsonb_build_object('answers', r.answers, 'comments', r.comments, 'name', r.participant_name, 'updated_at', r.updated_at);
end $$;

-- 4) Studio SEOZ (yayında): anket kaydı ve soruların son hali; panel anahtarı ilk kez bir kez döner ---------
create or replace function public.poll_owner_sync(p_slug text, p_layer_id text, p_form jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare sv public.poll_surveys%rowtype; v_token text := null;
begin
  if not public.seoz_is_owner() then raise exception 'not_owner'; end if;
  if not exists (select 1 from public.published_invitations where slug = p_slug) then raise exception 'invitation_not_found'; end if;
  if p_form is null or jsonb_typeof(p_form) <> 'object' or jsonb_typeof(coalesce(p_form->'questions', '[]'::jsonb)) <> 'array' or pg_column_size(p_form) > 200000 then
    raise exception 'invalid_form';
  end if;
  insert into public.poll_surveys (invitation_slug, layer_id, form_schema) values (p_slug, left(p_layer_id, 120), p_form)
  on conflict (invitation_slug, layer_id) do update set form_schema = excluded.form_schema, updated_at = now()
  returning * into sv;
  if sv.panel_token_hash is null then
    v_token := seoz_private.new_token();
    update public.poll_surveys set panel_token_hash = seoz_private.hash_token(v_token), panel_token_rotated_at = now() where id = sv.id;
  end if;
  return jsonb_build_object('survey_id', sv.id, 'panel_token', v_token, 'is_open', sv.is_open);
end $$;

create or replace function public.poll_owner_rotate_token(p_slug text, p_layer_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_token text := seoz_private.new_token(); v_id uuid;
begin
  if not public.seoz_is_owner() then raise exception 'not_owner'; end if;
  update public.poll_surveys set panel_token_hash = seoz_private.hash_token(v_token), panel_token_rotated_at = now(), updated_at = now()
   where invitation_slug = p_slug and layer_id = p_layer_id returning id into v_id;
  if v_id is null then raise exception 'survey_not_found'; end if;
  return jsonb_build_object('survey_id', v_id, 'panel_token', v_token);
end $$;

-- 5) Sonuç paneli (gizli link) -----------------------------------------------------------------
create or replace function public.poll_panel_get(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare sv public.poll_surveys%rowtype;
begin
  select * into sv from seoz_private.survey_by_token(p_token);
  if sv.id is null then raise exception 'invalid_token'; end if;
  return jsonb_build_object(
    'slug', sv.invitation_slug, 'layer_id', sv.layer_id, 'is_open', sv.is_open, 'form', sv.form_schema,
    'layer_index', (select x.i from public.published_invitations p,
                      lateral (select row_number() over () as i, l from jsonb_array_elements(p.document_data->'layers') l
                               where l->>'moduleId' = 'poll') x
                    where p.slug = sv.invitation_slug and x.l->>'id' = sv.layer_id limit 1),
    'invitation_title', (select p.document_data->'meta'->>'title' from public.published_invitations p where p.slug = sv.invitation_slug),
    'responses', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'answers', r.answers, 'comments', r.comments, 'name', r.participant_name,
                                                               'at', r.created_at, 'updated_at', r.updated_at) order by r.created_at desc)
                           from public.poll_responses r where r.survey_id = sv.id), '[]'::jsonb));
end $$;

create or replace function public.poll_panel_set_open(p_token text, p_open boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare sv public.poll_surveys%rowtype;
begin
  select * into sv from seoz_private.survey_by_token(p_token);
  if sv.id is null then raise exception 'invalid_token'; end if;
  update public.poll_surveys set is_open = coalesce(p_open, true), updated_at = now() where id = sv.id;
  return jsonb_build_object('is_open', coalesce(p_open, true));
end $$;

create or replace function public.poll_panel_delete_response(p_token text, p_response_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare sv public.poll_surveys%rowtype;
begin
  select * into sv from seoz_private.survey_by_token(p_token);
  if sv.id is null then raise exception 'invalid_token'; end if;
  delete from public.poll_responses where id = p_response_id and survey_id = sv.id;
  return jsonb_build_object('ok', true);
end $$;

-- 6) Yetkiler ------------------------------------------------------------------------------------
revoke all on function public.poll_submit(text, text, jsonb, text)          from public, anon, authenticated;
revoke all on function public.poll_get_own(text, text, text)               from public, anon, authenticated;
revoke all on function public.poll_owner_sync(text, text, jsonb)            from public, anon, authenticated;
revoke all on function public.poll_owner_rotate_token(text, text)           from public, anon, authenticated;
revoke all on function public.poll_panel_get(text)                          from public, anon, authenticated;
revoke all on function public.poll_panel_set_open(text, boolean)            from public, anon, authenticated;
revoke all on function public.poll_panel_delete_response(text, uuid)        from public, anon, authenticated;
grant execute on function public.poll_submit(text, text, jsonb, text)          to anon, authenticated;
grant execute on function public.poll_get_own(text, text, text)               to anon, authenticated;
grant execute on function public.poll_owner_sync(text, text, jsonb)            to authenticated;
grant execute on function public.poll_owner_rotate_token(text, text)           to authenticated;
grant execute on function public.poll_panel_get(text)                          to anon, authenticated;
grant execute on function public.poll_panel_set_open(text, boolean)            to anon, authenticated;
grant execute on function public.poll_panel_delete_response(text, uuid)        to anon, authenticated;

commit;
notify pgrst, 'reload schema';
