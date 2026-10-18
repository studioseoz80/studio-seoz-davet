/* =============================================================================
   STUDIO SEOZ — modules/hours.js  (YENİ İŞLETME MODÜLÜ — ÇALIŞMA SAATLERİ)
   -----------------------------------------------------------------------------
   Haftalık çalışma saatleri tablosu + canlı durum ("Şu an açık · 19:00'da
   kapanır" / "Şu an kapalı · Yarın 09:00'da açılır"). Bugünün satırı vurgulanır.
   - Saatler Türkiye saatine göre hesaplanır (misafir yurt dışında olsa da).
   - Satır biçimi serbesttir: "09:00 - 19:00", "09:00-12:30, 13:30-19:00",
     "Kapalı" ya da "24 saat". Anlaşılamayan satır olduğu gibi yazılır.
   - Anahtarlar "hr" önekli; diğer modüllerden bağımsızdır.
   ========================================================================= */
(function (global) {
  "use strict";

  const DAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
  const DEFAULTS = {
    moduleActive: true,
    hrTitle: "Çalışma Saatleri",
    hrRows: DAYS.map((d, i) => ({ day: d, hours: i === 6 ? "Kapalı" : i === 5 ? "10:00 - 18:00" : "09:00 - 19:00" })),
    hrShowStatus: true,
    hrNote: "",
    hrCompact: false,
    titleFont: "Cormorant Garamond",
    fontFamily: "Manrope",
    fontSize: 15,
    textColor: "#1E2A22",
    accentColor: "#93703F",
    openColor: "#2E8B57",
    closedColor: "#B3412F"
  };
  const SETTINGS_SCHEMA = [
    { key: "moduleActive", type: "checkbox", label: "Modül aktif (kapalıysa yayında görünmez)" },
    { key: "hrTitle", type: "text", label: "Başlık (boşsa gösterilmez)" },
    { key: "hrRows", type: "item-list", label: "Günler", itemLabel: "Gün", addLabel: "+ Satır Ekle",
      itemFields: [{ key: "day", type: "text", label: "Gün (ör. Pazartesi)" }, { key: "hours", type: "text", label: "Saat (ör. 09:00 - 19:00 · Kapalı · 24 saat)" }] },
    { key: "hrShowStatus", type: "checkbox", label: "“Şu an açık / kapalı” durumunu göster" },
    { key: "hrCompact", type: "checkbox", label: "Sıkı görünüm (aynı saatli ardışık günleri birleştir)" },
    { key: "hrNote", type: "textarea", label: "Alt not (ör. Resmî tatillerde kapalıyız)" },
    { key: "titleFont", type: "font-select", label: "Başlık fontu" },
    { key: "fontFamily", type: "font-select", label: "Yazı fontu" },
    { key: "fontSize", type: "number", label: "Yazı boyutu", unit: "px", min: 10 },
    { key: "textColor", type: "color", label: "Yazı rengi" },
    { key: "accentColor", type: "color", label: "Vurgu rengi (bugün)" },
    { key: "openColor", type: "color", label: "“Açık” rengi" },
    { key: "closedColor", type: "color", label: "“Kapalı” rengi" }
  ];

  const clean = v => String(v == null ? "" : v).trim();
  const lower = v => clean(v).toLocaleLowerCase("tr");
  function el(tag, css, text) { const e = document.createElement(tag); if (css) Object.assign(e.style, css); if (text != null) e.textContent = text; return e; }

  /* "09:00 - 12:30, 13:30-19:00" → [[540, 750], [810, 1140]] (dakika) */
  function parse(hours) {
    const h = lower(hours);
    if (!h) return null;
    if (/kapal|closed|tatil/.test(h)) return [];
    if (/24\s*saat|7\/24|açık\s*24/.test(h)) return [[0, 1440]];
    const out = [];
    h.split(/[,;\/]|\sve\s/).forEach(part => {
      const m = part.match(/(\d{1,2})[:.](\d{2})\s*[-–—]\s*(\d{1,2})[:.](\d{2})/);
      if (!m) return;
      const a = Number(m[1]) * 60 + Number(m[2]); let b = Number(m[3]) * 60 + Number(m[4]);
      if (b <= a) b += 1440;            // gece yarısını geçen saat (ör. 18:00 - 02:00)
      out.push([a, b]);
    });
    return out.length ? out : null;
  }
  const fmt = mins => { mins = ((mins % 1440) + 1440) % 1440; return String(Math.floor(mins / 60)).padStart(2, "0") + ":" + String(mins % 60).padStart(2, "0"); };
  function dayIndex(name) {
    const n = lower(name);
    const keys = ["pazartesi", "salı", "çarşamba", "perşembe", "cuma", "cumartesi", "pazar"];
    let i = keys.findIndex(k => n === k);
    if (i < 0) i = keys.findIndex(k => n.startsWith(k.slice(0, 3)) && !(k === "cuma" && n.startsWith("cumartesi")) && !(k === "pazar" && n.startsWith("pazartesi")));
    return i;
  }
  /* Türkiye saatiyle şimdi: { day: 0=Pazartesi … 6=Pazar, min } */
  function nowTR(date) {
    const d = date || new Date();
    try {
      const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Istanbul", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
      const g = t => (parts.find(p => p.type === t) || {}).value;
      const wd = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(g("weekday"));
      return { day: wd < 0 ? (d.getDay() + 6) % 7 : wd, min: (Number(g("hour")) % 24) * 60 + Number(g("minute")) };
    } catch (e) { return { day: (d.getDay() + 6) % 7, min: d.getHours() * 60 + d.getMinutes() }; }
  }
  /* Haftalık tabloya göre durum metni */
  function status(rows, now) {
    const week = Array.from({ length: 7 }, () => null);
    rows.forEach(r => { const i = dayIndex(r.day); if (i >= 0) week[i] = parse(r.hours); });
    if (week.every(w => w == null)) return null;
    const known = d => week[(d + 7) % 7] || [];
    // dünden taşan aralık (gece yarısını geçen)
    for (const [a, b] of known(now.day - 1)) if (b > 1440 && now.min < b - 1440) return { open: true, text: `Şu an açık · ${fmt(b)}'da kapanır` };
    for (const [a, b] of known(now.day)) {
      if (now.min >= a && now.min < b) return { open: true, text: b >= 1440 && a === 0 && b === 1440 ? "Şu an açık · 24 saat" : `Şu an açık · ${fmt(b)}'da kapanır` };
    }
    for (const [a] of known(now.day).slice().sort((x, y) => x[0] - y[0])) if (a > now.min) return { open: false, text: `Şu an kapalı · Bugün ${fmt(a)}'da açılır` };
    for (let k = 1; k <= 7; k++) {
      const list = known(now.day + k).slice().sort((x, y) => x[0] - y[0]);
      if (list.length) return { open: false, text: `Şu an kapalı · ${k === 1 ? "Yarın" : DAYS[(now.day + k) % 7]} ${fmt(list[0][0])}'da açılır` };
    }
    return { open: false, text: "Şu an kapalı" };
  }
  function compact(rows) {
    const out = [];
    rows.forEach(r => {
      const last = out[out.length - 1];
      if (last && lower(last.hours) === lower(r.hours) && dayIndex(r.day) === dayIndex(last.dayEnd || last.day) + 1) { last.dayEnd = r.day; }
      else out.push({ day: r.day, hours: r.hours });
    });
    return out.map(r => ({ day: r.dayEnd ? `${r.day} – ${r.dayEnd}` : r.day, hours: r.hours, from: r.day, to: r.dayEnd || r.day }));
  }
  function placeholder(text) {
    return el("div", { border: "1px dashed rgba(0,0,0,.25)", borderRadius: "8px", padding: "12px", textAlign: "center", fontFamily: "'Manrope', sans-serif", fontSize: "12px", color: "#8A8578", background: "rgba(255,255,255,.5)" }, text);
  }

  function render(settings, mode) {
    const s = Object.assign({}, DEFAULTS, settings);
    const rows = (Array.isArray(s.hrRows) ? s.hrRows : []).filter(r => r && (clean(r.day) || clean(r.hours)));
    if (!s.moduleActive) return mode === "edit" ? placeholder("Çalışma Saatleri — PASİF (yayında görünmez)") : el("div", { height: "0", overflow: "hidden" });
    if (!rows.length) return mode === "edit" ? placeholder("Çalışma Saatleri — henüz gün girilmedi") : el("div", { height: "0", overflow: "hidden" });
    const fs = Math.max(10, Number(s.fontSize) || 15);
    const wrap = el("div", { width: "100%", boxSizing: "border-box", color: s.textColor, fontFamily: `"${s.fontFamily}", sans-serif`, fontSize: fs + "px", padding: "4px 0" });
    wrap.className = "seoz-hours";
    if (clean(s.hrTitle)) wrap.appendChild(el("div", { fontFamily: `"${s.titleFont}", serif`, fontSize: "24px", fontWeight: "600", textAlign: "center", lineHeight: "1.2", marginBottom: "8px" }, s.hrTitle));
    const badge = el("div", { display: "flex", justifyContent: "center", margin: "0 0 10px" });
    const pill = el("span", { display: "inline-flex", alignItems: "center", gap: "8px", padding: "6px 12px", borderRadius: "999px", fontSize: Math.max(11, fs - 2) + "px", fontWeight: "700", background: "rgba(0,0,0,.04)" });
    badge.appendChild(pill);
    if (s.hrShowStatus) wrap.appendChild(badge);
    const list = el("div");
    const shown = s.hrCompact ? compact(rows) : rows.map(r => ({ day: r.day, hours: r.hours, from: r.day, to: r.day }));
    const rowEls = shown.map(r => {
      const row = el("div", { display: "flex", alignItems: "baseline", gap: "10px", padding: "6px 10px", borderRadius: "8px", lineHeight: "1.35" });
      row.appendChild(el("span", { flex: "1 1 auto", minWidth: "0" }, clean(r.day)));
      const isClosed = Array.isArray(parse(r.hours)) && !parse(r.hours).length;
      row.appendChild(el("span", { fontWeight: "700", whiteSpace: "nowrap", color: isClosed ? s.closedColor : "inherit" }, clean(r.hours)));
      list.appendChild(row);
      return { row, r };
    });
    wrap.appendChild(list);
    if (clean(s.hrNote)) wrap.appendChild(el("div", { fontSize: Math.max(10, fs - 3) + "px", opacity: ".7", textAlign: "center", marginTop: "10px", whiteSpace: "pre-wrap" }, s.hrNote));

    function tick() {
      const now = nowTR();
      rowEls.forEach(({ row, r }) => {
        const a = dayIndex(r.from), b = dayIndex(r.to);
        const today = a >= 0 && (now.day === a || (b >= a && now.day >= a && now.day <= b));
        row.style.background = today ? "rgba(0,0,0,.045)" : "transparent";
        row.style.boxShadow = today ? `inset 3px 0 0 ${s.accentColor}` : "none";
      });
      if (!s.hrShowStatus) return;
      const st = status(rows, now);
      if (!st) { badge.style.display = "none"; return; }
      badge.style.display = "flex";
      pill.innerHTML = "";
      const dot = el("i", { width: "8px", height: "8px", borderRadius: "50%", background: st.open ? s.openColor : s.closedColor, boxShadow: `0 0 0 3px ${st.open ? s.openColor : s.closedColor}33` });
      pill.appendChild(dot); pill.appendChild(el("span", { color: st.open ? s.openColor : s.closedColor }, st.text));
    }
    tick();
    wrap.dataset.intervalId = String(setInterval(tick, 30000));
    return wrap;
  }

  global.SeozModuleRegistry.registerModule({
    id: "hours",
    label: "Çalışma Saatleri",
    defaultSettings: DEFAULTS,
    defaultLayerSize: { w: 340, h: 320 },
    autoHeight: true,
    settingsSchema: SETTINGS_SCHEMA,
    render: render,
    validate: (s) => { s = Object.assign({}, DEFAULTS, s); if (!s.moduleActive) return null; return (s.hrRows || []).some(r => r && clean(r.hours)) ? null : "Çalışma Saatleri: hiç saat girilmemiş."; }
  });
  global.SeozHours = { parse, status, nowTR, dayIndex };
})(window);
