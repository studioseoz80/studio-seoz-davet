-- =============================================================================
-- STUDIO SEOZ — KATILIMCI & ETKİNLİK YÖNETİM SİSTEMİ — FAZ D (YERLEŞİM PLANI)
-- -----------------------------------------------------------------------------
-- Ön koşul: katilim-faz-a.sql ve katilim-faz-b.sql kurulmuş olmalı.
--
-- Ne kurar:
--   • seating_areas       : masa / alan / grup (ad, numara, KENDİ kapasitesi,
--                           şekil, salon planındaki konumu)
--   • seating_assignments : hangi katılımcı (rsvp_attendees) hangi alanda.
--                           Kişi bazlıdır; grup = aynı yanıttaki kişiler.
--   • Panel fonksiyonları (panel anahtarıyla, yalnızca KENDİ etkinliği):
--       rsvp_panel_seating_get, rsvp_panel_area_save, rsvp_panel_area_delete,
--       rsvp_panel_assign, rsvp_panel_swap
--
-- Kurallar:
--   • Kimse otomatik yerleştirilmez; her yerleşimi müşteri yapar.
--   • Kapasite aşımı veritabanında ENGELLENMEZ (panel önce açık onay ister).
--   • Masa silinirse oradaki kişiler "Yerleştirilmemiş"e döner.
--   • Misafir kişi sayısını azaltır / katılmayacağını bildirirse, artık
--     gelmeyen kişinin yerleşimi kendiliğinden kalkar.
--   • Tablolara doğrudan erişim KAPALI (RLS); yalnızca Studio SEOZ okuyabilir.
--
-- Mevcut tablolar DEĞİŞMEZ. Tekrar çalıştırmak güvenlidir.
-- =============================================================================

begin;

do $$
begin
  if to_regprocedure('seoz_private.event_by_panel_token(text, text)') is null then
    raise exception 'Önce katilim-faz-a.sql ve katilim-faz-b.sql kurulmalı.';
  end if;
end $$;

