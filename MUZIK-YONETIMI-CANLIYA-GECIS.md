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
