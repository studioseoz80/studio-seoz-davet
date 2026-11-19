# Müziğimi Yönet — Canlıya Geçiş Planı

**Ne yapar:** Müşteri, davetiyesinin müziğini kendine özel `muzigim.html#k=...` bağlantısıyla yükler, dinler, değiştirir veya siler. Her yüklemeden önce telif ve kullanım hakkı onayı verir. Studio SEOZ, kütüphanedeki **♪ Müzik Denetimi** ile müziği anında devre dışı bırakabilir.

**Nerede durur:**
- Müzik dosyaları Cloudflare R2'de, herkese kapalı bir bucket'ta (`MUSIC_BUCKET`).
- Kayıtlar Supabase'de: `music_tracks`, `music_consents`, `music_log`. Bu tablolar yalnızca Studio SEOZ hesabına açıktır.
- Mevcut davetiyeler, Katılım Paneli, Anı Albümü ve anket etkilenmez.
- Müzik modülünün varsayılanı eskisi gibi "Studio SEOZ yükler"dir.

**Dil:** Sayfa davetiyenin diliyle açılır; davetiye İngilizceyse sayfa da İngilizce açılır. Müşteri sağ üstten TR / EN seçebilir.
- Telif onayının Türkçe (`muzik-onay-v1`) ve İngilizce (`music-consent-v1-en`) metni ayrı sürüm adlarıyla tutulur. Kayıtta hangi dildeki metnin onaylandığı görünür.
- Metinler `supabase/muzik-yonetimi.sql` içindeki `seoz_private.music_consent` fonksiyonunda durur.
- **Metin değişirse sürüm adı da değiştirilmelidir.**
- İngilizce metin canlıya geçmeden önce onaylanmalıdır.

## Maliyet kontrolü

**Depolama sınırı (sunucuda):** Müşteri müziklerinin toplamı **8 GB**'a yaklaşınca yeni yükleme durur.
- R2'nin ücretsiz katmanı 10 GB'tır.
- Tam kural: kalan yer tek bir en büyük dosyaya (10 MB) yetmiyorsa yükleme durur.
- Müşteri şu mesajı görür: "Müzik yükleme şu anda kullanılamıyor. Lütfen Studio SEOZ ile iletişime geçin." İngilizce sayfada: "Music upload is currently unavailable. Please contact Studio SEOZ."
- Mevcut müzikler çalmaya devam eder.
- **Hiçbir müzik kendiliğinden silinmez.** Yer, Müzik Denetimi'nden **elle** silinen müziklerle açılır; yükleme o anda yeniden açılır.

**Eş zamanlı yüklemeler:**
- Her yükleme, dosya R2'ye yazılmadan önce Supabase'de tek kilit altında yer ayırır. Yer yoksa R2'ye hiçbir şey yazılmaz.
- 15 dakikada tamamlanmayan ayırma "yarım kalan" sayılır ve toplamdan düşer. Müzik Denetimi'ndeki **Temizle** düğmesiyle elle temizlenir.

**R2 işlem sınırları:**

| Sınır | Değer | Etkisi |
| --- | --- | --- |
| Tek dosya | 10 MB | Boyut, dosya okunmadan önce kontrol edilir. |
| Davetiye başına yükleme | 10 / 24 saat | Aynı anda en fazla 2 yükleme sürebilir. |
| Bütün müşteriler, toplam yükleme | 200 / 24 saat | Ayda en fazla ~12 bin R2 yazma işlemi; ücretsiz sınır 1 milyon. |
| Reddedilen yükleme | R2'ye hiç yazılmaz | Onaysız, MP3 olmayan, büyük dosya ya da yer yoksa. |

**R2 okuma işlemleri:**
- Misafir dinlemesi önce Cloudflare önbelleğinden gelir. Önbellek yalnızca davet.studioseoz.com alan adında çalışır.
- Önbellekte yoksa istek başına tek R2 okuması yapılır.
- Şu istekler R2'ye hiç dokunmaz: "müzik var mı?" sorgusu, HEAD istekleri ve tarayıcının "değişmedi" (304) yanıtı.
- Müzik, misafir dokunmadan indirilmez.
- Başka sitelerin dosyayı kendi sayfasına gömmesi engellenir.

