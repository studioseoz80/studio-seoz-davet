/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — module-panel.js (yalnızca editör)
   -----------------------------------------------------------------------------
   Herhangi bir modül katmanı seçildiğinde, o modülün settingsSchema'sından
   formu OTOMATİK üretir. Yeni bir modül eklendiğinde bu dosyaya
   dokunmanıza gerek yoktur — modülün kendi dosyasında tanımladığı
   settingsSchema yeterlidir.

   Her alan isteğe bağlı olarak şunları destekler:
   - showIf(settings) -> boolean : alan yalnızca bu koşul doğruyken gösterilir
     (ör. RSVP modülünde "WhatsApp Numarası" yalnızca WhatsApp modları seçiliyken)
   - reRenderPanel: true : bu alan değiştiğinde formun tamamı yeniden kurulur
     (yalnızca görünürlüğü değiştiren "tür/mod" seçicileri için kullanılır —
     sıradan metin/renk/sayı alanlarında KULLANILMAZ, aksi halde yazarken
     odak kaybolur)

   Alan tipi "image-list" (ör. Galeri modülü): tekil bir değer değil, bir
   DİZİ tutar ([{ref, naturalWidth, naturalHeight}, ...]) — ekleme,
   silme, sıralama kendi özel arayüzüyle (küçük resim ızgarası) yönetilir.
   ========================================================================= */

