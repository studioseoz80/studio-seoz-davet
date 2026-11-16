-- =============================================================================
-- STUDIO SEOZ — GÜVENLİ DAVETİYE OKUMA · ÖNCESİ YEDEK
-- -----------------------------------------------------------------------------
-- guvenli-okuma.sql'den ÖNCE bir kez çalıştırılır. published_invitations'ın o anki tam kopyasını
-- herkese KAPALI özel şemaya (seoz_private) alır ve mevcut güvenlik kurallarını not eder.
-- Hiçbir mevcut kaydı değiştirmez. Kopya tablo zararsızdır; işiniz bitince elle silebilirsiniz.
-- =============================================================================
begin;
create schema if not exists seoz_private;
create table seoz_private.published_invitations_yedek_20261116 as
  select * from public.published_invitations;
create table seoz_private.published_invitations_kurallar_20261116 as
  select polname, polcmd, pg_get_expr(polqual, polrelid) as using_expr, pg_get_expr(polwithcheck, polrelid) as check_expr,
         array(select rolname from pg_roles where oid = any(polroles)) as roles
  from pg_policy where polrelid = 'public.published_invitations'::regclass;
revoke all on seoz_private.published_invitations_yedek_20261116, seoz_private.published_invitations_kurallar_20261116 from public, anon, authenticated;
commit;
-- Kontrol: select count(*) from seoz_private.published_invitations_yedek_20261116;   -- canlı tabloyla aynı sayı olmalı
