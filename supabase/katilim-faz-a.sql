-- =============================================================================
-- STUDIO SEOZ — KATILIMCI & ETKİNLİK YÖNETİM SİSTEMİ — FAZ A
-- -----------------------------------------------------------------------------
-- Ne kurar:
--   • rsvp_events     : yayınlanan her davetiye için bir etkinlik kaydı
--                       (form soruları, panel anahtarının ŞİFRELENMİŞ hali)
--   • rsvp_responses  : misafir yanıtları (created_at / updated_at / güncelleme sayısı)
--   • rsvp_attendees  : yanıttaki her kişi ayrı satır (grup = aynı yanıt).
--                       Faz D'de masa planı kişi VEYA grup bazında bunları kullanır.
--   • Güvenli fonksiyonlar (misafir gönder/güncelle, sahip senkron, panel anahtarı yenile)
--
-- Ne YAPMAZ:
--   • published_invitations tablosunu DEĞİŞTİRMEZ (yalnızca slug'ın var olduğunu okur).
--   • Mevcut politikalara, Storage'a, feedback_submissions'a dokunmaz.
--
-- Güvenlik modeli:
--   • Üç tabloda da RLS AÇIK. Misafirin (anon) hiçbir tabloya doğrudan
--     okuma/yazma yetkisi YOK. Yalnızca Studio SEOZ (seoz_is_owner) okuyabilir.
--   • Misafir yalnızca rsvp_submit / rsvp_get_own fonksiyonlarını çağırabilir;
--     bunlar yalnızca KENDİ yanıtına (gizli düzenleme anahtarıyla) erişir.
--   • Anahtarlar veritabanında yalnızca SHA-256 özeti olarak tutulur.
--   • Yardımcı fonksiyonlar API'ye açık olmayan "seoz_private" şemasındadır.
--
-- Nasıl çalıştırılır: Supabase → SQL Editor → bu dosyanın TAMAMINI yapıştır → Run.
-- Tekrar çalıştırmak güvenlidir (mevcut veriyi silmez).
-- Geri almak için: katilim-geri-al.sql
-- =============================================================================

begin;

-- 0) Ön koşullar -------------------------------------------------------------
do $$
begin
  if to_regclass('public.published_invitations') is null then
    raise exception 'published_invitations tablosu bulunamadı. Önce SUPABASE-YAYIN-REHBERI.md uygulanmalı.';
  end if;
  if to_regprocedure('public.seoz_is_owner()') is null then
    raise exception 'seoz_is_owner() bulunamadı. Önce GUCLENDIRME-REHBERI.md bölüm B uygulanmalı.';
  end if;
end $$;

create extension if not exists pgcrypto with schema extensions;
create schema if not exists seoz_private;
revoke all on schema seoz_private from public;

