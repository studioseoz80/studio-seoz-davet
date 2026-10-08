/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — modules/poll.js  (YENİ MODÜL — ANKET SİSTEMİ)
   -----------------------------------------------------------------------------
   Genel ve esnek bir anket modülü — yalnızca Evet/Hayır değil, sınırsız
   sayıda soru, her soruda serbest metinli ve sayıda cevap seçeneği.
   Belediye, dernek, kurum, işletme, toplantı gibi FARKLI organizasyonlar
   tarafından kullanılabilecek şekilde tasarlandı (bkz. varsayılan örnek
   soru — "Evet/Hayır" ile sınırlı değil).

   Diğer tüm modüller (module-registry.js, renderer.js, editor-app.js)
   GİBİ, kendi kendini registerModule() ile tanıtır — mevcut hiçbir
   dosyaya dokunulmadı, yalnızca YENİ dosyalar eklendi (bkz. teslim
   raporu). Tek istisna: editor-app.js'teki renderPropPanel() içine,
   yalnızca "poll" modülünü özel panele (poll-panel.js) yönlendiren
   TEK BİR koşul eklendi (diğer tüm modüller AYNI genel module-panel.js'i
   kullanmaya devam ediyor).

   GOOGLE FORM BAĞLANTISI İZOLASYONU (KRİTİK — daha önceki bir hatadan
   ders alınarak): Anket, kendi ayrı alanlarını kullanır — pollFormUrl,
   pollFormFieldId, pollFormNameFieldId. Bunlar RSVP'nin googleFormUrl'i,
   Konum'un mapsUrl'i, Anı Yükle'nin uploadUrl'i, Müzik'in audioSrc'i
   veya Galeri'nin resimleriyle HİÇBİR ŞEKİLDE karışmaz — ayrı bir
   modülün kendi ayarlar nesnesinde yaşarlar, başka hiçbir modül bu
   alanları okumaz/yazmaz.

   GÖRÜNÜM + YANIT YÖNTEMİ GÜNCELLEMESİ:
   - Şıklar artık eşit sütunlu bir grid'de (bkz. optionGridColumns):
     kısa şıklar yan yana eşit, uzun şıklar tam genişlikte, metin 2
     satıra geçebilir. Sorular ayrı bloklarda, belirgin boşluk ve ince
     ayırıcıyla; tüm parçalar ortak köşe/kenarlık/boşluk değerlerinden.
   - autoHeight: true → kutu içeriğe göre uzar, alt katmanlara taşmaz.
   - responseMethod: "google-form" | "whatsapp" | "none". Eski kayıtlar
     birebir eski davranışta kalır (getResponseMethod).
   - Görüş alanlarına yazılanlar artık gönderime dahil.
   ========================================================================= */

