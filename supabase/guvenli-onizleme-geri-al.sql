-- =============================================================================
-- GÜVENLİ ÖN İZLEME — GERİ ALMA. guvenli-onizleme.sql'in kurduğu fonksiyonları ve iki tabloyu kaldırır.
-- DİKKAT: bütün ön izleme kopyaları ve "Nihai Yayına Al" kayıtları silinir; verilmiş ön izleme
-- bağlantıları açılmaz olur. Yayınlanmış davetiyelere, katılım, albüm, anket, dilek verilerine DOKUNMAZ.
-- =============================================================================
begin;
drop function if exists public.demo_preview_get(text);
drop function if exists public.demo_owner_finalizations(text);
drop function if exists public.demo_owner_finalize(text, text, text, boolean);
drop function if exists public.demo_owner_delete(uuid);
drop function if exists public.demo_owner_list(text);
drop function if exists public.demo_owner_revoke(uuid);
drop function if exists public.demo_owner_extend(uuid, integer);
drop function if exists public.demo_owner_update(uuid, jsonb, text);
drop function if exists public.demo_owner_create(text, text, jsonb, integer);
drop function if exists seoz_private.demo_doc_ok(jsonb);
drop function if exists seoz_private.demo_strip(jsonb);
drop table if exists public.demo_finalizations;
drop table if exists public.demo_previews;
commit;
notify pgrst, 'reload schema';
