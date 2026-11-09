/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — share-panel.js  (Yayın sonrası paylaşım penceresi)
   -----------------------------------------------------------------------------
   - prepare(doc): yayından ÖNCE paylaşım kapağını hazırlar. Davetiyenin kendi
     kapağından (iç kart / açılış görseli / zemin) 1200×630 küçük bir JPEG
     üretir (WhatsApp önizlemesi büyük PNG'leri göstermez). Görsel değişmediyse
     yeniden üretilmez. Sonuç doc.meta.share içine yazılır; yayında diğer
     görseller gibi Storage'a yüklenir.
   - show(...): yayından SONRA sade paylaşım penceresi: önizleme kartı, kısa
     bağlantı ve tek bir "Paylaş" düğmesi (telefonda sistemin paylaşım
     menüsü → Instagram, WhatsApp…; bilgisayarda bağlantıyı kopyalar).
     Yanında Kopyala / WhatsApp / Aç. Önizleme düzenleme ve etkinlik sahibi
     bağlantıları (müşteri paneli, anket, albüm, eski uzun bağlantı) ayrı,
     katlanır bölümlerde.
   - Paylaşım yalnızca BAĞLANTIYI gönderir (ek metin yok): Instagram DM'de
     mesaj tek bir bağlantı + önizleme kartı olarak görünür. Kartı Instagram
     kendisi oluşturur; görünmediği durumlarda da bağlantı tıklanabilir kalır.
   Davetiye içeriğine, modüllere ve mevcut bağlantılara dokunmaz.
   ========================================================================= */
(function (global) {
  "use strict";
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const W = 1200, H = 630;
  const DEFAULT_DESC = "Davetlisiniz! Davetiyeyi açmak için dokunun.";
  // İngilizce davetiyede (meta.lang "en") paylaşım kartının hazır açıklaması — functions/[slug].js ile aynı metin
  const DEFAULT_DESC_EN = "You're invited! Tap to open your invitation.";
  const DEFAULT_COVER = "assets/og/davetiye-paylasim.jpg";   // kapak yoksa sunucunun da kullandığı hazır kapak
  // telefon / tablet: sistemin paylaşım menüsü; bilgisayar: bağlantıyı kopyala
  const touchShare = () => !!(navigator.share && global.matchMedia && global.matchMedia("(pointer: coarse)").matches);

  function coverSource(doc) {
    const share = (doc.meta && doc.meta.share) || {};
    if (share.custom) return share.custom;
    const e = doc.entry || {}, cin = e.cinema || {};
    const layer = (Array.isArray(cin.layers) ? cin.layers : []).find(l => l && l.src);
    const img = (doc.layers || []).filter(l => l.type === "image" && l.content && l.content.src).sort((a, b) => (a.y || 0) - (b.y || 0))[0];
    const bg = doc.canvas && doc.canvas.background;
    // MP4 alanlarında paylaşım kapağı için videonun kapak görseli (ilk kare) kullanılır
    // 3D model katmanında modelin kapak görseli kullanılır (GLB bir resim değildir)
    const pic = (src, m, mo) => (mo && mo.type === "glb" ? (mo.poster || "") : m && m.type === "video" ? (m.poster || "") : src);
    return [pic(e.cardOnlySrc, e.cardOnlyMedia), pic(e.cardSrc, e.cardMedia), pic(e.pngSrc, e.pngMedia), layer && pic(layer.src, layer.media, layer.model), img && img.content.src, bg && bg.type === "image" ? bg.value : ""].find(Boolean) || "";
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
    // WhatsApp ~300 KB üstü küçük resmi göstermez: kapak 240 KB'ı geçerse kaliteyi adım adım düşür
    const enc = q => new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error("kapak üretilemedi"))), "image/jpeg", q));
    return [0.82, 0.72, 0.62, 0.5].reduce((p, q) => p.then(b => (b && b.size <= 240000 ? b : enc(q))), Promise.resolve(null));
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

  /* ---- TESLİMAT PAKETİ + ANI ALBÜMÜ SAKLAMA BİLGİSİ (yalnızca editör / Studio SEOZ) ---- */
  const PKG_TXT = {
    tr: { head: "Teslimat Paketiniz", inv: "Davetiye", album: "Anı Albümü", panel: "Katılım Paneli" },
    en: { head: "Your Invitation Package", inv: "Invitation", album: "Memory Album", panel: "RSVP Dashboard" }
  };
  /* "Tüm Linkleri Kopyala" metni — davetiyenin dilinde (paket sayfasıyla aynı düzen) */
  function allLinksText(lang, title, links) {
    const t = PKG_TXT[lang === "en" ? "en" : "tr"], rows = [t.head + (title ? " — " + title : ""), ""];
    if (links.inv) rows.push(t.inv + ": " + links.inv);
    if (links.album) rows.push(t.album + ": " + links.album);
    if (links.panel) rows.push(t.panel + ": " + links.panel);
    return rows.join("\n");
  }
  const DAY = 86400000;
  const parseDay = v => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v || "")); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null; };
  const fmtDay = ms => new Date(ms).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const todayUtc = () => { const n = new Date(); return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()); };
  /* Albüm saklama özeti (yalnızca bilgi — hiçbir şey kendiliğinden silinmez) */
  function retentionHTML(info) {
    if (!info) return "";
    if (info.purged_at) return `<p class="sp-ret sp-ret-gone">Albüm verileri silindi (${esc(new Date(info.purged_at).toLocaleDateString("tr-TR"))}). Link açılınca müşteri "süresi doldu" mesajını görür.</p>`;
    const ev = parseDay(info.event_date), days = info.retention_days;
    const rows = [`<span>Etkinlik tarihi</span><b>${ev != null ? esc(fmtDay(ev)) : "— (Geri Sayım veya Takvime Ekle tarihi yok)"}</b>`];
    if (!days) rows.push(`<span>Saklama kuralı</span><b>Uygulanmıyor (eski davetiye / demo)</b>`);
    else if (ev != null) {
      const last = ev + days * DAY, left = Math.round((last - todayUtc()) / DAY);
      rows.push(`<span>Son saklama tarihi</span><b>${esc(fmtDay(last))}</b>`);
      rows.push(`<span>Kalan gün</span><b class="${left < 0 ? "sp-over" : left <= 7 ? "sp-soon" : ""}">${left >= 0 ? left + " gün" : "Süre doldu (" + (-left) + " gün önce)"}</b>`);
    } else rows.push(`<span>Saklama kuralı</span><b>${days} gün (etkinlik tarihi girilince hesaplanır)</b>`);
    rows.push(`<span>Dosya</span><b>${Number(info.files || 0)}</b>`);
    return `<div class="sp-ret">${rows.map(r => `<div>${r}</div>`).join("")}</div>`;
  }

  /* opts: { shortUrl, longUrl, panelUrl, panelMissing, doc, onUpdate(title, desc) → Promise, onCover(file) → Promise } */
  function show(opts) {
    const old = document.querySelector(".sp-root"); if (old) old.remove();
    const doc = opts.doc, share = (doc.meta && doc.meta.share) || {};
    const defDesc = doc.meta && doc.meta.lang === "en" ? DEFAULT_DESC_EN : DEFAULT_DESC;
    const title = share.title || (doc.meta && doc.meta.title) || "Davetiye", desc = share.description || defDesc;
    const root = document.createElement("div");
    root.className = "sp-root"; root.setAttribute("role", "dialog"); root.setAttribute("aria-label", "Davetiye yayında");
    const domain = String(opts.shortUrl).replace(/^https?:\/\//, "").split("/")[0];
    const hasOwner = !!(opts.panelUrl || opts.panelMissing || (opts.polls || []).length || opts.albumUrl || opts.albumMissing);
    root.innerHTML = `
      <div class="sp-card">
        <button type="button" class="sp-x" data-sp-close aria-label="Kapat">×</button>
        <h3>Davetiye yayında 🎉</h3>
        <div class="sp-wa-card sp-hero"><div class="sp-img" data-sp-img></div>
          <div class="sp-txt"><b data-sp-t>${esc(title)}</b><small data-sp-d>${esc(desc)}</small><i>${esc(domain)}</i></div></div>
        <div class="sp-link"><input readonly data-share-url value="${esc(opts.shortUrl)}" data-long="${esc(opts.longUrl)}" aria-label="Davetiye bağlantısı"></div>
        <button type="button" class="btn sp-share" data-sp-share>${touchShare() ? "Paylaş" : "Paylaş — bağlantıyı kopyala"}</button>
        <div class="sp-actions">
          <button type="button" class="btn btn-outline" data-sp-copy>Kopyala</button>
          <a class="btn btn-outline sp-wa" data-sp-wa target="_blank" rel="noopener" href="${esc(waLink(opts.shortUrl))}">WhatsApp</a>
          <a class="btn btn-outline" target="_blank" rel="noopener" href="${esc(opts.shortUrl)}">Aç</a>
        </div>
        <p class="sp-note sp-tip" data-sp-tip>Bağlantıyı mesaja <b>tek başına</b> yapıştırın ve <b>kart görününce</b> gönderin. Kartı Instagram ve WhatsApp kendisi oluşturur; karta ya da bağlantıya dokunan davetiyeyi açar.</p>
        <details class="sp-prev" data-sp-prev${share.title ? "" : " open"}>
          <summary>Önizlemeyi düzenle <small>(başlık, açıklama, kapak)</small></summary>
          <label>Başlık <small class="sp-count" data-sp-tc></small><input type="text" maxlength="90" data-sp-title value="${esc(title)}" placeholder="Örn. Ada &amp; Kerem | Nişan Davetiyesi"></label>
          <label>Açıklama <small class="sp-count" data-sp-dc></small><textarea rows="2" maxlength="200" data-sp-desc placeholder="Örn. 17 Aralık · Altın Köşk. Davetiyeyi açmak için dokunun.">${esc(desc)}</textarea></label>
          <div class="sp-row"><button type="button" class="btn btn-outline" data-sp-cover>Kapak görselini değiştir</button><button type="button" class="btn btn-gold" data-sp-update>Önizlemeyi güncelle</button></div>
          <p class="sp-note sp-status" data-sp-status>WhatsApp ve Instagram önizlemeyi bir süre önbellekte tutabilir; değişiklik yeni paylaşımlarda görünür.</p>
          <input type="file" accept="image/png,image/jpeg,image/webp" class="hidden" data-sp-file>
        </details>
        ${opts.makePackageUrl ? `<div class="sp-pkg"><h4>Teslimat Paketi</h4>
          <p class="sp-note">Müşteriye tek link: davetiye${opts.albumUrl || opts.albumMissing ? ", anı albümü" : ""}${opts.panelUrl || opts.panelMissing ? ", katılım paneli" : ""} tek sayfada, davetiyenin dilinde. Yönetim bağlantılarını içerir — yalnızca etkinlik sahibine verin.</p>
          <div class="sp-link"><input readonly data-share-pkg value=""><button type="button" class="btn btn-outline" data-sp-copy-pkg>Kopyala</button><a class="btn btn-outline" data-sp-open-pkg target="_blank" rel="noopener" href="#">Aç</a></div>
          <button type="button" class="btn btn-outline sp-all" data-sp-copy-all>Tüm Linkleri Kopyala</button>
          <p class="sp-note sp-warn" data-sp-pkg-warn hidden></p></div>` : ""}
        ${hasOwner ? `<div class="sp-owner"><h4>Etkinlik sahibi bağlantıları</h4><p class="sp-note">Bunlar davetlilere gönderilmez; yalnızca etkinlik sahibine verin.</p>` : ""}
        ${opts.panelUrl ? `<section class="sp-panel"><h4>Müşteri paneli</h4><p class="sp-note">Yalnızca etkinlik sahibine verin — davetlilerle paylaşmayın.</p>
          <div class="sp-link"><input readonly data-share-panel value="${esc(opts.panelUrl)}"><button type="button" class="btn btn-outline" data-sp-copy-panel>Kopyala</button></div></section>` : ""}
        ${(opts.polls || []).length ? `<section class="sp-panel"><h4>Anket sonuçları</h4><p class="sp-note">Canlı sonuç paneli (grafikler, yanıtlar, QR kod). Yalnızca anket sahibine verin.</p>
          ${opts.polls.map((p, i) => `<div class="sp-poll" data-sp-poll="${esc(p.layerId)}"><small>${esc(p.title)}</small>${p.url ? `<div class="sp-link"><input readonly data-share-poll value="${esc(p.url)}"><button type="button" class="btn btn-outline" data-sp-copy-poll>Kopyala</button></div>`
            : `<p class="sp-note sp-warn">Sonuç paneli linki bu tarayıcıda kayıtlı değil.</p><button type="button" class="btn btn-outline" data-sp-poll-new>Yeni sonuç paneli linki üret (eski link iptal olur)</button>`}
            ${opts.onPollView ? `<div class="sp-poll-view"><button type="button" class="btn btn-outline" data-sp-poll-view>Salt okunur sonuç linki üret</button><p class="sp-note">Yalnızca toplu oyları gösterir; isim, görüş ve yönetim düğmesi yoktur. Toplantı ekranı veya vitrin demosu için güvenle paylaşılabilir. Yeni link üretince eskisi iptal olur.</p></div>` : ""}</div>`).join("")}</section>` : ""}
        ${opts.albumUrl || opts.albumMissing ? `<section class="sp-panel"><h4>Anı albümü</h4><p class="sp-note">Misafirlerin yüklediği fotoğraf ve videolar. Yalnızca etkinlik sahibine verin.</p>
          ${opts.albumUrl ? `<div class="sp-link"><input readonly data-share-album value="${esc(opts.albumUrl)}"><button type="button" class="btn btn-outline" data-sp-copy-album>Kopyala</button></div>`
            : `<p class="sp-note sp-warn">Albüm linki bu tarayıcıda kayıtlı değil (başka tarayıcıdan oluşturulmuş olabilir).</p><button type="button" class="btn btn-outline" data-sp-album-new>Yeni albüm linki üret (eski link iptal olur)</button>`}
          ${opts.albumInfo ? `<div data-sp-ret>${retentionHTML(opts.albumInfo)}</div>
          ${opts.onAlbumSettings && !opts.albumInfo.purged_at ? `<details class="sp-ret-set"><summary>Saklama bilgisini düzenle</summary>
            <label>Etkinlik tarihi <input type="date" data-sp-ev value="${esc(opts.albumInfo.event_date || "")}"></label>
            <label>Saklama kuralı <select data-sp-days><option value="30"${opts.albumInfo.retention_days ? " selected" : ""}>Etkinlikten sonra 30 gün (müşteriye gösterilir)</option><option value=""${opts.albumInfo.retention_days ? "" : " selected"}>Uygulanmaz (eski davetiye / demo)</option></select></label>
            <button type="button" class="btn btn-outline" data-sp-ret-save>Kaydet</button> <small class="sp-note" data-sp-ret-msg></small>
            <p class="sp-note">Yalnızca bilgi: süre dolunca hiçbir şey kendiliğinden silinmez. Silme yalnızca aşağıdaki düğmeyle yapılır.</p></details>` : ""}
          ${opts.onAlbumPurge && !opts.albumInfo.purged_at ? `<div class="sp-danger"><button type="button" class="btn sp-del" data-sp-purge>Albüm Verilerini Sil</button>
            <p class="sp-note">Yalnızca Studio SEOZ görür. Bu albümün fotoğraf ve videoları depodan kalıcı olarak silinir; davetiye, diğer albümler ve katılım verileri etkilenmez.</p></div>` : ""}` : ""}</section>` : ""}
        ${opts.panelMissing ? `<p class="sp-note sp-warn">Müşteri paneli linki bu tarayıcıda kayıtlı değil. Katılım Formu ayarlarındaki "Yeni panel linki üret" ile yeni bir link oluşturabilirsiniz.</p>` : ""}
        ${hasOwner ? "</div>" : ""}
        <details class="sp-long"><summary>Eski (uzun) bağlantı</summary><input readonly value="${esc(opts.longUrl)}"><p class="sp-note">Daha önce gönderilen bağlantılar aynen çalışmaya devam eder.</p></details>
      </div>`;
    document.body.appendChild(root);
    const $ = q => root.querySelector(q);
    const showImg = u => { $("[data-sp-img]").style.backgroundImage = `url("${u}")`; };
    if (share.image) SeozBlobStore.resolveToObjectURL(share.image).then(u => showImg(u || DEFAULT_COVER), () => showImg(DEFAULT_COVER));
    else { showImg(DEFAULT_COVER); $("[data-sp-img]").title = "Kapak görseli yok: hazır Studio SEOZ kapağı kullanılır"; }
    const close = () => { root.remove(); document.removeEventListener("keydown", onKey, true); };
    const onKey = e => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey, true);
    root.addEventListener("click", e => { if (e.target === root) close(); });
    $("[data-sp-close]").addEventListener("click", close);
    $("[data-sp-copy]").addEventListener("click", e => copy(opts.shortUrl, e.currentTarget));
    // Tek düğme: telefonda sistemin paylaşım menüsü (yalnızca bağlantı), bilgisayarda kopyala
    $("[data-sp-share]").addEventListener("click", e => {
      const btn = e.currentTarget;
      if (touchShare()) {
        // Yalnızca bağlantı: uygulama tek mesajda tek kart oluşturur (başlık/açıklama kartın içinde gelir).
        const data = { url: opts.shortUrl };
        navigator.share(data).catch(err => { if (!err || err.name !== "AbortError") copy(opts.shortUrl, btn); });
      } else {
        copy(opts.shortUrl, btn);
        $("[data-sp-tip]").innerHTML = "<b>Bağlantı kopyalandı.</b> Instagram, WhatsApp ya da istediğiniz uygulamada mesaja yapıştırıp gönderin.";
      }
    });
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
        refreshPkg();   // teslimat paketi yeni albüm anahtarıyla güncellenir
      }).catch(err => { b.disabled = false; alert("Yeni albüm linki üretilemedi: " + (err && err.message || "")); });
    });
    if ($("[data-sp-copy-panel]")) $("[data-sp-copy-panel]").addEventListener("click", e => copy(opts.panelUrl, e.currentTarget));
    // TESLİMAT PAKETİ: link (albüm linki yenilenince güncellenir) + "Tüm Linkleri Kopyala"
    const lang = doc.meta && doc.meta.lang === "en" ? "en" : "tr";
    function refreshPkg() {
      if (!$("[data-share-pkg]")) return;
      const u = opts.makePackageUrl() || "";
      $("[data-share-pkg]").value = u; $("[data-sp-open-pkg]").href = u || "#";
      const albumNow = $("[data-share-album]") ? $("[data-share-album]").value : "";
      const miss = [];
      if ((opts.albumUrl || opts.albumMissing) && !albumNow) miss.push("anı albümü");
      if (opts.panelMissing) miss.push("katılım paneli");
      const w = $("[data-sp-pkg-warn]");
      w.hidden = !miss.length;
      w.textContent = miss.length ? `Pakette ${miss.join(" ve ")} bölümü yok: anahtarı bu tarayıcıda kayıtlı değil. Aşağıdan yeni link üretince paket de güncellenir.` : "";
    }
    if ($("[data-share-pkg]")) {
      refreshPkg();
      $("[data-sp-copy-pkg]").addEventListener("click", e => copy($("[data-share-pkg]").value, e.currentTarget));
      $("[data-sp-copy-all]").addEventListener("click", e => copy(allLinksText(lang, (doc.meta && doc.meta.title) || "", {
        inv: opts.shortUrl, album: $("[data-share-album]") ? $("[data-share-album]").value : "", panel: opts.panelUrl || "" }), e.currentTarget));
    }
    // ANI ALBÜMÜ: saklama bilgisi (etkinlik tarihi / saklama kuralı) — yalnızca bilgi
    if ($("[data-sp-ret-save]")) $("[data-sp-ret-save]").addEventListener("click", e => {
      const b = e.currentTarget, msg = $("[data-sp-ret-msg]"); b.disabled = true; msg.textContent = "Kaydediliyor…";
      Promise.resolve(opts.onAlbumSettings($("[data-sp-ev]").value || null, $("[data-sp-days]").value ? 30 : null)).then(info => {
        opts.albumInfo = Object.assign({}, opts.albumInfo, info || {}); $("[data-sp-ret]").innerHTML = retentionHTML(opts.albumInfo); msg.textContent = "Kaydedildi ✓";
      }).catch(err => { msg.textContent = "Kaydedilemedi: " + (err && err.message || ""); }).finally(() => { b.disabled = false; });
    });
    // ALBÜM VERİLERİNİ SİL: güçlü onay (SİL yazılmadan düğme açılmaz) → depo + kayıtlar
    if ($("[data-sp-purge]")) $("[data-sp-purge]").addEventListener("click", () => {
      const m = document.createElement("div");
      m.className = "sp-confirm"; m.setAttribute("role", "alertdialog"); m.setAttribute("aria-label", "Albüm verilerini sil");
      m.innerHTML = `<div class="sp-confirm-box"><h4>Albüm Verilerini Sil</h4>
        <p class="sp-confirm-txt">Bu işlem geri alınamaz. Albümdeki tüm fotoğraf ve videolar kalıcı olarak silinecek. Devam etmek istiyor musunuz?</p>
        <p class="sp-note">Davetiye: <b>${esc((doc.meta && doc.meta.title) || opts.slug || "")}</b> · ${Number(opts.albumInfo.files || 0)} dosya</p>
        <label class="sp-note"><span>Onaylamak için <b>SİL</b> yazın</span><input type="text" data-sp-confirm-in autocomplete="off"></label>
        <div class="sp-row"><button type="button" class="btn btn-outline" data-sp-confirm-no>Vazgeç</button><button type="button" class="btn sp-del" data-sp-confirm-yes disabled>Evet, kalıcı olarak sil</button></div>
        <p class="sp-note" data-sp-confirm-msg></p></div>`;
      root.appendChild(m);
      const q = x => m.querySelector(x), inp = q("[data-sp-confirm-in]"), yes = q("[data-sp-confirm-yes]"), msg = q("[data-sp-confirm-msg]");
      inp.focus();
      inp.addEventListener("input", () => { yes.disabled = inp.value.trim().toLocaleUpperCase("tr-TR") !== "SİL"; });
      q("[data-sp-confirm-no]").addEventListener("click", () => m.remove());
      yes.addEventListener("click", () => {
        yes.disabled = true; inp.disabled = true; q("[data-sp-confirm-no]").disabled = true;
        Promise.resolve(opts.onAlbumPurge(t => { msg.textContent = t; })).then(r => {
          opts.albumInfo = Object.assign({}, opts.albumInfo, { purged_at: new Date().toISOString(), files: 0, is_open: false });
          $("[data-sp-ret]").innerHTML = retentionHTML(opts.albumInfo);
          const set = root.querySelector(".sp-ret-set"); if (set) set.remove();
          const dz = root.querySelector(".sp-danger"); if (dz) dz.innerHTML = `<p class="sp-note">✓ ${Number(r && r.deletedFiles || 0)} dosya depodan silindi, albüm kayıtları temizlendi.</p>`;
          m.remove();
        }).catch(err => {
          msg.className = "sp-note sp-warn";
          msg.textContent = "Silme tamamlanamadı: " + ((err && (err.code === "AUTH_REQUIRED" ? "Studio SEOZ girişi gerekli." : err.message)) || "bilinmeyen hata") + " Albüm kayıtları silinmedi; tekrar deneyebilirsiniz.";
          q("[data-sp-confirm-no]").disabled = false; q("[data-sp-confirm-no]").textContent = "Kapat";
        });
      });
    });
    const sync = () => { $("[data-sp-t]").textContent = $("[data-sp-title]").value || title; $("[data-sp-d]").textContent = $("[data-sp-desc]").value || defDesc; $("[data-sp-wa]").href = waLink(opts.shortUrl); counts(); };
    // Kartta tamamı görünsün diye önerilen uzunluklar: başlık ≤ 60, açıklama ≤ 110 karakter
    function counts() {
      const c = (el, n, max) => { const k = $(el).value.length; $(n).textContent = k + " / " + max + (k > max ? " — kartta kısalabilir" : ""); $(n).classList.toggle("sp-over", k > max); };
      c("[data-sp-title]", "[data-sp-tc]", 60); c("[data-sp-desc]", "[data-sp-dc]", 110);
    }
    root.addEventListener("input", sync); counts();
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
