-- =============================================================================
-- STUDIO SEOZ — MÜŞTERİ MÜZİK YÖNETİMİ ("Müziğimi Yönet")
-- -----------------------------------------------------------------------------
-- Müşteri, davetiyesinin müziğini kendi gizli bağlantısıyla (muzigim#k=ANAHTAR) yükler,
-- dinler, değiştirir ve siler. Dosyanın kendisi Cloudflare R2'de (herkese KAPALI) durur;
-- bu dosya yalnızca kayıtları ve kuralları kurar:
--   • public.music_tracks    : davetiye başına bir kayıt (gizli anahtarın ÖZETİ, etkin dosya, devre dışı durumu)
--   • public.music_consents  : her yüklemede verilen telif/kullanım hakkı onayı (metin sürümü + metnin özeti + tarih)
--   • public.music_log       : yükleme / silme / devre dışı bırakma kayıtları (şikâyet durumunda iz)
--   • public.music_upload_reservations : yükleme sırasında ayrılan yer (eş zamanlı yüklemeler toplam sınırı aşamaz)
-- MALİYET KONTROLÜ (seoz_private.music_limits): toplam 8 GB dolunca yeni yükleme DURUR (mevcut müzikler çalmaya
-- devam eder, hiçbir dosya kendiliğinden silinmez); yer, Studio SEOZ'un Müzik Denetimi'nden elle sildiği müziklerle açılır.
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
  action           text not null check (action in ('upload', 'delete', 'disable', 'enable', 'link', 'admin_delete', 'cleanup')),
  at               timestamptz not null default now(),
  detail           jsonb
);
create index if not exists music_log_slug_idx on public.music_log (invitation_slug, at desc);

-- Yükleme sırasında ayrılan yer: dosya R2'ye yazılmadan ÖNCE ayrılır, kayıtla birlikte (commit) kalkar.
-- 15 dakikada tamamlanmayan ayırma "yarım kalmış" sayılır: toplamdan düşer, Müzik Denetimi'nde elle temizlenir.
create table if not exists public.music_upload_reservations (
  id               uuid primary key default gen_random_uuid(),
  invitation_slug  text not null references public.music_tracks(invitation_slug) on delete restrict,
  file_key         text not null unique check (file_key ~ '^m/[a-z0-9-]+/[0-9a-f]{32}\.mp3$'),
  size_bytes       integer not null check (size_bytes between 1 and 10485760),
  created_at       timestamptz not null default now()
);
create index if not exists music_upload_reservations_created_idx on public.music_upload_reservations (created_at);

alter table public.music_tracks   enable row level security;
alter table public.music_consents enable row level security;
alter table public.music_log      enable row level security;
alter table public.music_upload_reservations enable row level security;
revoke all on public.music_tracks, public.music_consents, public.music_log, public.music_upload_reservations from anon;
revoke insert, update, delete, truncate on public.music_tracks, public.music_consents, public.music_log, public.music_upload_reservations from authenticated;
drop policy if exists "sahip okur" on public.music_tracks;
drop policy if exists "sahip okur" on public.music_consents;
drop policy if exists "sahip okur" on public.music_log;
create policy "sahip okur" on public.music_tracks   for select to authenticated using (public.seoz_is_owner());
create policy "sahip okur" on public.music_consents for select to authenticated using (public.seoz_is_owner());
create policy "sahip okur" on public.music_log      for select to authenticated using (public.seoz_is_owner());
drop policy if exists "sahip okur" on public.music_upload_reservations;
create policy "sahip okur" on public.music_upload_reservations for select to authenticated using (public.seoz_is_owner());

-- 2) Onay metinleri (tek kaynak: sayfa metni buradan alır, yükleme bu metnin özetiyle doğrulanır) ----
-- Türkçe ve İngilizce metnin AYRI sürüm adı vardır; kayıtta hangi dildeki metnin onaylandığı görünür.
-- Metin değişirse sürüm adı da değiştirilmelidir (eski onaylar eski sürüm adıyla kalır).
create or replace function seoz_private.music_consent(p_lang text default 'tr')
returns jsonb language sql immutable set search_path = '' as $$
  select case when p_lang = 'en' then jsonb_build_object(
    'lang', 'en', 'version', 'music-consent-v1-en',
    'text', 'I confirm that I hold all rights and permissions necessary for the music file I upload to be used in my invitation and played to my guests over the internet. I declare that I am responsible for the choice of music and for obtaining all necessary permissions.')
  else jsonb_build_object(
    'lang', 'tr', 'version', 'muzik-onay-v1',
    'text', 'Yüklediğim müzik dosyasının davetiyemde kullanılmasına ve internet üzerinden misafirlere dinletilmesine ilişkin gerekli haklara ve izinlere sahip olduğumu kabul ediyorum. Müzik seçiminden ve gerekli izinlerin temininden sorumlu olduğumu beyan ediyorum.') end
