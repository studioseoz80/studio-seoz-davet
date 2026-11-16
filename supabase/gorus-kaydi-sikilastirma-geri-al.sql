-- GÖRÜŞ BİLDİR — KAYIT SIKILAŞTIRMA GERİ ALMA: politikayı bugünkü (eski) hâline döndürür. Kayıtlara dokunmaz.
begin;
drop policy if exists "misafir gorus ekler" on public.feedback_submissions;
create policy "misafir gorus ekler" on public.feedback_submissions for insert to anon, authenticated with check (true);
commit;
notify pgrst, 'reload schema';
