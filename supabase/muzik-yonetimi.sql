-- =============================================================================
-- STUDIO SEOZ — MÜŞTERİ MÜZİK YÖNETİMİ ("Müziğimi Yönet")
-- -----------------------------------------------------------------------------
-- Müşteri, davetiyesinin müziğini kendi gizli bağlantısıyla (muzigim#k=ANAHTAR) yükler,
-- dinler, değiştirir ve siler. Dosyanın kendisi Cloudflare R2'de (herkese KAPALI) durur;
-- bu dosya yalnızca kayıtları ve kuralları kurar:
--   • public.music_tracks    : davetiye başına bir kayıt (gizli anahtarın ÖZETİ, etkin dosya, devre dışı durumu)
--   • public.music_consents  : her yüklemede verilen telif/kullanım hakkı onayı (metin sürümü + metnin özeti + tarih)
--   • public.music_log       : yükleme / silme / devre dışı bırakma kayıtları (şikâyet durumunda iz)
-- Tablolar herkese KAPALI (yalnızca Studio SEOZ hesabı okur). Müşteri ve misafir yalnızca aşağıdaki
-- fonksiyonlarla, tek davetiye ve kendi anahtarıyla işlem yapar.
--
-- Ne YAPMAZ: mevcut tablolara, davetiyelere, Katılım Paneli / Anı Albümü / anket kurallarına dokunmaz;
-- veri silmez; depolama (storage) bucket'ı oluşturmaz. Cron / Edge Function / pg_net YOK.
-- Ön koşul: katilim-faz-a.sql (seoz_private.new_token / hash_token, public.seoz_is_owner).
-- Geri almak için: muzik-yonetimi-geri-al.sql
-- =============================================================================
begin;

do $$
begin
  if to_regprocedure('seoz_private.new_token()') is null or to_regprocedure('seoz_private.hash_token(text)') is null
     or to_regprocedure('public.seoz_is_owner()') is null then
    raise exception 'Önce katilim-faz-a.sql çalıştırılmalı (seoz_private.new_token / hash_token / seoz_is_owner).';
  end if;
end $$;

-- 1) Tablolar ------------------------------------------------------------------
create table if not exists public.music_tracks (
  invitation_slug          text primary key check (invitation_slug ~ '^[a-z0-9][a-z0-9-]{1,118}[a-z0-9]$'),
  manage_token_hash        text unique,
  manage_token_rotated_at  timestamptz,
  file_key                 text check (file_key is null or file_key ~ '^m/[a-z0-9-]+/[0-9a-f]{32}\.mp3$'),
  file_size                integer check (file_size is null or file_size between 1 and 10485760),
  file_sha256              text check (file_sha256 is null or file_sha256 ~ '^[0-9a-f]{64}$'),
  original_name            text check (original_name is null or char_length(original_name) <= 120),
  uploaded_at              timestamptz,
  disabled_at              timestamptz,
  disabled_reason          text check (disabled_reason is null or char_length(disabled_reason) <= 300),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create table if not exists public.music_consents (
  id                   bigint generated always as identity primary key,
  invitation_slug      text not null references public.music_tracks(invitation_slug) on delete restrict,
  consent_version      text not null,
  consent_text_sha256  text not null check (consent_text_sha256 ~ '^[0-9a-f]{64}$'),
  accepted_at          timestamptz not null default now(),
  file_key             text not null,
  file_sha256          text not null check (file_sha256 ~ '^[0-9a-f]{64}$'),
  file_size            integer not null,
  original_name        text
);
create index if not exists music_consents_slug_idx on public.music_consents (invitation_slug, accepted_at desc);

create table if not exists public.music_log (
  id               bigint generated always as identity primary key,
  invitation_slug  text not null,
  action           text not null check (action in ('upload', 'delete', 'disable', 'enable', 'link')),
  at               timestamptz not null default now(),
  detail           jsonb
);
create index if not exists music_log_slug_idx on public.music_log (invitation_slug, at desc);

alter table public.music_tracks   enable row level security;
alter table public.music_consents enable row level security;
alter table public.music_log      enable row level security;
revoke all on public.music_tracks, public.music_consents, public.music_log from anon;
revoke insert, update, delete, truncate on public.music_tracks, public.music_consents, public.music_log from authenticated;
drop policy if exists "sahip okur" on public.music_tracks;
drop policy if exists "sahip okur" on public.music_consents;
drop policy if exists "sahip okur" on public.music_log;
create policy "sahip okur" on public.music_tracks   for select to authenticated using (public.seoz_is_owner());
create policy "sahip okur" on public.music_consents for select to authenticated using (public.seoz_is_owner());
create policy "sahip okur" on public.music_log      for select to authenticated using (public.seoz_is_owner());

-- 2) Onay metni (tek kaynak: sayfa metni buradan alır, yükleme bu metnin özetiyle doğrulanır) ----
create or replace function seoz_private.music_consent()
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'version', 'muzik-onay-v1',
    'text', 'Yüklediğim müzik dosyasının davetiyemde kullanılmasına ve internet üzerinden misafirlere dinletilmesine ilişkin gerekli haklara ve izinlere sahip olduğumu kabul ediyorum. Müzik seçiminden ve gerekli izinlerin temininden sorumlu olduğumu beyan ediyorum.')
