/* =============================================================================
   STUDIO SEOZ — theme/theme-core.js  (İÇ ZEMİN TASARIM STÜDYOSU · çalışma motoru)
   -----------------------------------------------------------------------------
   Davetiyenin/işletme sayfasının KENDİSİNİ süsleyen katman. Editör de müşteri
   sayfası da aynı kodu çalıştırır (renderer.js çağırır).

   ALTIN KURAL: belgede `theme` alanı yoksa ve katmanlarda `reveal` / `present`
   alanları yoksa bu dosya HİÇBİR ŞEY çizmez — eski davetiyeler birebir aynı kalır.

   doc.theme = {
     v: 1, pack: "dugun-bahce" | null,
     palette: { paper, ink, accent, accent2 },          // tasarım dili (çerçeveler, sunum biçimleri)
     fonts:   { title, body }, radius: 14,
     bg: {
       base:     null | { type: "gradient", from, to, angle } | { type: "radial", inner, outer },
       sections: [{ y, color }],                         // bölüm zeminleri: sayfa kaydıkça zemin değişir
       layers:   [{ id, art | src, color, color2, x, y, w, h, depth, motion, speed, opacity, flip, rotate, front }],
       particles:{ type, density, colors, seconds },     // seconds: 0 = sürekli, >0 = o kadar sonra hafifler
       light:    { type, strength }
     }
   }
   Katman alanları (hepsi isteğe bağlı):
     layer.reveal  = { type: "yukari|yakinlas|soldan|sagdan|ciz|sol", delay, duration }  → kaydırınca canlan
     layer.present = { frame, special, open }  → sunum biçimi (bkz. theme-present.js)
   ========================================================================= */
