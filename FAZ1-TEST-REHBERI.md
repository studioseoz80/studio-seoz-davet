# Studio SEOZ Editörü — FAZ 1 Teslim Notu

Bu, mevcut Studio SEOZ mağaza sitesinden (`site/` klasörü) tamamen
bağımsız, yeni bir projedir: `seoz-editor/`. O klasördeki hiçbir dosyaya
dokunulmadı.

## Nasıl test edersiniz

**Önemli:** Dosyaları çift tıklayıp doğrudan tarayıcıda açmak yerine,
basit bir yerel sunucu ile açmanızı öneririm. Bazı tarayıcılar (özellikle
Chrome), `file://` ile açılan sayfalarda kayıt sistemini (localStorage)
sayfadan sayfaya güvenilir şekilde paylaşmayabiliyor — bu editörün
hatası değil, tarayıcının dosya erişimini kısıtlama şekli. Sunucuyla
açtığınızda bu sorun hiç yaşanmaz.

En basit yöntem (bilgisayarınızda Python zaten kuruluysa):
1. `seoz-editor` klasörünü terminalde açın.
2. `python3 -m http.server 8000` yazıp çalıştırın.
3. Tarayıcıda `http://localhost:8000` adresine gidin.

## Test senaryosu (Faz 1 kapsamı)

1. Açılışta boş kütüphane ekranını görürsünüz → **"+ Yeni Davetiye"**
   → bir isim yazıp bir etkinlik türü seçin (tür şu an yalnızca bir
   etiket, hiçbir şeyi kısıtlamaz) → **Oluştur**.
2. Editöre düşersiniz. **"+ Metin Ekle"** ile bir metin katmanı ekleyin.
3. Metni canvas üzerinde sürükleyin — sağ alt köşesindeki altın
   noktadan genişliğini değiştirin.
4. Sağdaki **Özellikler** panelinden: metni değiştirin, font seçin,
   **sayısal** punto girin (örn. 52), rengi, kalın/italik/altı çizili,
   hizalamayı, harf/satır aralığını değiştirin. İkinci bir metin
   ekleyip aynı punto değerini girerek ikisinin birebir eşleştiğini
   doğrulayabilirsiniz.
5. **Çoğalt**, **Sil**, **En Öne Getir / En Arkaya Gönder**'i deneyin.
6. Üstteki **Mobil / Masaüstü Önizleme** geçişini deneyin (bkz. aşağıdaki
   "bilinen kapsam sınırı").
7. **Yayına Hazırla**'ya basın, çıkan bağlantıyı (`view.html?doc=...`)
   yeni sekmede açın — panelsiz, salt görüntülenebilir hâli göreceksiniz.
8. Kütüphaneye dönüp **Kopyala**, **Sil**, **JSON Dışa Aktar / İçe
   Aktar**'ı deneyin.

## Bu fazda kasıtlı olarak eksik bırakılanlar (sonraki fazlarda geliyor)

- **Fotoğraf/görsel katmanı, zemin/kart yükleme** → Faz 2
- **Giriş sahnesi (PNG/video/yok), "Girişi Yeniden Oynat"** → Faz 3
  (şu an `entry-scene.js` yalnızca "giriş yok" durumunu destekleyen bir
  iskelet — bunu belirten bir uyarı konsola yazdırır, hiçbir şeyi bozmaz)
- **Konum, Müzik, Geri Sayım modülleri** → Faz 4
- **RSVP (4 modlu)** → Faz 5
- **Galeri, Anı Yükle** → Faz 6
- **Kutlama efektleri** → Faz 7
- **Gerçek, katman bazlı mobil override sistemi** — şu anki
  "Mobil / Masaüstü Önizleme" düğmesi yalnızca önizleme çerçevesinin
  genişliğini değiştirir (tasarım tek bir koordinat uzayında, orantılı
  ölçeklenerek çalışır); her katman için ayrı mobil konum/boyut
  belirleme Faz 8'de ekleniyor.
- **Canvas üzerinde çift tıklayıp doğrudan yazma** — şu an metin içeriği
  sağdaki panelden düzenleniyor (metin kutusunun içine tıklayıp direkt
  yazma değil). İsterseniz bunu da ekleyebilirim; şu an için daha basit
  ve hatasız çalışan bu yöntemi tercih ettim.
- **Studio SEOZ kapanışı** — bu bir modül olacağı için Faz 4-6 civarı,
  modül sistemiyle birlikte eklenecek.

## Dosya haritası (kısa hatırlatma)

- `js/core/` → editör ve view.html'in ORTAK kullandığı motor
  (veri modeli, layout, kayıt, render)
- `js/editor/` → YALNIZCA `index.html` bunları yükler
- `view.html` → `js/editor/`'dan hiçbir şey yüklemez (yapısal olarak
  düzenleme imkânsız)
- `js/entry-scene.js`, `js/modules/module-registry.js` → şu an iskelet,
  sonraki fazlarda genişletilecek, üzerine yazılmayacak

## Sıradaki adım

Onayınızı bekliyorum:
- Faz 1 beklediğiniz gibi mi çalışıyor, yoksa değiştirmemi istediğiniz
  bir şey var mı?
- Onaylarsanız **Faz 2**'ye geçiyorum: fotoğraf/görsel katmanı, katman
  panelinde yeniden sıralama, zemin ve kart yükleme.
