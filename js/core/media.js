/* =============================================================================
   STUDIO SEOZ — core/media.js  (MP4 KATMANLAR · ortak video yardımcıları)
   -----------------------------------------------------------------------------
   Açılış katmanları, zarf ve iç kart PNG/JPG'nin yanında MP4 de olabilir. Bir
   kaydın video olduğu, yanındaki "media" alanından anlaşılır:

     katman.media      = { type:"video", autoplay, loop, sound, poster, w, h, duration }
     entry.pngMedia    → zarf / giriş görseli (pngSrc)
     entry.cardMedia   → iç kart (cardSrc)
     entry.cardOnlyMedia → tek kart (cardOnlySrc)

   "media" alanı OLMAYAN kayıt (bütün eski davetiyeler) eskisi gibi <img> ile
   çizilir; bu dosyadaki hiçbir şey devreye girmez.

   Oynatma kuralları (tarayıcı kuralları gereği):
   - Video her zaman SESSİZ başlar (sessiz otomatik oynatmaya bütün tarayıcılar izin verir).
   - "Ses açık" seçiliyse ses, misafirin ilk dokunuşunda açılır.
   - "Otomatik oynat" açıksa video sahne görünür görünmez, kapalıysa açılış başlayınca oynar.
   - Bölünen / parçalanan katmanlarda (ortadan açılma, parçalanma…) her parça aynı
     videonun sessiz bir kopyasıdır; hepsi aynı anda başlar.
   ========================================================================= */
