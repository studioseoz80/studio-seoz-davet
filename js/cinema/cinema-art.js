/* =============================================================================
   STUDIO SEOZ — cinema/cinema-art.js
   Modellerin görsel yüklenmediğinde kullandığı, KODLA ÇİZİLEN ortak parçalar.
   Hepsi CSS gradyan/gölge ve küçük SVG'lerden oluşur (dış dosya yok).
   ========================================================================= */
(function (global) {
  "use strict";
  const C = global.SeozCinema;
  const { h, svg, img } = C.util;

  /* Logo varsa logo, yoksa baş harf monogramı */
  function emblem(ctx, o) {
    o = o || {};
    const size = o.size || 60;
    const box = h("div", "sc-emblem", { width: size + "px", height: size + "px", left: (o.x != null ? o.x - size / 2 : 0) + "px",
                                        top: (o.y != null ? o.y - size / 2 : 0) + "px", color: o.color || ctx.pal.accent || "#C9A45C",
                                        fontFamily: o.font || "'Cinzel','Cormorant Garamond',serif", fontSize: Math.round(size * (o.fs || 0.36)) + "px",
                                        fontWeight: "700", letterSpacing: ".02em", textShadow: o.shadow || "0 1px 0 rgba(0,0,0,.35)" });
    if (ctx.cfg.brand.logo) box.appendChild(img(ctx.cfg.brand.logo, "", "contain"));
    else box.textContent = ctx.monogram;
    return box;
  }

  const tex = {
    wood(c1, c2) {
      return `repeating-linear-gradient(90deg, rgba(0,0,0,.08) 0 2px, transparent 2px 9px, rgba(255,255,255,.04) 9px 11px, transparent 11px 17px),
              linear-gradient(90deg, ${c2}, ${c1} 30%, ${c1} 70%, ${c2})`;
    },
    velvet(c1, c2) {
      return `repeating-linear-gradient(90deg, ${c2} 0, ${c1} 9%, ${C.util.mix(c1, "#ffffff", 0.18)} 13%, ${c1} 17%, ${c2} 25%)`;
    },
    paper(c1) {
      return `radial-gradient(ellipse at 30% 20%, rgba(255,255,255,.55), transparent 60%), linear-gradient(160deg, ${c1}, ${C.util.mix(c1, "#000000", 0.08)})`;
    },
    metal(c1) {
      return `linear-gradient(135deg, ${C.util.mix(c1, "#000", 0.35)} 0%, ${C.util.mix(c1, "#fff", 0.45)} 22%, ${c1} 40%, ${C.util.mix(c1, "#000", 0.3)} 62%, ${C.util.mix(c1, "#fff", 0.35)} 80%, ${c1} 100%)`;
    },
    glass() {
      return `linear-gradient(115deg, rgba(255,255,255,.35) 0%, rgba(255,255,255,.08) 28%, rgba(255,255,255,.02) 50%, rgba(255,255,255,.16) 70%, rgba(255,255,255,.04) 100%)`;
    }
  };

  /* Yüzey üzerinde kayan metalik/ışık parıltısı (animasyon senaryodan) */
  function sheen(alpha) {
    return h("div", "sc-sheen", { position: "absolute", inset: "0", overflow: "hidden", pointerEvents: "none", borderRadius: "inherit" }, [
      h("div", "sc-sheen-bar", { position: "absolute", top: "-20%", bottom: "-20%", left: "-60%", width: "40%", transform: "skewX(-18deg)",
        background: `linear-gradient(90deg, transparent, rgba(255,255,255,${alpha || 0.45}), transparent)` })
    ]);
  }
  function sweepSheen(ctx, root, o) {
    const bars = root ? root.querySelectorAll(".sc-sheen-bar") : [];
    bars.forEach((b, i) => ctx.anim(b, [{ transform: "translateX(0) skewX(-18deg)" }, { transform: "translateX(560%) skewX(-18deg)" }],
      Object.assign({ d: 1400, delay: i * 80, e: ctx.E.inOut }, o || {})));
  }

  function backdrop(css) { return h("div", "", Object.assign({ position: "absolute", inset: "0" }, css)); }

  C.art = { emblem, tex, sheen, sweepSheen, backdrop };
})(window);
