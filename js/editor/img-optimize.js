/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — editor/img-optimize.js · GÖRSELLERİN HIZLI KOPYALARI
   -----------------------------------------------------------------------------
   "Yayına Hazırla" sırasında (core/cloud-store.js → publishSnapshot) çalışır:
   davetiyedeki büyük görsellerin (PNG / JPEG / WebP) ekran boyutlarına göre
   küçültülmüş WebP kopyalarını üretir ve aslının yanına yükler:
       <klasör>/<ad>.png  →  <klasör>/<ad>__w828.webp, __w1200.webp, __w1800.webp
   Yayın kopyasına yalnızca bir "adres eşlemesi" yazılır (meta.imgv). Davetiye
   sayfası ekrana yetecek en küçük kopyayı kullanır (core/fast-boot.js).

   GÜVENLİK / KALİTE
   - Asıl dosyalar hiçbir zaman değiştirilmez, silinmez, üzerine yazılmaz
     (yükleme "x-upsert: false"). Kopya açılamazsa davetiye aslını kullanır.
   - Şeffaflık (PNG alfa) kayıpsız korunur; kalite tasarım görsellerinde %95, fotoğraflarda %90. Kopya aslından
     anlamlı ölçüde küçük değilse üretilmez. Hareketli PNG/WebP'lere dokunulmaz.
   - Tarayıcı WebP üretemiyorsa (bazı Safari sürümleri) kopya üretilmez; yayın
     eskisi gibi sürer. Bu adımdaki HİÇBİR hata yayını durdurmaz.
   ========================================================================= */
