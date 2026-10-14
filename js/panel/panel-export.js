/* =============================================================================
   STUDIO SEOZ — panel/panel-export.js  (MÜŞTERİ PANELİ — DIŞA AKTARMA)
   -----------------------------------------------------------------------------
   Excel'in doğrudan açabildiği CSV üretir. Dış kütüphane YOK.
   - Türkçe Excel için ayırıcı ";" ve dosya başında UTF-8 BOM (ş, ğ, ı bozulmaz).
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
    if (/[";\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function toCsv(rows) {
    return "﻿" + rows.map(r => r.map(cell).join(";")).join("\r\n");
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

  function safeName(s) {
    return String(s || "etkinlik").toLowerCase()
      .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i").replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "etkinlik";
  }

  global.SeozPanelExport = { toCsv, download, safeName, cell };
})(window);
