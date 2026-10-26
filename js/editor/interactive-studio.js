/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — interactive-studio.js  (E1 + E2 · Etkileşim Stüdyosu, yalnızca editör)
   -----------------------------------------------------------------------------
   On etkileşimin tamamı kendi görselleriyle bu tam ekran stüdyoda düzenlenir:
     - her türün kendi parçaları (PNG/JPG/WebP, şeffaf PNG korunur)
     - önizlemede sürükleyerek taşıma, köşeden büyütme, üst tutamaçtan döndürme; kaydırıcılar; ok tuşları
     - türe özel hareket ayarları (süre, hız, yön, tetikleme…)
     - ayrı "Sürpriz sonucu": mesaj, sürpriz fotoğrafı, bağlantı, efekt, yalnızca animasyon
     - canlı önizleme: ▶ Oynat (müşteri sayfasındaki kodun kendisi), ↺ Baştan başlat
   Ayarlar layer.settings içine yazılır (parts, motion[tür] — Kurdele için cut —, resultImage).
   Türün ana parçası yüklenmemişse etkileşim eskisi gibi hazır çizimle çalışır.
   ========================================================================= */
(function (global) {
  "use strict";
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (v, d) => { v = Number(v); return isFinite(v) ? v : d; };
  const fmt = (v, u) => (u === "%" ? "%" + v : v + (u || ""));
  const f = (k, t, l, x) => Object.assign({ k, t, l }, x || {});
  const SPEEDS = [[0.5, "0,5× (yavaş)"], [0.75, "0,75×"], [1, "1×"], [1.5, "1,5×"], [2, "2× (hızlı)"]];
  const SPD = f("speed", "sel", "Hız", { o: SPEEDS, n: 1 });
  const DUR = (min, max, l) => f("dur", "num", l || "Süre (sn)", { min, max, step: 0.1 });
  const TRIG = [["dokun", "Dokununca"], ["kaydir", "Yukarı kaydırınca"]];
  const RESULTS = [["mesaj", "Mesaj"], ["gorsel", "Sürpriz fotoğrafı"], ["baglanti", "Bağlantı düğmesi"], ["efekt", "Konfeti / efekt"], ["anim", "Yalnızca animasyon"]];
  const EFFECTS = [["konfeti", "Konfeti"], ["kalp", "Kalpler"], ["yildiz", "Yıldızlar"], ["simli", "Simli parıltı"], ["yok", "Yok"]];
  const BACK = ["back", "Arka görsel", "İsteğe bağlı. Tüm alanı kaplayan zemin.", false];
  // [anahtar, ad, açıklama, konumlanabilir, (gösterilme koşulu)]
  const KCFG = {
    kurdele: { icon: "🎀", name: "Kurdele kes", store: "cut", what: "Kurdele kesilince", motionTitle: "Kesim ve hareket",
      parts: [["ribbon", "Kurdele", "Yatay, tek parça kurdele. Kesilince kesim noktasından ikiye ayrılır.", true], ["bow", "Fiyonk", "İsteğe bağlı. Ayrı PNG olursa kesilince düşer.", true],
        ["scissor", "Makas", "İsteğe bağlı. Boşsa hazır metal makas kullanılır; kesim noktasına kendiliğinden gelir.", false], ["back", "Arka görsel", "Kurdelenin altındaki zemin (kutu, kart, fotoğraf).", false]],
      motion: [f("at", "range", "Kesim noktası", { min: 10, max: 90, step: 1, u: "%" }), f("shape", "sel", "Kesim şekli", { o: [["v", "V kesim (kurdele ucu)"], ["duz", "Düz"], ["zikzak", "Zikzak"]] }),
        f("fall", "sel", "Kesilince", { o: [["sark", "İki yana sarksın"], ["dus", "Düşüp kaybolsun"]] }), f("trigger", "sel", "Tetikleme", { o: [["dokun", "Dokununca"], ["kaydir", "Parmakla kaydırınca"]] }),
        DUR(0.3, 8), SPD, f("scissor", "chk", "Makas görünsün")] },
    "kazi-kazan": { icon: "🪙", name: "Kazı-kazan", what: "Kazınınca",
      parts: [["cover", "Kazıma yüzeyi", "Kazınacak kaplama (gümüş, altın, desenli…). Şeffaf PNG'nin şekli korunur; sürpriz bu şeklin içinde durur.", true],
        ["frame", "Çerçeve", "İsteğe bağlı. Kazıma alanının üstünde durur, kazınmaz.", true], ["coin", "Kazıma parası", "İsteğe bağlı. Boşsa hazır altın para; kazırken parmağı izler.", false], BACK],
      motion: [f("trigger", "sel", "Tetikleme", { o: [["kazi", "Parmakla kazıyınca"], ["dokun", "Dokununca kendiliğinden"]] }), f("brush", "range", "Fırça kalınlığı", { min: 12, max: 80, step: 1, u: "px" }),
        f("open", "range", "Açılma oranı", { min: 20, max: 90, step: 1, u: "%" }), f("finish", "sel", "Sonra", { o: [["sol", "Kalan kaplama solsun"], ["dagil", "Kalan kaplama dağılsın"]] }),
        DUR(0.6, 8, "Kendiliğinden kazıma (sn)"), SPD, f("dust", "chk", "Kazıma tozu"), f("coin", "chk", "Kazıma parası görünsün")] },
    zarf: { icon: "✉️", name: "Zarfı aç", what: "Zarf açılınca",
      parts: [["body", "Zarf gövdesi (ön cep)", "Zarfın ön yüzü; mektup bunun arkasında durur.", true], ["flap", "Kapak", "Üçgen kapak. Üst kenarından menteşelenip açılır.", true],
        ["flapIn", "Kapağın iç yüzü", "İsteğe bağlı. Açılınca görünen iç yüz; boşsa kapak görseli gölgede kalmış hâliyle kullanılır.", false],
        ["seal", "Mühür", "İsteğe bağlı. Açılırken kırılır ya da düşer.", true], ["letter", "Mektup kâğıdı", "İsteğe bağlı. Boşsa krem kâğıt; sürpriz mesaj bunun üstünde yazar.", true],
        ["inner", "Zarfın içi", "İsteğe bağlı. Mektubun arkasında görünen iç yüz.", true], BACK],
      motion: [f("trigger", "sel", "Tetikleme", { o: TRIG }), f("seal", "sel", "Mühür", { o: [["kir", "Kırılsın"], ["kalk", "Kalkıp düşsün"], ["sol", "Solsun"]] }),
        f("out", "sel", "Mektup", { o: [["one", "Çıkıp öne gelsin"], ["cik", "Yukarı çıkıp kalsın"]] }), f("rise", "range", "Çıkış yüksekliği", { min: 30, max: 110, step: 1, u: "%" }), DUR(0.6, 8), SPD] },
    balon: { icon: "🎈", name: "Balon patlat", what: "Balonlar patlayınca", items: "balon",
      parts: [["balloon", "Balon", "Tek balon görseli (ipi dahil olabilir). Tüm balonlar bundan çizilir.", false], ["balloon2", "2. balon görseli", "İsteğe bağlı; balonlar sırayla farklı görsel kullanır.", false],
        ["balloon3", "3. balon görseli", "İsteğe bağlı.", false], BACK],
      motion: [f("pop", "sel", "Dokununca", { o: [["patla", "Parçalara ayrılarak patlasın"], ["uc", "Uçup gitsin"]] }), f("need", "sel", "Sürpriz", { o: [["hepsi", "Hepsi patlayınca"], ["bir", "İlk balonda"]] }),
        f("sway", "range", "Süzülme", { min: 0, max: 2, step: 0.1 }), DUR(0.3, 3, "Patlama süresi (sn)"), SPD, f("tint", "chk", "Tek görselde renkleri çeşitle"), f("sound", "chk", "Patlama sesi")] },
    hediye: { icon: "🎁", name: "Hediye kutusu", what: "Kutu açılınca",
      parts: [["box", "Kutu", "Kutunun gövdesi.", true], ["lid", "Kapak", "Önerilir: ayrı kapak kalkar. Yoksa kutu bütün hâlde ışıkla açılır.", true], ["bow", "Fiyonk", "İsteğe bağlı. Kapakla birlikte uçar.", true], BACK],
      motion: [f("trigger", "sel", "Tetikleme", { o: TRIG }), f("open", "sel", "Kapak", { o: [["kalk", "Kalkıp yana devrilsin"], ["uc", "Havaya uçsun"]] }), f("side", "sel", "Yön", { o: [["sag", "Sağa"], ["sol", "Sola"]] }),
        f("boxEnd", "sel", "Kutu", { o: [["kalsin", "Yerinde kalsın"], ["kaybol", "Kaybolsun"]] }), DUR(0.6, 6), SPD, f("shake", "chk", "Beklerken kıpırdasın"), f("glow", "chk", "İçinden ışık")] },
    konfeti: { icon: "🎉", name: "Konfeti", what: "Düğmeye basınca",
      parts: [["button", "Düğme / konfeti patlatıcı", "Basılınca esneyen düğme ya da patlatıcı görseli.", true], ["piece", "Konfeti parçası", "İsteğe bağlı. Boşsa efekt seçimine göre kâğıt konfeti, kalp, yıldız ya da sim.", false],
        ["piece2", "2. konfeti parçası", "İsteğe bağlı.", false], ["piece3", "3. konfeti parçası", "İsteğe bağlı.", false], BACK],
      motion: [f("shot", "sel", "Konfeti", { o: [["patla", "Düğmeden fışkırsın"], ["yagmur", "Yukarıdan yağsın"], ["top", "İki yandan patlasın"]] }),
        f("amount", "sel", "Miktar", { o: [[0.5, "Az"], [1, "Orta"], [2, "Çok"]], n: 1 }), f("spread", "range", "Açı genişliği", { min: 20, max: 160, step: 1, u: "°" }),
        f("dir", "range", "Yön", { min: -60, max: 60, step: 1, u: "°" }), DUR(1, 6, "Uçuş süresi (sn)"), SPD] },
    "foto-cevir": { icon: "🔄", name: "Fotoğraf çevir", what: "Kart çevrilince",
      parts: [["front", "Ön yüz", "Fotoğraf ya da kart. Çevrilince arka yüz görünür.", true], ["rear", "Arka yüz", "İsteğe bağlı. Boşsa ön yüzün şeklinde krem kâğıt; sürpriz bunun üstünde.", false], BACK],
      motion: [f("trigger", "sel", "Tetikleme", { o: [["dokun", "Dokununca"], ["kaydir", "Parmakla kaydırınca"]] }), f("axis", "sel", "Dönüş", { o: [["y", "Yatay (sağa-sola)"], ["x", "Dikey (yukarı-aşağı)"]] }),
        f("dir", "sel", "Yön", { o: [[1, "İleri"], [-1, "Geri"]], n: 1 }), DUR(0.3, 4), SPD, f("lift", "chk", "Çevirirken havaya kalksın"), f("again", "chk", "Tekrar çevrilebilsin")] },
    dilek: { icon: "🏮", name: "Dilek feneri", what: "Fener bırakılınca",
      parts: [["lantern", "Fener", "Dilek feneri görseli. Işığı kendiliğinden titrer.", true], ["back", "Gökyüzü / arka görsel", "İsteğe bağlı. Tüm alanı kaplar.", false]],
      motion: [f("trigger", "sel", "Tetikleme", { o: [["dugme", "Düğmeyle"], ["dokun", "Fenere dokununca"], ["kaydir", "Yukarı kaydırınca"]] }),
        f("btnText", "txt", "Düğme yazısı", { showIf: M => M.trigger === "dugme" }), f("path", "sel", "Yükseliş", { o: [["salin", "Salınarak"], ["duz", "Dümdüz"], ["ruzgar", "Rüzgârla sürüklenerek"]] }),
        f("wind", "range", "Rüzgâr yönü", { min: -100, max: 100, step: 1 }), f("height", "range", "Yükseklik", { min: 60, max: 300, step: 5, u: "%" }), f("count", "range", "Fener sayısı", { min: 1, max: 5, step: 1 }),
        DUR(2, 15), SPD, f("glow", "chk", "Işık titreşsin"), f("again", "chk", "Ardından yeni fener gelsin")] },
    mum: { icon: "🕯️", name: "Mum söndür", what: "Mumlar sönünce", items: "mum",
      parts: [["cake", "Pasta / mumlar", "Mumlu pasta ya da mum görseli. Alevler ayrıca yerleştirilir.", true], ["flame", "Alev", "İsteğe bağlı. Boşsa gerçekçi hazır alev.", false], BACK],
      motion: [f("trigger", "sel", "Tetikleme", { o: [["basili", "Basılı tutunca"], ["kaydir", "Parmakla üfleyince (kaydır)"], ["dokun", "Dokununca"]] }),
        f("hold", "num", "Basılı tutma (sn)", { min: 0.5, max: 5, step: 0.1, showIf: M => M.trigger === "basili" }), f("order", "sel", "Sönme", { o: [["sirayla", "Sırayla"], ["birlikte", "Hepsi birlikte"]] }),
        DUR(0.6, 5, "Duman süresi (sn)"), SPD, f("smoke", "chk", "Duman")] },
    "kapi-cal": { icon: "🚪", name: "Kapı çal", what: "Kapı açılınca",
      parts: [["left", "Kapı / sol kanat", "Çift kanatta tek görsel yüklerseniz ortadan ikiye bölünür.", true], ["right", "Sağ kanat", "İsteğe bağlı: ayrı sağ kanat görseli.", true, M => M.mode !== "tek"],
        ["knocker", "Tokmak", "İsteğe bağlı. Her vuruşta sallanır; kapı açılınca kanatla birlikte döner.", true], ["frame", "Kapı kasası", "İsteğe bağlı; kanatların üstünde durur.", true],
        ["back", "İçerisi", "Kapı açılınca görünen iç mekân.", false]],
      motion: [f("mode", "sel", "Kapı", { o: [["cift", "Çift kanat"], ["tek", "Tek kanat"]] }), f("hinge", "sel", "Menteşe", { o: [["sol", "Solda"], ["sag", "Sağda"]], showIf: M => M.mode === "tek" }),
        f("knocks", "range", "Vuruş sayısı", { min: 1, max: 5, step: 1 }), f("dir", "sel", "Açılış", { o: [["iceri", "İçeri açılsın"], ["disari", "Dışarı açılsın"]] }),
        f("angle", "range", "Açılma açısı", { min: 30, max: 88, step: 1, u: "°" }), DUR(0.5, 6), SPD, f("light", "chk", "İçeriden ışık"), f("sound", "chk", "Vuruş sesi")] }
  };
  const RANGES = { x: ["Yatay", -20, 120, 0.5, "%"], y: ["Dikey", -20, 120, 0.5, "%"], w: ["Genişlik", 2, 220, 0.5, "%"], rot: ["Döndür", -180, 180, 1, "°"] };

  function open(layer, h) {
    h = h || {};
    const I = global.SeozInteractive, s = layer.settings;
    const kind = KCFG[s.kind] ? s.kind : "kazi-kazan", cfg = KCFG[kind], main = I.MAIN_PART[kind];
    s.parts = s.parts || {};
    let M;
    if (cfg.store === "cut") { s.cut = Object.assign({}, I.CUT_DEFAULTS, s.cut || {}); M = s.cut; }
    else { s.motion = Object.assign({}, s.motion || {}); s.motion[kind] = Object.assign({}, I.MOTION_DEFAULTS[kind], s.motion[kind] || {}); M = s.motion[kind]; }
    if (kind === "mum" && !(Array.isArray(M.flames) && M.flames.length)) M.flames = I.FLAME_DEFAULTS.map(p => Object.assign({}, p));
    const posKeys = cfg.parts.filter(p => p[3]).map(p => p[0]);
    const hasMain = () => !!(s.parts[main] && s.parts[main].ref);
    const state = { sel: hasMain() ? (posKeys.indexOf(main) >= 0 ? main : kind === "balon" ? "b0" : null) : null, mode: "edit" };
    const root = document.createElement("div");
    root.className = "is-root"; root.setAttribute("role", "dialog"); root.setAttribute("aria-label", "Etkileşim Stüdyosu");
    root.dataset.kind = kind;
    root.innerHTML = `
      <header class="is-head"><div><strong>${cfg.icon} Etkileşim Stüdyosu</strong><small>${esc(cfg.name)} · kendi görselleriniz</small></div>
        <button type="button" class="btn btn-gold" data-is-close>Bitti</button></header>
      <div class="is-body"><aside class="is-panel" data-is-panel></aside>
        <main class="is-stage"><div class="is-bar">
            <button type="button" class="btn btn-gold" data-is-play>▶ Oynat</button>
            <button type="button" class="btn btn-outline" data-is-reset>↺ Baştan başlat</button>
            <span class="is-status" data-is-status></span></div>
          <div class="is-frame" data-is-frame><div class="is-box" data-is-box></div><div class="is-ov" data-is-ov><div class="is-sel" data-is-sel hidden><i class="is-sel-r" title="Döndür"></i><i class="is-sel-k" title="Büyüt / küçült"></i></div></div></div>
          <p class="is-hint">Görsele tıklayıp sürükleyin; sağ alt köşeden büyütün, üstteki yuvarlak tutamaçtan döndürün (ok tuşları ince ayar yapar). <b>▶ Oynat</b> müşterinin göreceği hareketi oynatır; Oynat'tan sonra önizlemeye dokunarak ya da kaydırarak da deneyebilirsiniz.</p>
        </main></div>
      <input type="file" accept="image/png,image/jpeg,image/webp" class="hidden" data-is-file>`;
    document.body.appendChild(root);
    const $ = q => root.querySelector(q);
    const panel = $("[data-is-panel]"), box = $("[data-is-box]"), frame = $("[data-is-frame]"), ov = $("[data-is-ov]"), selEl = $("[data-is-sel]");
    let saveT = 0, ixRoot = null, scale = 1;
    const changed = () => { clearTimeout(saveT); saveT = setTimeout(() => { if (h.onChange) h.onChange(); }, 200); };

    /* ---------- önizleme (müşteri sayfasındaki çizimin kendisi) ---------- */
    function preview(play) {
      const W = num(layer.w, 300), H = num(layer.h, 220);
      const fw = Math.max(200, frame.clientWidth - 40), fh = Math.max(200, frame.clientHeight - 60);
      scale = Math.min(1.6, fw / W, fh / H);
      Object.assign(box.style, { width: W + "px", height: H + "px", transform: `scale(${scale})` });
      box.innerHTML = "";
      ixRoot = I.render(Object.assign({}, s), "view");
      box.appendChild(ixRoot);
      ov.hidden = state.mode !== "edit";
      $("[data-is-status]").textContent = state.mode === "edit" ? "Konumlandırma" : "Oynatma: müşterinin göreceği hâl";
      if (play && ixRoot.__ixPlay) setTimeout(() => ixRoot && ixRoot.__ixPlay && ixRoot.__ixPlay(), 60);
      requestAnimationFrame(placeSel);
    }
    const partEl = key => (ixRoot && key ? ixRoot.querySelector(`[data-ixp="${key}"]`) : null);
    function itemsArr() {
      const n = Math.max(1, Math.min(9, Number(s.count) || 5)), a = Array.isArray(M.items) ? M.items.slice() : [];
      for (let i = 0; i < n; i++) if (!a[i]) a[i] = Object.assign(I.balloonDefault(i, n), { img: i });
      return a;
    }
    function objOf(key) {
      if (!key) return null;
      let m = /^b(\d+)$/.exec(key);
      if (m && kind === "balon") { M.items = itemsArr(); return M.items[+m[1]] || null; }
      m = /^f(\d+)$/.exec(key);
      if (m && kind === "mum") return M.flames[+m[1]] || null;
      const p = s.parts[key]; return p && p.ref ? p : null;
    }
    // seçim çerçevesi ve tıklama, parçanın gerçek konum/boyut/dönüşünden hesaplanır
    function geo(key) {
      const e = partEl(key), o = objOf(key); if (!e || !o) return null;
      const br = box.getBoundingClientRect(), orr = ov.getBoundingClientRect();
      return { cx: br.left - orr.left + num(o.x, 50) / 100 * br.width, cy: br.top - orr.top + num(o.y, 50) / 100 * br.height, w: e.offsetWidth * scale, h: e.offsetHeight * scale, rot: num(o.rot, 0) };
    }
    function placeSel() {
      const g = state.mode === "edit" && geo(state.sel);
      if (!g) { selEl.hidden = true; return; }
      selEl.hidden = false; selEl.classList.toggle("no-rot", /^f\d+$/.test(state.sel));
      Object.assign(selEl.style, { left: (g.cx - g.w / 2) + "px", top: (g.cy - g.h / 2) + "px", width: g.w + "px", height: g.h + "px", transform: `rotate(${g.rot}deg)` });
    }
    function livePlace(key) { const e = partEl(key), o = objOf(key); if (e && o) I.placePart(e, Object.assign({}, o, { nw: 0, nh: 0 })); placeSel(); }
    function hitAt(x, y) {
      const keys = [...ixRoot.querySelectorAll("[data-ixp]")].map(e => e.dataset.ixp).reverse();
      const hits = keys.filter(k => {
        const g = geo(k); if (!g) return false;
        const a = -g.rot * Math.PI / 180, dx = x - g.cx, dy = y - g.cy, lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
        return Math.abs(lx) <= g.w / 2 && Math.abs(ly) <= g.h / 2;
      });
      return hits.find(k => k !== "frame") || hits[0] || null;   // çerçeve, altındaki parçayı seçmeyi engellemesin
    }
    ov.addEventListener("pointerdown", e => {
      const orr = ov.getBoundingClientRect(), x = e.clientX - orr.left, y = e.clientY - orr.top;
      const corner = e.target.classList.contains("is-sel-k"), rotH = e.target.classList.contains("is-sel-r");
      if (!corner && !rotH) { const k = hitAt(x, y); if (!k) return; if (k !== state.sel) { state.sel = k; renderPanel(); } }
      const o = objOf(state.sel), g = geo(state.sel); if (!o || !g) return;
      e.preventDefault(); try { ov.setPointerCapture(e.pointerId); } catch (er) { /* önemsiz */ }
      const br = box.getBoundingClientRect(), px = num(o.x, 50), py = num(o.y, 50), pw = num(o.w, 30), pr = num(o.rot, 0);
      const d0 = Math.hypot(x - g.cx, y - g.cy) || 1, a0 = Math.atan2(y - g.cy, x - g.cx);
      const mv = ev => {
        const X = ev.clientX - orr.left, Y = ev.clientY - orr.top;
        if (corner) o.w = Math.round(Math.max(2, Math.min(300, pw * Math.hypot(X - g.cx, Y - g.cy) / d0)) * 10) / 10;
        else if (rotH) { let r = pr + (Math.atan2(Y - g.cy, X - g.cx) - a0) * 180 / Math.PI; r = ((r + 540) % 360) - 180; if (ev.shiftKey) r = Math.round(r / 15) * 15; o.rot = Math.round(r); }
        else { o.x = Math.round((px + (X - x) / br.width * 100) * 10) / 10; o.y = Math.round((py + (Y - y) / br.height * 100) * 10) / 10; }
        livePlace(state.sel); syncInputs();
      };
      const up = () => { ov.removeEventListener("pointermove", mv); ov.removeEventListener("pointerup", up); ov.removeEventListener("pointercancel", up); preview(false); changed(); };
      ov.addEventListener("pointermove", mv); ov.addEventListener("pointerup", up); ov.addEventListener("pointercancel", up);
    });

    /* ---------- panel ---------- */
    const opt = (list, v) => list.map(([a, b]) => `<option value="${a}" ${String(v) === String(a) ? "selected" : ""}>${esc(b)}</option>`).join("");
    function sliders(key, o, ks) {
      return (ks || ["x", "y", "w", "rot"]).map(k => {
        const [lab, min, max, step, u] = RANGES[k], v = num(o[k], k === "rot" ? 0 : 50);
        return `<label class="is-row">${lab}<input type="range" min="${min}" max="${max}" step="${step}" data-is-p="${key}" data-k="${k}" value="${v}"><output data-is-out="${key}-${k}">${fmt(v, u)}</output></label>`;
      }).join("");
    }
    function partHTML([key, label, hint, posable, showIf]) {
      if (showIf && !showIf(M, s)) return "";
      const p = s.parts[key], on = p && p.ref;
      return `<div class="is-part${state.sel === key ? " is-on" : ""}" data-is-part="${key}">
        <div class="is-part-h"><span class="is-thumb">${on ? `<img data-is-thumb="${esc(p.ref)}" alt="">` : "＋"}</span>
          <span class="is-part-t"><b>${esc(label)}${key === main ? ' <em class="is-main">ana parça</em>' : ""}</b><small>${esc(hint)}</small></span></div>
        <div class="is-part-b"><button type="button" class="btn btn-outline" data-is-up="${key}">${on ? "Değiştir" : "Görsel yükle"}</button>${on ? `<button type="button" class="btn btn-danger-text" data-is-del="${key}">Kaldır</button>` : ""}</div>
        ${on && posable ? sliders(key, p) : ""}
      </div>`;
    }
    function itemsHTML() {
      if (cfg.items === "balon") {
        const n = Math.max(1, Math.min(9, Number(s.count) || 5)), imgN = ["balloon", "balloon2", "balloon3"].filter(k => s.parts[k] && s.parts[k].ref).length;
        const m = /^b(\d+)$/.exec(state.sel || ""), o = m ? objOf(state.sel) : null;
        return `<section class="is-sec"><h4>Balonlar</h4><p class="is-note">Her balonu önizlemede ayrı ayrı sürükleyip büyütebilir, döndürebilirsiniz.</p>
          <label class="is-row">Balon sayısı<input type="range" min="1" max="9" step="1" data-is-count value="${n}"><output data-is-out="count">${n}</output></label>
          <div class="is-chips">${Array.from({ length: n }, (_, i) => `<button type="button" class="is-chip${state.sel === "b" + i ? " is-on" : ""}" data-is-pick="b${i}">${i + 1}</button>`).join("")}</div>
          ${o ? `<div class="is-part is-on">${sliders(state.sel, o)}${imgN > 1 ? `<label class="is-row">Görsel<select data-is-bimg="${m[1]}">${opt(Array.from({ length: imgN }, (_, j) => [j, (j + 1) + ". balon görseli"]), num(o.img, +m[1]) % imgN)}</select></label>` : ""}</div>` : ""}</section>`;
      }
      if (cfg.items === "mum") {
        const m = /^f(\d+)$/.exec(state.sel || ""), o = m ? objOf(state.sel) : null;
        return `<section class="is-sec"><h4>Alevler</h4><p class="is-note">Alevleri önizlemede sürükleyip mum fitillerinin üstüne yerleştirin.</p>
          <div class="is-chips">${M.flames.map((_, i) => `<button type="button" class="is-chip${state.sel === "f" + i ? " is-on" : ""}" data-is-pick="f${i}">${i + 1}</button>`).join("")}
            <button type="button" class="is-chip" data-is-addf ${M.flames.length >= 12 ? "disabled" : ""}>＋ Alev</button>${o && M.flames.length > 1 ? '<button type="button" class="is-chip is-del" data-is-delf>Seçili alevi sil</button>' : ""}</div>
          ${o ? `<div class="is-part is-on">${sliders(state.sel, o, ["x", "y", "w"])}</div>` : ""}</section>`;
      }
      return "";
    }
    function fieldHTML(F) {
      if (F.showIf && !F.showIf(M, s)) return "";
      const v = M[F.k];
      if (F.t === "range") return `<label class="is-row">${esc(F.l)}<input type="range" min="${F.min}" max="${F.max}" step="${F.step || 1}" data-is-c="${F.k}" value="${num(v, F.min)}"><output data-is-out="c-${F.k}">${fmt(num(v, F.min), F.u)}</output></label>`;
      if (F.t === "sel") return `<label class="is-row">${esc(F.l)}<select data-is-c="${F.k}"${F.n ? ' data-n="1"' : ""}>${opt(F.o, v)}</select></label>`;
      if (F.t === "chk") return `<label class="is-check"><input type="checkbox" data-is-c="${F.k}" ${v !== false ? "checked" : ""}> ${esc(F.l)}</label>`;
      if (F.t === "num") return `<label class="is-row">${esc(F.l)}<input type="number" min="${F.min}" max="${F.max}" step="${F.step || 0.1}" data-is-c="${F.k}" value="${num(v, F.min)}"></label>`;
      if (F.t === "txt") return `<label class="is-col">${esc(F.l)}<input type="text" data-is-c="${F.k}" data-t="1" value="${esc(v)}"></label>`;
      return "";
    }
    function renderPanel() {
      const rt = s.resultType || "mesaj", mainLabel = (cfg.parts.find(p => p[0] === main) || [0, ""])[1];
      const effOn = rt !== "anim" || kind === "konfeti";
      panel.innerHTML = `
        <section class="is-sec"><h4>Görseller</h4>
          <p class="is-note">PNG, JPG veya WebP. Şeffaf (arka planı olmayan) PNG en gerçekçi sonucu verir. ${hasMain() ? "" : `<b>${esc(mainLabel)} görseli yüklenmezse hazır çizim kullanılır.</b>`}</p>
          ${cfg.parts.map(partHTML).join("")}</section>
        ${hasMain() ? itemsHTML() : ""}
        <section class="is-sec"><h4>${esc(cfg.motionTitle || "Hareket")}</h4>${cfg.motion.map(fieldHTML).join("")}</section>
        <section class="is-sec"><h4>Sürpriz sonucu</h4>
          <p class="is-note">${esc(cfg.what)} ortaya çıkan sürpriz. Yukarıdaki görsellerden ayrıdır.</p>
          <label class="is-row">Sonuç<select data-is-s="resultType">${opt(RESULTS, rt)}</select></label>
          ${rt === "mesaj" || rt === "baglanti" ? `<label class="is-col">Mesaj<textarea rows="2" data-is-s="message">${esc(s.message)}</textarea></label>` : ""}
          ${rt === "gorsel" ? `<div class="is-part"><div class="is-part-h"><span class="is-thumb">${s.resultImage ? `<img data-is-thumb="${esc(s.resultImage)}" alt="">` : "＋"}</span><span class="is-part-t"><b>Sürpriz fotoğrafı</b><small>Sonunda ortaya çıkan fotoğraf.</small></span></div>
            <div class="is-part-b"><button type="button" class="btn btn-outline" data-is-up="result">${s.resultImage ? "Değiştir" : "Fotoğraf yükle"}</button>${s.resultImage ? `<button type="button" class="btn btn-danger-text" data-is-del="result">Kaldır</button>` : ""}</div></div>` : ""}
          ${rt === "baglanti" ? `<label class="is-col">Bağlantı adresi<input type="url" data-is-s="linkUrl" value="${esc(s.linkUrl)}"></label><label class="is-col">Düğme yazısı<input type="text" data-is-s="linkText" value="${esc(s.linkText)}"></label>` : ""}
          ${effOn ? `<label class="is-row">${kind === "konfeti" ? "Konfeti türü" : "Efekt"}<select data-is-s="effect">${opt(EFFECTS, s.effect || "konfeti")}</select></label>` : ""}
          ${rt === "anim" ? '<p class="is-note">Yalnızca hareket oynar; mesaj ya da efekt çıkmaz.</p>' : ""}
          <label class="is-row">Yazı rengi<input type="color" data-is-s="textColor" value="${esc(s.textColor || "#3A2E28")}"></label>
          <label class="is-col">Üstteki ipucu (boşsa hazır ipucu)<input type="text" data-is-s="title" value="${esc(s.title)}"></label></section>`;
      panel.querySelectorAll("[data-is-thumb]").forEach(im => global.SeozBlobStore.resolveToObjectURL(im.dataset.isThumb).then(u => { if (u) im.src = u; }));
    }
    function syncInputs() {
      const o = objOf(state.sel); if (!o) return;
      ["x", "y", "w", "rot"].forEach(k => {
        const i = panel.querySelector(`[data-is-p="${state.sel}"][data-k="${k}"]`), out = panel.querySelector(`[data-is-out="${state.sel}-${k}"]`);
        if (i) i.value = num(o[k], 0); if (out) out.textContent = fmt(num(o[k], 0), RANGES[k][4]);
      });
    }
    const fieldOf = k => cfg.motion.find(F => F.k === k) || {};

    /* ---------- olaylar ---------- */
    let upKey = null;
    const fileIn = $("[data-is-file]");
    fileIn.addEventListener("change", () => {
      const file = fileIn.files && fileIn.files[0]; fileIn.value = ""; if (!file || !upKey) return;
      global.SeozImageUtils.processImageFile(file).then(r => {
        if (upKey === "result") { s.resultImage = r.ref; if (!s.resultType || s.resultType === "mesaj") s.resultType = "gorsel"; }
        else {
          const old = s.parts[upKey] || {};
          s.parts[upKey] = Object.assign({}, I.partDefault(kind, upKey), old, { ref: r.ref, nw: r.naturalWidth, nh: r.naturalHeight });
          if (posKeys.indexOf(upKey) >= 0) state.sel = upKey; else if (upKey === "balloon") state.sel = "b0";
        }
        state.mode = "edit"; renderPanel(); preview(false); changed();
      }).catch(() => alert("Görsel yüklenemedi. PNG, JPG veya WebP deneyin."));
    });
    root.addEventListener("click", e => {
      const b = e.target.closest("button"), part = e.target.closest("[data-is-part]");
      if (part && !b) {
        const k = part.dataset.isPart;
        if (k && k !== state.sel && posKeys.indexOf(k) >= 0 && s.parts[k] && s.parts[k].ref) { state.sel = k; renderPanel(); placeSel(); }
        return;
      }
      if (!b) return;
      const d = b.dataset;
      if (d.isClose != null) return close();
      if (d.isPlay != null) { state.mode = "play"; return preview(true); }
      if (d.isReset != null) { state.mode = "edit"; return preview(false); }
      if (d.isUp) { upKey = d.isUp; fileIn.click(); return; }
      if (d.isDel) {
        if (d.isDel === "result") delete s.resultImage; else delete s.parts[d.isDel];
        if (state.sel === d.isDel || !hasMain()) state.sel = null;
        renderPanel(); preview(false); changed(); return;
      }
      if (d.isPick) { state.sel = d.isPick; state.mode = "edit"; renderPanel(); preview(false); return; }
      if (d.isAddf != null) {
        const last = M.flames[M.flames.length - 1] || { x: 50, y: 30, w: 6 };
        M.flames.push({ x: Math.min(95, num(last.x, 50) + 8), y: num(last.y, 30), w: num(last.w, 6) });
        state.sel = "f" + (M.flames.length - 1); state.mode = "edit"; renderPanel(); preview(false); changed(); return;
      }
      if (d.isDelf != null) {
        const m = /^f(\d+)$/.exec(state.sel || "");
        if (m && M.flames.length > 1) { M.flames.splice(+m[1], 1); state.sel = null; renderPanel(); preview(false); changed(); }
      }
    });
    panel.addEventListener("input", e => {
      const t = e.target, d = t.dataset;
      if (d.isP) {
        const o = objOf(d.isP); if (!o) return;
        o[d.k] = Number(t.value); state.sel = d.isP;
        const out = panel.querySelector(`[data-is-out="${d.isP}-${d.k}"]`); if (out) out.textContent = fmt(t.value, RANGES[d.k][4]);
        if (state.mode !== "edit") { state.mode = "edit"; preview(false); } else livePlace(d.isP);
        return changed();
      }
      if (d.isCount != null) {
        s.count = Number(t.value); M.items = itemsArr();
        const out = panel.querySelector('[data-is-out="count"]'); if (out) out.textContent = t.value;
        preview(false); return changed();
      }
      if (d.isC && t.type !== "checkbox" && t.tagName !== "SELECT") {
        const v = d.t ? t.value : Number(t.value); if (!d.t && !isFinite(v)) return;
        M[d.isC] = v;
        const out = panel.querySelector(`[data-is-out="c-${d.isC}"]`); if (out) out.textContent = fmt(t.value, fieldOf(d.isC).u);
        preview(false); return changed();
      }
      if (d.isS && t.tagName !== "SELECT") { s[d.isS] = t.value; preview(false); return changed(); }
    });
    panel.addEventListener("change", e => {
      const t = e.target, d = t.dataset;
      if (d.isP) { preview(false); return; }
      if (d.isCount != null) { renderPanel(); return; }
      if (d.isBimg != null) { const o = objOf("b" + d.isBimg); if (o) o.img = Number(t.value); preview(false); return changed(); }
      if (d.isC && (t.type === "checkbox" || t.tagName === "SELECT")) {
        M[d.isC] = t.type === "checkbox" ? t.checked : (d.n ? Number(t.value) : t.value);
        renderPanel(); preview(false); return changed();
      }
      if (d.isS && t.tagName === "SELECT") { s[d.isS] = t.value; renderPanel(); preview(false); return changed(); }
    });
    // stüdyo açıkken editörün kısayolları (sil, geri al…) arkadaki sayfaya işlemesin
    const typing = t => t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
    const onKey = e => {
      if (e.key === "Escape") { e.stopPropagation(); return close(); }
      if (typing(e.target)) return;
      const step = e.shiftKey ? 2 : 0.5, mv = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      const o = mv && state.mode === "edit" ? objOf(state.sel) : null;
      if (o) {
        e.preventDefault(); o.x = Math.round((num(o.x, 50) + mv[0]) * 10) / 10; o.y = Math.round((num(o.y, 50) + mv[1]) * 10) / 10;
        livePlace(state.sel); syncInputs(); changed();
      }
      if (o || e.key === "Delete" || e.key === "Backspace" || e.ctrlKey || e.metaKey) { e.stopPropagation(); if (e.key === "Backspace") e.preventDefault(); }
    };
    const onResize = () => preview(false);
    global.addEventListener("keydown", onKey, true); global.addEventListener("resize", onResize);
    function close() {
      clearTimeout(saveT); if (h.onChange) h.onChange();
      global.removeEventListener("keydown", onKey, true); global.removeEventListener("resize", onResize);
      root.remove(); if (h.rerender) h.rerender();
    }
    renderPanel(); requestAnimationFrame(() => preview(false));
    return { close, root };
  }
  global.SeozInteractiveStudio = { open, KCFG };
})(window);
