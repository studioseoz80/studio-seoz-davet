/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — responsive-panel.js (yalnızca editör)
   -----------------------------------------------------------------------------
   FAZ 8: "Masaüstü Düzeni" paneli. Herhangi bir katman türü için çalışır
   (metin/fotoğraf/modül fark etmez) — bu yüzden text-panel.js, image-panel.js
   ve module-panel.js'e ayrı ayrı dokunmak yerine TEK bir paylaşılan panel
   olarak tasarlandı.

   Yalnızca "Masaüstü Önizleme" seçiliyken anlamlıdır (mobilde her zaman
   tek — mobil öncelikli — tasarım kullanılır, override kavramı yoktur).
   ========================================================================= */

(function (global) {
  "use strict";

  function render(containerEl, layer, breakpoint, cb) {
    if (breakpoint !== "desktop") {
      containerEl.innerHTML = `<p class="sidebar-empty">Masaüstüne özel bir düzen ayarlamak için üstteki "Masaüstü Önizleme"ye geçin.</p>`;
      return;
    }
    if (!layer) {
      containerEl.innerHTML = `<p class="sidebar-empty">Masaüstüne özel düzen ayarlamak için bir katman seçin.</p>`;
      return;
    }

    const hasOverride = !!(layer.desktopOverride && layer.desktopOverride.enabled);

    containerEl.innerHTML = `
      <div class="field">
        <label style="display:flex;align-items:center;gap:6px;">
          <input type="checkbox" data-override-toggle ${hasOverride ? "checked" : ""} style="width:auto;">
          Bu katman için masaüstünde farklı konum/boyut kullan
        </label>
      </div>
      ${hasOverride ? `
        <p class="sidebar-empty" style="font-size:.74rem;">
          Katmanı tuval üzerinde sürükleyip/boyutlandırıp masaüstüne özel
          konumunu ayarlayabilirsiniz. Mobil görünüm bundan ETKİLENMEZ.
        </p>
        <button type="button" class="btn btn-outline" data-reset-override style="width:100%;">Masaüstü Ayarını Sıfırla</button>
      ` : `
        <p class="sidebar-empty" style="font-size:.74rem;">
          Kapalıyken bu katman masaüstünde de mobil ile aynı orantılı
          konumda görünür.
        </p>
      `}
    `;

    containerEl.querySelector("[data-override-toggle]").addEventListener("change", (e) => {
      if (e.target.checked) cb.onEnableOverride();
      else cb.onResetOverride();
    });

    const resetBtn = containerEl.querySelector("[data-reset-override]");
    if (resetBtn) resetBtn.addEventListener("click", () => cb.onResetOverride());
  }

  global.SeozResponsivePanel = { render };
})(window);
