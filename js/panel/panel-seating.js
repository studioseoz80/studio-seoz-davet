/* =============================================================================
   STUDIO SEOZ — panel/panel-seating.js  (MÜŞTERİ PANELİ — YERLEŞİM, FAZ D)
   -----------------------------------------------------------------------------
   Görsel yerleşim çalışma alanı. Etkinlik türünden bağımsızdır:
   "katılımcı", "grup" (aynı yanıttaki kişiler), "masa / alan".
   - Sınırsız masa/alan; her birinin KENDİ kapasitesi, adı, numarası, şekli.
   - Salon Planı: masalar fareyle/parmakla sürüklenir, yerleri kaydedilir.
   - Masa Listesi: masalar kart olarak, oturan kişiler etiket olarak.
   - Kişi yerleştirme: sürükle-bırak (masaüstü; dokunmatikte basılı tutup
     sürükle) VEYA "kişiye dokun → masaya dokun".
   - Grup tek seferde taşınabilir; iki kişi kolayca yer değiştirir.
   - Kapasite dolunca görsel uyarı; aşım engellenmez ama açık onay ister.
   - Hiç kimse otomatik yerleştirilmez; son karar her zaman müşterinindir.
   Tüm kayıtlar rsvp_panel_* güvenli fonksiyonlarıyla yapılır
   (bkz. supabase/katilim-faz-d.sql). Misafir metinleri esc() ile basılır.
   ========================================================================= */

