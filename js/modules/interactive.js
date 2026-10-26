/* =============================================================================
   STUDIO SEOZ — modules/interactive.js  (İç Zemin İ3 · ETKİLEŞİMLİ NESNELER)
   -----------------------------------------------------------------------------
   Misafirin dokunarak oynadığı küçük sürprizler: kazı-kazan, zarfı aç, balon
   patlat, hediye kutusu aç, konfeti düğmesi, fotoğraf çevir, dilek feneri,
   mum söndür (basılı tut), kurdele kes, kapı çal.

   - Her nesne bir görsel (isteğe bağlı) ve bir sonuçla ayarlanır: mesaj,
     görsel, bağlantı ya da yalnızca efekt.
   - Yalnızca ekranda çalışır: misafirin tarayıcısı hiçbir yere veri YAZMAZ.
   - Kazı-kazanın altındaki mesaj sayfanın içinde durur; gerçek bir sır için
     kullanılmamalıdır (panelde bu not yazılıdır).
   - Editörde nesne kapalı hâliyle görünür; etkileşim müşteri sayfasında çalışır.
   ========================================================================= */
(function (global) {
  "use strict";

  const KINDS = [
    ["kazi-kazan", "Kazı-kazan"], ["zarf", "Zarfı aç"], ["balon", "Balon patlat"], ["hediye", "Hediye kutusu aç"], ["konfeti", "Konfeti düğmesi"],
    ["foto-cevir", "Fotoğraf çevir"], ["dilek", "Dilek feneri bırak"], ["mum", "Mum söndür (basılı tut)"], ["kurdele", "Kurdele kes"], ["kapi-cal", "Kapı çal"]
  ];
  const HINT = { "kazi-kazan": "Parmağınızla kazıyın", zarf: "Zarfı açmak için dokunun", balon: "Balonları patlatın", hediye: "Hediyeyi açmak için dokunun", konfeti: "Kutlamak için dokunun",
    "foto-cevir": "Çevirmek için dokunun", dilek: "Dilek tutup feneri bırakın", mum: "Mumları söndürmek için basılı tutun", kurdele: "Kurdeleyi kesmek için dokunun", "kapi-cal": "Kapıyı üç kez çalın" };

  const DEFAULTS = {
    kind: "kazi-kazan",
    title: "",
    resultType: "mesaj",
    message: "Sürpriz! 🎉",
    images: [],
    linkUrl: "",
    linkText: "Aç",
    effect: "konfeti",
    count: 5,
    color: "#B8925A",
    textColor: "#3A2E28",
    fontFamily: "Cormorant Garamond",
    fontSize: 26
  };
  // E1: kendi görselleriyle çalışan, Etkileşim Stüdyosu'ndan düzenlenen türler (diğerleri sonraki aşamalarda)
  const STUDIO_KINDS = ["kurdele"];
  const SETTINGS_SCHEMA = [
    { key: "kind", type: "select", label: "Nesne", options: KINDS.map(([value, label]) => ({ value, label })), reRenderPanel: true },
    { key: "_studio", type: "action-button", label: "🎀 Etkileşim Stüdyosu: kendi görselleriniz, hareket, sürpriz", action: "studio", showIf: s => STUDIO_KINDS.indexOf(s.kind) >= 0 },
    { key: "title", type: "text", label: "Üstteki ipucu (boşsa hazır ipucu)" },
    { key: "resultType", type: "select", label: "Sonuç", options: [{ value: "mesaj", label: "Mesaj" }, { value: "gorsel", label: "Görsel" }, { value: "baglanti", label: "Bağlantı düğmesi" }, { value: "efekt", label: "Yalnızca efekt" }] },
    { key: "message", type: "textarea", label: "Mesaj (sayfanın içinde durur — gerçek bir sır yazmayın)" },
    { key: "images", type: "image-list", label: "Görseller: 1. ön/kapak (isteğe bağlı) · 2. sonuç görseli" },
    { key: "linkUrl", type: "url", label: "Bağlantı adresi (sonuç “Bağlantı” ise)" },
    { key: "linkText", type: "text", label: "Bağlantı düğmesi yazısı" },
    { key: "effect", type: "select", label: "Efekt", options: [{ value: "konfeti", label: "Konfeti" }, { value: "kalp", label: "Kalpler" }, { value: "yildiz", label: "Yıldızlar" }, { value: "yok", label: "Yok" }] },
    { key: "count", type: "number", label: "Balon sayısı", min: 1 },
    { key: "color", type: "color", label: "Nesne rengi" },
    { key: "textColor", type: "color", label: "Yazı rengi" },
    { key: "fontFamily", type: "font-select", label: "Mesaj fontu" },
    { key: "fontSize", type: "number", label: "Mesaj boyutu", unit: "px", min: 10 }
  ];

  function el(tag, cls, css, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (css) Object.assign(e.style, css); if (html != null) e.innerHTML = html; return e; }
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const refs = s => (Array.isArray(s.images) ? s.images : []).map(x => x && x.ref).filter(Boolean);
  function setImg(img, ref) { if (!ref) return; if (global.SeozBlobStore) SeozBlobStore.resolveToObjectURL(ref).then(u => { if (u) img.src = u; }); else img.src = ref; }
  const reduced = () => !!(global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches);
  function safeUrl(u) { u = String(u || "").trim(); return /^(https?:|mailto:|tel:)/i.test(u) ? u : (u ? "https://" + u.replace(/^\/+/, "") : ""); }

  /* ----------------------------- efekt patlaması ----------------------------- */
  const COLS = { konfeti: ["#E94F6B", "#F7C548", "#4FB0E9", "#7BD389", "#FFFFFF", "#B8925A"], kalp: ["#F06A8A", "#F7A3B8", "#E2335C"], yildiz: ["#F3D27A", "#FFF1C4", "#FFFFFF"] };
  function burst(host, type) {
    if (!type || type === "yok" || reduced()) return;
    const cv = el("canvas", "ix-burst"); host.appendChild(cv);
    const r = host.getBoundingClientRect(), sc = r.width / (host.offsetWidth || 1) || 1;
    const W = host.offsetWidth + 160, H = host.offsetHeight + 200, dpr = Math.min(2, global.devicePixelRatio || 1);
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + "px"; cv.style.height = H + "px";
    const ctx = cv.getContext("2d"), cols = COLS[type] || COLS.konfeti, N = 70, list = [];
    for (let i = 0; i < N; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, v = 260 + Math.random() * 420;
      list.push({ x: W / 2, y: H / 2 + 20, vx: Math.cos(a) * v, vy: Math.sin(a) * v, c: cols[i % cols.length], s: 4 + Math.random() * 6, r: Math.random() * 6, life: 1.6 + Math.random() * 0.8 });
    }
    let t0 = 0, raf = 0;
    function heart(x, y, s) { ctx.beginPath(); ctx.moveTo(x, y + s * 0.35); ctx.bezierCurveTo(x - s, y - s * 0.4, x - s * 0.4, y - s * 1.1, x, y - s * 0.45); ctx.bezierCurveTo(x + s * 0.4, y - s * 1.1, x + s, y - s * 0.4, x, y + s * 0.35); ctx.fill(); }
    function step(now) {
      if (!t0) t0 = now; const t = (now - t0) / 1000, dt = 1 / 60;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      let alive = 0;
      list.forEach(p => {
        if (t > p.life) return; alive++;
        p.vy += 620 * dt; p.vx *= 0.985; p.x += p.vx * dt; p.y += p.vy * dt; p.r += dt * 8;
        ctx.globalAlpha = Math.max(0, 1 - t / p.life); ctx.fillStyle = p.c;
        if (type === "kalp") heart(p.x, p.y, p.s * 1.3);
        else if (type === "yildiz") { ctx.beginPath(); ctx.moveTo(p.x, p.y - p.s); ctx.quadraticCurveTo(p.x, p.y, p.x + p.s, p.y); ctx.quadraticCurveTo(p.x, p.y, p.x, p.y + p.s); ctx.quadraticCurveTo(p.x, p.y, p.x - p.s, p.y); ctx.quadraticCurveTo(p.x, p.y, p.x, p.y - p.s); ctx.fill(); }
        else { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); }
      });
      if (alive) raf = requestAnimationFrame(step); else cv.remove();
    }
    raf = requestAnimationFrame(step);
  }

  /* ----------------------------- sonuç ----------------------------- */
  function resultEl(s) {
    const box = el("div", "ix-result");
    box.style.color = s.textColor; box.style.fontFamily = `"${s.fontFamily}", serif`; box.style.fontSize = Math.max(10, Number(s.fontSize) || 26) + "px";
    const imgs = refs(s);
    const pic = s.resultImage || imgs[1] || imgs[0];   // Sürpriz fotoğrafı ayrı alanda (yoksa eski görsel listesi)
    if (s.resultType === "gorsel" && pic) { const im = el("img", "ix-result-img"); im.alt = ""; setImg(im, pic); box.appendChild(im); }
    else if (s.resultType === "baglanti") {
      if (s.message) box.appendChild(el("div", "ix-result-t", null, esc(s.message).replace(/\n/g, "<br>")));
      const a = el("a", "ix-link", { background: s.color }, esc(s.linkText || "Aç"));
      const url = safeUrl(s.linkUrl); if (url) { a.href = url; a.target = "_blank"; a.rel = "noopener"; } else a.setAttribute("aria-disabled", "true");
      box.appendChild(a);
    } else if (s.resultType !== "efekt" && s.message) box.appendChild(el("div", "ix-result-t", null, esc(s.message).replace(/\n/g, "<br>")));
    return box;
  }
  function reveal(root, s) { root.classList.add("is-done"); burst(root, s.effect); }
  function knock() {
    try {
      const AC = global.AudioContext || global.webkitAudioContext; if (!AC) return;
      const ac = knock.ac || (knock.ac = new AC()), t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.15);
      g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18); o.connect(g).connect(ac.destination); o.start(t); o.stop(t + 0.2);
    } catch (e) { /* ses isteğe bağlı */ }
  }

  /* ----------------------------- nesneler ----------------------------- */
  const BUILD = {
    "kazi-kazan"(root, s, live) {
      root.appendChild(resultEl(s));
      const cv = el("canvas", "ix-scratch"); root.appendChild(cv);
      const lbl = el("div", "ix-scratch-lbl", null, "✦ Kazıyın ✦"); root.appendChild(lbl);
      const paint = () => {
        const W = root.offsetWidth || 300, H = root.offsetHeight || 200, dpr = Math.min(2, global.devicePixelRatio || 1);
        cv.width = W * dpr; cv.height = H * dpr;
        const c = cv.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0);
        const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#9AA0A6"); g.addColorStop(0.45, "#E6E9EC"); g.addColorStop(0.55, "#C9CED3"); g.addColorStop(1, "#8A9096");
        c.fillStyle = g; c.fillRect(0, 0, W, H);
        c.globalAlpha = 0.18; for (let i = 0; i < 260; i++) { c.fillStyle = i % 2 ? "#fff" : "#000"; c.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5); } c.globalAlpha = 1;
      };
      requestAnimationFrame(paint);
      if (!live) return;
      const c = () => cv.getContext("2d");
      let down = false, last = null, strokes = 0;
      const pt = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * cv.width / r.width, y: (e.clientY - r.top) * cv.height / r.height }; };
      function line(a, b) { const x = c(); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = "destination-out"; x.lineCap = "round"; x.lineJoin = "round"; x.lineWidth = 34 * (cv.width / (root.offsetWidth || 300)); x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke(); }
      function cleared() {
        const x = c(), d = x.getImageData(0, 0, cv.width, cv.height).data; let n = 0, tot = 0;
        for (let i = 3; i < d.length; i += 4 * 16) { tot++; if (d[i] < 20) n++; }
        return n / Math.max(1, tot);
      }
      cv.addEventListener("pointerdown", e => { down = true; last = pt(e); lbl.style.opacity = "0"; try { cv.setPointerCapture(e.pointerId); } catch (er) { /* önemsiz */ } line(last, { x: last.x + 0.1, y: last.y }); e.preventDefault(); });
      cv.addEventListener("pointermove", e => { if (!down) return; const p = pt(e); line(last, p); last = p; if (++strokes % 8 === 0 && cleared() > 0.45) { down = false; cv.classList.add("is-gone"); reveal(root, s); } });
      const up = () => { down = false; if (!root.classList.contains("is-done") && cleared() > 0.45) { cv.classList.add("is-gone"); reveal(root, s); } };
      cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
    },
    zarf(root, s, live) {
      const imgs = refs(s);
      const letter = el("div", "ix-letter"); letter.appendChild(resultEl(s));
      const env = el("div", "ix-env", { "--ix-c": s.color }, `<span class="ix-env-back"></span><span class="ix-env-front"></span><span class="ix-env-flap"></span><span class="ix-env-seal">✦</span>`);
      env.style.setProperty("--ix-c", s.color);
      if (imgs[0]) { const im = el("img", "ix-env-img"); im.alt = ""; setImg(im, imgs[0]); env.appendChild(im); }
      env.insertBefore(letter, env.children[1]);
      root.appendChild(env);
      if (live) root.addEventListener("click", () => { if (root.classList.contains("is-done")) return; env.classList.add("is-open"); setTimeout(() => reveal(root, s), 650); });
    },
    balon(root, s, live) {
      root.appendChild(resultEl(s));
      const n = Math.max(1, Math.min(9, Number(s.count) || 5)), cols = ["#F49AB0", "#9FD3F5", "#F7D774", "#B5E3B5", "#C9B3F2", "#F7B27A"];
      const field = el("div", "ix-balloons"); root.appendChild(field);
      let left = n;
      for (let i = 0; i < n; i++) {
        const b = el("button", "ix-balloon", null, "<i></i>");
        b.type = "button"; b.setAttribute("aria-label", "Balon " + (i + 1));
        b.style.setProperty("--ix-c", i === 0 ? s.color : cols[i % cols.length]); b.style.left = (8 + (84 / n) * i + (84 / n) * 0.1) + "%";
        b.style.setProperty("--d", (i * 0.37 % 1.6).toFixed(2) + "s"); b.style.setProperty("--h", (8 + (i * 29) % 26) + "%");
        field.appendChild(b);
        if (live) b.addEventListener("click", e => {
          e.stopPropagation(); if (b.classList.contains("is-pop")) return;
          b.classList.add("is-pop"); burstSmall(b, b.style.getPropertyValue("--ix-c")); left--;
          if (left === 0) setTimeout(() => reveal(root, s), 300);
        });
      }
    },
    hediye(root, s, live) {
      const imgs = refs(s);
      root.appendChild(resultEl(s));
      const box = el("div", "ix-gift", null, imgs[0] ? "" : `<span class="ix-gift-body"></span><span class="ix-gift-lid"></span><span class="ix-gift-rib"></span><span class="ix-gift-bow"></span>`);
      box.style.setProperty("--ix-c", s.color);
      if (imgs[0]) { const im = el("img", "ix-gift-img"); im.alt = ""; setImg(im, imgs[0]); box.appendChild(im); }
      root.appendChild(box);
      if (live) root.addEventListener("click", () => { if (root.classList.contains("is-done")) return; box.classList.add("is-open"); setTimeout(() => reveal(root, s), 700); });
    },
    konfeti(root, s, live) {
      const b = el("button", "ix-btn", { background: s.color }, `<span>🎉</span> ${esc(s.title || "Kutlayalım!")}`); b.type = "button";
      root.appendChild(b);
      const res = resultEl(s); res.classList.add("ix-after"); root.appendChild(res);
      if (live) b.addEventListener("click", e => { e.stopPropagation(); b.classList.remove("is-hit"); void b.offsetWidth; b.classList.add("is-hit"); root.classList.add("is-done"); burst(root, s.effect === "yok" ? "konfeti" : s.effect); });
    },
    "foto-cevir"(root, s, live) {
      const imgs = refs(s);
      const card = el("div", "ix-photo"), fr = el("div", "ix-photo-face ix-photo-front"), bk = el("div", "ix-photo-face ix-photo-back");
      if (imgs[0]) { const im = el("img"); im.alt = ""; setImg(im, imgs[0]); fr.appendChild(im); } else fr.innerHTML = `<span class="ix-ph">📷</span>`;
      bk.appendChild(resultEl(Object.assign({}, s, { resultType: s.resultType === "gorsel" && imgs[1] ? "gorsel" : s.resultType, images: imgs[1] ? [{ ref: imgs[0] }, { ref: imgs[1] }] : s.images })));
      card.appendChild(fr); card.appendChild(bk); root.appendChild(card);
      if (live) root.addEventListener("click", () => { card.classList.toggle("is-flip"); if (!root.classList.contains("is-done")) reveal(root, s); });
    },
    dilek(root, s, live) {
      const imgs = refs(s);
      root.appendChild(resultEl(s));
      const sky = el("div", "ix-sky"); root.appendChild(sky);
      const b = el("button", "ix-btn ix-btn-soft", { background: s.color }, "🏮 Dileğimi bırak"); b.type = "button"; root.appendChild(b);
      if (live) b.addEventListener("click", e => {
        e.stopPropagation();
        const l = el("span", "ix-lantern"); l.style.left = (35 + Math.random() * 30) + "%";
        if (imgs[0]) { const im = el("img"); im.alt = ""; setImg(im, imgs[0]); l.appendChild(im); l.classList.add("has-img"); }
        sky.appendChild(l); setTimeout(() => l.remove(), 6200);
        if (!root.classList.contains("is-done")) setTimeout(() => reveal(root, s), 900);
      });
    },
    mum(root, s, live) {
      root.appendChild(resultEl(s));
      const cake = el("div", "ix-cake", null, `<span class="ix-cake-body"></span>${[0, 1, 2].map(i => `<span class="ix-candle" style="--i:${i}"><i class="ix-flame"></i><i class="ix-smoke"></i></span>`).join("")}<span class="ix-ring"><i></i></span>`);
      cake.style.setProperty("--ix-c", s.color);
      root.appendChild(cake);
      if (!live) return;
      let timer = 0, t0 = 0, raf = 0;
      const ring = cake.querySelector(".ix-ring");
      const stop = () => { clearTimeout(timer); cancelAnimationFrame(raf); cake.classList.remove("is-blowing"); ring.style.setProperty("--p", "0"); };
      const prog = now => { if (!t0) t0 = now; ring.style.setProperty("--p", String(Math.min(1, (now - t0) / 1300))); raf = requestAnimationFrame(prog); };
      root.addEventListener("pointerdown", e => {
        if (root.classList.contains("is-done")) return;
        e.preventDefault(); t0 = 0; cake.classList.add("is-blowing"); raf = requestAnimationFrame(prog);
        timer = setTimeout(() => { stop(); cake.classList.add("is-out"); setTimeout(() => reveal(root, s), 500); }, 1300);
      });
      ["pointerup", "pointercancel", "pointerleave"].forEach(ev => root.addEventListener(ev, () => { if (!cake.classList.contains("is-out")) stop(); }));
      root.addEventListener("contextmenu", e => e.preventDefault());
    },
    kurdele(root, s, live) {
      if (s.parts && s.parts.ribbon && s.parts.ribbon.ref) return kurdele2(root, s, live);
      const imgs = refs(s);
      const under = el("div", "ix-under"); if (imgs[0]) { const im = el("img", "ix-under-img"); im.alt = ""; setImg(im, imgs[0]); under.appendChild(im); }
      under.appendChild(resultEl(s)); root.appendChild(under);
      const rib = el("div", "ix-ribbon", null, `<span class="ix-rib-l"></span><span class="ix-rib-r"></span><span class="ix-rib-bow"></span><span class="ix-scissor">✂</span>`);
      rib.style.setProperty("--ix-c", s.color); root.appendChild(rib);
      if (live) root.addEventListener("click", () => { if (root.classList.contains("is-done")) return; rib.classList.add("is-cut"); setTimeout(() => reveal(root, s), 650); });
    },
    "kapi-cal"(root, s, live) {
      const imgs = refs(s);
      root.appendChild(resultEl(s));
      const door = el("div", "ix-door", null, imgs[0] ? "" : `<span class="ix-door-l"><i></i></span><span class="ix-door-r"><i></i></span>`);
      door.style.setProperty("--ix-c", s.color);
      if (imgs[0]) { const L = el("span", "ix-door-l ix-door-img"), R = el("span", "ix-door-r ix-door-img"); [L, R].forEach(x => { const im = el("img"); im.alt = ""; setImg(im, imgs[0]); x.appendChild(im); door.appendChild(x); }); }
      const dots = el("div", "ix-knocks", null, "<i></i><i></i><i></i>"); root.appendChild(door); root.appendChild(dots);
      if (!live) return;
      let n = 0;
      root.addEventListener("click", () => {
        if (root.classList.contains("is-done")) return;
        n++; knock(); door.classList.remove("is-knock"); void door.offsetWidth; door.classList.add("is-knock");
        dots.children[Math.min(2, n - 1)].classList.add("is-on");
        if (n >= 3) setTimeout(() => { door.classList.add("is-open"); setTimeout(() => reveal(root, s), 600); }, 350);
      });
    }
  };
  /* ----------------------------- E1 · Kurdele Kes (kendi görselleriyle) -----------------------------
     s.parts = { ribbon, bow, scissor, back }: { ref, nw, nh, x, y, w, rot }  (x, y: merkez %; w: genişlik %, kutuya göre)
     s.cut   = { at, shape, fall, trigger, dur, speed, scissor }
     Kesim anında kurdele görseli iki parçaya ayrılır (aynı görsel, kesim noktasından kırpılmış); her yarı kendi dış
     ucundan menteşelenip iki yana sarkar ya da düşer. Hareketler yalnızca dönüşüm/saydamlık: telefonda akıcı. */
  const CUT_DEFAULTS = { at: 38, shape: "v", fall: "sark", trigger: "dokun", dur: 1.6, speed: 1, scissor: true };
  const PART_DEFAULTS = { ribbon: { x: 50, y: 50, w: 120, rot: 0 }, bow: { x: 50, y: 50, w: 34, rot: 0 }, scissor: { w: 0, rot: 0 }, back: {} };
  const SCISSOR_SVG = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 60"><defs><linearGradient id="m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F4F5F7"/><stop offset=".5" stop-color="#B9BEC5"/><stop offset="1" stop-color="#7D838B"/></linearGradient><linearGradient id="h" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E7C77C"/><stop offset="1" stop-color="#9C7A34"/></linearGradient></defs><path d="M58 30 L118 22 Q120 26 116 28 Z" fill="url(#m)" stroke="#5E646B" stroke-width=".8"/><path d="M58 30 L118 38 Q120 34 116 32 Z" fill="url(#m)" stroke="#5E646B" stroke-width=".8"/><ellipse cx="22" cy="17" rx="17" ry="12" fill="none" stroke="url(#h)" stroke-width="6"/><ellipse cx="22" cy="43" rx="17" ry="12" fill="none" stroke="url(#h)" stroke-width="6"/><path d="M37 21 L60 30 L37 39" fill="none" stroke="url(#h)" stroke-width="5" stroke-linejoin="round"/><circle cx="58" cy="30" r="3.2" fill="#6B5A2E"/></svg>`);
  const clampN = (v, a, b, d) => { v = Number(v); return isFinite(v) ? Math.max(a, Math.min(b, v)) : d; };
  function partOf(s, key) { const p = (s.parts || {})[key]; return p && p.ref ? Object.assign({}, PART_DEFAULTS[key], p) : null; }
  function placePart(e, p) {
    Object.assign(e.style, { left: clampN(p.x, -50, 150, 50) + "%", top: clampN(p.y, -50, 150, 50) + "%", width: clampN(p.w, 2, 300, 50) + "%",
      transform: `translate(-50%, -50%) rotate(${clampN(p.rot, -180, 180, 0)}deg)` });
    if (p.nw > 0 && p.nh > 0) e.style.aspectRatio = `${p.nw} / ${p.nh}`;
  }
  function kurdele2(root, s, live) {
    const C = Object.assign({}, CUT_DEFAULTS, s.cut || {}), imgs = refs(s);
    const at = clampN(C.at, 5, 95, 50), T = clampN(C.dur, 0.3, 8, 1.6) / clampN(C.speed, 0.25, 4, 1) * 1000;
    root.classList.add("ix-k2on"); root.dataset.ixTrigger = C.trigger === "kaydir" ? "kaydir" : "dokun";
    const back = partOf(s, "back"), under = el("div", "ix-under");
    const bref = back ? back.ref : imgs[0];
    if (bref) { const im = el("img", "ix-under-img"); im.alt = ""; setImg(im, bref); under.appendChild(im); }
    under.appendChild(resultEl(s)); root.appendChild(under);
    const stage = el("div", "ix-k2"); root.appendChild(stage);
    const R = partOf(s, "ribbon"), rib = el("div", "ix-k2-rib"); placePart(rib, R); stage.appendChild(rib);
    const full = el("img", "ix-k2-full"); full.alt = ""; full.draggable = false; setImg(full, R.ref); rib.appendChild(full);
    const half = (side) => {
      const h = el("div", "ix-k2-half ix-k2-" + side, side === "l" ? { left: "0", width: at + "%" } : { left: at + "%", width: (100 - at) + "%" });
      const im = el("img"); im.alt = ""; im.draggable = false; setImg(im, R.ref);
      if (side === "l") Object.assign(im.style, { left: "0", width: (10000 / at) + "%" });
      else Object.assign(im.style, { left: (-at * 100 / (100 - at)) + "%", width: (10000 / (100 - at)) + "%" });
      h.appendChild(im); rib.appendChild(h); return h;
    };
    const hl = half("l"), hr = half("r");
    const B = partOf(s, "bow"); let bow = null;
    if (B) { bow = el("div", "ix-k2-bow"); placePart(bow, B); const im = el("img"); im.alt = ""; im.draggable = false; setImg(im, B.ref); bow.appendChild(im); stage.appendChild(bow); }
    let sc = null;
    if (C.scissor !== false) {
      const SP = partOf(s, "scissor");
      sc = el("div", "ix-k2-sc", { left: at + "%" }); const im = el("img"); im.alt = ""; im.draggable = false;
      if (SP) { setImg(im, SP.ref); if (SP.nw > 0 && SP.nh > 0) sc.style.aspectRatio = `${SP.nw} / ${SP.nh}`; } else im.src = SCISSOR_SVG;
      sc.appendChild(im); rib.appendChild(sc);
    }
    if (!live) return;
    let done = false;
    // kesim kenarı: düz, zikzak ya da V (kurdele uçlarındaki klasik kesim)
    function shapeEdges() {
      const hpx = rib.offsetHeight || 20, v = Math.round(hpx * 0.42), z = Math.max(3, Math.round(hpx * 0.16)), n = 6;
      if (C.shape === "v") {
        hl.style.clipPath = `polygon(0 0, 100% 0, calc(100% - ${v}px) 50%, 100% 100%, 0 100%)`;
        hr.style.clipPath = `polygon(0 0, 100% 0, 100% 100%, 0 100%, ${v}px 50%)`;
      } else if (C.shape === "zikzak") {
        const ptsL = [], ptsR = [];
        for (let i = 0; i <= n; i++) { const y = (i / n * 100).toFixed(2) + "%"; ptsL.push((i % 2 ? `calc(100% - ${z}px)` : "100%") + " " + y); ptsR.push((i % 2 ? "0" : z + "px") + " " + y); }
        hl.style.clipPath = `polygon(0 0, ${ptsL.join(", ")}, 0 100%)`;
        hr.style.clipPath = `polygon(${ptsR.join(", ")}, 100% 100%, 100% 0)`;
      }
    }
    const A = (e, kf, o) => { try { return e.animate(kf, Object.assign({ fill: "forwards" }, o)); } catch (er) { return null; } };
    function cut() {
      if (done || root.classList.contains("is-done")) return; done = true;
      if (reduced()) { stage.style.opacity = "0"; reveal(root, s); return; }
      const tSnip = sc ? T * 0.32 : 0;
      if (sc) {
        A(sc, [{ transform: "translate(-50%, -50%) translateX(260%) rotate(0deg)", opacity: 0 }, { opacity: 1, offset: 0.25 }, { transform: "translate(-50%, -50%) translateX(0) rotate(0deg)", opacity: 1 }], { duration: tSnip, easing: "cubic-bezier(.2,.7,.2,1)" });
        A(sc, [{ transform: "translate(-50%, -50%) rotate(0deg) scaleY(1)" }, { transform: "translate(-50%, -50%) rotate(-8deg) scaleY(.82)" }, { transform: "translate(-50%, -50%) rotate(0deg) scaleY(1)" }], { duration: T * 0.12, delay: tSnip, easing: "ease-in-out", fill: "none" });
        A(sc, [{ transform: "translate(-50%, -50%) translateX(0)", opacity: 1 }, { transform: "translate(-50%, -50%) translate(-220%, 40%) rotate(-12deg)", opacity: 0 }], { duration: T * 0.35, delay: tSnip + T * 0.12, easing: "ease-in" });
      }
      setTimeout(() => {
        shapeEdges(); full.style.visibility = "hidden"; hl.style.display = hr.style.display = "block";
        const fall = C.fall === "dus", d = T * 0.68, ease = fall ? "cubic-bezier(.55,0,.85,.4)" : "cubic-bezier(.3,.6,.25,1)";
        // önce gerilim boşalır (hafif geri sıçrama), sonra her yarı kendi dış ucundan sarkar ya da düşer
        const kfL = fall ? [{ transform: "none", opacity: 1 }, { transform: "translateX(-4%) rotate(-3deg)", offset: 0.12 }, { transform: "translateX(-6%) rotate(30deg) scaleY(.94)", offset: 0.45 }, { transform: "translate(-10%, 220%) rotate(80deg) scaleY(.9)", opacity: 0 }]
          : [{ transform: "none" }, { transform: "translateX(-4%) rotate(-3deg)", offset: 0.12 }, { transform: "translateX(-3%) rotate(88deg) scaleY(.93)", offset: 0.62 }, { transform: "translateX(-3%) rotate(72deg) scaleY(.95)", offset: 0.82 }, { transform: "translateX(-3%) rotate(78deg) scaleY(.95)" }];
        const kfR = kfL.map(k => Object.assign({}, k, { transform: k.transform.replace(/translateX\(-/g, "translateX(").replace(/translate\(-/g, "translate(").replace(/rotate\((-?)(\d+)deg\)/g, (m, sg, n) => `rotate(${sg ? "" : "-"}${n}deg)`) }));
        A(hl, kfL, { duration: d, easing: ease });
        A(hr, kfR, { duration: d * 1.04, delay: 30, easing: ease });
        if (bow) A(bow, [{ transform: bow.style.transform, opacity: 1 }, { transform: bow.style.transform + " translateY(-8%) scale(1.04)", offset: 0.15 }, { transform: bow.style.transform + " translateY(240%) rotate(32deg)", opacity: 0 }], { duration: T * 0.7, easing: "cubic-bezier(.5,0,.9,.5)" });
        setTimeout(() => reveal(root, s), T * 0.25);
      }, tSnip + (sc ? T * 0.06 : 0));
    }
    root.__ixPlay = cut;
    if (C.trigger === "kaydir") {
      // parmakla kurdelenin üzerinden kaydırınca kesilir
      let x0 = null, y0 = 0;
      root.addEventListener("dragstart", e => e.preventDefault());   // fareyle kaydırırken tarayıcı görseli sürüklemeye kalkmasın
      root.addEventListener("pointerdown", e => { x0 = e.clientX; y0 = e.clientY; try { root.setPointerCapture(e.pointerId); } catch (er) { /* önemsiz */ } });
      root.addEventListener("pointermove", e => { if (x0 == null || done) return; if (Math.abs(e.clientX - x0) > 36 && Math.abs(e.clientX - x0) > Math.abs(e.clientY - y0)) { x0 = null; cut(); } });
      ["pointerup", "pointercancel"].forEach(ev => root.addEventListener(ev, () => { x0 = null; }));
      root.style.touchAction = "pan-y";
    } else root.addEventListener("click", cut);
  }
  function burstSmall(b, color) {
    for (let i = 0; i < 10; i++) {
      const d = el("i", "ix-shard"); d.style.background = color || "#F49AB0";
      const a = (i / 10) * Math.PI * 2; d.style.setProperty("--x", Math.cos(a) * 40 + "px"); d.style.setProperty("--y", Math.sin(a) * 40 + "px");
      b.appendChild(d);
    }
  }

  function render(settings, mode) {
    const s = Object.assign({}, DEFAULTS, settings);
    const kind = BUILD[s.kind] ? s.kind : "kazi-kazan";
    const live = mode === "view";
    const root = el("div", "ix ix-" + kind);
    root.style.setProperty("--ix-c", s.color); root.style.setProperty("--ix-ink", s.textColor);
    const hint = el("div", "ix-hint", null, esc(s.title || (kind === "kurdele" && s.cut && s.cut.trigger === "kaydir" && s.parts && s.parts.ribbon && s.parts.ribbon.ref ? "Kurdeleyi kesmek için parmağınızla kaydırın" : HINT[kind])));
    try { BUILD[kind](root, s, live); } catch (e) { console.error("[Studio SEOZ] Etkileşim hatası:", e); }
    if (kind !== "konfeti") root.appendChild(hint);
    // klavye: Enter / Boşluk ile aynı sonuç (kazı-kazan ve mum için kısayol)
    if (live && ["konfeti", "dilek", "balon"].indexOf(kind) < 0) {
      root.tabIndex = 0; root.setAttribute("role", "button"); root.setAttribute("aria-label", s.title || HINT[kind]);
      root.addEventListener("keydown", e => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault(); if (root.classList.contains("is-done")) return;
        if (kind === "kazi-kazan") { const cv = root.querySelector(".ix-scratch"); if (cv) cv.classList.add("is-gone"); reveal(root, s); }
        else if (kind === "mum") { const c = root.querySelector(".ix-cake"); if (c) c.classList.add("is-out"); setTimeout(() => reveal(root, s), 400); }
        else if (kind === "kapi-cal") { for (let i = 0; i < 3; i++) setTimeout(() => root.click(), i * 260); }
        else if (root.__ixPlay) root.__ixPlay();
        else root.click();
      });
    }
    if (!live) root.appendChild(el("span", "ix-edit-badge", null, "✦ " + (KINDS.find(k => k[0] === kind) || [0, ""])[1]));
    return root;
  }

  global.SeozModuleRegistry.registerModule({
    id: "interactive",
    label: "Etkileşim (kazı-kazan, balon, zarf…)",
    defaultSettings: DEFAULTS,
    defaultLayerSize: { w: 300, h: 220 },
    settingsSchema: SETTINGS_SCHEMA,
    render: render,
    panelActions: { studio(layer, h) { if (global.SeozInteractiveStudio) global.SeozInteractiveStudio.open(layer, h); } },
    validate: (s) => {
      s = Object.assign({}, DEFAULTS, s);
      if (s.resultType === "baglanti" && !String(s.linkUrl || "").trim()) return "Etkileşim: sonuç “Bağlantı” seçilmiş ama adres girilmemiş.";
      if (s.resultType === "gorsel" && !refs(s).length && !s.resultImage) return "Etkileşim: sonuç “Görsel” seçilmiş ama görsel yüklenmemiş.";
      return null;
    }
  });
  global.SeozInteractive = { KINDS, HINT, DEFAULTS, STUDIO_KINDS, CUT_DEFAULTS, PART_DEFAULTS, render };
})(window);
