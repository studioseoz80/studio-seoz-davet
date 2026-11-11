/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — modules/countdown.js
   Geri sayım modülü: Gün/Saat/Dakika/Saniye kutuları. Kendi setInterval'ını
   kurar ve elementin data-interval-id özelliğine kaydeder — renderer.js bu
   sayede katman yeniden çizildiğinde (veya ayarlar değiştiğinde) eski
   sayacı temizleyip bellek sızıntısını önler (bkz. SeozRenderer.clearIntervalsWithin).
   ========================================================================= */

(function (global) {
  "use strict";

  const DEFAULTS = {
    targetDate: "",
    targetTime: "00:00",
    title: "Geri Sayım",
    fontFamily: "Cormorant Garamond",
    titleSize: 18,
    numberSize: 26,
    textColor: "#1E2A22",
    boxColor: "#FFFFFF",
    boxBorderColor: "#DCD5C6",
    // GÜÇLENDİRME: başlık ve rakamlar için metalik yazı (varsayılan kapalı)
    metallic: "none"
  };

  /* SAAT DİLİMİ: geri sayım, ziyaretçinin ülkesine göre değil ETKİNLİĞİN saat dilimine göre
     hesaplanır. Yaz/kış saati, tarayıcının IANA saat dilimi bilgisiyle otomatik bulunur
     (sabit UTC farkı yok). Yeni eklenen Geri Sayım'da varsayılan Türkiye'dir.
     ESKİ davetiyelerde bu alan yoktur: onlar eskisi gibi ziyaretçinin yerel saatine göre sayar
     (kayıt ve davranış değişmez). */
  const TIMEZONES = [
    { value: "Europe/Istanbul", label: "🇹🇷 Türkiye – Europe/Istanbul" },
    { value: "America/New_York", label: "🇺🇸 Amerika / New York (Doğu) – America/New_York" },
    { value: "America/Chicago", label: "🇺🇸 Amerika / Chicago (Orta) – America/Chicago" },
    { value: "America/Los_Angeles", label: "🇺🇸 Amerika / Los Angeles (Batı) – America/Los_Angeles" },
    { value: "Europe/Berlin", label: "🇩🇪 Almanya – Europe/Berlin" },
    { value: "Europe/Amsterdam", label: "🇳🇱 Hollanda – Europe/Amsterdam" },
    { value: "Europe/Brussels", label: "🇧🇪 Belçika – Europe/Brussels" }
  ];
  const NEW_LAYER_TIMEZONE = "Europe/Istanbul";

  const SETTINGS_SCHEMA = [
    { key: "targetDate", type: "date", label: "Tarih" },
    { key: "targetTime", type: "time", label: "Saat" },
    { key: "timezone", type: "select", label: "Saat Dilimi", options: TIMEZONES, showIf: s => !!s.timezone, reRenderPanel: true },
    // Eski davetiye (alan yok): mevcut davranış seçenek olarak görünür; bir dilim seçilince yukarıdaki liste gelir.
    { key: "timezone", type: "select", label: "Saat Dilimi", showIf: s => !s.timezone, reRenderPanel: true,
      options: [{ value: "", label: "Ziyaretçinin kendi saati (eski davetiye — değiştirilmedi)" }].concat(TIMEZONES) },
    { key: "title", type: "text", label: "Başlık" },
    { key: "fontFamily", type: "font-select", label: "Font" },
    { key: "titleSize", type: "number", label: "Başlık Boyutu", unit: "px" },
    { key: "numberSize", type: "number", label: "Rakam Boyutu", unit: "px" },
    { key: "textColor", type: "color", label: "Yazı Rengi" },
    { key: "boxColor", type: "color", label: "Kutu Rengi" },
    { key: "boxBorderColor", type: "color", label: "Kutu Kenarlık Rengi" },
    {
      key: "metallic", type: "select", label: "Yazı Metalik Efekti (başlık ve rakamlar)",
      options: [{ value: "none", label: "Yok" }, { value: "gold", label: "Altın (Koyu Zemin)" }, { value: "silver", label: "Gümüş (Koyu Zemin)" }, { value: "copper-gold", label: "Bakır Altın (Açık Zemin)" }, { value: "dark-silver", label: "Koyu Gümüş (Açık Zemin)" }, { value: "copper", label: "Bakır" }]
    }
  ];

  const UNITS = [["gun", "Gün"], ["saat", "Saat"], ["dakika", "Dk"], ["saniye", "Sn"]];

  /* Verilen saat diliminin, verilen UTC anındaki farkı (dakika) — Intl/IANA (yaz-kış saati dahil). */
  function tzOffsetMinutes(utcMs, timeZone) {
    const fmt = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const p = {};
    fmt.formatToParts(new Date(utcMs)).forEach(x => { p[x.type] = x.value; });
    return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - utcMs) / 60000);
  }
  /* Geri sayımın hedef anı (UTC ms). timezone varsa: girilen tarih/saat O DİLİMDE duvar saati kabul
     edilir → herkes için aynı an. Yoksa (eski davetiye): eskisi gibi ziyaretçinin yerel saati. */
  function targetMs(s) {
    const dateStr = s.targetDate || "2030-01-01";
    const timeStr = s.targetTime || "00:00";
    const local = new Date(dateStr + "T" + timeStr + ":00").getTime();
    if (!s.timezone) return local;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr), t = /^(\d{1,2}):(\d{2})/.exec(timeStr);
    if (!m || !t) return local;
    try {
      const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +t[1], +t[2], 0);
      const off = tzOffsetMinutes(wall, s.timezone);
      let utc = wall - off * 60000;
      const off2 = tzOffsetMinutes(utc, s.timezone);       // yaz/kış saati geçiş günü için ikinci geçiş
      if (off2 !== off) utc = wall - off2 * 60000;
      return utc;
    } catch (e) { return local; }                          // tanınmayan dilim: eski davranış
  }

  function render(settings, mode) {
    const s = Object.assign({}, DEFAULTS, settings);
    const wrap = document.createElement("div");
    wrap.style.width = "100%";
    wrap.style.height = "100%";
    wrap.style.display = "flex";
    wrap.style.flexDirection = "column";
    wrap.style.alignItems = "center";
    wrap.style.justifyContent = "center";
    wrap.style.gap = "10px";

    if (s.title) {
      const titleEl = document.createElement("div");
      titleEl.textContent = s.title;
      titleEl.style.fontFamily = `"${s.fontFamily}", serif`;
      titleEl.style.fontSize = s.titleSize + "px";
      titleEl.style.color = s.textColor;
      if (global.SeozRenderer && global.SeozRenderer.applyMetallicText) global.SeozRenderer.applyMetallicText(titleEl, s.metallic, s.textColor);
      wrap.appendChild(titleEl);
    }

    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.gap = "8px";

    const numberEls = {};
    UNITS.forEach(([key, label]) => {
      const box = document.createElement("div");
      Object.assign(box.style, {
        background: s.boxColor,
        border: `1px solid ${s.boxBorderColor}`,
        borderRadius: "4px",
        padding: "8px 10px",
        minWidth: "46px",
        textAlign: "center"
      });

      const num = document.createElement("div");
      num.textContent = "00";
      num.style.fontFamily = `"${s.fontFamily}", serif`;
      num.style.fontSize = s.numberSize + "px";
      num.style.fontWeight = "600";
      num.style.color = s.textColor;
      if (global.SeozRenderer && global.SeozRenderer.applyMetallicText) global.SeozRenderer.applyMetallicText(num, s.metallic, s.textColor);
      box.appendChild(num);
      numberEls[key] = num;

      const lbl = document.createElement("div");
      lbl.textContent = global.SeozInviteI18n ? global.SeozInviteI18n.L(label) : label;   // davetiye dili (Gün → Days)
      lbl.style.fontFamily = "'Manrope', sans-serif";
      lbl.style.fontSize = "10px";
      lbl.style.color = s.textColor;
      lbl.style.opacity = ".7";
      box.appendChild(lbl);

      row.appendChild(box);
    });
    wrap.appendChild(row);

    function tick() {
      let diff = Math.max(0, targetMs(s) - Date.now());
      const day = Math.floor(diff / 86400000); diff -= day * 86400000;
      const hour = Math.floor(diff / 3600000); diff -= hour * 3600000;
      const min = Math.floor(diff / 60000); diff -= min * 60000;
      const sec = Math.floor(diff / 1000);
      numberEls.gun.textContent = String(day).padStart(2, "0");
      numberEls.saat.textContent = String(hour).padStart(2, "0");
      numberEls.dakika.textContent = String(min).padStart(2, "0");
      numberEls.saniye.textContent = String(sec).padStart(2, "0");
    }

    tick();
    const intervalId = setInterval(tick, 1000);
    wrap.dataset.intervalId = String(intervalId);

    return wrap;
  }

  global.SeozModuleRegistry.registerModule({
    id: "countdown",
    label: "Geri Sayım",
    // Yeni eklenen Geri Sayım: Türkiye saat dilimiyle kaydedilir (eski kayıtlara dokunulmaz).
    defaultSettings: Object.assign({}, DEFAULTS, { timezone: NEW_LAYER_TIMEZONE }),
    defaultLayerSize: { w: 300, h: 130 },
    settingsSchema: SETTINGS_SCHEMA,
    render: render,
    validate: (s) => (!s.targetDate ? "Geri Sayım: tarih seçilmemiş." : null)
  });
  global.SeozCountdown = { targetMs, TIMEZONES };   // tema sunumları (theme-present.js) aynı hesabı kullanır
})(window);
