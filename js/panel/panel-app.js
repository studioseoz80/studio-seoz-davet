/* =============================================================================
   STUDIO SEOZ — panel/panel-app.js  (MÜŞTERİ KATILIMCI PANELİ — FAZ B/C/D)
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
  /* TR / EN: arayüz metinleri panel-i18n.js'ten gelir; kayıtlar değişmez. */
  const I = global.SeozPanelI18n;
  const t = (k, v) => I.t(k, v);
  const LABEL_KEYS = ["total", "yes", "no", "people"];
  let lastScreen = null;   // veri yokken gösterilen ekran (dil değişince yeniden çizilir)
  const OPTION_TYPES = ["radio", "choice", "checkbox", "select"];

  const state = {
    token: "", pin: null, data: null, loadedAt: 0,
    tab: "responses", search: "", status: "all", filters: [],
    chartMode: "responses", chartViews: {},
    editingLabels: false,
    seating: null,                                   // FAZ D: {areas, assignments} | {error}
    wishes: null,                                    // Dilek Ağacı: {trees, items, event_date} | null (yok / kurulmamış)
    seatUi: { view: (global.innerWidth < 720 ? "list" : "plan"), sel: [] }
  };

  /* ---------------- yardımcılar ---------------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }
  function fmtDate(iso) { return I.fmtDate(iso); }
  function norm(s) { return String(s || "").toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim(); }
  /* DAVETİYEYİ PAYLAŞ: etkinlik sahibi davetiye bağlantısını tek dokunuşla gönderir.
     Telefonda sistemin paylaşım menüsü (Instagram, WhatsApp…) yalnızca bağlantıyla açılır;
     bilgisayarda bağlantı kopyalanır. Panelin kendi adresi (gizli anahtar) hiçbir yere gitmez. */
  const inviteUrl = ev => (ev && /^[a-z0-9-]{3,80}$/.test(String(ev.slug || "")) ? global.location.origin + "/" + ev.slug : "");
  const touchShare = () => !!(navigator.share && global.matchMedia && global.matchMedia("(pointer: coarse)").matches);
  function inviteShareHTML(ev) {
    const u = inviteUrl(ev); if (!u) return "";
    const wa = "https://wa.me/?text=" + encodeURIComponent(u);   // yalnızca bağlantı → tek kart
    return `<div class="pn-share pn-noprint">
        <div class="pn-share-txt"><b>${esc(t("inviteLink"))}</b><span data-invite-url>${esc(u.replace(/^https?:\/\//, ""))}</span></div>
        <div class="pn-share-actions">
          <button class="pn-btn primary" data-invite-share>${esc(t(touchShare() ? "shareTouch" : "shareDesk"))}</button>
          <a class="pn-btn" data-invite-wa href="${esc(wa)}" target="_blank" rel="noopener noreferrer">WhatsApp</a>
        </div>
      </div>`;
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return new Promise((res, rej) => { const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy") ? res() : rej(new Error("kopyalanamadı")); } catch (e) { rej(e); } ta.remove(); });
  }
  function wireInviteShare() {
    const b = root.querySelector("[data-invite-share]"); if (!b) return;
    const ev = state.data && state.data.event, u = inviteUrl(ev);
    b.addEventListener("click", () => {
      const fallback = () => copyText(u).then(() => toast(t("linkCopied")), () => global.prompt(t("copyPrompt"), u));
      if (touchShare()) navigator.share({ url: u }).catch(err => { if (!err || err.name !== "AbortError") fallback(); });
      else fallback();
    });
  }

  function toast(msg) {
    document.querySelectorAll(".pn-toast").forEach(x => x.remove());   // bildirimler üst üste binmesin
    const t = document.createElement("div");
    t.className = "pn-toast"; t.textContent = msg; t.setAttribute("role", "status");
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
      const er = new Error(msg);
      er.code = /invalid_panel/.test(msg) ? "invalid_panel" : /pin_required/.test(msg) ? "pin_required"
              : /Could not find the function|PGRST202/.test(msg) ? "not_installed" : msg;
      throw er;
    }
    return text ? JSON.parse(text) : null;
  }

  /* ---------------- veri modeli ---------------- */
  function form() { return (state.data && state.data.event.form) || {}; }
  function questions() { return Array.isArray(form().questions) ? form().questions : []; }
  function hasAttendanceQ() { return questions().some(q => q.active !== false && q.role === "attendance"); }
  /* ETKİLEŞİMLER: davetiyede Dilek Ağacı varsa görünür. Ağaç davetiyeden kaldırılsa da kayıtlı dilekler
     silinene kadar görünür (organizatör indirebilsin / silebilsin). Hiç ağaç ve dilek yoksa sekme çıkmaz. */
  function hasWishes() {
    const w = state.wishes;
    return !!(w && ((Array.isArray(w.trees) && w.trees.length) || (Array.isArray(w.items) && w.items.length)));
  }
  // Yalnızca Dilek Ağacı olan davetiye (Katılım Formu yok): panel doğrudan Etkileşimler'i gösterir.
  function wishOnly() { return hasWishes() && !questions().length && !(state.data.responses || []).length; }
  /* Kayıttaki kart adları (müşteri değiştirmediyse Türkçe varsayılan) → ekranda seçilen dilde. */
  function storedLabels() { return ((state.data && state.data.event.settings) || {}).labels || {}; }
  function labels() { const S = storedLabels(), L = {}; LABEL_KEYS.forEach(k => { L[k] = I.displayLabel(k, S[k]); }); return L; }
  function responses() { return (state.data && state.data.responses) || []; }

  /* Tabloda gösterilecek soru sütunları: formdaki sorular (katılım ve kişi
     sayısı ayrı sütunda) + formdan kaldırılmış ama yanıtı olan sorular. */
  function columns() {
    const cols = [];
    const seen = new Set();
    questions().forEach(q => {
      seen.add(q.id);
      if (q.role === "attendance" || q.role === "count") return;
      cols.push({ id: q.id, label: q.label || t("untitledQ"), q: q, removed: false });
    });
    responses().forEach(r => Object.keys(r.answers || {}).forEach(id => {
      if (seen.has(id)) return;
      seen.add(id);
      cols.push({ id: id, label: t("removedQ", { q: r.answers[id].q || t("question") }), q: null, removed: true });
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
    if (!hasAttendanceQ()) return t("stRegistered");
    const aq = questions().find(q => q.role === "attendance");
    if (s === "yes") return (aq && aq.yesLabel) || t("stYes");
    if (s === "no") return (aq && aq.noLabel) || t("stNo");
    return t("stUnknown");
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
    if (q.type === "yesno") return [{ value: "true", label: q.yesLabel || t("yes") }, { value: "false", label: q.noLabel || t("no") }];
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
  function filtered(ignoreStatus) {
    const term = norm(state.search);
    return responses().filter(r => {
      if (!ignoreStatus && state.status !== "all" && statusOf(r) !== state.status) return false;
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
    const qlabel = q ? q.label : t("question");
    if (f.kind === "answered") return t("fLabelAnswered", { q: qlabel });
    if (f.kind === "empty") return t("fLabelEmpty", { q: qlabel });
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
  /* Veri yokken gösterilen ekranlar anahtarla çizilir: dil değişince aynı ekran yeni dilde yeniden çizilir. */
  function showMessage(titleKey, textKey, extraHtml) {
    lastScreen = () => showMessage(titleKey, textKey, extraHtml);
    root.classList.remove("pn-tab-seating");
    setDocTitle();
    root.innerHTML = `<div class="pn-topbar pn-topbar-msg">${I.switchHtml()}</div>
      <div class="pn-message"><div class="pn-brand">STUDIO SEOZ</div><h2>${esc(t(titleKey))}</h2><p>${esc(t(textKey))}</p>${typeof extraHtml === "function" ? extraHtml() : (extraHtml || "")}</div>`;
  }

  function showPinForm(wrong) {
    showMessage("pinTitle", wrong ? "pinWrong" : "pinAsk",
      () => `<form data-pin-form><input type="password" inputmode="numeric" autocomplete="off" class="pn-search" data-pin style="max-width:160px" aria-label="PIN"><button class="pn-btn primary" type="submit">${esc(t("pinButton"))}</button></form>`);
    lastScreen = () => showPinForm(wrong);
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
          ? `<input data-label-key="${key}" value="${esc(L[key])}" maxlength="40" aria-label="${esc(t("cardNameAria"))}">`
          : esc(L[key])}</div>
        <div class="pn-card-value">${value}</div>
      </div>`;

    lastScreen = null;
    if (state.tab === "interactions" && !hasWishes()) state.tab = "responses";
    if (wishOnly()) state.tab = "interactions";
    const only = wishOnly(), ix = state.tab === "interactions";
    root.classList.toggle("pn-tab-seating", state.tab === "seating");
    root.innerHTML = `
      <div class="pn-topbar"><div class="pn-brand">${esc(t("brand"))}</div>${I.switchHtml()}</div>
      <div class="pn-head">
        <div>
          <h1 class="pn-title">${esc(ev.title || t("untitledEvent"))}</h1>
          <div class="pn-sub pn-print-only">${esc(t("reportDate", { d: fmtDate(new Date().toISOString()) }))}</div>
          <div class="pn-sub pn-noprint">${esc(t("lastUpdate", { d: fmtDate(new Date(state.loadedAt).toISOString()) }))}</div>
        </div>
        <div class="pn-head-actions">
          ${only ? "" : `<span class="pn-pill ${ev.is_open ? "open" : "closed"}">${esc(t(ev.is_open ? "pillOpen" : "pillClosed"))}</span>
          <button class="pn-btn" data-toggle-open>${esc(t(ev.is_open ? "closeForm" : "openForm"))}</button>`}
          <button class="pn-btn" data-refresh>${esc(t("refresh"))}</button>
        </div>
      </div>
      ${inviteShareHTML(ev)}
      ${dupCount ? `<div class="pn-alert">${t("dupAlert", { n: dupCount })}</div>` : ""}
      ${only ? "" : `<div class="pn-cards">
        ${card("total", "", s.total)}
        ${att ? card("yes", "yes", s.yes) : ""}
        ${att ? card("no", "no", s.no) : ""}
        ${card("people", "people", s.people)}
      </div>
      <div class="pn-cards-foot pn-noprint">
        ${state.editingLabels
          ? `<button class="pn-link" data-labels-cancel>${esc(t("cancel"))}</button><button class="pn-btn primary" data-labels-save>${esc(t("labelsSave"))}</button>`
          : `<button class="pn-link" data-labels-edit>${esc(t("labelsEdit"))}</button>`}
      </div>`}
      <div class="pn-tabs" role="tablist">
        ${only ? "" : `<button class="pn-tab" role="tab" data-tab="responses" aria-selected="${state.tab === "responses"}">${esc(t("tabResponses"))}</button>
        <button class="pn-tab" role="tab" data-tab="people" aria-selected="${state.tab === "people"}">${esc(t("tabPeople"))}</button>
        <button class="pn-tab" role="tab" data-tab="charts" aria-selected="${state.tab === "charts"}">${esc(t("tabCharts"))}</button>
        <button class="pn-tab" role="tab" data-tab="seating" aria-selected="${state.tab === "seating"}">${esc(t("tabSeating"))}</button>`}
        ${hasWishes() ? `<button class="pn-tab" role="tab" data-tab="interactions" aria-selected="${ix}">${esc(t("tabInteractions"))}</button>` : ""}
      </div>
      <div class="pn-toolbar">
        <input class="pn-search" type="search" placeholder="${esc(t("searchPh"))}" data-search value="${esc(state.search)}">
        ${att && state.tab !== "seating" && !ix ? `<div class="pn-seg" role="group" aria-label="${esc(t("statusAria"))}">
          ${[["all", t("all")], ["yes", L.yes], ["no", L.no]].map(([v, t]) => `<button data-status="${v}" aria-pressed="${state.status === v}">${esc(t)}</button>`).join("")}
        </div>` : ""}
      </div>
      <div class="pn-filters" data-filters></div>
      <p class="pn-count" data-count></p>
      <div data-body></div>
      <div class="pn-export">${ix ? `
        <button class="pn-btn" data-export="wishes">${esc(t("exWishes"))}</button>
        <button class="pn-btn" data-print>${esc(t("printWishes"))}</button>` : state.tab === "seating" ? `
        <button class="pn-btn" data-export="seating">${esc(t("exSeating"))}</button>
        <button class="pn-btn" data-print>${esc(t("printSeating"))}</button>` : `
        <button class="pn-btn" data-export="responses">${esc(t("exResponses"))}</button>
        <button class="pn-btn" data-export="people">${esc(t("exPeople"))}</button>
        <button class="pn-btn" data-print>${esc(t("print"))}</button>`}
      </div>
    `;

    root.querySelector("[data-refresh]").addEventListener("click", () => load(false));
    wireInviteShare();
    if (root.querySelector("[data-toggle-open]")) root.querySelector("[data-toggle-open]").addEventListener("click", toggleOpen);
    root.querySelectorAll("[data-tab]").forEach(b => b.addEventListener("click", () => { state.tab = b.getAttribute("data-tab"); renderShell(); }));
    root.querySelectorAll("[data-status]").forEach(b => b.addEventListener("click", () => { state.status = b.getAttribute("data-status"); renderShell(); }));
    root.querySelector("[data-search]").addEventListener("input", (e) => { state.search = e.target.value; renderBody(); });
    const edit = root.querySelector("[data-labels-edit]");   // (yalnızca Dilek Ağacı panelinde kart/etiket yok)
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
      `<span class="pn-chip">${esc(filterLabel(f))}<button data-rm-filter="${i}" aria-label="${esc(t("removeFilter"))}">✕</button></span>`).join("") +
      (qs.length ? `<span class="pn-addfilter">
        <select data-f-q aria-label="${esc(t("filterByQAria"))}"><option value="">${esc(t("filterByQ"))}</option>
          ${qs.map(q => `<option value="${esc(q.id)}">${esc(q.label || t("untitledQ"))}</option>`).join("")}</select>
        <select data-f-v hidden aria-label="${esc(t("answerAria"))}"></select>
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
      selV.innerHTML = `<option value="">${esc(t("chooseAnswer"))}</option>` +
        choices.map(c => `<option value="eq:${esc(c.value)}">${esc(c.label)}</option>`).join("") +
        `<option value="answered">${esc(t("fAnswered"))}</option><option value="empty">${esc(t("fEmpty"))}</option>`;
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
    if (state.tab === "seating") { renderSeating(root.querySelector("[data-body]")); return; }
    if (state.tab === "interactions") { renderWishes(root.querySelector("[data-body]")); return; }
    const list = filtered();
    const people = list.filter(r => r.attending !== false).reduce((n, r) => n + (r.party_size || 0), 0);
    const narrowed = list.length !== responses().length;
    root.querySelector("[data-count]").textContent =
      t("countLine", { n: list.length, p: people }) + (narrowed ? t("countNarrowed", { t: responses().length }) : "");
    const body = root.querySelector("[data-body]");

    if (!responses().length) {
      body.innerHTML = `<div class="pn-empty">${esc(t("noResponses"))}</div>`;
      return;
    }
    if (!list.length) {
      body.innerHTML = `<div class="pn-empty">${esc(t("noMatch"))}</div>`;
      return;
    }
    if (state.tab === "people") { renderPeople(body, list); return; }
    if (state.tab === "charts") { renderCharts(body, list); return; }

    const cols = columns();
    const dup = duplicates();
    const badges = (r) =>
      (r.update_count > 0 ? `<span class="pn-badge upd" title="${esc(t("lastUpdate", { d: fmtDate(r.updated_at) }))}">${esc(t("badgeUpdated"))}</span>` : "") +
      (dup[norm(r.name)] > 1 ? `<span class="pn-badge dup">${esc(t("badgeDup"))}</span>` : "");

    body.innerHTML = `
      <div class="pn-tablewrap"><table class="pn-table">
        <thead><tr>
          <th>${esc(t("thName"))}</th><th>${esc(t("thStatus"))}</th><th>${esc(t("thGuests"))}</th>
          ${cols.map(c => `<th>${esc(c.label)}</th>`).join("")}
          <th>${esc(t("thCompanions"))}</th><th>${esc(t("thResponded"))}</th>
        </tr></thead>
        <tbody>${list.map(r => `
          <tr data-rid="${esc(r.id)}">
            <td class="pn-name">${esc(r.name)}${badges(r)}</td>
            <td class="pn-status ${statusOf(r)}">${esc(statusText(r))}</td>
            <td>${r.attending === false ? "—" : esc(r.party_size)}</td>
            ${cols.map(c => `<td>${esc(answerText(r, c.id)) || '<span class="pn-muted">—</span>'}</td>`).join("")}
            <td>${companions(r).map(a => esc(a.name || t("unnamed"))).join(", ") || '<span class="pn-muted">—</span>'}</td>
            <td class="pn-muted" style="white-space:nowrap">${esc(fmtDate(r.updated_at))}</td>
          </tr>`).join("")}
        </tbody></table></div>
      <div class="pn-list">${list.map(r => `
        <div class="pn-item" data-rid="${esc(r.id)}">
          <div class="pn-item-top"><span class="pn-name">${esc(r.name)}${badges(r)}</span>
            <span class="pn-status ${statusOf(r)}">${esc(statusText(r))}${r.attending === false ? "" : " · " + esc(t("guestsN", { n: r.party_size }))}</span></div>
          ${companions(r).length ? `<div class="pn-item-meta">+ ${companions(r).map(a => esc(a.name || t("unnamed"))).join(", ")}</div>` : ""}
          <div class="pn-item-meta">${cols.filter(c => answerText(r, c.id)).slice(0, 3).map(c => `${esc(c.label)}: <b>${esc(answerText(r, c.id))}</b>`).join(" · ")}</div>
        </div>`).join("")}
      </div>`;
    body.querySelectorAll("[data-rid]").forEach(el => el.addEventListener("click", () => openDetail(el.getAttribute("data-rid"))));
  }

  /* FAZ C: grafikler (panel-charts.js). Arama ve filtrelere uyar. */
  function renderCharts(body, list) {
    if (!global.SeozPanelCharts) { body.innerHTML = `<div class="pn-empty">${esc(t("chartsFail"))}</div>`; return; }
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

  /* FAZ D: yerleşim (panel-seating.js). Arama/filtre yalnızca
     "Yerleştirilmemiş" listesini süzer; masalar her zaman tam görünür. */
  function seatingCtx() {
    const visible = filtered(true);
    return {
      responses: responses(),
      visibleRids: new Set(visible.map(r => r.id)),
      narrowed: visible.length !== responses().length,
      seating: state.seating,
      ui: state.seatUi,
      cols: columns(),
      answerText: answerText,
      title: state.data.event.title,
      rpc: rpc, toast: toast, onError: handleActionError,
      reload: async () => { state.seating = null; renderBody(); state.seating = await loadSeating(); renderBody(); }
    };
  }
  function renderSeating(body) {
    const c = seatingCtx();
    root.querySelector("[data-count]").textContent = c.narrowed ? t("seatingNarrowed") : "";
    if (!global.SeozPanelSeating) { body.innerHTML = `<div class="pn-empty">${esc(t("seatingFail"))}</div>`; return; }
    global.SeozPanelSeating.render(body, c);
  }
  function seatOf(attendeeId) {
    return global.SeozPanelSeating ? global.SeozPanelSeating.areaNameOf(state.seating, attendeeId) : "";
  }
  async function loadSeating() {
    try {
      const d = await rpc("rsvp_panel_seating_get", {});
      return { areas: (d.areas || []).map(global.SeozPanelSeating.normArea), assignments: d.assignments || {} };
    } catch (e) {
      if (e.code !== "not_installed") console.warn("[Studio SEOZ] Yerleşim yüklenemedi:", e);
      return { error: e.code === "not_installed" ? "not_installed" : "failed" };
    }
  }

  /* ---------------- ETKİLEŞİMLER · DİLEK AĞACI ---------------- */
  async function loadWishes() {
    try { return await rpc("wish_panel_get", {}); }
    catch (e) {
      if (e.code !== "not_installed") console.warn("[Studio SEOZ] Dilekler yüklenemedi:", e);
      return null;   // kurulmamış / hata: sekme görünmez, panelin geri kalanı aynen çalışır
    }
  }
  function wishList() {
    const q = norm(state.search);
    const items = (state.wishes && state.wishes.items) || [];
    return q ? items.filter(w => norm(w.name).indexOf(q) >= 0 || norm(w.wish).indexOf(q) >= 0) : items;
  }
  function wishDeadline() {
    const d = state.wishes && state.wishes.event_date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d || ""))) return "";
    const x = new Date(d + "T12:00:00"); x.setDate(x.getDate() + 30);
    return x.toLocaleDateString(I.lang() === "en" ? "en-US" : "tr-TR", { day: "numeric", month: "long", year: "numeric" });
  }
  function renderWishes(body) {
    const all = (state.wishes && state.wishes.items) || [], list = wishList();
    const hidden = all.filter(w => w.hidden).length;
    root.querySelector("[data-count]").textContent = t("wishCount", { n: all.length, h: hidden });
    const dl = wishDeadline();
    const trees = state.wishes.trees || [];
    body.innerHTML = `<div class="pn-wish-head">
        <div class="pn-alert pn-wish-ret" data-wish-ret>${esc(t("wishRetention"))}${dl ? ` <b>${esc(t("wishRetentionDate", { d: dl }))}</b>` : ""}</div>
        ${!trees.length ? `<p class="pn-muted pn-wish-vis" data-wish-removed>${esc(t("wishRemoved"))}</p>` : ""}
        ${trees.map(tr => `<p class="pn-muted pn-wish-vis">${esc(t("wishTitle"))} · ${esc(t(tr.visibility === "acik" ? "wishVisPublic" : "wishVisLocked"))}</p>`).join("")}
      </div>
      ${!all.length ? `<div class="pn-empty">${esc(t("wishNone"))}</div>` : !list.length ? `<div class="pn-empty">${esc(t("noMatch"))}</div>` : `
      <div class="pn-wishes">${list.map(w => `
        <article class="pn-wish${w.hidden ? " is-hidden" : ""}" data-wish="${esc(w.id)}">
          <header><b>${esc(w.name)}</b> <span class="pn-muted">· ${esc(fmtDate(w.created_at))}</span>
            ${w.hidden ? `<span class="pn-pill closed">${esc(t("wishHidden"))}</span>` : ""}
            ${w.show_initials && w.initials ? `<span class="pn-muted pn-wish-ini">${esc(t("wishInitialsOk", { i: w.initials }))}</span>` : ""}</header>
          <p>${esc(w.wish).replace(/\n/g, "<br>")}</p>
          <div class="pn-wish-act pn-noprint">
            <button class="pn-btn" data-wish-hide="${w.hidden ? "0" : "1"}">${esc(t(w.hidden ? "wishShow" : "wishHide"))}</button>
            <button class="pn-btn pn-danger" data-wish-del>${esc(t("wishDelete"))}</button>
          </div>
        </article>`).join("")}</div>`}`;
    body.querySelectorAll("[data-wish]").forEach(card => {
      const id = card.getAttribute("data-wish"), w = all.find(x => x.id === id);
      const hb = card.querySelector("[data-wish-hide]"), db = card.querySelector("[data-wish-del]");
      hb.addEventListener("click", async () => {
        const hide = hb.getAttribute("data-wish-hide") === "1";
        hb.disabled = true;
        try {
          await rpc("wish_panel_set_hidden", { p_id: id, p_hidden: hide });
          w.hidden = hide; toast(t(hide ? "wishHiddenToast" : "wishShownToast")); renderShell();
        } catch (e) { hb.disabled = false; handleActionError(e); }
      });
      db.addEventListener("click", async () => {
        if (!confirm(t("wishConfirmDelete", { name: w.name }))) return;
        db.disabled = true;
        try {
          await rpc("wish_panel_delete", { p_id: id });
          state.wishes.items = state.wishes.items.filter(x => x.id !== id); toast(t("wishDeletedToast")); renderShell();
        } catch (e) { db.disabled = false; handleActionError(e); }
      });
    });
  }

  function renderPeople(body, list) {
    const groups = list.filter(r => r.attending !== false);
    if (!groups.length) { body.innerHTML = `<div class="pn-empty">${esc(t("noPeople"))}</div>`; return; }
    body.innerHTML = `<div class="pn-people">${groups.map(r => {
      const ppl = (r.attendees || []).length ? r.attendees : [{ position: 0, name: r.name }];
      return `<div class="pn-group"><h4>${esc(r.name)} <span class="pn-muted">· ${esc(t("guestsN", { n: r.party_size }))}</span></h4>
        <ol>${ppl.map(a => { const seatName = a.id ? seatOf(a.id) : "";
          return `<li>${esc(a.name || t("unnamedGuest"))}${a.position === 0 ? ` <span class="pn-muted">${esc(t("respondent"))}</span>` : ""}${seatName ? ` <span class="pn-seat-tag">${esc(seatName)}</span>` : ""}</li>`; }).join("")}</ol></div>`;
    }).join("")}</div>`;
  }

  function openDetail(id) {
    const r = responses().find(x => x.id === id);
    if (!r) return;
    const qs = questions();
    const rows = [];
    qs.forEach(q => { const t = answerText(r, q.id); if (t) rows.push([q.label, t]); });
    Object.keys(r.answers || {}).forEach(k => { if (!qs.some(q => q.id === k)) rows.push([t("removedQ", { q: r.answers[k].q || t("question") }), answerText(r, k)]); });
    const bg = document.createElement("div");
    bg.className = "pn-modal-bg";
    bg.innerHTML = `<div class="pn-modal" role="dialog" aria-modal="true" aria-label="${esc(t("detailAria"))}">
      <h3>${esc(r.name)}</h3>
      <div class="pn-muted">${esc(statusText(r))}${r.attending === false ? "" : " · " + esc(t("guestsN", { n: r.party_size }))}</div>
      <dl>
        ${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}
        ${companions(r).length ? `<dt>${esc(t("thCompanions"))}</dt><dd>${companions(r).map(a => esc(a.name || t("unnamed"))).join("\n")}</dd>` : ""}
        <dt>${esc(t("firstResponse"))}</dt><dd>${esc(fmtDate(r.created_at))}</dd>
        ${r.update_count > 0 ? `<dt>${esc(t("csvLastUpdate"))}</dt><dd>${esc(fmtDate(r.updated_at))} ${esc(t("updatedTimes", { n: r.update_count }))}</dd>` : ""}
        ${r.consent ? `<dt>${esc(t("consent"))}</dt><dd>${esc(t("consentChecked"))}</dd>` : ""}
      </dl>
      <div class="pn-modal-actions">
        <button class="pn-btn danger" data-del>${esc(t("deleteResponse"))}</button>
        <button class="pn-btn primary" data-close>${esc(t("close"))}</button>
      </div></div>`;
    document.body.appendChild(bg);
    const close = () => bg.remove();
    bg.addEventListener("click", (e) => { if (e.target === bg) close(); });
    bg.querySelector("[data-close]").addEventListener("click", close);
    bg.querySelector("[data-del]").addEventListener("click", async () => {
      if (!confirm(t("confirmDeleteResponse", { name: r.name }))) return;
      try {
        await rpc("rsvp_panel_delete_response", { p_response_id: r.id });
        close(); toast(t("responseDeleted")); load(false);
      } catch (e) { handleActionError(e); }
    });
  }

  /* ---------------- işlemler ---------------- */
  async function toggleOpen() {
    const ev = state.data.event;
    const msg = t(ev.is_open ? "confirmCloseForm" : "confirmOpenForm");
    if (!confirm(msg)) return;
    try {
      await rpc("rsvp_panel_set_open", { p_open: !ev.is_open });
      toast(t(ev.is_open ? "formClosed" : "formOpened"));
      load(false);
    } catch (e) { handleActionError(e); }
  }

  async function saveLabels() {
    // Kayıt biçimi eskisiyle aynı: dört ad birlikte; varsayılan ad (TR ya da EN) Türkçe varsayılan olarak saklanır.
    const S = storedLabels(), L = {};
    LABEL_KEYS.forEach(k => { L[k] = I.storeLabel(k, S[k]); });
    root.querySelectorAll("[data-label-key]").forEach(inp => {
      const k = inp.getAttribute("data-label-key");
      L[k] = I.storeLabel(k, inp.value.trim());
    });
    const settings = Object.assign({}, state.data.event.settings || {}, { labels: L });
    try {
      await rpc("rsvp_panel_save_settings", { p_settings: settings });
      state.data.event.settings = settings;
      state.editingLabels = false;
      toast(t("labelsSaved"));
      renderShell();
    } catch (e) { handleActionError(e); }
  }

  function exportCsv(kind) {
    const ev = state.data.event;
    const list = filtered();
    const cols = columns();
    const stamp = new Date().toISOString().slice(0, 10);
    const base = SeozPanelExport.safeName(ev.title);
    if (kind === "wishes") {
      const items = wishList();
      const rows = [[t("thName"), t("csvWish"), t("csvDate"), t("csvInitials"), t("csvHidden")]];
      items.forEach(w => rows.push([w.name, w.wish, fmtDate(w.created_at), w.show_initials ? (w.initials || t("yes")) : "", w.hidden ? t("csvHidden") : ""]));
      SeozPanelExport.download(`${base}-${t("fileWishes")}-${stamp}.csv`, rows);
      toast(t("excelWishes", { n: items.length }));
      return;
    }
    if (kind === "seating") {
      const n = global.SeozPanelSeating ? global.SeozPanelSeating.exportCsv(seatingCtx()) : 0;
      toast(t("excelGuests", { n }));
      return;
    }
    if (kind === "responses") {
      const rows = [[t("thName"), t("thStatus"), t("csvPartySize")].concat(cols.map(c => c.label), [t("thCompanions"), t("firstResponse"), t("csvLastUpdate"), t("csvUpdateCount")])];
      list.forEach(r => rows.push([r.name, statusText(r), r.attending === false ? 0 : r.party_size]
        .concat(cols.map(c => answerText(r, c.id)), [companions(r).map(a => a.name || t("unnamed")).join(", "), fmtDate(r.created_at), fmtDate(r.updated_at), r.update_count])));
      SeozPanelExport.download(`${base}-${t("fileResponses")}-${stamp}.csv`, rows);
    } else {
      const withSeat = state.seating && !state.seating.error && state.seating.areas.length > 0;
      const rows = [[t("csvNo"), t("thName"), t("csvParty"), t("csvPartyPos")].concat(withSeat ? [t("csvArea")] : [], cols.map(c => c.label))];
      let n = 0;
      list.filter(r => r.attending !== false).forEach(r => {
        const ppl = (r.attendees || []).length ? r.attendees : [{ position: 0, name: r.name }];
        ppl.forEach(a => { n++; rows.push([n, a.name || t("unnamedGuest"), r.name, a.position + 1].concat(withSeat ? [(a.id && seatOf(a.id)) || t("statUnplaced")] : [], cols.map(c => answerText(r, c.id)))); });
      });
      SeozPanelExport.download(`${base}-${t("filePeople")}-${stamp}.csv`, rows);
    }
    toast(t("excelResponses", { n: list.length }));
  }

  function handleActionError(e) {
    if (e && e.code === "invalid_panel") return showMessage("invalidTitle", "invalidText");
    if (e && e.code === "network") return alert(t("networkAlert"));
    alert(t("actionFailed", { m: (e && e.message) || t("unknownError") }));
  }

  /* ---------------- yükleme ---------------- */
  async function load(firstTime) {
    if (firstTime && !state.data) { lastScreen = null; setDocTitle(); root.innerHTML = `<div class="pn-loading">${esc(t("loading"))}</div>`; }
    try {
      const [d, seating, wishes] = await Promise.all([rpc("rsvp_panel_get", {}), loadSeating(), loadWishes()]);
      state.data = d;
      state.seating = seating;
      state.wishes = wishes;
      state.loadedAt = Date.now();
      // Filtrelerde artık var olmayan soru kalmasın
      state.filters = state.filters.filter(f => questions().some(q => q.id === f.qid));
      const ev = d.event;
      setDocTitle();
      renderShell();
    } catch (e) {
      if (e.code === "pin_required") return showPinForm(state.pin != null);
      if (e.code === "invalid_panel") return showMessage("invalidTitle", "invalidText");
      if (e.code === "network") return showMessage("netTitle", "netText");
      showMessage("failTitle", "failText");
      console.error("[Studio SEOZ] Panel yüklenemedi:", e);
    }
  }

  function showMissing() {
    showMessage("missingTitle", "missingText");
  }

  function setDocTitle() {
    const ev = state.data && state.data.event;
    document.title = (ev && ev.title ? ev.title + " — " : "") + t("docTitle") + " — Studio SEOZ";
  }

  /* DİL DEĞİŞİNCE: yalnızca ekran yeni dilde yeniden çizilir. Veri yeniden
     yüklenmez, hiçbir kayıt gönderilmez; sekme, arama, filtre ve seçimler korunur. */
  I.onChange(() => {
    setDocTitle();
    document.querySelectorAll(".pn-toast").forEach(x => x.remove());   // eski dildeki bildirim kalmasın
    if (state.data) {
      const y = global.scrollY;
      const q = document.activeElement && document.activeElement.matches && document.activeElement.matches("[data-search]");
      renderShell();
      global.scrollTo(0, y);
      if (q) { const s = root.querySelector("[data-search]"); if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } }
    } else if (lastScreen) lastScreen();
  });

  function boot() {
    // Adresteki anahtar değişirse (ör. yeni link yapıştırıldı) eski veriler
    // hemen temizlenir ve yeni anahtarla baştan yüklenir.
    global.addEventListener("hashchange", () => {
      const t = tokenFromHash();
      if (t === state.token) return;
      state.token = t; state.pin = null; state.data = null; state.filters = []; state.search = ""; state.status = "all";
      state.seating = null; state.seatUi.sel = []; state.wishes = null;
      if (!t) return showMissing();
      load(true);
    });
    // Sekmeye geri dönüldüğünde (en az 30 sn sonra) veriler kendiliğinden yenilenir.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && state.data && Date.now() - state.loadedAt > 30000 && !document.querySelector(".pn-modal-bg") && !document.body.classList.contains("pn-dragging")) load(false);
    });

    state.token = tokenFromHash();
    if (!state.token) return showMissing();
    load(true);
  }

  document.addEventListener("DOMContentLoaded", boot);
  global.SeozPanelApp = { state };   // yalnızca testler için
})(window);
