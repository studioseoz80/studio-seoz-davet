-- =============================================================================
-- STUDIO SEOZ — GÜVENLİ DAVETİYE OKUMA · 2. AŞAMANIN GERİ ALINMASI (ACİL DÖNÜŞ)
-- -----------------------------------------------------------------------------
-- "herkes okur" kuralını eski hâliyle geri koyar (toplu okuma yeniden AÇILIR — yalnızca sorun
-- giderilene kadar kullanın). "sahip okur" kuralı zararsızdır, yerinde kalır. Veri değişmez.
-- =============================================================================
begin;
drop policy if exists "herkes okur" on public.published_invitations;
create policy "herkes okur" on public.published_invitations for select to anon, authenticated using (true);
commit;
