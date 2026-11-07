/* =============================================================================
   STUDIO SEOZ — panel/panel-export.js  (MÜŞTERİ PANELİ — DIŞA AKTARMA)
   -----------------------------------------------------------------------------
   Excel'in doğrudan açabildiği CSV üretir. Dış kütüphane YOK.
   - Türkçe Excel için ayırıcı ";", İngilizce (ABD) Excel için "," (panel dili
     İngilizceyse); dosya başında UTF-8 BOM (ş, ğ, ı bozulmaz).
   - Güvenlik: "=", "+", "-", "@" ile başlayan hücrelerin başına ' eklenir
     (Excel formül enjeksiyonuna karşı — misafir metinleri dışarıdan gelir).
   Yazdırma/PDF için tarayıcının kendi "Yazdır → PDF olarak kaydet" özelliği
   kullanılır (bkz. css/panel.css @media print).
   ========================================================================= */

(function (global) {
  "use strict";

  function cell(v) {
    let s = v == null ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    if (/[";,\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  const sep = () => (global.SeozPanelI18n && global.SeozPanelI18n.lang() === "en" ? "," : ";");
  function toCsv(rows, separator) {
    const d = separator || sep();
    return "\ufeff" + rows.map(r => r.map(cell).join(d)).join("\r\n");
  }

  function download(filename, rows) {
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  const fallback = () => (global.SeozPanelI18n ? global.SeozPanelI18n.t("fileEvent") : "etkinlik");
  function safeName(s) {
    return String(s || fallback()).toLowerCase()
      .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i").replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || fallback();
  }

  global.SeozPanelExport = { toCsv, download, safeName, cell };
})(window);
