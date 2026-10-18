/* =============================================================================
   STUDIO SEOZ — modules/campaign.js  (YENİ İŞLETME MODÜLÜ — İNDİRİM / KAMPANYA)
   -----------------------------------------------------------------------------
   Kampanya kartı: rozet (ör. %20 İNDİRİM), başlık, açıklama, isteğe bağlı
   kupon kodu (tek dokunuşla kopyalanır), bitiş tarihine geri sayım, koşullar
   ve bir harekete çağrı düğmesi (WhatsApp ya da bağlantı).
   - Bitiş tarihi geçince "Kampanya sona erdi" yazar ya da (seçilirse) hiç görünmez.
   - Misafirin tarayıcısı hiçbir yere veri yazmaz.
   - Anahtarlar "cp" önekli; diğer modüllerden tamamen bağımsızdır.
   ========================================================================= */
(function (global) {
  "use strict";

  const DEFAULTS = {
    moduleActive: true,
    cpStyle: "kart",
    cpBadge: "%20 İNDİRİM",
    cpTitle: "Açılışa Özel Kampanya",
    cpText: "Tüm hizmetlerde geçerli indirim fırsatını kaçırmayın.",
    cpCode: "",
    cpEndDate: "",
    cpEndTime: "23:59",
    cpShowCountdown: true,
    cpHideAfterEnd: false,
    cpConditions: "",
    cpCta: "whatsapp",
    cpCtaText: "Hemen Yararlan",
    cpWhatsapp: "",
    cpWhatsappMessage: "Merhaba, kampanyanız hakkında bilgi almak istiyorum.",
    cpLink: "",
    titleFont: "Cormorant Garamond",
    fontFamily: "Manrope",
    accentColor: "#C8323C",
    textColor: "#2A2420",
    bgColor: "#FFFDF8"
  };

  const SETTINGS_SCHEMA = [
    { key: "moduleActive", type: "checkbox", label: "Modül aktif (kapalıysa yayında görünmez)" },
    { key: "cpStyle", type: "select", label: "Görünüm", options: [{ value: "kart", label: "Kart" }, { value: "etiket", label: "Fiyat etiketi" }, { value: "serit", label: "Şerit (ince bant)" }] },
    { key: "cpBadge", type: "text", label: "Rozet (ör. %20 İNDİRİM, 2 AL 1 ÖDE)" },
    { key: "cpTitle", type: "text", label: "Başlık" },
    { key: "cpText", type: "textarea", label: "Açıklama" },
    { key: "cpCode", type: "text", label: "Kupon kodu (isteğe bağlı)" },
    { key: "cpEndDate", type: "date", label: "Kampanya bitiş tarihi (isteğe bağlı)" },
    { key: "cpEndTime", type: "time", label: "Bitiş saati" },
    { key: "cpShowCountdown", type: "checkbox", label: "Bitişe kalan süreyi göster" },
    { key: "cpHideAfterEnd", type: "checkbox", label: "Bitince tamamen gizle (kapalıysa “Kampanya sona erdi” yazar)" },
    { key: "cpConditions", type: "textarea", label: "Koşullar (küçük yazı)" },
    { key: "cpCta", type: "select", label: "Düğme", options: [{ value: "whatsapp", label: "WhatsApp'tan yaz" }, { value: "link", label: "Bağlantı aç" }, { value: "none", label: "Düğme yok" }] },
    { key: "cpCtaText", type: "text", label: "Düğme yazısı" },
    { key: "cpWhatsapp", type: "text", label: "WhatsApp numarası (ör. 905xxxxxxxxx)" },
    { key: "cpWhatsappMessage", type: "textarea", label: "WhatsApp hazır mesajı" },
    { key: "cpLink", type: "url", label: "Bağlantı adresi" },
    { key: "titleFont", type: "font-select", label: "Başlık fontu" },
    { key: "fontFamily", type: "font-select", label: "Yazı fontu" },
    { key: "accentColor", type: "color", label: "Vurgu rengi (rozet, düğme)" },
    { key: "textColor", type: "color", label: "Yazı rengi" },
    { key: "bgColor", type: "color", label: "Arka plan" }
  ];

  const clean = v => String(v == null ? "" : v).trim();
  function el(tag, css, text) { const e = document.createElement(tag); if (css) Object.assign(e.style, css); if (text != null) e.textContent = text; return e; }
  function endOf(s) { if (!s.cpEndDate) return null; const t = new Date(s.cpEndDate + "T" + (s.cpEndTime || "23:59") + ":00"); return isNaN(t) ? null : t; }
  function left(end) {
    let d = Math.max(0, end.getTime() - Date.now());
    const g = Math.floor(d / 86400000); d -= g * 86400000; const h = Math.floor(d / 3600000); d -= h * 3600000; const m = Math.floor(d / 60000); d -= m * 60000;
    return { g, h, m, s: Math.floor(d / 1000), done: end.getTime() <= Date.now() };
  }
  function waLink(s) {
    const n = clean(s.cpWhatsapp).replace(/[^\d]/g, "");
    return n ? `https://wa.me/${n}?text=${encodeURIComponent(clean(s.cpWhatsappMessage))}` : "";
  }
  function safeUrl(u) { u = clean(u); return /^(https?:|mailto:|tel:)/i.test(u) ? u : (u ? "https://" + u.replace(/^\/+/, "") : ""); }
  function placeholder(text) {
    return el("div", { border: "1px dashed rgba(0,0,0,.25)", borderRadius: "8px", padding: "12px", textAlign: "center", fontFamily: "'Manrope', sans-serif", fontSize: "12px", color: "#8A8578", background: "rgba(255,255,255,.5)" }, text);
  }
  function emptyEl() { return el("div", { height: "0", overflow: "hidden" }); }

  function render(settings, mode) {
    const s = Object.assign({}, DEFAULTS, settings);
    if (!s.moduleActive) return mode === "edit" ? placeholder("İndirim / Kampanya — PASİF (yayında görünmez)") : emptyEl();
    const end = endOf(s);
    if (end && left(end).done && s.cpHideAfterEnd) return mode === "edit" ? placeholder("İndirim / Kampanya — süresi doldu (yayında gizli)") : emptyEl();
    const strip = s.cpStyle === "serit", tag = s.cpStyle === "etiket";
    const wrap = el("div", {
      width: "100%", boxSizing: "border-box", position: "relative", color: s.textColor, fontFamily: `"${s.fontFamily}", sans-serif`,
      background: s.bgColor, borderRadius: strip ? "999px" : tag ? "14px 40px 40px 14px" : "16px", padding: strip ? "10px 16px" : "20px 18px 18px",
      boxShadow: "0 10px 26px rgba(0,0,0,.10)", border: `1.5px ${tag ? "dashed" : "solid"} ${s.accentColor}`, textAlign: strip ? "left" : "center",
      display: strip ? "flex" : "block", alignItems: "center", gap: "12px", overflow: "hidden"
    });
    wrap.className = "seoz-campaign";
    if (tag) {
      const hole = el("span", { position: "absolute", right: "16px", top: "50%", width: "14px", height: "14px", marginTop: "-7px", borderRadius: "50%", background: "#fff", boxShadow: `inset 0 0 0 2px ${s.accentColor}` });
      wrap.appendChild(hole); wrap.style.paddingRight = "44px";
    }
    if (clean(s.cpBadge)) {
      const b = el("div", {
        display: "inline-block", background: s.accentColor, color: "#fff", fontWeight: "800", letterSpacing: ".06em", fontSize: strip ? "13px" : "15px",
        padding: strip ? "6px 12px" : "7px 16px", borderRadius: "999px", marginBottom: strip ? "0" : "10px", whiteSpace: "nowrap", flexShrink: "0",
        transform: strip ? "none" : "rotate(-2deg)", boxShadow: "0 4px 10px rgba(0,0,0,.15)"
      }, s.cpBadge);
      wrap.appendChild(b);
    }
    const body = el("div", { minWidth: "0", flex: "1 1 auto" });
    if (clean(s.cpTitle)) body.appendChild(el("div", { fontFamily: `"${s.titleFont}", serif`, fontSize: strip ? "17px" : "24px", fontWeight: "700", lineHeight: "1.2" }, s.cpTitle));
    if (clean(s.cpText) && !strip) body.appendChild(el("div", { fontSize: "14px", lineHeight: "1.45", marginTop: "6px", opacity: ".85", whiteSpace: "pre-wrap" }, s.cpText));
    wrap.appendChild(body);

    if (clean(s.cpCode) && !strip) {
      const code = el("button", { marginTop: "12px", display: "inline-flex", alignItems: "center", gap: "8px", padding: "8px 14px", borderRadius: "10px", border: `1.5px dashed ${s.accentColor}`,
        background: "rgba(255,255,255,.7)", color: s.textColor, font: `700 15px "${s.fontFamily}", sans-serif`, letterSpacing: ".12em", cursor: "pointer" });
      code.type = "button";
      code.innerHTML = `<span></span><small style="font-size:10px;letter-spacing:0;opacity:.65;font-weight:600">Kopyala</small>`;
      code.firstChild.textContent = s.cpCode;
      code.setAttribute("aria-label", "Kupon kodunu kopyala: " + s.cpCode);
      code.addEventListener("click", (e) => {
        e.stopPropagation();
        const done = () => { code.lastChild.textContent = "Kopyalandı ✓"; setTimeout(() => { code.lastChild.textContent = "Kopyala"; }, 1800); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(s.cpCode).then(done, done); else done();
      });
      body.appendChild(code);
    }
    if (end && s.cpShowCountdown) {
      const cd = el("div", { marginTop: strip ? "2px" : "12px", fontSize: strip ? "12px" : "13px", fontWeight: "700", color: s.accentColor });
      const tick = () => {
        const r = left(end);
        cd.textContent = r.done ? "Kampanya sona erdi" : `Bitişe ${r.g ? r.g + " gün " : ""}${String(r.h).padStart(2, "0")}:${String(r.m).padStart(2, "0")}:${String(r.s).padStart(2, "0")}`;
        if (r.done) { wrap.style.opacity = ".7"; }
      };
      tick();
      cd.dataset.intervalId = String(setInterval(tick, 1000));
      body.appendChild(cd);
    } else if (end && left(end).done) body.appendChild(el("div", { marginTop: "10px", fontSize: "13px", fontWeight: "700", color: s.accentColor }, "Kampanya sona erdi"));

    const href = s.cpCta === "whatsapp" ? waLink(s) : s.cpCta === "link" ? safeUrl(s.cpLink) : "";
    if (s.cpCta !== "none") {
      const a = el("a", { display: "inline-flex", alignItems: "center", justifyContent: "center", marginTop: strip ? "0" : "14px", padding: strip ? "8px 14px" : "11px 22px",
        borderRadius: "999px", background: s.accentColor, color: "#fff", textDecoration: "none", fontWeight: "700", fontSize: strip ? "13px" : "15px", whiteSpace: "nowrap",
        flexShrink: "0", opacity: href ? "1" : ".45", pointerEvents: href ? "auto" : "none" }, s.cpCtaText || "Hemen Yararlan");
      if (href) { a.href = href; a.target = "_blank"; a.rel = "noopener"; }
      (strip ? wrap : body).appendChild(a);
    }
    if (clean(s.cpConditions) && !strip) body.appendChild(el("div", { marginTop: "12px", fontSize: "11px", opacity: ".6", lineHeight: "1.4", whiteSpace: "pre-wrap" }, s.cpConditions));
    return wrap;
  }

  function validate(s) {
    s = Object.assign({}, DEFAULTS, s);
    if (!s.moduleActive) return null;
    if (s.cpCta === "whatsapp" && !clean(s.cpWhatsapp)) return "İndirim/Kampanya: WhatsApp numarası girilmemiş.";
    if (s.cpCta === "link" && !clean(s.cpLink)) return "İndirim/Kampanya: düğme bağlantısı girilmemiş.";
    const end = endOf(s); if (end && end.getTime() <= Date.now()) return "İndirim/Kampanya: bitiş tarihi geçmiş.";
    return null;
  }

  global.SeozModuleRegistry.registerModule({
    id: "campaign",
    label: "İndirim / Kampanya",
    defaultSettings: DEFAULTS,
    defaultLayerSize: { w: 360, h: 260 },
    autoHeight: true,
    settingsSchema: SETTINGS_SCHEMA,
    render: render,
    validate: validate
  });
})(window);
