/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — interactive-studio.js  (E1 · Etkileşim Stüdyosu, yalnızca editör)
   -----------------------------------------------------------------------------
   Etkileşim modülünün (şimdilik Kurdele Kes) kendi görselleriyle düzenlendiği tam ekran stüdyo:
     - parça görselleri: kurdele, fiyonk, makas, arka görsel (PNG/JPG/WebP, şeffaf PNG)
     - önizlemede sürükleyerek taşıma, köşeden büyütme; kaydırıcılarla konum/boyut/dönüş
     - kesim ve hareket: kesim noktası, şekli, ayrılma biçimi, tetikleme, süre, hız, makas
     - ayrı "Sürpriz sonucu" bölümü: mesaj, sürpriz fotoğrafı, bağlantı, efekt
     - canlı önizleme: ▶ Oynat (müşteri sayfasındaki kodun kendisi), ↺ Baştan
   Ayarlar layer.settings içine yazılır (parts, cut, resultImage); hiçbiri yoksa etkileşim eskisi gibi çizilir.
   ========================================================================= */
(function (global) {
  "use strict";
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (v, d) => { v = Number(v); return isFinite(v) ? v : d; };
  const PARTS = [
    ["ribbon", "Kurdele", "Yatay, tek parça kurdele. Kesilince kesim noktasından ikiye ayrılır.", true],
    ["bow", "Fiyonk", "İsteğe bağlı. Ayrı PNG olursa kesilince düşer.", true],
    ["scissor", "Makas", "İsteğe bağlı. Boşsa hazır metal makas kullanılır; kesim noktasına kendiliğinden gelir.", false],
    ["back", "Arka görsel", "Kurdelenin altındaki zemin (kutu, kart, fotoğraf).", false]
  ];
  const SHAPES = [["v", "V kesim (kurdele ucu)"], ["duz", "Düz"], ["zikzak", "Zikzak"]];
  const FALLS = [["sark", "İki yana sarksın"], ["dus", "Düşüp kaybolsun"]];
  const TRIGS = [["dokun", "Dokununca"], ["kaydir", "Parmakla kaydırınca"]];
  const SPEEDS = [[0.5, "0,5× (yavaş)"], [0.75, "0,75×"], [1, "1×"], [1.5, "1,5×"], [2, "2× (hızlı)"]];
  const RESULTS = [["mesaj", "Mesaj"], ["gorsel", "Sürpriz fotoğrafı"], ["baglanti", "Bağlantı düğmesi"], ["efekt", "Yalnızca efekt"]];
  const EFFECTS = [["konfeti", "Konfeti"], ["kalp", "Kalpler"], ["yildiz", "Yıldızlar"], ["yok", "Yok"]];

  function open(layer, h) {
    h = h || {};
    const I = global.SeozInteractive, s = layer.settings;
    s.parts = s.parts || {}; s.cut = Object.assign({}, I.CUT_DEFAULTS, s.cut || {});
    const state = { sel: s.parts.ribbon && s.parts.ribbon.ref ? "ribbon" : null, mode: "edit" };
    const root = document.createElement("div");
    root.className = "is-root"; root.setAttribute("role", "dialog"); root.setAttribute("aria-label", "Etkileşim Stüdyosu");
    root.innerHTML = `
      <header class="is-head"><div><strong>🎀 Etkileşim Stüdyosu</strong><small>Kurdele kes · kendi görselleriniz</small></div>
        <button type="button" class="btn btn-gold" data-is-close>Bitti</button></header>
      <div class="is-body"><aside class="is-panel" data-is-panel></aside>
        <main class="is-stage"><div class="is-bar">
            <button type="button" class="btn btn-gold" data-is-play>▶ Oynat</button>
            <button type="button" class="btn btn-outline" data-is-reset>↺ Baştan</button>
            <span class="is-status" data-is-status></span></div>
          <div class="is-frame" data-is-frame><div class="is-box" data-is-box></div><div class="is-ov" data-is-ov><div class="is-sel" data-is-sel hidden><i class="is-sel-k" title="Büyüt / küçült"></i></div></div></div>
          <p class="is-hint">Konumlandırırken görsele tıklayıp sürükleyin, sağ alt köşeden büyütün. <b>▶ Oynat</b> müşterinin göreceği hareketi oynatır; önizlemeye dokunarak ya da kaydırarak da deneyebilirsiniz.</p>
        </main></div>
      <input type="file" accept="image/png,image/jpeg,image/webp" class="hidden" data-is-file>`;
    document.body.appendChild(root);
    const $ = q => root.querySelector(q);
    const panel = $("[data-is-panel]"), box = $("[data-is-box]"), frame = $("[data-is-frame]"), ov = $("[data-is-ov]"), selEl = $("[data-is-sel]");
    let saveT = 0, ixRoot = null, scale = 1;
    const changed = () => { clearTimeout(saveT); saveT = setTimeout(() => { if (h.onChange) h.onChange(); }, 200); };

    /* ---------- önizleme ---------- */
    function preview(play) {
      const W = num(layer.w, 300), H = num(layer.h, 220);
      const fw = Math.max(200, frame.clientWidth - 40), fh = Math.max(200, frame.clientHeight - 60);
      scale = Math.min(1.6, fw / W, fh / H);
      Object.assign(box.style, { width: W + "px", height: H + "px", transform: `scale(${scale})` });
      box.innerHTML = "";
      ixRoot = I.render(Object.assign({}, s), "view");
      box.appendChild(ixRoot);
      ov.hidden = state.mode !== "edit";
      $("[data-is-status]").textContent = state.mode === "edit" ? "Konumlandırma" : "Oynatma: müşterinin göreceği hâl";
      if (play && ixRoot.__ixPlay) setTimeout(() => ixRoot && ixRoot.__ixPlay && ixRoot.__ixPlay(), 60);
      requestAnimationFrame(placeSel);
    }
    function partEl(key) { return ixRoot && ixRoot.querySelector(key === "ribbon" ? ".ix-k2-rib" : key === "bow" ? ".ix-k2-bow" : "null"); }
    function placeSel() {
      const e = state.mode === "edit" && partEl(state.sel);
      if (!e) { selEl.hidden = true; return; }
      const r = e.getBoundingClientRect(), o = ov.getBoundingClientRect();
      selEl.hidden = false;
      Object.assign(selEl.style, { left: (r.left - o.left) + "px", top: (r.top - o.top) + "px", width: r.width + "px", height: r.height + "px" });
    }
    // sürükleme: tıklanan parça seçilir (fiyonk kurdelenin üstünde)
    ov.addEventListener("pointerdown", e => {
      const hit = ["bow", "ribbon"].find(k => { const el = partEl(k); if (!el) return false; const r = el.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; });
      const corner = e.target.classList.contains("is-sel-k");
      if (!corner && !hit) return;
      if (!corner) { state.sel = hit; renderPanel(); }
      const p = s.parts[state.sel]; if (!p) return;
      e.preventDefault(); try { ov.setPointerCapture(e.pointerId); } catch (er) { /* önemsiz */ }
      const D = I.PART_DEFAULTS[state.sel] || {}, x0 = e.clientX, y0 = e.clientY, px = num(p.x, D.x), py = num(p.y, D.y), pw = num(p.w, D.w);
      const W = num(layer.w, 300) * scale, H = num(layer.h, 220) * scale;
      const mv = ev => {
        const dx = ev.clientX - x0, dy = ev.clientY - y0;
        if (corner) p.w = Math.max(4, Math.round(pw + dx / W * 100 * 2));
        else { p.x = Math.round((px + dx / W * 100) * 10) / 10; p.y = Math.round((py + dy / H * 100) * 10) / 10; }
        preview(false); syncInputs();
      };
      const up = () => { ov.removeEventListener("pointermove", mv); ov.removeEventListener("pointerup", up); ov.removeEventListener("pointercancel", up); changed(); };
      ov.addEventListener("pointermove", mv); ov.addEventListener("pointerup", up); ov.addEventListener("pointercancel", up);
    });

    /* ---------- panel ---------- */
    const opt = (list, v) => list.map(([a, b]) => `<option value="${a}" ${String(v) === String(a) ? "selected" : ""}>${esc(b)}</option>`).join("");
    function partHTML([key, label, hint, posable]) {
      const p = s.parts[key], D = I.PART_DEFAULTS[key] || {}, on = p && p.ref;
      const row = (k, lab, min, max, step, unit) => `<label class="is-row">${lab}<input type="range" min="${min}" max="${max}" step="${step}" data-is-p="${key}" data-k="${k}" value="${num(p[k], D[k])}"><output data-is-out="${key}-${k}">${num(p[k], D[k])}${unit}</output></label>`;
      return `<div class="is-part${state.sel === key ? " is-on" : ""}" data-is-part="${key}">
        <div class="is-part-h"><span class="is-thumb">${on ? `<img data-is-thumb="${esc(p.ref)}" alt="">` : "＋"}</span>
          <span class="is-part-t"><b>${label}</b><small>${esc(hint)}</small></span></div>
        <div class="is-part-b"><button type="button" class="btn btn-outline" data-is-up="${key}">${on ? "Değiştir" : "Görsel yükle"}</button>${on ? `<button type="button" class="btn btn-danger-text" data-is-del="${key}">Kaldır</button>` : ""}</div>
        ${on && posable ? `${row("x", "Yatay", -20, 120, 0.5, "%")}${row("y", "Dikey", -20, 120, 0.5, "%")}${row("w", "Genişlik", 5, 220, 1, "%")}${row("rot", "Döndür", -180, 180, 1, "°")}` : ""}
      </div>`;
    }
    function renderPanel() {
      const C = s.cut, rt = s.resultType || "mesaj";
      panel.innerHTML = `
        <section class="is-sec"><h4>Görseller</h4>
          <p class="is-note">Şeffaf (arka planı olmayan) PNG en gerçekçi sonucu verir. ${s.parts.ribbon && s.parts.ribbon.ref ? "" : "<b>Kurdele görseli yüklenmezse hazır çizim kullanılır.</b>"}</p>
          ${PARTS.map(partHTML).join("")}</section>
        <section class="is-sec"><h4>Kesim ve hareket</h4>
          <label class="is-row">Kesim noktası<input type="range" min="10" max="90" step="1" data-is-c="at" value="${num(C.at, 38)}"><output data-is-out="c-at">%${num(C.at, 38)}</output></label>
          <label class="is-row">Kesim şekli<select data-is-c="shape">${opt(SHAPES, C.shape)}</select></label>
          <label class="is-row">Kesilince<select data-is-c="fall">${opt(FALLS, C.fall)}</select></label>
          <label class="is-row">Tetikleme<select data-is-c="trigger">${opt(TRIGS, C.trigger)}</select></label>
          <div class="is-grid2"><label>Süre (sn)<input type="number" min="0.3" max="8" step="0.1" data-is-c="dur" value="${num(C.dur, 1.6)}"></label>
            <label>Hız<select data-is-c="speed">${opt(SPEEDS, num(C.speed, 1))}</select></label></div>
          <label class="is-check"><input type="checkbox" data-is-c="scissor" ${C.scissor !== false ? "checked" : ""}> Makas görünsün</label></section>
        <section class="is-sec"><h4>Sürpriz sonucu</h4>
          <p class="is-note">Kurdele kesilince ortaya çıkan sürpriz. Yukarıdaki görsellerden ayrıdır.</p>
          <label class="is-row">Sonuç<select data-is-s="resultType">${opt(RESULTS, rt)}</select></label>
          ${rt !== "efekt" && rt !== "gorsel" ? `<label class="is-col">Mesaj<textarea rows="2" data-is-s="message">${esc(s.message)}</textarea></label>` : ""}
          ${rt === "gorsel" ? `<div class="is-part"><div class="is-part-h"><span class="is-thumb">${s.resultImage ? `<img data-is-thumb="${esc(s.resultImage)}" alt="">` : "＋"}</span><span class="is-part-t"><b>Sürpriz fotoğrafı</b><small>Kesilince ortaya çıkan fotoğraf.</small></span></div>
            <div class="is-part-b"><button type="button" class="btn btn-outline" data-is-up="result">${s.resultImage ? "Değiştir" : "Fotoğraf yükle"}</button>${s.resultImage ? `<button type="button" class="btn btn-danger-text" data-is-del="result">Kaldır</button>` : ""}</div></div>` : ""}
          ${rt === "baglanti" ? `<label class="is-col">Bağlantı adresi<input type="url" data-is-s="linkUrl" value="${esc(s.linkUrl)}"></label><label class="is-col">Düğme yazısı<input type="text" data-is-s="linkText" value="${esc(s.linkText)}"></label>` : ""}
          <label class="is-row">Efekt<select data-is-s="effect">${opt(EFFECTS, s.effect || "konfeti")}</select></label>
          <label class="is-row">Yazı rengi<input type="color" data-is-s="textColor" value="${esc(s.textColor || "#3A2E28")}"></label>
          <label class="is-col">Üstteki ipucu (boşsa hazır ipucu)<input type="text" data-is-s="title" value="${esc(s.title)}"></label></section>`;
      panel.querySelectorAll("[data-is-thumb]").forEach(im => global.SeozBlobStore.resolveToObjectURL(im.dataset.isThumb).then(u => { if (u) im.src = u; }));
    }
    function syncInputs() {
      const p = s.parts[state.sel]; if (!p) return;
      ["x", "y", "w", "rot"].forEach(k => {
        const i = panel.querySelector(`[data-is-p="${state.sel}"][data-k="${k}"]`), o = panel.querySelector(`[data-is-out="${state.sel}-${k}"]`);
        if (i) i.value = num(p[k], 0); if (o) o.textContent = num(p[k], 0) + (k === "rot" ? "°" : "%");
      });
    }

    /* ---------- olaylar ---------- */
    let upKey = null;
    const fileIn = $("[data-is-file]");
    fileIn.addEventListener("change", () => {
      const f = fileIn.files && fileIn.files[0]; fileIn.value = ""; if (!f || !upKey) return;
      global.SeozImageUtils.processImageFile(f).then(r => {
        if (upKey === "result") { s.resultImage = r.ref; if (!s.resultType || s.resultType === "mesaj") s.resultType = "gorsel"; }
        else {
          const old = s.parts[upKey] || {};
          s.parts[upKey] = Object.assign({}, I.PART_DEFAULTS[upKey], old, { ref: r.ref, nw: r.naturalWidth, nh: r.naturalHeight });
          if (upKey === "ribbon" || upKey === "bow") state.sel = upKey;
        }
        renderPanel(); preview(false); changed();
      }).catch(() => alert("Görsel yüklenemedi. PNG, JPG veya WebP deneyin."));
    });
    root.addEventListener("click", e => {
      const b = e.target.closest("button"), part = e.target.closest("[data-is-part]");
      if (part && !b && part.dataset.isPart !== state.sel && (part.dataset.isPart === "ribbon" || part.dataset.isPart === "bow") && s.parts[part.dataset.isPart]) { state.sel = part.dataset.isPart; renderPanel(); placeSel(); return; }
      if (!b) return;
      const d = b.dataset;
      if (d.isClose != null) return close();
      if (d.isPlay != null) { state.mode = "play"; return preview(true); }
      if (d.isReset != null) { state.mode = "edit"; return preview(false); }
      if (d.isUp) { upKey = d.isUp; fileIn.click(); return; }
      if (d.isDel) {
        if (d.isDel === "result") delete s.resultImage; else delete s.parts[d.isDel];
        if (state.sel === d.isDel) state.sel = null;
        renderPanel(); preview(false); changed();
      }
    });
    panel.addEventListener("input", e => {
      const t = e.target;
      if (t.dataset.isP) {
        const p = s.parts[t.dataset.isP]; if (!p) return;
        p[t.dataset.k] = Number(t.value); state.sel = t.dataset.isP;
        const o = panel.querySelector(`[data-is-out="${t.dataset.isP}-${t.dataset.k}"]`); if (o) o.textContent = t.value + (t.dataset.k === "rot" ? "°" : "%");
        state.mode = "edit"; preview(false); return changed();
      }
      if (t.dataset.isC && t.type !== "checkbox" && t.tagName !== "SELECT") {
        const v = Number(t.value); if (!isFinite(v)) return;
        s.cut[t.dataset.isC] = v;
        const o = panel.querySelector(`[data-is-out="c-${t.dataset.isC}"]`); if (o) o.textContent = "%" + t.value;
        preview(false); return changed();
      }
      if (t.dataset.isS && t.tagName !== "SELECT") { s[t.dataset.isS] = t.value; preview(false); return changed(); }
    });
    panel.addEventListener("change", e => {
      const t = e.target;
      if (t.dataset.isC && (t.type === "checkbox" || t.tagName === "SELECT")) {
        s.cut[t.dataset.isC] = t.type === "checkbox" ? t.checked : (t.dataset.isC === "speed" ? Number(t.value) : t.value);
        if (t.dataset.isC === "trigger") renderPanel();
        preview(false); return changed();
      }
      if (t.dataset.isS && t.tagName === "SELECT") { s[t.dataset.isS] = t.value; renderPanel(); preview(false); return changed(); }
    });
    const onKey = e => { if (e.key === "Escape") close(); };
    const onResize = () => preview(false);
    document.addEventListener("keydown", onKey); global.addEventListener("resize", onResize);
    function close() {
      clearTimeout(saveT); if (h.onChange) h.onChange();
      document.removeEventListener("keydown", onKey); global.removeEventListener("resize", onResize);
      root.remove(); if (h.rerender) h.rerender();
    }
    renderPanel(); requestAnimationFrame(() => preview(false));
    return { close, root };
  }
  global.SeozInteractiveStudio = { open };
})(window);