(function (global) {
  "use strict";

  function uid(prefix) {
    return prefix + "_" + Math.random().toString(36).slice(2, 9);
  }

  // Varsayılan örnek: BİLİNÇLİ olarak Evet/Hayır DIŞINDA bir örnek —
  // anketin yalnızca Evet/Hayır'a sabit olmadığını en baştan gösterir.
  const DEFAULTS = {
    title: "Görüşünüzü Bizimle Paylaşın",
    description: "",
    questions: [
      {
        id: "q_default",
        text: "Bu etkinlik hakkında ne düşünüyorsunuz?",
        options: [
          { id: "o1", text: "Çok Memnunum" },
          { id: "o2", text: "Memnunum" }
        ]
      }
    ],
    // "off" | "optional" | "required" — VARSAYILAN "off" (anonim).
    collectName: "off",
    submitButtonText: "Gönder",
    // GÖRÜŞ ALANLARI (ek özellik): serbest metinli, ZORUNLU OLMAYAN yazı
    // kutuları. Şıklı sorulardan (questions) TAMAMEN AYRI bir dizide
    // tutulur — böylece mevcut soru doğrulaması, validate ve Google Form
    // özeti hiç değişmez. Eski kayıtlarda bu alan yoktur → boş dizi
    // sayılır, hiçbir şey çizilmez. Her öğe: { id, title, placeholder }.
    commentFields: [],
    // Google Form/Sheets bağlantısı — TAMAMEN AYRI, başka hiçbir modülle
    // paylaşılmayan alanlar (bkz. yukarıdaki not).
    pollFormUrl: "",
    pollFormFieldId: "",
    pollFormNameFieldId: "",
    // WhatsApp yanıt yöntemi — YALNIZCA ankete ait numara. RSVP'nin
    // whatsappNumber alanıyla HİÇBİR ŞEKİLDE paylaşılmaz.
    pollWhatsappNumber: "",
    textColor: "#1E2A22",
    buttonColor: "#93703F",
    fontFamily: "Manrope",
    fontSize: 16,
    metallic: "none"
  };

  const SETTINGS_SCHEMA = []; // Bu modülün TÜM ayarları özel panelden (poll-panel.js) yönetilir.

  /* ---------------------------------------------------------------------------
     YANIT YÖNTEMİ
     "google-form" | "whatsapp" | "none"   ("seoz" = Supabase, sonraki aşama)
     Eski kayıtlarda responseMethod alanı YOKTUR. Bu durumda davranış
     birebir eskisi gibidir: pollFormUrl doluysa "google-form", boşsa "none".
     ------------------------------------------------------------------------ */
  function getResponseMethod(s) {
    if (s.responseMethod === "google-form" || s.responseMethod === "whatsapp" || s.responseMethod === "none") {
      return s.responseMethod;
    }
    return s.pollFormUrl ? "google-form" : "none";
  }

  function buttonBackground(s) {
    const g = global.SeozRenderer && global.SeozRenderer.METALLIC_GRADIENTS;
    return (g && g[s.metallic]) || s.buttonColor;
  }

  // "#93703F" → "rgba(147,112,63,a)". Geçersiz değerde rengi olduğu gibi
  // döndürür (tema renkleri hiçbir durumda bozulmaz).
  function rgba(hex, a) {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || "").trim());
    if (!m) return hex;
    let h = m[1];
    if (h.length === 3) h = h.split("").map(c => c + c).join("");
    const n = parseInt(h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  // Satır içi stil :focus-visible tanımlayamadığı için, YALNIZCA anket
  // sınıflarını hedefleyen küçük bir stil bloğu bir kez eklenir. Başka
  // hiçbir modülü veya editör arayüzünü etkilemez.
  function ensureStyles() {
    if (document.getElementById("seoz-poll-styles")) return;
    const st = document.createElement("style");
    st.id = "seoz-poll-styles";
    st.textContent =
      ".seoz-poll button:focus-visible,.seoz-poll textarea:focus-visible,.seoz-poll input:focus-visible{outline:2px solid currentColor;outline-offset:2px;}" +
      ".seoz-poll textarea::placeholder,.seoz-poll input::placeholder{color:inherit;opacity:.45;}" +
      "@media (hover:hover){.seoz-poll-opt:not([aria-pressed=true]):not(:disabled):hover{background:var(--seoz-poll-hover) !important;}}";
    document.head.appendChild(st);
  }

  /* ŞIK IZGARASI — farklı genişlik sorununun çözümü.
     Eskiden şıklar flex-wrap içinde kendi metinleri kadar genişliyordu.
     Artık her soru için EŞİT sütunlu bir grid kurulur. Sütunun en küçük
     genişliği o sorudaki EN UZUN şıkka göre hesaplanır ve auto-fit,
     kutunun genişliğine göre kaç sütun sığacağına kendisi karar verir:
       - Evet / Hayır → iki eşit buton yan yana
       - orta uzunluktaki şıklar → 2 eşit sütun (dar kutuda 1)
       - uzun şıklar → tam genişlikte tek sütun, metin 2 satıra geçebilir
     Tuval ölçeklendiği için ekran genişliğine bakan media query burada
     işe yaramaz; düzen KUTUNUN kendi genişliğine göre uyum sağlar. */
  function optionGridColumns(options, fontSize) {
    const maxLen = options.reduce((m, o) => Math.max(m, String(o.text || "").trim().length), 0);
    if (maxLen > 28) return "minmax(0, 1fr)";
    // Uzun şıkların iki satıra bölünebileceğini hesaba katıyoruz.
    const effLen = maxLen > 16 ? Math.ceil(maxLen * 0.6) : maxLen;
    const minPx = Math.max(84, Math.round(effLen * fontSize * 0.58 + 36));
    return `repeat(auto-fit, minmax(min(${minPx}px, 100%), 1fr))`;
  }

  function buildSummary(questions, answers, commentValues) {
    const parts = questions.map(q => {
      const chosen = (q.options || []).find(o => o.id === answers[q.id]);
      return `${q.text}: ${chosen ? chosen.text : ""}`;
    });
    commentValues.forEach(c => { if (c.value) parts.push(`${c.title}: ${c.value}`); });
    return parts.join(" | ");
  }

  // Google Form'a gönderim. ÖNEMLİ DÜRÜSTLÜK NOTU: Google Form'un genel
  // gönderim uç noktası (formResponse) siteler arası POST'lara YALNIZCA
  // "no-cors" modunda izin verir. Bu yüzden yanıt OKUNAMAZ — sunucunun
  // isteği kabul edip etmediği teyit edilemez. "Başarılı" mesajı, istek
  // AĞ HATASI VERMEDEN gönderilebildiğinde gösterilir.
  // DEĞİŞİKLİK: Görüş alanlarına yazılanlar artık özetin SONUNA eklenir
  // (önceden hiçbir yere gönderilmiyordu). Görüş yazılmamışsa özet
  // birebir eski biçimindedir.
  function submitToGoogleForm(s, answersSummary, participantName) {
    if (!s.pollFormUrl) return Promise.resolve({ sent: false, reason: "no-url" });
    let actionUrl = s.pollFormUrl.trim();
    if (actionUrl.indexOf("/viewform") !== -1) actionUrl = actionUrl.replace("/viewform", "/formResponse");

    const body = new URLSearchParams();
    if (s.pollFormFieldId) body.append(s.pollFormFieldId, answersSummary);
    if (s.pollFormNameFieldId && participantName) body.append(s.pollFormNameFieldId, participantName);

    if (!s.pollFormFieldId) return Promise.resolve({ sent: false, reason: "no-field-id" });

    return fetch(actionUrl, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString()
    }).then(() => ({ sent: true })).catch(() => ({ sent: false, reason: "network-error" }));
  }

  // WhatsApp: yanıtlar okunaklı bir mesaj olarak, müşterinin belirlediği
  // numaraya hazır yazılı açılır. Mesajı katılımcı WhatsApp'ta kendisi
  // gönderir — otomatik gönderim yoktur, veri Studio SEOZ'a hiç gelmez.
  function buildWhatsAppMessage(s, questions, answers, commentValues, participantName) {
    const lines = [];
    if (s.title) lines.push(`*${s.title}*`, "");
    questions.forEach((q, i) => {
      const chosen = (q.options || []).find(o => o.id === answers[q.id]);
      lines.push(`${questions.length > 1 ? (i + 1) + ". " : ""}${q.text}`, `→ ${chosen ? chosen.text : ""}`);
    });
    commentValues.forEach(c => { if (c.value) lines.push("", `${c.title}:`, c.value); });
    if (participantName) lines.push("", `Ad Soyad: ${participantName}`);
    return lines.join("\n");
  }

  function openWhatsApp(number, message) {
    const clean = String(number || "").replace(/[^0-9]/g, "");
    const url = `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
    const win = global.open(url, "_blank");
    if (!win) global.location.href = url; // açılır pencere engellenirse
  }

  function render(settings, mode, ctx) {
    const s = Object.assign({}, DEFAULTS, settings);
    const questions = (s.questions && s.questions.length ? s.questions : DEFAULTS.questions);
    const method = getResponseMethod(s);
    const fs = Math.max(12, Number(s.fontSize) || 16);
    const accent = s.buttonColor || DEFAULTS.buttonColor;
    const ink = s.textColor || DEFAULTS.textColor;

    // Ortak tasarım değerleri — başlık, sorular, şıklar, görüş alanı ve
    // gönder butonu aynı köşe, kenarlık ve boşluk sisteminden beslenir.
    const T = {
      radius: "12px",
      rule: rgba(ink, 0.14),
      fieldBorder: rgba(ink, 0.28),
      fieldBg: "rgba(255,255,255,.55)",
      optBorder: rgba(accent, 0.55),
      hover: rgba(accent, 0.08),
      blockGap: "22px",
      innerGap: "10px",
      optFont: Math.max(14, fs - 1) + "px",
      inputFont: Math.max(16, fs) + "px" // 16px altı iOS'ta yakınlaştırma yapar
    };

    ensureStyles();

    const wrap = document.createElement("div");
    wrap.className = "seoz-poll";
    wrap.style.setProperty("--seoz-poll-hover", T.hover);
    Object.assign(wrap.style, {
      width: "100%",
      boxSizing: "border-box",
      padding: "20px 16px",
      display: "flex",
      flexDirection: "column",
      gap: T.blockGap,
      fontFamily: `"${s.fontFamily}", sans-serif`,
      fontSize: fs + "px",
      lineHeight: "1.4",
      color: ink
    });

    // Editörde, yanıtların hiçbir yere gitmeyeceğini dürüstçe belirt.
    if (mode === "edit" && method === "none") {
      const note = document.createElement("div");
      note.textContent = "Yanıt yöntemi seçilmedi — yanıtlar hiçbir yere gönderilmez. (Bu not yalnızca editörde görünür.)";
      Object.assign(note.style, {
        fontSize: "12px", padding: "8px 10px", borderRadius: "8px",
        border: "1px dashed #b3452c", color: "#b3452c", textAlign: "center"
      });
      wrap.appendChild(note);
    }

    // BAŞLIK BLOĞU
    if (s.title || s.description) {
      const head = document.createElement("div");
      Object.assign(head.style, { display: "flex", flexDirection: "column", gap: "6px", textAlign: "center" });
      if (s.title) {
        const titleEl = document.createElement("div");
        titleEl.textContent = s.title;
        Object.assign(titleEl.style, {
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: (fs + 9) + "px",
          fontWeight: "600",
          lineHeight: "1.2"
        });
        head.appendChild(titleEl);
      }
      if (s.description) {
        const descEl = document.createElement("div");
        descEl.textContent = s.description;
        Object.assign(descEl.style, { fontSize: (fs - 1) + "px", opacity: ".8" });
        head.appendChild(descEl);
      }
      wrap.appendChild(head);
    }

    // SORULAR — her soru kendi bloğunda; bloklar arasında belirgin boşluk
    // ve ince bir ayırıcı çizgi. Soru → şıkları → boşluk → sonraki soru.
    const answers = {};
    const numbered = questions.length > 1;

    function sectionBlock(withRule) {
      const b = document.createElement("div");
      Object.assign(b.style, { display: "flex", flexDirection: "column", gap: T.innerGap });
      if (withRule) {
        b.style.borderTop = `1px solid ${T.rule}`;
        b.style.paddingTop = T.blockGap;
      }
      return b;
    }

    questions.forEach((q, qi) => {
      const qWrap = sectionBlock(qi > 0 || !!(s.title || s.description));

      const qText = document.createElement("div");
      Object.assign(qText.style, { fontSize: fs + "px", fontWeight: "600", lineHeight: "1.35", display: "flex", gap: "6px" });
      if (numbered) {
        const num = document.createElement("span");
        num.textContent = (qi + 1) + ".";
        num.style.color = accent;
        num.style.flex = "none";
        qText.appendChild(num);
      }
      const qLabel = document.createElement("span");
      qLabel.textContent = q.text || "";
      qText.appendChild(qLabel);
      qWrap.appendChild(qText);

      const opts = q.options || [];
      const grid = document.createElement("div");
      grid.setAttribute("role", "group");
      Object.assign(grid.style, {
        display: "grid",
        gridTemplateColumns: optionGridColumns(opts, Math.max(14, fs - 1)),
        gap: "8px"
      });

      const optionButtons = [];
      opts.forEach(opt => {
        const optBtn = document.createElement("button");
        optBtn.type = "button";
        optBtn.className = "seoz-poll-opt";
        optBtn.textContent = opt.text || "";
        optBtn.setAttribute("aria-pressed", "false");
        Object.assign(optBtn.style, {
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          minHeight: "46px",
          padding: "10px 12px",
          boxSizing: "border-box",
          borderRadius: T.radius,
          border: `1.5px solid ${T.optBorder}`,
          background: "transparent",
          color: accent,
          fontFamily: "inherit",
          fontSize: T.optFont,
          fontWeight: "500",
          lineHeight: "1.25",
          textAlign: "center",
          whiteSpace: "normal",
          overflowWrap: "anywhere",
          cursor: "pointer",
          transition: "background .15s ease, color .15s ease, border-color .15s ease"
        });
        optBtn.addEventListener("click", () => {
          answers[q.id] = opt.id;
          optionButtons.forEach(b => {
            const on = b === optBtn;
            b.setAttribute("aria-pressed", on ? "true" : "false");
            b.style.background = on ? buttonBackground(s) : "transparent";
            b.style.color = on ? "#fff" : accent;
            b.style.borderColor = on ? "transparent" : T.optBorder;
          });
        });
        optionButtons.push(optBtn);
        grid.appendChild(optBtn);
      });

      qWrap.appendChild(grid);
      wrap.appendChild(qWrap);
    });

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

    // GÖRÜŞ ALANLARI — sorulardan sonra, ad alanından önce. Zorunlu
    // değildir; gönderim kontrolüne katılmaz.
    const commentInputs = [];
    (Array.isArray(s.commentFields) ? s.commentFields : []).forEach(cf => {
      const cWrap = sectionBlock(true);
      const cTitle = document.createElement("label");
      cTitle.textContent = cf.title || "Görüş, Fikir ve Önerileriniz";
      Object.assign(cTitle.style, { fontSize: fs + "px", fontWeight: "600" });
      cWrap.appendChild(cTitle);

      const ta = document.createElement("textarea");
      ta.rows = 3;
      ta.maxLength = 1000;
      ta.setAttribute("data-poll-comment-id", cf.id || "");
      ta.placeholder = cf.placeholder || "Eklemek istediğiniz görüş, fikir veya önerinizi buraya yazabilirsiniz.";
      styleField(ta);
      ta.style.resize = "vertical";
      ta.style.minHeight = "88px";
      cWrap.appendChild(ta);
      commentInputs.push({ title: cTitle.textContent, el: ta });
      wrap.appendChild(cWrap);
    });

    // Katılımcı bilgisi — YALNIZCA collectName "off" değilse gösterilir.
    let nameInput = null;
    if (s.collectName && s.collectName !== "off") {
      const nameWrap = sectionBlock(commentInputs.length === 0);
      nameWrap.style.gap = "6px";
      const nameLabel = document.createElement("label");
      nameLabel.textContent = "Ad Soyad" + (s.collectName === "optional" ? " (isteğe bağlı)" : "");
      Object.assign(nameLabel.style, { fontSize: (fs - 1) + "px", fontWeight: "600" });
      nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.autocomplete = "name";
      styleField(nameInput);
      nameWrap.appendChild(nameLabel);
      nameWrap.appendChild(nameInput);
      wrap.appendChild(nameWrap);
    }

    // GÖNDER + DURUM
    const footer = document.createElement("div");
    Object.assign(footer.style, { display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" });

    const submitBtn = document.createElement("button");
    submitBtn.type = "button";
    submitBtn.textContent = s.submitButtonText || "Gönder";
    Object.assign(submitBtn.style, {
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

    const statusEl = document.createElement("div");
    statusEl.setAttribute("aria-live", "polite");
    Object.assign(statusEl.style, { fontSize: (fs - 2) + "px", textAlign: "center", minHeight: "1.3em" });

    function showStatus(text, isError) {
      statusEl.textContent = text;
      statusEl.style.color = isError ? "#b3452c" : ink;
    }

    function lockForm() {
      wrap.querySelectorAll("button").forEach(b => { b.disabled = true; b.style.cursor = "default"; });
      submitBtn.style.opacity = ".6";
      if (nameInput) nameInput.disabled = true;
      commentInputs.forEach(c => { c.el.disabled = true; });
    }

    let submitted = false;
    submitBtn.addEventListener("click", () => {
      if (submitted) return;

      if (s.collectName === "required" && nameInput && !nameInput.value.trim()) {
        showStatus("Lütfen adınızı girin.", true);
        return;
      }
      const unanswered = questions.filter(q => !answers[q.id]);
      if (unanswered.length > 0) {
        showStatus("Lütfen tüm soruları yanıtlayın.", true);
        return;
      }

      const participantName = nameInput ? nameInput.value.trim() : "";
      const commentValues = commentInputs.map(c => ({ title: c.title, value: c.el.value.trim() }));

      // WHATSAPP — form kilitlenmez: katılımcı WhatsApp'ı kapatıp
      // göndermezse tekrar deneyebilsin.
      if (method === "whatsapp") {
        if (!String(s.pollWhatsappNumber || "").replace(/[^0-9]/g, "")) {
          showStatus("Bu anket için WhatsApp numarası tanımlanmamış.", true);
          return;
        }
        openWhatsApp(s.pollWhatsappNumber, buildWhatsAppMessage(s, questions, answers, commentValues, participantName));
        showStatus("WhatsApp açıldı. Yanıtınızı iletmek için WhatsApp'ta Gönder'e dokunun.", false);
        return;
      }

      submitted = true;
      submitBtn.disabled = true;
      submitBtn.style.opacity = ".6";
      showStatus("Gönderiliyor...", false);

      const summary = buildSummary(questions, answers, commentValues);
      const job = method === "google-form"
        ? submitToGoogleForm(s, summary, participantName)
        : Promise.resolve({ sent: false, reason: "no-method" }); // eski davranış korunur

      job.then(() => {
        lockForm();
        showStatus("Yanıtınız alınmıştır. Teşekkür ederiz.", false);
      });
    });

    footer.appendChild(submitBtn);
    footer.appendChild(statusEl);
    wrap.appendChild(footer);

    return wrap;
  }

  function validate(s) {
    const msgs = [];
    if (!s.questions || !s.questions.length) msgs.push("Anket: en az bir soru eklenmemiş.");
    const method = getResponseMethod(s);
    if (method === "none") msgs.push("Anket: yanıt yöntemi seçilmemiş — yanıtlar hiçbir yere gönderilmeyecek.");
    if (method === "google-form" && (!s.pollFormUrl || !s.pollFormFieldId)) msgs.push("Anket: Google Form bağlantısı veya cevap alan kimliği eksik.");
    if (method === "whatsapp" && !String(s.pollWhatsappNumber || "").replace(/[^0-9]/g, "")) msgs.push("Anket: WhatsApp numarası girilmemiş.");
    return msgs.length ? msgs.join(" ") : null;
  }

  global.SeozModuleRegistry.registerModule({
    id: "poll",
    label: "Anket",
    defaultSettings: DEFAULTS,
    defaultLayerSize: { w: 340, h: 260 },
    // Yükseklik içeriğe göre otomatik — soru eklendikçe kutu büyür,
    // içerik alttaki katmanlara taşmaz, sayfa da buna göre uzar.
    autoHeight: true,
    settingsSchema: SETTINGS_SCHEMA,
    render: render,
    validate: validate,
    getResponseMethod: getResponseMethod
  });
})(window);
