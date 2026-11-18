/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — editor/migration.js · TAŞIMA PAKETİ
   -----------------------------------------------------------------------------
   Editör her şeyini TARAYICININ KENDİ HAFIZASINDA tutar ve bu hafıza ADRESE
   bağlıdır: studio-seoz-davet.pages.dev'deki taslaklar editor.studioseoz.com'da
   görünmez. Taşıma Paketi bu hafızayı eksiksiz, şifreli tek bir dosyaya alır
   ve yeni adreste AYNEN geri koyar:
     • taslaklar ve davetiye kimlikleri (aynı kimlik = yeniden yayın AYNI linki günceller)
     • yayınlanan sürümlerin yerel kopyaları
     • bağlantı eşleşmeleri (hangi davetiye hangi kısa linke ait)
     • Katılım Paneli / Anı Albümü / Anket paneli anahtarları (müşterinin linkleri değişmez)
     • editöre yüklenmiş bütün görseller, videolar, 3D modeller (IndexedDB)
     • yüklenmiş görsellerin bulut adresleri, animasyon kurguları, tema geri-al kayıtları, yazı tipi tercihleri
   TAŞINMAYAN: giriş oturumu (güvenlik için yeni adreste yeniden giriş yapılır).

   GÜVENLİK
   - Dosya şifrelidir (AES-GCM 256, şifreden PBKDF2-SHA256 ile anahtar). İçinde müşteri
     panel anahtarları vardır: şifresiz açılamaz.
   - Her öğenin SHA-256 parmak izi pakette tutulur; yüklemeden önce ve sonra doğrulanır.
   - DIŞA AKTARMA hiçbir şeyi değiştirmez (eski editör olduğu gibi kalır).
   - İÇE AKTARMA önce bir YEDEK kaydeder; var olan farklı bir öğenin üzerine varsayılan
     olarak YAZMAZ (çakışma raporlanır). "Son taşımayı geri al" her şeyi taşıma öncesine döndürür.
   - Hiçbir aşamada Supabase'e, yayındaki davetiyelere veya müşteri linklerine dokunulmaz.
   ========================================================================= */
