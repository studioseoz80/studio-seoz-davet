/* =============================================================================
   STUDIO SEOZ — core/model3d.js  (3D MODEL KATMANI)
   -----------------------------------------------------------------------------
   Animasyon Stüdyosu'nda "3D Model" katmanı: GLB dosyası gerçek 3D olarak
   çizilir ve kendi ekseni (X / Y / Z) etrafında 360° döner.

     katman.model = { type:"glb", axis:"y", dir:1, period:6, loop:true, turns:1,
                      tiltX:0, tiltY:0, tiltZ:0, poster, tris }

   - 3D motoru (Three.js, js/vendor/three/) YALNIZCA sahnede model varsa,
     ilk model çizilirken yüklenir. Model olmayan davetiyeler hiçbir şey
     indirmez, hiçbir şey değişmez.
   - Dönüş açısı performance.now()'dan hesaplanır: önizleme, yayın ve MP4
     çıktısı aynı hareketi verir.
   - Ekranda görünmeyen ya da sayfadan kaldırılan model çizilmez; kaldırılan
     modelin grafik belleği serbest bırakılır.
   - WebGL yoksa / model açılamazsa kapak görseli (poster) gösterilir; sahne
     asla bozulmaz. Model inerken de kapak görseli görünür.
   - Müşteri sayfası bu dosyayı yalnızca davetiyede model varsa yükler
     (cinema-core.js → ensureModel3D); model olmayan davetiye hiçbir şey indirmez.
   ========================================================================= */
