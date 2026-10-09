/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — modules/gift.js  (YENİ MODÜL — HEDİYE)
   -----------------------------------------------------------------------------
   İsteğe bağlı hediye bölümü:
     - "kapali" : yayında HİÇBİR ŞEY görünmez (editörde yalnızca soluk bir
                  yer tutucu, katmanı bulabilmeniz için)
     - "link"   : hediye listesi / gönderme bağlantısı butonu
     - "iban"   : hesap sahibi + IBAN (+ isteğe bağlı banka adı) ve
                  "IBAN'ı Kopyala" butonu
     - "both"   : ikisi birlikte

   Diğer modüller gibi registerModule() ile kendini tanıtır; ayar formu
   genel module-panel.js tarafından settingsSchema'dan otomatik üretilir.
   Başka hiçbir modülün alanlarını okumaz/yazmaz.
   ========================================================================= */

(function (global) {
  "use strict";

  const DEFAULTS = {
    giftMode: "kapali",
    title: "Hediye",
    description: "",
    giftUrl: "",
    giftButtonText: "Hediye Listesi",
    accountHolder: "",
    iban: "",
    bankName: "",
    copyButtonText: "IBAN'ı Kopyala",
    fontFamily: "Manrope",
    fontSize: 15,
    textColor: "#1E2A22",
    titleMetallic: "none",
    buttonColor: "#93703F",
    buttonTextColor: "#FFFFFF",
    metallic: "none"
  };

  const METALLIC_OPTIONS = [
    { value: "none", label: "Yok" },
    { value: "gold", label: "Altın (Koyu Zemin)" },
    { value: "silver", label: "Gümüş (Koyu Zemin)" },
    { value: "copper-gold", label: "Bakır Altın (Açık Zemin)" },
    { value: "dark-silver", label: "Koyu Gümüş (Açık Zemin)" },
    { value: "copper", label: "Bakır" }
  ];

  const isOn = s => s.giftMode !== "kapali";
  const hasLink = s => s.giftMode === "link" || s.giftMode === "both";
  const hasIban = s => s.giftMode === "iban" || s.giftMode === "both";

  const SETTINGS_SCHEMA = [
    {
      key: "giftMode", type: "select", label: "Hediye Bölümü", reRenderPanel: true,
      options: [
        { value: "kapali", label: "Kapalı (davetiyede görünmez)" },
        { value: "link", label: "Hediye linki" },
        { value: "iban", label: "IBAN bilgisi" },
        { value: "both", label: "Hediye linki + IBAN" }
      ]
    },
    { key: "title", type: "text", label: "Başlık", showIf: isOn },
    { key: "description", type: "textarea", label: "Açıklama (isteğe bağlı)", showIf: isOn },

    { key: "giftUrl", type: "url", label: "Hediye Linki", showIf: hasLink },
    { key: "giftButtonText", type: "text", label: "Link Buton Yazısı (ör. Hediye Listesi, Hediye Gönder)", showIf: hasLink },

    { key: "accountHolder", type: "text", label: "Hesap Sahibi", showIf: hasIban },
    { key: "iban", type: "text", label: "IBAN (ör. TR00 0000 0000 0000 0000 0000 00)", showIf: hasIban },
    { key: "bankName", type: "text", label: "Banka Adı (isteğe bağlı)", showIf: hasIban },
    { key: "copyButtonText", type: "text", label: "Kopyala Buton Yazısı", showIf: hasIban },

    { key: "fontFamily", type: "font-select", label: "Font", showIf: isOn },
    { key: "fontSize", type: "number", label: "Yazı Boyutu", unit: "px", min: 10, showIf: isOn },
    { key: "textColor", type: "color", label: "Yazı Rengi", showIf: isOn },
    { key: "titleMetallic", type: "select", label: "Başlık Metalik Efekti", options: METALLIC_OPTIONS, showIf: isOn },
    { key: "buttonColor", type: "color", label: "Buton Rengi", showIf: isOn },
    { key: "buttonTextColor", type: "color", label: "Buton Yazı Rengi", showIf: isOn },
    { key: "metallic", type: "select", label: "Buton Metalik Efekti", options: METALLIC_OPTIONS, showIf: isOn }
  ];

  /* ---------------- IBAN yardımcıları ---------------- */
  function compactIban(v) {
    return String(v || "").replace(/\s+/g, "").toUpperCase();
  }

  function formatIban(v) {
    return compactIban(v).replace(/(.{4})/g, "$1 ").trim();
  }

  // Uluslararası IBAN kontrol hanesi (mod 97). TR IBAN'ları 26 karakterdir.
  function isValidIban(v) {
    const iban = compactIban(v);
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false;
    if (iban.startsWith("TR") && iban.length !== 26) return false;
    const rearranged = iban.slice(4) + iban.slice(0, 4);
    let rem = 0;
    for (const ch of rearranged) {
      const code = /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch;
      for (const d of code) rem = (rem * 10 + Number(d)) % 97;
    }
    return rem === 1;
  }

  /* ---------------- Kopyalama + kısa bildirim ---------------- */
  function copyText(text) {
    if (global.navigator && navigator.clipboard && global.isSecureContext) {
      return navigator.clipboard.writeText(text).then(() => true).catch(() => fallbackCopy(text));
    }
    return Promise.resolve(fallbackCopy(text));
  }

  function fallbackCopy(text) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      Object.assign(ta.style, { position: "fixed", top: "-1000px", opacity: "0" });
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }

  let toastTimer = null;
  function showToast(text) {
    let el = document.getElementById("seoz-gift-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "seoz-gift-toast";
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      Object.assign(el.style, {
        position: "fixed", left: "50%", bottom: "28px", transform: "translateX(-50%) translateY(10px)",
        zIndex: "7000", padding: "10px 18px", borderRadius: "999px",
        background: "rgba(30,42,34,.92)", color: "#fff",
        fontFamily: "'Manrope', sans-serif", fontSize: "14px",
        boxShadow: "0 6px 20px rgba(0,0,0,.18)", opacity: "0",
        transition: "opacity .2s ease, transform .2s ease", pointerEvents: "none"
      });
      document.body.appendChild(el);
    }
    el.textContent = text;
    requestAnimationFrame(() => {
      el.style.opacity = "1";
      el.style.transform = "translateX(-50%) translateY(0)";
    });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.style.opacity = "0";
      el.style.transform = "translateX(-50%) translateY(10px)";
    }, 1800);
  }

  /* ---------------- Görünüm ---------------- */
  function buttonBackground(s) {
    const g = global.SeozRenderer && global.SeozRenderer.METALLIC_GRADIENTS;
    return (g && g[s.metallic]) || s.buttonColor;
  }

  function makeButton(s, text, fs) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = text;
    Object.assign(b.style, {
      alignSelf: "center",
      width: "100%",
      maxWidth: "260px",
      minHeight: "46px",
      padding: "11px 22px",
      borderRadius: "12px",
      border: "none",
      background: buttonBackground(s),
      color: s.buttonTextColor,
      fontFamily: "inherit",
      fontSize: fs + "px",
      fontWeight: "600",
      cursor: "pointer"
    });
    return b;
  }

  function placeholder(text) {
    const p = document.createElement("div");
    p.textContent = text;
    Object.assign(p.style, {
      fontSize: "12px", fontFamily: "'Manrope', sans-serif", color: "#9a9a90",
      border: "1px dashed #ccc", padding: "10px 14px", borderRadius: "6px", textAlign: "center"
    });
    return p;
  }

  function render(settings, mode) {
    const s = Object.assign({}, DEFAULTS, settings);
    const fs = Math.max(12, Number(s.fontSize) || 15);

    const wrap = document.createElement("div");
    wrap.className = "seoz-gift";
    Object.assign(wrap.style, {
      width: "100%", boxSizing: "border-box", padding: "16px 14px",
      display: "flex", flexDirection: "column", alignItems: "center", gap: "14px",
      fontFamily: `"${s.fontFamily}", sans-serif`, fontSize: fs + "px",
      lineHeight: "1.45", color: s.textColor, textAlign: "center"
    });

    if (!isOn(s)) {
      // Yayında hiçbir şey görünmez.
      if (mode === "edit") wrap.appendChild(placeholder("Hediye bölümü kapalı — yayında görünmeyecek"));
      else wrap.style.display = "none";
      return wrap;
    }

    if (s.title || s.description) {
      const head = document.createElement("div");
      Object.assign(head.style, { display: "flex", flexDirection: "column", gap: "6px" });
      if (s.title) {
        const t = document.createElement("div");
        t.textContent = s.title;
        Object.assign(t.style, { fontFamily: "'Cormorant Garamond', serif", fontSize: (fs + 10) + "px", fontWeight: "600", lineHeight: "1.2" });
        if (global.SeozRenderer && global.SeozRenderer.applyMetallicText) global.SeozRenderer.applyMetallicText(t, s.titleMetallic, s.textColor);
        head.appendChild(t);
      }
      if (s.description) {
        const d = document.createElement("div");
        d.textContent = s.description;
        Object.assign(d.style, { opacity: ".85", whiteSpace: "pre-line" });
        head.appendChild(d);
      }
      wrap.appendChild(head);
    }

    if (hasLink(s)) {
      const b = makeButton(s, s.giftButtonText || DEFAULTS.giftButtonText, fs);
      const url = String(s.giftUrl || "").trim();
      if (!url) {
        b.style.opacity = ".5";
        b.style.cursor = "not-allowed";
        b.title = "Hediye linki girilmemiş";
      }
      b.addEventListener("click", () => {
        if (!url) return;
        const win = global.open(url, "_blank", "noopener");
        if (!win) global.location.href = url;
      });
      wrap.appendChild(b);
    }

    if (hasIban(s)) {
      const card = document.createElement("div");
      Object.assign(card.style, {
        width: "100%", boxSizing: "border-box", padding: "14px 12px",
        borderRadius: "12px", border: "1px solid rgba(0,0,0,.12)",
        background: "rgba(255,255,255,.55)",
        display: "flex", flexDirection: "column", alignItems: "center", gap: "6px"
      });

      if (s.accountHolder) {
        const h = document.createElement("div");
        h.textContent = s.accountHolder;
        h.style.fontWeight = "600";
        card.appendChild(h);
      }
      if (s.bankName) {
        const bn = document.createElement("div");
        bn.textContent = s.bankName;
        Object.assign(bn.style, { fontSize: (fs - 2) + "px", opacity: ".75" });
        card.appendChild(bn);
      }
      const ibanEl = document.createElement("div");
      ibanEl.textContent = s.iban ? formatIban(s.iban) : "IBAN girilmemiş";
      Object.assign(ibanEl.style, {
        fontFamily: "'IBM Plex Sans', 'Manrope', sans-serif",
        fontSize: (fs - 1) + "px", letterSpacing: ".04em",
        wordBreak: "break-word", userSelect: "all", opacity: s.iban ? "1" : ".5"
      });
      card.appendChild(ibanEl);

      const copyBtn = makeButton(s, s.copyButtonText || DEFAULTS.copyButtonText, fs - 1);
      copyBtn.style.marginTop = "6px";
      if (!s.iban) { copyBtn.style.opacity = ".5"; copyBtn.style.cursor = "not-allowed"; }
      copyBtn.addEventListener("click", () => {
        const value = compactIban(s.iban);
        if (!value) return;
        copyText(value).then(ok => showToast(ok ? "IBAN kopyalandı" : "Kopyalanamadı — IBAN'ı basılı tutarak seçebilirsiniz"));
      });
      card.appendChild(copyBtn);
      wrap.appendChild(card);
    }

    return wrap;
  }

  function validate(s) {
    const st = Object.assign({}, DEFAULTS, s);
    if (!isOn(st)) return null; // kapalı bir hediye bölümü geçerli bir tercihtir
    const msgs = [];
    if (hasLink(st) && !String(st.giftUrl || "").trim()) msgs.push("hediye linki girilmemiş");
    if (hasIban(st)) {
      if (!String(st.accountHolder || "").trim()) msgs.push("hesap sahibi girilmemiş");
      if (!compactIban(st.iban)) msgs.push("IBAN girilmemiş");
      else if (!isValidIban(st.iban)) msgs.push("IBAN geçersiz görünüyor (rakamları kontrol edin)");
    }
    return msgs.length ? "Hediye: " + msgs.join(", ") + "." : null;
  }

  global.SeozModuleRegistry.registerModule({
    id: "gift",
    label: "Hediye",
    defaultSettings: DEFAULTS,
    defaultLayerSize: { w: 320, h: 220 },
    autoHeight: true,
    settingsSchema: SETTINGS_SCHEMA,
    render: render,
    validate: validate,
    // testler için
    _iban: { compactIban, formatIban, isValidIban }
  });
})(window);
