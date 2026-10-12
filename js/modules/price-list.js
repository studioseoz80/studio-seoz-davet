/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — modules/price-list.js  (YENİ İŞLETME MODÜLÜ — FİYAT LİSTESİ)
   -----------------------------------------------------------------------------
   Satır satır "Hizmet Adı ........ Fiyat" listesi. Satır ekle/sil/sırala
   genel module-panel.js'in "item-list" alan tipiyle yapılır.

   - Fiyat boş bırakılabilir: o satırda yalnızca hizmet adı görünür
     (noktalı çizgi de çizilmez).
   - Tamamen boş satırlar yayında çizilmez. Hiç dolu satır yoksa modül
     yayında sıfır yükseklik kaplar.
   - Anahtarlar "pl" önekli — Hizmetlerimiz modülünden de bağımsızdır.
   ========================================================================= */

(function (global) {
  "use strict";

  const DEFAULTS = {
    moduleActive: true,
    plTitle: "Fiyat Listesi",
    plRows: [
      { name: "Hizmet", price: "0 ₺" }
    ],
    plNote: "",
    plLeader: true,
    titleFont: "Cormorant Garamond",
    fontFamily: "Manrope",
    fontSize: 15,
    textColor: "#1E2A22",
    accentColor: "#93703F"
  };

  const SETTINGS_SCHEMA = [
    { key: "moduleActive", type: "checkbox", label: "Modül aktif (kapalıysa yayında görünmez)" },
    { key: "plTitle", type: "text", label: "Başlık (boşsa gösterilmez)" },
    {
      key: "plRows", type: "item-list", label: "Satırlar", itemLabel: "Satır", addLabel: "+ Satır Ekle",
      itemFields: [
        { key: "name", type: "text", label: "Hizmet Adı" },
        { key: "price", type: "text", label: "Fiyat (boş bırakılabilir)" }
      ]
    },
    { key: "plNote", type: "textarea", label: "Alt Not (isteğe bağlı, ör. Fiyatlara KDV dahildir)" },
    { key: "plLeader", type: "checkbox", label: "Ad ile fiyat arasında noktalı çizgi" },
    { key: "titleFont", type: "font-select", label: "Başlık Fontu" },
    { key: "fontFamily", type: "font-select", label: "Yazı Fontu" },
    { key: "fontSize", type: "number", label: "Yazı Boyutu", unit: "px", min: 10 },
    { key: "textColor", type: "color", label: "Yazı Rengi" },
    { key: "accentColor", type: "color", label: "Vurgu Rengi (fiyat, çizgi)" }
  ];

  function clean(v) { return String(v == null ? "" : v).trim(); }

  function filledRows(s) {
    return (Array.isArray(s.plRows) ? s.plRows : []).filter(r => r && (clean(r.name) || clean(r.price)));
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
    const rows = filledRows(s);
    if (!s.moduleActive) return mode === "edit" ? editPlaceholder("Fiyat Listesi — PASİF (yayında görünmez)") : emptyEl();
    if (!rows.length) return mode === "edit" ? editPlaceholder("Fiyat Listesi — henüz satır girilmedi (yayında görünmez)") : emptyEl();

    const fs = Math.max(10, Number(s.fontSize) || DEFAULTS.fontSize);
    const wrap = document.createElement("div");
    Object.assign(wrap.style, {
      width: "100%", boxSizing: "border-box", color: s.textColor,
      fontFamily: `"${s.fontFamily}", sans-serif`, fontSize: fs + "px", padding: "4px 0"
    });

    if (clean(s.plTitle)) {
      const t = document.createElement("div");
      t.textContent = s.plTitle;
      Object.assign(t.style, { fontFamily: `"${s.titleFont}", serif`, fontSize: "24px", fontWeight: "600", textAlign: "center", lineHeight: "1.2", marginBottom: "10px" });
      wrap.appendChild(t);
    }

    rows.forEach(r => {
      const row = document.createElement("div");
      Object.assign(row.style, { display: "flex", alignItems: "baseline", gap: "8px", padding: "6px 0", lineHeight: "1.35" });

      const name = document.createElement("span");
      name.textContent = clean(r.name);
      Object.assign(name.style, { minWidth: "0", overflowWrap: "anywhere" });
      row.appendChild(name);

      if (clean(r.price)) {
        const leader = document.createElement("span");
        Object.assign(leader.style, {
          flex: "1 1 auto", minWidth: "12px", alignSelf: "flex-end", marginBottom: "5px",
          borderBottom: s.plLeader ? `1px dotted ${s.accentColor}` : "none"
        });
        row.appendChild(leader);

        const price = document.createElement("span");
        price.textContent = clean(r.price);
        Object.assign(price.style, { fontWeight: "700", color: s.accentColor, whiteSpace: "nowrap", flexShrink: "0" });
        row.appendChild(price);
      }
      wrap.appendChild(row);
    });

    if (clean(s.plNote)) {
      const n = document.createElement("div");
      n.textContent = s.plNote;
      Object.assign(n.style, { fontSize: Math.max(10, fs - 3) + "px", opacity: ".7", textAlign: "center", marginTop: "10px", whiteSpace: "pre-wrap" });
      wrap.appendChild(n);
    }

    return wrap;
  }

  function validate(s) {
    s = Object.assign({}, DEFAULTS, s);
    if (!s.moduleActive) return null;
    return filledRows(s).length ? null : "Fiyat Listesi: hiç satır girilmemiş (modül yayında görünmeyecek).";
  }

  global.SeozModuleRegistry.registerModule({
    id: "price-list",
    label: "Fiyat Listesi",
    defaultSettings: DEFAULTS,
    defaultLayerSize: { w: 360, h: 200 },
    autoHeight: true,
    settingsSchema: SETTINGS_SCHEMA,
    render: render,
    validate: validate
  });
})(window);
