-- =============================================================================
-- STUDIO SEOZ — DİLEK AĞACI (Etkileşim · "Dilek Ağacı")
-- -----------------------------------------------------------------------------
-- Ne kurar (YALNIZCA EKLEME):
--   • wish_entries : misafirlerin bıraktığı dilekler (davetiye + katman başına)
--   • Misafir   : wish_tree_get (ağaçtaki simgeler; "Herkese Açık" ise dilek metinleri),
--                 wish_tree_add (ad + dilek gönder)
--   • Organizatör (mevcut Katılım Paneli linki, panel.html#k=...):
--                 wish_panel_get (tüm dilekler, gizlenenler dahil), wish_panel_set_hidden, wish_panel_delete
--   • Studio SEOZ (giriş yapmış sahip):
--                 wish_owner_ensure_panel (davetiyede Katılım Formu yoksa panel linki için etkinlik kaydı açar;
--                                          VARSA HİÇBİR ŞEYİ DEĞİŞTİRMEZ)
--                 wish_owner_purge (bir davetiyenin dileklerini ELLE siler — yalnızca Studio SEOZ çağırır)
--
-- Ne YAPMAZ:
--   • Mevcut tablolara (published_invitations, rsvp_*, seating_*, memory_*, poll_*) sütun eklemez,
--     hiçbir mevcut kaydı değiştirmez/silmez. rsvp_events'e yalnızca HİÇ kaydı olmayan davetiye için
--     yeni satır ekleyebilir (wish_owner_ensure_panel).
--   • Otomatik silme, cron, pg_cron, pg_net, Edge Function KURMAZ.
--
-- Güvenlik:
--   • RLS AÇIK; anon/authenticated tabloya doğrudan erişemez. Her şey security definer fonksiyonlarla.
--   • Görünürlük ayarı (Herkese Açık / Kilitli) yayındaki davetiyenin kendisinden okunur; misafir değiştiremez.
--     Kilitliyken wish_tree_get dilek metni ve isim DÖNDÜRMEZ (yalnızca simge yeri ve onaylı baş harfler).
--   • Organizatör fonksiyonları panel anahtarının özetini kontrol eder; yalnızca o davetiyenin dileklerine erişir.
--
-- Ön koşul: katilim-faz-a.sql + katilim-faz-b.sql. Tekrar çalıştırmak güvenlidir.
-- Geri almak için: dilek-agaci-geri-al.sql (DİKKAT: dilekler silinir).
-- =============================================================================

begin;

do $$
begin
  if to_regclass('public.published_invitations') is null then raise exception 'published_invitations bulunamadı.'; end if;
  if to_regclass('public.rsvp_events') is null then raise exception 'Önce katilim-faz-a.sql kurulmalı.'; end if;
  if to_regprocedure('public.seoz_is_owner()') is null then raise exception 'seoz_is_owner() bulunamadı.'; end if;
  if to_regprocedure('seoz_private.event_by_panel_token(text,text)') is null then raise exception 'Önce katilim-faz-b.sql kurulmalı.'; end if;
end $$;

-- 1) Tablo ---------------------------------------------------------------------
create table if not exists public.wish_entries (
  id               uuid primary key default gen_random_uuid(),
  invitation_slug  text not null check (char_length(invitation_slug) between 3 and 120),
  layer_id         text not null check (char_length(layer_id) between 1 and 120),
  guest_name       text not null check (char_length(guest_name) between 1 and 60),
  wish_text        text not null check (char_length(wish_text) between 1 and 400),
  show_initials    boolean not null default false,
  initials         text check (initials is null or char_length(initials) <= 4),
  slot             integer not null default 0,
  is_hidden        boolean not null default false,
  created_at       timestamptz not null default now()
);
create index if not exists wish_entries_tree_idx on public.wish_entries (invitation_slug, layer_id, slot);
alter table public.wish_entries enable row level security;
revoke all on public.wish_entries from public, anon, authenticated;

