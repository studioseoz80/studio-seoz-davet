/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — modules/gallery.js
   -----------------------------------------------------------------------------
   Galeri modülü: siz (davetiye sahibi) fotoğrafları önceden yükleyip
   düzenlersiniz — "Anı Yükle" modülünün aksine bu, misafirlerin değil
   SİZİN yerleştirdiğiniz sabit bir fotoğraf galerisidir.

   HAREKETLİ/VİDEO EFEKTLİ GALERİ GENİŞLETMESİ:
   Artık üç "Galeri Görünümü" var:
     - "normal"     : ESKİ ızgara görünümü — HİÇ DEĞİŞMEDİ (bkz. renderNormal).
                      Eski kayıtlı projeler viewMode alanı hiç yoksa bile
                      (varsayılan "normal") BİREBİR eskisi gibi görünmeye
                      devam eder.
     - "auto-scroll": Yatay kayan galeri — ok butonları + mobilde parmakla
                      kaydırma + isteğe bağlı otomatik oynatma.
     - "video-effect": Sinematik "Ken Burns" efekti — CSS transition tabanlı
                      yavaş yakınlaşma/uzaklaşma/kayma + yumuşak geçişler.
                      Gerçek bir video dosyası OLUŞTURULMAZ; yalnızca CSS
                      transform/opacity animasyonlarıyla video HİSSİ verilir.

   Zamanlayıcı (setInterval) kullanan diğer modüllerle (ör. countdown.js)
   AYNI, projede zaten var olan temizlik desenini kullanır:
   wrap.dataset.intervalId = String(intervalId) — renderer.js/editor-app.js
   bunu otomatik olarak temizler, buraya AYRICA dokunmaya gerek yoktur.
   ========================================================================= */

