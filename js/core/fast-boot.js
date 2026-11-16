/* =============================================================================
   STUDIO SEOZ — core/fast-boot.js · HIZLI AÇILIŞ YARDIMCILARI
   -----------------------------------------------------------------------------
   1) SeozImgV — görselin "hızlı kopyası": Yayına alırken editör büyük görsellerin
      küçültülmüş WebP kopyalarını da yükler ve yayın kopyasına meta.imgv olarak
      yazar ( { "<asıl adres>": { w: <asıl genişlik>, v: [[828, adres], [1200, adres], ...] } } ).
      Davetiye, ekrana yetecek en küçük kopyayı kullanır; kopya yoksa ya da
      açılamazsa HER ZAMAN aslı kullanılır. Asıl dosyalar hiç değişmez/silinmez.
   2) Erken başlatma — kısa bağlantı sayfası (functions/[slug].js) davetiyeyi
      sayfanın içine gömdüğünde, açılış (zarf) görselleri sayfa kodları inmeden
      HEMEN, yüksek öncelikle indirilmeye başlanır. Aynı adres ve aynı istek
      türüyle istendiği için açılış motoru aynı dosyayı tekrar indirmez.
   Bu dosya hem davetiye sayfasında hem editörde yüklenir; tek başına çalışır,
   başka hiçbir dosyaya bağlı değildir. İki kez yüklenirse ikincisi hiçbir şey yapmaz.
   ========================================================================= */
