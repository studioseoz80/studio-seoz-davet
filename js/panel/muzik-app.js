/* =============================================================================
   STUDIO SEOZ — muzik-app.js  (MÜZİĞİMİ YÖNET / MANAGE MY MUSIC: muzigim.html#k=GİZLİ-ANAHTAR)
   Müşteri kendi davetiyesinin müziğini yükler, dinler, değiştirir ve siler.
   - Dil: davetiyenin dili (meta.lang "en" → İngilizce; yoksa Türkçe). Müşteri sağ üstten TR / EN seçebilir;
     seçim bu tarayıcıda hatırlanır. Adreste "&l=en" / "&l=tr" de dili belirler.
   - Onay metni sunucudan gelir (Türkçe ve İngilizce ayrı sürüm adıyla); hangi dil gösterildiyse o metnin
     sürümü + özeti gönderilir ve kayda o yazılır.
   - Anahtar "#" sonrasındadır (sunucuya / kayıtlara gitmez); işlemlerde başlıkla gönderilir.
   - Dosya türü, boyut ve onay SUNUCUDA denetlenir; buradaki denetimler yalnızca kolaylık içindir.
   ========================================================================= */
(function (global) {
  "use strict";
  const root = document.getElementById("mz-root");
  const cfg = global.SEOZ_SUPABASE_CONFIG || {};
  const base = String(cfg.url || "").replace(/\/+$/, ""), anon = String(cfg.anonKey || "");
  const TOKEN_RE = /^[A-Za-z0-9_-]{20,100}$/;
  const MAX = 10 * 1024 * 1024;
  const LANG_KEY = "seoz_muzik_lang_v1";
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const TXT = {
    tr: {
      htmlTitle: "Müziğimi Yönet — Studio SEOZ", title: "Müziğimi Yönet", loading: "Yükleniyor…", yourInv: "Davetiyeniz:",
      now: "Davetiyemdeki müzik", noMusic: "Henüz müzik yüklenmedi. Davetiyeniz müziksiz açılır.", fileFallback: "Müzik dosyası",
      del: "Müziği Sil", delConfirm: "Evet, müziği sil", delNote: "Silinen müzik davetiyede hemen çalmayı bırakır ve geri getirilemez.",
      upTitle: "Müzik yükle", changeTitle: "Müziği değiştir", rules: "Yalnızca MP3, en fazla 10 MB.", replaceNote: "Yeni dosya yüklenince eskisi silinir.",
      pick: "MP3 dosyası seçin", pickSub: "Telefonunuzdan veya bilgisayarınızdan",
      upBtn: "Müziği Yükle", upBtnNew: "Yeni Müziği Yükle", uploading: "Yükleniyor…", left: "Bugün kalan yükleme hakkı: {n}",
      disabled: "Bu davetiyenin müziği Studio SEOZ tarafından devre dışı bırakıldı ve misafirlere çalınmıyor. Yeni müzik yüklenemez; mevcut dosyayı silebilirsiniz. Ayrıntı için Studio SEOZ ile iletişime geçin.",
      okUp: "Müziğiniz yüklendi. Davetiyenizde artık bu müzik çalar.", okDel: "Müzik silindi. Davetiyeniz artık müziksiz açılır.",
      foot: "Bu bağlantı yalnızca size özeldir; başkalarıyla paylaşmayın. Müzik seçimi ve gerekli izinler sizin sorumluluğunuzdadır. Telif şikâyeti durumunda Studio SEOZ müziği devre dışı bırakabilir.",
      missingT: "Bağlantı eksik", missing: "Bu sayfayı Studio SEOZ'un size gönderdiği bağlantıyla açın.",
      invalidT: "Bağlantı geçersiz", invalid: "Bu bağlantı yenilenmiş olabilir. Lütfen Studio SEOZ'un size gönderdiği güncel bağlantıyı kullanın.",
      failT: "Sayfa şu anda açılamadı", fail: "İnternet bağlantınızı kontrol edip sayfayı yenileyin.",
      err: {
        not_mp3: "Yalnızca MP3 dosyası yüklenebilir.", too_large: "Dosya en fazla 10 MB olabilir.",
        consent_required: "Yüklemeden önce kullanım hakkı onayını vermelisiniz.", daily_limit: "Bugünkü yükleme hakkınız doldu. Yarın tekrar deneyin.",
        music_disabled: "Bu davetiyenin müziği Studio SEOZ tarafından devre dışı bırakıldı.", storage_not_ready: "Müzik deposu henüz hazır değil. Lütfen Studio SEOZ ile iletişime geçin.",
        preview: "Önizleme sürümünde yükleme kapalıdır.", upload: "Yükleme yapılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.", del: "Müzik silinemedi. Lütfen tekrar deneyin."
      }
    },
    en: {
      htmlTitle: "Manage My Music — Studio SEOZ", title: "Manage My Music", loading: "Loading…", yourInv: "Your invitation:",
      now: "Music in my invitation", noMusic: "No music uploaded yet. Your invitation opens without music.", fileFallback: "Music file",
      del: "Delete Music", delConfirm: "Yes, delete the music", delNote: "Deleted music stops playing in your invitation immediately and cannot be restored.",
      upTitle: "Upload music", changeTitle: "Change music", rules: "MP3 only, up to 10 MB.", replaceNote: "Uploading a new file deletes the previous one.",
      pick: "Choose an MP3 file", pickSub: "From your phone or computer",
      upBtn: "Upload Music", upBtnNew: "Upload New Music", uploading: "Uploading…", left: "Uploads left today: {n}",
      disabled: "The music for this invitation has been disabled by Studio SEOZ and is not being played to guests. New music cannot be uploaded; you can delete the current file. Please contact Studio SEOZ for details.",
      okUp: "Your music has been uploaded. It will now play in your invitation.", okDel: "Music deleted. Your invitation now opens without music.",
      foot: "This link is private to you; please don't share it. You are responsible for the choice of music and the necessary permissions. In case of a copyright complaint, Studio SEOZ may disable the music.",
      missingT: "Link incomplete", missing: "Please open this page with the link Studio SEOZ sent you.",
      invalidT: "Invalid link", invalid: "This link may have been renewed. Please use the latest link Studio SEOZ sent you.",
      failT: "We couldn't open this page right now", fail: "Please check your internet connection and refresh the page.",
      err: {
        not_mp3: "Only MP3 files can be uploaded.", too_large: "The file can be up to 10 MB.",
        consent_required: "Please confirm the usage rights statement before uploading.", daily_limit: "You've reached today's upload limit. Please try again tomorrow.",
        music_disabled: "The music for this invitation has been disabled by Studio SEOZ.", storage_not_ready: "Music storage isn't ready yet. Please contact Studio SEOZ.",
        preview: "Uploading is disabled in the preview version.", upload: "Upload failed. Please check your internet connection and try again.", del: "The music couldn't be deleted. Please try again."
      }
    }
  };

  function hashParams() {
    const o = {};
    String(global.location.hash || "").replace(/^#/, "").split("&").forEach(p => { const i = p.indexOf("="); if (i > 0) { try { o[p.slice(0, i)] = decodeURIComponent(p.slice(i + 1)); } catch (e) { /* bozuk parça */ } } });
    return o;
  }
  const HP = hashParams();
  const K = TOKEN_RE.test(HP.k || "") ? HP.k : "";
  const sget = k => { try { return global.localStorage.getItem(k); } catch (e) { return null; } };
  const sset = (k, v) => { try { global.localStorage.setItem(k, v); } catch (e) { /* gizli pencere vb. */ } };
  const okLang = l => (l === "en" || l === "tr" ? l : "");
  // Bilgi gelmeden önceki dil (eksik / geçersiz bağlantı mesajları): adres → hatırlanan seçim → tarayıcı dili
  let lang = okLang(HP.l) || okLang(sget(LANG_KEY)) || (/^tr/i.test(global.navigator.language || "") ? "tr" : "en");
  const T = () => TXT[lang];
  const fmt = (t, v) => String(t).replace(/\{(\w+)\}/g, (m, k) => (v && v[k] != null ? v[k] : m));
  const locale = () => (lang === "en" ? "en-GB" : "tr-TR");
  const mb = n => (n / 1048576).toLocaleString(locale(), { maximumFractionDigits: 1 }) + " MB";
  const when = d => { try { return new Date(d).toLocaleString(locale(), { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } };
  function applyLang() { document.documentElement.lang = lang; document.title = T().htmlTitle; }

  function message(kind) {
    applyLang();
    root.innerHTML = `<div class="pn-message"><div class="pn-brand">STUDIO SEOZ</div><h2>${esc(T()[kind + "T"])}</h2><p>${esc(T()[kind])}</p></div>`;
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

  let info = null, picked = null, busy = false, confirmDelete = false, consentChecked = false, langChosen = !!okLang(HP.l) || !!okLang(sget(LANG_KEY));
  function setMsg(t, cls) { const m = root.querySelector("[data-msg]"); if (m) { m.textContent = t; m.className = "mz-msg" + (cls ? " " + cls : ""); } }
  const consentNow = () => (info.consents && info.consents[lang]) || info.consent;
  const errText = code => T().err[code] || "";

  function render(flash) {
    applyLang();
    const t = T(), has = info.has_music, dis = info.disabled, c = consentNow();
    const src = has && !dis ? `/muzik/${encodeURIComponent(info.slug)}?v=${encodeURIComponent(String(info.file_sha256 || "").slice(0, 12))}` : "";
    root.innerHTML = `
      <div class="mz-lang" role="group" aria-label="Language / Dil">
        <button type="button" data-lang="tr" aria-pressed="${lang === "tr"}" lang="tr">TR</button>
        <button type="button" data-lang="en" aria-pressed="${lang === "en"}" lang="en">EN</button>
      </div>
      <header class="mz-head">
        <div class="pn-brand">STUDIO SEOZ</div>
        <h1 class="mz-title">${esc(t.title)}</h1>
        <p class="mz-sub">${esc(t.yourInv)} <a href="/${esc(info.slug)}" target="_blank" rel="noopener">${esc(info.slug)}</a></p>
      </header>
      ${flash ? `<p class="mz-alert ${flash.type}" role="status">${esc(t[flash.key])}</p>` : ""}
      ${dis ? `<p class="mz-alert warn" role="alert">${esc(t.disabled)}</p>` : ""}
      <section class="mz-card" aria-labelledby="mz-now">
        <h2 id="mz-now">${esc(t.now)}</h2>
        ${has ? `
          <div class="mz-file"><strong>${esc(info.file_name || t.fileFallback)}</strong><span>${info.file_size ? mb(info.file_size) + " · " : ""}${esc(when(info.uploaded_at))}</span></div>
          ${src ? `<audio class="mz-audio" controls preload="none" src="${esc(src)}"></audio>` : ""}
          <div class="mz-actions">
            <button type="button" class="mz-btn danger${confirmDelete ? " confirm" : ""}" data-del ${busy ? "disabled" : ""}>${esc(confirmDelete ? t.delConfirm : t.del)}</button>
          </div>
          ${confirmDelete ? `<p class="mz-muted" style="margin:8px 0 0">${esc(t.delNote)}</p>` : ""}`
        : `<p class="mz-muted">${esc(t.noMusic)}</p>`}
      </section>
      ${dis ? "" : `
      <section class="mz-card" aria-labelledby="mz-up">
        <h2 id="mz-up">${esc(has ? t.changeTitle : t.upTitle)}</h2>
        <p class="mz-muted">${esc(t.rules)} ${has ? esc(t.replaceNote) : ""}</p>
        <label class="mz-pick">
          <input type="file" accept=".mp3,audio/mpeg" data-file ${busy ? "disabled" : ""}>
          <span class="mz-pick-icon" aria-hidden="true">♪</span>
          <span class="mz-pick-text"><strong>${picked ? esc(picked.name) : esc(t.pick)}</strong><span>${picked ? mb(picked.size) : esc(t.pickSub)}</span></span>
        </label>
        <label class="mz-consent" lang="${esc(c && c.lang || lang)}">
          <input type="checkbox" data-consent ${consentChecked ? "checked" : ""} ${busy ? "disabled" : ""}>
          <span data-consent-text>${esc(c && c.text)}</span>
        </label>
        <div class="mz-progress" data-progress hidden><i></i></div>
        <button type="button" class="mz-btn primary" data-upload style="width:100%" disabled>${esc(has ? t.upBtnNew : t.upBtn)}</button>
        <p class="mz-msg" data-msg role="status" aria-live="polite"></p>
        ${info.uploads_left_today < 10 ? `<p class="mz-muted" style="margin:6px 0 0">${esc(fmt(t.left, { n: info.uploads_left_today }))}</p>` : ""}
      </section>`}
      <p class="mz-foot">${esc(t.foot)}</p>`;
    wire();
  }

  function wire() {
    const file = root.querySelector("[data-file]"), consent = root.querySelector("[data-consent]"), up = root.querySelector("[data-upload]");
    const del = root.querySelector("[data-del]");
    const ready = () => { if (up) up.disabled = busy || !picked || !consentChecked; };
    root.querySelectorAll("[data-lang]").forEach(b => b.addEventListener("click", () => {
      const l = b.getAttribute("data-lang");
      if (l === lang || busy) return;
      // Dil değişince onay, yeni dilde metin okunarak yeniden verilmelidir
      lang = l; langChosen = true; consentChecked = false; sset(LANG_KEY, l); render();
    }));
    if (file) file.addEventListener("change", () => {
      const f = file.files && file.files[0];
      picked = null;
      if (f) {
        if (!/\.mp3$/i.test(f.name) && f.type !== "audio/mpeg") { render(); setMsg(errText("not_mp3"), "err"); return; }
        if (f.size > MAX) { render(); setMsg(errText("too_large"), "err"); return; }
        picked = f;
      }
      render();
    });
    if (consent) consent.addEventListener("change", () => { consentChecked = consent.checked; ready(); });
    if (up) up.addEventListener("click", upload);
    if (del) del.addEventListener("click", () => {
      if (!confirmDelete) { confirmDelete = true; render(); return; }
      remove();
    });
    ready();
  }

  function upload() {
    if (busy || !picked) return;
    if (!consentChecked) { setMsg(errText("consent_required"), "err"); return; }
    const c = consentNow();
    busy = true; confirmDelete = false;
    const bar = root.querySelector("[data-progress]"), fill = bar && bar.querySelector("i");
    root.querySelectorAll("input,button").forEach(el => { el.disabled = true; });
    if (bar) bar.hidden = false;
    setMsg(T().uploading);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/muzik/yukle");
    xhr.setRequestHeader("X-Muzik-Anahtar", K);
    xhr.setRequestHeader("X-Onay-Surum", c.version);
    xhr.setRequestHeader("X-Onay-Ozet", c.sha256);
    xhr.setRequestHeader("X-Dosya-Adi", encodeURIComponent(picked.name.slice(0, 120)));
    xhr.setRequestHeader("Content-Type", "audio/mpeg");
    xhr.upload.onprogress = e => { if (e.lengthComputable && fill) fill.style.width = Math.round(e.loaded / e.total * 100) + "%"; };
    xhr.onload = () => {
      let r = null; try { r = JSON.parse(xhr.responseText); } catch (e) { r = null; }
      busy = false;
      if (xhr.status === 200 && r && r.ok) { picked = null; consentChecked = false; refresh({ type: "ok", key: "okUp" }); return; }
      if (r && r.error === "invalid_token") { message("invalid"); return; }
      render();
      setMsg(errText(r && r.error) || errText("upload"), "err");
    };
    xhr.onerror = () => { busy = false; render(); setMsg(errText("upload"), "err"); };
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
    if (ok) { refresh({ type: "ok", key: "okDel" }); return; }
    if (r && r.error === "invalid_token") { message("invalid"); return; }
    render();
    const box = root.querySelector(".mz-card");
    if (box) box.insertAdjacentHTML("afterbegin", `<p class="mz-alert warn" role="alert">${esc(errText(r && r.error) || errText("del"))}</p>`);
  }

  async function refresh(flash) {
    try { info = await loadInfo(); } catch (e) { message("fail"); return; }
    if (!info) { message("invalid"); return; }
    if (!langChosen) lang = okLang(info.lang) || lang;     // müşteri seçmediyse davetiyenin dili
    render(flash);
  }

  applyLang();
  root.innerHTML = `<div class="pn-loading">${esc(T().loading)}</div>`;
  if (!K || !base) { message("missing"); return; }
  refresh();
})(window);
