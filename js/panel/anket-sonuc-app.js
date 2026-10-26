/* =============================================================================
   STUDIO SEOZ — anket-sonuc-app.js  (SALT OKUNUR ANKET SONUÇLARI: anket-sonuc.html#g=ANAHTAR)
   -----------------------------------------------------------------------------
   Yalnızca toplu sonuçlar: her seçeneğin oy sayısı ve toplam yanıt (Supabase: poll_view_get).
   İsim, görüş metni, yanıt listesi YOKTUR; anketi kapatma, yanıt silme, indirme YOKTUR.
   Toplantı ekranında veya vitrin demosunda herkese gösterilebilir. 5 saniyede bir yenilenir.
   ========================================================================= */
(function (global) {
  "use strict";
  const root = document.getElementById("sonuc-root");
  const cfg = global.SEOZ_SUPABASE_CONFIG || {};
  const base = String(cfg.url || "").replace(/\/+$/, ""), key = String(cfg.anonKey || "");
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const tokenOf = () => { const m = String(global.location.hash || "").match(/[#&]g=([A-Za-z0-9_\-]{20,100})/); return m ? m[1] : ""; };
  const TYPE = { choice: "Tek seçim", multi: "Birden çok seçim", yesno: "Evet / Hayır" };
  const fmt = n => Number(n).toLocaleString("tr-TR");
  const pct = (v, b) => (b ? Math.round((v / b) * 100) : 0);
  let lastSig = "";

  async function rpc(name, args) {
    const res = await fetch(`${base}/rest/v1/rpc/${name}`, { method: "POST", headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" }, body: JSON.stringify(args) });
    const t = await res.text();
    if (!res.ok) { const e = new Error(t); e.code = /invalid_token/.test(t) ? "invalid" : "server"; throw e; }
    return t ? JSON.parse(t) : null;
  }
  function message(title, text) { root.innerHTML = `<div class="pn-message"><h2>${esc(title)}</h2><p>${esc(text)}</p></div>`; }
  function bars(q) {
    const rows = (q.options || []).map(o => ({ label: o.text || (q.type === "yesno" ? (o.id === "yes" ? "Evet" : "Hayır") : o.id), value: Number(o.count) || 0 }));
    const b = Number(q.answered) || 0, max = Math.max(1, ...rows.map(r => r.value));
    return `<div class="pn-bars" role="list">${rows.map(r => {
      const tip = `${r.label}: ${fmt(r.value)} oy (%${pct(r.value, b)})`;
      return `<div class="pn-bar-row" role="listitem" tabindex="0" title="${esc(tip)}" aria-label="${esc(tip)}"><div class="pn-bar-label">${esc(r.label)}</div>
        <div class="pn-bar-track"><div class="pn-bar" style="width:${((r.value / max) * 100).toFixed(2)}%"></div><span class="pn-bar-val">${fmt(r.value)} <span class="pn-muted">· %${pct(r.value, b)}</span></span></div></div>`;
    }).join("")}</div>`;
  }
  function draw(d) {
    const last = d.last_at ? new Date(d.last_at) : null;
    root.innerHTML = `
      <div class="pn-brand">STUDIO SEOZ · CANLI ANKET SONUÇLARI</div>
      <div class="pn-head"><div><h1 class="pn-title">${esc(d.title || d.invitation_title || "Anket")}</h1>
        <div class="pn-sub"><span class="ak-live"><i></i> Canlı</span> · ${fmt(d.total)} yanıt${last ? " · son yanıt " + esc(last.toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })) : ""}</div></div>
        <div class="pn-head-actions"><span class="pn-pill ${d.is_open ? "open" : "closed"}">${d.is_open ? "● Yanıtlara açık" : "● Yanıtlara kapalı"}</span><span class="pn-pill" data-readonly>Salt okunur</span></div></div>
      <div class="pn-charts">${(d.questions || []).map((q, i) => `
        <section class="pn-chart" data-q="${esc(q.id)}"><div class="pn-chart-head"><div><h3>${i + 1}. ${esc(q.text)}<span class="ak-qtype">${TYPE[q.type] || TYPE.choice}</span></h3>
          <div class="pn-chart-sub">${fmt(q.answered)} kişi yanıtladı${q.required === false ? " · isteğe bağlı" : ""}${q.type === "multi" ? " · yüzdeler yanıt verenlere göre (birden çok seçim)" : ""}</div></div></div>
          ${Number(q.answered) ? bars(q) : `<p class="pn-muted">Henüz bu soruya cevap yok.</p>`}</section>`).join("")}</div>
      <p class="pn-muted" style="text-align:center;font-size:.8rem;margin-top:22px;">Bu sayfa yalnızca toplu sonuçları gösterir. Katılımcı isimleri ve görüşleri burada yer almaz.</p>`;
  }
  async function load(force) {
    const tok = tokenOf();
    if (!tok) return message("Link eksik", "Bu sayfayı size gönderilen sonuç linkiyle açın.");
    try {
      const d = await rpc("poll_view_get", { p_token: tok });
      const sig = JSON.stringify(d);
      if (force || sig !== lastSig) { lastSig = sig; draw(d); }
    } catch (e) {
      if (e.code === "invalid") return message("Link geçersiz", "Bu sonuç linki yenilenmiş ya da hatalı olabilir.");
      if (!lastSig) message("Sonuçlar şu anda açılamadı", "İnternet bağlantınızı kontrol edip sayfayı yenileyin.");
    }
  }
  load(true);
  setInterval(() => { if (!document.hidden) load(false); }, 5000);
  global.addEventListener("hashchange", () => { lastSig = ""; load(true); });
})(window);
