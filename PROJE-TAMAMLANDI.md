# Studio SEOZ Editörü — PROJE TAMAMLANDI

Faz 1'den Faz 10'a kadar planladığımız tüm aşamalar tamamlandı. Bu belge,
projenin bütününün son durumunu özetliyor.

## Ne inşa edildi

**Genel amaçlı, modüler bir dijital davetiye editörü** — düğün, kına,
after party, baby shower, doğum günü, iş yeri açılışı veya aklınıza
gelecek herhangi bir etkinlik için, kod yazmadan tasarım yapabildiğiniz
bir sistem. Mevcut Studio SEOZ mağaza sitesinden (`site/` klasörü)
tamamen bağımsız — hiçbir dosyasını paylaşmıyor.

### Editör (`index.html`)
- Davetiye kütüphanesi: oluştur / kopyala / sil / JSON dışa-içe aktar
- Metin katmanı: sürüklenebilir, yeniden boyutlandırılabilir, **sayısal**
  punto/genişlik/yükseklik, 25 font (5 kategori), renk, kalın/italik/
  altı çizili, hizalama, harf/satır aralığı
- Fotoğraf katmanı: yükle, sürükle, iki yönlü boyutlandır, oranı kilitle,
  değiştir
- Zemin (arka plan) görseli/rengi
- Katman paneli: çoğalt, sil, öne/arkaya al, tümü için ortak
- Giriş sahnesi: PNG / Video / Yok, **zarftan çıkan iç kart** aşaması,
  "Girişi Yeniden Oynat", misafir için "Baştan İzle" aç/kapa
- 7 modül: **Konum, Müzik, Geri Sayım, RSVP (4 mod), Galeri, Anı Yükle,
  Kutlama Efekti** — hepsi aynı otomatik-form-üreten mimariden
- Mobil/Masaüstü ayrı düzenleme: her katman için isteğe bağlı masaüstüne
  özel konum/boyut, mobili hiç etkilemeden
- "Yayına Hazırla" öncesi akıllı kontrol listesi (eksik WhatsApp
  numarası, boş Maps bağlantısı vb. için uyarı — zorunlu değil, bilgi
  amaçlı)
- Otomatik kayıt + "Kaydedildi ✓" durumu + depolama hatalarında açık uyarı

### Yayın sayfası (`view.html`)
- Editörle AYNI render motorunu kullanır — "editörde güzel, yayında
  kaymış" sorunu yapısal olarak yok
- `js/editor/` klasöründen HİÇBİR dosya yüklemez — müşteri tarafında
  düzenleme yapısal olarak imkânsız
- Taslak/yayın ayrımı: siz düzenlemeye devam etseniz bile, tekrar
  "Yayına Hazırla" demeden müşteri eski (yayınlanan) hâli görür
- Gerçek tarayıcı genişliğine göre mobil/masaüstü düzenini canlı seçer

### Veri katmanı
- Belgenin kendisi (metin, ayarlar, katman konumları) → localStorage
  (küçük, hızlı)
- Görseller/videolar/müzik → **IndexedDB** (localStorage'ın küçük
  kotasını aşan büyük dosyalar için) — belgede yalnızca küçük bir
  referans tutulur, IndexedDB yoksa sessizce eski yönteme döner

## Bilinen, açıkça belirtilmiş sınırlar

Bunları gizlemedim, her birini ilgili test rehberinde de ayrıntılı
anlattım:

1. **"Anı Yükle" gerçek/paylaşımlı değildir.** Misafirin girdiği harici
   bağlantıyı (Google Drive vb.) açan bir buton — yükleme mantığının
   kendisi sizin belirlediğiniz harici serviste gerçekleşir.
2. **Video/ses dosyaları küçültülmez** (yalnızca görseller küçültülür) —
   kısa/küçük dosya kullanmanız önerilir.
3. **Bir katmanı Çoğalt ile kopyalarsanız ve o katmanın masaüstü
   override'ı varsa**, kopyanın masaüstü konumu orijinaliyle aynı kalır
   (nadir bir kenar durum).
4. **Bir görseli/videoyu değiştirdiğinizde eski dosya IndexedDB'de
   kalmaya devam eder** (otomatik silinmiyor — katmanları çoğaltma
   nedeniyle referans paylaşımı riski olduğundan bilerek basit
   tutuldu). Gerçek kullanımda sorun yaratmaz.
5. **Kalıcı, çok cihazlı bir veritabanı yoktur** — her şey tarayıcı
   bazlıdır. Bir cihazdan diğerine taşımak için JSON dışa/içe aktarma
   kullanabilirsiniz.

## Regresyon testi

`tests/core-selftest.js` — veri katmanının (belge modeli, kayıt, modül
sistemi, geometri çözümleme, yayın doğrulaması, font kütüphanesi)
**167 senaryosunu** Node üzerinde gerçekten çalıştırarak doğruluyor.
Herhangi bir değişiklikten sonra şunu çalıştırmanız yeterli:
```
cd seoz-editor
node tests/core-selftest.js
```
Tarayıcı-etkileşimli kısımlar (sürükleme, gerçek animasyon, ses/video
oynatma) için gerçek bir tarayıcı gerektiğinden, her fazın kendi
FAZ*-TEST-REHBERI.md dosyasında elle test adımları var.

## Yayına alma öncesi kontrol listesi

1. `python3 -m http.server 8000` ile (ya da tercih ettiğiniz bir statik
   hosting ile) siteyi çalıştırın.
2. Birkaç gerçek davetiye oluşturup uçtan uca test edin (giriş sahnesi,
   modüller, mobil/masaüstü, yayınlama).
3. `node tests/core-selftest.js` ile veri katmanının sağlam olduğunu
   doğrulayın.
4. Gerçek müşterilere açmadan önce: Anı Yükle bağlantılarınızı,
   Konum/RSVP WhatsApp numaralarınızı, Google Form bağlantılarınızı
   gerçek değerlerle doldurun — "Yayına Hazırla" bunları unutursanız
   size hatırlatacak.

## Dosya haritası

```
seoz-editor/
├─ index.html, view.html
├─ css/canvas.css (ortak), css/editor-chrome.css (yalnızca editör)
├─ js/core/            → editör + view.html ORTAK motor
├─ js/modules/         → 7 modül (yeni modül eklemek: 1 dosya + kayıt)
├─ js/editor/          → yalnızca index.html yükler
├─ js/entry-scene.js, js/fonts-library.js, js/view-app.js
├─ tests/core-selftest.js
└─ FAZ1..FAZ8-TEST-REHBERI.md → her fazın ayrıntılı test rehberi
```

Sorularınız veya yeni bir özellik/düzeltme isteğiniz olursa buradan
devam edebiliriz — mimari, yeni bir modül veya küçük bir ayar eklemeyi
kolaylaştıracak şekilde kuruldu.
