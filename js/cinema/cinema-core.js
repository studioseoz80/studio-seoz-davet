/* =============================================================================
   STUDIO SEOZ — cinema/cinema-core.js  (SİNEMATİK AÇILIŞ MOTORU)
   -----------------------------------------------------------------------------
   Mevcut giriş türlerinden (zarf, çift kanat, video...) TAMAMEN BAĞIMSIZDIR.
   Yalnızca entry.type === "cinema" olan belgelerde çalışır (bkz. entry-scene.js).

   YAPI
   - Modeller (kapı, zarf, perde...) registerModel() ile eklenir. Her model:
       slots      : yüklenebilir görsel katmanları (arka plan, sol kanat...)
       skins      : görsel yüklenmediğinde kullanılan kodla çizilmiş görünümler
       build(ctx) : sahneyi KAPALI hâliyle kurar
       scenarios  : 3 farklı kurgu; her biri attention(ctx) + open(ctx)
   - Konseptler (Halloween, yılbaşı...) registerConcept() ile eklenir;
     modelden bağımsızdır: ortam efektleri + "sürpriz anı" kutlaması.
   - İşletme hazır ayarları registerBusiness() ile eklenir.
   - Yeni bir parçacık türü registerParticle(), yeni ek hareket
     registerAccessory() ile eklenir — motor koduna dokunmadan.

   HER AÇILIŞTA DÖRT AŞAMA
     1) attention  dikkat çekici başlangıç (dokunulana kadar / otomatik)
     2-3) open     merak uyandıran hareket + beklenmedik sürpriz
     4) card       iç kart sahnenin devamı olarak görünür → davetiyeye geçiş

   Animasyonlar Web Animations API ile yalnızca transform/opacity üzerinden
   yapılır (GPU dostu). "Hafif mod" ve sistemdeki "hareketi azalt" tercihi
   desteklenir. Sesler dosya gerektirmez (WebAudio ile üretilir) ve yalnızca
   kullanıcı dokunuşundan sonra çalar (tarayıcı otomatik oynatma kuralı).
   ========================================================================= */

