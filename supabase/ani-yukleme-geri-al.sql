-- =============================================================================
-- ANI YÜKLE (Studio SEOZ depolaması) — GERİ ALMA
-- Fonksiyonları, politikayı ve albüm tablolarını kaldırır. "ani-yukleme" bucket'ındaki dosyalar
-- SİLİNMEZ (gerekirse Supabase → Storage panelinden elle silinir). Diğer hiçbir yapıya dokunmaz.
-- DİKKAT: memory_albums / memory_uploads içindeki albüm kayıtları silinir.
-- =============================================================================
begin;
drop policy if exists "ani-yukleme misafir yukler" on storage.objects;
drop function if exists public.memory_panel_remove(text, uuid);
drop function if exists public.memory_panel_set_open(text, boolean);
drop function if exists public.memory_panel_get(text);
drop function if exists seoz_private.album_by_token(text);
drop function if exists public.memory_owner_rotate_token(text);
drop function if exists public.memory_owner_sync(text);
drop function if exists public.memory_register(text, text, text, bigint, text);
drop function if exists public.memory_album_accepts(text);
drop table if exists public.memory_uploads;
drop table if exists public.memory_albums;
-- Bucket yalnızca İÇİ BOŞSA kaldırılır (dosya varsa yerinde kalır).
delete from storage.buckets b where b.id = 'ani-yukleme' and not exists (select 1 from storage.objects o where o.bucket_id = 'ani-yukleme');
commit;
notify pgrst, 'reload schema';
