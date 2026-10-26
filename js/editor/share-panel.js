/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — share-panel.js  (Yayın sonrası paylaşım penceresi)
   -----------------------------------------------------------------------------
   - prepare(doc): yayından ÖNCE paylaşım kapağını hazırlar. Davetiyenin kendi
     kapağından (iç kart / açılış görseli / zemin) 1200×630 küçük bir JPEG
     üretir (WhatsApp önizlemesi büyük PNG'leri göstermez). Görsel değişmediyse
     yeniden üretilmez. Sonuç doc.meta.share içine yazılır; yayında diğer
     görseller gibi Storage'a yüklenir.
   - show(...): yayından SONRA kısa bağlantı, Kopyala, WhatsApp'ta paylaş,
     önizleme kartı (başlık/açıklama düzenlenebilir), eski uzun bağlantı ve
     varsa müşteri paneli linki.
   Davetiye içeriğine, modüllere ve mevcut bağlantılara dokunmaz.
   ========================================================================= */
(function (global) {
  "use strict";
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const W = 1200, H = 630;
  const DEFAULT_DESC = "Davetlisiniz! Davetiyeyi açmak için dokunun.";

  function coverSource(doc) {
    const share = (doc.meta && doc.meta.share) || {};
    if (share.custom) return share.custom;
    const e = doc.entry || {}, cin = e.cinema || {};
    const layer = (Array.isArray(cin.layers) ? cin.layers : []).find(l => l && l.src);
    const img = (doc.layers || []).filter(l => l.type === "image" && l.content && l.content.src).sort((a, b) => (a.y || 0) - (b.y || 0))[0];
    const bg = doc.canvas && doc.canvas.background;
    return [e.cardOnlySrc, e.cardSrc, e.pngSrc, layer && layer.src, img && img.content.src, bg && bg.type === "image" ? bg.value : ""].find(Boolean) || "";
  }
  function loadImage(ref) {
    return SeozBlobStore.resolveToObjectURL(ref).then(u => new Promise((res, rej) => {
      if (!u) return rej(new Error("görsel yok"));
      const im = new Image(); if (/^https?:/i.test(u)) im.crossOrigin = "anonymous";
      im.onload = () => res(im); im.onerror = () => rej(new Error("görsel açılamadı")); im.src = u;
    }));
  }
  // Kapak: arkada aynı görselin bulanık, koyulaştırılmış hâli; önde görselin tamamı (kırpılmadan)
  function renderCover(im) {
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const x = c.getContext("2d"), iw = im.naturalWidth, ih = im.naturalHeight;
    const cover = Math.max(W / iw, H / ih), fit = Math.min(W / iw, H / ih) * 0.94;
    x.fillStyle = "#1c1612"; x.fillRect(0, 0, W, H);
    try { x.filter = "blur(28px) brightness(.62)"; } catch (e) { /* eski tarayıcı */ }
    x.drawImage(im, (W - iw * cover) / 2 - 40, (H - ih * cover) / 2 - 40, iw * cover + 80, ih * cover + 80);
    x.filter = "none";
    x.shadowColor = "rgba(0,0,0,.35)"; x.shadowBlur = 30;
    x.drawImage(im, (W - iw * fit) / 2, (H - ih * fit) / 2, iw * fit, ih * fit);
    return new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error("kapak üretilemedi"))), "image/jpeg", 0.82));
  }
  function prepare(doc) {
    doc.meta = doc.meta || {};
    const share = doc.meta.share = Object.assign({}, doc.meta.share || {});
    const src = coverSource(doc);
    if (!src) { delete share.image; delete share.src; return Promise.resolve(share); }
    if (share.image && share.src === src) return Promise.resolve(share);
    return loadImage(src).then(renderCover).then(blob => SeozBlobStore.putBlob(blob)).then(ref => {
      Object.assign(share, { src, image: ref, w: W, h: H }); return share;
    }).catch(err => { console.warn("[Studio SEOZ] Paylaşım kapağı hazırlanamadı:", err); return share; });
  }

  function waLink(text) { return "https://wa.me/?text=" + encodeURIComponent(text); }
  function copy(text, btn) {
    const done = () => { const t = btn.textContent; btn.textContent = "Kopyalandı ✓"; setTimeout(() => { btn.textContent = t; }, 1600); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => fallback());
    else fallback();
    function fallback() { const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); done(); } catch (e) { prompt("Bağlantıyı kopyalayın:", text); } ta.remove(); }
  }

  /* opts: { shortUrl, longUrl, panelUrl, panelMissing, doc, onUpdate(title, desc) → Promise, onCover(file) → Promise } */
  function show(opts) {
    const old = document.querySelector(".sp-root"); if (old) old.remove();
    const doc = opts.doc, share = (doc.meta && doc.meta.share) || {};
    const title = share.title || (doc.meta && doc.meta.title) || "Davetiye", desc = share.description || DEFAULT_DESC;
    const root = document.createElement("div");
    root.className = "sp-root"; root.setAttribute("role", "dialog"); root.setAttribute("aria-label", "Davetiye yayında");
    root.innerHTML = `
      <div class="sp-card">
        <button type="button" class="sp-x" data-sp-close aria-label="Kapat">×</button>
        <h3>Davetiye yayında 🎉</h3>
        <p class="sp-note">Bu bağlantıyı davetlilerinize gönderin.</p>
        <div class="sp-link"><input readonly data-share-url value="${esc(opts.shortUrl)}" data-long="${esc(opts.longUrl)}"><button type="button" class="btn btn-outline" data-sp-copy>Kopyala</button></div>
        <div class="sp-actions">
          <a class="btn sp-wa" data-sp-wa target="_blank" rel="noopener" href="${esc(waLink(title + "\n" + opts.shortUrl))}">WhatsApp'ta paylaş</a>
          ${navigator.share ? '<button type="button" class="btn btn-outline" data-sp-native>Diğer uygulamalar…</button>' : ""}
          <a class="btn btn-outline" target="_blank" rel="noopener" href="${esc(opts.shortUrl)}">Aç</a>
        </div>
        <section class="sp-prev">
          <h4>WhatsApp önizlemesi</h4>
          <div class="sp-wa-card"><div class="sp-img" data-sp-img>${share.image ? "" : "<span>Kapak görseli yok</span>"}</div>
            <div class="sp-txt"><b data-sp-t>${esc(title)}</b><small data-sp-d>${esc(desc)}</small><i>${esc(String(opts.shortUrl).replace(/^https?:\/\//, "").split("/")[0])}</i></div></div>
          <label>Başlık<input type="text" maxlength="90" data-sp-title value="${esc(title)}"></label>
          <label>Açıklama<textarea rows="2" maxlength="200" data-sp-desc>${esc(desc)}</textarea></label>
          <div class="sp-row"><button type="button" class="btn btn-outline" data-sp-cover>Kapak görselini değiştir</button><button type="button" class="btn btn-gold" data-sp-update>Önizlemeyi güncelle</button></div>
          <p class="sp-note sp-status" data-sp-status>WhatsApp önizlemeyi bir süre önbellekte tutabilir; değişiklik yeni paylaşımlarda görünür.</p>
          <input type="file" accept="image/png,image/jpeg,image/webp" class="hidden" data-sp-file>
        </section>
        ${opts.panelUrl ? `<section class="sp-panel"><h4>Müşteri paneli</h4><p class="sp-note">Yalnızca etkinlik sahibine verin — davetlilerle paylaşmayın.</p>
          <div class="sp-link"><input readonly data-share-panel value="${esc(opts.panelUrl)}"><button type="button" class="btn btn-outline" data-sp-copy-panel>Kopyala</button></div></section>` : ""}
        ${(opts.polls || []).length ? `<section class="sp-panel"><h4>Anket sonuçları</h4><p class="sp-note">Canlı sonuç paneli (grafikler, yanıtlar, QR kod). Yalnızca anket sahibine verin.</p>
          ${opts.polls.map((p, i) => `<div class="sp-poll" data-sp-poll="${esc(p.layerId)}"><small>${esc(p.title)}</small>${p.url ? `<div class="sp-link"><input readonly data-share-poll value="${esc(p.url)}"><button type="button" class="btn btn-outline" data-sp-copy-poll>Kopyala</button></div>`
            : `<p class="sp-note sp-warn">Sonuç paneli linki bu tarayıcıda kayıtlı değil.</p><button type="button" class="btn btn-outline" data-sp-poll-new>Yeni sonuç paneli linki üret (eski link iptal olur)</button>`}
            ${opts.onPollView ? `<div class="sp-poll-view"><button type="button" class="btn btn-outline" data-sp-poll-view>Salt okunur sonuç linki üret</button><p class="sp-note">Yalnızca toplu oyları gösterir; isim, görüş ve yönetim düğmesi yoktur. Toplantı ekranı veya vitrin demosu için güvenle paylaşılabilir. Yeni link üretince eskisi iptal olur.</p></div>` : ""}</div>`).join("")}</section>` : ""}
        ${opts.albumUrl || opts.albumMissing ? `<section class="sp-panel"><h4>Anı albümü</h4><p class="sp-note">Misafirlerin yüklediği fotoğraf ve videolar. Yalnızca etkinlik sahibine verin.</p>
          ${opts.albumUrl ? `<div class="sp-link"><input readonly data-share-album value="${esc(opts.albumUrl)}"><button type="button" class="btn btn-outline" data-sp-copy-album>Kopyala</button></div>`
            : `<p class="sp-note sp-warn">Albüm linki bu tarayıcıda kayıtlı değil (başka tarayıcıdan oluşturulmuş olabilir).</p><button type="button" class="btn btn-outline" data-sp-album-new>Yeni albüm linki üret (eski link iptal olur)</button>`}</section>` : ""}
        ${opts.panelMissing ? `<p class="sp-note sp-warn">Müşteri paneli linki bu tarayıcıda kayıtlı değil. Katılım Formu ayarlarındaki "Yeni panel linki üret" ile yeni bir link oluşturabilirsiniz.</p>` : ""}
        <details class="sp-long"><summary>Eski (uzun) bağlantı</summary><input readonly value="${esc(opts.longUrl)}"><p class="sp-note">Daha önce gönderilen bağlantılar aynen çalışmaya devam eder.</p></details>
      </div>`;
    document.body.appendChild(root);
    const $ = q => root.querySelector(q);
    if (share.image) SeozBlobStore.resolveToObjectURL(share.image).then(u => { if (u) $("[data-sp-img]").style.backgroundImage = `url("${u}")`; });
    const close = () => { root.remove(); document.removeEventListener("keydown", onKey, true); };
    const onKey = e => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey, true);
    root.addEventListener("click", e => { if (e.target === root) close(); });
    $("[data-sp-close]").addEventListener("click", close);
    $("[data-sp-copy]").addEventListener("click", e => copy(opts.shortUrl, e.currentTarget));
    root.addEventListener("click", e => {
      const cp = e.target.closest("[data-sp-copy-poll]");
      if (cp) return copy(cp.parentNode.querySelector("input").value, cp);
      const pv = e.target.closest("[data-sp-poll-view]");
      if (pv) {
        const pbox = pv.closest("[data-sp-poll]"); pv.disabled = true;
        return Promise.resolve(opts.onPollView(pbox.dataset.spPoll)).then(u => {
          if (!u) throw new Error("link alınamadı");
          const old = pbox.querySelector("[data-share-poll-view]"); if (old) old.parentNode.remove();
          pv.insertAdjacentHTML("beforebegin", `<div class="sp-link"><input readonly data-share-poll-view value="${esc(u)}"><button type="button" class="btn btn-outline" data-sp-copy-poll>Kopyala</button></div>`);
          pv.disabled = false; pv.textContent = "Yeni salt okunur link üret (eskisi iptal olur)";
        }).catch(err => { pv.disabled = false; alert("Salt okunur link üretilemedi: " + (err && err.message || "")); });
      }
      const nw = e.target.closest("[data-sp-poll-new]"); if (!nw) return;
      const box = nw.closest("[data-sp-poll]"); nw.disabled = true;
      Promise.resolve(opts.onPollRotate && opts.onPollRotate(box.dataset.spPoll)).then(u => {
        if (!u) throw new Error("link alınamadı");
        nw.insertAdjacentHTML("beforebegin", `<div class="sp-link"><input readonly data-share-poll value="${esc(u)}"><button type="button" class="btn btn-outline" data-sp-copy-poll>Kopyala</button></div>`);
        const w = box.querySelector(".sp-warn"); if (w) w.remove(); nw.remove();
      }).catch(err => { nw.disabled = false; alert("Yeni link üretilemedi: " + (err && err.message || "")); });
    });
    if ($("[data-sp-copy-album]")) $("[data-sp-copy-album]").addEventListener("click", e => copy($("[data-share-album]").value, e.currentTarget));
    if ($("[data-sp-album-new]")) $("[data-sp-album-new]").addEventListener("click", e => {
      const b = e.currentTarget; b.disabled = true;
      Promise.resolve(opts.onAlbumRotate && opts.onAlbumRotate()).then(u => {
        if (!u) throw new Error("albüm linki alınamadı");
        b.insertAdjacentHTML("beforebegin", `<div class="sp-link"><input readonly data-share-album value="${esc(u)}"><button type="button" class="btn btn-outline" data-sp-copy-album>Kopyala</button></div>`);
        root.querySelector("[data-sp-copy-album]").addEventListener("click", ev => copy(u, ev.currentTarget)); b.remove();
      }).catch(err => { b.disabled = false; alert("Yeni albüm linki üretilemedi: " + (err && err.message || "")); });
    });
    if ($("[data-sp-copy-panel]")) $("[data-sp-copy-panel]").addEventListener("click", e => copy(opts.panelUrl, e.currentTarget));
    if ($("[data-sp-native]")) $("[data-sp-native]").addEventListener("click", () => navigator.share({ title: $("[data-sp-title]").value, text: $("[data-sp-desc]").value, url: opts.shortUrl }).catch(() => {}));
    const sync = () => { $("[data-sp-t]").textContent = $("[data-sp-title]").value || title; $("[data-sp-d]").textContent = $("[data-sp-desc]").value || DEFAULT_DESC; $("[data-sp-wa]").href = waLink(($("[data-sp-title]").value || title) + "\n" + opts.shortUrl); };
    root.addEventListener("input", sync);
    const status = t => { $("[data-sp-status]").textContent = t; };
    const busy = on => root.querySelectorAll("[data-sp-update], [data-sp-cover]").forEach(b => { b.disabled = on; });
    $("[data-sp-update]").addEventListener("click", () => {
      busy(true); status("Güncelleniyor…");
      Promise.resolve(opts.onUpdate && opts.onUpdate($("[data-sp-title]").value.trim(), $("[data-sp-desc]").value.trim()))
        .then(() => status("Önizleme güncellendi ✓ (bağlantı değişmedi)"), err => status("Güncellenemedi: " + (err && err.message || "bilinmeyen hata")))
        .finally(() => busy(false));
    });
    const fileIn = $("[data-sp-file]");
    $("[data-sp-cover]").addEventListener("click", () => fileIn.click());
    fileIn.addEventListener("change", () => {
      const f = fileIn.files && fileIn.files[0]; fileIn.value = ""; if (!f || !opts.onCover) return;
      busy(true); status("Kapak hazırlanıyor…");
      Promise.resolve(opts.onCover(f, $("[data-sp-title]").value.trim(), $("[data-sp-desc]").value.trim()))
        .then(() => { status("Kapak güncellendi ✓"); const s2 = doc.meta.share || {}; if (s2.image) SeozBlobStore.resolveToObjectURL(s2.image).then(u => { if (u) { const b = $("[data-sp-img]"); b.innerHTML = ""; b.style.backgroundImage = `url("${u}")`; } }); },
          err => status("Kapak değiştirilemedi: " + (err && err.message || "")))
        .finally(() => busy(false));
    });
    return { close, root };
  }
  global.SeozSharePanel = { prepare, show, coverSource, DEFAULT_DESC };
})(window);
