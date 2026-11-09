-- =============================================================================
-- STUDIO SEOZ — ANI ALBÜMÜ YÖNETİMİ: 30 gün saklama BİLGİSİ + elle "Albüm Verilerini Sil"
-- -----------------------------------------------------------------------------
-- Ön koşul: ani-yukleme.sql kurulmuş olmalı. Tekrar çalıştırmak güvenlidir.
-- Geri almak için: ani-albumu-yonetim-geri-al.sql
--
-- Ne ekler:
--   • memory_albums'a 3 sütun:
--       event_date      etkinlik tarihi (yayında davetiyeden gelir; editörde gösterilir)
--       retention_days  saklama süresi BİLGİSİ (YENİ albümlerde 30; MEVCUT albümlerde boş =
--                       kural yok — geriye dönük uygulanmaz; demolar için editörden kapatılabilir)
--       purged_at       "Albüm Verilerini Sil" ile verilerin silindiği an
--   • Studio SEOZ (yalnızca sahip) için: albüm bilgisi/ayarı ve albüm kayıtlarını temizleme.
--   • Tek tek silme düzeltmesi: müşteri albümünde "Sil"e basılan dosya artık depodan da silinir.
--
-- Ne YAPMAZ:
--   • OTOMATİK SİLME YOK: cron, zamanlayıcı, Edge Function, pg_cron, pg_net kurulmaz.
--     Süre dolunca hiçbir şey kendiliğinden silinmez veya kapanmaz.
--   • Depolama izinleri YALNIZCA "ani-yukleme" bucket'ı içindir. davetiye-medya, order-uploads,
--     product-images ve diğer bucket'lara, Katılım (rsvp_*) ve published_invitations tablolarına,
--     mevcut politikalara DOKUNMAZ.
--
-- Silme nasıl güvenli:
--   • Dosyalar Supabase Storage arayüzü ile silinir (veritabanından doğrudan silmek dosyayı
--     depoda yetim bırakır).
--   • Studio SEOZ: yalnızca giriş yapmış sahip (seoz_is_owner) "ani-yukleme" içindeki dosyaları
--     listeleyip silebilir.
--   • Müşteri (gizli albüm linki): yalnızca KENDİ albümünde "Sil" dediği dosya için 15 dakikalık
--     tek seferlik silme izni oluşur; başka hiçbir dosyayı silemez/listeleyemez.
-- =============================================================================

begin;

do $$
begin
  if to_regclass('public.memory_albums') is null then raise exception 'Önce ani-yukleme.sql çalıştırılmalı.'; end if;
end $$;

-- 1) Sütunlar (mevcut albümler: retention_days BOŞ kalır → saklama kuralı geriye dönük uygulanmaz) ----
alter table public.memory_albums add column if not exists event_date date;
alter table public.memory_albums add column if not exists retention_days integer check (retention_days is null or retention_days between 1 and 365);
alter table public.memory_albums add column if not exists purged_at timestamptz;
alter table public.memory_albums alter column retention_days set default 30;   -- yalnızca bundan sonra açılan albümler

-- 2) Yükleme kabulü: verileri silinmiş albüm yükleme almaz ---------------------------------------------
create or replace function public.memory_album_accepts(p_slug text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memory_albums a
    where a.invitation_slug = p_slug and a.is_open and a.purged_at is null
      and (select count(*) from public.memory_uploads u where u.invitation_slug = a.invitation_slug) < a.max_files)
$$;

