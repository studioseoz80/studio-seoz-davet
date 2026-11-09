/* =============================================================================
   STUDIO SEOZ — package-app.js  (TESLİMAT PAKETİ: paket.html#i=DAVETİYE&a=ALBÜM&r=PANEL)
   Müşteriye tek sayfada: Davetiye + Anı Albümü + Katılım Paneli bağlantıları.
   - YENİ LİNK SİSTEMİ YOK: mevcut kısa davetiye linki, album.html#k=... ve panel.html#k=...
     bağlantıları gösterilir. Anahtarlar "#" sonrasında olduğu için sunucuya gitmez.
   - Dil: davetiyenin dili (meta.lang "en" → İngilizce; yoksa Türkçe).
   - Davetiyede modül yoksa ya da anahtar yoksa o bölüm hiç görünmez.
   - Anı Albümü bölümünde saklama bilgisi yalnızca yeni albümlerde (Supabase: retention_days) görünür.
   ========================================================================= */
(function (global) {
  "use strict";
  const root = document.getElementById("pkg-root");
  const cfg = global.SEOZ_SUPABASE_CONFIG || {};
  const base = String(cfg.url || "").replace(/\/+$/, ""), key = String(cfg.anonKey || "");
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,118}[a-z0-9])$/, TOKEN_RE = /^[A-Za-z0-9_-]{20,100}$/;

  const TXT = {
    en: {
      brand: "STUDIO SEOZ", head: "Your Invitation Package", loading: "Loading your package...",
      note: "The Invitation link can be shared with your guests. Memory Album and RSVP Dashboard links are for you only.",
      inv: "Invitation", invDesc: "Share this link with your guests.", invOpen: "Open Invitation",
      album: "Memory Album", albumDesc: "View, download and manage the memories uploaded by your guests.", albumOpen: "Open Memory Album",
      albumKeep: "Your Memory Album will be stored for 30 days after your event date. Please download your photos and videos before the storage period ends.",
      albumGone: "Memory Album Expired — the 30-day storage period for this event has ended.", albumRemoved: "The photos and videos in this album have been deleted.",
      panel: "RSVP Dashboard", panelDesc: "View guest responses and manage your guest list.", panelOpen: "Open RSVP Dashboard",
      guests: "For your guests", you: "For you only",
      copy: "Copy Link", copyAll: "Copy All Links", copied: "Copied ✓",
      badT: "Package link incomplete", bad: "Please open this page with the link Studio SEOZ sent you.",
      missT: "Invitation not found", miss: "This invitation hasn't been published yet or couldn't be found.",
      failT: "We couldn't open your package right now", fail: "Please check your internet connection and refresh the page.",
      copyManual: "Copy the links:"
    },
    tr: {
      brand: "STUDIO SEOZ", head: "Teslimat Paketiniz", loading: "Paketiniz yükleniyor...",
      note: "Davetiye bağlantısı misafirlerinizle paylaşılabilir. Anı Albümü ve Katılım Paneli bağlantıları yalnızca size özeldir.",
      inv: "Davetiye", invDesc: "Bu bağlantıyı misafirlerinizle paylaşın.", invOpen: "Davetiyeyi Aç",
      album: "Anı Albümü", albumDesc: "Misafirlerinizin yüklediği anıları görüntüleyin, indirin ve yönetin.", albumOpen: "Albümü Aç",
      albumKeep: "Anı Albümünüz etkinlik tarihinden sonra 30 gün boyunca saklanır. Fotoğraf ve videolarınızı süre dolmadan indiriniz.",
      albumGone: "Anı Albümünün Süresi Doldu — bu etkinlik için 30 günlük saklama süresi sona erdi.", albumRemoved: "Bu albümdeki fotoğraf ve videolar silindi.",
      panel: "Katılım Paneli", panelDesc: "Misafir yanıtlarını görüntüleyin ve davetli listenizi yönetin.", panelOpen: "Katılım Panelini Aç",
      guests: "Misafirler için", you: "Yalnızca size özel",
      copy: "Linki Kopyala", copyAll: "Tüm Linkleri Kopyala", copied: "Kopyalandı ✓",
      badT: "Paket linki eksik", bad: "Bu sayfayı Studio SEOZ'un size gönderdiği linkle açın.",
      missT: "Davetiye bulunamadı", miss: "Bu davetiye henüz yayınlanmadı ya da bulunamadı.",
      failT: "Paketiniz şu anda açılamadı", fail: "İnternet bağlantınızı kontrol edip sayfayı yenileyin.",
      copyManual: "Bağlantıları kopyalayın:"
    }
  };

  function params() {
    const h = String(global.location.hash || "").replace(/^#/, ""), o = {};
    h.split("&").forEach(p => { const i = p.indexOf("="); if (i > 0) o[p.slice(0, i)] = decodeURIComponent(p.slice(i + 1)); });
    return { slug: SLUG_RE.test(o.i || "") ? o.i : "", album: TOKEN_RE.test(o.a || "") ? o.a : "", panel: TOKEN_RE.test(o.r || "") ? o.r : "" };
  }
  const hdr = { apikey: key, Authorization: "Bearer " + key };
  async function loadDoc(slug) {
    const res = await fetch(`${base}/rest/v1/published_invitations?slug=eq.${encodeURIComponent(slug)}&select=document_data&limit=1`, { headers: hdr });
    if (!res.ok) throw new Error("http " + res.status);
    const rows = await res.json();
    return Array.isArray(rows) && rows[0] ? rows[0].document_data : null;
  }
  async function albumInfo(token) {
    try {
      const res = await fetch(`${base}/rest/v1/rpc/memory_panel_get`, { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, hdr), body: JSON.stringify({ p_token: token }) });
      return res.ok ? await res.json() : null;
    } catch (e) { return null; }
  }
  function message(t, title, text) {
    root.innerHTML = `<div class="pn-message"><h2>${esc(title)}</h2><p>${esc(text)}</p></div>`;
  }
  function copy(text, btn, t) {
    const done = () => { const old = btn.textContent; btn.textContent = t.copied; btn.classList.add("is-done"); setTimeout(() => { btn.textContent = old; btn.classList.remove("is-done"); }, 1800); };
    const fallback = () => {
      const ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      ta.remove(); if (ok) done(); else global.prompt(t.copyManual, text);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
  }

  async function start() {
    const p = params();
    const pre = /[#&]lang=en\b/i.test(String(global.location.hash || "")) ? TXT.en : TXT.tr;
    root.querySelector(".pn-loading").textContent = pre.loading;
    if (!p.slug) return message(pre, pre.badT, pre.bad);
    let doc;
    try { doc = await loadDoc(p.slug); } catch (e) { return message(pre, pre.failT, pre.fail); }
    if (!doc) return message(pre, pre.missT, pre.miss);
    const en = doc.meta && doc.meta.lang === "en", t = en ? TXT.en : TXT.tr, lang = en ? "en" : "tr";
    document.documentElement.lang = lang;
    document.title = (en ? "Your Invitation Package" : "Teslimat Paketi") + " — Studio SEOZ";
    const layers = Array.isArray(doc.layers) ? doc.layers : [];
    const has = id => layers.some(l => l && l.type === "module" && l.moduleId === id && (id !== "guest-upload" || (l.settings && l.settings.method === "seoz")));
    const site = global.location.origin;
    const links = { inv: `${site}/${p.slug}` };
    if (p.album && has("guest-upload")) links.album = `${site}/album.html#k=${p.album}${en ? "&lang=en" : ""}`;
    if (p.panel && has("attendance-form")) links.panel = `${site}/panel.html#k=${p.panel}${en ? "&lang=en" : ""}`;
    const al = links.album ? await albumInfo(p.album) : null;
    const title = (doc.meta && doc.meta.title) || "";

    const section = (k, name, desc, open, href, who, extra, hideOpen) => `
      <section class="pk-card" data-pk="${k}">
        <div class="pk-card-top"><h2>${esc(name)}</h2><span class="pk-who ${k === "inv" ? "pk-who-guests" : ""}">${esc(who)}</span></div>
        <p class="pk-desc">${esc(desc)}</p>${extra || ""}
        ${hideOpen ? "" : `<div class="pk-actions"><a class="pk-btn primary" href="${esc(href)}" target="_blank" rel="noopener" data-pk-open>${esc(open)}</a>
          <button type="button" class="pk-btn" data-pk-copy="${k}">${esc(t.copy)}</button></div>`}
      </section>`;
    let albumExtra = "", albumGone = false;
    if (links.album && al) {
      if (al.purged) { albumGone = true; albumExtra = `<p class="pk-keep pk-gone">${esc(al.retention_days ? t.albumGone : t.albumRemoved)}</p>`; }
      else if (al.retention_days) albumExtra = `<p class="pk-keep" data-pk-keep>${esc(t.albumKeep)}</p>`;
    }
    root.innerHTML = `
      <header class="pk-head">
        <div class="pn-brand">${esc(t.brand)}</div>
        <h1 class="pk-title">${esc(t.head)}</h1>
        ${title ? `<p class="pk-sub">${esc(title)}</p>` : ""}
      </header>
      ${links.album || links.panel ? `<p class="pk-note" data-pk-note>${esc(t.note)}</p>` : ""}
      ${section("inv", t.inv, t.invDesc, t.invOpen, links.inv, t.guests)}
      ${links.album ? section("album", t.album, t.albumDesc, t.albumOpen, links.album, t.you, albumExtra, albumGone) : ""}
      ${links.panel ? section("panel", t.panel, t.panelDesc, t.panelOpen, links.panel, t.you) : ""}
      <button type="button" class="pk-btn primary pk-all" data-pk-all>${esc(t.copyAll)}</button>`;
    const allText = () => {
      const rows = [t.head + (title ? " — " + title : ""), ""];
      rows.push(t.inv + ": " + links.inv);
      if (links.album && !albumGone) rows.push(t.album + ": " + links.album);
      if (links.panel) rows.push(t.panel + ": " + links.panel);
      return rows.join("\n");
    };
    root.addEventListener("click", e => {
      const c = e.target.closest("[data-pk-copy]"); if (c) return copy(links[c.dataset.pkCopy], c, t);
      const a = e.target.closest("[data-pk-all]"); if (a) return copy(allText(), a, t);
    });
  }
  start();
  global.addEventListener("hashchange", () => global.location.reload());
})(window);
