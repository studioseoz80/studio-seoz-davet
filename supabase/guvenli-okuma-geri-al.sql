-- =============================================================================
-- STUDIO SEOZ — GÜVENLİ DAVETİYE OKUMA · 1. AŞAMANIN GERİ ALINMASI
-- -----------------------------------------------------------------------------
-- guvenli-okuma.sql'in eklediği fonksiyonları kaldırır. Hiçbir davetiye / veri silinmez.
-- ÖNCE: guvenli-okuma-kapat.sql uygulandıysa onu guvenli-okuma-kapat-geri-al.sql ile geri alın
--       (genel okuma açılmadan bu fonksiyonlar kaldırılırsa davetiyeler açılmaz).
-- Site kodu yeni fonksiyonları bulamazsa kendiliğinden eski okuma / yayınlama yoluna döner.
-- =============================================================================
begin;
drop function if exists public.invitation_owner_publish(text, jsonb, text, text);
drop function if exists public.invitation_slug_taken(text);
drop function if exists public.invitation_get(text);
drop function if exists seoz_private.public_invitation_doc(jsonb);
commit;