$$;
create or replace function seoz_private.music_consent_sha(p_lang text default 'tr')
returns text language sql immutable set search_path = '' as $$
  select encode(extensions.digest(convert_to(seoz_private.music_consent(p_lang)->>'text', 'UTF8'), 'sha256'), 'hex')
$$;
-- Sürüm + özet çifti geçerli bir onay metnine (TR ya da EN) ait mi?
create or replace function seoz_private.music_consent_valid(p_version text, p_sha text)
returns boolean language sql immutable set search_path = '' as $$
  select (p_version = seoz_private.music_consent('tr')->>'version' and p_sha = seoz_private.music_consent_sha('tr'))
      or (p_version = seoz_private.music_consent('en')->>'version' and p_sha = seoz_private.music_consent_sha('en'))
$$;

-- Sınırlar (tek yer). Değiştirmek için bu fonksiyon güncellenir.
--   quota_bytes        : R2'deki müşteri müziklerinin toplamı (8 GB; R2 ücretsiz katmanı 10 GB/ay)
--   max_file_bytes     : tek dosya (10 MB)
--   per_invite_daily   : davetiye başına 24 saatte yükleme
--   global_daily       : bütün müşteriler için 24 saatte yükleme (R2 yazma işlemlerini sınırlar)
--   per_invite_pending : davetiye başına aynı anda süren yükleme
--   reservation_minutes: ayrılan yerin geçerlilik süresi
create or replace function seoz_private.music_limits()
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object('quota_bytes', 8589934592::bigint, 'max_file_bytes', 10485760, 'per_invite_daily', 10,
    'global_daily', 200, 'per_invite_pending', 2, 'reservation_minutes', 15)
$$;

