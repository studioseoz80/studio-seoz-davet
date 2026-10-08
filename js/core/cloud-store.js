/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — cloud-store.js  (YENİ — Supabase yayın katmanı)
   -----------------------------------------------------------------------------
   Gerçek müşteri bağlantısı (view.html?slug=...) için Supabase'e yayın
   yapar ve oradan okur. MEVCUT localStorage sistemine (storage.js) HİÇ
   dokunmaz: taslaklar ve yerel yayın kopyası eskisi gibi tarayıcıda kalır.

   NE YAPAR:
   - publishSnapshot(doc): yerel yayın kopyasını alır,
       1) içindeki "idb:..." medya referanslarını (görsel, video, müzik —
          hangi modülde olduğuna bakmadan) Supabase Storage'a yükler ve
          YALNIZCA BU KOPYADA gerçek https adresleriyle değiştirir
          (taslak ve belge yapısı değişmez — ZIP paketinin yaptığının
          aynısı),
       2) belgeyi published_invitations.document_data alanına yazar.
          Aynı slug varsa YENİ kayıt açılmaz, mevcut kayıt güncellenir.
   - loadPublishedBySlug(slug): view.html için kaydı okur.

   KÜTÜPHANE YOK: Supabase'in REST adreslerine düz fetch() ile gidilir;
   supabase-js yüklenmez, sayfa yükü artmaz, script sırası değişmez.

   SLUG: Her davetiyenin slug'ı ilk yayında üretilir ve bu tarayıcıda
   belgenin id'sine bağlı olarak AYRI bir anahtarda saklanır (belge
   modeli değişmez). Kopyalanan / içe aktarılan belgeler yeni id aldığı
   için kendi ayrı slug'larını alır — başkasının bağlantısının üstüne
   asla yazmaz.
   ========================================================================= */

