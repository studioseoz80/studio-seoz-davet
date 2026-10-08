/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — publish.js (yalnızca editör)
   -----------------------------------------------------------------------------
   FAZ 9: "Yayına Hazırla" akışı sağlamlaştırıldı.
   - validateForPublish(doc): yayınlamadan önce sık karşılaşılan eksiklikleri
     (boş WhatsApp numarası, boş Google Maps bağlantısı, tarihi girilmemiş
     geri sayım, hiç içerik olmayan davetiye vb.) tarar ve bir uyarı listesi
     döndürür. Bu KESİN BİR ENGEL DEĞİLDİR — davetiye sahibi isterse yine de
     yayınlayabilir; amaç yalnızca "bunu unutmuş olabilir misiniz?" demektir.
   - Her modülün bu taramaya nasıl katılacağını KENDİSİ belirler (isteğe
     bağlı validate(settings) fonksiyonu, bkz. js/modules/*.js) — bu dosya
     hangi modülün hangi alanı zorunlu tuttuğunu bilmez, yalnızca sorar.
     Yeni bir modül eklerken bu dosyaya dokunmanız GEREKMEZ.
   ========================================================================= */

(function (global) {
  "use strict";

  function validateForPublish(doc) {
    const warnings = [];

    if (!doc.layers || !doc.layers.length) {
      warnings.push("Davetiyede henüz hiç içerik (metin, fotoğraf, modül) yok.");
    }

    (doc.layers || []).forEach(layer => {
      if (layer.type !== "module") return;
      const moduleDef = typeof SeozModuleRegistry !== "undefined" ? SeozModuleRegistry.getModule(layer.moduleId) : null;
      if (moduleDef && typeof moduleDef.validate === "function") {
        const msg = moduleDef.validate(layer.settings);
        if (msg) warnings.push(msg);
      }
    });

    if (doc.entry && doc.entry.type !== "none" && typeof SeozEntryScene !== "undefined" && !SeozEntryScene.hasUsableEntry(doc.entry)) {
      warnings.push("Giriş sahnesi türü seçilmiş ama görsel/video yüklenmemiş.");
    }

    return warnings;
  }

  function publishDocument(id) {
    return SeozStorage.publish(id);
  }

  function viewURLFor(id) {
    return "view.html?doc=" + encodeURIComponent(id);
  }

  /* SUPABASE YAYINI (gerçek müşteri bağlantısı)
     Önce MEVCUT yerel yayın aynen yapılır (publishDocument → localStorage).
     Ardından Supabase yapılandırılmışsa aynı yayın kopyası Supabase'e
     gönderilir. Supabase ayarlı değilse isCloudConfigured() false döner
     ve editör birebir eski davranışı uygular. */
  function isCloudConfigured() {
    return typeof SeozCloudStore !== "undefined" && SeozCloudStore.isConfigured();
  }

  function publishToCloud(id, onProgress) {
    const snapshot = SeozStorage.loadPublished(id);
    if (!snapshot) return Promise.reject(new Error("Yerel yayın kopyası bulunamadı."));
    return SeozCloudStore.publishSnapshot(snapshot, onProgress);
  }

  global.SeozPublish = { publishDocument, viewURLFor, validateForPublish, isCloudConfigured, publishToCloud };
})(window);
