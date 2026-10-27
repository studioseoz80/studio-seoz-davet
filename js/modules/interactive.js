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
  // E1 + E2: kendi görselleriyle çalışan, Etkileşim Stüdyosu'ndan düzenlenen türler (on türün tamamı)
  const STUDIO_KINDS = KINDS.map(k => k[0]);
  const SETTINGS_SCHEMA = [
    { key: "kind", type: "select", label: "Nesne", options: KINDS.map(([value, label]) => ({ value, label })), reRenderPanel: true },
    { key: "_studio", type: "action-button", label: "✨ Etkileşim Stüdyosu: kendi görselleriniz, hareket, sürpriz", action: "studio", showIf: s => STUDIO_KINDS.indexOf(s.kind) >= 0 },
    { key: "title", type: "text", label: "Üstteki ipucu (boşsa hazır ipucu)" },
    { key: "resultType", type: "select", label: "Sonuç", options: [{ value: "mesaj", label: "Mesaj" }, { value: "gorsel", label: "Görsel" }, { value: "baglanti", label: "Bağlantı düğmesi" }, { value: "efekt", label: "Yalnızca efekt" }, { value: "anim", label: "Yalnızca animasyon" }] },
    { key: "message", type: "textarea", label: "Mesaj (sayfanın içinde durur — gerçek bir sır yazmayın)" },
    { key: "images", type: "image-list", label: "Görseller: 1. ön/kapak (isteğe bağlı) · 2. sonuç görseli" },
    { key: "linkUrl", type: "url", label: "Bağlantı adresi (sonuç “Bağlantı” ise)" },
    { key: "linkText", type: "text", label: "Bağlantı düğmesi yazısı" },
    { key: "effect", type: "select", label: "Efekt", options: [{ value: "konfeti", label: "Konfeti" }, { value: "kalp", label: "Kalpler" }, { value: "yildiz", label: "Yıldızlar" }, { value: "simli", label: "Simli parıltı" }, { value: "yok", label: "Yok" }] },
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
  const COLS = { konfeti: ["#E94F6B", "#F7C548", "#4FB0E9", "#7BD389", "#FFFFFF", "#B8925A"], kalp: ["#F06A8A", "#F7A3B8", "#E2335C"], yildiz: ["#F3D27A", "#FFF1C4", "#FFFFFF"], simli: ["#F3D27A", "#FFF1C4", "#E7C77C", "#FFFFFF", "#D9B25F"] };
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
    } else if (s.resultType !== "efekt" && s.resultType !== "anim" && s.message) box.appendChild(el("div", "ix-result-t", null, esc(s.message).replace(/\n/g, "<br>")));
    return box;
  }
  function reveal(root, s) { root.classList.add("is-done"); burst(root, s.resultType === "anim" ? "yok" : s.effect); }
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
  function partOf(s, key) {
    const p = (s.parts || {})[key]; if (!(p && p.ref)) return null;
    return Object.assign({}, partDefault(s.kind, key), p);
  }
  function placePart(e, p) {
    Object.assign(e.style, { left: clampN(p.x, -50, 150, 50) + "%", top: clampN(p.y, -50, 150, 50) + "%", width: clampN(p.w, 2, 300, 50) + "%",
      transform: `translate(-50%, -50%) rotate(${clampN(p.rot, -180, 180, 0)}deg)` });
    if (p.nw > 0 && p.nh > 0) e.style.aspectRatio = `${p.nw} / ${p.nh}`;
  }
  function kurdele2(root, s, live) {
    const C = Object.assign({}, CUT_DEFAULTS, s.cut || {}), imgs = refs(s);
    const at = clampN(C.at, 5, 95, 50), T = clampN(C.dur, 0.3, 8, 1.6) / clampN(C.speed, 0.25, 4, 1) * 1000;
    root.classList.add("ix-k2on"); root.dataset.ixTrigger = C.trigger === "kaydir" ? "kaydir" : "dokun";
    if (C.trigger === "kaydir") root.__ixHint = "Kurdeleyi kesmek için parmağınızla kaydırın";
    const back = partOf(s, "back"), under = el("div", "ix-under");
    const bref = back ? back.ref : imgs[0];
    if (bref) { const im = el("img", "ix-under-img"); im.alt = ""; setImg(im, bref); under.appendChild(im); }
    under.appendChild(resultEl(s)); root.appendChild(under);
    const stage = el("div", "ix-k2"); root.appendChild(stage);
    const R = partOf(s, "ribbon"), rib = el("div", "ix-k2-rib"); placePart(rib, R); rib.dataset.ixp = "ribbon"; stage.appendChild(rib);
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
    if (B) { bow = el("div", "ix-k2-bow"); placePart(bow, B); bow.dataset.ixp = "bow"; const im = el("img"); im.alt = ""; im.draggable = false; setImg(im, B.ref); bow.appendChild(im); stage.appendChild(bow); }
    let sc = null;
    if (C.scissor !== false) {
      const SP = partOf(s, "scissor");
      sc = el("div", "ix-k2-sc", { left: at + "%" }); const im = el("img"); im.alt = ""; im.draggable = false;
      if (SP) { setImg(im, SP.ref); if (SP.nw > 0 && SP.nh > 0) sc.style.aspectRatio = `${SP.nw} / ${SP.nh}`; } else im.src = SCISSOR_SVG;
      sc.appendChild(im); rib.appendChild(sc);
    }
    const swipe = C.trigger === "kaydir", WAIT = "translate(-50%, -50%) translateX(28%)";
    // kaydırma modunda makas kesim noktasının yanında bekler: misafir neyi, nereden keseceğini görür
    if (sc && swipe) { sc.style.opacity = "1"; sc.style.transform = WAIT; }
    if (!live) return;
    let done = false, idle = null;
    if (sc && swipe && !reduced()) idle = AN(sc, [{ transform: WAIT }, { transform: WAIT + " scaleY(.86)", offset: 0.5 }, { transform: WAIT }], { duration: 1600, iterations: Infinity, easing: "ease-in-out", fill: "none" });
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
    function cutNat(PR) {
      /* ✨ doğal kesim: makas küçük bir yay çizerek gelir; ağzı açılır ve KAPANDIĞI anda kurdele ayrılır. Uçlar
         gerginliği boşaltıp (hafif geri tepme) dış uçlarından yerçekimiyle savrulur, sönümlenerek salınır (sark) ya
         da hızlanarak düşer (dus). Kutlama, kesim tamamlanıp uçlar aşağı indikten sonra başlar. */
      const tSnip = sc ? T * 0.3 : 0, snipD = T * 0.16, cutAt = sc ? tSnip + snipD * 0.72 : 0;
      if (idle) idle.cancel();
      const C0 = "translate(-50%, -50%)";
      if (sc) {
        A(sc, swipe ? [{ transform: WAIT + " rotate(0deg)", opacity: 1, easing: "cubic-bezier(.22,.61,.36,1)" }, { transform: C0 + " translateX(0) rotate(0deg)", opacity: 1 }]
          : [{ transform: C0 + " translate(240%, -70%) rotate(12deg)", opacity: 0, easing: "cubic-bezier(.22,.61,.36,1)" }, { opacity: 1, offset: 0.3, easing: "cubic-bezier(.22,.61,.36,1)" },
             { transform: C0 + " translate(80%, -34%) rotate(7deg)", offset: 0.6, easing: "cubic-bezier(.37,0,.63,1)" }, { transform: C0 + " translate(0px, 0px) rotate(0deg)", opacity: 1 }], { duration: tSnip });
        A(sc, [{ transform: C0 + " rotate(0deg) scaleY(1)", easing: "cubic-bezier(.37,0,.63,1)" }, { transform: C0 + " rotate(-9deg) scaleY(1.16)", offset: 0.42, easing: "cubic-bezier(.55,.085,.68,.53)" },
          { transform: C0 + " rotate(1deg) scaleY(.78)", offset: 0.72, easing: "cubic-bezier(.37,0,.63,1)" }, { transform: C0 + " rotate(0deg) scaleY(1)" }], { duration: snipD, delay: tSnip, fill: "none" });
        A(sc, [{ transform: C0 + " translate(0px, 0px) rotate(0deg)", opacity: 1, easing: "cubic-bezier(.45,.05,.55,.95)" }, { transform: C0 + " translate(-60%, -50%) rotate(-10deg)", opacity: 1, offset: 0.35, easing: "cubic-bezier(.55,.085,.68,.53)" },
          { transform: C0 + " translate(-230%, -30%) rotate(-18deg)", opacity: 0 }], { duration: T * 0.42, delay: tSnip + snipD });
      }
      later(() => {
        shapeEdges(); full.style.visibility = "hidden"; hl.style.display = hr.style.display = "block";
        const fall = C.fall === "dus", d = T * (fall ? 0.72 : 0.95), SIN = "cubic-bezier(.37,0,.63,1)", G = "cubic-bezier(.55,.085,.68,.53)";
        const kfL = fall
          ? [{ transform: "none", opacity: 1, easing: "cubic-bezier(.22,.61,.36,1)" }, { transform: "translateX(-4%) rotate(-3deg)", offset: 0.08, easing: G },
             { transform: "translate(-7%, 50%) rotate(36deg) scaleY(.94)", offset: 0.45, easing: G }, { transform: "translate(-12%, 240%) rotate(84deg) scaleY(.9)", opacity: 0 }]
          : [{ transform: "none", easing: "cubic-bezier(.22,.61,.36,1)" }, { transform: "translateX(-4%) rotate(-3deg)", offset: 0.07, easing: G },
             { transform: "translateX(-3%) rotate(97deg) scaleY(.93)", offset: 0.38, easing: SIN }, { transform: "translateX(-3%) rotate(71deg) scaleY(.95)", offset: 0.56, easing: SIN },
             { transform: "translateX(-3%) rotate(84deg) scaleY(.94)", offset: 0.72, easing: SIN }, { transform: "translateX(-3%) rotate(77deg) scaleY(.95)", offset: 0.86, easing: SIN }, { transform: "translateX(-3%) rotate(79deg) scaleY(.95)" }];
        const kfR = kfL.map(k => Object.assign({}, k, { transform: k.transform.replace(/translateX\(-/g, "translateX(").replace(/translate\(-/g, "translate(").replace(/rotate\((-?)(\d+)deg\)/g, (m, sg, n) => `rotate(${sg ? "" : "-"}${n}deg)`) }));
        A(hl, kfL, { duration: d });
        A(hr, kfR, { duration: d * 1.03, delay: 24 });
        if (bow) A(bow, [{ transform: bow.style.transform, opacity: 1, easing: "cubic-bezier(.22,.61,.36,1)" }, { transform: bow.style.transform + " translateY(-8%) scale(1.04)", offset: 0.14, easing: G }, { transform: bow.style.transform + " translateY(240%) rotate(32deg)", opacity: 0 }], { duration: T * 0.75 });
        later(() => reveal(root, s), d * (fall ? 0.42 : 0.5));
      }, cutAt);
    }
    function cut() {
      if (done || root.classList.contains("is-done")) return; done = true;
      if (reduced()) { stage.style.opacity = "0"; reveal(root, s); return; }
      if (root.__prof) return cutNat(root.__prof);
      const tSnip = sc ? T * 0.32 : 0;
      if (idle) idle.cancel();
      if (sc) {
        A(sc, swipe ? [{ transform: WAIT + " rotate(0deg)", opacity: 1 }, { transform: "translate(-50%, -50%) translateX(0) rotate(0deg)", opacity: 1 }]
          : [{ transform: "translate(-50%, -50%) translateX(260%) rotate(0deg)", opacity: 0 }, { opacity: 1, offset: 0.25 }, { transform: "translate(-50%, -50%) translateX(0) rotate(0deg)", opacity: 1 }], { duration: tSnip, easing: "cubic-bezier(.2,.7,.2,1)" });
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
      let taps = 0;
      root.addEventListener("click", () => {
        if (done) return;
        if (++taps >= 2) return cut();
        const hint = root.querySelector(".ix-hint");
        if (hint) A(hint, [{ transform: "translateX(-50%) scale(1)" }, { transform: "translateX(-50%) scale(1.08)", offset: 0.3 }, { transform: "translateX(-50%) scale(1)" }], { duration: 700, fill: "none" });
        if (sc) { if (idle) idle.pause(); const a = A(sc, [{ transform: WAIT }, { transform: "translate(-50%, -50%) translateX(-12%)", offset: 0.45 }, { transform: WAIT }], { duration: 900, easing: "ease-in-out", fill: "none" }); if (a && idle) a.onfinish = () => { if (!done) idle.play(); }; }
      });
    } else root.addEventListener("click", cut);
  }
  /* ======================= E2 · Diğer dokuz etkileşim (kendi görselleriyle) =======================
     Ortak düzen E1 ile aynıdır: s.parts[parça] = { ref, nw, nh, x, y, w, rot } (x, y: merkez %; w: kutu genişliğinin %'si).
     Hareket ayarları türe özeldir ve s.motion[tür] içinde durur (Kurdele: s.cut). Bir türün ana parçası
     (MAIN_PART) yüklenmemişse o tür eskisi gibi hazır çizimle çalışır; eski davetiyeler hiç etkilenmez.
     Hareketler dönüşüm/saydamlık ile yapılır (telefonda akıcı); her tür kendi gerçek hareketini kullanır. */
  const MAIN_PART = { kurdele: "ribbon", "kazi-kazan": "cover", zarf: "body", balon: "balloon", hediye: "box", konfeti: "button", "foto-cevir": "front", dilek: "lantern", mum: "cake", "kapi-cal": "left" };
  const PART_DEFS = {
    "kazi-kazan": { cover: { x: 50, y: 50, w: 90, rot: 0 }, frame: { x: 50, y: 50, w: 100, rot: 0 } },
    zarf: { body: { x: 50, y: 62, w: 84, rot: 0 }, flap: { x: 50, y: 40, w: 84, rot: 0 }, seal: { x: 50, y: 52, w: 16, rot: 0 }, letter: { x: 50, y: 56, w: 74, rot: 0 }, inner: { x: 50, y: 56, w: 84, rot: 0 } },
    balon: {},
    hediye: { box: { x: 50, y: 64, w: 52, rot: 0 }, lid: { x: 50, y: 38, w: 58, rot: 0 }, bow: { x: 50, y: 26, w: 40, rot: 0 } },
    konfeti: { button: { x: 50, y: 42, w: 40, rot: 0 } },
    "foto-cevir": { front: { x: 50, y: 50, w: 70, rot: 0 } },
    dilek: { lantern: { x: 50, y: 60, w: 22, rot: 0 } },
    mum: { cake: { x: 50, y: 64, w: 70, rot: 0 } },
    "kapi-cal": { left: { x: 50, y: 50, w: 64, rot: 0 }, right: { x: 66, y: 50, w: 32, rot: 0 }, knocker: { x: 50, y: 46, w: 12, rot: 0 }, frame: { x: 50, y: 50, w: 78, rot: 0 } }
  };
  const MOTION_DEFAULTS = {
    "kazi-kazan": { trigger: "kazi", brush: 34, open: 45, finish: "sol", dust: true, coin: true, dur: 1.6, speed: 1 },
    zarf: { trigger: "dokun", seal: "kir", out: "one", rise: 62, dur: 2.4, speed: 1 },
    balon: { pop: "patla", need: "hepsi", sway: 1, tint: true, sound: true, dur: 0.7, speed: 1, items: null },
    hediye: { trigger: "dokun", open: "kalk", side: "sag", boxEnd: "kalsin", shake: true, glow: true, dur: 1.8, speed: 1 },
    konfeti: { shot: "patla", amount: 1, spread: 70, dir: 0, dur: 2.6, speed: 1 },
    "foto-cevir": { trigger: "dokun", axis: "y", dir: 1, lift: true, again: true, dur: 0.9, speed: 1 },
    dilek: { trigger: "dugme", btnText: "🏮 Dileğimi bırak", path: "salin", wind: 15, height: 150, count: 1, glow: true, again: true, dur: 6, speed: 1 },
    mum: { trigger: "basili", hold: 1.3, order: "sirayla", smoke: true, dur: 1.8, speed: 1, flames: null },
    "kapi-cal": { mode: "cift", hinge: "sol", knocks: 3, dir: "iceri", angle: 80, light: true, sound: true, dur: 1.6, speed: 1 }
  };
  const FLAME_DEFAULTS = [{ x: 38, y: 30, w: 6 }, { x: 50, y: 27, w: 6 }, { x: 62, y: 30, w: 6 }];
  const COIN_SVG = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><radialGradient id="g" cx=".36" cy=".3" r=".8"><stop offset="0" stop-color="#FFF6CC"/><stop offset=".45" stop-color="#E9C25A"/><stop offset="1" stop-color="#94722A"/></radialGradient></defs><circle cx="50" cy="50" r="46" fill="url(#g)" stroke="#82631F" stroke-width="3"/><circle cx="50" cy="50" r="36" fill="none" stroke="#B8923C" stroke-width="2.5" stroke-dasharray="3 3"/><path d="M50 27 L56 44 L73 50 L56 56 L50 73 L44 56 L27 50 L44 44 Z" fill="#9C7A2E"/></svg>`);

  function partDefault(kind, key) {
    if (kind === "kurdele" || !PART_DEFS[kind]) return Object.assign({}, PART_DEFAULTS[key] || {});
    return Object.assign({ x: 50, y: 50, w: 40, rot: 0 }, PART_DEFS[kind][key] || {});
  }
  function balloonDefault(i, n) { const span = 84 / n; return { x: Math.round((8 + span * i + span / 2) * 10) / 10, y: 58 - ((i * 29) % 26), w: Math.round(Math.max(12, Math.min(30, span * 0.9)) * 10) / 10, rot: 0 }; }
  const hasMain = (s, kind) => { const p = (s.parts || {})[MAIN_PART[kind]]; return !!(p && p.ref); };
  function motionOf(s, kind) { return Object.assign({}, MOTION_DEFAULTS[kind], ((s.motion || {})[kind]) || {}); }
  const msOf = M => clampN(M.dur, 0.2, 20, 1.6) / clampN(M.speed, 0.25, 4, 1) * 1000;
  const AN = (e, kf, o) => { if (!e || !e.animate) return null; try { return e.animate(kf, Object.assign({ fill: "forwards" }, o, reduced() ? { duration: 1, delay: 0, iterations: 1 } : null)); } catch (er) { return null; } };
  const later = (fn, ms) => setTimeout(fn, reduced() ? 0 : ms);
  function pic(ref, cls) { const im = el("img", cls); im.alt = ""; im.draggable = false; if (/^data:/.test(ref || "")) im.src = ref; else setImg(im, ref); return im; }
  // konumlandırılmış parça: dış kutu yerleşimi taşır, iç kutu hareketi taşır (ikisi birbirini bozmaz)
  function piece(cls, p, key, z) {
    const w = el("div", "ix2-p " + cls); placePart(w, p); if (key) w.dataset.ixp = key; if (z != null) w.style.zIndex = z;
    const inn = el("div", "ix2-in"), im = pic(p.ref); inn.appendChild(im); w.appendChild(inn); w.__in = inn; w.__img = im; return w;
  }
  function stage2(root, s) {
    root.classList.add("ix2on");
    const st = el("div", "ix2"); root.appendChild(st);
    const b = partOf(s, "back"); if (b) st.appendChild(pic(b.ref, "ix2-back"));
    return st;
  }
  function resolveRef(ref) { if (!ref) return Promise.resolve(""); return global.SeozBlobStore ? SeozBlobStore.resolveToObjectURL(ref) : Promise.resolve(ref); }
  // görseli tuval/maske için yükler; başka alan adındaysa önce CORS ile dener (olmazsa maske kullanılmaz, kazıma yine çalışır)
  function loadImg(ref) {
    return resolveRef(ref).then(u => new Promise(res => {
      if (!u) return res(null);
      // maske yalnızca görsel gerçekten okunabiliyorsa kullanılır (ör. file:// ile açılan pakette okunamaz → maskesiz)
      const readable = im => { try { const c = document.createElement("canvas"); c.width = c.height = 1; const x = c.getContext("2d"); x.drawImage(im, 0, 0, 1, 1); x.getImageData(0, 0, 1, 1); return true; } catch (e) { return false; } };
      const make = (cors) => { const im = new Image(); if (cors === "x") im.crossOrigin = "anonymous"; im.onload = () => res({ img: im, url: u, cors: !!cors && readable(im) }); im.onerror = () => (cors === "x" ? make(false) : res(null)); im.src = u; };
      const same = !/^https?:/i.test(u) || u.indexOf(global.location.origin) === 0;
      make(same ? true : "x");
    }));
  }
  function maskBy(e, info) { if (!info || !info.cors) return; const v = `url("${info.url}")`; e.style.webkitMaskImage = v; e.style.maskImage = v; }
  function onSwipe(root, test, fn, touch) {
    let p0 = null;
    root.addEventListener("dragstart", e => e.preventDefault());
    root.addEventListener("pointerdown", e => { p0 = { x: e.clientX, y: e.clientY }; try { root.setPointerCapture(e.pointerId); } catch (er) { /* önemsiz */ } });
    root.addEventListener("pointermove", e => { if (!p0) return; const r = test(e.clientX - p0.x, e.clientY - p0.y); if (r) { p0 = null; fn(r); } });
    ["pointerup", "pointercancel"].forEach(ev => root.addEventListener(ev, () => { p0 = null; }));
    root.style.touchAction = touch || "none";
  }
  const swipeUp = (dx, dy) => (dy < -32 && Math.abs(dy) > Math.abs(dx) ? 1 : 0);
  function popSound() {
    try {
      const AC = global.AudioContext || global.webkitAudioContext; if (!AC) return;
      const ac = knock.ac || (knock.ac = new AC()), n = Math.floor(ac.sampleRate * 0.09), buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
      const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      f.type = "highpass"; f.frequency.value = 700; g.gain.value = 0.45; src.buffer = buf; src.connect(f).connect(g).connect(ac.destination); src.start();
    } catch (e) { /* ses isteğe bağlı */ }
  }
  // sonuç: yeni çizimlerde efekt gerçekçi kâğıt fiziğiyle saçılır; "Yalnızca animasyon"da efekt yok
  function reveal2(root, s) {
    if (root.classList.contains("is-done")) return;
    root.classList.add("is-done");
    if (s.resultType !== "anim" && s.effect && s.effect !== "yok") confetti(root, { mode: "patla", type: s.effect, count: 70 });
  }

  /* ----------------------------- konfeti fiziği (kâğıt çevrilmesi, hava direnci, salınım) ----------------------------- */
  function confetti(host, o) {
    if (reduced()) return;
    const cv = el("canvas", "ix-burst"); host.appendChild(cv);
    const hw = host.offsetWidth || 300, hh = host.offsetHeight || 220, W = hw + 160, H = hh + 200, dpr = Math.min(2, global.devicePixelRatio || 1);
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + "px"; cv.style.height = H + "px";
    const ctx = cv.getContext("2d"), type = COLS[o.type] ? o.type : "konfeti", cols = COLS[type], imgs = (o.imgs || []).filter(Boolean), R = Math.random;
    const k = Math.max(0.7, Math.min(2.2, hh / 220)), life = Math.max(0.6, o.life || 2.4), N = Math.round((o.count || 70) * (type === "simli" ? 1.3 : 1)), list = [];
    function add(x, y, ang, v, d) {
      list.push({ x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, c: cols[list.length % cols.length], s: (type === "simli" ? 2 + R() * 3 : 5 + R() * 6) * Math.min(1.4, k),
        r: R() * 6.3, vr: (R() - 0.5) * 10, f: R() * 6.3, vf: 5 + R() * 9, life: life * (0.7 + R() * 0.45), d: d || 0, t: 0, im: imgs.length ? imgs[list.length % imgs.length] : null, sh: R() });
    }
    const ox = 80 + (o.x != null ? o.x : hw / 2), oy = 100 + (o.y != null ? o.y : hh / 2), spread = (o.spread || 70) * Math.PI / 180, base = (-90 + (o.dir || 0)) * Math.PI / 180;
    if (o.mode === "yagmur") for (let i = 0; i < N; i++) add(80 + R() * hw, 60 - R() * 50, Math.PI / 2, (30 + R() * 80) * k, R() * life * 0.45);
    else if (o.mode === "top") for (let i = 0; i < N; i++) { const L = i % 2 === 0; add(80 + hw * (L ? 0.04 : 0.96), 100 + hh, (L ? -62 : -118) * Math.PI / 180 + (R() - 0.5) * spread * 0.6, (420 + R() * 520) * k, R() * 0.12); }
    else for (let i = 0; i < N; i++) add(ox, oy, base + (R() - 0.5) * spread, (300 + R() * 520) * k, R() * 0.05);
    const g = (type === "simli" ? 260 : 720) * k, term = (type === "simli" ? 60 : 150) * k;
    function heart(sz) { ctx.beginPath(); ctx.moveTo(0, sz * 0.35); ctx.bezierCurveTo(-sz, -sz * 0.4, -sz * 0.4, -sz * 1.1, 0, -sz * 0.45); ctx.bezierCurveTo(sz * 0.4, -sz * 1.1, sz, -sz * 0.4, 0, sz * 0.35); ctx.fill(); }
    function star(sz) { ctx.beginPath(); ctx.moveTo(0, -sz); ctx.quadraticCurveTo(0, 0, sz, 0); ctx.quadraticCurveTo(0, 0, 0, sz); ctx.quadraticCurveTo(0, 0, -sz, 0); ctx.quadraticCurveTo(0, 0, 0, -sz); ctx.fill(); }
    let last = 0;
    function step(now) {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60; last = now;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      let alive = 0;
      for (const p of list) {
        p.t += dt; if (p.t < p.d) { alive++; continue; }
        const t = p.t - p.d; if (t > p.life) continue; alive++;
        const drag = Math.exp(-2.2 * dt);
        p.vy += g * dt; p.vx *= drag;
        if (p.vy > term) p.vy = term + (p.vy - term) * Math.exp(-6 * dt); else if (p.vy < 0) p.vy *= drag;
        p.f += p.vf * dt; p.r += p.vr * dt; p.x += (p.vx + Math.sin(p.f * 0.7) * 26 * k) * dt; p.y += p.vy * dt;
        let a = Math.min(1, (p.life - t) / (p.life * 0.25)); if (type === "simli") a *= 0.55 + 0.45 * Math.abs(Math.sin(p.f * 1.7));
        ctx.globalAlpha = Math.max(0, a); ctx.fillStyle = p.c; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
        if (type !== "simli") ctx.scale(1, Math.cos(p.f));   // kâğıdın havada dönüp ince görünmesi
        if (p.im && p.im.naturalWidth) { const sz = p.s * 2.4, ih = sz * p.im.naturalHeight / p.im.naturalWidth; ctx.drawImage(p.im, -sz / 2, -ih / 2, sz, ih); }
        else if (type === "kalp") heart(p.s * 1.3);
        else if (type === "yildiz") star(p.s);
        else if (type === "simli") { if (p.sh < 0.3) star(p.s * 1.6); else { ctx.beginPath(); ctx.arc(0, 0, p.s / 1.4, 0, 6.283); ctx.fill(); } }
        else if (p.sh < 0.22) { ctx.beginPath(); ctx.arc(0, 0, p.s / 2.6, 0, 6.283); ctx.fill(); }
        else if (p.sh > 0.86) ctx.fillRect(-p.s * 0.8, -p.s / 6, p.s * 1.6, p.s / 3);
        else ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        ctx.restore();
      }
      if (alive) requestAnimationFrame(step); else cv.remove();
    }
    requestAnimationFrame(step);
  }

  /* ----------------------------- Kazı-kazan: kendi kaplamanız kazınır ----------------------------- */
  function kazi2(root, s, live) {
    const M = motionOf(s, "kazi-kazan"), T = msOf(M), st = stage2(root, s), C = partOf(s, "cover");
    const area = el("div", "ix2-p ix2-scr"); placePart(area, C); area.dataset.ixp = "cover"; st.appendChild(area);
    const under = el("div", "ix2-scr-under"); under.style.visibility = "hidden"; under.appendChild(resultEl(s)); area.appendChild(under);
    const cv = el("canvas", "ix2-scr-cv"); area.appendChild(cv);
    const F = partOf(s, "frame"); if (F) st.appendChild(piece("ix2-frame", F, "frame", 4));
    let coin = null;
    if (live && M.coin !== false) {
      const CP = partOf(s, "coin"); coin = el("div", "ix2-coin"); coin.appendChild(pic(CP ? CP.ref : COIN_SVG));
      if (CP && CP.nw > 0 && CP.nh > 0) coin.style.aspectRatio = `${CP.nw} / ${CP.nh}`; area.appendChild(coin);
    }
    root.__ixHint = M.trigger === "dokun" ? "Kazımak için dokunun" : HINT["kazi-kazan"];
    let ctx = null, orig = null, idx = null, done = false, len = 0;
    const need = clampN(M.open, 10, 95, 45) / 100;
    loadImg(C.ref).then(info => {
      maskBy(under, info);   // sürpriz yalnızca kaplamanın şeklinin içinde durur
      let tries = 0;
      const paint = () => {
        const W = area.offsetWidth, H = area.offsetHeight;
        if (!W || !H) { if (++tries < 120) requestAnimationFrame(paint); return; }
        const dpr = Math.min(2, global.devicePixelRatio || 1);
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
        ctx = cv.getContext("2d", { willReadFrequently: true });
        if (info) ctx.drawImage(info.img, 0, 0, cv.width, cv.height);
        else { const g = ctx.createLinearGradient(0, 0, cv.width, cv.height); g.addColorStop(0, "#9AA0A6"); g.addColorStop(0.5, "#E6E9EC"); g.addColorStop(1, "#8A9096"); ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height); }
        try { orig = ctx.getImageData(0, 0, cv.width, cv.height).data; idx = []; for (let i = 3; i < orig.length; i += 64) if (orig[i] > 40) idx.push(i); } catch (e) { orig = null; idx = null; }
        under.style.visibility = "";
      };
      paint();
    });
    if (!live) return;
    const rad = () => clampN(M.brush, 8, 120, 34) / 2 * (cv.width / Math.max(1, area.offsetWidth));
    function scratch(a, b) {
      if (!ctx) return;
      const r = rad(), dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), n = Math.max(1, Math.ceil(d / (r * 0.35)));
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = "destination-out";
      for (let i = 0; i <= n; i++) {   // pürüzlü kenar: gerçek kazıma gibi
        const x = a.x + dx * i / n, y = a.y + dy * i / n;
        ctx.beginPath(); ctx.arc(x + (Math.random() - 0.5) * r * 0.16, y + (Math.random() - 0.5) * r * 0.16, r * (0.84 + Math.random() * 0.16), 0, 6.283); ctx.fill();
      }
      ctx.restore(); len += d;
    }
    function dust(p, force) {
      if (M.dust === false || reduced() || (!force && area.querySelectorAll(".ix2-dust").length > 36)) return;
      let col = "rgb(170,170,175)";
      if (orig) { const i = (Math.round(p.y) * cv.width + Math.round(p.x)) * 4; if (orig[i + 3] > 40) col = `rgb(${orig[i]},${orig[i + 1]},${orig[i + 2]})`; }
      for (let j = 0; j < 2; j++) {
        const d = el("i", "ix2-dust"); d.style.background = col; d.style.left = p.ox + "px"; d.style.top = p.oy + "px"; area.appendChild(d);
        const a = AN(d, [{ transform: "translate(0,0) rotate(0)", opacity: 1 }, { transform: `translate(${(Math.random() - 0.5) * 30}px, ${18 + Math.random() * 34}px) rotate(${Math.random() * 300}deg)`, opacity: 0 }], { duration: 600 + Math.random() * 500, easing: "cubic-bezier(.3,.1,.6,1)" });
        if (a) a.onfinish = () => d.remove(); else d.remove();
      }
    }
    function progress() {
      if (idx && idx.length && ctx) { try { const d = ctx.getImageData(0, 0, cv.width, cv.height).data; let n = 0; for (let j = 0; j < idx.length; j++) if (d[idx[j]] < 30) n++; return n / idx.length; } catch (e) { /* ölçülemiyor */ } }
      return Math.min(1, len * rad() * 2 / Math.max(1, cv.width * cv.height) * 0.75);
    }
    function moveCoin(p, vx) { if (!coin) return; coin.style.left = p.ox + "px"; coin.style.top = p.oy + "px"; coin.style.transform = `translate(-30%, -70%) rotate(${Math.max(-25, Math.min(25, (vx || 0) * 0.8))}deg)`; }
    function finish() {
      if (done) return; done = true; if (coin) coin.classList.remove("is-on");
      cv.style.pointerEvents = "none";
      if (M.finish === "dagil") {
        for (let i = 0; i < 26; i++) dust({ x: Math.random() * cv.width, y: Math.random() * cv.height, ox: Math.random() * area.offsetWidth, oy: Math.random() * area.offsetHeight }, true);
        AN(cv, [{ opacity: 1, transform: "scale(1)", filter: "blur(0px)" }, { opacity: 0, transform: "scale(1.04)", filter: "blur(3px)" }], { duration: 700, easing: "ease-in" });
      } else AN(cv, [{ opacity: 1 }, { opacity: 0 }], { duration: 650, easing: "ease-out" });
      reveal2(root, s);
    }
    let down = false, last = null, moves = 0, auto = false;
    const local = e => { const k = cv.width / Math.max(1, cv.offsetWidth); return { x: e.offsetX * k, y: e.offsetY * k, ox: e.offsetX, oy: e.offsetY }; };
    function play() {
      if (done || auto) return; auto = true;
      if (!ctx) { setTimeout(() => { auto = false; play(); }, 120); return; }
      if (reduced()) return finish();
      const W = cv.width, H = cv.height, pts = [], kx = area.offsetWidth / Math.max(1, W);
      for (let i = 0; i < 5; i++) { const y = H * (0.12 + 0.19 * i); pts.push({ x: i % 2 ? W * 0.9 : W * 0.1, y: y - H * 0.06 }, { x: i % 2 ? W * 0.1 : W * 0.9, y: y + H * 0.06 }); }
      let t0 = 0, prev = pts[0]; const total = pts.length - 1; if (coin) coin.classList.add("is-on");
      function tick(now) {
        if (!t0) t0 = now;
        const u = Math.min(1, (now - t0) / T), f = u * total, i = Math.min(total - 1, Math.floor(f)), a = pts[i], b = pts[i + 1], q = f - i;
        const p = { x: a.x + (b.x - a.x) * q, y: a.y + (b.y - a.y) * q }; p.ox = p.x * kx; p.oy = p.y * kx;
        scratch(prev, p); if (Math.random() < 0.4) dust(p); moveCoin(p, p.x - prev.x); prev = p;
        if (u < 1 && !done) requestAnimationFrame(tick); else finish();
      }
      requestAnimationFrame(tick);
    }
    root.__ixPlay = play;
    if (M.trigger === "dokun") { root.addEventListener("click", play); return; }
    cv.addEventListener("pointerdown", e => {
      if (done || auto) return; down = true; last = local(e); try { cv.setPointerCapture(e.pointerId); } catch (er) { /* önemsiz */ }
      scratch(last, { x: last.x + 0.1, y: last.y }); moveCoin(last, 0); if (coin) coin.classList.add("is-on"); e.preventDefault();
    });
    cv.addEventListener("pointermove", e => {
      if (!down || done) return; const p = local(e); scratch(last, p); if (++moves % 3 === 0) dust(p); moveCoin(p, p.x - last.x); last = p;
      if (moves % 8 === 0 && progress() >= need) finish();
    });
    const up = () => { if (!down) return; down = false; if (coin) coin.classList.remove("is-on"); if (!done && progress() >= need) finish(); };
    cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
  }

  /* ----------------------------- Zarf: mühür kırılır, kapak menteşesinden açılır, mektup çıkar ----------------------------- */
  function zarf2(root, s, live) {
    const M = motionOf(s, "zarf"), T = msOf(M), st = stage2(root, s);
    const B = partOf(s, "body"), FL = partOf(s, "flap"), FI = partOf(s, "flapIn"), SE = partOf(s, "seal"), LE = partOf(s, "letter"), IN = partOf(s, "inner");
    if (IN) st.appendChild(piece("ix2-zin", IN, "inner", 1));
    const LP = LE || { x: B.x, y: B.y, w: B.w * 0.86, rot: B.rot, nw: B.nw || 4, nh: (B.nh || 3) * 0.9 };
    const letter = el("div", "ix2-p ix2-letter"); placePart(letter, LP); letter.style.zIndex = 2; if (LE) letter.dataset.ixp = "letter";
    const lin = el("div", "ix2-in ix2-letter-in" + (LE ? "" : " is-paper")); if (LE) lin.appendChild(pic(LE.ref)); lin.appendChild(resultEl(s)); letter.appendChild(lin); st.appendChild(letter);
    st.appendChild(piece("ix2-zbody", B, "body", 3));
    let flap = null, fin = null, ffront = null;
    if (FL) {
      flap = el("div", "ix2-p ix2-flap"); placePart(flap, FL); flap.dataset.ixp = "flap"; flap.style.zIndex = 4;
      fin = el("div", "ix2-in ix2-flap-in" + (FI ? " has-b" : "")); ffront = pic(FL.ref, "ix2-face"); fin.appendChild(ffront);
      if (FI) fin.appendChild(pic(FI.ref, "ix2-face ix2-face-b"));
      flap.appendChild(fin); st.appendChild(flap);
    }
    const seal = SE ? piece("ix2-seal", SE, "seal", 5) : null; if (seal) st.appendChild(seal);
    if (M.trigger === "kaydir") root.__ixHint = "Zarfı açmak için yukarı kaydırın";
    if (!live) return;
    let done = false;
    function sealOff() {
      const d = T * 0.22, ease = "cubic-bezier(.4,0,.8,.6)";
      if (M.seal === "kir") {   // balmumu mühür çatlak çizgisinden ikiye ayrılır
        seal.__img.style.visibility = "hidden";
        [-1, 1].forEach(sg => {
          const h = pic(SE.ref); h.style.clipPath = sg > 0 ? "polygon(52% 0, 100% 0, 100% 100%, 46% 100%, 54% 62%, 47% 38%)" : "polygon(0 0, 52% 0, 47% 38%, 54% 62%, 46% 100%, 0 100%)";
          seal.__in.appendChild(h);
          AN(h, [{ transform: "none", opacity: 1 }, { transform: `translate(${sg * 8}%, -4%) rotate(${sg * 10}deg)`, offset: 0.25 }, { transform: `translate(${sg * 34}%, 150%) rotate(${sg * 64}deg)`, opacity: 0 }], { duration: d * 1.7, easing: ease });
        });
      } else if (M.seal === "kalk") AN(seal.__in, [{ transform: "none", opacity: 1 }, { transform: "translateY(-14%) scale(1.12) rotate(-6deg)", offset: 0.3 }, { transform: "translateY(230%) rotate(40deg)", opacity: 0 }], { duration: d * 1.7, easing: ease });
      else AN(seal.__in, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(.7)" }], { duration: d, easing: "ease-in" });
      return d * 0.8;
    }
    function open() {
      if (done) return; done = true;
      const t1 = seal ? sealOff() : 0, tf = T * 0.34, rise = clampN(M.rise, 20, 120, 62), one = M.out !== "cik";
      later(() => {
        if (flap) {
          AN(fin, [{ transform: "perspective(700px) rotateX(0deg)" }, { transform: "perspective(700px) rotateX(180deg)" }], { duration: tf, easing: "cubic-bezier(.45,.05,.3,1)" });
          // ayrı iç yüz yoksa: kapağın arkası aynı kâğıt, ışık almadığı için gölgede kalır
          if (!FI) AN(ffront, [{ filter: "brightness(1)" }, { filter: "brightness(1)", offset: 0.47 }, { filter: "brightness(.8)", offset: 0.53 }, { filter: "brightness(.8)" }], { duration: tf });
          later(() => { flap.style.zIndex = "1"; }, tf * 0.5);
        }
        later(() => {
          const tr = T * 0.34, up = one ? Math.max(rise, 104) : rise;
          AN(lin, [{ transform: "translateY(0)" }, { transform: `translateY(-${up}%)` }], { duration: tr, easing: "cubic-bezier(.35,.6,.3,1)" });
          later(() => reveal2(root, s), tr * (root.__prof ? 0.62 : 0.35));
          if (one) later(() => {   // mektup tamamen çıkınca zarfın önüne gelir
            letter.style.zIndex = "6";
            const H = root.offsetHeight || 220, lh = letter.offsetHeight || 1, dy = (50 - LP.y) / 100 * H;
            AN(lin, [{ transform: `translateY(-${up}%)` }, { transform: `translateY(${dy / lh * 100}%) scale(1.1)` }], { duration: T * 0.3, easing: "cubic-bezier(.3,.7,.25,1)" });
          }, tr + 40);
        }, flap ? tf * 0.62 : 0);
      }, t1);
    }
    root.__ixPlay = open;
    if (M.trigger === "kaydir") onSwipe(root, swipeUp, open, "pan-x"); else root.addEventListener("click", open);
  }

  /* ----------------------------- Balon: süzülür, dokununca parçalara ayrılarak patlar ya da uçar ----------------------------- */
  function balon2(root, s, live) {
    const M = motionOf(s, "balon"), T = msOf(M), st = stage2(root, s);
    st.appendChild(resultEl(s));
    const imgsP = ["balloon", "balloon2", "balloon3"].map(k => partOf(s, k)).filter(Boolean);
    const n = Math.max(1, Math.min(9, Number(s.count) || 5)), items = Array.isArray(M.items) ? M.items : [], sway = clampN(M.sway, 0, 3, 1), need = M.need === "bir" ? 1 : n;
    if (M.need === "bir") root.__ixHint = "Bir balon patlatın";
    let popped = 0;
    const list = [];
    for (let i = 0; i < n; i++) {
      const it = Object.assign(balloonDefault(i, n), items[i] || {}), P = imgsP[(it.img != null ? Number(it.img) || 0 : i) % imgsP.length];
      const b = el("button", "ix2-p ix2-bal"); b.type = "button"; b.setAttribute("aria-label", "Balon " + (i + 1)); b.dataset.ixp = "b" + i;
      placePart(b, Object.assign({}, it, { nw: P.nw, nh: P.nh }));
      const inn = el("div", "ix2-in"), im = pic(P.ref);
      if (M.tint !== false && imgsP.length === 1 && i > 0) im.style.filter = `hue-rotate(${[0, 205, 285, 150, 330, 40, 250, 180, 100][i % 9]}deg)`;
      inn.appendChild(im); b.appendChild(inn); st.appendChild(b);
      const B = { b, inn, im, P }; list.push(B);
      if (!live) continue;
      if (sway > 0) inn.__bob = AN(inn, [{ transform: `translateY(0) rotate(${-2 * sway}deg)` }, { transform: `translateY(${-5 * sway}%) rotate(${2 * sway}deg)` }], { duration: 2400 + (i * 370) % 1300, delay: -((i * 530) % 2000), direction: "alternate", iterations: Infinity, easing: "ease-in-out", fill: "none" });
      b.addEventListener("click", e => { e.stopPropagation(); pop(B); });
    }
    if (!live) return;
    function pop(B) {
      const { b, inn, im, P } = B;
      if (b.__popped) return; b.__popped = true; b.setAttribute("aria-disabled", "true");
      const cur = getComputedStyle(inn).transform; if (inn.__bob) inn.__bob.cancel(); const t0 = cur && cur !== "none" ? cur : "none"; inn.style.transform = t0 === "none" ? "" : t0;
      if (M.sound !== false && M.pop !== "uc") popSound();
      if (M.pop === "uc") {   // ip kopmuş gibi: önce hafif sallanır, sonra hızlanarak yükselip uzaklaşır
        const H = root.offsetHeight || 220, dx = (Math.random() - 0.5) * 60;
        AN(inn, [{ transform: t0, opacity: 1 }, { transform: `translate(${dx * 0.3}px, ${-H * 0.35}px) rotate(-5deg)`, offset: 0.35 }, { transform: `translate(${dx}px, ${-H * 1.5}px) rotate(6deg) scale(.75)`, opacity: 0 }], { duration: T * 3, easing: "cubic-bezier(.45,0,.75,.5)" });
      } else {
        AN(inn, [{ transform: t0 }, { transform: (t0 === "none" ? "" : t0) + " scale(1.07, .95)" }], { duration: 70 });
        later(() => {
          im.style.visibility = "hidden";
          const ring = el("i", "ix2-popring"); inn.appendChild(ring);
          AN(ring, [{ transform: "translate(-50%,-50%) scale(.3)", opacity: 0.9 }, { transform: "translate(-50%,-50%) scale(1.5)", opacity: 0 }], { duration: 220, easing: "ease-out" });
          const w = b.offsetWidth || 40, K = 9, cy = 42;
          for (let j = 0; j < K; j++) {   // lastik, merkezden yırtılan dilimler hâlinde savrulup düşer
            const a0 = j / K * 6.283 + Math.random() * 0.2, a1 = (j + 1) / K * 6.283, pts = [`50% ${cy}%`];
            for (let q = 0; q <= 3; q++) { const a = a0 + (a1 - a0) * q / 3; pts.push(`${(50 + 80 * Math.cos(a)).toFixed(1)}% ${(cy + 80 * Math.sin(a)).toFixed(1)}%`); }
            const m = (a0 + a1) / 2, f = el("div", "ix2-frag"), fi = pic(P.ref);
            if (im.style.filter) fi.style.filter = im.style.filter;
            f.style.clipPath = `polygon(${pts.join(", ")})`; f.style.transformOrigin = `${50 + 40 * Math.cos(m)}% ${cy + 40 * Math.sin(m)}%`;
            f.appendChild(fi); inn.appendChild(f);
            const v = w * (0.35 + Math.random() * 0.45), rot = (Math.random() - 0.5) * 420;
            AN(f, [{ transform: "translate(0,0) rotate(0deg) scale(1)", opacity: 1 }, { transform: `translate(${Math.cos(m) * v}px, ${Math.sin(m) * v}px) rotate(${rot * 0.5}deg) scale(.75)`, opacity: 1, offset: 0.3 },
              { transform: `translate(${Math.cos(m) * v * 1.35}px, ${Math.sin(m) * v + w * 1.3}px) rotate(${rot}deg) scale(.45)`, opacity: 0 }], { duration: T * (0.8 + Math.random() * 0.5), easing: "cubic-bezier(.2,.6,.4,1)" });
          }
          later(() => inn.querySelectorAll(".ix2-frag, .ix2-popring").forEach(x => x.remove()), T * 1.4 + 120);
        }, 70);
      }
      popped++;
      if (popped === need) later(() => reveal2(root, s), M.pop === "uc" ? 500 : 280);
    }
    root.__ixPlay = () => list.filter(B => !B.b.__popped).forEach((B, k) => later(() => pop(B), k * 300));
  }

  /* ----------------------------- Hediye: kutu toplanıp esner, kapak kalkıp devrilir, içinden ışık ve sürpriz ----------------------------- */
  function hediye2(root, s, live) {
    const M = motionOf(s, "hediye"), T = msOf(M), st = stage2(root, s);
    const BX = partOf(s, "box"), LD = partOf(s, "lid"), BW = partOf(s, "bow");
    const glow = M.glow !== false ? el("div", "ix2-glow") : null; if (glow) st.appendChild(glow);
    const grp = el("div", "ix2-grp"); st.appendChild(grp);
    const box = piece("ix2-box", BX, "box", 1); grp.appendChild(box);
    const lid = LD ? piece("ix2-lid", LD, "lid", 2) : null; if (lid) grp.appendChild(lid);
    const bow = BW ? piece("ix2-bow", BW, "bow", 3) : null; if (bow) grp.appendChild(bow);
    const rs = el("div", "ix2-gift-res"); rs.appendChild(resultEl(s)); st.appendChild(rs);
    if (M.trigger === "kaydir") root.__ixHint = "Kapağı açmak için yukarı kaydırın";
    if (!live) return;
    const geo = () => { const H = root.offsetHeight || 220, W = root.offsetWidth || 300, bh = box.offsetHeight, top = BX.y / 100 * H - bh / 2; return { W, H, bw: box.offsetWidth, bh, top, bot: top + bh, cx: BX.x / 100 * W }; };
    let idle = null, done = false;
    if (M.shake !== false && !reduced()) setTimeout(() => {
      if (done) return; const g = geo(); grp.style.transformOrigin = `${g.cx}px ${g.bot}px`;
      idle = AN(grp, [{ transform: "none", offset: 0 }, { transform: "none", offset: 0.78 }, { transform: "rotate(-4deg)", offset: 0.83 }, { transform: "rotate(4deg)", offset: 0.88 }, { transform: "rotate(-2.5deg)", offset: 0.93 }, { transform: "none", offset: 1 }], { duration: 2600, iterations: Infinity, fill: "none" });
    }, 60);
    function open() {
      if (done) return; done = true; if (idle) idle.cancel();
      const g = geo(), side = M.side === "sol" ? -1 : 1, ta = T * 0.16;
      grp.style.transformOrigin = `${g.cx}px ${g.bot}px`;
      AN(grp, [{ transform: "none" }, { transform: "scale(1.05, .92)", offset: 0.45 }, { transform: "scale(.97, 1.05)", offset: 0.75 }, { transform: "none" }], { duration: ta * 1.6, easing: "ease-in-out", fill: "none" });
      const fly = (e, delay) => {
        const kf = M.open === "uc"
          ? [{ transform: "none", opacity: 1 }, { transform: `translate(${side * g.W * 0.03}px, ${-g.H * 0.28}px) rotate(${-side * 8}deg)`, offset: 0.3 }, { transform: `translate(${side * g.W * 0.16}px, ${-g.H * 1.3}px) rotate(${-side * 26}deg)`, opacity: 0 }]
          : [{ transform: "none", opacity: 1 }, { transform: `translate(${side * g.W * 0.06}px, ${-g.H * 0.26}px) rotate(${side * 14}deg)`, offset: 0.32 }, { transform: `translate(${side * g.W * 0.34}px, ${-g.H * 0.12}px) rotate(${side * 70}deg)`, offset: 0.66 }, { transform: `translate(${side * g.W * 0.5}px, ${g.H * 0.3}px) rotate(${side * 105}deg)`, opacity: 0 }];
        AN(e.__in, kf, { duration: T * 0.62, delay, easing: M.open === "uc" ? "cubic-bezier(.3,.5,.6,1)" : "cubic-bezier(.35,.2,.55,1)" });
      };
      later(() => {
        if (lid) { fly(lid, 0); if (bow) fly(bow, 25); }
        else {   // kapak ayrı değilse kutu bütün hâlde sarsılır ve ışıkla açılır (görünmeyen iç kısım uydurulmaz)
          if (bow) fly(bow, 0);
          AN(box.__in, [{ transform: "none", opacity: 1 }, { transform: "rotate(-5deg)", offset: 0.2 }, { transform: "rotate(5deg)", offset: 0.4 }, { transform: "rotate(-3deg) scale(1.04)", offset: 0.6 }, { transform: "scale(1.1)", opacity: 0.9, offset: 0.8 }, { transform: "scale(1.25)", opacity: 0 }], { duration: T * 0.6, easing: "ease-in-out" });
        }
        if (glow) {
          Object.assign(glow.style, { left: g.cx + "px", top: (g.top + g.bh * 0.08) + "px", width: g.bw * 1.6 + "px" });
          AN(glow, [{ opacity: 0, transform: "translate(-50%,-50%) scale(.3)" }, { opacity: 1, transform: "translate(-50%,-55%) scale(1.15)", offset: 0.4 }, { opacity: 0.75, transform: "translate(-50%,-55%) scale(1)" }], { duration: T * 0.7, easing: "ease-out" });
        }
        if (g.top > g.H * 0.3 && lid) rs.style.bottom = Math.max(0, g.H - g.top - g.bh * 0.1) + "px";   // sürpriz kutunun ağzından yükselir
        later(() => reveal2(root, s), T * (root.__prof ? 0.36 : 0.3));
        if (M.boxEnd === "kaybol" && lid) later(() => AN(box, [{ opacity: 1 }, { opacity: 0 }], { duration: T * 0.4 }), T * 0.45);
      }, ta);
    }
    root.__ixPlay = open;
    if (M.trigger === "kaydir") onSwipe(root, swipeUp, open, "pan-x"); else root.addEventListener("click", open);
  }

  /* ----------------------------- Konfeti: düğme basılır, kendi konfeti parçalarınız fışkırır ----------------------------- */
  function konfeti2(root, s, live) {
    const M = motionOf(s, "konfeti"), T = msOf(M), st = stage2(root, s), BP = partOf(s, "button");
    const btn = el("button", "ix2-p ix2-cbtn"); btn.type = "button"; btn.dataset.ixp = "button"; placePart(btn, BP); btn.setAttribute("aria-label", s.title || "Kutlayalım!");
    const inn = el("div", "ix2-in"); inn.appendChild(pic(BP.ref)); btn.appendChild(inn); st.appendChild(btn);
    const res = resultEl(s); res.classList.add("ix-after"); st.appendChild(res);
    if (!live) return;
    const sprites = [];
    ["piece", "piece2", "piece3"].forEach(k => { const P = partOf(s, k); if (P) loadImg(P.ref).then(i => { if (i) sprites.push(i.img); }); });
    function fire() {
      AN(inn, [{ transform: "none" }, { transform: "scale(.86, .9) translateY(5%)", offset: 0.25 }, { transform: "scale(1.07) translateY(-4%)", offset: 0.6 }, { transform: "none" }], { duration: 420, easing: "ease-out", fill: "none" });
      const H = root.offsetHeight || 220, W = root.offsetWidth || 300, bh = btn.offsetHeight;
      const type = !s.effect || s.effect === "yok" ? "konfeti" : s.effect;
      later(() => confetti(root, { mode: M.shot, type, x: BP.x / 100 * W, y: BP.y / 100 * H - bh * 0.3, dir: clampN(M.dir, -80, 80, 0), spread: clampN(M.spread, 10, 180, 70), count: Math.round(80 * clampN(M.amount, 0.25, 3, 1)), life: T / 1000, imgs: sprites }), 90);
      root.classList.add("is-done");
    }
    btn.addEventListener("click", e => { e.stopPropagation(); fire(); });
    root.__ixPlay = fire;
  }

  /* ----------------------------- Fotoğraf çevir: kart havaya kalkarak döner, arkasında sürpriz ----------------------------- */
  function foto2(root, s, live) {
    const M = motionOf(s, "foto-cevir"), T = msOf(M), st = stage2(root, s), FP = partOf(s, "front"), RP = partOf(s, "rear");
    const ax = M.axis === "x" ? "rotateX" : "rotateY", mir = M.axis === "x" ? "scaleY(-1)" : "scaleX(-1)";
    const wrap = el("div", "ix2-p ix2-photo"); placePart(wrap, FP); wrap.dataset.ixp = "front"; wrap.style.zIndex = 3;
    const sh = el("i", "ix2-cshadow"); wrap.appendChild(sh);
    const card = el("div", "ix2-in ix2-card"), fr = el("div", "ix2-cface"); fr.appendChild(pic(FP.ref));
    const bk = el("div", "ix2-cface ix2-cback"); bk.style.transform = ax + "(180deg)";
    // arka yüz, ön yüzün aynalanmış şeklini taşır (gerçek kartın arkası gibi); içerik düz okunur
    const mk = el("div", "ix2-cmask"); mk.style.transform = mir;
    const ct = el("div", "ix2-cct" + (RP ? "" : " is-paper")); ct.style.transform = mir;
    if (RP) ct.appendChild(pic(RP.ref, "ix2-rear"));
    ct.appendChild(resultEl(s)); mk.appendChild(ct); bk.appendChild(mk);
    card.appendChild(fr); card.appendChild(bk); wrap.appendChild(card); st.appendChild(wrap);
    loadImg(FP.ref).then(i => maskBy(mk, i));
    if (M.trigger === "kaydir") root.__ixHint = "Çevirmek için kaydırın";
    if (!live) return;
    let ang = 0, busy = false, first = true;
    function flip(sg) {
      if (busy || (!first && M.again === false)) return;
      busy = true; sg = sg === 1 || sg === -1 ? sg : (Number(M.dir) < 0 ? -1 : 1);
      const to = ang + 180 * sg, lift = M.lift !== false;
      AN(card, [{ transform: `perspective(1000px) ${ax}(${ang}deg)` }, { transform: `perspective(1000px) ${lift ? "translateZ(60px) " : ""}${ax}(${ang + 90 * sg}deg)${lift ? " scale(1.04)" : ""}`, offset: 0.5 }, { transform: `perspective(1000px) ${ax}(${to}deg)` }], { duration: T, easing: "cubic-bezier(.45,.05,.35,1)" });
      if (lift) AN(sh, [{ opacity: 1, transform: "scale(1)" }, { opacity: 0.45, transform: "scale(.8) translateY(14%)", offset: 0.5 }, { opacity: 1, transform: "scale(1)" }], { duration: T, fill: "none" });
      ang = to; later(() => { busy = false; }, T);
      if (first) { first = false; later(() => reveal2(root, s), T * 0.5); }
    }
    root.__ixPlay = () => flip();
    if (M.trigger === "kaydir") {
      if (M.axis === "x") onSwipe(root, (dx, dy) => (Math.abs(dy) > 32 && Math.abs(dy) > Math.abs(dx) ? (dy < 0 ? 1 : -1) : 0), flip, "pan-x");
      else onSwipe(root, (dx, dy) => (Math.abs(dx) > 32 && Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : -1) : 0), flip, "pan-y");
    } else root.addEventListener("click", () => flip());
  }

  /* ----------------------------- Dilek feneri: ısınıp hafifçe çöker, salınarak yükselip uzaklaşır ----------------------------- */
  function dilek2(root, s, live) {
    const M = motionOf(s, "dilek"), T = msOf(M), st = stage2(root, s), LP = partOf(s, "lantern");
    st.appendChild(resultEl(s));
    function make(p, key) { const w = piece("ix2-lan", p, key, 3); if (M.glow !== false) { const g = el("i", "ix2-lglow"); w.__in.insertBefore(g, w.__img); w.__g = g; } return w; }
    function idle(w) {
      if (!live || reduced()) return;
      w.__bob = AN(w.__in, [{ transform: "translateY(0)" }, { transform: "translateY(-4%)" }], { duration: 2600, direction: "alternate", iterations: Infinity, easing: "ease-in-out", fill: "none" });
      if (w.__g) AN(w.__g, [{ opacity: 0.75, transform: "translate(-50%,-50%) scale(.96)" }, { opacity: 1, transform: "translate(-50%,-50%) scale(1.05)" }, { opacity: 0.85, transform: "translate(-50%,-50%) scale(1)" }], { duration: 900, direction: "alternate", iterations: Infinity, easing: "ease-in-out", fill: "none" });
    }
    let lan = make(LP, "lantern"); st.appendChild(lan); idle(lan);
    let btn = null;
    if (M.trigger === "dugme") { btn = el("button", "ix-btn ix-btn-soft ix2-dl-btn", { background: s.color }, esc(M.btnText || "🏮 Dileğimi bırak")); btn.type = "button"; root.appendChild(btn); }
    else { root.__ixKey = true; root.__ixHint = M.trigger === "kaydir" ? "Feneri bırakmak için yukarı kaydırın" : "Feneri bırakmak için dokunun"; }
    if (!live) return;
    let first = true, busy = false;
    function fly(w, delay) {
      if (w.__bob) w.__bob.cancel();
      const H = root.offsetHeight || 220, W = root.offsetWidth || 300, rise = H * clampN(M.height, 30, 400, 150) / 100;
      const drift = W * clampN(M.wind, -100, 100, 15) / 100 * (M.path === "ruzgar" ? 1.6 : M.path === "duz" ? 0.3 : 1);
      AN(w.__in, [{ transform: "translate(0,0) scale(1)", opacity: 1 }, { transform: `translate(0, ${H * 0.025}px) scale(1.02)`, offset: 0.05 }, { transform: `translate(${drift * 0.1}px, ${-rise * 0.14}px) scale(.95)`, offset: 0.2 },
        { transform: `translate(${drift * 0.5}px, ${-rise * 0.55}px) scale(.7)`, offset: 0.6 }, { transform: `translate(${drift * 0.8}px, ${-rise * 0.85}px) scale(.52)`, opacity: 0.85, offset: 0.85 }, { transform: `translate(${drift}px, ${-rise}px) scale(.42)`, opacity: 0 }],
        { duration: T, delay, easing: "cubic-bezier(.4,.1,.6,1)" });
      if (M.path !== "duz") AN(w.__img, [{ transform: "translateX(-4%) rotate(-4deg)" }, { transform: "translateX(4%) rotate(4deg)" }], { duration: 1500, delay, direction: "alternate", iterations: Infinity, easing: "ease-in-out", fill: "none" });
      if (w.__g) AN(w.__g, [{ opacity: 0.9, transform: "translate(-50%,-50%) scale(1)" }, { opacity: 1, transform: "translate(-50%,-50%) scale(1.3)", offset: 0.08 }, { opacity: 0.9, transform: "translate(-50%,-50%) scale(1.1)" }], { duration: T, delay });
      later(() => w.remove(), T + delay + 80);
    }
    function release() {
      if (busy || !lan || (!first && M.again === false)) return;
      busy = true; const w = lan; lan = null; fly(w, 0);
      const cnt = Math.round(clampN(M.count, 1, 6, 1));
      for (let k = 1; k < cnt; k++) {
        const R = Math.random, c = make(Object.assign({}, LP, { x: LP.x + (R() * 2 - 1) * 22, y: LP.y + R() * 8, w: LP.w * (0.6 + R() * 0.3) }), null);
        c.style.opacity = "0"; st.appendChild(c); AN(c, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: k * 420 - 300 }); fly(c, k * 420);
      }
      if (first) { first = false; later(() => reveal2(root, s), Math.min(T * 0.3, 2200)); }
      if (M.again !== false) later(() => {   // yeni fener yerine süzülerek gelir
        const w2 = make(LP, "lantern"); st.appendChild(w2);
        AN(w2.__in, [{ opacity: 0, transform: "translateY(12%)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 900, easing: "ease-out", fill: "none" });
        idle(w2); lan = w2; busy = false;
      }, Math.min(T * 0.6, 3500));
      else if (btn) btn.disabled = true;
    }
    root.__ixPlay = release;
    if (btn) btn.addEventListener("click", e => { e.stopPropagation(); release(); });
    else if (M.trigger === "kaydir") onSwipe(root, swipeUp, release, "pan-x");
    else root.addEventListener("click", release);
  }

  /* ----------------------------- Mum: alevler titrer, üflenince eğilip söner, fitilden duman kıvrılır ----------------------------- */
  function mum2(root, s, live) {
    const M = motionOf(s, "mum"), T = msOf(M), st = stage2(root, s), CK = partOf(s, "cake"), FLP = partOf(s, "flame");
    st.appendChild(piece("ix2-cake", CK, "cake", 2));
    const pts = (Array.isArray(M.flames) && M.flames.length ? M.flames : FLAME_DEFAULTS).slice(0, 12);
    const flames = pts.map((p, i) => {
      const w = el("div", "ix2-p ix2-fl"); placePart(w, Object.assign({ rot: 0 }, p, FLP ? { nw: FLP.nw, nh: FLP.nh } : { nw: 5, nh: 9 })); w.dataset.ixp = "f" + i; w.style.zIndex = 4;
      const halo = el("i", "ix2-halo"), lean = el("div", "ix2-lean"), fin = el("div", "ix2-fl-in");
      if (FLP) fin.appendChild(pic(FLP.ref)); else fin.innerHTML = '<i class="ix2-fl-o"></i><i class="ix2-fl-c"></i>';
      lean.appendChild(fin); w.appendChild(halo); w.appendChild(lean); st.appendChild(w);
      const f = { w, halo, lean, fin, on: true };
      if (live && !reduced() && root.__prof && global.SeozMotion) {
        // ✨ alev: küçük, düzensiz ama akıcı titreme (sert sıçrama yok, döngü dikişsiz); hale alevle birlikte nefes alır
        const M = global.SeozMotion, ph = M.phase("f" + i + (p.x || 0)), d = 1100 + ph * 600;
        f.fl = AN(fin, M.flickerKF("fl" + i + "-" + (p.x || 0), root.__prof.energy), { duration: d, delay: -ph * d, iterations: Infinity, easing: "linear", fill: "none" });
        f.hl = AN(halo, [{ opacity: 0.82, easing: M.CURVES.sinus }, { opacity: 1, offset: 0.45, easing: M.CURVES.sinus }, { opacity: 0.86, offset: 0.7, easing: M.CURVES.sinus }, { opacity: 0.82 }], { duration: d * 1.3, delay: -ph * d, iterations: Infinity, easing: "linear", fill: "none" });
      } else if (live && !reduced()) {   // her alev kendi düzensiz ritmiyle titrer
        const R = Math.random, kf = [];
        for (let j = 0; j < 6; j++) kf.push({ transform: `scale(${(0.95 + R() * 0.08).toFixed(3)}, ${(0.9 + R() * 0.2).toFixed(3)}) skewX(${((R() - 0.5) * 7).toFixed(2)}deg)` });
        f.fl = AN(fin, kf, { duration: 900 + R() * 500, direction: "alternate", iterations: Infinity, easing: "ease-in-out", fill: "none" });
        f.hl = AN(halo, [{ opacity: 0.85 }, { opacity: 1 }, { opacity: 0.8 }], { duration: 700 + R() * 400, direction: "alternate", iterations: Infinity, fill: "none" });
      }
      return f;
    });
    const res = resultEl(s); res.classList.add("ix2-mum-res"); st.appendChild(res);
    if (M.trigger === "kaydir") root.__ixHint = "Mumları üflemek için parmağınızı kaydırın";
    else if (M.trigger === "dokun") root.__ixHint = "Mumları söndürmek için dokunun";
    if (!live) return;
    let done = false, leanA = [];
    const ring = M.trigger === "basili" ? el("div", "ix2-ring", null, "<i></i>") : null; if (ring) st.appendChild(ring);
    function leanOn(str) {
      leanA.forEach(a => a && a.cancel());
      leanA = flames.filter(f => f.on).map(f => AN(f.lean, [{ transform: "skewX(0deg) scaleY(1)" }, { transform: `skewX(${-16 * str}deg) scaleY(${1 - 0.2 * str})` }, { transform: `skewX(${-9 * str}deg) scaleY(${1 - 0.1 * str})` }], { duration: 260, direction: "alternate", iterations: Infinity, easing: "ease-in-out", fill: "none" }));
    }
    function leanOff() { leanA.forEach(a => a && a.cancel()); leanA = []; }
    function snuff(f, nat) {
      f.on = false;
      if (nat) {
        // titremeyi kesmeden önce alevi bulunduğu hâlden söndür (sıçrama yok)
        const cur = getComputedStyle(f.fin).transform; if (f.fl) f.fl.cancel(); if (f.hl) f.hl.cancel();
        const c0 = cur && cur !== "none" ? cur : "none";
        AN(f.fin, [{ opacity: 1, transform: c0, easing: "cubic-bezier(.37,0,.63,1)" }, { opacity: 0.9, transform: "skewX(-26deg) scale(.92, .7)", offset: 0.4, easing: "cubic-bezier(.55,.085,.68,.53)" }, { opacity: 0, transform: "skewX(-32deg) scale(.35, .12)" }], { duration: 260 });
      } else { if (f.fl) f.fl.cancel(); if (f.hl) f.hl.cancel(); }
      if (!nat) AN(f.fin, [{ opacity: 1, transform: "none" }, { opacity: 0.8, transform: "skewX(-24deg) scale(.9, .6)", offset: 0.45 }, { opacity: 0, transform: "skewX(-30deg) scale(.4, .15)" }], { duration: 240, easing: "ease-in" });
      AN(f.halo, [{ opacity: 1 }, { opacity: 0 }], { duration: 450, easing: "ease-out" });
      const em = el("i", "ix2-ember"); f.w.appendChild(em); AN(em, [{ opacity: 1 }, { opacity: 0.7, offset: 0.3 }, { opacity: 0 }], { duration: 1100 });
      if (M.smoke === false || reduced()) return;
      const h = f.w.offsetHeight || 30, s0 = nat ? 150 : 0;   // doğal: duman alev tam söndüğü anda başlar
      for (let k = 0; k < 7; k++) {   // fitilden yükselen, genişleyip dağılan ince duman
        const p = el("i", "ix2-smoke"); f.w.appendChild(p);
        const R = Math.random, a = (R() - 0.5) * h * 0.6, b = (R() - 0.5) * h * 1.2;
        const an = AN(p, [{ transform: "translate(0,0) scale(.4)", opacity: 0 }, { transform: `translate(${a * 0.3}px, ${-h * 0.3}px) scale(.7)`, opacity: 0.6, offset: 0.12 }, { transform: `translate(${a}px, ${-h * 1.6}px) scale(1.5)`, opacity: 0.35, offset: 0.5 }, { transform: `translate(${b}px, ${-h * 3.2}px) scale(2.8)`, opacity: 0 }],
          { duration: T * (1 + R() * 0.4), delay: s0 + k * 110, easing: "cubic-bezier(.25,.5,.4,1)", fill: "both" });
        if (an) an.onfinish = () => p.remove();
      }
    }
    function out() {
      if (done) return; done = true; if (ring) ring.classList.remove("is-on");
      const seq = M.order !== "birlikte";
      if (root.__prof) {
        // ✨ üfleme bir yandan öbür yana ilerler: alevler soldan sağa sırayla, önce eğilip sonra söner; duman
        // tam sönme anında yükselir; kutlama son alevin dumanı yükselmeye başladıktan sonra gelir
        const order = flames.map((f, i) => ({ f, x: Number((pts[i] || {}).x) || 0, i })).sort((a, b) => a.x - b.x);
        const gap = seq ? Math.round(150 * root.__prof.tempo) : 0;
        order.forEach((o, k) => later(() => snuff(o.f, true), seq ? k * gap : (o.i * 37) % 70));
        later(() => leanOff(), (seq ? (order.length - 1) * gap : 70) + 200);
        later(() => reveal2(root, s), (seq ? (order.length - 1) * gap : 70) + 260 + Math.min(700, T * 0.3));
        return;
      }
      leanOff();
      flames.forEach((f, i) => later(() => snuff(f), seq ? i * 160 : Math.random() * 60));
      later(() => reveal2(root, s), (seq ? flames.length * 160 : 60) + T * 0.35);
    }
    if (M.trigger === "basili") {
      const hold = clampN(M.hold, 0.3, 6, 1.3) * 1000; let tm = 0, raf = 0, t0 = 0;
      const stop = () => { clearTimeout(tm); cancelAnimationFrame(raf); if (!done) { leanOff(); ring.classList.remove("is-on"); ring.style.setProperty("--p", "0"); } };
      const prog = now => { if (!t0) t0 = now; ring.style.setProperty("--p", String(Math.min(1, (now - t0) / hold))); raf = requestAnimationFrame(prog); };
      root.addEventListener("pointerdown", e => { if (done) return; e.preventDefault(); t0 = 0; ring.classList.add("is-on"); leanOn(1); raf = requestAnimationFrame(prog); tm = setTimeout(() => { cancelAnimationFrame(raf); out(); }, hold); });
      ["pointerup", "pointercancel", "pointerleave"].forEach(ev => root.addEventListener(ev, stop));
      root.addEventListener("contextmenu", e => e.preventDefault()); root.style.touchAction = "none";
    } else if (M.trigger === "kaydir") onSwipe(root, (dx, dy) => (Math.hypot(dx, dy) > 40 ? 1 : 0), () => { if (done) return; leanOn(1.2); later(out, 300); }, "none");
    else root.addEventListener("click", () => { if (done) return; leanOn(1); later(out, 280); });
    root.__ixPlay = () => { if (done) return; leanOn(1); later(out, 600); };
  }

  /* ----------------------------- Kapı çal: tokmak vurur, kapı sarsılır; kanatlar menteşeden açılır, içeriden ışık ----------------------------- */
  function kapi2(root, s, live) {
    const M = motionOf(s, "kapi-cal"), T = msOf(M), st = stage2(root, s);
    const LP = partOf(s, "left"), RP = M.mode === "tek" ? null : partOf(s, "right"), KP = partOf(s, "knocker"), FP = partOf(s, "frame");
    const lightP = RP ? { x: (LP.x + RP.x) / 2, y: (LP.y + RP.y) / 2, w: Math.abs(RP.x - LP.x) + (LP.w + RP.w) / 2, rot: 0, nw: (LP.nw || 1) * 2, nh: LP.nh || 1 } : LP;
    let light = null; if (M.light !== false) { light = el("div", "ix2-p ix2-dlight"); placePart(light, lightP); st.appendChild(light); }
    st.appendChild(resultEl(s));
    const grp = el("div", "ix2-dgrp"); st.appendChild(grp);
    const leaves = [];
    function leaf(parent, ref, side, split) {   // side: menteşenin olduğu kenar
      const lf = el("div", "ix2-leaf h-" + side + (split ? " is-split" : ""));
      Object.assign(lf.style, split ? (side === "l" ? { left: "0", width: "50%" } : { left: "50%", width: "50%" }) : { left: "0", width: "100%" });
      const im = pic(ref); lf.appendChild(im); parent.appendChild(lf); leaves.push({ el: lf, img: im, side });
    }
    const door = (P, key) => { const w = el("div", "ix2-p ix2-door"); placePart(w, P); w.dataset.ixp = key; grp.appendChild(w); return w; };
    if (M.mode === "tek") leaf(door(LP, "left"), LP.ref, M.hinge === "sag" ? "r" : "l", false);
    else if (RP) { leaf(door(LP, "left"), LP.ref, "l", false); leaf(door(RP, "right"), RP.ref, "r", false); }
    else { const w = door(LP, "left"); leaf(w, LP.ref, "l", true); leaf(w, LP.ref, "r", true); }   // tek görsel ortadan ikiye
    const knocker = KP ? piece("ix2-knocker", KP, "knocker", 5) : null; if (knocker) grp.appendChild(knocker);
    if (FP) st.appendChild(piece("ix2-dframe", FP, "frame", 6));
    const N = Math.round(clampN(M.knocks, 1, 6, 3)), dots = el("div", "ix-knocks", null, "<i></i>".repeat(N)); root.appendChild(dots);
    if (N !== 3) root.__ixHint = `Kapıyı ${N} kez çalın`;
    root.__ixKey = true;
    if (!live) return;
    let n = 0, opened = false;
    function attachKnocker() {   // tokmak bulunduğu kanada takılır ve onunla birlikte döner
      const kr = knocker.getBoundingClientRect(), cx = kr.left + kr.width / 2, cy = kr.top + kr.height / 2;
      const L = leaves.find(L => { const r = L.el.getBoundingClientRect(); return cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom; });
      if (!L) { AN(knocker, [{ opacity: 1 }, { opacity: 0 }], { duration: 300 }); return; }
      const r = L.el.getBoundingClientRect();
      Object.assign(knocker.style, { left: ((cx - r.left) / r.width * 100) + "%", top: ((cy - r.top) / r.height * 100) + "%", width: (knocker.offsetWidth / (L.el.offsetWidth || 1) * 100) + "%", zIndex: "2" });
      L.el.appendChild(knocker);
    }
    function open() {
      if (opened) return; opened = true;
      const ang = clampN(M.angle, 20, 88, 80), inward = M.dir !== "disari";
      if (knocker) attachKnocker();
      leaves.forEach((L, i) => {
        const sg = (L.side === "l" ? 1 : -1) * (inward ? 1 : -1);
        if (root.__prof && global.SeozMotion) {
          // ✨ kanat önce kilitten kurtulur (küçük geri itiş), ağırlığıyla açılır, hedefi az geçip yerine oturur
          const kf = global.SeozMotion.settleKF(v => `rotateY(${v.toFixed(2)}deg)`, 0, sg * ang, root.__prof.settle, 2);
          kf.splice(1, 0, { transform: `rotateY(${(sg * 3).toFixed(2)}deg)`, offset: 0.08, easing: "cubic-bezier(.45,.05,.25,1)" });
          kf[0].easing = "cubic-bezier(.37,0,.63,1)";
          AN(L.el, kf, { duration: T * 1.15, delay: i * 70, easing: "linear" });
        } else
        AN(L.el, [{ transform: "rotateY(0deg)" }, { transform: `rotateY(${sg * 3}deg)`, offset: 0.1 }, { transform: `rotateY(${sg * ang}deg)` }], { duration: T, delay: i * 70, easing: "cubic-bezier(.35,.1,.25,1)" });
        AN(L.img, [{ filter: "brightness(1)" }, { filter: `brightness(${inward ? 0.62 : 0.85})` }], { duration: T, delay: i * 70 });
      });
      if (light) AN(light, [{ opacity: 0 }, { opacity: 1 }], { duration: T * 0.7, delay: T * 0.08, easing: "ease-out" });
      later(() => reveal2(root, s), T * (root.__prof ? 0.55 : 0.45));
    }
    function knockOnce() {
      if (opened || n >= N) return; n++;
      if (M.sound !== false) knock();
      AN(grp, [{ transform: "none" }, { transform: "translateX(-1.5px) rotate(-.3deg)", offset: 0.3 }, { transform: "translateX(1.5px) rotate(.3deg)", offset: 0.6 }, { transform: "none" }], { duration: 260, fill: "none" });
      if (knocker) AN(knocker.__in, [{ transform: "perspective(300px) rotateX(0deg)" }, { transform: "perspective(300px) rotateX(36deg)", offset: 0.35 }, { transform: "perspective(300px) rotateX(-5deg)", offset: 0.7 }, { transform: "perspective(300px) rotateX(0deg)" }], { duration: 300, easing: "ease-out", fill: "none" });
      const d = dots.children[n - 1]; if (d) d.classList.add("is-on");
      if (n >= N) later(open, 420);
    }
    root.addEventListener("click", knockOnce);
    root.__ixPlay = () => { for (let k = n; k < N; k++) later(knockOnce, (k - n) * 340); };
  }
  const BUILD2 = { "kazi-kazan": kazi2, zarf: zarf2, balon: balon2, hediye: hediye2, konfeti: konfeti2, "foto-cevir": foto2, dilek: dilek2, mum: mum2, "kapi-cal": kapi2 };

  function burstSmall(b, color) {
    for (let i = 0; i < 10; i++) {
      const d = el("i", "ix-shard"); d.style.background = color || "#F49AB0";
      const a = (i / 10) * Math.PI * 2; d.style.setProperty("--x", Math.cos(a) * 40 + "px"); d.style.setProperty("--y", Math.sin(a) * 40 + "px");
      b.appendChild(d);
    }
  }

  function render(settings, mode, o3) {
    const s = Object.assign({}, DEFAULTS, settings);
    const kind = BUILD[s.kind] ? s.kind : "kazi-kazan";
    const live = mode === "view";
    const root = el("div", "ix ix-" + kind);
    // ✨ Sahne uyumu: belgede açıksa etkileşim aynı hareket diliyle (karakteriyle) oynar; yoksa eskisi gibi
    const mo = o3 && "motion" in o3 ? o3.motion : (global.SeozRenderer && SeozRenderer.motion ? SeozRenderer.motion() : null);
    root.__prof = mo && global.SeozMotion ? global.SeozMotion.of({ motion: mo }) : null;
    if (root.__prof) root.classList.add("ix-nat");
    root.style.setProperty("--ix-c", s.color); root.style.setProperty("--ix-ink", s.textColor);
    try {
      // E2: türün ana parçası yüklenmişse kendi görselleriyle çalışan yeni çizim; yoksa eski hazır çizim (aynen)
      if (kind !== "kurdele" && BUILD2[kind] && hasMain(s, kind)) BUILD2[kind](root, s, live);
      else BUILD[kind](root, s, live);
    } catch (e) { console.error("[Studio SEOZ] Etkileşim hatası:", e); }
    const hint = el("div", "ix-hint", null, esc(s.title || root.__ixHint || HINT[kind]));
    if (kind !== "konfeti") root.appendChild(hint);
    // klavye: Enter / Boşluk ile aynı sonuç (kazı-kazan ve mum için kısayol)
    if (live && (["konfeti", "dilek", "balon"].indexOf(kind) < 0 || root.__ixKey)) {
      root.tabIndex = 0; root.setAttribute("role", "button"); root.setAttribute("aria-label", s.title || HINT[kind]);
      root.addEventListener("keydown", e => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        if (root.__ixPlay) return root.__ixPlay();
        if (root.classList.contains("is-done")) return;
        if (kind === "kazi-kazan") { const cv = root.querySelector(".ix-scratch"); if (cv) cv.classList.add("is-gone"); reveal(root, s); }
        else if (kind === "mum") { const c = root.querySelector(".ix-cake"); if (c) c.classList.add("is-out"); setTimeout(() => reveal(root, s), 400); }
        else if (kind === "kapi-cal") { for (let i = 0; i < 3; i++) setTimeout(() => root.click(), i * 260); }
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
  global.SeozInteractive = { KINDS, HINT, DEFAULTS, STUDIO_KINDS, CUT_DEFAULTS, PART_DEFAULTS, PART_DEFS, MOTION_DEFAULTS, MAIN_PART, FLAME_DEFAULTS,
    partDefault, balloonDefault, placePart, render };
})(window);