-- 2) Yardımcılar ---------------------------------------------------------------
-- Yayındaki davetiyede bu katman gerçekten bir Dilek Ağacı mı? Ayarlarını döndürür (yoksa null).
create or replace function seoz_private.wish_tree_settings(p_slug text, p_layer_id text)
returns jsonb language sql stable set search_path = '' as $$
  select l->'settings'
  from public.published_invitations p,
       jsonb_array_elements(case when jsonb_typeof(p.document_data->'layers') = 'array' then p.document_data->'layers' else '[]'::jsonb end) l
  where p.slug = p_slug and l->>'id' = p_layer_id and l->>'type' = 'module'
    and l->>'moduleId' = 'interactive' and l->'settings'->>'kind' = 'dilek-agaci'
  order by p.id desc
  limit 1
$$;

-- Davetiyedeki bütün Dilek Ağaçları (panel için): [{id, visibility}]
create or replace function seoz_private.wish_trees_of(p_slug text)
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', l->>'id', 'visibility', coalesce(l->'settings'->>'wishVisibility', 'kilitli'))), '[]'::jsonb)
  from (select document_data from public.published_invitations where slug = p_slug order by id desc limit 1) p,
       jsonb_array_elements(case when jsonb_typeof(p.document_data->'layers') = 'array' then p.document_data->'layers' else '[]'::jsonb end) l
  where l->>'type' = 'module' and l->>'moduleId' = 'interactive' and l->'settings'->>'kind' = 'dilek-agaci'
$$;

-- Etkinlik tarihi (30 gün uyarısı için): önce Takvime Ekle, yoksa Geri Sayım tarihi. Yoksa null.
create or replace function seoz_private.wish_event_date(p_slug text)
returns text language sql stable set search_path = '' as $$
  select d from (
    select case when l->>'moduleId' = 'calendar' then l->'settings'->>'date' else l->'settings'->>'targetDate' end as d,
           case when l->>'moduleId' = 'calendar' then 0 else 1 end as o
    from (select document_data from public.published_invitations where slug = p_slug order by id desc limit 1) p,
         jsonb_array_elements(case when jsonb_typeof(p.document_data->'layers') = 'array' then p.document_data->'layers' else '[]'::jsonb end) l
    where l->>'type' = 'module' and l->>'moduleId' in ('calendar', 'countdown')
  ) x where d ~ '^\d{4}-\d{2}-\d{2}$' order by o limit 1
$$;

revoke all on function seoz_private.wish_tree_settings(text, text) from public, anon, authenticated;
revoke all on function seoz_private.wish_trees_of(text) from public, anon, authenticated;
revoke all on function seoz_private.wish_event_date(text) from public, anon, authenticated;

-- 3) Misafir -------------------------------------------------------------------
-- Ağaçtaki simgeler. Kilitliyken isim ve dilek metni DÖNMEZ.
create or replace function public.wish_tree_get(p_slug text, p_layer_id text)
returns jsonb language plpgsql security definer stable set search_path = '' as $$
declare s jsonb; v_public boolean;
begin
  if p_slug is null or p_layer_id is null or char_length(p_slug) > 120 or char_length(p_layer_id) > 120 then return null; end if;
  s := seoz_private.wish_tree_settings(p_slug, p_layer_id);
  if s is null then return null; end if;
  v_public := coalesce(s->>'wishVisibility', 'kilitli') = 'acik';
  return jsonb_build_object(
    'visibility', case when v_public then 'acik' else 'kilitli' end,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', w.id, 'slot', w.slot,
        'initials', case when w.show_initials then w.initials else null end,
        'name', case when v_public then w.guest_name else null end,
        'wish', case when v_public then w.wish_text else null end) order by w.slot)
      from (select * from public.wish_entries
            where invitation_slug = p_slug and layer_id = p_layer_id and not is_hidden
            order by slot limit 1500) w), '[]'::jsonb));
end $$;

