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
    return m && ["view", "index", "panel", "onizleme"].indexOf(m[1]) < 0 ? m[1] : null;
  }

  /* Davetiye dili: belge yüklenmeden önceki mesajlar için sunucunun sayfaya yazdığı dil
     (functions/[slug].js → <html data-invite-lang="en">); yoksa Türkçe (eskisi gibi). */
  const I = window.SeozInviteI18n;
  if (I) I.setLang(document.documentElement.getAttribute("data-invite-lang"));
  const L = (t, v) => (I ? I.L(t, v) : String(t).replace(/\{(\w+)\}/g, (m, k) => (v && v[k] != null ? v[k] : m)));
  function showMessage(html) {
    stage.innerHTML = `<div class="view-message">${L(html)}</div>`;
  }

  /* GÜVENLİ ÖN İZLEME: <alan-adı>/onizleme#t=<anahtar>
     Anahtar adresin # kısmındadır: sunucu kayıtlarına ve başka sitelere (Referer) gitmez.
     Davetiye kopyası yalnızca sunucu süre/iptal kontrolünü geçerse gelir (demo_preview_get). */
  function isDemoPath() { return /^\/onizleme(\.html)?\/?$/i.test(window.location.pathname); }
  function demoToken() {
    const h = String(window.location.hash || "").replace(/^#/, "");
    const m = /(?:^|&)t=([A-Za-z0-9_-]{20,100})/.exec(h);
    return m ? m[1] : (/^[A-Za-z0-9_-]{20,100}$/.test(h) ? h : "");
  }
  const DEMO_STATUS = {
    expired: "Bu ön izleme bağlantısının süresi doldu.<br>Yeni bağlantı için Studio SEOZ ile iletişime geçin.",
    revoked: "Bu ön izleme bağlantısı kapatıldı.<br>Yeni bağlantı için Studio SEOZ ile iletişime geçin.",
    finalized: "Bu ön izleme kapatıldı — davetiyeniz yayında.<br>Size gönderilen kalıcı davetiye bağlantısını kullanın.",
    not_found: "Ön izleme bulunamadı. Bağlantıyı eksiksiz kopyaladığınızdan emin olun."
  };
  // Davetiye dili henüz bilinmiyor: durum mesajı Türkçe + İngilizce
  function demoStatus(key) {
    const tr = DEMO_STATUS[key] || DEMO_STATUS.not_found;
    let en = tr;
    if (I) { const prev = I.lang(); I.setLang("en"); en = I.L(tr); I.setLang(prev); }
    stage.innerHTML = `<div class="view-message"><div>${tr}${en !== tr ? `<div class="view-message-en">${en}</div>` : ""}</div></div>`;
  }
  function bootDemo() {
    const token = demoToken();
    window.SeozDemoMode = true;           // modüller: gönderim/kayıt yok (sunucu da reddeder)
    document.documentElement.classList.add("seoz-demo");
    addWatermark(null);
    if (!token || typeof SeozCloudStore === "undefined" || !SeozCloudStore.isConfigured()) { demoStatus("not_found"); return; }
    showMessage("Davetiye yükleniyor...");
    SeozCloudStore.loadDemoPreview(token).then(r => {
      if (!r || r.status !== "ok") { demoStatus((r && r.status) || "not_found"); return; }
      const doc = r.doc && !SeozDocModel.validateDocument(r.doc).length ? SeozDocModel.sanitizeDocument(r.doc) : null;
      if (!doc) { demoStatus("not_found"); return; }
      if (I) I.setLang(doc.meta && doc.meta.lang);
      addWatermark(r.expires_at);
      start(doc);
    }).catch(err => {
      console.error("[Studio SEOZ] Ön izleme yüklenemedi:", err);
      showMessage("Davetiye şu anda yüklenemedi.<br>Lütfen internet bağlantınızı kontrol edip sayfayı yenileyin.");
    });
  }
  // Zarif, yarı saydam filigran: dokunuşları engellemez (pointer-events: none), her şeyin üstündedir.
  function addWatermark(expiresAt) {
    let wm = document.querySelector(".seoz-demo-wm");
    if (!wm) {
      wm = document.createElement("div"); wm.className = "seoz-demo-wm"; wm.setAttribute("aria-hidden", "true");
      wm.innerHTML = '<div class="seoz-demo-wm-grid">' + Array.from({ length: 14 }, () => "<span>PREVIEW — STUDIO SEOZ</span>").join("") + "</div>";
      document.body.appendChild(wm);
    }
    let chip = document.querySelector(".seoz-demo-chip");
    if (!chip) { chip = document.createElement("div"); chip.className = "seoz-demo-chip"; chip.setAttribute("role", "note"); document.body.appendChild(chip); }
    let until = "";
    if (expiresAt) {
      try { until = new Intl.DateTimeFormat(I && I.lang() === "en" ? "en-GB" : "tr-TR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(expiresAt)); } catch (e) { until = ""; }
    }
    chip.textContent = until ? L("Ön izleme · {d} tarihine kadar geçerli", { d: until }) : L("Ön izleme");
  }

  function boot() {
    if (isDemoPath()) { bootDemo(); return; }
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
