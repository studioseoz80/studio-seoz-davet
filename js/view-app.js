/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — view-app.js (yalnızca view.html)
   -----------------------------------------------------------------------------
   Bu dosya kasıtlı olarak js/editor/ klasöründeki HİÇBİR dosyayı
   kullanmaz/import etmez. Böylece müşteri tarafında panel, sürükleme
   tutamacı veya düzenleme kodu yapısal olarak hiç var olmaz.

   Yalnızca YAYINLANMIŞ sürümü okur — asla taslağı değil:
   - view.html?slug=...  → Supabase (SeozCloudStore.loadPublishedBySlug)
   - view.html?doc=...   → bu tarayıcının localStorage'ı (eski yöntem)
   Siz düzenlemeye devam etseniz bile müşteri, siz tekrar
   "Yayına Hazırla" demeden burada eski (yayınlanan) hâli görür.
   ========================================================================= */

(function () {
  "use strict";

  const stage = document.getElementById("stage");

  // FAZ 8: gerçek tarayıcı genişliğine göre breakpoint belirlenir. 640px
  // ve üzeri "desktop" sayılır — bu eşiğin altında (çoğu telefon) "mobile".
  const DESKTOP_BREAKPOINT_PX = 640;
  function currentBreakpoint() {
    return window.innerWidth >= DESKTOP_BREAKPOINT_PX ? "desktop" : "mobile";
  }

  function getDocId() {
    const params = new URLSearchParams(window.location.search);
    return params.get("doc");
  }

  // SUPABASE: gerçek müşteri bağlantısı view.html?slug=...
  function getSlug() {
    const params = new URLSearchParams(window.location.search);
    return params.get("slug");
  }

  function showMessage(html) {
    stage.innerHTML = `<div class="view-message">${html}</div>`;
  }

  function boot() {
    // 1) ?slug= → Supabase'den oku.
    const slug = getSlug();
    if (slug) {
      if (typeof SeozCloudStore === "undefined" || !SeozCloudStore.isConfigured()) {
        showMessage("Davetiye bulunamadı veya henüz yayınlanmadı.");
        return;
      }
      showMessage("Davetiye yükleniyor...");
      SeozCloudStore.loadPublishedBySlug(slug)
        .then(data => {
          const doc = data && !SeozDocModel.validateDocument(data).length
            ? SeozDocModel.sanitizeDocument(data)
            : null;
          if (!doc) {
            showMessage("Davetiye bulunamadı veya henüz yayınlanmadı.");
            return;
          }
          start(doc);
        })
        .catch(err => {
          console.error("[Studio SEOZ] Davetiye yüklenemedi:", err);
          showMessage("Davetiye şu anda yüklenemedi.<br>Lütfen internet bağlantınızı kontrol edip sayfayı yenileyin.");
        });
      return;
    }

    // 2) ?doc= → MEVCUT localStorage davranışı (değişmedi).
    const id = getDocId();
    if (!id) {
      showMessage("Bu bağlantı bir davetiyeye işaret etmiyor.");
      return;
    }
    const doc = SeozStorage.loadPublished(id);
    if (!doc) {
      showMessage("Bu davetiye henüz yayınlanmadı ya da bulunamadı.");
      return;
    }
    start(doc);
  }

  function start(doc) {
    document.title = doc.meta.title + " — Studio SEOZ";

    stage.innerHTML = `
      <div class="seoz-canvas-outer seoz-view-outer">
        <div class="seoz-canvas-scale-wrap" data-scale-wrap>
          <div class="seoz-canvas" data-canvas></div>
        </div>
      </div>
    `;
    const canvasEl = stage.querySelector("[data-canvas]");
    const scaleWrapEl = stage.querySelector("[data-scale-wrap]");

    function renderAndScale() {
      SeozRenderer.renderDocument(doc, canvasEl, "view", currentBreakpoint());
      SeozLayoutEngine.applyScale(canvasEl, scaleWrapEl, doc.canvas.baseWidth);
    }

    SeozEntryScene.initEntryScene(doc, () => {
      renderAndScale();
      window.addEventListener("resize", renderAndScale);
      if (doc.entry && doc.entry.allowReplayForGuest && SeozEntryScene.hasUsableEntry(doc.entry)) {
        addReplayButton(doc);
      }
    });
  }

  function addReplayButton(doc) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "seoz-replay-btn";
    btn.textContent = "↺ Baştan İzle";
    btn.addEventListener("click", () => SeozEntryScene.play(doc, () => {}));
    document.body.appendChild(btn);
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