create table if not exists public.seating_areas (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.rsvp_events(id) on delete cascade,
  label       text not null default '' check (char_length(label) <= 60),
  number      integer check (number between 0 and 9999),
  capacity    integer not null default 8 check (capacity between 1 and 500),
  shape       text not null default 'round' check (shape in ('round', 'rect')),
  pos_x       numeric not null default 40 check (pos_x between -100 and 5000),
  pos_y       numeric not null default 40 check (pos_y between -100 and 5000),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists seating_areas_event_idx on public.seating_areas(event_id);

create table if not exists public.seating_assignments (
  attendee_id  uuid primary key references public.rsvp_attendees(id) on delete cascade,
  event_id     uuid not null references public.rsvp_events(id) on delete cascade,
  area_id      uuid not null references public.seating_areas(id) on delete cascade,
  assigned_at  timestamptz not null default now()
);
create index if not exists seating_assignments_area_idx on public.seating_assignments(area_id);
create index if not exists seating_assignments_event_idx on public.seating_assignments(event_id);

alter table public.seating_areas       enable row level security;
alter table public.seating_assignments enable row level security;
revoke all on public.seating_areas, public.seating_assignments from public, anon, authenticated;
grant select on public.seating_areas, public.seating_assignments to authenticated;
drop policy if exists "sahip okur" on public.seating_areas;
drop policy if exists "sahip okur" on public.seating_assignments;
create policy "sahip okur" on public.seating_areas       for select to authenticated using (public.seoz_is_owner());
create policy "sahip okur" on public.seating_assignments for select to authenticated using (public.seoz_is_owner());

-- Masaları ve yerleşimleri getirir.
create or replace function public.rsvp_panel_seating_get(p_token text, p_pin text default null)
returns jsonb language plpgsql security definer stable set search_path = '' as $$
declare ev public.rsvp_events%rowtype;
begin
  ev := seoz_private.event_by_panel_token(p_token, p_pin);
  return jsonb_build_object(
    'areas', coalesce((select jsonb_agg(jsonb_build_object(
        'id', a.id, 'label', a.label, 'number', a.number, 'capacity', a.capacity, 'shape', a.shape,
        'x', a.pos_x, 'y', a.pos_y, 'sort', a.sort_order) order by a.sort_order, a.created_at)
      from public.seating_areas a where a.event_id = ev.id), '[]'::jsonb),
    'assignments', coalesce((select jsonb_object_agg(s.attendee_id::text, s.area_id)
      from public.seating_assignments s where s.event_id = ev.id), '{}'::jsonb)
  );
end $$;

-- Masa/alan ekler (id yoksa) veya günceller (id bu etkinliğe aitse).
create or replace function public.rsvp_panel_area_save(p_token text, p_area jsonb, p_pin text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare ev public.rsvp_events%rowtype; v_id uuid; v_count integer; a public.seating_areas%rowtype;
begin
  ev := seoz_private.event_by_panel_token(p_token, p_pin);
  if p_area is null or jsonb_typeof(p_area) <> 'object' then raise exception 'invalid_area'; end if;
  if nullif(p_area->>'id', '') is not null then
    v_id := (p_area->>'id')::uuid;
    update public.seating_areas set
      label      = left(coalesce(p_area->>'label', label), 60),
      number     = case when p_area ? 'number' then nullif(p_area->>'number', '')::int else number end,
      capacity   = coalesce(nullif(p_area->>'capacity', '')::int, capacity),
      shape      = coalesce(nullif(p_area->>'shape', ''), shape),
      pos_x      = coalesce(nullif(p_area->>'x', '')::numeric, pos_x),
      pos_y      = coalesce(nullif(p_area->>'y', '')::numeric, pos_y),
      sort_order = coalesce(nullif(p_area->>'sort', '')::int, sort_order),
      updated_at = now()
    where id = v_id and event_id = ev.id
    returning * into a;
    if a.id is null then raise exception 'area_not_found'; end if;
  else
    select count(*) into v_count from public.seating_areas where event_id = ev.id;
    if v_count >= 300 then raise exception 'too_many_areas'; end if;
    insert into public.seating_areas (event_id, label, number, capacity, shape, pos_x, pos_y, sort_order)
    values (ev.id, left(coalesce(p_area->>'label', ''), 60), nullif(p_area->>'number', '')::int,
            coalesce(nullif(p_area->>'capacity', '')::int, 8), coalesce(nullif(p_area->>'shape', ''), 'round'),
            coalesce(nullif(p_area->>'x', '')::numeric, 40), coalesce(nullif(p_area->>'y', '')::numeric, 40),
            coalesce(nullif(p_area->>'sort', '')::int, v_count))
    returning * into a;
  end if;
  return jsonb_build_object('id', a.id, 'label', a.label, 'number', a.number, 'capacity', a.capacity,
                            'shape', a.shape, 'x', a.pos_x, 'y', a.pos_y, 'sort', a.sort_order);
end $$;

-- Masa/alanı siler; oradaki kişiler "Yerleştirilmemiş"e döner.
create or replace function public.rsvp_panel_area_delete(p_token text, p_area_id uuid, p_pin text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare ev public.rsvp_events%rowtype; v_n integer;
begin
  ev := seoz_private.event_by_panel_token(p_token, p_pin);
  delete from public.seating_areas where id = p_area_id and event_id = ev.id;
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'area_not_found'; end if;
  return jsonb_build_object('ok', true);
end $$;

-- Kişileri bir alana yerleştirir; p_area_id boşsa yerleşimlerini kaldırır.
-- Yalnızca BU etkinliğin, KATILAN kişileri kabul edilir.
create or replace function public.rsvp_panel_assign(p_token text, p_attendee_ids uuid[], p_area_id uuid, p_pin text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare ev public.rsvp_events%rowtype; v_valid integer; v_n integer;
begin
  ev := seoz_private.event_by_panel_token(p_token, p_pin);
  if p_attendee_ids is null or array_length(p_attendee_ids, 1) is null then return jsonb_build_object('ok', true, 'count', 0); end if;
  if array_length(p_attendee_ids, 1) > 500 then raise exception 'too_many'; end if;
  select count(*) into v_valid from public.rsvp_attendees at
    join public.rsvp_responses r on r.id = at.response_id
    where at.id = any(p_attendee_ids) and at.event_id = ev.id and r.attending is distinct from false;
  if v_valid <> (select count(distinct x) from unnest(p_attendee_ids) x) then raise exception 'attendee_not_found'; end if;

  if p_area_id is null then
    delete from public.seating_assignments where event_id = ev.id and attendee_id = any(p_attendee_ids);
  else
    if not exists (select 1 from public.seating_areas where id = p_area_id and event_id = ev.id) then raise exception 'area_not_found'; end if;
    insert into public.seating_assignments (attendee_id, event_id, area_id)
      select distinct x, ev.id, p_area_id from unnest(p_attendee_ids) x
    on conflict (attendee_id) do update set area_id = excluded.area_id, assigned_at = now();
  end if;
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'count', v_n);
end $$;

-- İki kişinin yerini değiştirir (biri yerleşmemiş olabilir).
create or replace function public.rsvp_panel_swap(p_token text, p_a uuid, p_b uuid, p_pin text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare ev public.rsvp_events%rowtype; v_a uuid; v_b uuid; v_ok integer;
begin
  ev := seoz_private.event_by_panel_token(p_token, p_pin);
  select count(*) into v_ok from public.rsvp_attendees at join public.rsvp_responses r on r.id = at.response_id
    where at.id in (p_a, p_b) and at.event_id = ev.id and r.attending is distinct from false;
  if p_a = p_b or v_ok <> 2 then raise exception 'attendee_not_found'; end if;
  select area_id into v_a from public.seating_assignments where attendee_id = p_a and event_id = ev.id;
  select area_id into v_b from public.seating_assignments where attendee_id = p_b and event_id = ev.id;
  delete from public.seating_assignments where attendee_id in (p_a, p_b) and event_id = ev.id;
  if v_b is not null then insert into public.seating_assignments (attendee_id, event_id, area_id) values (p_a, ev.id, v_b); end if;
  if v_a is not null then insert into public.seating_assignments (attendee_id, event_id, area_id) values (p_b, ev.id, v_a); end if;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.rsvp_panel_seating_get(text, text)           from public, anon, authenticated;
revoke all on function public.rsvp_panel_area_save(text, jsonb, text)      from public, anon, authenticated;
revoke all on function public.rsvp_panel_area_delete(text, uuid, text)     from public, anon, authenticated;
revoke all on function public.rsvp_panel_assign(text, uuid[], uuid, text)  from public, anon, authenticated;
revoke all on function public.rsvp_panel_swap(text, uuid, uuid, text)      from public, anon, authenticated;
grant execute on function public.rsvp_panel_seating_get(text, text)          to anon, authenticated;
grant execute on function public.rsvp_panel_area_save(text, jsonb, text)     to anon, authenticated;
grant execute on function public.rsvp_panel_area_delete(text, uuid, text)    to anon, authenticated;
grant execute on function public.rsvp_panel_assign(text, uuid[], uuid, text) to anon, authenticated;
grant execute on function public.rsvp_panel_swap(text, uuid, uuid, text)     to anon, authenticated;

commit;

notify pgrst, 'reload schema';
