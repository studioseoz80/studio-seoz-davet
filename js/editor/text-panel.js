/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — text-panel.js (yalnızca editör)
   Seçili metin katmanının tüm özelliklerini düzenleyen form.
   ========================================================================= */

(function (global) {
  "use strict";

  function fontOptionsHTML(selected) {
    return SeozFonts.FONT_CATEGORIES.map(cat => `
      <optgroup label="${cat.label}">
        ${cat.fonts.map(f => `<option value="${f}" ${f === selected ? "selected" : ""}>${f}</option>`).join("")}
      </optgroup>
    `).join("");
  }

  function render(containerEl, layer, cb) {
    const c = layer.content;
    containerEl.innerHTML = `
      <div class="field">
        <label>Metin</label>
        <textarea data-f="text" rows="2">${escapeHTML(c.text)}</textarea>
      </div>

      <div class="field">
        <label>Font</label>
        <select data-f="fontFamily">${fontOptionsHTML(c.fontFamily)}</select>
      </div>

      <div class="prop-row">
        <div class="field">
          <label>Boyut</label>
          <div class="numeric-with-unit">
            <input type="number" data-f="fontSize" value="${c.fontSize}" min="8" max="160">
            <span>px</span>
          </div>
        </div>
        <div class="field">
          <label>Renk</label>
          <input type="color" data-f="color" value="${c.color}" style="height:37px;padding:2px;">
        </div>
      </div>

      <div class="field">
        <label>Metalik Efekt</label>
        <div class="toggle-btn-group" style="flex-wrap:wrap;">
          <button type="button" data-metallic="none" class="${(c.metallic || "none") === "none" ? "active" : ""}">Yok</button>
          <button type="button" data-metallic="gold" class="${c.metallic === "gold" ? "active" : ""}">Altın (Koyu Zemin)</button>
          <button type="button" data-metallic="silver" class="${c.metallic === "silver" ? "active" : ""}">Gümüş (Koyu Zemin)</button>
          <button type="button" data-metallic="copper-gold" class="${c.metallic === "copper-gold" ? "active" : ""}">Bakır Altın (Açık Zemin)</button>
          <button type="button" data-metallic="dark-silver" class="${c.metallic === "dark-silver" ? "active" : ""}">Koyu Gümüş (Açık Zemin)</button>
        </div>
      </div>

      <div class="field">
        <label>Stil</label>
        <div class="toggle-btn-group">
          <button type="button" data-toggle="bold" class="${c.bold ? "active" : ""}"><b>K</b></button>
          <button type="button" data-toggle="italic" class="${c.italic ? "active" : ""}"><i>İ</i></button>
          <button type="button" data-toggle="underline" class="${c.underline ? "active" : ""}"><u>A</u></button>
        </div>
      </div>

      <div class="field">
        <label>Hizalama</label>
        <div class="toggle-btn-group">
          <button type="button" data-align="left" class="${c.align === "left" ? "active" : ""}">Sol</button>
          <button type="button" data-align="center" class="${c.align === "center" ? "active" : ""}">Orta</button>
          <button type="button" data-align="right" class="${c.align === "right" ? "active" : ""}">Sağ</button>
        </div>
      </div>

      <div class="prop-row">
        <div class="field">
          <label>Harf Aralığı</label>
          <div class="numeric-with-unit">
            <input type="number" step="0.1" data-f="letterSpacing" value="${c.letterSpacing}" min="-2" max="20">
            <span>px</span>
          </div>
        </div>
        <div class="field">
          <label>Satır Aralığı</label>
          <div class="numeric-with-unit">
            <input type="number" step="0.1" data-f="lineHeight" value="${c.lineHeight}" min="0.8" max="3">
            <span>×</span>
          </div>
        </div>
      </div>

      <div class="prop-row">
        <div class="field">
          <label>Genişlik</label>
          <div class="numeric-with-unit">
            <input type="number" data-layer-f="w" value="${layer.w}" min="40">
            <span>px</span>
          </div>
        </div>
      </div>

      <div class="prop-actions">
        <button type="button" class="btn btn-outline" data-action="bring-front">En Öne Getir</button>
        <button type="button" class="btn btn-outline" data-action="send-back">En Arkaya Gönder</button>
      </div>
      <div class="prop-actions">
        <button type="button" class="btn btn-outline" data-action="duplicate">Çoğalt</button>
        <button type="button" class="btn btn-danger-text" data-action="delete">Sil</button>
      </div>
    `;

    containerEl.querySelectorAll("[data-f]").forEach(input => {
      const evt = input.tagName === "SELECT" || input.type === "color" ? "input" : "input";
      input.addEventListener(evt, () => {
        const key = input.getAttribute("data-f");
        let val = input.value;
        if (input.type === "number") val = parseFloat(val) || 0;
        c[key] = val;
        // EK ÖZELLİK: "Yazı Rengi"nden normal bir renk seçmek, açıksa
        // metalik efekti kapatır (aksi halde renk değişikliği görünmez
        // olur, çünkü metalik gradyan düz rengi geçersiz kılar).
        if (key === "color" && c.metallic && c.metallic !== "none") {
          c.metallic = "none";
          containerEl.querySelectorAll("[data-metallic]").forEach(b => {
            b.classList.toggle("active", b.getAttribute("data-metallic") === "none");
          });
        }
        cb.onChange();
      });
    });

    containerEl.querySelectorAll("[data-metallic]").forEach(btn => {
      btn.addEventListener("click", () => {
        c.metallic = btn.getAttribute("data-metallic");
        containerEl.querySelectorAll("[data-metallic]").forEach(b => b.classList.toggle("active", b === btn));
        cb.onChange();
      });
    });

    containerEl.querySelectorAll("[data-layer-f]").forEach(input => {
      input.addEventListener("input", () => {
        const key = input.getAttribute("data-layer-f");
        layer[key] = Math.max(40, parseFloat(input.value) || 40);
        cb.onChange();
      });
    });

    containerEl.querySelectorAll("[data-toggle]").forEach(btn => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-toggle");
        c[key] = !c[key];
        btn.classList.toggle("active", c[key]);
        cb.onChange();
      });
    });

    containerEl.querySelectorAll("[data-align]").forEach(btn => {
      btn.addEventListener("click", () => {
        c.align = btn.getAttribute("data-align");
        containerEl.querySelectorAll("[data-align]").forEach(b => b.classList.toggle("active", b === btn));
        cb.onChange();
      });
    });

    const actionMap = {
      "bring-front": cb.onBringFront,
      "send-back": cb.onSendBack,
      "duplicate": cb.onDuplicate,
      "delete": cb.onDelete
    };
    containerEl.querySelectorAll("[data-action]").forEach(btn => {
      btn.addEventListener("click", () => {
        const action = actionMap[btn.getAttribute("data-action")];
        if (action) action();
      });
    });
  }

  function escapeHTML(str) {
    return String(str || "").replace(/[&<>"']/g, s => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[s]);
  }

  global.SeozTextPanel = { render };
})(window);
