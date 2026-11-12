-- =============================================================================
-- MÜHÜRLÜ KART (gizli mesajların sunucuda korunması) — GERİ ALMA
-- muhurlu-kart.sql'in kurduğu fonksiyonları ve sealed_card_messages tablosunu kaldırır.
-- DİKKAT: saklanan gizli mesajlar silinir; yayındaki Mühürlü Kart'lar mesaj gösteremez
-- ("Mesaj şu anda alınamadı"), yeni Mühürlü Kart'lı davetiye yayınlanamaz.
-- Başka hiçbir tabloya, davetiyeye veya veriye dokunmaz.
-- =============================================================================
begin;
drop function if exists public.sealed_owner_purge(text);
drop function if exists public.sealed_card_get(text, text, integer);
drop function if exists public.sealed_owner_sync(text, jsonb);
drop table if exists public.sealed_card_messages;
commit;
notify pgrst, 'reload schema';
