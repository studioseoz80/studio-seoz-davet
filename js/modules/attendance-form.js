/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — modules/attendance-form.js  (KATILIM FORMU — FAZ A)
   -----------------------------------------------------------------------------
   Davetiye içinde çalışan kendi katılım/kayıt formumuz. Google Forms YOK.
   Misafir sayfadan ayrılmadan formu doldurur; yanıt Supabase'e kaydedilir
   (bkz. core/event-store.js, supabase/katilim-faz-a.sql).

   ETKİNLİK TÜRÜNDEN BAĞIMSIZDIR: kodda hiçbir etkinliğe özel kavram yoktur.
   Tüm başlıklar, sorular, seçenekler ve buton yazıları editörden gelir.

   Soru türleri (type):
     short    Kısa cevap          long     Uzun cevap
     yesno    Evet / Hayır        radio    Tek seçim (yuvarlak işaretler)
     choice   Çoktan seçmeli (tek cevap, büyük seçenek kartları)
     checkbox Çoklu seçim         number   Sayı
     select   Açılır liste
   Soru görevleri (role) — herhangi bir soruya editörden atanır:
     attendance  (Evet/Hayır) → "Katılıyor / Katılmıyor" bu sorudan hesaplanır
     count       (Sayı)       → "kaç kişi" bu sorudan hesaplanır
   Her soru: zorunlu/isteğe bağlı, aktif/pasif, "yalnızca katılacaksa göster".

   Misafir yanıtını sonradan GÜNCELLEYEBİLİR: ilk gönderimde kendi tarayıcısına
   gizli bir düzenleme anahtarı kaydedilir; tekrar açtığında form kendi
   yanıtıyla dolu gelir ve "Yanıtımı Güncelle" yeni kayıt AÇMAZ.

   Mevcut RSVP modülünden (rsvp.js) TAMAMEN bağımsızdır; ona dokunulmadı.

   GÖRÜNÜM (buton + açılır pencere): Davetiyede form doğrudan görünmez;
   yerine "Katılım Bildir" butonu çıkar. Misafir butona dokununca form
   ekranın üstünde açılır (telefonda alttan kayan sayfa, bilgisayarda
   ortada pencere); gönderip kapatabilir. Form içeriği, kayıt ve güncelleme
   davranışı aynıdır. Editörde önizleme için butona çift tıklanır.

   EK KATILIMCI İSİMLERİ: Kişi sayısı 2 veya daha fazla olunca diğer
   kişilerin Ad Soyad alanları kendiliğinden açılır ve ZORUNLU DEĞİLDİR.
   Yazılan isimler panelde ve yerleşim planında kullanılır; boş bırakılanlar
   "İsimsiz katılımcı" olarak kalır.
   ========================================================================= */

