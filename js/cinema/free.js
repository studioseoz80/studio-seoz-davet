/* =============================================================================
   STUDIO SEOZ — cinema/free.js  (A2.1 · SERBEST ANİMASYON STÜDYOSU)
   -----------------------------------------------------------------------------
   Görseli kullanıcı seçer, hareketi menüden uygular. Sabit model, sabit yuva
   veya belirli sayıda görsel zorunluluğu yoktur. A1 motoru (cinema-core.js)
   olduğu gibi kullanılır; bu dosya yalnızca:
     1) entry.cinema.v === 2 kayıtlarından o kayda özel bir "serbest model"
        kurar (katman listesi → motorun anladığı yuvalar),
     2) hareket menüsünü (registerMove) ve
     3) hareketleri "Dokununca / Öncekiyle birlikte / Öncekinden sonra"
        kurallarıyla sıraya koyan oynatıcıyı sağlar.
   Kapının A1'deki üç senaryosu "hazır kurgu" olarak isteğe bağlı kullanılır
   (preset); bu durumda kayıt A1 kapı biçimine çevrilip A1 koduyla oynar.

   Veri (entry.cinema):
     { v:2, layers:[{ id, name, src, backSrc, box:{x,y,w,h}, backdrop, parent,
                      x, y, scale, depth, origin, thickness, light, hidden }],
       actions:[{ id, layer, move, start:"tap"|"with"|"after", delay, duration,
                  easing, repeat, params:{} }],
       preset:{ id:"door:gizemli", roles:{ leftWing:"<katman id>", … }, artFill:false } | null,
       + A1'in oynatma alanları (speed, depth, sound, start, lite, card…) }
   ========================================================================= */
