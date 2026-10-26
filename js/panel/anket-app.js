/* =============================================================================
   STUDIO SEOZ — anket-app.js  (ANKET SONUÇ PANELİ: anket-panel.html#k=ANAHTAR)
   -----------------------------------------------------------------------------
   "Studio SEOZ sistemi" yöntemli anketin sonuçları. Erişim yalnızca gizli anahtarla
   (Supabase: poll_panel_get). 5 saniyede bir kendiliğinden yenilenir (canlı).
   - Özet kartları, her soru için çubuk grafik (Grafik/Tablo), görüşler, yanıt listesi
   - Yanıtlara aç/kapat, yanıt silme, Excel uyumlu CSV
   - Ankete doğrudan götüren QR kod (PNG indirilebilir) ve bağlantı
   Katılım paneli (panel.html) ve masa planından tamamen bağımsızdır.
   ========================================================================= */
(function (global) {
  "use strict";
  const root = document.getElementById("anket-root");
  const cfg = global.SEOZ_SUPABASE_CONFIG || {};
  const base = String(cfg.url || "").replace(/\/+$/, ""), key = String(cfg.anonKey || "");
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const tokenOf = () => { const m = String(global.location.hash || "").match(/[#&]k=([A-Za-z0-9_\-]{20,100})/); return m ? m[1] : ""; };
  const TYPE = { choice: "Tek seçim", multi: "Birden çok seçim", yesno: "Evet / Hayır" };
  const fmt = n => Number(n).toLocaleString("tr-TR");
  const pct = (v, b) => (b ? Math.round((v / b) * 100) : 0);
  let data = null, views = {}, lastSig = "", failCount = 0;

  async function rpc(name, args) {
    const res = await fetch(`${base}/rest/v1/rpc/${name}`, { method: "POST", headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" }, body: JSON.stringify(args) });
    const t = await res.text();
    if (!res.ok) { const e = new Error(t); e.code = /invalid_token/.test(t) ? "invalid" : "server"; throw e; }
    return t ? JSON.parse(t) : null;
  }
  function message(title, text) { root.innerHTML = `<div class="pn-message"><h2>${esc(title)}</h2><p>${text}</p></div>`; }
  const surveyUrl = () => `${global.location.origin}/${data.slug}#anket${data.layer_index > 1 ? "-" + data.layer_index : ""}`;
  const optLabel = (q, id) => { const o = (q.options || []).find(x => x.id === id); return o ? (o.text || (q.type === "yesno" ? (id === "yes" ? "Evet" : "Hayır") : id)) : id; };
  const answerText = (q, v) => (Array.isArray(v) ? v.map(id => optLabel(q, id)).join(", ") : v == null ? "" : optLabel(q, v));

  function dist(q, list) {
    const answered = list.filter(r => { const v = (r.answers || {})[q.id]; return v != null && !(Array.isArray(v) && !v.length); });
    const rows = (q.options || []).map(o => ({ label: optLabel(q, o.id), value: answered.filter(r => { const v = r.answers[q.id]; return Array.isArray(v) ? v.indexOf(o.id) >= 0 : v === o.id; }).length }));
    return { rows, base: answered.length };
  }
  function bars(rows, b) {
    const max = Math.max(1, ...rows.map(r => r.value));
    return `<div class="pn-bars" role="list">${rows.map(r => {
      const tip = `${r.label}: ${fmt(r.value)} yanıt (%${pct(r.value, b)})`;
      return `<div class="pn-bar-row" role="listitem" tabindex="0" title="${esc(tip)}" aria-label="${esc(tip)}"><div class="pn-bar-label">${esc(r.label)}</div>
        <div class="pn-bar-track"><div class="pn-bar" style="width:${((r.value / max) * 100).toFixed(2)}%"></div><span class="pn-bar-val">${fmt(r.value)} <span class="pn-muted">· %${pct(r.value, b)}</span></span></div></div>`;
    }).join("")}</div>`;
  }
  function table(rows, b) {
    return `<table class="pn-mini-table"><thead><tr><th>Cevap</th><th>Yanıt</th><th>Oran</th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r.label)}</td><td>${fmt(r.value)}</td><td>%${pct(r.value, b)}</td></tr>`).join("")}</tbody></table>`;
  }
  function qrCanvas(text) {
    const c = document.createElement("canvas");
    try {
      const res = global.SeozQREncoder.generateMatrix(text);
      if (!res) { c.dataset.err = "long"; return c; }   // bağlantı QR sınırını (≈106 karakter) aşıyor
      const m = res.modules, n = res.size, q = 4, s = 8;
      c.width = c.height = (n + q * 2) * s;
      const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.fillStyle = "#1E2A22";
      for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (m[r][k]) x.fillRect((k + q) * s, (r + q) * s, s, s);
    } catch (e) { c.dataset.err = "1"; }
    return c;
  }

  function draw() {
    const form = data.form || {}, qs = form.questions || [], list = data.responses || [];
    const today = new Date().toDateString(), nToday = list.filter(r => new Date(r.at).toDateString() === today).length;
    const named = form.collectName && form.collectName !== "off";
    const last = list[0] ? new Date(list[0].updated_at || list[0].at) : null;
    const comments = [];
    (form.comments || []).forEach(c => list.forEach(r => { const t = (r.comments || {})[c.id]; if (t) comments.push({ title: c.title, text: t, name: r.name, at: r.updated_at || r.at }); }));
    root.innerHTML = `
      <div class="pn-brand">STUDIO SEOZ · ANKET SONUÇLARI</div>
      <div class="pn-head"><div><h1 class="pn-title">${esc(form.title || data.invitation_title || "Anket")}</h1>
        <div class="pn-sub"><span class="ak-live"><i></i> Canlı</span> · ${fmt(list.length)} yanıt${last ? " · son yanıt " + esc(last.toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })) : ""}</div></div>
        <div class="pn-head-actions">
          <span class="pn-pill ${data.is_open ? "open" : "closed"}">${data.is_open ? "● Yanıtlara açık" : "● Yanıtlara kapalı"}</span>
          <button class="pn-btn" data-ak-open>${data.is_open ? "Anketi kapat" : "Anketi aç"}</button>
          <button class="pn-btn primary" data-ak-csv ${list.length ? "" : "disabled"}>Excel/CSV indir</button>
        </div></div>
      <div class="pn-cards ak-cards">
        <div class="pn-card"><div class="pn-card-label">Toplam yanıt</div><div class="pn-card-value" data-ak-total>${fmt(list.length)}</div></div>
        <div class="pn-card"><div class="pn-card-label">Bugün</div><div class="pn-card-value">${fmt(nToday)}</div></div>
        <div class="pn-card"><div class="pn-card-label">${named ? "İsim bırakan" : "Görüş yazan"}</div><div class="pn-card-value">${fmt(named ? list.filter(r => r.name).length : list.filter(r => Object.keys(r.comments || {}).length).length)}</div></div>
      </div>
      <div class="ak-share" data-ak-share><div data-ak-qr></div><div><b>Ankete doğrudan erişim</b>
        <p class="pn-muted" style="margin:4px 0 8px;font-size:.84rem;">QR kodu toplantı salonuna, asansöre ya da duyuru panosuna asın; okutan kişi doğrudan ankete gelir.</p>
        <input readonly value="${esc(surveyUrl())}" data-ak-url>
        <div class="ak-share-actions"><button class="pn-btn" data-ak-copy>Bağlantıyı kopyala</button><button class="pn-btn" data-ak-qrdl>QR kodu indir (PNG)</button></div></div></div>
      <div class="ak-sec-title">Sorular</div>
      <div class="pn-charts">${qs.map((q, i) => {
        const d = dist(q, list), v = views[q.id] || "chart";
        return `<section class="pn-chart" data-q="${esc(q.id)}"><div class="pn-chart-head"><div><h3>${i + 1}. ${esc(q.text)}<span class="ak-qtype">${TYPE[q.type] || TYPE.choice}</span></h3>
          <div class="pn-chart-sub">${fmt(d.base)} kişi yanıtladı${q.required === false ? " · isteğe bağlı" : ""}${q.type === "multi" ? " · yüzdeler yanıt verenlere göre (birden çok seçim)" : ""}</div></div>
          <div class="pn-seg pn-seg-sm" role="group" aria-label="Görünüm"><button data-view="chart" data-qv="${esc(q.id)}" aria-pressed="${v !== "table"}">Grafik</button><button data-view="table" data-qv="${esc(q.id)}" aria-pressed="${v === "table"}">Tablo</button></div></div>
          ${d.base ? (v === "table" ? table(d.rows, d.base) : bars(d.rows, d.base)) : `<p class="pn-muted">Henüz bu soruya cevap yok.</p>`}</section>`;
      }).join("")}</div>
      ${comments.length ? `<div class="ak-sec-title">Görüşler (${fmt(comments.length)})</div><div class="ak-comments">${comments.map(c => `<div class="ak-comment">${esc(c.text)}<small>${esc(c.title)}${c.name ? " · " + esc(c.name) : ""} · ${esc(new Date(c.at).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }))}</small></div>`).join("")}</div>` : ""}
      <div class="ak-sec-title">Yanıtlar</div>
      ${list.length ? `<div class="ak-table-wrap"><table class="ak-table"><thead><tr><th>Zaman</th>${named ? "<th>Ad</th>" : ""}${qs.map((q, i) => `<th>${i + 1}. ${esc(q.text)}</th>`).join("")}<th></th></tr></thead><tbody>
        ${list.map(r => `<tr><td>${esc(new Date(r.updated_at || r.at).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }))}</td>${named ? `<td>${esc(r.name || "—")}</td>` : ""}${qs.map(q => `<td>${esc(answerText(q, (r.answers || {})[q.id]) || "—")}</td>`).join("")}<td><button class="pn-link" data-ak-del="${esc(r.id)}">Sil</button></td></tr>`).join("")}
      </tbody></table></div>` : `<div class="al-empty pn-muted" style="text-align:center;padding:30px;background:var(--card);border:1px dashed var(--line);border-radius:var(--radius);">Henüz yanıt yok. Bağlantıyı ya da QR kodu paylaşın.</div>`}`;
    const qr = qrCanvas(surveyUrl()); qr.setAttribute("aria-label", "Anket QR kodu");
    if (qr.dataset.err) { root.querySelector("[data-ak-qr]").innerHTML = '<p class="pn-muted" style="max-width:150px;font-size:.8rem;">Bağlantı QR kod için çok uzun; bağlantıyı paylaşabilirsiniz.</p>'; const b = root.querySelector("[data-ak-qrdl]"); if (b) b.remove(); }
    else root.querySelector("[data-ak-qr]").appendChild(qr);
  }
  function csv() {
    const form = data.form || {}, qs = form.questions || [], cs = form.comments || [], named = form.collectName && form.collectName !== "off";
    const rows = [["Zaman"].concat(named ? ["Ad"] : [], qs.map(q => q.text), cs.map(c => c.title))];
    (data.responses || []).slice().reverse().forEach(r => rows.push([new Date(r.updated_at || r.at).toLocaleString("tr-TR")].concat(named ? [r.name || ""] : [], qs.map(q => answerText(q, (r.answers || {})[q.id])), cs.map(c => (r.comments || {})[c.id] || ""))));
    global.SeozPanelExport.download(global.SeozPanelExport.safeName(form.title || data.invitation_title || "anket") + "-anket.csv", rows);
  }
  root.addEventListener("click", e => {
    const t = e.target.closest("[data-view],[data-ak-open],[data-ak-csv],[data-ak-copy],[data-ak-qrdl],[data-ak-del]"); if (!t) return;
    if (t.dataset.view) { views[t.dataset.qv] = t.dataset.view; draw(); }
    else if (t.dataset.akOpen != null) rpc("poll_panel_set_open", { p_token: tokenOf(), p_open: !data.is_open }).then(() => load(true));
    else if (t.dataset.akCsv != null) csv();
    else if (t.dataset.akCopy != null) { const i = root.querySelector("[data-ak-url]"); (navigator.clipboard ? navigator.clipboard.writeText(i.value) : Promise.reject()).then(() => { t.textContent = "Kopyalandı ✓"; }, () => { i.select(); document.execCommand("copy"); }); }
    else if (t.dataset.akQrdl != null) { const c = root.querySelector("[data-ak-qr] canvas"); const a = document.createElement("a"); a.href = c.toDataURL("image/png"); a.download = "anket-qr.png"; document.body.appendChild(a); a.click(); a.remove(); }
    else if (t.dataset.akDel != null) { if (confirm("Bu yanıt silinsin mi? Geri alınamaz.")) rpc("poll_panel_delete_response", { p_token: tokenOf(), p_response_id: t.dataset.akDel }).then(() => load(true)); }
  });
  async function load(force) {
    const tok = tokenOf();
    if (!tok) return message("Panel linki eksik", "Bu sayfayı Studio SEOZ'un size gönderdiği sonuç paneli linkiyle açın.");
    try {
      const d = await rpc("poll_panel_get", { p_token: tok }); failCount = 0;
      const sig = JSON.stringify(d);
      if (force || sig !== lastSig) { lastSig = sig; data = d; draw(); }
    } catch (e) {
      if (e.code === "invalid") return message("Panel linki geçersiz", "Bu link yenilenmiş ya da hatalı olabilir. Studio SEOZ'dan güncel linki isteyin.");
      if (!data) message("Sonuçlar şu anda açılamadı", "İnternet bağlantınızı kontrol edip sayfayı yenileyin.");
      failCount++;
    }
  }
  load(true);
  setInterval(() => { if (!document.hidden) load(false); }, 5000);
  global.addEventListener("hashchange", () => { data = null; lastSig = ""; load(true); });
})(window);
