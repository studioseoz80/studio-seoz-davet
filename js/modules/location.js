/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — modules/location.js
   Konum modülü: mekân adı + adres + Google Maps'e giden bir buton.
   Buton hem editörde hem yayınlanan sayfada aynı şekilde çalışır —
   tıklanınca girilen Google Maps bağlantısını yeni sekmede açar.
   Sürükleme ile çakışmaması drag-resize.js'teki hareket eşiğiyle
   (DRAG_THRESHOLD) çözülmüştür: gerçek bir sürükleme olmadıkça tıklama
   engellenmez.
   ========================================================================= */

(function (global) {
  "use strict";

  const DEFAULTS = {
    venueName: "Mekân Adı",
    address: "",
    mapsUrl: "",
    buttonText: "Konumu Gör",
    fontFamily: "Manrope",
    fontSize: 15,
    textColor: "#FFFFFF",
    bgColor: "#93703F",
    // EK ÖZELLİK: "none" | "gold" | "silver" — doluysa buton arka planı
    // düz renk yerine metalik bir gradyan kullanır (bkz. renderer.js
    // METALLIC_GRADIENTS — metin efektiyle aynı görünüm, paylaşılan kaynak).
    metallic: "none",
    buttonWidth: 200,
    buttonHeight: 46,
    borderRadius: 24
  };

  const SETTINGS_SCHEMA = [
    { key: "venueName", type: "text", label: "Mekân Adı" },
    { key: "address", type: "text", label: "Adres" },
    { key: "mapsUrl", type: "url", label: "Google Maps Bağlantısı" },
    { key: "buttonText", type: "text", label: "Buton Yazısı" },
    { key: "fontFamily", type: "font-select", label: "Buton Fontu" },
    { key: "fontSize", type: "number", label: "Buton Yazı Boyutu", unit: "px" },
    { key: "textColor", type: "color", label: "Buton Yazı Rengi" },
    { key: "bgColor", type: "color", label: "Buton Arka Plan Rengi" },
    {
      key: "metallic", type: "select", label: "Buton Metalik Efekti",
      options: [{ value: "none", label: "Yok" }, { value: "gold", label: "Altın (Koyu Zemin)" }, { value: "silver", label: "Gümüş (Koyu Zemin)" }, { value: "copper-gold", label: "Bakır Altın (Açık Zemin)" }, { value: "dark-silver", label: "Koyu Gümüş (Açık Zemin)" }]
    },
    { key: "buttonWidth", type: "number", label: "Buton Genişliği", unit: "px", min: 60 },
    { key: "buttonHeight", type: "number", label: "Buton Yüksekliği", unit: "px", min: 30 },
    { key: "borderRadius", type: "number", label: "Köşe Yuvarlaklığı", unit: "px", min: 0 }
  ];

  /* "none" iken düz s.bgColor, "gold"/"silver" iken metin efektiyle
     AYNI paylaşılan gradyanı döndürür (renderer.js). */
  function buttonBackground(s) {
    const g = global.SeozRenderer && global.SeozRenderer.METALLIC_GRADIENTS;
    return (g && g[s.metallic]) || s.bgColor;
  }

  function render(settings, mode, ctx) {
    const s = Object.assign({}, DEFAULTS, settings);
    const wrap = document.createElement("div");
    wrap.style.width = "100%";
    wrap.style.height = "100%";
    wrap.style.display = "flex";
    wrap.style.flexDirection = "column";
    wrap.style.alignItems = "center";
    wrap.style.justifyContent = "center";
    wrap.style.gap = "6px";
    wrap.style.textAlign = "center";

    if (s.venueName) {
      const nameEl = document.createElement("div");
      nameEl.textContent = s.venueName;
      nameEl.style.fontFamily = "'Cormorant Garamond', serif";
      nameEl.style.fontSize = "18px";
      nameEl.style.fontWeight = "600";
      wrap.appendChild(nameEl);
    }
    if (s.address) {
      const addrEl = document.createElement("div");
      addrEl.textContent = s.address;
      addrEl.style.fontFamily = "'Manrope', sans-serif";
      addrEl.style.fontSize = "12px";
      addrEl.style.color = "#6B6A5E";
      wrap.appendChild(addrEl);
    }

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = s.buttonText || "Konumu Gör";
    // MADDE 7: bağlantı yoksa buton görsel ve işlevsel olarak PASİF.
    const hasLink = !!s.mapsUrl;
    Object.assign(btn.style, {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: s.buttonWidth + "px",
      height: s.buttonHeight + "px",
      borderRadius: s.borderRadius + "px",
      background: buttonBackground(s),
      color: s.textColor,
      fontFamily: `"${s.fontFamily}", sans-serif`,
      fontSize: s.fontSize + "px",
      border: "none",
      textDecoration: "none",
      cursor: hasLink ? "pointer" : "not-allowed",
      opacity: hasLink ? "1" : ".45",
      flexShrink: "0"
    });
    if (!hasLink) btn.disabled = true;
    // DÜZELTME: Buton artık hem editörde hem yayınlanan sayfada aynı
    // şekilde çalışır — tıklanınca girilen Google Maps bağlantısını
    // yeni sekmede açar. (Sürükleme ile çakışmaması, drag-resize.js'teki
    // hareket eşiği ile ayrıca çözülmüştür — bkz. o dosyanın başındaki not.)
    btn.addEventListener("click", () => {
      // GÜVENLİK (MADDE 7): yalnızca BU modülün kendi "mapsUrl" değeri
      // kullanılır. Anı Yükle'nin uploadUrl'ine veya RSVP'nin
      // googleFormUrl/whatsappNumber'ına ASLA fallback yapılmaz.
      if (!s.mapsUrl) return;
      window.open(s.mapsUrl, "_blank", "noopener");
    });
    wrap.appendChild(btn);

    return wrap;
  }

  global.SeozModuleRegistry.registerModule({
    id: "location",
    label: "Konum",
    defaultSettings: DEFAULTS,
    defaultLayerSize: { w: 240, h: 130 },
    settingsSchema: SETTINGS_SCHEMA,
    render: render,
    // FAZ 9: "Yayına Hazırla" öncesi kontrol listesi için isteğe bağlı
    // doğrulama. Eksik bir şey yoksa null/undefined döner.
    validate: (s) => (!s.mapsUrl ? "Konum: Google Maps bağlantısı girilmemiş." : null)
  });
})(window);
