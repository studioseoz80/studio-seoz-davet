/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — modules/qrcode.js  (YENİ MODÜL — QR KOD OLUŞTURUCU)
   -----------------------------------------------------------------------------
   Herhangi bir bağlantı için (web sitesi, PDF katalog, Google Form, konum,
   menü, sosyal medya vb.) tamamen tarayıcı tarafında üretilen, harici API
   veya üyelik GEREKTİRMEYEN bir QR kod modülü. Anket, RSVP, Konum, Müzik,
   Anı Yükle, Galeri modüllerinden TAMAMEN BAĞIMSIZDIR — hiçbirine bağlı
   değildir, hiçbirinin ayarlarını kullanmaz. QR kodun bağlantısı kendi
   ayrı "qrUrl" alanında tutulur.

   Diğer modüller GİBİ kendi kendini registerModule() ile tanıtır. SVG
   olarak render edilir (piksel tabanlı <canvas> değil) — bu sayede
   sürükle-bırak ile boyutlandırıldığında görsel KESİNLİKLE bulanıklaşmaz/
   pikselleşmez, her zaman keskin kalır.
   ========================================================================= */

(function (global) {
  "use strict";

  const DEFAULTS = {
    title: "",
    qrUrl: "",
    caption: "",
    fgColor: "#1E2A22",
    bgColor: "#FFFFFF",
    titleColor: "#1E2A22",
    captionColor: "#5C5A4E",
    fontFamily: "Manrope"
  };

  const SETTINGS_SCHEMA = [
    { key: "title", type: "text", label: "Başlık (isteğe bağlı)" },
    { key: "qrUrl", type: "url", label: "QR Koduna Dönüştürülecek Bağlantı / URL" },
    { key: "caption", type: "text", label: "QR Kodun Altındaki Açıklama (isteğe bağlı)" },
    { key: "fgColor", type: "color", label: "QR Kod Rengi" },
    { key: "bgColor", type: "color", label: "Zemin Rengi" },
    { key: "titleColor", type: "color", label: "Başlık Rengi" },
    { key: "captionColor", type: "color", label: "Açıklama Rengi" },
    { key: "fontFamily", type: "font-select", label: "Font" }
  ];

  function render(settings, mode, ctx) {
    const s = Object.assign({}, DEFAULTS, settings);

    const wrap = document.createElement("div");
    wrap.style.width = "100%";
    wrap.style.height = "100%";
    wrap.style.display = "flex";
    wrap.style.flexDirection = "column";
    wrap.style.alignItems = "center";
    wrap.style.justifyContent = "center";
    wrap.style.gap = "6px";
    wrap.style.fontFamily = `"${s.fontFamily}", sans-serif`;
    wrap.style.boxSizing = "border-box";

    if (s.title) {
      const titleEl = document.createElement("div");
      titleEl.textContent = s.title;
      titleEl.style.color = s.titleColor;
      titleEl.style.fontFamily = "'Cormorant Garamond', serif";
      titleEl.style.fontSize = "15px";
      titleEl.style.fontWeight = "600";
      titleEl.style.textAlign = "center";
      wrap.appendChild(titleEl);
    }

    const qrHost = document.createElement("div");
    qrHost.style.width = "100%";
    qrHost.style.flex = "1 1 auto";
    qrHost.style.minHeight = "0";
    qrHost.style.display = "flex";
    qrHost.style.alignItems = "center";
    qrHost.style.justifyContent = "center";

    if (!s.qrUrl) {
      // Bağlantı henüz girilmemiş — editörde bunu gösteren yumuşak bir
      // yer tutucu var; yayında (mode==="view") bu durumda hiçbir şey
      // görünmez (kırık/boş bir QR gösterilmez).
      if (mode === "edit") {
        const placeholder = document.createElement("div");
        placeholder.textContent = "QR Kod — bağlantı girilmedi";
        Object.assign(placeholder.style, {
          fontSize: "11px", color: "#9a9a90", textAlign: "center",
          border: "1px dashed #ccc", borderRadius: "6px", padding: "16px"
        });
        qrHost.appendChild(placeholder);
      }
    } else {
      const matrixResult = global.SeozQREncoder.generateMatrix(s.qrUrl);
      if (!matrixResult) {
        const errorEl = document.createElement("div");
        errorEl.textContent = "Bağlantı çok uzun — QR koda dönüştürülemedi.";
        Object.assign(errorEl.style, { fontSize: "11px", color: "#b3452c", textAlign: "center" });
        qrHost.appendChild(errorEl);
      } else {
        const { size, modules } = matrixResult;
        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
        svg.style.width = "100%";
        svg.style.height = "100%";
        svg.style.maxWidth = "100%";
        svg.style.maxHeight = "100%";
        svg.style.display = "block";

        const bg = document.createElementNS(svgNS, "rect");
        bg.setAttribute("x", "0"); bg.setAttribute("y", "0");
        bg.setAttribute("width", String(size)); bg.setAttribute("height", String(size));
        bg.setAttribute("fill", s.bgColor);
        svg.appendChild(bg);

        // Her koyu modülü tek tek çizmek yerine, performans için tüm
        // koyu hücreleri TEK bir <path> olarak birleştiriyoruz.
        let d = "";
        for (let r = 0; r < size; r++) {
          for (let c = 0; c < size; c++) {
            if (modules[r][c]) d += `M${c},${r}h1v1h-1z`;
          }
        }
        const path = document.createElementNS(svgNS, "path");
        path.setAttribute("d", d);
        path.setAttribute("fill", s.fgColor);
        svg.appendChild(path);

        qrHost.appendChild(svg);
      }
    }
    wrap.appendChild(qrHost);

    if (s.caption) {
      const captionEl = document.createElement("div");
      captionEl.textContent = s.caption;
      captionEl.style.color = s.captionColor;
      captionEl.style.fontSize = "11px";
      captionEl.style.textAlign = "center";
      wrap.appendChild(captionEl);
    }

    return wrap;
  }

  global.SeozModuleRegistry.registerModule({
    id: "qrcode",
    label: "QR Kod",
    defaultSettings: DEFAULTS,
    defaultLayerSize: { w: 180, h: 200 },
    settingsSchema: SETTINGS_SCHEMA,
    render: render,
    validate: (s) => (!s.qrUrl ? "QR Kod: bağlantı/URL girilmemiş." : null)
  });
})(window);
