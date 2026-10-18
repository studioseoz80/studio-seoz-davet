/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — cinema-studio2.js  (A2.1 · SERBEST ANİMASYON STÜDYOSU)
   -----------------------------------------------------------------------------
   Görseli kullanıcı seçer, hareketi menüden uygular:
     - istediğin kadar PNG/JPG/WebP katman: ekle, sil, sırala, sürükle, bağla
     - her katmana birden çok hareket; Başlat: Dokununca / Öncekiyle birlikte /
       Öncekinden sonra; gecikme, süre, yumuşaklık, tekrar
     - isteğe bağlı hazır kurgu: A1'in üç kapı senaryosu, rolleri kullanıcının
       katmanlarına eşlenerek
   Veri: entry.cinema (v:2) — bkz. js/cinema/free.js. Görseller IndexedDB'de
   (idb:…) durur; "Yayına Hazırla" bunları bugünkü gibi Storage'a yükler.
   A1 stüdyosundaki yükleme kontrolleri (SeozCinemaStudio.processLayerFile)
   ve CSS sınıfları aynen kullanılır.
   ========================================================================= */
(function (global) {
  "use strict";

  const BUDGET_MB = 15, MAX_LAYERS_WARN = 12;
  const START_LABELS = [["tap", "Dokununca"], ["pull", "Çekince"], ["swipe", "Kaydırınca"], ["hold", "Basılı tutunca"], ["with", "Öncekiyle birlikte"], ["after", "Öncekinden sonra"], ["at", "Belirli saniyede"]];
  const GDIRS = [["any", "Herhangi bir yöne"], ["up", "Yukarı"], ["down", "Aşağı"], ["left", "Sola"], ["right", "Sağa"]];
  const GATE_NAMES = { tap: "Dokunuş", pull: "Çekme", swipe: "Kaydırma", hold: "Basılı tutma" };
  const gateOf = a => !!(a && GATE_NAMES[a.start]);
  const SPEEDS = [[0.5, "0,5× (yavaş)"], [0.75, "0,75×"], [1, "1× (normal)"], [1.5, "1,5×"], [2, "2× (hızlı)"]];

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function r1(n) { return Math.round(n * 10) / 10; }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function uid(p) { return p + Math.random().toString(36).slice(2, 9); }
  function mb(bytes) { return (bytes / (1024 * 1024)).toFixed(bytes > 1024 * 1024 ? 1 : 2); }

  /* A1 (v1) kaydını v2'ye taşır: yüklenmiş kapı katmanları serbest katman olur,
     kapı senaryosu hazır kurgu olarak seçili kalır. */
  function ensureV2(entry) {
    const C = global.SeozCinema;
    let cin = entry.cinema;
    if (!cin || typeof cin !== "object") cin = entry.cinema = {};
    if (cin.v === 2) { if (!Array.isArray(cin.layers)) cin.layers = []; if (!Array.isArray(cin.actions)) cin.actions = []; return cin; }
    const old = cin, layers = [], roles = {};
    const m = C.model(old.model || "door");
    if (m && old.layers && typeof old.layers === "object") {
      m.slots.forEach(s => {
        const u = old.layers[s.id];
        if (!u || !u.src) return;
        const id = uid("L");
        layers.push(Object.assign({}, u, { id, name: s.label, box: s.backdrop ? { x: 0, y: 0, w: C.FRAME_W, h: C.FRAME_H } : Object.assign({}, s.box), backdrop: !!s.backdrop }));
        roles[s.id] = id;
      });
    }
    const keep = {};
    ["speed", "depth", "intensity", "sound", "start", "lite", "hintText", "cardMode", "cardTitle", "cardSubtitle", "cardCheck", "skin", "brand"].forEach(k => { if (old[k] !== undefined) keep[k] = old[k]; });
    entry.cinema = Object.assign(keep, { v: 2, layers, actions: [],
      preset: old.model === "door" && old.scenario && layers.length ? { id: "door:" + old.scenario, roles, artFill: false } : null });
    return entry.cinema;
  }

  function open(doc, cb) {
    cb = cb || {};
    const C = global.SeozCinema, F = global.SeozCinemaFree, S1 = global.SeozCinemaStudio;
    const entry = doc.entry;
    const wasV2 = !!(entry.cinema && entry.cinema.v === 2);
    const cin = ensureV2(entry);
    if (!wasV2 && cb.onChange) setTimeout(() => cb.onChange(), 0);   // A1 kaydından taşındıysa hemen kaydet
    const state = { sel: cin.layers.length ? cin.layers[cin.layers.length - 1].id : null, view: "phone", handle: null, previewing: false,
      selAct: null, clip: null, time: 0, playing: false, tl: null, zoom: 70 };

    const root = document.createElement("div");
    root.className = "cs-root cs2";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "Animasyon Stüdyosu");
    root.innerHTML = `
      <header class="cs-head">
        <div class="cs-title"><span class="cs-logo">🎬</span><div><h2>Animasyon Stüdyosu</h2><p data-cs-sub></p></div></div>
        <div class="cs-head-actions"><button type="button" class="btn btn-primary" data-cs-close>Bitti</button></div>
      </header>
      <div class="cs-body">
        <aside class="cs-left" data-cs-left></aside>
        <main class="cs-center">
          <div class="cs-toolbar">
            <div class="cs-seg" role="group" aria-label="Görünüm">
              <button type="button" data-cs-view="phone">Telefon</button>
              <button type="button" data-cs-view="desktop">Bilgisayar</button>
            </div>
            <button type="button" class="btn btn-gold cs-play" data-cs-play>▶ Önizle</button>
          </div>
          <div class="cs-stage-area" data-cs-area><div class="cs-stage" data-cs-stage></div></div>
          <p class="cs-stage-tip" data-cs-tip></p>
          <section class="cs-tl" data-cs-tl aria-label="Zaman çizelgesi"></section>
        </main>
        <aside class="cs-right" data-cs-right></aside>
      </div>`;
    document.body.appendChild(root);
    document.body.classList.add("cs-open");
    const $ = s => root.querySelector(s);
    const leftEl = $("[data-cs-left]"), rightEl = $("[data-cs-right]"), stageEl = $("[data-cs-stage]"), areaEl = $("[data-cs-area]");

    const layerById = id => cin.layers.find(l => l.id === id) || null;
    const L5 = global.SeozCinemaLibrary || null;
    const presetOn = () => !!(cin.preset && F.presetOf(cin.preset.id));
    function save() { if (cb.onChange) cb.onChange(); }
    function norm() { return C.normalize(cin); }

    /* ---------- üst bilgi ---------- */
    function renderSub() {
      const p = presetOn() ? F.presetOf(cin.preset.id).label : "Kendi kurgum";
      $("[data-cs-sub]").textContent = `${cin.layers.length} katman · ${cin.actions.length} hareket · ${p}`;
    }

    /* ---------- sol panel ---------- */
    function layerMoves(id) { return cin.actions.filter(a => a.layer === id); }
    function renderLeft() {
      const keep = leftEl.scrollTop; requestAnimationFrame(() => { leftEl.scrollTop = keep; });
      const n = norm();
      const front = cin.layers.slice().reverse();
      const pre = presetOn() ? cin.preset : null;
      leftEl.innerHTML = `
        <section class="cs-sec">
          <h3>Katmanlar <small>(üstteki önde)</small></h3>
          <button type="button" class="btn btn-gold cs-wide" data-cs-add>+ Görsel ekle (PNG, JPG, WebP)</button>
          <div class="cs-layers">
            ${front.map(l => {
              const mv = layerMoves(l.id).length, par = l.parent && layerById(l.parent);
              const tags = [l.backdrop ? "arka plan" : "", par ? "bağlı: " + esc(par.name) : "", mv ? mv + " hareket" : "", l.hidden ? "gizli" : ""].filter(Boolean).join(" · ") || "hareket yok";
              const warn = l.check && l.check.warnings && l.check.warnings.length;
              return `<div class="cs-layer cs-layer2${state.sel === l.id ? " is-on" : ""}" data-cs-sel="${l.id}" role="button" tabindex="0">
                <span class="cs-thumb" data-cs-thumb="${l.id}"></span>
                <span class="cs-layer-t"><strong>${esc(l.name)}</strong><small>${tags}</small></span>
                ${warn ? `<span class="cs-warn-dot" title="Uyarı var">!</span>` : ""}
                <span class="cs-row-btns">
                  <button type="button" class="cs-ico" data-cs-lup="${l.id}" title="Öne al" aria-label="${esc(l.name)} öne al">▲</button>
                  <button type="button" class="cs-ico" data-cs-ldown="${l.id}" title="Arkaya al" aria-label="${esc(l.name)} arkaya al">▼</button>
                  <button type="button" class="cs-ico cs-del" data-cs-ldel="${l.id}" title="Sil" aria-label="${esc(l.name)} sil">✕</button>
                </span></div>`;
            }).join("") || `<p class="cs-hint">Henüz katman yok. Tek görselle de, çok katmanla da çalışabilirsiniz.</p>`}
          </div>
          <p class="cs-budget" data-cs-budget></p>
        </section>
        <section class="cs-sec" data-cs-seqsec>${seqHTML()}</section>
        <section class="cs-sec cs-libsec">
          <h3>Kurgu kütüphanesi</h3>
          ${cin.kurgu && L5 && L5.builtin(cin.kurgu) ? `<p class="cs-hint">Uygulanan: <strong>${esc(L5.builtin(cin.kurgu).label)}</strong> — hareketleri dilediğiniz gibi değiştirebilirsiniz.</p>` : ""}
          <button type="button" class="btn btn-gold cs-wide" data-cs-lib>📚 Hazır kurgular ve kayıtlarım</button>
          <div class="cs-grid2">
            <button type="button" class="btn btn-outline" data-cs-lib-save ${cin.actions.length || cin.preset ? "" : "disabled"}>💾 Kaydet</button>
            <button type="button" class="btn btn-outline" data-cs-lib-import>⬆ İçe aktar</button>
          </div>
        </section>
        <section class="cs-sec">
          <h3>Kapı kurgusu (A1, rollerle)</h3>
          <select data-cs-preset>
            <option value="">Yok — kendi hareketlerim</option>
            ${F.PRESETS.map(p => `<option value="${p.id}" ${pre && pre.id === p.id ? "selected" : ""}>${esc(p.label)}</option>`).join("")}
          </select>
          ${pre ? `<p class="cs-hint">Kurgu kendi yerleşimini kullanır. Her role katmanlarınızdan birini seçin; sol ve sağ kanat gerekir.</p>
            ${F.rolesOf(pre.id).map(r => `<label class="cs-row cs-row-col"><span>${esc(r.label)}${r.required ? " *" : ""}</span>
              <select data-cs-role="${r.id}"><option value="">${r.required ? "Seçin" : "Kullanma"}</option>
              ${cin.layers.map(l => `<option value="${l.id}" ${(pre.roles || {})[r.id] === l.id ? "selected" : ""}>${esc(l.name)}</option>`).join("")}</select></label>`).join("")}
            <label class="cs-check"><input type="checkbox" data-cs-artfill ${pre.artFill ? "checked" : ""}> Boş rollerde kodla çizilen görünümü kullan</label>` : ""}
        </section>
        <section class="cs-sec">
          <h3>Oynatma</h3>
          ${rangeRow("speed", "Hız", n.speed, 0.5, 2, 0.05)}
          ${rangeRow("depth", "3D derinlik", n.depth, 0, 2, 0.05)}
          ${rangeRow("intensity", "Efekt yoğunluğu", n.intensity, 0, 1.5, 0.05)}
          <label class="cs-row"><span>Başlama</span><select data-cs-opt="start"><option value="tap" ${n.start === "tap" ? "selected" : ""}>Dokununca</option><option value="auto" ${n.start === "auto" ? "selected" : ""}>Otomatik</option></select></label>
          <label class="cs-check"><input type="checkbox" data-cs-opt="sound" ${n.sound ? "checked" : ""}> Ses efektleri (dokunuştan sonra çalar)</label>
          <label class="cs-check"><input type="checkbox" data-cs-opt="lite" ${n.lite ? "checked" : ""}> Hafif mod</label>
          <label class="cs-row cs-row-col"><span>İpucu yazısı</span><input type="text" maxlength="40" data-cs-opt="hintText" value="${esc(n.hintText)}"></label>
        </section>
        <section class="cs-sec">
          <h3>Özel gün konsepti</h3>
          <select data-cs-opt="concept" aria-label="Özel gün konsepti">
            <option value="none" ${!cin.concept || cin.concept === "none" || cin.concept === "auto" ? "selected" : ""}>Yok</option>
            ${["Atmosfer", "Özel Gün"].map(g => `<optgroup label="${g}">${C.concepts().filter(c => c.group === g).map(c => `<option value="${c.id}" ${cin.concept === c.id ? "selected" : ""}>${esc(c.label)}</option>`).join("")}</optgroup>`).join("")}
          </select>
          <p class="cs-hint">Bekleme sırasında sahnede süzülen ortam efekti (kar, yaprak, ışıltı…). Hareketlerinize ek olarak oynar.</p>
        </section>
        <section class="cs-sec">
          <h3>Marka</h3>
          <label class="cs-check"><input type="checkbox" data-cs-brand="useColors" ${cin.brand && cin.brand.useColors ? "checked" : ""}> Marka renklerini kullan</label>
          <div class="cs-grid2">
            <label>Ana renk<input type="color" data-cs-brand="primary" value="${esc((cin.brand && cin.brand.primary) || "#7A1F2B")}"></label>
            <label>Vurgu rengi<input type="color" data-cs-brand="secondary" value="${esc((cin.brand && cin.brand.secondary) || "#C9A45C")}"></label>
          </div>
          <label class="cs-row cs-row-col"><span>İşletme / çift adı (monogram)</span><input type="text" maxlength="40" data-cs-brand="text" value="${esc((cin.brand && cin.brand.text) || "")}"></label>
          <div class="cs-up"><button type="button" class="btn btn-outline" data-cs-logo>${cin.brand && cin.brand.logo ? "Logoyu değiştir" : "Logo yükle"}</button>
            ${cin.brand && cin.brand.logo ? `<button type="button" class="btn-danger-text" data-cs-logo-del>Kaldır</button>` : ""}</div>
          <p class="cs-hint">Logo ve renkler yazılı iç kartta kullanılır.</p>
        </section>
        <section class="cs-sec">
          <h3>İç kart</h3>
          <div class="cs-card"><span class="cs-thumb cs-thumb-card" data-cs-thumb="__card"></span>
            <div><button type="button" class="btn btn-outline" data-cs-card-up>${entry.cardSrc ? "Kartı değiştir" : "Kart görseli yükle"}</button>
            ${entry.cardSrc ? `<button type="button" class="btn-danger-text" data-cs-card-del>Kaldır</button>` : ""}</div></div>
          <label class="cs-row"><span>Kart</span><select data-cs-opt="cardMode">
            <option value="auto" ${n.cardMode === "auto" ? "selected" : ""}>Otomatik</option><option value="image" ${n.cardMode === "image" ? "selected" : ""}>Yüklenen görsel</option>
            <option value="title" ${n.cardMode === "title" ? "selected" : ""}>Yazılı kart</option><option value="none" ${n.cardMode === "none" ? "selected" : ""}>Kart yok</option></select></label>
          <label class="cs-row cs-row-col"><span>Yazılı kart başlığı</span><input type="text" maxlength="60" data-cs-opt="cardTitle" placeholder="${esc((doc.meta && doc.meta.title) || "")}" value="${esc(n.cardTitle)}"></label>
          <label class="cs-row"><span>Ekranda kalma</span><select data-cs-hold>
            ${[["3", "3 sn"], ["5", "5 sn"], ["8", "8 sn"], ["10", "10 sn"], ["15", "15 sn"], ["tap", "Dokunana kadar"]].map(([v, l]) => `<option value="${v}" ${String(entry.cardDisplayDuration != null ? entry.cardDisplayDuration : 10) === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
          <label class="cs-row"><span>Davetiyeye geçiş</span><select data-cs-opt="exitStyle">
            ${[["zoom", "Yakınlaşarak çözülme"], ["fade", "Solarak"], ["up", "Yukarı kayarak"]].map(([v, l]) => `<option value="${v}" ${(cin.exitStyle || "zoom") === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
          <label class="cs-row"><span>Geçiş süresi</span><select data-cs-opt="exitDuration">
            ${[[0.6, "0,6 sn"], [1, "1 sn"], [1.5, "1,5 sn"], [2, "2 sn"]].map(([v, l]) => `<option value="${v}" ${Number(cin.exitDuration || 1) === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        </section>`;
      fillThumbs(); renderBudget();
    }
    function seqHTML() {
      const pre = presetOn() ? cin.preset : null;
      return `<h3>Hareket sırası</h3>
          ${cin.actions.length ? `<ol class="cs-seq">${cin.actions.map((a, i) => {
            const m = F.move(a.move), l = layerById(a.layer);
            const st = (START_LABELS.find(s => s[0] === a.start) || START_LABELS[2])[1];
            return `<li class="${l && l.id === state.sel ? "is-on" : ""}" draggable="true" data-seq="${a.id}" title="Sürükleyerek sıralayın"><span class="cs-grip" aria-hidden="true">⋮⋮</span><button type="button" class="cs-seq-t" data-cs-sel="${a.layer}" data-cs-selact="${a.id}">
                <strong>${esc(m ? m.label : a.move)}</strong><small>${esc(m && m.scene ? "tüm sahne · " : "")}${esc(l ? l.name : "")} · ${i === 0 ? "Başlangıç" : st}</small></button>
              <span class="cs-row-btns"><button type="button" class="cs-ico" data-cs-aup="${a.id}" aria-label="Yukarı">▲</button><button type="button" class="cs-ico" data-cs-adown="${a.id}" aria-label="Aşağı">▼</button></span></li>`;
          }).join("")}</ol>` : `<p class="cs-hint">Bir katman seçip sağdaki "Hareket ekle" menüsünden hareket verin.</p>`}
          ${pre ? `<p class="cs-hint cs-note">Hazır kurgu seçiliyken bu liste kullanılmaz.</p>` : ""}
        </section>`;
    }
    function renderSeq() { const el = leftEl.querySelector("[data-cs-seqsec]"); if (el) el.innerHTML = seqHTML(); }
    function rangeRow(key, label, val, min, max, step) {
      return `<label class="cs-row"><span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${val}" data-cs-opt="${key}"><output data-cs-out="${key}">${r1(val)}×</output></label>`;
    }
    function checksHTML(chk) {
      if (!chk) return "";
      const w = (chk.warnings || []).map(t => `<li class="is-warn">${esc(t)}</li>`).join(""), n = (chk.notes || []).map(t => `<li>${esc(t)}</li>`).join("");
      return w || n ? `<ul class="cs-checks">${w}${n}</ul>` : "";
    }
    function fillThumbs() {
      root.querySelectorAll("[data-cs-thumb]").forEach(el => {
        const id = el.dataset.csThumb, ref = id === "__card" ? entry.cardSrc : (layerById(id) || {}).src;
        el.innerHTML = "";
        if (!ref) { el.classList.add("is-empty"); return; }
        el.classList.remove("is-empty");
        global.SeozBlobStore.resolveToObjectURL(ref).then(url => { if (url) { const i = document.createElement("img"); i.src = url; i.alt = ""; el.appendChild(i); } });
      });
    }
    async function renderBudget() {
      const el = $("[data-cs-budget]"); if (!el) return;
      const refs = []; cin.layers.forEach(l => { if (l.src) refs.push(l.src); if (l.backSrc) refs.push(l.backSrc); }); if (entry.cardSrc) refs.push(entry.cardSrc);
      let total = 0;
      for (const r of refs) { if (!global.SeozBlobStore.isRef(r)) continue; try { const b = await global.SeozBlobStore.getBlob(r.slice(4)); if (b) total += b.size; } catch (e) { /* önemsiz */ } }
      const over = total > BUDGET_MB * 1024 * 1024, many = cin.layers.length > MAX_LAYERS_WARN;
      el.className = "cs-budget" + (over || many ? " is-over" : "");
      el.textContent = `Görseller: ${mb(total)} MB / ${BUDGET_MB} MB` + (over ? " — sınır aşıldı, açılış yavaş yüklenebilir." : "") + (many ? ` · ${cin.layers.length} katman: telefonda akıcılık için ${MAX_LAYERS_WARN}'yi aşmamaya çalışın.` : "");
    }

    /* ---------- sağ panel ---------- */
    function paramsHTML(a, m) {
      return (m.params || []).map(p => p.type === "layer" ? `<label class="cs-row"><span>${esc(p.label)}</span><select data-cs-ap="${a.id}" data-key="${p.key}">
        <option value="">Yok</option>${cin.layers.filter(l => l.id !== a.layer && !l.backdrop).map(l => `<option value="${l.id}" ${(a.params || {})[p.key] === l.id ? "selected" : ""}>${esc(l.name)}</option>`).join("")}</select></label>`
        : `<label class="cs-row"><span>${esc(p.label)}</span><select data-cs-ap="${a.id}" data-key="${p.key}">
        ${p.options.map(([v, l]) => `<option value="${v}" ${String((a.params || {})[p.key] != null ? a.params[p.key] : p.def) === String(v) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>`).join("");
    }
    function actionHTML(a) {
      const m = F.move(a.move); if (!m) return "";
      const idx = cin.actions.indexOf(a);
      return `<div class="cs-act${state.selAct === a.id ? " is-on" : ""}" data-act="${a.id}">
        <div class="cs-act-h"><strong>${idx + 1}. ${esc(m.label)}</strong>
          <span class="cs-row-btns"><button type="button" class="cs-ico" data-cs-acopy="${a.id}" title="Kopyala (sonra başka katmanı seçip Yapıştır)" aria-label="Kopyala">⧉</button>
          <button type="button" class="cs-ico cs-del" data-cs-adel="${a.id}" aria-label="Hareketi sil">✕</button></span></div>
        ${m.note ? `<p class="cs-hint">${esc(m.note)}</p>` : ""}
        <label class="cs-row"><span>Başlat</span><select data-cs-af="${a.id}" data-key="start">
          ${START_LABELS.map(([v, l]) => `<option value="${v}" ${a.start === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label class="cs-row" data-gdir-row ${a.start === "pull" || a.start === "swipe" ? "" : "hidden"}><span>Parmak yönü</span><select data-cs-af="${a.id}" data-key="gdir">
          ${GDIRS.map(([v, l]) => `<option value="${v}" ${(a.gdir || "any") === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <div class="cs-grid2">
          <label>${a.start === "at" ? "Başlangıç (sn)" : "Gecikme (sn)"}<input type="number" min="0" max="60" step="0.1" data-cs-af="${a.id}" data-key="delay" value="${a.delay || 0}"></label>
          <label>Süre (sn)<input type="number" min="0.1" max="20" step="0.1" data-cs-af="${a.id}" data-key="duration" value="${a.duration}"></label>
        </div>
        <label class="cs-row"><span>Hız</span><select data-cs-af="${a.id}" data-key="speed">
          ${SPEEDS.map(([v, l]) => `<option value="${v}" ${Number(a.speed || 1) === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label class="cs-row"><span>Yumuşaklık</span><select data-cs-af="${a.id}" data-key="easing">
          ${F.EASE_LABELS.map(([v, l]) => `<option value="${v}" ${(a.easing || m.easing) === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        ${m.loop ? `<label class="cs-row"><span>Tekrar</span><select data-cs-af="${a.id}" data-key="repeat">
          ${[[0, "Sürekli"], [1, "1 kez"], [2, "2 kez"], [3, "3 kez"], [5, "5 kez"]].map(([v, l]) => `<option value="${v}" ${Number(a.repeat) === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>` : ""}
        ${paramsHTML(a, m)}
      </div>`;
    }
    function renderRight() {
      const l = layerById(state.sel);
      if (!l) { rightEl.innerHTML = `<section class="cs-sec"><p class="cs-hint">Soldan "Görsel ekle" ile başlayın veya bir katman seçin.</p></section>`; return; }
      const L = C.layoutOf({ box: l.box, origin: "50% 50%" }, l, 1);
      const [ox, oy] = String(L.origin).split(/\s+/).map(v => parseFloat(v));
      const others = cin.layers.filter(x => x.id !== l.id && !x.backdrop);
      const acts = layerMoves(l.id);
      rightEl.innerHTML = `
        <section class="cs-sec">
          <label class="cs-row cs-row-col"><span>Katman adı</span><input type="text" maxlength="40" data-cs-lname value="${esc(l.name)}"></label>
          <div class="cs-up"><button type="button" class="btn btn-outline" data-cs-up>Görseli değiştir</button></div>
          ${checksHTML(l.check)}
          <div class="cs-up cs-up-back"><span>Arka yüz <small>(isteğe bağlı, dönen katmanlar için)</small></span>
            <button type="button" class="btn btn-outline" data-cs-up-back>${l.backSrc ? "Değiştir" : "Yükle"}</button>
            ${l.backSrc ? `<button type="button" class="btn-danger-text" data-cs-del-back>Kaldır</button>` : ""}</div>
          <label class="cs-check"><input type="checkbox" data-cs-l="backdrop" ${l.backdrop ? "checked" : ""}> Arka plan olarak kullan (tüm ekranı kaplar)</label>
          ${l.backdrop ? "" : `<label class="cs-row cs-row-col"><span>Birlikte hareket et</span><select data-cs-parent>
            <option value="">Bağımsız</option>${others.map(o => `<option value="${o.id}" ${l.parent === o.id ? "selected" : ""}>${esc(o.name)} ile birlikte</option>`).join("")}</select></label>`}
          <label class="cs-check"><input type="checkbox" data-cs-l="hidden" ${l.hidden ? "checked" : ""}> Gizle</label>
        </section>
        <section class="cs-sec">
          <h3>Hareketler ${state.clip ? `<button type="button" class="cs-mini" data-cs-paste>Yapıştır: ${esc((F.move(state.clip.move) || {}).label || "")}</button>` : ""}</h3>
          ${presetOn() ? `<p class="cs-hint cs-note">Hazır kurgu seçili; buradaki hareketler kurgu kapatılınca oynar.</p>` : ""}
          <select data-cs-addmove aria-label="Hareket ekle"><option value="">+ Hareket ekle…</option>
            ${F.movesByGroup().map(g => `<optgroup label="${esc(g.label)}">${g.moves.map(m => { const av = F.availability(m.id, cin.layers.length); return `<option value="${m.id}" ${av.ok ? "" : "disabled"}>${esc(m.label)}${av.ok ? "" : " — " + esc(av.why)}</option>`; }).join("")}</optgroup>`).join("")}</select>
          <div class="cs-acts">${acts.map(actionHTML).join("") || `<p class="cs-hint">Bu katmanın henüz hareketi yok.</p>`}</div>
        </section>
        ${l.backdrop ? "" : `<section class="cs-sec">
          <h3>Yerleşim</h3>
          <div class="cs-grid2"><label>Yatay (x)<input type="number" step="1" data-cs-l="x" value="${r1(L.x)}"></label><label>Dikey (y)<input type="number" step="1" data-cs-l="y" value="${r1(L.y)}"></label></div>
          <label class="cs-row"><span>Ölçek</span><input type="range" min="0.2" max="3" step="0.01" data-cs-l="scale" value="${L.s}"><output data-cs-lout="scale">${Math.round(L.s * 100)}%</output></label>
          <div class="cs-grid2"><label>Dönme noktası x %<input type="number" step="1" data-cs-l="ox" value="${r1(ox)}"></label><label>Dönme noktası y %<input type="number" step="1" data-cs-l="oy" value="${r1(oy)}"></label></div>
          <label class="cs-row"><span>Derinlik</span><input type="range" min="-200" max="200" step="1" data-cs-l="depth" value="${Number(l.depth) || 0}"><output data-cs-lout="depth">${Number(l.depth) || 0}</output></label>
          <label class="cs-row"><span>Kalınlık</span><input type="range" min="0" max="40" step="1" data-cs-l="thickness" value="${L.thickness}"><output data-cs-lout="thickness">${L.thickness}</output></label>
          <label class="cs-row"><span>Işık tepkisi</span><input type="range" min="0" max="1.5" step="0.05" data-cs-l="light" value="${L.light}"><output data-cs-lout="light">${Math.round(L.light * 100)}%</output></label>
          <button type="button" class="btn btn-outline cs-reset" data-cs-reset>Yerleşimi sıfırla</button>
          <p class="cs-hint">Sahnede katmanı sürükleyin, sağ alt köşeden büyütün, kırmızı artıyla dönme noktasını taşıyın. Ok tuşları 1, Shift ile 10 birim kaydırır.</p>
        </section>`}`;
    }

    /* ---------- sahne ---------- */
    function sizeStage() {
      const ar = state.view === "phone" ? 390 / 844 : 1280 / 800;
      const aw = Math.max(200, areaEl.clientWidth - 24), ah = Math.max(200, areaEl.clientHeight - 24);
      let w = aw, hh = w / ar; if (hh > ah) { hh = ah; w = hh * ar; }
      if (state.view === "phone") { w = Math.min(w, 430); hh = w / ar; }
      stageEl.style.width = Math.round(w) + "px"; stageEl.style.height = Math.round(hh) + "px"; stageEl.dataset.view = state.view;
      root.querySelectorAll("[data-cs-view]").forEach(b => b.classList.toggle("is-on", b.dataset.csView === state.view));
    }
    let token = 0, hEls = null;
    function rebuildStage() {
      const my = ++token;
      if (state.tl) { state.tl.stop(); state.tl = null; state.playing = false; }
      if (state.handle) { state.handle.destroy(); state.handle = null; }
      if (hEls) { hEls.box.remove(); hEls = null; }
      stageEl.innerHTML = ""; sizeStage();
      const hd = C.play(doc, null, { container: stageEl, freeze: true });
      state.handle = hd;
      hd.ready.then(() => { if (my !== token) return; drawHandles(); $("[data-cs-tip]").textContent = presetOn() ? "Hazır kurgu · kapalı sahne" : "Kapalı sahne · seçili katman çerçeveli"; });
    }
    function drawHandles() {
      if (hEls) { hEls.box.remove(); hEls = null; }
      const hd = state.handle, l = layerById(state.sel);
      if (!hd || !hd.ctx || state.previewing || !l || l.backdrop || presetOn()) return;
      const el = hd.ctx.S[l.id]; if (!el) return;
      const box = document.createElement("div"); box.className = "cs-sel"; box.dataset.csHandle = "move";
      const corner = document.createElement("div"); corner.className = "cs-corner"; corner.dataset.csHandle = "scale";
      const pivot = document.createElement("div"); pivot.className = "cs-pivot"; pivot.dataset.csHandle = "pivot"; pivot.title = "Dönme noktası";
      box.appendChild(corner); box.appendChild(pivot); stageEl.appendChild(box);
      hEls = { box, el }; placeHandles();
    }
    function placeHandles() {
      if (!hEls) return;
      const sr = stageEl.getBoundingClientRect(), r = hEls.el.getBoundingClientRect(), l = layerById(state.sel) || {};
      Object.assign(hEls.box.style, { left: (r.left - sr.left) + "px", top: (r.top - sr.top) + "px", width: r.width + "px", height: r.height + "px" });
      const [ox, oy] = String(l.origin || "50% 50%").split(/\s+/).map(v => parseFloat(v));
      const pv = hEls.box.querySelector(".cs-pivot"); pv.style.left = ox + "%"; pv.style.top = oy + "%";
    }
    function setLayerLive(id, patch, commit) {
      const l = Object.assign(layerById(id), patch);
      if (state.handle) state.handle.setLayer(id, l);
      placeHandles(); syncInputs();
      if (commit) save();
    }
    function syncInputs() {
      const l = layerById(state.sel); if (!l || l.backdrop) return;
      const L = C.layoutOf({ box: l.box, origin: "50% 50%" }, l, 1), [ox, oy] = String(L.origin).split(/\s+/).map(v => parseFloat(v));
      const set = (k, v) => { const i = rightEl.querySelector(`[data-cs-l="${k}"]`); if (i && document.activeElement !== i) i.value = v; };
      set("x", r1(L.x)); set("y", r1(L.y)); set("scale", L.s); set("ox", r1(ox)); set("oy", r1(oy));
      const o = rightEl.querySelector('[data-cs-lout="scale"]'); if (o) o.textContent = Math.round(L.s * 100) + "%";
    }
    stageEl.addEventListener("pointerdown", (e) => {
      const t = e.target.closest("[data-cs-handle]"); if (!t || !state.handle || !state.handle.ctx) return;
      e.preventDefault();
      const kind = t.dataset.csHandle, id = state.sel, l = layerById(id), fit = state.handle.ctx.scale();
      const L0 = C.layoutOf({ box: l.box }, l, 1), br = hEls.box.getBoundingClientRect(), cx = br.left + br.width / 2, cy = br.top + br.height / 2;
      const st = { x: e.clientX, y: e.clientY, ux: L0.x, uy: L0.y, s: L0.s, d: Math.hypot(e.clientX - cx, e.clientY - cy) || 1 };
      try { t.setPointerCapture(e.pointerId); } catch (err) { /* önemsiz */ }
      const move = ev => {
        if (kind === "move") setLayerLive(id, { x: r1(st.ux + (ev.clientX - st.x) / fit), y: r1(st.uy + (ev.clientY - st.y) / fit) });
        else if (kind === "scale") setLayerLive(id, { scale: Math.round(clamp(st.s * Math.hypot(ev.clientX - cx, ev.clientY - cy) / st.d, 0.2, 4) * 100) / 100 });
        else { const r = hEls.box.getBoundingClientRect(); setLayerLive(id, { origin: `${r1(clamp((ev.clientX - r.left) / r.width * 100, -50, 150))}% ${r1(clamp((ev.clientY - r.top) / r.height * 100, -50, 150))}%` }); }
      };
      const up = () => { t.removeEventListener("pointermove", move); t.removeEventListener("pointerup", up); t.removeEventListener("pointercancel", up); save(); };
      t.addEventListener("pointermove", move); t.addEventListener("pointerup", up); t.addEventListener("pointercancel", up);
    });
    function onKey(e) {
      if (e.key === "Escape" && !state.previewing) { close(); return; }
      if (state.previewing || !/^Arrow/.test(e.key) || /^(INPUT|SELECT|TEXTAREA)$/.test((document.activeElement || {}).tagName || "")) return;
      const l = layerById(state.sel); if (!l || l.backdrop) return;
      e.preventDefault();
      const s = e.shiftKey ? 10 : 1, L = C.layoutOf({ box: l.box }, l, 1);
      setLayerLive(l.id, { x: L.x + (e.key === "ArrowLeft" ? -s : e.key === "ArrowRight" ? s : 0), y: L.y + (e.key === "ArrowUp" ? -s : e.key === "ArrowDown" ? s : 0) }, true);
    }
    document.addEventListener("keydown", onKey);
    const onResize = () => { if (!state.previewing) { sizeStage(); if (state.handle) state.handle.refit(); placeHandles(); } };
    global.addEventListener("resize", onResize);

    /* ---------- görsel yükleme ---------- */
    function pick(multi, fn) {
      const inp = document.createElement("input");
      inp.type = "file"; inp.accept = "image/png,image/jpeg,image/webp"; inp.multiple = !!multi; inp.style.display = "none"; inp.dataset.csFile = "1";
      inp.addEventListener("change", () => { const fs = Array.from(inp.files || []); inp.remove(); if (fs.length) fn(fs); });
      root.appendChild(inp); inp.click();
    }
    function busy(on, text) {
      let b = root.querySelector(".cs-busy");
      if (on) { if (!b) { b = document.createElement("div"); b.className = "cs-busy"; root.appendChild(b); } b.textContent = text || "Görsel işleniyor…"; } else if (b) b.remove();
    }
    const PSEUDO = { id: "free", backdrop: true, guide: { alpha: "no" } };
    async function process(file) { return S1.processLayerFile(file, null, PSEUDO, { guideSize: [1, 1] }); }
    function fitBox(w, hgt) {
      const s = Math.min(320 / w, 560 / hgt), bw = r1(w * s), bh = r1(hgt * s);
      return { x: r1((C.FRAME_W - bw) / 2), y: r1((C.FRAME_H - bh) / 2), w: bw, h: bh };
    }
    async function addFiles(files) {
      busy(true);
      const errs = [];
      for (const f of files) {
        try {
          const res = await process(f);
          const l = { id: uid("L"), name: (f.name || "Görsel").replace(/\.[a-z0-9]+$/i, "").slice(0, 40), src: res.ref, box: fitBox(res.info.w, res.info.h),
            check: { warnings: res.warnings, notes: res.notes, info: res.info } };
          cin.layers.push(l); state.sel = l.id;
        } catch (err) { errs.push(`${f.name}: ${err.message || "yüklenemedi"}`); }
      }
      busy(false); save(); refreshAll();
      if (errs.length) alert(errs.join("\n"));
    }
    async function replaceImage(id, back) {
      pick(false, async ([f]) => {
        busy(true);
        try {
          const res = await process(f), l = layerById(id);
          if (back) { l.backSrc = res.ref; l.backCheck = { warnings: res.warnings, notes: res.notes }; }
          else {
            l.src = res.ref; l.check = { warnings: res.warnings, notes: res.notes, info: res.info };
            // oran değiştiyse kutu yeni orana uyarlanır (merkez korunur)
            const nb = fitBox(res.info.w, res.info.h), ob = l.box || nb, cx = ob.x + ob.w / 2, cy = ob.y + ob.h / 2;
            const k = Math.min(ob.w / nb.w, ob.h / nb.h);
            l.box = { x: r1(cx - nb.w * k / 2), y: r1(cy - nb.h * k / 2), w: r1(nb.w * k), h: r1(nb.h * k) };
          }
          save(); refreshAll();
        } catch (err) { alert(err.message || "Görsel yüklenemedi."); } finally { busy(false); }
      });
    }
    async function uploadLogo(f) {
      busy(true);
      try { const res = await process(f); cin.brand = Object.assign({ useColors: false, primary: "#7A1F2B", secondary: "#C9A45C", text: "" }, cin.brand || {}, { logo: res.ref }); save(); refreshAll(); }
      catch (err) { alert(err.message || "Logo yüklenemedi."); } finally { busy(false); }
    }

    /* ---------- A2.5 · KURGU KÜTÜPHANESİ ---------- */
    function download(blob, name) {
      const url = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
    }
    const fname = s => String(s || "kurgu").replace(/[^a-z0-9ığüşöçİĞÜŞÖÇ\-_]+/gi, "-").replace(/^-+|-+$/g, "") || "kurgu";
    function saveKurgu() {
      if (!L5) return;
      const name = prompt("Kurgunun adı:", (doc.meta && doc.meta.title ? doc.meta.title + " açılışı" : "Kurgum"));
      if (name == null) return;
      try { L5.save(cin, name.trim() || "Kurgum"); toast("Kurgu bu bilgisayara kaydedildi"); }
      catch (err) { alert("Kaydedilemedi (tarayıcı depolama alanı dolu olabilir)."); }
    }
    function importKurgu() {
      if (!L5) return;
      const inp = document.createElement("input");
      inp.type = "file"; inp.accept = ".json,.zip,application/json,application/zip"; inp.style.display = "none";
      inp.addEventListener("change", async () => {
        const f = inp.files && inp.files[0]; inp.remove(); if (!f) return;
        busy(true, "Kurgu içe aktarılıyor…");
        try { const k = await L5.importFile(f); busy(false); toast("İçe aktarıldı: " + k.name); openLibrary("kayitli"); }
        catch (err) { busy(false); alert(err.message || "İçe aktarılamadı."); }
      });
      root.appendChild(inp); inp.click();
    }
    function openLibrary(tab) {
      if (!L5) return;
      let cur = tab || "hazir", pending = null;
      const ov = document.createElement("div");
      ov.className = "cs-lib"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-label", "Kurgu kütüphanesi");
      const layersTxt = () => cin.layers.filter(l => !l.backdrop).length;
      const favOf = k => !!(doc.theme && Array.isArray(doc.theme.kurgu) && doc.theme.kurgu.includes(k.id));
      function card(k) {
        const need = L5.needCount(k), opt = k.roles.length - need, ok = layersTxt() >= need;
        const fav = doc.theme && Array.isArray(doc.theme.kurgu) && doc.theme.kurgu.includes(k.id);
        return `<article class="cs-lib-card${ok ? "" : " is-off"}${fav ? " is-fav" : ""}">
          <header><strong>${esc(k.label)}</strong><span class="cs-lib-tag">${fav ? "★ Paketinize uygun" : esc(k.group)}</span></header>
          <p>${esc(k.desc)}</p>
          <small>${need} görsel${opt ? ` + ${opt} isteğe bağlı` : ""} · ${k.acts.length} adım</small>
          <button type="button" class="btn ${ok ? "btn-gold" : "btn-outline"}" data-lib-pick="${k.id}" ${ok ? "" : "disabled"}>${ok ? "Seç" : `En az ${need} görsel ekleyin`}</button>
        </article>`;
      }
      function savedRow(k) {
        const d = new Date(k.createdAt);
        return `<div class="cs-lib-row"><div><strong>${esc(k.name)}</strong><small>${(k.data.layers || []).length} katman · ${(k.data.actions || []).length} hareket · ${isNaN(d) ? "" : d.toLocaleDateString("tr-TR")}</small></div>
          <span class="cs-lib-acts"><button type="button" class="btn btn-gold" data-lib-use="${k.id}">Uygula</button>
          <button type="button" class="btn btn-outline" data-lib-json="${k.id}" title="Yalnız kurgu (.json)">JSON</button>
          <button type="button" class="btn btn-outline" data-lib-zip="${k.id}" title="Görsellerle birlikte (.zip)">ZIP</button>
          <button type="button" class="cs-ico cs-del" data-lib-del="${k.id}" aria-label="${esc(k.name)} sil">✕</button></span></div>`;
      }
      function roleStep(k) {
        const map = pending.map;
        const opts = sel => `<option value="">— Kullanma —</option>${cin.layers.filter(l => !l.backdrop).map(l => `<option value="${l.id}" ${sel === l.id ? "selected" : ""}>${esc(l.name)}</option>`).join("")}`;
        const miss = L5.missing(k, map);
        return `<div class="cs-lib-roles"><h4>${esc(k.label)} · roller</h4><p class="cs-hint">Her role katmanlarınızdan birini seçin. Yıldızlı roller gerekli.</p>
          ${k.roles.map(r => `<label class="cs-row cs-row-col"><span>${esc(r.label)}${r.need ? " *" : ""}${r.hint ? ` <small>· ${esc(r.hint)}</small>` : ""}</span><select data-lib-role="${r.key}">${opts(map[r.key])}</select></label>`).join("")}
          ${cin.actions.length || cin.preset ? `<p class="cs-hint cs-note">Mevcut ${cin.actions.length} hareket bu kurguyla değiştirilecek. Katmanlarınız ve yerleşimleri olduğu gibi kalır.</p>` : ""}
          <div class="cs-grid2"><button type="button" class="btn btn-outline" data-lib-back>← Geri</button>
          <button type="button" class="btn btn-gold" data-lib-apply ${miss.length ? "disabled" : ""}>Uygula</button></div></div>`;
      }
      function draw() {
        const saved = L5.readSaved();
        ov.innerHTML = `<div class="cs-lib-box">
          <header class="cs-lib-head"><h3>Kurgu kütüphanesi</h3><button type="button" class="cs-ico" data-lib-close aria-label="Kapat">✕</button></header>
          <div class="cs-seg" role="tablist"><button type="button" class="${cur === "hazir" ? "is-on" : ""}" data-lib-tab="hazir">Hazır kurgular (${L5.BUILTIN.length})</button>
            <button type="button" class="${cur === "kayitli" ? "is-on" : ""}" data-lib-tab="kayitli">Kayıtlarım (${saved.length})</button></div>
          <div class="cs-lib-body">${pending ? roleStep(pending.k)
            : cur === "hazir" ? `<div class="cs-lib-grid">${L5.BUILTIN.slice().sort((a, b) => (favOf(b) ? 1 : 0) - (favOf(a) ? 1 : 0)).map(card).join("")}</div>`
            : (saved.length ? saved.map(savedRow).join("") : `<p class="cs-hint">Henüz kayıtlı kurgunuz yok. Bir açılış kurduktan sonra “Kaydet” ile buraya ekleyebilir, “İçe aktar” ile başka bilgisayardan getirebilirsiniz.</p>`)}
          </div></div>`;
      }
      function closeLib() { ov.remove(); }
      ov.addEventListener("click", async (e) => {
        if (e.target === ov) return closeLib();
        const b = e.target.closest("button"); if (!b) return;
        const d = b.dataset;
        if (d.libClose != null) return closeLib();
        if (d.libTab) { cur = d.libTab; pending = null; return draw(); }
        if (d.libBack != null) { pending = null; return draw(); }
        if (d.libPick) { const k = L5.builtin(d.libPick); pending = { k, map: L5.autoRoles(k, cin.layers) }; return draw(); }
        if (d.libApply != null) {
          L5.applyBuiltin(cin, pending.k, pending.map);
          state.selAct = null; save(); closeLib(); refreshAll(); toast("Kurgu uygulandı: " + pending.k.label); return;
        }
        const saved = L5.readSaved();
        const k = saved.find(x => x.id === (d.libUse || d.libJson || d.libZip || d.libDel));
        if (!k) return;
        if (d.libUse) {
          if ((cin.layers.length || cin.actions.length) && !confirm(`“${k.name}” uygulanınca bu açılıştaki katmanlar ve hareketler kayıttakilerle değiştirilecek. Devam edilsin mi?`)) return;
          L5.applySaved(cin, k); state.sel = cin.layers.length ? cin.layers[cin.layers.length - 1].id : null; state.selAct = null;
          save(); closeLib(); refreshAll(); toast("Kayıtlı kurgu uygulandı"); return;
        }
        if (d.libDel) { if (confirm(`“${k.name}” silinsin mi?`)) { L5.remove(k.id); draw(); } return; }
        try {
          busy(true, "Hazırlanıyor…");
          const r = await L5.exportBlob(k, !!d.libZip);
          download(r.blob, fname(k.name) + "." + r.ext);
          toast(d.libZip ? `ZIP indirildi (${r.images} görsel)` : "Kurgu dosyası indirildi");
        } catch (err) { alert(err.message || "Dışa aktarılamadı."); } finally { busy(false); }
      });
      ov.addEventListener("change", (e) => {
        if (e.target.dataset.libRole && pending) {
          if (e.target.value) pending.map[e.target.dataset.libRole] = e.target.value; else delete pending.map[e.target.dataset.libRole];
          draw();
        }
      });
      draw(); root.appendChild(ov);
      const first = ov.querySelector("button"); if (first) first.focus();
    }

    async function uploadCard(f) {
      busy(true);
      try { const res = await S1.processLayerFile(f, null, { id: "card", backdrop: true, guide: { alpha: "no" } }, { guideSize: [1, 1] }); entry.cardSrc = res.ref; cin.cardCheck = { warnings: res.warnings, notes: res.notes }; save(); refreshAll(); }
      catch (err) { alert(err.message || "Kart görseli yüklenemedi."); } finally { busy(false); }
    }

    /* ---------- düzenleme işlemleri ---------- */
    function moveLayer(id, dir) {
      const i = cin.layers.findIndex(l => l.id === id), j = i + dir;
      if (i < 0 || j < 0 || j >= cin.layers.length) return;
      const t = cin.layers[i]; cin.layers[i] = cin.layers[j]; cin.layers[j] = t;
      save(); refreshAll();
    }
    function deleteLayer(id) {
      const l = layerById(id); if (!l) return;
      if (!confirm(`"${l.name}" katmanı ve ${layerMoves(id).length} hareketi silinsin mi?`)) return;
      cin.layers = cin.layers.filter(x => x.id !== id);
      cin.actions = cin.actions.filter(a => a.layer !== id);
      cin.layers.forEach(x => { if (x.parent === id) delete x.parent; });
      if (cin.preset && cin.preset.roles) Object.keys(cin.preset.roles).forEach(k => { if (cin.preset.roles[k] === id) delete cin.preset.roles[k]; });
      if (state.sel === id) state.sel = cin.layers.length ? cin.layers[cin.layers.length - 1].id : null;
      save(); refreshAll();
    }
    function addAction(moveId, layerId) {
      const m = F.move(moveId); if (!m) return;
      const a = { id: uid("A"), layer: layerId, move: moveId, start: "after", delay: 0, duration: m.duration, easing: m.easing, params: {} };
      if (m.loop) a.repeat = m.defRepeat != null ? m.defRepeat : 1;
      if (m.loop && a.repeat === 0) {
        // sürekli tekrarlanan bekleme hareketleri (süzülme, titreşim) ilk dokunuştan önce oynar
        a.start = "with";
        const ft = cin.actions.findIndex(gateOf);
        cin.actions.splice(ft >= 0 ? ft : cin.actions.length, 0, a);
      } else {
        a.start = cin.actions.some(gateOf) ? "after" : "tap";
        cin.actions.push(a);
      }
      save(); refreshAll();
    }
    function moveAction(id, dir) {
      const i = cin.actions.findIndex(a => a.id === id), j = i + dir;
      if (i < 0 || j < 0 || j >= cin.actions.length) return;
      const t = cin.actions[i]; cin.actions[i] = cin.actions[j]; cin.actions[j] = t;
      save(); renderLeft(); renderRight(); renderSub();
    }
    function toast(text) {
      let t = root.querySelector(".cs-toast"); if (!t) { t = document.createElement("div"); t.className = "cs-toast"; t.setAttribute("role", "status"); root.appendChild(t); }
      t.textContent = text; clearTimeout(t._h); t._h = setTimeout(() => t.remove(), 2600);
    }
    function copyAction(id) {
      const a = cin.actions.find(x => x.id === id); if (!a) return;
      state.clip = JSON.parse(JSON.stringify(a)); state.selAct = a.id;
      toast("Kopyalandı · bir katman seçip “Yapıştır”a basın"); renderRight(); renderTimeline();
    }
    function pasteAction() {
      if (!state.clip || !layerById(state.sel)) return;
      const c = JSON.parse(JSON.stringify(state.clip)); c.id = uid("A"); c.layer = state.sel;
      const srcIdx = cin.actions.findIndex(x => x.id === state.clip.id);
      if (gateOf(c) && cin.actions.some(gateOf)) c.start = "with";
      cin.actions.splice(srcIdx >= 0 ? srcIdx + 1 : cin.actions.length, 0, c);
      if (c.start !== "at" && srcIdx >= 0) c.start = "with";
      state.selAct = c.id; save(); refreshAll(); toast("Yapıştırıldı");
    }
    /* =================== A2.3 · ZAMAN ÇİZELGESİ =================== */
    const tlEl = root.querySelector("[data-cs-tl]");
    function fmt(t) { return (Math.round(t * 10) / 10).toFixed(1).replace(".", ","); }
    function tlPlan() { const n = norm(); return { n, p: n.__free ? F.plan(n, entry) : null, k: 1 / (n.speed || 1) }; }
    function renderTimeline() {
      const { p, k } = tlPlan();
      if (!p) { tlEl.innerHTML = `<p class="cs-hint cs-tl-empty">Hazır kurgu seçiliyken zaman çizelgesi kullanılmaz; kurgu kendi zamanlamasıyla oynar.</p>`; return; }
      const pps = state.zoom, sec = ms => ms * k / 1000, total = sec(p.total);
      const W = Math.max(600, Math.ceil(total + 1) * pps);
      const rows = cin.layers.slice().reverse();
      const LANE = 24;
      const bar = it => {
        const m = it.def, l = layerById(it.a.layer);
        const left = it._l, width = it._w;
        const startLab = (START_LABELS.find(x => x[0] === it.a.start) || [0, ""])[1];
        return `<div class="cs-bar g-${m.group}${it.loopForever ? " is-loop" : ""}${state.selAct === it.a.id ? " is-on" : ""}" data-bar="${it.a.id}" style="left:${left}px;width:${width}px;top:${4 + it._lane * LANE}px;height:${LANE - 4}px"
          title="${esc(m.label)} · ${esc(l ? l.name : "")} · ${fmt(sec(it.begin))}–${it.loopForever ? "dokunuşa kadar" : fmt(sec(it.end)) + " sn"} · ${esc(startLab)}">
          <span>${esc(m.label)}</span>${it.loopForever ? "" : `<i class="cs-bar-r" data-resize="${it.a.id}" title="Süreyi değiştir"></i>`}</div>`;
      };
      function lanes(list) {
        const ends = [];
        return list.map(it => {
          const l = sec(it.begin) * pps, w = it.loopForever ? Math.max(30, sec(p.firstTap - it.begin) * pps) : Math.max(16, sec(it.end - it.begin) * pps);
          let ln = ends.findIndex(e => e <= l + 1); if (ln < 0) { ln = ends.length; ends.push(0); }
          ends[ln] = l + w; return Object.assign({}, it, { _l: l, _w: w, _lane: ln });
        });
      }
      const ticks = [];
      for (let t = 0; t <= Math.ceil(total); t++) ticks.push(`<span class="cs-tick" style="left:${t * pps}px">${t}</span>`);
      const taps = p.taps.map((tp, i) => { const nm = GATE_NAMES[tp.kind] || GATE_NAMES.tap, ic = { pull: "✋", swipe: "👉", hold: "☝️" }[tp.kind] || "👆";
        return `<div class="cs-tap" data-kind="${tp.kind || "tap"}" style="left:${sec(tp.time) * pps}px" title="${i === 0 ? "Misafirin ilk hareketi (açılış başlar): " + nm.toLowerCase() : "Misafiri bekler: " + nm.toLowerCase()}"><span>${ic} ${nm}${i ? " " + (i + 1) : ""}</span></div>`; }).join("");
      const cardRow = p.hasCard ? `<div class="cs-tl-row"><div class="cs-tl-name">İç kart</div><div class="cs-tl-track" style="width:${W}px">
          <div class="cs-bar g-kart is-fixed" style="left:${sec(p.cardStart) * pps}px;width:${Math.max(20, sec(p.exitAt - p.cardStart) * pps)}px" title="İç kart görünür; ${p.holdTap ? "misafir dokunana kadar" : "ayarlanan süre kadar"} ekranda kalır"><span>İç kart${p.holdTap ? " · dokunana kadar" : ` · ${fmt(sec(p.exitAt - p.cardShown))} sn ekranda`}</span></div>
          <div class="cs-bar g-exit is-fixed" style="left:${sec(p.exitAt) * pps}px;width:${Math.max(16, sec(p.exitMs) * pps)}px" title="Davetiyeye geçiş"><span>Geçiş</span></div>
        </div></div>` : "";
      tlEl.innerHTML = `
        <div class="cs-tl-bar">
          <button type="button" class="cs-ico cs-tl-btn" data-tl="rewind" title="Başa sar" aria-label="Başa sar">⏮</button>
          <button type="button" class="btn btn-gold cs-tl-play" data-tl="play">${state.playing ? "❚❚ Durdur" : "▶ Oynat"}</button>
          <span class="cs-tl-time" data-tl-time>${fmt(state.time)} / ${fmt(total)} sn</span>
          <label class="cs-tl-go">Saniyeye git <input type="number" min="0" step="0.1" value="${fmt(state.time).replace(",", ".")}" data-tl-go aria-label="Saniye"></label>
          <span class="cs-tl-sp"></span>
          <button type="button" class="cs-mini" data-tl="copy" ${state.selAct ? "" : "disabled"}>Kopyala</button>
          <button type="button" class="cs-mini" data-tl="paste" ${state.clip && state.sel ? "" : "disabled"}>Yapıştır</button>
          <button type="button" class="cs-ico cs-tl-btn" data-tl="zout" title="Uzaklaştır" aria-label="Uzaklaştır">−</button>
          <button type="button" class="cs-ico cs-tl-btn" data-tl="zin" title="Yakınlaştır" aria-label="Yakınlaştır">+</button>
        </div>
        <div class="cs-tl-scroll" data-tl-scroll>
          <div class="cs-tl-inner" style="width:${W + 120}px">
            <div class="cs-tl-row cs-tl-ruler"><div class="cs-tl-name">sn</div><div class="cs-tl-track" data-tl-ruler style="width:${W}px">${ticks.join("")}</div></div>
            ${rows.map(l => { const its = lanes(p.items.filter(it => it.a.layer === l.id)); const n = its.reduce((m, it) => Math.max(m, it._lane + 1), 1);
              return `<div class="cs-tl-row${state.sel === l.id ? " is-on" : ""}" data-tl-layer="${l.id}" style="height:${n * LANE + 6}px"><div class="cs-tl-name" data-cs-sel="${l.id}" title="${esc(l.name)}">${esc(l.name)}</div>
              <div class="cs-tl-track" style="width:${W}px">${its.map(bar).join("")}</div></div>`; }).join("")}
            ${cardRow}
            <div class="cs-tl-overlay" style="width:${W}px">${taps}<div class="cs-phead" data-tl-head style="left:${state.time * pps}px"></div></div>
          </div>
        </div>
        <p class="cs-hint cs-tl-help">Çubuğu sürükleyerek başlangıcını, sağ kenarından çekerek süresini değiştirin. Cetvele tıklayınca sahne o saniyede donar.</p>`;
    }
    function updateHead(t) {
      const { p, k } = tlPlan(); if (!p) return;
      const head = tlEl.querySelector("[data-tl-head]"), lab = tlEl.querySelector("[data-tl-time]");
      if (head) head.style.left = (t * state.zoom) + "px";
      if (lab) lab.textContent = `${fmt(t)} / ${fmt(p.total * k / 1000)} sn`;
    }
    function hideHandles() { if (hEls) { hEls.box.remove(); hEls = null; } }
    function tlStart(from, paused) {
      if (state.previewing) return;
      if (state.tl) { state.tl.stop(); state.tl = null; }
      token++;
      if (state.handle) { state.handle.destroy(); state.handle = null; }
      hideHandles(); stageEl.innerHTML = "";
      state.playing = !paused;
      $("[data-cs-tip]").textContent = paused ? `Zaman çizelgesi · ${fmt(from)}. saniye` : "Zaman çizelgesi oynuyor";
      const n = norm();
      state.tl = F.runTimeline(doc, stageEl, { from, paused, sound: !paused && n.sound,
        onTick: t => { state.time = t; updateHead(t); },
        onEnd: () => { state.playing = false; state.time = 0; rebuildStage(); renderTimeline(); } });
      renderTimeline();
    }
    function tlPause() { const t = state.tl && state.tl.time ? state.tl.time() : state.time; state.time = t; tlStart(t, true); }
    function seek(t) { const { p, k } = tlPlan(); if (!p) return; state.time = clamp(t, 0, p.total * k / 1000); tlStart(state.time, true); }

    tlEl.addEventListener("click", (e) => {
      const b = e.target.closest("[data-tl]");
      if (b) {
        const a = b.dataset.tl;
        if (a === "play") { if (state.playing) tlPause(); else { const { p, k } = tlPlan(); if (p && state.time >= p.total * k / 1000 - 0.05) state.time = 0; tlStart(state.time, false); } }
        else if (a === "rewind") { state.time = 0; rebuildStage(); renderTimeline(); }
        else if (a === "zin") { state.zoom = Math.min(200, state.zoom * 1.4); renderTimeline(); }
        else if (a === "zout") { state.zoom = Math.max(25, state.zoom / 1.4); renderTimeline(); }
        else if (a === "copy" && state.selAct) copyAction(state.selAct);
        else if (a === "paste") pasteAction();
        return;
      }
      const nm = e.target.closest(".cs-tl-name[data-cs-sel]"); if (nm) return;   // genel tıklama işleyicisi seçer
      const ruler = e.target.closest("[data-tl-ruler], .cs-tl-track");
      if (ruler && !e.target.closest(".cs-bar")) {
        const r = ruler.getBoundingClientRect(); seek((e.clientX - r.left) / state.zoom);
      }
    });
    tlEl.addEventListener("change", (e) => { if (e.target.matches("[data-tl-go]")) seek(Number(String(e.target.value).replace(",", ".")) || 0); });
    // çubuk sürükleme: taşı (başlangıç) / sağ kenar (süre)
    tlEl.addEventListener("pointerdown", (e) => {
      const barEl = e.target.closest(".cs-bar[data-bar]"); if (!barEl) return;
      const id = barEl.dataset.bar, a = cin.actions.find(x => x.id === id); if (!a) return;
      const { p, k } = tlPlan(); const it = p.items.find(x => x.a.id === id); if (!it) return;
      e.preventDefault();
      const resize = !!e.target.closest("[data-resize]"), x0 = e.clientX, left0 = barEl.offsetLeft, w0 = barEl.offsetWidth;
      const chunkStart = it.chunk === 0 ? 0 : p.taps[it.chunk - 1].time;
      let moved = false;
      try { barEl.setPointerCapture(e.pointerId); } catch (err) { /* önemsiz */ }
      const mv = ev => {
        const dx = ev.clientX - x0; if (Math.abs(dx) > 3) moved = true; if (!moved) return;
        if (resize) barEl.style.width = Math.max(16, w0 + dx) + "px"; else barEl.style.left = Math.max(chunkStart * k / 1000 * state.zoom, left0 + dx) + "px";
      };
      const up = () => {
        barEl.removeEventListener("pointermove", mv); barEl.removeEventListener("pointerup", up); barEl.removeEventListener("pointercancel", up);
        if (!moved) { state.selAct = id; state.sel = a.layer; renderLeft(); renderRight(); drawHandles(); renderTimeline();
          const card = rightEl.querySelector(`[data-act="${id}"]`); if (card && card.scrollIntoView) card.scrollIntoView({ block: "nearest" }); return; }
        if (resize) {
          const vis = barEl.offsetWidth / state.zoom;                       // görünen saniye
          a.duration = Math.max(0.1, Math.round(vis / k * (a.speed || 1) * 10) / 10);
        } else {
          const beginU = barEl.offsetLeft / state.zoom * 1000 / k;           // hız uygulanmamış ms
          const rel = Math.max(0, Math.round((beginU - chunkStart) / 100) / 10);
          if (!gateOf(a)) a.start = "at";
          a.delay = rel;
        }
        const relayer = state.sel !== a.layer; state.selAct = id; state.sel = a.layer; save();
        if (relayer) { renderLeft(); drawHandles(); } else renderSeq();
        renderRight(); renderTimeline();
      };
      barEl.addEventListener("pointermove", mv); barEl.addEventListener("pointerup", up); barEl.addEventListener("pointercancel", up);
    });
    // hareket sırası: sürükle-bırak ile sıralama
    leftEl.addEventListener("dragstart", (e) => { const li = e.target.closest("[data-seq]"); if (!li) return; e.dataTransfer.setData("text/plain", li.dataset.seq); e.dataTransfer.effectAllowed = "move"; li.classList.add("is-drag"); });
    leftEl.addEventListener("dragend", (e) => { const li = e.target.closest("[data-seq]"); if (li) li.classList.remove("is-drag"); });
    leftEl.addEventListener("dragover", (e) => { if (e.target.closest("[data-seq]")) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; } });
    leftEl.addEventListener("drop", (e) => {
      const li = e.target.closest("[data-seq]"); if (!li) return; e.preventDefault();
      const from = e.dataTransfer.getData("text/plain"), to = li.dataset.seq; if (!from || from === to) return;
      const i = cin.actions.findIndex(a => a.id === from); const item = cin.actions.splice(i, 1)[0];
      const r = li.getBoundingClientRect(), after = e.clientY > r.top + r.height / 2;
      const j = cin.actions.findIndex(a => a.id === to); cin.actions.splice(after ? j + 1 : j, 0, item);
      save(); renderSeq(); renderRight(); renderTimeline(); renderSub();
    });
    // klavye: Ctrl/Cmd + C / V (yazı alanlarında değil)
    function onCopyKeys(e) {
      if (!(e.ctrlKey || e.metaKey) || /^(INPUT|SELECT|TEXTAREA)$/.test((document.activeElement || {}).tagName || "")) return;
      if (e.key === "c" && state.selAct) { e.preventDefault(); copyAction(state.selAct); }
      else if (e.key === "v" && state.clip) { e.preventDefault(); pasteAction(); }
    }
    document.addEventListener("keydown", onCopyKeys);

    function refreshAll() { renderSub(); renderLeft(); renderRight(); rebuildStage(); renderTimeline(); }

    /* ---------- olaylar ---------- */
    root.addEventListener("click", (e) => {
      const t = e.target.closest("button, [data-cs-sel]"); if (!t || !root.contains(t)) return;
      const d = t.dataset;
      if (d.csClose != null) return close();
      if (d.csLib != null) return openLibrary();
      if (d.csLibSave != null) return saveKurgu();
      if (d.csLibImport != null) return importKurgu();
      if (d.csLogo != null) return pick(false, ([f]) => uploadLogo(f));
      if (d.csLogoDel != null) { cin.brand = Object.assign({}, cin.brand, { logo: "" }); save(); return refreshAll(); }
      if (d.csAdd != null) return pick(true, addFiles);
      if (d.csLup) { e.stopPropagation(); return moveLayer(d.csLup, +1); }
      if (d.csLdown) { e.stopPropagation(); return moveLayer(d.csLdown, -1); }
      if (d.csLdel) { e.stopPropagation(); return deleteLayer(d.csLdel); }
      if (d.csAup) return moveAction(d.csAup, -1);
      if (d.csAdown) return moveAction(d.csAdown, +1);
      if (d.csAdel) { cin.actions = cin.actions.filter(a => a.id !== d.csAdel); if (state.selAct === d.csAdel) state.selAct = null; save(); return refreshAll(); }
      if (d.csAcopy) return copyAction(d.csAcopy);
      if (d.csPaste != null) return pasteAction();
      if (d.csSelact) { state.selAct = d.csSelact; }
      if (d.csSel) { state.sel = d.csSel; renderLeft(); renderRight(); drawHandles(); renderTimeline(); return; }
      if (d.csView) { state.view = d.csView; return rebuildStage(); }
      if (d.csPlay != null) return togglePreview();
      if (d.csUp != null) return replaceImage(state.sel, false);
      if (d.csUpBack != null) return replaceImage(state.sel, true);
      if (d.csDelBack != null) { const l = layerById(state.sel); delete l.backSrc; delete l.backCheck; save(); return refreshAll(); }
      if (d.csCardUp != null) return pick(false, ([f]) => uploadCard(f));
      if (d.csCardDel != null) { entry.cardSrc = ""; delete cin.cardCheck; save(); return refreshAll(); }
      if (d.csReset != null) { const l = layerById(state.sel); ["x", "y", "scale", "origin", "depth", "thickness", "light"].forEach(k => delete l[k]); save(); renderRight(); return rebuildStage(); }
    });
    leftEl.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target.matches("[data-cs-sel][role=button]")) { e.preventDefault(); e.target.click(); } });
    leftEl.addEventListener("input", (e) => {
      const k = e.target.dataset.csOpt;
      if (k && e.target.type === "range") { cin[k] = Number(e.target.value); const o = leftEl.querySelector(`[data-cs-out="${k}"]`); if (o) o.textContent = r1(cin[k]) + "×"; }
    });
    leftEl.addEventListener("change", (e) => {
      const tg = e.target;
      if (tg.matches("[data-cs-preset]")) {
        if (tg.value) cin.preset = { id: tg.value, roles: (cin.preset && cin.preset.roles) || {}, artFill: !!(cin.preset && cin.preset.artFill) };
        else cin.preset = null;
        save(); return refreshAll();
      }
      if (tg.matches("[data-cs-role]")) { cin.preset.roles = cin.preset.roles || {}; if (tg.value) cin.preset.roles[tg.dataset.csRole] = tg.value; else delete cin.preset.roles[tg.dataset.csRole]; save(); return rebuildStage(); }
      if (tg.matches("[data-cs-hold]")) { entry.cardDisplayDuration = tg.value === "tap" ? "tap" : Number(tg.value); save(); return renderTimeline(); }
      if (tg.matches("[data-cs-artfill]")) { cin.preset.artFill = tg.checked; save(); return rebuildStage(); }
      if (tg.dataset.csBrand) {
        cin.brand = Object.assign({ useColors: false, primary: "#7A1F2B", secondary: "#C9A45C", logo: "", text: "" }, cin.brand || {});
        cin.brand[tg.dataset.csBrand] = tg.type === "checkbox" ? tg.checked : tg.value;
        save(); renderSub(); return;
      }
      const k = tg.dataset.csOpt; if (!k) return;
      cin[k] = tg.type === "checkbox" ? tg.checked : tg.type === "range" ? Number(tg.value) : tg.value;
      save(); renderSub(); renderTimeline();
      if (["depth", "cardMode", "cardTitle", "lite"].includes(k)) rebuildStage();
    });
    function readOrigin() {
      const ox = Number(rightEl.querySelector('[data-cs-l="ox"]').value), oy = Number(rightEl.querySelector('[data-cs-l="oy"]').value);
      return `${clamp(isFinite(ox) ? ox : 50, -50, 150)}% ${clamp(isFinite(oy) ? oy : 50, -50, 150)}%`;
    }
    rightEl.addEventListener("input", (e) => {
      const k = e.target.dataset.csL; if (!k) return;
      const v = Number(e.target.value), out = rightEl.querySelector(`[data-cs-lout="${k}"]`);
      if (k === "x" || k === "y") { if (isFinite(v)) setLayerLive(state.sel, { [k]: v }); }
      else if (k === "scale") setLayerLive(state.sel, { scale: v });
      else if (k === "ox" || k === "oy") setLayerLive(state.sel, { origin: readOrigin() });
      else if (k === "depth") { setLayerLive(state.sel, { depth: v }); if (out) out.textContent = v; }
      else if (k === "thickness" && out) out.textContent = v;
      else if (k === "light" && out) out.textContent = Math.round(v * 100) + "%";
    });
    rightEl.addEventListener("change", (e) => {
      const tg = e.target, l = layerById(state.sel);
      if (tg.matches("[data-cs-addmove]")) { if (tg.value && l) addAction(tg.value, l.id); return; }
      if (tg.matches("[data-cs-lname]")) {
        l.name = tg.value.trim() || l.name; save(); renderSeq();
        const nm = leftEl.querySelector(`.cs-layer2[data-cs-sel="${l.id}"] .cs-layer-t strong`); if (nm) nm.textContent = l.name;
        return;
      }
      if (tg.matches("[data-cs-parent]")) { if (tg.value) l.parent = tg.value; else delete l.parent; save(); renderLeft(); return rebuildStage(); }
      if (tg.dataset.csAf) {
        const a = cin.actions.find(x => x.id === tg.dataset.csAf), key = tg.dataset.key;
        a[key] = key === "delay" || key === "duration" || key === "repeat" || key === "speed" ? Math.max(0, Number(tg.value) || 0) : tg.value;
        if (key === "duration" && !a.duration) a.duration = 0.1;
        if (key === "speed" && !a.speed) a.speed = 1;
        save(); renderSeq(); renderSub(); renderTimeline();
        if (key === "start") { const card = tg.closest(".cs-act"), lab = card.querySelector('[data-key="delay"]').parentNode; lab.firstChild.textContent = a.start === "at" ? "Başlangıç (sn)" : "Gecikme (sn)";
          const gr = card.querySelector("[data-gdir-row]"); if (gr) gr.hidden = !(a.start === "pull" || a.start === "swipe"); }
        return;
      }
      if (tg.dataset.csAp) {
        const a = cin.actions.find(x => x.id === tg.dataset.csAp); a.params = a.params || {};
        const raw = tg.value; a.params[tg.dataset.key] = /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw;
        save(); renderTimeline(); return rebuildStage();
      }
      const k = tg.dataset.csL; if (!k || !l) return;
      if (k === "hidden" || k === "backdrop") {
        l[k] = tg.checked;
        if (k === "backdrop" && tg.checked) { delete l.parent; cin.layers.forEach(x => { if (x.parent === l.id) delete x.parent; }); }
        save(); return refreshAll();
      }
      if (k === "thickness" || k === "light") { l[k] = Number(tg.value); save(); return rebuildStage(); }
      save();
    });

    /* ---------- önizleme ---------- */
    let prev = null;
    function togglePreview() {
      const btn = $("[data-cs-play]");
      if (state.previewing) { if (prev) prev.finish(true); return; }
      if (state.tl) { state.tl.stop(); state.tl = null; state.playing = false; renderTimeline(); }
      state.previewing = true; btn.textContent = "■ Durdur";
      if (hEls) { hEls.box.remove(); hEls = null; }
      if (state.handle) { state.handle.destroy(); state.handle = null; }
      stageEl.innerHTML = "";
      $("[data-cs-tip]").textContent = "Önizleme · sahneye dokunarak başlatın";
      if (C.Sound) C.Sound.unlock();
      prev = C.play(doc, () => {
        setTimeout(() => { state.previewing = false; prev = null; btn.textContent = "▶ Önizle"; if (document.body.contains(root)) rebuildStage(); }, 1100);
      }, { container: stageEl });
    }
    function close() {
      if (state.previewing && prev) prev.stop();
      token++;
      if (state.handle) state.handle.destroy();
      C.stop();
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("keydown", onCopyKeys);
      if (state.tl) { state.tl.stop(); state.tl = null; }
      global.removeEventListener("resize", onResize);
      root.remove(); document.body.classList.remove("cs-open");
      if (cb.onClose) cb.onClose();
    }

    renderSub(); renderLeft(); renderRight(); renderTimeline();
    requestAnimationFrame(() => rebuildStage());
    return { close, root, state };
  }

  function summary(entry) {
    const F = global.SeozCinemaFree, c = entry.cinema || {};
    if (c.v !== 2) return null;
    const p = c.preset && F && F.presetOf(c.preset.id);
    return { layers: (c.layers || []).length, actions: (c.actions || []).length, preset: p ? p.label : "" };
  }

  global.SeozCinemaStudio2 = { open, ensureV2, summary };
})(window);
