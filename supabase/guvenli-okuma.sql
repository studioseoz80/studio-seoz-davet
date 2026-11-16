-- =============================================================================
-- STUDIO SEOZ — GÜVENLİ DAVETİYE OKUMA / YAYINLAMA (1. AŞAMA: YALNIZCA EKLEME)
-- -----------------------------------------------------------------------------
-- Sorun: published_invitations tablosundaki "herkes okur" kuralı (using true) yüzünden sitede
-- zaten yazılı olan herkese açık anahtarla TEK istekle bütün davetiyeler (IBAN, telefon, adres)
-- listelenebiliyor.
--
-- Bu dosya NE KURAR (hiçbir şeyi kapatmaz, hiçbir kaydı değiştirmez):
--   • seoz_private.public_invitation_doc(doc) : misafire gösterilecek kopya. Davetiyede KULLANILMAYAN
--       ama kayıtta kalmış kişisel alanları çıkarır (ör. Hediye bölümü "Kapalı"/"Link" iken eski IBAN;
--       RSVP "Google Form" iken eski WhatsApp numarası; Anı Yükle "Studio SEOZ" iken eski Drive adresi;
--       Mühürlü Kart'ın gizli mesajları). Misafirin GÖRDÜĞÜ bilgiler (konum/adres, gösterilen IBAN,
--       WhatsApp butonunun numarası, metinler, görseller) aynen kalır — davetiye eskisi gibi görünür.
--   • public.invitation_get(slug)  : herkese açık. YALNIZCA tam bağlantı adı bilinen TEK davetiyeyi,
--       yukarıdaki temizlenmiş kopyayla döndürür. Liste, joker karakter, sayfalama YOK. Bulunamazsa null.
--   • public.invitation_slug_taken(slug) : YALNIZCA Studio SEOZ (giriş yapmış sahip). Editörün yeni
--       bağlantı adı üretirken "bu ad dolu mu?" kontrolü (tablo okunamaz hâle gelince de çalışsın diye).
--   • public.invitation_owner_publish(slug, doc, doc_id, mode) : YALNIZCA Studio SEOZ. Yayınlar / günceller.
--       Bağlantı adı ile davetiye kimliğinin eşleşmesini SUNUCUDA denetler: bir bağlantı adı başka bir
--       davetiyeye aitse ÜZERİNE YAZMAZ (istemcinin gönderdiği bağlantı adına körü körüne güvenilmez).
--
-- NE YAPMAZ:
--   • "herkes okur" kuralını KALDIRMAZ (bu, ayrı ve en son adımdır: guvenli-okuma-kapat.sql).
--   • Tabloya sütun eklemez; mevcut davetiyeleri değiştirmez/silmez; Storage'a dokunmaz.
--   • Katılım (RSVP), anı albümü, anket, dilek ağacı, mühürlü kart fonksiyonlarına dokunmaz
--     (onlar zaten kendi yetkileriyle — security definer — okur; kural kapansa da etkilenmez).
--   • Cron / Edge Function / otomatik silme KURMAZ.
--
-- Ön koşul: published_invitations + seoz_is_owner() (canlıda mevcut). Tekrar çalıştırmak güvenlidir.
-- Geri almak için: guvenli-okuma-geri-al.sql (yalnızca bu fonksiyonları kaldırır; veri silinmez).
-- =============================================================================

begin;

do $$
begin
  if to_regclass('public.published_invitations') is null then raise exception 'published_invitations bulunamadı.'; end if;
  if to_regprocedure('public.seoz_is_owner()') is null then raise exception 'seoz_is_owner() bulunamadı.'; end if;
end $$;

create schema if not exists seoz_private;

