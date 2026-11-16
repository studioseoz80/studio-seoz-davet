-- =============================================================================
-- STUDIO SEOZ — GÜVENLİ MÜŞTERİ ÖN İZLEMESİ (DEMO) + NİHAİ YAYIN KAYDI
-- -----------------------------------------------------------------------------
-- Ne kurar (YALNIZCA EKLEME — mevcut hiçbir tabloya, kayda, politikaya dokunmaz):
--   • demo_previews        : her ön izlemenin davetiye kopyası, süresi, iptal durumu
--                            (bağlantı anahtarının KENDİSİ saklanmaz; yalnızca SHA-256 özeti)
--   • demo_finalizations   : "Nihai Yayına Al" kayıtları (ödemeyi kim, ne zaman onayladı)
--   • Misafir (anon):
--       demo_preview_get(token)  : anahtar geçerliyse ve süresi DOLMAMIŞSA (sunucu saati) davetiye
--                                  kopyasını döndürür; değilse yalnızca durum (expired / revoked /
--                                  not_found). Süre kontrolü her açılışta sunucuda yapılır →
--                                  süresi dolan bağlantı kendiliğinden kapanır (cron gerekmez).
--   • Studio SEOZ (seoz_is_owner):
--       demo_owner_create / demo_owner_update / demo_owner_extend / demo_owner_revoke /
--       demo_owner_list / demo_owner_delete / demo_owner_finalize / demo_owner_finalizations
--
-- Ön izleme verisi KAYIT YAPAMAZ: ön izleme sayfası yayınlanmış bir davetiye değildir; gerçek
-- davetiye adresini (slug) bilmez. Katılım, anket, anı yükleme, dilek gibi kayıt fonksiyonları
-- yalnızca yayınlanmış/etkinleştirilmiş davetiyelere yazar ve bilinmeyen adresi reddeder.
-- Ayrıca ön izleme kopyasından veri gönderen dış adresler (Google Form, Apps Script — yerine "#onizleme")
-- ve Mühürlü Kart'ın gizli mesajları SUNUCUDA çıkarılır.
--
-- Ne YAPMAZ: mevcut tablolara/davetiyelere dokunmaz; otomatik silme, cron, pg_net, Edge Function kurmaz.
-- Güvenlik: RLS AÇIK, tablolara doğrudan erişim yok; yalnızca aşağıdaki fonksiyonlar.
-- Ön koşul: public.seoz_is_owner(), seoz_private.new_token(), seoz_private.hash_token()
--           (katilim-faz-a.sql ile kuruludur). Tekrar çalıştırmak güvenlidir.
-- Geri almak için: guvenli-onizleme-geri-al.sql (yalnızca bu dosyanın kurduklarını kaldırır).
-- =============================================================================

begin;

do $$
begin
  if to_regprocedure('public.seoz_is_owner()') is null then raise exception 'seoz_is_owner() bulunamadı.'; end if;
  if to_regprocedure('seoz_private.new_token()') is null or to_regprocedure('seoz_private.hash_token(text)') is null then
    raise exception 'seoz_private.new_token / hash_token bulunamadı (önce katilim-faz-a.sql).';
  end if;
end $$;

create table if not exists public.demo_previews (
  id             uuid primary key default gen_random_uuid(),
  token_hash     text not null unique check (char_length(token_hash) = 64),
  doc_id         text not null check (char_length(doc_id) between 1 and 120),
  title          text not null default '' check (char_length(title) <= 200),
  document_data  jsonb not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  expires_at     timestamptz not null,
  revoked_at     timestamptz,
  finalized_at   timestamptz,
  view_count     integer not null default 0,
  last_viewed_at timestamptz
);
create index if not exists demo_previews_doc_idx on public.demo_previews (doc_id);
alter table public.demo_previews enable row level security;
revoke all on public.demo_previews from public, anon, authenticated;

