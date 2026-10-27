-- =============================================================================
-- STUDIO SEOZ — ANI YÜKLE: "Studio SEOZ depolaması" yöntemi
-- -----------------------------------------------------------------------------
-- Ne kurar:
--   • storage bucket "ani-yukleme"  : misafir fotoğraf/videoları (en çok 25 MB; yalnızca resim/video)
--   • memory_albums                 : yayınlanan davetiye başına bir anı albümü (açık/kapalı, panel anahtarı ÖZETİ)
--   • memory_uploads                : albüme kayıtlı dosyalar
--   • Güvenli fonksiyonlar          : misafir kaydı, Studio SEOZ senkronu, müşteri albüm paneli
--
-- Ne YAPMAZ:
--   • published_invitations, Katılım (rsvp_*), masa planı, vitrin (products/orders…) tablolarına
--     ve mevcut bucket/politikalara DOKUNMAZ. Mevcut bucket varsa ayarlarını değiştirmez.
--
-- Güvenlik modeli:
--   • İki tabloda da RLS AÇIK; misafirin (anon) tablolara doğrudan erişimi YOK.
--   • Misafir yalnızca AÇIK albümü olan davetiyenin klasörüne dosya EKLEYEBİLİR; listeleyemez,
--     değiştiremez, silemez, üzerine yazamaz. Dosya adı 128 bit rastgele olmak ZORUNDA (kural
--     başka adları reddeder); dosya bağlantısı yalnızca albüm paneline (gizli link) verilir.
--   • Yalnızca resim/video türleri (SVG/HTML yok), dosya başına en çok 25 MB, albüm başına en çok 2000 dosya.
--   • Albümü yalnızca gizli panel linki (album.html#k=...) sahibi görür; anahtarın yalnızca
--     SHA-256 özeti saklanır. Studio SEOZ anahtarı yenileyerek eski linki anında iptal edebilir.
--
-- Ön koşul: katilim-faz-a.sql (seoz_private.new_token / hash_token) kurulmuş olmalı.
-- Nasıl çalıştırılır: Supabase → SQL Editor → tamamını yapıştır → Run. Tekrar çalıştırmak güvenlidir.
-- Geri almak için: ani-yukleme-geri-al.sql
-- =============================================================================

begin;

do $$
begin
  if to_regclass('public.published_invitations') is null then raise exception 'published_invitations bulunamadı.'; end if;
  if to_regprocedure('public.seoz_is_owner()') is null then raise exception 'seoz_is_owner() bulunamadı.'; end if;
  if to_regprocedure('seoz_private.new_token()') is null or to_regprocedure('seoz_private.hash_token(text)') is null then
    raise exception 'Önce katilim-faz-a.sql çalıştırılmalı (seoz_private.new_token / hash_token).';
  end if;
end $$;

-- 1) Tablolar -----------------------------------------------------------------
create table if not exists public.memory_albums (
  invitation_slug         text primary key check (char_length(invitation_slug) between 3 and 120),
  is_open                 boolean not null default true,
  max_files               integer not null default 2000 check (max_files between 1 and 20000),
  panel_token_hash        text unique,
  panel_token_rotated_at  timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create table if not exists public.memory_uploads (
  id               uuid primary key default gen_random_uuid(),
  invitation_slug  text not null references public.memory_albums(invitation_slug) on delete cascade,
  object_path      text not null unique check (char_length(object_path) between 5 and 300),
  mime             text,
  size_bytes       bigint,
  guest_name       text check (guest_name is null or char_length(guest_name) <= 80),
  created_at       timestamptz not null default now()
);
create index if not exists memory_uploads_slug_idx on public.memory_uploads (invitation_slug, created_at desc);

alter table public.memory_albums  enable row level security;
alter table public.memory_uploads enable row level security;
revoke all on public.memory_albums, public.memory_uploads from public, anon, authenticated;
grant select on public.memory_albums, public.memory_uploads to authenticated;
drop policy if exists "sahip okur" on public.memory_albums;
drop policy if exists "sahip okur" on public.memory_uploads;
create policy "sahip okur" on public.memory_albums  for select to authenticated using (public.seoz_is_owner());
create policy "sahip okur" on public.memory_uploads for select to authenticated using (public.seoz_is_owner());

-- 2) Depolama alanı (yalnızca yoksa oluşturulur) -------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ani-yukleme', 'ani-yukleme', true, 26214400,
        array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif','video/mp4','video/quicktime','video/webm'])
on conflict (id) do nothing;

-- Albüm dosya kabul ediyor mu? (depolama politikası ve misafir kaydı kullanır)
create or replace function public.memory_album_accepts(p_slug text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memory_albums a
    where a.invitation_slug = p_slug and a.is_open
      and (select count(*) from public.memory_uploads u where u.invitation_slug = a.invitation_slug) < a.max_files)
$$;

