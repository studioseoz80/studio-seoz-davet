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
  function applyModSettings(doc, pack, vi) {
    const ms = modSettingsFor(pack, vi);
    doc.layers.forEach(l => { if (l.type === "module" && ms[l.moduleId]) Object.assign(l.settings, clone(ms[l.moduleId])); });
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
        y += h + (k < b.length - 1 ? (l.type === "text" ? 14 : 22) : 0);
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
        out.push(l); y += st.h + 12;
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
        l.reveal = { type: "yukari", delay: 0, duration: 0.9 }; out.push(l); y += l.h + (def.autoHeight ? 40 : 26);
      });
      if (y > before) y += 46;
    });
    doc.layers = out;
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
    function save(rerender) { clearTimeout(saveT); saveT = setTimeout(() => { if (cb.onChange) cb.onChange(); }, 250); if (rerender !== false) preview(); renderSub(); }
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
    function placeSel() {
      const t = th(), L = state.tab === "zemin" && t && t.bg.layers.find(x => x.id === state.selBg);
      if (!L) { selBox.hidden = true; return; }
      const s = scaleNow(), pr = phone.getBoundingClientRect(), cr = pCanvas.getBoundingClientRect();
      selBox.hidden = false;
      Object.assign(selBox.style, { left: (cr.left - pr.left + num(L.x, 0) * s) + "px", top: (cr.top - pr.top + phone.scrollTop + num(L.y, 0) * s) + "px", width: num(L.w, 100) * s + "px", height: num(L.h, 100) * s + "px" });
    }
    // seçili zemin katmanını önizlemede sürükleyerek taşıma
    selBox.addEventListener("pointerdown", (e) => {
      const L = th() && th().bg.layers.find(x => x.id === state.selBg); if (!L) return;
      e.preventDefault(); try { selBox.setPointerCapture(e.pointerId); } catch (er) { /* önemsiz */ }
      const s = scaleNow(), x0 = e.clientX, y0 = e.clientY, lx = num(L.x, 0), ly = num(L.y, 0);
      const corner = e.target.classList.contains("ts-sel-k"), lw = num(L.w, 100), lh = num(L.h, 100);
      const mv = ev => {
        const dx = (ev.clientX - x0) / s, dy = (ev.clientY - y0) / s;
        if (corner) { const k = Math.max(0.1, (lw + dx) / lw); L.w = Math.round(lw * k); L.h = Math.round(lh * k); }
        else { L.x = Math.round(lx + dx); L.y = Math.round(ly + dy); }
        placeSel();
      };
      const up = () => { selBox.removeEventListener("pointermove", mv); selBox.removeEventListener("pointerup", up); renderPanel(); save(); };
      selBox.addEventListener("pointermove", mv); selBox.addEventListener("pointerup", up);
    });
    selBox.innerHTML = `<i class="ts-sel-k" title="Boyutlandır"></i>`;
    phone.addEventListener("scroll", () => placeSel(), { passive: true });

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
      const nm = L.art ? (A.get(L.art) || {}).label || L.art : "Görsel";
      return `<button type="button" class="ts-bl${state.selBg === L.id ? " is-on" : ""}" data-ts-bl="${L.id}">${L.art ? artImg(L.art, L.color, L.color2, "ts-bl-art") : `<span class="ts-bl-art ts-bl-up">PNG</span>`}<span>${esc(nm)}<small>${L.motion && L.motion !== "none" ? (T.MOTIONS.find(m => m[0] === L.motion) || [0, ""])[1] : "hareketsiz"}${num(L.depth, 0) ? " · derinlik " + num(L.depth, 0) : ""}${L.front ? " · önde" : ""}</small></span></button>`;
    }
    function bgLayerEditor(L) {
      const sel = (k, list, v) => `<select data-ts-l="${k}">${list.map(([a, b]) => `<option value="${a}" ${String(v) === a ? "selected" : ""}>${esc(b)}</option>`).join("")}</select>`;
      return `<div class="ts-bled">
        <div class="ts-grid2">
          <label>Yatay (x)<input type="number" step="1" data-ts-l="x" value="${num(L.x, 0)}"></label><label>Dikey (y)<input type="number" step="1" data-ts-l="y" value="${num(L.y, 0)}"></label>
          <label>Genişlik<input type="number" min="4" step="1" data-ts-l="w" value="${num(L.w, 100)}"></label><label>Yükseklik<input type="number" min="4" step="1" data-ts-l="h" value="${num(L.h, 100)}"></label>
        </div>
        ${L.art ? `<div class="ts-grid2"><label class="ts-color">Renk<input type="color" data-ts-l="color" value="${esc(L.color || "#C9A45C")}"></label><label class="ts-color">İkinci renk<input type="color" data-ts-l="color2" value="${esc(L.color2 || "#F3D27A")}"></label></div>` : ""}
        <label class="ts-row">Hareket ${sel("motion", T.MOTIONS, L.motion || "none")}</label>
        <label class="ts-row">Hız <input type="range" min="0.2" max="3" step="0.1" data-ts-l="speed" value="${num(L.speed, 1)}"></label>
        <label class="ts-row">Derinlik <input type="range" min="0" max="1" step="0.05" data-ts-l="depth" value="${num(L.depth, 0)}"><small>kaydırınca geriden kayar</small></label>
        <label class="ts-row">Saydamlık <input type="range" min="0.05" max="1" step="0.05" data-ts-l="opacity" value="${num(L.opacity, 1)}"></label>
        <label class="ts-row">Döndür <input type="range" min="-180" max="180" step="1" data-ts-l="rotate" value="${num(L.rotate, 0)}"></label>
        <div class="ts-checks"><label class="ts-check"><input type="checkbox" data-ts-l="flip" ${L.flip ? "checked" : ""}> Ayna (yatay çevir)</label>
          <label class="ts-check"><input type="checkbox" data-ts-l="front" ${L.front ? "checked" : ""}> İçeriğin önünde</label></div>
        <div class="ts-apply"><button type="button" class="btn btn-outline" data-ts-bldup>⧉ Çoğalt</button><button type="button" class="btn btn-outline ts-del" data-ts-bldel>✕ Sil</button></div>
        <p class="ts-hint">Önizlemede çerçeveli katmanı sürükleyerek taşıyabilir, sağ alt köşesinden büyütebilirsiniz.</p>
      </div>`;
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
        <section class="ts-sec"><h4>Sahne katmanları <small>(${t.bg.layers.length})</small></h4>
          <div class="ts-apply"><button type="button" class="btn btn-gold" data-ts-artpick>+ Süsleme ekle</button><button type="button" class="btn btn-outline" data-ts-upload>+ PNG yükle</button></div>
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
    function snapshot() {
      state.undo = JSON.stringify({ layers: doc.layers, canvas: doc.canvas, theme: doc.theme || null, cinema: doc.entry && doc.entry.cinema ? doc.entry.cinema : null });
      try { localStorage.setItem(UNDO_KEY(doc.id), state.undo); } catch (e) { /* çok büyükse yalnızca bellekte tutulur */ }
    }
    function restore() {
      if (!state.undo) return;
      const s = JSON.parse(state.undo);
      doc.layers = s.layers; doc.canvas = s.canvas; if (s.theme) doc.theme = s.theme; else delete doc.theme;
      if (s.cinema && doc.entry) doc.entry.cinema = s.cinema;
      state.undo = null; try { localStorage.removeItem(UNDO_KEY(doc.id)); } catch (e) { /* önemsiz */ }
      state.pick = doc.theme && doc.theme.pack || null; state.variant = doc.theme && doc.theme.variant || 0; state.selBg = null;
      toast("Önceki hâline döndürüldü"); renderPanel(); save();
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
      if (d.tsBl) { state.selBg = state.selBg === d.tsBl ? null : d.tsBl; renderPanel(); return; }
      if (d.tsBldel != null) { const t = ensure(); t.bg.layers = t.bg.layers.filter(x => x.id !== state.selBg); state.selBg = null; renderPanel(); return save(); }
      if (d.tsBldup != null) { const t = ensure(), L = t.bg.layers.find(x => x.id === state.selBg); if (!L) return; const c = Object.assign(clone(L), { id: uid("bl"), x: num(L.x, 0) + 20, y: num(L.y, 0) + 20 }); t.bg.layers.push(c); state.selBg = c.id; renderPanel(); return save(); }
      if (d.tsSadd != null) { const t = ensure(), last = t.bg.sections[t.bg.sections.length - 1]; t.bg.sections.push({ y: last ? num(last.y, 0) + 600 : 0, color: last ? "rgba(60,40,70,.25)" : "rgba(255,255,255,0)" }); renderPanel(); return save(); }
      if (d.tsSdel != null) { ensure().bg.sections.splice(Number(d.tsSdel), 1); renderPanel(); return save(); }
      if (d.tsLayout != null) {
        snapshot();
        const tpl = P.TEMPLATES[panel.querySelector("[data-ts-tpl]").value];
        layoutExisting(doc, tpl, measure); save(); return toast("Katmanlar şablona göre dizildi");
      }
      if (d.tsRvall != null) { const ty = panel.querySelector("[data-ts-rvtype]").value; doc.layers.forEach(l => { l.reveal = { type: ty, delay: 0, duration: 0.9 }; }); renderPanel(); save(); return toast("Kaydırınca canlanma eklendi"); }
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
        L[k] = ["x", "y", "w", "h", "speed", "depth", "opacity", "rotate"].includes(k) ? Number(tg.value) : tg.value;
        if (k === "w" && L.art) { const a = A.get(L.art); if (a && a.ratio) { L.h = Math.round(L.w / a.ratio); const hi = panel.querySelector('[data-ts-l="h"]'); if (hi) hi.value = L.h; } }
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
      if (tg.dataset.tsFont) { ensure().fonts[tg.dataset.tsFont] = tg.value; if (global.SeozFonts) SeozFonts.markFontUsed(tg.value); return save(); }
      const t = th(); if (!t) return;
      if (tg.matches("[data-ts-base]")) {
        t.bg.base = tg.value === "none" ? null : tg.value === "gradient" ? { type: "gradient", from: "#FFFFFF", to: t.palette.paper || "#F1EADF", angle: 180 } : { type: "radial", inner: "#FFFFFF", outer: t.palette.paper || "#E9E1D4" };
        renderPanel(); return save();
      }
      if (tg.dataset.tsL && tg.type === "checkbox") { const L = t.bg.layers.find(x => x.id === state.selBg); if (L) { L[tg.dataset.tsL] = tg.checked; renderPanel(); save(); } return; }
      if (tg.dataset.tsL === "motion") { renderPanel(); return; }
      if (tg.dataset.tsP) { t.bg.particles[tg.dataset.tsP] = tg.dataset.tsP === "type" ? tg.value : Number(tg.value); return save(); }
      if (tg.dataset.tsLi) { t.bg.light[tg.dataset.tsLi] = tg.dataset.tsLi === "type" ? tg.value : Number(tg.value); return save(); }
      if (tg.dataset.tsL || tg.dataset.tsS || tg.dataset.tsB) renderPanel();
    });
    function uploadBg() {
      const inp = document.createElement("input");
      inp.type = "file"; inp.accept = "image/png,image/jpeg,image/webp"; inp.style.display = "none";
      inp.addEventListener("change", () => {
        const f = inp.files && inp.files[0]; inp.remove(); if (!f) return;
        global.SeozImageUtils.processImageFile(f).then(r => {
          const t = ensure(), w = Math.min(260, r.naturalWidth || 260), h = Math.round(w * (r.naturalHeight || w) / (r.naturalWidth || w));
          const L = { id: uid("bl"), src: r.ref, x: Math.round((430 - w) / 2), y: Math.round(phone.scrollTop / scaleNow()) + 60, w, h, depth: 0, motion: "none", speed: 1, opacity: 1 };
          t.bg.layers.push(L); state.selBg = L.id; renderPanel(); save();
        }).catch(() => alert("Görsel yüklenemedi. PNG, JPG veya WebP deneyin."));
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

  global.SeozThemeStudio = { open, applyPack, themeFromPack, restyleTexts, layoutExisting, createFromTemplate, syncOpening, paletteFor };
})(window);
