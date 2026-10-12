/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — modules/before-after.js  (YENİ İŞLETME MODÜLÜ — ÖNCESİ / SONRASI)
   -----------------------------------------------------------------------------
   Her çalışma için iki fotoğraf (Öncesi, Sonrası) + isteğe bağlı kısa
   açıklama. Birden fazla çalışma eklenebilir (module-panel.js "item-list").

   Görünümler (baLayout):
     - "side"    : iki fotoğraf yan yana (mobilde de yan yana, her biri %50)
     - "stacked" : alt alta (Öncesi üstte, Sonrası altta)
     - "slider"  : tek kare üzerinde sürüklenebilir karşılaştırma çizgisi.
                   Yayında parmakla/fareyle sürüklenir; dikey sayfa kaydırmayı
                   ENGELLEMEZ (touch-action: pan-y). Editörde sabit %50 durur
                   ki katman sürükleme ile çakışmasın.

   Fotoğraflar Galeri ile AYNI yolla saklanır ("idb:..." referansı). Supabase
   yayını ve Yayın Paketi bu referansları zaten belgenin TAMAMINI tarayarak
   bulup yüklediği için yayın altyapısında hiçbir değişiklik gerekmez.

   GÖRÜNÜRLÜK: Hiç fotoğrafı olmayan çalışma yayında çizilmez. Tek fotoğrafı
   olan çalışma yalnızca o fotoğrafla gösterilir (kaydırıcı görünümünde de
   yan yana görünüme düşer). Hiç fotoğraf yoksa modül sıfır yükseklik kaplar.
   ========================================================================= */

