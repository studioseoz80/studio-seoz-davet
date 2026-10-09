# Editör Güçlendirme — Değişiklikler, Test ve Güvenlik Adımları

## 1. Değişen ve eklenen dosyalar

**Yeni dosyalar**
- `js/modules/gift.js`: Hediye modülü
- `build-public.sh`: müşteri sitesini (editör olmadan) hazırlar
- `_headers`: editör sitesinin güvenlik başlıkları
- `_headers.public`: müşteri sitesinin güvenlik başlıkları
- `.gitignore`
- bu rehber

**Değişen dosyalar**
- `js/fonts-library.js`: 38 yeni font, 3 yeni kategori ve "Son Kullanılanlar" bölümü
- `css/canvas.css`: yeni fontlar ayrı bir satırda yükleniyor; eski satır aynen duruyor
- `js/core/renderer.js`: Bakır metalik rengi
- `js/core/cloud-store.js`: e-posta ile giriş ve Görüş Bildir kaydı
- `js/editor/text-panel.js`: Bakır, Stili Kopyala/Yapıştır ve Çoğalt düğmesi en üstte
- `js/editor/editor-app.js`: Çoğalt akışı, Ctrl+D kısayolu, araç çubuğunda Çoğalt ve "☁ Giriş Yap"
- `js/editor/module-panel.js`: font seçicide "Son Kullanılanlar"
- `js/editor/poll-panel.js`: anket butonları için metalik seçimi
- `js/modules/feedback.js`: "Davetiye içinde topla" ve WhatsApp'ta yalnızca buton seçeneği
- `js/modules/countdown.js`: başlık ve rakamlar için metalik yazı
- `js/modules/calendar.js`, `celebration.js`, `guest-upload.js`, `location.js`, `music.js`, `rsvp.js`: Bakır seçeneği
- `js/editor/export-package.js`, `index.html`, `view.html`: yeni dosyaların kaydı
- `tests/core-selftest.js`

⚠️ `js/supabase-config.js` bu pakette **bilerek yok**. Bilgisayarındaki dosyada senin anahtarların yazılı, o dosya olduğu gibi kalmalı.

## 2. Eklenen özellikler

- **Hediye modülü:** Kapalı, hediye linki, IBAN ya da ikisi birlikte seçilebiliyor.
  - IBAN 4'erli gruplar hâlinde gösteriliyor.
  - "IBAN'ı Kopyala" düğmesine basınca "IBAN kopyalandı" bildirimi çıkıyor.
  - Yanlış yazılmış bir IBAN, yayın öncesinde uyarı veriyor.
- **Metalik renkler:** Altın ve Gümüş zaten vardı. Buna **Bakır** eklendi. Bakır şu yerlerde seçilebiliyor:
  - metin
  - butonlu tüm modüller
  - anket
  - geri sayımın başlığı ve rakamları
  - Hediye modülü
- **Çoğalt:**
  - Kopya, orijinalin hemen altına aynı hizada yerleşiyor ve otomatik seçili geliyor.
  - Metin kutusu kendiliğinden seçili oluyor; doğrudan yeni yazıyı yazabilirsin.
  - Kısayolu **Ctrl+D**, araç çubuğunda da düğmesi var.
- **Stili Kopyala / Yapıştır:** Yazının kendisi hariç bütün görünüm ayarları aktarılıyor.
- **Fontlar:**
  - Eski 25 fontun hepsi duruyor.
  - **38 yeni font** eklendi. Her birinde ç ğ ı İ ö ş ü harflerinin varlığı font dosyalarının içinden doğrulandı.
  - Yeni kategoriler: Lüks / Başlık, Minimal, Eğitim / Okul.
  - Font seçicinin en üstünde "★ Son Kullanılanlar" bölümü var.
  - ⚠ Eski fontlardan **Fredoka**'da ğ, Ğ, İ, ş ve Ş harfleri yok. Mevcut tasarımlar bozulmasın diye silmedim; listede uyarı işaretiyle görünüyor.
- **Görüş Bildir** (anketten bağımsız):
  - Davetiye içinde topla: görüşler Supabase'e kaydediliyor.
  - Google Form: düğme formu açıyor.
  - WhatsApp: yalnızca düğme ya da mesaj kutusu.
  - Düğme yazıları değiştirilebiliyor.

## 3. Test edilen mevcut özellikler

- **Otomatik testler:** 462 kontrolün hepsi geçti.
- **Gerçek tarayıcıda denenenler:**
  - metin ekleme
  - Geri Al ve Sil
  - Çoğalt (Ctrl+D ve düğme)
  - Stili Kopyala/Yapıştır
  - Son kullanılan fontlar
  - Hediye modülü (IBAN kopyalama ve bildirim)
  - Görüş Bildir'in Supabase kaydı
  - giriş bağlantısı akışı
  - Yayına Hazırla (girişten önce engelleniyor, girişten sonra yayınlanıyor)
  - müşteri linkinin açılması
- **Müşteri sitesi derlemesi:** 28 dosya üretiliyor, içlerinde hiç editör dosyası yok.

---

## 4. Senin yapacağın güvenlik adımları

Bunları tek seferde yapmak zorunda değilsin. Önem sırasına göre dizdim.

### A) Müşteri linkleri için ayrı site ("yan yana ikinci ev")

1. Cloudflare → **Workers & Pages** → **Create application** → alttaki **Continue to Pages**.
2. **Import an existing Git repository** → **studio-seoz-davet** → **Begin setup**.
3. **Project name:** `seoz-davetiye` (dilersen başka bir ad da verebilirsin).
4. **Build command:** `sh build-public.sh`
5. **Build output directory:** `public-site`
6. **Save and Deploy**.