create or replace function public.wish_tree_add(p_slug text, p_layer_id text, p_name text, p_wish text,
                                                p_show_initials boolean default false, p_hp text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s jsonb; v_name text; v_wish text; v_ini text; v_parts text[]; v_slot integer; v_id uuid; n integer;
begin
  if coalesce(p_hp, '') <> '' then raise exception 'rejected'; end if;               -- bot tuzağı
  if p_slug is null or p_layer_id is null or char_length(p_slug) > 120 or char_length(p_layer_id) > 120 then raise exception 'tree_not_found'; end if;
  s := seoz_private.wish_tree_settings(p_slug, p_layer_id);
  if s is null then raise exception 'tree_not_found'; end if;
  v_name := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_wish := btrim(coalesce(p_wish, ''));
  if char_length(v_name) < 1 then raise exception 'name_required'; end if;
  if char_length(v_wish) < 1 then raise exception 'wish_required'; end if;
  if char_length(v_name) > 60 then raise exception 'name_too_long'; end if;
  if char_length(v_wish) > 400 then raise exception 'wish_too_long'; end if;

  -- Ağaç başına üst sınır ve kısa süreli seri gönderim sınırı (kötüye kullanıma karşı)
  select count(*) into n from public.wish_entries where invitation_slug = p_slug and layer_id = p_layer_id;
  if n >= 1500 then raise exception 'limit_reached'; end if;
  select count(*) into n from public.wish_entries
    where invitation_slug = p_slug and layer_id = p_layer_id and created_at > now() - interval '1 minute';
  if n >= 30 then raise exception 'slow_down'; end if;

  v_parts := regexp_split_to_array(v_name, ' ');
  v_ini := upper(left(v_parts[1], 1) || coalesce(left(v_parts[array_length(v_parts, 1)], 1), ''));
  if array_length(v_parts, 1) = 1 then v_ini := upper(left(v_parts[1], 1)); end if;

  perform pg_advisory_xact_lock(hashtext('wish:' || p_slug || ':' || p_layer_id));
  select coalesce(max(slot), -1) + 1 into v_slot from public.wish_entries where invitation_slug = p_slug and layer_id = p_layer_id;

  insert into public.wish_entries (invitation_slug, layer_id, guest_name, wish_text, show_initials, initials, slot)
  values (p_slug, p_layer_id, v_name, v_wish, coalesce(p_show_initials, false), v_ini, v_slot)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'slot', v_slot,
                            'initials', case when coalesce(p_show_initials, false) then v_ini else null end);
end $$;

-- 4) Organizatör (Katılım Paneli anahtarı) -------------------------------------
create or replace function public.wish_panel_get(p_token text, p_pin text default null)
returns jsonb language plpgsql security definer stable set search_path = '' as $$
declare ev public.rsvp_events%rowtype;
begin
  ev := seoz_private.event_by_panel_token(p_token, p_pin);
  return jsonb_build_object(
    'trees', seoz_private.wish_trees_of(ev.invitation_slug),
    'event_date', seoz_private.wish_event_date(ev.invitation_slug),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', w.id, 'layer_id', w.layer_id, 'name', w.guest_name, 'wish', w.wish_text,
        'show_initials', w.show_initials, 'initials', w.initials, 'hidden', w.is_hidden,
        'created_at', w.created_at) order by w.created_at)
      from public.wish_entries w where w.invitation_slug = ev.invitation_slug), '[]'::jsonb));
end $$;