$$;
create or replace function seoz_private.music_consent_sha()
returns text language sql immutable set search_path = '' as $$
  select encode(extensions.digest(convert_to(seoz_private.music_consent()->>'text', 'UTF8'), 'sha256'), 'hex')
$$;

-- Gizli anahtardan kayıt (anahtar yalnızca özetiyle saklanır).
create or replace function seoz_private.music_by_token(p_token text)
returns public.music_tracks language sql stable security definer set search_path = '' as $$
  select t.* from public.music_tracks t
  where p_token is not null and p_token ~ '^[A-Za-z0-9_-]{20,100}$'
    and t.manage_token_hash = seoz_private.hash_token(p_token)
$$;

-- 3) MÜŞTERİ (gizli anahtarla) ---------------------------------------------------
-- Durum: davetiye adı, etkin müzik bilgisi, devre dışı mı, bugünkü yükleme hakkı, onay metni.
create or replace function public.music_manage_info(p_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare t public.music_tracks; v_today integer;
begin
  t := seoz_private.music_by_token(p_token);
  if t.invitation_slug is null then return null; end if;
  select count(*) into v_today from public.music_consents c where c.invitation_slug = t.invitation_slug and c.accepted_at > now() - interval '24 hours';
  return jsonb_build_object(
    'slug', t.invitation_slug,
    'has_music', t.file_key is not null,
    'file_name', t.original_name, 'file_size', t.file_size, 'file_sha256', t.file_sha256, 'uploaded_at', t.uploaded_at,
    'disabled', t.disabled_at is not null,
    'uploads_left_today', greatest(0, 10 - v_today),
    'consent', seoz_private.music_consent() || jsonb_build_object('sha256', seoz_private.music_consent_sha()));
end $$;

-- Yükleme kaydı: dosya R2'ye yazıldıktan SONRA sunucu (Cloudflare) çağırır. Onay metninin sürümü ve özeti
-- birebir tutmazsa, müzik devre dışıysa, günlük sınır dolduysa ya da dosya adı bu davetiyeye ait değilse REDDEDER.
-- Dönen old_key: değiştirilen eski dosya (sunucu onu R2'den hemen siler).
create or replace function public.music_manage_commit(p_token text, p_file_key text, p_file_size integer, p_file_sha256 text,
  p_original_name text, p_consent_version text, p_consent_sha256 text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare t public.music_tracks; v_old text; v_name text;
begin
  t := seoz_private.music_by_token(p_token);
  if t.invitation_slug is null then raise exception 'invalid_token'; end if;
  if t.disabled_at is not null then raise exception 'music_disabled'; end if;
  if p_consent_version is distinct from (seoz_private.music_consent()->>'version')
     or p_consent_sha256 is distinct from seoz_private.music_consent_sha() then raise exception 'consent_required'; end if;
  if p_file_key is null or p_file_key !~ ('^m/' || t.invitation_slug || '/[0-9a-f]{32}\.mp3$') then raise exception 'invalid_file_key'; end if;
  if p_file_size is null or p_file_size not between 1 and 10485760 then raise exception 'invalid_file_size'; end if;
  if p_file_sha256 is null or p_file_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'invalid_file_hash'; end if;
  if (select count(*) from public.music_consents c where c.invitation_slug = t.invitation_slug and c.accepted_at > now() - interval '24 hours') >= 10 then
    raise exception 'daily_limit';
  end if;
  v_name := nullif(left(regexp_replace(coalesce(p_original_name, ''), '[[:cntrl:]<>]', '', 'g'), 120), '');
  insert into public.music_consents (invitation_slug, consent_version, consent_text_sha256, file_key, file_sha256, file_size, original_name)
    values (t.invitation_slug, p_consent_version, p_consent_sha256, p_file_key, p_file_sha256, p_file_size, v_name);
  v_old := t.file_key;
  update public.music_tracks set file_key = p_file_key, file_size = p_file_size, file_sha256 = p_file_sha256,
    original_name = v_name, uploaded_at = now(), updated_at = now()
  where invitation_slug = t.invitation_slug;
  insert into public.music_log (invitation_slug, action, detail) values (t.invitation_slug, 'upload',
    jsonb_build_object('file_key', p_file_key, 'size', p_file_size, 'sha256', p_file_sha256, 'replaced', v_old));
  return jsonb_build_object('ok', true, 'old_key', v_old, 'uploaded_at', now());
end $$;

-- Müziği sil: kayıt boşaltılır; dönen old_key'i sunucu R2'den siler. Müzik devre dışıyken de silinebilir.
create or replace function public.music_manage_delete(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare t public.music_tracks;
begin
  t := seoz_private.music_by_token(p_token);
  if t.invitation_slug is null then raise exception 'invalid_token'; end if;
  update public.music_tracks set file_key = null, file_size = null, file_sha256 = null, original_name = null,
    uploaded_at = null, updated_at = now()
  where invitation_slug = t.invitation_slug;
  if t.file_key is not null then
    insert into public.music_log (invitation_slug, action, detail) values (t.invitation_slug, 'delete', jsonb_build_object('file_key', t.file_key));
  end if;
  return jsonb_build_object('ok', true, 'old_key', t.file_key);
end $$;

-- 4) MİSAFİR (davetiye sayfası) ----------------------------------------------------
-- Yalnızca tam davetiye adıyla; müzik yoksa / devre dışıysa null. Toplu listeleme yok.
create or replace function public.music_public_get(p_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when t.invitation_slug is null then null
    else jsonb_build_object('key', t.file_key, 'sha256', t.file_sha256, 'size', t.file_size) end
  from (select 1) x
  left join public.music_tracks t
    on p_slug ~ '^[a-z0-9][a-z0-9-]{1,118}[a-z0-9]$' and t.invitation_slug = p_slug
   and t.file_key is not null and t.disabled_at is null
$$;

-- 5) STUDIO SEOZ (yönetici) ---------------------------------------------------------
-- Yayına Hazırla: kayıt yoksa açılır, anahtar yoksa üretilir (anahtar YALNIZCA ilk üretimde döner).
create or replace function public.music_owner_sync(p_slug text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare t public.music_tracks; v_token text := null;
begin
  if not public.seoz_is_owner() then raise exception 'not_owner'; end if;
  if not exists (select 1 from public.published_invitations where slug = p_slug) then raise exception 'invitation_not_found'; end if;
  insert into public.music_tracks (invitation_slug) values (p_slug) on conflict (invitation_slug) do nothing;
  select * into t from public.music_tracks where invitation_slug = p_slug;
  if t.manage_token_hash is null then
    v_token := seoz_private.new_token();
    update public.music_tracks set manage_token_hash = seoz_private.hash_token(v_token), manage_token_rotated_at = now(), updated_at = now()
    where invitation_slug = p_slug;
    insert into public.music_log (invitation_slug, action) values (p_slug, 'link');
  end if;
  return jsonb_build_object('manage_token', v_token, 'has_music', t.file_key is not null, 'disabled', t.disabled_at is not null);
end $$;

-- Bağlantıyı yenile: eski "Müziğimi Yönet" bağlantısı anında geçersiz olur (müzik etkilenmez).
create or replace function public.music_owner_rotate_token(p_slug text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_token text := seoz_private.new_token();
begin
  if not public.seoz_is_owner() then raise exception 'not_owner'; end if;
  update public.music_tracks set manage_token_hash = seoz_private.hash_token(v_token), manage_token_rotated_at = now(), updated_at = now()
  where invitation_slug = p_slug;
  if not found then raise exception 'music_not_found'; end if;
  insert into public.music_log (invitation_slug, action, detail) values (p_slug, 'link', jsonb_build_object('rotated', true));
  return jsonb_build_object('manage_token', v_token);
end $$;

-- Telif şikâyeti: müziği hemen devre dışı bırak / yeniden etkinleştir. Devre dışıyken müzik çalmaz ve
-- müşteri yeni dosya yükleyemez (silebilir).
create or replace function public.music_owner_set_disabled(p_slug text, p_disabled boolean, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not public.seoz_is_owner() then raise exception 'not_owner'; end if;
  update public.music_tracks set
    disabled_at = case when p_disabled then coalesce(disabled_at, now()) else null end,
    disabled_reason = case when p_disabled then nullif(left(coalesce(p_reason, ''), 300), '') else null end,
    updated_at = now()
  where invitation_slug = p_slug;
  if not found then raise exception 'music_not_found'; end if;
  insert into public.music_log (invitation_slug, action, detail)
    values (p_slug, case when p_disabled then 'disable' else 'enable' end, jsonb_build_object('reason', nullif(left(coalesce(p_reason, ''), 300), '')));
  return jsonb_build_object('ok', true, 'disabled', p_disabled);
end $$;

-- Müzik Denetimi listesi: bütün müzik kayıtları + son onay.
create or replace function public.music_owner_list()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.seoz_is_owner() then raise exception 'not_owner'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'slug', t.invitation_slug, 'has_music', t.file_key is not null, 'file_name', t.original_name, 'file_size', t.file_size,
      'file_sha256', t.file_sha256, 'uploaded_at', t.uploaded_at, 'disabled_at', t.disabled_at, 'disabled_reason', t.disabled_reason,
      'consent_version', c.consent_version, 'consent_at', c.accepted_at, 'uploads_total', (select count(*) from public.music_consents x where x.invitation_slug = t.invitation_slug))
    order by coalesce(t.uploaded_at, t.created_at) desc)
    from public.music_tracks t
    left join lateral (select consent_version, accepted_at from public.music_consents c where c.invitation_slug = t.invitation_slug order by accepted_at desc limit 1) c on true), '[]'::jsonb);
end $$;

-- 6) Yetkiler -------------------------------------------------------------------------
revoke all on function seoz_private.music_consent()                 from public, anon, authenticated;
revoke all on function seoz_private.music_consent_sha()             from public, anon, authenticated;
revoke all on function seoz_private.music_by_token(text)            from public, anon, authenticated;
revoke all on function public.music_manage_info(text)               from public;
revoke all on function public.music_manage_commit(text, text, integer, text, text, text, text) from public;
revoke all on function public.music_manage_delete(text)             from public;
revoke all on function public.music_public_get(text)                from public;
revoke all on function public.music_owner_sync(text)                from public, anon;
revoke all on function public.music_owner_rotate_token(text)        from public, anon;
revoke all on function public.music_owner_set_disabled(text, boolean, text) from public, anon;
revoke all on function public.music_owner_list()                    from public, anon;
grant execute on function public.music_manage_info(text)            to anon, authenticated;
grant execute on function public.music_manage_commit(text, text, integer, text, text, text, text) to anon, authenticated;
grant execute on function public.music_manage_delete(text)          to anon, authenticated;
grant execute on function public.music_public_get(text)             to anon, authenticated;
grant execute on function public.music_owner_sync(text)             to authenticated;
grant execute on function public.music_owner_rotate_token(text)     to authenticated;
grant execute on function public.music_owner_set_disabled(text, boolean, text) to authenticated;
grant execute on function public.music_owner_list()                 to authenticated;

commit;
