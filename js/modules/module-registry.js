/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — module-registry.js
   -----------------------------------------------------------------------------
   FAZ 4: Konum, Müzik, Geri Sayım modülleri bu kayıt sistemine kaydolur.
   Her modül dosyası (js/modules/location.js, music.js, countdown.js, ve
   gelecekte eklenecek her yeni modül) kendi kendini burada
   registerModule() ile tanıtır. Editörün geri kalanı (renderer.js,
   module-panel.js, editor-app.js) hangi modüllerin var olduğunu HİÇBİR
   ZAMAN isimle bilmez — hepsi bu kayıttan okur.

   Yeni bir modül eklemek = yeni bir dosya + registerModule() çağrısı.
   Bu dosyaya, editor-app.js'e veya renderer.js'e dokunmak GEREKMEZ.

   Her modül şu kalıba uyar:
     {
       id: "konum",                      // benzersiz kısa kimlik
       label: "Konum",                   // panelde görünen isim
       defaultSettings: {...},           // yeni eklenince kullanılacak değerler
       defaultLayerSize: { w, h },       // canvas'a eklenirken varsayılan kutu boyutu
       settingsSchema: [...],            // panel formunu OTOMATİK üretmek için
       render(settings, mode) {...}      // hem edit hem view modunda kullanılan tek fonksiyon
     }
   ========================================================================= */

(function (global) {
  "use strict";

  const registry = new Map();

  function registerModule(moduleDef) {
    if (!moduleDef || !moduleDef.id) throw new Error("Modül id'si zorunludur.");
    registry.set(moduleDef.id, moduleDef);
  }

  function getModule(id) {
    return registry.get(id) || null;
  }

  function listModules() {
    return Array.from(registry.values());
  }

  global.SeozModuleRegistry = { registerModule, getModule, listModules };
})(window);
