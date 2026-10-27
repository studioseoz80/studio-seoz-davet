/* =============================================================================
   STUDIO SEOZ — core/motion.js  (ORTAK HAREKET SİSTEMİ · ✨ OTOMATİK SAHNE UYUMU)
   -----------------------------------------------------------------------------
   Açılış (Animasyon Stüdyosu), İç Zemin (katman hareketleri + 3D hareketler) ve
   Etkileşimler (Kurdele Kes, Mum, Hediye…) AYNI hareket diliyle çalışsın diye:

     1) Üç HAREKET KARAKTERİ  — Zarif / Neşeli / Görkemli. Katmanlara dokunmaz;
        tempo, örtüşme, enerji (genlik), yoğunluk ve eğrileri belirler.
     2) DOĞAL EĞRİLER ve ANAHTAR KARE ÜRETİCİLERİ — fiziksel sekme, sönümlü
        sarkaç, yumuşak titreşim, alev titremesi, dikişsiz döngü. Motorlar bunları
        YALNIZCA belgede sahne uyumu açıkken kullanır.
     3) SAHNE PLANLAYICI (Otomatik Sahne Uyumu) — hareketleri ana / dekoratif
        diye ayırır; gecikme, süre ve eğrileri birbirine bağlar; aynı katmandaki
        çakışmaları sıraya koyar; elle yapılmış ayarlara dokunmaz; geri alınabilir.

   ALTIN KURAL: belgede `motion` alanı yoksa (eski davetiyeler) ya da kapalıysa
   hiçbir motor bu dosyadaki hiçbir şeyi kullanmaz → görünüm birebir aynı kalır.

   doc.motion = { v: 1, on: true|false, character: "zarif"|"neseli"|"gorkemli", at }
   Planlayıcının izleri (geri alma için) ilgili kaydın kendisinde durur:
     action.auto = { start, delay, duration, easing }   → uyumun yazdığı değerler
     action.pre  = { start, delay, duration, easing }   → uyumdan ÖNCEKİ değerler
   Kullanıcı bir alanı uyumdan sonra değiştirirse (değer auto'dan farklıysa) o alan
   "elle ayar" sayılır ve bir daha kendiliğinden değiştirilmez.
   ========================================================================= */
