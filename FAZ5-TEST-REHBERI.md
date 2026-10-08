# Studio SEOZ Editörü — FAZ 5 Teslim Notu

FAZ 5 kapsamı: **RSVP / Katılım modülü** — 4 mod (Kapalı, WhatsApp Tek
Buton, Google Form, WhatsApp İki Buton), düzenlenebilir WhatsApp mesaj
şablonları, tam buton tasarımı. Faz 1-4'te teslim edilen hiçbir dosya
bozulmadı; Faz 4 sonrası yapılan Konum/Müzik düzeltmeleri de korunuyor.

## Mimariye küçük ama önemli bir ekleme

RSVP'nin 4 modu birbirinden çok farklı alanlar gerektiriyor (ör. Google
Form modunda WhatsApp numarası anlamsız). Bunu çözmek için
`module-panel.js`'e **geriye dönük uyumlu** iki küçük yetenek eklendi:
- `showIf(settings)` — bir alanın yalnızca belirli bir modda görünmesini
  sağlar
- `reRenderPanel: true` — yalnızca "tür/mod" seçicilerinde kullanılır;
  değiştiğinde formun tamamını yeniden kurar (sıradan metin/renk
  alanlarında kullanılmaz, yazarken odağı bozmaz)

Konum, Müzik, Geri Sayım modülleri bu yeni alanları hiç kullanmıyor —
davranışları birebir aynı kaldı.

## Nasıl test edersiniz

```
python3 -m http.server 8000
```

## Test senaryosu

1. **"+ Modül Ekle..."** listesinden **RSVP / Katılım**'ı seçin.
   Varsayılan "Kapalı" modda, editörde soluk bir "RSVP kapalı — yayında
   görünmeyecek" yazısı görünmeli (yalnızca editörde, yayında hiç
   görünmez).
2. **RSVP Türü**'nü **WhatsApp – Tek Buton** yapın. Panelde artık
   WhatsApp numarası, buton yazısı ve stil alanları (font, renk, boyut,
   köşe yuvarlaklığı) görünmeli — Google Form/iki-buton alanları
   GÖRÜNMEMELİ.
3. Bir WhatsApp numarası (ülke koduyla, ör. `905551112233`) girin.
   Tuvaldeki butona tıklayın — **WhatsApp Web/uygulamasının** "Merhaba,
   davetinize katılıyorum." mesajıyla açıldığını doğrulayın (hem
   editörde hem `view.html`'de).
4. Türü **Google Form**'a çevirin, bir form bağlantısı girin, butona
   tıklayın — formun yeni sekmede açıldığını doğrulayın.
5. Türü **WhatsApp – İki Buton**'a çevirin. "Katılıyorum" ve
   "Katılamıyorum" için ayrı buton yazısı ve ayrı WhatsApp mesajı
   alanlarının çıktığını doğrulayın. İki butonun da tuvalde yan yana
   göründüğünü, her birinin kendi mesajıyla WhatsApp'ı açtığını test
   edin.
6. Türü tekrar **Kapalı** yapıp yayınlayın — `view.html`'de RSVP
   alanının hiç görünmediğini doğrulayın.
7. Katman panelinde "▣ RSVP / Katılım" olarak listelendiğini, Çoğalt/
   Sil/Öne-Arkaya almanın diğer modüllerle aynı şekilde çalıştığını
   doğrulayın.

## Bilerek aldığım tasarım kararları

- **İki butonun stili ortaktır** (aynı font/renk/boyut ayarı). Spec
  ayrı ayrı stil istemiyordu; "Katılamıyorum" butonu görsel olarak
  ayırt edilsin diye otomatik olarak anahat (outline) stilinde
  gösteriliyor (dolu arka plan yerine).
- **Butonlar editörde de tıklanabilir** — Konum ve Müzik modüllerinde
  yaptığımız düzeltmelerden ders çıkararak, RSVP'yi baştan hem editörde
  hem yayında aynı şekilde çalışacak yazdım; `mode === "view"`
  kısıtlaması hiç eklenmedi.
- **WhatsApp numarası doğrulanmıyor** — kullanıcı ne yazarsa yazsın,
  yalnızca rakam olmayan karakterler otomatik temizlenip `wa.me`
  bağlantısına eklenir. Yanlış girilmiş bir numara WhatsApp'ın kendi
  hata sayfasını açar; ayrıca bir format kontrolü eklemedim.

## Gerçekten çalıştırıp doğruladığım kısım

`tests/core-selftest.js` artık **63 senaryo** içeriyor (Faz 5 için 22
yeni test: modül kaydı, RSVP'nin varsayılan modu, **her `showIf`
kombinasyonunun** doğru alanları gösterip gizlediği — Kapalı/WhatsApp
Tek/Google Form/WhatsApp İki modlarının her biri için ayrı ayrı —,
`reRenderPanel` işaretinin doğru alanda olması, ve RSVP katmanının
kayıt/yükleme sonrası korunması). Hepsi geçiyor:
```
cd seoz-editor
node tests/core-selftest.js
```
Ayrıca tüm JS `node --check`'ten geçti, HTML'ler etiket dengesinden
geçti, tüm modül referansları çapraz kontrol edildi, ve Konum/Müzik/
Geri Sayım dosyalarının bu değişiklikte HİÇ dokunulmadığı doğrulandı.

Tuvalde tıklama, WhatsApp'ın gerçekten açılması gibi tarayıcı-etkileşimli
kısımlar için gerçek bir tarayıcı çalıştıramadım — lütfen yukarıdaki
adımları deneyin.

## Değişen / eklenen dosyalar

**Yeni:**
- `js/modules/rsvp.js` — RSVP modülü (4 mod)

**Genişletilen (bozulmadı, geriye dönük uyumlu şekilde üzerine eklendi):**
- `js/editor/module-panel.js` → `showIf` / `reRenderPanel` desteği
  (Konum/Müzik/Geri Sayım bunları kullanmadığı için davranışları
  değişmedi)
- `index.html`, `view.html` → yeni script referansı
- `tests/core-selftest.js` → 22 yeni test senaryosu

## Sıradaki adım

Faz 6'ya geçmiyorum — onayınızı bekliyorum (Galeri + Anı Yükle
modülleri). Test edip sonucu bildirin.
