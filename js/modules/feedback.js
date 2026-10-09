/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — modules/feedback.js  (YENİ MODÜL — GÖRÜŞ BİLDİR)
   -----------------------------------------------------------------------------
   Anketten TAMAMEN BAĞIMSIZ, tek başına kullanılabilen görüş/öneri modülü.
   Lansman, toplantı, seminer, belediye, dernek, site yönetimi, kurumsal
   etkinlik gibi projelere tek başına eklenebilir; anket bulunan bir
   projeye de ayrıca eklenebilir.

   BAĞIMSIZLIK KURALLARI:
   - poll.js'yi, poll-panel.js'i veya anketin hiçbir alanını KULLANMAZ.
   - Kendi ayar alanları vardır (fb* önekli). RSVP'nin whatsappNumber'ı,
     anketin pollFormUrl'i vb. ile hiçbir şekilde karışmaz.
   - Diğer modüller gibi registerModule() ile kendini tanıtır; ayar formu
     genel module-panel.js tarafından settingsSchema'dan otomatik üretilir.
     editor-app.js'e dokunulmadı.

   GÖNDERİM YÖNTEMLERİ (sendMethod):
   - "whatsapp"      : mesaj, müşterinin numarasına hazır yazılı açılır.
   - "google-form"   : müşterinin kendi Google Form'una gönderilir.
   - "external-link" : buton, müşterinin kendi form sayfasını açar
                       (Google Forms, Microsoft Forms vb.).
   - "none"          : gönderim yok (yalnızca görünüm) — editörde uyarı.
   - "seoz"          : Davetiye içinde topla — Studio SEOZ Supabase'ine
                       (feedback_submissions tablosu) kaydedilir.
   ========================================================================= */

