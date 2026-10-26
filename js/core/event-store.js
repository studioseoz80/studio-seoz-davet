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
  async function ownerMemorySync(slug) {
    const r = await rpc("memory_owner_sync", { p_slug: slug }, true);
    if (r && r.panel_token) safeSet(ALBUM_KEY_PREFIX + slug, r.panel_token);
    return r;
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
    ownerMemorySync,
    ownerMemoryRotate,
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
