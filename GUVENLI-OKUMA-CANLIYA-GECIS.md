# Güvenli Davetiye Okuma — Canlıya Geçiş ve Geri Dönüş Planı

**Amaç:** Herkese açık anahtarla `published_invitations` tablosunun topluca okunmasını (34 davetiye; IBAN, telefon, adres) kapatmak. Bunu yaparken mevcut davetiye bağlantıları, editör, Katılım Paneli, Anı Albümü, anket, Dilek Ağacı, Mühürlü Kart, takvim dosyası ve paylaşım önizlemesi bozulmamalı.

**Kural:** Her adım ayrı onayla yapılır. Bir adımda sorun çıkarsa durulur ve o adımın geri dönüşü uygulanır.

## Ne değişiyor

| Önce | Sonra |
| --- | --- |
| Misafir sayfası tabloyu doğrudan okur (`?slug=eq.`) | `invitation_get(slug)`: yalnızca tam bağlantı adıyla, tek davetiye |
| Herkese açık yanıtta, davetiyede gösterilmeyen eski alanlar da var (ör. Hediye "Kapalı" iken eski IBAN) | Gösterilmeyen kişisel alanlar yanıttan çıkarılır; misafirin gördüğü her şey aynen kalır |
| Editör "bağlantı adı dolu mu?" sorusunu herkese açık okumayla sorar | `invitation_slug_taken`: yalnızca Studio SEOZ hesabı sorabilir |
| Editör tabloya "varsa üzerine yaz" yöntemiyle yazar | `invitation_owner_publish`: sahip sunucuda doğrulanır; bağlantı adı başka bir davetiyeye aitse üzerine YAZILMAZ |
| Paylaşım önizlemesi, takvim dosyası ve paket sayfası tabloyu okur | Hepsi `invitation_get` ile okur |

Yeni kod, fonksiyonlar kurulu değilse kendiliğinden eski yola döner. Bu sayede sıralama hatası davetiyeleri kapatmaz.

## Adımlar

1. **Yedek.** Kod tarafında `main`'in o anki hâli `yedek-guvenli-okuma-oncesi` dalına alınır. Veri tarafında `supabase/guvenli-okuma-yedek.sql` çalıştırılır: davetiyelerin tam kopyası ve mevcut kurallar herkese kapalı `seoz_private` şemasına alınır.
2. **Fonksiyonlar.** `supabase/guvenli-okuma.sql` çalıştırılır. Bu dosya yalnızca ekleme yapar; genel okuma açık kalır.
   - Kontrol: `supabase/guvenli-okuma-kontrol.sql` (yalnızca okur).
   - Geri dönüş: `supabase/guvenli-okuma-geri-al.sql`.
3. **Kod.** `guvenli-okuma` dalı `main`'e birleştirilir ve iki Cloudflare projesi yayınlanır. Geri dönüş: `main`'i yedek dala geri almak.
4. **Deneme (genel okuma hâlâ açıkken).** Şunlar denenir:
   - Gerçek davetiyeler: kısa ve uzun bağlantı, iPhone ve Android.
   - Editörden yayınlama ve güncelleme.
   - Katılım Paneli, Anı Albümü ve fotoğraf yükleme, anket.
   - Dilek Ağacı, Mühürlü Kart, takvim dosyası, WhatsApp önizlemesi, teslimat paketi.
5. **Genel okumayı kapat.** `supabase/guvenli-okuma-kapat.sql` çalıştırılır: "herkes okur" kaldırılır, yalnızca sahibe açık "sahip okur" eklenir.
   - Acil geri dönüş: `supabase/guvenli-okuma-kapat-geri-al.sql` (tek adımda eski hâl).
6. **Kapandığını doğrula.**
   - `guvenli-okuma-kontrol.sql` çalıştırılır; `herkese_acik_satir = 0` olmalı.
   - Herkese açık anahtarla tablo okuması boş dönmeli.
   - 4. adımdaki denemeler tekrarlanır.

## Bilinmesi gerekenler

- **4. adım beklemeden 5. adıma geçilmez.** Eski kod (`main`), genel okuma kapalıyken davetiyeleri açamaz; bu yerel testte doğrulandı.
- **Bağlantı adları değişmez.** Hiçbir davetiye kaydı değiştirilmez; çıkarma işlemi yalnızca herkese açık yanıtta yapılır.
- **Gösterilen bilgiler görünmeye devam eder.** IBAN, WhatsApp numarası ve adres davetiyede gösteriliyorsa misafir onları görmeye devam eder; bu bilgiler davetiyenin bağlantısını bilen herkese açıktır. Toplu listeleme ise artık mümkün değildir. Bağlantı adlarının sonundaki 6 karakterli rastgele ek, tahminle bulmayı pratikte imkânsız kılar.
