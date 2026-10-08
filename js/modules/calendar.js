/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — modules/calendar.js  (YENİ MODÜL — TAKVİME EKLE)
   -----------------------------------------------------------------------------
   Misafirin etkinliği kendi telefonunun takvimine eklemesini sağlar.
   "Takvime Ekle" butonuna basılınca küçük bir alt seçim alanı açılır:
     1) Google Takvim            → takvim şablon bağlantısı yeni sekmede açılır
                                   (internet YALNIZCA bu tıklamada gerekir)
     2) Apple / Diğer Takvimler  → tarayıcıda Blob ile standart .ics dosyası
                                   üretilip indirilir (Outlook dahil tüm
                                   takvim uygulamaları açabilir). Sunucu veya
                                   harici kütüphane GEREKTİRMEZ.

   Diğer modüller GİBİ kendi kendini registerModule() ile tanıtır; hiçbir
   modülün ayarlarını okumaz/değiştirmez. Konum, Geri Sayım vb. ile
   TAMAMEN BAĞIMSIZDIR — kendi tarih/saat/konum alanlarını tutar.

   SAAT DİLİMİ: Girilen tarih/saat her zaman "timezone" alanındaki
   (varsayılan Europe/Istanbul) duvar saati olarak yorumlanır — misafirin
   telefonunun saat diliminden ETKİLENMEZ.
     - Google Takvim: saatler dönüştürülmeden gönderilir + ctz parametresi
       (Google bunları doğrudan o saat diliminde yorumlar, kayma olmaz).
     - .ics: saatler bu saat dilimine göre kesin UTC anına çevrilip
       "Z" sonekiyle yazılır — VTIMEZONE bloğu gerektirmeyen, tüm takvim
       uygulamalarının desteklediği en güvenli biçim. Takvim uygulaması
       olayı misafirin kendi yerel saatinde doğru anda gösterir.
   ========================================================================= */

