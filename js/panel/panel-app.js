/* =============================================================================
   STUDIO SEOZ — panel/panel-app.js  (MÜŞTERİ KATILIMCI PANELİ — FAZ B)
   -----------------------------------------------------------------------------
   Adres: panel.html#k=GİZLİ_PANEL_ANAHTARI
   - Anahtar "#" işaretinden sonra durduğu için sunucuya/kayıtlara gitmez.
   - Veriler yalnızca Supabase'deki güvenli fonksiyonlardan (rsvp_panel_*)
     gelir; fonksiyon anahtarı kontrol eder ve YALNIZCA o etkinliğin
     verisini döndürür (bkz. supabase/katilim-faz-b.sql).
   - Misafirden gelen her metin ekrana kaçış karakterleriyle (esc) basılır.
   - Etkinlik türünden bağımsızdır; kart isimleri panelden değiştirilebilir.
   ========================================================================= */

(function (global) {
  "use strict";

  const root = document.getElementById("panel-root");
  const DEFAULT_LABELS = { total: "Toplam yanıt", yes: "Katılacak", no: "Katılmayacak", people: "Toplam gelecek kişi" };
  const OPTION_TYPES = ["radio", "choice", "checkbox", "select"];

  const state = {
    token: "", pin: null, data: null, loadedAt: 0,
    tab: "responses", search: "", status: "all", filters: [],
    chartMode: "responses", chartViews: {},
    editingLabels: false
  };

  /* ---------------- yardımcılar ---------------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }
  function fmtDate(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return "";
    return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" }) + " " +
           d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  }
  function norm(s) { return String(s || "").toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim(); }
  function toast(msg) {
    const t = document.createElement("div");
    t.className = "pn-toast"; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }
  function tokenFromHash() {
    const m = String(global.location.hash || "").match(/[#&]k=([A-Za-z0-9_\-]{20,100})/);
    return m ? m[1] : "";
  }

  /* ---------------- Supabase ---------------- */
  async function rpc(name, args) {
    const c = global.SEOZ_SUPABASE_CONFIG || {};
    const url = String(c.url || "").replace(/\/+$/, "");
    const key = String(c.anonKey || "");
    if (!url || !key) { const e = new Error("not_configured"); e.code = "not_configured"; throw e; }
    let res;
    try {
      res = await fetch(`${url}/rest/v1/rpc/${name}`, {
        method: "POST",
        headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" },
        body: JSON.stringify(Object.assign({ p_token: state.token, p_pin: state.pin }, args || {}))
      });
    } catch (e) { const er = new Error("network"); er.code = "network"; throw er; }
    const text = await res.text();
    if (!res.ok) {
      let msg = text;
      try { msg = JSON.parse(text).message || text; } catch (e) { /* düz metin */ }
      const er = new Error(msg); er.code = /invalid_panel/.test(msg) ? "invalid_panel" : /pin_required/.test(msg) ? "pin_required" : msg;
      throw er;
    }
    return text ? JSON.parse(text) : null;
  }

  /* ---------------- veri modeli ---------------- */
  function form() { return (state.data && state.data.event.form) || {}; }
  function questions() { return Array.isArray(form().questions) ? form().questions : []; }
  function hasAttendanceQ() { return questions().some(q => q.active !== false && q.role === "attendance"); }
  function labels() { return Object.assign({}, DEFAULT_LABELS, ((state.data && state.data.event.settings) || {}).labels || {}); }
  function responses() { return (state.data && state.data.responses) || []; }

  /* Tabloda gösterilecek soru sütunları: formdaki sorular (katılım ve kişi
     sayısı ayrı sütunda) + formdan kaldırılmış ama yanıtı olan sorular. */
  function columns() {
    const cols = [];
    const seen = new Set();
    questions().forEach(q => {
      seen.add(q.id);
      if (q.role === "attendance" || q.role === "count") return;
      cols.push({ id: q.id, label: q.label || "(başlıksız soru)", q: q, removed: false });
    });
    responses().forEach(r => Object.keys(r.answers || {}).forEach(id => {
      if (seen.has(id)) return;
      seen.add(id);
      cols.push({ id: id, label: (r.answers[id].q || "Soru") + " (kaldırılmış soru)", q: null, removed: true });
    }));
    return cols;
  }

  function statusOf(r) {
    if (r.attending === true) return "yes";
    if (r.attending === false) return "no";
    return "unk";
  }
  function statusText(r) {
    const s = statusOf(r);
    if (!hasAttendanceQ()) return "Kayıtlı";
    const aq = questions().find(q => q.role === "attendance");
    if (s === "yes") return (aq && aq.yesLabel) || "Katılıyor";
    if (s === "no") return (aq && aq.noLabel) || "Katılmıyor";
    return "Belirtilmedi";
  }
  function answerText(r, id) { const a = (r.answers || {})[id]; return a ? (a.d == null ? "" : String(a.d)) : ""; }
  function companions(r) { return (r.attendees || []).filter(a => a.position > 0); }

  function duplicates() {
    const count = {};
    responses().forEach(r => { const k = norm(r.name); count[k] = (count[k] || 0) + 1; });
    return count;
  }

  /* ---------------- filtreler ---------------- */
  function filterChoices(q) {
    if (q.type === "yesno") return [{ value: "true", label: q.yesLabel || "Evet" }, { value: "false", label: q.noLabel || "Hayır" }];
    if (OPTION_TYPES.includes(q.type)) return (q.options || []).map(o => ({ value: o.id, label: o.label }));
    return [];
  }
  function matchFilter(r, f) {
    const a = (r.answers || {})[f.qid];
    const v = a ? a.v : undefined;
    const answered = !(v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length));
    if (f.kind === "answered") return answered;
    if (f.kind === "empty") return !answered;
    if (!answered) return false;
    if (Array.isArray(v)) return v.includes(f.value);
    if (typeof v === "boolean") return String(v) === f.value;
    return String(v) === f.value;
  }
  function filtered() {
    const term = norm(state.search);
    return responses().filter(r => {
      if (state.status !== "all" && statusOf(r) !== state.status) return false;
      if (!state.filters.every(f => matchFilter(r, f))) return false;
      if (term) {
        const hay = [r.name].concat(companions(r).map(a => a.name), Object.keys(r.answers || {}).map(k => r.answers[k].d)).map(norm).join(" | ");
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }
  function filterLabel(f) {
    const q = questions().find(x => x.id === f.qid);
    const qlabel = q ? q.label : "Soru";
    if (f.kind === "answered") return `${qlabel}: yanıtlayanlar`;
    if (f.kind === "empty") return `${qlabel}: boş bırakanlar`;
    const ch = q ? filterChoices(q).find(c => c.value === f.value) : null;
    return `${qlabel}: ${ch ? ch.label : f.value}`;
  }

  /* ---------------- özet ---------------- */
  function summary() {
    const rs = responses();
    const att = hasAttendanceQ();
    const yes = rs.filter(r => att ? r.attending === true : true).length;
    const no = att ? rs.filter(r => r.attending === false).length : 0;
    const people = rs.filter(r => r.attending !== false).reduce((n, r) => n + (r.party_size || 0), 0);
    return { total: rs.length, yes, no, people };
  }

  /* ---------------- ekranlar ---------------- */
  function showMessage(title, text, extraHtml) {
    root.innerHTML = `<div class="pn-message"><div class="pn-brand">STUDIO SEOZ</div><h2>${esc(title)}</h2><p>${esc(text)}</p>${extraHtml || ""}</div>`;
  }

  function showPinForm(wrong) {
    showMessage("Panel PIN ile korunuyor", wrong ? "PIN hatalı, lütfen tekrar deneyin." : "Devam etmek için size verilen PIN'i girin.",
      `<form data-pin-form><input type="password" inputmode="numeric" autocomplete="off" class="pn-search" data-pin style="max-width:160px" aria-label="PIN"><button class="pn-btn primary" type="submit">Giriş</button></form>`);
    root.querySelector("[data-pin-form]").addEventListener("submit", (e) => {
      e.preventDefault();
      state.pin = root.querySelector("[data-pin]").value.trim() || null;
      load(true);
    });
  }

  function renderShell() {
    const ev = state.data.event;
    const L = labels();
    const s = summary();
    const dupCount = Object.values(duplicates()).filter(n => n > 1).length;
    const att = hasAttendanceQ();
    const card = (key, cls, value) => `
      <div class="pn-card ${cls}">
        <div class="pn-card-label">${state.editingLabels
          ? `<input data-label-key="${key}" value="${esc(L[key])}" maxlength="40" aria-label="Kart ismi">`
          : esc(L[key])}</div>
        <div class="pn-card-value">${value}</div>
      </div>`;

    root.innerHTML = `
      <div class="pn-brand">STUDIO SEOZ · KATILIMCI PANELİ</div>
      <div class="pn-head">
        <div>
          <h1 class="pn-title">${esc(ev.title || "Etkinlik")}</h1>
          <div class="pn-sub pn-print-only">Rapor tarihi: ${esc(fmtDate(new Date().toISOString()))}</div>
          <div class="pn-sub pn-noprint">Son güncelleme: ${esc(fmtDate(new Date(state.loadedAt).toISOString()))}</div>
        </div>
        <div class="pn-head-actions">
          <span class="pn-pill ${ev.is_open ? "open" : "closed"}">${ev.is_open ? "● Yanıtlara açık" : "● Yanıtlara kapalı"}</span>
          <button class="pn-btn" data-toggle-open>${ev.is_open ? "Formu kapat" : "Formu aç"}</button>
          <button class="pn-btn" data-refresh>↻ Yenile</button>
        </div>
      </div>
      ${dupCount ? `<div class="pn-alert">⚠ ${dupCount} isim birden fazla kez yanıt vermiş görünüyor. Tabloda <b>Olası tekrar</b> etiketiyle işaretlendi; gerekirse ayrıntıdan silebilirsiniz.</div>` : ""}
      <div class="pn-cards">
        ${card("total", "", s.total)}
        ${att ? card("yes", "yes", s.yes) : ""}
        ${att ? card("no", "no", s.no) : ""}
        ${card("people", "people", s.people)}
      </div>
      <div class="pn-cards-foot pn-noprint">
        ${state.editingLabels
          ? `<button class="pn-link" data-labels-cancel>Vazgeç</button><button class="pn-btn primary" data-labels-save>İsimleri kaydet</button>`
          : `<button class="pn-link" data-labels-edit>Kart isimlerini düzenle</button>`}
      </div>
      <div class="pn-tabs" role="tablist">
        <button class="pn-tab" role="tab" data-tab="responses" aria-selected="${state.tab === "responses"}">Yanıtlar</button>
        <button class="pn-tab" role="tab" data-tab="people" aria-selected="${state.tab === "people"}">Kişi Listesi</button>
        <button class="pn-tab" role="tab" data-tab="charts" aria-selected="${state.tab === "charts"}">Grafikler</button>
      </div>
      <div class="pn-toolbar">
        <input class="pn-search" type="search" placeholder="İsim veya cevap ara..." data-search value="${esc(state.search)}">
        ${att ? `<div class="pn-seg" role="group" aria-label="Durum">
          ${[["all", "Tümü"], ["yes", L.yes], ["no", L.no]].map(([v, t]) => `<button data-status="${v}" aria-pressed="${state.status === v}">${esc(t)}</button>`).join("")}
        </div>` : ""}
      </div>
      <div class="pn-filters" data-filters></div>
      <p class="pn-count" data-count></p>
      <div data-body></div>
      <div class="pn-export">
        <button class="pn-btn" data-export="responses">⬇ Excel — Yanıtlar</button>
        <button class="pn-btn" data-export="people">⬇ Excel — Kişi listesi</button>
        <button class="pn-btn" data-print>🖨 Yazdır / PDF</button>
      </div>
    `;

    root.querySelector("[data-refresh]").addEventListener("click", () => load(false));
    root.querySelector("[data-toggle-open]").addEventListener("click", toggleOpen);
    root.querySelectorAll("[data-tab]").forEach(b => b.addEventListener("click", () => { state.tab = b.getAttribute("data-tab"); renderShell(); }));
    root.querySelectorAll("[data-status]").forEach(b => b.addEventListener("click", () => { state.status = b.getAttribute("data-status"); renderShell(); }));
    root.querySelector("[data-search]").addEventListener("input", (e) => { state.search = e.target.value; renderBody(); });
    const edit = root.querySelector("[data-labels-edit]");
    if (edit) edit.addEventListener("click", () => { state.editingLabels = true; renderShell(); });
    const cancel = root.querySelector("[data-labels-cancel]");
    if (cancel) cancel.addEventListener("click", () => { state.editingLabels = false; renderShell(); });
    const save = root.querySelector("[data-labels-save]");
    if (save) save.addEventListener("click", saveLabels);
    root.querySelectorAll("[data-export]").forEach(b => b.addEventListener("click", () => exportCsv(b.getAttribute("data-export"))));
    root.querySelector("[data-print]").addEventListener("click", () => global.print());
    renderBody();
  }

  function renderFilters() {
    const box = root.querySelector("[data-filters]");
    const qs = questions().filter(q => q.role !== "attendance");
    box.innerHTML = state.filters.map((f, i) =>
      `<span class="pn-chip">${esc(filterLabel(f))}<button data-rm-filter="${i}" aria-label="Filtreyi kaldır">✕</button></span>`).join("") +
      (qs.length ? `<span class="pn-addfilter">
        <select data-f-q aria-label="Soruya göre filtrele"><option value="">+ Soruya göre filtrele</option>
          ${qs.map(q => `<option value="${esc(q.id)}">${esc(q.label || "(başlıksız soru)")}</option>`).join("")}</select>
        <select data-f-v hidden aria-label="Cevap"></select>
      </span>` : "");
    box.querySelectorAll("[data-rm-filter]").forEach(b => b.addEventListener("click", () => {
      state.filters.splice(parseInt(b.getAttribute("data-rm-filter"), 10), 1); renderBody();
    }));
    const selQ = box.querySelector("[data-f-q]");
    const selV = box.querySelector("[data-f-v]");
    if (!selQ) return;
    selQ.addEventListener("change", () => {
      const q = questions().find(x => x.id === selQ.value);
      if (!q) { selV.hidden = true; return; }
      const choices = filterChoices(q);
      selV.innerHTML = `<option value="">Cevap seçin</option>` +
        choices.map(c => `<option value="eq:${esc(c.value)}">${esc(c.label)}</option>`).join("") +
        `<option value="answered">Yanıtlayanlar</option><option value="empty">Boş bırakanlar</option>`;
      selV.hidden = false;
      selV.focus();
    });
    selV.addEventListener("change", () => {
      const v = selV.value;
      if (!v) return;
      const f = v.startsWith("eq:") ? { qid: selQ.value, kind: "eq", value: v.slice(3) } : { qid: selQ.value, kind: v };
      state.filters.push(f);
      renderBody();
    });
  }

  function renderBody() {
    renderFilters();
    const list = filtered();
    const people = list.filter(r => r.attending !== false).reduce((n, r) => n + (r.party_size || 0), 0);
    const narrowed = list.length !== responses().length;
    root.querySelector("[data-count]").textContent =
      `${list.length} yanıt · ${people} kişi` + (narrowed ? ` (toplam ${responses().length} yanıttan süzüldü)` : "");
    const body = root.querySelector("[data-body]");

    if (!responses().length) {
      body.innerHTML = `<div class="pn-empty">Henüz yanıt yok. Davetli linkini paylaştığınızda yanıtlar burada görünecek.</div>`;
      return;
    }
    if (!list.length) {
      body.innerHTML = `<div class="pn-empty">Bu arama/filtreyle eşleşen yanıt yok.</div>`;
      return;
    }
    if (state.tab === "people") { renderPeople(body, list); return; }
    if (state.tab === "charts") { renderCharts(body, list); return; }

    const cols = columns();
    const dup = duplicates();
    const badges = (r) =>
      (r.update_count > 0 ? `<span class="pn-badge upd" title="Son güncelleme: ${esc(fmtDate(r.updated_at))}">Güncellendi</span>` : "") +
      (dup[norm(r.name)] > 1 ? `<span class="pn-badge dup">Olası tekrar</span>` : "");

    body.innerHTML = `
      <div class="pn-tablewrap"><table class="pn-table">
        <thead><tr>
          <th>Ad Soyad</th><th>Durum</th><th>Kişi</th>
          ${cols.map(c => `<th>${esc(c.label)}</th>`).join("")}
          <th>Diğer katılımcılar</th><th>Yanıt</th>
        </tr></thead>
        <tbody>${list.map(r => `
          <tr data-rid="${esc(r.id)}">
            <td class="pn-name">${esc(r.name)}${badges(r)}</td>
            <td class="pn-status ${statusOf(r)}">${esc(statusText(r))}</td>
            <td>${r.attending === false ? "—" : esc(r.party_size)}</td>
            ${cols.map(c => `<td>${esc(answerText(r, c.id)) || '<span class="pn-muted">—</span>'}</td>`).join("")}
            <td>${companions(r).map(a => esc(a.name || "İsimsiz")).join(", ") || '<span class="pn-muted">—</span>'}</td>
            <td class="pn-muted" style="white-space:nowrap">${esc(fmtDate(r.updated_at))}</td>
          </tr>`).join("")}
        </tbody></table></div>
      <div class="pn-list">${list.map(r => `
        <div class="pn-item" data-rid="${esc(r.id)}">
          <div class="pn-item-top"><span class="pn-name">${esc(r.name)}${badges(r)}</span>
            <span class="pn-status ${statusOf(r)}">${esc(statusText(r))}${r.attending === false ? "" : " · " + esc(r.party_size) + " kişi"}</span></div>
          ${companions(r).length ? `<div class="pn-item-meta">+ ${companions(r).map(a => esc(a.name || "İsimsiz")).join(", ")}</div>` : ""}
          <div class="pn-item-meta">${cols.filter(c => answerText(r, c.id)).slice(0, 3).map(c => `${esc(c.label)}: <b>${esc(answerText(r, c.id))}</b>`).join(" · ")}</div>
        </div>`).join("")}
      </div>`;
    body.querySelectorAll("[data-rid]").forEach(el => el.addEventListener("click", () => openDetail(el.getAttribute("data-rid"))));
  }

  /* FAZ C: grafikler (panel-charts.js). Arama ve filtrelere uyar. */
  function renderCharts(body, list) {
    if (!global.SeozPanelCharts) { body.innerHTML = `<div class="pn-empty">Grafikler yüklenemedi.</div>`; return; }
    global.SeozPanelCharts.render(body, {
      questions: questions(),
      list: list,
      total: responses().length,
      narrowed: list.length !== responses().length,
      hasAttendance: hasAttendanceQ(),
      attendanceQ: questions().find(q => q.role === "attendance"),
      mode: state.chartMode,
      views: state.chartViews
    }, (change) => {
      if (change.mode) state.chartMode = change.mode;
      if (change.view) state.chartViews[change.view.id] = change.view.value;
      renderBody();
    });
  }

  function renderPeople(body, list) {
    const groups = list.filter(r => r.attending !== false);
    if (!groups.length) { body.innerHTML = `<div class="pn-empty">Bu süzgeçte gelecek kişi yok.</div>`; return; }
    body.innerHTML = `<div class="pn-people">${groups.map(r => {
      const ppl = (r.attendees || []).length ? r.attendees : [{ position: 0, name: r.name }];
      return `<div class="pn-group"><h4>${esc(r.name)} <span class="pn-muted">· ${esc(r.party_size)} kişi</span></h4>
        <ol>${ppl.map(a => `<li>${esc(a.name || "İsimsiz katılımcı")}${a.position === 0 ? ' <span class="pn-muted">(yanıtlayan)</span>' : ""}</li>`).join("")}</ol></div>`;
    }).join("")}</div>`;
  }

  function openDetail(id) {
    const r = responses().find(x => x.id === id);
    if (!r) return;
    const qs = questions();
    const rows = [];
    qs.forEach(q => { const t = answerText(r, q.id); if (t) rows.push([q.label, t]); });
    Object.keys(r.answers || {}).forEach(k => { if (!qs.some(q => q.id === k)) rows.push([(r.answers[k].q || "Soru") + " (kaldırılmış soru)", answerText(r, k)]); });
    const bg = document.createElement("div");
    bg.className = "pn-modal-bg";
    bg.innerHTML = `<div class="pn-modal" role="dialog" aria-modal="true" aria-label="Yanıt ayrıntısı">
      <h3>${esc(r.name)}</h3>
      <div class="pn-muted">${esc(statusText(r))}${r.attending === false ? "" : " · " + esc(r.party_size) + " kişi"}</div>
      <dl>
        ${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}
        ${companions(r).length ? `<dt>Diğer katılımcılar</dt><dd>${companions(r).map(a => esc(a.name || "İsimsiz")).join("\n")}</dd>` : ""}
        <dt>İlk yanıt</dt><dd>${esc(fmtDate(r.created_at))}</dd>
        ${r.update_count > 0 ? `<dt>Son güncelleme</dt><dd>${esc(fmtDate(r.updated_at))} (${esc(r.update_count)} kez güncellendi)</dd>` : ""}
        ${r.consent ? `<dt>Onay</dt><dd>Onay metni işaretlendi</dd>` : ""}
      </dl>
      <div class="pn-modal-actions">
        <button class="pn-btn danger" data-del>Yanıtı sil</button>
        <button class="pn-btn primary" data-close>Kapat</button>
      </div></div>`;
    document.body.appendChild(bg);
    const close = () => bg.remove();
    bg.addEventListener("click", (e) => { if (e.target === bg) close(); });
    bg.querySelector("[data-close]").addEventListener("click", close);
    bg.querySelector("[data-del]").addEventListener("click", async () => {
      if (!confirm(`"${r.name}" yanıtı kalıcı olarak silinsin mi?\n\nBu işlem geri alınamaz. Genellikle yalnızca mükerrer kayıtlar için kullanılır.`)) return;
      try {
        await rpc("rsvp_panel_delete_response", { p_response_id: r.id });
        close(); toast("Yanıt silindi."); load(false);
      } catch (e) { handleActionError(e); }
    });
  }

  /* ---------------- işlemler ---------------- */
  async function toggleOpen() {
    const ev = state.data.event;
    const msg = ev.is_open
      ? "Form yanıtlara kapatılsın mı?\n\nDavetliler yeni yanıt gönderemez ve mevcut yanıtlarını değiştiremez. İstediğiniz zaman tekrar açabilirsiniz."
      : "Form tekrar yanıtlara açılsın mı?";
    if (!confirm(msg)) return;
    try {
      await rpc("rsvp_panel_set_open", { p_open: !ev.is_open });
      toast(ev.is_open ? "Form kapatıldı." : "Form açıldı.");
      load(false);
    } catch (e) { handleActionError(e); }
  }

  async function saveLabels() {
    const L = labels();
    root.querySelectorAll("[data-label-key]").forEach(inp => {
      const v = inp.value.trim();
      L[inp.getAttribute("data-label-key")] = v || DEFAULT_LABELS[inp.getAttribute("data-label-key")];
    });
    const settings = Object.assign({}, state.data.event.settings || {}, { labels: L });
    try {
      await rpc("rsvp_panel_save_settings", { p_settings: settings });
      state.data.event.settings = settings;
      state.editingLabels = false;
      toast("Kart isimleri kaydedildi.");
      renderShell();
    } catch (e) { handleActionError(e); }
  }

  function exportCsv(kind) {
    const ev = state.data.event;
    const list = filtered();
    const cols = columns();
    const stamp = new Date().toISOString().slice(0, 10);
    const base = SeozPanelExport.safeName(ev.title);
    if (kind === "responses") {
      const rows = [["Ad Soyad", "Durum", "Kişi sayısı"].concat(cols.map(c => c.label), ["Diğer katılımcılar", "İlk yanıt", "Son güncelleme", "Güncelleme sayısı"])];
      list.forEach(r => rows.push([r.name, statusText(r), r.attending === false ? 0 : r.party_size]
        .concat(cols.map(c => answerText(r, c.id)), [companions(r).map(a => a.name || "İsimsiz").join(", "), fmtDate(r.created_at), fmtDate(r.updated_at), r.update_count])));
      SeozPanelExport.download(`${base}-yanitlar-${stamp}.csv`, rows);
    } else {
      const rows = [["Sıra", "Ad Soyad", "Grup (yanıtlayan)", "Gruptaki sıra"].concat(cols.map(c => c.label))];
      let n = 0;
      list.filter(r => r.attending !== false).forEach(r => {
        const ppl = (r.attendees || []).length ? r.attendees : [{ position: 0, name: r.name }];
        ppl.forEach(a => { n++; rows.push([n, a.name || "İsimsiz katılımcı", r.name, a.position + 1].concat(cols.map(c => answerText(r, c.id)))); });
      });
      SeozPanelExport.download(`${base}-kisi-listesi-${stamp}.csv`, rows);
    }
    toast(`Excel dosyası indirildi (${list.length} yanıt).`);
  }

  function handleActionError(e) {
    if (e && e.code === "invalid_panel") return showMessage("Panel linki geçersiz", "Bu panel linki geçersiz ya da yenilenmiş. Lütfen Studio SEOZ ile iletişime geçin.");
    if (e && e.code === "network") return alert("Bağlantı kurulamadı. İnternetinizi kontrol edip tekrar deneyin.");
    alert("İşlem yapılamadı: " + ((e && e.message) || "bilinmeyen hata"));
  }

  /* ---------------- yükleme ---------------- */
  async function load(firstTime) {
    if (firstTime && !state.data) root.innerHTML = `<div class="pn-loading">Panel yükleniyor...</div>`;
    try {
      const d = await rpc("rsvp_panel_get", {});
      state.data = d;
      state.loadedAt = Date.now();
      // Filtrelerde artık var olmayan soru kalmasın
      state.filters = state.filters.filter(f => questions().some(q => q.id === f.qid));
      const ev = d.event;
      document.title = (ev.title ? ev.title + " — " : "") + "Katılımcı Paneli";
      renderShell();
    } catch (e) {
      if (e.code === "pin_required") return showPinForm(state.pin != null);
      if (e.code === "invalid_panel") return showMessage("Panel linki geçersiz", "Bu panel linki geçersiz ya da yenilenmiş. Lütfen Studio SEOZ ile iletişime geçin.");
      if (e.code === "network") return showMessage("Bağlantı kurulamadı", "İnternet bağlantınızı kontrol edip sayfayı yenileyin.");
      showMessage("Panel açılamadı", "Lütfen daha sonra tekrar deneyin.");
      console.error("[Studio SEOZ] Panel yüklenemedi:", e);
    }
  }

  function showMissing() {
    showMessage("Panel linki eksik", "Bu sayfa yalnızca size özel panel linkiyle açılır. Lütfen size gönderilen linki kullanın.");
  }

  function boot() {
    // Adresteki anahtar değişirse (ör. yeni link yapıştırıldı) eski veriler
    // hemen temizlenir ve yeni anahtarla baştan yüklenir.
    global.addEventListener("hashchange", () => {
      const t = tokenFromHash();
      if (t === state.token) return;
      state.token = t; state.pin = null; state.data = null; state.filters = []; state.search = ""; state.status = "all";
      if (!t) return showMissing();
      load(true);
    });
    // Sekmeye geri dönüldüğünde (en az 30 sn sonra) veriler kendiliğinden yenilenir.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && state.data && Date.now() - state.loadedAt > 30000 && !document.querySelector(".pn-modal-bg")) load(false);
    });

    state.token = tokenFromHash();
    if (!state.token) return showMissing();
    load(true);
  }

  document.addEventListener("DOMContentLoaded", boot);
  global.SeozPanelApp = { state };   // yalnızca testler için
})(window);
