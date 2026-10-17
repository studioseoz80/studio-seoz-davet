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
    const dur = Math.max(50, num(a.duration, def.duration || 1) * 1000);
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

  function revealCard(ctx, style, t, begin) {
    if (!ctx.hasCard || ctx.__cardShown) return;
    ctx.__cardShown = true;
    // kamera ilerlediyse kart, sahnenin önünde kalıp perspektif büyümesi kadar küçültülür → ekranda doğal boyutta
    const P = 1400 / Math.max(0.35, ctx.cfg.depth || 0.35), sf = ctx.scale(), camZ = ctx.__camZ || 0;
    const k = Math.max(0.3, Math.min(1, (P - camZ - 60 * sf) / (P - 60 * sf)));
    const from = { belir: `translateZ(-100px) scale(${k * 0.85})`, in: `translateY(-520px) translateZ(60px) rotateX(18deg) scale(${k})` }[style] || `translateY(90px) translateZ(40px) scale(${k * 0.94})`;
    const to = style === "in" ? `translateY(0) translateZ(60px) rotateX(0) scale(${k})` : `translateY(0) translateZ(60px) scale(${k})`;
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
      if (i === 0 || a.start === "tap") begin = delay;
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

  function movesByGroup() {
    return GROUPS.map(([g, label]) => ({ id: g, label, moves: ORDER.map(id => MOVES[id]).filter(m => m.group === g && !m.approximate) }));
  }

  global.SeozCinemaFree = { registerMove, moves: () => ORDER.map(id => MOVES[id]), move: id => MOVES[id], movesByGroup, EASE_LABELS,
    PRESETS, presetOf, rolesOf, schedule, chunks };
})(window);
