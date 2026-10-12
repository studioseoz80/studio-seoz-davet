/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — modules/appointment.js  (YENİ İŞLETME MODÜLÜ — RANDEVU AL)
   -----------------------------------------------------------------------------
   İşletme sayfaları için "Randevu Al" butonu. İki yöntem:
     - "link"     : harici randevu sayfası (Calendly, Google Takvim randevu
                    sayfası, kuaför/klinik sistemi vb.) yeni sekmede açılır.
     - "whatsapp" : WhatsApp sohbeti hazır mesajla açılır.

   BAĞIMSIZLIK KURALLARI:
   - RSVP modülünden (rsvp.js) TAMAMEN bağımsızdır. Tüm ayar anahtarları
     "appt" önekiyle başlar (apptUrl, apptWhatsappNumber, apptMessage ...).
     RSVP'nin whatsappNumber / googleFormUrl / buttonText alanlarını ASLA
     okumaz, yazmaz; rsvp.js'e dokunulmadı.
   - Diğer modüller gibi registerModule() ile kendini tanıtır; formu genel
     module-panel.js settingsSchema'dan otomatik üretir.

   GÖRÜNÜRLÜK:
   - "Modül aktif" kapalıysa yayında HİÇ görünmez (editörde soluk bir
     "pasif" etiketi görünür ki seçilebilsin).
   - Boş alanlar (başlık/açıklama) çizilmez; bağlantı yoksa yayında buton
     da çizilmez. Hiçbir şey yoksa modül yayında sıfır yükseklik kaplar.
   ========================================================================= */

