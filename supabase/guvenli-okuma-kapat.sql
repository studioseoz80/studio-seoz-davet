-- =============================================================================
-- STUDIO SEOZ — GÜVENLİ DAVETİYE OKUMA (2. AŞAMA: TOPLU OKUMAYI KAPAT)
-- -----------------------------------------------------------------------------
-- YALNIZCA ŞUNLARDAN SONRA çalıştırılır:
--   1) guvenli-okuma.sql canlıda kurulu,
--   2) yeni site kodu (guvenli-okuma dalı) iki Cloudflare projesinde de yayında,
--   3) gerçek davetiyeler, editörden yayınlama, katılım paneli, anı albümü, anket, dilek ağacı,
--      takvim dosyası ve paylaşım önizlemesi yeni kodla denenmiş ve sorunsuz.
--
-- Ne yapar:
--   • "herkes okur" kuralını kaldırır → herkese açık anahtarla tablo artık LİSTELENEMEZ / okunamaz.
--     Davetiyeler invitation_get() ile (yalnızca tam bağlantı adıyla, tek tek) açılmaya devam eder.
--   • "sahip okur" kuralını ekler: yalnızca Studio SEOZ hesabı tabloyu okuyabilir (eski yayınlama
--     yolu ve Supabase panelinden bakmak için). Başka giriş yapmış hesaplar da okuyamaz.
--
-- Ne YAPMAZ: veri silmez/değiştirmez; yayınlama kurallarına ("sahip ekler", "sahip gunceller") dokunmaz.
-- Geri almak için (sorun çıkarsa, anında): guvenli-okuma-kapat-geri-al.sql
-- =============================================================================
begin;

do $$
begin
  if to_regprocedure('public.invitation_get(text)') is null then
    raise exception 'Önce guvenli-okuma.sql kurulmalı (invitation_get yok). Kural KAPATILMADI.';
  end if;
end $$;

drop policy if exists "sahip okur" on public.published_invitations;
create policy "sahip okur" on public.published_invitations for select to authenticated using (public.seoz_is_owner());
drop policy if exists "herkes okur" on public.published_invitations;

commit;
