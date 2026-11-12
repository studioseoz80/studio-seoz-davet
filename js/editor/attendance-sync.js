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

  // DİLEK AĞACI: dilekler müşteri panelinin "Etkileşimler" bölümünde görünür.
  function wishLayers(doc) {
    return (doc && Array.isArray(doc.layers) ? doc.layers : [])
      .filter(l => l.type === "module" && l.moduleId === "interactive" && l.settings && l.settings.kind === "dilek-agaci");
  }

  /* Dönen değer: null (form yok) | { synced: true, multiple: bool, result } */
  async function afterPublish(doc, slug) {
    const layers = formLayers(doc);
    if (!layers.length) {
      // Katılım Formu yok ama Dilek Ağacı var: panel linki için etkinlik kaydı (varsa dokunulmaz).
      if (!wishLayers(doc).length || !global.SeozEventStore || !global.SeozEventStore.ownerWishEnsurePanel) return null;
      if (!slug) throw new Error("Yayın bağlantısı (slug) bulunamadı.");
      const result = await global.SeozEventStore.ownerWishEnsurePanel(slug, doc.id);
      return { synced: true, multiple: false, wishOnly: true, result };
    }
    if (!slug) throw new Error("Yayın bağlantısı (slug) bulunamadı.");
    if (!global.SeozEventStore || !global.SeozEventStore.isConfigured()) {
      throw new Error("Supabase bağlantısı ayarlı değil.");
    }
    const def = global.SeozModuleRegistry.getModule("attendance-form");
    const layer = layers[0];
    const result = await global.SeozEventStore.ownerSyncEvent(slug, doc.id, layer.id, def.buildServerForm(layer.settings));
    // Bu davetiye daha önce yalnızca Dilek Ağacı ile (kapalı kayıtla) yayınlandıysa: form artık var → yanıtlara aç.
    // Başka hiçbir durumda bir şey değişmez; Dilek Ağacı kurulmamışsa sessizce geçilir.
    if (global.SeozEventStore.ownerWishFormAdded) {
      try { const w = await global.SeozEventStore.ownerWishFormAdded(slug); if (w && w.reopened && result) result.is_open = true; }
      catch (e) { /* dilek-agaci.sql yok ya da eski sürüm: Katılım Formu eskisi gibi */ }
    }
    return { synced: true, multiple: layers.length > 1, result };
  }

  function errorText(err) {
    const code = (err && (err.code || err.message)) || "";
    if (code === "AUTH_REQUIRED") return "Studio SEOZ girişi gerekli (☁ Giriş Yap).";
    if (/wish_owner_ensure_panel/i.test(code)) return "Supabase'de Dilek Ağacı kurulmamış görünüyor (supabase/dilek-agaci.sql çalıştırılmalı).";
    if (/rsvp_owner_sync_event|Could not find the function|PGRST202/i.test(code)) {
      return "Supabase'de katılım sistemi kurulmamış görünüyor (supabase/katilim-faz-a.sql çalıştırılmalı).";
    }
    if (code === "network") return "Bağlantı kurulamadı.";
    return code || "Bilinmeyen hata.";
  }

  global.SeozAttendanceSync = { afterPublish, errorText, formLayers, wishLayers };
})(window);
