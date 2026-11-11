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
    if (typeof SeozCloudStore !== "undefined" && SeozCloudStore.currentSlug) return SeozCloudStore.currentSlug() || null;
    const params = new URLSearchParams(window.location.search);
    if (params.get("slug")) return params.get("slug");
    // KISA BAĞLANTI: alan-adı/<slug> (bkz. functions/[slug].js). ?doc= varsa eski yöntem.
    if (params.get("doc")) return null;
    const m = window.location.pathname.toLowerCase().match(/^\/([a-z0-9][a-z0-9-]{1,78}[a-z0-9])\/?$/);
    return m && ["view", "index", "panel"].indexOf(m[1]) < 0 ? m[1] : null;
  }

  /* Davetiye dili: belge yüklenmeden önceki mesajlar için sunucunun sayfaya yazdığı dil
     (functions/[slug].js → <html data-invite-lang="en">); yoksa Türkçe (eskisi gibi). */
  const I = window.SeozInviteI18n;
  if (I) I.setLang(document.documentElement.getAttribute("data-invite-lang"));
  const L = (t) => (I ? I.L(t) : t);
  function showMessage(html) {
    stage.innerHTML = `<div class="view-message">${L(html)}</div>`;
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
          // Yayınlanmış davetiyenin adı: modüller sitenin kendi adreslerini kurarken kullanır
          // (ör. iPhone'da Apple Takvim → /takvim/<slug>/<katman>.ics).
          window.SeozPublishedSlug = slug;
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
    if (I) { I.setLang(doc.meta && doc.meta.lang); document.documentElement.lang = I.lang(); }

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

    // MÜZİK: açılış ekranına (zarf / sinematik açılış) yapılan İLK dokunuşta, aynı dokunuşla
    // müzik başlatılmaya çalışılır (iPhone/Android sesi yalnızca dokunuş anında açar).
    // Tarayıcı izin vermezse sessizce geçilir; misafir nota düğmesiyle başlatır. Bir kez çalışır;
    // misafir müziği kapattıysa tekrar açmaz. Açılış ekranı yoksa eskisi gibi yalnızca düğmeyle.
    const M = window.SeozMusic;
    let stopMusicHook = () => {};
    if (M && SeozEntryScene.hasUsableEntry(doc.entry) && M.prepare(doc)) {
      const EVENTS = ["touchend", "pointerup", "click", "keydown"];
      const onGesture = (e) => {
        if (e.type === "keydown" && (e.key === "Escape" || e.key === "Tab")) return;
        stopMusicHook();
        M.startFromGesture(doc);
      };
      stopMusicHook = () => EVENTS.forEach(ev => window.removeEventListener(ev, onGesture, true));
      EVENTS.forEach(ev => window.addEventListener(ev, onGesture, true));
    }

    SeozEntryScene.initEntryScene(doc, () => {
      stopMusicHook();   // açılış bitti: sonraki dokunuşlar müziği kendiliğinden başlatmaz
      renderAndScale();
      // DÜZELTME (telefonda yazı yazılamıyordu): Telefon klavyesi açılınca
      // yalnızca ekran YÜKSEKLİĞİ değişir; sayfa yeniden çizilirse yazı kutusu
      // kaybolur ve klavye kapanır. Artık yalnızca GENİŞLİK değişince
      // (telefonu yan çevirme, pencere boyutu) yeniden çizilir.
      let lastWidth = window.innerWidth;
      window.addEventListener("resize", () => {
        if (window.innerWidth === lastWidth) return;
        lastWidth = window.innerWidth;
        renderAndScale();
      });
      if (doc.entry && doc.entry.allowReplayForGuest && SeozEntryScene.hasUsableEntry(doc.entry)) {
        addReplayButton(doc);
      }
    });
  }

  function addReplayButton(doc) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "seoz-replay-btn";
    btn.textContent = L("↺ Baştan İzle");
    btn.addEventListener("click", () => SeozEntryScene.play(doc, () => {}));
    document.body.appendChild(btn);
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
