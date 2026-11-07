/* =============================================================================
   STUDIO SEOZ — panel/panel-charts.js  (MÜŞTERİ PANELİ — GRAFİKLER, FAZ C)
   -----------------------------------------------------------------------------
   Yanıtlardan OTOMATİK grafik üretir. Dış kütüphane YOK (HTML çubuklar).
   - Katılım durumu, grup büyüklüğü (kişi sayısı sorusu varsa)
   - Editörde oluşturulan her Evet/Hayır, Tek seçim, Çoktan seçmeli,
     Açılır liste ve Çoklu seçim sorusunun cevap dağılımı
   - Sayı sorularında ortalama / en az / en çok / toplam
   Her kartta "Grafik" ve "Tablo" görünümü vardır. Grafikler paneldeki
   arama ve filtrelere uyar (ör. yalnızca katılanların menü dağılımı).
   "Yanıt" sayımı her yanıtı 1 sayar; "Kişi" sayımı yanıtı gruptaki kişi
   sayısıyla ağırlıklandırır (grubun cevabı gruptaki herkes için sayılır).
   Etkinlik türünden bağımsızdır; tüm başlıklar sorulardan gelir.
   ========================================================================= */

(function (global) {
  "use strict";

  const CHOICE_TYPES = ["yesno", "radio", "choice", "select", "checkbox"];
  const I = global.SeozPanelI18n;
  const t = (k, v) => I.t(k, v);

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }
  function fmtNum(n) { return I.fmtNum(n); }
  function pct(v, base) { return base ? Math.round((v / base) * 100) : 0; }
  const pctTxt = (v, base) => I.pct(pct(v, base));

  function weight(r, mode) { return mode === "people" ? Math.max(0, r.party_size || 0) : 1; }
  function answered(r, qid) {
    const a = (r.answers || {})[qid];
    if (!a) return false;
    const v = a.v;
    return !(v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length));
  }

  /* Bir seçenekli sorunun dağılımı: [{label, value}] + taban */
  function distribution(q, list, mode) {
    let rows;
    if (q.type === "yesno") rows = [{ key: true, label: q.yesLabel || t("yes") }, { key: false, label: q.noLabel || t("no") }];
    else rows = (q.options || []).map(o => ({ key: o.id, label: o.label || t("unnamedOption") }));
    rows.forEach(r => { r.value = 0; });
    let base = 0, unanswered = 0;
    list.forEach(r => {
      // "Yalnızca katılacaklara sor" soruları katılmayanlara hiç sorulmadı:
      // onlar ne cevaplayan ne de "boş bırakan" sayılır.
      if (q.onlyIfAttending && r.attending === false) return;
      const w = weight(r, mode);
      if (!answered(r, q.id)) { unanswered += w; return; }
      base += w;
      const v = r.answers[q.id].v;
      rows.forEach(row => {
        const hit = Array.isArray(v) ? v.includes(row.key) : v === row.key;
        if (hit) row.value += w;
      });
    });
    return { rows, base, unanswered };
  }

  function attendanceRows(list, q) {
    const rows = [
      { label: (q && q.yesLabel) || t("stYes"), value: 0 },
      { label: (q && q.noLabel) || t("stNo"), value: 0 },
      { label: t("stUnknown"), value: 0 }
    ];
    list.forEach(r => { rows[r.attending === true ? 0 : r.attending === false ? 1 : 2].value += 1; });
    if (!rows[2].value) rows.pop();
    return rows;
  }

  function groupSizeRows(list) {
    const counts = {};
    list.filter(r => r.attending !== false).forEach(r => { const n = r.party_size || 1; counts[n] = (counts[n] || 0) + 1; });
    return Object.keys(counts).map(Number).sort((a, b) => a - b).map(n => ({ label: t("partyOfN", { n }), value: counts[n] }));
  }

  /* ---------------- çizim ---------------- */
  function barsHtml(rows, base, unit) {
    const max = Math.max(1, ...rows.map(r => r.value));
    return `<div class="pn-bars" role="list">${rows.map(r => {
      const w = (r.value / max) * 100;
      const tip = `${r.label}: ${fmtNum(r.value)} ${t("unitWord", { people: unit === "people", n: r.value })}${base ? " (" + pctTxt(r.value, base) + ")" : ""}`;
      return `<div class="pn-bar-row" role="listitem" tabindex="0" title="${esc(tip)}" aria-label="${esc(tip)}">
        <div class="pn-bar-label">${esc(r.label)}</div>
        <div class="pn-bar-track"><div class="pn-bar" style="width:${w.toFixed(2)}%"></div>
          <span class="pn-bar-val">${fmtNum(r.value)}${base ? ` <span class="pn-muted">· ${pctTxt(r.value, base)}</span>` : ""}</span></div>
      </div>`;
    }).join("")}</div>`;
  }

  function tableHtml(rows, base, unit) {
    return `<table class="pn-mini-table"><thead><tr><th>${esc(t("thAnswer"))}</th><th>${esc(t(unit === "people" ? "unitGuests" : "unitResponses"))}</th>${base ? `<th>${esc(t("thShare"))}</th>` : ""}</tr></thead>
      <tbody>${rows.map(r => `<tr><td>${esc(r.label)}</td><td>${fmtNum(r.value)}</td>${base ? `<td>${pctTxt(r.value, base)}</td>` : ""}</tr>`).join("")}</tbody></table>`;
  }

  function card(id, title, sub, rows, base, unit, view) {
    const content = view === "table" ? tableHtml(rows, base, unit) : barsHtml(rows, base, unit);
    return `<section class="pn-chart" data-chart="${esc(id)}">
      <div class="pn-chart-head">
        <div><h3>${esc(title)}</h3>${sub ? `<div class="pn-chart-sub">${sub}</div>` : ""}</div>
        <div class="pn-seg pn-seg-sm pn-noprint" role="group" aria-label="${esc(t("viewAria"))}">
          <button data-view="chart" aria-pressed="${view !== "table"}">${esc(t("viewChart"))}</button>
          <button data-view="table" aria-pressed="${view === "table"}">${esc(t("viewTable"))}</button>
        </div>
      </div>
      ${rows.length ? content : `<p class="pn-muted">${esc(t("noAnswersYet"))}</p>`}
    </section>`;
  }

  function statsCard(q, list) {
    const vals = list.filter(r => answered(r, q.id)).map(r => Number(r.answers[q.id].v)).filter(v => isFinite(v));
    if (!vals.length) return `<section class="pn-chart"><div class="pn-chart-head"><div><h3>${esc(q.label)}</h3></div></div><p class="pn-muted">${esc(t("noAnswersYet"))}</p></section>`;
    const sum = vals.reduce((a, b) => a + b, 0);
    const tiles = [[t("stAvg"), sum / vals.length], [t("stMin"), Math.min(...vals)], [t("stMax"), Math.max(...vals)], [t("stSum"), sum]];
    return `<section class="pn-chart">
      <div class="pn-chart-head"><div><h3>${esc(q.label)}</h3><div class="pn-chart-sub">${esc(t("basedOn", { n: vals.length }))}</div></div></div>
      <div class="pn-stats">${tiles.map(([k, v]) => `<div class="pn-stat"><div class="pn-stat-label">${esc(k)}</div><div class="pn-stat-value">${fmtNum(v)}</div></div>`).join("")}</div>
    </section>`;
  }

  /* ctx: { questions, list (süzülmüş yanıtlar), total, hasAttendance, attendanceQ, mode, views, narrowed } */
  function render(container, ctx, onChange) {
    const unit = ctx.mode === "people" ? "people" : "responses";
    const uw = n => t("unitWord", { people: unit === "people", n });
    const parts = [];

    parts.push(`<div class="pn-chart-toolbar pn-noprint">
      <span class="pn-muted">${esc(t("countBy"))}</span>
      <div class="pn-seg pn-seg-sm" role="group" aria-label="${esc(t("countTypeAria"))}">
        <button data-mode="responses" aria-pressed="${ctx.mode !== "people"}">${esc(t("unitResponses"))}</button>
        <button data-mode="people" aria-pressed="${ctx.mode === "people"}">${esc(t("unitGuests"))}</button>
      </div>
      <span class="pn-muted pn-chart-hint">${esc(t(ctx.mode === "people" ? "hintPeople" : "hintResponses"))}</span>
    </div>`);
    if (ctx.narrowed) parts.push(`<p class="pn-count">${esc(t("chartsNarrowed", { n: ctx.list.length, t: ctx.total }))}</p>`);

    if (!ctx.list.length) {
      container.innerHTML = parts.join("") + `<div class="pn-empty">${esc(t("noChartData"))}</div>`;
      bind(container, ctx, onChange);
      return;
    }

    const grid = [];
    if (ctx.hasAttendance) {
      // Katılım her zaman YANIT sayısıyla gösterilir (katılmayanların kişi sayısı 0'dır).
      const rows = attendanceRows(ctx.list, ctx.attendanceQ);
      const base = rows.reduce((n, r) => n + r.value, 0);
      grid.push(card("__att", t("chAttendance"), esc(t("responsesN", { n: fmtNum(base) })), rows, base, "responses", ctx.views.__att));
    }
    const cq = ctx.questions.find(q => q.role === "count" && q.active !== false);
    if (cq) {
      const rows = groupSizeRows(ctx.list);
      const base = rows.reduce((n, r) => n + r.value, 0);
      grid.push(card("__size", t("chPartySize"), esc(t("chPartySizeSub", { n: fmtNum(base) })), rows, base, "responses", ctx.views.__size));
    }
    ctx.questions.forEach(q => {
      if (q.role === "attendance" || q.role === "count") return;
      if (CHOICE_TYPES.includes(q.type)) {
        const d = distribution(q, ctx.list, ctx.mode);
        const notes = [t("nAnswered", { n: fmtNum(d.base), u: uw(d.base) })];
        if (d.unanswered) notes.push(t("nBlank", { n: fmtNum(d.unanswered), u: uw(d.unanswered) }));
        if (q.type === "checkbox") notes.push(t("multiNote"));
        grid.push(card(q.id, q.label || t("untitledQ"), esc(notes.join(" · ")) + (q.active === false ? ` · <i>${esc(t("inactiveQ"))}</i>` : ""),
          d.rows, d.base, unit, ctx.views[q.id]));
      } else if (q.type === "number") {
        grid.push(statsCard(q, ctx.list));
      }
    });
    if (grid.length === (ctx.hasAttendance ? 1 : 0) + (cq ? 1 : 0)) {
      grid.push(`<section class="pn-chart"><p class="pn-muted">${esc(t("noChoiceQs"))}</p></section>`);
    }
    container.innerHTML = parts.join("") + `<div class="pn-charts">${grid.join("")}</div>`;
    bind(container, ctx, onChange);
  }

  function bind(container, ctx, onChange) {
    container.querySelectorAll("[data-mode]").forEach(b => b.addEventListener("click", () => onChange({ mode: b.getAttribute("data-mode") })));
    container.querySelectorAll("[data-chart]").forEach(sec => {
      sec.querySelectorAll("[data-view]").forEach(b => b.addEventListener("click", () => {
        onChange({ view: { id: sec.getAttribute("data-chart"), value: b.getAttribute("data-view") } });
      }));
    });
  }

  global.SeozPanelCharts = { render, distribution, attendanceRows, groupSizeRows };
})(window);