-- 1) Misafire gösterilecek kopya -------------------------------------------------
create or replace function seoz_private.public_invitation_doc(d jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  out_layers jsonb := '[]'::jsonb;
  l jsonb;
  s jsonb;
  m text;
  mode text;
begin
  if d is null or jsonb_typeof(d) <> 'object' then return d; end if;
  if jsonb_typeof(d->'layers') <> 'array' then return d; end if;
  for l in select value from jsonb_array_elements(d->'layers') loop
    if jsonb_typeof(l) = 'object' and l->>'type' = 'module' and jsonb_typeof(l->'settings') = 'object' then
      s := l->'settings';
      m := l->>'moduleId';
      if m = 'gift' then
        mode := coalesce(nullif(s->>'giftMode', ''), 'kapali');                 -- varsayılan: Kapalı (modules/gift.js)
        if mode not in ('iban', 'both') then s := s - 'accountHolder' - 'iban' - 'bankName'; end if;
        if mode not in ('link', 'both') then s := s - 'giftUrl'; end if;
      elsif m = 'rsvp' then
        mode := coalesce(nullif(s->>'rsvpMode', ''), 'kapali');                 -- varsayılan: Kapalı (modules/rsvp.js)
        if mode not in ('whatsapp-tek', 'whatsapp-iki') then s := s - 'whatsappNumber'; end if;
        if mode <> 'google-form' then s := s - 'googleFormUrl'; end if;
      elsif m = 'guest-upload' then
        if coalesce(nullif(s->>'method', ''), 'drive') = 'seoz' then s := s - 'uploadUrl'; end if;   -- yöntemi olmayan eski kayıt: Drive
      elsif m = 'interactive' and s->>'kind' = 'muhurlu-kart' and coalesce((s->>'sealedSecure')::boolean, false)
            and jsonb_typeof(s->'cards') = 'array' then
        -- güvenli mühürlü kart: mesajlar zaten sunucudaki korumalı tablodadır; kopyada kalmışsa çıkarılır
        s := jsonb_set(s, '{cards}', coalesce((select jsonb_agg(case when jsonb_typeof(c) = 'object' then c - 'msgTr' - 'msgEn' else c end)
                                                from jsonb_array_elements(s->'cards') c), '[]'::jsonb));
      end if;
      l := jsonb_set(l, '{settings}', s);
    end if;
    out_layers := out_layers || jsonb_build_array(l);
  end loop;
  return jsonb_set(d, '{layers}', out_layers);
end $$;
revoke all on function seoz_private.public_invitation_doc(jsonb) from public, anon, authenticated;

-- 2) Herkese açık: tek davetiye ---------------------------------------------------
create or replace function public.invitation_get(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare d jsonb;
begin
  -- yalnızca geçerli bir bağlantı adı (küçük harf, rakam, tire; 3-120 karakter). Joker / liste yok.
  if p_slug is null or p_slug !~ '^[a-z0-9][a-z0-9-]{1,118}[a-z0-9]$' then return null; end if;
  select p.document_data into d from public.published_invitations p where p.slug = p_slug order by p.id desc limit 1;
  if d is null then return null; end if;
  return seoz_private.public_invitation_doc(d);
end $$;
revoke all on function public.invitation_get(text) from public;
grant execute on function public.invitation_get(text) to anon, authenticated;

-- 3) Sahip: bağlantı adı dolu mu? ---------------------------------------------------
create or replace function public.invitation_slug_taken(p_slug text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.seoz_is_owner() then raise exception 'not_authorized'; end if;
  if p_slug is null or p_slug !~ '^[a-z0-9][a-z0-9-]{1,118}[a-z0-9]$' then raise exception 'invalid_slug'; end if;
  return exists (select 1 from public.published_invitations where slug = p_slug);
end $$;
revoke all on function public.invitation_slug_taken(text) from public, anon;
grant execute on function public.invitation_slug_taken(text) to authenticated;

-- 4) Sahip: yayınla / güncelle -------------------------------------------------------
--    p_mode: 'create' = yalnızca yeni bağlantı (doluysa reddeder) · 'update' = yalnızca var olanı günceller
--            'any'    = yoksa oluşturur, varsa (AYNI davetiyeyse) günceller
--    Var olan kayıt BAŞKA bir davetiye kimliğine aitse hiçbir şey yazılmaz: 'slug_belongs_to_other_invitation'.
create or replace function public.invitation_owner_publish(p_slug text, p_doc jsonb, p_doc_id text, p_mode text default 'any')
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  ex record;
  ex_id text;
begin
  if not public.seoz_is_owner() then raise exception 'not_authorized'; end if;
  if p_slug is null or p_slug !~ '^[a-z0-9][a-z0-9-]{1,118}[a-z0-9]$' then raise exception 'invalid_slug'; end if;
  if p_doc is null or jsonb_typeof(p_doc) <> 'object' or jsonb_typeof(p_doc->'layers') <> 'array' then raise exception 'invalid_document'; end if;
  if coalesce(p_doc_id, '') = '' or p_doc->>'id' is distinct from p_doc_id then raise exception 'document_id_mismatch'; end if;
  if p_mode not in ('create', 'update', 'any') then raise exception 'invalid_mode'; end if;

  perform pg_advisory_xact_lock(hashtext('seoz_publish:' || p_slug));   -- aynı bağlantıya eşzamanlı iki yayın çakışmasın
  select id, document_data->>'id' as doc_id into ex from public.published_invitations where slug = p_slug order by id desc limit 1;

  if not found then
    if p_mode = 'update' then raise exception 'invitation_not_found'; end if;
    insert into public.published_invitations (slug, document_data) values (p_slug, p_doc);
    return jsonb_build_object('slug', p_slug, 'created', true);
  end if;

  if p_mode = 'create' then raise exception 'slug_taken'; end if;
  ex_id := ex.doc_id;
  -- bağlantı adı başka bir davetiyeye aitse ÜZERİNE YAZILMAZ (kimliği olmayan çok eski kayıtlar hariç)
  if ex_id is not null and ex_id <> p_doc_id then raise exception 'slug_belongs_to_other_invitation'; end if;
  update public.published_invitations set document_data = p_doc where id = ex.id;
  return jsonb_build_object('slug', p_slug, 'created', false);
end $$;
revoke all on function public.invitation_owner_publish(text, jsonb, text, text) from public, anon;
grant execute on function public.invitation_owner_publish(text, jsonb, text, text) to authenticated;

commit;