(function (global) {
  "use strict";

  const DEFAULTS = {
    title: "",
    date: "",
    startTime: "",
    endTime: "",
    location: "",
    description: "",
    buttonText: "Takvime Ekle",
    timezone: "Europe/Istanbul",
    // Görünüm alanları — Konum modülünün butonuyla AYNI varsayılanlar ve
    // AYNI paylaşılan metalik gradyanlar (renderer.js METALLIC_GRADIENTS).
    fontFamily: "Manrope",
    fontSize: 15,
    textColor: "#FFFFFF",
    bgColor: "#93703F",
    metallic: "none",
    buttonWidth: 200,
    buttonHeight: 46,
    borderRadius: 24
  };

  const SETTINGS_SCHEMA = [
    { key: "title", type: "text", label: "Etkinlik Adı" },
    { key: "date", type: "date", label: "Tarih" },
    { key: "startTime", type: "time", label: "Başlangıç Saati" },
    { key: "endTime", type: "time", label: "Bitiş Saati (boşsa +2 saat)" },
    { key: "location", type: "text", label: "Mekân / Konum" },
    { key: "description", type: "textarea", label: "Açıklama" },
    { key: "buttonText", type: "text", label: "Buton Yazısı" },
    {
      key: "timezone", type: "select", label: "Saat Dilimi",
      options: [
        { value: "Europe/Istanbul", label: "Türkiye (İstanbul)" },
        { value: "Europe/Berlin", label: "Almanya / Orta Avrupa" },
        { value: "Europe/London", label: "İngiltere" },
        { value: "Europe/Amsterdam", label: "Hollanda / Belçika" }
      ]
    },
    { key: "fontFamily", type: "font-select", label: "Buton Fontu" },
    { key: "fontSize", type: "number", label: "Buton Yazı Boyutu", unit: "px" },
    { key: "textColor", type: "color", label: "Buton Yazı Rengi" },
    { key: "bgColor", type: "color", label: "Buton Arka Plan Rengi" },
    {
      key: "metallic", type: "select", label: "Buton Metalik Efekti",
      options: [{ value: "none", label: "Yok" }, { value: "gold", label: "Altın (Koyu Zemin)" }, { value: "silver", label: "Gümüş (Koyu Zemin)" }, { value: "copper-gold", label: "Bakır Altın (Açık Zemin)" }, { value: "dark-silver", label: "Koyu Gümüş (Açık Zemin)" }]
    },
    { key: "buttonWidth", type: "number", label: "Buton Genişliği", unit: "px", min: 60 },
    { key: "buttonHeight", type: "number", label: "Buton Yüksekliği", unit: "px", min: 40 },
    { key: "borderRadius", type: "number", label: "Köşe Yuvarlaklığı", unit: "px", min: 0 }
  ];

  const MIN_TOUCH_PX = 40;          // butonun asla altına inmeyeceği yükseklik
  const DEFAULT_DURATION_MIN = 120; // bitiş saati boşsa +2 saat

  /* ---------------- Tarih / saat yardımcıları ---------------- */

  function pad(n) { return String(n).padStart(2, "0"); }

  function parseDate(str) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str || "");
    return m ? { y: +m[1], mo: +m[2], d: +m[3] } : null;
  }

  function parseTime(str) {
    const m = /^(\d{1,2}):(\d{2})/.exec(str || "");
    if (!m) return null;
    const h = +m[1], mi = +m[2];
    return (h < 24 && mi < 60) ? { h: h, mi: mi } : null;
  }

  /* "Duvar saati" hesabı: tarayıcının kendi saat dilimi hiç karışmasın
     diye tüm aritmetik Date.UTC üzerinde yapılır (yalnızca takvim/saat
     alanlarını taşımak için — gerçek UTC anı DEĞİLDİR). */
  function wall(date, time) {
    return new Date(Date.UTC(date.y, date.mo - 1, date.d, time.h, time.mi, 0));
  }

  function wallParts(dt) {
    return {
      y: dt.getUTCFullYear(), mo: dt.getUTCMonth() + 1, d: dt.getUTCDate(),
      h: dt.getUTCHours(), mi: dt.getUTCMinutes(), s: dt.getUTCSeconds()
    };
  }

  function compact(p) {
    return "" + p.y + pad(p.mo) + pad(p.d) + "T" + pad(p.h) + pad(p.mi) + pad(p.s || 0);
  }

  /* Başlangıç/bitiş duvar saatlerini hesaplar. Bitiş boşsa +2 saat;
     bitiş başlangıçtan önce/eşitse (ör. 21:00 – 02:00) ertesi güne
     taşınır. Eksik tarih/başlangıç varsa null döner. */
  function computeRange(s) {
    const date = parseDate(s.date);
    const start = parseTime(s.startTime);
    if (!date || !start) return null;
    const startWall = wall(date, start);
    const end = parseTime(s.endTime);
    let endWall;
    if (end) {
      endWall = wall(date, end);
      if (endWall.getTime() <= startWall.getTime()) endWall = new Date(endWall.getTime() + 86400000);
    } else {
      endWall = new Date(startWall.getTime() + DEFAULT_DURATION_MIN * 60000);
    }
    return { startWall: startWall, endWall: endWall };
  }

  /* Verilen saat diliminin, verilen UTC anındaki ofseti (dakika).
     Intl yoksa/saat dilimi tanınmazsa Europe/Istanbul için sabit +03:00
     (Türkiye 2016'dan beri yaz saati uygulamıyor) kullanılır. */
  function tzOffsetMinutes(utcMs, timeZone) {
    try {
      const fmt = new Intl.DateTimeFormat("en-US", {
        timeZone: timeZone, hourCycle: "h23",
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit"
      });
      const p = {};
      fmt.formatToParts(new Date(utcMs)).forEach(x => { p[x.type] = x.value; });
      const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
      return Math.round((asUtc - utcMs) / 60000);
    } catch (e) {
      return 180;
    }
  }

  /* Duvar saatini (timeZone'da) gerçek UTC anına çevirir. İki geçişli
     hesap, yaz saati kullanan dilimlerde (Berlin, Londra) de doğru sonuç
     verir. */
  function wallToUtc(wallDate, timeZone) {
    const guess = wallDate.getTime();
    let off = tzOffsetMinutes(guess, timeZone);
    let utc = guess - off * 60000;
    const off2 = tzOffsetMinutes(utc, timeZone);
    if (off2 !== off) utc = guess - off2 * 60000;
    return new Date(utc);
  }

  /* ---------------- Google Takvim ---------------- */

  function buildGoogleUrl(s) {
    const r = computeRange(s);
    if (!r) return null;
    const params = [
      ["action", "TEMPLATE"],
      ["text", s.title || "Etkinlik"],
      ["dates", compact(wallParts(r.startWall)) + "/" + compact(wallParts(r.endWall))],
      ["ctz", s.timezone || DEFAULTS.timezone]
    ];
    if (s.description) params.push(["details", s.description]);
    if (s.location) params.push(["location", s.location]);
    return "https://calendar.google.com/calendar/render?" +
      params.map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");
  }

  /* ---------------- .ics (RFC 5545) ---------------- */

  function icsEscape(str) {
    return String(str || "")
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\r\n|\r|\n/g, "\\n");
  }

  /* RFC 5545: satırlar 75 OKTETİ geçmemeli; devam satırı bir boşlukla
     başlar. UTF-8 bayt sayısına göre katlanır, çok baytlı Türkçe
     karakterler (ş, ğ, İ...) ASLA ortadan bölünmez. */
  const ENC = (typeof TextEncoder !== "undefined") ? new TextEncoder() : null;
  function utf8Len(ch) {
    return ENC ? ENC.encode(ch).length : unescape(encodeURIComponent(ch)).length;
  }

  function foldLine(line) {
    const out = [];
    let cur = "", bytes = 0;
    for (const ch of line) {
      const b = utf8Len(ch);
      const limit = out.length === 0 ? 75 : 74; // devam satırındaki boşluk da sayılır
      if (bytes + b > limit) {
        out.push(cur);
        cur = ""; bytes = 0;
      }
      cur += ch; bytes += b;
    }
    out.push(cur);
    return out.join("\r\n ");
  }

  function utcStamp(d) {
    return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + "T" +
      pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + "Z";
  }

  function makeUid() {
    const rnd = Math.random().toString(36).slice(2, 10);
    return Date.now().toString(36) + "-" + rnd + "@studioseoz";
  }

  function buildIcs(s) {
    const r = computeRange(s);
    if (!r) return null;
    const tz = s.timezone || DEFAULTS.timezone;
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Studio SEOZ//Dijital Davetiye//TR",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      "UID:" + makeUid(),
      "DTSTAMP:" + utcStamp(new Date()),
      "DTSTART:" + utcStamp(wallToUtc(r.startWall, tz)),
      "DTEND:" + utcStamp(wallToUtc(r.endWall, tz)),
      "SUMMARY:" + icsEscape(s.title || "Etkinlik"),
      "DESCRIPTION:" + icsEscape(s.description),
      "LOCATION:" + icsEscape(s.location),
      "END:VEVENT",
      "END:VCALENDAR"
    ];
    return lines.map(foldLine).join("\r\n") + "\r\n";
  }

  function safeFileName(title) {
    const map = { "ç": "c", "ğ": "g", "ı": "i", "ö": "o", "ş": "s", "ü": "u", "Ç": "c", "Ğ": "g", "İ": "i", "Ö": "o", "Ş": "s", "Ü": "u" };
    const slug = String(title || "")
      .replace(/[çğıöşüÇĞİÖŞÜ]/g, c => map[c])
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
    return (slug || "davetiye") + ".ics";
  }

  function downloadIcs(s) {
    const text = buildIcs(s);
    if (!text) return;
    const blob = new Blob([text], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = safeFileName(s.title);
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1500);
  }

  /* ---------------- Görünüm ---------------- */

  function buttonBackground(s) {
    const g = global.SeozRenderer && global.SeozRenderer.METALLIC_GRADIENTS;
    return (g && g[s.metallic]) || s.bgColor;
  }

  /* Seçim alanı document.body'ye eklenir (ölçeklenen canvas'ın İÇİNE
     DEĞİL) — böylece canvas ne kadar küçültülürse küçültülsün dokunma
     alanları gerçek ekran boyutunda kalır, katman sınırlarına taşmaz ve
     sürükle-bırak etkileşimleriyle çakışmaz. Aynı anda tek alan açık kalır. */
  function openSheet(s) {
    const existing = document.querySelector("[data-seoz-calendar-sheet]");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.setAttribute("data-seoz-calendar-sheet", "");
    Object.assign(overlay.style, {
      position: "fixed", inset: "0", zIndex: "500",
      background: "rgba(30,30,26,.45)",
      display: "flex", alignItems: "flex-end", justifyContent: "center"
    });

    const sheet = document.createElement("div");
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-label", s.buttonText || "Takvime Ekle");
    Object.assign(sheet.style, {
      width: "100%", maxWidth: "420px", boxSizing: "border-box",
      background: "#FBF8F2", color: "#1E2A22",
      borderRadius: "16px 16px 0 0",
      padding: "18px 16px calc(16px + env(safe-area-inset-bottom, 0px))",
      display: "flex", flexDirection: "column", gap: "10px",
      fontFamily: `"${s.fontFamily}", 'Manrope', sans-serif`,
      boxShadow: "0 -6px 24px rgba(0,0,0,.18)"
    });

    const heading = document.createElement("div");
    heading.textContent = s.buttonText || "Takvime Ekle";
    Object.assign(heading.style, {
      fontFamily: "'Cormorant Garamond', serif", fontSize: "20px",
      fontWeight: "600", textAlign: "center"
    });
    sheet.appendChild(heading);

    if (s.title) {
      const sub = document.createElement("div");
      sub.textContent = s.title;
      Object.assign(sub.style, { fontSize: "13px", color: "#5C5A4E", textAlign: "center", marginTop: "-4px", overflowWrap: "anywhere" });
      sheet.appendChild(sub);
    }

    function close() {
      overlay.remove();
      document.removeEventListener("keydown", onKey);
    }
    function onKey(e) { if (e.key === "Escape") close(); }

    function optionBtn(label, primary, onClick) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      Object.assign(b.style, {
        width: "100%", minHeight: "48px", boxSizing: "border-box",
        borderRadius: Math.min(s.borderRadius, 24) + "px",
        fontFamily: "inherit", fontSize: "15px", cursor: "pointer",
        border: primary ? "none" : `1.5px solid ${s.bgColor}`,
        background: primary ? buttonBackground(s) : "transparent",
        color: primary ? s.textColor : "#1E2A22",
        padding: "10px 14px"
      });
      b.addEventListener("click", () => { onClick(); close(); });
      return b;
    }

    sheet.appendChild(optionBtn("Google Takvim", true, () => {
      const url = buildGoogleUrl(s);
      if (url) window.open(url, "_blank", "noopener");
    }));
    sheet.appendChild(optionBtn("Apple / Diğer Takvimler", false, () => downloadIcs(s)));

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "Vazgeç";
    Object.assign(cancel.style, {
      background: "none", border: "none", color: "#5C5A4E",
      fontFamily: "inherit", fontSize: "14px", minHeight: "40px", cursor: "pointer"
    });
    cancel.addEventListener("click", close);
    sheet.appendChild(cancel);

    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    document.addEventListener("keydown", onKey);
    overlay.appendChild(sheet);
    document.body.appendChild(overlay);
  }

  function render(settings, mode, ctx) {
    const s = Object.assign({}, DEFAULTS, settings);
    const wrap = document.createElement("div");
    Object.assign(wrap.style, {
      width: "100%", height: "100%", display: "flex",
      alignItems: "center", justifyContent: "center"
    });

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = s.buttonText || "Takvime Ekle";
    // Tarih veya başlangıç saati yoksa buton PASİF (Konum modülüyle aynı
    // davranış) — misafir hiçbir zaman eksik bir etkinlik eklemez.
    const ready = !!computeRange(s);
    Object.assign(btn.style, {
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: s.buttonWidth + "px", maxWidth: "100%",
      height: Math.max(MIN_TOUCH_PX, s.buttonHeight) + "px",
      boxSizing: "border-box", padding: "0 12px",
      borderRadius: s.borderRadius + "px",
      background: buttonBackground(s),
      color: s.textColor,
      fontFamily: `"${s.fontFamily}", sans-serif`,
      fontSize: s.fontSize + "px",
      border: "none",
      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      cursor: ready ? "pointer" : "not-allowed",
      opacity: ready ? "1" : ".45",
      flexShrink: "0"
    });
    if (!ready) btn.disabled = true;
    btn.addEventListener("click", () => {
      // Tıklama anındaki güncel ayarlarla çalışır; yalnızca BU modülün
      // kendi alanları kullanılır.
      if (!computeRange(s)) return;
      openSheet(s);
    });
    wrap.appendChild(btn);
    return wrap;
  }

  global.SeozModuleRegistry.registerModule({
    id: "calendar",
    label: "Takvime Ekle",
    defaultSettings: DEFAULTS,
    defaultLayerSize: { w: 240, h: 70 },
    settingsSchema: SETTINGS_SCHEMA,
    render: render,
    validate: (s) => {
      if (!s.date && !s.startTime) return "Takvime Ekle: tarih ve başlangıç saati girilmemiş.";
      if (!parseDate(s.date)) return "Takvime Ekle: tarih girilmemiş.";
      if (!parseTime(s.startTime)) return "Takvime Ekle: başlangıç saati girilmemiş.";
      return null;
    }
  });

  // Yalnızca test/araç kullanımı içindir — diğer dosyalar buna bağımlı değil.
  global.SeozCalendar = { buildGoogleUrl, buildIcs, computeRange, wallToUtc, icsEscape };
})(window);
