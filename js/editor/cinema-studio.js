/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — cinema-studio.js  (AÇILIŞ STÜDYOSU · yalnızca editör)
   -----------------------------------------------------------------------------
   Giriş Türü "Sinematik Açılış" seçiliyken açılan tam ekran çalışma alanı.
   Bütün ayarlar belgenin entry.cinema alanına yazılır; görseller mevcut
   IndexedDB deposuna (idb:...) kaydedilir. "Yayına Hazırla" bu görselleri
   bugünkü gibi kendiliğinden bulup Supabase Storage'a yükler — yayın
   koduna ek bir şey gerekmez.

   A1 kapsamı: model ve senaryo seçimi, katmanlı PNG yükleme (saydamlık,
   boyut ve açıklık kontrolleriyle), arka yüz yükleme, rehber indirme,
   hizalama sahnesi (sürükle, ölçekle, dönme noktası, derinlik, kalınlık,
   ışık tepkisi), telefon/bilgisayar görünümü, oynatma ayarları, iç kart.
   ========================================================================= */

(function (global) {
  "use strict";

  const CATALOG = [
    { id: "door", label: "Çift Kanatlı Kapı", icon: "🚪" },
    { id: "envelope", label: "Mühürlü Zarf", icon: "✉️" },
    { id: "curtain", label: "Kadife Perde", icon: "🎭" },
    { id: "book", label: "Antika Kitap", icon: "📖" },
    { id: "giftbox", label: "Hediye Kutusu", icon: "🎁" },
    { id: "jewelry", label: "Lüks Mücevher Kutusu", icon: "💍" },
    { id: "flower", label: "Çiçek Açılışı", icon: "🌸" },
    { id: "cinema", label: "Sinematik Perde", icon: "🎬" }
  ];
  const MAX_PX = 2048;
  const BUDGET_MB = 15;
  const BIG_FILE_MB = 1.5;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function r1(n) { return Math.round(n * 10) / 10; }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function mb(bytes) { return (bytes / (1024 * 1024)).toFixed(bytes > 1024 * 1024 ? 1 : 2); }

  function ensureCinema(entry) {
    if (!entry.cinema || typeof entry.cinema !== "object") entry.cinema = {};
    const c = entry.cinema;
    if (!c.layers || typeof c.layers !== "object") c.layers = {};
    if (!c.model) c.model = "door";
    return c;
  }

  /* =================== GÖRSEL İŞLEME VE KONTROL =================== */
  function loadImage(file) {
    return new Promise((res, rej) => {
      const u = URL.createObjectURL(file);
      const im = new Image();
      im.onload = () => res({ im, u });
      im.onerror = () => { URL.revokeObjectURL(u); rej(new Error("Görsel açılamadı. Dosya bozuk olabilir.")); };
      im.src = u;
    });
  }
  function toBlob(cv, type, q) { return new Promise(res => cv.toBlob(res, type, q)); }

  /* Bir katman dosyasını işler: 2048 px sınırı, saydamlık kontrolü,
     saydam kalması gereken bölgelerin kontrolü, oran ve çözünürlük uyarıları.
     Döner: { ref, info, warnings[], notes[] } */
  async function processLayerFile(file, model, slot, opts) {
    opts = opts || {};
    if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error("Yalnızca PNG, JPG veya WebP yüklenebilir.");
    const { im, u } = await loadImage(file);
    try {
      const ow = im.naturalWidth, oh = im.naturalHeight;
      if (!ow || !oh) throw new Error("Görsel okunamadı.");
      const k = Math.min(1, MAX_PX / Math.max(ow, oh));
      const w = Math.max(1, Math.round(ow * k)), h = Math.max(1, Math.round(oh * k));
      const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
      cv.getContext("2d").drawImage(im, 0, 0, w, h);

      // analiz küçük bir kopya üzerinde yapılır (hızlı)
      const aw = Math.min(w, 360), ah = Math.max(1, Math.round(h * aw / w));
      const ac = document.createElement("canvas"); ac.width = aw; ac.height = ah;
      const actx = ac.getContext("2d");
      actx.drawImage(im, 0, 0, aw, ah);
      const data = actx.getImageData(0, 0, aw, ah).data;
      let clearPx = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] < 250) clearPx++;
      const hasAlpha = clearPx / (aw * ah) > 0.003;

      const g = slot.guide || {};
      const warnings = [], notes = [];
      const [gw, gh] = opts.guideSize || (global.SeozCinemaGuides ? global.SeozCinemaGuides.sizeOf(model, slot) : [w, h]);

      if (g.alpha === "required" && !hasAlpha) {
        warnings.push("Bu katmanın saydam zeminli PNG olması gerekiyor; yüklenen görselde saydam alan yok. Arkasındaki parçalar görünmeyecek.");
      }
      // saydam kalması gereken bölgeler (ör. kapı açıklığı)
      if (!opts.back && g.clear && slot.box) {
        const bw = slot.box.w, bh = slot.box.h;
        const s = Math.min(bw / ow, bh / oh), dw = ow * s, dh = oh * s, ox = (bw - dw) / 2, oy = (bh - dh) / 2;
        g.clear.forEach(r => {
          const x0 = clamp(((r.x - slot.box.x) - ox) / dw, 0, 1), x1 = clamp(((r.x - slot.box.x + r.w) - ox) / dw, 0, 1);
          const y0 = clamp(((r.y - slot.box.y) - oy) / dh, 0, 1), y1 = clamp(((r.y - slot.box.y + r.h) - oy) / dh, 0, 1);
          const px0 = Math.floor(x0 * aw), px1 = Math.ceil(x1 * aw), py0 = Math.floor(y0 * ah), py1 = Math.ceil(y1 * ah);
          let tot = 0, clr = 0;
          for (let y = py0; y < py1; y++) for (let x = px0; x < px1; x++) { tot++; if (data[(y * aw + x) * 4 + 3] < 40) clr++; }
          if (!tot) return;
          const frac = clr / tot;
          const name = (r.label || "Saydam bölge").split("·")[0].trim().toLocaleLowerCase("tr-TR");
          if (!r.soft && frac < 0.85) warnings.push(`"${name}" bölgesi saydam değil (yalnızca %${Math.round(frac * 100)}'ü saydam). Kanatlar açılınca arkadaki ışık ve kart görünmez; bu alanı saydam bırakın.`);
          else if (r.soft && frac < 0.5) notes.push(`Kapının önü büyük ölçüde dolu (%${Math.round(frac * 100)} saydam). Süsler açılışın başında kaybolur ama kapalı kapıyı örtebilir.`);
        });
      }
      if (!slot.backdrop) {
        const ar = ow / oh, gr = gw / gh;
        if (Math.abs(ar - gr) / gr > 0.04) notes.push(`Önerilen ölçü ${gw}×${gh} px; yüklenen ${ow}×${oh} px. Görsel kutuya oranı korunarak sığdırıldı, gerekirse hizalamadan ayarlayın.`);
      }
      if (k < 1) notes.push(`Görsel ${ow}×${oh} px idi; ${w}×${h} px'e küçültüldü (en fazla 2048 px).`);
      if (Math.max(ow, oh) < Math.max(gw, gh) * 0.5) notes.push("Görselin çözünürlüğü düşük; telefonda bulanık görünebilir.");

      const keepPng = file.type !== "image/jpeg" || hasAlpha;
      const blob = await toBlob(cv, keepPng ? "image/png" : "image/jpeg", keepPng ? undefined : 0.88);
      if (!blob) throw new Error("Görsel işlenemedi.");
      if (blob.size > BIG_FILE_MB * 1024 * 1024) notes.push(`Dosya ${mb(blob.size)} MB; yavaş bağlantıda açılışı geciktirebilir (öneri: 1,5 MB altı).`);
      const ref = await global.SeozBlobStore.putBlob(blob);
      return { ref, info: { w, h, hasAlpha, bytes: blob.size, name: file.name }, warnings, notes };
    } finally {
      URL.revokeObjectURL(u);
    }
  }

  /* =================== STÜDYO =================== */
  function open(doc, cb) {
    cb = cb || {};
    const entry = doc.entry;
    const cin = ensureCinema(entry);
    const C = global.SeozCinema;
    const state = { sel: "leftWing", view: "phone", handle: null, previewing: false, budget: null };

    const root = document.createElement("div");
    root.className = "cs-root";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "Açılış Stüdyosu");
    root.innerHTML = `
      <header class="cs-head">
        <div class="cs-title"><span class="cs-logo">🎬</span><div><h2>Açılış Stüdyosu</h2><p data-cs-sub></p></div></div>
        <div class="cs-head-actions">
          <button type="button" class="btn btn-outline" data-cs-zip>Rehber paketini indir (ZIP)</button>
          <button type="button" class="btn btn-primary" data-cs-close>Bitti</button>
        </div>
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
          <div class="cs-stage-area" data-cs-area>
            <div class="cs-stage" data-cs-stage></div>
          </div>
          <p class="cs-stage-tip" data-cs-tip></p>
        </main>
        <aside class="cs-right" data-cs-right></aside>
      </div>`;
    document.body.appendChild(root);
    document.body.classList.add("cs-open");

    const $ = s => root.querySelector(s);
    const leftEl = $("[data-cs-left]"), rightEl = $("[data-cs-right]"), stageEl = $("[data-cs-stage]"), areaEl = $("[data-cs-area]");

    function model() { return C.model(C.normalize(cin).model); }
    function norm() { return C.normalize(cin); }
    function layer(id) { if (!cin.layers[id]) cin.layers[id] = {}; return cin.layers[id]; }
    function slotOf(id) { return model().slots.find(s => s.id === id); }
    function save() { if (cb.onChange) cb.onChange(); }

    /* ---------- üst bilgi ---------- */
    function renderSub() {
      const n = norm(), m = model(), sc = C.scenarioOf(n);
      const up = m.slots.filter(s => cin.layers[s.id] && cin.layers[s.id].src).length;
      $("[data-cs-sub]").textContent = `${m.label} · ${sc.label} · ${up}/${m.slots.length} katman PNG`;
    }

    /* ---------- sol panel ---------- */
    function renderLeft() {
      const keepScroll = leftEl.scrollTop;
      requestAnimationFrame(() => { leftEl.scrollTop = keepScroll; });
      const n = norm(), m = model();
      const skins = m.skins ? Object.keys(m.skins) : [];
      leftEl.innerHTML = `
        <section class="cs-sec">
          <h3>1 · Model</h3>
          <div class="cs-models">
            ${CATALOG.map(c => {
              const ok = !!C.model(c.id);
              return `<button type="button" class="cs-model${n.model === c.id ? " is-on" : ""}" data-cs-model="${c.id}" ${ok ? "" : "disabled"}>
                <span class="cs-model-i">${c.icon}</span><span>${esc(c.label)}</span>${ok ? "" : `<em>yakında</em>`}</button>`;
            }).join("")}
          </div>
        </section>
        <section class="cs-sec">
          <h3>2 · Senaryo</h3>
          <div class="cs-scens">
            ${m.scenarios.map(s => `<button type="button" class="cs-scen${n.scenario === s.id ? " is-on" : ""}" data-cs-scen="${s.id}">
              <strong>${esc(s.label)}</strong><span>${esc(s.description || "")}</span></button>`).join("")}
          </div>
        </section>
        <section class="cs-sec">
          <h3>3 · Katmanlar</h3>
          <p class="cs-hint">Her parçayı ayrı PNG olarak yükleyin. Yüklenmeyen parçada kodla çizilmiş görünüm kullanılır.</p>
          <div class="cs-layers">
            ${m.slots.map(s => {
              const u = cin.layers[s.id] || {};
              const warn = u.check && u.check.warnings && u.check.warnings.length;
              const status = u.hidden ? "Gizli" : u.src ? "PNG yüklü" : "Kodla çizilen";
              return `<button type="button" class="cs-layer${state.sel === s.id ? " is-on" : ""}" data-cs-sel="${s.id}">
                <span class="cs-thumb" data-cs-thumb="${s.id}"></span>
                <span class="cs-layer-t"><strong>${esc(s.label)}</strong><small class="${u.src ? "is-png" : ""}">${status}${u.backSrc ? " · arka yüz" : ""}</small></span>
                ${warn ? `<span class="cs-warn-dot" title="Uyarı var">!</span>` : ""}</button>`;
            }).join("")}
          </div>
          <p class="cs-budget" data-cs-budget></p>
        </section>
        <section class="cs-sec">
          <h3>4 · Kodla çizilen görünüm</h3>
          <select data-cs-skin>${skins.map(k => `<option value="${k}" ${n.skin === k ? "selected" : ""}>${esc(m.skins[k].label || k)}</option>`).join("")}</select>
          <p class="cs-hint">Yalnızca PNG yüklenmeyen parçalarda ve hızlı denemede kullanılır.</p>
        </section>
        <section class="cs-sec">
          <h3>5 · Oynatma</h3>
          ${rangeRow("speed", "Hız", n.speed, 0.5, 2, 0.05, "×")}
          ${rangeRow("depth", "3D derinlik", n.depth, 0, 2, 0.05, "×")}
          ${rangeRow("intensity", "Efekt yoğunluğu", n.intensity, 0, 1.5, 0.05, "×")}
          <label class="cs-row"><span>Başlama</span>
            <select data-cs-opt="start"><option value="tap" ${n.start === "tap" ? "selected" : ""}>Dokununca</option><option value="auto" ${n.start === "auto" ? "selected" : ""}>Otomatik</option></select></label>
          <label class="cs-check"><input type="checkbox" data-cs-opt="sound" ${n.sound ? "checked" : ""}> Ses efektleri (dokunuştan sonra çalar)</label>
          <label class="cs-check"><input type="checkbox" data-cs-opt="lite" ${n.lite ? "checked" : ""}> Hafif mod (eski telefonlar için daha az efekt)</label>
          <label class="cs-row cs-row-col"><span>İpucu yazısı</span><input type="text" maxlength="40" data-cs-opt="hintText" value="${esc(n.hintText)}"></label>
        </section>
        <section class="cs-sec">
          <h3>6 · İç kart</h3>
          <div class="cs-card">
            <span class="cs-thumb cs-thumb-card" data-cs-thumb="__card"></span>
            <div>
              <button type="button" class="btn btn-outline" data-cs-card-up>${entry.cardSrc ? "Kartı değiştir" : "Kart görseli yükle"}</button>
              ${entry.cardSrc ? `<button type="button" class="btn-danger-text" data-cs-card-del>Kaldır</button>` : ""}
              <button type="button" class="cs-link" data-cs-guide="card">Kart rehberi</button>
            </div>
          </div>
          <label class="cs-row"><span>Kart</span>
            <select data-cs-opt="cardMode">
              <option value="auto" ${n.cardMode === "auto" ? "selected" : ""}>Otomatik (görsel varsa görsel)</option>
              <option value="image" ${n.cardMode === "image" ? "selected" : ""}>Yüklenen görsel</option>
              <option value="title" ${n.cardMode === "title" ? "selected" : ""}>Yazılı kart (başlık)</option>
              <option value="none" ${n.cardMode === "none" ? "selected" : ""}>Kart yok, doğrudan davetiye</option>
            </select></label>
          <label class="cs-row cs-row-col"><span>Yazılı kart başlığı</span><input type="text" maxlength="60" data-cs-opt="cardTitle" placeholder="${esc((doc.meta && doc.meta.title) || "")}" value="${esc(n.cardTitle)}"></label>
          <label class="cs-row cs-row-col"><span>Alt yazı</span><input type="text" maxlength="80" data-cs-opt="cardSubtitle" value="${esc(n.cardSubtitle)}"></label>
          ${checksHTML(cin.cardCheck)}
        </section>`;
      fillThumbs();
      renderBudget();
    }

    function rangeRow(key, label, val, min, max, step, unit) {
      return `<label class="cs-row"><span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${val}" data-cs-opt="${key}">
        <output data-cs-out="${key}">${r1(val)}${unit}</output></label>`;
    }

    function checksHTML(chk) {
      if (!chk) return "";
      const w = (chk.warnings || []).map(t => `<li class="is-warn">${esc(t)}</li>`).join("");
      const n = (chk.notes || []).map(t => `<li>${esc(t)}</li>`).join("");
      return w || n ? `<ul class="cs-checks">${w}${n}</ul>` : "";
    }

    function fillThumbs() {
      root.querySelectorAll("[data-cs-thumb]").forEach(el => {
        const id = el.dataset.csThumb;
        const ref = id === "__card" ? entry.cardSrc : (cin.layers[id] || {}).src;
        el.innerHTML = "";
        if (!ref) { el.classList.add("is-empty"); return; }
        el.classList.remove("is-empty");
        global.SeozBlobStore.resolveToObjectURL(ref).then(url => {
          if (!url) return;
          const i = document.createElement("img"); i.src = url; i.alt = ""; el.appendChild(i);
        });
      });
    }

    async function renderBudget() {
      const el = $("[data-cs-budget]");
      if (!el) return;
      const refs = C.sourcesOf(norm(), entry).filter(r => global.SeozBlobStore.isRef(r));
      let total = 0;
      for (const r of refs) {
        try { const b = await global.SeozBlobStore.getBlob(r.slice(4)); if (b) total += b.size; } catch (e) { /* önemsiz */ }
      }
      state.budget = total;
      const over = total > BUDGET_MB * 1024 * 1024;
      el.className = "cs-budget" + (over ? " is-over" : "");
      el.textContent = `Açılış görselleri toplamı: ${mb(total)} MB / ${BUDGET_MB} MB` + (over ? " — sınırı aştı, açılış yavaş yüklenebilir." : "");
    }

    /* ---------- sağ panel (seçili katman) ---------- */
    function renderRight() {
      const s = slotOf(state.sel) || model().slots[0];
      state.sel = s.id;
      const u = cin.layers[s.id] || {};
      const L = C.layoutOf(s, u, 1);
      const [ox, oy] = String(L.origin).split(/\s+/).map(v => parseFloat(v));
      const g = s.guide || {};
      const size = global.SeozCinemaGuides ? global.SeozCinemaGuides.sizeOf(model(), s) : [0, 0];
      rightEl.innerHTML = `
        <section class="cs-sec">
          <h3>${esc(s.label)}</h3>
          <p class="cs-hint">${esc(g.note || "")}</p>
          <p class="cs-size">Önerilen: <strong>${size[0]}×${size[1]} px</strong> · ${g.alpha === "required" ? "saydam PNG şart" : g.alpha === "no" ? "PNG/JPG" : "saydam PNG önerilir"}</p>
          <div class="cs-up">
            <button type="button" class="btn btn-outline" data-cs-up>${u.src ? "PNG'yi değiştir" : "PNG yükle"}</button>
            ${u.src ? `<button type="button" class="btn-danger-text" data-cs-del>Kaldır</button>` : ""}
            <button type="button" class="cs-link" data-cs-guide="${s.id}">Rehber</button>
          </div>
          ${checksHTML(u.check)}
          ${s.back ? `
          <div class="cs-up cs-up-back">
            <span>Arka yüz <small>(isteğe bağlı)</small></span>
            <button type="button" class="btn btn-outline" data-cs-up-back>${u.backSrc ? "Değiştir" : "Yükle"}</button>
            ${u.backSrc ? `<button type="button" class="btn-danger-text" data-cs-del-back>Kaldır</button>` : ""}
            <button type="button" class="cs-link" data-cs-guide-back="${s.id}">Rehber</button>
          </div>${checksHTML(u.backCheck)}` : ""}
          <label class="cs-check"><input type="checkbox" data-cs-l="hidden" ${u.hidden ? "checked" : ""}> Bu katmanı gizle</label>
        </section>
        ${s.backdrop ? `<section class="cs-sec"><p class="cs-hint">Arka plan tüm ekranı kaplar; konumu ekrana göre otomatik ayarlanır. Telefon ve Bilgisayar görünümünde kırpılan kısmı kontrol edin.</p></section>` : `
        <section class="cs-sec">
          <h3>Hizalama</h3>
          <div class="cs-grid2">
            <label>Yatay (x)<input type="number" step="1" data-cs-l="x" value="${r1(L.x)}"></label>
            <label>Dikey (y)<input type="number" step="1" data-cs-l="y" value="${r1(L.y)}"></label>
          </div>
          <label class="cs-row"><span>Ölçek</span><input type="range" min="0.2" max="3" step="0.01" data-cs-l="scale" value="${L.s}"><output data-cs-lout="scale">${Math.round(L.s * 100)}%</output></label>
          <div class="cs-grid2">
            <label>Dönme noktası x %<input type="number" step="1" data-cs-l="ox" value="${r1(ox)}"></label>
            <label>Dönme noktası y %<input type="number" step="1" data-cs-l="oy" value="${r1(oy)}"></label>
          </div>
          <label class="cs-row"><span>Derinlik</span><input type="range" min="-200" max="200" step="1" data-cs-l="depth" value="${Number(u.depth) || 0}"><output data-cs-lout="depth">${Number(u.depth) || 0}</output></label>
          <label class="cs-row"><span>Kalınlık</span><input type="range" min="0" max="40" step="1" data-cs-l="thickness" value="${L.thickness}"><output data-cs-lout="thickness">${L.thickness}</output></label>
          <label class="cs-row"><span>Işık tepkisi</span><input type="range" min="0" max="1.5" step="0.05" data-cs-l="light" value="${L.light}"><output data-cs-lout="light">${Math.round(L.light * 100)}%</output></label>
          <button type="button" class="btn btn-outline cs-reset" data-cs-reset>Yerleşimi sıfırla</button>
          <p class="cs-hint">Sahnede katmanı sürükleyin; sağ alt köşeden büyütün; kırmızı artı işaretini taşıyarak dönme noktasını (menteşeyi) değiştirin. Ok tuşları 1 birim, Shift ile 10 birim kaydırır.</p>
        </section>`}`;
    }

    /* ---------- sahne ---------- */
    function sizeStage() {
      const ar = state.view === "phone" ? 390 / 844 : 1280 / 800;
      const aw = Math.max(200, areaEl.clientWidth - 24), ah = Math.max(200, areaEl.clientHeight - 24);
      let w = aw, h = w / ar;
      if (h > ah) { h = ah; w = h * ar; }
      if (state.view === "phone") { w = Math.min(w, 430); h = w / ar; }
      stageEl.style.width = Math.round(w) + "px";
      stageEl.style.height = Math.round(h) + "px";
      stageEl.dataset.view = state.view;
      root.querySelectorAll("[data-cs-view]").forEach(b => b.classList.toggle("is-on", b.dataset.csView === state.view));
    }

    let buildToken = 0;
    function rebuildStage() {
      const token = ++buildToken;
      if (state.handle) { state.handle.destroy(); state.handle = null; }
      stageEl.innerHTML = "";
      sizeStage();
      const h = C.play(doc, null, { container: stageEl, freeze: true });
      state.handle = h;
      h.ready.then(() => {
        if (token !== buildToken) return;
        drawHandles();
        $("[data-cs-tip]").textContent = "Kapalı sahne · seçili katman çerçeveli gösterilir";
      });
    }

    let hEls = null;
    function drawHandles() {
      if (hEls) { hEls.box.remove(); hEls = null; }
      const h = state.handle;
      if (!h || !h.ctx || state.previewing) return;
      const s = slotOf(state.sel);
      if (!s || s.backdrop) return;
      const el = h.ctx.S[s.id];
      if (!el) return;
      const box = document.createElement("div"); box.className = "cs-sel"; box.setAttribute("data-cs-handle", "move");
      const corner = document.createElement("div"); corner.className = "cs-corner"; corner.setAttribute("data-cs-handle", "scale");
      const pivot = document.createElement("div"); pivot.className = "cs-pivot"; pivot.setAttribute("data-cs-handle", "pivot");
      pivot.title = "Dönme noktası";
      box.appendChild(corner); box.appendChild(pivot);
      stageEl.appendChild(box);
      hEls = { box, corner, pivot, el };
      placeHandles();
    }
    function placeHandles() {
      if (!hEls) return;
      const sr = stageEl.getBoundingClientRect(), r = hEls.el.getBoundingClientRect();
      Object.assign(hEls.box.style, { left: (r.left - sr.left) + "px", top: (r.top - sr.top) + "px", width: r.width + "px", height: r.height + "px" });
      const u = cin.layers[state.sel] || {};
      const L = C.layoutOf(slotOf(state.sel), u, 1);
      const [ox, oy] = String(L.origin).split(/\s+/).map(v => parseFloat(v));
      hEls.pivot.style.left = ox + "%"; hEls.pivot.style.top = oy + "%";
    }

    function setLayerLive(id, patch, commit) {
      const u = Object.assign(layer(id), patch);
      if (state.handle) state.handle.setLayer(id, u);
      placeHandles();
      syncRightInputs();
      if (commit) save();
    }
    function syncRightInputs() {
      const s = slotOf(state.sel); if (!s || s.backdrop) return;
      const u = cin.layers[s.id] || {}, L = C.layoutOf(s, u, 1);
      const [ox, oy] = String(L.origin).split(/\s+/).map(v => parseFloat(v));
      const set = (k, v) => { const i = rightEl.querySelector(`[data-cs-l="${k}"]`); if (i && document.activeElement !== i) i.value = v; };
      set("x", r1(L.x)); set("y", r1(L.y)); set("scale", L.s); set("ox", r1(ox)); set("oy", r1(oy));
      const o = rightEl.querySelector('[data-cs-lout="scale"]'); if (o) o.textContent = Math.round(L.s * 100) + "%";
    }

    /* sürükleme: taşı / ölçekle / dönme noktası */
    stageEl.addEventListener("pointerdown", (e) => {
      const kind = e.target.closest("[data-cs-handle]") && e.target.closest("[data-cs-handle]").dataset.csHandle;
      if (!kind || !state.handle || !state.handle.ctx) return;
      e.preventDefault();
      const id = state.sel, u = layer(id);
      const fit = state.handle.ctx.scale();
      const L0 = C.layoutOf(slotOf(id), u, 1);
      const br = hEls.box.getBoundingClientRect();
      const cx = br.left + br.width / 2, cy = br.top + br.height / 2;
      const start = { x: e.clientX, y: e.clientY, ux: L0.x, uy: L0.y, s: L0.s, d: Math.hypot(e.clientX - cx, e.clientY - cy) || 1 };
      const target = e.target.closest("[data-cs-handle]");
      try { target.setPointerCapture(e.pointerId); } catch (err) { /* önemsiz */ }
      function move(ev) {
        if (kind === "move") setLayerLive(id, { x: r1(start.ux + (ev.clientX - start.x) / fit), y: r1(start.uy + (ev.clientY - start.y) / fit) });
        else if (kind === "scale") setLayerLive(id, { scale: Math.round(clamp(start.s * Math.hypot(ev.clientX - cx, ev.clientY - cy) / start.d, 0.2, 4) * 100) / 100 });
        else if (kind === "pivot") {
          const r = hEls.box.getBoundingClientRect();
          const fx = clamp((ev.clientX - r.left) / r.width * 100, -50, 150), fy = clamp((ev.clientY - r.top) / r.height * 100, -50, 150);
          setLayerLive(id, { origin: `${r1(fx)}% ${r1(fy)}%` });
        }
      }
      function up() {
        target.removeEventListener("pointermove", move);
        target.removeEventListener("pointerup", up);
        target.removeEventListener("pointercancel", up);
        save();
      }
      target.addEventListener("pointermove", move);
      target.addEventListener("pointerup", up);
      target.addEventListener("pointercancel", up);
    });

    function onKey(e) {
      if (e.key === "Escape" && !state.previewing) { close(); return; }
      if (state.previewing || !/^Arrow/.test(e.key)) return;
      if (/^(INPUT|SELECT|TEXTAREA)$/.test((document.activeElement || {}).tagName || "")) return;
      const s = slotOf(state.sel); if (!s || s.backdrop) return;
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1, u = layer(s.id), L = C.layoutOf(s, u, 1);
      const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
      const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
      setLayerLive(s.id, { x: L.x + dx, y: L.y + dy }, true);
    }
    document.addEventListener("keydown", onKey);
    const onResize = () => { if (!state.previewing) { sizeStage(); if (state.handle) state.handle.refit(); placeHandles(); } };
    global.addEventListener("resize", onResize);

    /* ---------- yükleme ---------- */
    function pickFile(cbFile) {
      const inp = document.createElement("input");
      inp.type = "file"; inp.accept = "image/png,image/jpeg,image/webp";
      inp.style.display = "none";
      inp.setAttribute("data-cs-file", "1");
      inp.addEventListener("change", () => { const f = inp.files[0]; inp.remove(); if (f) cbFile(f); });
      root.appendChild(inp);
      inp.click();
    }
    function busy(on, text) {
      let b = root.querySelector(".cs-busy");
      if (on) { if (!b) { b = document.createElement("div"); b.className = "cs-busy"; root.appendChild(b); } b.textContent = text || "Görsel işleniyor…"; }
      else if (b) b.remove();
    }
    async function uploadTo(id, back, file) {
      const s = slotOf(id);
      busy(true);
      try {
        const res = await processLayerFile(file, model(), s, { back });
        const u = layer(id);
        if (back) { u.backSrc = res.ref; u.backCheck = { warnings: res.warnings, notes: res.notes, info: res.info }; }
        else { u.src = res.ref; u.check = { warnings: res.warnings, notes: res.notes, info: res.info }; }
        save(); refreshAll();
      } catch (err) {
        alert(err.message || "Görsel yüklenemedi.");
      } finally { busy(false); }
    }
    async function uploadCard(file) {
      const m = model();
      const cg = m.cardGuide || { box: { x: 50, y: 90, w: 300, h: 520 } };
      busy(true);
      try {
        const res = await processLayerFile(file, m, { id: "card", box: cg.box, guide: { alpha: "no" } }, { guideSize: [cg.box.w * 3, cg.box.h * 3] });
        entry.cardSrc = res.ref;
        cin.cardCheck = { warnings: res.warnings, notes: res.notes, info: res.info };
        save(); refreshAll();
      } catch (err) { alert(err.message || "Kart görseli yüklenemedi."); } finally { busy(false); }
    }

    function refreshAll() { renderSub(); renderLeft(); renderRight(); rebuildStage(); }

    /* ---------- olaylar ---------- */
    root.addEventListener("click", (e) => {
      const t = e.target.closest("button, [data-cs-sel]");
      if (!t || !root.contains(t)) return;
      const d = t.dataset;
      if (d.csClose != null) { close(); return; }
      if (d.csZip != null) {
        busy(true, "Rehberler hazırlanıyor…");
        global.SeozCinemaGuides.downloadZip(model()).catch(err => alert(err.message)).finally(() => busy(false));
        return;
      }
      if (d.csModel) { if (cin.model !== d.csModel) { cin.model = d.csModel; delete cin.scenario; delete cin.skin; save(); refreshAll(); } return; }
      if (d.csScen) { cin.scenario = d.csScen; save(); renderSub(); renderLeft(); rebuildStage(); return; }
      if (d.csSel) { state.sel = d.csSel; renderLeft(); renderRight(); drawHandles(); return; }
      if (d.csView) { state.view = d.csView; rebuildStage(); return; }
      if (d.csPlay != null) { togglePreview(); return; }
      if (d.csUp != null) { pickFile(f => uploadTo(state.sel, false, f)); return; }
      if (d.csUpBack != null) { pickFile(f => uploadTo(state.sel, true, f)); return; }
      if (d.csDel != null) { const u = layer(state.sel); delete u.src; delete u.check; save(); refreshAll(); return; }
      if (d.csDelBack != null) { const u = layer(state.sel); delete u.backSrc; delete u.backCheck; save(); refreshAll(); return; }
      if (d.csGuide) { global.SeozCinemaGuides.downloadSlotGuide(model(), d.csGuide, false); return; }
      if (d.csGuideBack) { global.SeozCinemaGuides.downloadSlotGuide(model(), d.csGuideBack, true); return; }
      if (d.csCardUp != null) { pickFile(uploadCard); return; }
      if (d.csCardDel != null) { entry.cardSrc = ""; delete cin.cardCheck; save(); refreshAll(); return; }
      if (d.csReset != null) {
        const u = layer(state.sel);
        ["x", "y", "scale", "origin", "depth", "thickness", "light"].forEach(k => delete u[k]);
        save(); renderRight(); rebuildStage(); return;
      }
    });

    // genel ayarlar (sol panel)
    leftEl.addEventListener("input", (e) => {
      const k = e.target.dataset.csOpt;
      if (!k) return;
      if (e.target.type === "range") {
        cin[k] = Number(e.target.value);
        const o = leftEl.querySelector(`[data-cs-out="${k}"]`); if (o) o.textContent = r1(cin[k]) + "×";
      }
    });
    leftEl.addEventListener("change", (e) => {
      const k = e.target.dataset.csOpt;
      if (e.target.matches("[data-cs-skin]")) { cin.skin = e.target.value; save(); rebuildStage(); return; }
      if (!k) return;
      if (e.target.type === "checkbox") cin[k] = e.target.checked;
      else if (e.target.type === "range") cin[k] = Number(e.target.value);
      else cin[k] = e.target.value;
      save(); renderSub();
      if (k === "depth" || k === "cardMode" || k === "cardTitle" || k === "cardSubtitle" || k === "lite") rebuildStage();
    });

    // katman ayarları (sağ panel)
    function readOrigin() {
      const ox = Number(rightEl.querySelector('[data-cs-l="ox"]').value), oy = Number(rightEl.querySelector('[data-cs-l="oy"]').value);
      return `${clamp(isFinite(ox) ? ox : 50, -50, 150)}% ${clamp(isFinite(oy) ? oy : 50, -50, 150)}%`;
    }
    rightEl.addEventListener("input", (e) => {
      const k = e.target.dataset.csL;
      if (!k || k === "hidden") return;
      const v = Number(e.target.value);
      const out = rightEl.querySelector(`[data-cs-lout="${k}"]`);
      if (k === "x" || k === "y") { if (isFinite(v)) setLayerLive(state.sel, { [k]: v }); }
      else if (k === "scale") { setLayerLive(state.sel, { scale: v }); }
      else if (k === "ox" || k === "oy") setLayerLive(state.sel, { origin: readOrigin() });
      else if (k === "depth") { setLayerLive(state.sel, { depth: v }); if (out) out.textContent = v; }
      else if (k === "thickness") { if (out) out.textContent = v; }
      else if (k === "light") { if (out) out.textContent = Math.round(v * 100) + "%"; }
    });
    rightEl.addEventListener("change", (e) => {
      const k = e.target.dataset.csL;
      if (!k) return;
      const u = layer(state.sel);
      if (k === "hidden") { u.hidden = e.target.checked; save(); renderLeft(); rebuildStage(); return; }
      if (k === "thickness" || k === "light") { u[k] = Number(e.target.value); save(); rebuildStage(); return; }
      save();
    });

    /* ---------- önizleme ---------- */
    let prev = null;
    function togglePreview() {
      const btn = $("[data-cs-play]");
      if (state.previewing) { if (prev) prev.finish(true); return; }
      state.previewing = true;
      btn.textContent = "■ Durdur";
      if (hEls) { hEls.box.remove(); hEls = null; }
      if (state.handle) { state.handle.destroy(); state.handle = null; }
      stageEl.innerHTML = "";
      $("[data-cs-tip]").textContent = "Önizleme · sahneye dokunarak başlatın";
      if (C.Sound) C.Sound.unlock();
      prev = C.play(doc, () => {
        setTimeout(() => {
          state.previewing = false; prev = null;
          btn.textContent = "▶ Önizle";
          if (document.body.contains(root)) rebuildStage();
        }, 1100);
      }, { container: stageEl });
    }

    function close() {
      if (state.previewing && prev) { prev.stop(); }
      buildToken++;
      if (state.handle) state.handle.destroy();
      C.stop();
      document.removeEventListener("keydown", onKey);
      global.removeEventListener("resize", onResize);
      root.remove();
      document.body.classList.remove("cs-open");
      if (cb.onClose) cb.onClose();
    }

    if (!slotOf(state.sel)) state.sel = model().slots[0].id;
    renderSub(); renderLeft(); renderRight();
    requestAnimationFrame(() => rebuildStage());
    return { close, root, state, _process: processLayerFile };
  }

  global.SeozCinemaStudio = { open, processLayerFile, CATALOG };
})(window);
