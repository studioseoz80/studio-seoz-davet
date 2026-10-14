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
