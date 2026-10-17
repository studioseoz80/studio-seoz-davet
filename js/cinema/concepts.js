/* =============================================================================
   STUDIO SEOZ — cinema/concepts.js  (ÖZEL GÜN VE ATMOSFER KONSEPTLERİ)
   Konseptler açılış modelinden BAĞIMSIZDIR: her modelle birlikte seçilebilir.
   Yeni bir özel gün eklemek için yalnızca aşağıya yeni bir kayıt eklemek
   yeterlidir — motor koduna dokunulmaz:
       SeozCinema.registerConcept({ id, label, group, ambient:[...], burst:[...],
                                    sound, tint, overlay(ctx, overlayEl), onSurprise(ctx, p) })
   ambient: sahne boyunca süren parçacıklar  ·  burst: "sürpriz anı" patlaması
   Parçacık türleri: dot, spark, glow, confetti, snow, petal, heart, star, bat,
   balloon, shard, smoke, page, cap, firework (yenisi registerParticle ile).
   ========================================================================= */
(function (global) {
  "use strict";
  const C = global.SeozCinema, { h } = C.util;

  /* ---- ortak katmanlar ---- */
  function fog(ctx, ov, color) {
    for (let i = 0; i < 3; i++) {
      const f = h("div", "sc-fog", { bottom: (i * 14 - 6) + "%", background: `radial-gradient(ellipse at ${30 + i * 20}% 50%, ${color || "rgba(200,200,215,.38)"}, transparent 60%)` });
      ov.insertBefore(f, ctx.fxCanvas);
      ctx.anim(f, [{ transform: "translateX(-8%)" }, { transform: "translateX(8%)" }], { d: 9000 + i * 2500, it: Infinity, dir: "alternate", e: ctx.E.inOut });
    }
  }
  function lightning(ctx, ov) {
    const bolt = h("div", "", { position: "absolute", inset: "0", pointerEvents: "none", zIndex: "44", opacity: "0", background: "radial-gradient(ellipse at 70% 10%, rgba(220,230,255,.9), rgba(140,150,200,.25) 40%, transparent 70%)" });
    ov.appendChild(bolt);
    const strike = () => ctx.anim(bolt, [{ opacity: 0 }, { opacity: 1, offset: 0.05 }, { opacity: 0.1, offset: 0.12 }, { opacity: 0.85, offset: 0.18 }, { opacity: 0 }], { d: 900, e: "linear" });
    const loop = () => { if (ctx.dead) return; strike(); ctx.later(3800 + Math.random() * 3000, loop); };
    ctx.later(1400, loop);
    ctx._strike = strike;
  }
  function beams(ctx, ov, color) {
    [-1, 1].forEach((s, i) => {
      const b = h("div", "", { position: "absolute", bottom: "-10%", left: (50 + s * 28) + "%", width: "26%", height: "130%", marginLeft: "-13%", pointerEvents: "none", zIndex: "37",
        transformOrigin: "50% 100%", background: `linear-gradient(0deg, ${color || "rgba(255,255,255,.22)"}, transparent 85%)`, clipPath: "polygon(42% 100%, 58% 100%, 100% 0, 0 0)", mixBlendMode: "screen" });
      ov.insertBefore(b, ctx.fxCanvas);
      ctx.anim(b, [{ transform: `rotate(${s * -22}deg)` }, { transform: `rotate(${s * 14}deg)` }], { d: 4200 + i * 900, it: Infinity, dir: "alternate", e: ctx.E.inOut });
    });
  }

  const GOLD = ["#F3D27A", "#E6C77A", "#FFFFFF", "#C9A45C"];
  const MULTI = ["#E94F6B", "#F7C548", "#4FB0E9", "#7BD389", "#B57BE0", "#FFFFFF"];

  const list = [
    /* ---------- atmosfer (modellerin önerdiği varsayılanlar) ---------- */
    { id: "zarif", label: "Zarif Parıltı", group: "Atmosfer",
      ambient: [{ type: "dot", count: 22, colors: ["rgba(243,210,122,.8)", "rgba(255,255,255,.7)"], size: 3, speed: 18, drift: 10, life: 10, from: "any" }],
      burst: [{ type: "spark", count: 40, speed: 420, colors: GOLD, gravity: 260, size: 7 }], sound: "sparkle" },
    { id: "gizem", label: "Gizem (sis ve toz)", group: "Atmosfer",
      ambient: [{ type: "dot", count: 26, colors: ["rgba(255,220,170,.55)", "rgba(200,200,220,.45)"], size: 2.5, speed: 10, drift: 14, life: 12, from: "any" }],
      overlay: (ctx, ov) => fog(ctx, ov),
      burst: [{ type: "glow", count: 18, speed: 160, colors: ["rgba(255,226,170,.9)"], gravity: -40, size: 7, life: 2.4 }, { type: "spark", count: 20, speed: 260, colors: GOLD, gravity: 120 }] },
    { id: "altin", label: "Altın Işık", group: "Atmosfer",
      ambient: [{ type: "spark", count: 18, colors: GOLD, size: 5, speed: 14, drift: 8, life: 8, from: "any" }],
      burst: [{ type: "spark", count: 60, speed: 620, colors: GOLD, gravity: 380, size: 8 }, { type: "star", count: 16, speed: 420, colors: ["#F3D27A"], gravity: 300, size: 6 }], sound: "sparkle" },
    { id: "konfeti", label: "Konfeti Kutlaması", group: "Atmosfer",
      burst: [{ type: "confetti", count: 110, speed: 760, spread: 1.1, colors: MULTI, size: 11, life: 3.2 }], sound: "pop" },
    { id: "buyu", label: "Büyülü Işıltı", group: "Atmosfer",
      ambient: [{ type: "glow", count: 16, colors: ["rgba(190,150,255,.6)", "rgba(255,220,160,.6)"], size: 4, speed: 12, drift: 12, life: 9, from: "any" }],
      burst: [{ type: "glow", count: 30, speed: 300, colors: ["rgba(200,160,255,.9)", "rgba(255,230,170,.9)"], gravity: -30, size: 6, life: 2.2 }, { type: "spark", count: 30, speed: 380, colors: ["#E8D9FF", "#F3D27A"], gravity: 160 }], sound: "magic" },
    { id: "inci", label: "İnci ve Işık", group: "Atmosfer",
      ambient: [{ type: "glow", count: 14, colors: ["rgba(255,255,255,.55)"], size: 3, speed: 8, drift: 8, life: 10, from: "any" }],
      burst: [{ type: "dot", count: 30, speed: 360, colors: ["#FFFFFF", "#F4EFE6", "#E9E2D6"], gravity: 520, size: 9 }, { type: "spark", count: 24, speed: 380, colors: ["#FFFFFF", "#DCE3EA"], gravity: 200 }], sound: "chime" },
    { id: "isilti", label: "Işıltı", group: "Atmosfer",
      ambient: [{ type: "spark", count: 24, colors: ["#FFFFFF", "#F3D27A", "#DCE3EA"], size: 5, speed: 6, drift: 4, life: 6, from: "any", sway: 0 }],
      burst: [{ type: "spark", count: 70, speed: 560, colors: ["#FFFFFF", "#F3D27A", "#DCE3EA"], gravity: 240, size: 8 }], sound: "sparkle" },
    { id: "toz", label: "Altın Toz", group: "Atmosfer",
      ambient: [{ type: "dot", count: 34, colors: ["rgba(243,210,122,.7)", "rgba(255,240,210,.6)"], size: 2.2, speed: 6, drift: 8, life: 14, from: "any" }],
      burst: [{ type: "dot", count: 60, speed: 240, colors: ["rgba(243,210,122,.9)"], gravity: -20, size: 3, life: 2.6 }] },
    { id: "bahar", label: "Bahar", group: "Atmosfer",
      ambient: [{ type: "petal", count: 14, colors: ["#F8C8D4", "#FFFFFF", "#FBE3E8"], size: 7, speed: 40, drift: 30, life: 12 }, { type: "dot", count: 14, colors: ["rgba(255,240,180,.7)"], size: 2.5, speed: 8, life: 10, from: "any" }],
      burst: [{ type: "petal", count: 40, speed: 380, colors: ["#F8C8D4", "#FFFFFF", "#F4A7B9"], gravity: 120, size: 9, life: 3 }], sound: "chime" },
    { id: "bahce", label: "Büyülü Bahçe (ateş böcekleri)", group: "Atmosfer",
      ambient: [{ type: "glow", count: 22, colors: ["rgba(230,255,150,.85)", "rgba(255,240,160,.8)"], size: 3, speed: 10, drift: 18, life: 9, from: "any" }],
      burst: [{ type: "glow", count: 40, speed: 260, colors: ["rgba(230,255,150,.95)"], gravity: -20, size: 4, life: 2.6 }], sound: "magic" },
    { id: "gala", label: "Gala", group: "Atmosfer",
      overlay: (ctx, ov) => beams(ctx, ov, "rgba(255,240,200,.16)"),
      burst: [{ type: "star", count: 26, speed: 520, colors: ["#F3D27A", "#FFFFFF"], gravity: 300, size: 7 }, { type: "spark", count: 40, speed: 560, colors: GOLD, gravity: 300 }], sound: "fanfare" },

    /* ---------- özel günler ---------- */
    { id: "dugun", label: "Düğün & Nişan", group: "Özel Gün",
      ambient: [{ type: "petal", count: 12, colors: ["#FFFFFF", "#FBE3E8", "#F6EEE2"], size: 7, speed: 34, drift: 26, life: 13 }, { type: "glow", count: 10, colors: ["rgba(255,255,255,.55)"], size: 3, speed: 6, life: 10, from: "any" }],
      burst: [{ type: "petal", count: 36, speed: 420, colors: ["#FFFFFF", "#FBE3E8", "#F4C9D3"], gravity: 160, size: 9, life: 3 }, { type: "spark", count: 30, speed: 460, colors: ["#F3D27A", "#FFFFFF", "#DCE3EA"], gravity: 240 }, { type: "dot", count: 14, speed: 300, colors: ["#FFFFFF", "#F4EFE6"], gravity: 520, size: 8 }],
      sound: "chime" },
    { id: "halloween", label: "Halloween", group: "Özel Gün", tint: "rgba(80,30,120,.35)",
      ambient: [{ type: "bat", count: 7, colors: ["#120D14"], size: 14, speed: 26, drift: 60, life: 9, from: "any", sway: 2 }],
      overlay: (ctx, ov) => { fog(ctx, ov, "rgba(140,170,140,.35)"); lightning(ctx, ov); },
      burst: [{ type: "bat", count: 16, speed: 520, colors: ["#120D14", "#2A1A30"], gravity: -80, size: 16, life: 2.4 }, { type: "glow", count: 20, speed: 260, colors: ["rgba(255,140,40,.9)", "rgba(170,255,120,.8)"], gravity: -30, size: 6 }],
      onSurprise: (ctx) => { if (ctx._strike) ctx._strike(); ctx.sfx("thunder"); } },
    { id: "yilbasi", label: "Yılbaşı", group: "Özel Gün",
      ambient: [{ type: "snow", count: 46, colors: ["#FFFFFF"], size: 4, speed: 46, drift: 22, life: 14 }],
      burst: [{ type: "firework", count: 4, speed: 760, spread: 0.35, colors: ["#F3D27A", "#FF6B6B", "#7FD8FF", "#B9F27C"], gravity: 300, size: 4, life: 2.2 },
              { type: "star", count: 20, speed: 480, colors: ["#F3D27A", "#FFFFFF"], gravity: 220, size: 7 }, { type: "confetti", count: 50, speed: 600, colors: ["#F3D27A", "#C9A45C", "#FFFFFF"], size: 9 }],
      sound: "chime" },
    { id: "dogumgunu", label: "Doğum Günü", group: "Özel Gün",
      ambient: [{ type: "balloon", count: 7, colors: ["#FF6B8A", "#FFC94D", "#5EC8F2", "#8BD17C", "#B98AF2"], size: 16, speed: 46, drift: 12, life: 18, from: "bottom", sway: 0.6 }],
      burst: [{ type: "confetti", count: 120, speed: 800, spread: 1.1, colors: MULTI, size: 11, life: 3.2 }, { type: "balloon", count: 6, speed: 260, angle: -Math.PI / 2, spread: 0.8, colors: ["#FF6B8A", "#FFC94D", "#5EC8F2"], gravity: -60, size: 16, life: 4 }],
      sound: "pop" },
    { id: "sevgililer", label: "Sevgililer Günü", group: "Özel Gün", tint: "rgba(255,90,130,.18)",
      ambient: [{ type: "heart", count: 12, colors: ["#FF4D6D", "#FF8FA3", "#FFC2D1"], size: 12, speed: 30, drift: 14, life: 12, from: "bottom", sway: 0.8 },
                { type: "petal", count: 10, colors: ["#C9184A", "#FF4D6D"], size: 7, speed: 34, drift: 24, life: 12 }],
      burst: [{ type: "heart", count: 34, speed: 460, colors: ["#FF4D6D", "#FF8FA3", "#FFFFFF"], gravity: -40, size: 15, life: 2.6 }, { type: "petal", count: 30, speed: 380, colors: ["#C9184A", "#FF4D6D"], gravity: 160, size: 9 }],
      sound: "chime" },
    { id: "mezuniyet", label: "Mezuniyet", group: "Özel Gün",
      ambient: [{ type: "star", count: 16, colors: ["#F3D27A", "#FFFFFF"], size: 4, speed: 6, drift: 6, life: 8, from: "any", sway: 0 }],
      overlay: (ctx, ov) => beams(ctx, ov, "rgba(200,220,255,.14)"),
      burst: [{ type: "cap", count: 12, speed: 820, spread: 0.7, colors: ["#1B2A4A", "#121212"], gravity: 520, size: 18, life: 3 },
              { type: "confetti", count: 70, speed: 700, colors: ["#1B2A4A", "#F3D27A", "#FFFFFF"], size: 10 }, { type: "star", count: 16, speed: 420, colors: ["#F3D27A"], size: 7 }],
      sound: "fanfare" },
    { id: "kurumsal", label: "Kurumsal Etkinlik", group: "Özel Gün",
      overlay: (ctx, ov) => beams(ctx, ov, "rgba(255,255,255,.12)"),
      burst: [{ type: "spark", count: 36, speed: 460, colors: null, gravity: 220, size: 7 }],
      onSurprise: (ctx, p) => ctx.fx.burst({ type: "dot", x: p.x, y: p.y, count: 30, speed: 320, gravity: 200, size: 5, colors: [ctx.pal.accent || "#C9A45C", ctx.pal.main || "#1E2A22", "#FFFFFF"] }) },
    { id: "sade", label: "Sade / Profesyonel (efektsiz)", group: "Özel Gün",
      burst: [{ type: "glow", count: 8, speed: 120, colors: ["rgba(255,255,255,.8)"], gravity: -20, size: 6, life: 1.6 }] }
  ];
  list.forEach(c => {
    // renk verilmemiş patlamalar markanın/temanın renklerini kullanır
    (c.burst || []).forEach(b => { if (!b.colors) b._brand = true; });
    C.registerConcept(c);
  });
})(window);
