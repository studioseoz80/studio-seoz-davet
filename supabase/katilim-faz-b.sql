-- =============================================================================
-- STUDIO SEOZ — KATILIMCI & ETKİNLİK YÖNETİM SİSTEMİ — FAZ B (MÜŞTERİ PANELİ)
-- -----------------------------------------------------------------------------
-- Ön koşul: katilim-faz-a.sql kurulmuş olmalı.
--
-- Ne kurar: Müşteri panelinin (panel.html#k=...) kullandığı güvenli fonksiyonlar.
--   • rsvp_panel_get            : etkinliğin özeti, soruları, tüm yanıtları
--   • rsvp_panel_save_settings  : panel ayarları (ör. kart isimleri)
--   • rsvp_panel_set_open       : formu yanıtlara aç / kapat
--   • rsvp_panel_delete_response: (ör. mükerrer) bir yanıtı sil
--
-- Güvenlik:
--   • Her fonksiyon panel anahtarının ÖZETİNİ (SHA-256) veritabanındakiyle
--     karşılaştırır ve YALNIZCA o anahtarın etkinliğine ait verileri döndürür
--     / değiştirir. Slug veya kimlik değiştirmek başka etkinliği açmaz.
--   • Tablolara doğrudan erişim Faz A'daki gibi KAPALI kalır.
--   • İleride isteğe bağlı PIN: rsvp_events.panel_pin_hash doluysa, doğru
--     p_pin verilmeden hiçbir veri dönmez (şu an hiçbir etkinlikte PIN yok).
--   • Studio SEOZ anahtarı yenilerse (rsvp_owner_rotate_panel_token) eski
--     link anında çalışmaz hale gelir.
--
-- Tablo yapısı DEĞİŞMEZ. Tekrar çalıştırmak güvenlidir.
-- =============================================================================

begin;

do $$
begin
  if to_regclass('public.rsvp_events') is null then
    raise exception 'Önce katilim-faz-a.sql kurulmalı.';
  end if;
end $$;

-- Anahtardan etkinliği bulur; geçersizse anlaşılır hata ile durur.
create or replace function seoz_private.event_by_panel_token(p_token text, p_pin text)
returns public.rsvp_events language plpgsql stable set search_path = '' as $$
declare ev public.rsvp_events%rowtype;
begin
  if p_token is null or char_length(p_token) not between 20 and 100 then raise exception 'invalid_panel'; end if;
  select * into ev from public.rsvp_events where panel_token_hash = seoz_private.hash_token(p_token);
  if not found then raise exception 'invalid_panel'; end if;
  if ev.panel_pin_hash is not null then
    if p_pin is null or seoz_private.hash_token(ev.id::text || ':' || p_pin) <> ev.panel_pin_hash then
      raise exception 'pin_required';
    end if;
  end if;
  return ev;
end $$;

revoke all on function seoz_private.event_by_panel_token(text, text) from public, anon, authenticated;

-- Panelin ihtiyaç duyduğu her şey tek çağrıda.
create or replace function public.rsvp_panel_get(p_token text, p_pin text default null)
returns jsonb language plpgsql security definer stable set search_path = '' as $$
declare ev public.rsvp_events%rowtype; v_title text;
begin
  ev := seoz_private.event_by_panel_token(p_token, p_pin);
  select document_data->'meta'->>'title' into v_title from public.published_invitations where slug = ev.invitation_slug;
  return jsonb_build_object(
    'event', jsonb_build_object(
      'slug', ev.invitation_slug, 'title', coalesce(v_title, ''), 'is_open', ev.is_open,
      'form', ev.form_schema, 'settings', ev.panel_settings, 'max_responses', ev.max_responses,
      'created_at', ev.created_at, 'updated_at', ev.updated_at),
    'responses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'name', r.respondent_name, 'attending', r.attending, 'party_size', r.party_size,
        'answers', r.answers, 'consent', r.consent_given,
        'created_at', r.created_at, 'updated_at', r.updated_at, 'update_count', r.update_count,
        'attendees', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'position', a.position, 'name', a.full_name) order by a.position)
                               from public.rsvp_attendees a where a.response_id = r.id), '[]'::jsonb)
      ) order by r.created_at)
      from public.rsvp_responses r where r.event_id = ev.id), '[]'::jsonb)
  );
end $$;

-- Panel ayarları (kart isimleri vb.). Yalnızca küçük bir JSON nesnesi kabul edilir.
create or replace function public.rsvp_panel_save_settings(p_token text, p_settings jsonb, p_pin text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare ev public.rsvp_events%rowtype;
begin
  ev := seoz_private.event_by_panel_token(p_token, p_pin);
  if p_settings is null or jsonb_typeof(p_settings) <> 'object' or pg_column_size(p_settings) > 20000 then
    raise exception 'invalid_settings';
  end if;
  update public.rsvp_events set panel_settings = p_settings, updated_at = now() where id = ev.id;
  return jsonb_build_object('ok', true);
end $$;

-- Formu yanıtlara aç / kapat.
create or replace function public.rsvp_panel_set_open(p_token text, p_open boolean, p_pin text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare ev public.rsvp_events%rowtype;
begin
  ev := seoz_private.event_by_panel_token(p_token, p_pin);
  update public.rsvp_events set is_open = coalesce(p_open, true), updated_at = now() where id = ev.id;
  return jsonb_build_object('ok', true, 'is_open', coalesce(p_open, true));
end $$;

-- Bir yanıtı (ör. mükerrer kayıt) siler. Yalnızca BU etkinliğin yanıtı silinebilir.
create or replace function public.rsvp_panel_delete_response(p_token text, p_response_id uuid, p_pin text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare ev public.rsvp_events%rowtype; v_n integer;
begin
  ev := seoz_private.event_by_panel_token(p_token, p_pin);
  delete from public.rsvp_responses where id = p_response_id and event_id = ev.id;
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'response_not_found'; end if;
  return jsonb_build_object('ok', true, 'deleted', v_n);
end $$;

revoke all on function public.rsvp_panel_get(text, text)                         from public, anon, authenticated;
revoke all on function public.rsvp_panel_save_settings(text, jsonb, text)        from public, anon, authenticated;
revoke all on function public.rsvp_panel_set_open(text, boolean, text)           from public, anon, authenticated;
revoke all on function public.rsvp_panel_delete_response(text, uuid, text)       from public, anon, authenticated;
grant execute on function public.rsvp_panel_get(text, text)                      to anon, authenticated;
grant execute on function public.rsvp_panel_save_settings(text, jsonb, text)     to anon, authenticated;
grant execute on function public.rsvp_panel_set_open(text, boolean, text)        to anon, authenticated;
grant execute on function public.rsvp_panel_delete_response(text, uuid, text)    to anon, authenticated;

commit;

notify pgrst, 'reload schema';
