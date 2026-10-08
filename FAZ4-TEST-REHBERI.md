# Studio SEOZ Editörü — FAZ 4 Teslim Notu

FAZ 4 kapsamı: **Konum, Müzik, Geri Sayım modülleri** — gerçek modül-kayıt
mimarisi üzerinden (spesifikasyondaki "ayarŞeması → panel formunu
otomatik üretir" tasarımına birebir uygun). Faz 1-3'te teslim edilen
hiçbir dosya bozulmadı.

## Mimari özeti (neden önemli)

Her modül (`js/modules/location.js`, `music.js`, `countdown.js`) kendi
`settingsSchema`'sını tanımlar; sağdaki ayar paneli bu şemadan
**otomatik** üretilir (`js/editor/module-panel.js` — tek, genel bir
dosya, üç modülün de formunu o üretiyor). Bunun sonucu: **yeni bir
modül eklemek artık yalnızca yeni bir dosya + `module-registry.js`'e
kayıt demek** — `module-panel.js`'e, `editor-app.js`'e veya
`renderer.js`'e dokunmanız gerekmiyor. Faz 5'teki RSVP modülü de aynı
sistemi kullanacak.

Modüller de tıpkı metin/fotoğraf gibi birer **katmandır** — sürüklenir,
yeniden boyutlandırılır, öne/arkaya alınır, çoğaltılır, silinir.

## Nasıl test edersiniz

```
python3 -m http.server 8000
```

## Test senaryosu

1. Araç çubuğunda **"+ Modül Ekle..."** açılır listesinden **Konum**'u
   seçin. Canvas'a bir kutu düşer.
2. Sağ panelden mekân adı, adres, Google Maps bağlantısı, buton yazısı,
   fontu, rengi, boyutu, köşe yuvarlaklığını değiştirin — canvas anında
   güncellenmeli.
3. Kutuyu sürükleyin, köşesinden boyutlandırın (hem genişlik hem
   yükseklik değişmeli).
4. **Müzik** modülünü ekleyin, bir MP3/WAV yükleyin, buton rengini/
   boyutunu değiştirin. Editörde tıklayınca ses ÇALMAMALI (bu kasıtlı —
   aşağıya bakın).
5. **Geri Sayım** modülünü ekleyin, bir tarih/saat girin, başlığı/
   fontu/renkleri değiştirin. Sayaç canvas'ta **canlı olarak saymalı**
   (saniyede bir güncellenmeli).
6. Geri sayım kutusunu sürükleyip bırakın — **sayaç durmadan saymaya
   devam etmeli** (bu, sürükleme sırasında modülün yeniden
   çizilmediğinin kanıtı — bkz. aşağıdaki teknik not).
7. Katman panelinde üç modülün de "▣ Konum", "▣ Müzik", "▣ Geri Sayım"
   olarak listelendiğini doğrulayın. Çoğalt/Sil/Öne-Arkaya alma
   düğmelerini deneyin.
8. **Yayına Hazırla**'ya basıp `view.html`'de:
   - Konum butonuna tıklayınca **gerçekten Google Maps'in açıldığını**,
   - Müzik butonuna tıklayınca **gerçekten çalıp durduğunu** (ikon
     değişmeli),
   - Geri sayımın orada da doğru saydığını
   doğrulayın.

## Bilerek aldığım tasarım kararları

- **Müzik editörde çalmaz, yalnızca `view.html`'de çalar.** Tarayıcılar
  otomatik/beklenmedik ses çalmayı zaten engelliyor; editörde çalışıyor
  gibi görünüp yayında çalışmaması kafa karıştırırdı, bu yüzden bilinçli
  olarak yalnızca gerçek yayın sayfasında aktif ettim.
- ~~Konum butonu editörde tıklanabilir değildir~~ **[GÜNCELLEME —
  düzeltildi]**: Kullanıcı geri bildirimi üzerine, Konum butonu artık
  hem editörde hem yayında gerçekten Google Maps'i açıyor. Sürükleme ile
  çakışma riski, tıklama ile sürüklemeyi ayıran bir hareket eşiği
  eklenerek çözüldü — bkz. `js/editor/drag-resize.js` başındaki not.
- **Sürükleme/boyutlandırma sırasında modülün içeriği YENİDEN
  ÇİZİLMEZ** — yalnızca konum/boyutu güncellenir. Bunun nedeni: geri
  sayımın kendi saniye sayacı var; her piksel hareketinde yeniden
  çizilseydi ya sayaç sıçrardı ya da performans sorunu yaşardık. Ayar
  panelinden bir değer değiştirdiğinizde ise modül gerçekten yeniden
  çizilir (eski sayaç önce düzgünce durdurulur, sonra yenisi başlar —
  bellek sızıntısı olmadan).

## Gerçekten çalıştırıp doğruladığım kısım

`tests/core-selftest.js` artık **41 senaryo** içeriyor (Faz 4 için 15
yeni test: modül kaydı, her modülün `settingsSchema`/`defaultLayerSize`
tanımlı olması, modül katmanı oluşturma, **derin kopya doğrulaması**
(bir katmanın ayarlarını değiştirmenin modülün asıl varsayılanlarını
bozmadığını doğrular — bu tür paylaşılan referans hataları sessizce
üretime sızabilir), ve modül katmanlarının kayıt/yükleme sonrası
korunması). Hepsi geçiyor:
```
cd seoz-editor
node tests/core-selftest.js
```
Ayrıca tüm JS `node --check`'ten, HTML'ler etiket dengesinden geçti ve
tüm modül referansları çapraz kontrol edildi (artık `SeozModuleRegistry`
de dahil olmak üzere HİÇBİR tanım kullanılmadan durmuyor).

Canvas üzerinde sürükleme, canlı sayaç, gerçek ses çalma gibi tamamen
tarayıcı-etkileşimli kısımlar için gerçek bir tarayıcı çalıştıramadım —
lütfen yukarıdaki adımları deneyin.

## Değişen / eklenen dosyalar

**Yeni:**
- `js/modules/location.js`, `music.js`, `countdown.js` — üç gerçek modül
- `js/editor/module-panel.js` — genel, şema-tabanlı ayar paneli

**Genişletilen (bozulmadı, üzerine eklendi):**
- `js/modules/module-registry.js` → artık gerçekten kullanılıyor
- `js/core/document-model.js` → `createModuleLayer`
- `js/core/renderer.js` → modül katmanı çizimi + `clearIntervalsWithin`
  (canlı zamanlayıcı temizliği)
- `js/editor/drag-resize.js` → modüller de fotoğraf gibi iki yönlü
  boyutlandırılabiliyor
- `js/editor/layers-panel.js` → modül etiketi
- `js/editor/editor-app.js` → modül ekleme, `updateLayerDOM` artık
  konum-only (`updateLayerPosition`) ve tam-içerik güncellemesi olarak
  ikiye ayrıldı (sürükleme sırasında canlı modüllerin bozulmaması için)
- `index.html`, `view.html` → yeni script referansları
- `tests/core-selftest.js` → 15 yeni test senaryosu

## Sıradaki adım

Faz 5'e geçmiyorum — onayınızı bekliyorum (RSVP modülü: 4 mod, WhatsApp
mesaj şablonları, tam buton tasarımı — aynı modül mimarisini kullanacak).
Test edip sonucu bildirin.

