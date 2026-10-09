/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — fonts-library.js
   -----------------------------------------------------------------------------
   Metin panelindeki font listesi buradan otomatik üretilir. Yeni bir font
   eklemek için: 1) Google Fonts bağlantısını css/canvas.css'teki @import
   satırına ekleyin, 2) aşağıdaki listeye bir satır ekleyin.

   FAZ 10: Kütüphane genişletildi — her kategoride artık 5 font var
   (toplam 25). Kategoriler aynı kaldı, yalnızca içerikleri zenginleşti.

   GÜÇLENDİRME: Mevcut 25 font aynen korundu, Türkçe harf desteği
   doğrulanmış 38 yeni font ve "Lüks / Başlık", "Minimal", "Eğitim / Okul"
   kategorileri eklendi. "Son Kullanılan Fontlar" desteği eklendi.
   ========================================================================= */

(function (global) {
  "use strict";

  const FONT_CATEGORIES = [
    {
      id: "script",
      label: "Romantik / El Yazısı",
      fonts: ["Alex Brush", "Petit Formal Script", "Dancing Script", "Great Vibes", "Parisienne",
              "Allura", "Pinyon Script", "Imperial Script", "Corinthia", "Italianno", "Sacramento"]
    },
    {
      id: "serif",
      label: "Zarif Serif",
      fonts: ["Cormorant Garamond", "Playfair Display", "Libre Baskerville", "EB Garamond", "Marcellus",
              "Cormorant", "Lora", "Gilda Display", "Bellefair", "Crimson Text", "Spectral", "DM Serif Display"]
    },
    {
      id: "luxury",
      label: "Lüks / Başlık",
      fonts: ["Cinzel", "Cinzel Decorative", "Bodoni Moda", "Playfair Display SC", "Marcellus SC", "Yeseva One", "Forum"]
    },
    {
      id: "modern",
      label: "Modern",
      fonts: ["Manrope", "Poppins", "Work Sans", "Outfit", "Jost",
              "Montserrat", "Raleway", "DM Sans", "Plus Jakarta Sans", "Urbanist", "Figtree", "Josefin Sans"]
    },
    {
      id: "minimal",
      label: "Minimal",
      fonts: ["Tenor Sans", "Albert Sans", "Red Hat Display", "Sora", "Nunito Sans"]
    },
    {
      id: "party",
      label: "Eğlenceli / Parti",
      fonts: ["Pacifico", "Baloo 2", "Fredoka", "Bungee", "Caveat", "Comfortaa"]
    },
    {
      id: "education",
      label: "Eğitim / Okul",
      fonts: ["Nunito", "Quicksand", "Lexend", "Patrick Hand", "Kalam"]
    },
    {
      id: "corporate",
      label: "Kurumsal",
      fonts: ["Inter", "Source Sans 3", "Roboto", "IBM Plex Sans", "Lato"]
    }
  ];

  /* TÜRKÇE KONTROLÜ: Listedeki her font, Google Fonts kaynak dosyasında
     ç Ç ğ Ğ ı İ ö Ö ş Ş ü Ü harflerinin varlığına bakılarak doğrulandı.
     Yeni eklenen fontların TAMAMI eksiksiz. Daha önceden listede olan
     aşağıdaki font(lar)da bazı Türkçe harfler EKSİK — mevcut tasarımlar
     bozulmasın diye silinmedi, seçicide uyarıyla gösterilir. */
  const TURKISH_INCOMPLETE = { "Fredoka": "ğ Ğ İ ş Ş yok" };

  function allFonts() {
    return FONT_CATEGORIES.flatMap(c => c.fonts);
  }

  /* SON KULLANILAN FONTLAR — yalnızca bu tarayıcıda, kolaylık için.
     Depolama kullanılamazsa (gizli pencere vb.) sessizce boş liste. */
  const RECENT_KEY = "seoz_editor_recent_fonts_v1";
  const RECENT_MAX = 6;

  function getRecentFonts() {
    try {
      const list = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
      const known = new Set(allFonts());
      return Array.isArray(list) ? list.filter(f => known.has(f)).slice(0, RECENT_MAX) : [];
    } catch (e) { return []; }
  }

  function markFontUsed(font) {
    if (!font) return;
    try {
      const list = getRecentFonts().filter(f => f !== font);
      list.unshift(font);
      localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX)));
    } catch (e) { /* yok say */ }
  }

  function escapeAttr(str) {
    return String(str || "").replace(/[&<>"']/g, s => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[s]);
  }

  // Font <select>'i için seçenekler: üstte "Son Kullanılanlar", sonra
  // kategoriler. Seçili font listede yoksa (eski belge) yine korunur.
  function optionsHTML(selected) {
    const label = f => escapeAttr(f) + (TURKISH_INCOMPLETE[f] ? ` ⚠ (${TURKISH_INCOMPLETE[f]})` : "");
    const opt = f => `<option value="${escapeAttr(f)}" ${f === selected ? "selected" : ""}>${label(f)}</option>`;
    const recent = getRecentFonts();
    let html = "";
    if (recent.length) {
      // Aynı font iki kez "selected" olmasın diye son kullanılanlarda
      // seçili işareti yalnızca burada verilir.
      html += `<optgroup label="★ Son Kullanılanlar">${recent.map(opt).join("")}</optgroup>`;
    }
    const inRecent = new Set(recent);
    html += FONT_CATEGORIES.map(cat => `<optgroup label="${escapeAttr(cat.label)}">${
      cat.fonts.map(f => `<option value="${escapeAttr(f)}" ${f === selected && !inRecent.has(f) ? "selected" : ""}>${label(f)}</option>`).join("")
    }</optgroup>`).join("");
    if (selected && !allFonts().includes(selected)) {
      html = `<option value="${escapeAttr(selected)}" selected>${escapeAttr(selected)}</option>` + html;
    }
    return html;
  }

  global.SeozFonts = { FONT_CATEGORIES, TURKISH_INCOMPLETE, allFonts, getRecentFonts, markFontUsed, optionsHTML };
})(window);
