# Mühürlü Kart + Dilek Ağacı — Canlıya Geçiş Planı

Dal: `etkilesim-kart-dilek` · Canlı (main) şu an: `dce5d11` · Supabase projesi: `wzpbegueescmrtlflayp`

## Ön koşullar (canlıda okuma ile doğrulandı)
- Var: `public.seoz_is_owner()`, `public.rsvp_events`, `public.published_invitations`,
  `seoz_private.event_by_panel_token / hash_token / new_token`, `public.rsvp_owner_set_open` (katilim-faz-a/b/d kurulu).
- Fonksiyon gövdeleri test veritabanındakiyle birebir aynı.
- Çakışma yok: `wish_entries`, `wish_panel_events`, `sealed_card_messages` tabloları ve `wish_*` / `sealed_*` fonksiyonları canlıda henüz yok.
- Canlıda Supabase'in varsayılan yetkileri yeni tablo/fonksiyonları anon'a açıyor → iki SQL dosyası da her nesne için yetkileri açıkça geri alıyor (test edildi).

## Uygulama sırası
1. **Yedek (kod):** `main` (`dce5d11`) için yedek dalı: `yedek-etkilesim-oncesi`. Cloudflare'deki mevcut Production yayını da geri dönüş noktası.
2. **Yedek (veri sayımı, yalnızca okuma):** `rsvp_events`, `rsvp_responses`, `published_invitations` sayıları kaydedilir.
3. **SQL 1:** `supabase/muhurlu-kart.sql` (bağımsız; yalnızca yeni tablo + 3 fonksiyon).
4. **SQL 2:** `supabase/dilek-agaci.sql` (katılım sistemine bağlı; yalnızca yeni 2 tablo + fonksiyonlar).
5. **Doğrulama (okuma):** nesneler, yetkiler (anon yalnızca: `sealed_card_get`, `wish_tree_get`, `wish_tree_add`, `wish_panel_*`), RLS açık, mevcut sayılar aynı.
6. **Kod:** `etkilesim-kart-dilek` → `main` (çakışmasız, ileri sarma) → Cloudflare Production.
7. **Canlı kısa kontrol:** mevcut davetiyeler (TR/EN) açılıyor; editörde iki yeni seçenek var. İstenirse "silinebilir" bir test davetiyesiyle uçtan uca deneme ve sonra test verisinin temizliği (ayrı onayla).

Neden önce SQL: SQL yalnızca ekleme yapar, eski kod onu hiç çağırmaz → canlıya etkisi yoktur. Önce kod gitseydi, Mühürlü Kart'lı davetiye SQL kurulana kadar yayınlanamazdı (bilerek engellenir).

## Geri alma
- **Kod sorunu:** yeni kod yazmadan önceki Cloudflare Production yayınına dön (ya da `main`'i `yedek-etkilesim-oncesi`'ne geri al). SQL kalabilir; eski kod onu kullanmaz.
- **SQL'i tamamen kaldırma (yalnızca özellikten vazgeçilirse, koddan sonra):**
  1. Dilekler panelden Excel'e indirilir.
  2. `supabase/dilek-agaci-geri-al.sql` → dilekler ve Dilek Ağacı fonksiyonları silinir. Yalnızca dilek için açılmış (kapalı) etkinlik kayıtları `rsvp_events`'te kalır (zararsız).
  3. `supabase/muhurlu-kart-geri-al.sql` → saklanan gizli mesajlar silinir.
  Geri alma dosyaları yalnızca kendi nesnelerini kaldırır; başka tablo/veriye dokunmaz (test edildi).

## Silme
Otomatik silme yok. Dilekler: panelden tek tek ya da Yayına Hazırla → "Dilekleri Sil" (SİL onaylı). Gizli mesajlar: `sealed_owner_purge(slug)` (yalnızca Studio SEOZ).
