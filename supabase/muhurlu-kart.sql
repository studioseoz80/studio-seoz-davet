-- =============================================================================
-- STUDIO SEOZ — MÜHÜRLÜ KART · GİZLİ MESAJLARIN SUNUCUDA KORUNMASI
-- -----------------------------------------------------------------------------
-- Ne kurar (YALNIZCA EKLEME):
--   • sealed_card_messages : her Mühürlü Kart'ın gizli mesajları (TR/EN) ve açılma anı (UTC)
--   • Studio SEOZ (giriş yapmış sahip):
--       sealed_owner_sync  : "Yayına Hazırla" sırasında, davetiye kaydedilmeden ÖNCE mesajları yazar
--                            (o davetiyenin mesajlarını baştan kurar); başarısızsa yayın durur
--       sealed_owner_purge : bir davetiyenin mesajlarını ELLE siler
--   • Misafir:
--       sealed_card_get    : seçtiği TEK kartın mesajını ister; sunucu kendi saatiyle (UTC, now())
--                            açılma anını kontrol eder. Öncesinde YALNIZCA açılma anını ve sunucu
--                            saatini döndürür — mesaj metni hiçbir koşulda erken dönmez.
--
-- Böylece gizli mesajlar herkese açık davetiye verisine (published_invitations) ve sayfa koduna HİÇ
-- girmez; telefonun saatini ileri almak mesajı açmaz (karar sunucu saatindedir).
--
-- Ne YAPMAZ: mevcut hiçbir tabloya/kayda dokunmaz; otomatik silme, cron, pg_net, Edge Function kurmaz.
-- Güvenlik: RLS AÇIK, tabloya doğrudan erişim yok; yalnızca aşağıdaki fonksiyonlar.
-- Ön koşul: public.seoz_is_owner(). Tekrar çalıştırmak güvenlidir.
-- Geri almak için: muhurlu-kart-geri-al.sql (DİKKAT: saklanan gizli mesajlar silinir).
-- =============================================================================

begin;

do $$
begin
  if to_regprocedure('public.seoz_is_owner()') is null then raise exception 'seoz_is_owner() bulunamadı.'; end if;
end $$;

create table if not exists public.sealed_card_messages (
  invitation_slug  text not null check (char_length(invitation_slug) between 3 and 120),
  layer_id         text not null check (char_length(layer_id) between 1 and 120),
  card_index       integer not null check (card_index between 0 and 499),
  msg_tr           text not null default '' check (char_length(msg_tr) <= 2000),
  msg_en           text not null default '' check (char_length(msg_en) <= 2000),
  unlock_at        timestamptz not null,
  updated_at       timestamptz not null default now(),
  primary key (invitation_slug, layer_id, card_index)
);
alter table public.sealed_card_messages enable row level security;
revoke all on public.sealed_card_messages from public, anon, authenticated;

-- p_layers: [{ "layer_id": "...", "unlock_at": "2027-01-01T04:59:00Z", "cards": [{ "tr": "...", "en": "..." }, ...] }, ...]
create or replace function public.sealed_owner_sync(p_slug text, p_layers jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare l jsonb; c jsonb; i integer; n integer := 0; v_at timestamptz;
begin
  if not public.seoz_is_owner() then raise exception 'not_owner'; end if;
  if p_slug is null or char_length(p_slug) not between 3 and 120 then raise exception 'invalid_slug'; end if;
  if p_layers is null or jsonb_typeof(p_layers) <> 'array' or jsonb_array_length(p_layers) > 20 or pg_column_size(p_layers) > 600000 then
    raise exception 'invalid_cards';
  end if;
  delete from public.sealed_card_messages where invitation_slug = p_slug;
  for l in select value from jsonb_array_elements(p_layers) loop
    if jsonb_typeof(l->'cards') <> 'array' or jsonb_array_length(l->'cards') > 500
       or char_length(coalesce(l->>'layer_id', '')) not between 1 and 120 then raise exception 'invalid_cards'; end if;
    begin v_at := (l->>'unlock_at')::timestamptz; exception when others then raise exception 'invalid_unlock'; end;
    if v_at is null then raise exception 'invalid_unlock'; end if;
    i := 0;
    for c in select value from jsonb_array_elements(l->'cards') loop
      insert into public.sealed_card_messages (invitation_slug, layer_id, card_index, msg_tr, msg_en, unlock_at)
      values (p_slug, l->>'layer_id', i, coalesce(c->>'tr', ''), coalesce(c->>'en', ''), v_at);
      i := i + 1; n := n + 1;
    end loop;
  end loop;
  return jsonb_build_object('ok', true, 'cards', n);
end $$;

-- Misafir: seçtiği kartın mesajı. Sunucu saati (now()) açılma anından önceyse mesaj DÖNMEZ.
create or replace function public.sealed_card_get(p_slug text, p_layer_id text, p_index integer)
returns jsonb language plpgsql security definer stable set search_path = '' as $$
declare r public.sealed_card_messages%rowtype;
begin
  if p_slug is null or p_layer_id is null or char_length(p_slug) > 120 or char_length(p_layer_id) > 120 or p_index is null then
    return jsonb_build_object('found', false, 'now', now());
  end if;
  select * into r from public.sealed_card_messages where invitation_slug = p_slug and layer_id = p_layer_id and card_index = p_index;
  if not found then return jsonb_build_object('found', false, 'now', now()); end if;
  if now() < r.unlock_at then
    return jsonb_build_object('found', true, 'open', false, 'unlock_at', r.unlock_at, 'now', now());
  end if;
  return jsonb_build_object('found', true, 'open', true, 'unlock_at', r.unlock_at, 'now', now(), 'msg_tr', r.msg_tr, 'msg_en', r.msg_en);
end $$;

-- Bir davetiyenin gizli mesajlarını siler (ELLE; yalnızca Studio SEOZ). Otomatik çalışan hiçbir şey yoktur.
create or replace function public.sealed_owner_purge(p_slug text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if not public.seoz_is_owner() then raise exception 'not_owner'; end if;
  delete from public.sealed_card_messages where invitation_slug = p_slug;
  get diagnostics n = row_count;
  return jsonb_build_object('ok', true, 'removed', n);
end $$;

revoke all on function public.sealed_owner_sync(text, jsonb)          from public, anon, authenticated;
revoke all on function public.sealed_card_get(text, text, integer)    from public, anon, authenticated;
revoke all on function public.sealed_owner_purge(text)                from public, anon, authenticated;
grant execute on function public.sealed_owner_sync(text, jsonb)       to authenticated;
grant execute on function public.sealed_card_get(text, text, integer) to anon, authenticated;
grant execute on function public.sealed_owner_purge(text)             to authenticated;

commit;
notify pgrst, 'reload schema';
