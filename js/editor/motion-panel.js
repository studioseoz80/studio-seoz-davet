/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — motion-panel.js  (✨ OTOMATİK SAHNE UYUMU paneli)
   -----------------------------------------------------------------------------
   Belgenin bütün hareketlerini (açılış, İç Zemin, etkileşimler) tek bir sahne
   gibi uyumlar. Hesaplamanın tamamı core/motion.js'tedir; bu dosya yalnızca:
     - aç/kapat, üç hareket karakteri (Zarif / Neşeli / Görkemli)
     - sahne analizi (ana / dekoratif / sürekli hareket sayıları, uyarılar)
     - "Uyumla", "Elle ayarlarımı da uyumla" (açık izinle), "Uyumu geri al"
   Her değişiklik editörün geri alma geçmişine de girer (Ctrl+Z).
   ========================================================================= */
(function (global) {
  "use strict";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

  function chip(doc) {
    const m = doc && doc.motion, M = global.SeozMotion;
    if (!M || !m || m.on === false) return "✨ Sahne Uyumu: kapalı";
    const c = M.CHARACTERS[m.character] || M.CHARACTERS.zarif;
    return `✨ Sahne Uyumu: ${c.label}`;
  }

  function open(doc, cb) {
    cb = cb || {};
    const M = global.SeozMotion; if (!M) return;
    const old = document.querySelector(".mp-root"); if (old) old.remove();
    let report = null, confirmForce = false;
    const root = document.createElement("div");
    root.className = "mp-root"; root.setAttribute("role", "dialog"); root.setAttribute("aria-label", "Otomatik Sahne Uyumu");
    document.body.appendChild(root);
    const on = () => !!(doc.motion && doc.motion.v && doc.motion.on !== false);
    const charId = () => (doc.motion && M.CHARACTERS[doc.motion.character] ? doc.motion.character : "zarif");
    const changed = () => { if (cb.onChange) cb.onChange(); };

    function analysisHTML() {
      const a = M.analyze(doc), rows = [];
      const fmt = (r, label) => {
        const tot = r.main + r.deco + r.loop; if (!tot) return "";
        return `<li><b>${label}</b><span>${r.main} ana hareket · ${r.deco} dekoratif · ${r.loop} sürekli</span></li>`;
      };
      const entryLabel = { cinema: "Açılış (Animasyon Stüdyosu)", png: "Açılış (zarf + kart)", "dual-wing": "Açılış (çift kanat)", card: "Açılış (tek kart)", video: "Açılış (video)" }[a.entryType];
      if (a.entryType === "cinema") {
        if (a.preset) rows.push(`<li><b>${entryLabel}</b><span>Hazır kapı kurgusu kullanılıyor — kendi özel zamanlaması aynen korunur; ortam efektleri doğal süzülür.</span></li>`);
        else rows.push(fmt(a.cinema, entryLabel) || `<li><b>${entryLabel}</b><span>Henüz hareket eklenmemiş</span></li>`);
      } else if (entryLabel) rows.push(`<li><b>${entryLabel}</b><span>Zarf, kart ve geçişler aynı doğal eğrilerle oynar</span></li>`);
      if (a.bgLayers) rows.push(`<li><b>İç Zemin</b><span>${a.bgLayers} katman${a.bg.main + a.bg.deco + a.bg.loop ? ` · ${a.bg.main + a.bg.deco + a.bg.loop} 3D hareket` : ""} · her katman kendi evresinde, kaydırma yumuşak</span></li>`);
      if (a.ix) rows.push(`<li><b>Etkileşimler</b><span>${a.ix} etkileşim · tetikleme → ana hareket → sonuç → kutlama sırası</span></li>`);
      if (!rows.length) rows.push(`<li><span>Bu belgede henüz hareket yok. Görsel ve hareket eklediğinizde sahne kendiliğinden uyumlanır.</span></li>`);
      const warns = (a.warnings || []).map(w => `<li class="mp-warn">⚠ <b>${esc(w.name)}</b> öndeki süs katmanı bir ${esc(w.targetName)} üzerine biniyor (%${w.share})${w.moving ? " ve hareket ediyor" : ""}.
        <button type="button" class="mp-link" data-mp-back="${esc(w.layer)}">Arkaya al</button></li>`);
      return `<ul class="mp-list">${rows.join("")}${warns.join("")}</ul>`;
    }
    function reportHTML() {
      if (!report) return "";
      const parts = [];
      parts.push(report.changed ? `${report.changed} hareket uyumlandı` : "Sahne zaten uyumlu");
      if (report.kept) parts.push(`${report.kept} elle ayarınız korundu`);
      const dup = (report.cinema.conflicts || []).concat(report.bg.conflicts || []).filter(c => c.type === "loop-dup").length;
      if (dup) parts.push(`${dup} katmanda aynı sürekli hareket iki kez var (genliği ikiye katlar)`);
      return `<p class="mp-report" role="status">✓ ${parts.join(" · ")}</p>`;
    }
    function draw() {
      const isOn = on(), cid = charId();
      root.innerHTML = `
        <div class="mp-card">
          <header class="mp-head"><div><h2>✨ Otomatik Sahne Uyumu</h2>
            <p>Katmanlarınıza dokunmadan bütün hareketleri tek bir sinematik sahne gibi uyumlar: zamanlama, hız, geçiş ve enerji.</p></div>
            <button type="button" class="mp-x" data-mp-close aria-label="Kapat">✕</button></header>
          <label class="mp-switch"><input type="checkbox" data-mp-on ${isOn ? "checked" : ""}><span class="mp-track"><i></i></span>
            <span><b>${isOn ? "Açık" : "Kapalı"}</b> · ${isOn ? "yeni katman ve hareketler eklendikçe sahne kendiliğinden yeniden uyumlanır" : "açtığınızda mevcut hareketler uyumlanır; istediğiniz an geri alabilirsiniz"}</span></label>
          <h3>Hareket karakteri</h3>
          <div class="mp-chars" role="radiogroup" aria-label="Hareket karakteri">
            ${M.ORDER.map(id => { const c = M.CHARACTERS[id]; return `<button type="button" role="radio" aria-checked="${isOn && cid === id}" class="mp-char${isOn && cid === id ? " is-on" : ""}" data-mp-char="${id}">
              <span class="mp-ic">${c.icon}</span><strong>${c.label}</strong><small>${esc(c.desc)}</small></button>`; }).join("")}
          </div>
          <h3>Sahne analizi</h3>
          ${analysisHTML()}
          ${reportHTML()}
          <div class="mp-actions">
            <button type="button" class="btn btn-gold" data-mp-apply>✨ ${isOn ? "Yeniden uyumla" : "Uyumla"}</button>
            ${confirmForce ? `<span class="mp-confirm">Elle yaptığınız gecikme, süre ve yumuşaklık ayarları da değişecek. <button type="button" class="btn btn-outline" data-mp-force-yes>Evet, uyumla</button> <button type="button" class="mp-link" data-mp-force-no>Vazgeç</button></span>`
              : `<button type="button" class="btn btn-outline" data-mp-force>Elle ayarlarımı da uyumla</button>`}
            <button type="button" class="btn btn-outline" data-mp-undo ${isOn ? "" : "disabled"}>↶ Uyumu geri al</button>
          </div>
          <p class="mp-note">Elle değiştirdiğiniz ayarlar korunur. “Uyumu geri al” bütün otomatik düzenlemeleri önceki hâline döndürür. Editör önizlemesi ile yayındaki davetiye aynı hareketleri gösterir.</p>
        </div>`;
    }
    function close() { root.remove(); document.removeEventListener("keydown", onKey); if (cb.onClose) cb.onClose(); }
    function onKey(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", onKey);
    root.addEventListener("click", e => {
      const t = e.target.closest("button, input"); if (e.target === root) return close();
      if (!t) return;
      if (t.matches("[data-mp-close]")) return close();
      if (t.matches("[data-mp-char]")) { report = M.apply(doc, t.dataset.mpChar); confirmForce = false; changed(); return draw(); }
      if (t.matches("[data-mp-apply]")) { report = M.apply(doc, charId()); confirmForce = false; changed(); return draw(); }
      if (t.matches("[data-mp-force]")) { confirmForce = true; return draw(); }
      if (t.matches("[data-mp-force-no]")) { confirmForce = false; return draw(); }
      if (t.matches("[data-mp-force-yes]")) { report = M.apply(doc, charId(), { force: true }); confirmForce = false; changed(); return draw(); }
      if (t.matches("[data-mp-undo]")) { const n = M.undo(doc); report = null; changed(); draw(); const p = root.querySelector(".mp-note"); if (p) p.textContent = `↶ Uyum geri alındı: ${n} ayar önceki hâline döndü.`; return; }
      if (t.matches("[data-mp-back]")) {
        const L = doc.theme && doc.theme.bg && (doc.theme.bg.layers || []).find(x => x.id === t.dataset.mpBack);
        if (L) { delete L.front; changed(); draw(); }
      }
    });
    root.addEventListener("change", e => {
      if (!e.target.matches("[data-mp-on]")) return;
      if (e.target.checked) report = M.apply(doc, charId());
      else { M.undo(doc); report = null; }
      changed(); draw();
    });
    draw();
    return { close };
  }

  global.SeozMotionPanel = { open, chip };
})(window);