-- Kullanım: etkin dosyalar (devre dışı olanlar da R2'de durduğu için sayılır) + süresi dolmamış ayırmalar.
create or replace function seoz_private.music_usage()
returns jsonb language sql stable security definer set search_path = '' as $$
  with l as (select seoz_private.music_limits() j),
  u as (select coalesce(sum(file_size), 0)::bigint used, count(*) files from public.music_tracks where file_key is not null),
  r as (select coalesce(sum(size_bytes), 0)::bigint reserved, count(*) pending from public.music_upload_reservations, l
        where created_at > now() - make_interval(mins => (l.j->>'reservation_minutes')::int)),
  g as (select count(*) uploads_24h from public.music_consents where accepted_at > now() - interval '24 hours')
  select jsonb_build_object('used_bytes', u.used, 'reserved_bytes', r.reserved, 'files', u.files, 'pending', r.pending,
    'quota_bytes', (l.j->>'quota_bytes')::bigint, 'remaining_bytes', greatest(0, (l.j->>'quota_bytes')::bigint - u.used - r.reserved),
    'uploads_24h', g.uploads_24h, 'global_daily', (l.j->>'global_daily')::int)
  from l, u, r, g
$$;

-- Gizli anahtardan kayıt (anahtar yalnızca özetiyle saklanır).
create or replace function seoz_private.music_by_token(p_token text)
returns public.music_tracks language sql stable security definer set search_path = '' as $$
  select t.* from public.music_tracks t
  where p_token is not null and p_token ~ '^[A-Za-z0-9_-]{20,100}$'
    and t.manage_token_hash = seoz_private.hash_token(p_token)
$$;

-- 3) MÜŞTERİ (gizli anahtarla) ---------------------------------------------------
-- Durum: davetiye adı ve dili, etkin müzik bilgisi, devre dışı mı, bugünkü yükleme hakkı, onay metinleri (TR + EN).
create or replace function public.music_manage_info(p_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare t public.music_tracks; v_today integer; v_lang text; u jsonb := seoz_private.music_usage(); lim jsonb := seoz_private.music_limits();
begin
  t := seoz_private.music_by_token(p_token);
  if t.invitation_slug is null then return null; end if;
  select count(*) into v_today from public.music_consents c where c.invitation_slug = t.invitation_slug and c.accepted_at > now() - interval '24 hours';
  select case when p.document_data->'meta'->>'lang' = 'en' then 'en' else 'tr' end into v_lang
    from public.published_invitations p where p.slug = t.invitation_slug order by p.id desc limit 1;
  v_lang := coalesce(v_lang, 'tr');
  return jsonb_build_object(
    'lang', v_lang,
    'slug', t.invitation_slug,
    'has_music', t.file_key is not null,
    'file_name', t.original_name, 'file_size', t.file_size, 'file_sha256', t.file_sha256, 'uploaded_at', t.uploaded_at,
    'disabled', t.disabled_at is not null,
    'uploads_left_today', greatest(0, (lim->>'per_invite_daily')::int - v_today),
    -- Yükleme şu an mümkün mü? (toplam yer en büyük dosyaya yetmiyorsa ya da genel günlük sınır dolduysa: hayır)
    'upload_available', (u->>'remaining_bytes')::bigint >= (lim->>'max_file_bytes')::bigint and (u->>'uploads_24h')::int < (lim->>'global_daily')::int,
    'consent', seoz_private.music_consent(v_lang) || jsonb_build_object('sha256', seoz_private.music_consent_sha(v_lang)),
    'consents', jsonb_build_object(
      'tr', seoz_private.music_consent('tr') || jsonb_build_object('sha256', seoz_private.music_consent_sha('tr')),
      'en', seoz_private.music_consent('en') || jsonb_build_object('sha256', seoz_private.music_consent_sha('en'))));
end $$;

-- Yer ayır: dosya R2'ye yazılmadan ÖNCE sunucu (Cloudflare) çağırır. Bütün ayırmalar tek kilit altında sırayla
-- yapılır: eş zamanlı yüklemeler toplam sınırı aşamaz. Yer yetmezse 'capacity_full', genel günlük sınır dolduysa
-- 'service_busy' — bu durumda R2'ye hiçbir şey yazılmaz.
create or replace function public.music_manage_reserve(p_token text, p_file_key text, p_size integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare t public.music_tracks; lim jsonb := seoz_private.music_limits(); u jsonb; v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('seoz_music_quota'));
  t := seoz_private.music_by_token(p_token);
  if t.invitation_slug is null then raise exception 'invalid_token'; end if;
  if t.disabled_at is not null then raise exception 'music_disabled'; end if;
  if p_file_key is null or p_file_key !~ ('^m/' || t.invitation_slug || '/[0-9a-f]{32}\.mp3$') then raise exception 'invalid_file_key'; end if;
  if p_size is null or p_size < 1 or p_size > (lim->>'max_file_bytes')::int then raise exception 'invalid_file_size'; end if;
  if (select count(*) from public.music_consents c where c.invitation_slug = t.invitation_slug and c.accepted_at > now() - interval '24 hours')
     >= (lim->>'per_invite_daily')::int then raise exception 'daily_limit'; end if;
  if (select count(*) from public.music_upload_reservations r where r.invitation_slug = t.invitation_slug
      and r.created_at > now() - make_interval(mins => (lim->>'reservation_minutes')::int)) >= (lim->>'per_invite_pending')::int then
    raise exception 'daily_limit';
  end if;
  u := seoz_private.music_usage();
  if (u->>'uploads_24h')::int >= (lim->>'global_daily')::int then raise exception 'service_busy'; end if;
  if (u->>'remaining_bytes')::bigint < p_size then raise exception 'capacity_full'; end if;
  insert into public.music_upload_reservations (invitation_slug, file_key, size_bytes) values (t.invitation_slug, p_file_key, p_size)
    returning id into v_id;
  return jsonb_build_object('reservation', v_id);
end $$;

-- Ayırmayı bırak (yükleme reddedildi / yarıda kaldı): yer hemen geri döner.
create or replace function public.music_manage_release(p_token text, p_reservation uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare t public.music_tracks;
begin
  t := seoz_private.music_by_token(p_token);
  if t.invitation_slug is null then raise exception 'invalid_token'; end if;
  delete from public.music_upload_reservations where id = p_reservation and invitation_slug = t.invitation_slug;
  return jsonb_build_object('ok', true);
end $$;

-- Yükleme kaydı: dosya R2'ye yazıldıktan SONRA sunucu (Cloudflare) çağırır. Onay metninin (TR ya da EN) sürümü
-- ve özeti birebir tutmazsa, müzik devre dışıysa, günlük sınır dolduysa ya da dosya adı bu davetiyeye ait değilse REDDEDER.
-- Dönen old_key: değiştirilen eski dosya (sunucu onu R2'den hemen siler).
create or replace function public.music_manage_commit(p_token text, p_reservation uuid, p_file_key text, p_file_size integer, p_file_sha256 text,
  p_original_name text, p_consent_version text, p_consent_sha256 text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare t public.music_tracks; v_old text; v_name text; rs public.music_upload_reservations; lim jsonb := seoz_private.music_limits();
begin
  t := seoz_private.music_by_token(p_token);
  if t.invitation_slug is null then raise exception 'invalid_token'; end if;
  -- Yer önceden ayrılmış olmalı (aynı dosya adı, aynı davetiye, süresi dolmamış, boyut ayrılandan büyük değil)
  select * into rs from public.music_upload_reservations r where r.id = p_reservation and r.invitation_slug = t.invitation_slug
    and r.file_key = p_file_key and r.created_at > now() - make_interval(mins => (lim->>'reservation_minutes')::int);
  if rs.id is null or p_file_size is null or p_file_size > rs.size_bytes then raise exception 'reservation_invalid'; end if;
  if t.disabled_at is not null then raise exception 'music_disabled'; end if;
  if not coalesce(seoz_private.music_consent_valid(p_consent_version, p_consent_sha256), false) then raise exception 'consent_required'; end if;
  if p_file_key is null or p_file_key !~ ('^m/' || t.invitation_slug || '/[0-9a-f]{32}\.mp3$') then raise exception 'invalid_file_key'; end if;
  if p_file_size not between 1 and (lim->>'max_file_bytes')::int then raise exception 'invalid_file_size'; end if;
  if p_file_sha256 is null or p_file_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'invalid_file_hash'; end if;
  if (select count(*) from public.music_consents c where c.invitation_slug = t.invitation_slug and c.accepted_at > now() - interval '24 hours')
     >= (lim->>'per_invite_daily')::int then raise exception 'daily_limit'; end if;
  delete from public.music_upload_reservations where id = rs.id;     -- ayrılan yer artık etkin dosya olarak sayılır
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

-- Kullanım özeti (Müzik Denetimi üst bölümü) + yarım kalmış yüklemeler.
create or replace function public.music_owner_usage()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare lim jsonb := seoz_private.music_limits();
begin
  if not public.seoz_is_owner() then raise exception 'not_owner'; end if;
  return seoz_private.music_usage() || jsonb_build_object('limits', lim, 'stale', coalesce((
    select jsonb_agg(jsonb_build_object('slug', r.invitation_slug, 'file_key', r.file_key, 'size', r.size_bytes, 'created_at', r.created_at) order by r.created_at)
    from public.music_upload_reservations r where r.created_at <= now() - make_interval(mins => (lim->>'reservation_minutes')::int)), '[]'::jsonb));
end $$;

-- Yönetici: bir davetiyenin müziğini SİL (yalnızca Studio SEOZ, elle). Dönen old_key'i sunucu R2'den siler.
-- Kendiliğinden hiçbir müzik silinmez; bu fonksiyon yalnızca Müzik Denetimi'ndeki "Müziği Sil" ile çağrılır.
create or replace function public.music_owner_delete(p_slug text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare t public.music_tracks;
begin
  if not public.seoz_is_owner() then raise exception 'not_owner'; end if;
  select * into t from public.music_tracks where invitation_slug = p_slug for update;
  if t.invitation_slug is null then raise exception 'music_not_found'; end if;
  update public.music_tracks set file_key = null, file_size = null, file_sha256 = null, original_name = null,
    uploaded_at = null, updated_at = now()
  where invitation_slug = p_slug;
  if t.file_key is not null then
    insert into public.music_log (invitation_slug, action, detail) values (p_slug, 'admin_delete', jsonb_build_object('file_key', t.file_key, 'size', t.file_size));
  end if;
  return jsonb_build_object('ok', true, 'old_key', t.file_key, 'freed_bytes', coalesce(t.file_size, 0));
end $$;

-- Yönetici: yarım kalmış (süresi dolmuş) ayırma kayıtlarını kaldır. Sunucu önce bu dosya adlarını R2'den siler.
create or replace function public.music_owner_forget_stale(p_keys text[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare lim jsonb := seoz_private.music_limits(); n integer;
begin
  if not public.seoz_is_owner() then raise exception 'not_owner'; end if;
  delete from public.music_upload_reservations r where r.file_key = any(p_keys)
    and r.created_at <= now() - make_interval(mins => (lim->>'reservation_minutes')::int)
    and not exists (select 1 from public.music_tracks t where t.file_key = r.file_key);
  get diagnostics n = row_count;
  if n > 0 then insert into public.music_log (invitation_slug, action, detail) values ('-', 'cleanup', jsonb_build_object('keys', to_jsonb(p_keys))); end if;
  return jsonb_build_object('ok', true, 'removed', n);
end $$;

-- Müzik Denetimi listesi: bütün müzik kayıtları + son onay.
create or replace function public.music_owner_list()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.seoz_is_owner() then raise exception 'not_owner'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'slug', t.invitation_slug, 'has_music', t.file_key is not null, 'file_name', t.original_name, 'file_size', t.file_size,
      'file_sha256', t.file_sha256, 'uploaded_at', t.uploaded_at, 'disabled_at', t.disabled_at, 'disabled_reason', t.disabled_reason,
      'consent_version', c.consent_version, 'consent_at', c.accepted_at, 'uploads_total', (select count(*) from public.music_consents x where x.invitation_slug = t.invitation_slug),
      'event_date', e.event_date, 'event_ended', e.event_date is not null and e.event_date < current_date)
    order by coalesce(t.uploaded_at, t.created_at) desc)
    from public.music_tracks t
    left join lateral (select consent_version, accepted_at from public.music_consents c where c.invitation_slug = t.invitation_slug order by accepted_at desc limit 1) c on true
    -- Etkinlik tarihi: davetiyedeki Takvime Ekle tarihi, yoksa Geri Sayım tarihi (Anı Albümü ile aynı kural)
    left join lateral (select coalesce(
        (select (l->'settings'->>'date')::date from jsonb_array_elements(coalesce(p.document_data->'layers', '[]'::jsonb)) l
          where l->>'moduleId' = 'calendar' and (l->'settings'->>'date') ~ '^\d{4}-\d{2}-\d{2}$' limit 1),
        (select (l->'settings'->>'targetDate')::date from jsonb_array_elements(coalesce(p.document_data->'layers', '[]'::jsonb)) l
          where l->>'moduleId' = 'countdown' and (l->'settings'->>'targetDate') ~ '^\d{4}-\d{2}-\d{2}$' limit 1)) event_date
      from public.published_invitations p where p.slug = t.invitation_slug order by p.id desc limit 1) e on true), '[]'::jsonb);
end $$;

-- 6) Yetkiler -------------------------------------------------------------------------
revoke all on function seoz_private.music_consent(text)             from public, anon, authenticated;
revoke all on function seoz_private.music_consent_sha(text)         from public, anon, authenticated;
revoke all on function seoz_private.music_consent_valid(text, text) from public, anon, authenticated;
revoke all on function seoz_private.music_by_token(text)            from public, anon, authenticated;
revoke all on function public.music_manage_info(text)               from public;
revoke all on function seoz_private.music_limits()                  from public, anon, authenticated;
revoke all on function seoz_private.music_usage()                   from public, anon, authenticated;
revoke all on function public.music_manage_reserve(text, text, integer) from public;
revoke all on function public.music_manage_release(text, uuid)      from public;
revoke all on function public.music_manage_commit(text, uuid, text, integer, text, text, text, text) from public;
revoke all on function public.music_owner_usage()                   from public, anon;
revoke all on function public.music_owner_delete(text)              from public, anon;
revoke all on function public.music_owner_forget_stale(text[])      from public, anon;
revoke all on function public.music_manage_delete(text)             from public;
revoke all on function public.music_public_get(text)                from public;
revoke all on function public.music_owner_sync(text)                from public, anon;
revoke all on function public.music_owner_rotate_token(text)        from public, anon;
revoke all on function public.music_owner_set_disabled(text, boolean, text) from public, anon;
revoke all on function public.music_owner_list()                    from public, anon;
grant execute on function public.music_manage_info(text)            to anon, authenticated;
grant execute on function public.music_manage_reserve(text, text, integer) to anon, authenticated;
grant execute on function public.music_manage_release(text, uuid)   to anon, authenticated;
grant execute on function public.music_manage_commit(text, uuid, text, integer, text, text, text, text) to anon, authenticated;
grant execute on function public.music_owner_usage()                to authenticated;
grant execute on function public.music_owner_delete(text)           to authenticated;
grant execute on function public.music_owner_forget_stale(text[])   to authenticated;
grant execute on function public.music_manage_delete(text)          to anon, authenticated;
grant execute on function public.music_public_get(text)             to anon, authenticated;
grant execute on function public.music_owner_sync(text)             to authenticated;
grant execute on function public.music_owner_rotate_token(text)     to authenticated;
grant execute on function public.music_owner_set_disabled(text, boolean, text) to authenticated;
grant execute on function public.music_owner_list()                 to authenticated;

commit;
