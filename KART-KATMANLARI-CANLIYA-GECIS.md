# Kart Üzerindeki Katmanlar — Canlıya Geçiş ve Geri Dönüş Planı

Bu belge yalnızca plandır. Cloudflare ve Supabase adımları Seher Hanım'ın ayrı
onayı olmadan yapılmaz.

## Şu anki durum

| Yer | Sürüm |
|---|---|
| GitHub `main` (canlı) | `dd704ea` — arka plan rengi |
| Cloudflare editör + müşteri sitesi | `dd704ea` (iki yayın da başarılı) |
| `kart-katmanlari` dalı | `dd704ea` + kart katmanları (`main`'in hemen üstünde) |
| Supabase | **Değişiklik gerekmiyor.** Yeni alanlar davetiye kaydının içinde gider; PNG'ler mevcut `davetiye-medya` deposuna yüklenir. |

Canlıdaki 24 davetiyenin (15'i sinematik açılışlı) hiçbiri yeni alanları
(`cardLayers`, `cardMode: "plain"`) kullanmıyor (salt okunur sorguyla
doğrulandı). Yeni kod yalnızca bu alanlar varsa devreye girer.

## Canlıya geçiş (onaydan sonra)

1. `dd704ea` için yedek dalı: `yedek-kart-oncesi` (GitHub'a gönderilir).
2. `git checkout main && git merge --ff-only kart-katmanlari`
3. `git push origin main` → Cloudflare iki siteyi kendisi derler. Derleme
   başarısız olursa tekrar denenmez; hata kaydı raporlanır.
4. Yayın sonrası kontroller (okuma):
   - Eski bir davetiye açılıyor mu, açılış her zamanki gibi mi?
   - Editörde İç kart → "Kart üzerindeki katmanlar" bölümü görünüyor mu?
   - Deneme davetiyesinde yazılar sırayla geliyor mu (telefon)?
   - "MP4 İndir → Açılış + iç kart" yazıları içeriyor mu?

Not: Bir dalı GitHub'a göndermek, Cloudflare'de o dal için otomatik bir
**önizleme** yayını oluşturur. Bu canlı siteyi değiştirmez, ama Cloudflare'de
yeni bir önizleme kaydı açar.

## Geri dönüş

1. **En hızlı (1 dakika):** Cloudflare panelinde her iki proje için
   *Deployments → `dd704ea` yayını → Rollback to this deployment*.
2. **Kalıcı:** `git revert` ile kart katmanları kaydını geri alan yeni bir kayıt
   gönderilir (geçmiş silinmez). İstenirse `main`, `yedek-kart-oncesi` dalına
   döndürülür (yalnızca onayla).
3. **Supabase:** geri alınacak bir şey yok.
4. **Geri dönüş sonrası:** Arada kart katmanlı bir davetiye yayınlanmışsa, eski
   kod yeni alanları tanımadığı için o davetiyede kart üzerindeki yazılar ve
   PNG'ler görünmez; kart, davetiyenin başlığını taşıyan eski "yazılı kart"
   olarak görünebilir (açılış ve davetiye çalışmaya devam eder). Böyle bir davetiye varsa geri
   dönüşten önce bildirilir.

## Değişen dosyalar (7)

`js/cinema/cinema-core.js`, `js/cinema/free.js`, `css/cinema.css` (müşteri
sitesi), `js/editor/cinema-studio2.js`, `js/editor/cinema-library.js`,
`js/editor/video-export.js`, `css/cinema-studio.css` (yalnızca editör).