-- 1) Tablolar ----------------------------------------------------------------
create table if not exists public.rsvp_events (
  id                      uuid primary key default gen_random_uuid(),
  invitation_slug         text not null unique check (char_length(invitation_slug) between 3 and 120),
  doc_id                  text,
  layer_id                text,
  form_schema             jsonb not null default '{}'::jsonb,
  is_open                 boolean not null default true,
  max_responses           integer not null default 3000 check (max_responses between 1 and 20000),
  panel_token_hash        text unique,
  panel_token_rotated_at  timestamptz,
  panel_pin_hash          text,          -- İLERİDE isteğe bağlı PIN için ayrıldı; Faz A'da kullanılmıyor
  panel_settings          jsonb not null default '{}'::jsonb,  -- Faz B: kart isimleri vb.
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create table if not exists public.rsvp_responses (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null references public.rsvp_events(id) on delete cascade,
  layer_id         text,
  respondent_name  text not null check (char_length(respondent_name) between 1 and 120),
  attending        boolean,
  party_size       integer not null default 1 check (party_size between 0 and 100),
  answers          jsonb not null default '{}'::jsonb,
  consent_given    boolean not null default false,
  edit_token_hash  text not null unique,
  update_count     integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists rsvp_responses_event_idx on public.rsvp_responses(event_id);

create table if not exists public.rsvp_attendees (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.rsvp_events(id) on delete cascade,
  response_id  uuid not null references public.rsvp_responses(id) on delete cascade,
  position     integer not null check (position between 0 and 99),   -- 0 = formu dolduran kişi
  full_name    text not null default '' check (char_length(full_name) <= 120),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (response_id, position)
);
create index if not exists rsvp_attendees_event_idx on public.rsvp_attendees(event_id);

-- 2) Erişim: RLS açık, doğrudan erişim yalnızca Studio SEOZ'a (okuma) --------
alter table public.rsvp_events    enable row level security;
alter table public.rsvp_responses enable row level security;
alter table public.rsvp_attendees enable row level security;

revoke all on public.rsvp_events, public.rsvp_responses, public.rsvp_attendees from public, anon, authenticated;
grant select on public.rsvp_events, public.rsvp_responses, public.rsvp_attendees to authenticated;

drop policy if exists "sahip okur" on public.rsvp_events;
drop policy if exists "sahip okur" on public.rsvp_responses;
drop policy if exists "sahip okur" on public.rsvp_attendees;
create policy "sahip okur" on public.rsvp_events    for select to authenticated using (public.seoz_is_owner());
create policy "sahip okur" on public.rsvp_responses for select to authenticated using (public.seoz_is_owner());
create policy "sahip okur" on public.rsvp_attendees for select to authenticated using (public.seoz_is_owner());

-- 3) Yardımcılar (API'ye kapalı şema) ---------------------------------------
create or replace function seoz_private.new_token() returns text
language sql volatile set search_path = '' as $$
  select translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_')
$$;

create or replace function seoz_private.hash_token(p text) returns text
language sql immutable set search_path = '' as $$
  select encode(extensions.digest(convert_to(coalesce(p, ''), 'UTF8'), 'sha256'), 'hex')
$$;

create or replace function seoz_private.is_blank(v jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select v is null
      or jsonb_typeof(v) = 'null'
      or (jsonb_typeof(v) = 'string' and btrim(v #>> '{}') = '')
      or (jsonb_typeof(v) = 'array'  and jsonb_array_length(v) = 0)
$$;

-- Formu (form_schema) ve misafirin gönderdiğini karşılaştırır; temiz bir
-- yanıt nesnesi döndürür ya da anlaşılır bir hata kodu ile durur.
-- Soru türleri: short, long, yesno, radio, choice, checkbox, number, select
-- Soru görevleri (role): 'attendance' (Evet/Hayır) ve 'count' (Sayı)
create or replace function seoz_private.build_response(p_form jsonb, p_payload jsonb)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  v_name      text := btrim(coalesce(p_payload->>'name', ''));
  v_in        jsonb := coalesce(p_payload->'answers', '{}'::jsonb);
  v_out       jsonb := '{}'::jsonb;
  v_questions jsonb := coalesce(p_form->'questions', '[]'::jsonb);
  v_attending boolean := null;
  v_has_att   boolean := false;
  v_party     integer := null;
  v_max_party integer := least(greatest(coalesce((p_form->>'maxPartySize')::int, 20), 1), 100);
  q jsonb; v jsonb; v_type text; v_id text; v_label text;
  v_txt text; v_num numeric; v_disp text; v_ids jsonb; v_lbls text[];
  v_el jsonb; v_comp jsonb := '[]'::jsonb; v_c text; i integer;
  v_consent boolean := coalesce(p_payload->'consent' = 'true'::jsonb, false);
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then raise exception 'invalid_payload'; end if;
  if jsonb_typeof(v_in) <> 'object' or jsonb_typeof(v_questions) <> 'array' then raise exception 'invalid_payload'; end if;
  if v_name = '' then raise exception 'required:name'; end if;
  if char_length(v_name) > 120 then raise exception 'too_long:name'; end if;

  -- Katılım sorusu önce okunur (diğer soruların görünürlüğü ona bağlı)
  for q in select value from jsonb_array_elements(v_questions) loop
    if coalesce(q->>'active', 'true') <> 'false' and q->>'role' = 'attendance' and q->>'type' = 'yesno' then
      v_has_att := true;
      v := v_in -> (q->>'id');
      if v is not null and jsonb_typeof(v) = 'boolean' then v_attending := (v #>> '{}')::boolean; end if;
      exit;
    end if;
  end loop;
  if not v_has_att then v_attending := true; end if;   -- katılım sorusu yoksa herkes "katılıyor" sayılır

  for q in select value from jsonb_array_elements(v_questions) loop
    continue when coalesce(q->>'active', 'true') = 'false';
    v_id := q->>'id'; v_type := q->>'type'; v_label := left(coalesce(q->>'label', ''), 300);
    continue when v_id is null or char_length(v_id) > 60;
    -- "yalnızca katılacaksa göster" soruları, katılmayanlarda atlanır
    continue when coalesce(q->>'onlyIfAttending', 'false') = 'true' and v_attending is false and coalesce(q->>'role', '') <> 'attendance';

    v := v_in -> v_id;
    if seoz_private.is_blank(v) then
      if coalesce(q->>'required', 'false') = 'true' then raise exception 'required:%', v_id; end if;
      continue;
    end if;

    v_disp := null;
    if v_type in ('short', 'long') then
      if jsonb_typeof(v) not in ('string', 'number') then raise exception 'invalid:%', v_id; end if;
      v_txt := btrim(v #>> '{}');
      if char_length(v_txt) > (case when v_type = 'short' then 300 else 3000 end) then raise exception 'too_long:%', v_id; end if;
      v := to_jsonb(v_txt); v_disp := v_txt;

    elsif v_type = 'yesno' then
      if jsonb_typeof(v) <> 'boolean' then raise exception 'invalid:%', v_id; end if;
      v_disp := case when (v #>> '{}')::boolean
                     then coalesce(nullif(q->>'yesLabel', ''), 'Evet')
                     else coalesce(nullif(q->>'noLabel', ''), 'Hayır') end;

    elsif v_type in ('radio', 'choice', 'select') then
      if jsonb_typeof(v) <> 'string' then raise exception 'invalid:%', v_id; end if;
      select o->>'label' into v_disp from jsonb_array_elements(coalesce(q->'options', '[]'::jsonb)) o
        where o->>'id' = v #>> '{}' limit 1;
      if v_disp is null then raise exception 'invalid:%', v_id; end if;

    elsif v_type = 'checkbox' then
      if jsonb_typeof(v) <> 'array' or jsonb_array_length(v) > 50 then raise exception 'invalid:%', v_id; end if;
      v_ids := '[]'::jsonb; v_lbls := '{}';
      for v_el in select value from jsonb_array_elements(v) loop
        if jsonb_typeof(v_el) <> 'string' then raise exception 'invalid:%', v_id; end if;
        continue when v_ids @> jsonb_build_array(v_el);
        select o->>'label' into v_txt from jsonb_array_elements(coalesce(q->'options', '[]'::jsonb)) o
          where o->>'id' = v_el #>> '{}' limit 1;
        if v_txt is null then raise exception 'invalid:%', v_id; end if;
        v_ids := v_ids || jsonb_build_array(v_el); v_lbls := v_lbls || v_txt;
      end loop;
      v := v_ids; v_disp := array_to_string(v_lbls, ', ');

    elsif v_type = 'number' then
      begin
        v_num := (v #>> '{}')::numeric;
      exception when others then raise exception 'invalid:%', v_id;
      end;
      if q->>'role' = 'count' then
        if v_num <> trunc(v_num) or v_num < 1 or v_num > v_max_party then raise exception 'range:%', v_id; end if;
      else
        if (q->>'min') is not null and q->>'min' <> '' and v_num < (q->>'min')::numeric then raise exception 'range:%', v_id; end if;
        if (q->>'max') is not null and q->>'max' <> '' and v_num > (q->>'max')::numeric then raise exception 'range:%', v_id; end if;
        if abs(v_num) > 1000000000 then raise exception 'range:%', v_id; end if;
      end if;
      v := to_jsonb(v_num); v_disp := v_num::text;
    else
      continue;  -- bilinmeyen tür: yok sayılır
    end if;

    if q->>'role' = 'count' and v_type = 'number' then v_party := v_num::int; end if;
    v_out := v_out || jsonb_build_object(v_id, jsonb_build_object('q', v_label, 't', v_type, 'v', v, 'd', v_disp));
  end loop;

  -- Kişi sayısı: katılmıyorsa 0, sayı sorusu yoksa 1
  if v_attending is false then v_party := 0;
  elsif v_party is null then v_party := 1;
  end if;

  -- Diğer katılımcıların isimleri (editörden açılırsa)
  if coalesce(p_form->>'askCompanionNames', 'false') = 'true' and v_party > 1 then
    for i in 1 .. v_party - 1 loop
      v_c := btrim(coalesce(p_payload->'companions'->>(i - 1), ''));
      if char_length(v_c) > 120 then raise exception 'too_long:companion:%', i; end if;
      if v_c = '' and coalesce(p_form->>'companionNamesRequired', 'false') = 'true' then
        raise exception 'required:companion:%', i;
      end if;
      v_comp := v_comp || to_jsonb(v_c);
    end loop;
  end if;

  -- KVKK / onay metni varsa işaretlenmesi zorunlu
  if btrim(coalesce(p_form->>'consentText', '')) <> '' and not v_consent then
    raise exception 'required:consent';
  end if;

  return jsonb_build_object(
    'name', v_name, 'attending', v_attending, 'party_size', v_party,
    'answers', v_out, 'companions', v_comp, 'consent', v_consent);
end $$;

-- Yanıttaki kişileri (rsvp_attendees) eşitler. Aynı sıradaki kişi aynı satırda
-- kalır (Faz D'de masa yerleşimi korunur); fazlalar silinir, eksikler eklenir.
create or replace function seoz_private.sync_attendees(p_event uuid, p_response uuid, p_built jsonb)
returns void language plpgsql volatile set search_path = '' as $$
declare
  v_party integer := (p_built->>'party_size')::int;
  v_name  text;
  i integer;
begin
  delete from public.rsvp_attendees where response_id = p_response and position >= v_party;
  for i in 0 .. v_party - 1 loop
    v_name := case when i = 0 then p_built->>'name'
                   else coalesce(p_built->'companions'->>(i - 1), '') end;
    insert into public.rsvp_attendees (event_id, response_id, position, full_name)
    values (p_event, p_response, i, v_name)
    on conflict (response_id, position) do update
      set full_name = excluded.full_name, updated_at = now()
      where public.rsvp_attendees.full_name is distinct from excluded.full_name;
  end loop;
end $$;

revoke all on all functions in schema seoz_private from public, anon, authenticated;

-- 4) MİSAFİR fonksiyonları ---------------------------------------------------
-- Yanıt gönderir. p_edit_token boşsa YENİ yanıt açar ve gizli düzenleme
-- anahtarını bir kez döndürür (yalnızca misafirin tarayıcısında saklanır).
-- p_edit_token geçerliyse AYNI yanıtı günceller (mükerrer kayıt oluşmaz).
create or replace function public.rsvp_submit(p_slug text, p_payload jsonb, p_edit_token text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  ev        public.rsvp_events%rowtype;
  b         jsonb;
  v_resp    uuid;
  v_token   text := null;
  v_created boolean := false;
  v_count   integer;
begin
  if p_slug is null or char_length(p_slug) > 120 then raise exception 'event_not_found'; end if;
  if p_payload is null or pg_column_size(p_payload) > 40000 then raise exception 'payload_too_large'; end if;
  if coalesce(p_payload->>'hp', '') <> '' then raise exception 'rejected'; end if;   -- bot tuzağı

  select * into ev from public.rsvp_events where invitation_slug = p_slug;
  if not found then raise exception 'event_not_found'; end if;
  if not ev.is_open then raise exception 'form_closed'; end if;

  b := seoz_private.build_response(ev.form_schema, p_payload);

  if p_edit_token is not null and char_length(p_edit_token) between 20 and 100 then
    select id into v_resp from public.rsvp_responses
      where event_id = ev.id and edit_token_hash = seoz_private.hash_token(p_edit_token)
      for update;
  end if;

  if v_resp is null then
    select count(*) into v_count from public.rsvp_responses where event_id = ev.id;
    if v_count >= ev.max_responses then raise exception 'limit_reached'; end if;
    v_token := seoz_private.new_token();
    insert into public.rsvp_responses
      (event_id, layer_id, respondent_name, attending, party_size, answers, consent_given, edit_token_hash)
    values
      (ev.id, ev.layer_id, b->>'name', (b->>'attending')::boolean, (b->>'party_size')::int,
       b->'answers', (b->>'consent')::boolean, seoz_private.hash_token(v_token))
    returning id into v_resp;
    v_created := true;
  else
    update public.rsvp_responses set
      respondent_name = b->>'name',
      attending       = (b->>'attending')::boolean,
      party_size      = (b->>'party_size')::int,
      answers         = b->'answers',
      consent_given   = (b->>'consent')::boolean,
      update_count    = update_count + 1,
      updated_at      = now()
    where id = v_resp;
  end if;

  perform seoz_private.sync_attendees(ev.id, v_resp, b);

  return jsonb_build_object('ok', true, 'created', v_created, 'edit_token', v_token, 'saved_at', now());
end $$;

-- Misafirin KENDİ yanıtını (formu önceden doldurmak için) döndürür.
-- Yalnızca doğru düzenleme anahtarıyla; başka hiçbir yanıt okunamaz.
create or replace function public.rsvp_get_own(p_slug text, p_edit_token text)
returns jsonb language plpgsql security definer stable set search_path = '' as $$
declare r public.rsvp_responses%rowtype; v_answers jsonb := '{}'::jsonb; k text; v jsonb;
begin
  if p_slug is null or p_edit_token is null or char_length(p_edit_token) not between 20 and 100 then return null; end if;
  select r2.* into r from public.rsvp_responses r2
    join public.rsvp_events e on e.id = r2.event_id
    where e.invitation_slug = p_slug and r2.edit_token_hash = seoz_private.hash_token(p_edit_token);
  if not found then return null; end if;
  for k, v in select key, value from jsonb_each(r.answers) loop
    v_answers := v_answers || jsonb_build_object(k, v->'v');
  end loop;
  return jsonb_build_object(
    'name', r.respondent_name,
    'answers', v_answers,
    'companions', coalesce((select jsonb_agg(a.full_name order by a.position)
                              from public.rsvp_attendees a where a.response_id = r.id and a.position > 0), '[]'::jsonb),
    'consent', r.consent_given,
    'created_at', r.created_at, 'updated_at', r.updated_at, 'update_count', r.update_count);
end $$;

-- 5) STUDIO SEOZ (sahip) fonksiyonları --------------------------------------
-- "Yayına Hazırla" sonrasında editör çağırır: etkinliği oluşturur/günceller,
-- soruların son halini kaydeder. Panel anahtarı İLK kez oluşturulduğunda
-- yalnızca bir kez düz metin olarak döner; veritabanında özeti tutulur.
create or replace function public.rsvp_owner_sync_event(p_slug text, p_doc_id text, p_layer_id text, p_form jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare ev public.rsvp_events%rowtype; v_token text := null;
begin
  if not public.seoz_is_owner() then raise exception 'not_owner'; end if;
  if not exists (select 1 from public.published_invitations where slug = p_slug) then
    raise exception 'invitation_not_found';
  end if;
  if p_form is null or jsonb_typeof(p_form) <> 'object' or jsonb_typeof(coalesce(p_form->'questions', '[]'::jsonb)) <> 'array'
     or pg_column_size(p_form) > 200000 then
    raise exception 'invalid_form';
  end if;

  insert into public.rsvp_events (invitation_slug, doc_id, layer_id, form_schema)
  values (p_slug, left(p_doc_id, 120), left(p_layer_id, 120), p_form)
  on conflict (invitation_slug) do update
    set doc_id = excluded.doc_id, layer_id = excluded.layer_id,
        form_schema = excluded.form_schema, updated_at = now()
  returning * into ev;

  if ev.panel_token_hash is null then
    v_token := seoz_private.new_token();
    update public.rsvp_events
      set panel_token_hash = seoz_private.hash_token(v_token), panel_token_rotated_at = now()
      where id = ev.id;
  end if;

  return jsonb_build_object('event_id', ev.id, 'panel_token', v_token, 'is_open', ev.is_open);
end $$;

-- Panel anahtarını yeniler: eski panel linki ANINDA geçersiz olur.
create or replace function public.rsvp_owner_rotate_panel_token(p_slug text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_token text := seoz_private.new_token(); v_id uuid;
begin
  if not public.seoz_is_owner() then raise exception 'not_owner'; end if;
  update public.rsvp_events
    set panel_token_hash = seoz_private.hash_token(v_token), panel_token_rotated_at = now(), updated_at = now()
    where invitation_slug = p_slug
    returning id into v_id;
  if v_id is null then raise exception 'event_not_found'; end if;
  return jsonb_build_object('event_id', v_id, 'panel_token', v_token);
end $$;

-- Formu yanıtlara açar / kapatır.
create or replace function public.rsvp_owner_set_open(p_slug text, p_open boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public.seoz_is_owner() then raise exception 'not_owner'; end if;
  update public.rsvp_events set is_open = coalesce(p_open, true), updated_at = now()
    where invitation_slug = p_slug returning id into v_id;
  if v_id is null then raise exception 'event_not_found'; end if;
  return jsonb_build_object('event_id', v_id, 'is_open', coalesce(p_open, true));
end $$;

-- 6) Fonksiyon yetkileri -----------------------------------------------------
revoke all on function public.rsvp_submit(text, jsonb, text)                   from public, anon, authenticated;
revoke all on function public.rsvp_get_own(text, text)                         from public, anon, authenticated;
revoke all on function public.rsvp_owner_sync_event(text, text, text, jsonb)   from public, anon, authenticated;
revoke all on function public.rsvp_owner_rotate_panel_token(text)              from public, anon, authenticated;
revoke all on function public.rsvp_owner_set_open(text, boolean)               from public, anon, authenticated;

grant execute on function public.rsvp_submit(text, jsonb, text)                 to anon, authenticated;
grant execute on function public.rsvp_get_own(text, text)                       to anon, authenticated;
grant execute on function public.rsvp_owner_sync_event(text, text, text, jsonb) to authenticated;
grant execute on function public.rsvp_owner_rotate_panel_token(text)            to authenticated;
grant execute on function public.rsvp_owner_set_open(text, boolean)             to authenticated;

commit;

-- Yeni fonksiyonların API'de hemen görünmesi için
notify pgrst, 'reload schema';
