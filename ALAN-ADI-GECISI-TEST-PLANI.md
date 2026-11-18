# Alan Adı Geçişi — Taşıma ve Test Planı

**Hedef:** Müşteri sitesini `davet.studioseoz.com`, editörü `editor.studioseoz.com` adresine taşımak. Eski `*.pages.dev` adresleri silinmez, yurt dışında çalışmaya devam eder.

## A. Taşıma Paketi ile editör verisinin taşınması

1. **Eski editörü açın** (VPN gerekebilir): `studio-seoz-davet.pages.dev`. Davetiyelerim ekranında **Taşıma Paketi** düğmesine basın ve özette taslak, görsel, link ve panel anahtarı sayılarına bakın.
2. **Paketi indirin.** Bir taşıma şifresi girip **Taşıma Paketini İndir**'e basın. Bu işlem eski editörde hiçbir şeyi değiştirmez.
3. **Paketi yeni editöre yükleyin.** `editor.studioseoz.com`'u açın, Studio SEOZ girişini yapın. **Taşıma Paketi** düğmesine basın, dosyayı seçin, şifreyi girin, önce **Önce Kontrol Et**'e, sonra **Taşı**'ya basın.
4. **Kontrol edin.** Liste aynı mı? Davetiyeleri açın, görseller görünüyor mu? Sorun varsa **Son Taşımayı Geri Al**'a basın.
5. **Onaylayın.** Her şey yerindeyse **Taşımayı Onayla**'ya basın ve paket dosyasını silin. Dosyada müşteri panel anahtarları var.

## B. Yeni adreslerde kontrol listesi (canlı veriyi değiştirmeden)

| # | Kontrol | Beklenen |
| --- | --- | --- |
| 1 | `davet.studioseoz.com/<bağlantı-adı>` (iPhone, Android, masaüstü) | Davetiye, zarf ve müzik aynen açılır |
| 2 | Aynı davetiye eski `seoz-davet.pages.dev` adresinde (yurt dışı veya VPN) | Açılmaya devam eder |
| 3 | WhatsApp'ta yeni linkin önizlemesi | Kapak, başlık ve açıklama görünür |
| 4 | Takvime ekle, Konum, Galeri, Dilek Ağacı, Mühürlü Kart | Çalışır |
| 5 | Katılım formu (deneme davetiyesinde) → Katılım Paneli `davet.studioseoz.com/panel.html#k=…` | Yanıt panelde görünür |
| 6 | Anı Yükle (deneme davetiyesinde) → Anı Albümü `davet.studioseoz.com/album.html#k=…` | Fotoğraf albümde görünür |
| 7 | Anket paneli ve sonuç sayfası | Açılır |
| 8 | Teslimat Paketi `davet.studioseoz.com/paket.html#…` | Bütün linkler yeni adresle görünür |
| 9 | `editor.studioseoz.com` editör şifresi | Şifre sorulur |
| 10 | Editörde e-posta ile giriş bağlantısı | Bağlantı yeni editöre döner (Supabase'de adres izni gerekli) |
| 11 | Taşınan bir davetiyeyi yeni editörden yeniden yayınlama (önce bir deneme davetiyesiyle) | Aynı link güncellenir; panel ve albüm linkleri değişmez |
| 12 | Yeni QR kodu | Yeni adresi açar |

Gerçek müşteri davetiyelerinde yalnızca **açma** kontrolü yapılır. Yanıt gönderme, yükleme ve yeniden yayınlama denemeleri **deneme davetiyesiyle** yapılır.