create table if not exists public.demo_finalizations (
  id            uuid primary key default gen_random_uuid(),
  doc_id        text not null check (char_length(doc_id) between 1 and 120),
  slug          text not null check (char_length(slug) between 3 and 120),
  note          text not null default '' check (char_length(note) <= 500),
  confirmed_by  text not null default '',
  confirmed_at  timestamptz not null default now()
);
create index if not exists demo_finalizations_doc_idx on public.demo_finalizations (doc_id);
alter table public.demo_finalizations enable row level security;
revoke all on public.demo_finalizations from public, anon, authenticated;

-- Ön izleme kopyasından veri gönderen dış adresleri ve gizli mesajları çıkarır (her düzeyde).
create or replace function seoz_private.demo_strip(j jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare k text; v jsonb; out jsonb; i integer;
begin
  if j is null then return null; end if;
  if jsonb_typeof(j) = 'object' then
    out := '{}'::jsonb;
    for k, v in select key, value from jsonb_each(j) loop
      -- Mühürlü Kart'ın gizli mesajları: tamamen çıkarılır
      if k in ('msgTr', 'msgEn') then continue; end if;
      -- Veri gönderen dış adresler (Google Form: Görüş Bildir / Anket / RSVP; Apps Script: Anı Yükle-Drive):
      -- düğmenin görünümü bozulmasın diye değer "#onizleme" ile değiştirilir — gerçek adres kopyada YOKTUR.
      if k in ('fbFormUrl', 'pollFormUrl', 'googleFormUrl', 'uploadUrl') then
        out := out || jsonb_build_object(k, case when jsonb_typeof(v) = 'string' and btrim(v #>> '{}') <> '' then to_jsonb('#onizleme'::text) else v end);
        continue;
      end if;
      out := out || jsonb_build_object(k, seoz_private.demo_strip(v));
    end loop;
    return out;
  elsif jsonb_typeof(j) = 'array' then
    out := '[]'::jsonb;
    for i in 0 .. jsonb_array_length(j) - 1 loop out := out || jsonb_build_array(seoz_private.demo_strip(j -> i)); end loop;
    return out;
  end if;
  return j;
end $$;

create or replace function seoz_private.demo_doc_ok(p jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select p is not null and jsonb_typeof(p) = 'object' and jsonb_typeof(p -> 'layers') = 'array' and pg_column_size(p) <= 5000000
$$;

-- STUDIO SEOZ: yeni ön izleme. Bağlantı anahtarı YALNIZCA burada bir kez döner.
create or replace function public.demo_owner_create(p_doc_id text, p_title text, p_doc jsonb, p_days integer default 7)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_token text; v_id uuid; v_exp timestamptz; v_days integer := coalesce(p_days, 7);
begin
  if not public.seoz_is_owner() then raise exception 'not_owner'; end if;
  if p_doc_id is null or char_length(p_doc_id) not between 1 and 120 then raise exception 'invalid_doc'; end if;
  if not seoz_private.demo_doc_ok(p_doc) then raise exception 'invalid_doc'; end if;
  if v_days not between 1 and 60 then raise exception 'invalid_days'; end if;
  v_token := seoz_private.new_token();
  v_exp := now() + make_interval(days => v_days);
  insert into public.demo_previews (token_hash, doc_id, title, document_data, expires_at)
  values (seoz_private.hash_token(v_token), p_doc_id, left(coalesce(p_title, ''), 200), seoz_private.demo_strip(p_doc), v_exp)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'token', v_token, 'expires_at', v_exp);
end $$;

-- STUDIO SEOZ: aynı bağlantının içeriğini yeni sürümle değiştirir (süre değişmez).
create or replace function public.demo_owner_update(p_id uuid, p_doc jsonb, p_title text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.demo_previews%rowtype;
begin
  if not public.seoz_is_owner() then raise exception 'not_owner'; end if;
  if not seoz_private.demo_doc_ok(p_doc) then raise exception 'invalid_doc'; end if;
  select * into r from public.demo_previews where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if r.revoked_at is not null or r.finalized_at is not null then raise exception 'closed'; end if;
  update public.demo_previews set document_data = seoz_private.demo_strip(p_doc), title = coalesce(left(p_title, 200), title), updated_at = now() where id = p_id;
  return jsonb_build_object('ok', true, 'expires_at', r.expires_at);
end $$;

-- STUDIO SEOZ: süre uzatma (süresi dolmuşsa şimdiden itibaren). En fazla bugünden 90 gün sonrası.
create or replace function public.demo_owner_extend(p_id uuid, p_days integer default 7)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.demo_previews%rowtype; v_exp timestamptz;
begin
  if not public.seoz_is_owner() then raise exception 'not_owner'; end if;
  if p_days is null or p_days not between 1 and 60 then raise exception 'invalid_days'; end if;
  select * into r from public.demo_previews where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if r.revoked_at is not null or r.finalized_at is not null then raise exception 'closed'; end if;
  v_exp := least(greatest(r.expires_at, now()) + make_interval(days => p_days), now() + interval '90 days');
  update public.demo_previews set expires_at = v_exp, updated_at = now() where id = p_id;
  return jsonb_build_object('ok', true, 'expires_at', v_exp);
end $$;

-- STUDIO SEOZ: bağlantıyı iptal eder (geri alınamaz; gerekirse yeni ön izleme oluşturulur).
create or replace function public.demo_owner_revoke(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not public.seoz_is_owner() then raise exception 'not_owner'; end if;
  update public.demo_previews set revoked_at = coalesce(revoked_at, now()), updated_at = now() where id = p_id;
  if not found then raise exception 'not_found'; end if;
  return jsonb_build_object('ok', true);
end $$;

-- STUDIO SEOZ: bir davetiyenin ön izlemeleri (davetiye kopyası ve anahtar DÖNMEZ).
create or replace function public.demo_owner_list(p_doc_id text)
returns jsonb language plpgsql security definer stable set search_path = '' as $$
begin
  if not public.seoz_is_owner() then raise exception 'not_owner'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'created_at', created_at, 'updated_at', updated_at,
      'expires_at', expires_at, 'revoked_at', revoked_at, 'finalized_at', finalized_at, 'view_count', view_count,
      'last_viewed_at', last_viewed_at, 'now', now()) order by created_at desc)
    from public.demo_previews where doc_id = p_doc_id), '[]'::jsonb);
end $$;

-- STUDIO SEOZ: kapanmış (iptal / süresi dolmuş / nihai yayına alınmış) bir ön izleme kaydını ELLE siler.
create or replace function public.demo_owner_delete(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.demo_previews%rowtype;
begin
  if not public.seoz_is_owner() then raise exception 'not_owner'; end if;
  select * into r from public.demo_previews where id = p_id;
  if not found then raise exception 'not_found'; end if;
  if r.revoked_at is null and r.finalized_at is null and r.expires_at > now() then raise exception 'still_active'; end if;
  delete from public.demo_previews where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

-- STUDIO SEOZ: "Nihai Yayına Al" — ödeme onayı kaydı + o davetiyenin açık ön izlemelerini kapatır.
-- Ödeme otomatik doğrulanmaz: bu kayıt, yöneticinin açık onayıyla (p_confirm = true) yapılır.
create or replace function public.demo_owner_finalize(p_doc_id text, p_slug text, p_note text, p_confirm boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare n integer; v_who text;
begin
  if not public.seoz_is_owner() then raise exception 'not_owner'; end if;
  if p_confirm is distinct from true then raise exception 'payment_not_confirmed'; end if;
  if p_doc_id is null or char_length(p_doc_id) not between 1 and 120 then raise exception 'invalid_doc'; end if;
  if p_slug is null or p_slug !~ '^[a-z0-9](?:[a-z0-9-]{1,78})[a-z0-9]$' then raise exception 'invalid_slug'; end if;
  if not exists (select 1 from public.published_invitations where slug = p_slug) then raise exception 'not_published'; end if;
  v_who := coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'email', '');
  insert into public.demo_finalizations (doc_id, slug, note, confirmed_by) values (p_doc_id, p_slug, left(coalesce(p_note, ''), 500), v_who);
  select count(*) into n from public.demo_previews where doc_id = p_doc_id and finalized_at is null and revoked_at is null and expires_at > now();   -- o an AÇIK olanlar
  update public.demo_previews set finalized_at = now(), updated_at = now() where doc_id = p_doc_id and finalized_at is null;
  return jsonb_build_object('ok', true, 'closed_previews', n, 'confirmed_at', now());
end $$;

create or replace function public.demo_owner_finalizations(p_doc_id text)
returns jsonb language plpgsql security definer stable set search_path = '' as $$
begin
  if not public.seoz_is_owner() then raise exception 'not_owner'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('slug', slug, 'note', note, 'confirmed_by', confirmed_by, 'confirmed_at', confirmed_at) order by confirmed_at desc)
    from public.demo_finalizations where doc_id = p_doc_id), '[]'::jsonb);