create or replace function public.wish_panel_set_hidden(p_token text, p_id uuid, p_hidden boolean, p_pin text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare ev public.rsvp_events%rowtype; v_id uuid;
begin
  ev := seoz_private.event_by_panel_token(p_token, p_pin);
  update public.wish_entries set is_hidden = coalesce(p_hidden, true)
    where id = p_id and invitation_slug = ev.invitation_slug returning id into v_id;
  if v_id is null then raise exception 'wish_not_found'; end if;
  return jsonb_build_object('ok', true, 'id', v_id, 'hidden', coalesce(p_hidden, true));
end $$;

create or replace function public.wish_panel_delete(p_token text, p_id uuid, p_pin text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare ev public.rsvp_events%rowtype; v_id uuid;
begin
  ev := seoz_private.event_by_panel_token(p_token, p_pin);
  delete from public.wish_entries where id = p_id and invitation_slug = ev.invitation_slug returning id into v_id;
  if v_id is null then raise exception 'wish_not_found'; end if;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

-- 5) Studio SEOZ (sahip) -------------------------------------------------------
-- Davetiyede Katılım Formu YOKSA dilekler için panel linki: boş sorulu etkinlik kaydı açar.
-- Kayıt zaten VARSA hiçbir şeyi değiştirmez (soruları, yanıtları, açık/kapalı durumunu korur).
create or replace function public.wish_owner_ensure_panel(p_slug text, p_doc_id text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare ev public.rsvp_events%rowtype; v_token text := null;
begin
  if not public.seoz_is_owner() then raise exception 'not_owner'; end if;
  if not exists (select 1 from public.published_invitations where slug = p_slug) then raise exception 'invitation_not_found'; end if;
  select * into ev from public.rsvp_events where invitation_slug = p_slug;
  if not found then
    v_token := seoz_private.new_token();
    insert into public.rsvp_events (invitation_slug, doc_id, form_schema, panel_token_hash, panel_token_rotated_at)
    values (p_slug, left(p_doc_id, 120), '{"questions":[]}'::jsonb, seoz_private.hash_token(v_token), now())
    returning * into ev;
  elsif ev.panel_token_hash is null then
    v_token := seoz_private.new_token();
    update public.rsvp_events set panel_token_hash = seoz_private.hash_token(v_token), panel_token_rotated_at = now() where id = ev.id;
  end if;
  return jsonb_build_object('event_id', ev.id, 'panel_token', v_token);
end $$;

-- Bir davetiyenin bütün dileklerini siler (ELLE; yalnızca Studio SEOZ). Otomatik çalışan hiçbir şey yoktur.
create or replace function public.wish_owner_purge(p_slug text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if not public.seoz_is_owner() then raise exception 'not_owner'; end if;
  if p_slug is null or char_length(p_slug) not between 3 and 120 then raise exception 'invalid_slug'; end if;
  delete from public.wish_entries where invitation_slug = p_slug;
  get diagnostics n = row_count;
  return jsonb_build_object('ok', true, 'removed', n);
end $$;

-- Dilek sayısı (Yayına Hazırla penceresinde bilgi için)
create or replace function public.wish_owner_count(p_slug text)
returns jsonb language plpgsql security definer stable set search_path = '' as $$
begin
  if not public.seoz_is_owner() then raise exception 'not_owner'; end if;
  return jsonb_build_object('count', (select count(*) from public.wish_entries where invitation_slug = p_slug),
                            'event_date', seoz_private.wish_event_date(p_slug));
end $$;

-- 6) Yetkiler ------------------------------------------------------------------
revoke all on function public.wish_tree_get(text, text)                                   from public, anon, authenticated;
revoke all on function public.wish_tree_add(text, text, text, text, boolean, text)        from public, anon, authenticated;
revoke all on function public.wish_panel_get(text, text)                                  from public, anon, authenticated;
revoke all on function public.wish_panel_set_hidden(text, uuid, boolean, text)            from public, anon, authenticated;
revoke all on function public.wish_panel_delete(text, uuid, text)                         from public, anon, authenticated;
revoke all on function public.wish_owner_ensure_panel(text, text)                         from public, anon, authenticated;
revoke all on function public.wish_owner_purge(text)                                      from public, anon, authenticated;
revoke all on function public.wish_owner_count(text)                                      from public, anon, authenticated;
grant execute on function public.wish_tree_get(text, text)                                to anon, authenticated;
grant execute on function public.wish_tree_add(text, text, text, text, boolean, text)     to anon, authenticated;
grant execute on function public.wish_panel_get(text, text)                               to anon, authenticated;
grant execute on function public.wish_panel_set_hidden(text, uuid, boolean, text)         to anon, authenticated;
grant execute on function public.wish_panel_delete(text, uuid, text)                      to anon, authenticated;
grant execute on function public.wish_owner_ensure_panel(text, text)                      to authenticated;
grant execute on function public.wish_owner_purge(text)                                   to authenticated;
grant execute on function public.wish_owner_count(text)                                   to authenticated;

commit;
notify pgrst, 'reload schema';
