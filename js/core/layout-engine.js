/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — layout-engine.js
   -----------------------------------------------------------------------------
   İki iş yapar:
   1) ÖLÇEK: canvas.baseWidth (örn. 430px) ile gerçek ekran/konteyner
      genişliğini karşılaştırıp CSS transform: scale(...) için çarpanı
      hesaplar. Editör de yayın sayfası da AYNI fonksiyonu kullanır —
      bu yüzden "editörde güzel, yayında kaymış" problemi oluşmaz.
   2) OTOMATİK YÜKSEKLİK: En alttaki görünür katmanın alt kenarına göre
      canvas'ın (dolayısıyla sayfanın) yüksekliğini hesaplar. Bir öğeyi
      aşağı taşırsanız sayfa uzar, yukarı alırsanız kısalır.
   ========================================================================= */

(function (global) {
  "use strict";

  function computeScale(containerWidthPx, baseWidth) {
    if (!containerWidthPx || !baseWidth) return 1;
    return containerWidthPx / baseWidth;
  }

  function applyScale(canvasEl, wrapperEl, baseWidth) {
    const containerWidth = wrapperEl.clientWidth;
    const scale = computeScale(containerWidth, baseWidth);
    canvasEl.style.transform = `scale(${scale})`;
    canvasEl.style.transformOrigin = "top left";
    // Sarmalayıcının yüksekliği, ölçeklenmiş canvas'ın gerçek yüksekliğine
    // eşitlenir — böylece sayfa akışı (scroll) doğru çalışır, canvas'ın
    // altında/üstünde boşluk kalmaz.
    wrapperEl.style.height = (canvasEl.offsetHeight * scale) + "px";
    return scale;
  }

  /* En alttaki katmanın alt kenarına göre canvas yüksekliğini hesaplar.
     DOM'a render edildikten SONRA çağrılmalıdır (metin auto-height'ı
     gerçek satır sayısına göre ölçmek için). */
  function recalcCanvasHeight(canvasEl, minHeight) {
    let maxBottom = 0;
    canvasEl.querySelectorAll("[data-layer-id]").forEach(el => {
      const bottom = el.offsetTop + el.offsetHeight;
      if (bottom > maxBottom) maxBottom = bottom;
    });
    const BOTTOM_PADDING = 48;
    const finalHeight = Math.max(minHeight || 0, maxBottom + BOTTOM_PADDING);
    canvasEl.style.height = finalHeight + "px";
    return finalHeight;
  }

  global.SeozLayoutEngine = {
    computeScale,
    applyScale,
    recalcCanvasHeight
  };
})(window);
