# Katılımcı & Etkinlik Yönetim Sistemi — Faz A Kurulum ve Test

## Faz A'da ne var?
- **Katılım Formu** modülü: misafir davetiyeden ayrılmadan formu doldurur, yanıt Supabase'e kaydedilir.
- Editörde **soru oluşturucu**: Soru Ekle; 8 soru türü; zorunlu/isteğe bağlı; aktif/pasif; "yalnızca katılacaklara sor".
- **Kişi sayısı + diğer katılımcıların isimleri**: her kişi ayrı katılımcı olarak kaydedilir; grup ilişkisi korunur.
- Misafir **yanıtını sonradan güncelleyebilir** (aynı telefondan). Yeni kayıt açılmaz.
- Yayın sonrası etkinlik kaydı ve **panel anahtarı** oluşur. Müşteri paneli Faz B'de gelecek.

Mevcut RSVP modülü, yayın akışı, müşteri linkleri ve `published_invitations` tablosu **değişmedi**.

## Sıra önemli: önce Supabase, sonra kod

### 1) Supabase'de tabloları kur
1. Supabase → projen → **SQL Editor** → **New query**
2. `supabase/katilim-faz-a.sql` dosyasının **tamamını** kopyala, yapıştır, **Run**.
3. "Success" görmelisin.
   - "seoz_is_owner() bulunamadı" hatası çıkarsa: önce `GUCLENDIRME-REHBERI.md` bölüm B uygulanmalı. Bu durumda hiçbir şey oluşturulmaz, güvenle tekrar denenebilir.
4. **Table Editor**'de `rsvp_events`, `rsvp_responses`, `rsvp_attendees` tablolarını görmelisin. Üçünde de kilit simgesi (RLS) olmalı.

Bu dosyayı tekrar çalıştırmak güvenlidir; veri silmez.

### 2) Kodu GitHub'a gönder
Cloudflare iki siteyi 1-3 dakikada günceller.

### 3) Test
1. Editörü aç, **Ctrl+F5** ile yenile, **☁ ile giriş yapmış** olduğundan emin ol.
2. Yeni bir test davetiyesi oluştur → **Modül Ekle → Katılım Formu**.
3. Sağ panelde soruları düzenle. Örnek: **+ Soru Ekle** → "Tek seçim" → "Menü tercihiniz" → seçenekler.
4. **Yayına Hazırla** → müşteri linki her zamanki gibi çıkar.
5. Linki **telefonda** aç, formu doldur, gönder → "Yanıtınız alındı".
6. Supabase → Table Editor → `rsvp_responses` → yanıtı gör.
7. Aynı telefonda linki tekrar aç → form senin yanıtınla dolu gelmeli → değiştir → **Yanıtımı Güncelle**.
   - Tabloda hâlâ **1 satır** olmalı, `update_count` 1 olmalı.
8. Başka bir telefondan aç → form **boş** gelmeli (başkasının yanıtı görünmez).

## Geri alma
- Kodu geri almak: GitHub'daki son kaydı geri al.
- Veritabanını geri almak: `supabase/katilim-geri-al.sql` dosyasını çalıştır. **Tüm katılım yanıtları silinir.** Davetiyeler etkilenmez.

## Güvenlik özeti
- Misafir tablolara doğrudan **erişemez**. Yalnızca kendi yanıtını gönderir ve kendi gizli anahtarıyla günceller.
- Anahtarlar veritabanında yalnızca şifrelenmiş özet olarak tutulur.
- Studio SEOZ (sahip girişi) tüm yanıtları Supabase'de görebilir. Başka giriş yapan biri hiçbir şey göremez.
- Panel anahtarı Studio SEOZ tarafından yenilenebilir; eski anahtar anında geçersiz olur.
- İleride isteğe bağlı PIN için veritabanında yer ayrıldı (`panel_pin_hash`).

---

# Faz D — Yerleşim Planı (masa / alan)

## Ne var?
- Panelde **Yerleşim** sekmesi. Etkinlik türünden bağımsızdır: katılımcı, grup, masa / alan.
- Sınırsız masa/alan; her birinin kendi adı, numarası, şekli (yuvarlak / dikdörtgen) ve **kendi kapasitesi**. Tek seferde birden fazla masa eklenebilir.
- **Salon planı:** masalar fareyle veya parmakla sürüklenir, yerleri kaydedilir. Masanın çevresindeki noktalar dolu/boş sandalyeleri gösterir.
- **Masa listesi:** her masa bir kart; oturanlar etiket olarak görünür.
- Kişi yerleştirme:
  - Sürükle-bırak (telefonda basılı tutup sürükle).
  - Ya da **kişiye dokun → masaya dokun**.
- Grup birlikte taşınır ("Grubu seç" / "Tüm grubu seç"). İki kişi sürükleyerek veya art arda dokunarak yer değiştirir. ✕ ile kişi masadan çıkar.
- Masa dolunca "Masa 4 kapasitesine ulaştı – 10/10" uyarısı çıkar. Kapasite aşımı kilitlenmez ama önce açık onay istenir.
- Arama ve soru filtresiyle (ör. Menü = Vejetaryen) bulunan kişiler "Görünenlerin hepsini seç" ile seçilip masaya konur. **Kimse otomatik yerleştirilmez.**
- "Yerleştirilmemiş: N kişi" sayacı ve uyarısı.
- Excel (masa listesi; menü gibi cevaplarla birlikte) ve yazdırılabilir masa listesi.
- Kişi Listesi sekmesinde ve Excel'inde herkesin masası da görünür.
- Misafir sonradan kişi sayısını azaltır ya da katılmayacağını bildirirse, artık gelmeyen kişinin yerleşimi kendiliğinden kalkar.
- Masa silinirse oradaki kişiler "Yerleştirilmemiş" listesine döner.

## Kurulum sırası
1. Supabase → SQL Editor → `supabase/katilim-faz-d.sql` içeriğini yapıştır → Run ("Success").
2. Sonra kodu yayına al. SQL'den önce yayına alınırsa Yerleşim sekmesi yalnızca "henüz etkin değil" der; panelin geri kalanı çalışmaya devam eder.

## Güvenlik
- `seating_areas` ve `seating_assignments` tablolarına doğrudan erişim kapalıdır (RLS). Yalnızca Studio SEOZ hesabı okuyabilir.
- Panel her işlemi panel anahtarıyla yapar. Fonksiyon yalnızca **o etkinliğin** masalarına ve **o etkinliğin katılan** kişilerine izin verir. Başka etkinliğin masası veya kişisi kullanılamaz.
