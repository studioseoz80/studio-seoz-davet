/* =============================================================================
   STUDIO SEOZ — editor/theme-panel.js  (İç Zemin · seçili katmanın "Görünüm" paneli)
   -----------------------------------------------------------------------------
   Seçili katman için: kaydırınca canlanma ve (modüllerde) sunum biçimi —
   çerçeve, açılış etkileşimi, modüle özel biçim. Modülün kendi ayarları
   (Özellikler bölümü) hiç değişmez.
   ========================================================================= */
(function (global) {
  "use strict";
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const opts = (list, v) => list.map(([a, b]) => `<option value="${esc(a)}" ${String(v || "") === a ? "selected" : ""}>${esc(b)}</option>`).join("");

  function render(el, layer, cb) {
    const T = global.SeozTheme, P = global.SeozThemePresent;
    if (!layer || !T || !P) { el.innerHTML = `<p class="sidebar-empty">Bir katman seçin.</p>`; return; }
    const rv = layer.reveal || {}, pr = layer.present || {}, o = P.optionsFor(layer);
    el.innerHTML = `
      <div class="field"><label>Kaydırınca canlan</label><select data-tv="rv">${opts(T.REVEALS, rv.type)}</select></div>
      ${rv.type ? `<div class="field" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <label style="font-size:.76rem;">Gecikme (sn)<input type="number" min="0" max="5" step="0.1" data-tv="rvDelay" value="${Number(rv.delay) || 0}"></label>
        <label style="font-size:.76rem;">Süre (sn)<input type="number" min="0.2" max="4" step="0.1" data-tv="rvDur" value="${Number(rv.duration) || 0.9}"></label></div>` : ""}
      <div class="field"><label>Çerçeve</label><select data-tv="frame">${opts(o.frames, pr.frame)}</select></div>
      <div class="field"><label>Açılış etkileşimi</label><select data-tv="open">${opts(o.opens, pr.open)}</select></div>
      ${o.specials.length ? `<div class="field"><label>Özel sunum biçimi</label><select data-tv="special">${opts([["", "Yok (modülün kendi görünümü)"]].concat(o.specials), pr.special)}</select></div>` : ""}
      ${pr.open || pr.special === "kaset" ? `<div class="field"><label>Kapak / etiket yazısı</label><input type="text" maxlength="40" data-tv="title" value="${esc(pr.title || "")}" placeholder="Boşsa modülün adı"></div>` : ""}
      <p style="font-size:.72rem;color:var(--ink-soft);margin:6px 0 0;">Sunum biçimi modülün işini değiştirmez; açılış etkileşimleri müşteri sayfasında çalışır (editörde rozetle gösterilir).</p>`;
    el.onchange = el.oninput = (e) => {
      const tg = e.target, k = tg.dataset.tv; if (!k) return;
      if (e.type === "input" && tg.tagName === "SELECT") return;     // select için yalnızca change
      if (k === "rv") { if (tg.value) layer.reveal = Object.assign({ delay: 0, duration: 0.9 }, layer.reveal || {}, { type: tg.value }); else delete layer.reveal; cb.onChange(); return render(el, layer, cb); }
      if (k === "rvDelay" || k === "rvDur") { if (!layer.reveal) return; layer.reveal[k === "rvDelay" ? "delay" : "duration"] = Math.max(0, Number(tg.value) || 0); return cb.onChange(); }
      const p = Object.assign({}, layer.present || {});
      if (tg.value) p[k] = tg.value; else delete p[k];
      if (k === "special" && tg.value && P.SIZE[tg.value] && cb.onResize) cb.onResize(P.SIZE[tg.value]);
      if (Object.keys(p).filter(x => x !== "title").some(x => p[x])) layer.present = p; else delete layer.present;
      cb.onChange();
      if (e.type === "change" && tg.tagName === "SELECT") render(el, layer, cb);
    };
  }
  global.SeozThemePanel = { render };
})(window);