**Sınırları değiştirmek:** `supabase/muzik-yonetimi.sql` → `seoz_private.music_limits()`.

**Önerilen Cloudflare ayarları (kart bağlandıktan sonra, onayla):**
1. **Billing → Notifications:** kullanıma dayalı fatura uyarısı (ör. $1).
2. **R2 uyarıları:** depolama ve işlem kullanımı için Cloudflare'in sunduğu bildirimler.
3. **studioseoz.com → Security → Rate limiting** (ücretsiz planda 1 kural): `/muzik/*` ve `/api/muzik/*` için IP başına 10 saniyede 60 istekten fazlası engellensin. Bu kural yalnızca alan adında çalışır, pages.dev adresinde çalışmaz.

R2'de kesin bir harcama tavanı yoktur. Yukarıdaki sınırlar kullanımı ücretsiz katmanın içinde tutmak için tasarlandı.

## Sıra

Her adım ayrı onayla yapılır.

1. **R2 bucket'ı.** Cloudflare → R2 → Create bucket → ad: `seoz-muzik`.
   - Public access **kapalı** kalır. Custom domain eklenmez.
2. **Bağlama (müşteri projesi).** Workers & Pages → **seoz-davet** → Settings → Bindings → Add → R2 bucket.
   - Variable name: `MUSIC_BUCKET`. Bucket: `seoz-muzik`.
   - Bu bağlama **Production** ortamına eklenir. Önizleme (Preview) ortamına eklenmez.
   - Editör projesine (studio-seoz-davet) eklenmez.
3. **Supabase.** `supabase/muzik-yonetimi.sql` çalıştırılır. Dosya yalnızca yeni tablo ve fonksiyon ekler.
   - Geri dönüş: `supabase/muzik-yonetimi-geri-al.sql`. Fonksiyonları kaldırır; onay kayıtları kanıt olarak kalır.
4. **Kod.** `muzik-yonetimi` dalı `main`'e birleştirilir. İki Cloudflare projesi kendiliğinden yeniden yayınlanır.
5. **Canlı deneme (yeni, test amaçlı bir davetiyeyle):**
   1. Müzik katmanında "Müşteri kendi müziğini yönetir" seçilir, ardından Yayına Hazırla'ya basılır.
   2. Müziğimi Yönet bağlantısı telefondan açılır; MP3 yüklenir, dinlenir, değiştirilir ve silinir.
   3. Davetiye iPhone ve Android'de açılır: zarfa dokununca müzik başlamalı, nota ile durmalı.
   4. Müzik Denetimi'nde müzik devre dışı bırakılınca davetiyede çalmamalı.

## Geri dönüş

- **Kod:** `main` bir önceki kayda geri alınır. Eski davetiyeler bundan etkilenmez.
- **Acil durdurma (müşteri müziklerinin hepsi):** `muzik-yonetimi-geri-al.sql` çalıştırılır. Davetiyeler müziksiz açılır.
- **Tek davetiye:** Müzik Denetimi → Devre dışı bırak.

## Bilinmesi gerekenler

- Telif onayı Studio SEOZ'un sorumluluğunu **tamamen kaldırmaz**. Asıl koruma, şikâyet gelince hemen devre dışı bırakmaktır. Onay metni ve kullanım şartları için avukat görüşü önerilir.
- Davetiyede çalınabilen her müzik, davetiye bağlantısını bilen biri tarafından indirilebilir. Bu teknik olarak önlenemez.
- **Sınırlar:**
  - Yalnızca MP3; içerik sunucuda kontrol edilir, uzantıya bakılmaz.
  - En fazla 10 MB.
  - Davetiye başına günde en fazla 10 yükleme.
- Değiştirilen veya silinen dosya R2'den hemen silinir. Etkinlikten sonra otomatik silme bu aşamada yoktur.
