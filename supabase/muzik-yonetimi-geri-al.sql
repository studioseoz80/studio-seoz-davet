-- =============================================================================
-- STUDIO SEOZ — MÜŞTERİ MÜZİK YÖNETİMİ · GERİ ALMA
-- -----------------------------------------------------------------------------
-- muzik-yonetimi.sql'in eklediği FONKSİYONLARI kaldırır: "Müziğimi Yönet" sayfası ve müşteri müziğinin
-- çalınması anında durur (davetiye müziksiz açılır). Mevcut davetiyeler, Katılım Paneli, Anı Albümü etkilenmez.
-- Tablolar (onay kayıtları, işlem kayıtları) BİLEREK SİLİNMEZ: telif şikâyetinde kanıt olarak kalırlar.
-- R2'deki dosyalar bu dosyayla silinmez (Cloudflare panelinden ayrıca silinebilir).
-- =============================================================================
begin;
drop function if exists public.music_owner_forget_stale(text[]);
drop function if exists public.music_owner_delete(text);
drop function if exists public.music_owner_usage();
drop function if exists public.music_owner_list();
drop function if exists public.music_owner_set_disabled(text, boolean, text);
drop function if exists public.music_owner_rotate_token(text);
drop function if exists public.music_owner_sync(text);
drop function if exists public.music_public_get(text);
drop function if exists public.music_manage_delete(text);
drop function if exists public.music_manage_commit(text, uuid, text, integer, text, text, text, text);
drop function if exists public.music_manage_release(text, uuid);
drop function if exists public.music_manage_reserve(text, text, integer);
drop function if exists public.music_manage_info(text);
drop function if exists seoz_private.music_by_token(text);
drop function if exists seoz_private.music_usage();
drop function if exists seoz_private.music_limits();
drop function if exists seoz_private.music_consent_valid(text, text);
drop function if exists seoz_private.music_consent_sha(text);
drop function if exists seoz_private.music_consent(text);
commit;

-- Kayıtların da tamamen silinmesi gerekirse (GERİ DÖNÜŞÜ YOK — önce dışa aktarın), ayrıca çalıştırın:
--   drop table if exists public.music_upload_reservations;
--   drop table if exists public.music_log;
--   drop table if exists public.music_consents;
--   drop table if exists public.music_tracks;
