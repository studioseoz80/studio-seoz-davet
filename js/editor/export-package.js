/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — export-package.js (yalnızca editör)
   -----------------------------------------------------------------------------
   ACİL DÜZELTME: Önceden "Yayına Hazırla" yalnızca bu tarayıcının kendi
   localStorage/IndexedDB'sine yazıyordu — bu yüzden site başka bir
   cihaza/hosting'e taşındığında (ör. Cloudflare Pages) davetiye eksik
   açılıyordu (medya verileri o tarayıcıda hiç yoktu).

   Bu dosya GERÇEK, BAĞIMSIZ bir yayın paketi (.zip) üretir:
     1) Belgedeki HER "idb:..." referansını (zemin, zarf, iç kart, galeri
        fotoğrafları, müzik — hangi modülde olduğuna bakılmaksızın, genel
        bir tarama ile) IndexedDB'den gerçek dosya (Blob) olarak okur.
     2) Bu dosyaları paketin "assets/" klasörüne yazar.
     3) Belgedeki "idb:..." referanslarını paket içindeki GERÇEK dosya
        yollarıyla ("assets/asset-1.jpg" gibi) değiştirir.
     4) Bu güncellenmiş belgeyi doğrudan paketin index.html'ine GÖMER
        (?doc=... gibi bir bağlantı parametresi GEREKMEZ).
     5) Yalnızca view.html'in ihtiyaç duyduğu çekirdek + modül dosyalarını
        pakete dahil eder — editöre özel HİÇBİR dosya (panel, kütüphane
        ekranı, JSON içe aktarma vb.) pakete girmez.

   ÖNEMLİ: js/core/blob-store.js'in resolveToObjectURL() fonksiyonu,
   "idb:" ile BAŞLAMAYAN bir değeri OLDUĞU GİBİ geri döndürür (bkz. o
   dosyanın kendi kodu). Bu sayede paket içindeki düz dosya yolları
   ("assets/asset-1.jpg") hiçbir render/modül kodunu DEĞİŞTİRMEDEN
   sorunsuz çalışır — IndexedDB'ye hiç dokunulmaz çünkü artık "idb:" ile
   başlayan hiçbir değer kalmamıştır.
   ========================================================================= */

