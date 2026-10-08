/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — layers-panel.js (yalnızca editör)
   FAZ 1'de yalnızca metin katmanları listelenir. FAZ 2'de fotoğraf
   katmanları ve yeniden sıralama (sürükleyerek) eklenecektir.
   ========================================================================= */

(function (global) {
  "use strict";

  function labelFor(layer) {
    if (layer.type === "text") {
      const t = (layer.content.text || "").trim();
      return t ? (t.length > 24 ? t.slice(0, 24) + "…" : t) : "(boş metin)";
    }
    if (layer.type === "image") {
      return "🖼 Fotoğraf";
    }
    if (layer.type === "module") {
      const moduleDef = typeof SeozModuleRegistry !== "undefined" ? SeozModuleRegistry.getModule(layer.moduleId) : null;
      return "▣ " + (moduleDef ? moduleDef.label : layer.moduleId);
    }
    return layer.type;
  }

  function render(containerEl, doc, selectedId, cb) {
    if (!doc.layers.length) {
      containerEl.innerHTML = `<p class="sidebar-empty">Henüz katman yok. Üstteki araç çubuğundan "Metin Ekle" ile başlayın.</p>`;
      return;
    }
    const sorted = doc.layers.slice().sort((a, b) => (b.z || 0) - (a.z || 0));
    containerEl.innerHTML = `<div class="layer-list">
      ${sorted.map(l => `
        <div class="layer-list-item ${l.id === selectedId ? "selected" : ""}" data-layer-row="${l.id}">
          <span class="name">${labelFor(l)}</span>
          <span class="layer-actions">
            <button type="button" class="btn-icon" data-delete-layer="${l.id}" title="Sil">✕</button>
          </span>
        </div>
      `).join("")}
    </div>`;

    containerEl.querySelectorAll("[data-layer-row]").forEach(row => {
      row.addEventListener("click", () => cb.selectLayer(row.getAttribute("data-layer-row")));
    });
    containerEl.querySelectorAll("[data-delete-layer]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        cb.deleteLayer(btn.getAttribute("data-delete-layer"));
      });
    });
  }

  global.SeozLayersPanel = { render };
})(window);
