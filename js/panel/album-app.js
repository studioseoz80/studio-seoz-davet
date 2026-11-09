/* =============================================================================
   STUDIO SEOZ — album-app.js  (MÜŞTERİ ANI ALBÜMÜ: album.html#k=ANAHTAR)
   Misafirlerin "Anı Yükle" ile Studio SEOZ depolamasına yüklediği fotoğraf ve videolar.
   Erişim yalnızca gizli anahtarla (Supabase: memory_panel_get). 20 sn'de bir kendiliğinden yenilenir.
   - Dil: davetiyenin dili (Supabase'den gelen "lang"; yoksa linkteki &lang=en (Katılım Paneli ile aynı); yoksa Türkçe —
     Türkçe albümler eskisi gibi).
   - Saklama bilgisi: yeni albümlerde "etkinlikten sonra 30 gün" notu (yalnızca bilgi; kendiliğinden
     hiçbir şey silinmez). Studio SEOZ albüm verilerini sildiyse yalnızca bilgi mesajı görünür.
   - Kaldır: dosya listeden kalkar VE depodan (Supabase Storage) da silinir.
   ========================================================================= */
(function (global) {
  "use strict";
  const root = document.getElementById("album-root");
  const cfg = global.SEOZ_SUPABASE_CONFIG || {};
  const base = String(cfg.url || "").replace(/\/+$/, ""), key = String(cfg.anonKey || "");
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const tokenOf = () => { const m = String(global.location.hash || "").match(/[#&]k=([A-Za-z0-9_\-]{20,100})/); return m ? m[1] : ""; };
  const hashLang = () => (/[#&]lang=en\b/i.test(String(global.location.hash || "")) ? "en" : "tr");
  const fileUrl = p => `${base}/storage/v1/object/public/ani-yukleme/${p.split("/").map(encodeURIComponent).join("/")}`;
  let data = null, timer = 0;

  /* Türkçe metinler eskisiyle BİREBİR aynı; İngilizce davetiyenin albümü İngilizce. */
  const TXT = {
    tr: {
      brand: "STUDIO SEOZ · ANI ALBÜMÜ", album: "Anı Albümü", loading: "Albüm yükleniyor...",
      sub: (n, p, v) => `${n} dosya · ${p} fotoğraf · ${v} video · kendiliğinden yenilenir`,
      open: "● Yüklemeye açık", closed: "● Yüklemeye kapalı", close: "Yüklemeyi kapat", reopen: "Yüklemeyi aç",
      zip: "Tümünü indir (ZIP)", zipPrep: (i, n) => `Hazırlanıyor ${i}/${n}…`, zipFail: "ZIP hazırlanamadı. Dosyaları tek tek indirebilirsiniz.",
      video: "Video", dl: "İndir", rm: "Kaldır", x: "Kapat",
      empty: `Henüz yüklenen anı yok.<br>Misafirler davetiyedeki "Anı Yükle" düğmesiyle fotoğraf ve video ekledikçe burada görünecek.`,
      dlFail: "İndirilemedi.",
      rmAsk: "Bu dosya albümden kalıcı olarak silinsin mi? Bu işlem geri alınamaz.",
      rmPartly: "Dosya albüm listesinden kaldırıldı ancak depodan silinemedi. Studio SEOZ'a bildirebilirsiniz.",
      retention: "Anı Albümünüz etkinlik tarihinden sonra 30 gün boyunca saklanır. Fotoğraf ve videolarınızı süre dolmadan indiriniz.",
      noLinkT: "Albüm linki eksik", noLink: "Bu sayfayı Studio SEOZ'un size gönderdiği albüm linkiyle açın.",
      badT: "Albüm linki geçersiz", bad: "Bu link yenilenmiş ya da hatalı olabilir. Studio SEOZ'dan güncel linki isteyin.",
      failT: "Albüm şu anda açılamadı", fail: "İnternet bağlantınızı kontrol edip sayfayı yenileyin.",
      expiredT: "Anı Albümünün Süresi Doldu", expired: "Bu etkinlik için 30 günlük saklama süresi sona erdi.",
      removedT: "Anı Albümü Kaldırıldı", removed: "Bu albümdeki fotoğraf ve videolar silindi.",
      locale: "tr-TR", zipName: "-anilar.zip"
    },
    en: {
      brand: "STUDIO SEOZ · MEMORY ALBUM", album: "Memory Album", loading: "Loading your album...",
      sub: (n, p, v) => `${n} ${n === 1 ? "file" : "files"} · ${p} ${p === 1 ? "photo" : "photos"} · ${v} ${v === 1 ? "video" : "videos"} · updates automatically`,
      open: "● Open for uploads", closed: "● Closed for uploads", close: "Close uploads", reopen: "Open uploads",
      zip: "Download all (ZIP)", zipPrep: (i, n) => `Preparing ${i}/${n}…`, zipFail: "We couldn't create the ZIP file. You can download the files one by one.",
      video: "Video", dl: "Download", rm: "Remove", x: "Close",
      empty: `No memories uploaded yet.<br>Photos and videos will appear here as your guests add them with the "Upload" button on the invitation.`,
      dlFail: "Download failed.",
      rmAsk: "Delete this file from the album permanently? This can't be undone.",
      rmPartly: "The file was removed from the album list but couldn't be deleted from storage. Please let Studio SEOZ know.",
      retention: "Your Memory Album will be stored for 30 days after your event date. Please download your photos and videos before the storage period ends.",
      noLinkT: "Album link missing", noLink: "Please open this page with the album link Studio SEOZ sent you.",
      badT: "Invalid album link", bad: "This link may have been renewed or mistyped. Please ask Studio SEOZ for the current link.",
      failT: "We couldn't open the album right now", fail: "Please check your internet connection and refresh the page.",
      expiredT: "Memory Album Expired", expired: "The 30-day storage period for this event has ended.",
      removedT: "Memory Album Removed", removed: "The photos and videos in this album have been deleted.",
      locale: "en-US", zipName: "-memories.zip"
    }
  };
  const lang = () => (data && data.lang === "en") || (!data && hashLang() === "en") ? "en" : "tr";
  const T = () => TXT[lang()];
  if (hashLang() === "en") {
    document.documentElement.lang = "en"; document.title = "Memory Album — Studio SEOZ";
    const l = root.querySelector(".pn-loading"); if (l) l.textContent = TXT.en.loading;
  }

  async function rpc(name, args) {
    const res = await fetch(`${base}/rest/v1/rpc/${name}`, { method: "POST", headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" }, body: JSON.stringify(args) });
    const t = await res.text();
    if (!res.ok) { const e = new Error(t); e.code = /invalid_token/.test(t) ? "invalid" : "server"; throw e; }
    return t ? JSON.parse(t) : null;
  }
  /* Kaldırılan dosyayı depodan siler: Supabase bu dosya için kısa süreli silme izni verdikten sonra
     (memory_panel_remove). Başka hiçbir dosya silinemez. */
  async function deleteFromStorage(path) {
    if (!path) return false;
    try {
      const res = await fetch(`${base}/storage/v1/object/ani-yukleme`, { method: "DELETE",
        headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" }, body: JSON.stringify({ prefixes: [path] }) });
      if (!res.ok) return false;
      const out = await res.json().catch(() => null);
      return Array.isArray(out) && out.some(o => o && o.name === path);
    } catch (e) { return false; }
  }
  function message(title, text) { root.innerHTML = `<div class="pn-message"><h2>${esc(title)}</h2><p>${text}</p></div>`; }
  const fmtSize = b => (b > 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB");
  const fmtTime = s => { try { return new Date(s).toLocaleString(T().locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } };

  function draw() {
    const t = T();
    document.documentElement.lang = lang();
    if (lang() === "en") document.title = "Memory Album — Studio SEOZ";
    if (data.purged) return message(data.retention_days ? t.expiredT : t.removedT, esc(data.retention_days ? t.expired : t.removed));
    const f = data.files || [], photos = f.filter(x => /^image\//.test(x.mime)).length;
    root.innerHTML = `
      <div class="pn-brand">${esc(t.brand)}</div>
      <div class="pn-head"><div><h1 class="pn-title">${esc(data.title || t.album)}</h1>
        <div class="pn-sub">${esc(t.sub(f.length, photos, f.length - photos))}</div></div>
        <div class="pn-head-actions">
          <span class="pn-pill ${data.is_open ? "open" : "closed"}">${data.is_open ? t.open : t.closed}</span>
          <button class="pn-btn" data-al-open>${data.is_open ? t.close : t.reopen}</button>
          <button class="pn-btn primary" data-al-zip ${f.length ? "" : "disabled"}>${esc(t.zip)}</button>
        </div></div>
      ${data.retention_days ? `<div class="pn-alert al-retention" data-al-retention>${esc(t.retention)}</div>` : ""}
      ${f.length ? `<div class="al-grid">${f.map((x, i) => `
        <div class="al-item">${/^video\//.test(x.mime) ? `<video class="al-media" src="${esc(fileUrl(x.path))}#t=0.1" preload="metadata" muted playsinline data-al-show="${i}"></video><span class="al-badge">${esc(t.video)}</span>`
          : `<img class="al-media" loading="lazy" alt="" src="${esc(fileUrl(x.path))}" data-al-show="${i}">`}
          <div class="al-meta"><span>${esc(fmtTime(x.at))} · ${fmtSize(x.size || 0)}</span><span><button data-al-dl="${i}">${esc(t.dl)}</button> · <button class="al-rm" data-al-rm="${i}">${esc(t.rm)}</button></span></div></div>`).join("")}</div>`
        : `<div class="al-empty">${t.empty}</div>`}`;
  }
  async function download(x) {
    const blob = await (await fetch(fileUrl(x.path))).blob();
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = x.path.split("/").pop(); document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  function loadZip() {
    return global.JSZip ? Promise.resolve(global.JSZip) : new Promise((res, rej) => {
      const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"; s.onload = () => res(global.JSZip); s.onerror = rej; document.head.appendChild(s);
    });
  }
  async function zipAll(btn) {
    const files = data.files || [], t = T(); btn.disabled = true;
    try {
      const JSZip = await loadZip(), zip = new JSZip();
      for (let i = 0; i < files.length; i++) { btn.textContent = t.zipPrep(i + 1, files.length); zip.file(files[i].path.split("/").pop(), await (await fetch(fileUrl(files[i].path))).blob()); }
      const blob = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = (data.slug || "ani-albumu") + t.zipName; document.body.appendChild(a); a.click(); a.remove();
    } catch (e) { alert(t.zipFail); }
    btn.disabled = false; btn.textContent = t.zip;
  }
  root.addEventListener("click", e => {
    const el = e.target.closest("[data-al-show],[data-al-dl],[data-al-rm],[data-al-open],[data-al-zip]"); if (!el) return;
    const f = data.files || [], t = T();
    if (el.dataset.alShow != null) {
      const x = f[+el.dataset.alShow], v = document.createElement("div"); v.className = "al-view";
      v.innerHTML = (/^video\//.test(x.mime) ? `<video src="${esc(fileUrl(x.path))}" controls autoplay playsinline></video>` : `<img src="${esc(fileUrl(x.path))}" alt="">`) + `<button class="al-close" aria-label="${esc(t.x)}">×</button>`;
      v.addEventListener("click", ev => { if (ev.target === v || ev.target.classList.contains("al-close")) v.remove(); }); document.body.appendChild(v);
    } else if (el.dataset.alDl != null) download(f[+el.dataset.alDl]).catch(() => alert(t.dlFail));
    else if (el.dataset.alRm != null) {
      if (!confirm(t.rmAsk)) return;
      const x = f[+el.dataset.alRm];
      rpc("memory_panel_remove", { p_token: tokenOf(), p_id: x.id })
        // Supabase'de ani-albumu-yonetim.sql kuruluysa yanıtta "path" gelir → dosya depodan da silinir.
        .then(r => (r && "path" in r && r.path ? deleteFromStorage(r.path).then(ok => { if (!ok) alert(t.rmPartly); }) : null))
        .then(load, load);
    } else if (el.dataset.alOpen != null) rpc("memory_panel_set_open", { p_token: tokenOf(), p_open: !data.is_open }).then(load);
    else if (el.dataset.alZip != null) zipAll(el);
  });
  async function load() {
    const tok = tokenOf();
    if (!tok) { const t = T(); return message(t.noLinkT, esc(t.noLink)); }
    try {
      const d = await rpc("memory_panel_get", { p_token: tok });
      const changed = !data || JSON.stringify(d) !== JSON.stringify(data);
      data = d; if (changed) draw();
    } catch (e) {
      const t = T();
      if (e.code === "invalid") return message(t.badT, esc(t.bad));
      if (!data) message(t.failT, esc(t.fail));
    }
  }
  load(); timer = setInterval(load, 20000);
  global.addEventListener("hashchange", () => { data = null; load(); });
})(window);