(function (global) {
  "use strict";

  /* =============================== karakterler =============================== */
  const CHARACTERS = {
    zarif: { id: "zarif", label: "Zarif", icon: "🕊️", desc: "Yumuşak, sakin, romantik",
      tempo: 1.2, overlap: 0.38, energy: 0.8, density: 0.85, cardLead: 0.34, beat: 900,
      ease: { open: "dogal-acilis", enter: "dogal-giris", loop: "sinus" }, settle: 0.02, bounce: 0.3 },
    neseli: { id: "neseli", label: "Neşeli", icon: "🎈", desc: "Canlı, enerjik ama kontrollü",
      tempo: 0.85, overlap: 0.3, energy: 1.15, density: 1.15, cardLead: 0.3, beat: 500,
      ease: { open: "canli-acilis", enter: "yaylanma", loop: "sinus" }, settle: 0.05, bounce: 0.42 },
    gorkemli: { id: "gorkemli", label: "Görkemli", icon: "👑", desc: "Etkileyici, sinematik, güçlü geçişler",
      tempo: 1.15, overlap: 0.22, energy: 1.3, density: 1, cardLead: 0.4, beat: 700,
      ease: { open: "sinematik", enter: "dogal-giris", loop: "sinus" }, settle: 0.035, bounce: 0.34 }
  };
  const ORDER = ["zarif", "neseli", "gorkemli"];

  /* =============================== doğal eğriler ===============================
     Adlar belgeye yazılır (action.easing); free.js EASE tablosu bunları tanır.
     Eski belgeler bu adları hiç içermez. */
  const CURVES = {
    "dogal-acilis": "cubic-bezier(.45,.05,.25,1)",   // ağırlığıyla başlar, yumuşakça oturur (kapı, kanat, kapak)
    "dogal-giris": "cubic-bezier(.22,.61,.36,1)",    // ortaya çıkış / yerleşme
    "canli-acilis": "cubic-bezier(.3,.62,.28,1.03)", // canlı, sonda çok hafif taşma
    "yaylanma": "cubic-bezier(.34,1.3,.64,1)",       // kontrollü yaylanma (neşeli giriş)
    "sinematik": "cubic-bezier(.76,0,.24,1)",        // ağır, güçlü sinema geçişi
    "sinus": "cubic-bezier(.37,0,.63,1)",            // dikişsiz sürekli hareket (dönüş noktasında durma hissi yok)
    "dusus": "cubic-bezier(.55,.085,.68,.53)",       // serbest düşüş (yerçekimi)
    "yukselis": "cubic-bezier(.25,.46,.45,.94)"      // sekip yükselme (yavaşlayarak tepe)
  };
  const CURVE_LABELS = [["dogal-acilis", "Doğal açılış"], ["dogal-giris", "Doğal giriş"], ["canli-acilis", "Canlı açılış"], ["yaylanma", "Hafif yaylanma"], ["sinematik", "Sinematik"], ["sinus", "Dalga (sürekli)"]];

  function num(v, d) { v = Number(v); return isFinite(v) ? v : d; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  const r2 = n => Math.round(n * 100) / 100;
  // dizgeden kararlı 0–1 değeri: aynı katman her açılışta aynı evrede başlar (editör = yayın)
  function phase(id) {
    let h = 2166136261; const s = String(id || "");
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ((h >>> 0) % 10000) / 10000;
  }
  function seeded(seed) { let x = Math.floor(phase(seed) * 2147483646) + 1; return () => { x = (x * 48271) % 2147483647; return (x - 1) / 2147483646; }; }

  /* Belgenin etkin hareket karakteri (kapalıysa null). Motorlar yalnızca bunu sorar. */
  function of(doc) {
    const m = doc && doc.motion;
    if (!m || typeof m !== "object" || !m.v || m.on === false) return null;
    const c = CHARACTERS[m.character] || CHARACTERS.zarif;
    return Object.assign({ curve: id => CURVES[id] || id }, c);
  }

  /* =============================== anahtar kare üreticileri =============================== */
  /* Fiziksel sekme: yukarıdan düşer, her sekmede yüksekliği esneklik² kadar azalır.
     Zaman yerçekimine göre (√yükseklik) dağıtılır; düşüş ivmelenir, yükseliş yavaşlar.
     squash: temas anında çok kısa basılma (yalnızca enerjik karakterde). */
  function bounceKF(H, e, opts) {
    opts = opts || {};
    const n = opts.bounces != null ? opts.bounces : 3, squash = !!opts.squash, tf = (y, s) => `translateY(${y.toFixed(1)}px)` + (s ? ` scale(${s})` : "");
    const segs = [{ t: 1, kind: "fall" }];
    for (let i = 1; i <= n; i++) segs.push({ t: 2 * Math.pow(e, i), h: Math.pow(e, 2 * i) * H, kind: "hop" });
    const T = segs.reduce((s, x) => s + x.t, 0);
    const kf = [{ transform: tf(-H), offset: 0, easing: CURVES.dusus }];
    let at = 1;
    segs.slice(1).forEach(sg => {
      const o0 = at / T;
      if (squash) kf.push({ transform: tf(0, "1.05,.93"), offset: Math.min(1, o0 + 0.012), easing: CURVES.yukselis });
      kf.splice(squash ? kf.length - 1 : kf.length, 0, { transform: tf(0), offset: o0, easing: CURVES.yukselis });
      kf.push({ transform: tf(-sg.h), offset: (at + sg.t / 2) / T, easing: CURVES.dusus });
      at += sg.t;
    });
    kf.push({ transform: tf(0), offset: 1 });
    return kf;
  }
  /* Sönümlü sarkaç: hedef açıya gider, biraz geçer, geri salınıp yerleşir (kurdele ucu, kapı kanadı).
     f(a) → transform dizgesi. */
  function settleKF(f, from, to, over, swings) {
    const n = swings || 2, kf = [{ transform: f(from), offset: 0, easing: CURVES["dogal-acilis"] }];
    const d = to - from; let amp = over;
    const pts = [0.55];
    for (let i = 1; i <= n; i++) pts.push(0.55 + 0.45 * i / n);
    pts.forEach((o, i) => {
      const val = i === 0 ? to + d * amp : (i === n ? to : to + d * amp * Math.pow(-0.45, i));
      kf.push({ transform: f(val), offset: o, easing: CURVES.sinus });
    });
    kf[kf.length - 1] = { transform: f(to), offset: 1 };
    return kf;
  }
  /* Yumuşak titreşim: rastgele ama kararlı noktalar arasında dalga eğrisiyle gezinir; başı ve sonu 0
     (döngüde dikiş görünmez). rest: sonda dinlenme payı (0–0.8). */
  function jitterKF(amp, n, seed, rest) {
    const R = seeded(seed || "j"), kf = [{ transform: "translate(0px, 0px) rotate(0deg)", offset: 0, easing: CURVES.sinus }];
    const span = 1 - (rest || 0);
    for (let i = 1; i < n; i++) {
      const k = Math.sin(Math.PI * i / n);   // ortada güçlü, uçlarda sönük
      kf.push({ transform: `translate(${((R() * 2 - 1) * amp * k).toFixed(2)}px, ${((R() * 2 - 1) * amp * 0.5 * k).toFixed(2)}px) rotate(${((R() * 2 - 1) * amp * 0.12 * k).toFixed(2)}deg)`, offset: span * i / n, easing: CURVES.sinus });
    }
    kf.push({ transform: "translate(0px, 0px) rotate(0deg)", offset: span });
    if (rest) kf.push({ transform: "translate(0px, 0px) rotate(0deg)", offset: 1 });
    return kf;
  }
  /* Sarkaç salınımı (dal, çiçek, avize): -a → +a, dönüş noktalarında doğal yavaşlama. */
  function swayKF(amp) {
    return [{ transform: `rotate(${-amp}deg)`, easing: CURVES.sinus }, { transform: `rotate(${amp}deg)` }];
  }
  /* Duruştan başlayan tam sarkaç turu (0 → +a → 0 → −a → 0). Saf sinüs: tepe noktalarında yavaşlar,
     ortadan hızlı geçer; tekrar ederken başlangıç ve bitiş birebir aynıdır. f: açı → dönüşüm. */
  const SIN_OUT = "cubic-bezier(.61,1,.88,1)", SIN_IN = "cubic-bezier(.12,0,.39,0)";
  function pendulumKF(amp, f) {
    f = f || (v => `rotate(${v.toFixed(2)}deg)`);
    return [{ transform: f(0), offset: 0, easing: SIN_OUT }, { transform: f(amp), offset: 0.25, easing: SIN_IN }, { transform: f(0), offset: 0.5, easing: SIN_OUT },
      { transform: f(-amp), offset: 0.75, easing: SIN_IN }, { transform: f(0), offset: 1 }];
  }
  /* Alev titremesi: küçük, düzensiz ama akıcı ölçek/eğilme değişimleri. */
  function flickerKF(seed, energy) {
    const R = seeded(seed || "f"), n = 7, e = clamp(num(energy, 1), 0.5, 1.6), kf = [];
    for (let i = 0; i <= n; i++) {
      const last = i === n, sx = last ? 1 : 1 + (R() - 0.5) * 0.07 * e, sy = last ? 1 : 1 + (R() - 0.35) * 0.16 * e, sk = last ? 0 : (R() - 0.5) * 6 * e;
      kf.push({ transform: `scale(${sx.toFixed(3)}, ${sy.toFixed(3)}) skewX(${sk.toFixed(2)}deg)`, offset: i / n, easing: CURVES.sinus });
    }
    kf[0].transform = "scale(1, 1) skewX(0deg)";
    return kf;
  }

  /* =============================== hareket sınıfları =============================== */
  // ana açılışlar (sahneyi açan, kartı ortaya çıkaran) — sıranın omurgası
  const OPEN = { "split-h": 0.72, "split-v": 0.72, hinge: 0.72, slide: 0.7, quad: 0.72, fold: 0.78, curtain: 0.75, drawer: 0.7, "page-turn": 0.75,
    seal: 0.22, "ribbon-cut": 0.55, lock: 0.62, burst: 0.18, shatter: 0.4 };   // değer: "doruk" anı (sürecin oranı)
  const ENTER = { reveal: 0.6, assemble: 0.8, rise: 0.7, drop: 0.55, card: 0.75, free3d: 0.75, zoom: 0.7, spin: 0.8, "camera-push": 0.7 };
  const LOOPS = { float: 1, shake: 1, tease: 1, parallax: 1, sheen: 1, shadow: 1 };
  const DECO = { "light-leak": "pre", "light-burst": "peak", confetti: "celebrate", fireworks: "celebrate",
    glitter: "ambient", fog: "ambient", snow: "ambient", petals: "ambient", stars: "ambient", spotlight: "ambient" };
  const GATES = { tap: 1, pull: 1, swipe: 1, hold: 1, view: 1 };
  // aynı katmanda aynı anda çalışırsa birbirinin dönüşümünü bozan ana hareketler
  const TRANSFORMERS = { hinge: 1, slide: 1, drawer: 1, "page-turn": 1, zoom: 1, spin: 1, free3d: 1, rise: 1, drop: 1, "split-h": 1, "split-v": 1, quad: 1, fold: 1, curtain: 1 };

  function roleOf(a, def, F) {
    if (!a || !def) return "none";
    if (a.start === "exit") return "exit";
    const infinite = def.loop && (a.repeat === 0 || a.repeat === "0");
    if (DECO[a.move]) return "deco";
    if (LOOPS[a.move] || (infinite && a.move === "spin")) return infinite ? "loop" : (a.move === "sheen" || a.move === "shadow" || a.move === "parallax" ? "deco" : "main");
    if (OPEN[a.move] != null || ENTER[a.move] != null) return "main";
    return "main";
  }
  const climaxOf = a => (OPEN[a.move] != null ? OPEN[a.move] : ENTER[a.move] != null ? ENTER[a.move] : 0.7);
  const isOpener = a => OPEN[a.move] != null;

  /* =============================== planlayıcı =============================== */
  const near = (a, b) => Math.abs(num(a, 0) - num(b, 0)) < 0.011;
  const sameVal = (a, b) => (typeof a === "number" || typeof b === "number") ? near(a, b) : (a == null ? "" : String(a)) === (b == null ? "" : String(b));
  /* Bir alan elle mi ayarlanmış? Uyumdan geçmiş kayıtta: değer uyumun yazdığından farklıysa.
     Hiç geçmemiş kayıtta: hareketin varsayılanından farklıysa (kullanıcı değiştirmiştir). */
  function manualOf(a, def) {
    const au = a.auto, m = {};
    if (au) {
      // bir kez elle ayarlanan alan kullanıcınındır (keep) — değeri sonradan uyumunkine denk gelse bile
      const kp = Array.isArray(au.keep) ? au.keep : [];
      m.timing = kp.includes("timing") || !(sameVal(a.start, au.start) && sameVal(num(a.delay, 0), num(au.delay, 0)));
      m.duration = kp.includes("duration") || !sameVal(num(a.duration, def.duration), au.duration);
      m.easing = kp.includes("easing") || !sameVal(a.easing || def.easing, au.easing);
    } else {
      m.timing = a.start === "at" || num(a.delay, 0) > 0.001 || (a.start === "with" && !(def.loop && num(a.repeat, 1) === 0));
      m.duration = !near(num(a.duration, def.duration), def.duration);
      m.easing = !!a.easing && a.easing !== def.easing;
    }
    return m;
  }
  const effDur = (a, dur) => dur * 1000 / clamp(num(a.speed, 1), 0.25, 4);
  const loopForever = (a, def) => !!def.loop && (a.repeat === 0 || a.repeat === "0");

  /* Bir bölümün (iki dokunuş arası) hareketlerini planlar. list: o bölümün hareketleri (sırayla).
     Dönüş: her hareket için { begin(ms), dur(ms), duration(sn), easing, set:{...} } */
  function planChunk(list, prof, F, opts) {
    const out = [], byId = {};
    let prevMain = null, lastOpener = null, pendingPre = null, cursorEnd = 0;
    const orig = F.schedule(list).items;   // kullanıcının bugünkü zamanlaması (tanımsız roller için)
    list.forEach((a, i) => {
      const def = F.move(a.move); if (!def) return;
      const man = opts.force ? { timing: false, duration: false, easing: false } : manualOf(a, def);
      const role = roleOf(a, def, F);
      const gateHead = i === 0 || GATES[a.start];
      // süre: karakterin temposu (sürekli ortam efektlerinin süresi "yoğunlaşma" süresidir, olduğu gibi kalır)
      let duration = num(a.duration, def.duration);
      if (!man.duration && !(role === "deco" && DECO[a.move] === "ambient") && !loopForever(a, def)) duration = r2(clamp(def.duration * prof.tempo, 0.2, 20));
      else if (!man.duration && loopForever(a, def)) duration = r2(clamp(def.duration * (a.move === "float" || a.move === "parallax" ? prof.tempo : 1), 0.2, 20));
      // eğri: açılış → karakterin açılış eğrisi; ortaya çıkış → giriş eğrisi; sürekli → dalga
      let easing = a.easing || def.easing;
      if (!man.easing) {
        if (role === "main" && isOpener(a) && ["hinge", "split-h", "split-v", "slide", "drawer", "page-turn", "quad", "curtain", "fold"].includes(a.move)) easing = prof.ease.open;
        else if (role === "main" && ["reveal", "rise", "card", "free3d", "zoom", "assemble", "camera-push"].includes(a.move)) easing = a.move === "camera-push" ? (prof.id === "gorkemli" ? "sinematik" : "dogal-acilis") : prof.ease.enter;
        else if (role === "loop" && ["float", "parallax", "tease", "shadow"].includes(a.move)) easing = "sinus";
      }
      const dur = effDur(a, duration);
      const total = loopForever(a, def) ? 0 : dur * (def.loop ? Math.max(1, Math.round(num(a.repeat, 1))) : 1);
      let begin;
      if (gateHead && i === 0) begin = 0;
      else if (GATES[a.start]) begin = 0;
      else if (man.timing) {
        // elle ayar: kullanıcının kurduğu İLİŞKİ korunur (öncekiyle birlikte / sonra / belirli saniye + gecikme);
        // önceki hareketler uyumla kaydıysa bu hareket de onlarla birlikte kayar
        const pv = out[out.length - 1], dl = num(a.delay, 0) * 1000;
        begin = a.start === "at" ? dl : !pv ? dl : a.start === "with" ? pv.begin + dl : pv.begin + pv.total + dl;
      }
      else if (role === "main") {
        if (a.layer === "__card" || def.isCard || (a.move === "free3d" && a.layer === "__card")) {
          // kart, listede hemen önündeki ana hareket bitmek üzereyken çıkar (zarf/kapı açılırken, araya
          // konmuş yakınlaşma vb. varsa onun ardından) — kullanıcının kurduğu sıra bozulmaz
          const ref = prevMain || lastOpener;
          begin = ref ? ref.begin + (ref.total || ref.dur) * (1 - prof.cardLead) : cursorEnd;
        } else if (prevMain) {
          const src = a.pre || a;   // kullanıcının asıl niyeti (uyumdan önceki başlatma ayarı)
          const paired = src.start === "with" && num(src.delay, 0) < 0.16 && prevMain.layer !== a.layer;   // çift kanat: birlikte
          const conflict = prevMain.layer === a.layer && TRANSFORMERS[a.move] && TRANSFORMERS[prevMain.a.move];
          if (paired) begin = prevMain.begin;
          else if (conflict) begin = prevMain.begin + prevMain.total;          // aynı katman: biri bitmeden öbürü başlamaz
          else begin = Math.max(prevMain.begin + prevMain.dur * 0.18, prevMain.begin + prevMain.total - prof.overlap * Math.min(prevMain.dur, dur));
        } else begin = 0;
        if (pendingPre) { begin = Math.max(begin, pendingPre.begin + pendingPre.dur * 0.55); pendingPre = null; }
      } else if (role === "deco") {
        const kind = DECO[a.move] || "peak", ref = prevMain, span = ref ? (ref.total || ref.dur) : 0;
        if (kind === "pre") { begin = prevMain ? prevMain.begin + prevMain.total * 0.6 : 0; }
        else if (kind === "peak") begin = ref ? ref.begin + span * climaxOf(ref.a) : 0;
        else if (kind === "celebrate") begin = ref ? ref.begin + span * Math.min(0.95, climaxOf(ref.a) + 0.12) : 0;
        else begin = ref ? ref.begin + span * 0.3 : 0;   // ortam: açılışla birlikte yavaşça yoğunlaşır
      } else if (role === "loop") {
        const own = [...out].reverse().find(o => o.layer === a.layer && o.role === "main");
        begin = own ? own.begin + own.total : (prevMain ? prevMain.begin : 0);
        if (!prevMain && !own) begin = Math.round(phase(a.layer + a.move) * 0.45 * dur);   // bekleme döngüleri farklı evrelerde
      } else begin = orig[i] ? orig[i].begin : 0;
      begin = Math.max(0, Math.round(begin));
      const rec = { a, def, role, layer: a.layer, begin, dur, total, duration, easing, man };
      out.push(rec); byId[a.id] = rec;
      if (role === "deco" && DECO[a.move] === "pre") pendingPre = rec;
      if (role === "main") { prevMain = rec; if (isOpener(a)) lastOpener = rec; }
      cursorEnd = Math.max(cursorEnd, begin + total);
    });
    // zamanlamayı belgenin diline (başlat + gecikme) çevir: her hareket listedeki bir öncekine göre
    let pB = 0, pE = 0;
    out.forEach((r, i) => {
      let start = r.a.start, delay = num(r.a.delay, 0);
      if (!(i === 0 || GATES[r.a.start] || r.man.timing)) {
        if (Math.abs(r.begin - pE) < 25) { start = "after"; delay = Math.max(0, r2((r.begin - pE) / 1000)); }
        else if (r.begin >= pB) { start = "with"; delay = r2((r.begin - pB) / 1000); }
        else { start = "at"; delay = r2(r.begin / 1000); }
        // "Öncekinden sonra" daha anlaşılır: önceki bittikten sonra başlıyorsa öyle yazılır
        if (start === "with" && r.begin >= pE - 1 && pE > pB) { start = "after"; delay = r2((r.begin - pE) / 1000); }
      }
      r.set = { start, delay, duration: r.duration, easing: r.easing };
      // gerçekte nerede başlayacağını belgenin kuralıyla yeniden hesapla (zincir bozulmasın)
      const b = (i === 0 || GATES[start] || start === "at") ? delay * 1000 : start === "with" ? pB + delay * 1000 : pE + delay * 1000;
      pB = b; pE = b + r.total;
    });
    return out;
  }

  function chunksOf(list, breakOn) {
    const out = [];
    list.forEach((a, i) => { if (i === 0 || breakOn(a)) out.push([]); out[out.length - 1].push(a); });
    return out;
  }

  /* Hareket listesini (açılış ya da İç Zemin) uyumlar; değişiklikleri kaydın içine yazar. */
  function harmonizeActions(actions, prof, opts) {
    const F = global.SeozCinemaFree;
    const rep = { main: 0, deco: 0, loop: 0, changed: 0, kept: 0, conflicts: [], fields: 0 };
    if (!F || !Array.isArray(actions) || !actions.length) return rep;
    const valid = actions.filter(a => a && F.move(a.move) && a.start !== "exit");
    const parts = chunksOf(valid, a => !!GATES[a.start]);
    parts.forEach(list => {
      const plan = planChunk(list, prof, F, opts || {});
      plan.forEach(r => {
        const a = r.a;
        rep[r.role === "main" ? "main" : r.role === "loop" ? "loop" : "deco"]++;
        if (r.man.timing || r.man.duration || r.man.easing) rep.kept++;
        if (!a.pre) a.pre = { start: a.start, delay: num(a.delay, 0), duration: num(a.duration, r.def.duration), easing: a.easing || null };
        let ch = false;
        const cur = { start: a.start, delay: num(a.delay, 0), duration: num(a.duration, r.def.duration), easing: a.easing || r.def.easing };
        const put = (k, v) => { if (!sameVal(cur[k], v)) { a[k] = v; ch = true; rep.fields++; } };
        if (!r.man.timing) { put("start", r.set.start); put("delay", r.set.delay); }
        if (!r.man.duration) put("duration", r.set.duration);
        if (!r.man.easing && r.set.easing) put("easing", r.set.easing);
        // uyumun yazdığı (ya da onayladığı) değerler — sonraki değişikliklerde elle ayarı tanımak için.
        // Elle ayarlanmış alanlar "keep" listesine girer: sonraki her hesaplamada da elle ayar sayılır, hiç ezilmez
        // (yalnızca kullanıcının açık izniyle — "Elle ayarlarımı da uyumla" — yeniden uyuma katılır).
        const keep = new Set(opts && opts.force ? [] : ((a.auto && a.auto.keep) || []));
        ["timing", "duration", "easing"].forEach(f => { if (r.man[f]) keep.add(f); });
        a.auto = { start: a.start, delay: num(a.delay, 0), duration: num(a.duration, r.def.duration), easing: a.easing || r.def.easing };
        if (keep.size) a.auto.keep = Array.from(keep);
        if (ch) rep.changed++;
      });
      // aynı katmanda iki sürekli aynı hareket: birbirinin üstüne biner (genlik ikiye katlanır)
      const seen = {};
      list.forEach(a => {
        const def = F.move(a.move); if (!def || !loopForever(a, def)) return;
        const k = a.layer + "|" + a.move;
        if (seen[k]) rep.conflicts.push({ type: "loop-dup", layer: a.layer, move: a.move });
        seen[k] = 1;
      });
    });
    return rep;
  }

  // ayar kutusu YERİNDE güncellenir (Etkileşim Stüdyosu aynı nesneyi tutar; yenisiyle değiştirilirse düzenlemeler kaybolur)
  function boxOf(s, kind) {
    if (kind === "kurdele") { if (!s.cut || typeof s.cut !== "object") s.cut = {}; return s.cut; }
    if (!s.motion || typeof s.motion !== "object") s.motion = {};
    if (!s.motion[kind] || typeof s.motion[kind] !== "object") s.motion[kind] = {};
    return s.motion[kind];
  }
  /* Etkileşimlerin süresi (Kurdele: settings.cut.dur, diğerleri: settings.motion[tür].dur) */
  function harmonizeInteractions(doc, prof, opts) {
    const I = global.SeozInteractive, rep = { count: 0, changed: 0, kept: 0 };
    if (!I) return rep;
    (doc.layers || []).forEach(l => {
      if (!l || l.type !== "module" || l.moduleId !== "interactive" || !l.settings) return;
      const s = l.settings, kind = s.kind;
      const isK = kind === "kurdele";
      const defDur = isK ? I.CUT_DEFAULTS.dur : (I.MOTION_DEFAULTS[kind] || {}).dur;
      if (!(defDur > 0)) return;
      rep.count++;
      const box = boxOf(s, kind);
      const cur = num(box.dur, defDur);
      const au = s.mAuto;
      const manual = opts && opts.force ? false : (au ? (au.keep || !near(cur, au.dur)) : !near(cur, defDur));
      if (manual) { rep.kept++; s.mAuto = { dur: au ? au.dur : defDur, keep: true }; return; }
      if (!s.mPre) s.mPre = { dur: box.dur == null ? null : cur };
      const v = r2(clamp(defDur * prof.tempo, 0.3, 8));
      if (!near(cur, v)) { box.dur = v; rep.changed++; }
      s.mAuto = { dur: num(box.dur, defDur) };
    });
    return rep;
  }

  /* İç Zemin: öndeki hareketli süs katmanı bir metnin/düğmenin üstüne biniyor mu? (yalnızca uyarı) */
  function frontWarnings(doc) {
    const out = [], bg = doc.theme && doc.theme.bg;
    if (!bg || !Array.isArray(bg.layers)) return out;
    const geo = l => (global.SeozDocModel && SeozDocModel.resolveGeometry) ? SeozDocModel.resolveGeometry(l, "mobile") : l;
    const content = (doc.layers || []).filter(l => l && (l.type === "text" || l.type === "module")).map(l => ({ l, g: geo(l) }));
    bg.layers.forEach(L => {
      if (!L || L.hidden || !L.front) return;
      const moving = (L.motion && L.motion !== "none") || (Array.isArray(L.moves) && L.moves.length) || (bg.actions || []).some(a => a && a.layer === L.id);
      const x = num(L.x, 0), y = num(L.y, 0), w = num(L.w, 120), h = num(L.h, 120);
      content.forEach(({ l, g }) => {
        const gx = num(g.x, 0), gy = num(g.y, 0), gw = num(g.w, 100), gh = num(g.h, 60);
        const ix = Math.max(0, Math.min(x + w, gx + gw) - Math.max(x, gx)), iy = Math.max(0, Math.min(y + h, gy + gh) - Math.max(y, gy));
        const share = (ix * iy) / Math.max(1, gw * gh);
        if (share > 0.12) out.push({ type: "front-cover", layer: L.id, name: L.name || "Süs katmanı", target: l.id, targetName: l.type === "text" ? "yazı" : "modül", moving: !!moving, share: Math.round(share * 100) });
      });
    });
    return out;
  }

  /* Bütün belgeyi uyumlar. opts.force: elle yapılmış ayarları da uyumla (kullanıcının açık izniyle). */
  function apply(doc, character, opts) {
    opts = opts || {};
    const prev = doc.motion && typeof doc.motion === "object" ? doc.motion : null;
    doc.motion = Object.assign({}, prev || {}, { v: 1, on: true, character: CHARACTERS[character] ? character : (prev && CHARACTERS[prev.character] ? prev.character : "zarif"), at: new Date().toISOString() });
    const prof = of(doc);
    const cin = doc.entry && doc.entry.cinema;
    const rCin = cin && cin.v === 2 && Array.isArray(cin.actions) && !cin.preset ? harmonizeActions(cin.actions, prof, opts) : harmonizeActions([], prof, opts);
    const bg = doc.theme && doc.theme.bg;
    const rBg = bg && Array.isArray(bg.actions) ? harmonizeActions(bg.actions, prof, opts) : harmonizeActions([], prof, opts);
    const rIx = harmonizeInteractions(doc, prof, opts);
    const layers = bg && Array.isArray(bg.layers) ? bg.layers.filter(L => L && !L.hidden && ((L.motion && L.motion !== "none") || (Array.isArray(L.moves) && L.moves.length))).length : 0;
    return { character: doc.motion.character, cinema: rCin, bg: rBg, ix: rIx, bgLoops: layers, warnings: frontWarnings(doc),
      preset: !!(cin && cin.preset), changed: rCin.changed + rBg.changed + rIx.changed, kept: rCin.kept + rBg.kept + rIx.kept };
  }
  /* Uyum açıksa (yeni katman/hareket eklenince) yeniden hesaplar; elle ayarlara dokunmaz. */
  function recompute(doc) { const m = doc && doc.motion; if (!m || !m.v || m.on === false) return null; return apply(doc, m.character); }

  /* Geri al: uyumun değiştirdiği bütün değerler uyumdan önceki hâline döner, uyum kapanır. */
  function undo(doc) {
    let n = 0;
    const restore = list => (Array.isArray(list) ? list : []).forEach(a => {
      if (!a) return;
      if (a.pre) {
        ["start", "delay", "duration", "easing"].forEach(k => { const v = a.pre[k]; if (v == null || v === "") { if (k === "easing") delete a.easing; else if (k === "delay") a.delay = 0; } else a[k] = v; });
        n++;
      }
      delete a.pre; delete a.auto;
    });
    const cin = doc.entry && doc.entry.cinema;
    if (cin) { restore(cin.actions); }
    if (doc.theme && doc.theme.bg) restore(doc.theme.bg.actions);
    (doc.layers || []).forEach(l => {
      const s = l && l.type === "module" && l.moduleId === "interactive" && l.settings; if (!s) return;
      if (s.mPre) {
        const box = boxOf(s, s.kind);
        if (s.mPre.dur == null) delete box.dur; else box.dur = s.mPre.dur;
        n++;
      }
      delete s.mPre; delete s.mAuto;
    });
    if (doc.motion) doc.motion = Object.assign({}, doc.motion, { on: false, at: new Date().toISOString() });
    return n;
  }

  /* Belgenin hareket özeti (panel için) */
  function analyze(doc) {
    const F = global.SeozCinemaFree, cin = doc.entry && doc.entry.cinema, bg = doc.theme && doc.theme.bg;
    const count = list => {
      const r = { main: 0, deco: 0, loop: 0 };
      (Array.isArray(list) ? list : []).forEach(a => { const def = F && F.move(a && a.move); if (!def || a.start === "exit") return; const ro = roleOf(a, def, F); r[ro === "main" ? "main" : ro === "loop" ? "loop" : "deco"]++; });
      return r;
    };
    const ix = (doc.layers || []).filter(l => l && l.type === "module" && l.moduleId === "interactive").length;
    return { cinema: count(cin && cin.v === 2 ? cin.actions : []), bg: count(bg && bg.actions), bgLayers: bg && Array.isArray(bg.layers) ? bg.layers.filter(L => L && !L.hidden).length : 0,
      ix, entryType: doc.entry && doc.entry.type, preset: !!(cin && cin.preset), warnings: frontWarnings(doc) };
  }

  global.SeozMotion = { CHARACTERS, ORDER, CURVES, CURVE_LABELS, of, phase, seeded, bounceKF, settleKF, jitterKF, swayKF, pendulumKF, flickerKF,
    roleOf, manualOf, planChunk, harmonizeActions, harmonizeInteractions, frontWarnings, apply, recompute, undo, analyze };
})(window);