Sonuç: `seoz-davetiye.pages.dev` adresinde editör hiç bulunmaz, yalnızca davetiyeler açılır.

7. Bilgisayarında `js/supabase-config.js` dosyasını aç ve şu satırı düzenle:
   `publicViewUrl: "https://seoz-davetiye.pages.dev/view.html"`
8. GitHub'a gönder (aşağıdaki "Güncellemeyi gönderme" bölümüne bak).

### B) Supabase: davetiyeleri yalnızca sen değiştirebilesin

1. **Authentication → Users → Add user → Create new user**
   - Kendi e-postanı yaz.
   - Herhangi bir güçlü parola yaz. Bu parola kullanılmayacak, giriş e-posta bağlantısıyla yapılacak.
   - **Auto Confirm User** kutusunu işaretle.
2. **Authentication → Sign In / Providers:** **Allow new users to sign up** ayarını **kapat**.
3. **Authentication → URL Configuration**
   - **Site URL:** `https://studio-seoz-davet.pages.dev`
   - **Redirect URLs** alanına şu ikisini ekle:
     - `https://studio-seoz-davet.pages.dev/**`
     - `http://127.0.0.1:5500/**` (Live Server ile çalışırken lazım)
4. Editörü aç, sağ üstteki **☁ Giriş Yap** düğmesine tıkla ve e-postanı yaz. E-postana gelen bağlantıya **aynı tarayıcıda** tıkla. Düğmede e-postanı görürsen giriş tamam demektir.
5. **SQL Editor**'e aşağıdaki kodu yapıştır. **`SENIN-EPOSTAN@gmail.com`** kısmını kendi e-postanla değiştir; bu yalnızca **tek bir yerde** geçiyor. Sonra **Run**'a bas.

```sql
-- Sahip kontrolü: yalnızca bu e-postayla giriş yapan kişi yazabilir
create or replace function public.seoz_is_owner() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'SENIN-EPOSTAN@gmail.com'
$$;

-- 1) Yayınlanan davetiyeler: herkes OKUR, yalnızca sen YAZARSIN
alter table public.published_invitations enable row level security;
do $$ declare p record; begin
  for p in select policyname from pg_policies
           where schemaname = 'public' and tablename = 'published_invitations' loop
    execute format('drop policy %I on public.published_invitations', p.policyname);
  end loop;
end $$;
create policy "herkes okur" on public.published_invitations
  for select to anon, authenticated using (true);
create policy "sahip ekler" on public.published_invitations
  for insert to authenticated with check (public.seoz_is_owner());
create policy "sahip gunceller" on public.published_invitations
  for update to authenticated using (public.seoz_is_owner()) with check (public.seoz_is_owner());

-- 2) Medya dosyaları: herkes GÖRÜR (public bucket), yalnızca sen YÜKLERSİN
drop policy if exists "davetiye-medya yukleme" on storage.objects;
drop policy if exists "davetiye-medya sahip yukler" on storage.objects;
create policy "davetiye-medya sahip yukler" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'davetiye-medya' and public.seoz_is_owner());

-- 3) Görüş Bildir: misafir yalnızca EKLER, yalnızca sen OKURSUN
create table if not exists public.feedback_submissions (
  id bigint generated by default as identity primary key,
  created_at timestamptz not null default now(),
  invitation_slug text,
  doc_id text,
  layer_id text,
  name text check (char_length(name) <= 200),
  contact text check (char_length(contact) <= 200),
  message text not null check (char_length(message) between 1 and 1000)
);
alter table public.feedback_submissions enable row level security;
drop policy if exists "misafir gorus ekler" on public.feedback_submissions;
drop policy if exists "sahip okur" on public.feedback_submissions;
create policy "misafir gorus ekler" on public.feedback_submissions
  for insert to anon, authenticated with check (true);
create policy "sahip okur" on public.feedback_submissions
  for select to authenticated using (public.seoz_is_owner());
```

6. **Test:**
   - Giriş yapmış hâlde **Yayına Hazırla** çalışmalı.
   - **☁** düğmesinden çıkış yapıp tekrar dene; bu sefer "giriş yapman gerekiyor" uyarısı çıkmalı.

Gelen görüşleri **Table Editor → feedback_submissions** tablosunda görebilirsin.

### C) Editörü kilitle (Cloudflare Access)

Bu adım A'dan sonra yapılmalı; aksi hâlde müşteri linkleri de kilitlenir.

1. Cloudflare → **Zero Trust**. İlk girişte bir takım adı ve **Free** plan seçmen istenir; bazen ücretsiz plan için bile kart bilgisi sorulur.
2. **Access → Applications → Add an application → Self-hosted**
3. **Domain:** `studio-seoz-davet.pages.dev`
4. **Policy:** Action **Allow**, Include → **Emails** → kendi e-postan.
5. Kaydet.

Artık editör adresini açan kişiden e-posta kodu istenir; kodu yalnızca sen alabilirsin. `seoz-davetiye.pages.dev` bu kilitten etkilenmez.

> Bu ayarlarda kodda hiçbir yerde parola veya gizli anahtar yok. Tarayıcıya giden tek anahtar herkese açık olmak için tasarlanmış "publishable/anon" anahtar. Yetkiyi Supabase kuralları ve Cloudflare belirliyor.

---

## Güncellemeyi gönderme

1. Bu ZIP'in içindeki dosyaları bilgisayarındaki `seoz-editor` klasörünün **üzerine kopyala**. `supabase-config.js` pakette olmadığı için seninki korunur.
2. VS Code terminaline sırayla şunları yaz:

```
git add .
git commit -m "Editör güçlendirme: hediye, bakır, çoğalt, stil, fontlar, güvenlik"
git push
```

Cloudflare iki siteyi de 1-2 dakika içinde kendiliğinden günceller.