(function (global) {
  "use strict";

  const TABLE = "published_invitations";
  const SLUG_PREFIX = "seoz_editor_slug_v1_";
  const ASSET_CACHE_KEY = "seoz_editor_cloud_assets_v1";
  const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,78})[a-z0-9]$/;

  /* ---------------- YAPILANDIRMA ---------------- */
  function cfg() {
    return global.SEOZ_SUPABASE_CONFIG || {};
  }

  // Gizli (service_role / secret) anahtar yanlışlıkla yazılırsa yakalar.
  function looksLikeSecretKey(key) {
    if (/^sb_secret_/i.test(key)) return true;
    const parts = key.split(".");
    if (parts.length === 3) {
      try {
        const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
        return payload && payload.role === "service_role";
      } catch (e) { return false; }
    }
    return false;
  }

  function isConfigured() {
    const c = cfg();
    const url = String(c.url || "").trim();
    const key = String(c.anonKey || "").trim();
    if (!/^https:\/\/\S+$/.test(url) || key.length < 20) return false;
    if (looksLikeSecretKey(key)) {
      console.error("[Studio SEOZ] supabase-config.js içine GİZLİ (service_role/secret) anahtar yazılmış. Güvenlik nedeniyle Supabase bağlantısı kullanılmıyor. Yalnızca anon/publishable anahtarı yazın.");
      return false;
    }
    return true;
  }

  function baseUrl() { return String(cfg().url).trim().replace(/\/+$/, ""); }
  function anonKey() { return String(cfg().anonKey).trim(); }
  function bucket() { return String(cfg().assetsBucket || "davetiye-medya").trim(); }

  function authHeaders(extra) {
    return Object.assign({
      apikey: anonKey(),
      Authorization: "Bearer " + anonKey()
    }, extra || {});
  }

  function fetchWithTimeout(url, options, ms) {
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), ms) : null;
    return fetch(url, Object.assign({}, options, ctrl ? { signal: ctrl.signal } : {}))
      .finally(() => { if (timer) clearTimeout(timer); });
  }

  async function errorText(res) {
    let body = "";
    try { body = await res.text(); } catch (e) { /* yok say */ }
    return `HTTP ${res.status}${body ? " — " + body.slice(0, 300) : ""}`;
  }

  function safeLocalGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function safeLocalSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* yok say */ }
  }

  /* ---------------- SLUG ---------------- */
  // "Ayşe & Mustafa Düğün" → "ayse-mustafa-dugun"
  function slugifyTitle(title) {
    let s = String(title || "")
      .replace(/İ/g, "i").replace(/I/g, "i").replace(/ı/g, "i")
      .toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "") // ç ğ ö ş ü → c g o s u
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (s.length > 40) s = s.slice(0, 40).replace(/-[^-]*$/, "") || s.slice(0, 40);
    s = s.replace(/-+$/g, "");
    return s || "davetiye";
  }

  // Karışabilecek harfler (0/o, 1/l/i) çıkarıldı.
  function randomSuffix(len) {
    const chars = "abcdefghjkmnpqrstuvwxyz23456789";
    const out = [];
    const buf = new Uint32Array(len);
    if (global.crypto && global.crypto.getRandomValues) global.crypto.getRandomValues(buf);
    else for (let i = 0; i < len; i++) buf[i] = Math.floor(Math.random() * 1e9);
    for (let i = 0; i < len; i++) out.push(chars[buf[i] % chars.length]);
    return out.join("");
  }

  function getSlug(docId) {
    return safeLocalGet(SLUG_PREFIX + docId);
  }

  async function slugExists(slug) {
    const url = `${baseUrl()}/rest/v1/${TABLE}?slug=eq.${encodeURIComponent(slug)}&select=slug&limit=1`;
    const res = await fetchWithTimeout(url, { headers: authHeaders() }, 20000);
    if (!res.ok) throw new Error("Slug kontrolü yapılamadı: " + await errorText(res));
    const rows = await res.json();
    return Array.isArray(rows) && rows.length > 0;
  }

  // Belgenin kalıcı slug'ı: varsa aynısı, yoksa yeni ve BENZERSİZ olanı.
  async function ensureSlug(doc) {
    const existing = getSlug(doc.id);
    if (existing) return existing;
    const base = slugifyTitle(doc.meta && doc.meta.title);
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = base + "-" + randomSuffix(6);
      if (!(await slugExists(candidate))) {
        safeLocalSet(SLUG_PREFIX + doc.id, candidate);
        return candidate;
      }
    }
    throw new Error("Benzersiz bir bağlantı adı üretilemedi, lütfen tekrar deneyin.");
  }

  /* ---------------- MEDYA (Storage) ---------------- */
  const EXT_BY_MIME = {
    "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif",
    "image/svg+xml": "svg", "video/mp4": "mp4", "video/webm": "webm",
    "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/wav": "wav", "audio/x-wav": "wav",
    "audio/ogg": "ogg", "audio/mp4": "m4a"
  };

  function collectRefs(node, refs) {
    if (typeof node === "string") {
      if (global.SeozBlobStore && global.SeozBlobStore.isRef(node)) refs.add(node);
    } else if (Array.isArray(node)) {
      node.forEach(n => collectRefs(n, refs));
    } else if (node && typeof node === "object") {
      Object.keys(node).forEach(k => collectRefs(node[k], refs));
    }
    return refs;
  }

  function replaceRefs(node, map) {
    if (typeof node === "string") return map.has(node) ? map.get(node) : node;
    if (Array.isArray(node)) return node.map(n => replaceRefs(n, map));
    if (node && typeof node === "object") {
      const out = {};
      Object.keys(node).forEach(k => { out[k] = replaceRefs(node[k], map); });
      return out;
    }
    return node;
  }

  function readAssetCache() {
    try { return JSON.parse(safeLocalGet(ASSET_CACHE_KEY) || "{}") || {}; } catch (e) { return {}; }
  }

  function publicAssetUrl(path) {
    return `${baseUrl()}/storage/v1/object/public/${encodeURIComponent(bucket())}/${path.split("/").map(encodeURIComponent).join("/")}`;
  }

  // Bir "idb:..." dosyasını Storage'a yükler, herkese açık adresini döndürür.
  // IndexedDB anahtarları değişmez (yeni dosya = yeni anahtar), bu yüzden
  // daha önce yüklenmiş dosya tekrar yüklenmez (büyük videolarda önemli).
  async function uploadRef(ref, slug, cache) {
    const key = ref.slice(4);
    const cacheKey = `${bucket()}|${slug}|${key}`;
    if (cache[cacheKey]) return cache[cacheKey];

    const blob = await global.SeozBlobStore.getBlob(key);
    if (!blob) throw new Error("Bir medya dosyası bu tarayıcıda bulunamadı (silinmiş olabilir). İlgili görsel/video/müziği yeniden yükleyip tekrar deneyin.");

    const path = `${slug}/${key}.${EXT_BY_MIME[blob.type] || "bin"}`;
    const url = `${baseUrl()}/storage/v1/object/${encodeURIComponent(bucket())}/${path.split("/").map(encodeURIComponent).join("/")}`;
    const res = await fetchWithTimeout(url, {
      method: "POST",
      headers: authHeaders({
        "Content-Type": blob.type || "application/octet-stream",
        "x-upsert": "false",
        "cache-control": "31536000"
      }),
      body: blob
    }, 180000);

    if (!res.ok) {
      const detail = await errorText(res);
      // Dosya zaten yüklüyse (önceki yayından) sorun değil.
      const duplicate = res.status === 409 || /duplicate|already exists/i.test(detail);
      if (!duplicate) throw new Error("Medya dosyası yüklenemedi: " + detail);
    }

    const publicUrl = publicAssetUrl(path);
    cache[cacheKey] = publicUrl;
    safeLocalSet(ASSET_CACHE_KEY, JSON.stringify(cache));
    return publicUrl;
  }

  /* ---------------- YAYIN ---------------- */
  // snapshot: storage.js'in publish() ile ürettiği yerel yayın kopyası.
  // onProgress(metin): isteğe bağlı, editörde durum göstermek için.
  async function publishSnapshot(snapshot, onProgress) {
    if (!isConfigured()) throw new Error("Supabase bağlantı bilgileri girilmemiş (js/supabase-config.js).");
    const progress = typeof onProgress === "function" ? onProgress : () => {};

    const slug = await ensureSlug(snapshot);

    const refs = Array.from(collectRefs(snapshot, new Set()));
    const map = new Map();
    const cache = readAssetCache();
    for (let i = 0; i < refs.length; i++) {
      progress(`Medya yükleniyor (${i + 1}/${refs.length})...`);
      map.set(refs[i], await uploadRef(refs[i], slug, cache));
    }

    progress("Davetiye kaydediliyor...");
    const documentData = replaceRefs(snapshot, map);
    const res = await fetchWithTimeout(`${baseUrl()}/rest/v1/${TABLE}?on_conflict=slug`, {
      method: "POST",
      headers: authHeaders({
        "Content-Type": "application/json",
        // Aynı slug varsa YENİ satır açılmaz, mevcut satır güncellenir.
        Prefer: "resolution=merge-duplicates,return=minimal"
      }),
      body: JSON.stringify({ slug: slug, document_data: documentData })
    }, 60000);
    if (!res.ok) throw new Error("Davetiye kaydedilemedi: " + await errorText(res));

    return { slug: slug, url: customerUrl(slug), mediaCount: refs.length };
  }

  function customerUrl(slug) {
    const configured = String(cfg().publicViewUrl || "").trim();
    let base;
    try {
      base = new URL(configured || "view.html", global.location.href);
    } catch (e) {
      base = new URL("view.html", global.location.href);
    }
    base.search = "";
    base.searchParams.set("slug", slug);
    return base.href;
  }

  /* ---------------- OKUMA (view.html) ---------------- */
  // Dönen değer: belge | null (bulunamadı). Ağ hatasında hata fırlatır.
  async function loadPublishedBySlug(slug) {
    if (!isConfigured()) throw new Error("Supabase yapılandırılmamış.");
    if (!SLUG_RE.test(String(slug || ""))) return null;
    const url = `${baseUrl()}/rest/v1/${TABLE}?slug=eq.${encodeURIComponent(slug)}&select=document_data&limit=1`;
    const res = await fetchWithTimeout(url, { headers: authHeaders() }, 20000);
    if (!res.ok) throw new Error(await errorText(res));
    const rows = await res.json();
    if (!Array.isArray(rows) || !rows.length || !rows[0].document_data) return null;
    return rows[0].document_data;
  }

  global.SeozCloudStore = {
    isConfigured,
    getSlug,
    slugifyTitle,
    publishSnapshot,
    customerUrl,
    loadPublishedBySlug
  };
})(window);