(function (global) {
  "use strict";

  const DEFAULTS = {
    moduleActive: true,
    apptTitle: "",
    apptDescription: "",
    apptMethod: "link",             // "link" | "whatsapp"
    apptUrl: "",
    apptWhatsappNumber: "",
    apptMessage: "Merhaba, randevu almak istiyorum.",
    apptButtonText: "Randevu Al",
    titleFont: "Cormorant Garamond",
    fontFamily: "Manrope",
    fontSize: 15,
    textColor: "#1E2A22",
    buttonTextColor: "#FFFFFF",
    buttonColor: "#93703F",
    metallic: "none",
    buttonWidth: 220,
    buttonHeight: 48,
    borderRadius: 24
  };

  const METALLIC_OPTIONS = [
    { value: "none", label: "Yok" }, { value: "gold", label: "Altın (Koyu Zemin)" },
    { value: "silver", label: "Gümüş (Koyu Zemin)" }, { value: "copper-gold", label: "Bakır Altın (Açık Zemin)" },
    { value: "dark-silver", label: "Koyu Gümüş (Açık Zemin)" }, { value: "copper", label: "Bakır" }
  ];

  const SETTINGS_SCHEMA = [
    { key: "moduleActive", type: "checkbox", label: "Modül aktif (kapalıysa yayında görünmez)" },
    {
      key: "apptMethod", type: "select", label: "Randevu Yöntemi", reRenderPanel: true,
      options: [
        { value: "link", label: "Harici randevu bağlantısı" },
        { value: "whatsapp", label: "WhatsApp" }
      ]
    },
    { key: "apptUrl", type: "url", label: "Randevu Sayfası Bağlantısı (https://...)", showIf: s => s.apptMethod !== "whatsapp" },
    { key: "apptWhatsappNumber", type: "tel", label: "WhatsApp Numarası veya wa.me linki (ör. 905551112233)", showIf: s => s.apptMethod === "whatsapp" },
    { key: "apptMessage", type: "textarea", label: "Hazır WhatsApp Mesajı", showIf: s => s.apptMethod === "whatsapp" },
    { key: "apptButtonText", type: "text", label: "Buton Yazısı" },
    { key: "apptTitle", type: "text", label: "Başlık (isteğe bağlı)" },
    { key: "apptDescription", type: "textarea", label: "Açıklama (isteğe bağlı)" },
    { key: "titleFont", type: "font-select", label: "Başlık Fontu" },
    { key: "fontFamily", type: "font-select", label: "Yazı / Buton Fontu" },
    { key: "fontSize", type: "number", label: "Buton Yazı Boyutu", unit: "px", min: 10 },
    { key: "textColor", type: "color", label: "Yazı Rengi" },
    { key: "buttonTextColor", type: "color", label: "Buton Yazı Rengi" },
    { key: "buttonColor", type: "color", label: "Buton Arka Plan Rengi" },
    { key: "metallic", type: "select", label: "Buton Metalik Efekti", options: METALLIC_OPTIONS },
    { key: "buttonWidth", type: "number", label: "Buton Genişliği", unit: "px", min: 60 },
    { key: "buttonHeight", type: "number", label: "Buton Yüksekliği", unit: "px", min: 30 },
    { key: "borderRadius", type: "number", label: "Köşe Yuvarlaklığı", unit: "px", min: 0 }
  ];

  function digits(v) { return String(v || "").replace(/[^0-9]/g, ""); }

  /* "05551112233" gibi yurt içi yazımı 90'lı biçime çevirir. */
  function waNumber(v) {
    let d = digits(v);
    if (d.length === 11 && d.charAt(0) === "0") d = "90" + d.slice(1);
    return d;
  }

  function normalizeUrl(v) {
    const u = String(v || "").trim();
    if (!u) return "";
    return /^https?:\/\//i.test(u) ? u : "https://" + u;
  }

  /* Bu modülün KENDİ alanlarından hedef adresi üretir; yoksa "". */
  function targetUrl(s) {
    if (s.apptMethod === "whatsapp") {
      const n = waNumber(s.apptWhatsappNumber);
      if (!n) return "";
      return `https://wa.me/${n}` + (s.apptMessage ? `?text=${encodeURIComponent(s.apptMessage)}` : "");
    }
    return normalizeUrl(s.apptUrl);
  }

  function buttonBackground(s) {
    const g = global.SeozRenderer && global.SeozRenderer.METALLIC_GRADIENTS;
    return (g && g[s.metallic]) || s.buttonColor;
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
    const url = targetUrl(s);
    const hasText = !!(String(s.apptTitle).trim() || String(s.apptDescription).trim());

    if (!s.moduleActive) return mode === "edit" ? editPlaceholder("Randevu Al — PASİF (yayında görünmez)") : emptyEl();
    if (mode !== "edit" && !url && !hasText) return emptyEl();

    const wrap = document.createElement("div");
    Object.assign(wrap.style, {
      width: "100%", display: "flex", flexDirection: "column", alignItems: "center",
      gap: "8px", textAlign: "center", color: s.textColor, boxSizing: "border-box", padding: "4px 0"
    });

    if (String(s.apptTitle).trim()) {
      const t = document.createElement("div");
      t.textContent = s.apptTitle;
      Object.assign(t.style, { fontFamily: `"${s.titleFont}", serif`, fontSize: "22px", fontWeight: "600", lineHeight: "1.2" });
      wrap.appendChild(t);
    }
    if (String(s.apptDescription).trim()) {
      const d = document.createElement("div");
      d.textContent = s.apptDescription;
      Object.assign(d.style, { fontFamily: `"${s.fontFamily}", sans-serif`, fontSize: "13px", lineHeight: "1.5", opacity: ".85", whiteSpace: "pre-wrap" });
      wrap.appendChild(d);
    }

    // Bağlantı yoksa: yayında buton HİÇ çizilmez; editörde soluk/pasif görünür.
    if (url || mode === "edit") {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = s.apptButtonText || DEFAULTS.apptButtonText;
      Object.assign(btn.style, {
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: s.buttonWidth + "px", maxWidth: "100%", height: s.buttonHeight + "px",
        borderRadius: s.borderRadius + "px", background: buttonBackground(s), color: s.buttonTextColor,
        fontFamily: `"${s.fontFamily}", sans-serif`, fontSize: s.fontSize + "px", fontWeight: "700",
        border: "none", cursor: url ? "pointer" : "not-allowed", opacity: url ? "1" : ".45", flexShrink: "0"
      });
      if (!url) {
        btn.disabled = true;
        btn.title = "Randevu bağlantısı / WhatsApp numarası girilmemiş";
      }
      btn.addEventListener("click", () => {
        // GÜVENLİK: yalnızca BU modülün kendi appt* alanları kullanılır.
        if (!url) return;
        window.open(url, "_blank", "noopener");
      });
      wrap.appendChild(btn);
    }

    return wrap;
  }

  function validate(s) {
    s = Object.assign({}, DEFAULTS, s);
    if (!s.moduleActive) return null;
    if (targetUrl(s)) return null;
    return s.apptMethod === "whatsapp"
      ? "Randevu Al: WhatsApp numarası girilmemiş (buton yayında görünmeyecek)."
      : "Randevu Al: randevu bağlantısı girilmemiş (buton yayında görünmeyecek).";
  }

  global.SeozModuleRegistry.registerModule({
    id: "appointment",
    label: "Randevu Al",
    defaultSettings: DEFAULTS,
    defaultLayerSize: { w: 300, h: 120 },
    autoHeight: true,
    settingsSchema: SETTINGS_SCHEMA,
    render: render,
    validate: validate,
    _targetUrl: targetUrl // yalnızca testler için
  });
})(window);