-- 3) Yayın senkronu: etkinlik tarihi de kaydedilir; silinmiş albüm yeniden açılmaz ----------------------
drop function if exists public.memory_owner_sync(text);
create or replace function public.memory_owner_sync(p_slug text, p_event_date date default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_token text := null; al public.memory_albums%rowtype;
begin
  if not public.seoz_is_owner() then raise exception 'not_owner'; end if;
  if not exists (select 1 from public.published_invitations where slug = p_slug) then raise exception 'invitation_not_found'; end if;
  insert into public.memory_albums (invitation_slug, event_date) values (p_slug, p_event_date)
  on conflict (invitation_slug) do update set updated_at = now(),
    event_date = coalesce(excluded.event_date, public.memory_albums.event_date)
  returning * into al;
  if al.panel_token_hash is null then
    v_token := seoz_private.new_token();
    update public.memory_albums set panel_token_hash = seoz_private.hash_token(v_token), panel_token_rotated_at = now() where invitation_slug = p_slug;
  end if;
  return jsonb_build_object('panel_token', v_token, 'is_open', al.is_open, 'event_date', al.event_date,
    'retention_days', al.retention_days, 'purged_at', al.purged_at,
    'files', (select count(*) from public.memory_uploads u where u.invitation_slug = p_slug));
end $$;

-- 4) Studio SEOZ: albüm bilgisi ve ayarı (etkinlik tarihi, saklama kuralı açık/kapalı) -----------------
create or replace function public.memory_owner_album_info(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare al public.memory_albums%rowtype;
begin
  if not public.seoz_is_owner() then raise exception 'not_owner'; end if;
  select * into al from public.memory_albums where invitation_slug = p_slug;
  if al.invitation_slug is null then raise exception 'album_not_found'; end if;
  return jsonb_build_object('slug', al.invitation_slug, 'is_open', al.is_open, 'event_date', al.event_date,
    'retention_days', al.retention_days, 'purged_at', al.purged_at,
    'files', (select count(*) from public.memory_uploads u where u.invitation_slug = p_slug),
    'bytes', (select coalesce(sum(u.size_bytes), 0) from public.memory_uploads u where u.invitation_slug = p_slug));
end $$;

create or replace function public.memory_owner_album_settings(p_slug text, p_event_date date, p_retention_days integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_slug text;
begin
  if not public.seoz_is_owner() then raise exception 'not_owner'; end if;
  if p_retention_days is not null and (p_retention_days < 1 or p_retention_days > 365) then raise exception 'invalid_retention'; end if;
  update public.memory_albums set event_date = p_event_date, retention_days = p_retention_days, updated_at = now()
    where invitation_slug = p_slug returning invitation_slug into v_slug;
  if v_slug is null then raise exception 'album_not_found'; end if;
  return public.memory_owner_album_info(p_slug);
end $$;

-- 5) Studio SEOZ: "Albüm Verilerini Sil" — dosyalar Storage'dan silindikten SONRA çağrılır ----------------
--    Albümün dosya kayıtlarını siler, albümü kapatır ve silinme anını yazar. Albüm satırı (link) kalır:
--    müşteri linki açınca "süresi doldu / silindi" mesajını görür. Yalnızca bu albümün kayıtları.
create or replace function public.memory_owner_purge(p_slug text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_n integer; v_slug text;
begin
  if not public.seoz_is_owner() then raise exception 'not_owner'; end if;
  select invitation_slug into v_slug from public.memory_albums where invitation_slug = p_slug;
  if v_slug is null then raise exception 'album_not_found'; end if;
  -- Depoda bu albüme ait dosya kaldıysa durur: önce dosyalar silinmeli (yarım silme olmaz).
  if exists (select 1 from storage.objects o where o.bucket_id = 'ani-yukleme' and (storage.foldername(o.name))[1] = p_slug) then
    raise exception 'storage_not_empty';
  end if;
  delete from public.memory_uploads where invitation_slug = p_slug;
  get diagnostics v_n = row_count;
  update public.memory_albums set is_open = false, purged_at = now(), updated_at = now() where invitation_slug = p_slug;
  delete from seoz_private.memory_delete_grants g where g.object_path like p_slug || '/%';
  return jsonb_build_object('ok', true, 'removed_records', v_n);
end $$;

-- 6) Tek tek silme: müşteri "Sil" dediğinde o dosya için kısa süreli silme izni ------------------------
create table if not exists seoz_private.memory_delete_grants (
  object_path text primary key,
  granted_at  timestamptz not null default now()
);
revoke all on seoz_private.memory_delete_grants from public, anon, authenticated;

create or replace function public.memory_delete_allowed(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from seoz_private.memory_delete_grants g
                 where g.object_path = p_name and g.granted_at > now() - interval '15 minutes')
$$;

create or replace function public.memory_panel_remove(p_token text, p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare al public.memory_albums%rowtype; v_path text;
begin
  select * into al from seoz_private.album_by_token(p_token);
  if al.invitation_slug is null then raise exception 'invalid_token'; end if;
  delete from public.memory_uploads where id = p_id and invitation_slug = al.invitation_slug returning object_path into v_path;
  if v_path is not null then
    insert into seoz_private.memory_delete_grants (object_path) values (v_path)
    on conflict (object_path) do update set granted_at = now();
  end if;
  delete from seoz_private.memory_delete_grants g where g.granted_at < now() - interval '1 day';
  return jsonb_build_object('ok', true, 'path', v_path);
end $$;

-- 7) Müşteri albüm paneli: dil, etkinlik tarihi, saklama bilgisi; silinmiş albümde dosya listesi yok --------
create or replace function public.memory_panel_get(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare al public.memory_albums%rowtype; d jsonb;
begin
  select * into al from seoz_private.album_by_token(p_token);
  if al.invitation_slug is null then raise exception 'invalid_token'; end if;
  select p.document_data into d from public.published_invitations p where p.slug = al.invitation_slug;
  if al.purged_at is not null then
    return jsonb_build_object('slug', al.invitation_slug, 'purged', true, 'is_open', false,
      'title', d->'meta'->>'title', 'lang', d->'meta'->>'lang', 'retention_days', al.retention_days, 'files', '[]'::jsonb);
  end if;
  return jsonb_build_object(
    'slug', al.invitation_slug, 'is_open', al.is_open, 'purged', false,
    'title', d->'meta'->>'title', 'lang', d->'meta'->>'lang',
    'event_date', al.event_date, 'retention_days', al.retention_days,
    'files', coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'path', u.object_path, 'mime', u.mime, 'size', u.size_bytes, 'name', u.guest_name, 'at', u.created_at) order by u.created_at desc)
                       from public.memory_uploads u where u.invitation_slug = al.invitation_slug), '[]'::jsonb));
