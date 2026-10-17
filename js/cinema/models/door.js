/* =============================================================================
   MODEL 1 — ÇİFT KANATLI KAPI
   Katmanlar: arka plan, kapı çerçevesi, sol kanat, sağ kanat, tokmak/mühür,
   dekoratif ön katman. Senaryolar: Gizemli Açılış, Görkemli Giriş, Sürpriz Kapı.
   ========================================================================= */
(function (global) {
  "use strict";
  const C = global.SeozCinema, A = C.art, { h, svg } = C.util;

  // açıklık (kanatların durduğu boşluk)
  const OP = { x: 70, y: 150, w: 260, h: 470 };
  const HALF = OP.w / 2;

  const SKINS = {
    gotik:  { label: "Gotik (koyu meşe)", bg1: "#0D0B0C", bg2: "#2A2026", main: "#3B2418", main2: "#1F120B", accent: "#B88A3E", accent2: "#E6C77A", stone: "#4A4548", light: "#FFD9A0", paper: "#F4EBDD", ink: "#2A1F1A", studs: true, arch: "pointed" },
    klasik: { label: "Klasik (krem & altın)", bg1: "#E9DFD0", bg2: "#BFAE96", main: "#F3EBDD", main2: "#D9CBB3", accent: "#B8924A", accent2: "#E3C984", stone: "#D8CCBA", light: "#FFF3D6", paper: "#FBF7EF", ink: "#3A2E22", arch: "round" },
    modern: { label: "Modern (antrasit)", bg1: "#1B1D20", bg2: "#3A3E44", main: "#2C2F33", main2: "#1D1F22", accent: "#C9A45C", accent2: "#E8CF95", stone: "#575C63", light: "#FFFFFF", paper: "#FAFAF7", ink: "#1E2124", arch: "flat" },
    ayna:   { label: "Ayna (kuaför / güzellik)", bg1: "#EDE6E8", bg2: "#B9AAB0", main: "#D9DEE3", main2: "#9AA4AE", accent: "#C7A86A", accent2: "#F0DDB0", stone: "#E7E1DC", light: "#FFFFFF", paper: "#FFFDFB", ink: "#2E2A2C", mirror: true, arch: "round" },
    vitrin: { label: "Vitrin (cam mağaza)", bg1: "#F2EEE8", bg2: "#CFC6BA", main: "#1E1E1E", main2: "#0F0F0F", accent: "#C9A45C", accent2: "#EAD49A", stone: "#2A2A2A", light: "#FFF8EC", paper: "#FFFFFF", ink: "#1E1E1E", glass: true, arch: "flat" }
  };

  function wingArt(side) {
    return function (ctx) {
      const P = ctx.pal, left = side === "left";
      const rad = P.arch === "round" ? (left ? "130px 0 0 0 / 110px 0 0 0" : "0 130px 0 0 / 0 110px 0 0")
                : P.arch === "pointed" ? (left ? "100% 0 0 0 / 34% 0 0 0" : "0 100% 0 0 / 0 34% 0 0") : "0";
      let bg;
      if (P.mirror) bg = `${A.tex.glass()}, linear-gradient(${left ? 100 : 80}deg, ${P.main2}, ${P.main} 45%, #F4F7FA 60%, ${P.main})`;
      else if (P.glass) bg = `${A.tex.glass()}, linear-gradient(180deg, rgba(255,255,255,.18), rgba(255,255,255,.06))`;
      else bg = A.tex.wood(P.main, P.main2);
      const wing = h("div", "sc-face", { background: bg, borderRadius: rad, overflow: "hidden",
        boxShadow: `inset ${left ? "-" : ""}6px 0 14px rgba(0,0,0,.35), inset 0 0 0 2px ${P.glass ? P.main : "rgba(0,0,0,.25)"}` });
      if (P.glass) wing.style.border = `10px solid ${P.main}`;
      // paneller / pervazlar
      const panel = (y, hh) => h("div", "", { position: "absolute", left: "16px", right: "16px", top: y + "px", height: hh + "px", borderRadius: P.arch === "flat" ? "2px" : "6px",
        boxShadow: P.glass ? "inset 0 0 0 1px rgba(255,255,255,.35)" : `inset 0 0 0 3px ${P.mirror ? "rgba(255,255,255,.5)" : P.accent}, inset 0 0 0 6px rgba(0,0,0,.18), inset 0 0 18px rgba(0,0,0,.25)`,
        background: P.mirror ? "linear-gradient(130deg, rgba(255,255,255,.4), transparent 40%, rgba(255,255,255,.25) 70%, transparent)" : "transparent" });
      if (!P.glass) { wing.appendChild(panel(70, 170)); wing.appendChild(panel(262, 180)); }
      else {
        // vitrin: mağaza adı camda
        const t = h("div", "", { position: "absolute", left: left ? "auto" : "0", right: left ? "0" : "auto", top: "150px", width: "100%", textAlign: left ? "right" : "left",
          color: P.accent, font: "600 22px 'Cinzel',serif", letterSpacing: ".08em", padding: left ? "0 4px 0 0" : "0 0 0 4px", opacity: ".9", whiteSpace: "nowrap" });
        const title = (ctx.cfg.brand.text || (ctx.doc.meta && ctx.doc.meta.title) || "").toLocaleUpperCase("tr-TR");
        const half = Math.ceil(title.length / 2);
        t.textContent = left ? title.slice(0, half) : title.slice(half);
        wing.appendChild(t);
      }
      if (P.studs) {
        wing.appendChild(h("div", "", { position: "absolute", inset: "0", background: "radial-gradient(circle, rgba(20,16,14,.9) 0 2.2px, rgba(230,199,122,.55) 2.6px 3.2px, transparent 3.6px) 0 0/34px 46px", opacity: ".55", mixBlendMode: "multiply" }));
        // demir menteşe bantları
        [110, 380].forEach(y => wing.appendChild(h("div", "", { position: "absolute", top: y + "px", [left ? "left" : "right"]: "0", width: "78%", height: "12px",
          background: "linear-gradient(180deg,#2B2622,#5A524B 50%,#1C1916)", borderRadius: left ? "0 8px 8px 0" : "8px 0 0 8px", boxShadow: "0 2px 3px rgba(0,0,0,.5)" })));
      }
      // kulp
      wing.appendChild(h("div", "", { position: "absolute", top: "250px", [left ? "right" : "left"]: "10px", width: P.arch === "flat" ? "8px" : "10px", height: P.arch === "flat" ? "90px" : "26px",
        borderRadius: "6px", background: A.tex.metal(P.accent), boxShadow: "0 2px 4px rgba(0,0,0,.45)" }));
      if (P.mirror) wing.appendChild(A.sheen(0.6));
      // kanadın arka yüzü (dışa açılan senaryolarda görünür)
      const back = h("div", "sc-face", { background: P.glass ? "rgba(255,255,255,.12)" : A.tex.wood(C.util.mix(P.main, "#000", 0.25), C.util.mix(P.main2, "#000", 0.3)),
        borderRadius: rad, transform: "rotateY(180deg)", boxShadow: "inset 0 0 0 2px rgba(0,0,0,.35), inset 0 0 30px rgba(0,0,0,.5)", border: P.glass ? `10px solid ${P.main}` : "" });
      return h("div", "", { position: "absolute", inset: "0", transformStyle: "preserve-3d" }, [wing, back]);
    };
  }

  function frameArt(ctx) {
    const P = ctx.pal;
    const pad = 22;
    const g = h("div", "", { position: "absolute", inset: "0" });
    const rad = P.arch === "round" ? "152px 152px 0 0 / 132px 132px 0 0" : P.arch === "pointed" ? "50% 50% 0 0 / 40% 40% 0 0" : "4px";
    g.appendChild(h("div", "", { position: "absolute", left: (OP.x - pad) + "px", top: (OP.y - pad) + "px", width: (OP.w + pad * 2) + "px", height: (OP.h + pad) + "px",
      boxSizing: "border-box", border: `${pad}px solid ${P.stone}`, borderBottom: "none", borderRadius: rad,
      boxShadow: `inset 0 0 0 2px ${P.accent}, 0 0 0 2px rgba(0,0,0,.25), 0 30px 60px rgba(0,0,0,.45), inset 0 8px 20px rgba(0,0,0,.4)`,
      background: "transparent" }));
    // kemer taşı / amblem
    g.appendChild(A.emblem(ctx, { x: 200, y: OP.y - 2, size: 46, color: P.accent2 || P.accent }));
    // eşik
    g.appendChild(h("div", "", { position: "absolute", left: (OP.x - 40) + "px", top: (OP.y + OP.h) + "px", width: (OP.w + 80) + "px", height: "16px",
      background: `linear-gradient(180deg, ${P.stone}, ${C.util.mix(P.stone, "#000", 0.4)})`, borderRadius: "3px", boxShadow: "0 10px 24px rgba(0,0,0,.5)" }));
    return g;
  }

  function knockerArt(ctx) {
    const P = ctx.pal;
    if (P.glass) return null;
    return svg(`<svg viewBox="0 0 60 80"><defs><linearGradient id="kg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="${P.accent2}"/><stop offset=".5" stop-color="${P.accent}"/><stop offset="1" stop-color="${C.util.mix(P.accent, "#000", 0.45)}"/></linearGradient></defs>
      <circle cx="30" cy="12" r="9" fill="url(#kg)" stroke="rgba(0,0,0,.35)"/><circle cx="30" cy="12" r="3.5" fill="${C.util.mix(P.accent, "#000", 0.5)}"/>
      <circle cx="30" cy="46" r="22" fill="none" stroke="url(#kg)" stroke-width="6"/><circle cx="30" cy="46" r="22" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="1"/></svg>`);
  }

  function decorArt(ctx) {
    const P = ctx.pal, s = ctx.cfg.skin;
    const g = h("div", "", { position: "absolute", inset: "0" });
    if (s === "gotik") {
      [42, 358].forEach(x => {
        g.appendChild(h("div", "sc-lantern", { position: "absolute", left: (x - 16) + "px", top: "150px", width: "32px", height: "54px", borderRadius: "6px 6px 10px 10px",
          background: "radial-gradient(circle at 50% 55%, #FFE2A8 0 30%, #E08B2E 55%, rgba(60,30,10,.9) 75%)", boxShadow: "0 0 30px 10px rgba(255,170,70,.35), inset 0 0 0 3px #2B2622" }));
        g.appendChild(h("div", "", { position: "absolute", left: (x - 1) + "px", top: "100px", width: "2px", height: "50px", background: "#2B2622" }));
      });
    } else if (s === "klasik" || s === "ayna") {
      // çiçek girlandı
      g.appendChild(svg(`<svg viewBox="0 0 400 120"><path d="M30 90 Q200 10 370 90" fill="none" stroke="#8FA47A" stroke-width="3"/>
        ${[50, 95, 140, 200, 260, 305, 350].map((x, i) => `<g transform="translate(${x},${68 - Math.sin(i / 6 * Math.PI) * 42})"><circle r="9" fill="${i % 2 ? "#F4D9DC" : "#FFFFFF"}"/><circle r="4" fill="${P.accent}"/></g>`).join("")}</svg>`,
        "", { position: "absolute", left: "0", top: "70px", width: "400px", height: "120px" }));
    } else if (s === "vitrin") {
      g.appendChild(h("div", "", { position: "absolute", left: "40px", top: "86px", width: "320px", height: "44px", background: P.main, color: P.accent2,
        display: "flex", alignItems: "center", justifyContent: "center", font: "600 18px 'Cinzel',serif", letterSpacing: ".18em" }, [(ctx.cfg.brand.text || (ctx.doc.meta && ctx.doc.meta.title) || "").toLocaleUpperCase("tr-TR")]));
    }
    return g;
  }

  function build(ctx) {
    const P = ctx.pal;
    // kapının arkasındaki ışık
    ctx.doorLight = ctx.piece("door-light", { x: OP.x, y: OP.y, w: OP.w, h: OP.h }, 1, [
      h("div", "", { position: "absolute", inset: "0", borderRadius: P.arch === "flat" ? "0" : "130px 130px 0 0 / 110px 110px 0 0",
        background: `radial-gradient(ellipse at 50% 60%, #FFFFFF 0%, ${P.light} 30%, ${C.util.mix(P.light, "#000", 0.3)} 70%)` })], -30);
    ctx.doorLight.style.opacity = "0";
    // kanat aralığından sızan ışık çizgisi
    ctx.crack = ctx.piece("door-crack", { x: 197, y: OP.y + 30, w: 6, h: OP.h - 40 }, 9, [
      h("div", "", { position: "absolute", inset: "0", background: `linear-gradient(180deg, transparent, ${P.light} 15%, #FFFFFF 50%, ${P.light} 85%, transparent)`, boxShadow: `0 0 18px 6px ${P.light}`, borderRadius: "3px" })], 3);
    ctx.crack.style.opacity = "0";
    // kapı altından sızan ışık
    ctx.under = ctx.piece("door-under", { x: OP.x + 10, y: OP.y + OP.h - 6, w: OP.w - 20, h: 14 }, 9, [
      h("div", "", { position: "absolute", inset: "0", background: `radial-gradient(ellipse, ${P.light}, transparent 70%)`, filter: ctx.lite ? "" : "blur(2px)" })], 2);
    ctx.under.style.opacity = "0";
    // kart kapının arkasında başlar
    ctx.cardWrap.style.transform = `translateZ(${-40}px)`;
    ctx.hinge("knocker", OP.x + OP.w, 0);
  }

  function knock(ctx, at) {
    ctx.later(at, () => {
      ctx.anim(ctx.L.knocker, [{ transform: "rotateX(0)" }, { transform: "rotateX(-38deg)", offset: 0.4 }, { transform: "rotateX(0)" }], { d: 260, e: ctx.E.in });
      ctx.anim(ctx.L.leftWing, [{ transform: "translateX(0)" }, { transform: "translateX(-1.5px) rotateY(.6deg)" }, { transform: "translateX(0)" }], { d: 160, delay: 110 });
      ctx.anim(ctx.L.rightWing, [{ transform: "translateX(0)" }, { transform: "translateX(1.5px) rotateY(-.6deg)" }, { transform: "translateX(0)" }], { d: 160, delay: 110 });
      ctx.sfx("knock", 110);
    });
  }

  C.registerModel({
    id: "door", label: "Çift Kanatlı Kapı", icon: "🚪", concept: "zarif",
    description: "İki kanadı ayrı ayrı açılan, aralığından ışık sızan kapı.",
    skins: SKINS,
    accessoryAt: { x: 200, y: 395 },
    /* Katman sözleşmesi: kutular 400×700'lük mantıksal sahnede (rehber
       görseller bunun 3 katı çözünürlükte hazırlanır). "guide" alanı,
       editördeki rehber görseli ve yükleme kontrollerini besler:
         alpha : "required" saydamlık şart · "recommended" önerilir · "no" gerekmez
         clear : saydam kalması gereken bölgeler (sahne koordinatı)
         hinge : dönme ekseninin olduğu kenar (left/right) */
    slots: [
      { id: "background", label: "Arka plan", backdrop: true, fit: "cover",
        art: ctx => A.backdrop({ background: `radial-gradient(ellipse at 50% 40%, ${ctx.pal.bg2}, ${ctx.pal.bg1} 75%)` }),
        guide: { file: "01-arka-plan", size: [1024, 2048], alpha: "no",
          note: "Tam ekran arka plan (duvar dokusu, salon, gökyüzü). Telefonda yanlar, bilgisayarda üst ve alt kırpılır; önemli ayrıntıyı ortadaki kesikli kutuya koyun." } },
      { id: "frame", label: "Kapı çerçevesi / duvar", box: { x: 0, y: 0, w: 400, h: 700 }, z: 3, zLayer: 2, art: frameArt,
        guide: { file: "02-kapi-cercevesi", alpha: "required", clear: [{ x: OP.x, y: OP.y, w: OP.w, h: OP.h, label: "KAPI AÇIKLIĞI · SAYDAM BIRAKIN" }],
          note: "Duvar, kemer, pervaz, sütun ve eşik. Kapı açıklığı tamamen saydam olmalı; kanatlar açılınca arkadaki ışık ve iç kart buradan görünür." } },
      { id: "leftWing", label: "Sol kapı kanadı", box: { x: OP.x, y: OP.y, w: HALF, h: OP.h }, z: 2, origin: "0% 50%", art: wingArt("left"), zLayer: 1,
        back: true, thickness: 12, lit: true,
        guide: { file: "03-sol-kanat", alpha: "recommended", hinge: "left", backFile: "03b-sol-kanat-arka-yuz",
          note: "Sol kanat, kapalı hâliyle önden. Menteşe sol kenarda; kanat bu çizginin etrafında döner. Kemerli kapıda kemerin dışını saydam bırakın. Kanadın orta kenarı sağdaki çizgiye tam oturmalı." } },
      { id: "rightWing", label: "Sağ kapı kanadı", box: { x: OP.x + HALF, y: OP.y, w: HALF, h: OP.h }, z: 2, origin: "100% 50%", art: wingArt("right"), zLayer: 1,
        back: true, thickness: 12, lit: true,
        guide: { file: "04-sag-kanat", alpha: "recommended", hinge: "right", backFile: "04b-sag-kanat-arka-yuz",
          note: "Sağ kanat, kapalı hâliyle önden. Menteşe sağ kenarda. Tokmak ayrı katmandır; kanadın üzerine çizmeyin (yalnızca tokmak yoksa çizebilirsiniz)." } },
      { id: "knocker", label: "Tokmak veya mühür", box: { x: 206, y: 330, w: 48, h: 64 }, z: 4, origin: "50% 15%", art: knockerArt, zLayer: 4, lit: true,
        guide: { file: "05-tokmak", alpha: "required", pivot: [0.5, 0.15],
          note: "Kapı tokmağı, halka ya da mühür. Sağ kanadın üzerinde durur, kanatla birlikte döner. Artı işareti asılma (sallanma) noktasıdır." } },
      { id: "decor", label: "Dekoratif ön katman", box: { x: 0, y: 0, w: 400, h: 700 }, z: 10, art: decorArt, zLayer: 20,
        guide: { file: "06-on-suslemeler", alpha: "required", clear: [{ x: OP.x + 20, y: OP.y + 60, w: OP.w - 40, h: OP.h - 120, label: "MÜMKÜNSE BOŞ BIRAKIN", soft: true }],
          note: "Kapının önündeki süsler: fener, çiçek girlandı, sarmaşık, kurdele. Saydam zemin üzerinde hazırlayın; açılışın başında öne doğru süzülüp kaybolur." } }
    ],
    cardGuide: { file: "07-ic-kart", box: { x: 50, y: 90, w: 300, h: 520 }, note: "Kapı açılınca ışığın içinde beliren iç kart (davetiye metni). Editördeki \"İç Kart Görseli\" alanına yüklenir." },
    build,
    scenarios: [
      {
        id: "gizemli", label: "Gizemli Açılış", concept: "gizem",
        description: "Karanlıkta kapı altından ışık sızar, tokmak üç kez vurulur, kapı ağır ağır içeri açılır ve kamera ışığın içine ilerler.",
        attention(ctx) {
          ctx.dark = ctx.darkness(0.35);
          ctx.loop(ctx.under, [{ opacity: 0.25 }, { opacity: 0.85 }], { d: 1800 });
          ctx.loop(ctx.L.knocker, [{ transform: "rotateX(0)" }, { transform: "rotateX(-6deg)" }], { d: 2200 });
          ctx.loop(ctx.L.decor, [{ transform: "translateY(0)" }, { transform: "translateY(3px)" }], { d: 2600 });
          ctx.cam([{ transform: "translateZ(0)" }, { transform: `translateZ(${ctx.Z(30)}px)` }], { d: 5200, it: Infinity, dir: "alternate", e: ctx.E.inOut });
        },
        async open(ctx) {
          [0, 520, 1040].forEach(t => knock(ctx, t));
          await ctx.wait(1500);
          await ctx.accessory();
          ctx.sfx("creak");
          ctx.anim(ctx.crack, [{ opacity: 0, transform: "scaleY(.2)" }, { opacity: 1, transform: "scaleY(1)" }], { d: 700, e: ctx.E.out });
          ctx.anim(ctx.doorLight, [{ opacity: 0 }, { opacity: 0.55 }], { d: 700 });
          ctx.sheen("leftWing", { d: 900 }); ctx.sheen("rightWing", { d: 900 });
          await ctx.wait(650);
          const D = 2300;
          ctx.anim(ctx.L.leftWing, [{ transform: "rotateY(0)" }, { transform: "rotateY(6deg)", offset: 0.15 }, { transform: "rotateY(82deg)" }], { d: D, e: ctx.E.heavy });
          ctx.anim(ctx.L.rightWing, [{ transform: "rotateY(0)" }, { transform: "rotateY(-6deg)", offset: 0.15 }, { transform: "rotateY(-82deg)" }], { d: D, e: ctx.E.heavy });
          ctx.anim(ctx.C.knocker, [{ transform: "rotateY(0)" }, { transform: "rotateY(-6deg)", offset: 0.15 }, { transform: "rotateY(-82deg)" }], { d: D, e: ctx.E.heavy });
          // içeri dönen kanatların ön yüzü ışıktan uzaklaşır: kendi şeklinde koyulaşır
          ["leftWing", "rightWing", "knocker"].forEach(id => ctx.shade(id, 0.6, { d: D, delay: 250, e: ctx.E.heavy }));
          ctx.anim(ctx.crack, [{ opacity: 1 }, { opacity: 0 }], { d: 600, delay: 400 });
          ctx.anim(ctx.doorLight, [{ opacity: 0.55 }, { opacity: 1 }], { d: 1200, delay: 300 });
          if (ctx.dark) ctx.anim(ctx.dark, [{ opacity: 0.35 }, { opacity: 0 }], { d: 1600, delay: 600 });
          ctx.retire(ctx.anim(ctx.L.decor, [{ opacity: 1 }, { opacity: 0, transform: "translateY(-40px) scale(1.15)" }], { d: 1400, delay: 700 }), ctx.S.decor);
          await ctx.wait(1300);
          // kamera kapıdan içeri ilerler; kapı ışığın içinde erir, kart o ışıkta belirir
          const warm = ctx.bgLight({ background: `radial-gradient(ellipse at 50% 45%, #FFFFFF, ${ctx.pal.light} 45%, ${ctx.mix(ctx.pal.light, "#000", 0.35)})` });
          const camA = ctx.cam([{ transform: "translateZ(0)" }, { transform: `translateZ(${ctx.Z(420) + 320}px) translateY(-14px)` }], { d: 1900, e: ctx.E.in, fill: "forwards" });
          ["frame", "leftWing", "rightWing", "knocker"].forEach(id => ctx.retire(ctx.anim(ctx.S[id], [{ opacity: 1 }, { opacity: 0 }], { d: 650, delay: 1150 }), ctx.S[id]));
          ctx.anim(ctx.doorLight, [{ opacity: 1 }, { opacity: 0 }], { d: 600, delay: 1350 });
          ctx.anim(warm, [{ opacity: 0 }, { opacity: 1 }], { d: 900, delay: 900 });
          ctx.later(1150, () => ctx.flash("#FFF8EC", 1300, 0.8));
          await ctx.wait(1900);
          if (camA) camA.cancel();
          const halo = ctx.glow(200, 350, 560, "rgba(255,255,255,.95)", 19);
          ctx.anim(halo, [{ opacity: 0 }, { opacity: 0.85 }], { d: 1200 });
          ctx.anim(ctx.cardWrap, [{ opacity: 0, transform: "translateZ(-120px) scale(.9)" }, { opacity: 1, transform: "translateZ(0) scale(1)" }], { d: 1500, e: ctx.E.out });
          ctx.sfx("chime", 200);
          ctx.later(500, () => ctx.celebrate(200, 330, 0.6));
          await ctx.wait(1500);
        }
      },
      {
        id: "gorkemli", label: "Görkemli Giriş", concept: "altin",
        description: "Altın ışık huzmeleri döner, kilit açılır, kanatlar izleyiciye doğru hızla açılır; kamera yükselir ve kart yukarıdan süzülür.",
        attention(ctx) {
          ctx.rayEl = ctx.rays(200, 340, 760, "rgba(255,226,150,.5)", 0);
          ctx.rayEl.style.transform = "translateZ(-60px)";
          ctx.anim(ctx.rayEl, [{ opacity: 0 }, { opacity: 0.55 }], { d: 1200 });
          ctx.loop(ctx.rayEl, [{ transform: "translateZ(-60px) rotate(0)" }, { transform: "translateZ(-60px) rotate(40deg)" }], { d: 9000, e: "linear", dir: "normal" });
          ctx.loop(ctx.crack, [{ opacity: 0.1 }, { opacity: 0.5 }], { d: 1600 });
          ctx.loop(ctx.L.decor, [{ transform: "rotate(0)" }, { transform: "rotate(.6deg)" }], { d: 2400 });
          ["leftWing", "rightWing", "knocker"].forEach((id, i) => ctx.sheen(id, { d: 3200, delay: 400 + i * 180, it: Infinity }));
        },
        async open(ctx) {
          ctx.sfx("lock");
          ctx.anim(ctx.L.knocker, [{ transform: "rotateZ(0)" }, { transform: "rotateZ(-70deg)" }, { transform: "rotateZ(0)" }], { d: 520, e: ctx.E.inOut });
          ctx.anim(ctx.L.leftWing, [{ transform: "translateZ(0)" }, { transform: "translateZ(10px)" }], { d: 360, e: ctx.E.out });
          ctx.anim(ctx.L.rightWing, [{ transform: "translateZ(0)" }, { transform: "translateZ(10px)" }], { d: 360, e: ctx.E.out });
          await ctx.wait(520);
          await ctx.accessory();
          ctx.sfx("whoosh"); ctx.sfx("fanfare", 250);
          const D = 1100;
          ctx.anim(ctx.L.leftWing, [{ transform: "translateZ(10px) rotateY(0)" }, { transform: "translateZ(10px) rotateY(-112deg)" }], { d: D, e: ctx.E.back, fill: "forwards" });
          ctx.anim(ctx.L.rightWing, [{ transform: "translateZ(10px) rotateY(0)" }, { transform: "translateZ(10px) rotateY(112deg)" }], { d: D, e: ctx.E.back, fill: "forwards" });
          ctx.anim(ctx.C.knocker, [{ transform: "rotateY(0)" }, { transform: "rotateY(112deg)" }], { d: D, e: ctx.E.back, fill: "forwards" });
          ctx.anim(ctx.doorLight, [{ opacity: 0 }, { opacity: 1 }], { d: 500 });
          ["leftWing", "rightWing"].forEach(id => { ctx.sheen(id, { d: 700 }); ctx.shade(id, 0.45, { d: D, delay: 250 }); });
          ctx.anim(ctx.crack, [{ opacity: 1 }, { opacity: 0 }], { d: 300 });
          ctx.flash("#FFE7A8", 1200, 0.85);
          if (ctx.rayEl) ctx.anim(ctx.rayEl, [{ opacity: 0.55, transform: "translateZ(-60px) scale(1) rotate(0)" }, { opacity: 1, transform: "translateZ(-60px) scale(1.5) rotate(90deg)" }], { d: 2600, e: ctx.E.out });
          ctx.later(300, () => ctx.celebrate(200, 300, 1.2));
          ctx.retire(ctx.anim(ctx.L.decor, [{ opacity: 1 }, { opacity: 0, transform: "scale(1.3)" }], { d: 900, delay: 200 }), ctx.S.decor);
          await ctx.wait(700);
          // kamera yükselir, kart yukarıdan süzülür
          ctx.cam([{ transform: "translateY(0) rotateX(0)" }, { transform: "translateY(70px) rotateX(-5deg)", offset: 0.45 }, { transform: "translateY(0) rotateX(0)" }], { d: 2400, e: ctx.E.inOut });
          const halo = ctx.glow(200, 350, 520, "rgba(255,236,190,.9)", 19);
          ctx.anim(halo, [{ opacity: 0 }, { opacity: 0.9 }], { d: 1600, delay: 600 });
          ctx.anim(ctx.cardWrap, [{ opacity: 0, transform: "translateY(-560px) translateZ(150px) scale(.9) rotateX(24deg)" }, { opacity: 1, transform: "translateY(0) translateZ(150px) scale(.9) rotateX(0)" }], { d: 2000, delay: 500, e: ctx.E.back });
          ctx.sfx("chime", 1700);
          await ctx.wait(2500);
        }
      },
      {
        id: "surpriz", label: "Sürpriz Kapı", concept: "konfeti",
        description: "Kapı aralanıp hemen kapanarak merak uyandırır, sarsılır; sonra kanatlar duvarlara kayar, konfeti patlar ve kart aralıktan fırlar.",
        attention(ctx) {
          // kapı aralanıp kapanır (cilve)
          ctx.anim(ctx.L.rightWing, [{ transform: "rotateY(0)" }, { transform: "rotateY(0)", offset: 0.55 }, { transform: "rotateY(-16deg)", offset: 0.68 }, { transform: "rotateY(0)", offset: 0.8 }, { transform: "rotateY(0)" }],
            { d: 3200, it: Infinity, e: ctx.E.inOut });
          ctx.anim(ctx.crack, [{ opacity: 0 }, { opacity: 0, offset: 0.55 }, { opacity: 0.9, offset: 0.68 }, { opacity: 0, offset: 0.8 }, { opacity: 0 }], { d: 3200, it: Infinity });
          ctx.anim(ctx.C.knocker, [{ transform: "rotateY(0)" }, { transform: "rotateY(0)", offset: 0.55 }, { transform: "rotateY(-16deg)", offset: 0.68 }, { transform: "rotateY(0)", offset: 0.8 }, { transform: "rotateY(0)" }],
            { d: 3200, it: Infinity, e: ctx.E.inOut });
        },
        async open(ctx) {
          ctx.sfx("knock"); ctx.sfx("knock", 160); ctx.sfx("knock", 320);
          const shake = [];
          for (let i = 0; i <= 10; i++) shake.push({ transform: `translate(${(i % 2 ? 1 : -1) * (2 + i * 0.5)}px, ${(i % 3 - 1) * 1.5}px) rotate(${(i % 2 ? 0.4 : -0.4)}deg)` });
          shake.push({ transform: "translate(0,0) rotate(0)" });
          ctx.anim(ctx.frame, shake, { d: 700, e: "linear" });
          await ctx.wait(750);
          await ctx.accessory();
          // sürgülü açılış: kanatlar duvarlara kayar
          ctx.sfx("pop"); ctx.sfx("whoosh", 40); ctx.sfx("fanfare", 300);
          // kanatlar duvarın içine kayarak katlanır (sürgülü kapı)
          ctx.anim(ctx.L.leftWing, [{ transform: "scaleX(1)" }, { transform: "scaleX(.04)" }], { d: 520, e: ctx.E.snap, fill: "forwards" });
          ctx.anim(ctx.L.rightWing, [{ transform: "scaleX(1)" }, { transform: "scaleX(.04)" }], { d: 520, e: ctx.E.snap, fill: "forwards" });
          ["leftWing", "rightWing"].forEach(id => ctx.shade(id, 0.7, { d: 420 }));
          ctx.hinge("knocker", OP.x + OP.w, 400);
          ctx.anim(ctx.C.knocker, [{ transform: "scaleX(1)", opacity: 1 }, { transform: "scaleX(.04)", opacity: 0 }], { d: 520, e: ctx.E.snap, fill: "forwards" });
          ctx.anim(ctx.doorLight, [{ opacity: 0 }, { opacity: 1 }], { d: 200 });
          ctx.flash("#FFFFFF", 700, 0.9);
          const p = ctx.frameToScreen(200, 420);
          ctx.fx.burst({ type: "confetti", x: p.x, y: p.y, count: 90, speed: 900, spread: 0.55, angle: -Math.PI / 2 - 0.5, size: 10, colors: ["#E94F6B", "#F7C548", "#4FB0E9", "#7BD389", "#FFFFFF"] });
          ctx.fx.burst({ type: "confetti", x: p.x, y: p.y, count: 90, speed: 900, spread: 0.55, angle: -Math.PI / 2 + 0.5, size: 10, colors: ["#E94F6B", "#F7C548", "#4FB0E9", "#7BD389", "#FFFFFF"] });
          ctx.celebrate(200, 380, 1);
          ctx.retire(ctx.anim(ctx.L.decor, [{ opacity: 1 }, { opacity: 0, transform: "scale(1.4)" }], { d: 500 }), ctx.S.decor);
          ctx.anim(ctx.S.frame, [{ transform: getComputedStyle(ctx.S.frame).transform }, { transform: getComputedStyle(ctx.S.frame).transform + " translateY(-4px)" }, { transform: getComputedStyle(ctx.S.frame).transform }], { d: 240, delay: 80 });
          ctx.anim(ctx.cardWrap, [{ opacity: 0, transform: "translateZ(-40px) scale(.15) rotate(-8deg)" }, { opacity: 1, transform: "translateZ(60px) scale(1.12) rotate(3deg)", offset: 0.6 },
            { opacity: 1, transform: "translateZ(40px) scale(1) rotate(0)" }], { d: 900, delay: 150, e: ctx.E.out });
          await ctx.wait(1200);
        }
      }
    ]
  });
})(window);