end $$;

-- MİSAFİR: ön izlemeyi açar. Süre / iptal kontrolü SUNUCU saatiyle; geçersizse davetiye kopyası DÖNMEZ.
create or replace function public.demo_preview_get(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.demo_previews%rowtype;
begin
  if p_token is null or char_length(p_token) not between 20 and 100 then return jsonb_build_object('status', 'not_found'); end if;
  select * into r from public.demo_previews where token_hash = seoz_private.hash_token(p_token);
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  if r.finalized_at is not null then return jsonb_build_object('status', 'finalized'); end if;
  if r.revoked_at is not null then return jsonb_build_object('status', 'revoked'); end if;
  if now() >= r.expires_at then return jsonb_build_object('status', 'expired', 'expires_at', r.expires_at); end if;
  update public.demo_previews set view_count = view_count + 1, last_viewed_at = now() where id = r.id;
  return jsonb_build_object('status', 'ok', 'doc', r.document_data, 'expires_at', r.expires_at, 'now', now());
end $$;

revoke all on function public.demo_owner_create(text, text, jsonb, integer)       from public, anon, authenticated;
revoke all on function public.demo_owner_update(uuid, jsonb, text)                 from public, anon, authenticated;
revoke all on function public.demo_owner_extend(uuid, integer)                     from public, anon, authenticated;
revoke all on function public.demo_owner_revoke(uuid)                              from public, anon, authenticated;
revoke all on function public.demo_owner_list(text)                                from public, anon, authenticated;
revoke all on function public.demo_owner_delete(uuid)                              from public, anon, authenticated;
revoke all on function public.demo_owner_finalize(text, text, text, boolean)       from public, anon, authenticated;
revoke all on function public.demo_owner_finalizations(text)                       from public, anon, authenticated;
revoke all on function public.demo_preview_get(text)                               from public, anon, authenticated;
revoke all on function seoz_private.demo_strip(jsonb)                              from public, anon, authenticated;
revoke all on function seoz_private.demo_doc_ok(jsonb)                             from public, anon, authenticated;
grant execute on function public.demo_owner_create(text, text, jsonb, integer)     to authenticated;
grant execute on function public.demo_owner_update(uuid, jsonb, text)              to authenticated;
grant execute on function public.demo_owner_extend(uuid, integer)                  to authenticated;
grant execute on function public.demo_owner_revoke(uuid)                           to authenticated;
grant execute on function public.demo_owner_list(text)                             to authenticated;
grant execute on function public.demo_owner_delete(uuid)                           to authenticated;
grant execute on function public.demo_owner_finalize(text, text, text, boolean)    to authenticated;
grant execute on function public.demo_owner_finalizations(text)                    to authenticated;
grant execute on function public.demo_preview_get(text)                            to anon, authenticated;

commit;
notify pgrst, 'reload schema';