(function (global) {
  "use strict";

  const LOGICAL_W = 1000;     // salon planının mantıksal genişliği
  const MIN_CANVAS_PX = 720;  // telefonda plan bu genişlikten küçülmez (yatay kaydırılır)
  const MAX_AREAS = 300;
  const I = global.SeozPanelI18n;
  const t = (k, v) => I.t(k, v);

  let ctx = null;        // son render bağlamı (panel-app'ten)
  let container = null;
  let dnd = null;        // etkin sürükleme
  let suppressClickUntil = 0;
  let bound = false;

  /* ---------------- yardımcılar ---------------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }
  function seat() { return ctx.seating; }
  function areas() { return seat().areas; }
  function areaById(id) { return areas().find(a => a.id === id) || null; }
  /* Masa adı: müşterinin verdiği ad aynen; panelin ürettiği "Masa 7" seçilen dilde
     ("Table 7"). Kayıttaki ad değişmez. */
  function areaName(a) {
    if (!a) return "";
    if (a.label) return I.displayAreaLabel(a.label);
    return a.number != null ? t("tableN", { n: a.number }) : t("unnamedArea");
  }
  function showNumberBadge(a) { return a.number != null && !areaName(a).includes(String(a.number)); }
  function sortedAreas() {
    const key = a => (a.number == null ? 1e9 : a.number);
    return areas().slice().sort((a, b) => key(a) - key(b) || (a.sort || 0) - (b.sort || 0));
  }
  function normArea(r) {
    return { id: r.id, label: r.label || "", number: r.number == null ? null : Number(r.number), capacity: Number(r.capacity) || 1,
             shape: r.shape === "rect" ? "rect" : "round", x: Number(r.x) || 0, y: Number(r.y) || 0, sort: Number(r.sort) || 0 };
  }

  /* Gelecek her kişi: yanıttaki attendees kayıtları (grup = aynı yanıt). */
  function persons() {
    const out = [];
    ctx.responses.forEach(r => {
      if (r.attending === false) return;
      const list = r.attendees || [];
      list.forEach(a => out.push({
        id: a.id, rid: r.id, pos: a.position, group: r.name, size: list.length,
        name: a.name || (a.position === 0 ? r.name : t("unnamedGuest"))
      }));
    });
    return out;
  }
  let P = {};          // id → kişi
  let PL = [];         // kişi listesi
  function areaOf(id) {
    const a = seat().assignments[id];
    return a && areaById(a) ? a : null;
  }
  function seatedIn(areaId) { return PL.filter(p => areaOf(p.id) === areaId); }
  function countIn(areaId) { return seatedIn(areaId).length; }
  function capState(a) {
    const n = countIn(a.id);
    return n > a.capacity ? "over" : n === a.capacity ? "full" : "";
  }

  /* ---------------- çizim ---------------- */
  function render(c, context) {
    container = c; ctx = context;
    bindGlobal();
    draw();
  }

  function draw() {
    if (!container || !ctx) return;
    const s = seat();
    if (!s) { container.innerHTML = `<div class="pn-empty">${esc(t("seatLoading"))}</div>`; return; }
    if (s.error === "not_installed") {
      container.innerHTML = `<div class="pn-empty">${t("seatNotInstalled")}</div>`;
      return;
    }
    if (s.error) {
      container.innerHTML = `<div class="pn-empty">${esc(t("seatLoadFail"))}<br><br><button class="pn-btn" data-seat-retry>${esc(t("retry"))}</button></div>`;
      container.querySelector("[data-seat-retry]").addEventListener("click", () => ctx.reload());
      return;
    }
    PL = persons();
    P = {}; PL.forEach(p => { P[p.id] = p; });
    const ui = ctx.ui;
    ui.sel = (ui.sel || []).filter(id => P[id]);

    const total = PL.length;
    const placed = PL.filter(p => areaOf(p.id)).length;
    const unplaced = total - placed;
    const cap = areas().reduce((n, a) => n + a.capacity, 0);
    const overList = areas().filter(a => capState(a) === "over");

    let alert;
    if (!total) alert = `<div class="pn-seat-alert info">${esc(t("seatNoGuests"))}</div>`;
    else if (unplaced) alert = `<div class="pn-seat-alert warn" data-unplaced-alert>${t("seatUnplacedAlert", { n: unplaced })}${cap < total ? esc(t("seatCapLow", { c: cap, t: total })) : ""}</div>`;
    else alert = `<div class="pn-seat-alert ok">${esc(t("seatAllPlaced"))}</div>`;
    if (overList.length) alert += `<div class="pn-seat-alert over">${t("seatOverAlert", { n: overList.length, list: overList.map(a => esc(areaName(a)) + " (" + countIn(a.id) + "/" + a.capacity + ")").join(", ") })}</div>`;

    const root = document.createElement("div");
    root.className = "pn-seat";
    root.innerHTML = `
      <div class="pn-seat-stats pn-noprint">
        ${stat(t("statAreas"), areas().length)}
        ${stat(t("statCapacity"), cap)}
        ${stat(t("statSeated"), placed + (total ? " / " + total : ""))}
        ${stat(t("statUnplaced"), unplaced, unplaced ? "warn" : "")}
      </div>
      <div class="pn-noprint">${alert}</div>
      <div class="pn-seat-bar pn-noprint">
        <button class="pn-btn primary" data-add>${esc(t("addArea"))}</button>
        <div class="pn-seg" role="group" aria-label="${esc(t("viewAria"))}">
          <button data-view="plan" aria-pressed="${ui.view === "plan"}">${esc(t("viewPlan"))}</button>
          <button data-view="list" aria-pressed="${ui.view !== "plan"}">${esc(t("viewList"))}</button>
        </div>
        ${areas().length > 1 ? `<button class="pn-link" data-renumber>${esc(t("renumber"))}</button>` : ""}
      </div>
      ${selectionBar()}
      <div class="pn-seat-grid pn-noprint">
        <aside class="pn-seat-side" data-drop="unplaced" aria-label="${esc(t("unplacedAria"))}">${sideHtml(unplaced)}</aside>
        <section class="pn-seat-main">${ui.view === "plan" ? `<div class="pn-plan-wrap"><div class="pn-plan" data-plan></div></div>
          <p class="pn-muted pn-small">${esc(t("planHint"))}</p>` : listHtml()}</section>
      </div>
      ${printHtml()}`;
    container.innerHTML = "";
    container.appendChild(root);
    root.addEventListener("click", onClick);
    root.addEventListener("keydown", onKey);
    root.addEventListener("pointerdown", onDown);
    root.addEventListener("contextmenu", (e) => { if (e.target.closest("[data-person]")) e.preventDefault(); });
    if (ui.view === "plan") layoutPlan();
  }

  function stat(label, value, cls) {
    return `<div class="pn-seat-stat ${cls || ""}"><div class="pn-stat-label">${esc(label)}</div><div class="pn-stat-value">${esc(value)}</div></div>`;
  }

  function selectionBar() {
    const sel = ctx.ui.sel.map(id => P[id]).filter(Boolean);
    if (!sel.length) return "";
    const one = sel.length === 1 ? sel[0] : null;
    const anySeated = sel.some(p => areaOf(p.id));
    const groupOthers = one ? PL.filter(p => p.rid === one.rid && p.id !== one.id).length : 0;
    const what = one ? t("selOne", { name: esc(one.name) }) : t("selMany", { n: sel.length });
    const hint = esc(t(one && anySeated ? "selHintSwap" : "selHintPlace"));
    return `<div class="pn-seat-sel pn-noprint" role="status">
      <div>${what}<span class="pn-seat-sel-hint">${hint}</span></div>
      <div class="pn-seat-sel-actions">
        ${groupOthers ? `<button class="pn-btn" data-sel-group-of>${esc(t("selWholeParty", { n: groupOthers + 1 }))}</button>` : ""}
        ${anySeated ? `<button class="pn-btn" data-sel-unplace>${esc(t("removeFromTable"))}</button>` : ""}
        <button class="pn-btn" data-sel-clear>${esc(t("cancel"))}</button>
      </div></div>`;
  }

  function chip(p, seated) {
    const sel = ctx.ui.sel.includes(p.id);
    const sub = seated && p.pos > 0 ? `<small>${esc(t("chipGroup", { g: p.group }))}</small>` : "";
    const title = p.pos > 0 ? t("chipInGroup", { name: p.name, g: p.group }) : p.size > 1 ? t("chipPartyOf", { name: p.name, n: p.size }) : p.name;
    return `<span class="pn-pchip${sel ? " sel" : ""}${seated ? " seated" : ""}" data-person="${esc(p.id)}" ${seated ? `data-drop="person:${esc(p.id)}"` : ""}
        role="button" tabindex="0" aria-pressed="${sel}" title="${esc(title)}"><span class="pn-pchip-name">${esc(p.name)}${sub}</span>${seated
        ? `<button type="button" class="pn-pchip-x" data-unseat="${esc(p.id)}" aria-label="${esc(t("unseatAria", { name: p.name }))}" title="${esc(t("removeFromTable"))}">✕</button>` : ""}</span>`;
  }

  function sideHtml(unplaced) {
    const vis = ctx.visibleRids;
    const groups = [];
    const byRid = {};
    PL.forEach(p => {
      if (areaOf(p.id) || !vis.has(p.rid)) return;
      if (!byRid[p.rid]) { byRid[p.rid] = { rid: p.rid, name: p.group, members: [] }; groups.push(byRid[p.rid]); }
      byRid[p.rid].members.push(p);
    });
    const shown = groups.reduce((n, g) => n + g.members.length, 0);
    const head = `<div class="pn-seat-side-head"><h3>${esc(t("sideTitle"))}</h3><span class="pn-seat-count${unplaced ? " warn" : ""}">${esc(t("guestsN", { n: unplaced }))}</span></div>`;
    if (!PL.length) return head + `<p class="pn-muted pn-small">${esc(t("sideNoGuests"))}</p>`;
    if (!unplaced) return head + `<p class="pn-muted pn-small">${esc(t("sideAllPlaced"))}</p>`;
    let html = head + `<p class="pn-muted pn-small">${esc(t("sideHint"))}</p>`;
    if (ctx.narrowed) {
      html += `<p class="pn-small pn-seat-filtered">${esc(t("sideFiltered", { n: shown }))}</p>`;
      if (shown) html += `<button class="pn-btn pn-btn-block" data-sel-visible>${esc(t("selVisible", { n: shown }))}</button>`;
    }
    if (!groups.length) return html + `<p class="pn-muted pn-small">${esc(t("sideNoMatch"))}</p>`;
    html += groups.map(g => {
      const seatedOthers = PL.filter(p => p.rid === g.rid && areaOf(p.id));
      const where = seatedOthers.length ? esc(t(seatedOthers.length > 1 && new Set(seatedOthers.map(p => areaOf(p.id))).size > 1 ? "whereMany" : "whereOne",
        { n: seatedOthers.length, area: areaName(areaById(areaOf(seatedOthers[0].id))) })) : "";
      return `<div class="pn-sgroup">
        <div class="pn-sgroup-head"><span class="pn-sgroup-name">${esc(g.name)}</span>
          <span class="pn-muted pn-small">${esc(t("partyOfGroup", { n: PL.filter(p => p.rid === g.rid).length }))}${where}</span>
          ${g.members.length > 1 ? `<button class="pn-link" data-sel-group="${esc(g.rid)}">${esc(t("selParty", { n: g.members.length }))}</button>` : ""}</div>
        <div class="pn-chips">${g.members.map(p => chip(p, false)).join("")}</div></div>`;
    }).join("");
    return html;
  }

  function listHtml() {
    if (!areas().length) return emptyAreas();
    const hasSel = ctx.ui.sel.length > 0;
    return `<div class="pn-tcards">${sortedAreas().map(a => {
      const ppl = seatedIn(a.id);
      const st = capState(a);
      const free = a.capacity - ppl.length;
      const note = st === "full" ? esc(t("tcFull", { area: areaName(a), n: ppl.length, c: a.capacity }))
                 : st === "over" ? esc(t("tcOver", { n: ppl.length, c: a.capacity, x: ppl.length - a.capacity })) : "";
      return `<div class="pn-tcard ${st}${hasSel ? " hint" : ""}" data-area="${esc(a.id)}" data-drop="area:${esc(a.id)}" role="button" tabindex="0"
          aria-label="${esc(t("tcAria", { area: areaName(a), n: ppl.length, c: a.capacity }))}">
        <div class="pn-tcard-head">
          <div class="pn-tcard-title"><span class="pn-shape ${a.shape}" aria-hidden="true"></span><b>${esc(areaName(a))}</b>${showNumberBadge(a) ? `<span class="pn-numbadge">${a.number}</span>` : ""}</div>
          <span class="pn-cap ${st}">${ppl.length}/${a.capacity}</span>
          <button class="pn-link" data-edit="${esc(a.id)}">${esc(t("edit"))}</button>
        </div>
        <div class="pn-capbar"><div style="width:${Math.min(100, (ppl.length / a.capacity) * 100).toFixed(1)}%"></div></div>
        ${note ? `<div class="pn-tcard-note ${st}">${note}</div>` : ""}
        <div class="pn-chips">${ppl.length ? ppl.map(p => chip(p, true)).join("") : `<span class="pn-muted pn-small">${esc(t("tcEmpty"))}</span>`}</div>
        ${free > 0 && ppl.length ? `<div class="pn-muted pn-small pn-tcard-free">${esc(t("tcFree", { n: free }))}</div>` : ""}
      </div>`;
    }).join("")}</div>`;
  }

  function emptyAreas() {
    return `<div class="pn-empty">${t("noAreas")}</div>`;
  }

  /* Salon planı: düğümler ölçeklenerek mutlak konumlanır. */
  function nodeSize(a) {
    const c = Math.min(a.capacity, 24);
    return a.shape === "rect" ? { w: 120 + c * 7, h: 76 } : { w: 84 + c * 3, h: 84 + c * 3 };
  }
  function planScale() {
    const wrap = container.querySelector(".pn-plan-wrap");
    const w = Math.max(MIN_CANVAS_PX, wrap ? wrap.clientWidth : MIN_CANVAS_PX);
    return w / LOGICAL_W;
  }
  function layoutPlan() {
    const plan = container.querySelector("[data-plan]");
    if (!plan) return;
    const s = planScale();
    const hasSel = ctx.ui.sel.length > 0;
    let maxBottom = 0;
    areas().forEach(a => { const z = nodeSize(a); maxBottom = Math.max(maxBottom, a.y + z.h); });
    const H = Math.max(520, maxBottom + 90);
    plan.style.width = (LOGICAL_W * s) + "px";
    plan.style.height = (H * s) + "px";
    plan.style.setProperty("--grid", (40 * s) + "px");
    if (!areas().length) { plan.innerHTML = `<div class="pn-plan-empty">${emptyAreas()}</div>`; return; }
    plan.innerHTML = areas().map(a => {
      const z = nodeSize(a);
      const ppl = seatedIn(a.id);
      const st = capState(a);
      const names = ppl.map(p => p.name).join(", ");
      return `<div class="pn-node ${a.shape} ${st}${hasSel ? " hint" : ""}" data-area="${esc(a.id)}" data-drop="area:${esc(a.id)}" role="button" tabindex="0"
          style="left:${(a.x * s).toFixed(1)}px;top:${(a.y * s).toFixed(1)}px;width:${(z.w * s).toFixed(1)}px;height:${(z.h * s).toFixed(1)}px;font-size:${Math.max(10, 13 * s).toFixed(1)}px"
          title="${esc(areaName(a) + " — " + (names || t("nodeEmpty")))}" aria-label="${esc(t("tcAria", { area: areaName(a), n: ppl.length, c: a.capacity }))}">
        ${dotsHtml(a, z, s, ppl.length)}
        <div class="pn-node-in">${showNumberBadge(a) ? `<span class="pn-numbadge">${a.number}</span>` : ""}<b>${esc(areaName(a))}</b><span class="pn-node-cap">${ppl.length}/${a.capacity}</span></div>
      </div>`;
    }).join("");
  }
  function dotsHtml(a, z, s, n) {
    if (a.capacity > 24) return "";
    const d = Math.max(5, 8 * s);
    const out = [];
    const push = (cx, cy, i) => out.push(`<i class="pn-dot${i < n ? " on" : ""}" style="left:${(cx * s - d / 2).toFixed(1)}px;top:${(cy * s - d / 2).toFixed(1)}px;width:${d.toFixed(1)}px;height:${d.toFixed(1)}px"></i>`);
    if (a.shape === "round") {
      const r = z.w / 2 + 8;
      for (let i = 0; i < a.capacity; i++) {
        const t = (i / a.capacity) * Math.PI * 2 - Math.PI / 2;
        push(z.w / 2 + r * Math.cos(t), z.h / 2 + r * Math.sin(t), i);
      }
    } else {
      const top = Math.ceil(a.capacity / 2), bottom = a.capacity - top;
      for (let i = 0; i < top; i++) push((z.w / (top + 1)) * (i + 1), -8, i);
      for (let i = 0; i < bottom; i++) push((z.w / (bottom + 1)) * (i + 1), z.h + 8, top + i);
    }
    return out.join("");
  }

  function printHtml() {
    const list = sortedAreas();
    const un = PL.filter(p => !areaOf(p.id));
    return `<div class="pn-seat-print">
      <h2>${esc(t("printTitle"))}</h2>
      <div class="pn-print-cols">${list.map(a => {
        const ppl = seatedIn(a.id);
        return `<div class="pn-print-table"><h4>${esc(areaName(a))} <span>(${ppl.length}/${a.capacity})</span></h4>
          ${ppl.length ? `<ol>${ppl.map(p => `<li>${esc(p.name)}${p.pos > 0 ? ` <span class="pn-muted">(${esc(p.group)})</span>` : ""}</li>`).join("")}</ol>` : `<p class="pn-muted">${esc(t("printEmpty"))}</p>`}</div>`;
      }).join("")}</div>
      ${un.length ? `<h3>${esc(t("printUnplaced", { n: un.length }))}</h3><p>${un.map(p => esc(p.name)).join(", ")}</p>` : ""}
    </div>`;
  }

  /* ---------------- etkileşim: dokunma/klavye ---------------- */
  function onClick(e) {
    if (Date.now() < suppressClickUntil) { e.preventDefault(); e.stopPropagation(); return; }
    const t = e.target;
    let el;
    const ui = ctx.ui;
    if ((el = t.closest("[data-unseat]"))) { e.stopPropagation(); return assign([el.getAttribute("data-unseat")], null); }
    if ((el = t.closest("[data-person]"))) return tapPerson(el.getAttribute("data-person"));
    if ((el = t.closest("[data-sel-group]"))) { ui.sel = PL.filter(p => p.rid === el.getAttribute("data-sel-group") && !areaOf(p.id)).map(p => p.id); return draw(); }
    if ((el = t.closest("[data-sel-group-of]"))) { const one = P[ui.sel[0]]; if (one) ui.sel = PL.filter(p => p.rid === one.rid).map(p => p.id); return draw(); }
    if ((el = t.closest("[data-sel-visible]"))) { ui.sel = PL.filter(p => !areaOf(p.id) && ctx.visibleRids.has(p.rid)).map(p => p.id); return draw(); }
    if ((el = t.closest("[data-sel-unplace]"))) return assign(ui.sel.slice(), null);
    if ((el = t.closest("[data-sel-clear]"))) { ui.sel = []; return draw(); }
    if ((el = t.closest("[data-edit]"))) return areaDialog(areaById(el.getAttribute("data-edit")));
    if ((el = t.closest("[data-add]"))) return areaDialog(null);
    if ((el = t.closest("[data-renumber]"))) return renumber();
    if ((el = t.closest("[data-view]"))) { ui.view = el.getAttribute("data-view"); return draw(); }
    if ((el = t.closest("[data-area]"))) return tapArea(el.getAttribute("data-area"), el.classList.contains("pn-node"));
  }
  function onKey(e) {
    if ((e.key === "Enter" || e.key === " ") && e.target.getAttribute("role") === "button" && e.target.tagName !== "BUTTON") {
      e.preventDefault(); e.target.click();
    }
    if (e.key === "Escape" && ctx.ui.sel.length) { ctx.ui.sel = []; draw(); }
  }

  function tapPerson(id) {
    const ui = ctx.ui;
    const sel = ui.sel;
    if (sel.includes(id)) { ui.sel = sel.filter(x => x !== id); return draw(); }
    if (!sel.length) { ui.sel = [id]; return draw(); }
    const target = areaOf(id);
    if (!target) {
      // Yerleştirilmemiş bir kişiye dokunuldu: seçime ekle (seçim de yerleştirilmemişse)
      ui.sel = sel.every(x => !areaOf(x)) ? sel.concat(id) : [id];
      return draw();
    }
    if (sel.length === 1) {
      if (areaOf(sel[0]) === target) { ui.sel = [id]; return draw(); }
      return swap(sel[0], id);
    }
    return assign(sel.slice(), target);
  }

  function tapArea(id, isNode) {
    if (ctx.ui.sel.length) return assign(ctx.ui.sel.slice(), id);
    if (isNode) areaDialog(areaById(id));
  }

  /* ---------------- etkileşim: sürükle-bırak ---------------- */
  function bindGlobal() {
    if (bound) return;
    bound = true;
    global.addEventListener("pointermove", onMove);
    global.addEventListener("pointerup", onUp);
    global.addEventListener("pointercancel", onCancel);
    // Dokunmatikte kişi sürüklenirken sayfa kaymasın
    global.addEventListener("touchmove", (e) => { if (dnd && dnd.started && dnd.kind === "person") e.preventDefault(); }, { passive: false });
    let lastW = global.innerWidth;
    global.addEventListener("resize", () => {
      if (global.innerWidth === lastW) return;
      lastW = global.innerWidth;
      if (container && container.isConnected && ctx && ctx.ui.view === "plan" && !dnd) layoutPlan();
    });
  }

  function onDown(e) {
    // Sürüklemenin ardından gelen tek "click" yutulur; yeni bir dokunuş ise her zaman geçerlidir.
    suppressClickUntil = 0;
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target.closest("[data-unseat]")) return;
    const chipEl = e.target.closest("[data-person]");
    if (chipEl) {
      dnd = { kind: "person", id: chipEl.getAttribute("data-person"), x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY,
              pid: e.pointerId, touch: e.pointerType === "touch", started: false };
      if (dnd.touch) {
        const mine = dnd;
        mine.timer = setTimeout(() => { if (dnd === mine) startPersonDrag(); }, 380);
      }
      return;
    }
    const node = e.target.closest(".pn-node");
    if (node) {
      const a = areaById(node.getAttribute("data-area"));
      if (!a) return;
      dnd = { kind: "area", id: a.id, el: node, x0: e.clientX, y0: e.clientY, ox: a.x, oy: a.y, nx: a.x, ny: a.y,
              pid: e.pointerId, started: false, s: planScale(), z: nodeSize(a) };
      try { node.setPointerCapture(e.pointerId); } catch (err) { /* önemsiz */ }
    }
  }

  function onMove(e) {
    if (!dnd || e.pointerId !== dnd.pid) return;
    const dx = e.clientX - dnd.x0, dy = e.clientY - dnd.y0;
    const dist = Math.hypot(dx, dy);
    if (dnd.kind === "person") {
      dnd.x = e.clientX; dnd.y = e.clientY;
      if (!dnd.started) {
        if (dnd.touch) { if (dist > 10) { clearTimeout(dnd.timer); dnd = null; } return; }  // kaydırma
        if (dist > 5) startPersonDrag(); else return;
      }
      e.preventDefault();
      dnd.ghost.style.transform = `translate(${e.clientX + 12}px, ${e.clientY + 12}px)`;
      highlight(dropTargetAt(e.clientX, e.clientY));
      autoScroll(e.clientY);
      return;
    }
    if (dnd.kind === "area") {
      if (!dnd.started) { if (dist > 4) { dnd.started = true; dnd.el.classList.add("dragging"); } else return; }
      e.preventDefault();
      dnd.nx = Math.round(Math.min(LOGICAL_W - dnd.z.w, Math.max(0, dnd.ox + dx / dnd.s)));
      dnd.ny = Math.round(Math.min(4900, Math.max(0, dnd.oy + dy / dnd.s)));
      dnd.el.style.left = (dnd.nx * dnd.s) + "px";
      dnd.el.style.top = (dnd.ny * dnd.s) + "px";
    }
  }

  function onUp(e) {
    if (!dnd || e.pointerId !== dnd.pid) return;
    const d = dnd; dnd = null;
    if (d.kind === "person") {
      clearTimeout(d.timer);
      if (!d.started) return;            // dokunma: click olayı işler
      cleanupGhost(d);
      suppressClickUntil = Date.now() + 400;
      handleDrop(d.ids, dropTargetAt(e.clientX, e.clientY));
      return;
    }
    if (d.kind === "area" && d.started) {
      suppressClickUntil = Date.now() + 400;
      d.el.classList.remove("dragging");
      moveArea(d.id, d.nx, d.ny, d.ox, d.oy);
    }
  }

  function onCancel(e) {
    if (!dnd || e.pointerId !== dnd.pid) return;
    const d = dnd; dnd = null;
    clearTimeout(d.timer);
    if (d.kind === "person" && d.started) cleanupGhost(d);
    if (d.kind === "area" && d.started) draw();
  }

  function startPersonDrag() {
    const d = dnd;
    if (!d || d.started) return;
    d.started = true;
    d.ids = ctx.ui.sel.includes(d.id) ? ctx.ui.sel.slice() : [d.id];
    const g = document.createElement("div");
    g.className = "pn-ghost";
    g.textContent = d.ids.length > 1 ? t("guestsN", { n: d.ids.length }) : (P[d.id] ? P[d.id].name : "");
    g.style.transform = `translate(${d.x + 12}px, ${d.y + 12}px)`;
    document.body.appendChild(g);
    d.ghost = g;
    document.body.classList.add("pn-dragging");
    container.querySelectorAll(`[data-person]`).forEach(el => { if (d.ids.includes(el.getAttribute("data-person"))) el.classList.add("lifted"); });
    if (d.touch && navigator.vibrate) { try { navigator.vibrate(15); } catch (err) { /* yok */ } }
  }
  function cleanupGhost(d) {
    if (d.ghost) d.ghost.remove();
    document.body.classList.remove("pn-dragging");
    highlight(null);
    if (container) container.querySelectorAll(".lifted").forEach(el => el.classList.remove("lifted"));
  }
  let overEl = null;
  function highlight(el) {
    if (overEl === el) return;
    if (overEl) overEl.classList.remove("pn-drop-over");
    overEl = el;
    if (el) el.classList.add("pn-drop-over");
  }
  function dropTargetAt(x, y) {
    const el = document.elementFromPoint(x, y);
    return el ? el.closest("[data-drop]") : null;
  }
  function autoScroll(y) {
    const edge = 60;
    if (y < edge) global.scrollBy(0, -12);
    else if (y > global.innerHeight - edge) global.scrollBy(0, 12);
  }

  function handleDrop(ids, target) {
    if (!target || !ids || !ids.length) return;
    const v = target.getAttribute("data-drop");
    if (v === "unplaced") return assign(ids, null);
    if (v.startsWith("area:")) return assign(ids, v.slice(5));
    if (v.startsWith("person:")) {
      const other = v.slice(7);
      if (ids.includes(other)) return;
      if (ids.length === 1) return swap(ids[0], other);
      const a = areaOf(other);
      if (a) return assign(ids, a);
    }
  }

  /* ---------------- kayıt işlemleri (iyimser güncelleme) ---------------- */
  async function assign(ids, areaId) {
    const s = seat();
    areaId = areaId || null;
    ids = ids.filter(id => P[id] && areaOf(id) !== areaId);
    if (!ids.length) { ctx.ui.sel = []; return draw(); }
    const a = areaId ? areaById(areaId) : null;
    if (areaId && !a) return;
    if (a) {
      const after = countIn(a.id) + ids.length;
      if (after > a.capacity && !global.confirm(t("confirmOverCap", { area: areaName(a), c: a.capacity, after, x: after - a.capacity }))) return;
    }
    const prev = {};
    ids.forEach(id => { prev[id] = s.assignments[id]; if (areaId) s.assignments[id] = areaId; else delete s.assignments[id]; });
    ctx.ui.sel = [];
    draw();
    try {
      await ctx.rpc("rsvp_panel_assign", { p_attendee_ids: ids, p_area_id: areaId });
      if (a) {
        const n = countIn(a.id);
        if (n === a.capacity) ctx.toast(t("tcFull", { area: areaName(a), n, c: a.capacity }));
        else ctx.toast(ids.length > 1 ? t("placedMany", { n: ids.length, area: areaName(a) }) : `${P[ids[0]].name} → ${areaName(a)}`);
      } else {
        ctx.toast(ids.length > 1 ? t("unplacedMany", { n: ids.length }) : t("unplacedOne", { name: P[ids[0]].name }));
      }
    } catch (e) {
      ids.forEach(id => { if (prev[id]) s.assignments[id] = prev[id]; else delete s.assignments[id]; });
      draw();
      ctx.onError(e);
    }
  }

  async function swap(a, b) {
    const s = seat();
    const A = areaOf(a), B = areaOf(b);
    if (A === B) { ctx.ui.sel = []; ctx.toast(t("sameSpot")); return draw(); }
    const set = (id, v) => { if (v) s.assignments[id] = v; else delete s.assignments[id]; };
    set(a, B); set(b, A);
    ctx.ui.sel = [];
    draw();
    try {
      await ctx.rpc("rsvp_panel_swap", { p_a: a, p_b: b });
      ctx.toast(t("swapped", { a: P[a].name, b: P[b].name }));
    } catch (e) {
      set(a, A); set(b, B); draw(); ctx.onError(e);
    }
  }

  async function moveArea(id, x, y, ox, oy) {
    const a = areaById(id);
    if (!a || (x === ox && y === oy)) return;
    a.x = x; a.y = y;
    layoutPlan();
    try {
      await ctx.rpc("rsvp_panel_area_save", { p_area: { id, x, y } });
    } catch (e) {
      a.x = ox; a.y = oy; layoutPlan(); ctx.onError(e);
    }
  }

  function freeSlot() {
    for (let row = 0; row < 60; row++) {
      for (let col = 0; col < 5; col++) {
        const x = 40 + col * 190, y = 40 + row * 180;
        if (!areas().some(a => Math.abs(a.x - x) < 140 && Math.abs(a.y - y) < 130)) return { x, y };
      }
    }
    return { x: 30, y: 30 };
  }

  async function renumber() {
    const list = areas().slice().sort((a, b) => (Math.round(a.y / 80) - Math.round(b.y / 80)) || (a.x - b.x));
    if (!global.confirm(t("confirmRenumber"))) return;
    try {
      for (let i = 0; i < list.length; i++) {
        const a = list[i], n = i + 1;
        // Panelin ürettiği adlar ("Masa 7" / "Table 7") yeni numarayı alır; kayıt biçimi eskisiyle aynı ("Masa N").
        const label = !a.label || I.autoTableNo(a.label) != null ? I.canonicalTable(n) : a.label;
        if (a.number === n && a.label === label && a.sort === i) continue;
        const r = await ctx.rpc("rsvp_panel_area_save", { p_area: { id: a.id, number: n, label, sort: i } });
        Object.assign(a, normArea(r));
      }
      ctx.toast(t("renumbered"));
    } catch (e) { ctx.onError(e); }
    draw();
  }

  /* ---------------- masa / alan penceresi ---------------- */
  function areaDialog(a) {
    const isNew = !a;
    if (isNew && areas().length >= MAX_AREAS) return global.alert(t("maxAreas", { n: MAX_AREAS }));
    const nextNum = areas().reduce((m, x) => Math.max(m, x.number || 0), 0) + 1;
    const cur = a || { label: "", number: nextNum, capacity: ctx.ui.lastCap || 8, shape: ctx.ui.lastShape || "round" };
    const seated = a ? seatedIn(a.id) : [];
    const bg = document.createElement("div");
    bg.className = "pn-modal-bg";
    // Ad kutusunda panelin ürettiği ad seçilen dilde görünür ("Table 7"); kaydederken eski biçimde ("Masa 7") saklanır.
    bg.innerHTML = `<form class="pn-modal pn-area-form" role="dialog" aria-modal="true" aria-label="${esc(t(isNew ? "dlgAdd" : "dlgEditAria"))}" novalidate>
      <h3>${isNew ? esc(t("dlgAdd")) : esc(areaName(a))}</h3>
      <div class="pn-field-row">
        <label class="pn-field">${esc(t("fName"))} <input name="label" maxlength="60" placeholder="${esc(t("fNamePh", { n: nextNum }))}" value="${esc(I.displayAreaLabel(cur.label))}" autocomplete="off"></label>
        <label class="pn-field narrow">${esc(t("fNumber"))} <input name="number" type="number" min="0" max="9999" inputmode="numeric" value="${cur.number == null ? "" : cur.number}"></label>
      </div>
      <div class="pn-field-row">
        <label class="pn-field narrow">${esc(t("fCapacity"))} <input name="capacity" type="number" min="1" max="500" inputmode="numeric" value="${cur.capacity}"></label>
        <div class="pn-field">${esc(t("fShape"))}
          <div class="pn-seg" role="group" aria-label="${esc(t("fShape"))}">
            <button type="button" data-shape="round" aria-pressed="${cur.shape !== "rect"}">${esc(t("shapeRound"))}</button>
            <button type="button" data-shape="rect" aria-pressed="${cur.shape === "rect"}">${esc(t("shapeRect"))}</button>
          </div></div>
        ${isNew ? `<label class="pn-field narrow">${esc(t("fQty"))} <input name="qty" type="number" min="1" max="50" inputmode="numeric" value="1"></label>` : ""}
      </div>
      ${isNew ? `<p class="pn-muted pn-small">${esc(t("multiHint", { a: nextNum, b: nextNum + 1 }))}</p>` : ""}
      <p class="pn-form-err" data-err hidden></p>
      ${!isNew ? `<div class="pn-area-people"><div class="pn-muted pn-small">${esc(t("seatedHere", { n: seated.length, c: a.capacity }))}</div>
        ${seated.length ? `<ul>${seated.map(p => `<li data-row="${esc(p.id)}"><span>${esc(p.name)}${p.pos > 0 ? ` <span class="pn-muted">(${esc(p.group)})</span>` : ""}</span>
          <button type="button" class="pn-link" data-out="${esc(p.id)}">${esc(t("removeFromTable"))}</button></li>`).join("")}</ul>` : `<p class="pn-muted pn-small">${esc(t("noOneYet"))}</p>`}</div>` : ""}
      <div class="pn-modal-actions">
        ${!isNew ? `<button type="button" class="pn-btn danger" data-del>${esc(t("del"))}</button>` : "<span></span>"}
        <div class="pn-modal-actions-r"><button type="button" class="pn-btn" data-close>${esc(t("cancel"))}</button>
        <button type="submit" class="pn-btn primary">${esc(t(isNew ? "add" : "save"))}</button></div>
      </div></form>`;
    document.body.appendChild(bg);
    const f = bg.querySelector("form");
    let shape = cur.shape === "rect" ? "rect" : "round";
    const close = () => bg.remove();
    bg.addEventListener("click", (e) => { if (e.target === bg) close(); });
    bg.querySelector("[data-close]").addEventListener("click", close);
    bg.querySelectorAll("[data-shape]").forEach(b => b.addEventListener("click", () => {
      shape = b.getAttribute("data-shape");
      bg.querySelectorAll("[data-shape]").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    }));
    bg.querySelectorAll("[data-out]").forEach(b => b.addEventListener("click", () => {
      const id = b.getAttribute("data-out");
      const row = bg.querySelector(`[data-row="${CSS.escape(id)}"]`);
      if (row) row.remove();
      assign([id], null);
    }));
    const del = bg.querySelector("[data-del]");
    if (del) del.addEventListener("click", async () => {
      const n = countIn(a.id);
      if (!global.confirm(t("confirmDeleteArea", { area: areaName(a) }) + (n ? t("confirmDeleteAreaPeople", { n }) : ""))) return;
      try {
        await ctx.rpc("rsvp_panel_area_delete", { p_area_id: a.id });
        const s = seat();
        s.areas = s.areas.filter(x => x.id !== a.id);
        Object.keys(s.assignments).forEach(k => { if (s.assignments[k] === a.id) delete s.assignments[k]; });
        close(); draw();
        ctx.toast(t("areaDeleted", { area: areaName(a) }) + (n ? t("areaDeletedPeople", { n }) : ""));
      } catch (e) { ctx.onError(e); }
    });
    const err = (m) => { const p = bg.querySelector("[data-err]"); p.textContent = m; p.hidden = !m; };
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      // Panelin ürettiği ad ("Table 7" / "Masa 7") eski kayıt biçiminde saklanır: dil değişse de kayıt aynı kalır.
      const rawLabel = f.label.value.trim();
      const autoNo = I.autoTableNo(rawLabel);
      const label = autoNo != null ? I.canonicalTable(autoNo) : rawLabel;
      const numRaw = f.number.value.trim();
      const number = numRaw === "" ? null : parseInt(numRaw, 10);
      const capacity = parseInt(f.capacity.value, 10);
      if (!(capacity >= 1 && capacity <= 500)) return err(t("errCapacity"));
      if (number != null && !(number >= 0 && number <= 9999)) return err(t("errNumber"));
      const submitBtn = f.querySelector("[type=submit]");
      submitBtn.disabled = true;
      ctx.ui.lastCap = capacity; ctx.ui.lastShape = shape;
      try {
        if (isNew) {
          const qty = Math.max(1, Math.min(50, parseInt(f.qty.value, 10) || 1));
          if (areas().length + qty > MAX_AREAS) { submitBtn.disabled = false; return err(t("maxAreas", { n: MAX_AREAS })); }
          for (let i = 0; i < qty; i++) {
            const n = number == null ? null : number + i;
            const lbl = qty > 1 ? (label ? `${label} ${i + 1}` : (n != null ? I.canonicalTable(n) : "")) : (label || (n != null ? I.canonicalTable(n) : ""));
            const pos = freeSlot();
            const r = await ctx.rpc("rsvp_panel_area_save", { p_area: { label: lbl, number: n, capacity, shape, x: pos.x, y: pos.y, sort: areas().length } });
            seat().areas.push(normArea(r));
          }
          close(); draw();
          ctx.toast(qty > 1 ? t("areasAdded", { n: qty }) : t("areaAdded", { area: areaName(areas()[areas().length - 1]) }));
        } else {
          const r = await ctx.rpc("rsvp_panel_area_save", { p_area: { id: a.id, label, number, capacity, shape } });
          Object.assign(a, normArea(r));
          close(); draw();
          const n = countIn(a.id);
          ctx.toast(n > a.capacity ? t("savedOver", { area: areaName(a), n, c: a.capacity }) : t("saved"));
        }
      } catch (e2) {
        submitBtn.disabled = false;
        if (isNew) draw();
        ctx.onError(e2);
      }
    });
    setTimeout(() => { const i = f.querySelector(isNew ? "[name=capacity]" : "[name=label]"); if (i && global.innerWidth >= 720) i.focus(); }, 30);
  }

  /* ---------------- dışa aktarma ---------------- */
  function exportCsv(context) {
    ctx = context;
    if (!seat() || seat().error) return 0;
    PL = persons(); P = {}; PL.forEach(p => { P[p.id] = p; });
    const cols = ctx.cols || [];
    const rows = [[t("csvArea"), t("csvAreaNo"), t("csvCapacity"), t("csvAtTable"), t("csvNo"), t("thName"), t("csvParty")].concat(cols.map(c => c.label))];
    const respById = {};
    ctx.responses.forEach(r => { respById[r.id] = r; });
    const line = (aName, aNo, cap, cnt, i, p) => rows.push([aName, aNo, cap, cnt, i, p.name, p.group].concat(cols.map(c => ctx.answerText(respById[p.rid], c.id))));
    sortedAreas().forEach(a => {
      const ppl = seatedIn(a.id);
      if (!ppl.length) rows.push([areaName(a), a.number == null ? "" : a.number, a.capacity, 0, "", t("csvEmpty"), ""]);
      ppl.forEach((p, i) => line(areaName(a), a.number == null ? "" : a.number, a.capacity, ppl.length, i + 1, p));
    });
    PL.filter(p => !areaOf(p.id)).forEach((p, i) => line(t("statUnplaced"), "", "", "", i + 1, p));
    const stamp = new Date().toISOString().slice(0, 10);
    global.SeozPanelExport.download(`${global.SeozPanelExport.safeName(ctx.title)}-${t("fileSeating")}-${stamp}.csv`, rows);
    return PL.length;
  }

  /* Kişi listesi sekmesi ve Excel'i için: kişinin masası (yoksa ""). */
  function areaNameOf(seating, attendeeId) {
    if (!seating || seating.error) return "";
    const id = seating.assignments[attendeeId];
    const a = id && seating.areas.find(x => x.id === id);
    return areaName(a);
  }

  global.SeozPanelSeating = { render, exportCsv, normArea, areaNameOf };
})(window);