(function (global) {
  "use strict";

  const DEFAULTS = {
    title: "Görüş Bildir",
    description: "Görüş, fikir ve önerileriniz bizim için değerli.",
    messageLabel: "Mesajınız",
    messagePlaceholder: "Görüşünüzü buraya yazabilirsiniz.",
    // "off" | "optional" | "required"
    collectName: "off",
    collectContact: "off",
    consentText: "",
    submitButtonText: "Gönder",
    successMessage: "Görüşünüz alınmıştır. Teşekkür ederiz.",
    sendMethod: "none",
    fbWhatsappNumber: "",
    fbFormUrl: "",
    fbFormMessageFieldId: "",
    fbFormNameFieldId: "",
    fbFormContactFieldId: "",
    fbExternalUrl: "",
    externalButtonText: "Görüş Formunu Aç",
    // GÜÇLENDİRME: WhatsApp görünümü — "form" (mevcut: mesaj kutusu +
    // Gönder, WhatsApp hazır mesajla açılır) | "button" (yalnızca buton,
    // doğrudan WhatsApp sohbeti açılır). Eski kayıtlar "form" kalır.
    whatsappStyle: "form",
    waButtonText: "Bize Yaz",
    fontFamily: "Manrope",
    fontSize: 16,
    textColor: "#1E2A22",
    buttonColor: "#93703F",
    metallic: "none"
  };

  const isMethod = (m) => (s) => s.sendMethod === m;
  const isWaButton = (s) => s.sendMethod === "whatsapp" && s.whatsappStyle === "button";
  const isFormMethod = (s) => s.sendMethod !== "external-link" && !isWaButton(s);
  const COLLECT_OPTIONS = [
    { value: "off", label: "İstenmesin" },
    { value: "optional", label: "İsteğe bağlı" },
    { value: "required", label: "Zorunlu" }
  ];

  const SETTINGS_SCHEMA = [
    {
      key: "sendMethod", type: "select", label: "Gönderim Yöntemi", reRenderPanel: true,
      options: [
        { value: "seoz", label: "Davetiye içinde topla (Studio SEOZ)" },
        { value: "external-link", label: "Google Form / harici form (buton formu açar)" },
        { value: "whatsapp", label: "WhatsApp" },
        { value: "google-form", label: "Google Form — sayfa içinden gönder (alan kimlikleri gerekir)" },
        { value: "none", label: "Gönderim yok (yalnızca görünüm)" }
      ]
    },
    {
      key: "whatsappStyle", type: "select", label: "WhatsApp Görünümü", reRenderPanel: true, showIf: isMethod("whatsapp"),
      options: [
        { value: "button", label: "Yalnızca buton (WhatsApp sohbeti açılır)" },
        { value: "form", label: "Mesaj kutusu + Gönder (hazır mesajla açılır)" }
      ]
    },
    { key: "fbWhatsappNumber", type: "tel", label: "WhatsApp Numarası veya wa.me linki (ör. 905551112233)", showIf: isMethod("whatsapp") },
    { key: "waButtonText", type: "text", label: "Buton Yazısı (ör. Bize Yaz, Önerini Paylaş)", showIf: isWaButton },
    { key: "fbFormUrl", type: "url", label: "Google Form Bağlantısı", showIf: isMethod("google-form") },
    { key: "fbFormMessageFieldId", type: "text", label: "Mesaj Alan Kimliği (entry.XXXXXXX)", showIf: isMethod("google-form") },
    { key: "fbFormNameFieldId", type: "text", label: "Ad Soyad Alan Kimliği (isteğe bağlı)", showIf: isMethod("google-form") },
    { key: "fbFormContactFieldId", type: "text", label: "İletişim Alan Kimliği (isteğe bağlı)", showIf: isMethod("google-form") },
    { key: "fbExternalUrl", type: "url", label: "Form Bağlantısı (Google Form vb.)", showIf: isMethod("external-link") },
    { key: "externalButtonText", type: "text", label: "Buton Yazısı (ör. Görüş Bildir, Önerini Paylaş)", showIf: isMethod("external-link") },

    { key: "title", type: "text", label: "Başlık" },
    { key: "description", type: "textarea", label: "Açıklama" },
    { key: "messageLabel", type: "text", label: "Mesaj Alanı Başlığı", showIf: isFormMethod },
    { key: "messagePlaceholder", type: "text", label: "Mesaj Alanı İpucu Yazısı", showIf: isFormMethod },
    { key: "collectName", type: "select", label: "Ad Soyad", options: COLLECT_OPTIONS, showIf: isFormMethod },
    { key: "collectContact", type: "select", label: "İletişim (telefon veya e-posta)", options: COLLECT_OPTIONS, showIf: isFormMethod },
    { key: "consentText", type: "textarea", label: "Onay Metni (KVKK — doluysa işaretlenmesi zorunlu kutu gösterilir)", showIf: isFormMethod },
    { key: "submitButtonText", type: "text", label: "Gönder Butonu Yazısı (ör. Görüş Bildir, Bize Yaz)", showIf: isFormMethod },
    { key: "successMessage", type: "text", label: "Teşekkür Mesajı", showIf: s => s.sendMethod === "google-form" || s.sendMethod === "none" || s.sendMethod === "seoz" },

    { key: "fontFamily", type: "font-select", label: "Font" },
    { key: "fontSize", type: "number", label: "Yazı Boyutu", unit: "px", min: 10 },
    { key: "textColor", type: "color", label: "Yazı Rengi" },
    { key: "buttonColor", type: "color", label: "Buton Rengi" },
    {
      key: "metallic", type: "select", label: "Buton Metalik Efekti",
      options: [{ value: "none", label: "Yok" }, { value: "gold", label: "Altın (Koyu Zemin)" }, { value: "silver", label: "Gümüş (Koyu Zemin)" }, { value: "copper-gold", label: "Bakır Altın (Açık Zemin)" }, { value: "dark-silver", label: "Koyu Gümüş (Açık Zemin)" }, { value: "copper", label: "Bakır" }]
    }
  ];

  function buttonBackground(s) {
    const g = global.SeozRenderer && global.SeozRenderer.METALLIC_GRADIENTS;
    return (g && g[s.metallic]) || s.buttonColor;
  }

  function rgba(hex, a) {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || "").trim());
    if (!m) return hex;
    let h = m[1];
    if (h.length === 3) h = h.split("").map(c => c + c).join("");
    const n = parseInt(h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  function digits(v) { return String(v || "").replace(/[^0-9]/g, ""); }

  function ensureStyles() {
    if (document.getElementById("seoz-feedback-styles")) return;
    const st = document.createElement("style");
    st.id = "seoz-feedback-styles";
    st.textContent =
      ".seoz-feedback button:focus-visible,.seoz-feedback textarea:focus-visible,.seoz-feedback input:focus-visible{outline:2px solid currentColor;outline-offset:2px;}" +
      ".seoz-feedback textarea::placeholder,.seoz-feedback input::placeholder{color:inherit;opacity:.45;}";
    document.head.appendChild(st);
  }

  // Google Form gönderimi — no-cors nedeniyle sunucu yanıtı okunamaz
  // (bkz. poll.js'teki aynı dürüstlük notu; kod paylaşılmaz, modüller
  // birbirinden bağımsızdır).
  function submitToGoogleForm(s, data) {
    let actionUrl = String(s.fbFormUrl || "").trim();
    if (!actionUrl || !s.fbFormMessageFieldId) return Promise.resolve({ sent: false });
    if (actionUrl.indexOf("/viewform") !== -1) actionUrl = actionUrl.replace("/viewform", "/formResponse");
    const body = new URLSearchParams();
    body.append(s.fbFormMessageFieldId, data.message);
    if (s.fbFormNameFieldId && data.name) body.append(s.fbFormNameFieldId, data.name);
    if (s.fbFormContactFieldId && data.contact) body.append(s.fbFormContactFieldId, data.contact);
    // Alan kimliği ayrı girilmemişse ad/iletişim mesajın sonuna eklenir —
    // böylece bilgi kaybolmaz.
    if (!s.fbFormNameFieldId && data.name) body.set(s.fbFormMessageFieldId, body.get(s.fbFormMessageFieldId) + `\n\nAd Soyad: ${data.name}`);
    if (!s.fbFormContactFieldId && data.contact) body.set(s.fbFormMessageFieldId, body.get(s.fbFormMessageFieldId) + `\nİletişim: ${data.contact}`);
    return fetch(actionUrl, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString()
    }).then(() => ({ sent: true })).catch(() => ({ sent: false }));
  }

  function openUrl(url) {
    const win = global.open(url, "_blank");
    if (!win) global.location.href = url;
  }

  // Davetiye içinde topla: Studio SEOZ Supabase'ine kayıt (bkz.
  // js/core/cloud-store.js → insertFeedback). Ziyaretçi yalnızca kayıt
  // EKLEYEBİLİR, okuyamaz (RLS — bkz. SUPABASE-YAYIN-REHBERI.md).
  function cloudAvailable() {
    return !!(global.SeozCloudStore && global.SeozCloudStore.isConfigured());
  }

  function submitToSeoz(data, ctx) {
    if (!cloudAvailable()) return Promise.resolve({ sent: false });
    let slug = "";
    try { slug = new URLSearchParams(global.location.search).get("slug") || ""; } catch (e) { /* yok */ }
    return global.SeozCloudStore.insertFeedback({
      invitation_slug: slug || null,
      doc_id: (ctx && ctx.docId) || null,
      layer_id: (ctx && ctx.layerId) || null,
      name: data.name || null,
      contact: data.contact || null,
      message: data.message
    }).then(() => ({ sent: true })).catch((err) => {
      console.error("[Studio SEOZ] Görüş kaydedilemedi:", err);
      return { sent: false };
    });
  }

  function render(settings, mode, ctx) {
    const s = Object.assign({}, DEFAULTS, settings);
    const fs = Math.max(12, Number(s.fontSize) || 16);
    const accent = s.buttonColor || DEFAULTS.buttonColor;
    const ink = s.textColor || DEFAULTS.textColor;
    const T = {
      radius: "12px",
      fieldBorder: rgba(ink, 0.28),
      fieldBg: "rgba(255,255,255,.55)",
      inputFont: Math.max(16, fs) + "px"
    };

    ensureStyles();

    const wrap = document.createElement("div");
    wrap.className = "seoz-feedback";
    Object.assign(wrap.style, {
      width: "100%",
      boxSizing: "border-box",
      padding: "20px 16px",
      display: "flex",
      flexDirection: "column",
      gap: "16px",
      fontFamily: `"${s.fontFamily}", sans-serif`,
      fontSize: fs + "px",
      lineHeight: "1.4",
      color: ink
    });

    if (mode === "edit" && s.sendMethod === "none") {
      const note = document.createElement("div");
      note.textContent = "Gönderim yöntemi seçilmedi — mesajlar hiçbir yere gönderilmez. (Bu not yalnızca editörde görünür.)";
      Object.assign(note.style, {
        fontSize: "12px", padding: "8px 10px", borderRadius: "8px",
        border: "1px dashed #b3452c", color: "#b3452c", textAlign: "center"
      });
      wrap.appendChild(note);
    }

    if (s.title || s.description) {
      const head = document.createElement("div");
      Object.assign(head.style, { display: "flex", flexDirection: "column", gap: "6px", textAlign: "center" });
      if (s.title) {
        const t = document.createElement("div");
        t.textContent = s.title;
        Object.assign(t.style, { fontFamily: "'Cormorant Garamond', serif", fontSize: (fs + 9) + "px", fontWeight: "600", lineHeight: "1.2" });
        head.appendChild(t);
      }
      if (s.description) {
        const d = document.createElement("div");
        d.textContent = s.description;
        Object.assign(d.style, { fontSize: (fs - 1) + "px", opacity: ".8" });
        head.appendChild(d);
      }
      wrap.appendChild(head);
    }

    function primaryButton(text) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = text;
      Object.assign(b.style, {
        alignSelf: "center",
        width: "100%",
        maxWidth: "280px",
        minHeight: "48px",
        padding: "12px 24px",
        borderRadius: T.radius,
        border: "none",
        background: buttonBackground(s),
        color: "#fff",
        fontFamily: "inherit",
        fontSize: fs + "px",
        fontWeight: "600",
        cursor: "pointer"
      });
      return b;
    }

    // WHATSAPP — yalnızca buton: doğrudan sohbet açılır.
    if (isWaButton(s)) {
      const b = primaryButton(s.waButtonText || DEFAULTS.waButtonText);
      if (!digits(s.fbWhatsappNumber)) { b.style.opacity = ".5"; b.style.cursor = "not-allowed"; }
      b.addEventListener("click", () => {
        if (digits(s.fbWhatsappNumber)) openUrl(`https://wa.me/${digits(s.fbWhatsappNumber)}`);
      });
      wrap.appendChild(b);
      return wrap;
    }

    // HARİCİ BAĞLANTI — yalnızca bir buton; form müşterinin kendi sayfasında.
    if (s.sendMethod === "external-link") {
      const b = primaryButton(s.externalButtonText || DEFAULTS.externalButtonText);
      b.addEventListener("click", () => {
        if (s.fbExternalUrl) openUrl(s.fbExternalUrl);
      });
      wrap.appendChild(b);
      return wrap;
    }

    function fieldBlock(labelText, control) {
      const f = document.createElement("div");
      Object.assign(f.style, { display: "flex", flexDirection: "column", gap: "6px" });
      const l = document.createElement("label");
      l.textContent = labelText;
      Object.assign(l.style, { fontSize: (fs - 1) + "px", fontWeight: "600" });
      f.appendChild(l);
      f.appendChild(control);
      return f;
    }

    function styleField(el) {
      Object.assign(el.style, {
        width: "100%",
        boxSizing: "border-box",
        padding: "10px 12px",
        borderRadius: T.radius,
        border: `1px solid ${T.fieldBorder}`,
        background: T.fieldBg,
        color: ink,
        fontFamily: "inherit",
        fontSize: T.inputFont,
        lineHeight: "1.4"
      });
    }

    const msg = document.createElement("textarea");
    msg.rows = 4;
    msg.maxLength = 1000;
    msg.placeholder = s.messagePlaceholder || "";
    styleField(msg);
    msg.style.resize = "vertical";
    msg.style.minHeight = "110px";
    wrap.appendChild(fieldBlock(s.messageLabel || "Mesajınız", msg));

    let nameInput = null;
    if (s.collectName !== "off") {
      nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.autocomplete = "name";
      styleField(nameInput);
      wrap.appendChild(fieldBlock("Ad Soyad" + (s.collectName === "optional" ? " (isteğe bağlı)" : ""), nameInput));
    }

    let contactInput = null;
    if (s.collectContact !== "off") {
      contactInput = document.createElement("input");
      contactInput.type = "text";
      contactInput.autocomplete = "email";
      contactInput.placeholder = "Telefon veya e-posta";
      styleField(contactInput);
      wrap.appendChild(fieldBlock("İletişim" + (s.collectContact === "optional" ? " (isteğe bağlı)" : ""), contactInput));
    }

    let consentBox = null;
    if (String(s.consentText || "").trim()) {
      const row = document.createElement("label");
      Object.assign(row.style, { display: "flex", gap: "10px", alignItems: "flex-start", fontSize: (fs - 2) + "px", cursor: "pointer" });
      consentBox = document.createElement("input");
      consentBox.type = "checkbox";
      Object.assign(consentBox.style, { width: "20px", height: "20px", margin: "1px 0 0", flex: "none", accentColor: accent });
      const txt = document.createElement("span");
      txt.textContent = s.consentText;
      row.appendChild(consentBox);
      row.appendChild(txt);
      wrap.appendChild(row);
    }

    // Bal küpü: gerçek kullanıcıya görünmez; basit botlar doldurur.
    const trap = document.createElement("input");
    trap.type = "text";
    trap.tabIndex = -1;
    trap.autocomplete = "off";
    trap.setAttribute("aria-hidden", "true");
    Object.assign(trap.style, { position: "absolute", left: "-9999px", width: "1px", height: "1px", opacity: "0" });
    wrap.appendChild(trap);

    const footer = document.createElement("div");
    Object.assign(footer.style, { display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" });
    const submitBtn = primaryButton(s.submitButtonText || "Gönder");
    const statusEl = document.createElement("div");
    statusEl.setAttribute("aria-live", "polite");
    Object.assign(statusEl.style, { fontSize: (fs - 2) + "px", textAlign: "center", minHeight: "1.3em" });
    footer.appendChild(submitBtn);
    footer.appendChild(statusEl);
    wrap.appendChild(footer);

    function showStatus(text, isError) {
      statusEl.textContent = text;
      statusEl.style.color = isError ? "#b3452c" : ink;
    }

    function lock() {
      [msg, nameInput, contactInput, consentBox, submitBtn].forEach(el => { if (el) el.disabled = true; });
      submitBtn.style.opacity = ".6";
      submitBtn.style.cursor = "default";
    }

    let submitted = false;
    submitBtn.addEventListener("click", () => {
      if (submitted) return;
      const data = {
        message: msg.value.trim(),
        name: nameInput ? nameInput.value.trim() : "",
        contact: contactInput ? contactInput.value.trim() : ""
      };
      if (!data.message) return showStatus("Lütfen mesajınızı yazın.", true);
      if (s.collectName === "required" && !data.name) return showStatus("Lütfen adınızı girin.", true);
      if (s.collectContact === "required" && !data.contact) return showStatus("Lütfen iletişim bilginizi girin.", true);
      if (consentBox && !consentBox.checked) return showStatus("Devam etmek için onay kutusunu işaretleyin.", true);

      if (trap.value) { submitted = true; lock(); showStatus(s.successMessage, false); return; }

      if (s.sendMethod === "whatsapp") {
        if (!digits(s.fbWhatsappNumber)) return showStatus("WhatsApp numarası tanımlanmamış.", true);
        const lines = [];
        if (s.title) lines.push(`*${s.title}*`, "");
        lines.push(data.message);
        if (data.name) lines.push("", `Ad Soyad: ${data.name}`);
        if (data.contact) lines.push(`İletişim: ${data.contact}`);
        openUrl(`https://wa.me/${digits(s.fbWhatsappNumber)}?text=${encodeURIComponent(lines.join("\n"))}`);
        // Form kilitlenmez: WhatsApp'ta göndermeden kapatılırsa tekrar denenebilir.
        return showStatus("WhatsApp açıldı. Mesajınızı iletmek için WhatsApp'ta Gönder'e dokunun.", false);
      }

      submitted = true;
      submitBtn.disabled = true;
      submitBtn.style.opacity = ".6";
      showStatus("Gönderiliyor...", false);

      let job;
      if (s.sendMethod === "google-form") job = submitToGoogleForm(s, data);
      // Editörde deneme gönderimi veritabanına YAZILMAZ (gerçek görüşlerle
      // karışmasın); yalnızca yayınlanan davetiyede kaydedilir.
      else if (s.sendMethod === "seoz") job = mode === "edit" ? Promise.resolve({ sent: true }) : submitToSeoz(data, ctx);
      else job = Promise.resolve({ sent: false });
      job.then((r) => {
        if ((s.sendMethod === "google-form" || s.sendMethod === "seoz") && !r.sent) {
          submitted = false;
          submitBtn.disabled = false;
          submitBtn.style.opacity = "1";
          return showStatus("Gönderilemedi. Bağlantınızı kontrol edip tekrar deneyin.", true);
        }
        lock();
        showStatus(s.successMessage || DEFAULTS.successMessage, false);
      });
    });

    return wrap;
  }

  function validate(s) {
    switch (s.sendMethod) {
      case "whatsapp":
        return digits(s.fbWhatsappNumber) ? null : "Görüş Bildir: WhatsApp numarası girilmemiş.";
      case "google-form":
        return (s.fbFormUrl && s.fbFormMessageFieldId) ? null : "Görüş Bildir: Google Form bağlantısı veya mesaj alan kimliği eksik.";
      case "external-link":
        return s.fbExternalUrl ? null : "Görüş Bildir: form sayfası bağlantısı girilmemiş.";
      case "seoz":
        return cloudAvailable() ? null : "Görüş Bildir: Supabase bağlantısı ayarlı değil (js/supabase-config.js) — görüşler kaydedilemez.";
      default:
        return "Görüş Bildir: gönderim yöntemi seçilmemiş — mesajlar hiçbir yere gönderilmeyecek.";
    }
  }

  global.SeozModuleRegistry.registerModule({
    id: "feedback",
    label: "Görüş Bildir",
    defaultSettings: DEFAULTS,
    defaultLayerSize: { w: 340, h: 320 },
    autoHeight: true,
    settingsSchema: SETTINGS_SCHEMA,
    render: render,
    validate: validate
  });
})(window);