(function (global) {
  "use strict";

  const DEFAULTS = {
    moduleActive: true,
    baTitle: "Öncesi / Sonrası",
    baItems: [
      { caption: "", before: "", after: "" }
    ],
    baLayout: "side",              // "side" | "stacked" | "slider"
    baRatio: "4:5",                // "1:1" | "4:5" | "3:4" | "4:3" | "16:9"
    beforeLabel: "Öncesi",
    afterLabel: "Sonrası",
    showLabels: true,
    titleFont: "Cormorant Garamond",
    fontFamily: "Manrope",
    textColor: "#1E2A22",
    accentColor: "#93703F",
    borderRadius: 10
  };

  const SETTINGS_SCHEMA = [
    { key: "moduleActive", type: "checkbox", label: "Modül aktif (kapalıysa yayında görünmez)" },
    { key: "baTitle", type: "text", label: "Başlık (boşsa gösterilmez)" },
    {
      key: "baItems", type: "item-list", label: "Çalışmalar", itemLabel: "Çalışma", addLabel: "+ Çalışma Ekle",
      itemFields: [
        { key: "before", type: "image", label: "Öncesi Fotoğrafı" },
        { key: "after", type: "image", label: "Sonrası Fotoğrafı" },
        { key: "caption", type: "text", label: "Kısa Açıklama (isteğe bağlı)" }
      ]
    },
    {
      key: "baLayout", type: "select", label: "Görünüm",
      options: [
        { value: "side", label: "Yan yana" },
        { value: "stacked", label: "Alt alta" },
        { value: "slider", label: "Kaydırmalı karşılaştırma" }
      ]
    },
    {
      key: "baRatio", type: "select", label: "Fotoğraf Oranı",
      options: [
        { value: "1:1", label: "Kare (1:1)" }, { value: "4:5", label: "Dikey (4:5)" },
        { value: "3:4", label: "Dikey (3:4)" }, { value: "4:3", label: "Yatay (4:3)" },
        { value: "16:9", label: "Geniş (16:9)" }
      ]
    },
    { key: "showLabels", type: "checkbox", label: "Fotoğraf üstünde Öncesi/Sonrası etiketi" },
    { key: "beforeLabel", type: "text", label: '"Öncesi" Etiketi' },
    { key: "afterLabel", type: "text", label: '"Sonrası" Etiketi' },
    { key: "titleFont", type: "font-select", label: "Başlık Fontu" },
    { key: "fontFamily", type: "font-select", label: "Yazı Fontu" },
    { key: "textColor", type: "color", label: "Yazı Rengi" },
    { key: "accentColor", type: "color", label: "Vurgu Rengi (etiket, çizgi)" },
    { key: "borderRadius", type: "number", label: "Köşe Yuvarlaklığı", unit: "px", min: 0 }
  ];

  function clean(v) { return String(v == null ? "" : v).trim(); }

  function filledItems(s) {
    return (Array.isArray(s.baItems) ? s.baItems : []).filter(it => it && (clean(it.before) || clean(it.after)));
  }

  function ratioPadding(r) {
    const parts = String(r || "4:5").split(":").map(Number);
    const w = parts[0] || 4, h = parts[1] || 5;
    return (h / w * 100).toFixed(3) + "%";
  }

  function emptyEl() {
    const d = document.createElement("div");
    d.style.height = "0";
    d.style.overflow = "hidden";
    return d;
  }

  function editPlaceholder(text) {
    const d = document.createElement("div");
    Object.assign(d.style, {
      border: "1px dashed rgba(0,0,0,.25)", borderRadius: "8px", padding: "12px",
      textAlign: "center", fontFamily: "'Manrope', sans-serif", fontSize: "12px",
      color: "#8A8578", background: "rgba(255,255,255,.5)"
    });
    d.textContent = text;
    return d;
  }

  function imgEl(ref) {
    const img = document.createElement("img");
    img.alt = "";
    img.draggable = false;
    Object.assign(img.style, {
      position: "absolute", inset: "0", width: "100%", height: "100%",
      objectFit: "cover", display: "block", userSelect: "none", pointerEvents: "none"
    });
    SeozBlobStore.resolveToObjectURL(ref).then(url => { if (url) img.src = url; });
    return img;
  }

  function labelEl(text, s, side) {
    const l = document.createElement("span");
    l.textContent = text;
    Object.assign(l.style, {
      position: "absolute", top: "8px", [side]: "8px", zIndex: "2",
      background: "rgba(0,0,0,.55)", color: "#fff", borderRadius: "999px",
      padding: "3px 9px", fontFamily: `"${s.fontFamily}", sans-serif`, fontSize: "11px",
      fontWeight: "700", letterSpacing: ".02em", pointerEvents: "none"
    });
    return l;
  }

  /* Oranı koruyan kutu (padding-top hilesi: eski tarayıcılarda da çalışır). */
  function frame(s) {
    const f = document.createElement("div");
    Object.assign(f.style, {
      position: "relative", width: "100%", paddingTop: ratioPadding(s.baRatio),
      overflow: "hidden", borderRadius: s.borderRadius + "px", background: "#E9E4D8"
    });
    return f;
  }

  function photoCell(ref, label, s) {
    const f = frame(s);
    f.appendChild(imgEl(ref));
    if (s.showLabels && clean(label)) f.appendChild(labelEl(label, s, "left"));
    return f;
  }

  function renderPair(it, s, layout) {
    const box = document.createElement("div");
    const refs = [];
    if (clean(it.before)) refs.push({ ref: it.before, label: s.beforeLabel });
    if (clean(it.after)) refs.push({ ref: it.after, label: s.afterLabel });
    Object.assign(box.style, layout === "stacked" || refs.length === 1
      ? { display: "grid", gridTemplateColumns: "1fr", gap: "6px" }
      : { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" });
    refs.forEach(r => box.appendChild(photoCell(r.ref, r.label, s)));
    return box;
  }

  function renderSlider(it, s, mode) {
    const f = frame(s);
    f.appendChild(imgEl(it.after));
    const beforeLayer = document.createElement("div");
    Object.assign(beforeLayer.style, { position: "absolute", inset: "0", overflow: "hidden" });
    beforeLayer.appendChild(imgEl(it.before));
    f.appendChild(beforeLayer);

    const line = document.createElement("div");
    Object.assign(line.style, {
      position: "absolute", top: "0", bottom: "0", width: "2px", marginLeft: "-1px",
      background: "#fff", boxShadow: "0 0 4px rgba(0,0,0,.4)", zIndex: "3", pointerEvents: "none"
    });
    const knob = document.createElement("div");
    knob.textContent = "‹ ›";
    Object.assign(knob.style, {
      position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
      width: "34px", height: "34px", borderRadius: "50%", background: s.accentColor, color: "#fff",
      display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px",
      fontWeight: "700", fontFamily: "sans-serif", boxShadow: "0 1px 6px rgba(0,0,0,.35)"
    });
    line.appendChild(knob);
    f.appendChild(line);

    if (s.showLabels) {
      if (clean(s.beforeLabel)) f.appendChild(labelEl(s.beforeLabel, s, "left"));
      if (clean(s.afterLabel)) f.appendChild(labelEl(s.afterLabel, s, "right"));
    }

    function setPos(pct) {
      pct = Math.max(0, Math.min(100, pct));
      beforeLayer.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
      beforeLayer.style.webkitClipPath = beforeLayer.style.clipPath;
      line.style.left = pct + "%";
    }
    setPos(50);

    // Editörde sabit kalır (katman sürükleme ile çakışmasın).
    if (mode !== "edit") {
      f.style.touchAction = "pan-y";
      f.style.cursor = "ew-resize";
      let dragging = false;
      const fromEvent = e => {
        const r = f.getBoundingClientRect();
        if (r.width) setPos((e.clientX - r.left) / r.width * 100);
      };
      f.addEventListener("pointerdown", e => {
        dragging = true;
        try { f.setPointerCapture(e.pointerId); } catch (err) { /* yok say */ }
        fromEvent(e);
      });
      f.addEventListener("pointermove", e => { if (dragging) fromEvent(e); });
      const stop = () => { dragging = false; };
      f.addEventListener("pointerup", stop);
      f.addEventListener("pointercancel", stop);
    }
    return f;
  }

  function render(settings, mode) {
    const s = Object.assign({}, DEFAULTS, settings);
    const items = filledItems(s);
    if (!s.moduleActive) return mode === "edit" ? editPlaceholder("Öncesi / Sonrası — PASİF (yayında görünmez)") : emptyEl();
    if (!items.length) return mode === "edit" ? editPlaceholder("Öncesi / Sonrası — henüz fotoğraf yüklenmedi (yayında görünmez)") : emptyEl();

    const wrap = document.createElement("div");
    Object.assign(wrap.style, {
      width: "100%", boxSizing: "border-box", color: s.textColor,
      fontFamily: `"${s.fontFamily}", sans-serif`, display: "flex", flexDirection: "column", gap: "16px", padding: "4px 0"
    });

    if (clean(s.baTitle)) {
      const t = document.createElement("div");
      t.textContent = s.baTitle;
      Object.assign(t.style, { fontFamily: `"${s.titleFont}", serif`, fontSize: "24px", fontWeight: "600", textAlign: "center", lineHeight: "1.2", marginBottom: "-6px" });
      wrap.appendChild(t);
    }

    items.forEach(it => {
      const work = document.createElement("div");
      Object.assign(work.style, { display: "flex", flexDirection: "column", gap: "6px" });
      const both = clean(it.before) && clean(it.after);
      work.appendChild(s.baLayout === "slider" && both ? renderSlider(it, s, mode) : renderPair(it, s, s.baLayout));
      if (clean(it.caption)) {
        const c = document.createElement("div");
        c.textContent = it.caption;
        Object.assign(c.style, { fontSize: "13px", textAlign: "center", opacity: ".85", lineHeight: "1.4" });
        work.appendChild(c);
      }
      wrap.appendChild(work);
    });

    return wrap;
  }

  function validate(s) {
    s = Object.assign({}, DEFAULTS, s);
    if (!s.moduleActive) return null;
    const items = filledItems(s);
    if (!items.length) return "Öncesi / Sonrası: hiç fotoğraf yüklenmemiş (modül yayında görünmeyecek).";
    if (items.some(it => !clean(it.before) || !clean(it.after))) return "Öncesi / Sonrası: bazı çalışmalarda fotoğraflardan biri eksik.";
    return null;
  }

  global.SeozModuleRegistry.registerModule({
    id: "before-after",
    label: "Öncesi / Sonrası",
    defaultSettings: DEFAULTS,
    defaultLayerSize: { w: 360, h: 300 },
    autoHeight: true,
    settingsSchema: SETTINGS_SCHEMA,
    render: render,
    validate: validate
  });
})(window);