(function (global) {
  "use strict";
  if (global.SeozImgV) return;

  const WIDTHS = [828, 1200, 1800];     // üretilen kopya genişlikleri (asıl bunlardan küçükse aslının genişliği)
  const MAX_CSS = 1000;                  // açılış ve sayfa görselleri ekranda en fazla bu kadar CSS pikseli kaplar
  const MAX_DPR = 2.5;                   // 3x ekranlarda bile 2,5x yeterli; fark gözle görülmez
  let MAP = null;

  function setDoc(doc) {
    const m = doc && doc.meta && doc.meta.imgv;
    MAP = m && typeof m === "object" && !Array.isArray(m) ? m : null;
  }
  // Yavaş bağlantı (Android'de tarayıcı bildirir: 2G/3G ya da veri tasarrufu): 2x yoğunluk yeterli
  function maxDpr() {
    const c = global.navigator && global.navigator.connection;
    return c && (c.saveData || /(^|-)2g$|^3g$/.test(String(c.effectiveType || ""))) ? 2 : MAX_DPR;
  }
  function need(cssW) {
    const vw = Math.max(320, Math.min(global.innerWidth || 390, MAX_CSS));
    const dpr = Math.min(Math.max(global.devicePixelRatio || 1, 1), maxDpr());
    return Math.ceil(Math.min(cssW || vw, MAX_CSS) * dpr);
  }
  function variants(url) {
    const e = MAP && typeof url === "string" ? MAP[url] : null;
    if (!e || !Array.isArray(e.v)) return null;
    const v = e.v.filter(x => Array.isArray(x) && x[0] > 0 && typeof x[1] === "string" && /^https:\/\//i.test(x[1])).sort((a, b) => a[0] - b[0]);
    return v.length ? { w: Number(e.w) || 0, v } : null;
  }
  /* Ekrana yetecek en küçük kopya; hiçbiri yetmiyorsa ve en büyüğü tam çözünürlükse o, değilse aslı. */
  function pick(url, cssW) {
    const e = variants(url);
    if (!e) return url;
    const n = need(cssW);
    for (const x of e.v) if (x[0] >= n) return x[1];
    const top = e.v[e.v.length - 1];
    return e.w && top[0] >= e.w * 0.98 ? top[1] : url;
  }
  /* <img>: önce hızlı kopya; açılamazsa (eski tarayıcı, eksik dosya) kendiliğinden aslına döner. */
  function apply(img, url, cssW) {
    if (!img || !url) { if (img) img.src = url || ""; return url; }
    const v = pick(url, cssW);
    if (v !== url) {
      const back = () => { img.removeEventListener("error", back); if (img.src !== url) img.src = url; };
      img.addEventListener("error", back);
    }
    img.src = v;
    return v;
  }

  /* ---------------- erken başlatma (yalnızca davetiye sayfası) ---------------- */
  const EARLY = [];
  const isImg = u => typeof u === "string" && /^https:\/\//i.test(u) && !/\.(mp4|webm|mov|m4v|glb|gltf|mp3|m4a|wav|ogg)(\?|#|$)/i.test(u);
  const crossOrigin = u => { try { return new URL(u, global.location.href).origin !== global.location.origin; } catch (e) { return false; } };
  // Açılış ekranının ilk anda gereken görselleri (açılış motorunun da bekleyeceği görseller)
  function entryImages(doc) {
    const e = (doc && doc.entry) || {}, out = [];
    if (e.type === "cinema" && e.cinema && Array.isArray(e.cinema.layers)) {
      e.cinema.layers.forEach(l => {
        if (!l || l.hidden || l.model || (l.media && l.media.type === "video")) return;
        [l.src, l.backSrc].forEach(u => { if (isImg(u)) out.push({ url: u, cors: crossOrigin(u) }); });
      });
    } else if (e.type === "card" || e.type === "png" || e.type === "dual-wing") {
      const media = { cardOnlySrc: e.cardOnlyMedia, pngSrc: e.pngMedia, cardSrc: e.cardMedia };
      (e.type === "card" ? ["cardOnlySrc"] : ["pngSrc", "cardSrc"]).forEach(k => {
        if (isImg(e[k]) && !(media[k] && media[k].type === "video")) out.push({ url: e[k], cors: false });
      });
    }
    const seen = new Set();
    return out.filter(x => !seen.has(x.url) && seen.add(x.url));
  }
  /* İndirmeyi başlatır. Açılış motoru (sinematik açılış) görseli CORS ile ister: aynı türde istenir ki
     tarayıcı ikinci kez indirmesin. Görseller bellekte tutulur (çöpe gitmesin). */
  function warm(list, priority) {
    list.forEach(x => {
      const url = pick(x.url);
      if (EARLY.some(e => e.src === url && e.cors === x.cors)) return;
      const im = new Image();
      if (x.cors) im.crossOrigin = "anonymous";
      try { im.fetchPriority = priority || "high"; } catch (e) { /* eski tarayıcı */ }
      im.decoding = "async";
      im.src = url;
      EARLY.push({ src: url, cors: x.cors, im });
    });
  }
  /* Sayfaya gömülü davetiye (functions/[slug].js): <script type="application/json" id="seoz-doc" data-slug="..."> */
  let INLINE = null;
  function inlineDoc(slug) {
    if (INLINE === null) {
      INLINE = false;
      try {
        const el = global.document && global.document.getElementById("seoz-doc");
        if (el && el.textContent) INLINE = { slug: el.getAttribute("data-slug") || "", doc: JSON.parse(el.textContent) };
      } catch (e) { INLINE = false; }
    }
    if (!INLINE || !INLINE.doc || (slug && INLINE.slug !== slug)) return null;
    return INLINE.doc;
  }
  // Davetiyenin kullandığı modül dosyaları da hemen indirilmeye başlar (çalıştırma sırası view-app.js'te).
  // Liste js/view-app.js → MODULES ile aynıdır; tanınmayan modül adında hiçbir şey önceden indirilmez.
  const MODULES = ["location", "music", "countdown", "rsvp", "gallery", "guest-upload", "celebration", "poll", "qrcode", "calendar", "feedback",
    "gift", "appointment", "social-media", "services", "price-list", "before-after", "attendance-form", "campaign", "hours", "interactive"];
  function preloadModules(doc, base) {
    let json = ""; try { json = JSON.stringify(doc); } catch (e) { return; }
    const ids = new Set(), re = /"moduleId":"([^"]+)"/g;
    let m; while ((m = re.exec(json))) ids.add(m[1]);
    for (const id of ids) if (MODULES.indexOf(id) < 0) return;
    const files = [];
    ids.forEach(id => { if (id === "countdown") return; if (id === "qrcode") files.push("js/core/qr-encoder.js"); files.push("js/modules/" + id + ".js"); });
    files.forEach(f => {
      const l = global.document.createElement("link");
      l.rel = "preload"; l.as = "script"; l.href = base + f;
      global.document.head.appendChild(l);
    });
  }
  function early() {
    const doc = inlineDoc();
    if (!doc) return;
    setDoc(doc);
    warm(entryImages(doc), "high");
    try { const el = global.document.getElementById("seoz-doc"); if (el && el.hasAttribute("data-base")) preloadModules(doc, el.getAttribute("data-base")); } catch (e) { /* önemsiz */ }
  }

  /* Aşağıdaki bölümler (galeri vb.): görseller bölüm ekrana yaklaşınca (≈ 400 px önce) yüklenir.
     lazy=false (editör) ya da tarayıcı desteklemiyorsa hemen yüklenir. */
  function gate(lazy) {
    const items = [];
    let open = !lazy || !("IntersectionObserver" in global);
    return {
      add(img, url, cssW) { if (!img || !url) return; if (open) apply(img, url, cssW); else items.push([img, url, cssW]); },
      watch(el) {
        if (open || !el) return;
        const io = new IntersectionObserver(es => {
          if (!es.some(e => e.isIntersecting)) return;
          io.disconnect(); open = true;
          items.splice(0).forEach(a => apply(a[0], a[1], a[2]));
        }, { rootMargin: "400px 0px 400px 0px" });
        io.observe(el);
      }
    };
  }

  global.SeozImgV = { WIDTHS, setDoc, pick, apply, need, variants, entryImages, warm, inlineDoc, isImg, gate };
  early();
})(window);
