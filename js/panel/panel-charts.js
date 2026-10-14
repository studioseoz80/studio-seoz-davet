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

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }
  function fmtNum(n) {
    return Number(n).toLocaleString("tr-TR", { maximumFractionDigits: 1 });
  }
  function pct(v, base) { return base ? Math.round((v / base) * 100) : 0; }

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
    if (q.type === "yesno") rows = [{ key: true, label: q.yesLabel || "Evet" }, { key: false, label: q.noLabel || "Hayır" }];
    else rows = (q.options || []).map(o => ({ key: o.id, label: o.label || "(adsız seçenek)" }));
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
      { label: (q && q.yesLabel) || "Katılıyor", value: 0 },
      { label: (q && q.noLabel) || "Katılmıyor", value: 0 },
      { label: "Belirtilmedi", value: 0 }
    ];
    list.forEach(r => { rows[r.attending === true ? 0 : r.attending === false ? 1 : 2].value += 1; });
    if (!rows[2].value) rows.pop();
    return rows;
  }

  function groupSizeRows(list) {
    const counts = {};
    list.filter(r => r.attending !== false).forEach(r => { const n = r.party_size || 1; counts[n] = (counts[n] || 0) + 1; });
    return Object.keys(counts).map(Number).sort((a, b) => a - b).map(n => ({ label: n + " kişilik", value: counts[n] }));
  }

  /* ---------------- çizim ---------------- */
  function barsHtml(rows, base, unitLabel) {
    const max = Math.max(1, ...rows.map(r => r.value));
    return `<div class="pn-bars" role="list">${rows.map(r => {
      const w = (r.value / max) * 100;
      const tip = `${r.label}: ${fmtNum(r.value)} ${unitLabel}${base ? " (%" + pct(r.value, base) + ")" : ""}`;
      return `<div class="pn-bar-row" role="listitem" tabindex="0" title="${esc(tip)}" aria-label="${esc(tip)}">
        <div class="pn-bar-label">${esc(r.label)}</div>
        <div class="pn-bar-track"><div class="pn-bar" style="width:${w.toFixed(2)}%"></div>
          <span class="pn-bar-val">${fmtNum(r.value)}${base ? ` <span class="pn-muted">· %${pct(r.value, base)}</span>` : ""}</span></div>
      </div>`;
    }).join("")}</div>`;
  }

  function tableHtml(rows, base, unitLabel) {
    return `<table class="pn-mini-table"><thead><tr><th>Cevap</th><th>${esc(unitLabel)}</th>${base ? "<th>Oran</th>" : ""}</tr></thead>
      <tbody>${rows.map(r => `<tr><td>${esc(r.label)}</td><td>${fmtNum(r.value)}</td>${base ? `<td>%${pct(r.value, base)}</td>` : ""}</tr>`).join("")}</tbody></table>`;
  }

  function card(id, title, sub, rows, base, unitLabel, view) {
    const content = view === "table" ? tableHtml(rows, base, unitLabel) : barsHtml(rows, base, unitLabel);
    return `<section class="pn-chart" data-chart="${esc(id)}">
      <div class="pn-chart-head">
        <div><h3>${esc(title)}</h3>${sub ? `<div class="pn-chart-sub">${sub}</div>` : ""}</div>
        <div class="pn-seg pn-seg-sm pn-noprint" role="group" aria-label="Görünüm">
          <button data-view="chart" aria-pressed="${view !== "table"}">Grafik</button>
          <button data-view="table" aria-pressed="${view === "table"}">Tablo</button>
        </div>
      </div>
      ${rows.length ? content : `<p class="pn-muted">Henüz bu soruya cevap yok.</p>`}
    </section>`;
  }

  function statsCard(q, list) {
    const vals = list.filter(r => answered(r, q.id)).map(r => Number(r.answers[q.id].v)).filter(v => isFinite(v));
    if (!vals.length) return `<section class="pn-chart"><div class="pn-chart-head"><div><h3>${esc(q.label)}</h3></div></div><p class="pn-muted">Henüz bu soruya cevap yok.</p></section>`;
    const sum = vals.reduce((a, b) => a + b, 0);
    const tiles = [["Ortalama", sum / vals.length], ["En az", Math.min(...vals)], ["En çok", Math.max(...vals)], ["Toplam", sum]];
    return `<section class="pn-chart">
      <div class="pn-chart-head"><div><h3>${esc(q.label)}</h3><div class="pn-chart-sub">${vals.length} yanıt üzerinden</div></div></div>
      <div class="pn-stats">${tiles.map(([k, v]) => `<div class="pn-stat"><div class="pn-stat-label">${k}</div><div class="pn-stat-value">${fmtNum(v)}</div></div>`).join("")}</div>
    </section>`;
  }

  /* ctx: { questions, list (süzülmüş yanıtlar), total, hasAttendance, attendanceQ, mode, views, narrowed } */
  function render(container, ctx, onChange) {
    const unit = ctx.mode === "people" ? "kişi" : "yanıt";
    const parts = [];

    parts.push(`<div class="pn-chart-toolbar pn-noprint">
      <span class="pn-muted">Sayım:</span>
      <div class="pn-seg pn-seg-sm" role="group" aria-label="Sayım türü">
        <button data-mode="responses" aria-pressed="${ctx.mode !== "people"}">Yanıt</button>
        <button data-mode="people" aria-pressed="${ctx.mode === "people"}">Kişi</button>
      </div>
      <span class="pn-muted pn-chart-hint">${ctx.mode === "people"
        ? "Her yanıt, gruptaki kişi sayısı kadar sayılır (grubun cevabı gruptaki herkes için geçerli kabul edilir)."
        : "Her yanıt 1 sayılır."}</span>
    </div>`);
    if (ctx.narrowed) parts.push(`<p class="pn-count">Grafikler arama/filtre sonucundaki ${ctx.list.length} yanıta göre çizildi (toplam ${ctx.total}).</p>`);

    if (!ctx.list.length) {
      container.innerHTML = parts.join("") + `<div class="pn-empty">Grafik için henüz yanıt yok.</div>`;
      bind(container, ctx, onChange);
      return;
    }

    const grid = [];
    if (ctx.hasAttendance) {
      // Katılım her zaman YANIT sayısıyla gösterilir (katılmayanların kişi sayısı 0'dır).
      const rows = attendanceRows(ctx.list, ctx.attendanceQ);
      const base = rows.reduce((n, r) => n + r.value, 0);
      grid.push(card("__att", "Katılım durumu", `${fmtNum(base)} yanıt`, rows, base, "yanıt", ctx.views.__att));
    }
    const cq = ctx.questions.find(q => q.role === "count" && q.active !== false);
    if (cq) {
      const rows = groupSizeRows(ctx.list);
      const base = rows.reduce((n, r) => n + r.value, 0);
      grid.push(card("__size", "Grup büyüklüğü", `Katılan ${fmtNum(base)} yanıtın kaç kişilik olduğu`, rows, base, "yanıt", ctx.views.__size));
    }
    ctx.questions.forEach(q => {
      if (q.role === "attendance" || q.role === "count") return;
      if (CHOICE_TYPES.includes(q.type)) {
        const d = distribution(q, ctx.list, ctx.mode);
        const notes = [`${fmtNum(d.base)} ${unit} cevapladı`];
        if (d.unanswered) notes.push(`${fmtNum(d.unanswered)} ${unit} boş bıraktı`);
        if (q.type === "checkbox") notes.push("birden fazla seçilebildiği için oranların toplamı %100'ü geçebilir");
        grid.push(card(q.id, q.label || "(başlıksız soru)", esc(notes.join(" · ")) + (q.active === false ? " · <i>pasif soru</i>" : ""),
          d.rows, d.base, unit, ctx.views[q.id]));
      } else if (q.type === "number") {
        grid.push(statsCard(q, ctx.list));
      }
    });
    if (grid.length === (ctx.hasAttendance ? 1 : 0) + (cq ? 1 : 0)) {
      grid.push(`<section class="pn-chart"><p class="pn-muted">Formda seçenekli soru (Evet/Hayır, Tek seçim, Çoktan seçmeli, Açılır liste, Çoklu seçim) yok. Böyle bir soru eklendiğinde dağılımı burada otomatik görünür.</p></section>`);
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
