-- =============================================================================
-- (İSTEĞE BAĞLI) GÖRÜŞ BİLDİR — KAYIT SIKILAŞTIRMA
-- -----------------------------------------------------------------------------
-- Bugün feedback_submissions tablosuna anon anahtarla HER davetiye adına (hatta adı olmayan)
-- kayıt eklenebiliyor ("misafir gorus ekler", with check true). Bu dosya, kaydı yalnızca
-- YAYINLANMIŞ bir davetiyenin adresiyle (slug) kabul edecek şekilde değiştirir:
--   → ön izleme sayfası ya da uydurma bir adres üzerinden görüş kaydı yapılamaz.
-- Yayındaki davetiyelerin Görüş Bildir formu aynen çalışır (adresleri published_invitations'da).
-- Etkilenen tek durum: adressiz (view.html?doc=… yerel önizleme) gönderimler — bunlar zaten
-- gerçek müşteri kullanımı değildir.
-- Mevcut görüş kayıtlarına DOKUNMAZ. Geri almak için: gorus-kaydi-sikilastirma-geri-al.sql
-- =============================================================================
begin;
drop policy if exists "misafir gorus ekler" on public.feedback_submissions;
create policy "misafir gorus ekler" on public.feedback_submissions for insert to anon, authenticated
  with check (invitation_slug is not null and exists (select 1 from public.published_invitations p where p.slug = invitation_slug));
commit;
notify pgrst, 'reload schema';