drop policy if exists "ani-yukleme misafir yukler" on storage.objects;
create policy "ani-yukleme misafir yukler" on storage.objects for insert to anon, authenticated
  with check (
    bucket_id = 'ani-yukleme'
    and array_length(storage.foldername(name), 1) = 1
    and storage.filename(name) ~ '^[0-9a-z]{6,12}-[A-Za-z0-9_-]{22}\.(jpg|png|webp|gif|heic|heif|mp4|mov|webm)$'
    and public.memory_album_accepts((storage.foldername(name))[1])
  );

-- 3) Misafir: yüklenen dosyayı albüme kaydeder -----------------------------------
create or replace function public.memory_register(p_slug text, p_path text, p_mime text, p_size bigint, p_name text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not public.memory_album_accepts(p_slug) then raise exception 'album_closed'; end if;
  if p_path is null or left(p_path, char_length(p_slug) + 1) <> p_slug || '/' or p_path like '%..%'
     or substr(p_path, char_length(p_slug) + 2) !~ '^[0-9a-z]{6,12}-[A-Za-z0-9_-]{22}\.(jpg|png|webp|gif|heic|heif|mp4|mov|webm)$' then raise exception 'invalid_path'; end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'ani-yukleme' and o.name = p_path) then raise exception 'file_not_found'; end if;
  insert into public.memory_uploads (invitation_slug, object_path, mime, size_bytes, guest_name)
  values (p_slug, p_path, left(p_mime, 80), p_size, nullif(left(btrim(coalesce(p_name, '')), 80), ''))
  on conflict (object_path) do nothing;
  return jsonb_build_object('ok', true);
end $$;

-- 4) Studio SEOZ (yayında): albümü oluşturur/açar; panel anahtarı ilk seferde bir kez döner ----
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

create or replace function public.memory_owner_rotate_token(p_slug text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_token text := seoz_private.new_token(); v_slug text;
begin
  if not public.seoz_is_owner() then raise exception 'not_owner'; end if;
  update public.memory_albums set panel_token_hash = seoz_private.hash_token(v_token), panel_token_rotated_at = now(), updated_at = now()
    where invitation_slug = p_slug returning invitation_slug into v_slug;
  if v_slug is null then raise exception 'album_not_found'; end if;
  return jsonb_build_object('panel_token', v_token);
end $$;

-- 5) Müşteri albüm paneli (gizli link) -------------------------------------------
create or replace function seoz_private.album_by_token(p_token text)
returns public.memory_albums language sql stable security definer set search_path = '' as $$
  select a.* from public.memory_albums a
  where p_token is not null and char_length(p_token) between 20 and 200 and a.panel_token_hash = seoz_private.hash_token(p_token)
$$;
revoke all on function seoz_private.album_by_token(text) from public, anon, authenticated;

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

create or replace function public.memory_panel_set_open(p_token text, p_open boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare al public.memory_albums%rowtype;
begin
  select * into al from seoz_private.album_by_token(p_token);
  if al.invitation_slug is null then raise exception 'invalid_token'; end if;
  update public.memory_albums set is_open = coalesce(p_open, true), updated_at = now() where invitation_slug = al.invitation_slug;
  return jsonb_build_object('is_open', coalesce(p_open, true));
end $$;

-- Albümden kaldırır (dosya listeden çıkar; misafirler zaten listeyi göremez)
create or replace function public.memory_panel_remove(p_token text, p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare al public.memory_albums%rowtype;
begin
  select * into al from seoz_private.album_by_token(p_token);
  if al.invitation_slug is null then raise exception 'invalid_token'; end if;
  delete from public.memory_uploads where id = p_id and invitation_slug = al.invitation_slug;
  return jsonb_build_object('ok', true);
end $$;

-- 6) Yetkiler ---------------------------------------------------------------------
revoke all on function public.memory_album_accepts(text)                      from public, anon, authenticated;
revoke all on function public.memory_register(text, text, text, bigint, text) from public, anon, authenticated;
revoke all on function public.memory_owner_sync(text)                         from public, anon, authenticated;
revoke all on function public.memory_owner_rotate_token(text)                 from public, anon, authenticated;
revoke all on function public.memory_panel_get(text)                          from public, anon, authenticated;
revoke all on function public.memory_panel_set_open(text, boolean)            from public, anon, authenticated;
revoke all on function public.memory_panel_remove(text, uuid)                 from public, anon, authenticated;
grant execute on function public.memory_album_accepts(text)                      to anon, authenticated;
grant execute on function public.memory_register(text, text, text, bigint, text) to anon, authenticated;
grant execute on function public.memory_owner_sync(text)                         to authenticated;
grant execute on function public.memory_owner_rotate_token(text)                 to authenticated;
grant execute on function public.memory_panel_get(text)                          to anon, authenticated;
grant execute on function public.memory_panel_set_open(text, boolean)            to anon, authenticated;
grant execute on function public.memory_panel_remove(text, uuid)                 to anon, authenticated;

commit;
notify pgrst, 'reload schema';
