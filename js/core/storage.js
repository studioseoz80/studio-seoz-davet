/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — storage.js
   -----------------------------------------------------------------------------
   Kayıt sisteminin TEK giriş noktası budur. Editörün geri kalanı hiçbir
   zaman doğrudan localStorage okumaz/yazmaz — hep bu dosyadaki
   fonksiyonlar üzerinden.

   Neden önemli: İleride gerçek, çok cihazlı bir veritabanı (Supabase vb.)
   bağlamak isterseniz, değiştirmeniz gereken TEK dosya burasıdır. Editör,
   panel, render motoru hiçbir şekilde etkilenmez.

   TASLAK / YAYIN AYRIMI:
   - "draft"     → siz düzenlerken üzerinde çalıştığınız, sürekli
                    otomatik kaydedilen sürüm.
   - "published" → yalnızca "Yayına Hazırla" dediğinizde güncellenen,
                    view.html'in gösterdiği sürüm. Taslakta yaptığınız
                    yarım kalmış değişiklikler, siz tekrar yayına
                    hazırlamadan müşteriye asla yansımaz.
   ========================================================================= */

(function (global) {
  "use strict";

  const INDEX_KEY = "seoz_editor_index_v1";
  const DRAFT_PREFIX = "seoz_editor_draft_v1_";
  const PUBLISHED_PREFIX = "seoz_editor_published_v1_";

  function safeParse(raw, fallback) {
    try { return raw ? JSON.parse(raw) : fallback; } catch (e) { return fallback; }
  }

  function readIndex() {
    return safeParse(localStorage.getItem(INDEX_KEY), []);
  }
  function writeIndex(list) {
    localStorage.setItem(INDEX_KEY, JSON.stringify(list));
  }

  function upsertIndexEntry(doc, extra) {
    const list = readIndex();
    const i = list.findIndex(e => e.id === doc.id);
    const entry = Object.assign({
      id: doc.id,
      title: doc.meta.title,
      eventType: doc.meta.eventType,
      updatedAt: doc.meta.updatedAt,
      publishedAt: i >= 0 ? list[i].publishedAt : null
    }, extra || {});
    if (i >= 0) list[i] = entry; else list.push(entry);
    writeIndex(list);
  }

  function removeIndexEntry(id) {
    writeIndex(readIndex().filter(e => e.id !== id));
  }

  /* ------------------------------------------------------------------
     LİSTE
     ------------------------------------------------------------------ */
  function listDocuments() {
    return readIndex().slice().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  /* ------------------------------------------------------------------
     TASLAK
     ------------------------------------------------------------------ */
  function saveDraft(doc) {
    SeozDocModel.touch(doc);
    localStorage.setItem(DRAFT_PREFIX + doc.id, JSON.stringify(doc));
    upsertIndexEntry(doc);
    return doc;
  }

  function loadDraft(id) {
    const doc = safeParse(localStorage.getItem(DRAFT_PREFIX + id), null);
    // MADDE 7: her yüklemede, eski/şüpheli çapraz bağlantı temizliği
    // güvenle (yalnızca temizler, asla başka modülden doldurmaz) uygulanır.
    return doc ? SeozDocModel.sanitizeDocument(doc) : doc;
  }

  function deleteDocument(id) {
    localStorage.removeItem(DRAFT_PREFIX + id);
    localStorage.removeItem(PUBLISHED_PREFIX + id);
    removeIndexEntry(id);
  }

  function duplicateDocument(id) {
    const original = loadDraft(id);
    if (!original) return null;
    const copy = SeozDocModel.cloneDocument(original);
    copy.id = SeozDocModel.generateId("doc");
    copy.meta.title = original.meta.title + " (kopya)";
    copy.meta.createdAt = new Date().toISOString();
    saveDraft(copy);
    return copy;
  }

  /* ------------------------------------------------------------------
     YAYIN (published snapshot)
     ------------------------------------------------------------------ */
  function publish(id) {
    const draft = loadDraft(id);
    if (!draft) throw new Error("Taslak bulunamadı: " + id);
    const snapshot = SeozDocModel.cloneDocument(draft);
    snapshot.meta.publishedAt = new Date().toISOString();
    localStorage.setItem(PUBLISHED_PREFIX + id, JSON.stringify(snapshot));
    upsertIndexEntry(draft, { publishedAt: snapshot.meta.publishedAt });
    return snapshot;
  }

  function loadPublished(id) {
    const doc = safeParse(localStorage.getItem(PUBLISHED_PREFIX + id), null);
    // MADDE 7: yayınlanan (misafirlerin gördüğü) sayfa da, bu düzeltmeden
    // ÖNCE yayınlanmış eski bir snapshot olabileceği için aynı güvenli
    // temizlikten geçirilir.
    return doc ? SeozDocModel.sanitizeDocument(doc) : doc;
  }

  function isPublished(id) {
    return !!localStorage.getItem(PUBLISHED_PREFIX + id);
  }

  /* ------------------------------------------------------------------
     DIŞA / İÇE AKTARMA (JSON) — yedekleme ve cihazlar arası taşıma için
     ------------------------------------------------------------------ */
  function exportJSON(id) {
    const doc = loadDraft(id);
    if (!doc) return null;
    return JSON.stringify(doc, null, 2);
  }

  function importJSON(jsonString) {
    const doc = safeParse(jsonString, null);
    const errors = SeozDocModel.validateDocument(doc);
    if (errors.length) throw new Error("Geçersiz dosya: " + errors.join(", "));
    // MADDE 7: dışarıdan içe aktarılan dosyalar için de aynı güvenli temizlik.
    SeozDocModel.sanitizeDocument(doc);
    // Çakışmayı önlemek için her zaman yeni bir id verilir.
    doc.id = SeozDocModel.generateId("doc");
    doc.meta.title = (doc.meta.title || "İçe Aktarılan Davetiye") + " (içe aktarıldı)";
    saveDraft(doc);
    return doc;
  }

  global.SeozStorage = {
    listDocuments,
    saveDraft,
    loadDraft,
    deleteDocument,
    duplicateDocument,
    publish,
    loadPublished,
    isPublished,
    exportJSON,
    importJSON
  };
})(window);
