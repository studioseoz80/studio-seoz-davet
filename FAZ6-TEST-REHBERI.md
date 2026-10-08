# Studio SEOZ Editörü — FAZ 6 Teslim Notu

FAZ 6 kapsamı: **Galeri** (siz düzenlersiniz) + **Anı Yükle** (misafirler
yükler) modülleri. Faz 1-5'te teslim edilen hiçbir dosya bozulmadı.

## ÖNCE EN ÖNEMLİ KISIM: Anı Yükle'nin gerçek sınırı

Bunu en başta, açıkça söylüyorum çünkü yanlış beklenti oluşturmak
istemiyorum:

**Bir misafirin "Anı Yükle" ile yüklediği fotoğraf/video YALNIZCA O
MİSAFİRİN KENDİ TELEFONUNDA/TARAYICISINDA görünür.** Siz (davetiye
sahibi) onu göremezsiniz, başka bir misafir de göremez. Bunun nedeni:
bu proje şu an tamamen istemci taraflı (sunucusuz) — her tarayıcı
kendi yerel deposunu (IndexedDB) tutuyor, ortak bir yer yok.

Bunu test ederken kafanız karışmasın diye: aynı tarayıcıda birkaç dosya
yükleyip küçük resimlerin göründüğünü göreceksiniz (bu, "yükleme
mekanizması çalışıyor" demek) — ama bu, gerçek bir düğünde
misafirlerin ortak bir "anı duvarı" oluşturması ANLAMINA GELMEZ. Onun
için gerçek bir backend gerekir (daha önce mağaza sitesi için konuştuğumuz
Supabase gibi — orada zaten bir Supabase projeniz var, istersen Storage
kısmını bu modül için de kullanacak şekilde ayrı bir görev olarak
bağlayabilirim). Şimdilik bu modülü **"yükleme arayüzü hazır, paylaşım
altyapısı ayrı bir görev"** olarak düşünün.

## Galeri modülü — bunu tam olarak test edebilirsiniz

Galeri, SİZİN önceden yüklediğiniz fotoğrafları düzenlemenizle ilgili —
bu tamamen yerel çalışır ve gerçek/nihai bir özelliktir, "Anı Yükle"
gibi bir backend sınırı yoktur (çünkü siz zaten kendi tarayıcınızda
düzenliyorsunuz, veri paylaşılmasına gerek yok — davetiye yayınlandığında
seçtiğiniz fotoğraflar belgenin bir parçası olarak herkese görünür).

## Nasıl test edersiniz

```
python3 -m http.server 8000
```

## Test senaryosu — Galeri

1. **"+ Modül Ekle..."** listesinden **Galeri**'yi seçin. Boşken
   editörde "Galeri boş — sağ panelden fotoğraf ekleyin" yazısı
   görünmeli.
2. Sağ panelden **"+ Fotoğraf Ekle"** ile birden fazla görsel seçin
   (aynı anda çoklu seçim desteklenir). Küçük resimlerin panelde
   listelendiğini, tuvaldeki galerinin de aynı fotoğrafları ızgara
   halinde gösterdiğini doğrulayın.
3. Panelden bir fotoğrafın **↑ / ↓** ile sırasını değiştirin — hem
   panelde hem tuvalde sıra değişmeli.
4. Bir fotoğrafı **✕** ile kaldırın — hem panelden hem tuvalden
   kaybolmalı.
5. **Sütun Sayısı**'nı 1/2/3 arası değiştirin, **Fotoğraf Yüksekliği**,
   **Boşluk**, **Köşe Yuvarlaklığı**'nı değiştirin — tuvalde anında
   yansımalı.
6. Çok sayıda fotoğraf ekleyip galeri kutusunun dikeyde kaydırılabilir
   hale geldiğini gözlemleyin (kutu taşan içeriği kırpmaz, kaydırır) —
   isterseniz köşe tutamacından kutuyu büyüterek daha az kaydırma
   gerektirecek şekilde ayarlayabilirsiniz.
7. **Yayına Hazırla** → `view.html`'de galerinin aynı şekilde göründüğünü
   doğrulayın.

## Test senaryosu — Anı Yükle

1. **"+ Modül Ekle..."** listesinden **Anı Yükle**'yi seçin. Başlık,
   buton yazısı, renk/font/boyut ayarlarını deneyin.
2. Tuvaldeki butona tıklayıp bir fotoğraf/video seçin — küçük resim
   ızgarasında hemen belirmeli (bu, o anki tarayıcınızda çalıştığınızı
   gösterir).
3. **Yayına Hazırla** → `view.html`'i açın, tekrar bir dosya yükleyin —
   göründüğünü doğrulayın. Sonra **farklı bir tarayıcıda** (ya da gizli
   sekmede) aynı `view.html` bağlantısını açın: **az önce yüklediğiniz
   dosyanın orada GÖRÜNMEMESİ beklenen davranıştır** — yukarıdaki sınırı
   doğrulamış olursunuz.

## Bilerek aldığım tasarım kararları

- Galeri, taşan içeriği KIRPMAZ — kendi içinde kaydırılabilir olur.
  Böylece hiçbir fotoğraf "kaybolmaz", ama çok fotoğraflı galerilerde
  kutuyu büyütmeniz gerekebilir.
- Anı Yükle'nin dosya deposu, Blob depolama mekanizmasını (blob-store.js
  / IndexedDB) diğer modüllerle PAYLAŞIR — ama hangi dosyanın hangi
  belgeye/modüle ait olduğunu tutan küçük referans listesi tamamen
  ayrı ve bağımsızdır (`js/core/guest-uploads.js`). Yani "diğer
  modüllerden bağımsız olsun" isteğinizi, veri/mantık düzeyinde
  karşıladım; alt yapıdaki ortak "dosya nasıl saklanır" mekanizmasını
  gereksiz yere tekrar yazmadım.
