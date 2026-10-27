/* =============================================================================
   STUDIO SEOZ — editor/theme-studio.js  (İÇ ZEMİN TASARIM STÜDYOSU · editör ekranı)
   -----------------------------------------------------------------------------
   Tam ekran çalışma alanı: kategori paketi seçimi (canlı önizlemeli), tasarım
   dili, animasyonlu zemin katmanları, bölüm zeminleri, parçacık ve ışık,
   yerleşim şablonları ve kaydırınca canlanma.

   Ayarlar belgenin `theme` alanına ve katmanların `present`/`reveal`
   alanlarına yazılır. Canlı önizleme müşteri sayfasıyla AYNI kodu (renderer,
   theme-core) "view" kipinde çalıştırır: burada görülen, müşteride görülendir.
   Paket uygulamadan önce belgenin bir kopyası saklanır; "Geri al" tek adımda
   önceki hâle döndürür (editörün kendi Geri Al'ı da çalışır).
   ========================================================================= */
(function (global) {
  "use strict";

  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clone = o => JSON.parse(JSON.stringify(o));
  const num = (v, d) => { v = Number(v); return isFinite(v) ? v : d; };
  const uid = p => p + Math.random().toString(36).slice(2, 9);
  const UNDO_KEY = id => "seoz_theme_undo_" + id;

  /* =============================== paket uygulama (saf işlevler) =============================== */
  function paletteFor(pack, vi) {
    const v = pack.variants[vi] || pack.variants[0];
    const p = Object.assign({}, pack.language.palette, v.palette || {});
    if (v.dark && !pack.language.dark) p.ink = "#F7EFE0";
    if (!v.dark && pack.language.dark) p.ink = "#2A2420";
    return p;
  }
  function themeFromPack(pack, vi, keepImage) {
    const v = pack.variants[vi] || pack.variants[0];
    const bg = clone(v.bg);
    (bg.layers || []).forEach(l => { l.id = uid("bl"); });
    if (keepImage) bg.base = null;
    return { v: 1, pack: pack.id, variant: vi, dark: !!v.dark, palette: paletteFor(pack, vi), fonts: clone(pack.language.fonts), radius: pack.language.radius, bg, kurgu: (pack.kurgu || []).slice() };
  }
  function modSettingsFor(pack, vi) {
    const v = pack.variants[vi] || pack.variants[0];
    if (!pack.modSettings) return {};
    return (pack.language.dark ? v.dark : true) ? pack.modSettings : {};
  }
  /* Metin katmanlarını tasarım diline uydurur: en büyük yazı başlık fontunu,
     diğerleri başlık/gövde fontunu ve mürekkep rengini alır. */
  function restyleTexts(doc, th) {
    const texts = doc.layers.filter(l => l.type === "text" && l.content);
    if (!texts.length) return 0;
    const maxSize = Math.max.apply(null, texts.map(l => num(l.content.fontSize, 20)));
    const f = th.fonts || {};
    texts.forEach(l => {
      const c = l.content, big = num(c.fontSize, 20) >= maxSize - 0.5;
      c.fontFamily = big ? (f.title || c.fontFamily) : (num(c.fontSize, 16) >= 19 ? (f.heading || f.title || c.fontFamily) : (f.body || c.fontFamily));
      if (!c.metallic || c.metallic === "none") c.color = th.palette.ink;
    });
    return texts.length;
  }
  function presentFor(pack, layer) {
    if (layer.type !== "module" || !pack.present) return null;
    const p = pack.present[layer.moduleId];
    return p && (p.frame || p.special || p.open) ? clone(p) : null;
  }
  /* Belirli modüllerin özel biçimleri için önerilen kutu boyutu (küçükse büyütülür) */
  function fitSpecial(layer, W) {
    const P = global.SeozThemePresent, sz = P && layer.present && layer.present.special && P.SIZE[layer.present.special];
    if (!sz) return;
    if (layer.w < sz.w || layer.h < sz.h) { layer.w = Math.max(layer.w, sz.w); layer.h = Math.max(layer.h, sz.h); }
    if (layer.x + layer.w > W) layer.x = Math.max(0, Math.round((W - layer.w) / 2));
  }
  /* Modül renklerini zemine ve çerçeveye uydurur: açık çerçeveli (bilet, kartpostal…)
     modüllerde koyu yazı, koyu çerçeve (ahşap tabela, ışıklı tabela) ya da koyu
     zeminde açık yazı; düğmeler vurgu rengini alır. Modülün işine dokunmaz. */
  const LIGHT_FRAMES = ["bilet", "kartpostal", "polaroid", "parsomen", "altin"], DARK_FRAMES = ["tabela", "isikli"];
  const PAGE_TEXT = ["appointment", "before-after", "feedback", "gift", "hours", "poll", "price-list", "social-media"];
  const BTN_BG = ["location", "rsvp", "calendar", "celebration", "guest-upload"];
  const BTN_COLOR = ["appointment", "attendance-form", "feedback", "gift", "poll", "social-media"];
  const OWN_SURFACE = ["kazi-kazan", "zarf", "foto-cevir", "mum", "kurdele", "kapi-cal"];
  function harmonizeModule(l, th) {
    if (l.type !== "module" || !l.settings) return;
    const s = l.settings, p = th.palette || {}, fr = l.present && l.present.frame;
    const darkCtx = DARK_FRAMES.includes(fr) || (!LIGHT_FRAMES.includes(fr) && !!th.dark);
    const txt = darkCtx ? "#F7EFE0" : (LIGHT_FRAMES.includes(fr) ? "#2A2420" : (p.ink || "#2A2420"));
    if (PAGE_TEXT.includes(l.moduleId) && "textColor" in s) s.textColor = txt;
    if ("accentColor" in s && l.moduleId !== "campaign") s.accentColor = p.accent || s.accentColor;
    if (BTN_BG.includes(l.moduleId)) { s.bgColor = p.accent2 && th.dark ? p.accent : (p.accent || s.bgColor); s.textColor = "#FFFFFF"; }
    if (BTN_COLOR.includes(l.moduleId) && "buttonColor" in s) s.buttonColor = p.accent || s.buttonColor;
    if (l.moduleId === "countdown") {
      s.textColor = txt;
      if (darkCtx) { s.boxColor = "#241C22"; s.boxBorderColor = p.accent || "#B8925A"; } else { s.boxColor = "#FFFFFF"; s.boxBorderColor = p.accent || "#DCD5C6"; }
    }
    if (l.moduleId === "qrcode") s.titleColor = txt;
    if (l.moduleId === "services") { s.textColor = darkCtx ? "#F7EFE0" : "#1E2A22"; s.cardColor = darkCtx ? "#2B2326" : "#FFFFFF"; }
    if (l.moduleId === "music") s.noteColor = p.accent || s.noteColor;
    if (l.moduleId === "interactive") { s.color = s.color || p.accent; s.textColor = OWN_SURFACE.includes(s.kind) ? "#3A2E28" : txt; }
  }
  function applyModSettings(doc, pack, vi) {
    const ms = modSettingsFor(pack, vi);
    doc.layers.forEach(l => { harmonizeModule(l, doc.theme); if (l.type === "module" && ms[l.moduleId]) Object.assign(l.settings, clone(ms[l.moduleId])); });
  }

  /* Var olan katmanları şablonun bölümlerine göre alt alta dizer. İçerik
     (yazılar, modül ayarları, görseller) hiç değişmez; yalnızca konum. */
  function layoutExisting(doc, tpl, measure) {
    const W = doc.canvas.baseWidth || 430;
    const items = doc.layers.slice().sort((a, b) => (a.y - b.y) || (a.x - b.x));
    const secOf = {}; tpl.sections.forEach((s, i) => (s.modules || []).forEach(m => { if (secOf[m] == null) secOf[m] = i; }));
    const buckets = tpl.sections.map(() => []);
    const firstMod = items.findIndex(l => l.type === "module"), lastMod = items.length - 1 - items.slice().reverse().findIndex(l => l.type === "module");
    const closing = tpl.sections.length - 1;
    let pending = [];                    // yazı/görseller bir sonraki modülün bölümüne katılır
    items.forEach((l, i) => {
      if (l.type === "module") {
        const si = secOf[l.moduleId] != null ? secOf[l.moduleId] : Math.max(1, closing - 1);
        buckets[si].push(...pending, l); pending = [];
      } else if (firstMod < 0 || i < firstMod) buckets[0].push(l);
      else if (i > lastMod) buckets[closing].push(l);
      else pending.push(l);
    });
    if (pending.length) buckets[closing].unshift(...pending);
    let y = 70;
    buckets.forEach((b, si) => {
      if (!b.length) return;
      b.forEach((l, k) => {
        const h = Math.max(20, num(measure ? measure(l) : null, l.h || 40));
        l.x = Math.max(0, Math.round((W - num(l.w, 200)) / 2));
        l.y = Math.round(y);
        if (l.desktopOverride) l.desktopOverride = { enabled: false, x: null, y: null, w: null, h: null };
        y += h + (l.moduleId === "interactive" ? 30 : 0) + (k < b.length - 1 ? (l.type === "text" ? 14 : 22) : 0);
      });
      y += si === 0 ? 70 : 64;
    });
    return y;
  }

  /* Boş tasarım: paketin metinleri ve şablonun modülleriyle yeni katmanlar kurar. */
  function createFromTemplate(doc, pack, vi, tpl, opts) {
    const DM = global.SeozDocModel, R = global.SeozModuleRegistry, TS = global.SeozThemePacks.TEXT_STYLE, th = doc.theme;
    const W = doc.canvas.baseWidth || 430, out = [];
    let z = 1, y = 70;
    const ms = modSettingsFor(pack, vi);
    tpl.sections.forEach((sec, si) => {
      const before = y;
      (sec.texts || []).forEach(role => {
        const txt = pack.texts && pack.texts[role]; if (!txt) return;
        const st = TS[role] || TS.subtitle, w = st.w;
        const font = (th.fonts || {})[st.font] || (th.fonts || {}).body || "Manrope";
        const l = DM.createTextLayer({ z: z++, x: Math.round((W - w) / 2), y: Math.round(y), w, content: { text: txt, fontFamily: font, fontSize: st.size, color: st.accent ? th.palette.accent2 : th.palette.ink, italic: !!st.italic, letterSpacing: st.spacing || 0, align: "center" } });
        l.reveal = { type: role === "title" ? "yakinlas" : "yukari", delay: 0, duration: 1 };
        // metin kutusu yüksekliği içeriğe göre büyür: satır sayısı yaklaşık hesaplanır
        const lines = Math.max(1, Math.ceil(String(txt).length * st.size * 0.5 / w));
        out.push(l); y += Math.max(st.h, Math.round(lines * st.size * 1.32)) + 12;
      });
      (sec.modules || []).forEach(mid => {
        if (tpl.create.indexOf(mid) < 0) return;
        if (mid === "interactive" && (!pack.interactive || opts.noInteractive)) return;
        const def = R && R.getModule(mid); if (!def) return;
        const size = def.defaultLayerSize || { w: 240, h: 120 };
        const l = DM.createModuleLayer(mid, def.defaultSettings, { z: z++, x: Math.round((W - size.w) / 2), y: Math.round(y), w: size.w, h: size.h });
        if (ms[mid]) Object.assign(l.settings, clone(ms[mid]));
        if (mid === "interactive") Object.assign(l.settings, clone(pack.interactive), { color: pack.interactive.color || th.palette.accent, textColor: th.palette.ink, fontFamily: (th.fonts || {}).heading || "Cormorant Garamond" });
        if (mid === "location") l.settings.venueName = pack.group === "İşletme" ? (pack.texts.title || "İşletmemiz") : "Mekân Adı";
        if (mid === "countdown") {
          l.settings.title = pack.group === "İşletme" ? "Kampanyanın bitimine" : "Büyük güne"; if (!ms.countdown) l.settings.textColor = th.palette.ink;
          const d = new Date(Date.now() + 120 * 86400000); l.settings.targetDate = d.toISOString().slice(0, 10); l.settings.targetTime = "19:00";
        }
        const p = presentFor(pack, l); if (p) { l.present = p; fitSpecial(l, W); }
        if (mid === "music" && !(l.present && l.present.special)) { l.x = W - size.w - 18; l.y = 18; l.z = 50; out.push(l); return; }
        l.reveal = { type: "yukari", delay: 0, duration: 0.9 }; out.push(l); y += l.h + (def.autoHeight ? 40 : mid === "interactive" ? 46 : 26);
      });
      if (y > before) y += 46;
    });
    doc.layers = out;
    applyModSettings(doc, pack, vi);
    return out.length;
  }

  /* Paketi uygular. mode: "zemin" | "mevcut" | "bos" */
  function applyPack(doc, pack, vi, mode, opts) {
    opts = opts || {};
    const keepImage = !!opts.keepImage && doc.canvas.background && doc.canvas.background.type === "image";
    doc.theme = themeFromPack(pack, vi, keepImage);
    const v = pack.variants[vi] || pack.variants[0];
    if (!keepImage) doc.canvas.background = { type: "color", value: v.canvas || "#FBF8F2", scale: 100, heightPercent: 100, offsetX: 50, offsetY: 50 };
    const tpl = global.SeozThemePacks.TEMPLATES[pack.template];
    let info = { texts: 0, modules: 0 };
    if (mode === "bos") {
      info.layers = createFromTemplate(doc, pack, vi, tpl, opts);
    } else if (mode === "mevcut") {
      info.texts = restyleTexts(doc, doc.theme);
      doc.layers.forEach(l => {
        const p = presentFor(pack, l);
        if (p) { l.present = p; fitSpecial(l, doc.canvas.baseWidth || 430); info.modules++; }
        if (!l.reveal) l.reveal = { type: l.type === "text" ? "yukari" : "yukari", delay: 0, duration: 0.9 };
      });
      applyModSettings(doc, pack, vi);
      if (pack.interactive && !opts.noInteractive && !doc.layers.some(l => l.moduleId === "interactive")) {
        const def = global.SeozModuleRegistry.getModule("interactive");
        if (def) {
          const l = global.SeozDocModel.createModuleLayer("interactive", def.defaultSettings, { z: global.SeozDocModel.nextZ(doc), x: 65, y: 0, w: 300, h: 220 });
          Object.assign(l.settings, clone(pack.interactive), { color: pack.interactive.color || doc.theme.palette.accent, textColor: doc.theme.palette.ink });
          l.reveal = { type: "yukari", delay: 0, duration: 0.9 };
          doc.layers.push(l);
        }
      }
      if (opts.relayout !== false) layoutExisting(doc, tpl, opts.measure);
    }
    // açılışla uyum: renk ve konsept
    if (opts.syncOpening && doc.entry && doc.entry.cinema && doc.entry.cinema.v === 2) syncOpening(doc);
    return info;
  }
  function syncOpening(doc) {
    const c = doc.entry && doc.entry.cinema; if (!c || !doc.theme) return false;
    const p = doc.theme.palette || {};
    c.brand = Object.assign({ useColors: false, primary: "#7A1F2B", secondary: "#C9A45C", logo: "", text: "" }, c.brand || {}, { useColors: true, primary: p.accent2 || p.accent, secondary: p.accent || p.accent2 });
    const pk = doc.theme.pack && global.SeozThemePacks.pack(doc.theme.pack);
    if (pk && pk.concept) c.concept = pk.concept;
    return true;
  }

  /* =============================== ekran =============================== */
  function open(doc, cb) {
    cb = cb || {};
    const P = global.SeozThemePacks, T = global.SeozTheme, TP = global.SeozThemePresent, A = global.SeozThemeArt;
    const state = { tab: "paket", group: "Davet", pick: (doc.theme && doc.theme.pack) || null, variant: (doc.theme && doc.theme.variant) || 0, selBg: null,
      undo: null, opts: { keepImage: true, noInteractive: false, syncOpening: true } };
    try { state.undo = localStorage.getItem(UNDO_KEY(doc.id)); } catch (e) { /* önemsiz */ }

    const root = document.createElement("div");
    root.className = "ts-root"; root.setAttribute("role", "dialog"); root.setAttribute("aria-label", "İç Zemin Stüdyosu");
    root.innerHTML = `
      <header class="ts-head">
        <div class="ts-title"><span class="ts-logo">🎨</span><div><h2>İç Zemin Stüdyosu</h2><p data-ts-sub></p></div></div>
        <div class="ts-head-actions">
          <button type="button" class="btn btn-outline" data-ts-undo>↶ Paketi geri al</button>
          <button type="button" class="btn btn-primary" data-ts-close>Bitti</button>
        </div>
      </header>
      <div class="ts-body">
        <aside class="ts-left">
          <nav class="ts-tabs" role="tablist">
            ${[["paket", "Paketler"], ["dil", "Tasarım dili"], ["zemin", "Zemin"], ["bolum", "Bölüm · ışık · parçacık"], ["yerlesim", "Yerleşim · canlanma"]].map(([k, l]) => `<button type="button" role="tab" data-ts-tab="${k}">${l}</button>`).join("")}
          </nav>
          <div class="ts-panel" data-ts-panel></div>
        </aside>
        <main class="ts-center">
          <div class="ts-prev-head"><span>Canlı önizleme · müşteri sayfası</span><button type="button" class="btn btn-outline" data-ts-reload title="Animasyonları baştan oynat">↻ Yenile</button></div>
          <div class="ts-phone" data-ts-phone><div class="seoz-canvas-outer"><div class="seoz-canvas-scale-wrap" data-ts-wrap><div class="seoz-canvas" data-ts-canvas></div></div></div><div class="ts-sel" data-ts-sel hidden></div></div>
        </main>
      </div>`;
    document.body.appendChild(root);
    document.body.classList.add("cs-open");
    const $ = s => root.querySelector(s);
    const panel = $("[data-ts-panel]"), phone = $("[data-ts-phone]"), pCanvas = $("[data-ts-canvas]"), pWrap = $("[data-ts-wrap]"), selBox = $("[data-ts-sel]");

    function th() { return doc.theme; }
    function ensure() {
      if (!doc.theme) doc.theme = { v: 1, pack: null, palette: { paper: "#FBF7EF", ink: "#2A2420", accent: "#B8925A", accent2: "#7A1F2B" }, fonts: { title: "Cormorant Garamond", heading: "Cormorant Garamond", body: "Manrope" }, radius: 14, bg: { base: null, sections: [], layers: [], particles: { type: "none" }, light: { type: "none" } } };
      const t = doc.theme; t.bg = t.bg || {}; t.bg.layers = t.bg.layers || []; t.bg.sections = t.bg.sections || []; t.bg.particles = t.bg.particles || { type: "none" }; t.bg.light = t.bg.light || { type: "none" };
      t.palette = t.palette || {}; t.fonts = t.fonts || {};
      return t;
    }
    let saveT = 0;
    function save(rerender) { const tz = th(); if (tz && tz.bg && Array.isArray(tz.bg.layers) && tz.bg.layers.length) tz.bg.lv = 2;
      /* ✨ sahne uyumu (elle ayarlar korunur) */ if (global.SeozMotion && doc.motion && doc.motion.on !== false) global.SeozMotion.recompute(doc); clearTimeout(saveT); saveT = setTimeout(() => { if (cb.onChange) cb.onChange(); }, 250); markAfter(); if (rerender !== false) preview(); renderSub(); }
    function renderSub() {
      const t = th(), pk = t && t.pack && P.pack(t.pack);
      $("[data-ts-sub]").textContent = t ? (pk ? `${pk.label} · ${pk.variants[t.variant || 0].label}` : "Özel zemin") + ` · ${(t.bg && t.bg.layers || []).length} zemin katmanı` : "Henüz iç zemin yok — bir paket seçin ya da kendi zemininizi kurun";
      $("[data-ts-undo]").disabled = !state.undo;
    }

    /* ---------------- önizleme ---------------- */
    let prevT = 0;
    function preview(now) {
      clearTimeout(prevT);
      const run = () => {
        const keep = phone.scrollTop;
        global.SeozRenderer.renderDocument(doc, pCanvas, "view", "mobile");
        global.SeozLayoutEngine.applyScale(pCanvas, pWrap, doc.canvas.baseWidth);
        phone.scrollTop = keep;
        placeSel();
      };
      if (now) run(); else prevT = setTimeout(run, 140);
    }
    function scaleNow() { const r = pCanvas.getBoundingClientRect(); return r.width / (pCanvas.offsetWidth || 1) || 1; }
    // seçim çerçevesi katmanın EKRANDAKİ yerini izler (derinlik/kaydırma efektleri katmanı kaydırsa da);
    // sürükleme sırasında başlangıçtaki bu fark korunur, böylece çerçeve parmağın altında kalır
    let selOff = { x: 0, y: 0 }, dragging = false;
    function placeSel() {
      const t = th(), L = state.tab === "zemin" && t && t.bg.layers.find(x => x.id === state.selBg);
      if (!L || L.hidden) { selBox.hidden = true; return; }
      const s = scaleNow(), pr = phone.getBoundingClientRect(), cr = pCanvas.getBoundingClientRect();
      if (!dragging) {
        const n = pCanvas.querySelector(`.th-bl[data-bl="${(global.CSS && CSS.escape) ? CSS.escape(L.id) : L.id}"]`);
        if (n) {
          const r = n.getBoundingClientRect();
          selOff = { x: (r.left + r.width / 2) - (cr.left + (num(L.x, 0) + num(L.w, 100) / 2) * s), y: (r.top + r.height / 2) - (cr.top + (num(L.y, 0) + num(L.h, 100) / 2) * s) };
        } else selOff = { x: 0, y: 0 };
      }
      selBox.hidden = false;
      Object.assign(selBox.style, { left: (cr.left - pr.left + num(L.x, 0) * s + selOff.x) + "px", top: (cr.top - pr.top + phone.scrollTop + num(L.y, 0) * s + selOff.y) + "px",
        width: num(L.w, 100) * s + "px", height: num(L.h, 100) * s + "px", transform: num(L.rotate, 0) ? `rotate(${num(L.rotate, 0)}deg)` : "" });
    }
    // seçili zemin katmanını önizlemede sürükleyerek taşıma, köşeden boyutlandırma, üst tutamaktan döndürme
    selBox.addEventListener("pointerdown", (e) => {
      const L = th() && th().bg.layers.find(x => x.id === state.selBg); if (!L) return;
      e.preventDefault(); try { selBox.setPointerCapture(e.pointerId); } catch (er) { /* önemsiz */ }
      const s = scaleNow(), x0 = e.clientX, y0 = e.clientY, lx = num(L.x, 0), ly = num(L.y, 0);
      const corner = e.target.classList.contains("ts-sel-k"), turn = e.target.classList.contains("ts-sel-r"), lw = num(L.w, 100), lh = num(L.h, 100);
      const rb = selBox.getBoundingClientRect(), cx = rb.left + rb.width / 2, cy = rb.top + rb.height / 2;
      dragging = true;
      const mv = ev => {
        const dx = (ev.clientX - x0) / s, dy = (ev.clientY - y0) / s;
        if (turn) { let a = Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180 / Math.PI + 90; if (a > 180) a -= 360; if (ev.shiftKey) a = Math.round(a / 15) * 15; L.rotate = Math.round(a); }
        else if (corner) { const k = Math.max(0.1, (lw + dx) / lw); L.w = Math.round(lw * k); L.h = Math.round(lh * k); }
        else { L.x = Math.round(lx + dx); L.y = Math.round(ly + dy); }
        placeSel();
      };
      const up = () => {
        selBox.removeEventListener("pointermove", mv); selBox.removeEventListener("pointerup", up); selBox.removeEventListener("pointercancel", up);
        dragging = false; if (corner && L.src) liteSoon(L); renderPanel(); save();
      };
      selBox.addEventListener("pointermove", mv); selBox.addEventListener("pointerup", up); selBox.addEventListener("pointercancel", up);
    });
    selBox.innerHTML = `<i class="ts-sel-k" title="Boyutlandır"></i><i class="ts-sel-r" title="Döndür (Shift: 15° adım)"></i>`;
    // kaydırınca zemin önce kendi yerini günceller; çerçeve bir sonraki karede onu izler
    let selRaf = 0;
    phone.addEventListener("scroll", () => { cancelAnimationFrame(selRaf); selRaf = requestAnimationFrame(() => { selRaf = requestAnimationFrame(placeSel); }); }, { passive: true });

    /* ---------- hafif kopya: telefonda kullanılan, katmanın ekrandaki boyutuna yeten küçük kopya ----------
       Orijinal görsel (L.src) hiç değiştirilmez ve yayına da gider; kopya yalnızca telefonda, yettiği sürece kullanılır. */
    const liteT = {};
    function liteSoon(L) { clearTimeout(liteT[L.id]); liteT[L.id] = setTimeout(() => makeLite(L), 700); }
    function makeLite(L) {
      const BS = global.SeozBlobStore; if (!L || !L.src || !BS || !BS.isRef(L.src)) return Promise.resolve();   // yalnızca bu bilgisayarda duran görselden
      const need = Math.ceil(num(L.w, 120) * 3);
      if (L.lite && num(L.liteW, 0) >= need && num(L.liteW, 0) <= need * 1.6) return Promise.resolve();
      return BS.resolveToObjectURL(L.src).then(url => {
        if (!url) return;
        return new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = url; }).then(im => {
          if (!im || !im.naturalWidth) return;
          if (im.naturalWidth <= need * 1.25) { delete L.lite; delete L.liteW; return; }   // orijinal zaten küçük: kopyaya gerek yok
          const w = need, h = Math.max(1, Math.round(im.naturalHeight * w / im.naturalWidth));
          const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
          const c = cv.getContext("2d"); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = "high"; c.drawImage(im, 0, 0, w, h);
          return new Promise(r2 => cv.toBlob(r2, "image/png")).then(b => b && BS.putBlob(b)).then(ref => {
            if (!ref) return;
            const t = th(), cur = t && t.bg.layers.find(x => x.id === L.id); if (!cur || cur.src !== L.src) return;
            cur.lite = ref; cur.liteW = w; save(false);
          });
        });
      }).catch(() => {});
    }


    /* ---------------- paneller ---------------- */
    const swatch = p => `<span class="ts-sw">${["paper", "ink", "accent", "accent2"].map(k => `<i style="background:${esc(p[k])}"></i>`).join("")}</span>`;
    function artImg(id, c1, c2, cls) { return `<img class="${cls || "ts-art"}" alt="" src="${esc(T.artURL(id, c1, c2))}">`; }
    function packCard(pk) {
      const on = state.pick === pk.id, p = pk.language.palette;
      return `<button type="button" class="ts-pack${on ? " is-on" : ""}" data-ts-pack="${pk.id}" style="--a:${esc(p.accent)};--b:${esc(pk.variants[0].canvas)}">
        <span class="ts-pack-art">${artImg(pk.icon, p.accent, p.accent2)}</span>
        <span class="ts-pack-t"><strong>${esc(pk.label)}</strong><small>${esc(pk.desc)}</small>${swatch(p)}</span></button>`;
    }
    function packDetail(pk) {
      const L5 = global.SeozCinemaLibrary;
      const kurgu = (pk.kurgu || []).map(id => L5 && L5.builtin(id)).filter(Boolean).map(k => k.label).join(", ");
      const bgImg = doc.canvas.background && doc.canvas.background.type === "image";
      const hasCinema = doc.entry && doc.entry.type === "cinema" && doc.entry.cinema && doc.entry.cinema.v === 2;
      const sp = Object.keys(pk.present || {}).map(m => { const md = global.SeozModuleRegistry.getModule(m), p = pk.present[m]; if (!md) return ""; const opt = TP.optionsFor({ type: "module", moduleId: m });
        const nm = p.special ? (opt.specials.find(x => x[0] === p.special) || [0, p.special])[1] : p.open ? (TP.OPENS.find(x => x[0] === p.open) || [0, ""])[1] : (TP.FRAMES.find(x => x[0] === p.frame) || [0, ""])[1];
        return nm ? `<li><b>${esc(md.label)}</b> → ${esc(nm)}</li>` : ""; }).join("");
      return `<div class="ts-detail">
        <h4>${esc(pk.label)}</h4>
        <div class="ts-variants" role="radiogroup" aria-label="Zemin çeşidi">${pk.variants.map((v, i) => `<button type="button" role="radio" aria-checked="${state.variant === i}" class="${state.variant === i ? "is-on" : ""}" data-ts-variant="${i}" style="--b:${esc(v.canvas)}">${esc(v.label)}${v.dark ? " · koyu" : ""}</button>`).join("")}</div>
        <ul class="ts-facts"><li><b>Önerilen açılış</b> → ${esc(kurgu || "—")}</li>${pk.interactive ? `<li><b>Etkileşim</b> → ${esc((global.SeozInteractive.KINDS.find(k => k[0] === pk.interactive.kind) || [0, ""])[1])}</li>` : ""}${sp}</ul>
        ${bgImg ? `<label class="ts-check"><input type="checkbox" data-ts-opt="keepImage" ${state.opts.keepImage ? "checked" : ""}> Yüklediğim zemin görselini koru</label>` : ""}
        ${pk.interactive ? `<label class="ts-check"><input type="checkbox" data-ts-opt="noInteractive" ${state.opts.noInteractive ? "" : "checked"}> Önerilen etkileşimi ekle</label>` : ""}
        ${hasCinema ? `<label class="ts-check"><input type="checkbox" data-ts-opt="syncOpening" ${state.opts.syncOpening ? "checked" : ""}> Sinematik açılışın renklerini ve konseptini pakete uydur</label>` : ""}
        <div class="ts-apply">
          <button type="button" class="btn btn-gold" data-ts-apply="mevcut" ${doc.layers.length ? "" : "disabled"}>Mevcut içeriğe uygula</button>
          <button type="button" class="btn btn-outline" data-ts-apply="bos">Boş tasarıma uygula</button>
          <button type="button" class="btn btn-outline" data-ts-apply="zemin">Yalnızca zemini uygula</button>
        </div>
        <p class="ts-hint">“Mevcut içeriğe uygula” yazılarınızı, modül ayarlarınızı ve görsellerinizi korur; yalnızca düzeni, yazı tiplerini, renkleri ve sunum biçimlerini değiştirir. “Boş tasarıma uygula” örnek metinlerle yeni bir sayfa kurar. Her ikisi de “Paketi geri al” ile tek adımda geri alınır.</p>
      </div>`;
    }
    function panelPaket() {
      const list = P.PACKS.filter(p => p.group === state.group || (state.group === "Davet" && p.alsoDavet));
      const pk = state.pick && P.pack(state.pick);
      return `<div class="cs-seg ts-groups" role="group">${["Davet", "İşletme"].map(g => `<button type="button" class="${state.group === g ? "is-on" : ""}" data-ts-group="${g}">${g} paketleri</button>`).join("")}</div>
        ${pk ? packDetail(pk) : `<p class="ts-hint">Bir paket seçin: önizlemede hemen görürsünüz, uygulamadan önce değişmez.</p>`}
        <div class="ts-packs">${list.map(packCard).join("")}</div>`;
    }
    function fontSel(key, val) { return `<select data-ts-font="${key}">${global.SeozFonts ? SeozFonts.optionsHTML(val) : `<option>${esc(val)}</option>`}</select>`; }
    function panelDil() {
      const t = ensure(), p = t.palette, f = t.fonts;
      return `<section class="ts-sec"><h4>Renk takımı</h4>
          <div class="ts-grid2">${[["paper", "Kâğıt / kart"], ["ink", "Yazı"], ["accent", "Vurgu"], ["accent2", "İkinci vurgu"]].map(([k, l]) => `<label class="ts-color">${l}<input type="color" data-ts-pal="${k}" value="${esc(p[k] || "#000000")}"></label>`).join("")}</div></section>
        <section class="ts-sec"><h4>Yazı tipleri</h4>
          <label class="ts-row">İsim / büyük başlık ${fontSel("title", f.title || "Cormorant Garamond")}</label>
          <label class="ts-row">Ara başlık ${fontSel("heading", f.heading || f.title || "Cormorant Garamond")}</label>
          <label class="ts-row">Metin ${fontSel("body", f.body || "Manrope")}</label></section>
        <section class="ts-sec"><h4>Köşe yuvarlığı</h4><input type="range" min="0" max="28" step="1" value="${num(t.radius, 14)}" data-ts-radius aria-label="Köşe yuvarlığı"> <output>${num(t.radius, 14)} px</output>
          <p class="ts-hint">Çerçeveler, dönen kartlar ve kapaklar bu renkleri ve yuvarlığı kullanır.</p></section>
        <section class="ts-sec"><div class="ts-apply">
          <button type="button" class="btn btn-gold" data-ts-texts>Metinlerime uygula</button>
          <button type="button" class="btn btn-outline" data-ts-sync ${doc.entry && doc.entry.cinema && doc.entry.cinema.v === 2 ? "" : "disabled"}>Sinematik açılışla eşitle</button></div>
          <p class="ts-hint">“Metinlerime uygula” yazı tiplerini ve yazı rengini bütün metin katmanlarına uygular (geri alınabilir).</p></section>`;
    }
    function bgLayerRow(L) {
      const fog = L.kind === "fog";
      const nm = fog ? "Sis katmanı" : L.art ? (A.get(L.art) || {}).label || L.art : (L.name || "Görsel");
      const t = th(), nAct = ((t && t.bg.actions) || []).filter(a => a.layer === L.id).length;
      const nMv = (L.moves || []).length;
      const tags = [L.hidden ? "gizli" : "", fog ? "" : (L.motion && L.motion !== "none" ? (T.MOTIONS.find(m => m[0] === L.motion) || [0, ""])[1] : nMv ? "" : "hareketsiz"), nMv ? nMv + " sürekli hareket" : "", hasScroll(L) ? "kaydırınca" : "",
        num(L.depth, 0) ? "derinlik " + num(L.depth, 0) : "", L.d3 ? "3D" : "", num(L.z, 0) ? "Z " + num(L.z, 0) : "", num(L.shadow, 0) > 0 ? "gölge" : "", nAct ? nAct + " hareket" : "", L.front ? "önde" : ""].filter(Boolean).join(" · ");
      return `<div class="ts-blrow${L.hidden ? " is-hidden" : ""}"><button type="button" class="ts-bl${state.selBg === L.id ? " is-on" : ""}" data-ts-bl="${L.id}">${fog ? `<span class="ts-bl-art ts-bl-up">SİS</span>` : L.art ? artImg(L.art, L.color, L.color2, "ts-bl-art") : `<span class="ts-bl-art ts-bl-up">PNG</span>`}<span>${esc(nm)}<small>${esc(tags)}</small></span></button>
        <span class="ts-blbtns"><button type="button" class="ts-ico${L.hidden ? " is-off" : ""}" data-ts-blhide="${L.id}" title="${L.hidden ? "Göster" : "Gizle"}" aria-label="${esc(nm)} ${L.hidden ? "göster" : "gizle"}" aria-pressed="${L.hidden ? "true" : "false"}">${L.hidden ? "◌" : "👁"}</button><button type="button" class="ts-ico" data-ts-blmv="up" data-id="${L.id}" title="Öne al" aria-label="${esc(nm)} öne al">▲</button><button type="button" class="ts-ico" data-ts-blmv="down" data-id="${L.id}" title="Arkaya al" aria-label="${esc(nm)} arkaya al">▼</button></span></div>`;
    }
    /* İç Zemin 3D: hareket kartları (A2 hareketleri; arayüz burada, motor A2'nin kendisi) */
    const F = global.SeozCinemaFree;
    const BG_STARTS = [["with", "Öncekiyle birlikte"], ["after", "Öncekinden sonra"], ["at", "Belirli saniyede"], ["view", "Katman göründüğünde"]];
    const SPEEDS = [[0.5, "0,5× (yavaş)"], [0.75, "0,75×"], [1, "1× (normal)"], [1.5, "1,5×"], [2, "2× (hızlı)"]];
    function bgActHTML(a, i) {
      const m = F && F.move(a.move); if (!m) return "";
      const pv = (k, d) => { const v = (a.params || {})[k]; return v != null && v !== "" ? v : d; };
      const opt = (key, list, v) => list.map(([x, l]) => `<option value="${x}" ${String(v) === String(x) ? "selected" : ""}>${esc(l)}</option>`).join("");
      return `<div class="ts-act" data-aid="${a.id}">
        <div class="ts-act-h"><strong>${i + 1}. ${esc(m.label)}</strong><button type="button" class="ts-ico ts-del" data-ts-adel="${a.id}" aria-label="Hareketi sil">✕</button></div>
        <label class="ts-row">Başlat <select data-ts-a="start" data-aid="${a.id}">${opt("start", BG_STARTS, a.start || "with")}</select></label>
        <div class="ts-grid2"><label>${a.start === "at" ? "Başlangıç (sn)" : "Gecikme (sn)"}<input type="number" min="0" max="60" step="0.1" data-ts-a="delay" data-aid="${a.id}" value="${num(a.delay, 0)}"></label>
          <label>Süre (sn)<input type="number" min="0.1" max="30" step="0.1" data-ts-a="duration" data-aid="${a.id}" value="${num(a.duration, m.duration)}"></label></div>
        <label class="ts-row">Hız <select data-ts-a="speed" data-aid="${a.id}">${opt("speed", SPEEDS, num(a.speed, 1))}</select></label>
        <label class="ts-row">Yumuşaklık <select data-ts-a="easing" data-aid="${a.id}">${opt("easing", F.EASE_LABELS, a.easing || m.easing)}</select></label>
        ${m.loop ? `<label class="ts-row">Tekrar <select data-ts-a="repeat" data-aid="${a.id}">${opt("repeat", [[1, "1 kez"], [2, "2 kez"], [3, "3 kez"], [0, "Sürekli"]], a.repeat != null ? a.repeat : (m.defRepeat != null ? m.defRepeat : 1))}</select></label>` : ""}
        ${m.pairs ? `<div class="ts-pairs"><div class="ts-pair ts-pair-h"><span></span><b>Başlangıç</b><b>Bitiş</b></div>${m.pairs.map(ax => { const d = ax.def != null ? ax.def : 0;
          return `<div class="ts-pair"><span>${esc(ax.label)}</span><input type="number" min="${ax.min}" max="${ax.max}" step="${ax.step}" data-ts-ap="${ax.key}0" data-aid="${a.id}" value="${esc(pv(ax.key + "0", d))}" aria-label="${esc(ax.label)} başlangıç"><input type="number" min="${ax.min}" max="${ax.max}" step="${ax.step}" data-ts-ap="${ax.key}1" data-aid="${a.id}" value="${esc(pv(ax.key + "1", d))}" aria-label="${esc(ax.label)} bitiş"></div>`; }).join("")}</div>` : ""}
        ${(m.params || []).filter(p => p.options).map(p => `<label class="ts-row">${esc(p.label)} <select data-ts-ap="${p.key}" data-aid="${a.id}">${opt(p.key, p.options, pv(p.key, p.def))}</select></label>`).join("")}
      </div>`;
    }
    function bgActsHTML(L) {
      if (!F || L.kind === "fog") return "";
      const t = ensure(), all = t.bg.actions || [], mine = all.filter(a => a.layer === L.id);
      return `<div class="ts-sub"><h5>Hareketler</h5>
        <select data-ts-am aria-label="Katmana hareket ekle"><option value="">+ Hareket ekle…</option>${T.BG_MOVES.map(id => F.move(id)).filter(Boolean).map(m => `<option value="${m.id}">${esc(m.label)}</option>`).join("")}</select>
        ${mine.map(a => bgActHTML(a, all.indexOf(a))).join("") || `<p class="ts-hint">Bu katmanın henüz hareketi yok. Hareketler sayfa açılınca (açılış bittiyse) ya da katman göründüğünde oynar.</p>`}
      </div>`;
    }
    function bg3dHTML(L) {
      const deg = k => Math.round(num(L[k], 0));
      const rot = (k, label) => `<label class="ts-row">${label} <input type="range" min="-180" max="180" step="1" data-ts-l="${k}" value="${deg(k)}"><small data-ts-lout="${k}">${deg(k)}°</small></label>`;
      return `<div class="ts-sub"><h5>3D</h5>
        <label class="ts-check"><input type="checkbox" data-ts-l="d3" ${L.d3 ? "checked" : ""}> 3D duruş (X/Y/Z dönüşü)</label>
        ${L.d3 ? `${rot("rx", "X dönüşü")}${rot("ry", "Y dönüşü")}${rot("rz", "Z dönüşü")}
          <label class="ts-row">Perspektif <select data-ts-l="persp">${[["", "Sahneyle aynı"], ["500", "Güçlü"], ["1000", "Orta"], ["2000", "Hafif"]].map(([v, l]) => `<option value="${v}" ${String(L.persp || "") === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>` : ""}
        <label class="ts-row">Derinlik (Z) <input type="range" min="-600" max="600" step="10" data-ts-l="z" value="${num(L.z, 0)}"><small data-ts-lout="z">${num(L.z, 0)}</small></label>
        ${L.kind === "fog" ? "" : `<label class="ts-row">Ölçek <input type="range" min="0.2" max="3" step="0.05" data-ts-l="scale" value="${num(L.scale, 1)}"><small data-ts-lout="scale">${Math.round(num(L.scale, 1) * 100)}%</small></label>
        <label class="ts-row">Yumuşak gölge <input type="range" min="0" max="1" step="0.05" data-ts-l="shadow" value="${num(L.shadow, 0)}"><small data-ts-lout="shadow">${num(L.shadow, 0) > 0 ? Math.round(num(L.shadow, 0) * 100) + "%" : "kapalı"}</small></label>`}
        <p class="ts-hint">Z: artı değer katmanı öne, eksi değer geriye alır; kamera hareket edince uzak ve yakın katmanlar farklı hızda kayar.${L.d3 && (Math.abs(num(L.rx, 0)) > 90 || Math.abs(num(L.ry, 0)) > 90) ? " ⚠ Görselin arkası uydurulmaz: bu açıda katman görünmez." : ""}</p>
      </div>`;
    }
    /* ---------- İç Zemin katmanları: sürekli hareketler (birden çok, birlikte çalışır) ---------- */
    const MV = T.MOVE_TYPES || [];
    const MV_AMP = { sallanma: [0.5, 30, 0.5], suzulme: [1, 80, 1], kayma: [1, 150, 1], donme: [10, 360, 5], titresim: [0.5, 10, 0.5], yakinlas: [1, 50, 1], uzaklas: [1, 50, 1], parilti: [5, 100, 5] };
    const MV_DIR = { sallanma: ["Önce sola", "Önce sağa"], suzulme: ["Önce yukarı", "Önce aşağı"], kayma: ["Önce sola", "Önce sağa"], donme: ["Saat yönünde", "Saat yönünün tersine"], titresim: ["Sağa", "Sola"] };
    const MV_REP = [[0, "Sürekli"], [1, "1 kez"], [2, "2 kez"], [3, "3 kez"], [5, "5 kez"], [10, "10 kez"]];
    const hasScroll = L => !!(L && L.scroll && ["x", "rot", "scale", "fade"].some(k => num(L.scroll[k], 0)));
    function moveCardHTML(m, i) {
      const d = (MV.find(x => x[0] === m.type) || [])[2] || { dur: 3, amp: 5, unit: "" }, rg = MV_AMP[m.type] || [0, 100, 1], dir = MV_DIR[m.type];
      const amp = num(m.amp, d.amp), opt = (list, v) => list.map(([x, l]) => `<option value="${x}" ${String(v) === String(x) ? "selected" : ""}>${esc(l)}</option>`).join("");
      return `<div class="ts-act ts-mvcard" data-mid="${m.id}">
        <div class="ts-act-h"><strong>${i + 1}.</strong><select data-ts-m="type" data-mid="${m.id}" aria-label="Hareket türü">${opt(MV.map(x => [x[0], x[1]]), m.type)}</select><button type="button" class="ts-ico ts-del" data-ts-mdel="${m.id}" aria-label="Hareketi sil">✕</button></div>
        <div class="ts-grid2"><label>Süre (sn)<input type="number" min="0.1" max="120" step="0.1" data-ts-m="dur" data-mid="${m.id}" value="${num(m.dur, d.dur)}"></label>
          <label>Gecikme (sn)<input type="number" min="0" max="60" step="0.1" data-ts-m="delay" data-mid="${m.id}" value="${num(m.delay, 0)}"></label></div>
        <label class="ts-row">Genlik <input type="range" min="${rg[0]}" max="${rg[1]}" step="${rg[2]}" data-ts-m="amp" data-mid="${m.id}" value="${amp}"><small data-ts-mout="${m.id}">${amp}${m.type === "donme" && amp >= 360 ? "° (tam tur)" : d.unit}</small></label>
        <div class="ts-grid2"><label>Hız<select data-ts-m="speed" data-mid="${m.id}">${opt([[0.5, "0,5×"], [0.75, "0,75×"], [1, "1×"], [1.5, "1,5×"], [2, "2×"]], num(m.speed, 1))}</select></label>
          <label>Tekrar<select data-ts-m="repeat" data-mid="${m.id}">${opt(MV_REP, num(m.repeat, 0))}</select></label></div>
        ${dir ? `<label class="ts-row">Yön <select data-ts-m="dir" data-mid="${m.id}">${opt([["normal", dir[0]], ["ters", dir[1]]], m.dir || "normal")}</select></label>` : ""}
      </div>`;
    }
    function movesHTML(L) {
      const list = L.moves || [];
      return `<div class="ts-sub"><h5>Sürekli hareketler <small>(birlikte çalışır)</small></h5>
        ${L.motion && L.motion !== "none" ? `<label class="ts-row">Klasik hareket <select data-ts-l="motion">${T.MOTIONS.map(([a, b]) => `<option value="${a}" ${L.motion === a ? "selected" : ""}>${esc(b)}</option>`).join("")}</select></label>
          <label class="ts-row">Klasik hız <input type="range" min="0.2" max="3" step="0.1" data-ts-l="speed" value="${num(L.speed, 1)}"></label>` : ""}
        ${list.map(moveCardHTML).join("")}
        <select data-ts-madd aria-label="Sürekli hareket ekle"><option value="">+ Hareket ekle…</option>${MV.map(x => `<option value="${x[0]}">${esc(x[1])}</option>`).join("")}</select>
        ${list.length ? "" : `<p class="ts-hint">Katmana sallanma, süzülme, dönme, titreşim, yakınlaşma gibi hareketler ekleyin; birden çoğu birlikte çalışır.</p>`}
      </div>`;
    }
    function scrollHTML(L) {
      const sc = L.scroll || {}, row = (k, label, min, max, step, unit) => `<label class="ts-row">${label} <input type="range" min="${min}" max="${max}" step="${step}" data-ts-sf="${k}" value="${num(sc[k], 0)}"><small data-ts-sfout="${k}">${num(sc[k], 0) ? num(sc[k], 0) + unit : "kapalı"}</small></label>`;
      return `<div class="ts-sub"><h5>Kaydırınca</h5>
        <label class="ts-row">Derinlik <input type="range" min="0" max="1" step="0.05" data-ts-l="depth" value="${num(L.depth, 0)}"><small data-ts-lout="depth">${num(L.depth, 0) ? num(L.depth, 0) : "kapalı"}</small></label>
        ${row("x", "Yatay kayma", -200, 200, 5, " px")}${row("rot", "Dönme", -180, 180, 1, "°")}${row("scale", "Ölçek", -60, 60, 1, "%")}${row("fade", "Saydamlaşma", 0, 100, 5, "%")}
        <p class="ts-hint">Katman ekranın ortasındayken bu etkiler sıfırdır, ekranın kenarına doğru tam değerine ulaşır. Sürekli hareketlerle birlikte çalışır; önizlemede telefonu kaydırarak deneyin.</p>
      </div>`;
    }
    function layerBtnsHTML(L) {
      return `<div class="ts-apply ts-lbtns"><button type="button" class="btn btn-outline" data-ts-blhide="${L.id}">${L.hidden ? "👁 Göster" : "◌ Gizle"}</button><button type="button" class="btn btn-outline" data-ts-blz="top">⤒ En öne</button><button type="button" class="btn btn-outline" data-ts-blz="bottom">⤓ En arkaya</button><button type="button" class="btn btn-outline" data-ts-bldup>⧉ Çoğalt</button><button type="button" class="btn btn-outline ts-del" data-ts-bldel>✕ Sil</button></div>`;
    }
    // telefon yükü: hareket eden, kaydırmayla değişen ve büyük katmanlar daha çok sayılır (yapay sınır yok)
    function loadHTML(t) {
      const vis = t.bg.layers.filter(L => !L.hidden), acts = new Set((t.bg.actions || []).map(a => a.layer));
      let sc = 0;
      vis.forEach(L => {
        const moving = (L.moves || []).length + (L.motion && L.motion !== "none" ? 1 : 0) + (acts.has(L.id) ? 1 : 0);
        const area = Math.min(4, num(L.w, 100) * num(L.h, 100) / 40000);
        sc += 0.25 + moving * 0.6 + (hasScroll(L) || num(L.depth, 0) > 0 ? 0.3 : 0) + (L.kind === "fog" ? 1.5 : 0) + area * (moving ? 0.3 : 0.1) + (num(L.shadow, 0) > 0 ? 0.3 : 0);
      });
      // ölçüm: 8 hareketli katman (her biri 3 hareket + kaydırma efekti) yavaşlatılmış testte ~50 kare/sn → "Orta"
      const lvl = sc <= 14 ? ["hafif", "Hafif — telefonda akıcı"] : sc <= 30 ? ["orta", "Orta — çoğu telefonda akıcı"] : ["agir", "Ağır — eski telefonlarda takılabilir; hareketli katman sayısını azaltmayı düşünün"];
      return `<p class="ts-load ts-load-${lvl[0]}" data-ts-load="${lvl[0]}"><b>Telefon yükü:</b> ${lvl[1]} <small>(${vis.length} görünür katman)</small></p>`;
    }
    function bgLayerEditor(L) {
      const sel = (k, list, v) => `<select data-ts-l="${k}">${list.map(([a, b]) => `<option value="${a}" ${String(v) === a ? "selected" : ""}>${esc(b)}</option>`).join("")}</select>`;
      if (L.kind === "fog") return `<div class="ts-bled">
        <div class="ts-grid2">
          <label>Yatay (x)<input type="number" step="1" data-ts-l="x" value="${num(L.x, -40)}"></label><label>Dikey (y)<input type="number" step="1" data-ts-l="y" value="${num(L.y, 0)}"></label>
          <label>Genişlik<input type="number" min="40" step="1" data-ts-l="w" value="${num(L.w, 510)}"></label><label>Yükseklik<input type="number" min="40" step="1" data-ts-l="h" value="${num(L.h, 260)}"></label>
        </div>
        <label class="ts-row ts-color">Renk <input type="color" data-ts-l="color" value="${esc(L.color || "#FFFFFF")}"></label>
        <label class="ts-row">Yoğunluk <input type="range" min="0.05" max="1" step="0.05" data-ts-l="opacity" value="${num(L.opacity, 0.55)}"></label>
        <label class="ts-row">Akış hızı <input type="range" min="0.2" max="3" step="0.1" data-ts-l="speed" value="${num(L.speed, 1)}"></label>
        <label class="ts-row">Derinlik <input type="range" min="0" max="1" step="0.05" data-ts-l="depth" value="${num(L.depth, 0)}"><small>kaydırınca geriden kayar</small></label>
        ${bg3dHTML(L)}
        ${layerBtnsHTML(L)}
        <p class="ts-hint">Sis katmanını görsel katmanlarının arasına sıralayarak (▲▼) katmanlı derinlik elde edersiniz.</p>
      </div>`;
      return `<div class="ts-bled">
        <div class="ts-grid2">
          <label>Yatay (x)<input type="number" step="1" data-ts-l="x" value="${num(L.x, 0)}"></label><label>Dikey (y)<input type="number" step="1" data-ts-l="y" value="${num(L.y, 0)}"></label>
          <label>Genişlik<input type="number" min="4" step="1" data-ts-l="w" value="${num(L.w, 100)}"></label><label>Yükseklik<input type="number" min="4" step="1" data-ts-l="h" value="${num(L.h, 100)}"></label>
        </div>
        ${L.art ? `<div class="ts-grid2"><label class="ts-color">Renk<input type="color" data-ts-l="color" value="${esc(L.color || "#C9A45C")}"></label><label class="ts-color">İkinci renk<input type="color" data-ts-l="color2" value="${esc(L.color2 || "#F3D27A")}"></label></div>` : ""}
        <label class="ts-row">Saydamlık <input type="range" min="0.05" max="1" step="0.05" data-ts-l="opacity" value="${num(L.opacity, 1)}"><small data-ts-lout="opacity">${Math.round(num(L.opacity, 1) * 100)}%</small></label>
        <label class="ts-row">Döndür <input type="range" min="-180" max="180" step="1" data-ts-l="rotate" value="${num(L.rotate, 0)}"><small data-ts-lout="rotate">${num(L.rotate, 0)}°</small></label>
        <div class="ts-checks"><label class="ts-check"><input type="checkbox" data-ts-l="flip" ${L.flip ? "checked" : ""}> Ayna (yatay çevir)</label>
          <label class="ts-check"><input type="checkbox" data-ts-l="front" ${L.front ? "checked" : ""}> İçeriğin önünde</label></div>
        ${layerBtnsHTML(L)}
        ${movesHTML(L)}
        ${scrollHTML(L)}
        ${bg3dHTML(L)}
        ${bgActsHTML(L)}
        <p class="ts-hint">Önizlemede çerçeveli katmanı sürükleyerek taşıyın, sağ alt köşeden büyütün, üstteki yuvarlak tutamaktan döndürün.${L.lite ? " Telefonda bu görselin hafif kopyası kullanılır; orijinali korunur." : ""}</p>
      </div>`;
    }
    function scene3dHTML(t) {
      const sc = t.bg.scene || {}, cm = sc.camera || {}, acts = t.bg.actions || [];
      const lname = id => { const L = t.bg.layers.find(x => x.id === id); return L ? (L.kind === "fog" ? "Sis" : L.art ? (A.get(L.art) || {}).label || L.art : (L.name || "Görsel")) : "?"; };
      const st = id => (BG_STARTS.find(x => x[0] === id) || BG_STARTS[0])[1];
      return `<section class="ts-sec"><h4>3D sahne</h4>
          <label class="ts-row">Perspektif <select data-ts-sc="persp">${[["", "Varsayılan"], ["700", "Güçlü"], ["1200", "Orta"], ["2200", "Hafif"]].map(([v, l]) => `<option value="${v}" ${String(sc.persp || "") === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
          <label class="ts-row">Kamera <select data-ts-sc="camera">${T.CAMERAS.map(([v, l]) => `<option value="${v}" ${(cm.type || "none") === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
          ${cm.type && cm.type !== "none" ? `<label class="ts-row">Kamera gücü <input type="range" min="0" max="1" step="0.05" data-ts-sc="strength" value="${num(cm.strength, 0.5)}"></label>
            ${cm.type === "yaklas" || cm.type === "uzaklas" ? `<label class="ts-row">Kamera süresi <select data-ts-sc="duration">${[[2, "2 sn"], [3, "3 sn"], [5, "5 sn"], [8, "8 sn"]].map(([v, l]) => `<option value="${v}" ${num(cm.duration, 3) === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>` : ""}` : ""}
          ${acts.length ? `<h5>Hareket sırası</h5><ol class="ts-seq">${acts.map((a, i) => `<li><span>${esc((F && F.move(a.move) || {}).label || a.move)} <small>· ${esc(lname(a.layer))} · ${i === 0 ? "Sayfa açılınca" : esc(st(a.start))}</small></span>
            <span class="ts-blbtns"><button type="button" class="ts-ico" data-ts-aup="${a.id}" aria-label="Yukarı">▲</button><button type="button" class="ts-ico" data-ts-adown="${a.id}" aria-label="Aşağı">▼</button></span></li>`).join("")}</ol>` : ""}
          <button type="button" class="btn btn-outline ts-wide" data-ts-play>▶ Önizlemede oynat</button>
          <p class="ts-hint">Kamera ve hareketler müşteri sayfasında açılış bittikten sonra başlar. Derinliği (Z), 3D duruşu ve hareketleri her katmanın kendi ayarlarından verin.</p>
        </section>`;
    }
    function panelZemin() {
      const t = ensure(), b = t.bg.base;
      const L = t.bg.layers.find(x => x.id === state.selBg);
      const bt = b ? b.type : "none";
      return `<section class="ts-sec"><h4>Taban</h4>
          <label class="ts-row">Biçim <select data-ts-base><option value="none" ${bt === "none" ? "selected" : ""}>Zemin rengi / görseli (editördeki)</option><option value="gradient" ${bt === "gradient" ? "selected" : ""}>Renk geçişi</option><option value="radial" ${bt === "radial" ? "selected" : ""}>Ortadan ışıyan</option></select></label>
          ${bt === "gradient" ? `<div class="ts-grid2"><label class="ts-color">Üst<input type="color" data-ts-b="from" value="${esc(b.from || "#FFFFFF")}"></label><label class="ts-color">Alt<input type="color" data-ts-b="to" value="${esc(b.to || "#EEEEEE")}"></label></div>
            <label class="ts-row">Açı <input type="range" min="0" max="360" step="5" data-ts-b="angle" value="${num(b.angle, 180)}"></label>` : ""}
          ${bt === "radial" ? `<div class="ts-grid2"><label class="ts-color">Orta<input type="color" data-ts-b="inner" value="${esc(b.inner || "#FFFFFF")}"></label><label class="ts-color">Kenar<input type="color" data-ts-b="outer" value="${esc(b.outer || "#DDDDDD")}"></label></div>` : ""}
        </section>
        <section class="ts-sec"><label class="ts-check"><input type="checkbox" data-ts-tilt ${t.bg.tilt ? "checked" : ""}> Telefon eğimiyle derinlik (derinliği olan katmanlar telefonu eğince kayar)</label>
          <p class="ts-hint">iPhone'da misafir köşedeki “Eğerek derinlik” düğmesine bir kez dokunarak izin verir; varsayılan derinlik kaydırmaya bağlıdır.</p></section>
        ${scene3dHTML(t)}
        <section class="ts-sec"><h4>Sahne katmanları <small>(${t.bg.layers.length} · listenin altındaki önde)</small></h4>
          <div class="ts-apply"><button type="button" class="btn btn-gold" data-ts-artpick>+ Süsleme ekle</button><button type="button" class="btn btn-outline" data-ts-upload>+ PNG yükle (birden çok)</button><button type="button" class="btn btn-outline" data-ts-fogadd>+ Sis katmanı</button></div>
          ${t.bg.layers.length ? loadHTML(t) : ""}
          <div class="ts-bls">${t.bg.layers.map(bgLayerRow).join("") || `<p class="ts-hint">Henüz katman yok. Dal, bulut, balon gibi süslemeler ya da kendi PNG'nizi ekleyin.</p>`}</div>
          ${L ? bgLayerEditor(L) : ""}</section>
        <div class="ts-artgrid" data-ts-arts hidden>${A.list().map(a => `<button type="button" data-ts-art="${a.id}" title="${esc(a.label)}">${artImg(a.id, t.palette.accent || "#B8925A", t.palette.accent2 || "#7A1F2B")}<small>${esc(a.label)}</small></button>`).join("")}</div>`;
    }
    function hexA(c) { const m = /^rgba?\(([^)]+)\)$/.exec(c || ""); if (!m) return { hex: c && c[0] === "#" ? c.slice(0, 7) : "#FFFFFF", a: 1 }; const p = m[1].split(",").map(s => parseFloat(s)); return { hex: "#" + p.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, "0")).join(""), a: p[3] != null ? p[3] : 1 }; }
    function rgba(hex, a) { const h = hex.replace("#", ""); return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${(+a).toFixed(2)})`; }
    function panelBolum() {
      const t = ensure(), pt = t.bg.particles, lt = t.bg.light;
      const H = pCanvas.offsetHeight || 1200;
      return `<section class="ts-sec"><h4>Bölüm zeminleri</h4>
          <p class="ts-hint">Sayfa aşağı kaydıkça zemin rengi bu noktalarda yumuşakça değişir (ör. davet bölümü gündüz, program bölümü akşam). Sayfa yüksekliği yaklaşık ${Math.round(H)} px.</p>
          ${t.bg.sections.map((s, i) => { const ca = hexA(s.color); return `<div class="ts-secrow"><label>Konum (px)<input type="number" min="0" step="10" data-ts-s="y" data-i="${i}" value="${num(s.y, 0)}"></label>
            <label class="ts-color">Renk<input type="color" data-ts-s="hex" data-i="${i}" value="${esc(ca.hex)}"></label><label>Yoğunluk<input type="range" min="0" max="1" step="0.05" data-ts-s="a" data-i="${i}" value="${ca.a}"></label>
            <button type="button" class="ts-ico" data-ts-sdel="${i}" aria-label="Bölümü sil">✕</button></div>`; }).join("")}
          <button type="button" class="btn btn-outline" data-ts-sadd>+ Bölüm ekle</button></section>
        <section class="ts-sec"><h4>Parçacıklar</h4>
          <label class="ts-row">Tür <select data-ts-p="type">${T.PARTICLES.map(([a, b]) => `<option value="${a}" ${pt.type === a ? "selected" : ""}>${b}</option>`).join("")}</select></label>
          <label class="ts-row">Yoğunluk <input type="range" min="0.2" max="2.5" step="0.1" data-ts-p="density" value="${num(pt.density, 1)}"></label>
          <label class="ts-row">Süre <select data-ts-p="seconds">${[[0, "Sürekli"], [5, "5 sn sonra hafiflesin"], [10, "10 sn sonra hafiflesin"], [20, "20 sn sonra hafiflesin"]].map(([a, b]) => `<option value="${a}" ${num(pt.seconds, 0) === a ? "selected" : ""}>${b}</option>`).join("")}</select></label>
          <p class="ts-hint">Açılıştaki efektin sayfada sürmesi için açılışla aynı türü seçip “sonra hafiflesin” deyin. Hareketi azaltmış misafirlerde ve ekran dışında durur.</p></section>
        <section class="ts-sec"><h4>Işık ve doku</h4>
          <label class="ts-row">Tür <select data-ts-li="type">${T.LIGHTS.map(([a, b]) => `<option value="${a}" ${lt.type === a ? "selected" : ""}>${b}</option>`).join("")}</select></label>
          <label class="ts-row">Güç <input type="range" min="0" max="1" step="0.05" data-ts-li="strength" value="${num(lt.strength, 0.5)}"></label></section>`;
    }
    function panelYerlesim() {
      const t = th(), pk = t && t.pack && P.pack(t.pack);
      const tplId = (pk && pk.template) || state.tpl || "davet";
      const withRv = doc.layers.filter(l => l.reveal && l.reveal.type).length;
      return `<section class="ts-sec"><h4>Yerleşim şablonu</h4>
          <select data-ts-tpl>${Object.keys(P.TEMPLATES).map(k => `<option value="${k}" ${k === tplId ? "selected" : ""}>${esc(P.TEMPLATES[k].label)}</option>`).join("")}</select>
          <button type="button" class="btn btn-gold ts-wide" data-ts-layout ${doc.layers.length ? "" : "disabled"}>Katmanlarımı şablona göre diz</button>
          <p class="ts-hint">İçerik korunur; yalnızca konumlar değişir: yazılar ve modüller bölümlere göre (giriş, hikâye, detaylar, program, konum, katılım, galeri, kapanış) alt alta, ortalanmış dizilir. Masaüstüne özel konumlar sıfırlanır. “Paketi geri al” ile geri alınır.</p></section>
        <section class="ts-sec"><h4>Kaydırınca canlanma</h4>
          <p class="ts-hint">${withRv} / ${doc.layers.length} katmanda açık. Tek tek ayar için editörde katmanı seçip “Görünüm” bölümünü kullanın.</p>
          <label class="ts-row">Süre (sn) <input type="number" min="0.3" max="4" step="0.1" data-ts-rvdur value="${(() => { const l = doc.layers.find(x => x.reveal && x.reveal.type); return l ? (Number(l.reveal.duration) || 0.9) : 0.9; })()}"></label>
          <small class="ts-hint" style="display:block;margin:-4px 0 6px;">Sayı büyüdükçe katmanlar daha yavaş belirir (ör. 1.5–2).</small>
          <label class="ts-row">Biçim <select data-ts-rvtype>${T.REVEALS.filter(r => r[0]).map(([a, b]) => `<option value="${a}">${b}</option>`).join("")}</select></label>
          <div class="ts-apply"><button type="button" class="btn btn-outline" data-ts-rvall>Bütün katmanlara uygula</button><button type="button" class="btn btn-outline" data-ts-rvnone>Hepsinden kaldır</button></div></section>
        <section class="ts-sec"><h4>İç zemini kaldır</h4><button type="button" class="btn btn-outline ts-del" data-ts-clear ${doc.theme ? "" : "disabled"}>İç zemin ayarlarını sil</button>
          <p class="ts-hint">Zemin katmanları, parçacıklar ve tasarım dili kaldırılır; katmanlarınız ve sunum biçimleri kalır.</p></section>`;
    }
    function renderPanel() {
      root.querySelectorAll("[data-ts-tab]").forEach(b => { b.classList.toggle("is-on", b.dataset.tsTab === state.tab); b.setAttribute("aria-selected", String(b.dataset.tsTab === state.tab)); });
      const keep = panel.scrollTop;
      panel.innerHTML = state.tab === "paket" ? panelPaket() : state.tab === "dil" ? panelDil() : state.tab === "zemin" ? panelZemin() : state.tab === "bolum" ? panelBolum() : panelYerlesim();
      panel.scrollTop = keep;
      placeSel();
    }

    /* ---------------- geri alma ---------------- */
    /* Geri alma kaydı: { before, after }. "before" paket uygulanmadan önceki hâl, "after" bu
       stüdyoda yapılan son değişiklikten sonraki hâl. Stüdyo dışında (editörde, Animasyon
       Stüdyosu'nda) sonradan yapılan değişiklikler "after" ile karşılaştırılarak korunur. */
    const partsOf = () => ({ layers: doc.layers, canvas: doc.canvas, theme: doc.theme || null, cinema: doc.entry && doc.entry.cinema ? doc.entry.cinema : null });
    const same = (a, b) => JSON.stringify(a == null ? null : a) === JSON.stringify(b == null ? null : b);
    function writeUndo() { try { localStorage.setItem(UNDO_KEY(doc.id), state.undo); } catch (e) { /* çok büyükse yalnızca bellekte tutulur */ } }
    function snapshot() {
      const now = partsOf();
      state.undo = JSON.stringify({ before: now, after: now });
      writeUndo();
    }
    function markAfter() {
      if (!state.undo) return;
      try { const rec = JSON.parse(state.undo); rec.before = rec.before || rec; rec.after = partsOf(); state.undo = JSON.stringify({ before: rec.before, after: rec.after }); writeUndo(); } catch (e) { /* önemsiz */ }
    }
    function restore() {
      if (!state.undo) return;
      const rec = JSON.parse(state.undo);
      const s = rec.before || rec, after = rec.before ? rec.after : null, cur = partsOf();
      const pageChanged = !!after && (!same(cur.layers, after.layers) || !same(cur.canvas, after.canvas));
      if (pageChanged && !confirm("Paketi uyguladıktan sonra sayfada başka değişiklikler de yaptınız (yazı, modül, görsel).\n\nGeri alırsanız bu değişiklikler de geri alınır. Devam edilsin mi?")) return;
      const cinemaChanged = !!after && !same(cur.cinema, after.cinema);
      doc.layers = s.layers; doc.canvas = s.canvas; if (s.theme) doc.theme = s.theme; else delete doc.theme;
      if (s.cinema && doc.entry && !cinemaChanged) doc.entry.cinema = s.cinema;   // açılışta sonradan yapılan değişiklikler korunur
      state.undo = null; try { localStorage.removeItem(UNDO_KEY(doc.id)); } catch (e) { /* önemsiz */ }
      state.pick = doc.theme && doc.theme.pack || null; state.variant = doc.theme && doc.theme.variant || 0; state.selBg = null;
      toast(cinemaChanged ? "Önceki hâline döndürüldü · sinematik açılış ayarlarınız korundu" : "Önceki hâline döndürüldü"); renderPanel(); save();
    }
    function toast(text) {
      let t = root.querySelector(".cs-toast"); if (!t) { t = document.createElement("div"); t.className = "cs-toast"; t.setAttribute("role", "status"); root.appendChild(t); }
      t.textContent = text; clearTimeout(t._h); t._h = setTimeout(() => t.remove(), 2600);
    }
    // editördeki gerçek yükseklikler (otomatik yükseklikli modüller için)
    const measure = l => (cb.measure ? cb.measure(l.id) : null);

    /* ---------------- olaylar ---------------- */
    root.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b || !root.contains(b)) return;
      const d = b.dataset;
      if (d.tsClose != null) return close();
      if (d.tsUndo != null) return restore();
      if (d.tsReload != null) return preview(true);
      if (d.tsTab) { state.tab = d.tsTab; return renderPanel(); }
      if (d.tsGroup) { state.group = d.tsGroup; return renderPanel(); }
      if (d.tsPack) {
        state.pick = d.tsPack; state.variant = 0;
        // önizleme: paketin zemini geçici olarak gösterilir, belge değişmez
        const pk = P.pack(state.pick), tmp = clone(doc); tmp.theme = themeFromPack(pk, 0, false); tmp.canvas.background = { type: "color", value: pk.variants[0].canvas };
        renderPanel(); showTemp(tmp); return;
      }
      if (d.tsVariant != null) {
        state.variant = Number(d.tsVariant); const pk = P.pack(state.pick), tmp = clone(doc);
        tmp.theme = themeFromPack(pk, state.variant, false); tmp.canvas.background = { type: "color", value: pk.variants[state.variant].canvas };
        renderPanel(); showTemp(tmp); return;
      }
      if (d.tsApply) {
        const pk = P.pack(state.pick); if (!pk) return;
        if (d.tsApply === "bos" && doc.layers.length && !confirm("Boş tasarıma uygulanınca mevcut katmanlar kaldırılıp paketin örnek sayfası kurulur.\n\n“Paketi geri al” ile geri alabilirsiniz. Devam edilsin mi?")) return;
        snapshot();
        const info = applyPack(doc, pk, state.variant, d.tsApply, Object.assign({}, state.opts, { measure }));
        state.selBg = null; renderPanel(); save();
        toast(d.tsApply === "zemin" ? "Zemin uygulandı" : d.tsApply === "bos" ? `Paket kuruldu (${info.layers} katman)` : `Paket uygulandı · ${info.texts} metin, ${info.modules} modül biçimi`);
        return;
      }
      if (d.tsTexts != null) { snapshot(); const n = restyleTexts(doc, ensure()); save(); return toast(n + " metin tasarım diline uyduruldu"); }
      if (d.tsSync != null) { snapshot(); if (syncOpening(doc)) { save(false); toast("Sinematik açılışın renkleri ve konsepti eşitlendi"); } return; }
      if (d.tsArtpick != null) { const g = panel.querySelector("[data-ts-arts]"); g.hidden = !g.hidden; return; }
      if (d.tsArt) {
        const t = ensure(), a = A.get(d.tsArt), w = 140, h = Math.round(w / (a.ratio || 1));
        const L = { id: uid("bl"), art: a.id, color: t.palette.accent || "#B8925A", color2: t.palette.accent2 || "#F3D27A", x: Math.round((430 - w) / 2), y: Math.round((phone.scrollTop) / scaleNow()) + 60, w, h, depth: 0, motion: "none", speed: 1, opacity: 1 };
        t.bg.layers.push(L); state.selBg = L.id; renderPanel(); return save();
      }
      if (d.tsUpload != null) return uploadBg();
      if (d.tsFogadd != null) {
        const t = ensure(), L = { id: uid("bl"), kind: "fog", color: "#FFFFFF", opacity: 0.55, speed: 1, depth: 0.2, x: -40, y: Math.round(phone.scrollTop / scaleNow()) + 200, w: 510, h: 260 };
        t.bg.layers.push(L); state.selBg = L.id; renderPanel(); return save();
      }
      if (d.tsBlmv) {
        const t = ensure(), i = t.bg.layers.findIndex(x => x.id === d.id), j = d.tsBlmv === "up" ? i + 1 : i - 1;
        if (i < 0 || j < 0 || j >= t.bg.layers.length) return;
        const x = t.bg.layers[i]; t.bg.layers[i] = t.bg.layers[j]; t.bg.layers[j] = x; renderPanel(); return save();
      }
      if (d.tsAdel) { const t = ensure(); t.bg.actions = (t.bg.actions || []).filter(a => a.id !== d.tsAdel); renderPanel(); return save(); }
      if (d.tsAup || d.tsAdown) {
        const t = ensure(), list = t.bg.actions || [], i = list.findIndex(a => a.id === (d.tsAup || d.tsAdown)), j = d.tsAup ? i - 1 : i + 1;
        if (i < 0 || j < 0 || j >= list.length) return;
        const x = list[i]; list[i] = list[j]; list[j] = x; renderPanel(); return save();
      }
      if (d.tsPlay != null) return preview(true);
      if (d.tsBlhide) { const t = ensure(), L = t.bg.layers.find(x => x.id === d.tsBlhide); if (!L) return; if (L.hidden) delete L.hidden; else L.hidden = true; renderPanel(); return save(); }
      if (d.tsBlz) {
        const t = ensure(), i = t.bg.layers.findIndex(x => x.id === state.selBg); if (i < 0) return;
        const [L] = t.bg.layers.splice(i, 1); if (d.tsBlz === "top") t.bg.layers.push(L); else t.bg.layers.unshift(L);
        renderPanel(); return save();
      }
      if (d.tsMdel) { const t = ensure(), L = t.bg.layers.find(x => x.id === state.selBg); if (!L) return; L.moves = (L.moves || []).filter(m => m.id !== d.tsMdel); if (!L.moves.length) delete L.moves; renderPanel(); return save(); }
      if (d.tsBl) { state.selBg = state.selBg === d.tsBl ? null : d.tsBl; renderPanel(); return; }
      if (d.tsBldel != null) { const t = ensure(); t.bg.layers = t.bg.layers.filter(x => x.id !== state.selBg); if (t.bg.actions) t.bg.actions = t.bg.actions.filter(a => a.layer !== state.selBg); state.selBg = null; renderPanel(); return save(); }
      if (d.tsBldup != null) {
        const t = ensure(), L = t.bg.layers.find(x => x.id === state.selBg); if (!L) return;
        const c = Object.assign(clone(L), { id: uid("bl"), x: num(L.x, 0) + 20, y: num(L.y, 0) + 20 });
        if (c.moves) c.moves = c.moves.map(m => Object.assign(m, { id: uid("mv") }));
        // katmanın 3D zamanlı hareketleri de kopyalanır
        const acts = (t.bg.actions || []).filter(a => a.layer === L.id).map(a => Object.assign(clone(a), { id: uid("ba"), layer: c.id }));
        if (acts.length) t.bg.actions = t.bg.actions.concat(acts);
        t.bg.layers.splice(t.bg.layers.indexOf(L) + 1, 0, c); state.selBg = c.id; renderPanel(); return save();
      }
      if (d.tsSadd != null) { const t = ensure(), last = t.bg.sections[t.bg.sections.length - 1]; t.bg.sections.push({ y: last ? num(last.y, 0) + 600 : 0, color: last ? "rgba(60,40,70,.25)" : "rgba(255,255,255,0)" }); renderPanel(); return save(); }
      if (d.tsSdel != null) { ensure().bg.sections.splice(Number(d.tsSdel), 1); renderPanel(); return save(); }
      if (d.tsLayout != null) {
        snapshot();
        const tpl = P.TEMPLATES[panel.querySelector("[data-ts-tpl]").value];
        layoutExisting(doc, tpl, measure); save(); return toast("Katmanlar şablona göre dizildi");
      }
      if (d.tsRvall != null) { const ty = panel.querySelector("[data-ts-rvtype]").value, du = Math.max(0.3, Math.min(4, Number(panel.querySelector("[data-ts-rvdur]").value) || 0.9)); doc.layers.forEach(l => { l.reveal = { type: ty, delay: (l.reveal && l.reveal.delay) || 0, duration: du }; }); renderPanel(); save(); return toast("Kaydırınca canlanma eklendi"); }
      if (d.tsRvnone != null) { doc.layers.forEach(l => { delete l.reveal; }); renderPanel(); save(); return toast("Kaydırınca canlanma kaldırıldı"); }
      if (d.tsClear != null) { if (!confirm("İç zemin ayarları silinsin mi?")) return; snapshot(); delete doc.theme; state.selBg = null; renderPanel(); return save(); }
    });
    let tempShown = false;
    function showTemp(tmp) {
      tempShown = true;
      global.SeozRenderer.renderDocument(tmp, pCanvas, "view", "mobile");
      global.SeozLayoutEngine.applyScale(pCanvas, pWrap, tmp.canvas.baseWidth);
    }
    panel.addEventListener("input", (e) => {
      const tg = e.target, t = th();
      if (tg.matches("[data-ts-radius]")) { ensure().radius = Number(tg.value); tg.nextElementSibling.textContent = tg.value + " px"; return save(); }
      if (tg.dataset.tsPal) { ensure().palette[tg.dataset.tsPal] = tg.value; return save(); }
      if (!t) return;
      if (tg.dataset.tsL) {
        const L = t.bg.layers.find(x => x.id === state.selBg); if (!L) return;
        const k = tg.dataset.tsL;
        if (tg.type === "checkbox") return;
        L[k] = ["x", "y", "w", "h", "speed", "depth", "opacity", "rotate", "rx", "ry", "rz", "z", "scale", "shadow"].includes(k) ? Number(tg.value) : (k === "persp" ? (tg.value ? Number(tg.value) : "") : tg.value);
        const lo = panel.querySelector(`[data-ts-lout="${k}"]`);
        if (lo) lo.textContent = k === "scale" || k === "opacity" ? Math.round(Number(tg.value) * 100) + "%" : k === "shadow" ? (Number(tg.value) > 0 ? Math.round(Number(tg.value) * 100) + "%" : "kapalı") : k === "depth" ? (Number(tg.value) ? tg.value : "kapalı") : k === "z" ? tg.value : tg.value + "°";
        if (k === "w" && L.src) liteSoon(L);
        if (k === "w" && L.art) { const a = A.get(L.art); if (a && a.ratio) { L.h = Math.round(L.w / a.ratio); const hi = panel.querySelector('[data-ts-l="h"]'); if (hi) hi.value = L.h; } }
        return save();
      }
      if (tg.dataset.tsM && (tg.type === "range" || tg.type === "number")) {
        const L = t.bg.layers.find(x => x.id === state.selBg), m = L && (L.moves || []).find(x => x.id === tg.dataset.mid); if (!m) return;
        const v = Number(tg.value); if (!isFinite(v)) return;
        m[tg.dataset.tsM] = tg.dataset.tsM === "dur" ? Math.max(0.1, v) : Math.max(0, v);
        const o = panel.querySelector(`[data-ts-mout="${m.id}"]`), dd = ((T.MOVE_TYPES || []).find(x => x[0] === m.type) || [])[2];
        if (o && tg.dataset.tsM === "amp") o.textContent = v + (m.type === "donme" && v >= 360 ? "° (tam tur)" : dd ? dd.unit : "");
        return save();
      }
      if (tg.dataset.tsSf) {
        const L = t.bg.layers.find(x => x.id === state.selBg); if (!L) return;
        const k = tg.dataset.tsSf, v = Number(tg.value), un = { x: " px", rot: "°", scale: "%", fade: "%" }[k];
        L.scroll = L.scroll || {}; if (v) L.scroll[k] = v; else delete L.scroll[k];
        if (!Object.keys(L.scroll).length) delete L.scroll;
        const o = panel.querySelector(`[data-ts-sfout="${k}"]`); if (o) o.textContent = v ? v + un : "kapalı";
        return save();
      }
      if (tg.dataset.tsB) { t.bg.base[tg.dataset.tsB] = tg.type === "range" ? Number(tg.value) : tg.value; return save(); }
      if (tg.dataset.tsS) {
        const s = t.bg.sections[Number(tg.dataset.i)]; if (!s) return;
        if (tg.dataset.tsS === "y") s.y = Number(tg.value);
        else { const ca = hexA(s.color); s.color = rgba(tg.dataset.tsS === "hex" ? tg.value : ca.hex, tg.dataset.tsS === "a" ? tg.value : ca.a); }
        return save();
      }
      if (tg.dataset.tsP && tg.type === "range") { t.bg.particles[tg.dataset.tsP] = Number(tg.value); return save(); }
      if (tg.dataset.tsLi && tg.type === "range") { t.bg.light[tg.dataset.tsLi] = Number(tg.value); return save(); }
    });
    panel.addEventListener("change", (e) => {
      const tg = e.target;
      if (tg.dataset.tsOpt) { state.opts[tg.dataset.tsOpt] = tg.dataset.tsOpt === "noInteractive" ? !tg.checked : tg.checked; return; }
      if (tg.matches("[data-ts-tilt]")) { ensure().bg.tilt = tg.checked; return save(); }
      if (tg.dataset.tsFont) { ensure().fonts[tg.dataset.tsFont] = tg.value; if (global.SeozFonts) SeozFonts.markFontUsed(tg.value); return save(); }
      const t = th(); if (!t) return;
      if (tg.matches("[data-ts-base]")) {
        t.bg.base = tg.value === "none" ? null : tg.value === "gradient" ? { type: "gradient", from: "#FFFFFF", to: t.palette.paper || "#F1EADF", angle: 180 } : { type: "radial", inner: "#FFFFFF", outer: t.palette.paper || "#E9E1D4" };
        renderPanel(); return save();
      }
      if (tg.dataset.tsL && tg.type === "checkbox") { const L = t.bg.layers.find(x => x.id === state.selBg); if (L) { L[tg.dataset.tsL] = tg.checked; renderPanel(); save(); } return; }
      if (tg.dataset.tsL === "motion") { renderPanel(); return; }
      if (tg.matches("[data-ts-madd]")) {
        const L = t.bg.layers.find(x => x.id === state.selBg), dd = ((T.MOVE_TYPES || []).find(x => x[0] === tg.value) || [])[2]; if (!L || !dd) return;
        L.moves = L.moves || []; L.moves.push({ id: uid("mv"), type: tg.value, dur: dd.dur, amp: dd.amp, speed: 1, dir: "normal", delay: 0, repeat: 0 });
        renderPanel(); return save();
      }
      if (tg.dataset.tsM && tg.tagName === "SELECT") {
        const L = t.bg.layers.find(x => x.id === state.selBg), m = L && (L.moves || []).find(x => x.id === tg.dataset.mid); if (!m) return;
        const k = tg.dataset.tsM;
        if (k === "type") { const dd = ((T.MOVE_TYPES || []).find(x => x[0] === tg.value) || [])[2]; if (!dd) return; Object.assign(m, { type: tg.value, dur: dd.dur, amp: dd.amp, dir: "normal" }); renderPanel(); }
        else m[k] = k === "dir" ? tg.value : Number(tg.value);
        return save();
      }
      if (tg.matches("[data-ts-am]")) {
        const L = t.bg.layers.find(x => x.id === state.selBg), m = F && F.move(tg.value); if (!L || !m) return;
        const a = { id: uid("ba"), layer: L.id, move: m.id, start: "with", delay: 0, duration: m.duration, easing: m.easing, params: {} };
        if (m.loop) a.repeat = m.id === "sheen" ? 1 : 0;
        if (m.id === "free3d") { a.params = { z0: -400, ry0: -30, s0: 80, fade: "belir" }; a.easing = "yavaslayarak"; }
        t.bg.actions = t.bg.actions || []; t.bg.actions.push(a); renderPanel(); return save();
      }
      if (tg.dataset.tsA) {
        const a = (t.bg.actions || []).find(x => x.id === tg.dataset.aid); if (!a) return;
        const k = tg.dataset.tsA;
        a[k] = ["delay", "duration", "speed", "repeat"].includes(k) ? Math.max(0, Number(tg.value) || 0) : tg.value;
        if (k === "duration" && !a.duration) a.duration = 0.1;
        if (k === "speed" && !a.speed) a.speed = 1;
        if (k === "start") renderPanel();
        return save();
      }
      if (tg.dataset.tsAp) {
        const a = (t.bg.actions || []).find(x => x.id === tg.dataset.aid); if (!a) return;
        a.params = a.params || {}; const raw = tg.value; a.params[tg.dataset.tsAp] = /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw;
        return save();
      }
      if (tg.dataset.tsSc) {
        const sc = t.bg.scene = t.bg.scene || {}, k = tg.dataset.tsSc;
        if (k === "persp") { if (tg.value) sc.persp = Number(tg.value); else delete sc.persp; }
        else { sc.camera = sc.camera || {}; if (k === "camera") sc.camera.type = tg.value; else sc.camera[k] = Number(tg.value); }
        if (!sc.persp && (!sc.camera || !sc.camera.type || sc.camera.type === "none")) delete t.bg.scene;
        renderPanel(); return save();
      }
      if (tg.dataset.tsP) { t.bg.particles[tg.dataset.tsP] = tg.dataset.tsP === "type" ? tg.value : Number(tg.value); return save(); }
      if (tg.dataset.tsLi) { t.bg.light[tg.dataset.tsLi] = tg.dataset.tsLi === "type" ? tg.value : Number(tg.value); return save(); }
      if (tg.dataset.tsL || tg.dataset.tsS || tg.dataset.tsB) renderPanel();
    });
    function uploadBg() {
      const inp = document.createElement("input");
      inp.type = "file"; inp.accept = "image/png,image/jpeg,image/webp"; inp.multiple = true; inp.style.display = "none";
      inp.addEventListener("change", async () => {
        const files = Array.from(inp.files || []); inp.remove(); if (!files.length) return;
        const fails = [];
        for (let i = 0; i < files.length; i++) {
          try {
            const r = await global.SeozImageUtils.processImageFile(files[i]);
            const t = ensure(), w = Math.min(260, r.naturalWidth || 260), h = Math.round(w * (r.naturalHeight || w) / (r.naturalWidth || w));
            const L = { id: uid("bl"), src: r.ref, name: String(files[i].name || "Görsel").replace(/\.[a-z0-9]+$/i, "").slice(0, 30), x: Math.round((430 - w) / 2) + i * 12, y: Math.round(phone.scrollTop / scaleNow()) + 60 + i * 12, w, h, depth: 0, motion: "none", speed: 1, opacity: 1 };
            t.bg.layers.push(L); state.selBg = L.id; makeLite(L);
          } catch (e) { fails.push(files[i].name); }
        }
        renderPanel(); save();
        if (fails.length) alert("Şu görseller yüklenemedi (PNG, JPG veya WebP deneyin):\n" + fails.join("\n"));
      });
      root.appendChild(inp); inp.click();
    }
    function onKey(e) { if (e.key === "Escape" && !root.querySelector(".ts-artgrid:not([hidden])")) close(); }
    document.addEventListener("keydown", onKey);
    const onResize = () => preview(true);
    global.addEventListener("resize", onResize);
    function close() {
      clearTimeout(saveT); if (cb.onChange) cb.onChange();
      global.SeozTheme.teardown(pCanvas);
      global.SeozRenderer.clearIntervalsWithin(pCanvas);
      document.removeEventListener("keydown", onKey); global.removeEventListener("resize", onResize);
      root.remove(); document.body.classList.remove("cs-open");
      if (cb.onClose) cb.onClose();
    }
    renderSub(); renderPanel(); preview(true);
    if (state.pick && !doc.theme) state.pick = null;
    const first = root.querySelector("[data-ts-tab]"); if (first) first.focus();
    return { close, preview: () => preview(true) };
  }

  global.SeozThemeStudio = { open, applyPack, harmonizeModule, themeFromPack, restyleTexts, layoutExisting, createFromTemplate, syncOpening, paletteFor };
})(window);
