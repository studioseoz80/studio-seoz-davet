-- =============================================================================
-- DİLEK AĞACI — GERİ ALMA. dilek-agaci.sql'in kurduğu fonksiyonları ve wish_entries tablosunu kaldırır.
-- DİKKAT: bırakılmış bütün dilekler silinir. Katılım, masa planı, anı albümü, anket ve
-- published_invitations yapılarına dokunmaz. (wish_owner_ensure_panel ile açılmış boş sorulu
-- etkinlik kayıtları rsvp_events'te kalır; panel linkleri çalışmaya devam eder.)
-- =============================================================================
begin;
drop function if exists public.wish_owner_count(text);
drop function if exists public.wish_owner_purge(text);
drop function if exists public.wish_owner_ensure_panel(text, text);
drop function if exists public.wish_panel_delete(text, uuid, text);
drop function if exists public.wish_panel_set_hidden(text, uuid, boolean, text);
drop function if exists public.wish_panel_get(text, text);
drop function if exists public.wish_tree_add(text, text, text, text, boolean, text);
drop function if exists public.wish_tree_get(text, text);
drop function if exists seoz_private.wish_event_date(text);
drop function if exists seoz_private.wish_trees_of(text);
drop function if exists seoz_private.wish_tree_settings(text, text);
drop table if exists public.wish_entries;
commit;
notify pgrst, 'reload schema';
