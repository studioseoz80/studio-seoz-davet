-- =============================================================================
-- ANI ALBÜMÜ YÖNETİMİ — GERİ ALMA (ani-albumu-yonetim.sql öncesine döner)
-- Yeni fonksiyonları, "ani-yukleme" için eklenen 4 depolama iznini, silme izni tablosunu ve
-- 3 yeni sütunu kaldırır; değişen 4 fonksiyonun ESKİ hâlini (ani-yukleme.sql) geri yükler.
-- Silinmiş dosyalar geri GELMEZ. Albümler, dosya kayıtları ve diğer hiçbir yapı etkilenmez.
-- =============================================================================
begin;
drop policy if exists "ani-yukleme sahip listeler" on storage.objects;
drop policy if exists "ani-yukleme sahip siler" on storage.objects;
drop policy if exists "ani-yukleme izinli dosyayi gorur" on storage.objects;
drop policy if exists "ani-yukleme izinli dosyayi siler" on storage.objects;
drop function if exists public.memory_owner_purge(text);
drop function if exists public.memory_owner_album_settings(text, date, integer);
drop function if exists public.memory_owner_album_info(text);
drop function if exists public.memory_owner_sync(text, date);

create or replace function public.memory_album_accepts(p_slug text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memory_albums a
    where a.invitation_slug = p_slug and a.is_open
      and (select count(*) from public.memory_uploads u where u.invitation_slug = a.invitation_slug) < a.max_files)
$$;

create or replace function public.memory_owner_sync(p_slug text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_token text := null; al public.memory_albums%rowtype;
begin
  if not public.seoz_is_owner() then raise exception 'not_owner'; end if;
  if not exists (select 1 from public.published_invitations where slug = p_slug) then raise exception 'invitation_not_found'; end if;
  insert into public.memory_albums (invitation_slug) values (p_slug)
  on conflict (invitation_slug) do update set updated_at = now()
  returning * into al;
  if al.panel_token_hash is null then
    v_token := seoz_private.new_token();
    update public.memory_albums set panel_token_hash = seoz_private.hash_token(v_token), panel_token_rotated_at = now() where invitation_slug = p_slug;
  end if;
  return jsonb_build_object('panel_token', v_token, 'is_open', al.is_open);
end $$;

create or replace function public.memory_panel_get(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare al public.memory_albums%rowtype;
begin
  select * into al from seoz_private.album_by_token(p_token);
  if al.invitation_slug is null then raise exception 'invalid_token'; end if;
  return jsonb_build_object(
    'slug', al.invitation_slug, 'is_open', al.is_open,
    'title', (select p.document_data->'meta'->>'title' from public.published_invitations p where p.slug = al.invitation_slug),
    'files', coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'path', u.object_path, 'mime', u.mime, 'size', u.size_bytes, 'name', u.guest_name, 'at', u.created_at) order by u.created_at desc)
                       from public.memory_uploads u where u.invitation_slug = al.invitation_slug), '[]'::jsonb));
end $$;

create or replace function public.memory_panel_remove(p_token text, p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare al public.memory_albums%rowtype;
begin
  select * into al from seoz_private.album_by_token(p_token);
  if al.invitation_slug is null then raise exception 'invalid_token'; end if;
  delete from public.memory_uploads where id = p_id and invitation_slug = al.invitation_slug;
  return jsonb_build_object('ok', true);
end $$;

drop function if exists public.memory_delete_allowed(text);
drop table if exists seoz_private.memory_delete_grants;
alter table public.memory_albums drop column if exists purged_at;
alter table public.memory_albums drop column if exists retention_days;
alter table public.memory_albums drop column if exists event_date;

revoke all on function public.memory_album_accepts(text)        from public, anon, authenticated;
revoke all on function public.memory_owner_sync(text)           from public, anon, authenticated;
revoke all on function public.memory_panel_get(text)            from public, anon, authenticated;
revoke all on function public.memory_panel_remove(text, uuid)   from public, anon, authenticated;
grant execute on function public.memory_album_accepts(text)      to anon, authenticated;
grant execute on function public.memory_owner_sync(text)         to authenticated;
grant execute on function public.memory_panel_get(text)          to anon, authenticated;
grant execute on function public.memory_panel_remove(text, uuid) to anon, authenticated;
commit;
notify pgrst, 'reload schema';
