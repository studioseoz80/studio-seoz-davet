/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — image-panel.js (yalnızca editör)
   Seçili fotoğraf/görsel katmanının özelliklerini düzenleyen form.
   ========================================================================= */

(function (global) {
  "use strict";

  function render(containerEl, layer, cb) {
    const c = layer.content;
    containerEl.innerHTML = `
      <div class="prop-row">
        <div class="field">
          <label>Genişlik</label>
          <div class="numeric-with-unit">
            <input type="number" data-dim="w" value="${layer.w}" min="20">
            <span>px</span>
          </div>
        </div>
        <div class="field">
          <label>Yükseklik</label>
          <div class="numeric-with-unit">
            <input type="number" data-dim="h" value="${layer.h}" min="20">
            <span>px</span>
          </div>
        </div>
      </div>

      <div class="field">
        <label style="display:flex;align-items:center;gap:6px;">
          <input type="checkbox" data-lock-aspect ${c.lockAspect ? "checked" : ""} style="width:auto;">
          Oranı Kilitle
        </label>
      </div>

      <div class="field">
        <button type="button" class="btn btn-outline" data-replace-image style="width:100%;">Görseli Değiştir</button>
        <input type="file" accept="image/png,image/jpeg,image/webp" data-replace-input class="hidden">
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

    containerEl.querySelectorAll("[data-dim]").forEach(input => {
      input.addEventListener("input", () => {
        const dim = input.getAttribute("data-dim");
        const val = Math.max(20, parseFloat(input.value) || 20);
        if (dim === "w") {
          layer.w = val;
          if (c.lockAspect && layer.w > 0 && c.naturalWidth) {
            layer.h = Math.round(val * (c.naturalHeight / c.naturalWidth));
            containerEl.querySelector('[data-dim="h"]').value = layer.h;
          }
        } else {
          layer.h = val;
          if (c.lockAspect && layer.h > 0 && c.naturalHeight) {
            layer.w = Math.round(val * (c.naturalWidth / c.naturalHeight));
            containerEl.querySelector('[data-dim="w"]').value = layer.w;
          }
        }
        cb.onChange();
      });
    });

    containerEl.querySelector("[data-lock-aspect]").addEventListener("change", (e) => {
      c.lockAspect = e.target.checked;
      cb.onChange();
    });

    const replaceInput = containerEl.querySelector("[data-replace-input]");
    containerEl.querySelector("[data-replace-image]").addEventListener("click", () => replaceInput.click());
    replaceInput.addEventListener("change", () => {
      const file = replaceInput.files[0];
      if (!file) return;
      SeozImageUtils.processImageFile(file).then(result => {
        c.src = result.ref;
        c.naturalWidth = result.naturalWidth;
        c.naturalHeight = result.naturalHeight;
        cb.onImageReplaced();
      }).catch(() => alert("Görsel yüklenemedi. Lütfen PNG, JPG veya WebP deneyin."));
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

  global.SeozImagePanel = { render };
})(window);