(function (global) {
  "use strict";

  function uid(prefix) { return prefix + "_" + Math.random().toString(36).slice(2, 9); }

  const QUESTION_TYPES = [
    { value: "short", label: "Kısa cevap" },
    { value: "long", label: "Uzun cevap" },
    { value: "yesno", label: "Evet / Hayır" },
    { value: "radio", label: "Tek seçim" },
    { value: "choice", label: "Çoktan seçmeli (kartlar)" },
    { value: "checkbox", label: "Çoklu seçim" },
    { value: "number", label: "Sayı" },
    { value: "select", label: "Açılır liste" }
  ];
  const OPTION_TYPES = ["radio", "choice", "checkbox", "select"];

  function defaultQuestions() {
    return [
      { id: uid("q"), type: "yesno", label: "Katılacak mısınız?", help: "", required: true, active: true,
        role: "attendance", yesLabel: "Katılacağım", noLabel: "Katılamayacağım", onlyIfAttending: false, options: [] },
      { id: uid("q"), type: "number", label: "Kaç kişi katılacaksınız?", help: "Kendiniz dahil", required: true, active: true,
        role: "count", min: 1, max: "", onlyIfAttending: true, options: [] },
      { id: uid("q"), type: "long", label: "Eklemek istediğiniz bir not var mı?", help: "", required: false, active: true,
        role: "", onlyIfAttending: false, options: [] }
    ];
  }

  const DEFAULTS = {
    launcherText: "Katılım Bildir",
    formTitle: "Katılım Formu",
    formDescription: "",
    nameLabel: "Adınız Soyadınız",
    questions: null,                 // ilk eklemede defaultQuestions() ile doldurulur
    askCompanionNames: true,         // her zaman açık (bkz. buildServerForm)
    companionNamesRequired: false,   // her zaman isteğe bağlı
    companionLabel: "{n}. kişinin adı soyadı",
    maxPartySize: 10,
    consentText: "",
    submitButtonText: "Gönder",
    updateButtonText: "Yanıtımı Güncelle",
    successMessage: "Yanıtınız alındı. Teşekkür ederiz.",
    updatedMessage: "Yanıtınız güncellendi. Teşekkür ederiz.",
    editAgainText: "Yanıtımı değiştir",
    closedMessage: "Bu form yanıtlara kapatılmıştır.",
    titleFont: "Cormorant Garamond",
    fontFamily: "Manrope",
    fontSize: 15,
    textColor: "#1E2A22",
    cardColor: "#FFFFFF",
    buttonColor: "#93703F",
    buttonTextColor: "#FFFFFF",
    metallic: "none"
  };

  const METALLIC_OPTIONS = [
    { value: "none", label: "Yok" }, { value: "gold", label: "Altın (Koyu Zemin)" },
    { value: "silver", label: "Gümüş (Koyu Zemin)" }, { value: "copper-gold", label: "Bakır Altın (Açık Zemin)" },
    { value: "dark-silver", label: "Koyu Gümüş (Açık Zemin)" }, { value: "copper", label: "Bakır" }
  ];

  /* Genel panelde (module-panel.js) gösterilecek alanlar. Sorular ve
     katılımcı ayarları editördeki özel soru oluşturucuda yönetilir. */
  const SETTINGS_SCHEMA = [
    { key: "launcherText", type: "text", label: "Davetiyedeki Buton Yazısı" },
    { key: "formTitle", type: "text", label: "Form Başlığı (boşsa gösterilmez)" },
    { key: "formDescription", type: "textarea", label: "Açıklama (isteğe bağlı)" },
    { key: "submitButtonText", type: "text", label: "Gönder Butonu Yazısı" },
    { key: "updateButtonText", type: "text", label: "Güncelleme Butonu Yazısı" },
    { key: "successMessage", type: "text", label: "Teşekkür Mesajı" },
    { key: "updatedMessage", type: "text", label: "Güncelleme Sonrası Mesaj" },
    { key: "editAgainText", type: "text", label: '"Yanıtımı değiştir" Bağlantı Yazısı' },
    { key: "closedMessage", type: "text", label: "Form Kapalıyken Gösterilecek Mesaj" },
    { key: "titleFont", type: "font-select", label: "Başlık Fontu" },
    { key: "fontFamily", type: "font-select", label: "Yazı Fontu" },
    { key: "fontSize", type: "number", label: "Yazı Boyutu", unit: "px", min: 11 },
    { key: "textColor", type: "color", label: "Yazı Rengi" },
    { key: "cardColor", type: "color", label: "Form Kartı Arka Planı" },
    { key: "buttonColor", type: "color", label: "Buton / Vurgu Rengi" },
    { key: "buttonTextColor", type: "color", label: "Buton Yazı Rengi" },
    { key: "metallic", type: "select", label: "Buton Metalik Efekti", options: METALLIC_OPTIONS }
  ];

  /* ------------------------------------------------------------------
     FORM ŞEMASI — editör ve sunucu aynı temiz yapıyı kullanır.
     ------------------------------------------------------------------ */
  function bool(v, def) { return v === undefined || v === null ? def : v === true || v === "true"; }

  function normalizeQuestion(q) {
    q = q || {};
    const type = QUESTION_TYPES.some(t => t.value === q.type) ? q.type : "short";
    const out = {
      id: String(q.id || uid("q")).slice(0, 60),
      type: type,
      label: String(q.label || "").slice(0, 300),
      help: String(q.help || "").slice(0, 300),
      required: bool(q.required, false),
      active: bool(q.active, true),
      onlyIfAttending: bool(q.onlyIfAttending, false),
      role: (q.role === "attendance" && type === "yesno") || (q.role === "count" && type === "number") ? q.role : "",
      options: OPTION_TYPES.includes(type)
        ? (Array.isArray(q.options) ? q.options : []).map(o => ({ id: String((o && o.id) || uid("o")).slice(0, 60), label: String((o && o.label) || "").slice(0, 200) }))
        : []
    };
    if (type === "yesno") { out.yesLabel = String(q.yesLabel || "Evet").slice(0, 80); out.noLabel = String(q.noLabel || "Hayır").slice(0, 80); }
    if (type === "number") { out.min = q.min === "" || q.min == null ? "" : Number(q.min); out.max = q.max === "" || q.max == null ? "" : Number(q.max); }
    return out;
  }

  function getQuestions(s) {
    return (Array.isArray(s.questions) ? s.questions : defaultQuestions()).map(normalizeQuestion);
  }

  /* Supabase'e (rsvp_events.form_schema) gönderilen form tanımı. */
  function buildServerForm(settings) {
    const s = Object.assign({}, DEFAULTS, settings);
    return {
      version: 1,
      nameLabel: String(s.nameLabel || DEFAULTS.nameLabel),
      // Ek katılımcı isim alanları her formda açıktır ve isteğe bağlıdır.
      askCompanionNames: true,
      companionNamesRequired: false,
      maxPartySize: Math.max(1, Math.min(100, parseInt(s.maxPartySize, 10) || 10)),
      consentText: String(s.consentText || "").trim(),
      questions: getQuestions(s)
    };
  }

  /* ------------------------------------------------------------------
     DURUM — görünüm yeniden çizilse de (ekran boyutu değişimi vb.)
     misafirin yazdıkları kaybolmaz. Anahtar: belge + katman.
     ------------------------------------------------------------------ */
  const STATES = new Map();
  function stateFor(key) {
    if (!STATES.has(key)) {
      STATES.set(key, { values: {}, name: "", companions: [], consent: false, phase: "form", errors: {}, status: "", statusErr: false,
                        own: null, ownLoaded: false, ownPromise: null, busy: false, wasUpdate: false, closed: false });
    }
    return STATES.get(key);
  }

  function currentSlug() {
    try { return new URLSearchParams(global.location.search).get("slug") || ""; } catch (e) { return ""; }
  }

  /* ------------------------------------------------------------------
     STİL — yalnızca bir kez eklenir.
     ------------------------------------------------------------------ */
  function injectStyles() {
    if (document.getElementById("seoz-af-styles")) return;
    const st = document.createElement("style");
    st.id = "seoz-af-styles";
    st.textContent = [
      ".seoz-af{box-sizing:border-box;width:100%;color:var(--af-ink);font-family:var(--af-font);font-size:var(--af-fs);line-height:1.45;}",
      ".seoz-af *{box-sizing:border-box;}",
      ".seoz-af-card{background:var(--af-card);border-radius:14px;padding:18px 16px;box-shadow:0 2px 14px rgba(0,0,0,.07);}",
      ".seoz-af-title{font-family:var(--af-title);font-size:1.7em;font-weight:600;text-align:center;line-height:1.15;margin:0 0 14px;}",
      ".seoz-af-title+.seoz-af-desc{margin-top:-8px;}",
      ".seoz-af-desc{text-align:center;opacity:.8;margin:0 0 12px;white-space:pre-wrap;}",
      ".seoz-af-note{font-size:.82em;background:rgba(0,0,0,.05);border-radius:8px;padding:8px 10px;margin:0 0 12px;text-align:center;}",
      ".seoz-af-field{margin:0 0 14px;}",
      ".seoz-af-label{display:block;font-weight:700;margin:0 0 6px;}",
      ".seoz-af-req{color:var(--af-accent);margin-left:2px;}",
      ".seoz-af-help{display:block;font-size:.82em;opacity:.7;margin:-3px 0 6px;}",
      ".seoz-af input[type=text],.seoz-af input[type=number],.seoz-af textarea,.seoz-af select{width:100%;font:inherit;color:inherit;background:rgba(255,255,255,.75);border:1px solid rgba(0,0,0,.18);border-radius:10px;padding:10px 12px;outline:none;}",
      ".seoz-af textarea{min-height:76px;resize:vertical;}",
      ".seoz-af input:focus,.seoz-af textarea:focus,.seoz-af select:focus{border-color:var(--af-accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--af-accent) 25%,transparent);}",
      ".seoz-af-err .seoz-af-ctrl input,.seoz-af-err .seoz-af-ctrl textarea,.seoz-af-err .seoz-af-ctrl select{border-color:#B3261E;}",
      ".seoz-af-errmsg{color:#B3261E;font-size:.82em;margin-top:4px;}",
      ".seoz-af-pills{display:flex;gap:8px;flex-wrap:wrap;}",
      ".seoz-af-pill{flex:1 1 0;min-width:120px;font:inherit;font-weight:700;padding:11px 10px;border-radius:10px;border:1.5px solid var(--af-accent);background:transparent;color:inherit;cursor:pointer;}",
      ".seoz-af-pill[aria-pressed=true]{background:var(--af-btn);color:var(--af-btn-ink);border-color:transparent;}",
      ".seoz-af-choices{display:grid;grid-template-columns:1fr;gap:8px;}",
      ".seoz-af-choice{font:inherit;text-align:left;padding:11px 12px;border-radius:10px;border:1.5px solid rgba(0,0,0,.15);background:rgba(255,255,255,.6);color:inherit;cursor:pointer;}",
      ".seoz-af-choice[aria-pressed=true]{border-color:var(--af-accent);background:color-mix(in srgb,var(--af-accent) 14%,transparent);font-weight:700;}",
      ".seoz-af-opt{display:flex;align-items:center;gap:10px;padding:7px 2px;cursor:pointer;}",
      ".seoz-af-opt input{width:18px;height:18px;accent-color:var(--af-accent);flex-shrink:0;margin:0;}",
      ".seoz-af-stepper{display:flex;align-items:stretch;gap:6px;max-width:220px;}",
      ".seoz-af-stepper button{width:44px;font:inherit;font-size:1.3em;border-radius:10px;border:1.5px solid var(--af-accent);background:transparent;color:inherit;cursor:pointer;}",
      ".seoz-af-stepper input{text-align:center;}",
      ".seoz-af-comp{border-left:3px solid var(--af-accent);padding-left:10px;}",
      ".seoz-af-comp .seoz-af-field{margin-bottom:10px;}",
      ".seoz-af-consent{display:flex;gap:10px;align-items:flex-start;font-size:.88em;cursor:pointer;}",
      ".seoz-af-consent input{width:18px;height:18px;margin-top:2px;accent-color:var(--af-accent);flex-shrink:0;}",
      ".seoz-af-submit{width:100%;font:inherit;font-weight:700;font-size:1.05em;padding:13px;border:none;border-radius:12px;background:var(--af-btn-bg);color:var(--af-btn-ink);cursor:pointer;margin-top:4px;}",
      ".seoz-af-submit:disabled{opacity:.6;cursor:wait;}",
      ".seoz-af-status{text-align:center;font-size:.9em;margin-top:10px;}",
      ".seoz-af-status.err{color:#B3261E;}",
      ".seoz-af-done{text-align:center;padding:10px 4px;}",
      ".seoz-af-check{width:52px;height:52px;border-radius:50%;margin:0 auto 10px;display:flex;align-items:center;justify-content:center;background:var(--af-btn);color:var(--af-btn-ink);font-size:26px;}",
      ".seoz-af-link{font:inherit;background:none;border:none;color:var(--af-accent);text-decoration:underline;cursor:pointer;margin-top:10px;font-weight:700;}",
      ".seoz-af-hp{position:absolute!important;left:-9999px!important;width:1px;height:1px;overflow:hidden;}",
      /* Davetiyedeki buton */
      ".seoz-af-launcher{display:flex;flex-direction:column;align-items:center;padding:6px 0;}",
      ".seoz-af-launch{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-width:220px;max-width:100%;font:inherit;font-weight:700;font-size:1.08em;letter-spacing:.02em;padding:14px 30px;border:none;border-radius:999px;background:var(--af-btn-bg);color:var(--af-btn-ink);cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.14);transition:transform .15s ease,box-shadow .15s ease;}",
      ".seoz-af-launch:hover{transform:translateY(-1px);box-shadow:0 9px 22px rgba(0,0,0,.18);}",
      ".seoz-af-launch:active{transform:translateY(0);}",
      ".seoz-af-launch:focus-visible{outline:2px solid var(--af-accent);outline-offset:3px;}",
      ".seoz-af-launch-note{font-size:.84em;margin-top:8px;text-align:center;opacity:.85;}",
      /* Açılır pencere: telefonda alttan kayan sayfa, geniş ekranda ortada pencere */
      ".seoz-af-modal{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:flex-end;justify-content:center;background:rgba(18,20,18,.52);animation:seozAfFade .2s ease;}",
      ".seoz-af-sheet{position:relative;width:100%;max-width:520px;max-height:92vh;max-height:92dvh;display:flex;flex-direction:column;background:var(--af-card);color:var(--af-ink);border-radius:20px 20px 0 0;box-shadow:0 -10px 40px rgba(0,0,0,.22);animation:seozAfUp .28s cubic-bezier(.2,.8,.2,1);outline:none;}",
      ".seoz-af-sheet-head{flex:0 0 auto;display:flex;justify-content:flex-end;align-items:center;padding:8px 8px 0;position:relative;}",
      ".seoz-af-sheet-head:before{content:'';position:absolute;left:50%;top:8px;width:40px;height:4px;margin-left:-20px;border-radius:4px;background:rgba(0,0,0,.15);}",
      ".seoz-af-x{width:44px;height:44px;border:none;border-radius:50%;background:rgba(0,0,0,.06);color:inherit;font:inherit;font-size:20px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;}",
      ".seoz-af-x:hover{background:rgba(0,0,0,.1);}",
      ".seoz-af-sheet-body{flex:1 1 auto;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:0 0 calc(10px + env(safe-area-inset-bottom));}",
      ".seoz-af-sheet .seoz-af-card{box-shadow:none;border-radius:0;background:transparent;padding:0 20px 18px;}",
      ".seoz-af-sheet input[type=text],.seoz-af-sheet input[type=number],.seoz-af-sheet textarea,.seoz-af-sheet select{font-size:max(16px,1em);}",
      ".seoz-af-done-close{margin-top:14px;}",
      "@media (min-width:600px){.seoz-af-modal{align-items:center;padding:24px;}.seoz-af-sheet{border-radius:20px;max-height:88vh;box-shadow:0 20px 60px rgba(0,0,0,.25);animation:seozAfPop .22s ease;}.seoz-af-sheet-head:before{display:none;}}",
      "@keyframes seozAfFade{from{opacity:0}to{opacity:1}}",
      "@keyframes seozAfUp{from{transform:translateY(40px);opacity:.4}to{transform:none;opacity:1}}",
      "@keyframes seozAfPop{from{transform:scale(.97);opacity:0}to{transform:none;opacity:1}}",
      "@media (prefers-reduced-motion:reduce){.seoz-af-modal,.seoz-af-sheet{animation:none;}}"
    ].join("\n");
    document.head.appendChild(st);
  }

  /* ------------------------------------------------------------------
     YARDIMCILAR
     ------------------------------------------------------------------ */
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function isBlank(v) {
    return v === undefined || v === null || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0);
  }
  function attendanceQ(questions) { return questions.find(q => q.active && q.role === "attendance"); }
  function countQ(questions) { return questions.find(q => q.active && q.role === "count"); }

  function attendingValue(st, questions) {
    const aq = attendanceQ(questions);
    if (!aq) return true;
    const v = st.values[aq.id];
    return typeof v === "boolean" ? v : null;
  }
  function partySize(st, s, questions) {
    if (attendingValue(st, questions) === false) return 0;
    const cq = countQ(questions);
    if (!cq) return 1;
    const n = parseInt(st.values[cq.id], 10);
    const max = buildServerForm(s).maxPartySize;
    return isFinite(n) ? Math.max(1, Math.min(max, n)) : 1;
  }
  function isVisible(q, st, questions) {
    if (!q.active) return false;
    if (q.onlyIfAttending && q.role !== "attendance" && attendingValue(st, questions) === false) return false;
    return true;
  }

  const MESSAGES = {
    network: "Bağlantı kurulamadı. İnternetinizi kontrol edip tekrar deneyin.",
    event_not_found: "Bu davetiyenin katılım formu henüz etkin değil.",
    limit_reached: "Bu form için yanıt sınırına ulaşıldı.",
    rejected: "Yanıt gönderilemedi.",
    payload_too_large: "Yanıt çok uzun. Lütfen kısaltıp tekrar deneyin.",
    not_configured: "Katılım formu şu anda kullanılamıyor."
  };

  /* Yerel (tarayıcı) kontrolü — sunucu da aynı kuralları ayrıca uygular. */
  function validateLocal(st, s, questions) {
    const errs = {};
    if (isBlank(st.name)) errs.__name = "Bu alan zorunludur.";
    questions.forEach(q => {
      if (!isVisible(q, st, questions)) return;
      const v = st.values[q.id];
      if (isBlank(v)) { if (q.required) errs[q.id] = "Bu alan zorunludur."; return; }
      if (q.type === "number") {
        const n = Number(v);
        if (!isFinite(n)) { errs[q.id] = "Geçerli bir sayı girin."; return; }
        if (q.role === "count") {
          const max = buildServerForm(s).maxPartySize;
          if (n < 1 || n > max || Math.floor(n) !== n) errs[q.id] = `1 ile ${max} arasında bir sayı girin.`;
        } else {
          if (q.min !== "" && q.min != null && n < Number(q.min)) errs[q.id] = `En az ${q.min} olmalı.`;
          if (q.max !== "" && q.max != null && n > Number(q.max)) errs[q.id] = `En fazla ${q.max} olabilir.`;
        }
      }
    });
    const form = buildServerForm(s);
    const ps = partySize(st, s, questions);
    if (form.askCompanionNames && form.companionNamesRequired) {
      for (let i = 1; i < ps; i++) if (isBlank(st.companions[i - 1])) errs["__comp" + i] = "Bu alan zorunludur.";
    }
    if (form.consentText && !st.consent) errs.__consent = "Devam etmek için onay vermeniz gerekiyor.";
    return errs;
  }

  function serverErrorToField(code) {
    const m = String(code || "").match(/^(required|invalid|range|too_long):(.+)$/);
    if (!m) return null;
    const target = m[2];
    const msg = m[1] === "required" ? "Bu alan zorunludur." : m[1] === "range" ? "Bu değer izin verilen aralıkta değil." :
                m[1] === "too_long" ? "Bu yanıt çok uzun." : "Bu yanıt geçerli değil.";
    if (target === "name") return { key: "__name", msg };
    if (target === "consent") return { key: "__consent", msg: "Devam etmek için onay vermeniz gerekiyor." };
    const cm = target.match(/^companion:(\d+)$/);
    if (cm) return { key: "__comp" + cm[1], msg };
    return { key: target, msg };
  }

  /* ------------------------------------------------------------------
     ÇİZİM
     ------------------------------------------------------------------ */
  function buttonBg(s) {
    const g = global.SeozRenderer && global.SeozRenderer.METALLIC_GRADIENTS;
    return (g && g[s.metallic]) || s.buttonColor;
  }

  function fieldWrap(st, key, labelText, required, help) {
    const f = el("div", "seoz-af-field");
    f.dataset.afKey = key;
    if (st.errors[key]) f.classList.add("seoz-af-err");
    if (labelText) {
      const l = el("label", "seoz-af-label", labelText);
      if (required) l.appendChild(el("span", "seoz-af-req", "*"));
      f.appendChild(l);
    }
    if (help) f.appendChild(el("span", "seoz-af-help", help));
    const ctrl = el("div", "seoz-af-ctrl");
    f.appendChild(ctrl);
    if (st.errors[key]) f.appendChild(el("div", "seoz-af-errmsg", st.errors[key]));
    return { f, ctrl };
  }

  function clearErr(st, key, fieldEl) {
    if (!st.errors[key]) return;
    delete st.errors[key];
    fieldEl.classList.remove("seoz-af-err");
    const m = fieldEl.querySelector(".seoz-af-errmsg");
    if (m) m.remove();
    // Tüm hatalar düzeltildiyse alttaki uyarı yazısı da kalkar.
    if (!Object.keys(st.errors).length && st.statusErr) {
      st.status = ""; st.statusErr = false;
      const root = fieldEl.closest(".seoz-af");
      const line = root && root.querySelector(".seoz-af-status");
      if (line) { line.textContent = ""; line.className = "seoz-af-status"; }
    }
  }

  function renderQuestion(q, st, s, questions, repaint, refreshCompanions) {
    const { f, ctrl } = fieldWrap(st, q.id, q.label, q.required, q.help);
    // Kişi sayısı sorusu boşsa 1 ile başlar (çoğu kişi tek gelir; "+" ile artırılır).
    if (q.role === "count" && q.type === "number" && isBlank(st.values[q.id])) st.values[q.id] = 1;
    const val = st.values[q.id];
    const set = (v) => { st.values[q.id] = v; clearErr(st, q.id, f); };

    if (q.type === "short" || q.type === "long") {
      const inp = q.type === "short" ? el("input") : el("textarea");
      if (q.type === "short") inp.type = "text";
      inp.maxLength = q.type === "short" ? 300 : 3000;
      inp.value = val == null ? "" : String(val);
      inp.addEventListener("input", () => set(inp.value));
      ctrl.appendChild(inp);

    } else if (q.type === "yesno") {
      const row = el("div", "seoz-af-pills");
      [[true, q.yesLabel || "Evet"], [false, q.noLabel || "Hayır"]].forEach(([v, text]) => {
        const b = el("button", "seoz-af-pill", text);
        b.type = "button";
        b.setAttribute("aria-pressed", String(val === v));
        b.addEventListener("click", () => {
          set(v);
          if (q.role === "attendance") repaint(); else row.querySelectorAll("button").forEach((x, i) => x.setAttribute("aria-pressed", String((i === 0) === v)));
        });
        row.appendChild(b);
      });
      ctrl.appendChild(row);

    } else if (q.type === "choice") {
      const grid = el("div", "seoz-af-choices");
      q.options.forEach(o => {
        const b = el("button", "seoz-af-choice", o.label);
        b.type = "button";
        b.setAttribute("aria-pressed", String(val === o.id));
        b.addEventListener("click", () => {
          set(o.id);
          grid.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", "false"));
          b.setAttribute("aria-pressed", "true");
        });
        grid.appendChild(b);
      });
      ctrl.appendChild(grid);

    } else if (q.type === "radio" || q.type === "checkbox") {
      const multi = q.type === "checkbox";
      const group = "af_" + q.id + "_" + Math.random().toString(36).slice(2, 6);
      q.options.forEach(o => {
        const lab = el("label", "seoz-af-opt");
        const inp = el("input");
        inp.type = multi ? "checkbox" : "radio";
        inp.name = group;
        inp.checked = multi ? Array.isArray(val) && val.includes(o.id) : val === o.id;
        inp.addEventListener("change", () => {
          if (multi) {
            const cur = Array.isArray(st.values[q.id]) ? st.values[q.id].slice() : [];
            const i = cur.indexOf(o.id);
            if (inp.checked && i < 0) cur.push(o.id);
            if (!inp.checked && i >= 0) cur.splice(i, 1);
            set(cur);
          } else if (inp.checked) set(o.id);
        });
        lab.appendChild(inp);
        lab.appendChild(el("span", null, o.label));
        ctrl.appendChild(lab);
      });

    } else if (q.type === "select") {
      const sel = el("select");
      const ph = el("option", null, "Seçiniz");
      ph.value = "";
      sel.appendChild(ph);
      q.options.forEach(o => {
        const op = el("option", null, o.label);
        op.value = o.id;
        if (val === o.id) op.selected = true;
        sel.appendChild(op);
      });
      sel.addEventListener("change", () => set(sel.value || null));
      ctrl.appendChild(sel);

    } else if (q.type === "number") {
      const inp = el("input");
      inp.type = "number";
      inp.inputMode = "numeric";
      if (q.role === "count") { inp.min = "1"; inp.max = String(buildServerForm(s).maxPartySize); inp.step = "1"; }
      else { if (q.min !== "" && q.min != null) inp.min = String(q.min); if (q.max !== "" && q.max != null) inp.max = String(q.max); }
      inp.value = val == null ? "" : String(val);
      const update = () => {
        set(inp.value === "" ? null : Number(inp.value));
        if (q.role === "count") refreshCompanions();
      };
      inp.addEventListener("input", update);
      if (q.role === "count") {
        const step = el("div", "seoz-af-stepper");
        const minus = el("button", null, "−"); minus.type = "button"; minus.setAttribute("aria-label", "Azalt");
        const plus = el("button", null, "+"); plus.type = "button"; plus.setAttribute("aria-label", "Artır");
        const max = buildServerForm(s).maxPartySize;
        minus.addEventListener("click", () => { inp.value = String(Math.max(1, (parseInt(inp.value, 10) || 1) - 1)); update(); });
        plus.addEventListener("click", () => { inp.value = String(Math.min(max, (parseInt(inp.value, 10) || 0) + 1)); update(); });
        step.appendChild(minus); step.appendChild(inp); step.appendChild(plus);
        ctrl.appendChild(step);
      } else ctrl.appendChild(inp);
    }
    return f;
  }

  function paint(root, s, mode, ctx, st) {
    const questions = getQuestions(s);
    const form = buildServerForm(s);
    root.innerHTML = "";
    const card = el("div", "seoz-af-card");
    root.appendChild(card);

    if (String(s.formTitle || "").trim()) card.appendChild(el("h3", "seoz-af-title", s.formTitle));
    if (String(s.formDescription || "").trim()) card.appendChild(el("p", "seoz-af-desc", s.formDescription));

    const slug = mode === "edit" ? "" : currentSlug();
    const live = mode !== "edit" && !!slug && global.SeozEventStore && global.SeozEventStore.isConfigured();

    if (st.closed) {
      card.appendChild(el("p", "seoz-af-desc", s.closedMessage || DEFAULTS.closedMessage));
      return;
    }

    /* Gönderildi ekranı */
    if (st.phase === "done") {
      const d = el("div", "seoz-af-done");
      d.appendChild(el("div", "seoz-af-check", "✓"));
      d.appendChild(el("p", null, st.wasUpdate ? (s.updatedMessage || DEFAULTS.updatedMessage) : (s.successMessage || DEFAULTS.successMessage)));
      if (mode === "edit") d.appendChild(el("p", "seoz-af-note", "Editör önizlemesi — yanıt kaydedilmedi."));
      if (st.closeModal) {
        const closeBtn = el("button", "seoz-af-submit seoz-af-done-close", "Kapat");
        closeBtn.type = "button";
        closeBtn.addEventListener("click", () => st.closeModal());
        d.appendChild(closeBtn);
      }
      const again = el("button", "seoz-af-link", s.editAgainText || DEFAULTS.editAgainText);
      again.type = "button";
      again.addEventListener("click", () => { st.phase = "form"; st.status = ""; paint(root, s, mode, ctx, st); });
      d.appendChild(again);
      card.appendChild(d);
      return;
    }

    if (st.own && st.own.updated_at) {
      const when = new Date(st.own.updated_at);
      const txt = isNaN(when) ? "" : " (" + when.toLocaleDateString("tr-TR", { day: "numeric", month: "long" }) + ")";
      card.appendChild(el("p", "seoz-af-note", "Daha önce yanıt verdiniz" + txt + ". Değişiklik yapıp güncelleyebilirsiniz."));
    }
    if (mode !== "edit" && !live) {
      card.appendChild(el("p", "seoz-af-note", "Bu form yalnızca yayınlanmış davetiye bağlantısında yanıt alır."));
    }

    const repaint = () => paint(root, s, mode, ctx, st);

    /* Ad soyad (her formda var; etiketi editörden değişir) */
    const nameW = fieldWrap(st, "__name", form.nameLabel, true, "");
    const nameInp = el("input");
    nameInp.type = "text"; nameInp.maxLength = 120; nameInp.autocomplete = "name";
    nameInp.value = st.name || "";
    nameInp.addEventListener("input", () => { st.name = nameInp.value; clearErr(st, "__name", nameW.f); });
    nameW.ctrl.appendChild(nameInp);
    card.appendChild(nameW.f);

    /* Diğer katılımcıların adları — kişi sayısı değişince yalnızca bu bölüm yenilenir */
    const compBox = el("div");
    function refreshCompanions() {
      compBox.innerHTML = "";
      const ps = partySize(st, s, questions);
      if (!form.askCompanionNames || ps <= 1) return;
      const wrap = el("div", "seoz-af-field seoz-af-comp");
      for (let i = 1; i < ps; i++) {
        const key = "__comp" + i;
        const label = String(s.companionLabel || DEFAULTS.companionLabel).replace("{n}", String(i + 1));
        const w = fieldWrap(st, key, label, form.companionNamesRequired, form.companionNamesRequired ? "" : "İsteğe bağlı");
        const inp = el("input");
        inp.type = "text"; inp.maxLength = 120;
        inp.value = st.companions[i - 1] || "";
        inp.addEventListener("input", () => { st.companions[i - 1] = inp.value; clearErr(st, key, w.f); });
        w.ctrl.appendChild(inp);
        wrap.appendChild(w.f);
      }
      compBox.appendChild(wrap);
    }

    questions.forEach(q => {
      if (!isVisible(q, st, questions)) return;
      card.appendChild(renderQuestion(q, st, s, questions, repaint, refreshCompanions));
      if (q.role === "count") card.appendChild(compBox);
    });
    if (!countQ(questions)) card.appendChild(compBox);
    refreshCompanions();

    if (form.consentText) {
      const cw = fieldWrap(st, "__consent", "", false, "");
      const lab = el("label", "seoz-af-consent");
      const cb = el("input"); cb.type = "checkbox"; cb.checked = !!st.consent;
      cb.addEventListener("change", () => { st.consent = cb.checked; clearErr(st, "__consent", cw.f); });
      lab.appendChild(cb);
      lab.appendChild(el("span", null, form.consentText));
      cw.ctrl.appendChild(lab);
      card.appendChild(cw.f);
    }

    /* Bot tuzağı: gerçek kullanıcı görmez/doldurmaz */
    const hp = el("input", "seoz-af-hp");
    hp.type = "text"; hp.tabIndex = -1; hp.autocomplete = "off"; hp.setAttribute("aria-hidden", "true"); hp.name = "website";
    card.appendChild(hp);

    const btn = el("button", "seoz-af-submit", st.own ? (s.updateButtonText || DEFAULTS.updateButtonText) : (s.submitButtonText || DEFAULTS.submitButtonText));
    btn.type = "button";
    btn.disabled = st.busy;
    card.appendChild(btn);
    const status = el("div", "seoz-af-status" + (st.statusErr ? " err" : ""), st.status || "");
    card.appendChild(status);

    btn.addEventListener("click", () => {
      if (st.busy) return;
      st.errors = validateLocal(st, s, questions);
      if (Object.keys(st.errors).length) {
        st.status = "Lütfen işaretli alanları kontrol edin."; st.statusErr = true;
        repaint();
        const first = root.querySelector(".seoz-af-err");
        if (first && first.scrollIntoView) first.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      if (mode === "edit") { st.wasUpdate = !!st.own; st.phase = "done"; st.status = ""; repaint(); return; }
      if (!live) { st.status = "Bu form yalnızca yayınlanmış davetiye bağlantısında yanıt alır."; st.statusErr = true; repaint(); return; }

      const ps = partySize(st, s, questions);
      const answers = {};
      questions.forEach(q => { if (isVisible(q, st, questions) && !isBlank(st.values[q.id])) answers[q.id] = st.values[q.id]; });
      const payload = {
        name: String(st.name || "").trim(),
        answers: answers,
        companions: form.askCompanionNames ? st.companions.slice(0, Math.max(0, ps - 1)).map(x => String(x || "").trim()) : [],
        consent: !!st.consent,
        hp: hp.value
      };
      st.busy = true; st.status = "Gönderiliyor..."; st.statusErr = false;
      btn.disabled = true; status.textContent = st.status; status.className = "seoz-af-status";
      global.SeozEventStore.submitResponse(slug, ctx && ctx.layerId, payload)
        .then(r => {
          st.busy = false;
          st.wasUpdate = !!(r && r.created === false);
          st.own = { updated_at: (r && r.saved_at) || new Date().toISOString() };
          st.phase = "done"; st.status = "";
          repaint();
          if (st.refreshLauncher) st.refreshLauncher();
        })
        .catch(err => {
          st.busy = false;
          const code = (err && (err.code || err.message)) || "";
          if (code === "form_closed") { st.closed = true; repaint(); return; }
          const fe = serverErrorToField(code);
          if (fe) { st.errors[fe.key] = fe.msg; st.status = "Lütfen işaretli alanları kontrol edin."; }
          else st.status = MESSAGES[code] || "Yanıt gönderilemedi. Lütfen tekrar deneyin.";
          st.statusErr = true;
          repaint();
        });
    });
  }

  /* Daha önce yanıt verildiyse formu misafirin kendi yanıtıyla doldurur. */
  function loadOwn(st, slug, ctx, onDone) {
    if (st.ownLoaded || st.ownPromise) return;
    if (!global.SeozEventStore || !global.SeozEventStore.getGuestToken(slug, ctx && ctx.layerId)) { st.ownLoaded = true; return; }
    st.ownPromise = global.SeozEventStore.getOwnResponse(slug, ctx && ctx.layerId)
      .then(own => {
        st.ownLoaded = true;
        if (!own) return;
        st.own = own;
        st.name = own.name || "";
        st.values = Object.assign({}, own.answers || {});
        st.companions = Array.isArray(own.companions) ? own.companions.slice() : [];
        st.consent = !!own.consent;
        onDone();
      })
      .catch(() => { st.ownLoaded = true; });
  }

  function applyVars(node, s) {
    node.style.setProperty("--af-ink", s.textColor);
    node.style.setProperty("--af-card", s.cardColor);
    node.style.setProperty("--af-accent", s.buttonColor);
    node.style.setProperty("--af-btn", s.buttonColor);
    node.style.setProperty("--af-btn-bg", buttonBg(s));
    node.style.setProperty("--af-btn-ink", s.buttonTextColor);
    node.style.setProperty("--af-font", `"${s.fontFamily}", sans-serif`);
    node.style.setProperty("--af-title", `"${s.titleFont}", serif`);
    node.style.setProperty("--af-fs", Math.max(11, Number(s.fontSize) || 15) + "px");
  }

  /* Formu açılır pencerede gösterir. Pencere sayfanın (body) en üstüne
     eklenir; davetiyenin ölçeklenmesinden etkilenmez. Aynı anda bir tane açık olur. */
  function openModal(s, mode, ctx, st) {
    if (st.modal && st.modal.isConnected) return;
    const overlay = el("div", "seoz-af-modal");
    applyVars(overlay, s);
    const sheet = el("div", "seoz-af-sheet");
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    sheet.setAttribute("aria-label", String(s.formTitle || "").trim() || String(s.launcherText || DEFAULTS.launcherText));
    sheet.tabIndex = -1;
    const head = el("div", "seoz-af-sheet-head");
    const x = el("button", "seoz-af-x", "✕");
    x.type = "button";
    x.setAttribute("aria-label", "Kapat");
    head.appendChild(x);
    const body = el("div", "seoz-af-sheet-body");
    const inner = el("div", "seoz-af");
    applyVars(inner, s);
    body.appendChild(inner);
    sheet.appendChild(head);
    sheet.appendChild(body);
    overlay.appendChild(sheet);

    const html = document.documentElement;
    const prevHtml = html.style.overflow, prevBody = document.body.style.overflow;
    const prevFocus = document.activeElement;
    function onKey(e) { if (e.key === "Escape") close(); }
    function close() {
      if (!overlay.isConnected) return;
      overlay.remove();
      html.style.overflow = prevHtml; document.body.style.overflow = prevBody;
      document.removeEventListener("keydown", onKey);
      st.modal = null; st.closeModal = null;
      if (st.root === inner) st.root = null;
      // Gönderildiyse bir sonraki açılışta form (dolu olarak) gelir.
      if (st.phase === "done") { st.phase = "form"; }
      if (st.refreshLauncher) st.refreshLauncher();
      if (prevFocus && prevFocus.focus && prevFocus.isConnected) { try { prevFocus.focus({ preventScroll: true }); } catch (e) { /* önemsiz */ } }
    }
    x.addEventListener("click", close);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    document.addEventListener("keydown", onKey);

    st.modal = overlay;
    st.closeModal = close;
    st.root = inner;
    html.style.overflow = "hidden"; document.body.style.overflow = "hidden";
    document.body.appendChild(overlay);
    paint(inner, s, mode, ctx, st);
    // Telefonda klavye kendiliğinden açılmasın: odak yalnızca pencereye verilir.
    try { sheet.focus({ preventScroll: true }); } catch (e) { sheet.focus(); }
  }

  function render(settings, mode, ctx) {
    injectStyles();
    const s = Object.assign({}, DEFAULTS, settings);
    const root = el("div", "seoz-af seoz-af-launcher");
    applyVars(root, s);

    const key = (mode === "edit" ? "edit:" : "view:") + ((ctx && ctx.docId) || "") + ":" + ((ctx && ctx.layerId) || "");
    const st = stateFor(key);

    const btn = el("button", "seoz-af-launch", String(s.launcherText || "").trim() || DEFAULTS.launcherText);
    btn.type = "button";
    btn.setAttribute("aria-haspopup", "dialog");
    const note = el("div", "seoz-af-launch-note");
    root.appendChild(btn);
    root.appendChild(note);

    st.refreshLauncher = () => {
      if (!note.isConnected && !root.isConnected) return;
      if (mode === "edit") { note.textContent = "Editör: formu önizlemek için butona çift tıklayın."; return; }
      note.textContent = st.closed ? (s.closedMessage || DEFAULTS.closedMessage) : st.own ? "✓ Yanıtınız alındı · değiştirmek için tekrar dokunun" : "";
      note.hidden = !note.textContent;
    };
    st.refreshLauncher();

    // Editörde tek tıklama katmanı seçer; önizleme çift tıklamayla açılır.
    btn.addEventListener(mode === "edit" ? "dblclick" : "click", () => openModal(s, mode, ctx, st));

    if (mode !== "edit") {
      const slug = currentSlug();
      if (slug) loadOwn(st, slug, ctx, () => {
        if (st.refreshLauncher) st.refreshLauncher();
        if (st.root && st.root.isConnected && st.phase === "form") paint(st.root, s, mode, ctx, st);
      });
    }
    return root;
  }

  function validate(settings) {
    const s = Object.assign({}, DEFAULTS, settings);
    const qs = getQuestions(s).filter(q => q.active);
    if (!global.SeozEventStore || !global.SeozEventStore.isConfigured()) {
      return "Katılım Formu: Supabase bağlantısı ayarlı değil — yanıtlar kaydedilemez.";
    }
    const empty = qs.find(q => !q.label.trim());
    if (empty) return "Katılım Formu: başlığı boş bir soru var.";
    const noOpts = qs.find(q => OPTION_TYPES.includes(q.type) && q.options.filter(o => o.label.trim()).length < 2);
    if (noOpts) return `Katılım Formu: "${noOpts.label}" sorusunda en az 2 seçenek olmalı.`;
    return null;
  }

  const defaultSettings = Object.assign({}, DEFAULTS);
  Object.defineProperty(defaultSettings, "questions", { enumerable: true, get: defaultQuestions });

  global.SeozModuleRegistry.registerModule({
    id: "attendance-form",
    label: "Katılım Formu",
    defaultSettings: defaultSettings,
    defaultLayerSize: { w: 370, h: 520 },
    autoHeight: true,
    settingsSchema: SETTINGS_SCHEMA,
    render: render,
    validate: validate,
    // Editör (soru oluşturucu + yayın senkronu) için yardımcılar
    QUESTION_TYPES: QUESTION_TYPES,
    OPTION_TYPES: OPTION_TYPES,
    normalizeQuestion: normalizeQuestion,
    getQuestions: getQuestions,
    buildServerForm: buildServerForm,
    newId: uid
  });
})(window);
