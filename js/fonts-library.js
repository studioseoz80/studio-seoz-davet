/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — fonts-library.js
   -----------------------------------------------------------------------------
   Metin panelindeki font listesi buradan otomatik üretilir. Yeni bir font
   eklemek için: 1) Google Fonts bağlantısını css/canvas.css'teki @import
   satırına ekleyin, 2) aşağıdaki listeye bir satır ekleyin.

   FAZ 10: Kütüphane genişletildi — her kategoride artık 5 font var
   (toplam 25). Kategoriler aynı kaldı, yalnızca içerikleri zenginleşti.
   ========================================================================= */

(function (global) {
  "use strict";

  const FONT_CATEGORIES = [
    {
      id: "script",
      label: "Romantik / El Yazısı",
      fonts: ["Alex Brush", "Petit Formal Script", "Dancing Script", "Great Vibes", "Parisienne"]
    },
    {
      id: "serif",
      label: "Zarif Serif",
      fonts: ["Cormorant Garamond", "Playfair Display", "Libre Baskerville", "EB Garamond", "Marcellus"]
    },
    {
      id: "modern",
      label: "Modern",
      fonts: ["Manrope", "Poppins", "Work Sans", "Outfit", "Jost"]
    },
    {
      id: "party",
      label: "Eğlenceli / Parti",
      fonts: ["Pacifico", "Baloo 2", "Fredoka", "Bungee", "Caveat"]
    },
    {
      id: "corporate",
      label: "Kurumsal",
      fonts: ["Inter", "Source Sans 3", "Roboto", "IBM Plex Sans", "Lato"]
    }
  ];

  function allFonts() {
    return FONT_CATEGORIES.flatMap(c => c.fonts);
  }

  global.SeozFonts = { FONT_CATEGORIES, allFonts };
})(window);
