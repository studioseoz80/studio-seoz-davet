/* =============================================================================
   DİLEK AĞACI · KENDİ AĞAÇ GÖRSELİ EDİTÖRÜ (yalnızca editör)
   - Şeffaf PNG/WebP ağaç görseli yüklenir; ORANI KORUNUR, yalnızca boyut ve konum ayarlanır.
   - Notların asılacağı noktalar sahneye dokunarak eklenir, sürüklenerek taşınır; istenirse
     "Dallara otomatik yerleştir" görseldeki dalların alt kenarlarını bulup noktaları dağıtır.
   - Çakışan / sahneden taşan noktalar kırmızı gösterilir; misafir sayfasında zaten atlanır
     (SeozWishTree.cleanSpots) → notlar hiçbir ekranda üst üste binmez.
   - Görsel değiştirilince noktalar ve dilekler SİLİNMEZ (dilekler sunucuda sıra numarasıyla durur).
   Veri: settings.treeImg [{ref, naturalWidth, naturalHeight}], settings.treeFit {s, x, y},
         settings.treeSpots [{x, y, r}] (400×500 sahne birimi; r = kurdele boyu)
   ============================================================================= */
(function (global) {
  "use strict";
  const esc = v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function open(layer, h) {
    h = h || {};
    const T = global.SeozWishTree; if (!T) return;
    const s = layer.settings, RT = T.RT;
    s.treeFit = Object.assign({ s: 100, x: 0, y: 0 }, s.treeFit || {});
    if (!Array.isArray(s.treeSpots)) s.treeSpots = [];
    const st = { sel: -1, follow: true, msg: "" };
    const root = document.createElement("div");
    root.className = "is-root wt-root"; root.setAttribute("role", "dialog"); root.setAttribute("aria-label", "Ağaç görseli ve not noktaları");
    root.innerHTML = `
      <header class="is-head"><div><strong>🌳 Dilek Ağacı · Kendi ağaç görseliniz</strong><small>Görsel, boyut ve konum · notların asılacağı noktalar</small></div>
        <button type="button" class="btn btn-gold" data-wt-close>Bitti</button></header>
      <div class="is-body"><aside class="is-panel" data-wt-panel></aside>
        <main class="is-stage"><div class="is-bar"><span class="is-status" data-wt-status></span></div>
          <div class="is-frame wt-frame" data-wt-frame><div class="wt-stage" data-wt-stage></div></div>
          <p class="is-hint">Bir dala dokunun: kurdele oraya bağlanır, not aşağı sarkar. Noktayı sürükleyerek taşıyın; seçiliyken ok tuşları ince ayar yapar, Delete siler. <b style="color:#B23A3A">Kırmızı</b> not başka bir notla çakışıyor ya da alanın dışına taşıyor: misafir sayfasında gösterilmez.</p>
        </main></div>
      <input type="file" accept="image/png,image/webp" class="hidden" data-wt-file>`;
    document.body.appendChild(root);
    const $ = q => root.querySelector(q);
    const panel = $("[data-wt-panel]"), frame = $("[data-wt-frame]"), stage = $("[data-wt-stage]"), fileIn = $("[data-wt-file]");
    let saveT = 0, scale = 1, imgUrl = "";
    const changed = () => { clearTimeout(saveT); saveT = setTimeout(() => { if (h.onChange) h.onChange(); }, 180); };

    /* ---------------- panel ---------------- */
    function renderPanel() {
      const im = (s.treeImg || [])[0], f = s.treeFit, n = s.treeSpots.length, bad = T.cleanSpots(s.treeSpots).skip.length, sp = s.treeSpots[st.sel];
      panel.innerHTML = `
        <section class="is-sec"><h4>Ağaç görseli</h4>
          <div class="is-part-h"><div class="is-thumb">${im ? `<img data-wt-thumb alt="">` : "🌳"}</div>
            <div class="is-part-t"><b>${im ? "Yüklendi" : "Henüz görsel yok"}</b><small>Şeffaf PNG veya WebP. Görselin oranı ve dokusu korunur.</small></div></div>
          <div class="is-part-b"><button type="button" class="btn btn-gold" data-wt-upload>${im ? "Görseli değiştir" : "+ Ağaç görseli yükle"}</button></div>
          ${im && n ? `<p class="is-note">Görseli değiştirirseniz dilekler silinmez; noktaları yeni ağaca göre taşıyın ya da otomatik yerleştirin.</p>` : ""}
        </section>
        <section class="is-sec"><h4>Boyut ve konum</h4>
          ${[["s", "Boyut", 40, 200, "%"], ["x", "Yatay", -200, 200, ""], ["y", "Dikey", -250, 250, ""]].map(([k, l, a, b, u]) =>
            `<label class="is-row"><span>${l}</span><input type="range" min="${a}" max="${b}" step="1" value="${Math.round(f[k])}" data-wt-fit="${k}" ${im ? "" : "disabled"}><output>${Math.round(f[k])}${u}</output></label>`).join("")}
          <label class="is-check"><input type="checkbox" data-wt-follow ${st.follow ? "checked" : ""}> Noktalar görselle birlikte taşınsın</label>
          <button type="button" class="btn btn-outline" data-wt-center ${im ? "" : "disabled"}>Ortala ve sıfırla</button>
        </section>
        <section class="is-sec"><h4>Not noktaları</h4>
          <p class="is-note"><b data-wt-count>${n}</b> nokta (en fazla ${T.TREE_MAX_SPOTS}).${bad ? ` <b style="color:#B23A3A">${bad} nokta çakışıyor</b> — misafirde gösterilmez.` : ""} Noktalardan fazla dilek gelirse son not “+N” olur ve dokununca tüm dilekler listelenir.</p>
          <div class="is-chips">
            <button type="button" class="btn btn-gold" data-wt-auto ${im ? "" : "disabled"}>🪄 Dallara otomatik yerleştir</button>
            <button type="button" class="btn btn-outline" data-wt-undo ${n ? "" : "disabled"}>↶ Son noktayı geri al</button>
            <button type="button" class="btn btn-outline" data-wt-clear ${n ? "" : "disabled"}>Tümünü sil</button>
          </div>
          ${sp ? `<div class="is-part is-on"><b>Seçili nokta</b>
            <label class="is-row"><span>Kurdele boyu</span><input type="range" min="8" max="50" step="1" value="${Math.round(sp.r || 16)}" data-wt-rib><output>${Math.round(sp.r || 16)}</output></label>
            <button type="button" class="btn btn-outline" data-wt-del>Noktayı sil</button></div>` : ""}
          ${st.msg ? `<p class="is-note wt-msg">${esc(st.msg)}</p>` : ""}
        </section>`;
      const th = panel.querySelector("[data-wt-thumb]"); if (th && imgUrl) th.src = imgUrl;
    }

    /* ---------------- sahne ---------------- */
    function fitStage() {
      const fw = Math.max(200, frame.clientWidth - 30), fh = Math.max(200, frame.clientHeight - 30);
      scale = Math.min(fw / RT.W, fh / RT.H);
      Object.assign(stage.style, { width: RT.W + "px", height: RT.H + "px", transform: `scale(${scale})` });
    }
    function draw() {
      const R = T.treeImgRect(s), c = T.cleanSpots(s.treeSpots), bad = new Set(c.skip);
      let html = R && imgUrl ? `<img class="wt-tree" src="${esc(imgUrl)}" alt="" draggable="false" style="left:${R.x}px;top:${R.y}px;width:${R.w}px;height:${R.h}px">` : (R ? "" : `<div class="wt-empty">Önce soldan bir ağaç görseli yükleyin</div>`);
      s.treeSpots.forEach((q, i) => {
        const p = { x: q.x, ay: q.y, rib: q.r || 16 }, b = T.noteBox(p);
        html += `<div class="wt-spot${bad.has(i) ? " is-bad" : ""}${i === st.sel ? " is-sel" : ""}" data-i="${i}">
          <i class="wt-rib" style="left:${q.x - 1}px;top:${q.y}px;height:${b.t - q.y + 4}px"></i>
          <i class="wt-paper" style="left:${b.l}px;top:${b.t}px;width:${b.r - b.l}px;height:${b.b - b.t}px"><em>${i + 1}</em></i>
          <b class="wt-dot" data-i="${i}" style="left:${q.x}px;top:${q.y}px" title="Sürükleyin"></b></div>`;
      });
      stage.innerHTML = html;
      $("[data-wt-status]").textContent = R ? `${s.treeSpots.length} nokta · ${c.spots.length} not misafirde görünür` : "Ağaç görseli bekleniyor";
    }
    function refresh() { renderPanel(); draw(); }
    function resolveImg() {
      const im = (s.treeImg || [])[0];
      if (!im) { imgUrl = ""; return refresh(); }
      const done = u => { imgUrl = u || ""; refresh(); };
      if (/^idb:/.test(im.ref) && global.SeozBlobStore) SeozBlobStore.resolveToObjectURL(im.ref).then(done); else done(im.ref);
    }
    const ptOf = e => { const r = stage.getBoundingClientRect(); return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale }; };
    function okAt(i, q) {   // q noktası, diğer GEÇERLİ noktalarla çakışmadan sığıyor mu?
      const good = T.cleanSpots(s.treeSpots.filter((o, k) => k !== i)).spots.map(p => ({ x: p.x, y: p.ay, r: p.rib }));
      return T.cleanSpots(good.concat([q])).skip.length === 0;
    }

    /* ---------------- otomatik yerleştirme: dalların alt kenarı ---------------- */
    function autoPlace() {
      const R = T.treeImgRect(s); if (!R || !imgUrl) return;
      const im = new Image();
      im.onload = () => {
        const cv = document.createElement("canvas"); cv.width = RT.W; cv.height = RT.H;
        const g = cv.getContext("2d"); g.drawImage(im, R.x, R.y, R.w, R.h);
        let A; try { A = g.getImageData(0, 0, RT.W, RT.H).data; } catch (e) { st.msg = "Görsel okunamadı; noktaları elle ekleyin."; return refresh(); }
        const a = (x, y) => (x < 0 || y < 0 || x >= RT.W || y >= RT.H) ? 0 : A[(y * RT.W + x) * 4 + 3];
        const cand = [];
        for (let y = 12; y < RT.H - 70; y += 2) for (let x = 24; x < RT.W - 24; x += 2) {
          if (a(x, y) > 90 && a(x, y + 3) < 25 && a(x, y + 5) < 25) cand.push({ x, y });   // dalın alt kenarı: üstü dolu, altı boş
        }
        if (cand.length < 3) { st.msg = "Görselde dal bulunamadı; noktaları dallara dokunarak elle ekleyin."; return refresh(); }
        const pick = [], rib = i => 14 + (i * 7 % 4) * 3;
        // en uzak nokta seçimi: her adımda seçilenlere en uzak GEÇERLİ adayı al → notlar ağaca dengeli dağılır
        const cx = R.x + R.w / 2;
        let first = cand.reduce((b, p) => (Math.abs(p.x - cx) + p.y * 0.2 < Math.abs(b.x - cx) + b.y * 0.2 ? p : b), cand[0]);
        const boxes = [];
        const valid = (p, r) => {
          const b = T.noteBox({ x: p.x, ay: p.y, rib: r });
          if (b.l < 0 || b.r > RT.W || b.b > RT.H) return false;
          for (const o of boxes) if (T.boxHit(o, b, T.NOTE_GAP + 1)) return false;
          return true;
        };
        const add = (p, r) => { pick.push({ x: p.x, y: p.y, r }); boxes.push(T.noteBox({ x: p.x, ay: p.y, rib: r })); };
        if (valid(first, rib(0))) add(first, rib(0));
        while (pick.length < T.TREE_MAX_SPOTS) {
          let best = null, bd = -1; const r = rib(pick.length);
          for (const p of cand) {
            let d = 1e9; for (const q of pick) { const dx = p.x - q.x, dy = (p.y - q.y) * 1.3; d = Math.min(d, dx * dx + dy * dy); }
            if (d > bd && valid(p, r)) { bd = d; best = p; }
          }
          if (!best || bd < 400) break;
          add(best, r);
        }
        pick.sort((p, q) => p.y - q.y || p.x - q.x);
        s.treeSpots = pick; st.sel = -1;
        st.msg = `${pick.length} nokta dalların üzerine yerleştirildi. İsterseniz sürükleyerek düzeltin.`;
        changed(); refresh();
      };
      im.onerror = () => { st.msg = "Görsel okunamadı; noktaları elle ekleyin."; refresh(); };
      im.src = imgUrl;
    }

    /* ---------------- olaylar ---------------- */
    let drag = null;
    stage.addEventListener("pointerdown", e => {
      if (!T.treeImgRect(s)) return;
      const dot = e.target.closest(".wt-dot, .wt-paper"), p = ptOf(e);
      if (dot) {
        const i = Number((dot.closest("[data-i]") || dot).dataset.i);
        st.sel = i; drag = { i, dx: s.treeSpots[i].x - p.x, dy: s.treeSpots[i].y - p.y, moved: false };
        stage.setPointerCapture(e.pointerId); refresh(); e.preventDefault(); return;
      }
      if (s.treeSpots.length >= T.TREE_MAX_SPOTS) { st.msg = `En fazla ${T.TREE_MAX_SPOTS} nokta eklenebilir.`; return refresh(); }
      const q = { x: Math.round(p.x), y: Math.round(p.y), r: 16 };
      if (!okAt(s.treeSpots.length, q)) { st.msg = "Bu noktada not başka bir notla çakışır ya da alanın dışına taşar. Biraz daha uzağa dokunun."; return refresh(); }
      s.treeSpots.push(q); st.sel = s.treeSpots.length - 1; st.msg = ""; changed(); refresh();
    });
    stage.addEventListener("pointermove", e => {
      if (!drag) return; const p = ptOf(e), q = s.treeSpots[drag.i];
      q.x = Math.round(clamp(p.x + drag.dx, 0, RT.W)); q.y = Math.round(clamp(p.y + drag.dy, 0, RT.H)); drag.moved = true; draw();
    });
    const endDrag = () => { if (!drag) return; if (drag.moved) changed(); drag = null; renderPanel(); };
    stage.addEventListener("pointerup", endDrag); stage.addEventListener("pointercancel", endDrag);
    panel.addEventListener("input", e => {
      const t = e.target;
      if (t.matches("[data-wt-fit]")) {
        const R0 = T.treeImgRect(s); s.treeFit[t.dataset.wtFit] = Number(t.value); const R1 = T.treeImgRect(s);
        if (st.follow && R0 && R1) s.treeSpots.forEach(q => { q.x = Math.round(R1.x + (q.x - R0.x) * R1.w / R0.w); q.y = Math.round(R1.y + (q.y - R0.y) * R1.h / R0.h); });
        t.nextElementSibling.textContent = t.value + (t.dataset.wtFit === "s" ? "%" : ""); changed(); draw();
      } else if (t.matches("[data-wt-rib]") && s.treeSpots[st.sel]) { s.treeSpots[st.sel].r = Number(t.value); t.nextElementSibling.textContent = t.value; changed(); draw(); }
      else if (t.matches("[data-wt-follow]")) st.follow = t.checked;
    });
    panel.addEventListener("change", e => { if (e.target.matches("[data-wt-fit], [data-wt-rib]")) renderPanel(); });
    panel.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.matches("[data-wt-upload]")) fileIn.click();
      else if (b.matches("[data-wt-center]")) {
        const R0 = T.treeImgRect(s); s.treeFit = { s: 100, x: 0, y: 0 }; const R1 = T.treeImgRect(s);
        if (st.follow && R0 && R1) s.treeSpots.forEach(q => { q.x = Math.round(R1.x + (q.x - R0.x) * R1.w / R0.w); q.y = Math.round(R1.y + (q.y - R0.y) * R1.h / R0.h); });
        changed(); refresh();
      } else if (b.matches("[data-wt-auto]")) autoPlace();
      else if (b.matches("[data-wt-undo]")) { s.treeSpots.pop(); st.sel = -1; changed(); refresh(); }
      else if (b.matches("[data-wt-clear]")) { if (confirm("Bütün not noktaları silinsin mi? (Dilekler silinmez.)")) { s.treeSpots = []; st.sel = -1; changed(); refresh(); } }
      else if (b.matches("[data-wt-del]")) { s.treeSpots.splice(st.sel, 1); st.sel = -1; changed(); refresh(); }
    });
    fileIn.addEventListener("change", () => {
      const file = fileIn.files && fileIn.files[0]; fileIn.value = ""; if (!file) return;
      if (!/^image\/(png|webp)$/.test(file.type)) { st.msg = "Lütfen şeffaf PNG veya WebP yükleyin."; return refresh(); }
      SeozImageUtils.processImageFile(file, { keepAlpha: true }).then(r => {
        const had = !!(s.treeImg && s.treeImg[0]);
        s.treeImg = [{ ref: r.ref, naturalWidth: r.naturalWidth, naturalHeight: r.naturalHeight }];
        st.msg = had ? "Görsel değiştirildi. Dilekler duruyor; noktaları yeni ağaca göre düzenleyin ya da otomatik yerleştirin." : (s.treeSpots.length ? "" : "Şimdi dallara dokunarak not noktalarını ekleyin ya da “Dallara otomatik yerleştir”i kullanın.");
        changed(); resolveImg();
      }).catch(() => { st.msg = "Görsel yüklenemedi. Lütfen PNG veya WebP deneyin."; refresh(); });
    });
    const onKey = e => {
      if (e.key === "Escape") return close();
      const q = s.treeSpots[st.sel]; if (!q || /input|select|textarea/i.test((e.target.tagName || ""))) return;
      const d = e.shiftKey ? 5 : 1;
      if (e.key === "Delete" || e.key === "Backspace") { s.treeSpots.splice(st.sel, 1); st.sel = -1; }
      else if (e.key === "ArrowLeft") q.x -= d; else if (e.key === "ArrowRight") q.x += d; else if (e.key === "ArrowUp") q.y -= d; else if (e.key === "ArrowDown") q.y += d;
      else return;
      e.preventDefault(); changed(); refresh();
    };
    document.addEventListener("keydown", onKey);
    const ro = global.ResizeObserver ? new ResizeObserver(fitStage) : null; if (ro) ro.observe(frame);
    function close() {
      clearTimeout(saveT); if (h.onChange) h.onChange();
      document.removeEventListener("keydown", onKey); if (ro) ro.disconnect(); root.remove();
      if (h.rerender) h.rerender();
    }
    $("[data-wt-close]").addEventListener("click", close);
    fitStage(); resolveImg();
  }
  global.SeozWishTreeEditor = { open };
})(window);