(function (global) {
  "use strict";

  const MAX_MB = 25, MAX_SEC = 60, WARN_MB = 8, WARN_SEC = 15;
  const ACCEPT_IMAGES = "image/png,image/jpeg,image/webp";
  const ACCEPT_WITH_VIDEO = ACCEPT_IMAGES + ",video/mp4,.mp4,.m4v";

  function isVideo(m) { return !!(m && typeof m === "object" && m.type === "video"); }
  function opts(m) { m = m || {}; return { autoplay: m.autoplay !== false, loop: m.loop !== false, sound: !!m.sound }; }
  function isVideoFile(f) { return !!f && (/^video\/mp4$/i.test(f.type || "") || /\.(mp4|m4v)$/i.test(f.name || "")); }
  function crossOrigin(url) {
    if (!/^https?:/i.test(url || "")) return false;
    try { return new URL(url, global.location.href).origin !== global.location.origin; } catch (e) { return false; }
  }

  /* Ekranda gösterilecek <video>. Her zaman sessiz başlar, satır içi oynar (iPhone tam ekran açmaz). */
  function makeVideo(url, m, style, cls) {
    const o = opts(m), v = document.createElement("video");
    v.muted = true; v.defaultMuted = true; v.setAttribute("muted", "");
    v.playsInline = true; v.setAttribute("playsinline", ""); v.setAttribute("webkit-playsinline", "");
    v.preload = "auto"; v.loop = o.loop; v.disablePictureInPicture = true; v.setAttribute("disableremoteplayback", "");
    v.dataset.seozVideo = "1"; v.dataset.vAuto = o.autoplay ? "1" : "0"; v.dataset.vSound = o.sound ? "1" : "0";
    if (cls) v.className = cls;
    if (style) Object.assign(v.style, style);
    if (url) { if (crossOrigin(url)) v.crossOrigin = "anonymous"; v.src = url; }
    return v;
  }
  /* Parçalara bölünen katmanlar için kopya: aynı kaynak, hep sessiz, aynı oynatma ayarları */
  function cloneVideo(src, style) {
    const v = makeVideo(src.currentSrc || src.getAttribute("src") || "", { type: "video", loop: src.loop, autoplay: src.dataset.vAuto !== "0", sound: false }, style);
    v.dataset.clone = "1";
    return v;
  }
  /* Görsel ya da video öğesinin kopyası (bölünen parçalar için). img ise eskisi gibi <img>. */
  function cloneVisual(el, style) {
    if (el && el.tagName === "VIDEO") return cloneVideo(el, style);
    if (el && el.dataset && el.dataset.seozModel && global.SeozModel3D) return global.SeozModel3D.snapshot(el, style);   // 3D model: o anki kare
    const im = document.createElement("img");
    if (style) Object.assign(im.style, style);
    im.src = el ? el.src : ""; im.alt = "";
    return im;
  }

  function videosIn(root) { return root ? Array.from(root.querySelectorAll("video[data-seoz-video]")) : []; }
  function playSafe(v) { try { const p = v.play(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* önemsiz */ } }
  /* phase: "show" → yalnızca otomatik oynayanlar; "open" → hepsi (açılış başladı). Kopyalar asıllarıyla birlikte başlar. */
  function start(root, phase) {
    if (global.__seozVideoManual) return;   // video dışa aktarımı: oynatmayı dışa aktarıcı yönetir
    videosIn(root).forEach(v => {
      if (v.dataset.started) return;
      if (phase === "show" && v.dataset.vAuto === "0") return;
      v.dataset.started = "1";
      // kaynak adresi henüz çözülmediyse (IndexedDB / ağ) yüklenir yüklenmez kendiliğinden başlasın
      if (!v.getAttribute("src")) { v.autoplay = true; return; }
      try { v.currentTime = 0; } catch (e) { /* önemsiz */ }
      playSafe(v);
    });
  }
  /* Misafirin dokunuşu: "ses açık" videolarda (kopyalar hariç) ses açılır. Dokunuşun içinde çağrılmalı. */
  function unmute(root) {
    videosIn(root).forEach(v => {
      if (v.dataset.vSound !== "1" || v.dataset.clone) return;
      v.muted = false;
      if (v.dataset.started) playSafe(v);
    });
  }
  function stop(root) { videosIn(root).forEach(v => { try { v.pause(); } catch (e) { /* önemsiz */ } }); }

  /* ---------------- editör: MP4 dosyasını hazırla ----------------
     Tarayıcının bu dosyayı gerçekten oynatabildiği denenir (ör. H.265 MP4'leri birçok tarayıcı
     oynatamaz); ilk kareden bir kapak görseli (poster) üretilir. Dosya olduğu gibi saklanır. */
  function loadVideoMeta(url) {
    return new Promise((res, rej) => {
      const v = document.createElement("video");
      v.muted = true; v.playsInline = true; v.preload = "auto";
      let done = false;
      const fail = msg => { if (done) return; done = true; clearTimeout(t); rej(new Error(msg)); };
      const t = setTimeout(() => fail("Video okunamadı (zaman aşımı)."), 15000);
      v.onerror = () => fail("Bu MP4 bu tarayıcıda oynatılamıyor. Videoyu H.264 (MP4) olarak kaydedip tekrar deneyin.");
      v.onloadeddata = () => {
        if (!v.videoWidth || !v.videoHeight) return fail("Videonun görüntüsü okunamadı. H.264 (MP4) olarak kaydedip tekrar deneyin.");
        const seekTo = Math.min(0.1, (v.duration || 1) / 4);
        v.onseeked = () => { if (done) return; done = true; clearTimeout(t); res(v); };
        try { v.currentTime = seekTo; } catch (e) { done = true; clearTimeout(t); res(v); }
      };
      v.src = url;
    });
  }
  /* MP4 içindeki video kodunu oku (moov › trak › mdia › minf › stbl › stsd). Yalnızca kutu başlıkları gezilir. */
  function videoCodecOf(buf) {
    const dv = new DataView(buf), n = buf.byteLength;
    const type = o => String.fromCharCode(dv.getUint8(o + 4), dv.getUint8(o + 5), dv.getUint8(o + 6), dv.getUint8(o + 7));
    function find(start, end, path) {
      let o = start;
      while (o + 8 <= end) {
        let size = dv.getUint32(o), hdr = 8;
        if (size === 1 && o + 16 <= end) { size = dv.getUint32(o + 8) * 4294967296 + dv.getUint32(o + 12); hdr = 16; }
        else if (size === 0) size = end - o;
        if (size < 8 || o + size > end) return null;
        const t = type(o);
        if (t === path[0]) {
          if (path.length === 1) return { o, hdr, end: o + size };
          const skip = t === "stsd" ? 8 : 0;
          const r = find(o + hdr + skip, o + size, path.slice(1));
          if (r && r !== "next") return r;
          if (t !== "trak") return null;
        }
        o += size;
      }
      return null;
    }
    try {
      const moov = find(0, n, ["moov"]); if (!moov) return "";
      // birden çok iz olabilir: video izini (vide) bul
      let o = moov.o + moov.hdr;
      while (o + 8 <= moov.end) {
        const size = dv.getUint32(o); if (size < 8) break;
        if (type(o) === "trak") {
          const hd = find(o + 8, o + size, ["mdia", "hdlr"]);
          if (hd && String.fromCharCode(dv.getUint8(hd.o + 16), dv.getUint8(hd.o + 17), dv.getUint8(hd.o + 18), dv.getUint8(hd.o + 19)) === "vide") {
            const st = find(o + 8, o + size, ["mdia", "minf", "stbl", "stsd"]);
            if (st) return type(st.o + st.hdr + 8);
          }
        }
        o += size;
      }
    } catch (e) { /* okunamadı */ }
    return "";
  }

  async function processVideoFile(file, o) {
    o = o || {};
    if (!isVideoFile(file)) throw new Error("Yalnızca MP4 video yüklenebilir.");
    const mb = file.size / 1048576;
    if (mb > (o.maxMB || MAX_MB)) throw new Error(`Video ${mb.toFixed(1)} MB; en fazla ${o.maxMB || MAX_MB} MB olabilir. Daha kısa ya da daha düşük çözünürlüklü bir MP4 deneyin.`);
    // iPhone'un "Yüksek Verimlilik" (HEVC / H.265) videoları Android telefonlarda ve birçok tarayıcıda oynamaz
    let codec = "";
    try { codec = videoCodecOf(await file.arrayBuffer()); } catch (e) { /* okunamadı: tarayıcı denemesi yeterli */ }
    if (codec === "hvc1" || codec === "hev1") throw new Error("Bu video HEVC (H.265) biçiminde; Android telefonlarda ve birçok tarayıcıda oynamaz. Videoyu H.264 (MP4) olarak kaydedip tekrar yükleyin. (iPhone: Ayarlar › Kamera › Biçimler › “En Uyumlu”)");
    const url = URL.createObjectURL(file);
    try {
      const v = await loadVideoMeta(url);
      const w = v.videoWidth, h = v.videoHeight, duration = isFinite(v.duration) ? v.duration : 0;
      if (duration > MAX_SEC) throw new Error(`Video ${Math.round(duration)} saniye; açılışlar için en fazla ${MAX_SEC} saniye kullanılabilir.`);
      // kapak görseli (ilk kare): küçük resimler, kalınlık/gölge kopyaları ve video henüz yüklenmemişken kullanılır
      const k = Math.min(1, 1280 / Math.max(w, h)), cv = document.createElement("canvas");
      cv.width = Math.max(1, Math.round(w * k)); cv.height = Math.max(1, Math.round(h * k));
      cv.getContext("2d").drawImage(v, 0, 0, cv.width, cv.height);
      const posterBlob = await new Promise(r => cv.toBlob(r, "image/jpeg", 0.86));
      const blob = file.type === "video/mp4" ? file : new Blob([file], { type: "video/mp4" });
      const ref = await global.SeozBlobStore.putBlob(blob);
      const poster = posterBlob ? await global.SeozBlobStore.putBlob(posterBlob) : "";
      const warnings = [], notes = [];
      if (mb > WARN_MB) notes.push(`Video ${mb.toFixed(1)} MB; yavaş bağlantıda açılışı geciktirebilir (öneri: 8 MB altı).`);
      if (duration > WARN_SEC) notes.push(`Video ${Math.round(duration)} saniye; açılışlar için 3–10 saniyelik kısa klipler önerilir.`);
      if (Math.max(w, h) > 1920) notes.push(`Video ${w}×${h} px; telefonlar için 1080 px genişlik yeterlidir (daha küçük dosya).`);
      if (codec && codec !== "avc1" && codec !== "avc3") notes.push(`Video ${codec === "vp09" ? "VP9" : codec === "av01" ? "AV1" : codec} biçiminde; bazı iPhone'larda oynamayabilir. En geniş uyum için H.264 (MP4) önerilir.`);
      notes.push("Video saydam olamaz (MP4 saydamlık taşımaz): arkasındaki katmanları örter.");
      return { ref, poster, info: { w, h, duration: Math.round(duration * 100) / 100, bytes: file.size, name: file.name, hasAlpha: false, video: true }, warnings, notes };
    } finally { URL.revokeObjectURL(url); }
  }
  /* Yeni video kaydının "media" alanı (varsayılanlar: otomatik oynat, döngü, sessiz) */
  function newMedia(res, prev) {
    const p = isVideo(prev) ? prev : {};
    return { type: "video", autoplay: p.autoplay !== false, loop: p.loop !== false, sound: !!p.sound, poster: res.poster || "", w: res.info.w, h: res.info.h, duration: res.info.duration };
  }

  global.SeozMedia = { MAX_MB, MAX_SEC, ACCEPT_IMAGES, ACCEPT_WITH_VIDEO, isVideo, opts, isVideoFile, makeVideo, cloneVideo, cloneVisual,
    videosIn, start, unmute, stop, processVideoFile, newMedia, videoCodecOf };
})(window);
