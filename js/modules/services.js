/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — modules/services.js  (YENİ İŞLETME MODÜLÜ — HİZMETLERİMİZ)
   -----------------------------------------------------------------------------
   Birden fazla hizmet: her birinde Hizmet Adı, Kısa Açıklama, isteğe bağlı
   Fiyat. Hizmet ekle/sil/sırala, genel module-panel.js'in "item-list"
   alan tipiyle yapılır.

   GÖRÜNÜRLÜK: Tamamen boş hizmet satırları yayında çizilmez; boş açıklama
   veya boş fiyat o satırda yer kaplamaz. Hiç dolu hizmet yoksa modül yayında
   sıfır yükseklik kaplar. Anahtarlar "svc" önekli — başka modülle karışmaz.
   ========================================================================= */

(function (global) {
  "use strict";

  const DEFAULTS = {
    moduleActive: true,
    svcTitle: "Hizmetlerimiz",
    svcItems: [
      { name: "Hizmet Adı", description: "Kısa açıklama", price: "" }
    ],
    svcLayout: "cards",            // "cards" | "list"
    titleFont: "Cormorant Garamond",
    fontFamily: "Manrope",
    fontSize: 15,
    textColor: "#1E2A22",
    accentColor: "#93703F",
    cardColor: "#FFFFFF",
    borderRadius: 10
  };

  const SETTINGS_SCHEMA = [
    { key: "moduleActive", type: "checkbox", label: "Modül aktif (kapalıysa yayında görünmez)" },
    { key: "svcTitle", type: "text", label: "Başlık (boşsa gösterilmez)" },
    {
      key: "svcItems", type: "item-list", label: "Hizmetler", itemLabel: "Hizmet", addLabel: "+ Hizmet Ekle",
      itemFields: [
        { key: "name", type: "text", label: "Hizmet Adı" },
        { key: "description", type: "textarea", label: "Kısa Açıklama (isteğe bağlı)" },
        { key: "price", type: "text", label: "Fiyat (isteğe bağlı, ör. 750 ₺)" }
      ]
    },
    {
      key: "svcLayout", type: "select", label: "Görünüm",
      options: [{ value: "cards", label: "Kartlar" }, { value: "list", label: "Sade liste (ayırıcı çizgili)" }]
    },
    { key: "titleFont", type: "font-select", label: "Başlık Fontu" },
    { key: "fontFamily", type: "font-select", label: "Yazı Fontu" },
    { key: "fontSize", type: "number", label: "Hizmet Adı Boyutu", unit: "px", min: 10 },
    { key: "textColor", type: "color", label: "Yazı Rengi" },
    { key: "accentColor", type: "color", label: "Vurgu Rengi (fiyat, çizgiler)" },
    { key: "cardColor", type: "color", label: "Kart Arka Planı" },
    { key: "borderRadius", type: "number", label: "Köşe Yuvarlaklığı", unit: "px", min: 0 }
  ];

  function clean(v) { return String(v == null ? "" : v).trim(); }

  function filledItems(s) {
    return (Array.isArray(s.svcItems) ? s.svcItems : [])
      .filter(it => it && (clean(it.name) || clean(it.description) || clean(it.price)));
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

  function render(settings, mode) {
    const s = Object.assign({}, DEFAULTS, settings);
    const items = filledItems(s);
    if (!s.moduleActive) return mode === "edit" ? editPlaceholder("Hizmetlerimiz — PASİF (yayında görünmez)") : emptyEl();
    if (!items.length) return mode === "edit" ? editPlaceholder("Hizmetlerimiz — henüz hizmet girilmedi (yayında görünmez)") : emptyEl();

    const fs = Math.max(10, Number(s.fontSize) || DEFAULTS.fontSize);
    const cards = s.svcLayout !== "list";

    const wrap = document.createElement("div");
    Object.assign(wrap.style, {
      width: "100%", boxSizing: "border-box", color: s.textColor,
      fontFamily: `"${s.fontFamily}", sans-serif`, display: "flex", flexDirection: "column",
      gap: cards ? "10px" : "0", padding: "4px 0"
    });

    if (clean(s.svcTitle)) {
      const t = document.createElement("div");
      t.textContent = s.svcTitle;
      Object.assign(t.style, {
        fontFamily: `"${s.titleFont}", serif`, fontSize: "24px", fontWeight: "600",
        textAlign: "center", lineHeight: "1.2", marginBottom: cards ? "2px" : "8px"
      });
      wrap.appendChild(t);
    }

    items.forEach((it, i) => {
      const row = document.createElement("div");
      Object.assign(row.style, cards
        ? { background: s.cardColor, borderRadius: s.borderRadius + "px", padding: "12px 14px", boxShadow: "0 1px 4px rgba(0,0,0,.06)", borderLeft: `3px solid ${s.accentColor}` }
        : { padding: "10px 2px", borderTop: i === 0 ? "none" : `1px solid ${s.accentColor}33` });

      const head = document.createElement("div");
      Object.assign(head.style, { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "10px" });

      if (clean(it.name)) {
        const n = document.createElement("div");
        n.textContent = it.name;
        Object.assign(n.style, { fontSize: fs + "px", fontWeight: "700", lineHeight: "1.3", minWidth: "0", overflowWrap: "anywhere" });
        head.appendChild(n);
      }
      if (clean(it.price)) {
        const p = document.createElement("div");
        p.textContent = it.price;
        Object.assign(p.style, { fontSize: fs + "px", fontWeight: "700", color: s.accentColor, whiteSpace: "nowrap", flexShrink: "0", marginLeft: "auto" });
        head.appendChild(p);
      }
      if (head.childNodes.length) row.appendChild(head);

      if (clean(it.description)) {
        const d = document.createElement("div");
        d.textContent = it.description;
        Object.assign(d.style, { fontSize: Math.max(10, fs - 2) + "px", lineHeight: "1.5", opacity: ".8", marginTop: head.childNodes.length ? "4px" : "0", whiteSpace: "pre-wrap", overflowWrap: "anywhere" });
        row.appendChild(d);
      }
      wrap.appendChild(row);
    });

    return wrap;
  }

  function validate(s) {
    s = Object.assign({}, DEFAULTS, s);
    if (!s.moduleActive) return null;
    return filledItems(s).length ? null : "Hizmetlerimiz: hiç hizmet girilmemiş (modül yayında görünmeyecek).";
  }

  global.SeozModuleRegistry.registerModule({
    id: "services",
    label: "Hizmetlerimiz",
    defaultSettings: DEFAULTS,
    defaultLayerSize: { w: 360, h: 220 },
    autoHeight: true,
    settingsSchema: SETTINGS_SCHEMA,
    render: render,
    validate: validate
  });
})(window);
