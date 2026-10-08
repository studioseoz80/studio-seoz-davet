# Studio SEOZ Editörü — FAZ 8 Teslim Notu

FAZ 8 kapsamı: **Mobil/Masaüstü ayrı düzenleme sistemi.** Faz 1'den beri
her katmanda rezerve duran (hiç kullanılmayan) alan artık gerçek
işlevine kavuştu. Faz 1-7'de teslim edilen hiçbir davranış bozulmadı.

## Mimari özet

- Canvas hâlâ **tek bir koordinat uzayında** (430px, mobil öncelikli) —
  bu değişmedi, 7 fazdır test ettiğiniz her şey aynen çalışmaya devam
  ediyor.
- Yeni: her katman için **isteğe bağlı bir "masaüstü override"**.
  Kapalıyken (varsayılan, her zaman) masaüstü = mobil ile birebir aynı
  orantılı tasarım. Açtığınızda, o katmanı yalnızca masaüstü
  önizlemesindeyken farklı bir yere sürükleyip farklı bir boyuta
  getirebilirsiniz — mobil görünüm bundan hiç etkilenmez.
- **İsimlendirme notu:** Faz 1'de bu alanı `mobile` olarak adlandırıp
  hiç kullanmamıştım. Şimdi gerçek işlevini kazanırken `desktopOverride`
  olarak yeniden adlandırdım (mantığı ters: varsayılan zaten mobil,
  override edilen masaüstü). Hiçbir çalışan davranışı bozmadı çünkü
  alan daha önce hiç okunmuyor/yazılmıyordu.

## Nasıl test edersiniz

```
python3 -m http.server 8000
```

## Test senaryosu

1. Birkaç katmanlı bir davetiye açın (metin, fotoğraf, bir modül).
2. Üstteki **"Masaüstü Önizleme"**'ye geçin. Önizleme çerçevesi
   genişlerken, sağ tarafta yeni bir **"Masaüstü Düzeni"** paneli
   belirmeli. Hiçbir katman seçili değilken "Masaüstüne özel düzen
   ayarlamak için bir katman seçin" yazmalı.
3. Bir metin katmanı seçin. Panelde **"Bu katman için masaüstünde
   farklı konum/boyut kullan"** onay kutusu görünmeli (varsayılan
   olarak İŞARETSİZ).