(function (global) {
  "use strict";

  const MODELS = {}, MODEL_ORDER = [];
  const CONCEPTS = {}, CONCEPT_ORDER = [];
  const BUSINESS = {}, BUSINESS_ORDER = [];
  const PARTICLES = {};
  const ACCESSORIES = {};
  const FRAME_W = 400, FRAME_H = 700;

  const DEFAULTS = {
    v: 1,
    model: "door", scenario: "", skin: "", concept: "auto", accessory: "none", business: "",
    speed: 1, depth: 1, intensity: 1, sound: true, start: "tap", lite: false,
    cardMode: "auto", cardTitle: "", cardSubtitle: "",
    hintText: "Açmak için dokunun",
    brand: { useColors: false, primary: "#7A1F2B", secondary: "#C9A45C", logo: "", text: "" },
    layers: {}
  };

  const E = {
    out: "cubic-bezier(.16,1,.3,1)", inOut: "cubic-bezier(.65,0,.35,1)", in: "cubic-bezier(.55,0,1,.45)",
    back: "cubic-bezier(.34,1.56,.64,1)", soft: "cubic-bezier(.25,.1,.25,1)", lin: "linear",
    heavy: "cubic-bezier(.7,0,.2,1)", snap: "cubic-bezier(.2,1.4,.4,1)"
  };

  /* ---------------- kayıt ---------------- */
  function registerModel(def) {
    if (!MODELS[def.id]) MODEL_ORDER.push(def.id);
    def.scenarios.forEach(s => { s.model = def.id; });
    MODELS[def.id] = def;
  }
  function registerConcept(def) { if (!CONCEPTS[def.id]) CONCEPT_ORDER.push(def.id); CONCEPTS[def.id] = def; }
  function registerBusiness(def) { if (!BUSINESS[def.id]) BUSINESS_ORDER.push(def.id); BUSINESS[def.id] = def; }
  function registerParticle(type, def) { PARTICLES[type] = def; }
  function registerAccessory(id, def) { ACCESSORIES[id] = def; }

  /* ---------------- ayarlar ---------------- */
  function num(v, def, min, max) { v = Number(v); if (!isFinite(v)) v = def; return Math.max(min, Math.min(max, v)); }
  /* A2 (serbest stüdyo): v:2 kayıtları bir uyarlayıcıdan geçer. Uyarlayıcı
     ya hazır kurguyu (ör. kapı) A1 biçimine çevirir ya da kullanıcının
     katmanlarından o kayda özel bir "serbest model" kurar (__free). */
  let V2_ADAPTER = null;
  function setV2Adapter(fn) { V2_ADAPTER = fn; }
  function modelOf(c) { return (c && c.__free) || MODELS[c.model]; }
  function normalize(cfg) {
    if (cfg && cfg.v === 2 && !cfg.__free && V2_ADAPTER) cfg = V2_ADAPTER(cfg);
    const c = Object.assign({}, DEFAULTS, cfg || {});
    c.brand = Object.assign({}, DEFAULTS.brand, (cfg && cfg.brand) || {});
    c.layers = Object.assign({}, (cfg && cfg.layers) || {});
    if (c.__free) { c.model = c.__free.id; c.scenario = c.__free.scenarios[0].id; }
    else if (!MODELS[c.model]) c.model = MODEL_ORDER[0] || "door";
    const m = modelOf(c);
    if (m && !m.scenarios.some(s => s.id === c.scenario)) c.scenario = m.scenarios[0].id;
    if (m && m.skins && !m.skins[c.skin]) c.skin = Object.keys(m.skins)[0];
    c.speed = num(c.speed, 1, 0.5, 2);
    c.depth = num(c.depth, 1, 0, 2);
    c.intensity = num(c.intensity, 1, 0, 1.5);
    c.start = c.start === "auto" ? "auto" : "tap";
    c.sound = c.sound !== false;
    c.lite = !!c.lite;
    if (c.concept !== "auto" && c.concept !== "none" && !CONCEPTS[c.concept]) c.concept = "auto";
    if (c.accessory !== "none" && !ACCESSORIES[c.accessory]) c.accessory = "none";
    return c;
  }
  function scenarioOf(c) { const m = modelOf(c); return m.scenarios.find(s => s.id === c.scenario) || m.scenarios[0]; }
  function conceptOf(c) {
    if (c.concept === "none") return null;
    if (c.concept === "auto") return CONCEPTS[scenarioOf(c).concept || modelOf(c).concept || "zarif"] || null;
    return CONCEPTS[c.concept] || null;
  }

  /* ---------------- yardımcılar ---------------- */
  function h(tag, cls, style, kids) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (style) Object.assign(e.style, style);
    (kids || []).forEach(k => { if (k) e.appendChild(typeof k === "string" ? document.createTextNode(k) : k); });
    return e;
  }
  function svg(markup, cls, style) {
    const w = h("div", cls, style);
    w.innerHTML = markup;
    const s = w.firstElementChild;
    if (s) { s.style.width = "100%"; s.style.height = "100%"; s.style.display = "block"; s.style.overflow = "visible"; }
    return w;
  }
  /* Görsel adresleri: editörde "idb:..." referansı, yayında https adresi.
     Ön yükleme sırasında çözülen adresler URLS'de tutulur; böylece sahne
     kurulurken görseller beklemeden, eşzamanlı yerleşir. */
  const URLS = new Map();
  function resolveSrc(ref) {
    if (!ref) return Promise.resolve("");
    if (URLS.has(ref)) return Promise.resolve(URLS.get(ref));
    if (global.SeozBlobStore && global.SeozBlobStore.resolveToObjectURL) return global.SeozBlobStore.resolveToObjectURL(ref).catch(() => "");
    return Promise.resolve(ref);
  }
  function img(ref, cls, fit) {
    const i = h("img", cls, { width: "100%", height: "100%", objectFit: fit || "contain", display: "block", pointerEvents: "none" });
    i.alt = ""; i.draggable = false;
    if (URLS.has(ref)) { if (URLS.get(ref)) i.src = URLS.get(ref); }
    else resolveSrc(ref).then(u => { if (u) i.src = u; });
    return i;
  }

  /* ---------------- ön yükleme ----------------
     Animasyon, bütün katman görselleri inene (decode edilene) kadar
     başlamaz. Süre aşılırsa (varsayılan 8 sn) inmeyen görsel "başarısız"
     sayılır ve o yuvada kodla çizilmiş yedek görünüm kullanılır. */
  /* Işık/gölge maskesi (CSS mask-image) başka bir alan adındaki görseli
     yalnızca CORS izniyle kullanabilir (Supabase Storage bu izni verir).
     İzin yoksa görsel yine gösterilir, yalnızca maskeli ışık/gölge kapanır. */
  const MASK_OK = new Set();
  function needsCors(url) {
    if (!/^https?:/i.test(url)) return false;
    try { return new URL(url, global.location.href).origin !== global.location.origin; } catch (e) { return false; }
  }
  function tryLoad(url, cors) {
    return new Promise(res => {
      const im = new Image();
      let settled = false;
      const ok = () => { if (settled) return; settled = true; res(true); };
      const bad = () => { if (settled) return; settled = true; res(false); };
      if (cors) im.crossOrigin = "anonymous";
      im.onload = () => { if (im.decode) im.decode().then(ok, ok); else ok(); };
      im.onerror = bad;
      im.src = url;
    });
  }
  function loadOne(ref) {
    return resolveSrc(ref).then(async url => {
      if (!url) return false;
      const cors = needsCors(url);
      let ok = await tryLoad(url, cors);
      if (ok) MASK_OK.add(ref);
      else if (cors) ok = await tryLoad(url, false);
      if (ok) URLS.set(ref, url);
      return ok;
    }).catch(() => false);
  }
  function preload(refs, timeoutMs) {
    const list = Array.from(new Set((refs || []).filter(Boolean)));
    const failed = {};
    if (!list.length) return Promise.resolve({ failed, timedOut: false });
    let timedOut = false;
    const each = list.map(r => loadOne(r).then(ok => { if (!ok) failed[r] = true; return ok; }));
    const all = Promise.all(each).then(() => ({ failed, timedOut }));
    const limit = new Promise(res => setTimeout(() => {
      timedOut = true;
      list.forEach(r => { if (!URLS.has(r)) failed[r] = true; });
      res({ failed, timedOut });
    }, timeoutMs != null ? timeoutMs : 8000));
    return Promise.race([all, limit]);
  }
  /* Kalınlık dilimleri ve (ayrı yüklenmemiş) arka yüz için PNG'nin
     koyulaştırılmış kopyası bir kez üretilir. CSS filtresi yerine hazır
     görsel kullanmak, telefonda her karede yeniden hesaplamayı önler.
     Saydamlık korunur (yalnızca dolu pikseller koyulaşır). */
  const DARK = new Map();
  function makeDark(ref) {
    const url = URLS.get(ref);
    if (!url || !MASK_OK.has(ref) || DARK.has(ref)) return Promise.resolve();
    return new Promise(res => {
      const im = new Image();
      if (needsCors(url)) im.crossOrigin = "anonymous";
      im.onload = () => {
        try {
          const k = Math.min(1, 1024 / Math.max(im.naturalWidth, im.naturalHeight));
          const w = Math.max(1, Math.round(im.naturalWidth * k)), hh = Math.max(1, Math.round(im.naturalHeight * k));
          const out = {};
          [["slab", 0.6], ["back", 0.4]].forEach(([name, a]) => {
            const cv = document.createElement("canvas"); cv.width = w; cv.height = hh;
            const c2 = cv.getContext("2d");
            c2.drawImage(im, 0, 0, w, hh);
            c2.globalCompositeOperation = "source-atop";
            c2.fillStyle = `rgba(8,5,3,${a})`; c2.fillRect(0, 0, w, hh);
            out[name] = cv.toDataURL("image/png");
          });
          DARK.set(ref, out);
        } catch (e) { /* tuval kullanılamadı: CSS filtresine düşülür */ }
        res();
      };
      im.onerror = () => res();
      im.src = url;
    });
  }
  function prepareDark(cfg, failed) {
    const m = modelOf(cfg), jobs = [];
    if (m) m.slots.forEach(s => {
      const u = cfg.layers[s.id];
      if (!u || u.hidden || !u.src || failed[u.src]) return;
      const L = layoutOf(s, u, cfg.depth);
      if (L.thickness > 0 || (s.back && !u.backSrc)) jobs.push(makeDark(u.src));
    });
    return Promise.all(jobs);
  }

  function sourcesOf(cfg, entry) {
    const m = modelOf(cfg), out = [];
    if (m) m.slots.forEach(s => {
      const u = cfg.layers[s.id];
      if (!u || u.hidden) return;
      if (u.src) out.push(u.src);
      if (u.backSrc) out.push(u.backSrc);
    });
    if (entry && entry.cardSrc && cfg.cardMode !== "none" && cfg.cardMode !== "title") out.push(entry.cardSrc);
    if (cfg.brand && cfg.brand.logo) out.push(cfg.brand.logo);
    return out;
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function initials(title) {
    const words = String(title || "").replace(/[—–-].*$/, "").split(/[\s&]+/).filter(w => /[A-Za-zÇĞİÖŞÜçğıöşü]/.test(w));
    if (!words.length) return "S";
    if (words.length === 1) return words[0][0].toLocaleUpperCase("tr-TR");
    return (words[0][0] + "&" + words[words.length - 1][0]).toLocaleUpperCase("tr-TR");
  }
  function mix(hex, other, t) {
    const p = x => { x = String(x || "#000").replace("#", ""); if (x.length === 3) x = x.split("").map(c => c + c).join(""); return [0, 2, 4].map(i => parseInt(x.substr(i, 2), 16) || 0); };
    const a = p(hex), b = p(other);
    return "#" + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, "0")).join("");
  }

  /* ================= SES (WebAudio, dosyasız) ================= */
  const Sound = (function () {
    let ac = null;
    function unlock() {
      try {
        const AC = global.AudioContext || global.webkitAudioContext;
        if (!AC) return;
        if (!ac) ac = new AC();
        if (ac.state === "suspended") ac.resume();
      } catch (e) { /* ses yok */ }
    }
    function ready() { return ac && ac.state === "running"; }
    function noiseBuf(sec) {
      const b = ac.createBuffer(1, Math.max(1, Math.floor(ac.sampleRate * sec)), ac.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return b;
    }
    function env(g, t0, a, peak, d) {
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(peak, t0 + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
    }
    function tone(freq, t0, dur, type, vol, slideTo) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type || "sine"; o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      env(g, t0, 0.01, vol, dur);
      o.connect(g).connect(ac.destination); o.start(t0); o.stop(t0 + dur + 0.05);
    }
    function noise(t0, dur, vol, ftype, f1, f2, q) {
      const s = ac.createBufferSource(); s.buffer = noiseBuf(dur + 0.05);
      const f = ac.createBiquadFilter(); f.type = ftype || "bandpass"; f.frequency.setValueAtTime(f1, t0);
      if (f2) f.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
      f.Q.value = q || 1;
      const g = ac.createGain(); env(g, t0, Math.min(0.03, dur / 3), vol, dur);
      s.connect(f).connect(g).connect(ac.destination); s.start(t0); s.stop(t0 + dur + 0.05);
    }
    const LIB = {
      knock: t => { tone(95, t, 0.18, "sine", 0.5, 55); noise(t, 0.06, 0.25, "lowpass", 900); },
      creak: t => { const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
        o.type = "sawtooth"; o.frequency.setValueAtTime(140, t); o.frequency.linearRampToValueAtTime(260, t + 0.6); o.frequency.linearRampToValueAtTime(180, t + 1.3);
        f.type = "bandpass"; f.frequency.value = 900; f.Q.value = 6; env(g, t, 0.15, 0.05, 1.2);
        o.connect(f).connect(g).connect(ac.destination); o.start(t); o.stop(t + 1.5); },
      whoosh: t => noise(t, 0.7, 0.18, "bandpass", 300, 2400, 0.8),
      swoosh: t => noise(t, 0.35, 0.15, "bandpass", 2400, 500, 0.9),
      crack: t => { noise(t, 0.08, 0.35, "highpass", 2500); noise(t + 0.05, 0.12, 0.2, "bandpass", 1400, 600, 2); },
      pop: t => { tone(420, t, 0.12, "sine", 0.3, 120); noise(t, 0.05, 0.2, "highpass", 1800); },
      chime: t => [1318, 1760, 2093, 2637].forEach((f, i) => tone(f, t + i * 0.07, 0.9, "sine", 0.07)),
      sparkle: t => [2637, 3136, 3520].forEach((f, i) => tone(f, t + i * 0.05, 0.5, "triangle", 0.04)),
      magic: t => [523, 659, 784, 1046].forEach((f, i) => tone(f, t + i * 0.09, 1.3, "sine", 0.06)),
      boom: t => { tone(70, t, 0.6, "sine", 0.55, 35); noise(t, 0.5, 0.25, "lowpass", 400); },
      thunder: t => { noise(t, 1.6, 0.35, "lowpass", 600, 120); tone(48, t, 1.2, "sine", 0.3, 30); },
      beep: t => tone(988, t, 0.16, "sine", 0.14),
      drumroll: t => { for (let i = 0; i < 18; i++) noise(t + i * 0.055, 0.05, 0.12 + i * 0.01, "bandpass", 220, 0, 1.5); },
      fanfare: t => [[523, 0], [659, 0.12], [784, 0.24], [1046, 0.38]].forEach(([f, d]) => tone(f, t + d, 0.5, "triangle", 0.09)),
      click: t => noise(t, 0.03, 0.3, "highpass", 3000),
      page: t => noise(t, 0.25, 0.12, "bandpass", 1800, 4000, 0.7),
      projector: t => { for (let i = 0; i < 12; i++) noise(t + i * 0.09, 0.03, 0.05, "bandpass", 1200, 0, 3); },
      snip: t => { noise(t, 0.04, 0.3, "highpass", 4000); noise(t + 0.07, 0.04, 0.3, "highpass", 4500); },
      lock: t => { noise(t, 0.04, 0.3, "bandpass", 2600, 0, 4); tone(180, t + 0.08, 0.12, "square", 0.05); }
    };
    function play(name, delaySec) {
      if (!ready() || !LIB[name]) return;
      try { LIB[name](ac.currentTime + (delaySec || 0)); } catch (e) { /* önemsiz */ }
    }
    return { unlock, ready, play, names: Object.keys(LIB), _ctx: () => ac };
  })();

  /* ================= PARÇACIKLAR (tek canvas) ================= */
  function Particles(canvas, opts) {
    const c2 = canvas.getContext("2d");
    const list = [], emitters = [];
    let raf = 0, last = 0, dead = false, W = 0, H = 0, dpr = 1;
    const cap = opts.lite ? 140 : 650;
    function resize() {
      const r = canvas.getBoundingClientRect();
      dpr = opts.lite ? 1 : Math.min(2, global.devicePixelRatio || 1);
      W = r.width; H = r.height;
      canvas.width = Math.max(1, Math.round(W * dpr)); canvas.height = Math.max(1, Math.round(H * dpr));
    }
    resize();
    function add(p) {
      if (list.length >= cap) return;
      const def = PARTICLES[p.type] || PARTICLES.dot;
      p.age = 0; p.rot = p.rot != null ? p.rot : rnd(0, Math.PI * 2); p.vr = p.vr != null ? p.vr : rnd(-3, 3);
      p.alpha = p.alpha != null ? p.alpha : 1; p.drag = p.drag != null ? p.drag : 0.985;
      p.seed = Math.random(); p._host = api;
      if (def.init) def.init(p);
      list.push(p);
    }
    function scaleCount(n) { return Math.max(0, Math.round(n * opts.intensity * (opts.lite ? 0.3 : 1))); }
    function burst(o) {
      const n = scaleCount(o.count || 40);
      const cx = (o.x != null ? o.x : 0.5) * W, cy = (o.y != null ? o.y : 0.5) * H;
      const colors = o.colors || ["#F3D27A", "#FFFFFF"];
      for (let i = 0; i < n; i++) {
        const ang = (o.angle != null ? o.angle : -Math.PI / 2) + rnd(-1, 1) * (o.spread != null ? o.spread : Math.PI);
        const sp = rnd(0.35, 1) * (o.speed || 520);
        add({ type: o.type || "spark", x: cx + rnd(-1, 1) * (o.jitter || 0), y: cy + rnd(-1, 1) * (o.jitter || 0),
              vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, g: o.gravity != null ? o.gravity : 600,
              life: rnd(0.7, 1.2) * (o.life || 1.8), size: rnd(0.6, 1.2) * (o.size || 6), color: pick(colors), drag: o.drag });
      }
    }
    function ambient(o) {
      const n = scaleCount(o.count || 30);
      const colors = o.colors || ["#FFFFFF"];
      const em = { o, alive: true, spawn() {
        const fromTop = o.from !== "bottom" && o.from !== "any";
        add({ type: o.type || "dot", x: rnd(0, W), y: o.from === "bottom" ? H + 20 : o.from === "any" ? rnd(0, H) : -20,
              vx: rnd(-1, 1) * (o.drift || 20), vy: (fromTop ? 1 : -1) * rnd(0.6, 1) * (o.speed || 60) * (o.from === "any" ? rnd(-0.3, 0.3) : 1),
              g: 0, life: o.life || 9, size: rnd(0.6, 1.3) * (o.size || 4), color: pick(colors), drag: 1, ambient: true, sway: o.sway != null ? o.sway : 1 });
      } };
      for (let i = 0; i < n; i++) { em.spawn(); const p = list[list.length - 1]; if (p) { p.y = rnd(-20, H); p.age = rnd(0, p.life * 0.6); } }
      em.rate = n / (o.life || 9);
      em.acc = 0;
      emitters.push(em);
      return { stop() { em.alive = false; } };
    }
    function stream(o) {
      const rate = (o.rate || 30) * opts.intensity * (opts.lite ? 0.3 : 1);
      const em = { o, alive: true, acc: 0, rate, until: o.duration ? performance.now() + o.duration : Infinity,
        spawn() { burst(Object.assign({}, o, { count: 1 / Math.max(0.0001, opts.intensity * (opts.lite ? 0.3 : 1)) })); } };
      emitters.push(em);
      return { stop() { em.alive = false; } };
    }
    function step(t) {
      if (dead) return;
      const dt = Math.min(0.05, (t - (last || t)) / 1000); last = t;
      emitters.forEach(em => {
        if (!em.alive) return;
        if (em.until && t > em.until) { em.alive = false; return; }
        em.acc += em.rate * dt;
        while (em.acc >= 1) { em.acc -= 1; em.spawn(); }
      });
      c2.setTransform(dpr, 0, 0, dpr, 0, 0);
      c2.clearRect(0, 0, W, H);
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.age += dt;
        if (p.age >= p.life || p.y > H + 80 || p.y < -200 || p.x < -140 || p.x > W + 140) { list.splice(i, 1); continue; }
        p.vy += (p.g || 0) * dt; p.vx *= p.drag; p.vy *= p.drag;
        if (p.sway) p.x += Math.sin(p.age * 1.6 + p.seed * 6) * p.sway * 0.6;
        p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
        const k = p.age / p.life;
        const fade = k < 0.1 ? k / 0.1 : k > 0.75 ? (1 - k) / 0.25 : 1;
        c2.save(); c2.globalAlpha = Math.max(0, p.alpha * fade); c2.translate(p.x, p.y);
        (PARTICLES[p.type] || PARTICLES.dot).draw(c2, p, k);
        c2.restore();
      }
      raf = requestAnimationFrame(step);
    }
    const api = { burst, ambient, stream, resize, count: () => list.length, _W: () => W, _H: () => H,
             stopAll() { emitters.forEach(e => { e.alive = false; }); },
             destroy() { dead = true; cancelAnimationFrame(raf); list.length = 0; } };
    raf = requestAnimationFrame(step);
    return api;
  }

  /* temel parçacık çizimleri — yenileri registerParticle ile eklenir */
  function star(c, r, n, inner) {
    c.beginPath();
    for (let i = 0; i < n * 2; i++) { const rr = i % 2 ? r * inner : r, a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    c.closePath();
  }
  registerParticle("dot", { draw(c, p) { c.fillStyle = p.color; c.beginPath(); c.arc(0, 0, p.size / 2, 0, Math.PI * 2); c.fill(); } });
  registerParticle("spark", { draw(c, p) {
    c.rotate(p.rot); c.fillStyle = p.color; const s = p.size;
    c.beginPath(); c.moveTo(0, -s); c.lineTo(s * 0.22, 0); c.lineTo(0, s); c.lineTo(-s * 0.22, 0); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(-s * 0.6, 0); c.lineTo(0, s * 0.14); c.lineTo(s * 0.6, 0); c.lineTo(0, -s * 0.14); c.closePath(); c.fill();
  } });
  registerParticle("glow", { draw(c, p, k) {
    const r = p.size * (1 + Math.sin(p.age * 5 + p.seed * 9) * 0.25);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, r * 2.2); g.addColorStop(0, p.color); g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, r * 2.2, 0, Math.PI * 2); c.fill();
  } });
  registerParticle("confetti", { init(p) { p.g = p.g || 420; p.drag = 0.97; p.vr = rnd(-8, 8); p.w = rnd(0.6, 1.1); },
    draw(c, p) { c.rotate(p.rot); c.scale(1, Math.cos(p.age * 9 + p.seed * 6)); c.fillStyle = p.color; c.fillRect(-p.size * p.w / 2, -p.size * 0.35, p.size * p.w, p.size * 0.7); } });
  registerParticle("snow", { init(p) { p.vr = 0; }, draw(c, p) {
    const g = c.createRadialGradient(0, 0, 0, 0, 0, p.size); g.addColorStop(0, "rgba(255,255,255,.95)"); g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, p.size, 0, Math.PI * 2); c.fill(); } });
  registerParticle("petal", { init(p) { p.vr = rnd(-2, 2); }, draw(c, p) {
    c.rotate(p.rot); c.scale(1, 0.55 + Math.sin(p.age * 3 + p.seed * 7) * 0.35); c.fillStyle = p.color;
    c.beginPath(); c.ellipse(0, 0, p.size, p.size * 0.6, 0, 0, Math.PI * 2); c.fill(); } });
  registerParticle("heart", { draw(c, p) {
    c.rotate(Math.sin(p.age * 2 + p.seed * 5) * 0.35); const s = p.size / 10; c.scale(s, s); c.fillStyle = p.color;
    c.beginPath(); c.moveTo(0, 3); c.bezierCurveTo(-10, -4, -5, -11, 0, -5); c.bezierCurveTo(5, -11, 10, -4, 0, 3); c.fill(); } });
  registerParticle("star", { draw(c, p) { c.rotate(p.rot); c.fillStyle = p.color; star(c, p.size, 5, 0.45); c.fill(); } });
  registerParticle("bat", { init(p) { p.vr = 0; }, draw(c, p) {
    const s = p.size / 10, f = Math.sin(p.age * 18 + p.seed * 9); c.scale(s, s); c.fillStyle = p.color;
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-6, -6 - f * 5, -14, -2 - f * 6); c.quadraticCurveTo(-10, 1, -8, 4); c.quadraticCurveTo(-4, 2, 0, 4);
    c.quadraticCurveTo(4, 2, 8, 4); c.quadraticCurveTo(10, 1, 14, -2 - f * 6); c.quadraticCurveTo(6, -6 - f * 5, 0, 0); c.fill(); } });
  registerParticle("balloon", { init(p) { p.vr = 0; }, draw(c, p) {
    const s = p.size; c.rotate(Math.sin(p.age + p.seed * 4) * 0.12); c.strokeStyle = "rgba(255,255,255,.6)"; c.lineWidth = 1;
    c.beginPath(); c.moveTo(0, s * 1.2); c.quadraticCurveTo(s * 0.3, s * 2, 0, s * 2.8); c.stroke();
    const g = c.createRadialGradient(-s * 0.3, -s * 0.4, s * 0.1, 0, 0, s * 1.2); g.addColorStop(0, "rgba(255,255,255,.75)"); g.addColorStop(0.25, p.color); g.addColorStop(1, p.color);
    c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, s, s * 1.2, 0, 0, Math.PI * 2); c.fill(); } });
  registerParticle("shard", { init(p) { p.pts = [0, 1, 2, 3].map(i => [Math.cos(i * 1.7 + p.seed) * rnd(0.5, 1), Math.sin(i * 1.7 + p.seed) * rnd(0.5, 1)]); },
    draw(c, p) { c.rotate(p.rot); c.fillStyle = p.color; c.beginPath(); p.pts.forEach(([x, y], i) => (i ? c.lineTo : c.moveTo).call(c, x * p.size, y * p.size)); c.closePath(); c.fill(); } });
  registerParticle("smoke", { init(p) { p.vr = 0; }, draw(c, p, k) {
    const r = p.size * (1 + k * 2.5); const g = c.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, p.color); g.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill(); } });
  registerParticle("page", { init(p) { p.vr = rnd(-4, 4); p.g = 60; }, draw(c, p) {
    c.rotate(p.rot); c.scale(Math.cos(p.age * 4 + p.seed * 5), 1); c.fillStyle = p.color; c.fillRect(-p.size * 0.7, -p.size, p.size * 1.4, p.size * 2);
    c.fillStyle = "rgba(120,100,70,.25)"; for (let i = 0; i < 4; i++) c.fillRect(-p.size * 0.5, -p.size * 0.6 + i * p.size * 0.35, p.size, 1); } });
  registerParticle("cap", { draw(c, p) {
    const s = p.size / 10; c.rotate(p.rot); c.scale(s, s); c.fillStyle = p.color;
    c.beginPath(); c.moveTo(-12, 0); c.lineTo(0, -6); c.lineTo(12, 0); c.lineTo(0, 6); c.closePath(); c.fill(); c.fillRect(-6, 2, 12, 6);
    c.strokeStyle = "#E8C66A"; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, 0); c.lineTo(9, 5); c.lineTo(9, 10); c.stroke(); } });
  registerParticle("firework", { init(p) { p.g = 200; p.drag = 0.99; p.done = false; }, draw(c, p, k) {
    if (!p.done && (p.vy > -40 || k > 0.45)) {
      p.done = true; p.life = p.age + 0.01;
      const host = p._host; if (host) host.burst({ type: "spark", x: p.x / host._W(), y: p.y / host._H(), count: 46, speed: 260, spread: Math.PI, gravity: 140, life: 1.4, size: 5, colors: [p.color, "#FFFFFF"] });
    }
    c.fillStyle = p.color; c.beginPath(); c.arc(0, 0, 2.2, 0, Math.PI * 2); c.fill(); } });

  /* ================= SAHNE KURULUMU ================= */
  let active = null;

  function stop(immediate) {
    if (!active) return;
    const a = active; active = null;
    a.dead = true;
    if (a.ctx) a.ctx.dead = true;
    a.timers.forEach(clearTimeout);
    a.anims.forEach(x => { try { x.cancel(); } catch (e) { /* önemsiz */ } });
    if (a.fx) a.fx.destroy();
    if (a.onResize) global.removeEventListener("resize", a.onResize);
    if (a.onKey) global.removeEventListener("keydown", a.onKey);
    if (a.overlay && a.overlay.parentNode) a.overlay.remove();
  }

  function fitFrame(st) {
    const box = st.overlay.getBoundingClientRect();
    const s = Math.min(box.width / FRAME_W, box.height / FRAME_H) * 0.96;
    st.scale = Math.max(0.3, Math.min(1.5, s));
    st.fit.style.transform = `translate(-50%,-50%) scale3d(${st.scale},${st.scale},${st.scale})`;
  }

  function buildCard(ctx) {
    const c = ctx.cfg, doc = ctx.doc;
    let mode = c.cardMode;
    const src = ctx.entry.cardSrc;
    if (mode === "auto") mode = src ? "image" : "title";
    if (mode === "image" && !src) mode = "title";
    const wrap = h("div", "sc-cardwrap");
    if (mode === "none") { ctx.hasCard = false; return wrap; }
    ctx.hasCard = true;
    let card;
    if (mode === "image") {
      card = h("div", "sc-card sc-card-img", null, [img(src, "", "contain")]);
    } else {
      const P = ctx.pal;
      const title = c.cardTitle || (doc.meta && doc.meta.title) || "";
      card = h("div", "sc-card sc-card-title", { background: P.paper || "#FBF7EF", color: P.ink || "#2A2420", borderColor: P.accent || "#C9A45C" }, [
        h("div", "sc-card-orn", { color: P.accent }, ["❦"]),
        c.brand.logo ? h("div", "sc-card-logo", null, [img(c.brand.logo, "", "contain")]) : null,
        h("div", "sc-card-t", null, [title]),
        c.cardSubtitle ? h("div", "sc-card-s", null, [c.cardSubtitle]) : null,
        h("div", "sc-card-orn sc-card-orn-b", { color: P.accent }, ["— ✦ —"])
      ]);
    }
    wrap.appendChild(card);
    ctx.cardEl = card;
    return wrap;
  }

  /* ---------------- katmanlar (yuvalar) ----------------
     Her katman üç iç içe kutudur:
       outer : kullanıcının yerleşimi (konum, ölçek, derinlik) — hizalama ekranı bunu değiştirir
       carry : başka bir parçayla birlikte taşınma (ör. tokmak sağ kanatla döner)
       inner : parçanın kendi hareketi; dönme noktası (menteşe) buradadır
     inner'ın içinde: kalınlık dilimleri, arka yüz, ön yüz ve ışık/gölge maskesi. */
  function layerOf(cfg, slot) { return (cfg.layers && cfg.layers[slot.id]) || {}; }
  function layoutOf(slot, u, depthMul) {
    const g = slot.box || { x: 0, y: 0, w: FRAME_W, h: FRAME_H };
    return {
      g, x: Number(u.x) || 0, y: Number(u.y) || 0,
      s: Number(u.scale) > 0 ? Math.max(0.2, Math.min(4, Number(u.scale))) : 1,
      // Derinlik: kullanıcı derinliği 3D ayarıyla çarpılır; zLayer yalnızca katman sırası içindir.
      z: (Number(u.depth) || 0) * depthMul + (slot.zLayer || 0),
      origin: u.origin || slot.origin || "50% 50%",
      thickness: u.thickness != null && u.thickness !== "" ? Math.max(0, Math.min(60, Number(u.thickness) || 0)) : (slot.thickness || 0),
      light: u.light != null && u.light !== "" ? Math.max(0, Math.min(1.5, Number(u.light))) : 1
    };
  }
  function applyLayout(ctx, slot) {
    const outer = ctx.S[slot.id], inner = ctx.L[slot.id];
    if (!outer || !inner || slot.backdrop) return;
    const L = layoutOf(slot, layerOf(ctx.cfg, slot), ctx.cfg.depth);
    outer.style.transform = `translate3d(${L.x}px,${L.y}px,${L.z}px) scale(${L.s})`;
    inner.style.transformOrigin = L.origin;
    ctx.box[slot.id] = { x: L.g.x + L.x, y: L.g.y + L.y, w: L.g.w, h: L.g.h, s: L.s };
  }

  function setHidden(el) { el.style.backfaceVisibility = "hidden"; el.style.webkitBackfaceVisibility = "hidden"; }

  /* Işık/gölge katmanı: içinde parçanın şeklinde koyulaşan bir gölge ve
     üzerinden geçen bir ışık parıltısı vardır. Yüklenen PNG'de şekil,
     PNG'nin saydamlığı maske yapılarak elde edilir. */
  function makeLit(ctx, slot, k) {
    const lit = h("div", "sc-lit");
    const shade = h("div", "sc-shade");
    const bar = h("div", "sc-lit-bar");
    lit.appendChild(shade); lit.appendChild(bar);
    ctx.lit[slot.id] = { el: lit, shade, bar, k };
    return lit;
  }

  function buildPngFaces(ctx, slot, u, L, inner, src) {
    const fit = slot.fit || "contain";
    const two = !!slot.back;            // dönen parça: arkası görünebilir
    const t = L.thickness;
    // kalınlık: PNG'nin arkasına çok ince aralıkla dizilen koyulaştırılmış kopyalar
    const dark = DARK.get(src);
    if (t > 0) {
      const n = ctx.lite ? 1 : Math.max(2, Math.min(3, Math.round(t / 4)));
      for (let i = 1; i <= n; i++) {
        let sl;
        if (dark) { sl = h("img", "sc-slab", { width: "100%", height: "100%", objectFit: fit, display: "block", pointerEvents: "none" }); sl.alt = ""; sl.src = dark.slab; }
        else { sl = img(src, "sc-slab", fit); sl.style.filter = "brightness(.4)"; }
        sl.style.transform = `translateZ(${-(t * i / (n + 1)).toFixed(2)}px)`;
        inner.appendChild(sl);
      }
    }
    if (two) {
      const backRef = u.backSrc && !ctx.failed[u.backSrc] ? u.backSrc : "";
      let back;
      if (!backRef && dark) { back = h("img", "sc-upload sc-backface", { width: "100%", height: "100%", objectFit: fit, display: "block", pointerEvents: "none" }); back.alt = ""; back.src = dark.back; }
      else back = img(backRef || src, "sc-upload sc-backface", fit);
      back.style.transform = `translateZ(${-t}px) rotateY(180deg)`;
      setHidden(back);
      // ayrı arka yüz yüklenmediyse: ön yüzün koyulaştırılmış hâli
      if (!backRef && !dark) back.style.filter = "brightness(.6) saturate(.85)";
      inner.appendChild(back);
    }
    const front = img(src, "sc-upload sc-front", fit);
    if (two) setHidden(front);
    inner.appendChild(front);
    const url = URLS.get(src);
    if (url && slot.lit && MASK_OK.has(src)) {
      const lit = makeLit(ctx, slot, L.light);
      const m = `url("${url}")`;
      Object.assign(lit.style, {
        WebkitMaskImage: m, maskImage: m, WebkitMaskSize: fit, maskSize: fit,
        WebkitMaskPosition: "center", maskPosition: "center", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
        transform: "translateZ(.6px)"
      });
      if (two) setHidden(lit);
      inner.appendChild(lit);
    }
  }

  function buildArtExtras(ctx, slot, L, inner) {
    // kodla çizilmiş görünümde de aynı ışık/gölge ve kalınlık uygulanır
    const face = inner.querySelector(".sc-face");
    if (!face) return;
    if (slot.lit) face.appendChild(makeLit(ctx, slot, L.light));
    const t = L.thickness;
    if (t > 0) {
      const holder = face.parentNode;
      const n = ctx.lite ? 1 : Math.max(2, Math.min(5, Math.round(t / 3)));
      const radius = face.style.borderRadius || "0";
      const col = (ctx.pal && ctx.pal.main2) || "#1A120C";
      for (let i = 1; i <= n; i++) {
        const sl = h("div", "sc-slab", { position: "absolute", inset: "0", borderRadius: radius, background: mix(col, "#000000", 0.35 + i * 0.04),
          transform: `translateZ(${-(t * i / (n + 1)).toFixed(2)}px)` });
        holder.insertBefore(sl, holder.firstChild);
      }
      const faces = Array.prototype.filter.call(holder.children, el => el.classList.contains("sc-face"));
      if (faces[1]) faces[1].style.transform = `translateZ(${-t}px) rotateY(180deg)`;
    }
  }

  function buildSlot(ctx, slot) {
    const u = layerOf(ctx.cfg, slot);
    const L = layoutOf(slot, u, ctx.cfg.depth);
    const outer = h("div", "sc-slot sc-slot-" + slot.id);
    outer.dataset.slot = slot.id;
    Object.assign(outer.style, { left: L.g.x + "px", top: L.g.y + "px", width: L.g.w + "px", height: L.g.h + "px", zIndex: String(slot.z || 1) });
    const carry = h("div", "sc-anim sc-carry");
    const inner = h("div", "sc-anim");
    ctx.L[slot.id] = inner; ctx.C[slot.id] = carry; ctx.S[slot.id] = outer;
    const src = u.src && !ctx.failed[u.src] ? u.src : "";
    ctx.uploaded[slot.id] = !!src;
    outer.dataset.source = src ? "png" : "art";
    // custom yuvalar (ör. çoğaltılan sayfa/yaprak) yüklenen görseli kendileri yerleştirir
    if (slot.custom && slot.art) { const a = slot.art(ctx, inner, src); if (a) inner.appendChild(a); }
    else if (src) buildPngFaces(ctx, slot, u, L, inner, src);
    else if (slot.art) { const a = slot.art(ctx, inner); if (a) { inner.appendChild(a); buildArtExtras(ctx, slot, L, inner); } }
    carry.appendChild(inner);
    outer.appendChild(carry);
    applyLayout(ctx, slot);
    return outer;
  }

  /* Model bir sahne öğesi (yuva olmayan) eklemek isterse */
  function addPiece(ctx, cls, box, z, kids) {
    const e = h("div", "sc-piece " + (cls || ""), { left: box.x + "px", top: box.y + "px", width: box.w + "px", height: box.h + "px", zIndex: String(z || 5) }, kids);
    ctx.frame.appendChild(e);
    return e;
  }

  function makeCtx(doc, entry, cfg, overlay, st) {
    const m = modelOf(cfg);
    const skin = (m.skins && m.skins[cfg.skin]) || {};
    const pal = Object.assign({}, skin);
    if (cfg.brand.useColors) {
      pal.main = cfg.brand.primary; pal.main2 = mix(cfg.brand.primary, "#000000", 0.35);
      pal.accent = cfg.brand.secondary; pal.accent2 = mix(cfg.brand.secondary, "#FFFFFF", 0.35);
    }
    const k = 1 / cfg.speed;
    const ctx = {
      doc, entry, cfg, model: m, scenario: scenarioOf(cfg), concept: conceptOf(cfg), pal, E,
      L: {}, S: {}, C: {}, box: {}, uploaded: {}, lit: {}, failed: st.failed || {}, overlay, frame: st.frame, backdropEl: st.backdrop,
      scale: () => st.scale, dead: false, hasCard: false, reduced: st.reduced, lite: cfg.lite,
      k, h, svg, img, rnd, pick, mix,
      Z: (n) => n * cfg.depth,
      t: (ms) => ms * k,
      monogram: cfg.brand.text || initials(doc.meta && doc.meta.title),
      anim(el, kf, o) {
        if (!el || ctx.dead) return null;
        o = o || {};
        const a = el.animate(kf, { duration: (o.d || 600) * k, delay: (o.delay || 0) * k, easing: o.e || E.out,
                                   fill: o.fill || "both", iterations: o.it || 1, direction: o.dir || "normal", composite: o.comp || "replace" });
        st.anims.push(a);
        return a;
      },
      loop(el, kf, o) { return ctx.anim(el, kf, Object.assign({ it: Infinity, e: E.inOut, dir: "alternate" }, o || {})); },
      done(a) { return a ? new Promise(r => { a.finished.then(r, r); }) : Promise.resolve(); },
      wait(ms) { return new Promise((res) => { st.timers.push(setTimeout(res, ms * k)); }); },
      later(ms, fn) { st.timers.push(setTimeout(() => { if (!ctx.dead) fn(); }, ms * k)); },
      sfx(name, delayMs) { if (cfg.sound) Sound.play(name, (delayMs || 0) * k / 1000); },
      // 3D kamera
      cam(kf, o) { return ctx.anim(st.cam, kf, o); },
      piece(cls, box, z, kids, zLayer) {
        const e = h("div", "sc-piece " + (cls || ""), { left: box.x + "px", top: box.y + "px", width: box.w + "px", height: box.h + "px",
          zIndex: String(z || 5), transform: zLayer ? `translateZ(${zLayer}px)` : "" }, kids);
        st.frame.appendChild(e);
        return e;
      },
      // katman "hareket yönü": auto | left | right | up | down | fade | none
      dir(slotId, def) { const u = cfg.layers[slotId]; return (u && u.dir && u.dir !== "auto") ? u.dir : (def || "fade"); },
      dirVec(slotId, def, dist) {
        const d = ctx.dir(slotId, def), D = dist || 500;
        return { left: [-D, 0], right: [D, 0], up: [0, -D], down: [0, D], fade: [0, 0], none: [0, 0] }[d] || [0, 0];
      },
      // carry öğesini bir menteşe noktası etrafında döndürmek için orijin ayarlar (çerçeve koordinatı)
      hinge(slotId, fx, fy) {
        const b = ctx.box[slotId], c = ctx.C[slotId];
        if (b && c) c.style.transformOrigin = `${fx - b.x}px ${fy - b.y}px`;
      },
      // A2: açılış sırasında yeni bir dokunuş bekle ("Dokununca" adımları)
      waitTap() { return new Promise(r => { st.tapWait = r; }); },
      // parçanın kendi şeklinde gölge (0 = yok, 1 = tam koyu); ışık tepkisi ayarıyla ölçeklenir
      shade(slotId, to, o) {
        const l = ctx.lit[slotId];
        if (!l) return null;
        const from = Number(l.shade.style.opacity || 0);
        const target = Math.max(0, Math.min(1, to * l.k));
        l.shade.style.opacity = String(target);
        return ctx.anim(l.shade, [{ opacity: from }, { opacity: target }], Object.assign({ d: 900, e: E.inOut }, o || {}));
      },
      // parçanın kendi şeklinde üzerinden geçen ışık parıltısı
      sheen(slotId, o) {
        const l = ctx.lit[slotId];
        if (!l || l.k <= 0) return null;
        return ctx.anim(l.bar, [{ transform: "translateX(-130%) skewX(-16deg)", opacity: 0 }, { opacity: Math.min(1, l.k), offset: 0.2 },
          { opacity: Math.min(1, l.k), offset: 0.8 }, { transform: "translateX(330%) skewX(-16deg)", opacity: 0 }], Object.assign({ d: 1500, e: E.inOut }, o || {}));
      },
      // görevi biten (tamamen solan) parçayı sahneden çıkarır: telefonda
      // her karede boşuna çizilip 3D sıralamaya girmesin
      retire(a, el) {
        if (!a || !el) return a;
        a.finished.then(() => { if (!ctx.dead) el.style.display = "none"; }, () => {});
        return a;
      },
      // ışıklar
      flash(color, d, peak) {
        const f = h("div", "sc-flash", { background: color || "#FFF8E6" });
        overlay.appendChild(f);
        const a = ctx.anim(f, [{ opacity: 0 }, { opacity: peak != null ? peak : 0.9, offset: 0.15 }, { opacity: 0 }], { d: d || 900, e: E.out });
        if (a) a.finished.then(() => f.remove(), () => f.remove());
        return a;
      },
      glow(x, y, size, color, z) {
        const g = h("div", "sc-glow", { left: (x - size / 2) + "px", top: (y - size / 2) + "px", width: size + "px", height: size + "px",
                                       background: `radial-gradient(circle, ${color || "rgba(255,240,200,.95)"} 0%, rgba(255,240,200,0) 68%)`, zIndex: String(z || 30), opacity: "0" });
        st.frame.appendChild(g);
        return g;
      },
      rays(x, y, size, color, z) {
        const r = h("div", "sc-rays", { left: (x - size / 2) + "px", top: (y - size / 2) + "px", width: size + "px", height: size + "px", zIndex: String(z || 29), opacity: "0",
          background: `repeating-conic-gradient(from 0deg, ${color || "rgba(255,235,180,.55)"} 0deg 6deg, rgba(255,235,180,0) 6deg 18deg)`,
          WebkitMaskImage: "radial-gradient(circle, #000 0%, rgba(0,0,0,.6) 30%, transparent 68%)", maskImage: "radial-gradient(circle, #000 0%, rgba(0,0,0,.6) 30%, transparent 68%)" });
        st.frame.appendChild(r);
        return r;
      },
      // arka planın tamamına yayılan ışık/renk (ör. kapıdan geçince sıcak ışık)
      bgLight(css) {
        const d = h("div", "", Object.assign({ position: "absolute", inset: "0", opacity: "0", pointerEvents: "none" }, css));
        st.backdrop.appendChild(d);
        return d;
      },
      darkness(op) {
        const d = h("div", "sc-dark", { opacity: String(op != null ? op : 0) });
        overlay.insertBefore(d, st.fxCanvas);
        return d;
      },
      // parçacıklar (ekran oranı 0-1 koordinatlarıyla)
      fx: null,
      frameToScreen(x, y) {
        const fr = st.frame.getBoundingClientRect(), ov = overlay.getBoundingClientRect();
        return { x: (fr.left - ov.left + (x / FRAME_W) * fr.width) / ov.width, y: (fr.top - ov.top + (y / FRAME_H) * fr.height) / ov.height };
      },
      // konsept kutlaması: modelden bağımsız "sürpriz anı" efekti
      celebrate(x, y, strength) {
        const c = ctx.concept, p = ctx.frameToScreen(x != null ? x : 200, y != null ? y : 350);
        const s = strength || 1;
        if (!c) { ctx.fx.burst({ type: "spark", x: p.x, y: p.y, count: 26 * s, speed: 380, colors: [ctx.pal.accent || "#F3D27A", "#FFFFFF"], gravity: 300 }); return; }
        (c.burst || []).forEach(b => ctx.fx.burst(Object.assign({ x: p.x, y: p.y }, b, { count: (b.count || 40) * s,
          colors: b.colors || [ctx.pal.accent || "#C9A45C", ctx.pal.accent2 || "#F3D27A", "#FFFFFF"] })));
        if (c.onSurprise) c.onSurprise(ctx, p);
        if (c.sound) ctx.sfx(c.sound);
      },
      // kart (sahnenin devamı)
      card: null,
      accessory: () => runAccessory(ctx)
    };
    ctx.fxCanvas = st.fxCanvas;
    return ctx;
  }

  function runAccessory(ctx) {
    const id = ctx.cfg.accessory;
    if (!id || id === "none" || !ACCESSORIES[id] || !ctx.accEl) return Promise.resolve();
    return ACCESSORIES[id].play(ctx, ctx.accEl);
  }

  /* opts:
       container      : önizleme kutusu (editör); yoksa tam ekran
       freeze         : true → yalnızca kapalı sahne kurulur (hizalama ekranı)
       onPhase(p)     : aşama değişince çağrılır (loading, attention, opening, card, exit)
       reduced        : "hareketi azalt" tercihini zorla (test)
       autoDelay, cardHoldMs, preloadTimeout : süre ayarları (test/önizleme)
     Dönen tutamaç: { overlay, ctx, ready(Promise), stop(), finish(), setLayer(), relayout(), refit(), destroy() } */
  function play(doc, onFinish, opts) {
    opts = opts || {};
    if (!opts.freeze) stop();
    const entry = doc.entry || {};
    const cfg = normalize(entry.cinema);
    // çok zayıf cihazlarda (≤2 GB bellek veya ≤2 çekirdek) hafif mod kendiliğinden açılır
    if (!cfg.lite && !opts.freeze && weakDevice()) cfg.lite = true;
    const done = onFinish || function () {};
    const inBox = !!opts.container;
    const reduced = !opts.freeze && (opts.reduced != null ? opts.reduced : !!(global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches));

    const overlay = h("div", "sc-overlay" + (inBox ? " sc-inbox" : "") + (cfg.lite ? " sc-lite" : "") + (opts.freeze ? " sc-freeze" : ""));
    overlay.dataset.scModel = cfg.model; overlay.dataset.scScenario = cfg.scenario; overlay.dataset.scPhase = "loading";
    overlay.setAttribute("role", "dialog"); overlay.setAttribute("aria-label", "Davetiye açılışı");
    const backdrop = h("div", "sc-backdrop");
    const view = h("div", "sc-view");
    const cam = h("div", "sc-cam");
    const fit = h("div", "sc-fit");
    const frame = h("div", "sc-frame");
    const fxCanvas = h("canvas", "sc-fx");
    fit.appendChild(frame); cam.appendChild(fit); view.appendChild(cam);
    overlay.appendChild(backdrop); overlay.appendChild(view); overlay.appendChild(fxCanvas);
    view.style.perspective = Math.round(1400 / Math.max(0.35, cfg.depth || 0.35)) + "px";

    const st = { overlay, frame, fit, cam, view, backdrop, fxCanvas, anims: [], timers: [], reduced, scale: 1, failed: {}, ctx: null, dead: false };
    if (inBox) opts.container.appendChild(overlay); else document.body.appendChild(overlay);
    if (!opts.freeze) active = st;

    let phase = "loading", finished = false;
    function setPhase(p) { phase = p; overlay.dataset.scPhase = p; if (opts.onPhase) opts.onPhase(p); }

    const handle = {
      overlay, ctx: null, ready: null,
      stop: () => { if (active === st) stop(); },
      finish: (fast) => finish(fast),
      refit: () => fitFrame(st),
      destroy() { st.dead = true; if (active === st) stop(); else overlay.remove(); },
      // hizalama ekranı: bir katmanın yerleşimini canlı günceller (sahne yeniden kurulmaz)
      setLayer(id, u) {
        const ctx = st.ctx; if (!ctx) return;
        ctx.cfg.layers[id] = Object.assign({}, u || {});
        const slot = ctx.model.slots.find(s => s.id === id);
        if (slot) applyLayout(ctx, slot);
      },
      relayout() { const ctx = st.ctx; if (ctx) ctx.model.slots.forEach(s => applyLayout(ctx, s)); }
    };

    // arayüz: ipucu ve her zaman görünen "Geç" düğmesi (yükleme sırasında da çalışır)
    let hint = null;
    if (!opts.freeze) {
      const ui = h("div", "sc-ui");
      hint = h("div", "sc-hint", null, [cfg.hintText || DEFAULTS.hintText]);
      hint.style.display = "none";
      const skip = h("button", "sc-skip", null, ["Geç ›"]);
      skip.type = "button";
      skip.setAttribute("aria-label", "Açılışı geç");
      ui.appendChild(hint); ui.appendChild(skip);
      overlay.appendChild(ui);
      skip.addEventListener("click", (e) => { e.stopPropagation(); Sound.unlock(); finish(true); });
    }

    function finish(fast) {
      if (finished || opts.freeze) return;
      finished = true;
      setPhase("exit");
      // davetiye, açılış ekranının ALTINDA hemen çizilir; açılış onun içine çözülür
      try { done(); } catch (e) { console.error(e); }
      const ctx = st.ctx;
      const end = () => { if (active === st) stop(); else overlay.remove(); };
      if (!ctx) { end(); return; }
      const d = fast ? 260 : (reduced ? 500 : 1000);
      const out = ctx.anim(overlay, [{ opacity: 1 }, { opacity: 1, offset: fast ? 0 : 0.25 }, { opacity: 0 }], { d, e: E.inOut });
      if (!reduced) {
        const cur = getComputedStyle(st.cam).transform;
        ctx.anim(st.cam, [{ transform: cur === "none" ? "none" : cur }, { transform: `${cur === "none" ? "" : cur} translateZ(${ctx.Z(220) + 40}px)` }], { d, e: E.in, fill: "forwards" });
        if (ctx.hasCard && ctx.cardEl && !fast) ctx.anim(ctx.cardEl, [{ filter: "brightness(1)" }, { filter: "brightness(1.08)" }], { d, e: E.out });
      }
      if (out) out.finished.then(end, end); else end();
    }

    // yükleme göstergesi yalnızca yükleme gerçekten uzarsa görünür
    let loader = null;
    const lt = setTimeout(() => {
      if (st.ctx || st.dead) return;
      loader = h("div", "sc-loading", null, [h("div", "sc-spin"), h("div", "sc-loading-t", null, ["Hazırlanıyor…"])]);
      overlay.appendChild(loader);
    }, 250);
    st.timers.push(lt);

    handle.ready = preload(sourcesOf(cfg, entry), opts.preloadTimeout).then(res => prepareDark(cfg, res.failed).then(() => res)).then(res => {
      clearTimeout(lt);
      if (loader) loader.remove();
      if (st.dead || (!opts.freeze && active !== st) || finished) return handle;
      st.failed = res.failed;
      overlay.dataset.scFailed = String(Object.keys(res.failed).length);
      const ctx = makeCtx(doc, entry, cfg, overlay, st);
      st.ctx = ctx; handle.ctx = ctx;
      buildScene(ctx, st);
      fitFrame(st);
      if (opts.freeze) { setPhase("freeze"); return handle; }
      st.onResize = () => { fitFrame(st); if (st.fx) st.fx.resize(); };
      global.addEventListener("resize", st.onResize);
      ctx.fx = Particles(fxCanvas, { lite: cfg.lite, intensity: cfg.intensity });
      st.fx = ctx.fx;
      if (cfg.start !== "auto") hint.style.display = "";
      startPlayback(ctx);
      return handle;
    });

    let tapResolve = null;
    if (!opts.freeze) {
      overlay.addEventListener("click", () => {
        Sound.unlock();
        if (phase === "attention" && tapResolve) { const r = tapResolve; tapResolve = null; r(); }
        else if (phase === "card") finish(false);
        else if (phase === "opening" && st.tapWait) { const r = st.tapWait; st.tapWait = null; r(); }
        else if (phase === "opening" && st.skipToCard) st.skipToCard();
      });
      st.onKey = (e) => { if (e.key === "Escape") finish(true); };
      global.addEventListener("keydown", st.onKey);
    }

    function startPlayback(ctx) {
      // ortam efektleri (konsept)
      function startConcept() {
        const c = ctx.concept;
        if (!c) return;
        (c.ambient || []).forEach(a => ctx.fx.ambient(a));
        if (c.overlay && !cfg.lite) c.overlay(ctx, overlay);
        if (c.tint) { const t = h("div", "sc-tint", { background: c.tint }); overlay.insertBefore(t, fxCanvas); }
      }
      function waitStart() {
        if (cfg.start === "auto") return ctx.wait(opts.autoDelay != null ? opts.autoDelay : 1600);
        return new Promise(r => { tapResolve = r; });
      }
      function holdCard() {
        if (ctx.dead || finished) return;
        if (!ctx.hasCard) { finish(false); return; }
        setPhase("card");
        const dur = entry.cardDisplayDuration;
        if (dur === "tap") { hint.textContent = "Devam etmek için dokunun"; hint.style.display = ""; hint.classList.add("sc-hint-bottom"); return; }
        const sec = Number(dur); const ms = (isFinite(sec) && sec > 0 ? sec : 10) * 1000;
        st.timers.push(setTimeout(() => finish(false), opts.cardHoldMs != null ? opts.cardHoldMs : ms));
      }
      async function run() {
        const sc = ctx.scenario;
        setPhase("attention");
        if (reduced) {
          // hareketi azalt: sahne yerinde sade bir geçişle karta döner
          ctx.card = ctx.cardEl;
          await waitStart();
          if (ctx.dead) return;
          hint.style.display = "none";
          setPhase("opening");
          ctx.anim(frame.querySelectorAll(".sc-slot").length ? frame : null, [{ opacity: 1 }, { opacity: 0.12 }], { d: 500, fill: "forwards" });
          if (ctx.hasCard) ctx.anim(ctx.cardWrap, [{ opacity: 0 }, { opacity: 1 }], { d: 500, fill: "forwards" });
          await ctx.wait(500);
          return holdCard();
        }
        startConcept();
        if (sc.attention) sc.attention(ctx);
        await waitStart();
        if (ctx.dead) return;
        // dikkat aşamasının sonsuz döngüleri durdurulur
        st.anims.forEach(a => { if (a.effect && a.effect.getTiming().iterations === Infinity) { try { a.cancel(); } catch (e) { /* önemsiz */ } } });
        hint.style.display = "none";
        setPhase("opening");
        let skipped = false;
        const skipP = new Promise(r => { st.skipToCard = () => { skipped = true; r(); }; });
        await Promise.race([sc.open(ctx), skipP]);
        st.skipToCard = null;
        if (ctx.dead) return;
        if (skipped && ctx.hasCard) {
          // dokunarak hızlandırma: kart doğrudan son hâline gelir
          ctx.cardWrap.getAnimations().forEach(a => { try { a.finish(); } catch (e) { /* sonsuz */ } });
          ctx.cardWrap.style.opacity = "1";
        }
        holdCard();
      }
      run().catch(err => { console.error("[Studio SEOZ] Açılış hatası:", err); finish(true); });
    }

    return handle;
  }

  function weakDevice() {
    const n = global.navigator || {};
    return (n.deviceMemory && n.deviceMemory <= 2) || (n.hardwareConcurrency && n.hardwareConcurrency <= 2) || false;
  }

  function buildScene(ctx, st) {
    const cfg = ctx.cfg, m = ctx.model;
    // arka plan yuvası tam ekran, diğer yuvalar çerçevede
    m.slots.forEach(slot => {
      const u = layerOf(cfg, slot);
      if (u.hidden) { ctx.uploaded[slot.id] = false; return; }
      if (slot.backdrop) {
        const src = u.src && !ctx.failed[u.src] ? u.src : "";
        const inner = h("div", "sc-anim sc-backdrop-inner");
        inner.dataset.source = src ? "png" : "art";
        if (src) inner.appendChild(img(src, "sc-upload", "cover"));
        else if (slot.art) { const a = slot.art(ctx); if (a) inner.appendChild(a); }
        st.backdrop.appendChild(inner);
        ctx.L[slot.id] = inner; ctx.S[slot.id] = st.backdrop; ctx.uploaded[slot.id] = !!src;
      } else st.frame.appendChild(buildSlot(ctx, slot));
    });
    const cardWrap = buildCard(ctx);
    ctx.cardWrap = cardWrap;
    st.frame.appendChild(cardWrap);
    if (m.build) m.build(ctx);
    // ek hareket (kurdele kesimi, anahtar)
    if (cfg.accessory !== "none" && ACCESSORIES[cfg.accessory]) {
      ctx.accEl = ACCESSORIES[cfg.accessory].build(ctx, (m.accessoryAt || { x: 200, y: 350 }));
    }
  }

  /* --------------- hazır ayarlar (bu cihazda) --------------- */
  const PRESET_KEY = "seoz_cinema_presets_v1";
  function listPresets() { try { return JSON.parse(localStorage.getItem(PRESET_KEY) || "[]"); } catch (e) { return []; } }
  function savePreset(name, cfg) {
    const list = listPresets().filter(p => p.name !== name);
    list.unshift({ name, savedAt: new Date().toISOString(), cfg: JSON.parse(JSON.stringify(cfg)) });
    try { localStorage.setItem(PRESET_KEY, JSON.stringify(list.slice(0, 50))); return true; } catch (e) { return false; }
  }
  function deletePreset(name) { try { localStorage.setItem(PRESET_KEY, JSON.stringify(listPresets().filter(p => p.name !== name))); } catch (e) { /* önemsiz */ } }

  global.SeozCinema = {
    FRAME_W, FRAME_H, DEFAULTS, E,
    registerModel, registerConcept, registerBusiness, registerParticle, registerAccessory,
    models: () => MODEL_ORDER.map(id => MODELS[id]), model: id => MODELS[id],
    concepts: () => CONCEPT_ORDER.map(id => CONCEPTS[id]), concept: id => CONCEPTS[id],
    businesses: () => BUSINESS_ORDER.map(id => BUSINESS[id]), business: id => BUSINESS[id],
    accessories: () => Object.keys(ACCESSORIES).map(id => Object.assign({ id }, ACCESSORIES[id])),
    normalize, scenarioOf, conceptOf, play, stop, isPlaying: () => !!active,
    preload, sourcesOf, layoutOf, setV2Adapter, modelOf, applyLayout,
    listPresets, savePreset, deletePreset,
    Sound, util: { h, svg, img, rnd, pick, mix, addPiece, initials }
  };
})(window);
