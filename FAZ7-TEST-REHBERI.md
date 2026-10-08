# Studio SEOZ Editörü — FAZ 7 Teslim Notu (sizin adlandırmanızla "Faz 6": Kutlama Efektleri)

Küçük bir numaralandırma notu: Galeri + Anı Yükle teslimimi "FAZ6-TEST-REHBERI.md"
olarak kaydetmiştim; siz kutlama efektlerini "Faz 6" olarak adlandırdınız.
Karışıklık olmasın diye bu dosyayı FAZ7 olarak kaydediyorum ama içerik
sizin istediğiniz "Kutlama Efektleri" fazının tam karşılığıdır.

FAZ 7 kapsamı: **Kutlama Efekti modülü** — Konfeti/Parıltı, iki tetikleme
modu (Sayfa açılışında otomatik / Bir butona basınca), sabit yoğunluk
seviyeleri (Az/Orta/Çok), performans güvenliği. Faz 1-5'te (ve Anı
Yükle düzeltmesinde) teslim edilen hiçbir dosya bozulmadı.

## Mimariye küçük bir ekleme

Modülün "Misafir tekrar oynatabilsin" ayarı gerçek bir onay kutusu
(checkbox) olsun istedim, bu yüzden `module-panel.js`'e yeni bir
`"checkbox"` alan tipi ekledim — geriye dönük uyumlu, mevcut altı modül
bunu kullanmadığı için davranışları değişmedi.

## Performans güvenliği — nasıl sağlandı

- Efekt, sınırlı sayıda parçacıkla (Az: 40, Orta: 90, Çok: 160) çalışır
  — sınırsız/aşırı parçacık YOK.
- Tek bir `<canvas>` üzerinde çizilir (DOM'a yüzlerce eleman eklenmez).
- Tam olarak **3.2 saniye** sonra kendini TAMAMEN temizler:
  `requestAnimationFrame` iptal edilir, `resize` dinleyicisi kaldırılır,
  canvas DOM'dan silinir. Geride hiçbir şey kalmaz.
- Harici kütüphane (konfeti paketi vb.) kullanılmadı — saf Canvas API.

## Nasıl test edersiniz

```
python3 -m http.server 8000
```

## Test senaryosu

1. **"+ Modül Ekle..."** listesinden **Kutlama Efekti**'ni seçin.
   Varsayılan "Sayfa Açılışında Otomatik" modda, editörde soluk bir
   "🎉 Konfeti — sayfa açılışında otomatik oynar" kutusu + **"▶ Test
   Et"** butonu görünmeli. Test Et'e basınca ekranı kaplayan konfeti
   animasyonunu görmelisiniz (yaklaşık 3 saniye sürüp kendiliğinden
   kaybolmalı).
2. **Efekt Türü**'nü **Parıltı**'ya çevirip tekrar test edin — daha
   yumuşak, titreşen küçük daireler görmelisiniz.
3. **Yoğunluk**'u Az/Orta/Çok arasında değiştirip farkı gözlemleyin.
4. 4 renk alanından paleti değiştirin — parçacıklar bu renklerden
   rastgele seçilmeli.
5. **"Misafir tekrar oynatabilsin"** kutusunu işaretli bırakıp **Yayına
   Hazırla** → `view.html`'i açın:
   - Sayfa açılır açılmaz efekt **bir kez** otomatik oynamalı.
   - Altta **"🎉 Tekrar Oynat"** butonu görünmeli, istediğiniz kadar
     tekrar tetikleyebilmelisiniz.
   - **Kritik test:** Tarayıcı penceresini yeniden boyutlandırın
     (veya geliştirici araçlarından mobil/masaüstü görünüm arasında
     geçiş yapın) — efekt TEKRAR TETİKLENMEMELİ. Yalnızca gerçek sayfa
     yenilemesinde (F5) bir kez daha oynamalı.
6. Kutuyu işaretlemeden yeniden yayınlayın — `view.html`'de "Tekrar
   Oynat" butonu GÖRÜNMEMELİ (yalnızca otomatik ilk oynatma olmalı).
7. **Tetikleme**'yi **"Bir Butona Basınca"** yapın. Panelde artık buton
   yazısı + tam stil alanları (font, renk, boyut, köşe yuvarlaklığı)
   görünmeli. Tuvaldeki butona hem editörde hem yayında tıklayınca
   efektin oynadığını doğrulayın.

## Bilerek aldığım tasarım kararları

- **Editörde otomatik mod hiçbir zaman kendiliğinden oynamaz** —
  yalnızca "▶ Test Et" ile manuel önizlenir. Aksi halde her katman
  ekleme/silme/düzenleme işleminde ekranınız konfetiyle dolardı.
- **Pencere yeniden boyutlandırma efekti tekrar tetiklemez** — bu,
  view.html'in `resize` olayında tüm sayfayı yeniden çizmesinden
  kaynaklanan gerçek bir riskti; katman kimliğine göre "bu oturumda
  zaten oynadı mı?" takibi ekleyerek çözdüm.
- **Efekt, katmanın kendi kutusuna değil tüm ekrana** yayılır (Giriş
  Sahnesi'nde kullandığımız aynı "tam ekran, kendi kendini temizleyen
  katman" deseniyle) — bir konfeti patlaması küçük bir kutuya
  sıkıştırılamayacak kadar "tam ekran" bir olay olduğu için.

## Gerçekten çalıştırıp doğruladığım kısım

`tests/core-selftest.js` artık **88 senaryo** içeriyor (Faz 7 için 17
yeni test: modül kaydı, varsayılan ayarlar, her `showIf` kombinasyonunun
doğru alanları gösterip gizlediği, checkbox alan tipinin doğru
tanımlandığı, derin kopya doğrulaması, kayıt/yükleme sonrası korunma).
Hepsi geçiyor:
```
cd seoz-editor
node tests/core-selftest.js
```
Tüm JS `node --check`'ten geçti, HTML'ler etiket dengesinden geçti, tüm
modül referansları çapraz kontrol edildi, ve önceki altı modülün
(Konum, Müzik, Geri Sayım, RSVP, Galeri, Anı Yükle) MD5 karşılaştırmasıyla
hiç değişmediği doğrulandı.

Gerçek canvas animasyonu, pencere yeniden boyutlandırma davranışı gibi
tarayıcı-etkileşimli kısımlar için gerçek bir tarayıcı çalıştıramadım —
lütfen yukarıdaki adımları deneyin, özellikle 5. maddedeki "yeniden
boyutlandırma tekrar tetiklemiyor" testini.

## Değişen / eklenen dosyalar

**Yeni:**
- `js/modules/celebration.js`

**Genişletilen (bozulmadı, geriye dönük uyumlu şekilde üzerine eklendi):**
- `js/editor/module-panel.js` → yeni `"checkbox"` alan tipi
- `index.html`, `view.html` → yeni script referansı
- `tests/core-selftest.js` → 17 yeni test senaryosu

## Sıradaki adım

Kalan fazlar (orijinal planımdan): **Faz 8** (mobil ayrı düzenleme +
override sistemi), **Faz 9** ("Yayına Hazırla" akışının tam
sağlamlaştırılması + doğrulama), **Faz 10** (font kütüphanesini
genişletme). Onayınızı bekliyorum — hangisiyle devam edelim?
