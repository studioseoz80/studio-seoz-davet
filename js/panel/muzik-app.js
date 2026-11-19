/* =============================================================================
   STUDIO SEOZ — muzik-app.js  (MÜZİĞİMİ YÖNET: muzigim.html#k=GİZLİ-ANAHTAR)
   Müşteri kendi davetiyesinin müziğini yükler, dinler, değiştirir ve siler.
   - Anahtar "#" sonrasındadır (sunucuya / kayıtlara gitmez); işlemlerde başlıkla gönderilir.
   - Durum Supabase'den (music_manage_info) okunur; yükleme ve silme bu sitenin sunucu
     fonksiyonlarıyla yapılır (functions/api/muzik). Dosya türü, boyut ve onay SUNUCUDA denetlenir;
     buradaki denetimler yalnızca kolaylık içindir.
   - Telif onayı verilmeden "Yükle" düğmesi çalışmaz; onay metni sunucudan gelir (tek kaynak).
   ========================================================================= */
(function (global) {
  "use strict";
  const root = document.getElementById("mz-root");
  const cfg = global.SEOZ_SUPABASE_CONFIG || {};
  const base = String(cfg.url || "").replace(/\/+$/, ""), anon = String(cfg.anonKey || "");
  const TOKEN_RE = /^[A-Za-z0-9_-]{20,100}$/;
  const MAX = 10 * 1024 * 1024;
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const mb = n => (n / 1048576).toLocaleString("tr-TR", { maximumFractionDigits: 1 }) + " MB";
  const when = d => { try { return new Date(d).toLocaleString("tr-TR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } };

  function token() {
    const m = String(global.location.hash || "").match(/(?:^#|&)k=([^&]+)/);
    const t = m ? decodeURIComponent(m[1]) : "";
    return TOKEN_RE.test(t) ? t : "";
  }
  const K = token();

  function message(title, text) {
    root.innerHTML = `<div class="pn-message"><div class="pn-brand">STUDIO SEOZ</div><h2>${esc(title)}</h2><p>${esc(text)}</p></div>`;
  }

  async function loadInfo() {
    const r = await fetch(`${base}/rest/v1/rpc/music_manage_info`, {
      method: "POST",
      headers: { apikey: anon, Authorization: "Bearer " + anon, "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: K })
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }

  let info = null, picked = null, busy = false, confirmDelete = false;
  function setMsg(t, cls) { const m = root.querySelector("[data-msg]"); if (m) { m.textContent = t; m.className = "mz-msg" + (cls ? " " + cls : ""); } }

  function render(flash) {
    const has = info.has_music, dis = info.disabled;
    const src = has && !dis ? `/muzik/${encodeURIComponent(info.slug)}?v=${encodeURIComponent(String(info.file_sha256 || "").slice(0, 12))}` : "";
    root.innerHTML = `
      <header class="mz-head">
        <div class="pn-brand">STUDIO SEOZ</div>
        <h1 class="mz-title">Müziğimi Yönet</h1>
        <p class="mz-sub">Davetiyeniz: <a href="/${esc(info.slug)}" target="_blank" rel="noopener">${esc(info.slug)}</a></p>
      </header>
      ${flash ? `<p class="mz-alert ${flash.type}" role="status">${esc(flash.text)}</p>` : ""}
      ${dis ? `<p class="mz-alert warn" role="alert">Bu davetiyenin müziği Studio SEOZ tarafından devre dışı bırakıldı ve misafirlere çalınmıyor. Yeni müzik yüklenemez; mevcut dosyayı silebilirsiniz. Ayrıntı için Studio SEOZ ile iletişime geçin.</p>` : ""}
      <section class="mz-card" aria-labelledby="mz-now">
        <h2 id="mz-now">Davetiyemdeki müzik</h2>
        ${has ? `
          <div class="mz-file"><strong>${esc(info.file_name || "Müzik dosyası")}</strong><span>${info.file_size ? mb(info.file_size) + " · " : ""}${esc(when(info.uploaded_at))}</span></div>
          ${src ? `<audio class="mz-audio" controls preload="none" src="${esc(src)}"></audio>` : ""}
          <div class="mz-actions">
            <button type="button" class="mz-btn danger${confirmDelete ? " confirm" : ""}" data-del ${busy ? "disabled" : ""}>${confirmDelete ? "Evet, müziği sil" : "Müziği Sil"}</button>
          </div>
          ${confirmDelete ? `<p class="mz-muted" style="margin:8px 0 0">Silinen müzik davetiyede hemen çalmayı bırakır ve geri getirilemez.</p>` : ""}`
        : `<p class="mz-muted">Henüz müzik yüklenmedi. Davetiyeniz müziksiz açılır.</p>`}
      </section>
      ${dis ? "" : `
      <section class="mz-card" aria-labelledby="mz-up">
        <h2 id="mz-up">${has ? "Müziği değiştir" : "Müzik yükle"}</h2>
        <p class="mz-muted">Yalnızca MP3, en fazla 10 MB. ${has ? "Yeni dosya yüklenince eskisi silinir." : ""}</p>
        <label class="mz-pick">
          <input type="file" accept=".mp3,audio/mpeg" data-file ${busy ? "disabled" : ""}>
          <span class="mz-pick-icon" aria-hidden="true">♪</span>
          <span class="mz-pick-text"><strong>${picked ? esc(picked.name) : "MP3 dosyası seçin"}</strong><span>${picked ? mb(picked.size) : "Telefonunuzdan veya bilgisayarınızdan"}</span></span>
        </label>
        <label class="mz-consent">
          <input type="checkbox" data-consent ${busy ? "disabled" : ""}>
          <span>${esc(info.consent && info.consent.text)}</span>
        </label>
        <div class="mz-progress" data-progress hidden><i></i></div>
        <button type="button" class="mz-btn primary" data-upload style="width:100%" disabled>${has ? "Yeni Müziği Yükle" : "Müziği Yükle"}</button>
        <p class="mz-msg" data-msg role="status" aria-live="polite"></p>
        ${info.uploads_left_today < 10 ? `<p class="mz-muted" style="margin:6px 0 0">Bugün kalan yükleme hakkı: ${esc(info.uploads_left_today)}</p>` : ""}
      </section>`}
      <p class="mz-foot">Bu bağlantı yalnızca size özeldir; başkalarıyla paylaşmayın. Müzik seçimi ve gerekli izinler sizin sorumluluğunuzdadır. Telif şikâyeti durumunda Studio SEOZ müziği devre dışı bırakabilir.</p>`;
    wire();
  }

  function wire() {
    const file = root.querySelector("[data-file]"), consent = root.querySelector("[data-consent]"), up = root.querySelector("[data-upload]"), msg = root.querySelector("[data-msg]");
    const del = root.querySelector("[data-del]");
    const say = (t, cls) => { if (msg) { msg.textContent = t; msg.className = "mz-msg" + (cls ? " " + cls : ""); } };
    const ready = () => { if (up) up.disabled = busy || !picked || !(consent && consent.checked); };
    if (file) file.addEventListener("change", () => {
      const f = file.files && file.files[0];
      picked = null;
      if (f) {
        if (!/\.mp3$/i.test(f.name) && f.type !== "audio/mpeg") { render(); setMsg("Yalnızca MP3 dosyası yüklenebilir.", "err"); return; }
        if (f.size > MAX) { render(); setMsg("Dosya en fazla 10 MB olabilir.", "err"); return; }
        picked = f;
      }
      const checked = consent && consent.checked;
      render();
      const c2 = root.querySelector("[data-consent]"); if (c2) c2.checked = !!checked;
      const u2 = root.querySelector("[data-upload]"); if (u2) u2.disabled = busy || !picked || !checked;
    });
    if (consent) consent.addEventListener("change", ready);
    if (up) up.addEventListener("click", () => upload(consent && consent.checked, say));
    if (del) del.addEventListener("click", () => {
      if (!confirmDelete) { confirmDelete = true; render(); return; }
      remove();
    });
    ready();
  }

  function upload(consented, say) {
    if (busy || !picked) return;
    if (!consented) { say("Yüklemeden önce kullanım hakkı onayını vermelisiniz.", "err"); return; }
    busy = true; confirmDelete = false;
    const bar = root.querySelector("[data-progress]"), fill = bar && bar.querySelector("i");
    root.querySelectorAll("input,button").forEach(el => { el.disabled = true; });
    if (bar) bar.hidden = false;
    say("Yükleniyor…");
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/muzik/yukle");
    xhr.setRequestHeader("X-Muzik-Anahtar", K);
    xhr.setRequestHeader("X-Onay-Surum", info.consent.version);
    xhr.setRequestHeader("X-Onay-Ozet", info.consent.sha256);
    xhr.setRequestHeader("X-Dosya-Adi", encodeURIComponent(picked.name.slice(0, 120)));
    xhr.setRequestHeader("Content-Type", "audio/mpeg");
    xhr.upload.onprogress = e => { if (e.lengthComputable && fill) fill.style.width = Math.round(e.loaded / e.total * 100) + "%"; };
    xhr.onload = () => {
      let r = null; try { r = JSON.parse(xhr.responseText); } catch (e) { r = null; }
      busy = false;
      if (xhr.status === 200 && r && r.ok) { picked = null; refresh({ type: "ok", text: "Müziğiniz yüklendi. Davetiyenizde artık bu müzik çalar." }); return; }
      if (r && r.error === "invalid_token") { message("Bağlantı geçersiz", "Bu bağlantı yenilenmiş olabilir. Lütfen Studio SEOZ'un size gönderdiği güncel bağlantıyı kullanın."); return; }
      render();
      const m = root.querySelector("[data-msg]"); if (m) { m.textContent = (r && r.message) || "Yükleme yapılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin."; m.className = "mz-msg err"; }
    };
    xhr.onerror = () => { busy = false; render(); setMsg("Yükleme yapılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.", "err"); };
    xhr.send(picked);
  }

  async function remove() {
    busy = true; render();
    let ok = false, r = null;
    try {
      const res = await fetch("/api/muzik/sil", { method: "POST", headers: { "X-Muzik-Anahtar": K } });
      r = await res.json().catch(() => null);
      ok = res.ok && r && r.ok;
    } catch (e) { ok = false; }
    busy = false; confirmDelete = false;
    if (ok) { refresh({ type: "ok", text: "Müzik silindi. Davetiyeniz artık müziksiz açılır." }); return; }
    if (r && r.error === "invalid_token") { message("Bağlantı geçersiz", "Bu bağlantı yenilenmiş olabilir. Lütfen Studio SEOZ'un size gönderdiği güncel bağlantıyı kullanın."); return; }
    render({ type: "warn", text: (r && r.message) || "Müzik silinemedi. Lütfen tekrar deneyin." });
  }

  async function refresh(flash) {
    try { info = await loadInfo(); } catch (e) { message("Sayfa şu anda açılamadı", "İnternet bağlantınızı kontrol edip sayfayı yenileyin."); return; }
    if (!info) { message("Bağlantı geçersiz", "Bu bağlantı yenilenmiş olabilir. Lütfen Studio SEOZ'un size gönderdiği güncel bağlantıyı kullanın."); return; }
    render(flash);
  }

  if (!K || !base) { message("Bağlantı eksik", "Bu sayfayı Studio SEOZ'un size gönderdiği bağlantıyla açın."); return; }
  refresh();
})(window);