(function (global) {
  "use strict";

  function escapeHTML(str) {
    return String(str || "").replace(/[&<>"']/g, s => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[s]);
  }

  function fieldHTML(field, value) {
    const key = field.key;
    switch (field.type) {
      case "color":
        return `<div class="field"><label>${field.label}</label>
          <input type="color" data-mkey="${key}" value="${value || "#000000"}" style="height:37px;padding:2px;"></div>`;
      case "number":
        return `<div class="field"><label>${field.label}</label>
          <div class="numeric-with-unit">
            <input type="number" data-mkey="${key}" value="${value}" ${field.min != null ? `min="${field.min}"` : ""}>
            <span>${field.unit || "px"}</span>
          </div></div>`;
      case "textarea":
        return `<div class="field"><label>${field.label}</label><textarea data-mkey="${key}" rows="2">${escapeHTML(value)}</textarea></div>`;
      case "select":
        return `<div class="field"><label>${field.label}</label><select data-mkey="${key}">
          ${field.options.map(o => `<option value="${o.value}" ${o.value === value ? "selected" : ""}>${o.label}</option>`).join("")}
        </select></div>`;
      case "font-select":
        return `<div class="field"><label>${field.label}</label><select data-mkey="${key}">
          ${SeozFonts.FONT_CATEGORIES.map(cat => `<optgroup label="${cat.label}">
            ${cat.fonts.map(f => `<option value="${f}" ${f === value ? "selected" : ""}>${f}</option>`).join("")}
          </optgroup>`).join("")}
        </select></div>`;
      case "date":
        return `<div class="field"><label>${field.label}</label><input type="date" data-mkey="${key}" value="${value || ""}"></div>`;
      case "time":
        return `<div class="field"><label>${field.label}</label><input type="time" data-mkey="${key}" value="${value || ""}"></div>`;
      case "file-audio":
        return `<div class="field"><label>${field.label}</label>
          <button type="button" class="btn btn-outline" data-audio-upload="${key}" style="width:100%;">${value ? "Müziği Değiştir" : "Müzik Yükle"}</button>
          <input type="file" accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg" data-audio-input="${key}" class="hidden">
          ${value ? `<audio data-audio-preview="${key}" controls style="width:100%;margin-top:8px;height:32px;"></audio>` : ""}
        </div>`;
      case "image-list": {
        const images = Array.isArray(value) ? value : [];
        return `<div class="field">
          <label>${field.label}</label>
          <div class="gallery-thumb-grid" data-image-list="${key}">
            ${images.map((img, i) => `
              <div class="gallery-thumb-item">
                <img data-thumb-ref="${img.ref}" alt="">
                <button type="button" class="gallery-thumb-remove" data-remove-idx="${i}" title="Kaldır">✕</button>
                <div class="gallery-thumb-move">
                  <button type="button" data-move-idx="${i}" data-dir="-1" title="Yukarı taşı">↑</button>
                  <button type="button" data-move-idx="${i}" data-dir="1" title="Aşağı taşı">↓</button>
                </div>
              </div>
            `).join("")}
          </div>
          <button type="button" class="btn btn-outline" data-add-images="${key}" style="width:100%;margin-top:8px;">+ Fotoğraf Ekle</button>
          <input type="file" accept="image/png,image/jpeg,image/webp" multiple data-add-images-input="${key}" class="hidden">
        </div>`;
      }
      case "url":
        return `<div class="field"><label>${field.label}</label><input type="url" data-mkey="${key}" value="${escapeHTML(value)}"></div>`;
      case "checkbox":
        return `<div class="field"><label style="display:flex;align-items:center;gap:6px;">
          <input type="checkbox" data-mkey="${key}" ${value ? "checked" : ""} style="width:auto;">
          ${field.label}
        </label></div>`;
      default:
        return `<div class="field"><label>${field.label}</label><input type="text" data-mkey="${key}" value="${escapeHTML(value)}"></div>`;
    }
  }

  function render(containerEl, layer, cb) {
    const moduleDef = SeozModuleRegistry.getModule(layer.moduleId);
    if (!moduleDef) {
      containerEl.innerHTML = `<p class="sidebar-empty">Bilinmeyen modül: ${layer.moduleId}</p>`;
      return;
    }
    const s = layer.settings;
    const visibleFields = moduleDef.settingsSchema.filter(f => !f.showIf || f.showIf(s));

    containerEl.innerHTML = `
      <p class="sidebar-empty" style="margin-bottom:12px;">${moduleDef.label} ayarları</p>
      ${visibleFields.map(f => fieldHTML(f, s[f.key])).join("")}
      <div class="prop-actions">
        <button type="button" class="btn btn-outline" data-action="bring-front">En Öne Getir</button>
        <button type="button" class="btn btn-outline" data-action="send-back">En Arkaya Gönder</button>
      </div>
      <div class="prop-actions">
        <button type="button" class="btn btn-outline" data-action="duplicate">Çoğalt</button>
        <button type="button" class="btn btn-danger-text" data-action="delete">Sil</button>
      </div>
    `;

    // Ses önizlemesi varsa, referansı gerçek adrese asenkron çeviriyoruz
    // (bkz. blob-store.js — değer artık gömülü veri değil, IndexedDB
    // referansı olabilir).
    containerEl.querySelectorAll("[data-audio-preview]").forEach(audioEl => {
      const key = audioEl.getAttribute("data-audio-preview");
      const ref = s[key];
      if (ref) SeozBlobStore.resolveToObjectURL(ref).then(url => { if (url) audioEl.src = url; });
    });

    // Galeri gibi fotoğraf-listesi alanlarındaki her küçük resmi de aynı
    // şekilde çözüyoruz.
    containerEl.querySelectorAll("[data-thumb-ref]").forEach(imgEl => {
      const ref = imgEl.getAttribute("data-thumb-ref");
      if (ref) SeozBlobStore.resolveToObjectURL(ref).then(url => { if (url) imgEl.src = url; });
    });

    containerEl.querySelectorAll("[data-image-list]").forEach(listEl => {
      const key = listEl.getAttribute("data-image-list");
      if (!Array.isArray(s[key])) s[key] = [];

      listEl.querySelectorAll("[data-remove-idx]").forEach(btn => {
        btn.addEventListener("click", () => {
          const idx = parseInt(btn.getAttribute("data-remove-idx"), 10);
          s[key].splice(idx, 1);
          cb.onSettingsChange();
          render(containerEl, layer, cb);
        });
      });

      listEl.querySelectorAll("[data-move-idx]").forEach(btn => {
        btn.addEventListener("click", () => {
          const idx = parseInt(btn.getAttribute("data-move-idx"), 10);
          const dir = parseInt(btn.getAttribute("data-dir"), 10);
          const arr = s[key];
          const newIdx = idx + dir;
          if (newIdx < 0 || newIdx >= arr.length) return;
          const tmp = arr[idx];
          arr[idx] = arr[newIdx];
          arr[newIdx] = tmp;
          cb.onSettingsChange();
          render(containerEl, layer, cb);
        });
      });
    });

    containerEl.querySelectorAll("[data-add-images]").forEach(btn => {
      const key = btn.getAttribute("data-add-images");
      const input = containerEl.querySelector(`[data-add-images-input="${key}"]`);
      btn.addEventListener("click", () => input.click());
      input.addEventListener("change", () => {
        const files = Array.from(input.files || []);
        if (!files.length) return;
        Promise.all(files.map(file => SeozImageUtils.processImageFile(file)))
          .then(results => {
            if (!Array.isArray(s[key])) s[key] = [];
            results.forEach(r => s[key].push({ ref: r.ref, naturalWidth: r.naturalWidth, naturalHeight: r.naturalHeight }));
            cb.onSettingsChange();
            render(containerEl, layer, cb);
          })
          .catch(() => alert("Bazı görseller yüklenemedi. Lütfen PNG, JPG veya WebP deneyin."));
      });
    });

    containerEl.querySelectorAll("[data-mkey]").forEach(input => {
      input.addEventListener("input", () => {
        const key = input.getAttribute("data-mkey");
        const fieldDef = moduleDef.settingsSchema.find(f => f.key === key);
        let val;
        if (input.type === "checkbox") {
          val = input.checked;
        } else if (fieldDef && fieldDef.type === "number") {
          val = parseFloat(input.value) || 0;
        } else {
          val = input.value;
        }
        s[key] = val;
        cb.onSettingsChange();
        // Bazı alanlar (ör. RSVP'nin "Tür" seçimi) hangi diğer alanların
        // görünür olacağını belirler — bu durumda formu yeniden kurmamız
        // gerekir. Sıradan metin/renk/sayı alanlarında BUNU YAPMAYIZ,
        // aksi halde yazarken odak kaybolurdu.
        if (fieldDef && fieldDef.reRenderPanel) render(containerEl, layer, cb);
      });
    });

    containerEl.querySelectorAll("[data-audio-upload]").forEach(btn => {
      const key = btn.getAttribute("data-audio-upload");
      const input = containerEl.querySelector(`[data-audio-input="${key}"]`);
      btn.addEventListener("click", () => input.click());
      input.addEventListener("change", () => {
        const file = input.files[0];
        if (!file) return;
        const sizeMB = SeozImageUtils.estimateFileSizeMB(file);
        if (sizeMB > 30 && !confirm(
          `Bu müzik dosyası yaklaşık ${sizeMB.toFixed(1)} MB. Büyük dosyalar ` +
          `yavaş yüklenebilir. Yine de kullanmak istiyor musunuz?`
        )) return;
        SeozImageUtils.storeRawFile(file).then(ref => {
          s[key] = ref;
          cb.onSettingsChange();
          render(containerEl, layer, cb); // önizlemeyi göstermek için paneli yeniden çiz
        }).catch(() => alert("Müzik dosyası yüklenemedi. Lütfen MP3, WAV veya OGG deneyin."));
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

  global.SeozModulePanel = { render };
})(window);
