# 3D Model (GLB) — Canlıya Geçiş, Yedek ve Geri Dönüş Planı

Bu belge yalnızca plandır. Aşağıdaki adımların hiçbiri Seher Hanım'ın ayrı onayı
olmadan yapılmaz.

## Şu anki durum

| Yer | Sürüm |
|---|---|
| GitHub `main` (canlı) | `08bdcdb` — MP4 yükleme ve MP4 indirme |
| Yerel `3d-model` dalı | `08bdcdb` + 3D model 1. ve 2. aşama (yalnızca bu bilgisayarda) |
| Cloudflare `studio-seoz-davet` (editör) | `main` → `08bdcdb` |
| Cloudflare `seoz-davet` (müşteri) | `main` → `08bdcdb` (`sh build-public.sh`) |
| Supabase | **Değişiklik gerekmiyor.** `davetiye-medya` deposu zaten herkese açık okunur, dosya türü/boyut sınırı yok, yalnızca sahip yükleyebilir (salt okunur sorguyla doğrulandı). |

`3d-model`, `08bdcdb`'nin hemen üstünde olduğu için `main`'e birleştirme
"ileri sarma" (fast-forward) olur; araya başka değişiklik girmez.

## Canlıya geçiş adımları (onaydan sonra)

1. **Yedek etiketi:** `git tag yedek-3d-oncesi 08bdcdb` ve etiketi GitHub'a gönder.
   (Geri dönüş noktası; hiçbir şeyi değiştirmez.)
2. **Birleştir:** `git checkout main && git merge --ff-only 3d-model`.
3. **Gönder:** `git push origin main` (tek gönderim).
4. Cloudflare iki projeyi kendisi derler. Derleme başarısız olursa **tekrar
   denenmez**; hata kaydı raporlanır.
5. **Canlı kontroller (yalnızca okuma):**
   - Eski davetiyeler (zarf, PNG, MP4, kapı açılışları) açılıyor mu?
   - Model olmayan bir davetiyede `model3d.js` / `vendor/three` indirilmiyor mu?
   - Editörde "+ 3D Model ekle (GLB)" düğmesi görünüyor mu?
   - Gerçek bir telefonda disko topuyla deneme davetiyesi (Seher Hanım'ın onayıyla
     yayınlanır; istenirse sonra silinir).
   - "MP4 İndir" hâlâ çalışıyor mu?

## Geri dönüş (sorun çıkarsa)

En hızlıdan en kalıcıya:

1. **Cloudflare'de bir önceki yayına dön (1 dakika):** Cloudflare panelinde her iki
   proje için *Deployments → `08bdcdb` yayını → Rollback to this deployment*.
   Kod değişmez, site hemen eski hâline döner.
2. **Kodu geri al:** `git revert` ile 3D değişikliklerini geri alan yeni bir kayıt
   oluşturup gönder (geçmiş silinmez), ya da `main`'i `yedek-3d-oncesi`
   etiketine döndür (yalnızca onayla; zorla gönderim gerektirir).
3. **Supabase:** geri alınacak bir şey yok. Bu geliştirme tablo, kural, fonksiyon
   veya depo ayarı değiştirmez. 3D modelli bir davetiye yayınlanmışsa GLB
   dosyası `davetiye-medya/<davetiye>/` altında durur. Geri dönüşte eski kod
   modeli tanımadığı için o davetiyede model katmanı boş görünür (açılış ve
   davetiye yine çalışır); 3D'li davetiye varsa geri dönüşten önce bildirilir.

## Bu sürüm neyi değiştirmez

- Mevcut davetiyelerin kayıtları (yeni alan `model` yalnızca 3D katmanında var).
- `view.html` (müşteri sayfası) — 3D dosyaları yalnızca davetiyede model varsa,
  açılış hazırlanırken sonradan yüklenir.
- Supabase tabloları, kuralları, depolama ayarları.
- PNG, MP4, zarf, kapı, tema, modül ve etkileşim sistemleri (test sonuçları raporda).
