/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — editor/attendance-sync.js  (KATILIM FORMU — YAYIN SONRASI)
   -----------------------------------------------------------------------------
   "Yayına Hazırla" BAŞARIYLA bittikten SONRA çağrılır. Mevcut yayın akışını
   değiştirmez:
     • Davetiyede Katılım Formu YOKSA hiçbir şey yapmaz (bugünkü davranış).
     • Varsa Supabase'de etkinlik kaydını oluşturur/günceller ve soruların son
       halini kaydeder. Panel anahtarı ilk seferde üretilir ve bu tarayıcıda
       saklanır (müşteri paneli linki Faz B'de gösterilecek).
   ========================================================================= */

(function (global) {
  "use strict";

  function formLayers(doc) {
    return (doc && Array.isArray(doc.layers) ? doc.layers : [])
      .filter(l => l.type === "module" && l.moduleId === "attendance-form");
  }

  /* Dönen değer: null (form yok) | { synced: true, multiple: bool, result } */
  async function afterPublish(doc, slug) {
    const layers = formLayers(doc);
    if (!layers.length) return null;
    if (!slug) throw new Error("Yayın bağlantısı (slug) bulunamadı.");
    if (!global.SeozEventStore || !global.SeozEventStore.isConfigured()) {
      throw new Error("Supabase bağlantısı ayarlı değil.");
    }
    const def = global.SeozModuleRegistry.getModule("attendance-form");
    const layer = layers[0];
    const result = await global.SeozEventStore.ownerSyncEvent(slug, doc.id, layer.id, def.buildServerForm(layer.settings));
    return { synced: true, multiple: layers.length > 1, result };
  }

  function errorText(err) {
    const code = (err && (err.code || err.message)) || "";
    if (code === "AUTH_REQUIRED") return "Studio SEOZ girişi gerekli (☁ Giriş Yap).";
    if (/rsvp_owner_sync_event|Could not find the function|PGRST202/i.test(code)) {
      return "Supabase'de katılım sistemi kurulmamış görünüyor (supabase/katilim-faz-a.sql çalıştırılmalı).";
    }
    if (code === "network") return "Bağlantı kurulamadı.";
    return code || "Bilinmeyen hata.";
  }

  global.SeozAttendanceSync = { afterPublish, errorText, formLayers };
})(window);
