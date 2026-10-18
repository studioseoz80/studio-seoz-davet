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

cp css/canvas.css "$OUT/css/canvas.css"
# Açılış Stüdyosu: sinematik açılış motoru (yalnızca görüntüleme kodu)
cp css/cinema.css "$OUT/css/cinema.css"

# Görüntüleme kodu: çekirdek, modüller ve üst düzey yardımcılar.
# js/editor/ BİLEREK kopyalanmaz.
cp -R js/core "$OUT/js/core"
cp -R js/modules "$OUT/js/modules"
cp js/*.js "$OUT/js/"
cp -R js/cinema "$OUT/js/cinema"
# İç Zemin Tasarım Stüdyosu: zemin motoru ve sunum biçimleri (yalnızca görüntüleme kodu)
cp -R js/theme "$OUT/js/theme"
cp css/theme.css "$OUT/css/theme.css"

# Müşteri katılımcı paneli (panel.html#k=...). Veriye erişim gizli panel
# anahtarıyla Supabase tarafında denetlenir; editör kodu içermez.
cp panel.html "$OUT/panel.html"
cp css/panel.css "$OUT/css/panel.css"
cp -R js/panel "$OUT/js/panel"

if [ -d assets ]; then cp -R assets "$OUT/assets"; fi
cp _headers.public "$OUT/_headers"

# Güvenlik kontrolü: editör dosyası yanlışlıkla girdiyse derlemeyi durdur.
if [ -d "$OUT/js/editor" ] || grep -q "editor-app.js" "$OUT/index.html"; then
  echo "HATA: Müşteri sitesine editör dosyası girdi — derleme durduruldu." >&2
  exit 1
fi

echo "Müşteri sitesi hazır: $OUT/ ($(find "$OUT" -type f | wc -l) dosya, editör yok)"