end $$;

-- 8) Depolama izinleri — YALNIZCA "ani-yukleme" bucket'ı ---------------------------------------------------
-- Studio SEOZ (sahip): albüm klasörünü listeleyip silebilir ("Albüm Verilerini Sil").
drop policy if exists "ani-yukleme sahip listeler" on storage.objects;
create policy "ani-yukleme sahip listeler" on storage.objects for select to authenticated
  using (bucket_id = 'ani-yukleme' and public.seoz_is_owner());
drop policy if exists "ani-yukleme sahip siler" on storage.objects;
create policy "ani-yukleme sahip siler" on storage.objects for delete to authenticated
  using (bucket_id = 'ani-yukleme' and public.seoz_is_owner());
-- Müşteri: yalnızca albümünde "Sil" dediği dosya (15 dk). Storage silme işlemi satırı okuyabilmeyi de ister.
drop policy if exists "ani-yukleme izinli dosyayi gorur" on storage.objects;
create policy "ani-yukleme izinli dosyayi gorur" on storage.objects for select to anon, authenticated
  using (bucket_id = 'ani-yukleme' and public.memory_delete_allowed(name));
drop policy if exists "ani-yukleme izinli dosyayi siler" on storage.objects;
create policy "ani-yukleme izinli dosyayi siler" on storage.objects for delete to anon, authenticated
  using (bucket_id = 'ani-yukleme' and public.memory_delete_allowed(name));

-- 9) Yetkiler ------------------------------------------------------------------------------------------------
revoke all on function public.memory_owner_sync(text, date)                         from public, anon, authenticated;
revoke all on function public.memory_owner_album_info(text)                         from public, anon, authenticated;
revoke all on function public.memory_owner_album_settings(text, date, integer)      from public, anon, authenticated;
revoke all on function public.memory_owner_purge(text)                              from public, anon, authenticated;
revoke all on function public.memory_delete_allowed(text)                           from public, anon, authenticated;
revoke all on function public.memory_panel_remove(text, uuid)                       from public, anon, authenticated;
revoke all on function public.memory_panel_get(text)                                from public, anon, authenticated;
revoke all on function public.memory_album_accepts(text)                            from public, anon, authenticated;
grant execute on function public.memory_owner_sync(text, date)                         to authenticated;
grant execute on function public.memory_owner_album_info(text)                         to authenticated;
grant execute on function public.memory_owner_album_settings(text, date, integer)      to authenticated;
grant execute on function public.memory_owner_purge(text)                              to authenticated;
grant execute on function public.memory_delete_allowed(text)                           to anon, authenticated;
grant execute on function public.memory_panel_remove(text, uuid)                       to anon, authenticated;
grant execute on function public.memory_panel_get(text)                                to anon, authenticated;
grant execute on function public.memory_album_accepts(text)                            to anon, authenticated;

commit;
notify pgrst, 'reload schema';