(function (global) {
  "use strict";

  const MAGIC = "SEOZTASIMA1";
  const VERSION = 1;
  const ITER = 310000;
  const INCLUDE = ["seoz_editor_", "seoz_rsvp_panel_v1_", "seoz_album_panel_v1_", "seoz_poll_panel_v1_", "seoz_cinema_", "seoz_theme_undo_"];
  const EXCLUDE = ["seoz_editor_auth_v1"];          // giriş oturumu taşınmaz
  const MERGE_LIST = "seoz_editor_index_v1";         // davetiye listesi: kimliğe göre birleştirilir
  const MERGE_MAP = "seoz_editor_cloud_assets_v1";   // görsel → bulut adresi: anahtara göre birleştirilir
  const BLOB_DB = "seoz_editor_assets_v1", BLOB_STORE = "blobs";
  const BACKUP_DB = "seoz_tasima_v1", BACKUP_STORE = "yedek", BACKUP_KEY = "son";

  const enc = new TextEncoder(), dec = new TextDecoder();
  const hex = buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  const sha = async data => hex(await crypto.subtle.digest("SHA-256", typeof data === "string" ? enc.encode(data) : data));
  const isOurKey = k => INCLUDE.some(p => k.startsWith(p)) && EXCLUDE.indexOf(k) < 0;

  /* ---------------- IndexedDB ---------------- */
  function openDB(name, store) {
    return new Promise((res, rej) => {
      const req = indexedDB.open(name, 1);
      req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(store)) req.result.createObjectStore(store); };
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  }
  function txDone(tx) { return new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error || new Error("abort")); }); }
  async function allBlobs() {
    const db = await openDB(BLOB_DB, BLOB_STORE);
    return new Promise((res, rej) => {
      const out = [], tx = db.transaction(BLOB_STORE, "readonly"), req = tx.objectStore(BLOB_STORE).openCursor();
      req.onsuccess = () => { const c = req.result; if (c) { out.push({ key: String(c.key), blob: c.value }); c.continue(); } else res(out); };
      req.onerror = () => rej(req.error);
    }).finally(() => db.close());
  }
  async function blobGet(key) {
    const db = await openDB(BLOB_DB, BLOB_STORE);
    try { return await new Promise((res, rej) => { const r = db.transaction(BLOB_STORE, "readonly").objectStore(BLOB_STORE).get(key); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
    finally { db.close(); }
  }
  async function blobPutMany(list) {   // [{key, blob}]
    const db = await openDB(BLOB_DB, BLOB_STORE);
    try { const tx = db.transaction(BLOB_STORE, "readwrite"); list.forEach(x => tx.objectStore(BLOB_STORE).put(x.blob, x.key)); await txDone(tx); }
    finally { db.close(); }
  }
  async function blobDeleteMany(keys) {
    const db = await openDB(BLOB_DB, BLOB_STORE);
    try { const tx = db.transaction(BLOB_STORE, "readwrite"); keys.forEach(k => tx.objectStore(BLOB_STORE).delete(k)); await txDone(tx); }
    finally { db.close(); }
  }
  async function backupSave(rec) {
    const db = await openDB(BACKUP_DB, BACKUP_STORE);
    try { const tx = db.transaction(BACKUP_STORE, "readwrite"); tx.objectStore(BACKUP_STORE).put(rec, BACKUP_KEY); await txDone(tx); }
    finally { db.close(); }
  }
  async function backupLoad() {
    const db = await openDB(BACKUP_DB, BACKUP_STORE);
    try { return await new Promise((res, rej) => { const r = db.transaction(BACKUP_STORE, "readonly").objectStore(BACKUP_STORE).get(BACKUP_KEY); r.onsuccess = () => res(r.result || null); r.onerror = () => rej(r.error); }); }
    finally { db.close(); }
  }
  async function backupClear() {
    const db = await openDB(BACKUP_DB, BACKUP_STORE);
    try { const tx = db.transaction(BACKUP_STORE, "readwrite"); tx.objectStore(BACKUP_STORE).delete(BACKUP_KEY); await txDone(tx); }
    finally { db.close(); }
  }

  /* ---------------- içerik özeti ---------------- */
  function refsIn(value, out) {
    if (typeof value === "string") { if (value.startsWith("idb:")) out.add(value.slice(4)); return out; }
    if (Array.isArray(value)) value.forEach(v => refsIn(v, out));
    else if (value && typeof value === "object") Object.keys(value).forEach(k => refsIn(value[k], out));
    return out;
  }
  function describe(items, blobKeys) {
    const c = { taslak: 0, yayin: 0, baglanti: 0, katilimPaneli: 0, albumPaneli: 0, anketPaneli: 0, gorsel: blobKeys.length, diger: 0 };
    const refs = new Set();
    items.forEach(({ k, v }) => {
      if (k.startsWith("seoz_editor_draft_v1_")) { c.taslak++; try { refsIn(JSON.parse(v), refs); } catch (e) { /* bozuk taslak: olduğu gibi taşınır */ } }
      else if (k.startsWith("seoz_editor_published_v1_")) c.yayin++;
      else if (k.startsWith("seoz_editor_slug_v1_")) c.baglanti++;
      else if (k.startsWith("seoz_rsvp_panel_v1_")) c.katilimPaneli++;
      else if (k.startsWith("seoz_album_panel_v1_")) c.albumPaneli++;
      else if (k.startsWith("seoz_poll_panel_v1_")) c.anketPaneli++;
      else c.diger++;
    });
    const have = new Set(blobKeys);
    c.eksikGorsel = Array.from(refs).filter(r => !have.has(r));   // taslakta var, tarayıcıda yok (zaten eksikti)
    return c;
  }

  /* Bu tarayıcıdaki editör verisinin özeti (hiçbir şey değiştirmez). */
  async function summary() {
    const items = Object.keys(localStorage).filter(isOurKey).map(k => ({ k, v: localStorage.getItem(k) }));
    const blobs = await allBlobs();
    const bytes = blobs.reduce((s, b) => s + (b.blob && b.blob.size || 0), 0) + items.reduce((s, i) => s + i.v.length * 2, 0);
    return Object.assign(describe(items, blobs.map(b => b.key)), { bytes });
  }

  /* ---------------- şifreleme ---------------- */
  async function keyFrom(password, salt) {
    const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations: ITER }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }
  function checkPassword(p) { if (typeof p !== "string" || p.length < 8) throw new Error("Taşıma şifresi en az 8 karakter olmalı."); }

  /* ---------------- DIŞA AKTAR (eski editörde) ---------------- */
  async function exportPackage(password, onStep) {
    checkPassword(password);
    const step = t => { if (onStep) onStep(t); };
    step("Taslaklar ve ayarlar okunuyor...");
    const items = [];
    for (const k of Object.keys(localStorage).filter(isOurKey).sort()) { const v = localStorage.getItem(k); items.push({ k, v, h: await sha(v) }); }
    step("Görseller okunuyor...");
    const blobs = await allBlobs(), metas = [], parts = [];
    let off = 0;
    for (const b of blobs) {
      const buf = await (b.blob instanceof Blob ? b.blob.arrayBuffer() : new Blob([b.blob]).arrayBuffer());
      metas.push({ key: b.key, type: (b.blob && b.blob.type) || "", size: buf.byteLength, h: await sha(buf), off });
      parts.push(new Uint8Array(buf)); off += buf.byteLength;
    }
    const counts = describe(items, blobs.map(b => b.key));
    const manifest = { format: "seoz-tasima", version: VERSION, createdAt: new Date().toISOString(), source: location.origin, counts, items, blobs: metas };
    const mBytes = enc.encode(JSON.stringify(manifest));
    const payload = new Uint8Array(4 + mBytes.length + off);
    new DataView(payload.buffer).setUint32(0, mBytes.length);
    payload.set(mBytes, 4);
    let p = 4 + mBytes.length; parts.forEach(u => { payload.set(u, p); p += u.length; });
    step("Şifreleniyor...");
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await keyFrom(password, salt), payload));
    const head = enc.encode(MAGIC);
    const file = new Uint8Array(head.length + 1 + 16 + 12 + ct.length);
    file.set(head, 0); file[head.length] = VERSION; file.set(salt, head.length + 1); file.set(iv, head.length + 17); file.set(ct, head.length + 29);
    const d = new Date(), z = n => String(n).padStart(2, "0");
    const name = `studio-seoz-tasima-${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}.seoztasima`;
    return { blob: new Blob([file], { type: "application/octet-stream" }), filename: name, counts, bytes: file.length };
  }

  /* ---------------- PAKETİ AÇ + DOĞRULA ---------------- */
  async function readPackage(fileOrBlob, password) {
    checkPassword(password);
    const buf = new Uint8Array(await fileOrBlob.arrayBuffer());
    const head = enc.encode(MAGIC);
    if (buf.length < head.length + 29 || dec.decode(buf.subarray(0, head.length)) !== MAGIC) throw new Error("Bu dosya bir Studio SEOZ Taşıma Paketi değil.");
    if (buf[head.length] !== VERSION) throw new Error("Taşıma Paketi sürümü desteklenmiyor.");
    const salt = buf.subarray(head.length + 1, head.length + 17), iv = buf.subarray(head.length + 17, head.length + 29);
    let payload;
    try { payload = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, await keyFrom(password, salt), buf.subarray(head.length + 29))); }
    catch (e) { throw new Error("Şifre yanlış ya da dosya bozulmuş. Hiçbir şey değiştirilmedi."); }
    const mLen = new DataView(payload.buffer, payload.byteOffset).getUint32(0);
    const manifest = JSON.parse(dec.decode(payload.subarray(4, 4 + mLen)));
    if (manifest.format !== "seoz-tasima") throw new Error("Taşıma Paketi okunamadı.");
    const base = 4 + mLen;
    for (const it of manifest.items) {
      if (!isOurKey(it.k) || typeof it.v !== "string") throw new Error("Pakette beklenmeyen bir kayıt var: " + it.k);
      if (await sha(it.v) !== it.h) throw new Error("Paket bozulmuş (kayıt doğrulanamadı): " + it.k);
    }
    const blobs = [];
    for (const b of manifest.blobs) {
      const bytes = payload.slice(base + b.off, base + b.off + b.size);
      if (bytes.length !== b.size || await sha(bytes) !== b.h) throw new Error("Paket bozulmuş (görsel doğrulanamadı): " + b.key);
      blobs.push({ key: b.key, h: b.h, size: b.size, blob: new Blob([bytes], { type: b.type || "" }) });
    }
    return { manifest, blobs };
  }

  /* ---------------- PLAN (hiçbir şey yazmaz) ---------------- */
  function mergeList(cur, inc) {   // davetiye listesi: var olanlar korunur, eksikler eklenir
    const a = safeJSON(cur, []), b = safeJSON(inc, []);
    if (!Array.isArray(a) || !Array.isArray(b)) return null;
    const ids = new Set(a.map(e => e && e.id));
    return JSON.stringify(a.concat(b.filter(e => e && !ids.has(e.id))));
  }
  function mergeMap(cur, inc, overwrite) {
    const a = safeJSON(cur, {}), b = safeJSON(inc, {});
    if (!a || !b || typeof a !== "object" || typeof b !== "object") return null;
    return JSON.stringify(overwrite ? Object.assign({}, a, b) : Object.assign({}, b, a));
  }
  function safeJSON(s, fb) { try { return s == null ? fb : JSON.parse(s); } catch (e) { return undefined; } }

  async function plan(pkg, overwrite) {
    const writes = [], skipped = [], conflicts = [];
    for (const it of pkg.manifest.items) {
      const cur = localStorage.getItem(it.k);
      let next = it.v;
      if (it.k === MERGE_LIST && cur != null) next = mergeList(cur, it.v);
      else if (it.k === MERGE_MAP && cur != null) next = mergeMap(cur, it.v, overwrite);
      if (next == null) next = it.v;
      if (cur === next) { skipped.push(it.k); continue; }
      if (cur != null && it.k !== MERGE_LIST && it.k !== MERGE_MAP && !overwrite) { conflicts.push(it.k); continue; }
      writes.push({ k: it.k, v: next, before: cur });
    }
    const blobNew = [], blobSame = [], blobConflict = [];
    for (const b of pkg.blobs) {
      const cur = await blobGet(b.key);
      if (!cur) { blobNew.push(b); continue; }
      const h = await sha(await cur.arrayBuffer());
      if (h === b.h) blobSame.push(b.key); else blobConflict.push(b.key);   // rastgele anahtar: pratikte olmaz; üzerine yazılmaz
    }
    return { writes, skipped, conflicts, blobNew, blobSame, blobConflict };
  }

  /* ---------------- İÇE AKTAR (yeni editörde) ---------------- */
  async function importPackage(fileOrBlob, password, opts) {
    opts = opts || {};
    const pkg = await readPackage(fileOrBlob, password);
    const pl = await plan(pkg, !!opts.overwrite);
    if (opts.dryRun) return report(pkg, pl, null);
    const prev = await backupLoad();
    if (prev && !opts.replaceBackup) throw new Error("Daha önceki bir taşımanın geri alma kaydı duruyor. Önce \"Son taşımayı geri al\" ya da \"Geri alma kaydını sil\" seçin.");
    // 1) YEDEK: dokunulacak her kaydın önceki hâli + eklenecek görsellerin listesi (yazmadan ÖNCE)
    await backupSave({ createdAt: new Date().toISOString(), source: pkg.manifest.source, before: pl.writes.map(w => ({ k: w.k, v: w.before })), blobsAdded: pl.blobNew.map(b => b.key) });
    // 2) YAZ — bir hata olursa kendiliğinden geri alınır
    try {
      if (pl.blobNew.length) await blobPutMany(pl.blobNew.map(b => ({ key: b.key, blob: b.blob })));
      pl.writes.forEach(w => localStorage.setItem(w.k, w.v));
    } catch (e) {
      await rollback().catch(() => {});
      throw new Error("Taşıma tamamlanamadı (" + (e && e.name === "QuotaExceededError" ? "tarayıcı hafızası doldu" : (e && e.message || e)) + "). Her şey taşıma öncesine döndürüldü.");
    }
    // 3) DOĞRULA
    const problems = [];
    for (const w of pl.writes) if (localStorage.getItem(w.k) !== w.v) problems.push(w.k);
    for (const b of pl.blobNew) { const cur = await blobGet(b.key); if (!cur || cur.size !== b.size) problems.push("görsel " + b.key); }
    return report(pkg, pl, problems);
  }
  function report(pkg, pl, problems) {
    const blobKeys = new Set(pkg.blobs.map(b => b.key));
    return {
      kaynak: pkg.manifest.source, olusturma: pkg.manifest.createdAt, paket: pkg.manifest.counts,
      yazilacak: pl.writes.length, ayni: pl.skipped.length, cakisan: pl.conflicts, gorselYeni: pl.blobNew.length, gorselAyni: pl.blobSame.length,
      gorselCakisan: pl.blobConflict, eksikGorsel: (pkg.manifest.counts.eksikGorsel || []).filter(r => !blobKeys.has(r)),
      dogrulama: problems === null ? "deneme (hiçbir şey yazılmadı)" : (problems.length ? problems : "tamam")
    };
  }

  /* ---------------- GERİ AL ---------------- */
  async function rollback() {
    const rec = await backupLoad();
    if (!rec) throw new Error("Geri alınacak bir taşıma kaydı yok.");
    rec.before.forEach(({ k, v }) => { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); });
    if (rec.blobsAdded && rec.blobsAdded.length) await blobDeleteMany(rec.blobsAdded);
    await backupClear();
    return { geriAlinanKayit: rec.before.length, silinenGorsel: (rec.blobsAdded || []).length, tarih: rec.createdAt };
  }
  async function lastBackup() { const r = await backupLoad(); return r ? { tarih: r.createdAt, kaynak: r.source, kayit: r.before.length, gorsel: (r.blobsAdded || []).length } : null; }
  async function clearBackup() { await backupClear(); }

  global.SeozTasima = { summary, exportPackage, readPackage, importPackage, rollback, lastBackup, clearBackup, isOurKey };
})(window);
