/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — library-view.js (yalnızca editör)
   Davetiye listesi + yeni davetiye oluşturma. "Etkinlik Türü" burada
   yalnızca bir ETİKETTİR (meta.eventType) — hiçbir mantık dallanmasına
   yol açmaz, ileride şablon/varsayılan önerileri için kullanılacaktır.
   ========================================================================= */

(function (global) {
  "use strict";

  const EVENT_TYPES = [
    { id: "bos-sayfa", label: "Boş Sayfa" },
    { id: "dugun", label: "Düğün" },
    { id: "kina", label: "Kına Gecesi" },
    { id: "after-party", label: "After Party" },
    { id: "baby-shower", label: "Baby Shower" },
    { id: "dogum-gunu", label: "Doğum Günü" },
    { id: "is-yeri-acilisi", label: "İş Yeri Açılışı" },
    { id: "diger", label: "Diğer" }
  ];

  function eventLabel(id) {
    const e = EVENT_TYPES.find(e => e.id === id);
    return e ? e.label : id;
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
  }

  function render(rootEl, onOpen) {
    const docs = SeozStorage.listDocuments();

    rootEl.innerHTML = `
      <div class="library-shell">
        <div class="library-header">
          <div>
            <h1>Studio SEOZ Editör</h1>
            <p class="sub">Davetiyeleriniz — düzenlemeye devam edin veya yeni bir tane başlatın.</p>
          </div>
          <div class="library-actions">
            <button class="btn btn-outline" data-import>JSON İçe Aktar</button>
            <button class="btn btn-primary" data-new>+ Yeni Davetiye</button>
          </div>
        </div>
        ${docs.length ? `<div class="doc-grid" data-doc-grid></div>` : `
          <div class="empty-library">
            <p>Henüz bir davetiye oluşturmadınız.</p>
          </div>`}
      </div>
      <input type="file" accept=".json,application/json" data-import-input class="hidden">
    `;

    if (docs.length) {
      const grid = rootEl.querySelector("[data-doc-grid]");
      grid.innerHTML = docs.map(d => `
        <div class="doc-card" data-open="${d.id}">
          <div class="doc-card-thumb">${eventLabel(d.eventType)}</div>
          <span class="badge ${d.publishedAt ? "is-published" : ""}">${d.publishedAt ? "Yayınlandı" : "Taslak"}</span>
          <h3>${escapeHTML(d.title)}</h3>
          <div class="meta">Son güncelleme: ${fmtDate(d.updatedAt)}</div>
          <div class="doc-card-actions">
            <button class="btn btn-outline" data-duplicate="${d.id}">Kopyala</button>
            <button class="btn-danger-text" data-delete="${d.id}">Sil</button>
          </div>
        </div>
      `).join("");

      grid.querySelectorAll("[data-open]").forEach(card => {
        card.addEventListener("click", (e) => {
          if (e.target.closest("[data-duplicate], [data-delete]")) return;
          onOpen(card.getAttribute("data-open"));
        });
      });
      grid.querySelectorAll("[data-duplicate]").forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          SeozStorage.duplicateDocument(btn.getAttribute("data-duplicate"));
          render(rootEl, onOpen);
        });
      });
      grid.querySelectorAll("[data-delete]").forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (confirm("Bu davetiyeyi kalıcı olarak silmek istediğinize emin misiniz?")) {
            SeozStorage.deleteDocument(btn.getAttribute("data-delete"));
            render(rootEl, onOpen);
          }
        });
      });
    }

    rootEl.querySelector("[data-new]").addEventListener("click", () => openNewModal(rootEl, onOpen));

    const importInput = rootEl.querySelector("[data-import-input]");
    rootEl.querySelector("[data-import]").addEventListener("click", () => importInput.click());
    importInput.addEventListener("change", () => {
      const file = importInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const doc = SeozStorage.importJSON(reader.result);
          onOpen(doc.id);
        } catch (err) {
          alert(err.message);
        }
      };
      reader.readAsText(file);
    });
  }

  function openNewModal(rootEl, onOpen) {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal-card">
        <h2>Yeni Davetiye</h2>
        <div class="field">
          <label>Davetiye Adı</label>
          <input type="text" data-new-title value="Adsız Davetiye">
        </div>
        <div class="field">
          <label>Etkinlik Türü (yalnızca bir etiket — her şeyi sonra değiştirebilirsiniz)</label>
          <select data-new-type>
            ${EVENT_TYPES.map(e => `<option value="${e.id}">${e.label}</option>`).join("")}
          </select>
        </div>
        <div class="prop-actions">
          <button class="btn btn-outline" data-cancel>Vazgeç</button>
          <button class="btn btn-primary" data-create>Oluştur</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector("[data-cancel]").addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector("[data-create]").addEventListener("click", () => {
      const title = overlay.querySelector("[data-new-title]").value.trim() || "Adsız Davetiye";
      const type = overlay.querySelector("[data-new-type]").value;
      const doc = SeozDocModel.createEmptyDocument(title, type);
      SeozStorage.saveDraft(doc);
      overlay.remove();
      onOpen(doc.id);
    });
  }

  function escapeHTML(str) {
    return String(str || "").replace(/[&<>"']/g, s => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[s]);
  }

  global.SeozLibraryView = { render, EVENT_TYPES, eventLabel };
})(window);