(function (global) {
  "use strict";

  const MAX_MB = 15, WARN_MB = 5, WARN_TRIS = 150000, MAX_TRIS = 600000;
  const ACCEPT = ".glb,model/gltf-binary";
  const DEFAULTS = { type: "glb", axis: "y", dir: 1, period: 6, loop: true, turns: 1, tiltX: 0, tiltY: 0, tiltZ: 0 };
  // motorun yeri: bu dosyanın yanındaki ../vendor/three/ (yayında da editörde de aynı göreli yol)
  const SCRIPT_SRC = (document.currentScript && document.currentScript.src) || "";
  const VENDOR = SCRIPT_SRC ? new URL("../vendor/three/", SCRIPT_SRC).href : new URL("js/vendor/three/", document.baseURI).href;

  const isModel = m => !!(m && typeof m === "object" && m.type === "glb");
  const opts = m => Object.assign({}, DEFAULTS, isModel(m) ? m : {});
  const isGlbFile = f => !!f && (/\.glb$/i.test(f.name || "") || /model\/gltf-binary/i.test(f.type || ""));

  /* ---------------- motor (tembel yükleme) ---------------- */
  let enginePromise = null;
  function engine() {
    if (!enginePromise) {
      enginePromise = Promise.all([
        import(VENDOR + "three.module.min.js"),
        import(VENDOR + "GLTFLoader.js"),
        import(VENDOR + "RoomEnvironment.js")
      ]).then(([THREE, G, R]) => ({ THREE, GLTFLoader: G.GLTFLoader, RoomEnvironment: R.RoomEnvironment }));
      enginePromise.catch(() => { enginePromise = null; });
    }
    return enginePromise;
  }
  function hasWebGL() {
    try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (e) { return false; }
  }
  const weak = () => (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);

  /* model dosyası bir kez indirilir (açılış hazırlanırken önceden başlatılabilir) */
  const bufCache = new Map();
  function fetchBuf(url) {
    if (!bufCache.has(url)) {
      const p = fetch(url, { mode: "cors", credentials: "omit" }).then(r => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.arrayBuffer();
      }).then(b => {
        if (b.byteLength < 20 || new DataView(b).getUint32(0, true) !== 0x46546C67) throw new Error("GLB değil");
        return b;
      });
      bufCache.set(url, p);
      p.catch(() => bufCache.delete(url));
    }
    return bufCache.get(url);
  }
  /* açılış hazırlığı: motoru ve model dosyasını birlikte indirmeye başla; hata olsa da çözülür */
  function prefetch(url) {
    if (!url) return Promise.resolve(false);
    const jobs = [fetchBuf(url)];
    if (hasWebGL()) jobs.push(engine());
    return Promise.all(jobs).then(() => true, () => false);
  }
  /* model dosyasını sahne nesnesine çevir; aynı adres için tek kez okunur */
  const sceneCache = new Map();
  function loadGltf(E, url) {
    if (!sceneCache.has(url)) {
      const p = fetchBuf(url).then(buf => new Promise((res, rej) => new E.GLTFLoader().parse(buf, "", g => res(g), err => rej(err))));
      sceneCache.set(url, p);
      p.catch(() => sceneCache.delete(url));
    }
    return sceneCache.get(url).then(g => g.scene.clone(true));
  }
  function boundRadius(T, obj) {
    obj.updateMatrixWorld(true);
    const v = new T.Vector3(); let m = 0;
    obj.traverse(o => {
      if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
      const p = o.geometry.attributes.position, step = Math.max(1, Math.floor(p.count / 20000));
      for (let i = 0; i < p.count; i += step) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); m = Math.max(m, v.length()); }
    });
    return m * 1.02;
  }
  function countTris(obj) {
    let n = 0;
    obj.traverse(o => { if (o.isMesh && o.geometry) { const g = o.geometry; n += (g.index ? g.index.count : (g.attributes.position ? g.attributes.position.count : 0)) / 3; } });
    return Math.round(n);
  }

  /* ---------------- çizim örneği ---------------- */
  const live = new Set();
  let rafId = 0;
  function loop() {
    rafId = 0;
    const now = performance.now();
    for (const it of live) {
      if (!it.el.isConnected) { if (++it.gone > 2) dispose(it); continue; }
      it.gone = 0;
      if (!it.ready || !it.visible || document.visibilityState === "hidden") continue;
      if (it.cap && it.lastT && now - it.lastT < it.cap) continue;   // zayıf cihaz: saniyede en çok ~30 kare
      adapt(it, now);
      draw(it, now);
    }
    if (live.size) rafId = requestAnimationFrame(loop);
  }
  /* zayıf telefonda akıcılık: kareler uzun sürerse çizim çözünürlüğü kademeli düşer (en fazla 1× ekran pikseline) */
  function adapt(it, now) {
    if (global.__vclock || !it.lastT) return;
    const dt = now - it.lastT;
    if (dt > 1500) { it.slow = 0; return; }             // sekme değişimi / uzun duraklama: sayma
    it.ema = it.ema ? it.ema * 0.9 + dt * 0.1 : dt;
    it.slow = it.ema > 26 ? (it.slow || 0) + dt : 0;      // ~38 kare/sn altında geçen süre
    if (it.slow > 1200 && (it.q || 1) > (it.qMin || 1)) { it.q = Math.max(it.qMin || 1, (it.q || 1) * 0.75); it.slow = 0; it.ema = 0; it.w = 0; }
    else if (it.slow > 1200 && !it.cap) { it.cap = 30; it.slow = 0; it.ema = 0; }   // en düşük çözünürlükte de yavaşsa: 30 kare/sn
  }
  function kick() { if (!rafId && live.size) rafId = requestAnimationFrame(loop); }

  function angleAt(o, t) {
    const per = Math.max(0.5, Number(o.period) || 6) * 1000;
    const dir = Number(o.dir) < 0 ? -1 : 1;
    if (o.loop !== false) return dir * 2 * Math.PI * (t / per);
    const turns = Math.max(0.25, Number(o.turns) || 1), total = per * turns;
    const k = Math.min(1, Math.max(0, t / total));
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;   // yumuşak başlayıp yumuşak durur
    return dir * 2 * Math.PI * turns * e;
  }
  function pose(it, now) {
    const o = it.o, a = angleAt(o, Math.max(0, now - it.t0));
    // yön = 1: ön yüz sağa (Y), üst kısım öne (X), saat yönünde (Z — ekrana bakınca)
    it.spin.rotation.set(o.axis === "x" ? a : 0, o.axis === "y" ? a : 0, o.axis === "z" ? -a : 0);
  }
  function draw(it, now) {
    resize(it);
    pose(it, now);
    it.renderer.render(it.scene, it.camera);
    it.lastT = now; it.frames = (it.frames || 0) + 1;
  }
  /* katman büyütülmüşse (Ölçek / yakınlaşma hareketi) çizim çözünürlüğü de büyür: bulanıklaşmaz */
  function zoomOf(it, now) {
    if (it.zT && now - it.zT < 500) return it.z || 1;
    it.zT = now;
    const r = it.el.getBoundingClientRect(), w = it.el.clientWidth || 1, h = it.el.clientHeight || 1;
    const k = Math.max(r.width / w, r.height / h) || 1;
    const z = Math.min(3, Math.max(1, Math.round(k * 4) / 4));   // çeyrek adımlarla: küçük titreşimler yeniden boyutlandırmaz
    if (z !== it.z) { it.z = z; it.w = 0; }
    return z;
  }
  function resize(it) {
    zoomOf(it, performance.now());
    const w = it.el.clientWidth || 1, h = it.el.clientHeight || 1;
    if (w === it.w && h === it.h) return;
    it.w = w; it.h = h;
    // telefonda piksel yoğunluğu ve toplam piksel sınırlı (akıcılık + pil)
    const base = Math.min(global.devicePixelRatio || 1, weak() ? 1.5 : 2);
    it.qMin = Math.min(1, 1 / base);                    // en fazla ekran pikseline kadar iner (bulanıklaşmaz)
    let dpr = base * Math.max(it.qMin, it.q || 1) * (it.z || 1);
    const maxPx = global.__vclock ? 4.2e6 : 1.6e6;
    if (w * h * dpr * dpr > maxPx) dpr = Math.sqrt(maxPx / (w * h));
    it.renderer.setPixelRatio(dpr);
    it.renderer.setSize(w, h, false);
    it.camera.aspect = w / h;
    fitCamera(it);
  }
  function fitCamera(it) {
    const r = it.radius || 1, fov = it.camera.fov * Math.PI / 180;
    const fitH = r / Math.sin(fov / 2), fitW = r / Math.sin(Math.atan(Math.tan(fov / 2) * it.camera.aspect));
    it.camera.position.set(0, 0, Math.max(fitH, fitW) * 1.04);
    it.camera.near = 0.01 * r; it.camera.far = 100 * r;
    it.camera.updateProjectionMatrix();
  }
  function dispose(it) {
    live.delete(it);
    try { if (it.io) it.io.disconnect(); } catch (e) { /* önemsiz */ }
    try {
      it.scene && it.scene.traverse(o => {
        if (!o.isMesh) return;
        if (o.geometry) o.geometry.dispose();
        [].concat(o.material || []).forEach(m => { Object.keys(m).forEach(k => { if (m[k] && m[k].isTexture) m[k].dispose(); }); m.dispose(); });
      });
    } catch (e) { /* önemsiz */ }
    try { if (it.envTex) it.envTex.dispose(); } catch (e) { /* önemsiz */ }
    try { if (it.renderer) { it.renderer.dispose(); it.renderer.forceContextLoss && it.renderer.forceContextLoss(); } } catch (e) { /* önemsiz */ }
    it.ready = false;
  }
  /* kapak görseli: model inene kadar ve model açılamazsa görünür */
  function posterImg(it) {
    if (!it.posterEl) {
      const im = document.createElement("img"); im.alt = ""; im.draggable = false; im.className = "sc-model-poster";
      Object.assign(im.style, { position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "contain", display: "block", pointerEvents: "none" });
      it.el.insertBefore(im, it.el.firstChild);
      it.posterEl = im;
    }
    return it.posterEl;
  }
  function setPoster(el, url) {
    const it = el && el.__model; if (!it || !url) return;
    it.posterUrl = url;
    if (!it.ready) { const im = posterImg(it); if (im.getAttribute("src") !== url) im.src = url; }
  }
  function fallback(it, why) {
    it.failed = why || "hata";
    it.el.dataset.modelFailed = it.failed;
    if (it.canvas) it.canvas.style.display = "none";
    if (it.posterUrl) { const im = posterImg(it); im.src = it.posterUrl; im.style.display = "block"; }
    dispose(it);
    it.resolve();
  }

  async function start(it, url) {
    try {
      if (!hasWebGL()) return fallback(it, "webgl");
      const E = await engine();
      const T = E.THREE;
      // yüksek yoğunluklu (2×+) ekranda kenar yumuşatma gözle fark edilmez ama telefonu yorar
      const aa = !!global.__vclock || (global.devicePixelRatio || 1) < 2;
      const renderer = new T.WebGLRenderer({ canvas: it.canvas, alpha: true, antialias: aa, premultipliedAlpha: true,
        preserveDrawingBuffer: !!global.__vclock, powerPreference: weak() ? "low-power" : "high-performance" });
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      it.renderer = renderer;
      it.canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); fallback(it, "context"); }, { once: true });
      const scene = new T.Scene();
      const pm = new T.PMREMGenerator(renderer);
      it.envTex = pm.fromScene(new E.RoomEnvironment(), 0.04).texture;   // metal ve ayna yüzeyler için yansıma ortamı
      pm.dispose();
      scene.environment = it.envTex;
      const key = new T.DirectionalLight(0xffffff, 1.6); key.position.set(2.5, 3, 4); scene.add(key);
      scene.add(new T.AmbientLight(0xffffff, 0.25));
      const model = await loadGltf(E, url);
      if (!it.el.isConnected && it.gone > 2) { it.resolve(); return; }
      // ortala ve birim boyuta getir
      const box = new T.Box3().setFromObject(model), c = box.getCenter(new T.Vector3()), s = box.getSize(new T.Vector3());
      const r = Math.max(s.x, s.y, s.z) / 2 || 1;
      model.position.sub(c);
      const tilt = new T.Group(), spin = new T.Group();
      const d = Math.PI / 180, o = it.o;
      tilt.rotation.set((Number(o.tiltX) || 0) * d, (Number(o.tiltY) || 0) * d, (Number(o.tiltZ) || 0) * d);
      spin.add(model); tilt.add(spin); scene.add(tilt);
      it.radius = boundRadius(T, model) || r;   // dönüşten bağımsız gerçek yarıçap: döndükçe hiçbir köşe kadraj dışına taşmaz
      it.camera = new T.PerspectiveCamera(28, 1, 0.01, 100);
      it.scene = scene; it.spin = spin; it.tris = countTris(model);
      it.ready = true;
      it.el.dataset.modelReady = "1";
      draw(it, performance.now());
      if (it.posterEl) it.posterEl.style.display = "none";
      kick();
      it.resolve();
    } catch (e) {
      console.warn("3D model açılamadı:", e && e.message || e);
      fallback(it, "yukleme");
    }
  }

  /* ekrandaki öğe: <div class="sc-model"><canvas></canvas></div> */
  function makeEl(url, model, style, cls, posterUrl) {
    const el = document.createElement("div");
    el.className = ((cls || "") + " sc-model").trim();
    el.dataset.seozModel = "1";
    Object.assign(el.style, { position: "relative", overflow: "visible" }, style || {});
    const canvas = document.createElement("canvas");
    Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", display: "block", pointerEvents: "none" });
    el.appendChild(canvas);
    let resolve; const ready = new Promise(r => { resolve = r; });
    const it = { el, canvas, o: opts(model), posterUrl: posterUrl || "", t0: performance.now(), visible: true, gone: 0, ready: false, resolve, readyP: ready };
    el.__model = it;
    if (it.posterUrl) setPoster(el, it.posterUrl);
    live.add(it);
    if ("IntersectionObserver" in global) {
      it.io = new IntersectionObserver(es => { es.forEach(x => { it.visible = x.isIntersecting; }); if (it.visible) kick(); });
      it.io.observe(el);
    }
    const go = u => { if (u) start(it, u); else fallback(it, "adres"); };
    if (url && typeof url.then === "function") url.then(go, () => fallback(it, "adres")); else go(url);
    return el;
  }
  /* dönüşü baştan başlat (örn. açılış başlarken) */
  function restart(root) { all(root).forEach(it => { it.t0 = performance.now(); }); }
  function all(root) { return Array.from((root || document).querySelectorAll("[data-seoz-model]")).map(e => e.__model).filter(Boolean); }
  /* bütün modeller açıldı (ya da yedeğe düştü) — MP4 çıktısı bunu bekler */
  function ready(root, timeoutMs) {
    const list = all(root).map(it => it.readyP);
    if (!list.length) return Promise.resolve(true);
    return Promise.race([Promise.all(list).then(() => true), new Promise(r => { const vc = global.__vclock, st = vc && vc.real ? vc.real.setTimeout.bind(global) : setTimeout; st(() => r(false), timeoutMs || 20000); })]);
  }
  /* bölünen parçalar için o anki karenin görüntüsü */
  function snapshot(el, style) {
    const it = el && el.__model, im = document.createElement("img");
    im.alt = ""; if (style) Object.assign(im.style, style);
    try {
      if (it && it.ready) {
        // aynı anda birden çok parça (ör. dörde bölünme) aynı kareyi paylaşır: kare bir kez kodlanır
        const now = performance.now();
        if (!it.snap || now - it.snapT > 30) { draw(it, now); it.snap = it.canvas.toDataURL("image/png"); it.snapT = now; }
        im.src = it.snap;
      } else if (it && it.posterUrl) im.src = it.posterUrl;
    } catch (e) { if (it && it.posterUrl) im.src = it.posterUrl; }
    return im;
  }
  function stop(root) { all(root).forEach(dispose); }

  /* ---------------- editör: GLB dosyasını hazırla ----------------
     Dosya olduğu gibi saklanır; ilk duruştan bir kapak görseli üretilir. */
  async function processModelFile(file, o) {
    o = o || {};
    if (!file) throw new Error("Dosya seçilmedi.");
    if (/\.gltf$/i.test(file.name || "")) throw new Error("Bu aşamada yalnızca tek dosyalık GLB yüklenebilir. GLTF dosyanızı ücretsiz bir dönüştürücüyle GLB'ye çevirip tekrar deneyin.");
    if (!isGlbFile(file)) throw new Error("Yalnızca GLB 3D model dosyası yüklenebilir (.glb).");
    const mb = file.size / 1048576;
    if (mb > (o.maxMB || MAX_MB)) throw new Error(`Model ${mb.toFixed(1)} MB; en fazla ${o.maxMB || MAX_MB} MB olabilir. Daha sade (az yüzeyli, küçük dokulu) bir model deneyin.`);
    const buf = await file.arrayBuffer();
    const dv = new DataView(buf);
    if (buf.byteLength < 20 || dv.getUint32(0, true) !== 0x46546C67) throw new Error("Bu dosya geçerli bir GLB değil (dosya başlığı okunamadı).");
    if (dv.getUint32(4, true) !== 2) throw new Error("Bu GLB sürümü desteklenmiyor (glTF 2.0 gerekir).");
    if (!hasWebGL()) throw new Error("Bu tarayıcıda 3D çizim (WebGL) kapalı; model önizlenemiyor.");
    const blob = new Blob([buf], { type: "model/gltf-binary" });
    const url = URL.createObjectURL(blob);
    let poster = "", tris = 0, posterBlob = null;
    try {
      const E = await engine();
      const T = E.THREE;
      const cv = document.createElement("canvas"); cv.width = cv.height = 512;
      const ren = new T.WebGLRenderer({ canvas: cv, alpha: true, antialias: true, preserveDrawingBuffer: true });
      ren.setClearColor(0x000000, 0); ren.outputColorSpace = T.SRGBColorSpace; ren.toneMapping = T.ACESFilmicToneMapping;
      const sc = new T.Scene();
      const pm = new T.PMREMGenerator(ren); const env = pm.fromScene(new E.RoomEnvironment(), 0.04).texture; pm.dispose(); sc.environment = env;
      const key = new T.DirectionalLight(0xffffff, 1.6); key.position.set(2.5, 3, 4); sc.add(key); sc.add(new T.AmbientLight(0xffffff, 0.25));
      const g = await new Promise((res, rej) => new E.GLTFLoader().load(url, res, undefined, rej));
      const m = g.scene; tris = countTris(m);
      const box = new T.Box3().setFromObject(m), c = box.getCenter(new T.Vector3()), s = box.getSize(new T.Vector3()), r = Math.max(s.x, s.y, s.z) / 2 || 1;
      m.position.sub(c); sc.add(m);
      const cam = new T.PerspectiveCamera(28, 1, 0.01 * r, 100 * r); cam.position.set(0, 0, (r * 1.1) / Math.sin(14 * Math.PI / 180));
      ren.render(sc, cam);
      posterBlob = await new Promise(rs => cv.toBlob(rs, "image/png"));
      sc.traverse(x => { if (x.isMesh) x.geometry.dispose(); }); env.dispose(); ren.dispose(); ren.forceContextLoss();
    } catch (e) {
      URL.revokeObjectURL(url);
      throw new Error("Model açılamadı: dosya bozuk ya da desteklenmeyen bir sıkıştırma kullanıyor olabilir (Draco / Meshopt sıkıştırmasız GLB deneyin).");
    }
    URL.revokeObjectURL(url);
    if (tris > MAX_TRIS) throw new Error(`Model ${tris.toLocaleString("tr-TR")} üçgen; telefonlar için çok ağır (en fazla ${MAX_TRIS.toLocaleString("tr-TR")}). Daha sade bir model kullanın.`);
    const ref = await global.SeozBlobStore.putBlob(blob);
    if (posterBlob) poster = await global.SeozBlobStore.putBlob(posterBlob);
    const warnings = [], notes = [];
    if (tris > WARN_TRIS) warnings.push(`Model ${tris.toLocaleString("tr-TR")} üçgen; eski telefonlarda dönüş takılabilir (öneri: 150.000 altı).`);
    if (mb > WARN_MB) notes.push(`Model ${mb.toFixed(1)} MB; yavaş bağlantıda geç açılabilir (öneri: 5 MB altı).`);
    notes.push("3D motoru yalnızca bu tür bir katman olduğunda yüklenir (yaklaşık 200 KB).");
    return { ref, poster, info: { w: 1, h: 1, tris, bytes: file.size, name: file.name, model: true }, warnings, notes };
  }
  function newModel(res, prev) {
    const p = isModel(prev) ? prev : {};
    return Object.assign({}, DEFAULTS, p, { type: "glb", poster: res.poster || "", tris: res.info.tris });
  }

  global.SeozModel3D = { ACCEPT, DEFAULTS, MAX_MB, isModel, opts, isGlbFile, makeEl, setPoster, prefetch, snapshot, ready, restart, stop, processModelFile, newModel, engine, angleAt,
    _live: () => live.size };
})(window);
