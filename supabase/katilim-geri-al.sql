-- =============================================================================
-- STUDIO SEOZ — KATILIM SİSTEMİNİ TAMAMEN KALDIRIR (GERİ ALMA)
-- -----------------------------------------------------------------------------
-- DİKKAT: Tüm katılım yanıtları ve etkinlik kayıtları SİLİNİR. Geri getirilemez.
-- published_invitations, feedback_submissions, Storage ve mevcut davetiyeler
-- ETKİLENMEZ.
-- =============================================================================
begin;
-- Faz B (müşteri paneli)
drop function if exists public.rsvp_panel_get(text, text);
drop function if exists public.rsvp_panel_save_settings(text, jsonb, text);
drop function if exists public.rsvp_panel_set_open(text, boolean, text);
drop function if exists public.rsvp_panel_delete_response(text, uuid, text);
-- Faz A
drop function if exists public.rsvp_submit(text, jsonb, text);
drop function if exists public.rsvp_get_own(text, text);
drop function if exists public.rsvp_owner_sync_event(text, text, text, jsonb);
drop function if exists public.rsvp_owner_rotate_panel_token(text);
drop function if exists public.rsvp_owner_set_open(text, boolean);
drop table if exists public.rsvp_attendees;
drop table if exists public.rsvp_responses;
drop table if exists public.rsvp_events;
drop schema if exists seoz_private cascade;
commit;
notify pgrst, 'reload schema';
