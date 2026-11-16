-- =============================================================================
-- STUDIO SEOZ — GÜVENLİ DAVETİYE OKUMA · KONTROL (YALNIZCA OKUR, HİÇBİR ŞEY DEĞİŞTİRMEZ)
-- -----------------------------------------------------------------------------
-- Her aşamadan sonra çalıştırılır. Sonunda ROLLBACK vardır.
-- Beklenen (2. aşamadan sonra): herkese_acik_satir = 0 ve "herkes okur" kuralı listede YOK.
-- =============================================================================
begin;
select polname, polcmd, pg_get_expr(polqual, polrelid) as using_expr from pg_policy
 where polrelid = 'public.published_invitations'::regclass order by polname;
select proname, prosecdef from pg_proc where proname in ('invitation_get', 'invitation_slug_taken', 'invitation_owner_publish');
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select count(*) as herkese_acik_satir from public.published_invitations;          -- anahtarla toplu okuma
select public.invitation_get((select null::text)) is null as bos_ad_reddedildi;    -- geçersiz ad: null
rollback;