(function (global) {
  "use strict";

  const reduced = () => !!(global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const weak = () => { const n = global.navigator || {}; return (n.deviceMemory && n.deviceMemory <= 2) || (n.hardwareConcurrency && n.hardwareConcurrency <= 2); };
  function el(tag, cls, css) { const e = document.createElement(tag); if (cls) e.className = cls; if (css) Object.assign(e.style, css); return e; }
  function num(v, d) { v = Number(v); return isFinite(v) ? v : d; }
  // Hazırlık (K1): sinematik açılış ekranı hâlâ üstteyse (müşteri sayfası), canlı hareketler
  // açılış tamamen kalkınca başlar; böylece ilk saniyeler açılışın arkasında kaybolmaz.
  function afterEntry(mode, st, fn) {
    if (mode !== "view" || !global.__seozEntryActive) return fn();
    const go = () => { global.removeEventListener("seoz:entry-end", go); if (!st.dead) fn(); };
    global.addEventListener("seoz:entry-end", go);
    st.cleanups.push(() => global.removeEventListener("seoz:entry-end", go));
  }

  const MOTIONS = [["none", "Hareketsiz"], ["salinim", "Salınım (dal gibi)"], ["suzulme", "Süzülme"], ["donme", "Yavaş dönme"], ["nefes", "Nefes alma"], ["kayma", "Yatay kayma"], ["parilti", "Parıldama"]];
  const PARTICLES = [["none", "Yok"], ["kar", "Kar"], ["yaprak", "Çiçek yaprağı"], ["konfeti", "Konfeti"], ["atesbocegi", "Ateş böceği"], ["yildiz", "Yıldız"], ["balon", "Balon"], ["kalp", "Kalp"], ["parilti", "Altın parıltı"]];
  const LIGHTS = [["none", "Yok"], ["vinyet", "Kenar gölgesi"], ["gunes", "Üstten güneş ışığı"], ["altin", "Sıcak altın ışık"], ["kagit", "Kâğıt dokusu"], ["keten", "Keten dokusu"], ["neon", "Neon parlaması"]];
  const REVEALS = [["", "Yok"], ["yukari", "Yukarı kayarak belirme"], ["yakinlas", "Yakınlaşarak belirme"], ["soldan", "Soldan gelme"], ["sagdan", "Sağdan gelme"], ["ciz", "Çizilerek oluşma"], ["sol", "Yalnızca belirme"]];

  /* =============================== tasarım dili =============================== */
  function applyLanguage(canvasEl, th) {
    const p = th.palette || {}, f = th.fonts || {};
    const set = (k, v) => { if (v != null && v !== "") canvasEl.style.setProperty(k, v); };
    set("--th-paper", p.paper); set("--th-ink", p.ink); set("--th-accent", p.accent); set("--th-accent2", p.accent2);
    if (f.title) set("--th-title", `"${f.title}", serif`);
    if (f.body) set("--th-body", `"${f.body}", sans-serif`);
    if (th.radius != null) set("--th-radius", num(th.radius, 14) + "px");
    canvasEl.classList.add("th-on");
    canvasEl.classList.toggle("th-dark", !!th.dark);
  }

  /* =============================== zemin =============================== */
  function artURL(id, c1, c2) {
    const A = global.SeozThemeArt; if (!A) return "";
    const s = A.art(id, c1, c2); if (!s) return "";
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s);
  }
  /* =============================== İÇ ZEMİN 3D ===============================
     Yalnızca 3D özelliği kullanılan zeminlerde kurulur (bkz. use3d); diğer zeminler eski yoldan,
     birebir aynı çizilir. Ayrı bir animasyon motoru YOKTUR:
       - katmanın 3D duruşu  → 3D-1'in hesabı (SeozCinema.poseOf)
       - hareketler ve sıra  → A2'nin hareketleri ve sıralayıcısı (SeozCinemaFree.move / schedule)
     Yapı:  kök (perspektif) → kamera → katman (kaydırma derinliği) → duruş (X/Y/Z, ölçek)
            → taşıyıcı (süzülme, belirme) → hareket (Serbest 3D, yakınlaşma) → CSS hareketi → görsel
     bg.scene = { persp, camera: { type, strength, duration } }
     katman: d3, rx, ry, rz, persp, z, scale, shadow (0–1), kind:"fog" (sis katmanı)
     bg.actions = A2 hareket listesi (layer, move, start: with|after|at|view, delay, duration, speed, easing, repeat, params) */
  const BG_MOVES = ["free3d", "float", "shake", "zoom", "sheen"];
  const CAMERAS = [["none", "Yok"], ["yaklas", "Açılışta yaklaşma"], ["uzaklas", "Açılışta uzaklaşma (geri çekilme)"], ["kaydir-yaklas", "Kaydırdıkça yaklaşma"], ["kaydir-uzaklas", "Kaydırdıkça uzaklaşma"]];
  function use3d(bg) {
    if (!bg) return false;
    if (bg.scene && (bg.scene.camera && bg.scene.camera.type && bg.scene.camera.type !== "none" || num(bg.scene.persp, 0) > 0)) return true;
    if (Array.isArray(bg.actions) && bg.actions.length) return true;
    return (Array.isArray(bg.layers) ? bg.layers : []).some(L => L && (L.d3 || num(L.z, 0) || (L.scale != null && num(L.scale, 1) !== 1) || num(L.shadow, 0) > 0 || L.kind === "fog"));
  }
  function poseCSS(L) {
    const C = global.SeozCinema, parts = [];
    const z = Math.max(-1200, Math.min(800, num(L.z, 0))), sc = Math.max(0.1, Math.min(6, num(L.scale, 1)));
    if (z) parts.push(`translateZ(${z}px)`);
    const p = C && C.poseOf ? C.poseOf(L) : "";
    if (p) parts.push(p);
    if (sc !== 1) parts.push(`scale(${sc})`);
    return parts.join(" ");
  }
  function buildFog(L) {
    const outer = el("div", "th-bl th-bl3 th-fog", {
      left: num(L.x, -40) + "px", top: num(L.y, 0) + "px", width: num(L.w, 510) + "px", height: num(L.h, 260) + "px"
    });
    const fogOp = Math.max(0, Math.min(1, num(L.opacity, 0.55)));
    outer.dataset.depth = String(Math.max(0, Math.min(1, num(L.depth, 0))));
    const pose = el("div", "th-pose"); const pc = poseCSS(L); if (pc) pose.style.transform = pc;
    const col = L.color || "#FFFFFF";
    const sp = (40 / Math.max(0.2, num(L.speed, 1))).toFixed(1) + "s";
    // tek bant, iki yumuşak bulut: ekranı az kaplar, bulanıklık filtresi yoktur (kaydırmayı yavaşlatmaz)
    const band = el("div", "th-fog-band", { opacity: fogOp.toFixed(2),
      background: `radial-gradient(42% 55% at 30% 55%, ${col}, transparent 72%), radial-gradient(38% 48% at 72% 45%, ${col}, transparent 72%)` });
    band.style.setProperty("--th-fog-sp", sp);
    pose.appendChild(band);
    outer.appendChild(pose);
    return outer;
  }
  function buildBgLayer(L, mode, three, opt) {
    if (three) return buildBgLayer3(L, mode, opt || {});
    const outer = el("div", "th-bl" + (L.front ? " th-bl-front" : ""), {
      left: num(L.x, 0) + "px", top: num(L.y, 0) + "px", width: num(L.w, 120) + "px", height: num(L.h, 120) + "px",
      opacity: String(Math.max(0, Math.min(1, num(L.opacity, 1))))
    });
    outer.dataset.depth = String(Math.max(0, Math.min(1, num(L.depth, 0))));
    const mid = el("div", "th-bl-m" + (L.motion && L.motion !== "none" ? " th-m-" + L.motion : ""));
    mid.style.setProperty("--th-sp", (8 / Math.max(0.2, num(L.speed, 1))).toFixed(2) + "s");
    if (L.motion === "salinim" || L.motion === "donme") mid.style.transformOrigin = L.origin || (L.motion === "salinim" ? "0% 100%" : "50% 50%");
    const img = el("img", "th-bl-img", { transform: `${L.flip ? "scaleX(-1) " : ""}rotate(${num(L.rotate, 0)}deg)` });
    img.alt = ""; img.draggable = false;
    if (L.art) img.src = artURL(L.art, L.color, L.color2);
    else if (L.src) {
      img.loading = "lazy"; img.decoding = "async";      // sayfanın altındaki zemin görselleri ekrana yaklaşınca yüklenir
      img.dataset.srcRef = L.src;
      if (global.SeozBlobStore) SeozBlobStore.resolveToObjectURL(L.src).then(u => { if (u) img.src = u; });
      else img.src = L.src;
    }
    mid.appendChild(img); outer.appendChild(mid);
    return outer;
  }
  function buildBgLayer3(L, mode, opt) {
    const needLit = !!opt.lit, hasAct = !!opt.act;
    if (L.kind === "fog") return buildFog(L);
    const outer = el("div", "th-bl th-bl3" + (L.front ? " th-bl-front" : ""), {
      left: num(L.x, 0) + "px", top: num(L.y, 0) + "px", width: num(L.w, 120) + "px", height: num(L.h, 120) + "px"
    });
    const op = Math.max(0, Math.min(1, num(L.opacity, 1)));
    outer.dataset.depth = String(Math.max(0, Math.min(1, num(L.depth, 0))));
    outer.dataset.bl = L.id || "";
    // yalnızca gereken kutular kurulur: hareketi olmayan katmanda taşıyıcı/hareket kutusu, CSS hareketi
    // olmayan katmanda hareket sarmalı yoktur (her kutu tarayıcıya ayrı bir katman yükü getiriyordu)
    const pose = el("div", "th-pose"), carry = hasAct ? el("div", "th-carry") : null, anim = hasAct ? el("div", "th-anim") : null;
    const pc = poseCSS(L); if (pc) pose.style.transform = pc;
    const moving = L.motion && L.motion !== "none";
    const mid = moving ? el("div", "th-bl-m th-m-" + L.motion) : null;
    if (mid) {
      mid.style.setProperty("--th-sp", (8 / Math.max(0.2, num(L.speed, 1))).toFixed(2) + "s");
      if (L.motion === "salinim" || L.motion === "donme") mid.style.transformOrigin = L.origin || (L.motion === "salinim" ? "0% 100%" : "50% 50%");
    }
    const img = el("img", "th-bl-img");
    if (L.flip || num(L.rotate, 0)) img.style.transform = `${L.flip ? "scaleX(-1) " : ""}rotate(${num(L.rotate, 0)}deg)`;
    img.alt = ""; img.draggable = false;
    if (op < 1) img.style.opacity = String(op);
    // görselin arkası uydurulmaz: katman arkasını döndüğünde görünmez
    img.style.backfaceVisibility = "hidden"; img.style.webkitBackfaceVisibility = "hidden";
    const setSrc = (im, after) => {
      if (L.art) { im.src = artURL(L.art, L.color, L.color2); if (after) after(im.src); }
      else if (L.src) {
        im.loading = "lazy"; im.decoding = "async"; im.dataset.srcRef = L.src;
        if (global.SeozBlobStore) SeozBlobStore.resolveToObjectURL(L.src).then(u => { if (u) { im.src = u; if (after) after(u); } });
        else { im.src = L.src; if (after) after(L.src); }
      }
    };
    // yumuşak gölge: görselin kendi şekli, BİR KEZ küçük bir tuvale bulanık çizilir; tarayıcı her karede
    // bulanıklık hesaplamaz (canlı CSS bulanıklığı kaydırmayı yavaşlatıyordu)
    const shs = Math.max(0, Math.min(1, num(L.shadow, 0)));
    let sh = null;
    if (shs > 0) {
      sh = el("canvas", "th-shadow", { opacity: ((0.25 + 0.5 * shs) * op).toFixed(2), transform: `translate3d(${Math.round(6 + 10 * shs)}px, ${Math.round(10 + 16 * shs)}px, -8px) ${L.flip ? "scaleX(-1) " : ""}rotate(${num(L.rotate, 0)}deg)` });
      pose.appendChild(sh);
    }
    // ışık yansıması katmanı yalnızca o katmana "Metalik ışık" hareketi verildiyse kurulur
    let lit = null, bar = null;
    if (needLit) { lit = el("div", "th-lit"); bar = el("div", "th-lit-bar"); lit.appendChild(bar); }
    setSrc(img, url => {
      if (lit) { const m = `url("${url}")`; Object.assign(lit.style, { WebkitMaskImage: m, maskImage: m }); }
      if (sh) softShadow(sh, url, num(L.w, 120), num(L.h, 120));
    });
    const body = mid || img; if (mid) mid.appendChild(img);
    const host = anim || pose;
    host.appendChild(body); if (lit) host.appendChild(lit);
    if (anim) { carry.appendChild(anim); pose.appendChild(carry); }
    outer.appendChild(pose);
    outer.__th = { L: anim, C: carry, lit: lit ? { bar, k: 1 } : null };
    return outer;
  }
  // görselin siluetini düşük çözünürlüklü tuvale çizer; CSS büyütmesi kenarları kendiliğinden yumuşatır
  function softShadow(cv, url, w, h) {
    const im = new Image();
    im.decoding = "async";
    im.onload = () => {
      const q = 4, W = Math.max(8, Math.round(w / q)), H = Math.max(8, Math.round(h / q)), pad = 3;
      cv.width = W + pad * 2; cv.height = H + pad * 2;
      Object.assign(cv.style, { left: -(pad * q) + "px", top: -(pad * q) + "px", width: `calc(100% + ${pad * q * 2}px)`, height: `calc(100% + ${pad * q * 2}px)` });
      const iw = im.naturalWidth || W, ih = im.naturalHeight || H, s = Math.min(W / iw, H / ih);
      const dw = iw * s, dh = ih * s, c = cv.getContext("2d");
      if (!c) return;
      try {
        if ("filter" in c) c.filter = "blur(2px)";
        c.drawImage(im, pad + (W - dw) / 2, pad + (H - dh) / 2, dw, dh);
        c.filter = "none"; c.globalCompositeOperation = "source-in"; c.fillStyle = "#000"; c.fillRect(0, 0, cv.width, cv.height);
      } catch (e) { cv.remove(); }
    };
    im.onerror = () => cv.remove();
    im.src = url;
  }
  /* İç Zemin hareketleri: A2'nin hareketleri ve sıralayıcısı, zemine bağlanan küçük bir bağlamla çalışır */
  function bgMoves(st, bg, nodes, mode) {
    const F = global.SeozCinemaFree;
    const acts = (Array.isArray(bg.actions) ? bg.actions : []).filter(a => a && BG_MOVES.includes(a.move) && nodes[a.layer] && nodes[a.layer].__th && nodes[a.layer].__th.L);
    if (!F || !acts.length || mode !== "view" || reduced()) return;
    const anims = [];
    const ctx = { L: {}, C: {}, S: {}, box: {}, lit: {}, cfg: { layers: {}, depth: 1, actions: [] }, k: 1, lite: weak(), dead: false,
      anim(elm, kf, o) {
        if (!elm || ctx.dead) return null; o = o || {};
        const a = elm.animate(kf, { duration: o.d || 600, delay: o.delay || 0, easing: o.e || "cubic-bezier(.16,1,.3,1)", fill: o.fill || "both", iterations: o.it || 1, direction: o.dir || "normal", composite: o.comp || "replace" });
        anims.push(a); return a;
      },
      later(ms, fn) { const t = setTimeout(() => { if (!ctx.dead) fn(); }, Math.max(0, ms)); st.cleanups.push(() => clearTimeout(t)); },
      sfx() {}, Z: n => n, scale: () => 1, shade() { return null; },
      sheen(id, o) {
        const l = ctx.lit[id]; if (!l) return null;
        return ctx.anim(l.bar, [{ transform: "translateX(-130%) skewX(-16deg)", opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.8 }, { transform: "translateX(330%) skewX(-16deg)", opacity: 0 }], Object.assign({ d: 1500, e: "cubic-bezier(.65,0,.35,1)" }, o || {}));
      }
    };
    Object.keys(nodes).forEach(id => { const n = nodes[id].__th; if (!n || !n.L) return; ctx.L[id] = n.L; ctx.C[id] = n.C; if (n.lit) ctx.lit[id] = n.lit; });
    st.cleanups.push(() => { ctx.dead = true; anims.forEach(a => { try { a.cancel(); } catch (e) { /* önemsiz */ } }); });
    // "Göründüğünde" ile başlayan hareket yeni bir bölüm açar: o katman ekrana gelince bölüm oynar
    const parts = [];
    acts.forEach((a, i) => { if (i === 0 || a.start === "view") parts.push([]); parts[parts.length - 1].push(a); });
    const runPart = list => {
      const sp = F.schedule(list.map((a, i) => i === 0 ? Object.assign({}, a, { start: "with" }) : a));
      sp.items.forEach(it => { try { it.def.run(ctx, it.a, it.def, it.begin); } catch (e) { console.error("[Studio SEOZ] Zemin hareketi:", it.a.move, e); } });
    };
    parts.forEach((list, i) => {
      if (i === 0 && list[0].start !== "view") return runPart(list);
      const target = nodes[list[0].layer];
      if (!global.IntersectionObserver || !target) return runPart(list);
      const io = new IntersectionObserver(ents => { if (ents.some(e => e.isIntersecting)) { io.disconnect(); runPart(list); } }, { threshold: 0.2 });
      io.observe(target); st.cleanups.push(() => io.disconnect());
    });
  }
  function sectionGradient(sections) {
    const s = sections.filter(x => x && x.color).slice().sort((a, b) => num(a.y, 0) - num(b.y, 0));
    if (!s.length) return "";
    if (s.length === 1) return s[0].color;
    const stops = [];
    s.forEach((x, i) => {
      const y = Math.max(0, num(x.y, 0)), blend = 140;
      if (i === 0) stops.push(`${x.color} 0px`);
      else stops.push(`${s[i - 1].color} ${Math.max(0, y - blend)}px`, `${x.color} ${y + blend}px`);
    });
    return `linear-gradient(180deg, ${stops.join(", ")})`;
  }
  const NOISE = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .55 0"/></filter><rect width="160" height="160" filter="url(#n)"/></svg>`);
  const LINEN = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><path d="M0 0H8M0 4H8" stroke="#000" stroke-opacity=".06"/><path d="M0 0V8M4 0V8" stroke="#000" stroke-opacity=".04"/></svg>`);
  function lightCSS(L, accent) {
    const s = Math.max(0, Math.min(1, num(L.strength, 0.5)));
    switch (L.type) {
      case "vinyet": return { boxShadow: `inset 0 0 ${80 + 120 * s}px rgba(0,0,0,${(0.18 + 0.35 * s).toFixed(2)})` };
      case "gunes": return { background: `radial-gradient(120% 60% at 30% 0%, rgba(255,246,220,${(0.35 + 0.5 * s).toFixed(2)}), rgba(255,246,220,0) 60%)` };
      case "altin": return { background: `radial-gradient(90% 40% at 50% 0%, rgba(240,200,120,${(0.25 + 0.45 * s).toFixed(2)}), transparent 70%), radial-gradient(90% 40% at 50% 100%, rgba(240,200,120,${(0.15 + 0.3 * s).toFixed(2)}), transparent 70%)` };
      case "kagit": return { backgroundImage: `url("${NOISE}")`, opacity: String(0.25 + 0.6 * s), mixBlendMode: "multiply" };
      case "keten": return { backgroundImage: `url("${LINEN}")`, opacity: String(0.5 + 0.5 * s) };
      case "neon": return { boxShadow: `inset 0 0 ${40 + 60 * s}px ${accent || "#FF3DBE"}`, opacity: String(0.35 + 0.5 * s) };
      default: return null;
    }
  }

  /* =============================== parçacıklar =============================== */
  /* Sayfanın tamamını değil yalnızca GÖRÜNEN kısmını kaplayan küçük bir tuval:
     kaydırdıkça tuval görünen bölgeye taşınır. Böylece uzun sayfada bile iş yükü
     sabittir. Katmanların ARKASINDA kalır (yazıların üstüne binmez). */
  const PCOL = {
    kar: ["#FFFFFF", "#EAF2FF"], yaprak: ["#F6C3CF", "#F9DCE3", "#FFFFFF"], konfeti: ["#E94F6B", "#F7C548", "#4FB0E9", "#7BD389", "#FFFFFF"],
    atesbocegi: ["rgba(240,255,150,1)", "rgba(255,236,150,1)"], yildiz: ["#FFFFFF", "#FFF1C4"], balon: ["#F49AB0", "#9FD3F5", "#F7D774", "#B5E3B5"],
    kalp: ["#F06A8A", "#F7A3B8", "#E2335C"], parilti: ["#F3D27A", "#FFF1C4", "#C9A45C"]
  };
  /* env: ayrı çalışanda (worker) çalışırken ekran yoğunluğu, kare zamanlayıcısı ve sekme durumu buradan gelir;
     ana sayfada verilmez ve eskisi gibi davranır */
  function Particles(canvas, cfg, env) {
    env = env || {};
    const ctx = canvas.getContext("2d");
    const RAF = env.raf || (f => requestAnimationFrame(f)), CAF = env.caf || (id => cancelAnimationFrame(id)), hidden = env.hidden || (() => document.hidden);
    const type = cfg.type, cols = (cfg.colors && cfg.colors.length ? cfg.colors : PCOL[type]) || ["#fff"];
    let W = 430, H = 700, dpr = env.dpr || Math.min(2, global.devicePixelRatio || 1), list = [], fade = 1, raf = 0, last = 0, dead = false, paused = false, sized = false;
    const base = { kar: 40, yaprak: 22, konfeti: 34, atesbocegi: 22, yildiz: 36, balon: 9, kalp: 14, parilti: 30 }[type] || 20;
    const N = Math.max(3, Math.round(base * Math.max(0.2, Math.min(2.5, num(cfg.density, 1))) * ((env.weak != null ? env.weak : weak()) ? 0.4 : 1)));
    const R = Math.random;
    function spawn(p, fresh) {
      p.x = R() * W; p.y = fresh ? R() * H : (type === "balon" || type === "kalp" ? H + 30 : -20);
      p.c = cols[(R() * cols.length) | 0]; p.r = R(); p.a = R() * Math.PI * 2; p.t = R() * 100;
      const sp = { kar: 22, yaprak: 30, konfeti: 55, atesbocegi: 8, yildiz: 0, balon: -26, kalp: -22, parilti: 0 }[type] || 20;
      p.vy = sp * (0.6 + R() * 0.8); p.vx = (R() - 0.5) * (type === "atesbocegi" ? 16 : 10);
      p.s = { kar: 1.5 + R() * 2.5, yaprak: 5 + R() * 5, konfeti: 4 + R() * 4, atesbocegi: 1.5 + R() * 1.5, yildiz: 1 + R() * 2.2, balon: 10 + R() * 8, kalp: 5 + R() * 5, parilti: 1.5 + R() * 3 }[type] || 3;
      return p;
    }
    function resize(w, h) {
      if (sized && Math.abs(w - W) < 1 && Math.abs(h - H) < 1) return;
      sized = true;
      W = w; H = h; canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      if (!list.length) list = Array.from({ length: N }, () => spawn({}, true));
      else list.forEach(p => { if (p.y > H + 40) p.y = R() * H; });
    }
    function heart(x, y, s) { ctx.beginPath(); ctx.moveTo(x, y + s * 0.35); ctx.bezierCurveTo(x - s, y - s * 0.4, x - s * 0.4, y - s * 1.1, x, y - s * 0.45); ctx.bezierCurveTo(x + s * 0.4, y - s * 1.1, x + s, y - s * 0.4, x, y + s * 0.35); ctx.fill(); }
    function star4(x, y, s) { ctx.beginPath(); ctx.moveTo(x, y - s * 2); ctx.quadraticCurveTo(x, y, x + s * 2, y); ctx.quadraticCurveTo(x, y, x, y + s * 2); ctx.quadraticCurveTo(x, y, x - s * 2, y); ctx.quadraticCurveTo(x, y, x, y - s * 2); ctx.fill(); }
    function frame(now) {
      if (dead) return;
      raf = RAF(frame);
      if (paused || hidden()) { last = now; return; }
      const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
      if (cfg.seconds > 0) { cfg.__t = (cfg.__t || 0) + dt; if (cfg.__t > cfg.seconds) fade = Math.max(0.25, fade - dt * 0.25); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      for (const p of list) {
        p.t += dt;
        if (type === "yildiz" || type === "parilti") {
          const tw = 0.35 + 0.65 * Math.abs(Math.sin(p.t * (0.8 + p.r)));
          ctx.globalAlpha = tw * fade; ctx.fillStyle = p.c; star4(p.x, p.y, p.s); continue;
        }
        if (type === "atesbocegi") {
          p.x += (Math.sin(p.t * 0.7 + p.a) * 14 + p.vx) * dt; p.y += (Math.cos(p.t * 0.5 + p.a) * 10) * dt;
          if (p.x < -10) p.x = W + 10; if (p.x > W + 10) p.x = -10; if (p.y < -10) p.y = H + 10; if (p.y > H + 10) p.y = -10;
          const g = 0.3 + 0.7 * Math.abs(Math.sin(p.t * 1.6 + p.a));
          ctx.globalAlpha = g * fade; ctx.fillStyle = p.c; ctx.shadowColor = p.c; ctx.shadowBlur = 8;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 6.283); ctx.fill(); ctx.shadowBlur = 0; continue;
        }
        p.y += p.vy * dt; p.x += (p.vx + Math.sin(p.t * 1.2 + p.a) * (type === "kar" ? 8 : 14)) * dt; p.a += dt * (type === "konfeti" ? 4 : 1.2);
        const off = type === "balon" || type === "kalp" ? p.y < -40 : p.y > H + 30;
        if (off) spawn(p, false);
        ctx.globalAlpha = (type === "kar" ? 0.85 : 0.9) * fade; ctx.fillStyle = p.c;
        if (type === "kar") { ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 6.283); ctx.fill(); }
        else if (type === "kalp") heart(p.x, p.y, p.s);
        else if (type === "balon") {
          ctx.beginPath(); ctx.ellipse(p.x, p.y, p.s * 0.8, p.s, 0, 0, 6.283); ctx.fill();
          ctx.globalAlpha *= 0.5; ctx.strokeStyle = p.c; ctx.beginPath(); ctx.moveTo(p.x, p.y + p.s); ctx.quadraticCurveTo(p.x + 4, p.y + p.s * 2, p.x, p.y + p.s * 3); ctx.stroke();
        } else {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
          if (type === "yaprak") { ctx.beginPath(); ctx.ellipse(0, 0, p.s, p.s * 0.55, 0, 0, 6.283); ctx.fill(); }
          else { ctx.scale(1, Math.abs(Math.cos(p.a * 1.3)) + 0.2); ctx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * 0.66); }
          ctx.restore();
        }
      }
      ctx.globalAlpha = 1;
    }
    raf = RAF(frame);
    // hafif mod: tuval çözünürlüğü düşürülür (parçacıkların sayısı, rengi ve hareketi aynı kalır)
    function quality(d) { if (!d || d === dpr) return; dpr = d; if (sized) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); } }
    return { resize, quality, destroy() { dead = true; CAF(raf); }, pause() { paused = true; }, resume() { paused = false; }, count: () => list.length };
  }
  /* Parçacıklar ayrı bir çalışanda (OffscreenCanvas): aynı Particles kodu, ana iş parçacığının dışında çizer.
     Kaydırma ve 3D hareketler parçacık çiziminden etkilenmez; görünüm birebir aynıdır.
     Desteklenmeyen tarayıcıda null döner ve sayfa eski yoldan (ana iş parçacığında) çizer. */
  let pWorkerURL = null;
  function particleWorkerURL() {
    if (pWorkerURL) return pWorkerURL;
    const src = `"use strict";
const global = self; const PCOL = ${JSON.stringify(PCOL)};
${num.toString()}
function weak() { return false; }
${Particles.toString()}
let P = null, hid = false;
onmessage = e => { const m = e.data;
  if (m.t === "init") {
    const raf = self.requestAnimationFrame ? f => self.requestAnimationFrame(f) : f => setTimeout(() => f(performance.now()), 16);
    const caf = self.cancelAnimationFrame ? id => self.cancelAnimationFrame(id) : id => clearTimeout(id);
    P = Particles(m.canvas, m.cfg, { dpr: m.dpr, weak: m.weak, raf, caf, hidden: () => hid });
  } else if (!P) return;
  else if (m.t === "resize") P.resize(m.w, m.h);
  else if (m.t === "pause") P.pause();
  else if (m.t === "resume") P.resume();
  else if (m.t === "quality") P.quality(m.d);
  else if (m.t === "hidden") hid = m.v;
  else if (m.t === "destroy") { P.destroy(); P = null; close(); }
};`;
    pWorkerURL = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
    return pWorkerURL;
  }
  function ParticlesOff(canvas, cfg) {
    if (!canvas.transferControlToOffscreen || !global.Worker || !global.OffscreenCanvas || !global.Blob || !global.URL) return null;
    let w;
    try { w = new Worker(particleWorkerURL()); } catch (e) { return null; }
    try {
      const off = canvas.transferControlToOffscreen();
      w.postMessage({ t: "init", canvas: off, cfg: JSON.parse(JSON.stringify(cfg)), dpr: Math.min(2, global.devicePixelRatio || 1), weak: !!weak() }, [off]);
    } catch (e) { w.terminate(); return null; }
    const type = cfg.type, base = { kar: 40, yaprak: 22, konfeti: 34, atesbocegi: 22, yildiz: 36, balon: 9, kalp: 14, parilti: 30 }[type] || 20;
    const N = Math.max(3, Math.round(base * Math.max(0.2, Math.min(2.5, num(cfg.density, 1))) * (weak() ? 0.4 : 1)));
    const onVis = () => { if (!main) w.postMessage({ t: "hidden", v: !!document.hidden }); };
    let lw = -1, lh = -1, pz = null, q = 0, dead = false, main = null;
    const send = m => { if (!dead && !main) w.postMessage(m); };
    // güvenlik ağı: çalışan açılamazsa (ör. sitenin güvenlik ayarı) tuval yenilenir ve eski yoldan çizilir
    const fallback = () => {
      if (dead || main) return;
      try { w.terminate(); } catch (e) { /* önemsiz */ }
      document.removeEventListener("visibilitychange", onVis);
      const fresh = canvas.cloneNode(false);
      if (canvas.parentNode) canvas.parentNode.replaceChild(fresh, canvas);
      api.el = fresh;
      main = Particles(fresh, cfg);
      if (lw > 0) main.resize(lw, lh);
      if (q) main.quality(q);
      if (pz) main.pause();
      api.off = false;
    };
    w.addEventListener("error", e => { if (e && e.preventDefault) e.preventDefault(); fallback(); });
    document.addEventListener("visibilitychange", onVis); onVis();
    const api = {
      off: true, el: canvas,
      resize(wd, h) { if (Math.abs(wd - lw) < 1 && Math.abs(h - lh) < 1) return; lw = wd; lh = h; if (main) main.resize(wd, h); else send({ t: "resize", w: wd, h }); },
      quality(d) { q = d; if (main) main.quality(d); else send({ t: "quality", d }); },
      pause() { if (pz !== true) { pz = true; if (main) main.pause(); else send({ t: "pause" }); } },
      resume() { if (pz !== false) { pz = false; if (main) main.resume(); else send({ t: "resume" }); } },
      destroy() {
        if (dead) return;
        if (main) main.destroy(); else { send({ t: "destroy" }); setTimeout(() => { try { w.terminate(); } catch (e) { /* önemsiz */ } }, 100); }
        dead = true; document.removeEventListener("visibilitychange", onVis);
      },
      count: () => main ? main.count() : N
    };
    return api;
  }


  /* =============================== belge uygulama =============================== */
  function teardown(canvasEl) {
    const st = canvasEl && canvasEl.__seozTheme;
    if (st) { try { st.destroy(); } catch (e) { /* önemsiz */ } canvasEl.__seozTheme = null; }
    if (canvasEl) {
      ["--th-paper", "--th-ink", "--th-accent", "--th-accent2", "--th-title", "--th-body", "--th-radius"].forEach(k => canvasEl.style.removeProperty(k));
      canvasEl.classList.remove("th-on", "th-dark");
    }
  }

  function applyDocument(doc, canvasEl, mode) {
    teardown(canvasEl);
    const th = doc && doc.theme;
    const revealEls = Array.from(canvasEl.querySelectorAll(".th-rv"));
    const st = { cleanups: [] };
    st.destroy = () => st.cleanups.splice(0).forEach(f => { try { f(); } catch (e) { /* önemsiz */ } });
    canvasEl.__seozTheme = st;

    if (th && typeof th === "object") {
      applyLanguage(canvasEl, th);
      const bg = th.bg || {};
      const root = el("div", "th-root"); root.setAttribute("data-theme-root", ""); root.setAttribute("aria-hidden", "true");
      const front = el("div", "th-root th-root-front"); front.setAttribute("data-theme-root", ""); front.setAttribute("aria-hidden", "true");
      if (bg.base && bg.base.type === "gradient") root.appendChild(el("div", "th-fill", { background: `linear-gradient(${num(bg.base.angle, 180)}deg, ${bg.base.from || "#fff"}, ${bg.base.to || "#eee"})` }));
      else if (bg.base && bg.base.type === "radial") root.appendChild(el("div", "th-fill", { background: `radial-gradient(120% 80% at 50% 20%, ${bg.base.inner || "#fff"}, ${bg.base.outer || "#ddd"})` }));
      if (Array.isArray(bg.sections) && bg.sections.length) { const g = sectionGradient(bg.sections); if (g) root.appendChild(el("div", "th-fill th-sections", { background: g })); }
      const three = use3d(bg);
      let cam = null, camF = null, stage = null, stageF = null;
      if (three) {
        // perspektifli sahne: kamera kökün içinde; perspektifin bakış noktası kaydırmayla ekranın ortasında tutulur
        const P = Math.max(300, Math.min(4000, num(bg.scene && bg.scene.persp, 0) || 1200));
        // perspektif boyanmayan ayrı bir sahne kutusunda: kökün zemin boyası 3D katmanına taşınmaz
        // (aksi hâlde sayfa boyu zemin her karede ikinci kez çiziliyordu)
        stage = el("div", "th-stage"); stageF = el("div", "th-stage");
        [stage, stageF].forEach(x => { x.style.perspective = P + "px"; });
        [root, front].forEach(r => r.classList.add("th-3d"));
        cam = el("div", "th-cam"); camF = el("div", "th-cam");
        stage.appendChild(cam); stageF.appendChild(camF);
        root.appendChild(stage); front.appendChild(stageF);
      }
      const nodes = {};
      const bgActs = (Array.isArray(bg.actions) ? bg.actions : []).filter(a => a && BG_MOVES.includes(a.move));
      const litIds = new Set(bgActs.filter(a => a.move === "sheen").map(a => a.layer)), actIds = new Set(bgActs.map(a => a.layer));
      const bls = (Array.isArray(bg.layers) ? bg.layers : []).map(L => { const n = buildBgLayer(L, mode, three, { lit: litIds.has(L.id), act: actIds.has(L.id) }); (three ? (L.front ? camF : cam) : (L.front ? front : root)).appendChild(n); if (L.id) nodes[L.id] = n; return n; });
      if (three && !camF.childNodes.length) { stageF.remove(); stageF = null; }
      /* Hafif mod (yalnızca 3D zeminde): zayıf cihazda baştan, diğerlerinde gerektiğinde kendiliğinden açılır.
         Sis akışı durur, ışık parıltısı gizlenir, parçacık tuvali düşük çözünürlükte çizilir.
         PNG katmanlarının 3D duruşu ve hareketleri AYNEN korunur. */
      const goLite = why => {
        if (st.lite) return; st.lite = why;
        canvasEl.classList.add("th-lite3"); canvasEl.dataset.thLite = why;
        st.cleanups.push(() => { canvasEl.classList.remove("th-lite3"); delete canvasEl.dataset.thLite; });
        if (st.particles) st.particles.quality(1);
      };
      if (three && weak()) goLite("cihaz");
      const lc = bg.light && bg.light.type && bg.light.type !== "none" ? lightCSS(bg.light, (th.palette || {}).accent) : null;
      if (lc) root.appendChild(el("div", "th-fill th-light th-light-" + bg.light.type, lc));
      let pc = null, parts = null;
      const pt = bg.particles && bg.particles.type && bg.particles.type !== "none" ? bg.particles : null;
      if (pt && !reduced()) {
        pc = el("canvas", "th-particles"); root.appendChild(pc);
        afterEntry(mode, st, () => {
          const pcfg = Object.assign({}, pt, { seconds: num(pt.seconds, 0) });
          // 3D zeminli sayfada parçacıklar ayrı çalışanda çizilir (desteklenmezse eski yol); 2D sayfalar aynen eski yoldan
          parts = (three && ParticlesOff(pc, pcfg)) || Particles(pc, pcfg); st.particles = parts;
          if (st.lite) parts.quality(1);
          if (st.update) requestAnimationFrame(st.update);   // açılıştan sonra kurulduysa tuvali hemen yerine oturt
        });
      }

      // katmanların arkasına (zemin görselinin hemen üstüne) yerleştir
      const firstLayer = canvasEl.querySelector("[data-layer-id]");
      canvasEl.insertBefore(root, firstLayer || null);
      if (front.childNodes.length) canvasEl.appendChild(front);

      const rm = reduced();
      if (rm) canvasEl.classList.add("th-still");
      // Hazırlık (K1): süs hareketleri açılış ekranı kalkana kadar duraklı bekler
      if (mode === "view" && global.__seozEntryActive) {
        canvasEl.classList.add("th-wait");
        st.cleanups.push(() => canvasEl.classList.remove("th-wait"));
        afterEntry(mode, st, () => canvasEl.classList.remove("th-wait"));
      }
      // ekranda görünmeyen zemin hareketleri durur
      if (global.IntersectionObserver && !rm) {
        const io = new IntersectionObserver(ents => ents.forEach(e => {
          e.target.classList.toggle("th-off", !e.isIntersecting);
          if (three) e.target.getAnimations({ subtree: true }).forEach(a => { if (a.effect && a.effect.getTiming().iterations === Infinity) { try { e.isIntersecting ? a.play() : a.pause(); } catch (err) { /* önemsiz */ } } });
        }), { rootMargin: "120px" });
        bls.forEach(n => io.observe(n));
        st.cleanups.push(() => io.disconnect());
      }
      // otomatik hafif mod: açılıştan sonraki ilk ~25 saniyede kare hızı art arda 2 saniye 40'ın altında kalırsa
      if (three && mode === "view" && !rm && !st.lite && !global.__seozNoAutoLite) afterEntry(mode, st, () => {   // __seozNoAutoLite: yalnızca ölçüm için
        let frames = 0, t0 = 0, slow = 0, windows = 0, raf = 0, dead = false;
        const tick = now => {
          if (dead || st.lite) return;
          if (document.hidden) { t0 = 0; raf = requestAnimationFrame(tick); return; }
          if (!t0) { t0 = now; frames = 0; }
          frames++;
          if (now - t0 >= 1000) {
            const fps = (frames - 1) * 1000 / (now - t0);
            windows++; slow = fps < 40 ? slow + 1 : 0; t0 = 0;
            if (slow >= 2) return goLite("otomatik");
            if (windows >= 25) return;
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        st.cleanups.push(() => { dead = true; cancelAnimationFrame(raf); });
      });
      // İç Zemin 3D: kamera ve hareketler (açılış ekranı kalkınca başlar)
      const camCfg = three && bg.scene && bg.scene.camera && bg.scene.camera.type && bg.scene.camera.type !== "none" ? bg.scene.camera : null;
      const camD = camCfg ? Math.round(60 + 260 * Math.max(0, Math.min(1, num(camCfg.strength, 0.5)))) : 0;
      if (three) {
        afterEntry(mode, st, () => {
          if (camCfg && mode === "view" && !rm && (camCfg.type === "yaklas" || camCfg.type === "uzaklas")) {
            const kf = camCfg.type === "yaklas" ? [{ transform: "translateZ(0)" }, { transform: `translateZ(${camD}px)` }] : [{ transform: `translateZ(${camD}px)` }, { transform: "translateZ(0)" }];
            const d = Math.max(400, Math.min(12000, num(camCfg.duration, 3) * 1000));
            [cam, camF].filter(c => c.isConnected).forEach(c => { const a = c.animate(kf, { duration: d, easing: "cubic-bezier(.33,0,.2,1)", fill: "forwards" }); st.cleanups.push(() => { try { a.cancel(); } catch (e) { /* önemsiz */ } }); });
          }
          bgMoves(st, bg, nodes, mode);
        });
      }
      // derinlik (kaydırınca farklı hızda kayma) + parçacık tuvalini görünen bölgeye taşıma
      const deep = bls.filter(n => Number(n.dataset.depth) > 0);
      let ticking = false, tiltX = 0, tiltY = 0;
      // önce bütün ölçüler okunur, sonra bütün yazmalar yapılır: okuma-yazma karışınca tarayıcı her
      // katmanda sayfayı yeniden ölçmek zorunda kalıyordu. Katman konumları müşteri sayfasında değişmez,
      // bu yüzden bir kez ölçülür (pencere boyu değişince yeniden).
      let geo = null;
      const measure = () => deep.map(n => ({ n, d: Number(n.dataset.depth), cy: n.offsetTop + n.offsetHeight / 2 }));
      function update() {
        ticking = false;
        const r = canvasEl.getBoundingClientRect();
        const cw = canvasEl.offsetWidth || 1, ch = canvasEl.offsetHeight;
        const scale = r.width / cw || 1;
        const vh = (global.innerHeight || 800);
        const top = Math.max(0, -r.top / scale), hgt = Math.min(ch - top, vh / scale);
        const g = (mode === "view" && geo) || measure();
        if (mode === "view") geo = g;
        const mid = top + (vh / scale) / 2;
        if (!rm) g.forEach(({ n, d, cy }) => {
          n.style.transform = `translate3d(${(tiltX * d * 18).toFixed(1)}px, ${((cy - mid) * d * 0.35 + tiltY * d * 14).toFixed(1)}px, 0)`;
        });
        if (three) {
          const oy = mid.toFixed(0) + "px";
          stage.style.perspectiveOrigin = "50% " + oy; if (stageF) stageF.style.perspectiveOrigin = "50% " + oy;
          if (camCfg && !rm && (camCfg.type === "kaydir-yaklas" || camCfg.type === "kaydir-uzaklas")) {
            const span = Math.max(1, ch - vh / scale), pr = Math.max(0, Math.min(1, top / span));
            const z = (camCfg.type === "kaydir-yaklas" ? pr : 1 - pr) * camD;
            cam.style.transform = camF.style.transform = `translateZ(${z.toFixed(1)}px)`;
          }
        }
        if (pc && parts && hgt > 0) {
          // 3D sayfada tuval yeniden yerleşim gerektirmeyen dönüşümle taşınır (görünüm aynı)
          const pe = parts.el || pc;   // çalışan açılamadıysa tuval yenilenmiş olabilir
          if (three) pe.style.transform = `translate3d(0, ${top}px, 0)`; else pe.style.top = top + "px";
          pe.style.height = Math.max(1, hgt) + "px";
          parts.resize(cw === 1 ? 430 : cw, Math.max(1, hgt));
          if (r.bottom < 0 || r.top > vh) parts.pause(); else parts.resume();
        }
      }
      st.update = update;
      const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
      if (deep.length || pc || three) {
        global.addEventListener("scroll", onScroll, { passive: true, capture: true });
        const onResize = () => { geo = null; onScroll(); };
        global.addEventListener("resize", onResize);
        st.cleanups.push(() => { global.removeEventListener("scroll", onScroll, { capture: true }); global.removeEventListener("resize", onResize); });
        requestAnimationFrame(update); setTimeout(update, 300);
      }
      st.cleanups.push(() => { if (parts) parts.destroy(); });   // parçacıklar açılıştan sonra kurulabilir
      // telefon eğimiyle derinlik (isteğe bağlı): iPhone izin istediği için bir dokunuşla açılır
      if (bg.tilt && deep.length && mode === "view" && !rm && global.DeviceOrientationEvent) {
        const onTilt = e => { tiltX = Math.max(-1, Math.min(1, (e.gamma || 0) / 30)); tiltY = Math.max(-1, Math.min(1, ((e.beta || 0) - 40) / 30)); onScroll(); };
        const start = () => { global.addEventListener("deviceorientation", onTilt); st.cleanups.push(() => global.removeEventListener("deviceorientation", onTilt)); };
        if (typeof DeviceOrientationEvent.requestPermission === "function") {
          const btn = el("button", "th-tilt-btn"); btn.type = "button"; btn.textContent = "📱 Eğerek derinlik";
          btn.addEventListener("click", () => { DeviceOrientationEvent.requestPermission().then(r => { if (r === "granted") start(); }).catch(() => {}).finally(() => btn.remove()); });
          document.body.appendChild(btn); st.cleanups.push(() => btn.remove());
        } else start();
        if (!(deep.length || pc)) { global.addEventListener("scroll", onScroll, { passive: true, capture: true }); }
      }
      st.particles = parts;
    }

    // kaydırınca canlanma (yalnızca müşteri görünümünde; editörde içerik hep görünür)
    if (revealEls.length) {
      if (mode !== "view" || reduced() || !global.IntersectionObserver) revealEls.forEach(n => n.classList.add("th-in"));
      else {
        afterEntry(mode, st, () => {
          const io = new IntersectionObserver(ents => ents.forEach(e => { if (e.isIntersecting) { e.target.classList.add("th-in"); io.unobserve(e.target); } }), { threshold: 0.15 });
          revealEls.forEach(n => io.observe(n));
          st.cleanups.push(() => io.disconnect());
        });
      }
    }
  }

  /* =============================== katman süsleme =============================== */
  function decorateLayer(wrap, layer, mode) {
    // önceki süslemeyi sök (ayar değişince yeniden uygulanabilsin)
    wrap.classList.remove("th-rv", "th-in");
    Array.from(wrap.classList).filter(c => c.indexOf("th-rv-") === 0).forEach(c => wrap.classList.remove(c));
    const rv = layer.reveal;
    if (rv && rv.type) {
      wrap.classList.add("th-rv", "th-rv-" + rv.type);
      wrap.style.setProperty("--th-rv-delay", Math.max(0, num(rv.delay, 0)) + "s");
      wrap.style.setProperty("--th-rv-dur", Math.max(0.2, num(rv.duration, 0.9)) + "s");
      if (mode !== "view") wrap.classList.add("th-in");
    }
    if (global.SeozThemePresent) global.SeozThemePresent.apply(wrap, layer, mode);
  }

  global.SeozTheme = { applyDocument, teardown, decorateLayer, Particles, artURL, MOTIONS, PARTICLES, LIGHTS, REVEALS, sectionGradient, use3d, BG_MOVES, CAMERAS };
})(window);