(function (global) {
  "use strict";

  // view.html'in çalışması için gerekli, editöre özel OLMAYAN dosyalar.
  // js/core/storage.js BİLEREK DAHİL EDİLMEDİ — paket artık localStorage
  // üzerinden belge okumuyor, belge doğrudan index.html'e gömülü.
  const CORE_FILES = [
    "css/canvas.css",
    "js/core/document-model.js",
    "js/core/layout-engine.js",
    "js/core/blob-store.js",
    "js/core/renderer.js",
    "js/core/qr-encoder.js",
    "js/fonts-library.js",
    "js/entry-scene.js",
    "js/modules/module-registry.js",
    "js/modules/location.js",
    "js/modules/music.js",
    "js/modules/countdown.js",
    "js/modules/rsvp.js",
    "js/modules/gallery.js",
    "js/modules/guest-upload.js",
    "js/modules/celebration.js",
    "js/modules/poll.js",
    "js/modules/qrcode.js",
    "js/modules/calendar.js",
    "js/modules/feedback.js"
  ];

  const EXTENSION_BY_MIME = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/ogg": "ogg"
  };

  function guessExtension(blob) {
    return EXTENSION_BY_MIME[blob.type] || "bin";
  }

  /* Belge ağacında (herhangi bir alanda, hangi modül olduğuna
     bakılmaksızın) "idb:" ile başlayan her metni bulur. */
  function collectIdbRefs(node, refs) {
    if (typeof node === "string") {
      if (global.SeozBlobStore.isRef(node)) refs.add(node);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(item => collectIdbRefs(item, refs));
      return;
    }
    if (node && typeof node === "object") {
      Object.keys(node).forEach(key => collectIdbRefs(node[key], refs));
    }
  }

  /* Aynı ağacı, bu sefer "idb:" referanslarını verilen eşleme (map) ile
     değiştirerek dolaşır. Orijinal belgeyi DEĞİŞTİRMEZ — yeni bir kopya
     döner (çağıran taraf zaten önceden derin kopyalamış olmalı, ama bu
     fonksiyon da güvenlik için yeni nesneler üretir). */
  function replaceIdbRefs(node, map) {
    if (typeof node === "string") {
      return map.has(node) ? map.get(node) : node;
    }
    if (Array.isArray(node)) return node.map(item => replaceIdbRefs(item, map));
    if (node && typeof node === "object") {
      const out = {};
      Object.keys(node).forEach(key => { out[key] = replaceIdbRefs(node[key], map); });
      return out;
    }
    return node;
  }

  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, s => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[s]);
  }

  function buildIndexHtml(doc) {
    // "</script>" gömülü JSON'u erken kapatmasın diye "<" karakteri
    // kaçırılıyor — bu, verinin kendisini DEĞİŞTİRMEZ, yalnızca güvenli
    // gömme içindir (JSON.parse ile geri okunduğunda birebir aynıdır).
    const json = JSON.stringify(doc).replace(/</g, "\\u003c");
    const title = escapeHtml((doc.meta && doc.meta.title) || "Davetiye");

    return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>${title} — Studio SEOZ</title>
<link rel="stylesheet" href="css/canvas.css">
<style>html, body{ margin:0; min-height:100vh; background:#E9E4D8; }
.seoz-view-outer{ min-height:100vh; min-height:100dvh; }</style>
</head>
<body>
<div id="stage"></div>
<script type="application/json" id="seoz-doc-data">${json}</script>
<script src="js/core/document-model.js"></script>
<script src="js/core/layout-engine.js"></script>
<script src="js/core/blob-store.js"></script>
<script src="js/core/renderer.js"></script>
<script src="js/core/qr-encoder.js"></script>
<script src="js/fonts-library.js"></script>
<script src="js/entry-scene.js"></script>
<script src="js/modules/module-registry.js"></script>
<script src="js/modules/location.js"></script>
<script src="js/modules/music.js"></script>
<script src="js/modules/countdown.js"></script>
<script src="js/modules/rsvp.js"></script>
<script src="js/modules/gallery.js"></script>
<script src="js/modules/guest-upload.js"></script>
<script src="js/modules/celebration.js"></script>
<script src="js/modules/poll.js"></script>
<script src="js/modules/qrcode.js"></script>
<script src="js/modules/calendar.js"></script>
<script src="js/modules/feedback.js"></script>
<script>
(function () {
  "use strict";
  var doc = JSON.parse(document.getElementById("seoz-doc-data").textContent);
  var stage = document.getElementById("stage");
  stage.innerHTML =
    '<div class="seoz-canvas-outer seoz-view-outer"><div class="seoz-canvas-scale-wrap" id="seoz-scale-wrap">' +
    '<div class="seoz-canvas" id="seoz-canvas"></div></div></div>';
  var canvasEl = document.getElementById("seoz-canvas");
  var scaleWrapEl = document.getElementById("seoz-scale-wrap");
  var DESKTOP_BREAKPOINT_PX = 640;
  function breakpoint() { return window.innerWidth >= DESKTOP_BREAKPOINT_PX ? "desktop" : "mobile"; }
  function renderAndScale() {
    SeozRenderer.renderDocument(doc, canvasEl, "view", breakpoint());
    SeozLayoutEngine.applyScale(canvasEl, scaleWrapEl, doc.canvas.baseWidth);
  }
  SeozEntryScene.initEntryScene(doc, function () {
    renderAndScale();
    window.addEventListener("resize", renderAndScale);
    if (doc.entry && doc.entry.allowReplayForGuest && SeozEntryScene.hasUsableEntry(doc.entry)) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "seoz-replay-btn";
      btn.textContent = "↺ Baştan İzle";
      btn.addEventListener("click", function () { SeozEntryScene.play(doc, function () {}); });
      document.body.appendChild(btn);
    }
  });
})();
</script>
</body>
</html>`;
  }

  /* DÜZELTME ("Failed to fetch" hatası): Önceden bu dosyalar sayfanın o
     anki konumuna göre GÖRELİ bir yoldan (ör. fetch("css/canvas.css"))
     okunuyordu — bu, editörün tam olarak hangi klasör yapısıyla
     sunulduğuna dair bir VARSAYIM yapıyordu ve bazı yerel sunucu
     (Live Server vb.) kurulumlarında bu varsayım tutmuyordu.

     Artık bu dosyalar, sayfada ZATEN BAŞARIYLA YÜKLENMİŞ olan <script>/
     <link> etiketlerinin tarayıcının kendisinin çözdüğü GERÇEK, mutlak
     URL'sinden okunuyor. Bu URL'nin doğru olduğu garantidir — çünkü
     sayfa zaten bu dosyayı yükleyerek çalışıyor. Böylece editörün nereden
     sunulduğuna dair hiçbir varsayımda bulunmuyoruz.
     ------------------------------------------------------------------ */
  function resolveSourceUrl(relPath) {
    const fileName = relPath.split("/").pop();
    if (relPath.endsWith(".css")) {
      const link = document.querySelector(
        'link[rel="stylesheet"][href$="' + fileName + '"], link[rel="stylesheet"][href*="' + fileName + '"]'
      );
      if (link) return link.href;
    } else {
      const script = document.querySelector(
        'script[src$="' + fileName + '"], script[src*="' + fileName + '"]'
      );
      if (script) return script.src;
    }
    // Sayfada bulunamazsa (beklenmedik durum) sayfanın kendi konumuna
    // göre göreli çözülür — eski davranış, yalnızca yedek yol.
    return new URL(relPath, document.baseURI).href;
  }

  async function fetchTextOrThrow(relPath) {
    const url = resolveSourceUrl(relPath);
    let res;
    try {
      res = await fetch(url);
    } catch (networkErr) {
      // DÜZELTME: artık genel "Failed to fetch" yerine HANGİ dosyanın
      // başarısız olduğu açıkça belirtiliyor.
      throw new Error(`Gerekli dosya alınamadı: "${relPath}" (denenen adres: ${url}). Ağ/CORS hatası: ${networkErr.message}`);
    }
    if (!res.ok) {
      throw new Error(`Gerekli dosya bulunamadı: "${relPath}" (denenen adres: ${url}, HTTP ${res.status}).`);
    }
    return res.text();
  }

  /* Ana fonksiyon: verilen belgeden gerçek, bağımsız bir .zip paketi
     üretir. Dönen değer bir Blob'dur (indirme bağlantısı için). */
  async function buildPackageZip(doc) {
    if (typeof JSZip === "undefined") {
      throw new Error("Paketleme kütüphanesi (JSZip) yüklenemedi. İnternet bağlantınızı kontrol edip tekrar deneyin.");
    }

    const docCopy = JSON.parse(JSON.stringify(doc));

    const refs = new Set();
    collectIdbRefs(docCopy, refs);

    const map = new Map();
    const zip = new JSZip();
    const assetsFolder = zip.folder("assets");

    let counter = 1;
    for (const ref of refs) {
      const key = ref.slice(4);
      let blob = null;
      try {
        blob = await global.SeozBlobStore.getBlob(key);
      } catch (e) {
        blob = null;
      }
      if (!blob) {
        // Bozuk/eksik bir referans paketi çökertmesin — atlanır, ama
        // konsola açıkça bildirilir.
        console.warn("[Studio SEOZ] Paket dışa aktarma: '" + ref + "' referansı IndexedDB'de bulunamadı, atlanıyor.");
        continue;
      }
      const filename = "asset-" + counter + "." + guessExtension(blob);
      counter += 1;
      assetsFolder.file(filename, blob);
      map.set(ref, "assets/" + filename);
    }

    const finalDoc = replaceIdbRefs(docCopy, map);

    for (const relPath of CORE_FILES) {
      const text = await fetchTextOrThrow(relPath);
      zip.file(relPath, text);
    }

    zip.file("index.html", buildIndexHtml(finalDoc));

    return {
      blob: await zip.generateAsync({ type: "blob" }),
      resolvedCount: map.size,
      totalRefs: refs.size
    };
  }

  global.SeozExportPackage = { buildPackageZip, buildIndexHtml, collectIdbRefs, replaceIdbRefs };
})(window);