4. Kutuyu işaretleyin VEYA doğrudan katmanı sürükleyin (sürüklemek
   otomatik olarak override'ı açar). Katmanı masaüstü önizlemesinde
   farklı bir yere taşıyın.
5. **"Mobil"**e geri dönün — katmanın **orijinal mobil konumunda**
   olduğunu doğrulayın (masaüstü için yaptığınız değişiklik mobili
   HİÇ etkilememeli).
6. Tekrar **"Masaüstü Önizleme"**'ye dönün — katmanın az önce
   taşıdığınız masaüstüne özel konumda kaldığını doğrulayın.
7. **"Masaüstü Ayarını Sıfırla"**'ya basın — katman masaüstünde de
   tekrar mobil ile aynı orantılı konuma dönmeli.
8. Bu davranışı bir **fotoğraf** ve bir **modül** katmanı için de
   deneyin (boyut değişikliği dahil — köşe tutamacından
   boyutlandırdığınızda da aynı override mantığı çalışmalı).
9. **Yayına Hazırla** → `view.html`'i açın. Tarayıcı penceresi geniş
   (≥640px) iken masaüstüne özel düzeni, dar (<640px, ör. telefon veya
   dar bir pencere) iken mobil düzeni görmelisiniz. Pencereyi
   yeniden boyutlandırıp eşiği geçtiğinizde düzenin **canlı olarak**
   değiştiğini gözlemleyin.

## Bilerek aldığım tasarım kararları

- **Eşik: 640px.** Bu genel bir "telefon mu, daha geniş bir ekran mı"
  ayrımıdır — tablet ve masaüstü aynı "desktop" davranışını paylaşır
  (istersen bu eşiği kolayca değiştirebilirim, `js/view-app.js` içinde
  tek bir sabit: `DESKTOP_BREAKPOINT_PX`).
- **Sürüklemek otomatik olarak override'ı açar.** Böylece her katman
  için önce ayrı bir "aç" adımı gerekmiyor — masaüstü önizlemesindeyken
  bir katmanı taşırsanız, sistem "bu katman için farklı bir masaüstü
  düzeni istiyorsunuz" anlar. Hiçbir şeyi sürüklemezseniz hiçbir katman
  etkilenmez, tasarımınız tamamen mobil-öncelikli kalmaya devam eder.
- **Kısmi override desteklenir.** Yalnızca konumu değiştirip boyutu
  mobil değerden miras bırakabilirsiniz (ya da tam tersi) — override
  "hepsi ya da hiçbiri" değildir.
- **Bilinen küçük sınır:** Masaüstüne özel düzeni olan bir katmanı
  "Çoğalt" ile kopyalarsanız, kopyanın masaüstü konumu da orijinaliyle
  aynı kalır (yalnızca mobil konumu ötelenir). Bu, çok nadir bir kenar
  durum — isterseniz ayrıca düzeltebilirim.

## Gerçekten çalıştırıp doğruladığım kısım

`tests/core-selftest.js` artık **105 senaryo** içeriyor (Faz 8 için 17
yeni test: override kapalıyken mobil/masaüstünün birebir aynı olması,
`setGeometry`'nin doğru alana (asıl katman ya da override) yazması ve
override'ı doğru koşulda etkinleştirmesi, kısmi override'da eksik
alanların mobil değerden miras alınması, sıfırlamanın gerçekten
sıfırlaması, mobil için yazmanın masaüstü override'ını YANLIŞLIKLA
etkinleştirmediği, ve `desktopOverride` alanı hiç olmayan ESKİ bir
katmanın çökmeden çalışması — geriye dönük uyumluluk garantisi). Hepsi
geçiyor:
```
cd seoz-editor
node tests/core-selftest.js
```
Tüm JS `node --check`'ten geçti, HTML'ler etiket dengesinden geçti, tüm
modül referansları çapraz kontrol edildi, ve yedi modülün (Konum,
Müzik, Geri Sayım, RSVP, Galeri, Anı Yükle, Kutlama Efekti) MD5
karşılaştırmasıyla HİÇ değişmediği doğrulandı — bu faz yalnızca
konum/boyut ÇÖZÜMLEME mantığına dokundu, modüllerin kendi içeriğine
dokunmadı.

Gerçek sürükleme, pencere yeniden boyutlandırma ile canlı geçiş gibi
tarayıcı-etkileşimli kısımlar için gerçek bir tarayıcı çalıştıramadım —
lütfen yukarıdaki adımları deneyin.

## Değişen / eklenen dosyalar

**Yeni:**
- `js/editor/responsive-panel.js` — "Masaüstü Düzeni" paneli (tüm
  katman türleri için tek, paylaşılan panel)

**Genişletilen (bozulmadı, geriye dönük uyumlu şekilde üzerine eklendi):**
- `js/core/document-model.js` → `mobile` alanı `desktopOverride` olarak
  yeniden adlandırıldı (hiç kullanılmıyordu) + `resolveGeometry`,
  `setGeometry`, `clearDesktopOverride` eklendi (tüm sistemin tek
  doğru geometri kaynağı)
- `js/core/renderer.js` → `renderDocument`/`renderLayer` artık bir
  `breakpoint` parametresi alıyor, geometriyi `resolveGeometry` ile
  çözüyor (parametre verilmezse "mobile" varsayılır — geriye dönük
  uyumlu)
- `js/editor/drag-resize.js` → sürükleme/boyutlandırma artık
  `opts.getBreakpoint()`'e göre doğru alana (asıl katman ya da
  override) okuyup yazıyor
- `js/editor/editor-app.js` → "Masaüstü Önizleme" düğmesi artık
  gerçekten farklı bir geometri kümesi kullanıyor (önceden yalnızca
  kozmetikti), yeni "Masaüstü Düzeni" panel bağlantısı
- `js/view-app.js` → gerçek tarayıcı genişliğine göre breakpoint
  hesaplayıp `renderDocument`'a geçiyor, pencere yeniden
  boyutlandırıldığında yeniden hesaplıyor
- `index.html` → yeni script referansı
- `tests/core-selftest.js` → 17 yeni test senaryosu

## Sıradaki adım

Kalan fazlar: **Faz 9** ("Yayına Hazırla" akışının tam sağlamlaştırılması
+ doğrulama), **Faz 10** (font kütüphanesini genişletme). Onayınızı
bekliyorum.
