/* =============================================================================
   STUDIO SEOZ — core/event-store.js  (KATILIM SİSTEMİ — Supabase bağlantısı)
   -----------------------------------------------------------------------------
   Katılım Formu (modules/attendance-form.js) ve editör için Supabase'deki
   güvenli fonksiyonları (supabase/katilim-faz-a.sql) çağırır.

   - Mevcut cloud-store.js'in yayın kodunu KULLANMAZ/DEĞİŞTİRMEZ; yalnızca
     aynı yapılandırmayı (supabase-config.js) ve sahip oturumunu okur.
   - Tablolara doğrudan erişim YOKTUR; her şey /rest/v1/rpc/... üzerinden.
   - Misafirin düzenleme anahtarı yalnızca KENDİ tarayıcısında saklanır.
   ========================================================================= */

(function (global) {
  "use strict";

  const GUEST_KEY_PREFIX = "seoz_rsvp_edit_v1_";   // + slug + "_" + layerId
  const PANEL_KEY_PREFIX = "seoz_rsvp_panel_v1_";  // + slug  (yalnızca editör tarayıcısı)

  function cfg() { return global.SEOZ_SUPABASE_CONFIG || {}; }
  function isConfigured() {
    return !!(global.SeozCloudStore && global.SeozCloudStore.isConfigured && global.SeozCloudStore.isConfigured());
  }
  function baseUrl() { return String(cfg().url || "").trim().replace(/\/+$/, ""); }
  function anonKey() { return String(cfg().anonKey || "").trim(); }

  function safeGet(k) { try { return global.localStorage.getItem(k); } catch (e) { return null; } }
  function safeSet(k, v) { try { global.localStorage.setItem(k, v); } catch (e) { /* yok say */ } }

  /* Sunucudan gelen hata kodunu ("required:q_x" gibi) ayıklar. */
  function errorCode(text) {
    try {
      const j = JSON.parse(text);
      return String(j.message || j.error || text);
    } catch (e) { return String(text || ""); }
  }

  async function rpc(name, args, asOwner) {
    if (!isConfigured()) {
      const e = new Error("not_configured"); e.code = "not_configured"; throw e;
    }
    let bearer = anonKey();
    if (asOwner) {
      const token = global.SeozCloudStore.getAccessToken ? await global.SeozCloudStore.getAccessToken().catch(() => null) : null;
      if (!token) { const e = new Error("auth_required"); e.code = "AUTH_REQUIRED"; throw e; }
      bearer = token;
    }
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), 20000) : null;
    let res;
    try {
      res = await fetch(`${baseUrl()}/rest/v1/rpc/${name}`, {
        method: "POST",
        headers: { apikey: anonKey(), Authorization: "Bearer " + bearer, "Content-Type": "application/json" },
        body: JSON.stringify(args || {}),
        signal: ctrl ? ctrl.signal : undefined
      });
    } catch (netErr) {
      const e = new Error("network"); e.code = "network"; throw e;
    } finally {
      if (timer) clearTimeout(timer);
    }
    const text = await res.text();
    if (!res.ok) {
      const code = errorCode(text);
      const e = new Error(code);
      e.code = /not_owner|JWT|jwt|permission denied/i.test(code) ? "AUTH_REQUIRED" : code;
      e.status = res.status;
      throw e;
    }
    return text ? JSON.parse(text) : null;
  }

  /* ---------------- MİSAFİR ---------------- */
  function guestKey(slug, layerId) { return GUEST_KEY_PREFIX + slug + "_" + (layerId || ""); }
  function getGuestToken(slug, layerId) { return safeGet(guestKey(slug, layerId)); }

  async function submitResponse(slug, layerId, payload) {
    const existing = getGuestToken(slug, layerId);
    const r = await rpc("rsvp_submit", { p_slug: slug, p_payload: payload, p_edit_token: existing || null });
    if (r && r.edit_token) safeSet(guestKey(slug, layerId), r.edit_token);
    return r;
  }

  async function getOwnResponse(slug, layerId) {
    const token = getGuestToken(slug, layerId);
    if (!token) return null;
    return rpc("rsvp_get_own", { p_slug: slug, p_edit_token: token });
  }

  /* ---------------- STUDIO SEOZ (sahip) ---------------- */
  async function ownerSyncEvent(slug, docId, layerId, form) {
    const r = await rpc("rsvp_owner_sync_event", { p_slug: slug, p_doc_id: docId, p_layer_id: layerId, p_form: form }, true);
    if (r && r.panel_token) safeSet(PANEL_KEY_PREFIX + slug, r.panel_token);
    return r;
  }

  async function ownerRotatePanelToken(slug) {
    const r = await rpc("rsvp_owner_rotate_panel_token", { p_slug: slug }, true);
    if (r && r.panel_token) safeSet(PANEL_KEY_PREFIX + slug, r.panel_token);
    return r;
  }

  async function ownerSetOpen(slug, open) {
    return rpc("rsvp_owner_set_open", { p_slug: slug, p_open: !!open }, true);
  }

  /* Bu tarayıcıda saklı panel anahtarı. */
  function getStoredPanelToken(slug) { return safeGet(PANEL_KEY_PREFIX + slug); }

  /* Müşteri paneli linki: davetli linkiyle AYNI sitede panel.html#k=ANAHTAR.
     Anahtar "#" sonrasında olduğu için sunucuya/kayıtlara gönderilmez. */
  function panelUrl(slug, token) {
    token = token || getStoredPanelToken(slug);
    if (!slug || !token) return "";
    let base;
    try {
      base = new URL(global.SeozCloudStore.customerUrl(slug));
    } catch (e) {
      base = new URL("view.html", global.location.href);
    }
    const u = new URL("panel.html", base);
    u.hash = "k=" + token;
    return u.href;
  }

  /* ---------------- ANI ALBÜMÜ (Anı Yükle · Studio SEOZ depolaması) ---------------- */
  const ALBUM_KEY_PREFIX = "seoz_album_panel_v1_";   // + slug (yalnızca editör tarayıcısı)
  /* eventDate: "YYYY-AA-GG" (davetiyedeki Geri Sayım / Takvime Ekle tarihi) — albümün saklama bilgisi için.
     Supabase'de ani-albumu-yonetim.sql henüz kurulmamışsa eski çağrıya düşer (yayın aynen çalışır). */
  async function ownerMemorySync(slug, eventDate) {
    let r;
    try { r = await rpc("memory_owner_sync", eventDate ? { p_slug: slug, p_event_date: eventDate } : { p_slug: slug }, true); }
    catch (e) {
      if (!eventDate || !/PGRST202|Could not find|p_event_date/i.test(String(e && (e.code || e.message)))) throw e;
      r = await rpc("memory_owner_sync", { p_slug: slug }, true);
    }
    if (r && r.panel_token) safeSet(ALBUM_KEY_PREFIX + slug, r.panel_token);
    return r;
  }
  const ownerAlbumInfo = slug => rpc("memory_owner_album_info", { p_slug: slug }, true);
  const ownerAlbumSettings = (slug, eventDate, retentionDays) =>
    rpc("memory_owner_album_settings", { p_slug: slug, p_event_date: eventDate || null, p_retention_days: retentionDays || null }, true);

  /* "Albüm Verilerini Sil" (yalnızca Studio SEOZ): 1) "ani-yukleme/<slug>/" klasöründeki bütün dosyalar
     Storage'dan silinir, 2) klasörün boş olduğu doğrulanır, 3) albüm kayıtları temizlenir.
     YALNIZCA "ani-yukleme" bucket'ı ve YALNIZCA bu davetiyenin klasörü; başka hiçbir dosyaya dokunmaz.
     Bir adım başarısız olursa durur (kayıtlar silinmez → tekrar denenebilir). onStep(metin) ilerleme. */
  const ALBUM_BUCKET = "ani-yukleme";
  async function ownerStorage(path, body, method) {
    const token = global.SeozCloudStore.getAccessToken ? await global.SeozCloudStore.getAccessToken().catch(() => null) : null;
    if (!token) { const e = new Error("auth_required"); e.code = "AUTH_REQUIRED"; throw e; }
    let res;
    try {
      res = await fetch(`${baseUrl()}/storage/v1/${path}`, { method: method || "POST",
        headers: { apikey: anonKey(), Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } catch (netErr) { const e = new Error("network"); e.code = "network"; throw e; }
    const t = await res.text();
    if (!res.ok) { const e = new Error(errorCode(t) || ("HTTP " + res.status)); e.code = "storage"; throw e; }
    return t ? JSON.parse(t) : null;
  }
  async function listAlbumFiles(slug) {
    const out = [];
    for (let offset = 0; offset < 50000; offset += 1000) {
      const page = await ownerStorage(`object/list/${ALBUM_BUCKET}`, { prefix: slug, limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
      (page || []).forEach(o => { if (o && o.name && o.id !== null) out.push(slug + "/" + o.name); });
      if (!page || page.length < 1000) break;
    }
    return out;
  }
  const SAFE_SLUG = /^[a-z0-9](?:[a-z0-9-]{1,118}[a-z0-9])$/;
  async function ownerAlbumPurge(slug, onStep) {
    if (!SAFE_SLUG.test(String(slug || ""))) throw new Error("invalid_slug");
    const step = t => { if (onStep) onStep(t); };
    step("Dosyalar listeleniyor…");
    const files = await listAlbumFiles(slug);
    if (files.some(p => p.split("/")[0] !== slug || p.split("/").length !== 2)) throw new Error("unexpected_path");
    let deleted = 0;
    for (let i = 0; i < files.length; i += 100) {
      const part = files.slice(i, i + 100);
      step(`Dosyalar siliniyor… ${Math.min(i + part.length, files.length)}/${files.length}`);
      const r = await ownerStorage(`object/${ALBUM_BUCKET}`, { prefixes: part }, "DELETE");
      deleted += Array.isArray(r) ? r.length : 0;
    }
    step("Kontrol ediliyor…");
    const left = await listAlbumFiles(slug);
    if (left.length) { const e = new Error(`${left.length} dosya depodan silinemedi`); e.code = "storage_not_empty"; e.deleted = deleted; throw e; }
    step("Albüm kayıtları temizleniyor…");
    const r = await rpc("memory_owner_purge", { p_slug: slug }, true);
    return { deletedFiles: deleted, removedRecords: r && r.removed_records };
  }

  /* TESLİMAT PAKETİ: mevcut üç bağlantıyı tek sayfada toplar (paket.html#i=davetiye&a=albüm&r=panel).
     Yeni anahtar üretmez; albüm/panel anahtarları bu tarayıcıda kayıtlı olanlardır. "#" sonrası sunucuya gitmez. */
  function packageUrl(slug, opts) {
    if (!slug) return "";
    opts = opts || {};
    let b; try { b = new URL(global.SeozCloudStore.customerUrl(slug)); } catch (e) { b = new URL("view.html", global.location.href); }
    const q = ["i=" + encodeURIComponent(slug)];
    const a = opts.album && safeGet(ALBUM_KEY_PREFIX + slug), r = opts.panel && getStoredPanelToken(slug);
    if (a) q.push("a=" + a);
    if (r) q.push("r=" + r);
    const u = new URL("paket.html", b); u.hash = q.join("&"); return u.href;
  }
  async function ownerMemoryRotate(slug) {
    const r = await rpc("memory_owner_rotate_token", { p_slug: slug }, true);
    if (r && r.panel_token) safeSet(ALBUM_KEY_PREFIX + slug, r.panel_token);
    return r;
  }
  function albumUrl(slug, token) {
    token = token || safeGet(ALBUM_KEY_PREFIX + slug);
    if (!slug || !token) return "";
    let b; try { b = new URL(global.SeozCloudStore.customerUrl(slug)); } catch (e) { b = new URL("view.html", global.location.href); }
    const u = new URL("album.html", b); u.hash = "k=" + token; return u.href;
  }

  /* ---------------- ANKET (Studio SEOZ sistemi) ---------------- */
  const POLL_VOTE_PREFIX = "seoz_poll_vote_v1_";    // + slug + "_" + layerId (katılımcının tarayıcısı)
  const POLL_PANEL_PREFIX = "seoz_poll_panel_v1_";  // + slug + "_" + layerId (yalnızca editör tarayıcısı)
  async function pollSubmit(slug, layerId, payload) {
    const k = POLL_VOTE_PREFIX + slug + "_" + (layerId || "");
    const r = await rpc("poll_submit", { p_slug: slug, p_layer_id: layerId, p_payload: payload, p_voter_token: safeGet(k) || null });
    if (r && r.voter_token) safeSet(k, r.voter_token);
    return r;
  }
  const pollHasVoted = (slug, layerId) => !!safeGet(POLL_VOTE_PREFIX + slug + "_" + (layerId || ""));
  async function pollGetOwn(slug, layerId) {
    const tok = safeGet(POLL_VOTE_PREFIX + slug + "_" + (layerId || ""));
    return tok ? rpc("poll_get_own", { p_slug: slug, p_layer_id: layerId, p_voter_token: tok }) : null;
  }
  async function ownerPollSync(slug, layerId, form) {
    const r = await rpc("poll_owner_sync", { p_slug: slug, p_layer_id: layerId, p_form: form }, true);
    if (r && r.panel_token) safeSet(POLL_PANEL_PREFIX + slug + "_" + layerId, r.panel_token);
    return r;
  }
  async function ownerPollRotate(slug, layerId) {
    const r = await rpc("poll_owner_rotate_token", { p_slug: slug, p_layer_id: layerId }, true);
    if (r && r.panel_token) safeSet(POLL_PANEL_PREFIX + slug + "_" + layerId, r.panel_token);
    return r;
  }
  // Salt okunur sonuç linki: her çağrı YENİ link üretir (eskisi geçersiz olur). Yalnızca toplu oylar görünür.
  async function ownerPollViewLink(slug, layerId) {
    const r = await rpc("poll_owner_view_token", { p_slug: slug, p_layer_id: layerId }, true);
    if (!r || !r.view_token) return "";
    let b; try { b = new URL(global.SeozCloudStore.customerUrl(slug)); } catch (e) { b = new URL("view.html", global.location.href); }
    const u = new URL("anket-sonuc.html", b); u.hash = "g=" + r.view_token; return u.href;
  }
  function pollPanelUrl(slug, layerId, token) {
    token = token || safeGet(POLL_PANEL_PREFIX + slug + "_" + layerId);
    if (!slug || !token) return "";
    let b; try { b = new URL(global.SeozCloudStore.customerUrl(slug)); } catch (e) { b = new URL("view.html", global.location.href); }
    const u = new URL("anket-panel.html", b); u.hash = "k=" + token; return u.href;
  }

  global.SeozEventStore = {
    pollSubmit,
    pollHasVoted,
    pollGetOwn,
    ownerPollSync,
    ownerPollRotate,
    pollPanelUrl,
    ownerPollViewLink,
    ownerMemorySync,
    ownerMemoryRotate,
    ownerAlbumInfo,
    ownerAlbumSettings,
    ownerAlbumPurge,
    packageUrl,
    albumUrl,
    isConfigured,
    submitResponse,
    getOwnResponse,
    getGuestToken,
    ownerSyncEvent,
    ownerRotatePanelToken,
    ownerSetOpen,
    getStoredPanelToken,
    panelUrl
  };
})(window);