(function (global) {
  "use strict";

  const DEFAULTS = {
    images: [],       // [{ ref, naturalWidth, naturalHeight }]
    columns: "2",
    gap: 8,
    imageHeight: 130,
    borderRadius: 6,
    // --- YENİ ALANLAR (hepsi geriye dönük güvenli varsayılanlarla) ---
    viewMode: "normal",           // "normal" | "auto-scroll" | "video-effect"
    autoplay: true,
    slideDuration: "4",           // saniye: "2"|"3"|"4"|"5"|"6"
    transitionEffect: "slide",    // "slide" | "fade"
    kenBurnsEffect: "mixed",      // "zoom-in" | "zoom-out" | "pan" | "mixed"
    showArrows: true,
    showTitle: false,
    title: "Galeri"
  };

  const SETTINGS_SCHEMA = [
    { key: "images", type: "image-list", label: "Fotoğraflar (en az 8 önerilir — sınır yok)" },
    {
      key: "viewMode", type: "select", label: "Galeri Görünümü",
      options: [
        { value: "normal", label: "Normal Galeri (Izgara)" },
        { value: "auto-scroll", label: "Otomatik Kayan Galeri" },
        { value: "video-effect", label: "Video Efektli Galeri (Sinematik)" }
      ]
    },
    {
      key: "columns", type: "select", label: "Sütun Sayısı",
      options: [{ value: "1", label: "1" }, { value: "2", label: "2" }, { value: "3", label: "3" }],
      showIf: (s) => (s.viewMode || "normal") === "normal"
    },
    { key: "gap", type: "number", label: "Fotoğraflar Arası Boşluk", unit: "px", min: 0, showIf: (s) => (s.viewMode || "normal") === "normal" },
    { key: "imageHeight", type: "number", label: "Fotoğraf Yüksekliği", unit: "px", min: 40, showIf: (s) => (s.viewMode || "normal") === "normal" },
    { key: "borderRadius", type: "number", label: "Köşe Yuvarlaklığı", unit: "px", min: 0 },
    {
      key: "autoplay", type: "checkbox", label: "Otomatik Oynatma",
      showIf: (s) => s.viewMode === "auto-scroll" || s.viewMode === "video-effect"
    },
    {
      key: "slideDuration", type: "select", label: "Fotoğraf Gösterim Süresi",
      options: [{ value: "2", label: "2 saniye" }, { value: "3", label: "3 saniye" }, { value: "4", label: "4 saniye" }, { value: "5", label: "5 saniye" }, { value: "6", label: "6 saniye" }],
      showIf: (s) => s.viewMode === "auto-scroll" || s.viewMode === "video-effect"
    },
    {
      key: "transitionEffect", type: "select", label: "Geçiş Efekti",
      options: [{ value: "slide", label: "Kayma" }, { value: "fade", label: "Yumuşak Geçiş" }],
      showIf: (s) => s.viewMode === "auto-scroll"
    },
    {
      key: "kenBurnsEffect", type: "select", label: "Sinematik Hareket",
      options: [
        { value: "zoom-in", label: "Yakınlaşma" }, { value: "zoom-out", label: "Uzaklaşma" },
        { value: "pan", label: "Hafif Kayma" }, { value: "mixed", label: "Karışık" }
      ],
      showIf: (s) => s.viewMode === "video-effect"
    },
    {
      key: "showArrows", type: "checkbox", label: "Sağ-Sol Yön Okları",
      showIf: (s) => s.viewMode === "auto-scroll" || s.viewMode === "video-effect"
    },
    {
      key: "showTitle", type: "checkbox", label: "Galeri Başlığı Göster",
      showIf: (s) => s.viewMode === "auto-scroll" || s.viewMode === "video-effect"
    },
    {
      key: "title", type: "text", label: "Galeri Başlığı",
      showIf: (s) => (s.viewMode === "auto-scroll" || s.viewMode === "video-effect") && s.showTitle
    }
  ];

  function emptyPlaceholder(mode) {
    const wrap = document.createElement("div");
    wrap.style.width = "100%";
    wrap.style.height = "100%";
    if (mode === "edit") {
      wrap.style.display = "flex";
      wrap.style.alignItems = "center";
      wrap.style.justifyContent = "center";
      const placeholder = document.createElement("div");
      placeholder.textContent = "Galeri boş — sağ panelden fotoğraf ekleyin";
      Object.assign(placeholder.style, {
        fontSize: "12px", fontFamily: "'Manrope', sans-serif",
        color: "#9a9a90", textAlign: "center", padding: "10px"
      });
      wrap.appendChild(placeholder);
    }
    return wrap;
  }

  /* ------------------------------------------------------------------
     A) NORMAL GALERİ — MEVCUT KOD, HİÇ DEĞİŞMEDİ. Eski kayıtlı
     projeler (viewMode alanı hiç yoksa "normal" varsayılana düşer)
     BİREBİR eskisi gibi görünmeye devam eder.
     ------------------------------------------------------------------ */
  function renderNormal(s, mode, images) {
    const wrap = document.createElement("div");
    wrap.style.width = "100%";
    wrap.style.height = "100%";
    wrap.style.overflowY = "auto";
    wrap.style.overflowX = "hidden";

    const columns = parseInt(s.columns, 10) || 2;
    const grid = document.createElement("div");
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    grid.style.gap = s.gap + "px";
    grid.style.width = "100%";

    images.forEach(imgData => {
      const cell = document.createElement("div");
      cell.style.width = "100%";
      cell.style.height = s.imageHeight + "px";
      cell.style.overflow = "hidden";
      cell.style.borderRadius = s.borderRadius + "px";
      cell.style.background = "#eee";

      const img = document.createElement("img");
      img.alt = "";
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.objectFit = "cover";
      img.style.display = "block";
      SeozBlobStore.resolveToObjectURL(imgData.ref).then(url => { if (url) img.src = url; });

      cell.appendChild(img);
      grid.appendChild(cell);
    });

    wrap.appendChild(grid);
    return wrap;
  }

  /* ------------------------------------------------------------------
     Ortak: başlık + ok butonları — auto-scroll ve video-effect
     modlarının ikisi de kullanır (kod tekrarını önlemek için).
     ------------------------------------------------------------------ */
  function buildArrowButton(dir) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = dir === "prev" ? "‹" : "›";
    Object.assign(btn.style, {
      position: "absolute", top: "50%", [dir === "prev" ? "left" : "right"]: "8px",
      transform: "translateY(-50%)",
      width: "32px", height: "32px", borderRadius: "50%",
      border: "none", background: "rgba(0,0,0,.42)", color: "#fff",
      fontSize: "18px", lineHeight: "1", cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: "3"
    });
    return btn;
  }

  function buildTitleEl(s) {
    const titleEl = document.createElement("div");
    titleEl.textContent = s.title || "";
    Object.assign(titleEl.style, {
      textAlign: "center", fontFamily: "'Cormorant Garamond', serif",
      fontSize: "16px", fontWeight: "600", padding: "6px 0", flexShrink: "0"
    });
    return titleEl;
  }

  /* ------------------------------------------------------------------
     B) OTOMATİK KAYAN GALERİ — yatay kayma, ok butonları, mobilde
     parmakla kaydırma, sonunda başa dönme, isteğe bağlı otomatik
     oynatma. object-fit:contain kullanır (Normal moddaki sabit-
     yükseklik ızgara mantığından FARKLI — her fotoğraf kendi oranını
     tam korur, dikey/yatay fark etmeksizin).
     ------------------------------------------------------------------ */
  function renderAutoScroll(s, mode, images) {
    const outer = document.createElement("div");
    outer.style.width = "100%";
    outer.style.height = "100%";
    outer.style.display = "flex";
    outer.style.flexDirection = "column";
    outer.style.borderRadius = s.borderRadius + "px";
    outer.style.overflow = "hidden";

    if (s.showTitle) outer.appendChild(buildTitleEl(s));

    const viewport = document.createElement("div");
    Object.assign(viewport.style, {
      position: "relative", width: "100%", flex: "1 1 auto", minHeight: "0",
      overflow: "hidden", background: "#111", touchAction: "pan-y"
    });

    const track = document.createElement("div");
    const useFade = s.transitionEffect === "fade";
    Object.assign(track.style, {
      display: "flex", width: "100%", height: "100%",
      position: "relative"
    });

    let current = 0;
    const slideEls = images.map((imgData, i) => {
      const slide = document.createElement("div");
      if (useFade) {
        Object.assign(slide.style, {
          position: "absolute", inset: "0",
          opacity: i === 0 ? "1" : "0",
          transition: "opacity .6s ease"
        });
      } else {
        Object.assign(slide.style, {
          flex: "0 0 100%", width: "100%", height: "100%"
        });
      }
      const img = document.createElement("img");
      img.alt = "";
      Object.assign(img.style, { width: "100%", height: "100%", objectFit: "contain", display: "block" });
      SeozBlobStore.resolveToObjectURL(imgData.ref).then(url => { if (url) img.src = url; });
      slide.appendChild(img);
      track.appendChild(slide);
      return slide;
    });

    if (!useFade) {
      track.style.transition = "transform .5s cubic-bezier(.4,0,.2,1)";
    }

    viewport.appendChild(track);
    outer.appendChild(viewport);

    function goTo(idx) {
      current = ((idx % images.length) + images.length) % images.length; // döngüsel (son->ilk)
      if (useFade) {
        slideEls.forEach((el, i) => { el.style.opacity = i === current ? "1" : "0"; });
      } else {
        track.style.transform = `translateX(-${current * 100}%)`;
      }
    }

    if (s.showArrows && images.length > 1) {
      const prevBtn = buildArrowButton("prev");
      const nextBtn = buildArrowButton("next");
      prevBtn.addEventListener("click", () => { goTo(current - 1); resetTimer(); });
      nextBtn.addEventListener("click", () => { goTo(current + 1); resetTimer(); });
      viewport.appendChild(prevBtn);
      viewport.appendChild(nextBtn);
    }

    // Mobil: parmakla kaydırma (yatay). Sayfa dikey kaydırmasını
    // engellememek için yalnızca YATAY hareket net olduğunda tepki verir.
    let touchStartX = null, touchStartY = null;
    viewport.addEventListener("touchstart", (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });
    viewport.addEventListener("touchend", (e) => {
      if (touchStartX == null) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) goTo(current + 1); else goTo(current - 1);
        resetTimer();
      }
      touchStartX = null; touchStartY = null;
    }, { passive: true });

    let intervalId = null;
    function startTimer() {
      if (!s.autoplay || images.length < 2) return;
      const ms = (parseInt(s.slideDuration, 10) || 4) * 1000;
      intervalId = setInterval(() => goTo(current + 1), ms);
      outer.dataset.intervalId = String(intervalId);
    }
    function resetTimer() {
      if (intervalId) clearInterval(intervalId);
      startTimer();
    }
    startTimer();

    return outer;
  }

  /* ------------------------------------------------------------------
     C) VİDEO EFEKTLİ GALERİ (Ken Burns) — CSS transition tabanlı yavaş
     yakınlaşma/uzaklaşma/kayma + yumuşak (fade) geçişler. Gerçek video
     dosyası OLUŞTURULMAZ. Sağ-sol oklarla manuel geçiş de mümkündür.
     ------------------------------------------------------------------ */
  function renderVideoEffect(s, mode, images) {
    const outer = document.createElement("div");
    outer.style.width = "100%";
    outer.style.height = "100%";
    outer.style.display = "flex";
    outer.style.flexDirection = "column";
    outer.style.borderRadius = s.borderRadius + "px";
    outer.style.overflow = "hidden";

    if (s.showTitle) outer.appendChild(buildTitleEl(s));

    const viewport = document.createElement("div");
    Object.assign(viewport.style, {
      position: "relative", width: "100%", flex: "1 1 auto", minHeight: "0",
      overflow: "hidden", background: "#111"
    });

    const durationSec = parseInt(s.slideDuration, 10) || 4;
    // Efekt süresi, gösterim süresinden biraz UZUN tutulur — böylece
    // yakınlaşma/kayma hareketi fotoğraf değişene kadar akıcı devam eder
    // (aniden "sıçrayıp" başa dönmez).
    const effectDurationSec = durationSec + 1.5;

    function effectForIndex(i) {
      if (s.kenBurnsEffect === "mixed") {
        const variants = ["zoom-in", "zoom-out", "pan"];
        return variants[i % variants.length];
      }
      return s.kenBurnsEffect || "zoom-in";
    }

    let current = 0;
    const slideEls = images.map((imgData, i) => {
      const slide = document.createElement("div");
      Object.assign(slide.style, {
        position: "absolute", inset: "0",
        opacity: i === 0 ? "1" : "0",
        transition: "opacity 1s ease"
      });
      const imgWrap = document.createElement("div");
      Object.assign(imgWrap.style, {
        width: "100%", height: "100%", overflow: "hidden",
        display: "flex", alignItems: "center", justifyContent: "center"
      });
      const img = document.createElement("img");
      img.alt = "";
      Object.assign(img.style, {
        width: "100%", height: "100%", objectFit: "cover",
        display: "block", transformOrigin: "center center"
      });
      SeozBlobStore.resolveToObjectURL(imgData.ref).then(url => { if (url) img.src = url; });
      imgWrap.appendChild(img);
      slide.appendChild(imgWrap);
      viewport.appendChild(slide);
      return { slide, img };
    });

    // Bir fotoğrafın Ken Burns hareketini başlatır: başlangıç durumuna
    // (transition YOK) anında döner, sonra bir sonraki karede (rAF)
    // hedef duruma yavaşça (transition VAR) geçer — CSS'in "aynı
    // değere geçiş yapılamaz" kısıtını doğru şekilde aşan standart bir
    // tekniktir.
    function playEffect(i) {
      const { img } = slideEls[i];
      const effect = effectForIndex(i);
      let fromT = "scale(1) translate(0,0)";
      let toT;
      if (effect === "zoom-in") toT = "scale(1.15) translate(0,0)";
      else if (effect === "zoom-out") { fromT = "scale(1.15) translate(0,0)"; toT = "scale(1) translate(0,0)"; }
      else toT = "scale(1.08) translate(-2.5%, 0)"; // "pan" — hafif kayma + çok hafif yakınlaşma

      img.style.transition = "none";
      img.style.transform = fromT;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          img.style.transition = `transform ${effectDurationSec}s linear`;
          img.style.transform = toT;
        });
      });
    }

    playEffect(0);

    function goTo(idx) {
      current = ((idx % images.length) + images.length) % images.length;
      slideEls.forEach((s2, i) => { s2.slide.style.opacity = i === current ? "1" : "0"; });
      playEffect(current);
    }

    if (s.showArrows && images.length > 1) {
      const prevBtn = buildArrowButton("prev");
      const nextBtn = buildArrowButton("next");
      prevBtn.addEventListener("click", () => { goTo(current - 1); resetTimer(); });
      nextBtn.addEventListener("click", () => { goTo(current + 1); resetTimer(); });
      viewport.appendChild(prevBtn);
      viewport.appendChild(nextBtn);
    }

    outer.appendChild(viewport);

    let intervalId = null;
    function startTimer() {
      if (!s.autoplay || images.length < 2) return;
      const ms = durationSec * 1000;
      intervalId = setInterval(() => goTo(current + 1), ms);
      outer.dataset.intervalId = String(intervalId);
    }
    function resetTimer() {
      if (intervalId) clearInterval(intervalId);
      startTimer();
    }
    startTimer();

    return outer;
  }

  function render(settings, mode) {
    const s = Object.assign({}, DEFAULTS, settings);
    const images = Array.isArray(s.images) ? s.images : [];

    if (!images.length) return emptyPlaceholder(mode);

    const viewMode = s.viewMode || "normal";
    if (viewMode === "auto-scroll") return renderAutoScroll(s, mode, images);
    if (viewMode === "video-effect") return renderVideoEffect(s, mode, images);
    return renderNormal(s, mode, images); // "normal" — ESKİ DAVRANIŞ, DEĞİŞMEDİ
  }

  global.SeozModuleRegistry.registerModule({
    id: "gallery",
    label: "Galeri",
    defaultSettings: DEFAULTS,
    defaultLayerSize: { w: 340, h: 280 },
    settingsSchema: SETTINGS_SCHEMA,
    render: render
  });
})(window);
