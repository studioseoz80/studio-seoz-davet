#!/bin/sh
# =============================================================================
# STUDIO SEOZ — MÜŞTERİ (HERKESE AÇIK) SİTESİNİ HAZIRLAR
# -----------------------------------------------------------------------------
# Bu dosyayı SEN çalıştırmazsın; Cloudflare'deki ikinci (müşteri) projesi her
# GitHub güncellemesinde otomatik çalıştırır:
#     Build command:          sh build-public.sh
#     Build output directory: public-site
#
# Ne yapar: Yalnızca davetiye GÖRÜNTÜLEME için gereken dosyaları
# "public-site" klasörüne kopyalar. Editör (index.html + js/editor/),
# testler ve rehberler bu siteye HİÇ girmez — yani müşteri linkinin
# sonunu silen biri editöre ulaşamaz, çünkü o sitede editör yoktur.
# =============================================================================
set -e

OUT=public-site
rm -rf "$OUT"
mkdir -p "$OUT/js" "$OUT/css"

# Davetiye sayfası. Ana adres (/) de aynı sayfayı gösterir; ?slug=
# olmadan açılırsa yalnızca "davetiyeye işaret etmiyor" mesajı çıkar.
cp view.html "$OUT/view.html"
cp view.html "$OUT/index.html"

# HIZLI AÇILIŞ — YAZI TİPLERİ: editördeki canvas.css bütün yazı tiplerini (60+ aile) sayfayı bekleterek
# yükler. Davetiye sayfasında bu satırlar çıkarılır; aile listesi js/font-specs.js'e yazılır ve sayfa
# yalnızca davetiyede kullanılan aileleri, sayfayı bekletmeden yükler (functions/[slug].js, js/view-app.js).
grep -v "^@import url('https://fonts.googleapis.com/" css/canvas.css > "$OUT/css/canvas.css"
# Açılış Stüdyosu: sinematik açılış motoru (yalnızca görüntüleme kodu)
cp css/cinema.css "$OUT/css/cinema.css"

# Görüntüleme kodu: çekirdek, modüller ve üst düzey yardımcılar.
# js/editor/ BİLEREK kopyalanmaz.
cp -R js/core "$OUT/js/core"
cp -R js/modules "$OUT/js/modules"
cp js/*.js "$OUT/js/"
cp -R js/cinema "$OUT/js/cinema"
# 3D model motoru (Three.js, MIT). Yalnızca davetiyede 3D model katmanı varsa
# tarayıcıya iner; model olmayan davetiyeler bu klasöre hiç istek atmaz.
cp -R js/vendor "$OUT/js/vendor"
# İç Zemin Tasarım Stüdyosu: zemin motoru ve sunum biçimleri (yalnızca görüntüleme kodu)
cp -R js/theme "$OUT/js/theme"
cp css/theme.css "$OUT/css/theme.css"

# Müşteri katılımcı paneli (panel.html#k=...). Veriye erişim gizli panel
# anahtarıyla Supabase tarafında denetlenir; editör kodu içermez.
cp panel.html "$OUT/panel.html"
cp css/panel.css "$OUT/css/panel.css"
cp -R js/panel "$OUT/js/panel"
# Müşteri anı albümü (album.html#k=...): Anı Yükle "Studio SEOZ depolaması" ile yüklenenler.
cp album.html "$OUT/album.html"
cp css/album.css "$OUT/css/album.css"
# Teslimat Paketi (paket.html#i=...&a=...&r=...): davetiye + anı albümü + katılım paneli bağlantıları tek sayfada.
cp paket.html "$OUT/paket.html"
cp css/paket.css "$OUT/css/paket.css"
# Anket sonuç paneli (anket-panel.html#k=...): "Studio SEOZ sistemi" yöntemli anketler.
cp anket-panel.html "$OUT/anket-panel.html"
cp css/anket-panel.css "$OUT/css/anket-panel.css"
# Salt okunur anket sonuçları (anket-sonuc.html#g=...): yalnızca toplu oylar; herkese gösterilebilir.
cp anket-sonuc.html "$OUT/anket-sonuc.html"

# Yazı tipi listesi (tek kaynak: css/canvas.css'teki @import satırları) → js/font-specs.js
{
  printf '/* build-public.sh tarafından css/canvas.css dosyasından üretilir. Elle düzenlemeyin. */\nwindow.SeozFontSpecs = {'
  grep "^@import url('https://fonts.googleapis.com/" css/canvas.css | grep -o "family=[^&']*" | sed 's/^family=//' |
    awk 'BEGIN { n = 0 } { split($0, a, ":"); name = a[1]; gsub(/\+/, " ", name); printf "%s\"%s\":\"%s\"", (n++ ? "," : ""), name, $0 }'
  printf '};\n'
} > "$OUT/js/font-specs.js"
if ! grep -q '"Cormorant Garamond":' "$OUT/js/font-specs.js"; then
  echo "HATA: yazı tipi listesi üretilemedi — derleme durduruldu." >&2
  exit 1
fi

if [ -d assets ]; then cp -R assets "$OUT/assets"; fi
# Bağlantı önizleme botları (Instagram/Facebook, WhatsApp...) için açık robots.txt.
# (Yoksa bu adres davetiye sayfasını döndürüyordu.) Davetiyeler arama motorlarında
# yine listelenmez: kısa bağlantılar "noindex" başlığıyla sunulur.
printf 'User-agent: *\nAllow: /\n' > "$OUT/robots.txt"
cp _headers.public "$OUT/_headers"

# HIZLI AÇILIŞ — TEKRAR ZİYARET: davetiye sayfasının kod ve stil dosyaları içerik parmak izli bir klasöre
# (v/<parmak-izi>/) kopyalanır ve tarayıcıda 1 yıl saklanır (_headers: /v/*). Kod değişince parmak izi
# değişir; misafir eski dosyayı asla görmez. Diğer sayfalar (panel, albüm, paket) eski adresleri kullanır.
VER=$(find "$OUT/js" "$OUT/css" -type f | LC_ALL=C sort | xargs cat | cksum | cut -d' ' -f1)
mkdir -p "$OUT/v/$VER"
cp -R "$OUT/js" "$OUT/css" "$OUT/v/$VER/"
for f in view.html index.html; do
  sed -e "s#src=\"js/#src=\"v/$VER/js/#g" -e "s#href=\"css/#href=\"v/$VER/css/#g" "$OUT/$f" > "$OUT/$f.tmp" && mv "$OUT/$f.tmp" "$OUT/$f"
done
if ! grep -q "v/$VER/js/view-app.js" "$OUT/view.html"; then
  echo "HATA: sürümlü dosya adresleri yazılamadı — derleme durduruldu." >&2
  exit 1
fi

# Güvenlik kontrolü: editör dosyası yanlışlıkla girdiyse derlemeyi durdur.
if [ -d "$OUT/js/editor" ] || grep -q "editor-app.js" "$OUT/index.html"; then
  echo "HATA: Müşteri sitesine editör dosyası girdi — derleme durduruldu." >&2
  exit 1
fi

echo "Müşteri sitesi hazır: $OUT/ ($(find "$OUT" -type f | wc -l) dosya, editör yok)"
