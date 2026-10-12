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
        return `<div class="field"><label>${field.label}</label><select data-mkey="${key}" data-font-select>
          ${SeozFonts.optionsHTML(value)}
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
      case "item-list":
        return itemListHTML(field, value);
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

  /* ------------------------------------------------------------------
     İŞLETME MODÜLLERİ EKİ — "item-list" alan tipi (YENİ, yalnızca ekleme)
     -----------------------------------------------------------------
     Hizmetlerimiz / Fiyat Listesi / Öncesi-Sonrası gibi "satır ekle/sil"
     gerektiren modüller için. Değer bir DİZİDİR: [{alt1, alt2, ...}, ...].
     Alan tanımı:
       { key, type: "item-list", label, addLabel, itemLabel,
         itemFields: [{ key, type: "text"|"textarea"|"image", label }] }
     Mevcut hiçbir modül bu tipi KULLANMAZ — onların formu birebir aynıdır.
     ------------------------------------------------------------------ */
  function itemListHTML(field, value) {
    const items = Array.isArray(value) ? value : [];
    const itemLabel = field.itemLabel || "Öğe";
    const rows = items.map((item, i) => {
      const sub = field.itemFields.map(f => {
        const v = item ? item[f.key] : "";
        const attrs = `data-item-list="${field.key}" data-item-idx="${i}" data-item-key="${f.key}"`;
        if (f.type === "image") {
          return `<div class="field" style="margin-top:6px;"><label>${f.label}</label>
            ${v ? `<div style="display:flex;gap:6px;align-items:center;">
                     <img data-item-thumb="${escapeHTML(v)}" alt="" style="width:56px;height:56px;object-fit:cover;border-radius:6px;background:#eee;">
                     <button type="button" class="btn btn-outline" data-item-image-btn ${attrs} style="flex:1;">Değiştir</button>
                     <button type="button" class="btn btn-danger-text" data-item-image-clear ${attrs} title="Fotoğrafı kaldır">✕</button>
                   </div>`
                : `<button type="button" class="btn btn-outline" data-item-image-btn ${attrs} style="width:100%;">+ Fotoğraf Yükle</button>`}
            <input type="file" accept="image/png,image/jpeg,image/webp" class="hidden" data-item-image-input ${attrs}>
          </div>`;
        }
        if (f.type === "textarea") {
          return `<div class="field" style="margin-top:6px;"><label>${f.label}</label><textarea rows="2" data-item-input ${attrs}>${escapeHTML(v)}</textarea></div>`;
        }
        return `<div class="field" style="margin-top:6px;"><label>${f.label}</label><input type="text" data-item-input ${attrs} value="${escapeHTML(v)}"></div>`;
      }).join("");
      return `<div style="border:1px dashed var(--line, #ccc);border-radius:8px;padding:8px;margin-top:8px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
          <strong style="font-size:.78rem;">${escapeHTML(itemLabel)} ${i + 1}</strong>
          <span style="display:flex;gap:4px;">
            <button type="button" class="btn btn-outline" data-item-move="${field.key}" data-item-idx="${i}" data-dir="-1" title="Yukarı taşı" style="padding:2px 8px;">↑</button>
            <button type="button" class="btn btn-outline" data-item-move="${field.key}" data-item-idx="${i}" data-dir="1" title="Aşağı taşı" style="padding:2px 8px;">↓</button>
            <button type="button" class="btn btn-danger-text" data-item-remove="${field.key}" data-item-idx="${i}" title="Sil">Sil</button>
          </span>
        </div>
        ${sub}
      </div>`;
    }).join("");
    return `<div class="field">
      <label>${field.label}</label>
      ${items.length ? rows : `<p class="sidebar-empty" style="margin:6px 0;">Henüz ${escapeHTML(itemLabel.toLowerCase())} eklenmedi.</p>`}
      <button type="button" class="btn btn-outline" data-item-add="${field.key}" style="width:100%;margin-top:8px;">${escapeHTML(field.addLabel || "+ Ekle")}</button>
    </div>`;
  }

  function bindItemLists(containerEl, layer, moduleDef, cb) {
    const s = layer.settings;
    const fieldOf = key => moduleDef.settingsSchema.find(f => f.key === key && f.type === "item-list");
    const listOf = key => { if (!Array.isArray(s[key])) s[key] = []; return s[key]; };
    const rerender = () => { cb.onSettingsChange(); render(containerEl, layer, cb); };

    containerEl.querySelectorAll("[data-item-add]").forEach(btn => {
      btn.addEventListener("click", () => {
        const field = fieldOf(btn.getAttribute("data-item-add"));
        if (!field) return;
        const blank = {};
        field.itemFields.forEach(f => { blank[f.key] = ""; });
        listOf(field.key).push(blank);
        rerender();
      });
    });

    containerEl.querySelectorAll("[data-item-remove]").forEach(btn => {
      btn.addEventListener("click", () => {
        const arr = listOf(btn.getAttribute("data-item-remove"));
        arr.splice(parseInt(btn.getAttribute("data-item-idx"), 10), 1);
        rerender();
      });
    });

    containerEl.querySelectorAll("[data-item-move]").forEach(btn => {
      btn.addEventListener("click", () => {
        const arr = listOf(btn.getAttribute("data-item-move"));
        const idx = parseInt(btn.getAttribute("data-item-idx"), 10);
        const to = idx + parseInt(btn.getAttribute("data-dir"), 10);
        if (to < 0 || to >= arr.length) return;
        const tmp = arr[idx]; arr[idx] = arr[to]; arr[to] = tmp;
        rerender();
      });
    });

    // Yazı alanları: formu YENİDEN KURMADAN günceller (yazarken odak kaybolmaz).
    containerEl.querySelectorAll("[data-item-input]").forEach(input => {
      input.addEventListener("input", () => {
        const arr = listOf(input.getAttribute("data-item-list"));
        const item = arr[parseInt(input.getAttribute("data-item-idx"), 10)];
        if (!item) return;
        item[input.getAttribute("data-item-key")] = input.value;
        cb.onSettingsChange();
      });
    });

    containerEl.querySelectorAll("[data-item-thumb]").forEach(imgEl => {
      const ref = imgEl.getAttribute("data-item-thumb");
      if (ref) SeozBlobStore.resolveToObjectURL(ref).then(url => { if (url) imgEl.src = url; });
    });

    function itemFor(el) {
      const arr = listOf(el.getAttribute("data-item-list"));
      return arr[parseInt(el.getAttribute("data-item-idx"), 10)];
    }

    containerEl.querySelectorAll("[data-item-image-btn]").forEach(btn => {
      const sel = `[data-item-image-input][data-item-list="${btn.getAttribute("data-item-list")}"][data-item-idx="${btn.getAttribute("data-item-idx")}"][data-item-key="${btn.getAttribute("data-item-key")}"]`;
      const input = containerEl.querySelector(sel);
      if (!input) return;
      btn.addEventListener("click", () => input.click());
    });

    containerEl.querySelectorAll("[data-item-image-input]").forEach(input => {
      input.addEventListener("change", () => {
        const file = input.files && input.files[0];
        if (!file) return;
        // Galeri ile AYNI görsel işleme yolu: küçültülür, IndexedDB'ye
        // "idb:..." referansı olarak kaydedilir. Yayın (Supabase) ve
        // Yayın Paketi bu referansları zaten genel tarama ile buluyor.
        SeozImageUtils.processImageFile(file)
          .then(r => {
            const item = itemFor(input);
            if (!item) return;
            item[input.getAttribute("data-item-key")] = r.ref;
            rerender();
          })
          .catch(() => alert("Görsel yüklenemedi. Lütfen PNG, JPG veya WebP deneyin."));
      });
    });

    containerEl.querySelectorAll("[data-item-image-clear]").forEach(btn => {
      btn.addEventListener("click", () => {
        const item = itemFor(btn);
        if (!item) return;
        item[btn.getAttribute("data-item-key")] = "";
        rerender();
      });
    });
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

    // Yalnızca "item-list" alanı olan (yeni işletme) modüllerde iş yapar.
    bindItemLists(containerEl, layer, moduleDef, cb);

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
        if (input.hasAttribute("data-font-select") && global.SeozFonts.markFontUsed) global.SeozFonts.markFontUsed(val);
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
