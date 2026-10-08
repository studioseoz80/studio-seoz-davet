/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — editor-app.js (yalnızca editör)
   Uygulamanın giriş noktası. Kütüphane (davetiye listesi) ile editör
   ekranı arasında basit bir hash-routing (#/ ve #/edit/<id>) kullanır.
   ========================================================================= */

(function () {
  "use strict";

  const appRoot = document.getElementById("app");

  /* ------------------------------------------------------------------
     ROUTING
     ------------------------------------------------------------------ */
  function currentRoute() {
    const hash = window.location.hash || "#/";
    const editMatch = hash.match(/^#\/edit\/(.+)$/);
    if (editMatch) return { view: "editor", id: decodeURIComponent(editMatch[1]) };
    return { view: "library" };
  }

  function goToLibrary() { window.location.hash = "#/"; }
  function goToEditor(id) { window.location.hash = "#/edit/" + encodeURIComponent(id); }

  function route() {
    const r = currentRoute();
    if (r.view === "editor") {
      const doc = SeozStorage.loadDraft(r.id);
      if (!doc) { goToLibrary(); return; }
      renderEditor(doc);
    } else {
      renderLibrary();
    }
  }

  function renderLibrary() {
    document.body.className = "seoz-editor-body";
    appRoot.innerHTML = "";
    SeozLibraryView.render(appRoot, goToEditor);
  }

  /* ------------------------------------------------------------------
     EDITOR VIEW
     ------------------------------------------------------------------ */
  function renderEditor(doc) {
    document.body.className = "seoz-editor-body";
    let selectedLayerId = null;
    let currentScale = 1;
    let saveTimer = null;
    let previewWidth = 430; // önizleme çerçevesi genişliği
    let currentBreakpoint = "mobile"; // FAZ 8: "mobile" | "desktop" — geometriyi de belirler

    appRoot.innerHTML = `
      <div class="editor-shell">
        <div class="editor-topbar">
          <button class="back-btn btn-icon" data-back title="Kütüphaneye dön">←</button>
          <input type="text" class="doc-title-input" data-title-input value="${escapeAttr(doc.meta.title)}">
          <div class="spacer"></div>
          <span class="save-status" data-save-status>Kaydedildi</span>
          <div class="bp-toggle">
            <button type="button" data-bp="mobile" class="active">Mobil</button>
            <button type="button" data-bp="desktop">Masaüstü Önizleme</button>
          </div>
          <button class="btn btn-outline" data-export>JSON Dışa Aktar</button>
          <button class="btn btn-outline" data-export-package>Yayın Paketi İndir (.zip)</button>
          <button class="btn btn-gold" data-publish>Yayına Hazırla</button>
        </div>

        <div class="editor-toolbar">
          <button class="btn btn-outline" data-undo title="Geri Al (Ctrl+Z)">↶ Geri Al</button>
          <button class="btn btn-outline" data-redo title="İleri Al (Ctrl+Y)">↷ İleri Al</button>
          <button class="btn btn-outline" data-delete-selected title="Seçili Öğeyi Sil (Delete)">🗑 Sil</button>
          <span style="width:1px;background:var(--line);align-self:stretch;margin:0 4px;"></span>
          <button class="btn btn-outline" data-add-text>+ Metin Ekle</button>
          <button class="btn btn-outline" data-add-image>+ Fotoğraf Ekle</button>
          <input type="file" accept="image/png,image/jpeg,image/webp" data-add-image-input class="hidden">
          <select data-add-module>
            <option value="">+ Modül Ekle...</option>
          </select>
          <div class="spacer"></div>
          <button class="btn btn-outline" data-change-bg>Zemin Görseli Yükle</button>
          <input type="file" accept="image/png,image/jpeg,image/webp" data-change-bg-input class="hidden">
          <button class="btn btn-outline" data-reset-bg title="Düz renge dön">Zemini Sıfırla</button>
          <input type="color" data-bg-color value="${doc.canvas.background.type === 'color' ? doc.canvas.background.value : '#FBF8F2'}" title="Zemin rengi">
        </div>

        <div class="editor-body">
          <div class="editor-canvas-area">
            <div class="seoz-canvas-outer" data-preview-frame style="max-width:${previewWidth}px;">
              <div class="seoz-canvas-scale-wrap" data-scale-wrap>
                <div class="seoz-canvas" data-canvas></div>
              </div>
            </div>
          </div>
          <aside class="editor-sidebar">
            <div class="sidebar-section">
              <h4>Giriş Sahnesi</h4>
              <div data-entry-panel></div>
            </div>
            <div class="sidebar-section" data-bg-settings-section style="${doc.canvas.background.type === 'image' ? '' : 'display:none;'}">
              <h4>Zemin Görseli Ayarları</h4>
              <div data-bg-settings-panel></div>
            </div>
            <div class="sidebar-section">
              <h4>Katmanlar</h4>
              <div data-layers-panel></div>
            </div>
            <div class="sidebar-section" data-responsive-section>
              <h4>Masaüstü Düzeni</h4>
              <div data-responsive-panel></div>
            </div>
            <div class="sidebar-section" data-prop-section>
              <h4>Özellikler</h4>
              <div data-prop-panel><p class="sidebar-empty">Düzenlemek için bir katman seçin.</p></div>
            </div>
          </aside>
        </div>
      </div>
    `;

    const canvasEl = appRoot.querySelector("[data-canvas]");
    const scaleWrapEl = appRoot.querySelector("[data-scale-wrap]");
    const previewFrameEl = appRoot.querySelector("[data-preview-frame]");
    const layersPanelEl = appRoot.querySelector("[data-layers-panel]");
    const propPanelEl = appRoot.querySelector("[data-prop-panel]");
    const entryPanelEl = appRoot.querySelector("[data-entry-panel]");
    const responsivePanelEl = appRoot.querySelector("[data-responsive-panel]");
    const saveStatusEl = appRoot.querySelector("[data-save-status]");

    /* ---------------- MADDE 4: GERİ AL / İLERİ AL (GEÇMİŞ) ----------------
       Basit ama güvenilir bir "anlık görüntü" (snapshot) tabanlı geçmiş:
       her anlamlı değişiklik tamamlandığında (scheduleAutosave'in GERÇEKTEN
       kaydettiği an — bkz. aşağıda) belgenin TAMAMININ bir JSON kopyası
       geçmişe eklenir. Bu, taşıma/boyut/metin/renk/öğe ekleme-silme gibi
       TÜM işlem türlerini TEK bir mekanizmayla kapsar — her işlem türü
       için ayrı kod yazmaya gerek kalmaz. "doc" nesnesinin kendisi asla
       yeniden ATANMAZ (birçok kapanış/closure aynı referansı tutuyor) —
       bunun yerine içeriği YERİNDE (in place) değiştirilir.
       Masaüstü/telefon geçmişi KARIŞMAZ: her anlık görüntü, o anki HEM
       mobil (layer.x/y/w/h) HEM masaüstü (layer.desktopOverride) alanlarını
       birlikte içerir — bu yüzden geri alma, hangi ekran boyutunda
       yapıldığına bakılmaksızın doğru alanı doğru şekilde eski haline
       döndürür. */
    const MAX_HISTORY = 60;
    let undoStack = [JSON.stringify(doc)]; // ilk kayıt: belge açıldığındaki hâli
    let redoStack = [];
    let isRestoringHistory = false;

    function pushHistorySnapshot() {
      if (isRestoringHistory) return; // geri/ileri alma SIRASINDA yeni kayıt eklenmez
      const snapshot = JSON.stringify(doc);
      if (snapshot === undoStack[undoStack.length - 1]) return; // gerçek bir değişiklik yoksa ekleme
      undoStack.push(snapshot);
      if (undoStack.length > MAX_HISTORY) undoStack.shift();
      redoStack = []; // yeni bir değişiklik, ileri geçmişini geçersiz kılar
      updateUndoRedoButtons();
    }

    function restoreDocFrom(snapshotJson) {
      const snapshot = JSON.parse(snapshotJson);
      Object.keys(doc).forEach(k => { delete doc[k]; });
      Object.assign(doc, snapshot);
      if (!doc.layers.some(l => l.id === selectedLayerId)) selectedLayerId = null;
    }

    function refreshAllUI() {
      fullCanvasRender();
      refreshSidebar();
      renderEntryPanel();
      renderBgSettingsPanel();
      appRoot.querySelector("[data-title-input]").value = doc.meta.title || "";
      const bgColorInput = appRoot.querySelector("[data-bg-color]");
      if (bgColorInput && doc.canvas.background.type === "color") bgColorInput.value = doc.canvas.background.value;
      const deleteBtn = appRoot.querySelector("[data-delete-selected]");
      if (deleteBtn) deleteBtn.disabled = !selectedLayerId;
      applySelectionClass();
    }

    function undo() {
      if (undoStack.length < 2) return; // geri alınacak bir şey yok
      isRestoringHistory = true;
      const current = undoStack.pop();
      redoStack.push(current);
      restoreDocFrom(undoStack[undoStack.length - 1]);
      refreshAllUI();
      scheduleAutosave(true);
      isRestoringHistory = false;
      updateUndoRedoButtons();
    }

    function redo() {
      if (!redoStack.length) return;
      isRestoringHistory = true;
      const next = redoStack.pop();
      undoStack.push(next);
      restoreDocFrom(next);
      refreshAllUI();
      scheduleAutosave(true);
      isRestoringHistory = false;
      updateUndoRedoButtons();
    }

    function updateUndoRedoButtons() {
      const undoBtn = appRoot.querySelector("[data-undo]");
      const redoBtn = appRoot.querySelector("[data-redo]");
      if (undoBtn) undoBtn.disabled = undoStack.length < 2;
      if (redoBtn) redoBtn.disabled = redoStack.length === 0;
    }

    /* ---------------- CANVAS RENDER + SCALE ---------------- */
    function fullCanvasRender() {
      SeozRenderer.renderDocument(doc, canvasEl, "edit", currentBreakpoint);
      applyScaleAndHeight();
      applySelectionClass();
    }

    function applyScaleAndHeight() {
      SeozLayoutEngine.recalcCanvasHeight(canvasEl, doc.canvas.minHeight);
      currentScale = SeozLayoutEngine.applyScale(canvasEl, scaleWrapEl, doc.canvas.baseWidth);
    }

    function applySelectionClass() {
      canvasEl.querySelectorAll("[data-layer-id]").forEach(node => {
        node.classList.toggle("selected", node.dataset.layerId === selectedLayerId);
      });
    }

    function updateLayerPosition(layer) {
      const node = canvasEl.querySelector(`[data-layer-id="${layer.id}"]`);
      if (!node) return;
      const geo = SeozDocModel.resolveGeometry(layer, currentBreakpoint);
      node.style.left = geo.x + "px";
      node.style.top = geo.y + "px";
      node.style.width = geo.w + "px";
      node.style.zIndex = String(layer.z || 1);
      if (layer.type === "image" || layer.type === "module") node.style.height = geo.h + "px";
      applyScaleAndHeight();
    }

    function updateLayerDOM(layer) {
      updateLayerPosition(layer);
      const node = canvasEl.querySelector(`[data-layer-id="${layer.id}"]`);
      if (!node) return;
      if (layer.type === "text") {
        const textNode = node.querySelector(".seoz-text-content");
        if (textNode) SeozRenderer.applyTextStyle(textNode, layer.content);
      }
      if (layer.type === "image") {
        const imgNode = node.querySelector(".seoz-image-content");
        if (imgNode && imgNode.dataset.srcRef !== layer.content.src) {
          imgNode.dataset.srcRef = layer.content.src;
          SeozBlobStore.resolveToObjectURL(layer.content.src).then(url => { imgNode.src = url; });
        }
      }
      if (layer.type === "module") {
        // Ayarlar değiştiği için modülün içeriğini YENİDEN kuruyoruz. Önce
        // varsa eski "canlı" zamanlayıcıyı (geri sayım vb.) temizliyoruz —
        // aksi halde eski aralık görünmez şekilde çalışmaya devam eder.
        const host = node.querySelector(".seoz-module-content");
        if (host) {
          SeozRenderer.clearIntervalsWithin(host);
          host.innerHTML = "";
          const moduleDef = SeozModuleRegistry.getModule(layer.moduleId);
          if (moduleDef) host.appendChild(moduleDef.render(layer.settings, "edit", { docId: doc.id, layerId: layer.id }));
        }
      }
      applyScaleAndHeight();
    }

    /* ---------------- SIDEBAR ---------------- */
    function renderLayersPanel() {
      SeozLayersPanel.render(layersPanelEl, doc, selectedLayerId, {
        selectLayer: selectLayer,
        deleteLayer: deleteLayer
      });
    }

    function renderPropPanel() {
      const layer = doc.layers.find(l => l.id === selectedLayerId);
      if (!layer) {
        propPanelEl.innerHTML = `<p class="sidebar-empty">Düzenlemek için bir katman seçin.</p>`;
        return;
      }
      if (layer.type === "text") {
        SeozTextPanel.render(propPanelEl, layer, {
          onChange: () => { updateLayerDOM(layer); renderLayersPanel(); scheduleAutosave(); },
          onDuplicate: () => duplicateLayer(layer),
          onDelete: () => deleteLayer(layer.id),
          onBringFront: () => reorderLayer(layer, "front"),
          onSendBack: () => reorderLayer(layer, "back")
        });
      }
      if (layer.type === "image") {
        SeozImagePanel.render(propPanelEl, layer, {
          onChange: () => { updateLayerDOM(layer); renderLayersPanel(); scheduleAutosave(); },
          onImageReplaced: () => { updateLayerDOM(layer); renderPropPanel(); scheduleAutosave(true); },
          onDuplicate: () => duplicateLayer(layer),
          onDelete: () => deleteLayer(layer.id),
          onBringFront: () => reorderLayer(layer, "front"),
          onSendBack: () => reorderLayer(layer, "back")
        });
      }
      if (layer.type === "module") {
        // ANKET MODÜLÜ (poll.js): sınırsız soru/seçenek yönetimi genel
        // module-panel.js'in basit alan şemasına sığmadığı için, tıpkı
        // Giriş Sahnesi'nin kendi özel paneli olduğu gibi, kendi özel
        // panelini (poll-panel.js) kullanır. Diğer TÜM modüller
        // (Konum, RSVP, Müzik, Anı Yükle, Galeri, Kutlama, Geri Sayım)
        // AYNEN eskisi gibi genel module-panel.js'i kullanmaya devam
        // eder — bu satır SADECE "poll" id'li katmanlar için devreye
        // girer.
        if (layer.moduleId === "poll") {
          SeozPollPanel.render(propPanelEl, layer, {
            onSettingsChange: () => { updateLayerDOM(layer); renderLayersPanel(); scheduleAutosave(); },
            onDuplicate: () => duplicateLayer(layer),
            onDelete: () => deleteLayer(layer.id),
            onBringFront: () => reorderLayer(layer, "front"),
            onSendBack: () => reorderLayer(layer, "back")
          });
        } else {
          SeozModulePanel.render(propPanelEl, layer, {
            onSettingsChange: () => { updateLayerDOM(layer); renderLayersPanel(); scheduleAutosave(); },
            onDuplicate: () => duplicateLayer(layer),
            onDelete: () => deleteLayer(layer.id),
            onBringFront: () => reorderLayer(layer, "front"),
            onSendBack: () => reorderLayer(layer, "back")
          });
        }
      }
    }

    function refreshSidebar() {
      renderLayersPanel();
      renderPropPanel();
      renderResponsivePanel();
    }

    /* ---------------- FAZ 8: MASAÜSTÜ DÜZENİ ---------------- */
    function renderResponsivePanel() {
      const layer = doc.layers.find(l => l.id === selectedLayerId) || null;
      SeozResponsivePanel.render(responsivePanelEl, layer, currentBreakpoint, {
        onEnableOverride: () => {
          if (!layer) return;
          SeozDocModel.setGeometry(layer, "desktop", {});
          updateLayerPosition(layer);
          renderResponsivePanel();
          scheduleAutosave(true);
        },
        onResetOverride: () => {
          if (!layer) return;
          SeozDocModel.clearDesktopOverride(layer);
          updateLayerPosition(layer);
          renderResponsivePanel();
          scheduleAutosave(true);
        }
      });
    }

    /* ---------------- GİRİŞ SAHNESİ ---------------- */
    function renderEntryPanel() {
      SeozEntryPanel.render(entryPanelEl, doc, {
        onChange: () => scheduleAutosave(true),
        onReplay: () => SeozEntryScene.play(doc, () => {})
      });
    }

    /* ---------------- EK MADDE (SON DÜZELTME): ZEMİN GÖRSELİ AYARLARI ----------------
       Yalnızca zemin bir GÖRSEL iken görünür. 4 kontrol: Ölçek (büyüt/
       küçült, en-boy oranı korunur), Yükseklik (isteğe bağlı, bağımsız
       dikey esneme — uzun içerikte alt/üstte boşluk kalmasını önlemek
       için bilinçli bir ek kontrol), Yatay/Dikey Konum (0-100, 50=orta —
       üstteki boşluğu kaldırmak için Dikey Konum'u küçültmek yeterlidir). */
    function renderBgSettingsPanel() {
      const bgPanelEl = appRoot.querySelector("[data-bg-settings-panel]");
      const sectionEl = appRoot.querySelector("[data-bg-settings-section]");
      if (!bgPanelEl || !sectionEl) return;

      const isImage = doc.canvas.background.type === "image";
      sectionEl.style.display = isImage ? "" : "none";
      if (!isImage) return;

      const bg = doc.canvas.background;
      bg.scale = bg.scale != null ? bg.scale : 100;
      bg.heightPercent = bg.heightPercent != null ? bg.heightPercent : 100;
      bg.offsetX = bg.offsetX != null ? bg.offsetX : 50;
      bg.offsetY = bg.offsetY != null ? bg.offsetY : 50;

      bgPanelEl.innerHTML = `
        <div class="field">
          <label style="font-size:.76rem;color:var(--ink-soft);margin-bottom:5px;display:block;">Zemin Boyutu / Ölçek</label>
          <div class="numeric-with-unit">
            <input type="number" data-bg-scale value="${bg.scale}" min="50" max="300">
            <span>%</span>
          </div>
        </div>
        <div class="field" style="margin-top:10px;">
          <label style="font-size:.76rem;color:var(--ink-soft);margin-bottom:5px;display:block;">Zemin Yüksekliği (bağımsız, isteğe bağlı)</label>
          <div class="numeric-with-unit">
            <input type="number" data-bg-height value="${bg.heightPercent}" min="50" max="300">
            <span>%</span>
          </div>
        </div>
        <div class="field" style="margin-top:10px;">
          <label style="font-size:.76rem;color:var(--ink-soft);margin-bottom:5px;display:block;">Zemin Yatay Konum</label>
          <input type="range" data-bg-offset-x value="${bg.offsetX}" min="0" max="100">
        </div>
        <div class="field" style="margin-top:10px;">
          <label style="font-size:.76rem;color:var(--ink-soft);margin-bottom:5px;display:block;">Zemin Dikey Konum</label>
          <input type="range" data-bg-offset-y value="${bg.offsetY}" min="0" max="100">
          <p style="font-size:.72rem;color:var(--ink-soft);margin-top:6px;">
            Üstte istenmeyen boşluk varsa bu değeri küçültün (görseli yukarı kaydırır).
          </p>
        </div>
        <button type="button" class="btn btn-outline" data-bg-reset-position style="width:100%;margin-top:10px;">
          Ölçek/Konumu Sıfırla
        </button>
      `;

      function applyAndSave() {
        SeozRenderer.applyCanvasBackground(canvasEl, doc.canvas.background, "edit");
        scheduleAutosave();
      }

      bgPanelEl.querySelector("[data-bg-scale]").addEventListener("input", (e) => {
        bg.scale = parseInt(e.target.value, 10) || 100;
        applyAndSave();
      });
      bgPanelEl.querySelector("[data-bg-height]").addEventListener("input", (e) => {
        bg.heightPercent = parseInt(e.target.value, 10) || 100;
        applyAndSave();
      });
      bgPanelEl.querySelector("[data-bg-offset-x]").addEventListener("input", (e) => {
        bg.offsetX = parseInt(e.target.value, 10);
        applyAndSave();
      });
      bgPanelEl.querySelector("[data-bg-offset-y]").addEventListener("input", (e) => {
        bg.offsetY = parseInt(e.target.value, 10);
        applyAndSave();
      });
      bgPanelEl.querySelector("[data-bg-reset-position]").addEventListener("click", () => {
        bg.scale = 100; bg.heightPercent = 100; bg.offsetX = 50; bg.offsetY = 50;
        renderBgSettingsPanel();
        applyAndSave();
      });
    }

    /* ---------------- SELECTION ---------------- */
    function selectLayer(id) {
      selectedLayerId = id;
      applySelectionClass();
      refreshSidebar();
      // MADDE 4: seçili öğe yoksa "Sil" butonu da pasif olsun.
      const deleteBtn = appRoot.querySelector("[data-delete-selected]");
      if (deleteBtn) deleteBtn.disabled = !selectedLayerId;
    }

    /* ---------------- LAYER OPERATIONS ---------------- */
    function addTextLayer() {
      const layer = SeozDocModel.createTextLayer({ z: SeozDocModel.nextZ(doc) });
      doc.layers.push(layer);
      fullCanvasRender();
      selectLayer(layer.id);
      scheduleAutosave(true);
    }

    function addImageLayer(file) {
      SeozImageUtils.processImageFile(file).then(result => {
        // Görsel canvas genişliğinden büyükse, canvas'a orantılı sığdır.
        const maxW = doc.canvas.baseWidth - 60;
        let w = result.naturalWidth;
        let h = result.naturalHeight;
        if (w > maxW) {
          const ratio = maxW / w;
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        const layer = SeozDocModel.createImageLayer({
          z: SeozDocModel.nextZ(doc),
          x: Math.round((doc.canvas.baseWidth - w) / 2),
          y: 40,
          w, h,
          content: {
            src: result.ref,
            naturalWidth: result.naturalWidth,
            naturalHeight: result.naturalHeight,
            lockAspect: true
          }
        });
        doc.layers.push(layer);
        fullCanvasRender();
        selectLayer(layer.id);
        scheduleAutosave(true);
      }).catch(() => alert("Görsel yüklenemedi. Lütfen PNG, JPG veya WebP deneyin."));
    }

    function addModuleLayer(moduleId) {
      const moduleDef = SeozModuleRegistry.getModule(moduleId);
      if (!moduleDef) return;
      const size = moduleDef.defaultLayerSize || { w: 240, h: 120 };
      const layer = SeozDocModel.createModuleLayer(moduleId, moduleDef.defaultSettings, {
        z: SeozDocModel.nextZ(doc),
        x: Math.round((doc.canvas.baseWidth - size.w) / 2),
        y: 60,
        w: size.w,
        h: size.h
      });
      doc.layers.push(layer);
      fullCanvasRender();
      selectLayer(layer.id);
      scheduleAutosave(true);
    }

    function duplicateLayer(layer) {
      const copy = JSON.parse(JSON.stringify(layer));
      copy.id = SeozDocModel.generateId("layer");
      copy.x += 16; copy.y += 16;
      copy.z = SeozDocModel.nextZ(doc);
      doc.layers.push(copy);
      fullCanvasRender();
      selectLayer(copy.id);
      scheduleAutosave(true);
    }

    function deleteLayer(id) {
      doc.layers = doc.layers.filter(l => l.id !== id);
      if (selectedLayerId === id) selectedLayerId = null;
      fullCanvasRender();
      refreshSidebar();
      scheduleAutosave(true);
      const deleteBtn = appRoot.querySelector("[data-delete-selected]");
      if (deleteBtn) deleteBtn.disabled = !selectedLayerId;
    }

    function reorderLayer(layer, dir) {
      if (dir === "front") layer.z = SeozDocModel.nextZ(doc);
      else layer.z = Math.min.apply(null, doc.layers.map(l => l.z || 0)) - 1;
      updateLayerPosition(layer);
      renderLayersPanel();
      scheduleAutosave();
    }

    /* ---------------- AUTOSAVE ---------------- */
    function scheduleAutosave(immediate) {
      saveStatusEl.textContent = "Kaydediliyor...";
      clearTimeout(saveTimer);
      const doSave = () => {
        try {
          SeozStorage.saveDraft(doc);
          saveStatusEl.textContent = "Kaydedildi • " + new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
          // MADDE 4: belge GERÇEKTEN kaydedildiği an (yani değişiklik
          // "yerleşti" — ne her piksel sürüklemede, ne her tuş
          // vuruşunda) bir geçmiş anlık görüntüsü eklenir.
          pushHistorySnapshot();
        } catch (err) {
          // Büyük olasılıkla tarayıcı depolama sınırı aşıldı (ör. çok büyük
          // bir video/görsel). Sessizce veri kaybetmek yerine açıkça bildir.
          saveStatusEl.textContent = "⚠ Kaydedilemedi (depolama dolu)";
          alert(
            "Kaydedilemedi — muhtemelen tarayıcı depolama sınırına ulaşıldı " +
            "(genelde 5-10MB). Büyük bir video veya çok sayıda yüksek " +
            "çözünürlüklü görsel eklemiş olabilirsiniz. Son eklediğiniz " +
            "dosyayı kaldırıp tekrar deneyin, ya da daha küçük bir dosya kullanın."
          );
        }
      };
      if (immediate) doSave(); else saveTimer = setTimeout(doSave, 700);
    }

    /* ---------------- INTERACTIONS ---------------- */
    SeozDragResize.attachInteractions(canvasEl, doc, {
      selectLayer: selectLayer,
      onLayerChange: (layer) => { updateLayerPosition(layer); renderResponsivePanel(); scheduleAutosave(); },
      onDragEnd: () => { renderLayersPanel(); scheduleAutosave(true); },
      getScale: () => currentScale,
      getBreakpoint: () => currentBreakpoint
    });

    window.addEventListener("resize", applyScaleAndHeight);

    /* ---------------- TOPBAR ---------------- */
    appRoot.querySelector("[data-back]").addEventListener("click", () => {
      SeozStorage.saveDraft(doc);
      goToLibrary();
    });
    appRoot.querySelector("[data-title-input]").addEventListener("input", (e) => {
      doc.meta.title = e.target.value || "Adsız Davetiye";
      scheduleAutosave();
    });

    /* ---------------- MADDE 4: GERİ AL / İLERİ AL / SİL — buton + klavye ---------------- */
    appRoot.querySelector("[data-undo]").addEventListener("click", undo);
    appRoot.querySelector("[data-redo]").addEventListener("click", redo);
    appRoot.querySelector("[data-delete-selected]").addEventListener("click", () => {
      if (selectedLayerId) deleteLayer(selectedLayerId);
    });
    updateUndoRedoButtons();
    appRoot.querySelector("[data-delete-selected]").disabled = !selectedLayerId;

    function isTypingInField(target) {
      if (!target) return false;
      const tag = target.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
    }

    document.addEventListener("keydown", (e) => {
      // Editör ekranından ayrılınca (kütüphaneye dönünce) bu dinleyicinin
      // hâlâ tetiklenmemesi için — appRoot artık bu editörün DOM'unu
      // içermiyorsa sessizce çık.
      if (!appRoot.contains(document.activeElement) && document.activeElement !== document.body) return;

      const ctrlOrCmd = e.ctrlKey || e.metaKey;
      if (ctrlOrCmd && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
        return;
      }
      if ((ctrlOrCmd && e.key.toLowerCase() === "y") || (ctrlOrCmd && e.shiftKey && e.key.toLowerCase() === "z")) {
        e.preventDefault();
        redo();
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedLayerId && !isTypingInField(e.target)) {
        e.preventDefault();
        deleteLayer(selectedLayerId);
      }
    });

    appRoot.querySelector("[data-add-text]").addEventListener("click", addTextLayer);

    const addImageInput = appRoot.querySelector("[data-add-image-input]");
    appRoot.querySelector("[data-add-image]").addEventListener("click", () => addImageInput.click());
    addImageInput.addEventListener("change", () => {
      const file = addImageInput.files[0];
      if (file) addImageLayer(file);
      addImageInput.value = "";
    });

    const moduleSelect = appRoot.querySelector("[data-add-module]");
    SeozModuleRegistry.listModules().forEach(m => {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = m.label;
      moduleSelect.appendChild(opt);
    });
    moduleSelect.addEventListener("change", () => {
      if (moduleSelect.value) {
        addModuleLayer(moduleSelect.value);
        moduleSelect.value = "";
      }
    });

    /* ---------------- ZEMİN (canvas.background) ---------------- */
    function applyBackgroundUpdate() {
      SeozRenderer.applyCanvasBackground(canvasEl, doc.canvas.background);
      renderBgSettingsPanel();
      scheduleAutosave(true);
    }

    const bgInput = appRoot.querySelector("[data-change-bg-input]");
    appRoot.querySelector("[data-change-bg]").addEventListener("click", () => bgInput.click());
    bgInput.addEventListener("change", () => {
      const file = bgInput.files[0];
      if (!file) return;
      // EK MADDE — ZEMİN PNG OTOMATİK ÜST/ALT RENK TAMAMLAMA: yalnızca
      // zemin yüklemesinde processImageFile YERİNE processBackgroundImageFile
      // kullanılır — bu, aynı işi yapar ve EK olarak üst/alt kenar
      // renklerini de otomatik hesaplar. Diğer tüm görsel yükleme
      // yolları (içerik/kart görselleri) processImageFile'ı DEĞİŞMEDEN
      // kullanmaya devam eder.
      SeozImageUtils.processBackgroundImageFile(file).then(result => {
        doc.canvas.background = {
          type: "image", value: result.ref,
          scale: 100, heightPercent: 100, offsetX: 50, offsetY: 50,
          topColor: result.topColor, bottomColor: result.bottomColor
        };
        applyBackgroundUpdate();
      }).catch(() => alert("Zemin görseli yüklenemedi. Lütfen PNG, JPG veya WebP deneyin."));
      bgInput.value = "";
    });

    appRoot.querySelector("[data-reset-bg]").addEventListener("click", () => {
      const colorInput = appRoot.querySelector("[data-bg-color]");
      doc.canvas.background = { type: "color", value: colorInput.value || "#FBF8F2" };
      applyBackgroundUpdate();
    });

    appRoot.querySelector("[data-bg-color]").addEventListener("input", (e) => {
      doc.canvas.background = { type: "color", value: e.target.value };
      applyBackgroundUpdate();
    });

    appRoot.querySelectorAll("[data-bp]").forEach(btn => {
      btn.addEventListener("click", () => {
        appRoot.querySelectorAll("[data-bp]").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const bp = btn.getAttribute("data-bp") === "desktop" ? "desktop" : "mobile";
        currentBreakpoint = bp;
        // FAZ 8: Bu artık yalnızca kozmetik bir önizleme çerçevesi değil —
        // "desktop" seçilince, masaüstü override'ı etkin olan katmanlar
        // kendi konum/boyutlarında, diğerleri mobil ile aynı orantılı
        // konumda çizilir (bkz. SeozDocModel.resolveGeometry).
        previewWidth = bp === "desktop" ? 900 : 430;
        previewFrameEl.style.maxWidth = previewWidth + "px";
        fullCanvasRender();
        renderResponsivePanel();
      });
    });

    appRoot.querySelector("[data-export]").addEventListener("click", () => {
      const json = SeozStorage.exportJSON(doc.id);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = (doc.meta.title || "davetiye").replace(/[^a-z0-9ığüşöç\-_]+/gi, "-") + ".json";
      a.click();
      URL.revokeObjectURL(url);
    });

    appRoot.querySelector("[data-export-package]").addEventListener("click", async () => {
      const btn = appRoot.querySelector("[data-export-package]");
      const originalLabel = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Hazırlanıyor...";
      try {
        const result = await SeozExportPackage.buildPackageZip(doc);
        const url = URL.createObjectURL(result.blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = (doc.meta.title || "davetiye").replace(/[^a-z0-9ığüşöçİĞÜŞÖÇ\-_]+/gi, "-") + "-yayin-paketi.zip";
        a.click();
        URL.revokeObjectURL(url);
        showToast(`Yayın paketi indirildi (${result.resolvedCount}/${result.totalRefs} medya dosyası paketlendi).`);
      } catch (err) {
        alert("Yayın paketi oluşturulamadı: " + (err && err.message ? err.message : "bilinmeyen bir hata oluştu."));
      } finally {
        btn.disabled = false;
        btn.textContent = originalLabel;
      }
    });

    appRoot.querySelector("[data-publish]").addEventListener("click", () => {
      const doPublish = () => {
        // 1) MEVCUT YEREL YAYIN — değişmedi.
        try {
          SeozStorage.saveDraft(doc);
          SeozPublish.publishDocument(doc.id);
        } catch (err) {
          // FAZ 9: sessizce başarısız olmak yerine açıkça bildir — büyük
          // olasılıkla tarayıcı depolama sınırına ulaşıldı.
          alert(
            "Yayınlanamadı — muhtemelen tarayıcı depolama sınırına ulaşıldı. " +
            "Büyük bir video/görsel kaldırıp tekrar deneyin."
          );
          return;
        }

        // Supabase ayarlı değilse eski davranış birebir korunur.
        if (!SeozPublish.isCloudConfigured()) {
          showToast("Yayınlandı — görüntülemek için: " + SeozPublish.viewURLFor(doc.id));
          return;
        }

        // 2) SUPABASE YAYINI — gerçek müşteri bağlantısı.
        const btn = appRoot.querySelector("[data-publish]");
        const originalLabel = btn.textContent;
        btn.disabled = true;
        btn.textContent = "Yayınlanıyor...";
        SeozPublish.publishToCloud(doc.id, (msg) => { btn.textContent = msg; })
          .then(result => {
            showToast("Yayınlandı. Müşteri bağlantısı: " + result.url);
            // prompt kutusu bağlantıyı seçilebilir/kopyalanabilir gösterir.
            prompt("Yayınlandı. Müşteri bağlantısı:", result.url);
          })
          .catch(err => {
            console.error("[Studio SEOZ] Supabase yayını başarısız:", err);
            alert(
              "Yayın sırasında hata oluştu.\n\n" +
              (err && err.message ? err.message : "Bilinmeyen hata.") +
              "\n\n(Yerel yayın kaydedildi; taslağınız güvende.)"
            );
          })
          .finally(() => {
            btn.disabled = false;
            btn.textContent = originalLabel;
          });
      };

      const warnings = SeozPublish.validateForPublish(doc);
      if (warnings.length) {
        const proceed = confirm(
          "Yayınlamadan önce şunları kontrol etmek isteyebilirsiniz:\n\n- " +
          warnings.join("\n- ") +
          "\n\nYine de yayınlamak istiyor musunuz?"
        );
        if (!proceed) return;
      }
      doPublish();
    });

    /* ---------------- İLK ÇİZİM ---------------- */
    fullCanvasRender();
    refreshSidebar();
    renderEntryPanel();
    renderBgSettingsPanel();
  }

  function showToast(msg) {
    let toast = document.querySelector(".publish-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "publish-toast";
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 4000);
  }

  function escapeAttr(str) {
    return String(str || "").replace(/"/g, "&quot;");
  }

  window.addEventListener("hashchange", route);
  document.addEventListener("DOMContentLoaded", route);
})();
