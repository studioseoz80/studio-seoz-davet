# Studio SEOZ Editörü — FAZ 3 Teslim Notu

FAZ 3 kapsamı: **giriş sahnesi (PNG / Video / Giriş Yok), "Girişi Yeniden
Oynat", misafir için "Baştan İzle" ve yayın bütünlüğü.** Faz 1-2'de
teslim edilen hiçbir dosya bozulmadı — yalnızca genişletildi.

## Nasıl test edersiniz

Aynı yerel sunucu yöntemi:
```
python3 -m http.server 8000
```

## Test senaryosu

1. Bir davetiye açın. Sol sidebar'ın en üstünde artık **"Giriş Sahnesi"**
   bölümü var.
2. **Giriş Türü**'nü "PNG / Görsel Giriş" yapın, bir görsel yükleyin.
   Ardından **"▶ Girişi Yeniden Oynat"**'a basın — tüm ekranı kaplayan
   görseli, altında "Açmak için dokunun" yazısıyla görmelisiniz.
   Herhangi bir yere tıklayınca kapanıp editöre dönmeli.
3. Giriş Türü'nü "Video" yapın, kısa bir MP4/WebM yükleyin. Panelde
   küçük bir önizleme oynatılır. **"Girişi Yeniden Oynat"**'a basınca
   video tam ekran oynamalı, bitince otomatik kapanmalı. Sağ üstteki
   **"Geç"** butonunun da her zaman çalıştığını doğrulayın.
4. **"Misafirler 'Baştan İzle' butonunu görebilsin"** kutusunu işaretleyip
   **Yayına Hazırla**'ya basın. `view.html?doc=...` bağlantısını yeni
   sekmede açın:
   - Sayfa önce giriş sahnesini göstermeli, bitince/tıklanınca davetiye
     ortaya çıkmalı.
   - Sağ altta **"↺ Baştan İzle"** butonu görünmeli; tıklayınca giriş
     sahnesi tekrar oynamalı.
5. Kutuyu işaretlemeden tekrar yayınlarsanız, "Baştan İzle" butonu
   `view.html`'de GÖRÜNMEMELİ.
6. Giriş Türünü "Giriş Yok" yapıp yeniden yayınlayın — `view.html`
   doğrudan davetiyeyi göstermeli, hiçbir overlay çıkmamalı.
7. Büyük bir video (birkaç MB üzerinde) yüklemeyi deneyin — boyut
   uyarısı çıkıp onayınızı istemeli. Onaylamazsanız dosya
   kullanılmamalı.

## Gerçekten çalıştırıp doğruladığım kısım

Tarayıcı gerektiren (overlay gösterme, video oynatma) kısımları burada
çalıştıramadım — lütfen yukarıdaki adımları siz deneyin. Ama **veri
katmanını yine Node üzerinde gerçekten çalıştırıp doğruladım**:
`tests/core-selftest.js` artık 26 senaryo içeriyor (Faz 3 için 8 yeni
senaryo eklendi: giriş türü/görseli ayarlama, yayın anlık görüntüsünün
giriş verisini koruması, `SeozEntryScene.hasUsableEntry` mantığının tüm
kombinasyonları). Hepsi geçiyor:
```
cd seoz-editor
node tests/core-selftest.js
```

Ayrıca tüm JS dosyalarını `node --check` ile, HTML dosyalarını etiket
dengesi açısından, ve tüm modül referanslarını (`SeozXxx`) çapraz
kontrol ettim — hiçbiri eksik/hatalı değil.

## Bilinen teknik sınır — video için ÖZELLİKLE önemli

Video dosyaları, görsellerin aksine küçültülemiyor (tarayıcıda video
yeniden kodlamak pratik değil) — olduğu gibi base64 olarak
localStorage'a yazılıyor. Bu yüzden:
- **Kısa (3-8 saniye) ve küçük (birkaç MB) video kullanın.**
- 3MB üstü görsellerde, 6MB üstü videolarda sistem sizi uyarıp onay
  ister.
- Kaydetme sırasında tarayıcı depolama sınırı aşılırsa (localStorage
  genelde 5-10MB), artık sessizce veri kaybetmek yerine size açık bir
  hata mesajı gösteriyorum ("Kaydedilemedi — depolama dolu...").

Bu sınırın kalıcı çözümü, daha önce mağaza sitesi için konuştuğumuz gibi
gerçek bir dosya depolama servisi (ör. Supabase Storage) bağlamaktır —
istediğiniz zaman ayrı bir görev olarak ele alabiliriz.

## Değişen / eklenen dosyalar

**Yeni:**
- `js/editor/entry-panel.js` — Giriş Sahnesi ayar paneli

**Gerçek işlevini kazanan (iskeletten çıktı):**
- `js/entry-scene.js` — artık PNG/video/yok mantığının tamamı burada;
  editör ve view.html aynı `play()` fonksiyonunu çağırıyor

**Genişletilen (bozulmadı, üzerine eklendi):**
- `js/core/document-model.js` → `entry` alanı gerçek veri taşıyor
- `js/editor/image-utils.js` → `readFileAsDataURL`, `estimateDataURLSizeMB`
- `js/editor/editor-app.js` → Giriş Sahnesi paneli sidebar'a eklendi,
  autosave artık depolama hatasını yakalayıp bildiriyor
- `js/view-app.js` → giriş sahnesi + misafir "Baştan İzle" butonu
- `css/canvas.css` → giriş overlay'i ve "Baştan İzle" buton stilleri
- `index.html` → yeni script referansları
- `tests/core-selftest.js` → 8 yeni test senaryosu

## Sıradaki adım

Faz 4'e geçmiyorum — onayınızı bekliyorum (Konum, Müzik, Geri Sayım
modülleri). Test edip sonucu bildirin.
