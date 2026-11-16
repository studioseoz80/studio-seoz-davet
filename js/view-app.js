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

  /* HIZLI AÇILIŞ — MODÜLLER YALNIZCA GEREKİRSE: davetiyede kullanılan modüllerin dosyaları yüklenir
     (her davetiye 20 modülün hepsini indirmez). Bilinmeyen bir modül adı görülürse güvenli tarafta
     kalınır ve HEPSİ yüklenir. Sıra, eski view.html sırasıyla aynıdır. */
  const SCRIPT_BASE = (document.currentScript && document.currentScript.src || "").replace(/js\/view-app\.js(\?.*)?$/, "");
  const MODULES = ["location", "music", "countdown", "rsvp", "gallery", "guest-upload", "celebration", "poll", "qrcode", "calendar", "feedback",
    "gift", "appointment", "social-media", "services", "price-list", "before-after", "attendance-form", "campaign", "hours", "interactive"];
  const MODULE_DEPS = { qrcode: ["js/core/qr-encoder.js"] };
  function neededModules(doc) {
    let json = ""; try { json = JSON.stringify(doc); } catch (e) { return MODULES.slice(); }
    const ids = new Set(["countdown"]), re = /"moduleId":"([^"]+)"/g;
    let m; while ((m = re.exec(json))) ids.add(m[1]);
    for (const id of ids) if (MODULES.indexOf(id) < 0) return MODULES.slice();   // tanınmayan modül: hepsi
    return MODULES.filter(id => ids.has(id));
  }
  const loaded = new Set();
  function loadScript(path) {
    if (loaded.has(path)) return Promise.resolve();
    loaded.add(path);
    return new Promise(res => {
      const sc = document.createElement("script");
      sc.src = SCRIPT_BASE + path; sc.async = false;
      sc.onload = () => res();
      sc.onerror = () => { console.error("[Studio SEOZ] Modül yüklenemedi:", path); res(); };
      document.head.appendChild(sc);
    });
  }
  function ensureModules(doc) {
    const R = window.SeozModuleRegistry;
    const files = [];
    neededModules(doc).forEach(id => {
      if (R && R.getModule && R.getModule(id)) return;   // zaten yüklü (ör. Geri Sayım)
      (MODULE_DEPS[id] || []).forEach(d => files.push(d));
      files.push("js/modules/" + id + ".js");
    });
    // hepsi aynı anda iner, eski sıra korunarak çalışır (async=false)
    return Promise.all(files.map(loadScript));
  }

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
      // HIZLI AÇILIŞ: kısa bağlantı sayfası davetiyeyi sayfanın içine gömdüyse tekrar indirilmez
      // (functions/[slug].js). Gömülü değilse ya da okunamazsa eskisi gibi Supabase'den okunur.
      const inline = window.SeozImgV && window.SeozImgV.inlineDoc(slug);
      const inlineDoc = inline && !SeozDocModel.validateDocument(inline).length ? SeozDocModel.sanitizeDocument(inline) : null;
      if (inlineDoc) {
        window.SeozPublishedSlug = slug;
        ensureModules(inlineDoc).then(() => start(inlineDoc));
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
          return ensureModules(doc).then(() => start(doc));
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
    ensureModules(doc).then(() => start(doc));
  }

  /* ---------------- HIZLI AÇILIŞ ---------------- */
  // Yazı tipleri: yalnızca davetiyede kullanılan aileler, sayfayı bekletmeden (kısa bağlantı sayfası
  // bunu zaten eklediyse tekrar eklenmez). Sayfa kodunun kendi kullandığı aileler her zaman eklenir.
  const FONT_BASE = ["Manrope", "Cormorant Garamond", "Great Vibes", "Alex Brush", "Cinzel", "IBM Plex Sans"];
  function ensureFonts(doc) {
    const specs = window.SeozFontSpecs;
    if (!specs || document.querySelector("link[data-seoz-fonts]")) return;
    let json = ""; try { json = JSON.stringify(doc); } catch (e) { /* önemsiz */ }
    const fams = Object.keys(specs).filter(f => FONT_BASE.indexOf(f) >= 0 || json.indexOf('"' + f + '"') >= 0 || json.indexOf("'" + f + "'") >= 0);
    if (!fams.length) return;
    const l = document.createElement("link");
    l.rel = "stylesheet"; l.setAttribute("data-seoz-fonts", "");
    l.href = "https://fonts.googleapis.com/css2?" + fams.map(f => "family=" + specs[f]).join("&") + "&display=swap";
    document.head.appendChild(l);
  }
  // Açılış ekranı hazır olunca (görseller indi): davetiyenin İLK EKRANINDAKİ görseller düşük öncelikle
  // önceden indirilir — misafir zarfı açtığında sayfa hazır olur. Aşağıdaki bölümler (galeri, dilek
  // ağacı...) ekrana yaklaşınca iner.
  function warmFirstScreen(doc) {
    const V = window.SeozImgV; if (!V) return;
    const list = [], bg = doc.canvas && doc.canvas.background;
    if (bg && bg.type === "image" && V.isImg(bg.value)) list.push({ url: bg.value, cors: false });
    const scale = Math.max(0.2, Math.min(window.innerWidth, 1000) / ((doc.canvas && doc.canvas.baseWidth) || 430));
    const limit = (window.innerHeight * 1.2) / scale;
    (doc.layers || []).forEach(l => {
      if (l && l.type === "image" && l.content && V.isImg(l.content.src) && Number(l.y) < limit) list.push({ url: l.content.src, cors: false });
    });
    V.warm(list, "low");
  }

  function start(doc) {
    document.title = doc.meta.title + " — Studio SEOZ";
    if (I) { I.setLang(doc.meta && doc.meta.lang); document.documentElement.lang = I.lang(); }
    if (window.SeozImgV) window.SeozImgV.setDoc(doc);
    ensureFonts(doc);
    // Açılış görselleri yavaş bağlantıda geç inerse açılış yarım başlamaz: zarif "Hazırlanıyor…"
    // göstergesiyle beklenir (en fazla 30 sn; "Geç ›" her zaman çalışır).
    window.SeozCinemaPreloadMs = 30000;
    const cinemaEntry = !!(doc.entry && doc.entry.type === "cinema" && SeozEntryScene.hasUsableEntry(doc.entry));
    // Müzik dosyası açılış görselleriyle aynı anda inmesin: açılış hazır olunca (ya da ilk dokunuşta) iner.
    if (cinemaEntry && window.SeozMusic && window.SeozMusic.defer) window.SeozMusic.defer(true);
    if (cinemaEntry) {
      let warmed = false;
      const onReady = () => {
        if (warmed) return; warmed = true;
        window.removeEventListener("seoz:entry-ready", onReady);
        warmFirstScreen(doc);
        // önce sayfanın ilk ekranı, kısa bir süre sonra müzik
        setTimeout(() => { if (window.SeozMusic && window.SeozMusic.defer) window.SeozMusic.defer(false); }, 1500);
      };
      window.addEventListener("seoz:entry-ready", onReady);
    }

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
      if (window.SeozMusic && window.SeozMusic.defer) window.SeozMusic.defer(false);
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
