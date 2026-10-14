/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — editor/attendance-form-panel.js  (KATILIM FORMU — SORU OLUŞTURUCU)
   -----------------------------------------------------------------------------
   Katılım Formu modülünün sorularını yönetir: Soru Ekle, 8 soru türü,
   zorunlu/isteğe bağlı, aktif/pasif, "yalnızca katılacaklara göster",
   soru görevleri (Katılım durumu / Kişi sayısı), seçenek ekle/sil/sırala,
   diğer katılımcıların isimleri ve onay (KVKK) metni.

   Başlık, renk, font, buton yazıları ve "Öne getir / Çoğalt / Sil" düğmeleri
   için MEVCUT genel panel (module-panel.js) aynen kullanılır — burada tekrar
   yazılmadı. Diğer hiçbir modülün paneli bundan etkilenmez.
   ========================================================================= */

(function (global) {
  "use strict";

  function esc(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, s => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[s]);
  }

  const SECTION = 'style="margin-top:16px;padding-top:14px;border-top:1px dashed var(--line, #ccc);"';
  const SMALL = 'style="font-size:.72rem;color:var(--ink-soft, #777);margin:2px 0 8px;"';

  function questionCard(q, i, total, def) {
    const typeOpts = def.QUESTION_TYPES.map(t => `<option value="${t.value}" ${t.value === q.type ? "selected" : ""}>${t.label}</option>`).join("");
    const hasOptions = def.OPTION_TYPES.includes(q.type);
    const roleSelect = q.type === "yesno"
      ? `<label style="display:flex;align-items:center;gap:6px;margin-top:6px;font-size:.76rem;">
           <input type="checkbox" data-q-role="attendance" ${q.role === "attendance" ? "checked" : ""} style="width:auto;">
           Bu soru "Katılım durumu" sorusudur (Evet = katılıyor)</label>`
      : q.type === "number"
        ? `<label style="display:flex;align-items:center;gap:6px;margin-top:6px;font-size:.76rem;">
             <input type="checkbox" data-q-role="count" ${q.role === "count" ? "checked" : ""} style="width:auto;">
             Bu soru "Kişi sayısı" sorusudur</label>`
        : "";
    const badge = q.role === "attendance" ? " · Katılım durumu" : q.role === "count" ? " · Kişi sayısı" : "";

    return `<div data-q-idx="${i}" style="border:1px solid var(--line, #ddd);border-radius:10px;padding:10px;margin-top:10px;${q.active ? "" : "opacity:.6;"}">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
        <strong style="font-size:.78rem;">Soru ${i + 1}${badge}${q.active ? "" : " (pasif)"}</strong>
        <span style="display:flex;gap:4px;">
          <button type="button" class="btn btn-outline" data-q-move="-1" title="Yukarı" style="padding:2px 8px;" ${i === 0 ? "disabled" : ""}>↑</button>
          <button type="button" class="btn btn-outline" data-q-move="1" title="Aşağı" style="padding:2px 8px;" ${i === total - 1 ? "disabled" : ""}>↓</button>
          <button type="button" class="btn btn-danger-text" data-q-remove title="Soruyu sil">Sil</button>
        </span>
      </div>
      <div class="field" style="margin-top:8px;"><label>Soru</label>
        <input type="text" data-q-field="label" value="${esc(q.label)}" placeholder="Sorunuzu yazın"></div>
      <div class="field" style="margin-top:6px;"><label>Soru Türü</label>
        <select data-q-type>${typeOpts}</select></div>
      <div class="field" style="margin-top:6px;"><label>Kısa açıklama (isteğe bağlı)</label>
        <input type="text" data-q-field="help" value="${esc(q.help)}"></div>
      ${q.type === "yesno" ? `
        <div style="display:flex;gap:6px;margin-top:6px;">
          <div class="field" style="flex:1;"><label>"Evet" yazısı</label><input type="text" data-q-field="yesLabel" value="${esc(q.yesLabel)}"></div>
          <div class="field" style="flex:1;"><label>"Hayır" yazısı</label><input type="text" data-q-field="noLabel" value="${esc(q.noLabel)}"></div>
        </div>` : ""}
      ${q.type === "number" && q.role !== "count" ? `
        <div style="display:flex;gap:6px;margin-top:6px;">
          <div class="field" style="flex:1;"><label>En az</label><input type="number" data-q-num="min" value="${esc(q.min)}"></div>
          <div class="field" style="flex:1;"><label>En fazla</label><input type="number" data-q-num="max" value="${esc(q.max)}"></div>
        </div>` : ""}
      ${hasOptions ? `
        <div class="field" style="margin-top:8px;"><label>Seçenekler</label>
          ${q.options.map((o, oi) => `
            <div style="display:flex;gap:4px;margin-top:4px;">
              <input type="text" data-opt-idx="${oi}" value="${esc(o.label)}" placeholder="Seçenek ${oi + 1}" style="flex:1;">
              <button type="button" class="btn btn-outline" data-opt-move="${oi}" data-dir="-1" title="Yukarı" style="padding:2px 7px;" ${oi === 0 ? "disabled" : ""}>↑</button>
              <button type="button" class="btn btn-danger-text" data-opt-remove="${oi}" title="Seçeneği sil">✕</button>
            </div>`).join("")}
          <button type="button" class="btn btn-outline" data-opt-add style="width:100%;margin-top:6px;">+ Seçenek Ekle</button>
        </div>` : ""}
      ${roleSelect}
      <div style="display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:8px;font-size:.76rem;">
        <label style="display:flex;align-items:center;gap:5px;"><input type="checkbox" data-q-flag="required" ${q.required ? "checked" : ""} style="width:auto;"> Zorunlu</label>
        <label style="display:flex;align-items:center;gap:5px;"><input type="checkbox" data-q-flag="active" ${q.active ? "checked" : ""} style="width:auto;"> Aktif</label>
        ${q.role === "attendance" ? "" : `<label style="display:flex;align-items:center;gap:5px;"><input type="checkbox" data-q-flag="onlyIfAttending" ${q.onlyIfAttending ? "checked" : ""} style="width:auto;"> Yalnızca katılacaklara sor</label>`}
      </div>
    </div>`;
  }

  function render(containerEl, layer, cb) {
    const def = global.SeozModuleRegistry.getModule("attendance-form");
    const s = layer.settings;
    // Sorular her zaman temiz ve kalıcı kimlikli tutulur.
    s.questions = def.getQuestions(s);
    const qs = s.questions;

    const top = document.createElement("div");
    const rest = document.createElement("div");
    containerEl.innerHTML = "";
    containerEl.appendChild(top);
    containerEl.appendChild(rest);

    const hasAttendance = qs.some(q => q.active && q.role === "attendance");
    const hasCount = qs.some(q => q.active && q.role === "count");

    top.innerHTML = `
      <p class="sidebar-empty" style="margin-bottom:8px;">Katılım Formu ayarları</p>
      <p ${SMALL}>Yanıtlar Studio SEOZ veritabanına kaydedilir. Form, davetiye "Yayına Hazırla" ile yayınlandıktan sonra yanıt almaya başlar. Editörde deneme gönderimi kaydedilmez.</p>

      <div class="field"><label>Ad Soyad alanı başlığı</label>
        <input type="text" data-s-text="nameLabel" value="${esc(s.nameLabel)}"></div>
      <p ${SMALL}>Bu alan her formda vardır ve zorunludur.</p>

      <div ${SECTION}>
        <label style="font-weight:700;">Sorular</label>
        ${hasAttendance ? "" : `<p ${SMALL}>İpucu: Bir Evet/Hayır sorusunu "Katılım durumu" olarak işaretlerseniz panelde Katılacak/Katılmayacak sayıları hesaplanır.</p>`}
        <div data-q-list>${qs.map((q, i) => questionCard(q, i, qs.length, def)).join("")}</div>
        <div style="display:flex;gap:6px;margin-top:10px;">
          <select data-new-q-type style="flex:1;">${def.QUESTION_TYPES.map(t => `<option value="${t.value}">${t.label}</option>`).join("")}</select>
          <button type="button" class="btn btn-gold" data-add-q>+ Soru Ekle</button>
        </div>
      </div>

      <div ${SECTION}>
        <label style="font-weight:700;">Katılımcılar</label>
        ${hasCount ? "" : `<p ${SMALL}>Kişi sayısı sorusu yoksa her yanıt 1 kişi sayılır.</p>`}
        <div class="field" style="margin-top:6px;"><label>Bir yanıtta en fazla kişi sayısı</label>
          <input type="number" min="1" max="100" data-s-num="maxPartySize" value="${esc(s.maxPartySize)}"></div>
        <label style="display:flex;align-items:center;gap:6px;margin-top:8px;font-size:.78rem;">
          <input type="checkbox" data-s-flag="askCompanionNames" ${s.askCompanionNames ? "checked" : ""} style="width:auto;">
          Diğer katılımcıların isimlerini sor (kişi sayısı 1'den fazlaysa)</label>
        ${s.askCompanionNames ? `
          <label style="display:flex;align-items:center;gap:6px;margin-top:6px;font-size:.78rem;">
            <input type="checkbox" data-s-flag="companionNamesRequired" ${s.companionNamesRequired ? "checked" : ""} style="width:auto;">
            İsimler zorunlu olsun</label>
          <div class="field" style="margin-top:6px;"><label>İsim alanı başlığı ({n} = kişinin sırası)</label>
            <input type="text" data-s-text="companionLabel" value="${esc(s.companionLabel)}"></div>
          <p ${SMALL}>Her kişi ayrı katılımcı olarak kaydedilir; yerleşim planında tek tek veya grup olarak taşınabilir.</p>` : ""}
      </div>

      <div ${SECTION}>
        <label style="font-weight:700;">Onay Metni (KVKK)</label>
        <p ${SMALL}>Doluysa formun altında işaretlenmesi zorunlu bir onay kutusu çıkar. Sağlık (ör. alerji) gibi hassas bilgiler soruyorsanız önerilir.</p>
        <div class="field"><textarea rows="3" data-s-text="consentText">${esc(s.consentText)}</textarea></div>
      </div>

      <div ${SECTION}></div>
    `;

    const rerender = () => { cb.onSettingsChange(); render(containerEl, layer, cb); };
    const light = () => cb.onSettingsChange();   // yazarken: yalnızca önizleme yenilenir, odak kaybolmaz

    // --- form düzeyi ayarlar
    top.querySelectorAll("[data-s-text]").forEach(inp => {
      inp.addEventListener("input", () => { s[inp.getAttribute("data-s-text")] = inp.value; light(); });
    });
    top.querySelectorAll("[data-s-num]").forEach(inp => {
      inp.addEventListener("input", () => {
        const n = parseInt(inp.value, 10);
        s[inp.getAttribute("data-s-num")] = isFinite(n) ? Math.max(1, Math.min(100, n)) : 10;
        light();
      });
    });
    top.querySelectorAll("[data-s-flag]").forEach(inp => {
      inp.addEventListener("change", () => { s[inp.getAttribute("data-s-flag")] = inp.checked; rerender(); });
    });

    // --- soru ekle
    top.querySelector("[data-add-q]").addEventListener("click", () => {
      const type = top.querySelector("[data-new-q-type]").value;
      const q = def.normalizeQuestion({ id: def.newId("q"), type, label: "", active: true });
      if (def.OPTION_TYPES.includes(type)) q.options = [{ id: def.newId("o"), label: "" }, { id: def.newId("o"), label: "" }];
      qs.push(q);
      rerender();
      const cards = top.querySelectorAll("[data-q-idx]");
      const last = cards[cards.length - 1];
      if (last) { const inp = last.querySelector('[data-q-field="label"]'); if (inp) inp.focus(); }
    });

    // --- her soru kartı
    top.querySelectorAll("[data-q-idx]").forEach(card => {
      const i = parseInt(card.getAttribute("data-q-idx"), 10);
      const q = qs[i];

      card.querySelectorAll("[data-q-field]").forEach(inp => {
        inp.addEventListener("input", () => { q[inp.getAttribute("data-q-field")] = inp.value; light(); });
      });
      card.querySelectorAll("[data-q-num]").forEach(inp => {
        inp.addEventListener("input", () => { q[inp.getAttribute("data-q-num")] = inp.value === "" ? "" : Number(inp.value); light(); });
      });
      card.querySelector("[data-q-type]").addEventListener("change", (e) => {
        q.type = e.target.value;
        if (def.OPTION_TYPES.includes(q.type) && (!q.options || !q.options.length)) {
          q.options = [{ id: def.newId("o"), label: "" }, { id: def.newId("o"), label: "" }];
        }
        if (q.type === "yesno") { q.yesLabel = q.yesLabel || "Evet"; q.noLabel = q.noLabel || "Hayır"; }
        qs[i] = def.normalizeQuestion(q);
        rerender();
      });
      card.querySelectorAll("[data-q-flag]").forEach(inp => {
        inp.addEventListener("change", () => { q[inp.getAttribute("data-q-flag")] = inp.checked; rerender(); });
      });
      card.querySelectorAll("[data-q-role]").forEach(inp => {
        inp.addEventListener("change", () => {
          const role = inp.getAttribute("data-q-role");
          // Her görev formda yalnızca bir soruda olabilir.
          qs.forEach(other => { if (other.role === role) other.role = ""; });
          q.role = inp.checked ? role : "";
          if (q.role === "attendance") q.onlyIfAttending = false;
          if (q.role === "count") { q.required = true; q.onlyIfAttending = true; }
          rerender();
        });
      });
      card.querySelector("[data-q-remove]").addEventListener("click", () => {
        const name = q.label ? `"${q.label}"` : `Soru ${i + 1}`;
        if (!confirm(name + " silinsin mi?\n\nDaha önce bu soruya verilmiş yanıtlar panelde kalmaya devam eder.")) return;
        qs.splice(i, 1);
        rerender();
      });
      card.querySelectorAll("[data-q-move]").forEach(btn => {
        btn.addEventListener("click", () => {
          const to = i + parseInt(btn.getAttribute("data-q-move"), 10);
          if (to < 0 || to >= qs.length) return;
          const tmp = qs[i]; qs[i] = qs[to]; qs[to] = tmp;
          rerender();
        });
      });
      // seçenekler
      card.querySelectorAll("[data-opt-idx]").forEach(inp => {
        inp.addEventListener("input", () => { q.options[parseInt(inp.getAttribute("data-opt-idx"), 10)].label = inp.value; light(); });
      });
      const add = card.querySelector("[data-opt-add]");
      if (add) add.addEventListener("click", () => {
        q.options.push({ id: def.newId("o"), label: "" });
        rerender();
        const inputs = top.querySelectorAll(`[data-q-idx="${i}"] [data-opt-idx]`);
        if (inputs.length) inputs[inputs.length - 1].focus();
      });
      card.querySelectorAll("[data-opt-remove]").forEach(btn => {
        btn.addEventListener("click", () => { q.options.splice(parseInt(btn.getAttribute("data-opt-remove"), 10), 1); rerender(); });
      });
      card.querySelectorAll("[data-opt-move]").forEach(btn => {
        btn.addEventListener("click", () => {
          const oi = parseInt(btn.getAttribute("data-opt-move"), 10);
          const to = oi + parseInt(btn.getAttribute("data-dir"), 10);
          if (to < 0 || to >= q.options.length) return;
          const tmp = q.options[oi]; q.options[oi] = q.options[to]; q.options[to] = tmp;
          rerender();
        });
      });
    });

    // Başlık, buton yazıları, renk, font + Öne getir/Çoğalt/Sil → mevcut genel panel
    global.SeozModulePanel.render(rest, layer, cb);
    const heading = rest.querySelector(".sidebar-empty");
    if (heading) heading.textContent = "Görünüm ve yazılar";
  }

  global.SeozAttendanceFormPanel = { render };
})(window);
