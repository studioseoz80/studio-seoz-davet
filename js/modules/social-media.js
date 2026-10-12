/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — modules/social-media.js  (YENİ İŞLETME MODÜLÜ — SOSYAL MEDYA)
   -----------------------------------------------------------------------------
   Instagram, TikTok, Facebook ve WhatsApp bağlantıları. Her alan isteğe
   bağlıdır; BOŞ bırakılan platform yayınlanan sayfada HİÇ görünmez.

   Kabul edilen yazımlar (ikisi de çalışır):
     Instagram : "@kullanici"  veya  "https://instagram.com/kullanici"
     TikTok    : "@kullanici"  veya  "https://www.tiktok.com/@kullanici"
     Facebook  : "sayfaadi"    veya  "https://facebook.com/sayfaadi"
     WhatsApp  : "905551112233", "0555 111 22 33" veya "https://wa.me/90..."

   BAĞIMSIZLIK: tüm anahtarlar "social" önekli; başka hiçbir modülün
   alanını okumaz. registerModule() ile kendini tanıtır.
   Simgeler bu dosyada çizilmiş basit SVG'lerdir (dış dosya/CDN yok).
   ========================================================================= */

(function (global) {
  "use strict";

  const DEFAULTS = {
    moduleActive: true,
    socialTitle: "",
    socialInstagram: "",
    socialTiktok: "",
    socialFacebook: "",
    socialWhatsapp: "",
    socialStyle: "icons",          // "icons" | "buttons"
    iconSize: 46,
    titleFont: "Cormorant Garamond",
    fontFamily: "Manrope",
    textColor: "#1E2A22",
    iconColor: "#FFFFFF",
    buttonColor: "#93703F",
    metallic: "none"
  };

  const METALLIC_OPTIONS = [
    { value: "none", label: "Yok" }, { value: "gold", label: "Altın (Koyu Zemin)" },
    { value: "silver", label: "Gümüş (Koyu Zemin)" }, { value: "copper-gold", label: "Bakır Altın (Açık Zemin)" },
    { value: "dark-silver", label: "Koyu Gümüş (Açık Zemin)" }, { value: "copper", label: "Bakır" }
  ];

  const SETTINGS_SCHEMA = [
    { key: "moduleActive", type: "checkbox", label: "Modül aktif (kapalıysa yayında görünmez)" },
    { key: "socialInstagram", type: "text", label: "Instagram (@kullanici veya bağlantı — boşsa görünmez)" },
    { key: "socialTiktok", type: "text", label: "TikTok (@kullanici veya bağlantı — boşsa görünmez)" },
    { key: "socialFacebook", type: "text", label: "Facebook (sayfa adı veya bağlantı — boşsa görünmez)" },
    { key: "socialWhatsapp", type: "tel", label: "WhatsApp (numara veya wa.me linki — boşsa görünmez)" },
    { key: "socialTitle", type: "text", label: "Başlık (isteğe bağlı, ör. Bizi Takip Edin)" },
    {
      key: "socialStyle", type: "select", label: "Görünüm",
      options: [
        { value: "icons", label: "Yan yana yuvarlak simgeler" },
        { value: "buttons", label: "Alt alta yazılı butonlar" }
      ]
    },
    { key: "iconSize", type: "number", label: "Simge / Buton Boyutu", unit: "px", min: 28 },
    { key: "titleFont", type: "font-select", label: "Başlık Fontu" },
    { key: "fontFamily", type: "font-select", label: "Buton Fontu" },
    { key: "textColor", type: "color", label: "Başlık Rengi" },
    { key: "iconColor", type: "color", label: "Simge / Buton Yazı Rengi" },
    { key: "buttonColor", type: "color", label: "Simge / Buton Arka Plan Rengi" },
    { key: "metallic", type: "select", label: "Metalik Efekt", options: METALLIC_OPTIONS }
  ];

  const ICONS = {
    instagram: '<rect x="3.5" y="3.5" width="17" height="17" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.2" cy="6.8" r="1.2" fill="currentColor"/>',
    tiktok: '<path d="M14 3.5v11a3.6 3.6 0 1 1-3.6-3.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M14 3.5c.6 2.6 2.4 4.3 5 4.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    facebook: '<path d="M13.6 21v-7.2h2.5l.4-3h-2.9V9c0-.9.3-1.5 1.5-1.5h1.5V4.8c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.3H8.2v3h2.5V21z" fill="currentColor"/>',
    whatsapp: '<path d="M4 20.5l1.2-4A8.3 8.3 0 1 1 8.4 19.4z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M9.2 8.3c.3-.4.7-.4.9 0l.7 1.5c.1.3 0 .5-.2.7l-.5.5c.5 1.1 1.4 2 2.5 2.5l.5-.5c.2-.2.5-.3.7-.2l1.5.7c.4.2.4.6 0 .9-.6.6-1.3.9-2 .7-2.2-.6-3.9-2.3-4.5-4.5-.2-.7.1-1.4.4-1.8z" fill="currentColor"/>'
  };

  const LABELS = { instagram: "Instagram", tiktok: "TikTok", facebook: "Facebook", whatsapp: "WhatsApp" };

  function clean(v) { return String(v || "").trim(); }
  function isUrl(v) { return /^https?:\/\//i.test(v); }

  function profileUrl(v, domain, base) {
    v = clean(v);
    if (!v) return "";
    if (isUrl(v)) return v;
    if (v.toLowerCase().indexOf(domain) !== -1) return "https://" + v.replace(/^\/+/, "");
    const handle = v.replace(/^@+/, "").replace(/\s+/g, "");
    return handle ? base + handle : "";
  }

  function waUrl(v) {
    let d = clean(v).replace(/[^0-9]/g, "");
    if (d.length === 11 && d.charAt(0) === "0") d = "90" + d.slice(1);
    return d ? "https://wa.me/" + d : "";
  }

  /* Yalnızca DOLU platformları sırasıyla döndürür. */
  function links(s) {
    const out = [];
    const ig = profileUrl(s.socialInstagram, "instagram.com", "https://instagram.com/");
    const tt = profileUrl(s.socialTiktok, "tiktok.com", "https://www.tiktok.com/@");
    const fb = profileUrl(s.socialFacebook, "facebook.com", "https://facebook.com/");
    const wa = waUrl(s.socialWhatsapp);
    if (ig) out.push({ id: "instagram", url: ig });
    if (tt) out.push({ id: "tiktok", url: tt });
    if (fb) out.push({ id: "facebook", url: fb });
    if (wa) out.push({ id: "whatsapp", url: wa });
    return out;
  }

  function background(s) {
    const g = global.SeozRenderer && global.SeozRenderer.METALLIC_GRADIENTS;
    return (g && g[s.metallic]) || s.buttonColor;
  }

  function svg(id, size) {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" style="display:block">${ICONS[id]}</svg>`;
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
    const list = links(s);

    if (!s.moduleActive) return mode === "edit" ? editPlaceholder("Sosyal Medya — PASİF (yayında görünmez)") : emptyEl();
    if (!list.length) {
      return mode === "edit" ? editPlaceholder("Sosyal Medya — henüz hesap girilmedi (yayında görünmez)") : emptyEl();
    }

    const size = Math.max(28, Number(s.iconSize) || DEFAULTS.iconSize);
    const wrap = document.createElement("div");
    Object.assign(wrap.style, {
      width: "100%", display: "flex", flexDirection: "column", alignItems: "center",
      gap: "10px", textAlign: "center", boxSizing: "border-box", padding: "4px 0"
    });

    if (clean(s.socialTitle)) {
      const t = document.createElement("div");
      t.textContent = s.socialTitle;
      Object.assign(t.style, { fontFamily: `"${s.titleFont}", serif`, fontSize: "20px", fontWeight: "600", color: s.textColor, lineHeight: "1.2" });
      wrap.appendChild(t);
    }

    const row = document.createElement("div");
    const asButtons = s.socialStyle === "buttons";
    Object.assign(row.style, asButtons
      ? { display: "flex", flexDirection: "column", alignItems: "stretch", gap: "8px", width: "100%", maxWidth: "300px" }
      : { display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "12px" });

    list.forEach(item => {
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("aria-label", LABELS[item.id]);
      b.title = LABELS[item.id];
      const common = {
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        background: background(s), color: s.iconColor, border: "none", cursor: "pointer", padding: "0"
      };
      if (asButtons) {
        Object.assign(b.style, common, {
          height: size + "px", borderRadius: (size / 2) + "px", gap: "10px",
          fontFamily: `"${s.fontFamily}", sans-serif`, fontSize: Math.round(size * 0.32) + "px", fontWeight: "700"
        });
        b.innerHTML = svg(item.id, Math.round(size * 0.48)) + `<span>${LABELS[item.id]}</span>`;
      } else {
        Object.assign(b.style, common, { width: size + "px", height: size + "px", borderRadius: "50%" });
        b.innerHTML = svg(item.id, Math.round(size * 0.52));
      }
      b.addEventListener("click", () => window.open(item.url, "_blank", "noopener"));
      row.appendChild(b);
    });

    wrap.appendChild(row);
    return wrap;
  }

  function validate(s) {
    s = Object.assign({}, DEFAULTS, s);
    if (!s.moduleActive) return null;
    return links(s).length ? null : "Sosyal Medya: hiçbir hesap girilmemiş (modül yayında görünmeyecek).";
  }

  global.SeozModuleRegistry.registerModule({
    id: "social-media",
    label: "Sosyal Medya",
    defaultSettings: DEFAULTS,
    defaultLayerSize: { w: 300, h: 90 },
    autoHeight: true,
    settingsSchema: SETTINGS_SCHEMA,
    render: render,
    validate: validate,
    _links: links // yalnızca testler için
  });
})(window);