(function (global) {
  "use strict";

  const WIDTHS = [828, 1200, 1800];
  // Kalite: tasarım görselleri (PNG / WebP — altın çizgiler, çiçekler, şeffaflık) %95; fotoğraflar (JPEG) %90.
  // Ölçüm (yerel): SSIM ≥ 0,99; şeffaflık (alfa) kayıpsız; 1x ekranda fark görülmüyor.
  const QUALITY_ART = 0.95, QUALITY_PHOTO = 0.9;
  const MIN_BYTES = 60 * 1024;          // bundan küçük görseller zaten hızlı
  const CACHE_KEY = "seoz_imgv_cache_v1";
  const RASTER = /\.(png|jpe?g|webp)(\?|#|$)/i;
  const IS_VARIANT = /__w\d+\.webp(\?|#|$)/i;

  function readCache() { try { return JSON.parse(global.localStorage.getItem(CACHE_KEY) || "{}") || {}; } catch (e) { return {}; } }
  function writeCache(c) { try { global.localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch (e) { /* dolu: önemsiz */ } }

  // Davetiyedeki (kendi depomuzdaki) görsel adresleri. Paylaşım kapağı (meta.share) bilerek dışarıda:
  // WhatsApp/Instagram önizlemesi aslını kullanır.
  function collect(doc, prefix) {
    const out = new Set();
    (function walk(n, key) {
      if (key === "share" || key === "imgv") return;
      if (typeof n === "string") { if (n.startsWith(prefix) && RASTER.test(n) && !IS_VARIANT.test(n)) out.add(n); return; }
      if (Array.isArray(n)) { n.forEach(x => walk(x)); return; }
      if (n && typeof n === "object") Object.keys(n).forEach(k => walk(n[k], k));
    })(doc);
    return Array.from(out);
  }

  // Hareketli PNG (acTL) / WebP (ANIM) mi? Hareketliler kopyalanmaz (kopya duran görüntü olurdu).
  async function isAnimated(blob) {
    try {
      const head = new Uint8Array(await blob.slice(0, 256 * 1024).arrayBuffer());
      const txt = String.fromCharCode.apply(null, Array.from(head.subarray(0, Math.min(head.length, 65536))));
      if (blob.type === "image/png" || /^\x89PNG/.test(txt)) return txt.indexOf("acTL") >= 0;
      if (blob.type === "image/webp" || /^RIFF....WEBP/.test(txt)) return txt.indexOf("ANIM") >= 0;
    } catch (e) { return true; }
    return false;
  }

  async function encode(blob, w, h, quality) {
    let bmp = null;
    try { bmp = await createImageBitmap(blob, { resizeWidth: w, resizeHeight: h, resizeQuality: "high", premultiplyAlpha: "none" }); }
    catch (e) { bmp = null; }
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    const g = cv.getContext("2d");
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
    if (bmp) g.drawImage(bmp, 0, 0, w, h);
    else {   // createImageBitmap yeniden boyutlandırma desteklenmiyorsa: adım adım yarıya indirerek (yumuşak)
      const full = await createImageBitmap(blob);
      let src = full, sw = full.width, sh = full.height;
      while (sw / 2 >= w) {
        const t = document.createElement("canvas"); t.width = Math.round(sw / 2); t.height = Math.round(sh / 2);
        const tg = t.getContext("2d"); tg.imageSmoothingQuality = "high"; tg.drawImage(src, 0, 0, t.width, t.height);
        src = t; sw = t.width; sh = t.height;
      }
      g.drawImage(src, 0, 0, w, h);
    }
    return new Promise(res => cv.toBlob(b => res(b), "image/webp", quality));
  }

  /* doc: yayın kopyası (adresler yüklenmiş hâlde). ctx: { prefix, upload(path, blob) → url, blobFor(url) → Blob|null, progress(text) }
     Dönen: { "<asıl adres>": { w, v: [[genişlik, adres], ...] } } — boşsa {} */
  async function run(doc, ctx) {
    const out = {};
    if (typeof createImageBitmap !== "function") return out;
    const urls = collect(doc, ctx.prefix);
    const cache = readCache();
    let webpOk = true;
    for (let i = 0; i < urls.length && webpOk; i++) {
      const url = urls[i];
      if (cache[url]) { if (cache[url].v && cache[url].v.length) out[url] = cache[url]; continue; }
      ctx.progress && ctx.progress(`Görseller hızlandırılıyor (${i + 1}/${urls.length})...`);
      try {
        let blob = ctx.blobFor ? await ctx.blobFor(url) : null;
        if (!blob) { const r = await fetch(url, { mode: "cors" }); blob = r.ok ? await r.blob() : null; }
        if (!blob || blob.size < MIN_BYTES || await isAnimated(blob)) { cache[url] = { v: [] }; continue; }
        const full = await createImageBitmap(blob);
        const W = full.width, H = full.height;
        if (full.close) full.close();
        const widths = WIDTHS.filter(w => w < W * 0.95);
        if (W <= WIDTHS[WIDTHS.length - 1]) widths.push(W);   // asıl 1800 px'ten küçükse: tam boy WebP kopyası
        const path = decodeURIComponent(url.slice(ctx.prefix.length).split(/[?#]/)[0]);
        const v = [];
        for (const w of Array.from(new Set(widths))) {
          const h = Math.max(1, Math.round(H * w / W));
          const b = await encode(blob, w, h, blob.type === "image/jpeg" ? QUALITY_PHOTO : QUALITY_ART);
          if (!b || b.type !== "image/webp") { webpOk = false; break; }       // bu tarayıcı WebP üretemiyor
          if (b.size >= blob.size * 0.85) continue;                              // anlamlı kazanç yok
          const vurl = await ctx.upload(path.replace(/\.[a-z0-9]+$/i, "") + `__w${w}.webp`, b);
          if (vurl) v.push([w, vurl]);
        }
        if (!webpOk) break;
        cache[url] = { w: W, v };
        if (v.length) out[url] = cache[url];
      } catch (e) {
        if (global.console) console.warn("[Studio SEOZ] Görsel kopyası üretilemedi (aslı kullanılacak):", url, e);
      }
    }
    writeCache(cache);
    return out;
  }

  global.SeozImgOptimize = { run, collect, WIDTHS };
})(window);
