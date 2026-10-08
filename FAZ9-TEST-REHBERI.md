# FAZ 9 — Anket Görünümü, Yanıt Yöntemi ve Görüş Bildir Modülü

## Değişen / eklenen dosyalar
| Dosya | Değişiklik |
|---|---|
| `js/modules/poll.js` | Görsel düzen yenilendi, yanıt yöntemi eklendi, `autoHeight` |
| `js/editor/poll-panel.js` | "Google Form / Sheets" bölümü → "Yanıt Yöntemi" seçimi (Google Form alanları aynen korundu) |
| `js/modules/feedback.js` | **YENİ** — bağımsız Görüş Bildir modülü |
| `js/core/renderer.js` | `autoHeight: true` modüllere `seoz-autoheight` sınıfı ekler |
| `css/canvas.css` | `.seoz-autoheight` kuralı |
| `index.html`, `view.html`, `js/editor/export-package.js` | `feedback.js` kaydı (export'ta 2 yer) |
| `tests/core-selftest.js` | Anket + Görüş Bildir testleri |

Dokunulmayanlar: `editor-app.js`, `module-panel.js`, `module-registry.js`, `drag-resize.js`, `publish.js` ve diğer tüm modüller.

## Test listesi
1. **Eski anket:** Daha önce Google Form bağlanmış bir taslağı aç → Yanıt Yöntemi otomatik "Google Form" görünmeli, gönderim eskisi gibi çalışmalı.
2. **Şıklar:** Evet/Hayır → iki eşit buton. Uzun şıklar → tam genişlik, gerekirse 2 satır. Aynı sorudaki tüm şıklar aynı genişlikte.
3. **Boşluk:** Soru → şıklar → çizgi → sonraki soru düzeni net.
4. **Otomatik yükseklik:** Soru ekle/sil → kutu büyüyüp küçülmeli, alt katmanlara taşmamalı, sayfa uzamalı.
5. **Mobil:** Telefonda Ad Soyad / görüş kutusuna dokununca sayfa yakınlaşmamalı (iOS).
6. **WhatsApp (anket):** Yöntem WhatsApp + numara → Gönder → WhatsApp, cevaplar + görüşler + ad hazır yazılı açılmalı.
7. **Yöntem yok:** Editörde kırmızı kesikli uyarı görünmeli; "Yayına Hazırla" uyarı listesinde çıkmalı.
8. **Görüş Bildir:** Modül Ekle → Görüş Bildir. Anket olmayan bir projede tek başına eklenebilmeli. Her yöntemi dene (WhatsApp, Google Form, Harici bağlantı).
9. **Onay metni:** Doluysa kutu işaretlenmeden gönderilmemeli.
10. **ZIP:** "Yayına Hazırla" paketinde `js/modules/feedback.js` olmalı; paketten açılan sayfada modül çalışmalı.
11. **Diğer modüller:** Konum, RSVP, Galeri vb. boyut ve görünüşü değişmemiş olmalı.
12. `node tests/core-selftest.js` → TÜM TESTLER GEÇTİ.

## Bilinen sınırlar
- Google Form gönderimi `no-cors` olduğu için sunucu onayı okunamaz (eskisi gibi).
- WhatsApp yönteminde mesajı katılımcı kendisi gönderir; yanıtlar tek listede toplanmaz.
- Anket/Görüş kutusunun yükseklik tutamacı artık etkisiz (yükseklik otomatik); genişlik tutamacı çalışır.
- Studio SEOZ / Supabase yöntemi panelde "yakında" olarak görünür; sonraki aşama.

## Ek: Kutlama Efekti düzeltmesi (`js/modules/celebration.js`)
Yalnızca efektin oynatma kısmı (`playEffect`) değişti; ayarlar, buton ve tetikleme davranışı aynı.
1. Konfeti/parıltı ekranın en altına kadar inmeli, ortada aniden kaybolmamalı (~4 sn).
2. Telefon ve bilgisayarda aynı hızda düşmeli.
3. Butona art arda basınca efektler üst üste binmemeli.
4. Telefonda efekt sırasında sayfayı kaydırınca titreme/iz olmamalı.
5. Cihazda "Hareketi azalt" açıksa kısa ve sade sürüm oynamalı.
