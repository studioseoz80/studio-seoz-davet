/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — drag-resize.js (yalnızca editör)
   -----------------------------------------------------------------------------
   Katmanları fare/dokunma ile taşıma ve genişlik tutamacıyla yeniden
   boyutlandırma. Ekran pikseli ile canvas pikseli arasındaki farkı
   (ölçek) her zaman opts.getScale() üzerinden hesaba katar — böylece
   canvas ne kadar küçültülmüş/büyütülmüş olursa olsun sürükleme birebir
   doğru çalışır.

   DÜZELTME (Konum modülü butonu tıklanamıyordu): Önceden her
   pointerdown anında e.preventDefault() çağrılıyordu — bu, hareket
   olmasa bile altındaki gerçek tıklamayı (ör. bir bağlantı/buton)
   engelliyordu. Artık bir HAREKET EŞİĞİ (DRAG_THRESHOLD) var: fare/
   parmak bu eşiği aşacak kadar hareket etmeden preventDefault
   ÇAĞRILMIYOR. Böylece:
     - Katmana tıklayıp bırakırsanız (hareket yok) → normal bir tıklama
       olarak işler, içindeki buton/bağlantı kendi click olayını alır.
     - Katmanı gerçekten sürüklerseniz (eşik aşılır) → taşıma/yeniden
       boyutlandırma normal şekilde çalışır.

   FAZ 8: opts.getBreakpoint() ile hangi modda (mobile/desktop)
   olunduğu sorulur. "desktop" ise ve katmanın masaüstü override'ı
   etkinse (veya kullanıcı sürüklemeye başlayınca otomatik etkinleşir),
   okuma/yazma SeozDocModel.resolveGeometry/setGeometry üzerinden
   yapılır — mobil (varsayılan) değerlere hiç dokunulmaz.
   ========================================================================= */

(function (global) {
  "use strict";

  const DRAG_THRESHOLD = 4; // ekran pikseli — bunun altındaki hareket "tıklama" sayılır

  function attachInteractions(canvasEl, doc, opts) {
    let dragState = null;

    canvasEl.addEventListener("pointerdown", (e) => {
      const layerEl = e.target.closest("[data-layer-id]");
      if (!layerEl) {
        opts.selectLayer(null);
        return;
      }
      const isHandle = e.target.classList.contains("resize-handle");
      const layerId = layerEl.dataset.layerId;
      const layer = doc.layers.find(l => l.id === layerId);
      if (!layer) return;

      opts.selectLayer(layerId);

      const breakpoint = opts.getBreakpoint ? opts.getBreakpoint() : "mobile";
      const geo = SeozDocModel.resolveGeometry(layer, breakpoint);

      dragState = {
        layerId,
        breakpoint,
        mode: isHandle ? "resize" : "move",
        startClientX: e.clientX,
        startClientY: e.clientY,
        startX: geo.x,
        startY: geo.y,
        startW: geo.w,
        startH: geo.h || 0,
        moved: false
      };
      // NOT: Burada preventDefault/stopPropagation ÇAĞRILMIYOR. Gerçek
      // bir sürükleme yalnızca aşağıdaki pointermove'da eşik aşıldığında
      // başlatılır — aksi halde bu bir tıklamadır ve normal şekilde
      // devam etmesine izin verilir.
    });

    window.addEventListener("pointermove", (e) => {
      if (!dragState) return;
      const rawDx = e.clientX - dragState.startClientX;
      const rawDy = e.clientY - dragState.startClientY;

      if (!dragState.moved) {
        if (Math.abs(rawDx) < DRAG_THRESHOLD && Math.abs(rawDy) < DRAG_THRESHOLD) return;
        dragState.moved = true;
      }
      e.preventDefault();

      const scale = opts.getScale() || 1;
      const dx = rawDx / scale;
      const dy = rawDy / scale;
      const layer = doc.layers.find(l => l.id === dragState.layerId);
      if (!layer) return;

      let patch;
      if (dragState.mode === "move") {
        patch = {
          x: Math.round(dragState.startX + dx),
          y: Math.round(dragState.startY + dy)
        };
      } else if (layer.type === "image" || layer.type === "module") {
        const newW = Math.max(20, dragState.startW + dx);
        if (layer.type === "image" && layer.content.lockAspect && dragState.startW > 0) {
          const ratio = dragState.startH / dragState.startW;
          patch = { w: Math.round(newW), h: Math.round(newW * ratio) };
        } else {
          patch = { w: Math.round(newW), h: Math.max(20, Math.round(dragState.startH + dy)) };
        }
      } else {
        patch = { w: Math.max(40, Math.round(dragState.startW + dx)) };
      }

      SeozDocModel.setGeometry(layer, dragState.breakpoint, patch);
      opts.onLayerChange(layer);
    });

    window.addEventListener("pointerup", () => {
      if (dragState && dragState.moved && opts.onDragEnd) opts.onDragEnd();
      dragState = null;
    });
  }

  global.SeozDragResize = { attachInteractions };
})(window);
