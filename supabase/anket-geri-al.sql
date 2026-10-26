-- =============================================================================
-- ANKET SİSTEMİ — GERİ ALMA. Anket fonksiyonlarını ve poll_* tablolarını kaldırır.
-- DİKKAT: anket yanıtları silinir. Katılım, masa planı ve diğer yapılara dokunmaz.
-- =============================================================================
begin;
drop function if exists public.poll_panel_delete_response(text, uuid);
drop function if exists public.poll_panel_set_open(text, boolean);
drop function if exists public.poll_panel_get(text);
drop function if exists public.poll_owner_rotate_token(text, text);
drop function if exists public.poll_owner_sync(text, text, jsonb);
drop function if exists public.poll_submit(text, text, jsonb, text);
drop function if exists public.poll_get_own(text, text, text);
drop function if exists seoz_private.survey_by_token(text);
drop function if exists seoz_private.poll_build(jsonb, jsonb);
drop table if exists public.poll_responses;
drop table if exists public.poll_surveys;
commit;
notify pgrst, 'reload schema';
