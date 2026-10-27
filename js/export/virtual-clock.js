/* =============================================================================
   STUDIO SEOZ — export/virtual-clock.js  (MP4 DIŞA AKTARMA · sanal saat)
   -----------------------------------------------------------------------------
   YALNIZCA video çıktısı sayfasında (editörün gizli çerçevesi) yüklenir; davetiye
   sitesine hiç girmez. Animasyon motorunu "gerçek zamanda" değil, kare kare
   sanal bir saatle çalıştırır: her kare tam olarak 1/30 sn ilerler, bilgisayar
   ne kadar yavaş olursa olsun hiçbir hareket atlanmaz, kaymaz.

   Sanallaştırılanlar:
     setTimeout / setInterval / requestAnimationFrame / performance.now / Date.now
     Web Animations (el.animate, CSS geçiş ve animasyonları): duraklatılır, her
       karede doğru ana konumlanır; bitenler "finish" ile sonlandırılır
     <video>: gerçek oynatma yerine her karede doğru saniyeye konumlanır
     Math.random: sabit tohumlu (prova ve çekim aynı sahneyi üretir)

   Motorun kendisine hiçbir değişiklik gerekmez. Bu dosya motor dosyalarından
   ÖNCE yüklenmelidir.
   ========================================================================= */
(function (W) {
  "use strict";
  if (W.__vclock) return;

  const real = {
    setTimeout: W.setTimeout.bind(W), clearTimeout: W.clearTimeout.bind(W),
    setInterval: W.setInterval.bind(W), clearInterval: W.clearInterval.bind(W),
    raf: W.requestAnimationFrame.bind(W), caf: W.cancelAnimationFrame.bind(W),
    perfNow: W.performance.now.bind(W.performance), dateNow: Date.now, random: Math.random
  };
  const C = {
    now: 0, base: real.dateNow(), seq: 0, timers: new Map(), rafs: new Map(), anims: new Map(), videos: new Set(),
    real, cardMark: null, log: []
  };
  W.__vclock = C;

  /* ---------------- cihaz: video her zaman tam kalitede çizilir ---------------- */
  // (zayıf cihaz algısı → "hafif mod", hareketi azalt tercihi ve ekran yoğunluğu çıktıyı değiştirmesin)
  const dpr = Number(W.__exportDPR) || 2;
  try { Object.defineProperty(W, "devicePixelRatio", { configurable: true, get: () => dpr }); } catch (e) { /* önemsiz */ }
  try { Object.defineProperty(W.navigator, "hardwareConcurrency", { configurable: true, get: () => 8 }); } catch (e) { /* önemsiz */ }
  try { Object.defineProperty(W.navigator, "deviceMemory", { configurable: true, get: () => 8 }); } catch (e) { /* önemsiz */ }
  const mm = W.matchMedia ? W.matchMedia.bind(W) : null;
  if (mm) W.matchMedia = q => (/prefers-reduced-motion/.test(q) ? { matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} } : mm(q));

  /* ---------------- zaman ---------------- */
  try { Object.defineProperty(W.performance, "now", { configurable: true, value: () => C.now }); } catch (e) { /* önemsiz */ }
  Date.now = () => C.base + Math.round(C.now);

  /* sabit tohumlu rastgele sayı (mulberry32) */
  let seed = 0x5e02;
  C.seed = s => { seed = s >>> 0; };
  Math.random = function () {
    seed = (seed + 0x6D2B79F5) >>> 0; let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  function addTimer(fn, ms, args, every) {
    const id = ++C.seq;
    const d = Math.max(0, Number(ms) || 0);
    C.timers.set(id, { id, due: C.now + d, fn, args, every: every ? Math.max(1, d) : 0 });
    return id;
  }
  W.setTimeout = function (fn, ms, ...args) { return typeof fn === "function" ? addTimer(fn, ms, args, false) : 0; };
  W.setInterval = function (fn, ms, ...args) { return typeof fn === "function" ? addTimer(fn, ms, args, true) : 0; };
  W.clearTimeout = W.clearInterval = function (id) { C.timers.delete(id); };
  W.requestAnimationFrame = function (fn) { const id = ++C.seq; C.rafs.set(id, fn); return id; };
  W.cancelAnimationFrame = function (id) { C.rafs.delete(id); };

  /* ---------------- Web Animations ---------------- */
  const AP = W.Animation.prototype;
  const orig = {
    animate: W.Element.prototype.animate, pause: AP.pause, play: AP.play, finish: AP.finish, cancel: AP.cancel, reverse: AP.reverse,
    ctSet: Object.getOwnPropertyDescriptor(AP, "currentTime").set, ctGet: Object.getOwnPropertyDescriptor(AP, "currentTime").get,
    rateSet: Object.getOwnPropertyDescriptor(AP, "playbackRate").set, rateGet: Object.getOwnPropertyDescriptor(AP, "playbackRate").get,
    stateGet: Object.getOwnPropertyDescriptor(AP, "playState").get, upd: AP.updatePlaybackRate
  };
  function endOf(a) { try { return a.effect ? a.effect.getComputedTiming().endTime : 0; } catch (e) { return 0; } }
  function rec(a) {
    let r = C.anims.get(a);
    if (!r) {
      let ct = 0; try { ct = orig.ctGet.call(a) || 0; } catch (e) { /* önemsiz */ }
      r = { v0: C.now - ct, rate: 1, held: null, done: false };
      try { r.rate = orig.rateGet.call(a); } catch (e) { /* önemsiz */ }
      C.anims.set(a, r);
      try { orig.pause.call(a); orig.ctSet.call(a, ct); } catch (e) { /* önemsiz */ }
      if (C.cardMark && C.cardMark.at == null && a.effect && a.effect.target && C.cardMark.test(a.effect.target, a)) {
        let d = 0; try { d = Math.max(0, Number(a.effect.getTiming().delay) || 0); } catch (e) { /* önemsiz */ }
        C.cardMark.at = C.now + d - ct;
      }
    }
    return r;
  }
  const localTime = r => (r.held != null ? r.held : (C.now - r.v0) * r.rate);
  W.Element.prototype.animate = function () { const a = orig.animate.apply(this, arguments); rec(a); return a; };
  AP.pause = function () { const r = C.anims.get(this); if (!r) return orig.pause.call(this); if (r.held == null) r.held = localTime(r); try { orig.ctSet.call(this, r.held); } catch (e) { /* önemsiz */ } };
  AP.play = function () {
    const r = C.anims.get(this); if (!r) return orig.play.call(this);
    let t = r.held != null ? r.held : localTime(r);
    const end = endOf(this);
    if (r.done || (r.rate > 0 && isFinite(end) && t >= end)) t = r.rate > 0 ? 0 : end;
    if (r.rate < 0 && t <= 0) t = end;
    r.done = false; r.held = null; r.v0 = C.now - t / (r.rate || 1);
    try { orig.ctSet.call(this, t); } catch (e) { /* önemsiz */ }
  };
  AP.finish = function () { const r = C.anims.get(this); if (r) { r.done = true; r.held = null; } return orig.finish.call(this); };
  AP.cancel = function () { C.anims.delete(this); return orig.cancel.call(this); };
  AP.reverse = function () { const r = C.anims.get(this); if (!r) return orig.reverse.call(this); const t = localTime(r); r.rate = -(r.rate || 1); r.held = null; r.done = false; r.v0 = C.now - t / r.rate; };
  AP.updatePlaybackRate = function (rate) { const r = C.anims.get(this); if (!r) return orig.upd.call(this, rate); const t = localTime(r); r.rate = Number(rate) || 0; if (r.held == null && r.rate) r.v0 = C.now - t / r.rate; };
  Object.defineProperty(AP, "currentTime", {
    configurable: true,
    get() { const r = C.anims.get(this); return r && !r.done ? localTime(r) : orig.ctGet.call(this); },
    set(v) {
      const r = C.anims.get(this); if (!r) return orig.ctSet.call(this, v);
      const t = Number(v) || 0; r.done = false;
      if (r.held != null) r.held = t; else r.v0 = C.now - t / (r.rate || 1);
      try { orig.ctSet.call(this, t); } catch (e) { /* önemsiz */ }
    }
  });
  Object.defineProperty(AP, "playbackRate", {
    configurable: true,
    get() { const r = C.anims.get(this); return r ? r.rate : orig.rateGet.call(this); },
    set(v) { const r = C.anims.get(this); if (!r) return orig.rateSet.call(this, v); const t = localTime(r); r.rate = Number(v) || 0; if (r.held == null && r.rate) r.v0 = C.now - t / r.rate; }
  });
  Object.defineProperty(AP, "playState", {
    configurable: true,
    get() { const r = C.anims.get(this); if (!r) return orig.stateGet.call(this); return r.done ? "finished" : (r.held != null ? "paused" : "running"); }
  });

  /* CSS geçişleri / animasyonları kendiliğinden oluşur: her olaydan sonra yakalanır */
  C.scan = function () {
    let list = [];
    try { list = W.document.getAnimations(); } catch (e) { return; }
    for (const a of list) if (!C.anims.has(a)) rec(a);
  };
  /* bütün animasyonları sanal saate getir; bitenleri sonlandır (olaylar ve "finished" sözleri gerçek olsun) */
  C.sync = function () {
    for (const [a, r] of C.anims) {
      if (r.done) continue;
      if (a.effect == null) { C.anims.delete(a); continue; }
      const t = localTime(r), end = endOf(a);
      if (r.held == null && isFinite(end) && ((r.rate > 0 && t >= end) || (r.rate < 0 && t <= 0))) {
        r.done = true;
        try { orig.ctSet.call(a, r.rate > 0 ? end : 0); orig.finish.call(a); } catch (e) { /* önemsiz */ }
        continue;
      }
      try { orig.ctSet.call(a, Math.max(0, t)); } catch (e) { /* önemsiz */ }
    }
  };

  /* ---------------- <video> ---------------- */
  const MP = W.HTMLMediaElement.prototype;
  const morig = { play: MP.play, pause: MP.pause, ctSet: Object.getOwnPropertyDescriptor(MP, "currentTime").set, ctGet: Object.getOwnPropertyDescriptor(MP, "currentTime").get };
  function vrec(el) { if (!el.__v) el.__v = { v0: null, held: 0 }; C.videos.add(el); return el.__v; }
  MP.play = function () { const v = vrec(this); if (v.v0 == null) v.v0 = C.now - v.held * 1000; return Promise.resolve(); };
  MP.pause = function () { const v = vrec(this); if (v.v0 != null) { v.held = (C.now - v.v0) / 1000; v.v0 = null; } };
  Object.defineProperty(MP, "currentTime", {
    configurable: true,
    get() { return this.__v ? C.videoTime(this) : morig.ctGet.call(this); },
    set(t) { const v = vrec(this); const s = Math.max(0, Number(t) || 0); if (v.v0 != null) v.v0 = C.now - s * 1000; else v.held = s; }
  });
  Object.defineProperty(MP, "paused", { configurable: true, get() { return !(this.__v && this.__v.v0 != null); } });
  C.videoTime = function (el) {
    const v = el.__v; if (!v) return 0;
    let s = v.v0 != null ? (C.now - v.v0) / 1000 : v.held;
    const d = el.duration;
    if (isFinite(d) && d > 0) s = el.loop ? s % d : Math.min(s, Math.max(0, d - 0.001));
    return Math.max(0, s);
  };
  /* videoyu sanal saniyesine konumla (karenin gerçekten çözülmesini bekler) */
  C.seekVideo = function (el) {
    return new Promise(res => {
      if (!el.__v) vrec(el);
      if (el.readyState < 1) {   // henüz yüklenmedi
        let done = false;
        const fin = () => { if (done) return; done = true; el.removeEventListener("loadeddata", fin); res(C.seekVideo(el)); };
        el.addEventListener("loadeddata", fin); real.setTimeout(() => { if (!done) { done = true; res(false); } }, 8000);
        return;
      }
      const target = C.videoTime(el);
      let cur = 0; try { cur = morig.ctGet.call(el); } catch (e) { /* önemsiz */ }
      if (Math.abs(cur - target) < 0.004 && el.readyState >= 2) return res(true);
      let done = false;
      const fin = ok => { if (done) return; done = true; el.removeEventListener("seeked", on); res(ok); };
      const on = () => fin(true);
      el.addEventListener("seeked", on);
      real.setTimeout(() => fin(false), 6000);
      try { morig.ctSet.call(el, target); } catch (e) { fin(false); }
    });
  };

  /* ---------------- ilerletme ---------------- */
  const mc = new MessageChannel(); const q = [];
  mc.port1.onmessage = () => { const f = q.shift(); if (f) f(); };
  const yieldTask = () => new Promise(r => { q.push(r); mc.port2.postMessage(0); });
  C.yieldTask = yieldTask;
  /* gerçek bir ekran karesini bekle: animasyon olayları (finish, transitionend) tarayıcının çizim adımında gönderilir */
  C.realFrame = () => new Promise(r => { let ok = false; const f = () => { if (!ok) { ok = true; r(); } }; real.raf(f); real.setTimeout(f, 120); });

  function nextTimer(limit) {
    let best = null;
    for (const t of C.timers.values()) if (t.due <= limit && (!best || t.due < best.due || (t.due === best.due && t.id < best.id))) best = t;
    return best;
  }
  function safe(fn, args) { try { fn.apply(W, args || []); } catch (e) { C.log.push(String(e && e.message || e)); console.error(e); } }

  /* saati "t" anına kadar ilerlet: araya düşen bütün zamanlayıcılar sırasıyla çalışır */
  C.advanceTo = async function (t, opts) {
    opts = opts || {};
    let guard = 0;
    for (;;) {
      const tm = nextTimer(t);
      if (!tm) break;
      if (++guard > 20000) { C.log.push("zamanlayıcı döngüsü"); break; }
      if (tm.due > C.now) C.now = tm.due;
      if (tm.every) tm.due += tm.every; else C.timers.delete(tm.id);
      C.sync();
      safe(tm.fn, tm.args);
      await yieldTask();   // sözler (Promise) ve ardından gelen adımlar aynı sanal anda çalışsın
      C.scan(); C.sync();
    }
    C.now = Math.max(C.now, t);
    C.scan(); C.sync();
    // ekran karesi geri çağrıları (parçacıklar, sürekli döngüler)
    const fs = Array.from(C.rafs.values()); C.rafs.clear();
    fs.forEach(f => safe(f, [C.now]));
    await yieldTask();
    C.scan(); C.sync();
    if (opts.realFrame) { await C.realFrame(); await yieldTask(); C.scan(); C.sync(); }
  };
})(window);
