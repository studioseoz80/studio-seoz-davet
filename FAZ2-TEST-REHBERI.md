# Studio SEOZ Editörü — FAZ 2 Teslim Notu

FAZ 2 kapsamı: **fotoğraf/görsel katmanı, zemin (arka plan) yükleme, ve
katman panelinin fotoğraflarla çalışacak şekilde genişletilmesi.**
Faz 1'de teslim edilen hiçbir dosya bozulmadı — yalnızca genişletildi.

## Neyi test etmelisiniz

Aynı yerel sunucu yöntemiyle açın (bkz. FAZ1-TEST-REHBERI.md):
```
python3 -m http.server 8000
```

1. Bir davetiye açın (Faz 1'de oluşturduğunuzu veya yenisini kullanın).
2. **"+ Fotoğraf Ekle"** ile bir PNG/JPG/WebP yükleyin. Görsel otomatik
   olarak canvas'a sığacak şekilde ölçeklenip ortalanır.
3. Görseli sürükleyin; sağ alt köşesindeki tutamaçtan boyutlandırın —
   **"Oranı Kilitle"** işaretliyken en/boy oranı korunur, işareti
   kaldırırsanız serbestçe gerdirebilirsiniz.
4. Sağdaki panelden **Genişlik/Yükseklik** kutularına sayısal değer
   girin (örn. iki farklı görsele aynı "320" değerini girip birebir
   eşleştiğini doğrulayın — tam olarak istediğiniz davranış budur).
5. **"Görseli Değiştir"** ile aynı katmanın içeriğini başka bir
   görselle değiştirin (konum/boyut ayarları korunur).
6. **Çoğalt / Sil / En Öne Getir / En Arkaya Gönder**'i fotoğraf için
   de deneyin — metin katmanıyla birebir aynı şekilde çalışır.
7. Araç çubuğundan **"Zemin Görseli Yükle"** ile tüm davetiyenin arka
   planını bir görsele çevirin; **"Zemini Sıfırla"** ile düz renge
   dönün; yanındaki renk seçiciyle zemin rengini değiştirin.
8. **Yayına Hazırla**'ya basıp `view.html`'de fotoğrafların ve zeminin
   doğru göründüğünü kontrol edin.
9. Katman listesinde fotoğrafların "🖼 Fotoğraf" etiketiyle ayrı ayrı
   göründüğünü doğrulayın.

## Neyi zaten gerçekten test ettim (sizin tarayıcınızda değil, kod
seviyesinde)

Bu ortamda gerçek bir tarayıcı çalıştıramadığım için görsel
sürükleme/boyutlandırmayı bizzat göremiyorum — ama şunları yaptım:
- Tüm JS dosyalarını `node --check` ile sözdizimi açısından doğruladım.
- Her iki HTML dosyasında etiket dengesini otomatik kontrol ettim.
- Kodun kullandığı her `SeozXxx` modül referansının gerçekten
  tanımlandığını çapraz kontrol ettim (eksik/yanlış yazılmış referans
  yok).
- **En kritiği:** `tests/core-selftest.js` dosyasıyla veri katmanını
  (belge oluşturma, katman ekleme, kaydetme, kopyalama, YAYINLAMA/
  TASLAK ayrımı, dışa/içe aktarma, silme, geçersiz veri reddi) Node
  üzerinde GERÇEKTEN ÇALIŞTIRIP 21 senaryonun tamamının geçtiğini
  doğruladım. Bunu siz de istediğiniz an tekrar çalıştırabilirsiniz:
  ```
  cd seoz-editor
  node tests/core-selftest.js
  ```
  Gelecekte bir fazda bir şey bozulursa, bu komut size hemen haber
  verir.

Sürükleme/boyutlandırma gibi tamamen tarayıcı-etkileşimli kısımlar için
sizin elle test etmeniz gerekiyor — yukarıdaki adımları takip edin ve
beklenmedik bir davranış görürseniz bana tam olarak ne yaptığınızı ve ne
gördüğünüzü anlatın, hemen düzeltirim.

## Bilinen teknik sınır — açıkça belirtiyorum

Görseller şu an tarayıcı belleğinde (localStorage) base64 olarak
saklanıyor. Büyük görseller otomatik olarak küçültülüyor (en uzun kenar
azami 1600px) ama yine de **çok sayıda görsel eklerseniz tarayıcının
depolama sınırına (genelde 5-10MB) ulaşabilirsiniz.** Bu FAZ'da bunun
çözümü yok — gerçek dosya depolama (ör. Supabase Storage) bağlandığında
bu sınır tamamen ortadan kalkacak. Şimdilik: bir davetiyede çok fazla
(örn. 15-20'den fazla) yüksek çözünürlüklü görsel varsa dikkatli olun.

## Değişen / eklenen dosyalar

**Yeni:**
- `js/editor/image-utils.js` — yükleme sırasında görsel küçültme
- `js/editor/image-panel.js` — fotoğraf katmanı özellik paneli
- `tests/core-selftest.js` — yeniden çalıştırılabilir regresyon testi

**Genişletilen (bozulmadı, üzerine eklendi):**
- `js/core/document-model.js` → `createImageLayer` eklendi
- `js/core/renderer.js` → görsel katman çizimi + zemin görseli desteği
- `js/editor/drag-resize.js` → fotoğraflar için iki yönlü boyutlandırma
- `js/editor/layers-panel.js` → fotoğraf etiketi
- `js/editor/editor-app.js` → araç çubuğuna "Fotoğraf Ekle" ve zemin
  kontrolleri eklendi
- `index.html` → yeni script referansları

## Sıradaki adım

Faz 3'e geçmiyorum — onayınızı bekliyorum. Test edip:
- Sorun yoksa "Faz 3'e geçebilirsin" deyin (giriş sahnesi: PNG/video/
  yok + "Girişi Yeniden Oynat" + ilk "Yayına Hazırla" bütünlüğü),
- Bir şey beklediğiniz gibi çalışmıyorsa ne gördüğünüzü anlatın,
  Faz 3'e geçmeden düzeltirim.