---

## SONRADAN GELEN DÜZELTMELER (Faz 4 onayından sonra)

### Düzeltme 1 — Konum butonu editörde açılmıyordu
Sorun: `drag-resize.js` her tıklamada (hareket olmasa bile)
`preventDefault()` çağırıyordu, bu da altındaki butonun tıklama olayını
hiç almasını engelliyordu. Artık bir HAREKET EŞİĞİ var — yalnızca gerçek
bir sürükleme (birkaç pikselden fazla hareket) `preventDefault`
tetikliyor; düz bir tıklama normal şekilde geçiyor. Konum butonu artık
hem editörde hem `view.html`'de gerçekten Google Maps'i açıyor.
Değişen dosyalar: `js/editor/drag-resize.js`, `js/modules/location.js`.

### Düzeltme 2 — localStorage depolama sınırı hatası ("Kaydedilemedi")
Sorun: Görseller/videolar doğrudan belgenin JSON'una gömülü base64
olarak yazılıyordu; bu, tarayıcının küçük localStorage kotasını
(genelde 5-10MB) kolayca aşıyordu.

**Çözüm:** Yeni bir `js/core/blob-store.js` dosyası eklendi. Artık tüm
görsel/video/müzik dosyaları tarayıcının **IndexedDB**'sine (localStorage'dan
çok daha büyük bir kotaya sahip, genelde yüzlerce MB) kaydediliyor;
belgenin JSON'unda yalnızca küçük bir referans dizesi (`"idb:xyz123"`)
tutuluyor. IndexedDB herhangi bir sebeple kullanılamazsa (çok eski
tarayıcı vb.) sistem sessizce eski yönteme (gömülü veri) döner —
uygulama asla çökmez, yalnızca o durumda eski depolama sınırı geri
gelir.

**Geriye dönük uyumluluk:** Daha önce kaydettiğiniz taslaklardaki eski,
gerçek gömülü görseller/videolar hâlâ sorunsuz çalışır — sistem yalnızca
"idb:" ile başlayan değerleri IndexedDB'den okumaya çalışır, başlamayanı
olduğu gibi kullanır.

**Bilinen sınır (bilerek basit tutuldu):** Bir görseli/videoyu
değiştirdiğinizde veya bir katmanı sildiğinizde, eski dosya şu an
IndexedDB'de kalmaya devam ediyor (otomatik silinmiyor). Bunun nedeni:
bir katmanı "Çoğalt" ile kopyaladığınızda aynı referans başka bir
katman tarafından da kullanılıyor olabilir — körü körüne silmek o
katmanı bozardı. Bu, gerçek kullanımda sorun yaratmaz (IndexedDB kotası
çok büyük) ama zamanla birikebilir; isterseniz ayrı bir görev olarak
düzgün bir "kullanılmayan dosyaları temizle" sistemi ekleyebilirim.

Değişen/eklenen dosyalar:
- **Yeni:** `js/core/blob-store.js`
- **Güncellenen:** `js/editor/image-utils.js` (artık Blob üretip
  `blob-store.js`'e kaydediyor, `dataURL` yerine `ref` döndürüyor;
  `storeRawFile()` ve `estimateFileSizeMB()` eklendi), `js/core/renderer.js`
  (görsel katman + zemin görseli artık referansı çözüyor),
  `js/entry-scene.js` (PNG/video girişi referansı çözüyor),
  `js/modules/music.js` (ses referansını çözüyor), `js/editor/entry-panel.js`
  ve `js/editor/module-panel.js` (yükleme + önizleme referans çözümüne
  göre güncellendi, büyük dosya uyarı eşikleri IndexedDB'nin daha yüksek
  kapasitesine göre yükseltildi), `js/editor/image-panel.js` ve
  `js/editor/editor-app.js` (yeni `ref` alan adına göre güncellendi)
- **`index.html` / `view.html`:** `blob-store.js` script referansı eklendi

Regresyon testi 45 senaryoya çıkarıldı (yeni: blob-store referans
mantığının saf-mantık testleri) ve hepsi geçiyor:
```
node tests/core-selftest.js
```