(function (global) {
  "use strict";
  const C = global.SeozCinema;
  if (!C) return;
  const { h } = C.util;

  const MOVES = {}, ORDER = [];
  const GROUPS = [["acilma", "Açılma"], ["sinematik", "Sinematik hareket"], ["isik", "Işık ve efekt"], ["kart", "İç kart"]];
  function registerMove(def) { if (!MOVES[def.id]) ORDER.push(def.id); MOVES[def.id] = def; }

  const EASE = {
    yumusak: "cubic-bezier(.65,0,.35,1)", hizlanarak: "cubic-bezier(.55,0,1,.45)", yavaslayarak: "cubic-bezier(.16,1,.3,1)",
    esnek: "cubic-bezier(.34,1.56,.64,1)", agir: "cubic-bezier(.7,0,.2,1)", duz: "linear"
  };
  const EASE_LABELS = [["yavaslayarak", "Yavaşlayarak"], ["yumusak", "Yumuşak"], ["hizlanarak", "Hızlanarak"], ["agir", "Ağır (kapı gibi)"], ["esnek", "Esnek"], ["duz", "Düz"]];

  function num(v, d) { v = Number(v); return isFinite(v) ? v : d; }
  function timing(a, def) {
    // A2.3: harekete özel hız (0,5× yavaş … 2× hızlı) süreyi böler
    const sp = Math.max(0.25, Math.min(4, num(a.speed, 1)));
    const dur = Math.max(50, num(a.duration, def.duration || 1) * 1000 / sp);
    const rep = a.repeat === 0 || a.repeat === "0" ? Infinity : Math.max(1, Math.round(num(a.repeat, 1)));
    return { dur, it: def.loop ? rep : 1, e: EASE[a.easing] || EASE[def.easing] || EASE.yavaslayarak };
  }
  function P(a, def, key) {
    const p = (a.params || {})[key];
    if (p != null && p !== "") return p;
    const sch = (def.params || []).find(x => x.key === key);
    return sch ? sch.def : undefined;
  }
  function center(ctx, id) {
    const b = ctx.box[id] || { x: 0, y: 0, w: C.FRAME_W, h: C.FRAME_H };
    return { x: b.x + b.w / 2, y: b.y + b.h / 2, b };
  }

  /* ---------- görseli gerçek parçalarına ayıran açılışlar (ikiye) ----------
     Görsel ortadan gerçekten ikiye kesilir (clip-path); kesilen yerin arkası
     boştur ve arkadaki katman, ışık ya da iç kart görünür. Nesneyi zeminden
     ayırıyormuş gibi davranan sahte bir işlem yoktur. */
  function splitPrepare(vertical) {
    return function (ctx, a) {
      const inner = ctx.L[a.layer], u = ctx.cfg.layers[a.layer];
      if (!inner || !u || !u.src || inner.__split) return;
      const imgEl = inner.querySelector(".sc-front") || inner.querySelector("img");
      if (!imgEl) return;
      inner.__split = true;
      const fit = imgEl.style.objectFit || "contain";
      Array.from(inner.children).forEach(ch => { if (!ch.classList.contains("sc-slot")) ch.style.display = "none"; });   // bağlı katmanlar kalır
      // Her yarı yalnızca kendi yarısı kadar yer kaplar (taşma gizli): telefonda çizim yükü yarıya iner.
      const alpha = !(u.check && u.check.info && u.check.info.hasAlpha === false);
      const parts = [0, 1].map(i => {
        const half = h("div", "sc-half", { position: "absolute", overflow: "hidden", transformStyle: "preserve-3d",
          left: vertical ? "0" : (i ? "50%" : "0"), top: vertical ? (i ? "50%" : "0") : "0",
          width: vertical ? "100%" : "50%", height: vertical ? "50%" : "100%",
          transformOrigin: vertical ? (i ? "50% 100%" : "50% 0%") : (i ? "100% 50%" : "0% 50%") });
        const pos = { position: "absolute", width: vertical ? "100%" : "200%", height: vertical ? "200%" : "100%",
          left: vertical ? "0" : (i ? "-100%" : "0"), top: vertical ? (i ? "-100%" : "0") : "0" };
        const im = h("img", "", Object.assign({ objectFit: fit, pointerEvents: "none" }, pos));
        im.src = imgEl.src; im.alt = "";
        half.appendChild(im);
        let sh = null;
        if (!ctx.lite) {
          sh = h("div", "sc-half-shade", Object.assign({ background: "#07050A", opacity: "0" }, pos));
          if (alpha) Object.assign(sh.style, { WebkitMaskImage: `url("${imgEl.src}")`, maskImage: `url("${imgEl.src}")`, WebkitMaskSize: fit, maskSize: fit,
            WebkitMaskPosition: "center", maskPosition: "center", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat" });
          half.appendChild(sh);
        }
        // yarılar, bağlı katmanların ARKASINA eklenir (tokmak kanadın önünde kalsın)
        const firstChild = Array.from(inner.children).find(ch => ch.classList.contains("sc-slot"));
        inner.insertBefore(half, firstChild || null);
        return { half, sh };
      });
      // bağlı katmanlar, merkezlerinin düştüğü yarıyla birlikte hareket eder (ör. tokmak sağ kanatla)
      const pb = ctx.box[a.layer] || { w: C.FRAME_W, h: C.FRAME_H };
      Array.from(inner.children).filter(ch => ch.classList.contains("sc-slot")).forEach(ch => {
        const cx = parseFloat(ch.style.left) + parseFloat(ch.style.width) / 2, cy = parseFloat(ch.style.top) + parseFloat(ch.style.height) / 2;
        const idx = vertical ? (cy < pb.h / 2 ? 0 : 1) : (cx < pb.w / 2 ? 0 : 1);
        if (idx === 1) { if (vertical) ch.style.top = (parseFloat(ch.style.top) - pb.h / 2) + "px"; else ch.style.left = (parseFloat(ch.style.left) - pb.w / 2) + "px"; }
        parts[idx].half.appendChild(ch);
      });
      ctx.parts = ctx.parts || {};
      ctx.parts[a.layer] = parts;
    };
  }
  function splitRun(vertical) {
    return function (ctx, a, def, begin) {
      const parts = ctx.parts && ctx.parts[a.layer];
      const t = timing(a, def);
      const style = P(a, def, "style");
      if (!parts) { // görsel yoksa (yalnızca hizalama sahnesi) sessizce geç
        return t.dur;
      }
      parts.forEach((p, i) => {
        const s = i ? 1 : -1;
        let kf;
        if (style === "kay") kf = vertical ? [{ transform: "translateY(0)" }, { transform: `translateY(${s * 105}%)` }] : [{ transform: "translateX(0)" }, { transform: `translateX(${s * 105}%)` }];
        else {
          const ang = num(P(a, def, "angle"), 100) * (P(a, def, "dir") === "disa" ? -1 : 1);
          kf = vertical ? [{ transform: "rotateX(0)" }, { transform: `rotateX(${-s * ang}deg)` }] : [{ transform: "rotateY(0)" }, { transform: `rotateY(${-s * ang}deg)` }];
        }
        ctx.anim(p.half, kf, { d: t.dur, delay: begin, e: t.e, fill: "forwards", comp: "add" });
        if (style !== "kay" && p.sh) ctx.anim(p.sh, [{ opacity: 0 }, { opacity: 0.55 }], { d: t.dur, delay: begin, e: t.e, fill: "forwards" });
      });
      if (num(P(a, def, "sound"), 1)) ctx.later(begin, () => ctx.sfx(style === "kay" ? "swoosh" : "creak"));
      return t.dur;
    };
  }
  const SPLIT_PARAMS = [
    { key: "style", label: "Biçim", def: "kanat", options: [["kanat", "Kanat gibi dönerek"], ["kay", "Kayarak"]] },
    { key: "dir", label: "Yön", def: "ice", options: [["ice", "İçeri doğru"], ["disa", "İzleyiciye doğru"]] },
    { key: "angle", label: "Açı", def: 100, options: [[70, "70°"], [100, "100°"], [120, "120°"]] }
  ];

  /* =================== HAREKET MENÜSÜ (A2.1: 12 hareket + iç kart) =================== */
  registerMove({ id: "split-h", group: "acilma", label: "Ortadan iki yana açılma", single: true, duration: 1.8, easing: "agir",
    note: "Görsel tam ortadan ikiye kesilir; arkası boş kalır.", params: SPLIT_PARAMS, prepare: splitPrepare(false), run: splitRun(false) });
  registerMove({ id: "split-v", group: "acilma", label: "Yukarı ve aşağı açılma", single: true, duration: 1.6, easing: "agir",
    note: "Görsel yatay olarak tam ortadan ikiye kesilir.", params: SPLIT_PARAMS, prepare: splitPrepare(true), run: splitRun(true) });
  registerMove({ id: "hinge", group: "acilma", label: "Menteşeden 3D dönerek açılma", single: true, duration: 2, easing: "agir", needsBack: true, needsLit: true,
    note: "Katman bir kenarından kapı gibi döner. Çift kanat için iki katman kullanın.",
    params: [
      { key: "side", label: "Menteşe", def: "left", options: [["left", "Sol kenar"], ["right", "Sağ kenar"], ["top", "Üst kenar"], ["bottom", "Alt kenar"]] },
      { key: "dir", label: "Yön", def: "ice", options: [["ice", "İçeri doğru"], ["disa", "İzleyiciye doğru"]] },
      { key: "angle", label: "Açı", def: 100, options: [[45, "45°"], [80, "80°"], [100, "100°"], [120, "120°"]] }
    ],
    prepare(ctx, a, def) {
      const inner = ctx.L[a.layer], u = ctx.cfg.layers[a.layer] || {};
      if (!inner || u.origin) return; // kullanıcı dönme noktasını kendisi ayarladıysa ona dokunulmaz
      inner.style.transformOrigin = { left: "0% 50%", right: "100% 50%", top: "50% 0%", bottom: "50% 100%" }[P(a, def, "side")] || "0% 50%";
    },
    run(ctx, a, def, begin) {
      const t = timing(a, def), side = P(a, def, "side"), out = P(a, def, "dir") === "disa";
      const ang = num(P(a, def, "angle"), 100) * (out ? -1 : 1);
      const axis = side === "top" || side === "bottom" ? "rotateX" : "rotateY";
      const sign = side === "right" || side === "top" ? -1 : 1;
      const deg = axis === "rotateX" ? -sign * ang : sign * ang;
      ctx.anim(ctx.L[a.layer], [{ transform: `${axis}(0)` }, { transform: `${axis}(${deg}deg)` }], { d: t.dur, delay: begin, e: t.e, fill: "forwards", comp: "add" });
      ctx.later(begin, () => ctx.shade(a.layer, out ? 0.25 : 0.6, { d: t.dur, e: t.e }));
      ctx.later(begin, () => ctx.sfx("creak"));
      return t.dur;
    } });
  registerMove({ id: "slide", group: "acilma", label: "Sürgülü açılma", single: true, duration: 1.2, easing: "yumusak",
    note: "Katman kendi genişliği kadar kayarak çekilir.",
    params: [{ key: "dir", label: "Yön", def: "left", options: [["left", "Sola"], ["right", "Sağa"], ["up", "Yukarı"], ["down", "Aşağı"]] }],
    run(ctx, a, def, begin) {
      const t = timing(a, def), d = P(a, def, "dir");
      const tr = { left: "translateX(-105%)", right: "translateX(105%)", up: "translateY(-105%)", down: "translateY(105%)" }[d] || "translateX(-105%)";
      ctx.anim(ctx.L[a.layer], [{ transform: "translate(0,0)" }, { transform: tr }], { d: t.dur, delay: begin, e: t.e, fill: "forwards", comp: "add" });
      ctx.later(begin, () => ctx.sfx("swoosh"));
      return t.dur;
    } });
  registerMove({ id: "camera-push", group: "sinematik", label: "Kameranın içeri ilerlemesi", single: true, duration: 1.8, easing: "hizlanarak", scene: true,
    note: "Bütün sahne izleyiciye doğru yaklaşır. Derinlik hissi için en az iki katman önerilir.",
    params: [{ key: "amount", label: "Mesafe", def: "orta", options: [["az", "Az"], ["orta", "Orta"], ["cok", "İçinden geç"]] }],
    run(ctx, a, def, begin) {
      const t = timing(a, def), z = { az: 140, orta: 300, cok: 640 }[P(a, def, "amount")] || 300;
      const dz = ctx.Z(z) + z * 0.3;
      ctx.__camZ = (ctx.__camZ || 0) + dz;   // iç kart bu ilerlemeyi telafi eder, ekranda doğal boyutta kalır
      ctx.cam([{ transform: "translateZ(0)" }, { transform: `translateZ(${dz}px)` }], { d: t.dur, delay: begin, e: t.e, fill: "forwards", comp: "add" });
      ctx.later(begin, () => ctx.sfx("whoosh"));
      return t.dur;
    } });
  registerMove({ id: "zoom", group: "sinematik", label: "3D yakınlaşma ve uzaklaşma", single: true, duration: 1.4, easing: "yavaslayarak",
    params: [{ key: "dir", label: "Yön", def: "in", options: [["in", "Yakınlaş"], ["out", "Uzaklaş"]] }],
    run(ctx, a, def, begin) {
      const t = timing(a, def), inn = P(a, def, "dir") !== "out";
      ctx.anim(ctx.L[a.layer], [{ transform: "translateZ(0) scale(1)" }, { transform: inn ? `translateZ(${ctx.Z(120)}px) scale(1.12)` : `translateZ(${ctx.Z(-160)}px) scale(.86)` }],
        { d: t.dur, delay: begin, e: t.e, fill: "forwards", comp: "add" });
      return t.dur;
    } });
  registerMove({ id: "float", group: "sinematik", label: "Havada süzülme", single: true, duration: 2.6, easing: "yumusak", loop: true, defRepeat: 0,
    params: [{ key: "amount", label: "Genlik", def: "orta", options: [["az", "Az"], ["orta", "Orta"], ["cok", "Çok"]] }],
    run(ctx, a, def, begin) {
      const t = timing(a, def), px = { az: 5, orta: 10, cok: 18 }[P(a, def, "amount")] || 10;
      ctx.anim(ctx.C[a.layer] || ctx.L[a.layer], [{ transform: "translateY(0) rotate(0)" }, { transform: `translateY(${-px}px) rotate(.4deg)` }],
        { d: t.dur / 2, delay: begin, e: t.e, it: t.it === Infinity ? Infinity : t.it * 2, dir: "alternate", fill: "none", comp: "add" });
      return t.it === Infinity ? 0 : t.dur * t.it;
    } });
  registerMove({ id: "shake", group: "sinematik", label: "Sallanma ve titreşim", single: true, duration: 0.7, easing: "duz", loop: true, defRepeat: 0,
    params: [{ key: "mode", label: "Biçim", def: "titresim", options: [["titresim", "Hafif titreşim"], ["sallanma", "Sallanma"], ["sarsinti", "Güçlü sarsıntı"]] }],
    run(ctx, a, def, begin) {
      const t = timing(a, def), m = P(a, def, "mode"), el = ctx.C[a.layer] || ctx.L[a.layer];
      let kf;
      if (m === "sallanma") kf = [{ transform: "rotate(0)" }, { transform: "rotate(1.6deg)" }, { transform: "rotate(0)" }, { transform: "rotate(-1.6deg)" }, { transform: "rotate(0)" }];
      else {
        const amp = m === "sarsinti" ? 5 : 1.4; kf = [];
        for (let i = 0; i <= 8; i++) kf.push({ transform: `translate(${(i % 2 ? 1 : -1) * amp * (i === 8 ? 0 : 1)}px, ${((i % 3) - 1) * amp * 0.5 * (i === 8 ? 0 : 1)}px)` });
        // dikkat aşamasında sürekli titreşim, aralıklarla gelsin (yorucu olmasın)
        if (t.it === Infinity && m === "titresim") kf = [{ transform: "translate(0,0)", offset: 0 }, { transform: "translate(0,0)", offset: 0.7 }].concat(kf.map((k, i) => Object.assign({}, k, { offset: 0.7 + 0.3 * i / 8 })));
      }
      const d = t.it === Infinity && m === "titresim" ? Math.max(t.dur, 2200) : t.dur;
      ctx.anim(el, kf, { d, delay: begin, e: "linear", it: t.it, fill: "none", comp: "add" });
      if (m === "sarsinti") ctx.later(begin, () => ctx.sfx("knock"));
      return t.it === Infinity ? 0 : d * t.it;
    } });
  registerMove({ id: "light-leak", group: "isik", label: "Işık sızması", single: true, duration: 1.4, easing: "yavaslayarak",
    note: "Katmanın arkasından ışık sızar; açılıştan önce merak uyandırır.",
    params: [{ key: "style", label: "Biçim", def: "aralik", options: [["aralik", "Ortadaki aralıktan"], ["kenar", "Kenarlardan hale"], ["alt", "Alttan"]] },
             { key: "color", label: "Renk", def: "sicak", options: [["sicak", "Sıcak altın"], ["beyaz", "Beyaz"], ["soguk", "Soğuk gümüş"]] }],
    prepare(ctx, a, def) {
      const { b } = center(ctx, a.layer), st = P(a, def, "style");
      const col = { sicak: "255,214,150", beyaz: "255,255,255", soguk: "205,225,255" }[P(a, def, "color")] || "255,214,150";
      const slot = ctx.model.slots.find(s => s.id === a.layer) || { z: 2, zLayer: 0 };
      let box, kids;
      if (st === "aralik") { box = { x: b.x + b.w / 2 - 4, y: b.y + b.h * 0.06, w: 8, h: b.h * 0.88 }; kids = [h("div", "", { position: "absolute", inset: "0", borderRadius: "4px", background: `linear-gradient(180deg, transparent, rgba(${col},1) 18%, #fff 50%, rgba(${col},1) 82%, transparent)`, boxShadow: `0 0 22px 8px rgba(${col},.75)` })]; }
      else if (st === "alt") { box = { x: b.x + b.w * 0.08, y: b.y + b.h - 8, w: b.w * 0.84, h: 18 }; kids = [h("div", "", { position: "absolute", inset: "0", background: `radial-gradient(ellipse, rgba(${col},1), transparent 70%)` })]; }
      else { box = { x: b.x - 30, y: b.y - 30, w: b.w + 60, h: b.h + 60 }; kids = [h("div", "", { position: "absolute", inset: "0", borderRadius: "24px", background: `radial-gradient(ellipse, rgba(${col},.85) 30%, rgba(${col},0) 70%)` })]; }
      const el = ctx.piece("sc-leak", box, st === "kenar" ? Math.max(1, slot.z - 1) : slot.z + 1, kids, (slot.zLayer || 0) + (st === "kenar" ? -2 : 1));
      el.style.opacity = "0";
      ctx.leaks = ctx.leaks || {}; ctx.leaks[a.id] = el;
    },
    run(ctx, a, def, begin) {
      const t = timing(a, def), el = ctx.leaks && ctx.leaks[a.id];
      if (!el) return t.dur;
      ctx.anim(el, [{ opacity: 0, transform: "scaleY(.3)" }, { opacity: 1, transform: "scaleY(1)" }], { d: t.dur, delay: begin, e: t.e, fill: "forwards" });
      return t.dur;
    } });
  registerMove({ id: "sheen", group: "isik", label: "Metalik ışık yansıması", single: true, duration: 1.5, easing: "yumusak", loop: true, defRepeat: 1, needsLit: true,
    note: "Işık yalnızca görselin kendi şeklinin üzerinden geçer (saydam alanlara taşmaz).",
    run(ctx, a, def, begin) {
      const t = timing(a, def);
      if (!ctx.lit[a.layer]) return t.dur;
      if (t.it === Infinity) {
        // sürekli parlama: geçişler arasında bekleme olsun
        const bar = ctx.lit[a.layer].bar, k = Math.min(1, ctx.lit[a.layer].k);
        ctx.anim(bar, [{ transform: "translateX(-130%) skewX(-16deg)", opacity: 0 }, { opacity: k, offset: 0.1 }, { transform: "translateX(330%) skewX(-16deg)", opacity: 0, offset: 0.45 }, { transform: "translateX(330%) skewX(-16deg)", opacity: 0 }],
          { d: t.dur * 2.2, delay: begin, e: "linear", it: Infinity, fill: "none" });
        return 0;
      }
      ctx.sheen(a.layer, { d: t.dur, delay: begin, it: t.it, e: t.e });
      ctx.later(begin, () => ctx.sfx("sparkle"));
      return t.dur * t.it;
    } });
  registerMove({ id: "light-burst", group: "isik", label: "Işık patlaması", single: true, duration: 1.4, easing: "yavaslayarak", scene: true,
    note: "Katmanın arkasından ışık huzmesi ve parlama yayılır.",
    params: [{ key: "color", label: "Renk", def: "sicak", options: [["sicak", "Sıcak altın"], ["beyaz", "Beyaz"]] }],
    run(ctx, a, def, begin) {
      const t = timing(a, def), c = center(ctx, a.layer), warm = P(a, def, "color") !== "beyaz";
      ctx.later(begin, () => {
        const glow = ctx.glow(c.x, c.y, Math.min(760, Math.max(c.b.w, c.b.h) * 1.2), warm ? "rgba(255,226,170,.95)" : "rgba(255,255,255,.95)", 19);
        const rays = ctx.lite ? null : ctx.rays(c.x, c.y, 560, warm ? "rgba(255,226,150,.5)" : "rgba(255,255,255,.45)", 18);
        ctx.anim(glow, [{ opacity: 0, transform: "scale(.6)" }, { opacity: 1, transform: "scale(1)", offset: 0.3 }, { opacity: 0.7, transform: "scale(1.1)" }], { d: t.dur, e: t.e, fill: "forwards" });
        if (rays) ctx.anim(rays, [{ opacity: 0, transform: "rotate(0) scale(.7)" }, { opacity: 0.9, transform: "rotate(25deg) scale(1)", offset: 0.35 }, { opacity: 0.5, transform: "rotate(60deg) scale(1.25)" }], { d: t.dur * 1.6, e: t.e, fill: "forwards" });
        ctx.flash(warm ? "#FFF1D6" : "#FFFFFF", t.dur * 0.8, 0.75);
        const p = ctx.frameToScreen(c.x, c.y);
        ctx.fx.burst({ type: "spark", x: p.x, y: p.y, count: 40, speed: 520, colors: warm ? ["#F3D27A", "#FFFFFF"] : ["#FFFFFF", "#DCE3EA"], gravity: 260 });
        ctx.sfx("chime");
      });
      return t.dur;
    } });
  registerMove({ id: "confetti", group: "isik", label: "Konfeti", single: true, duration: 1.2, easing: "duz", scene: true,
    params: [{ key: "style", label: "Biçim", def: "top", options: [["top", "İki yandan konfeti topu"], ["yagmur", "Yukarıdan yağmur"]] },
             { key: "palette", label: "Renk", def: "renkli", options: [["renkli", "Renkli"], ["altin", "Altın ve beyaz"], ["pastel", "Pastel"]] }],
    run(ctx, a, def, begin) {
      const t = timing(a, def), c = center(ctx, a.layer);
      const colors = { renkli: ["#E94F6B", "#F7C548", "#4FB0E9", "#7BD389", "#FFFFFF"], altin: ["#F3D27A", "#C9A45C", "#FFFFFF", "#E8D9B0"], pastel: ["#F8C8D4", "#C9E4F5", "#FDF0C2", "#D5F0DC", "#FFFFFF"] }[P(a, def, "palette")] || ["#F3D27A", "#FFFFFF"];
      ctx.later(begin, () => {
        if (P(a, def, "style") === "yagmur") {
          ctx.fx.stream({ type: "confetti", x: 0.5, y: -0.05, jitter: ctx.fx._W() / 2, angle: Math.PI / 2, spread: 0.5, speed: 160, rate: 70, duration: t.dur * ctx.k + 600, colors, size: 9, gravity: 260, life: 3.5 });
        } else {
          const p = ctx.frameToScreen(c.x, Math.min(C.FRAME_H - 40, c.b.y + c.b.h * 0.75));
          [-0.5, 0.5].forEach(s => ctx.fx.burst({ type: "confetti", x: p.x, y: p.y, count: 80, speed: 900, spread: 0.5, angle: -Math.PI / 2 + s, size: 10, colors }));
        }
        ctx.sfx("pop");
      });
      return t.dur;
    } });
  registerMove({ id: "card", group: "kart", label: "İç kartın ortaya çıkması", single: true, duration: 1.4, easing: "yavaslayarak", scene: true, isCard: true,
    note: "Eklemezseniz kart, son hareketten sonra kendiliğinden yükselerek gelir.",
    params: [{ key: "style", label: "Biçim", def: "yuksel", options: [["yuksel", "Aşağıdan yükselerek"], ["belir", "Derinden belirerek"], ["in", "Yukarıdan inerek"]] }],
    run(ctx, a, def, begin) { const t = timing(a, def); revealCard(ctx, P(a, def, "style"), t, begin); return t.dur; } });

  /* =================== A2.2 — MENÜNÜN DEVAMI =================== */
  /* Görseli gerçek parçalarına bölen ortak yardımcı (ızgara). Her parça yalnızca
     kendi alanı kadardır (taşma gizli). Bir katman yalnızca BİR kez bölünür;
     aynı katmana ikinci bir bölen hareket verilirse ilk ızgara kullanılır. */
  function tilePrepare(cols, rows) {
    return function (ctx, a) {
      const inner = ctx.L[a.layer], u = ctx.cfg.layers[a.layer];
      if (!inner || !u || !u.src || inner.__split) return;
      const imgEl = inner.querySelector(".sc-front") || inner.querySelector("img");
      if (!imgEl) return;
      inner.__split = true;
      const fit = imgEl.style.objectFit || "contain";
      Array.from(inner.children).forEach(ch => { if (!ch.classList.contains("sc-slot")) ch.style.display = "none"; });
      const firstChild = Array.from(inner.children).find(ch => ch.classList.contains("sc-slot"));
      const tiles = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const tile = h("div", "sc-half sc-tile", { position: "absolute", overflow: "hidden", transformStyle: "preserve-3d",
          left: (100 * c / cols) + "%", top: (100 * r / rows) + "%", width: (100 / cols) + "%", height: (100 / rows) + "%" });
        const im = h("img", "", { position: "absolute", width: (100 * cols) + "%", height: (100 * rows) + "%", left: (-100 * c) + "%", top: (-100 * r) + "%", objectFit: fit, pointerEvents: "none" });
        im.src = imgEl.src; im.alt = "";
        tile.appendChild(im);
        inner.insertBefore(tile, firstChild || null);
        tiles.push({ el: tile, c, r });
      }
      const pb = ctx.box[a.layer] || { w: C.FRAME_W, h: C.FRAME_H };
      Array.from(inner.children).filter(ch => ch.classList.contains("sc-slot")).forEach(ch => {
        const cx = parseFloat(ch.style.left) + parseFloat(ch.style.width) / 2, cy = parseFloat(ch.style.top) + parseFloat(ch.style.height) / 2;
        const c = Math.max(0, Math.min(cols - 1, Math.floor(cx / (pb.w / cols)))), r = Math.max(0, Math.min(rows - 1, Math.floor(cy / (pb.h / rows))));
        const t = tiles[r * cols + c];
        ch.style.left = (parseFloat(ch.style.left) - c * pb.w / cols) + "px"; ch.style.top = (parseFloat(ch.style.top) - r * pb.h / rows) + "px";
        t.el.appendChild(ch);
      });
      ctx.tiles = ctx.tiles || {};
      ctx.tiles[a.layer] = { tiles, cols, rows };
    };
  }
  function tilesOf(ctx, a) { return ctx.tiles && ctx.tiles[a.layer]; }

  registerMove({ id: "quad", group: "acilma", label: "Dört yöne açılma", single: true, duration: 1.6, easing: "agir",
    note: "Görsel 4 eşit parçaya kesilir; parçalar köşelere doğru açılır. Gerçek zarf kapakları için 4 ayrı katman kullanın.",
    params: [{ key: "style", label: "Biçim", def: "don", options: [["don", "Dönerek açılır"], ["kay", "Köşelere kayar"]] }],
    prepare: tilePrepare(2, 2),
    run(ctx, a, def, begin) {
      const t = timing(a, def), g = tilesOf(ctx, a); if (!g) return t.dur;
      const kay = P(a, def, "style") === "kay";
      g.tiles.forEach(p => {
        const sx = p.c ? 1 : -1, sy = p.r ? 1 : -1;
        p.el.style.transformOrigin = `${p.c ? 100 : 0}% ${p.r ? 100 : 0}%`;
        const kf = kay ? [{ transform: "translate(0,0)" }, { transform: `translate(${sx * 105}%, ${sy * 105}%)` }]
          : [{ transform: "rotateX(0) rotateY(0)" }, { transform: `rotateX(${sy * 70}deg) rotateY(${-sx * 70}deg)`, opacity: 0.0 }];
        ctx.anim(p.el, kf, { d: t.dur, delay: begin + (p.r * 2 + p.c) * 60, e: t.e, fill: "forwards", comp: "add" });
      });
      ctx.later(begin, () => ctx.sfx("swoosh"));
      return t.dur + 180;
    } });
  registerMove({ id: "fold", group: "acilma", label: "Katlanarak açılma", single: true, duration: 1.6, easing: "yumusak",
    note: "Görsel şeritlere bölünür ve akordeon gibi katlanarak çekilir. Düz kart ve kâğıt görsellerinde en gerçekçi sonucu verir.",
    params: [{ key: "dir", label: "Yön", def: "left", options: [["left", "Sola katlanır"], ["right", "Sağa katlanır"], ["up", "Yukarı katlanır"]] },
             { key: "strips", label: "Şerit", def: 6, options: [[4, "4"], [6, "6"], [8, "8"]] }],
    prepare(ctx, a, def) { const n = num(P(a, def, "strips"), 6); return (P(a, def, "dir") === "up" ? tilePrepare(1, n) : tilePrepare(n, 1))(ctx, a); },
    run(ctx, a, def, begin) {
      const t = timing(a, def), g = tilesOf(ctx, a); if (!g) return t.dur;
      const dir = P(a, def, "dir"), n = g.tiles.length, step = t.dur / (n + 2);
      g.tiles.forEach((p, i) => {
        const k = dir === "left" ? i : dir === "right" ? n - 1 - i : n - 1 - i;   // uzak uçtan başlar
        const order = dir === "left" ? n - 1 - k : k;
        if (dir === "up") { p.el.style.transformOrigin = "50% 0%"; }
        else p.el.style.transformOrigin = dir === "left" ? "0% 50%" : "100% 50%";
        const ang = (i % 2 ? -1 : 1) * 88;
        const kf = dir === "up" ? [{ transform: "rotateX(0)" }, { transform: `rotateX(${ang}deg)`, opacity: 0.15 }]
          : [{ transform: "rotateY(0)" }, { transform: `rotateY(${ang}deg)`, opacity: 0.15 }];
        ctx.anim(p.el, kf, { d: step * 2.2, delay: begin + order * step, e: t.e, fill: "forwards", comp: "add" });
      });
      ctx.later(begin, () => ctx.sfx("page"));
      return t.dur;
    } });
  registerMove({ id: "curtain", group: "acilma", label: "Perde gibi toplanma", single: true, duration: 2, easing: "agir",
    note: "Görsel dikey şeritlere bölünür ve kıvrımlarla kenara toplanır. İki ayrı perde için sol ve sağ katman da kullanabilirsiniz.",
    params: [{ key: "dir", label: "Yön", def: "both", options: [["both", "İki yana"], ["left", "Sola"], ["right", "Sağa"], ["up", "Yukarı"]] }],
    prepare(ctx, a, def) { return (P(a, def, "dir") === "up" ? tilePrepare(1, 8) : tilePrepare(10, 1))(ctx, a); },
    run(ctx, a, def, begin) {
      const t = timing(a, def), g = tilesOf(ctx, a); if (!g) return t.dur;
      const dir = P(a, def, "dir"), n = g.tiles.length;
      g.tiles.forEach((p, i) => {
        let kf;
        if (dir === "up") {
          const f = (n - i) / n;
          p.el.style.transformOrigin = "50% 0%";
          kf = [{ transform: "translateY(0) scaleY(1)" }, { transform: `translateY(${-i * 100 * f}%) scaleY(.22)` }];
        } else {
          const side = dir === "both" ? (i < n / 2 ? -1 : 1) : dir === "left" ? -1 : 1;
          const fromEdge = side < 0 ? i : n - 1 - i;              // kenara uzaklığı
          p.el.style.transformOrigin = side < 0 ? "0% 50%" : "100% 50%";
          kf = [{ transform: "translateX(0) scaleX(1) skewY(0)" }, { transform: `translateX(${side * fromEdge * -78}%) scaleX(.24) skewY(${(i % 2 ? 1 : -1) * 2}deg)` }];
          if (side > 0) kf[1].transform = `translateX(${fromEdge * 78}%) scaleX(.24) skewY(${(i % 2 ? 1 : -1) * 2}deg)`;
        }
        ctx.anim(p.el, kf, { d: t.dur, delay: begin, e: t.e, fill: "forwards", comp: "add" });
        if (!ctx.lite) ctx.anim(p.el, [{ filter: "brightness(1)" }, { filter: `brightness(${i % 2 ? 0.7 : 1.05})` }], { d: t.dur, delay: begin, e: t.e, fill: "forwards" });
      });
      ctx.later(begin, () => ctx.sfx("whoosh"));
      return t.dur;
    } });
  registerMove({ id: "drawer", group: "acilma", label: "Çekmece gibi dışarı çıkma", needsLayers: 2, duration: 1.4, easing: "yavaslayarak",
    note: "Bu katman çekmecenin ön yüzü olur ve izleyiciye doğru çıkar. Arkasında kutu gövdesi için ayrı bir katman gerekir.",
    params: [{ key: "amount", label: "Mesafe", def: "orta", options: [["az", "Az"], ["orta", "Orta"], ["cok", "Çok"]] }],
    run(ctx, a, def, begin) {
      const t = timing(a, def), k = { az: 0.6, orta: 1, cok: 1.6 }[P(a, def, "amount")] || 1;
      ctx.anim(ctx.L[a.layer], [{ transform: "translate3d(0,0,0)" }, { transform: `translate3d(0, ${40 * k}px, ${ctx.Z(140 * k)}px)` }], { d: t.dur, delay: begin, e: t.e, fill: "forwards", comp: "add" });
      ctx.later(begin, () => ctx.sfx("swoosh"));
      return t.dur;
    } });
  registerMove({ id: "page-turn", group: "acilma", label: "Kitap sayfası çevirme", needsLayers: 2, needsBack: true, needsLit: true, duration: 1.2, easing: "yumusak",
    note: "Bu katman sayfa (veya kapak) olur ve sol kenarından çevrilir; arkasındaki katman görünür. Sayfanın arka yüzü için arka yüz görseli yükleyebilirsiniz.",
    params: [{ key: "pages", label: "Sayfa sayısı", def: 1, options: [[1, "1 sayfa"], [3, "3 sayfa"], [5, "5 sayfa"]] }],
    prepare(ctx, a, def) {
      const inner = ctx.L[a.layer], u = ctx.cfg.layers[a.layer] || {};
      if (!inner) return;
      if (!u.origin) inner.style.transformOrigin = "0% 50%";
      const n = num(P(a, def, "pages"), 1);
      if (n > 1 && u.src && !inner.__pages) {
        // aynı sayfa görseli ek yapraklar olarak çoğaltılır (A2 planındaki gibi), asıl katmanın hemen altına
        const front = inner.querySelector(".sc-front") || inner.querySelector("img");
        inner.__pages = [];
        for (let i = 1; i < n; i++) {
          const leaf = h("div", "sc-half sc-leaf", { position: "absolute", inset: "0", transformOrigin: "0% 50%", transformStyle: "preserve-3d", transform: `translateZ(${-i * 0.8}px)` });
          const im = h("img", "", { position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: (front && front.style.objectFit) || "contain", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", filter: `brightness(${1 - i * 0.05})` });
          im.src = front ? front.src : ""; im.alt = "";
          const back = h("div", "", { position: "absolute", inset: "0", background: "#EDE6D8", transform: "rotateY(180deg)", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" });
          leaf.appendChild(im); leaf.appendChild(back);
          ctx.S[a.layer].insertBefore(leaf, ctx.C[a.layer]);
          inner.__pages.push(leaf);
        }
      }
    },
    run(ctx, a, def, begin) {
      const t = timing(a, def), inner = ctx.L[a.layer], leaves = [inner].concat(inner.__pages || []);
      leaves.forEach((el, i) => {
        ctx.anim(el, [{ transform: "rotateY(0)" }, { transform: "rotateY(-60deg) skewY(-2deg)", offset: 0.5 }, { transform: "rotateY(-178deg)" }],
          { d: t.dur, delay: begin + i * t.dur * 0.45, e: t.e, fill: "forwards", comp: "add" });
        ctx.later(begin + i * t.dur * 0.45, () => ctx.sfx("page"));
      });
      ctx.later(begin, () => ctx.shade(a.layer, 0.45, { d: t.dur * 0.5 }));
      return t.dur + (leaves.length - 1) * t.dur * 0.45;
    } });

  registerMove({ id: "rise", group: "sinematik", label: "Yavaş yükselme", single: true, duration: 2.2, easing: "yavaslayarak",
    params: [{ key: "mode", label: "Biçim", def: "in", options: [["in", "Aşağıdan yükselerek belir"], ["up", "Yükselip uzaklaş"]] }],
    run(ctx, a, def, begin) {
      const t = timing(a, def), up = P(a, def, "mode") === "up";
      const kf = up ? [{ transform: "translateY(0)", opacity: 1 }, { transform: "translateY(-120px)", opacity: 0 }] : [{ transform: "translateY(110px)", opacity: 0 }, { transform: "translateY(0)", opacity: 1 }];
      ctx.anim(ctx.L[a.layer], kf, { d: t.dur, delay: begin, e: t.e, fill: up ? "forwards" : "both", comp: "add" });
      return t.dur;
    } });
  registerMove({ id: "drop", group: "sinematik", label: "Düşme ve sekme", single: true, duration: 1.3, easing: "duz",
    params: [{ key: "mode", label: "Biçim", def: "in", options: [["in", "Yukarıdan düşüp sekerek yerleş"], ["out", "Aşağı düşüp çık"]] }],
    run(ctx, a, def, begin) {
      const t = timing(a, def), out = P(a, def, "mode") === "out";
      const kf = out ? [{ transform: "translateY(0) rotate(0)", offset: 0, easing: "cubic-bezier(.55,0,1,.45)" }, { transform: "translateY(-24px) rotate(-2deg)", offset: 0.18, easing: "cubic-bezier(.55,0,1,.45)" }, { transform: "translateY(900px) rotate(8deg)", offset: 1 }]
        : [{ transform: "translateY(-760px)", offset: 0, easing: "cubic-bezier(.55,0,1,.45)" }, { transform: "translateY(0)", offset: 0.55, easing: "cubic-bezier(.16,1,.3,1)" },
           { transform: "translateY(-46px)", offset: 0.72, easing: "cubic-bezier(.55,0,1,.45)" }, { transform: "translateY(0)", offset: 0.86, easing: "cubic-bezier(.16,1,.3,1)" },
           { transform: "translateY(-12px)", offset: 0.93, easing: "cubic-bezier(.55,0,1,.45)" }, { transform: "translateY(0)", offset: 1 }];
      ctx.anim(ctx.L[a.layer], kf, { d: t.dur, delay: begin, e: "linear", fill: out ? "forwards" : "both", comp: "add" });
      if (!out) ctx.later(begin + t.dur * 0.55, () => ctx.sfx("knock"));
      return t.dur;
    } });
  registerMove({ id: "spin", group: "sinematik", label: "Kendi etrafında dönme", single: true, needsBack: true, duration: 1.6, easing: "yumusak", loop: true, defRepeat: 1,
    note: "Arka yüz görseli yüklemezseniz arkada görselin koyulaştırılmış hâli görünür.",
    params: [{ key: "axis", label: "Eksen", def: "y", options: [["y", "Dikey eksen (kart gibi)"], ["z", "Düz döner"]] }, { key: "turns", label: "Tur", def: 1, options: [[0.5, "Yarım tur"], [1, "1 tur"], [2, "2 tur"]] }],
    run(ctx, a, def, begin) {
      const t = timing(a, def), ax = P(a, def, "axis") === "z" ? "rotateZ" : "rotateY", deg = 360 * num(P(a, def, "turns"), 1);
      ctx.anim(ctx.L[a.layer], [{ transform: `${ax}(0)` }, { transform: `${ax}(${deg}deg)` }], { d: t.dur, delay: begin, e: t.e, it: t.it, fill: t.it === Infinity ? "none" : "forwards", comp: "add" });
      return t.it === Infinity ? 0 : t.dur * t.it;
    } });
  function scatter(ctx, a, t, begin, gather) {
    const g = tilesOf(ctx, a); if (!g) return;
    g.tiles.forEach((p, i) => {
      const cx = (p.c + 0.5) / g.cols - 0.5, cy = (p.r + 0.5) / g.rows - 0.5, seed = Math.sin(i * 12.9898) * 43758.5453, rnd = seed - Math.floor(seed);
      const far = `translate3d(${cx * 900 + (rnd - 0.5) * 160}px, ${cy * 1100 + (rnd - 0.5) * 200}px, ${ctx.Z(200 + rnd * 260)}px) rotate(${(rnd - 0.5) * 220}deg) rotateY(${(rnd - 0.5) * 160}deg)`;
      const kf = gather ? [{ transform: far, opacity: 0 }, { opacity: 1, offset: 0.4 }, { transform: "translate3d(0,0,0) rotate(0) rotateY(0)", opacity: 1 }]
        : [{ transform: "translate3d(0,0,0) rotate(0) rotateY(0)", opacity: 1 }, { opacity: 1, offset: 0.6 }, { transform: far, opacity: 0 }];
      ctx.anim(p.el, kf, { d: t.dur, delay: begin + rnd * t.dur * 0.25, e: t.e, fill: gather ? "both" : "forwards", comp: "add" });
    });
  }
  const SHATTER_PARAMS = [{ key: "grid", label: "Parça sayısı", def: "orta", options: [["az", "Az (12)"], ["orta", "Orta (24)"], ["cok", "Çok (40)"]] }];
  const SHATTER_GRID = { az: [3, 4], orta: [4, 6], cok: [5, 8] };
  function shatterPrepare(ctx, a, def) { const gsz = SHATTER_GRID[P(a, def, "grid")] || [4, 6]; const lite = ctx.lite ? [3, 4] : gsz; return tilePrepare(lite[0], lite[1])(ctx, a); }
  registerMove({ id: "shatter", group: "sinematik", label: "Parçalanarak dağılma", single: true, duration: 1.6, easing: "hizlanarak", params: SHATTER_PARAMS,
    note: "Görsel gerçek parçalarına bölünüp dört yana dağılır; arkasındaki katman veya kart ortaya çıkar.",
    prepare: shatterPrepare,
    run(ctx, a, def, begin) { const t = timing(a, def); scatter(ctx, a, t, begin, false); ctx.later(begin, () => ctx.sfx("crack")); return t.dur * 1.25; } });
  registerMove({ id: "assemble", group: "sinematik", label: "Parçaların birleşerek şekil oluşturması", single: true, duration: 1.8, easing: "yavaslayarak", params: SHATTER_PARAMS,
    note: "Görselin parçaları dağınık hâlden uçarak birleşir.",
    prepare: shatterPrepare,
    run(ctx, a, def, begin) { const t = timing(a, def); scatter(ctx, a, t, begin, true); ctx.later(begin + t.dur * 0.8, () => ctx.sfx("chime")); return t.dur * 1.25; } });
  registerMove({ id: "parallax", group: "sinematik", label: "Derinlikli parallax", needsLayers: 2, scene: true, duration: 4, easing: "yumusak", loop: true, defRepeat: 0,
    note: "Bütün sahneye uygulanır: öndeki katmanlar arkadakilerden daha çok kayar. En az iki katman gerekir.",
    params: [{ key: "dir", label: "Yön", def: "yatay", options: [["yatay", "Yatay"], ["dikey", "Dikey"]] }, { key: "amount", label: "Genlik", def: "orta", options: [["az", "Az"], ["orta", "Orta"], ["cok", "Çok"]] }],
    run(ctx, a, def, begin) {
      const t = timing(a, def), amp = { az: 6, orta: 12, cok: 22 }[P(a, def, "amount")] || 12, vert = P(a, def, "dir") === "dikey";
      const slots = ctx.model.slots, n = slots.length;
      slots.forEach((s, i) => {
        const el = s.backdrop ? ctx.L[s.id] : ctx.C[s.id]; if (!el) return;
        const k = (i - (n - 1) / 2) / Math.max(1, n - 1) * 2 + (s.backdrop ? -1 : 0);   // arka -1 … ön +1
        const d = amp * k;
        ctx.anim(el, [{ transform: vert ? `translateY(${-d}px)` : `translateX(${-d}px)` }, { transform: vert ? `translateY(${d}px)` : `translateX(${d}px)` }],
          { d: t.dur / 2, delay: begin, e: t.e, it: t.it === Infinity ? Infinity : t.it * 2, dir: "alternate", fill: "none", comp: "add" });
      });
      return t.it === Infinity ? 0 : t.dur * t.it;
    } });

  /* ---------- ışık ve efektler (görselden bağımsız) ---------- */
  function areaOf(ctx, a) { const c = center(ctx, a.layer); return { p: ctx.frameToScreen(c.x, c.y), c }; }
  function ambientFor(ctx, a, def, begin, opts) {
    const t = timing(a, def), dens = { az: 0.5, orta: 1, cok: 1.8 }[P(a, def, "density")] || 1;
    ctx.later(begin, () => {
      const h1 = ctx.fx.ambient(Object.assign({}, opts, { count: Math.round((opts.count || 30) * dens) }));
      if (t.it !== Infinity) ctx.later(t.dur, () => h1.stop());
    });
    return t.it === Infinity ? 0 : t.dur;
  }
  const DENSITY = { key: "density", label: "Yoğunluk", def: "orta", options: [["az", "Az"], ["orta", "Orta"], ["cok", "Çok"]] };
  registerMove({ id: "glitter", group: "isik", label: "Altın ve gümüş parıltılar", single: true, scene: true, duration: 3, easing: "duz", loop: true, defRepeat: 0,
    params: [{ key: "color", label: "Renk", def: "altin", options: [["altin", "Altın"], ["gumus", "Gümüş"], ["karisik", "Altın ve gümüş"]] }, DENSITY],
    run(ctx, a, def, begin) {
      const col = { altin: ["#F3D27A", "#FFF1C4", "#C9A45C"], gumus: ["#FFFFFF", "#DCE3EA", "#B8C2CC"], karisik: ["#F3D27A", "#FFFFFF", "#DCE3EA"] }[P(a, def, "color")];
      return ambientFor(ctx, a, def, begin, { type: "spark", count: 26, colors: col, size: 5, speed: 6, drift: 5, life: 5, from: "any", sway: 0 });
    } });
  registerMove({ id: "fog", group: "isik", label: "Sis ve duman", single: true, scene: true, duration: 2.5, easing: "yumusak", loop: true, defRepeat: 0,
    params: [DENSITY, { key: "color", label: "Renk", def: "beyaz", options: [["beyaz", "Beyaz sis"], ["mavi", "Mavimsi"], ["sicak", "Sıcak duman"]] }],
    run(ctx, a, def, begin) {
      if (ctx.lite) return 0;
      const t = timing(a, def), dens = { az: 0.25, orta: 0.45, cok: 0.7 }[P(a, def, "density")] || 0.45;
      const col = { beyaz: "rgba(230,230,240,.5)", mavi: "rgba(180,200,235,.5)", sicak: "rgba(240,215,180,.45)" }[P(a, def, "color")] || "rgba(230,230,240,.5)";
      ctx.later(begin, () => {
        for (let i = 0; i < 3; i++) {
          const f = h("div", "sc-fog", { bottom: (i * 14 - 8) + "%", background: `radial-gradient(ellipse at ${30 + i * 20}% 50%, ${col}, transparent 62%)`, opacity: "0" });
          ctx.overlay.insertBefore(f, ctx.fxCanvas);
          ctx.anim(f, [{ opacity: 0 }, { opacity: dens }], { d: t.dur, e: t.e, fill: "forwards" });
          ctx.anim(f, [{ transform: "translateX(-8%)" }, { transform: "translateX(8%)" }], { d: 9000 + i * 2500, it: Infinity, dir: "alternate", e: EASE.yumusak, fill: "none" });
        }
      });
      return t.it === Infinity ? 0 : t.dur;
    } });
  registerMove({ id: "snow", group: "isik", label: "Kar yağışı", single: true, scene: true, duration: 6, easing: "duz", loop: true, defRepeat: 0, params: [DENSITY],
    run(ctx, a, def, begin) { return ambientFor(ctx, a, def, begin, { type: "snow", count: 46, colors: ["#FFFFFF"], size: 4, speed: 46, drift: 22, life: 14 }); } });
  registerMove({ id: "petals", group: "isik", label: "Çiçek yaprakları", single: true, scene: true, duration: 6, easing: "duz", loop: true, defRepeat: 0,
    params: [{ key: "color", label: "Renk", def: "pembe", options: [["pembe", "Pembe ve beyaz"], ["gul", "Kırmızı gül"], ["beyaz", "Beyaz"]] }, DENSITY],
    run(ctx, a, def, begin) {
      const col = { pembe: ["#F8C8D4", "#FFFFFF", "#FBE3E8"], gul: ["#C9184A", "#FF4D6D", "#A4133C"], beyaz: ["#FFFFFF", "#F6EEE2", "#FBF7EF"] }[P(a, def, "color")];
      return ambientFor(ctx, a, def, begin, { type: "petal", count: 18, colors: col, size: 7, speed: 38, drift: 28, life: 13 });
    } });
  registerMove({ id: "fireworks", group: "isik", label: "Havai fişek", single: true, scene: true, duration: 2.4, easing: "duz",
    params: [{ key: "count", label: "Adet", def: 4, options: [[3, "3"], [4, "4"], [6, "6"]] }, { key: "color", label: "Renk", def: "renkli", options: [["renkli", "Renkli"], ["altin", "Altın"]] }],
    run(ctx, a, def, begin) {
      const t = timing(a, def), n = num(P(a, def, "count"), 4), cols = P(a, def, "color") === "altin" ? ["#F3D27A", "#FFF1C4", "#C9A45C"] : ["#F3D27A", "#FF6B6B", "#7FD8FF", "#B9F27C", "#FFFFFF"];
      for (let i = 0; i < n; i++) ctx.later(begin + i * t.dur / n, () => {
        ctx.fx.burst({ type: "firework", x: 0.2 + 0.6 * ((i * 0.37) % 1), y: 1.02, count: 1, speed: 760, spread: 0.12, angle: -Math.PI / 2, colors: [cols[i % cols.length]], gravity: 300, size: 4, life: 2.2 });
        ctx.sfx("boom", 0.6);
      });
      return t.dur + 1200;
    } });
  registerMove({ id: "stars", group: "isik", label: "Yıldız ve ateş böcekleri", single: true, scene: true, duration: 6, easing: "duz", loop: true, defRepeat: 0,
    params: [{ key: "kind", label: "Tür", def: "atesbocegi", options: [["atesbocegi", "Ateş böcekleri"], ["yildiz", "Yıldızlar"]] }, DENSITY],
    run(ctx, a, def, begin) {
      return P(a, def, "kind") === "yildiz"
        ? ambientFor(ctx, a, def, begin, { type: "star", count: 18, colors: ["#F3D27A", "#FFFFFF"], size: 4, speed: 6, drift: 6, life: 8, from: "any", sway: 0 })
        : ambientFor(ctx, a, def, begin, { type: "glow", count: 22, colors: ["rgba(230,255,150,.85)", "rgba(255,240,160,.8)"], size: 3, speed: 10, drift: 18, life: 9, from: "any" });
    } });
  registerMove({ id: "spotlight", group: "isik", label: "Sinematik spot ışıkları", single: true, scene: true, duration: 3, easing: "yumusak", loop: true, defRepeat: 0,
    params: [{ key: "color", label: "Renk", def: "sicak", options: [["sicak", "Sıcak"], ["beyaz", "Beyaz"], ["soguk", "Soğuk"]] }, { key: "count", label: "Spot", def: 2, options: [[2, "2 spot"], [3, "3 spot"]] }],
    run(ctx, a, def, begin) {
      const t = timing(a, def), n = num(P(a, def, "count"), 2);
      const col = { sicak: "rgba(255,236,190,.26)", beyaz: "rgba(255,255,255,.24)", soguk: "rgba(200,220,255,.24)" }[P(a, def, "color")] || "rgba(255,236,190,.26)";
      ctx.later(begin, () => {
        for (let i = 0; i < n; i++) {
          const x = n === 2 ? (i ? 78 : 22) : [15, 50, 85][i];
          const b = h("div", "sc-spot", { position: "absolute", bottom: "-8%", left: x + "%", width: "34%", height: "135%", marginLeft: "-17%", pointerEvents: "none", zIndex: "37",
            transformOrigin: "50% 100%", background: `linear-gradient(0deg, ${col}, transparent 88%)`, clipPath: "polygon(42% 100%, 58% 100%, 100% 0, 0 0)", WebkitClipPath: "polygon(42% 100%, 58% 100%, 100% 0, 0 0)",
            opacity: "0", mixBlendMode: "screen" });
          ctx.overlay.insertBefore(b, ctx.fxCanvas);
          ctx.anim(b, [{ opacity: 0 }, { opacity: 1 }], { d: 700, e: EASE.yumusak, fill: "forwards" });
          ctx.anim(b, [{ transform: `rotate(${(i % 2 ? 1 : -1) * 16}deg)` }, { transform: `rotate(${(i % 2 ? -1 : 1) * 12}deg)` }],
            { d: t.dur, e: t.e, it: t.it === Infinity ? Infinity : t.it * 2, dir: "alternate", fill: "forwards" });
        }
        ctx.sfx("projector");
      });
      return t.it === Infinity ? 0 : t.dur * t.it;
    } });
  registerMove({ id: "shadow", group: "isik", label: "Hareketli gölge", single: true, duration: 3, easing: "yumusak", loop: true, defRepeat: 0,
    note: "Görselin kendi şeklinde, zemine düşen yumuşak bir gölge eklenir ve ışık dolaşıyormuş gibi kayar.",
    prepare(ctx, a) {
      const S = ctx.S[a.layer], u = ctx.cfg.layers[a.layer]; if (!S || !u || !u.src || S.__shadow) return;
      const front = ctx.L[a.layer].querySelector("img"); if (!front) return;
      const sh = h("img", "sc-cast", { position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: front.style.objectFit || "contain", pointerEvents: "none",
        filter: ctx.lite ? "brightness(0)" : "brightness(0) blur(8px)", opacity: "0.42", transform: "translate3d(14px, 22px, -4px)" });
      sh.src = front.src; sh.alt = "";
      S.insertBefore(sh, S.firstChild);
      S.__shadow = sh;
    },
    run(ctx, a, def, begin) {
      const t = timing(a, def), sh = ctx.S[a.layer] && ctx.S[a.layer].__shadow; if (!sh) return t.dur;
      ctx.anim(sh, [{ transform: "translate3d(-18px, 22px, -4px)", opacity: 0.32 }, { transform: "translate3d(18px, 26px, -4px)", opacity: 0.46 }],
        { d: t.dur, delay: begin, e: t.e, it: t.it === Infinity ? Infinity : t.it, dir: "alternate", fill: "forwards" });
      return t.it === Infinity ? 0 : t.dur * t.it;
    } });

  function revealCard(ctx, style, t, begin) {
    if (!ctx.hasCard || ctx.__cardShown) return;
    ctx.__cardShown = true;
    // Kart her zaman bütün katmanların ÖNÜNDE belirir (yakınlaşan/çıkan katmanlar dahil). Öne alınıp
    // kameranın ilerlemesi de hesaba katılarak, perspektif büyümesi kadar küçültülür → ekranda doğal boyutta.
    const P = 1400 / Math.max(0.35, ctx.cfg.depth || 0.35), sf = ctx.scale(), camZ = ctx.__camZ || 0;
    const zc = Math.max(60, Math.min(300, (P - camZ) * 0.45 / sf));
    const k = Math.max(0.2, Math.min(1, (P - camZ - zc * sf) / (P - 60 * sf)));
    const from = { belir: `translateZ(${zc - 160}px) scale(${k * 0.85})`, in: `translateY(-520px) translateZ(${zc}px) rotateX(18deg) scale(${k})` }[style] || `translateY(90px) translateZ(${zc - 20}px) scale(${k * 0.94})`;
    const to = style === "in" ? `translateY(0) translateZ(${zc}px) rotateX(0) scale(${k})` : `translateY(0) translateZ(${zc}px) scale(${k})`;
    ctx.anim(ctx.cardWrap, [{ opacity: 0, transform: from }, { opacity: 1, transform: to }], { d: t.dur, delay: begin, e: t.e, fill: "forwards" });
    ctx.later(begin + t.dur * 0.3, () => ctx.sfx("chime"));
  }

  /* =================== SIRALAYICI =================== */
  // Her hareketin başlangıcı (ms): "with" = öncekiyle birlikte, "after" = öncekinden sonra,
  // "tap" = yeni bir dokunuş (bölümün başı). Sonsuz tekrarlar bitişi uzatmaz.
  function schedule(list) {
    let prevBegin = 0, prevEnd = 0, maxEnd = 0;
    return { items: list.map((a, i) => {
      const def = MOVES[a.move], t = timing(a, def), delay = Math.max(0, num(a.delay, 0) * 1000);
      let begin;
      if (i === 0 || a.start === "tap" || a.start === "at") begin = delay;   // "at" = bölüm başından itibaren belirli saniye
      else if (a.start === "with") begin = prevBegin + delay;
      else begin = prevEnd + delay;
      const end = begin + (t.it === Infinity ? 0 : t.dur * (def.loop ? t.it : 1));
      prevBegin = begin; prevEnd = end; maxEnd = Math.max(maxEnd, end);
      return { a, def, begin, end };
    }), get end() { return maxEnd; } };
  }
  function chunks(list) {
    const out = [];
    list.forEach((a, i) => { if (i === 0 || a.start === "tap") out.push([]); out[out.length - 1].push(a); });
    return out;
  }
  function runChunk(ctx, list) {
    const plan = schedule(list);
    let end = 0;
    plan.items.forEach(it => {
      let used = 0;
      try { used = it.def.run(ctx, it.a, it.def, it.begin) || 0; } catch (e) { console.error("[Studio SEOZ] Hareket hatası:", it.a.move, e); }
      if (isFinite(used)) end = Math.max(end, it.begin + used);
    });
    return ctx.wait(end);
  }
  function showTapHint(ctx, on) {
    const hint = ctx.overlay.querySelector(".sc-hint");
    if (!hint) return;
    if (on) { hint.textContent = "Devam etmek için dokunun"; hint.style.display = ""; }
    else hint.style.display = "none";
  }

  /* =================== SERBEST MODEL =================== */
  function placeholderArt(l) {
    return () => h("div", "sc-ph", null, [l.name || "Görsel yok"]);
  }
  function validParent(list, l) {
    const byId = {}; list.forEach(x => { byId[x.id] = x; });
    let p = byId[l.parent], guard = 0;
    while (p && guard++ < 50) { if (p.id === l.id) return null; if (p.backdrop) return null; p = byId[p.parent]; }
    const direct = byId[l.parent];
    return direct && !direct.backdrop && !l.backdrop ? direct : null;
  }

  function buildFreeModel(cfg) {
    const list = (Array.isArray(cfg.layers) ? cfg.layers : []).filter(l => l && l.id);
    const ids = {}; list.forEach(l => { ids[l.id] = true; });
    const acts = (Array.isArray(cfg.actions) ? cfg.actions : []).filter(a => a && MOVES[a.move] && (MOVES[a.move].scene || ids[a.layer]));
    const uses = (id, flag) => acts.some(a => a.layer === id && MOVES[a.move][flag]);
    const slots = list.map((l, i) => {
      const b = l.box || { x: 40, y: 120, w: 320, h: 460 };
      return { id: l.id, label: l.name || "Katman", backdrop: !!l.backdrop, fit: l.backdrop ? "cover" : "contain",
        box: { x: num(b.x, 0), y: num(b.y, 0), w: Math.max(4, num(b.w, 100)), h: Math.max(4, num(b.h, 100)) },
        z: (i + 1) * 2, zLayer: i * 1.5, origin: "50% 50%", back: uses(l.id, "needsBack") || !!l.backSrc, lit: uses(l.id, "needsLit"),
        art: placeholderArt(l) };
    });
    const firstTap = acts.findIndex(a => a.start === "tap");
    const pre = firstTap > 0 ? acts.slice(0, firstTap) : [];   // ilk dokunuştan önceki hareketler = bekleme (dikkat) bölümü
    const rest = firstTap >= 0 ? acts.slice(firstTap) : acts;
    const model = {
      id: "free", label: "Serbest stüdyo", icon: "🎬", concept: "none", slots,
      build(ctx) {
        // bağlı katmanlar: çocuk, ebeveyninin hareket kutusunun içine taşınır → onunla birlikte hareket eder
        list.forEach(l => {
          const p = l.parent && validParent(list, l);
          const child = ctx.S[l.id], host = p && ctx.L[p.id];
          if (!child || !host || child === ctx.S[p.id]) return;
          const cb = slots.find(s => s.id === l.id).box, pb = slots.find(s => s.id === p.id).box;
          child.style.left = (cb.x - pb.x) + "px"; child.style.top = (cb.y - pb.y) + "px";
          child.dataset.parent = p.id;
          host.appendChild(child);
        });
        acts.forEach(a => { const d = MOVES[a.move]; if (d.prepare) { try { d.prepare(ctx, a, d); } catch (e) { console.error(e); } } });
      },
      scenarios: [{
        id: "custom", label: "Kendi kurgum",
        attention(ctx) { if (pre.length) runChunk(ctx, pre); },
        async open(ctx) {
          const parts = rest.length ? chunks(rest) : [];
          for (let i = 0; i < parts.length; i++) {
            if (i > 0) { showTapHint(ctx, true); await ctx.waitTap(); showTapHint(ctx, false); if (ctx.dead) return; }
            await runChunk(ctx, parts[i]);
            if (ctx.dead) return;
          }
          if (!ctx.__cardShown && ctx.hasCard) {
            const t = { dur: 1300, e: EASE.yavaslayarak };
            revealCard(ctx, "yuksel", t, 0);
            await ctx.wait(t.dur);
          }
        }
      }]
    };
    const map = {}; list.forEach(l => { map[l.id] = l; });
    return { layers: map, actions: acts, __free: model };
  }

  /* =================== HAZIR KURGULAR (A1 kapı senaryoları) =================== */
  const PRESETS = [
    { id: "door:gizemli", label: "Kapı · Gizemli Açılış", model: "door", scenario: "gizemli" },
    { id: "door:gorkemli", label: "Kapı · Görkemli Giriş", model: "door", scenario: "gorkemli" },
    { id: "door:surpriz", label: "Kapı · Sürpriz Kapı", model: "door", scenario: "surpriz" }
  ];
  function presetOf(id) { return PRESETS.find(p => p.id === id) || null; }
  function rolesOf(presetId) {
    const p = presetOf(presetId), m = p && C.model(p.model);
    return m ? m.slots.map(s => ({ id: s.id, label: s.label, required: s.id === "leftWing" || s.id === "rightWing" })) : [];
  }
  function adaptPreset(cfg, p) {
    const list = Array.isArray(cfg.layers) ? cfg.layers : [];
    const byId = {}; list.forEach(l => { byId[l.id] = l; });
    const roles = (cfg.preset && cfg.preset.roles) || {}, artFill = !!(cfg.preset && cfg.preset.artFill);
    const layers = {};
    C.model(p.model).slots.forEach(s => {
      const l = byId[roles[s.id]];
      if (l && l.src) layers[s.id] = { src: l.src, backSrc: l.backSrc || "", thickness: l.thickness, light: l.light };
      else if (!artFill) layers[s.id] = { hidden: true };
    });
    const out = Object.assign({}, cfg, { model: p.model, scenario: p.scenario, layers });
    delete out.v; delete out.actions; delete out.preset;
    if (!out.skin) out.skin = "klasik";
    return out;
  }

  function adapt(cfg) {
    const p = cfg.preset && presetOf(cfg.preset.id);
    if (p && C.model(p.model)) return adaptPreset(cfg, p);
    return Object.assign({}, cfg, buildFreeModel(cfg));
  }
  C.setV2Adapter(adapt);

  // A2.2: bazı hareketler birden çok katman ister (ör. çekmece için kutu gövdesi). Yaklaşık
  // hareketler (approximate) menüde hiç gösterilmez.
  function movesByGroup() {
    return GROUPS.map(([g, label]) => ({ id: g, label, moves: ORDER.map(id => MOVES[id]).filter(m => m.group === g && !m.approximate) }));
  }
  function availability(moveId, layerCount) {
    const m = MOVES[moveId]; if (!m) return { ok: false, why: "Bilinmeyen hareket" };
    if (m.needsLayers && layerCount < m.needsLayers) return { ok: false, why: `En az ${m.needsLayers} katman gerekir` };
    return { ok: true };
  }

  /* =================== A2.3 ZAMAN ÇİZELGESİ =================== */
  /* Planı düz bir zamana yayar. Gerçek açılışta "Dokununca" adımları misafiri
     bekler; çizelgede bu bekleme sabit bir "dokunuş" aralığı olarak gösterilir.
     Bütün değerler motorun hızı uygulanmadan (ms) verilir; ekranda k ile çarpılır. */
  const TAP_GAP = 600, ATTENTION_MIN = 1500, CARD_AUTO = 1300;
  function plan(ncfg, entry) {
    const model = ncfg.__free, acts = model ? (ncfg.actions || []) : [];
    const firstTap = acts.findIndex(a => a.start === "tap");
    const pre = firstTap > 0 ? acts.slice(0, firstTap) : [];
    const rest = firstTap >= 0 ? acts.slice(firstTap) : acts;
    const items = [], taps = [];
    let t = 0;
    if (pre.length) {
      const sp = schedule(pre);
      sp.items.forEach(it => items.push(Object.assign({}, it, { begin: it.begin, end: it.end, loopForever: !isFinite(timing(it.a, it.def).it) && it.def.loop, chunk: 0 })));
      t = Math.max(ATTENTION_MIN, sp.end);
    } else t = ncfg.start === "auto" ? 1600 : 900;
    taps.push({ time: t, first: true });
    const parts = rest.length ? chunks(rest) : [];
    parts.forEach((list, ci) => {
      if (ci > 0) { t += TAP_GAP; taps.push({ time: t }); }
      const sp = schedule(list);
      sp.items.forEach(it => items.push(Object.assign({}, it, { begin: t + it.begin, end: t + it.end, loopForever: !isFinite(timing(it.a, it.def).it) && it.def.loop, chunk: ci + 1 })));
      t += sp.end;
    });
    const cardItem = items.find(it => it.def.isCard);
    const hasCard = !!(entry && (entry.cardSrc || ncfg.cardMode === "title")) && ncfg.cardMode !== "none";
    const cardStart = cardItem ? cardItem.begin : t;
    const cardShown = cardItem ? cardItem.end : (hasCard ? t + CARD_AUTO : t);
    const dd = entry && entry.cardDisplayDuration;
    const hold = dd === "tap" ? 3000 : Math.max(1, num(dd, 10)) * 1000;
    const end = Math.max(t, cardShown);
    const exitMs = Math.max(200, Math.min(4000, num(ncfg.exitDuration, 1) * 1000));
    return { items, taps, firstTap: taps[0].time, cardStart, cardShown, hasCard, autoCard: !cardItem && hasCard, holdTap: dd === "tap",
      exitAt: end + (hasCard ? hold : 0), exitMs, total: end + (hasCard ? hold : 0) + exitMs };
  }

  /* Zaman çizelgesi oynatıcısı: sahneyi "manual" kurar ve hareketleri negatif gecikmeyle
     başlatır → herhangi bir saniyeden oynatılabilir veya o anda dondurulabilir. */
  function runTimeline(doc, container, o) {
    o = o || {};
    const d2 = JSON.parse(JSON.stringify(doc)); d2.entry.cinema = Object.assign({}, d2.entry.cinema, { sound: !!o.sound });
    const hd = C.play(d2, null, { container, manual: true, reduced: false });
    const ctl = { hd, dead: false, timers: [], raf: 0, plan: null };
    ctl.stop = () => { ctl.dead = true; cancelAnimationFrame(ctl.raf); ctl.timers.forEach(clearTimeout); hd.destroy(); };
    ctl.ready = hd.ready.then(() => {
      const ctx = hd.ctx; if (!ctx || ctl.dead) return ctl;
      const p = plan(ctx.cfg, d2.entry); ctl.plan = p;
      const k = ctx.k, Tu = Math.max(0, Math.min(p.paused ? p.total : p.total, (o.from || 0) * 1000 / k));
      ctx.later = (ms, fn) => {   // geçmişte kalan ses/parçacık anlarını atla, gerisini bu oynatıcıya bağla
        if (ms < -1200) return;
        ctl.timers.push(setTimeout(() => { if (!ctx.dead && !ctl.dead) fn(); }, Math.max(0, ms) * k));
      };
      const pastTap = Tu >= p.firstTap;
      p.items.forEach(it => {
        if (pastTap && it.loopForever) return;   // bekleme döngüleri ilk dokunuşta durur
        try { it.def.run(ctx, it.a, it.def, it.begin - Tu); } catch (e) { console.error(e); }
      });
      if (!pastTap) ctx.later(p.firstTap - Tu, () => {
        hd.overlay.getAnimations({ subtree: true }).forEach(an => { if (an.effect && an.effect.getTiming().iterations === Infinity) an.cancel(); });
      });
      if (p.autoCard) revealCard(ctx, "yuksel", { dur: CARD_AUTO, e: EASE.yavaslayarak }, p.cardStart - Tu);
      const t0 = performance.now();
      const now = () => Math.min(p.total, Tu + (performance.now() - t0) / k) * k / 1000;
      ctl.time = now;
      if (o.paused) {
        requestAnimationFrame(() => requestAnimationFrame(() => {
          if (ctl.dead) return;
          hd.overlay.getAnimations({ subtree: true }).forEach(an => { try { an.pause(); } catch (e) { /* önemsiz */ } });
          if (ctx.fx) ctx.fx.pause();
          ctl.timers.forEach(clearTimeout); ctl.timers = [];
          ctl.time = () => Tu * k / 1000;
          if (o.onTick) o.onTick(Tu * k / 1000);
        }));
        return ctl;
      }
      ctl.timers.push(setTimeout(() => { if (!ctl.dead) hd.finish(false); }, Math.max(0, p.exitAt - Tu) * k));
      ctl.timers.push(setTimeout(() => { if (!ctl.dead && o.onEnd) o.onEnd(); }, Math.max(0, p.total - Tu) * k + 80));
      const tick = () => { if (ctl.dead) return; if (o.onTick) o.onTick(now()); ctl.raf = requestAnimationFrame(tick); };
      tick();
      return ctl;
    });
    return ctl;
  }

  global.SeozCinemaFree = { registerMove, moves: () => ORDER.map(id => MOVES[id]), move: id => MOVES[id], movesByGroup, availability, EASE_LABELS,
    PRESETS, presetOf, rolesOf, schedule, chunks, plan, runTimeline };
})(window);
