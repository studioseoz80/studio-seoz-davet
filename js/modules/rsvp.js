/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — modules/rsvp.js
   -----------------------------------------------------------------------------
   RSVP / Katılım modülü. Dört mod:
     1) kapali        → hiçbir buton görünmez
     2) whatsapp-tek   → "Katılım Bildir" tek butonu, WhatsApp'ı açar
     3) google-form    → buton, belirlenen Google Form bağlantısını açar
     4) whatsapp-iki   → "Katılıyorum" / "Katılamıyorum" iki ayrı buton,
                          her biri kendi hazır WhatsApp mesajını açar

   Butonlar hem editörde hem yayında AYNI şekilde tıklanabilir (Konum ve
   Müzik modüllerinde daha önce düzeltilen mode==="view" kısıtlaması
   buraya hiç eklenmedi).
   ========================================================================= */

(function (global) {
  "use strict";

  const DEFAULTS = {
    rsvpMode: "kapali",
    whatsappNumber: "",
    googleFormUrl: "",
    buttonText: "Katılım Bildir",
    acceptButtonText: "Katılıyorum",
    acceptMessage: "Merhaba, davetinize katılıyorum.",
    declineButtonText: "Katılamıyorum",
    declineMessage: "Merhaba, davetiniz için teşekkür ederim. Ne yazık ki katılamıyorum.",
    fontFamily: "Manrope",
    fontSize: 15,
    textColor: "#FFFFFF",
    bgColor: "#93703F",
    metallic: "none",
    buttonWidth: 200,
    buttonHeight: 46,
    borderRadius: 24
  };

  const isWhatsappMode = s => s.rsvpMode === "whatsapp-tek" || s.rsvpMode === "whatsapp-iki";

  const SETTINGS_SCHEMA = [
    {
      key: "rsvpMode", type: "select", label: "RSVP Türü", reRenderPanel: true,
      options: [
        { value: "kapali", label: "Kapalı" },
        { value: "whatsapp-tek", label: "WhatsApp – Tek Buton" },
        { value: "google-form", label: "Google Form" },
        { value: "whatsapp-iki", label: "WhatsApp – İki Buton" }
      ]
    },
    { key: "whatsappNumber", type: "tel", label: "WhatsApp Numarası (ülke koduyla, ör. 905551112233)", showIf: isWhatsappMode },
    { key: "googleFormUrl", type: "url", label: "Google Form Bağlantısı", showIf: s => s.rsvpMode === "google-form" },
    { key: "buttonText", type: "text", label: "Buton Yazısı", showIf: s => s.rsvpMode === "whatsapp-tek" || s.rsvpMode === "google-form" },
    { key: "acceptButtonText", type: "text", label: '"Katılıyorum" Buton Yazısı', showIf: s => s.rsvpMode === "whatsapp-iki" },
    { key: "acceptMessage", type: "textarea", label: '"Katılıyorum" WhatsApp Mesajı', showIf: s => s.rsvpMode === "whatsapp-iki" },
    { key: "declineButtonText", type: "text", label: '"Katılamıyorum" Buton Yazısı', showIf: s => s.rsvpMode === "whatsapp-iki" },
    { key: "declineMessage", type: "textarea", label: '"Katılamıyorum" WhatsApp Mesajı', showIf: s => s.rsvpMode === "whatsapp-iki" },
    { key: "fontFamily", type: "font-select", label: "Buton Fontu", showIf: s => s.rsvpMode !== "kapali" },
    { key: "fontSize", type: "number", label: "Buton Yazı Boyutu", unit: "px", showIf: s => s.rsvpMode !== "kapali" },
    { key: "textColor", type: "color", label: "Buton Yazı Rengi", showIf: s => s.rsvpMode !== "kapali" },
    { key: "bgColor", type: "color", label: "Buton Arka Plan Rengi", showIf: s => s.rsvpMode !== "kapali" },
    {
      key: "metallic", type: "select", label: "Buton Metalik Efekti (dolu buton)", showIf: s => s.rsvpMode !== "kapali",
      options: [{ value: "none", label: "Yok" }, { value: "gold", label: "Altın (Koyu Zemin)" }, { value: "silver", label: "Gümüş (Koyu Zemin)" }, { value: "copper-gold", label: "Bakır Altın (Açık Zemin)" }, { value: "dark-silver", label: "Koyu Gümüş (Açık Zemin)" }, { value: "copper", label: "Bakır" }]
    },
    { key: "buttonWidth", type: "number", label: "Buton Genişliği", unit: "px", min: 60, showIf: s => s.rsvpMode !== "kapali" },
    { key: "buttonHeight", type: "number", label: "Buton Yüksekliği", unit: "px", min: 30, showIf: s => s.rsvpMode !== "kapali" },
    { key: "borderRadius", type: "number", label: "Köşe Yuvarlaklığı", unit: "px", min: 0, showIf: s => s.rsvpMode !== "kapali" }
  ];

  /* "none" iken düz s.bgColor, "gold"/"silver" iken metin efektiyle AYNI
     paylaşılan gradyanı döndürür (renderer.js). Yalnızca DOLU (fill)
     butonlara uygulanır — RSVP'nin "Katılamıyorum" anahat (outline)
     butonu kasıtlı olarak düz renk kullanmaya devam eder. */
  function buttonBackground(s) {
    const g = global.SeozRenderer && global.SeozRenderer.METALLIC_GRADIENTS;
    return (g && g[s.metallic]) || s.bgColor;
  }

  function buildWhatsAppUrl(number, message) {
    const cleanNumber = (number || "").replace(/[^0-9]/g, "");
    return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message || "")}`;
  }

  function styledButton(s, text) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = text;
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
      cursor: "pointer",
      flexShrink: "0"
    });
    return btn;
  }

  function render(settings, mode, ctx) {
    const s = Object.assign({}, DEFAULTS, settings);
    const wrap = document.createElement("div");
    wrap.style.width = "100%";
    wrap.style.height = "100%";
    wrap.style.display = "flex";
    wrap.style.alignItems = "center";
    wrap.style.justifyContent = "center";

    if (s.rsvpMode === "kapali") {
      // Yayında hiçbir şey görünmez. Editörde katmanı bulabilmeniz için
      // hafif, göze batmayan bir yer tutucu gösterilir.
      if (mode === "edit") {
        const placeholder = document.createElement("div");
        placeholder.textContent = "RSVP kapalı — yayında görünmeyecek";
        Object.assign(placeholder.style, {
          fontSize: "12px",
          fontFamily: "'Manrope', sans-serif",
          color: "#9a9a90",
          border: "1px dashed #ccc",
          padding: "10px 14px",
          borderRadius: "6px",
          textAlign: "center"
        });
        wrap.appendChild(placeholder);
      }
      return wrap;
    }

    // MADDE 7: bağlantı/numara yoksa buton görsel ve işlevsel olarak
    // PASİF — GÜVENLİK: bu modülün kendi whatsappNumber/googleFormUrl
    // değerleri dışında (ör. Konum'un mapsUrl'i, Anı Yükle'nin
    // uploadUrl'i) HİÇBİR ŞEYE ASLA fallback yapılmaz.
    function setDisabledIfEmpty(btn, hasValue) {
      btn.style.cursor = hasValue ? "pointer" : "not-allowed";
      btn.style.opacity = hasValue ? "1" : ".45";
      if (!hasValue) btn.disabled = true;
    }

    if (s.rsvpMode === "whatsapp-tek") {
      const btn = styledButton(s, s.buttonText || "Katılım Bildir");
      setDisabledIfEmpty(btn, !!s.whatsappNumber);
      btn.addEventListener("click", () => {
        if (!s.whatsappNumber) return;
        const url = buildWhatsAppUrl(s.whatsappNumber, "Merhaba, davetinize katılıyorum.");
        window.open(url, "_blank", "noopener");
      });
      wrap.appendChild(btn);
    }

    if (s.rsvpMode === "google-form") {
      const btn = styledButton(s, s.buttonText || "Katılım Bildir");
      setDisabledIfEmpty(btn, !!s.googleFormUrl);
      btn.addEventListener("click", () => {
        if (!s.googleFormUrl) return;
        window.open(s.googleFormUrl, "_blank", "noopener");
      });
      wrap.appendChild(btn);
    }

    if (s.rsvpMode === "whatsapp-iki") {
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.gap = "10px";
      row.style.flexWrap = "wrap";
      row.style.justifyContent = "center";

      const hasNumber = !!s.whatsappNumber;

      const acceptBtn = styledButton(s, s.acceptButtonText || "Katılıyorum");
      setDisabledIfEmpty(acceptBtn, hasNumber);
      acceptBtn.addEventListener("click", () => {
        if (!s.whatsappNumber) return;
        window.open(buildWhatsAppUrl(s.whatsappNumber, s.acceptMessage), "_blank", "noopener");
      });

      const declineBtn = styledButton(s, s.declineButtonText || "Katılamıyorum");
      declineBtn.style.background = "transparent";
      declineBtn.style.border = `1px solid ${s.bgColor}`;
      declineBtn.style.color = s.bgColor;
      setDisabledIfEmpty(declineBtn, hasNumber);
      declineBtn.addEventListener("click", () => {
        if (!s.whatsappNumber) return;
        window.open(buildWhatsAppUrl(s.whatsappNumber, s.declineMessage), "_blank", "noopener");
      });

      row.appendChild(acceptBtn);
      row.appendChild(declineBtn);
      wrap.appendChild(row);
    }

    return wrap;
  }

  global.SeozModuleRegistry.registerModule({
    id: "rsvp",
    label: "RSVP / Katılım",
    defaultSettings: DEFAULTS,
    defaultLayerSize: { w: 260, h: 70 },
    settingsSchema: SETTINGS_SCHEMA,
    render: render,
    validate: (s) => {
      if (s.rsvpMode === "whatsapp-tek" || s.rsvpMode === "whatsapp-iki") {
        if (!s.whatsappNumber) return "RSVP: WhatsApp numarası girilmemiş.";
      }
      if (s.rsvpMode === "google-form" && !s.googleFormUrl) {
        return "RSVP: Google Form bağlantısı girilmemiş.";
      }
      return null;
    }
  });
})(window);
