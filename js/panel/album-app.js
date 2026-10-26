/* =============================================================================
   STUDIO SEOZ — album-app.js  (MÜŞTERİ ANI ALBÜMÜ: album.html#k=ANAHTAR)
   Misafirlerin "Anı Yükle" ile Studio SEOZ depolamasına yüklediği fotoğraf ve videolar.
   Erişim yalnızca gizli anahtarla (Supabase: memory_panel_get). 20 sn'de bir kendiliğinden yenilenir.
   ========================================================================= */
(function (global) {
  "use strict";
  const root = document.getElementById("album-root");
  const cfg = global.SEOZ_SUPABASE_CONFIG || {};
  const base = String(cfg.url || "").replace(/\/+$/, ""), key = String(cfg.anonKey || "");
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const tokenOf = () => { const m = String(global.location.hash || "").match(/[#&]k=([A-Za-z0-9_\-]{20,100})/); return m ? m[1] : ""; };
  const fileUrl = p => `${base}/storage/v1/object/public/ani-yukleme/${p.split("/").map(encodeURIComponent).join("/")}`;
  let data = null, timer = 0;

  async function rpc(name, args) {
    const res = await fetch(`${base}/rest/v1/rpc/${name}`, { method: "POST", headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" }, body: JSON.stringify(args) });
    const t = await res.text();
    if (!res.ok) { const e = new Error(t); e.code = /invalid_token/.test(t) ? "invalid" : "server"; throw e; }
    return t ? JSON.parse(t) : null;
  }
  function message(title, text) { root.innerHTML = `<div class="pn-message"><h2>${esc(title)}</h2><p>${text}</p></div>`; }
  const fmtSize = b => (b > 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB");
  const fmtTime = s => { try { return new Date(s).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } };

  function draw() {
    const f = data.files || [], photos = f.filter(x => /^image\//.test(x.mime)).length;
    root.innerHTML = `
      <div class="pn-brand">STUDIO SEOZ · ANI ALBÜMÜ</div>
      <div class="pn-head"><div><h1 class="pn-title">${esc(data.title || "Anı Albümü")}</h1>
        <div class="pn-sub">${f.length} dosya · ${photos} fotoğraf · ${f.length - photos} video · kendiliğinden yenilenir</div></div>
        <div class="pn-head-actions">
          <span class="pn-pill ${data.is_open ? "open" : "closed"}">${data.is_open ? "● Yüklemeye açık" : "● Yüklemeye kapalı"}</span>
          <button class="pn-btn" data-al-open>${data.is_open ? "Yüklemeyi kapat" : "Yüklemeyi aç"}</button>
          <button class="pn-btn primary" data-al-zip ${f.length ? "" : "disabled"}>Tümünü indir (ZIP)</button>
        </div></div>
      ${f.length ? `<div class="al-grid">${f.map((x, i) => `
        <div class="al-item">${/^video\//.test(x.mime) ? `<video class="al-media" src="${esc(fileUrl(x.path))}#t=0.1" preload="metadata" muted playsinline data-al-show="${i}"></video><span class="al-badge">Video</span>`
          : `<img class="al-media" loading="lazy" alt="" src="${esc(fileUrl(x.path))}" data-al-show="${i}">`}
          <div class="al-meta"><span>${esc(fmtTime(x.at))} · ${fmtSize(x.size || 0)}</span><span><button data-al-dl="${i}">İndir</button> · <button class="al-rm" data-al-rm="${i}">Kaldır</button></span></div></div>`).join("")}</div>`
        : `<div class="al-empty">Henüz yüklenen anı yok.<br>Misafirler davetiyedeki "Anı Yükle" düğmesiyle fotoğraf ve video ekledikçe burada görünecek.</div>`}`;
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
    const files = data.files || []; btn.disabled = true;
    try {
      const JSZip = await loadZip(), zip = new JSZip();
      for (let i = 0; i < files.length; i++) { btn.textContent = `Hazırlanıyor ${i + 1}/${files.length}…`; zip.file(files[i].path.split("/").pop(), await (await fetch(fileUrl(files[i].path))).blob()); }
      const blob = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = (data.slug || "ani-albumu") + "-anilar.zip"; document.body.appendChild(a); a.click(); a.remove();
    } catch (e) { alert("ZIP hazırlanamadı. Dosyaları tek tek indirebilirsiniz."); }
    btn.disabled = false; btn.textContent = "Tümünü indir (ZIP)";
  }
  root.addEventListener("click", e => {
    const t = e.target.closest("[data-al-show],[data-al-dl],[data-al-rm],[data-al-open],[data-al-zip]"); if (!t) return;
    const f = data.files || [];
    if (t.dataset.alShow != null) {
      const x = f[+t.dataset.alShow], v = document.createElement("div"); v.className = "al-view";
      v.innerHTML = (/^video\//.test(x.mime) ? `<video src="${esc(fileUrl(x.path))}" controls autoplay playsinline></video>` : `<img src="${esc(fileUrl(x.path))}" alt="">`) + `<button class="al-close" aria-label="Kapat">×</button>`;
      v.addEventListener("click", ev => { if (ev.target === v || ev.target.classList.contains("al-close")) v.remove(); }); document.body.appendChild(v);
    } else if (t.dataset.alDl != null) download(f[+t.dataset.alDl]).catch(() => alert("İndirilemedi."));
    else if (t.dataset.alRm != null) {
      if (!confirm("Bu dosya albümden kaldırılsın mı?")) return;
      rpc("memory_panel_remove", { p_token: tokenOf(), p_id: f[+t.dataset.alRm].id }).then(load);
    } else if (t.dataset.alOpen != null) rpc("memory_panel_set_open", { p_token: tokenOf(), p_open: !data.is_open }).then(load);
    else if (t.dataset.alZip != null) zipAll(t);
  });
  async function load() {
    const tok = tokenOf();
    if (!tok) return message("Albüm linki eksik", "Bu sayfayı Studio SEOZ'un size gönderdiği albüm linkiyle açın.");
    try {
      const d = await rpc("memory_panel_get", { p_token: tok });
      const changed = !data || JSON.stringify(d) !== JSON.stringify(data);
      data = d; if (changed) draw();
    } catch (e) {
      if (e.code === "invalid") return message("Albüm linki geçersiz", "Bu link yenilenmiş ya da hatalı olabilir. Studio SEOZ'dan güncel linki isteyin.");
      if (!data) message("Albüm şu anda açılamadı", "İnternet bağlantınızı kontrol edip sayfayı yenileyin.");
    }
  }
  load(); timer = setInterval(load, 20000);
  global.addEventListener("hashchange", () => { data = null; load(); });
})(window);