- Video guest-upload'ları da (tıpkı giriş videosu gibi) küçültülmeden
  olduğu gibi saklanıyor — aynı "kısa/küçük dosya kullanın" önerisi
  burada da geçerli.

## Gerçekten çalıştırıp doğruladığım kısım

`tests/core-selftest.js` artık **71 senaryo** içeriyor (Faz 6 için 8
yeni test: modül kaydı, Galeri'nin boş listeyle başlaması, şemasında
`image-list` alanı olması, galeriye fotoğraf eklemenin modülün asıl
varsayılanlarını bozmadığı — derin kopya doğrulaması —, Anı Yükle'nin
etiketi, `SeozGuestUploads.list()`'in olmayan bir belge için güvenle
boş dizi döndürmesi, ve her iki modülün de kayıt/yükleme sonrası
korunması — Galeri'de fotoğraf listesi dahil). Hepsi geçiyor:
```
cd seoz-editor
node tests/core-selftest.js
```
Tüm JS `node --check`'ten geçti, HTML'ler etiket dengesinden geçti, tüm
modül referansları çapraz kontrol edildi, ve önceki modüllerin (Konum,
Müzik, Geri Sayım, RSVP) bu değişiklikte dokunulmadığı doğrulandı.

Fotoğraf ekleme/sıralama/kaldırma, gerçek dosya yükleme gibi tarayıcı-
etkileşimli kısımlar için gerçek bir tarayıcı çalıştıramadım — lütfen
yukarıdaki adımları deneyin.

## Değişen / eklenen dosyalar

**Yeni:**
- `js/modules/gallery.js`, `js/modules/guest-upload.js`
- `js/core/guest-uploads.js`

**Genişletilen (bozulmadı, geriye dönük uyumlu şekilde üzerine eklendi):**
- `js/editor/module-panel.js` → yeni `"image-list"` alan tipi (Galeri
  için); diğer modüller bunu kullanmadığı için etkilenmedi
- `js/core/renderer.js` → modül `render()` çağrısına üçüncü, isteğe
  bağlı bir "bağlam" parametresi (`{docId, layerId}`) eklendi — Anı
  Yükle bunu kullanıyor, diğer dört modül YOK SAYIYOR (geriye dönük
  uyumlu)
- `js/editor/editor-app.js` → `updateLayerDOM`'daki modül yeniden
  çizimi de aynı bağlamı geçiyor
- `css/editor-chrome.css` → galeri küçük resim ızgarası stilleri
- `index.html`, `view.html` → yeni script referansları
- `tests/core-selftest.js` → 8 yeni test senaryosu

## Sıradaki adım

Faz 7'ye geçmiyorum — onayınızı bekliyorum (Kutlama Efektleri: konfeti/
parıltı, mobil performans testiyle birlikte). Test edip sonucu bildirin.

Not: "Anı Yükle"yi gerçek/paylaşımlı hale getirmek isterseniz (misafir
yüklemelerini sizin ve diğer misafirlerin de görmesi), bunu Faz 7'den
bağımsız, ayrı bir görev olarak ele almamı isteyebilirsiniz — mağaza
sitesi için kurduğumuz Supabase projesine bir Storage bucket'ı eklemek
yeterli olur.
