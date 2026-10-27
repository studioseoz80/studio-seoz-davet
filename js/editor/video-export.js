/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — video-export.js  (⬇ MP4 İNDİR penceresi)
   -----------------------------------------------------------------------------
   Açılışı (Animasyon Stüdyosu, zarf, çift kanat, tek kart) .mp4 olarak indirir.
     Bölüm : Açılış · İç kart · Açılış + iç kart
     Kalite: 1080×1920 (Instagram Reels, dikey) · 720×1280 (daha hızlı, küçük)
     Süre  : otomatik (sahnenin doğal süresi) ya da saniye (ör. 3,5)
     Müzik : davetiyedeki Müzik modülünün dosyası (tarayıcı AAC destekliyorsa)

   Çekim, editörün içinde görünür küçük bir önizleme çerçevesinde (aynı site,
   sunucuya hiçbir şey gitmez) kare kare yapılır; ilerleme gösterilir. Hata,
   eksik ses veya yaklaşık çizilen efektler AÇIKÇA yazılır — sorunlu bir dosya
   "başarılı" diye sunulmaz.
   ========================================================================= */
(function (global) {
  "use strict";
  const FPS = 30, CSS_W = 405, CSS_H = 720;
  const PARTS = { acilis: "Açılış", kart: "İç kart", ikisi: "Açılış + iç kart" };
  const QUALITY = { hd: { w: 1080, h: 1920, label: "1080 × 1920 · Instagram Reels (önerilen)" }, sd: { w: 720, h: 1280, label: "720 × 1280 · daha hızlı, daha küçük dosya" } };
  const SCRIPTS = ["js/export/virtual-clock.js", "js/core/document-model.js", "js/core/layout-engine.js", "js/core/blob-store.js", "js/core/renderer.js",
    "js/core/motion.js", "js/core/media.js", "js/entry-scene.js", "js/cinema/cinema-core.js", "js/cinema/cinema-art.js", "js/cinema/concepts.js",
    "js/cinema/models/door.js", "js/cinema/free.js", "js/modules/module-registry.js", "js/export/frame-compositor.js", "js/export/mp4-mux.js", "js/export/export-runner.js"];
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function supportedType(doc) {
    const e = doc.entry || {};
    if (e.type === "cinema") return !!(e.cinema && ((e.cinema.layers || []).length || e.cinema.preset));
    if (e.type === "png" || e.type === "dual-wing") return !!e.pngSrc;
    if (e.type === "card") return !!e.cardOnlySrc;
    return false;
  }
  function hasMusic(doc) { return (doc.layers || []).some(l => l && l.moduleId === "music" && l.settings && l.settings.audioSrc); }
  function hasCardGuess(doc) {
    const e = doc.entry || {};
    if (e.type === "card") return true;
    if (e.type === "cinema") { const m = (e.cinema && e.cinema.cardMode) || "auto"; return m !== "none" && (!!e.cardSrc || m === "title" || m === "auto"); }
    return !!e.cardSrc;
  }
  function parseSec(v) { const n = parseFloat(String(v || "").replace(",", ".")); return isFinite(n) && n > 0 ? n : null; }
  const fmtSec = s => (Math.round(s * 10) / 10).toString().replace(".", ",");
  const fmtMB = b => (b / 1048576).toFixed(b > 10485760 ? 0 : 1).replace(".", ",");

  /* çekim çerçevesi: aynı siteden srcdoc (yayındaki davetiyenin motoruyla birebir) */
  function makeFrame(host, dpr) {
    return new Promise((res, rej) => {
      const f = document.createElement("iframe");
      f.className = "vx-frame"; f.setAttribute("aria-hidden", "true"); f.tabIndex = -1;
      f.width = CSS_W; f.height = CSS_H;
      f.srcdoc = `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=${CSS_W}">
<link rel="stylesheet" href="css/canvas.css"><link rel="stylesheet" href="css/cinema.css">
<style>html,body{margin:0;width:${CSS_W}px;height:${CSS_H}px;overflow:hidden;background:#000;}</style>
<script>window.__exportDPR=${dpr};<\/script>
${SCRIPTS.map(s => `<script src="${s}"><\/script>`).join("\n")}
</head><body></body></html>`;
      const to = setTimeout(() => rej(new Error("Çekim sayfası açılamadı.")), 20000);
      f.onload = () => {
        clearTimeout(to);
        const w = f.contentWindow;
        if (!w || !w.SeozExportRunner || !w.__vclock) return rej(new Error("Çekim sayfası yüklenemedi (dosyalar eksik)."));
        res(f);
      };
      host.appendChild(f);
    });
  }

  /* bölüm penceresi: sanal saatte [a, b] doğal aralık; bMax'a kadar uzatılabilir */
  function planFor(part, m, sec) {
    const k = m.marks, notes = [];
    const hold = Math.min(isFinite(m.hold) ? m.hold : 60000, 60000);
    let a = 0, b, bMax;
    if (m.type === "card") { a = 0; b = Math.max(k.cardShown || 300, 300) + 3000; bMax = Math.max(b, hold - 60); }
    else if (!m.hasCard || k.cardShown == null) {
      if (part !== "acilis") throw new Error("Bu açılışta iç kart yok; yalnızca “Açılış” indirilebilir.");
      b = k.exitAt != null ? k.exitAt : m.end; bMax = b;
    } else if (part === "acilis") {
      b = m.type === "dual-wing" ? k.cardShown : (k.cardStart != null ? k.cardStart : k.cardShown);
      b = Math.max(b, (k.tapAt || 0) + 300); bMax = b;
    } else {
      const holdEnd = Math.min(k.holdEnd != null ? k.holdEnd : Infinity, k.cardShown + hold) - 60;
      a = part === "kart" ? Math.max(0, (m.type === "dual-wing" ? k.cardShown - 600 : (k.cardStart != null ? k.cardStart : k.cardShown) - 250)) : 0;
      b = Math.min(k.cardShown + 2500, holdEnd); bMax = Math.max(b, holdEnd);
    }
    const N = Math.max(200, b - a);
    let frames, speed = 1;
    if (sec) {
      frames = Math.max(1, Math.round(sec * FPS));
      const want = sec * 1000;
      if (want < N - 20) { speed = N / want; notes.push(`Seçtiğiniz süreye sığması için hareketler ${fmtSec(speed)}× hızlandırıldı (doğal süre ${fmtSec(N / 1000)} sn).`); }
      else if (a + want > bMax + 20) notes.push(`Son ${fmtSec((a + want - bMax) / 1000)} sn, sahnenin son hâli sabit görüntü olarak devam eder.`);
    } else frames = Math.max(1, Math.round(N / 1000 * FPS));
    if (speed > 3) notes.push("Hareketler çok hızlandı; daha uzun bir süre seçmeniz önerilir.");
    return { a, b, bMax, k: speed, frames, notes, natural: N / 1000 };
  }

  function open(doc, o) {
    o = o || {};
    const old = document.querySelector(".vx-root"); if (old) old.remove();
    const root = document.createElement("div");
    root.className = "vx-root"; root.setAttribute("role", "dialog"); root.setAttribute("aria-label", "MP4 indir");
    document.body.appendChild(root);
    const cardOK = hasCardGuess(doc), music = hasMusic(doc), type = (doc.entry || {}).type;
    const st = { part: type === "card" ? "kart" : (o.part || (cardOK ? "ikisi" : "acilis")), q: "hd", dur: "", music: music, busy: false, cancel: false, url: null, frames: [] };
    let onKey;

    function formHTML() {
      const partBtn = (id) => {
        const off = (type === "card" && id !== "kart") || (!cardOK && id !== "acilis");
        const why = type === "card" ? "Tek kartta yalnızca kart vardır" : "Bu açılışta iç kart yok";
        return `<label class="vx-opt${off ? " is-off" : ""}" ${off ? `title="${why}"` : ""}><input type="radio" name="vx-part" value="${id}" ${st.part === id ? "checked" : ""} ${off ? "disabled" : ""}>
          <span><b>${PARTS[id]}</b><small>${id === "acilis" ? "Kapı, zarf ve katman hareketleri" : id === "kart" ? "İç kartın gelişi ve ekranda duruşu" : "Açılıştan iç karta geçiş, tek video"}</small></span></label>`;
      };
      return `
        <div class="vx-sec"><h3>Bölüm</h3><div class="vx-opts">${["acilis", "kart", "ikisi"].map(partBtn).join("")}</div></div>
        <div class="vx-sec"><h3>Kalite</h3><div class="vx-opts vx-opts-col">${Object.keys(QUALITY).map(k => `<label class="vx-opt"><input type="radio" name="vx-q" value="${k}" ${st.q === k ? "checked" : ""}><span><b>${QUALITY[k].label}</b></span></label>`).join("")}</div></div>
        <div class="vx-sec vx-row"><h3>Süre</h3>
          <label class="vx-dur"><input type="text" inputmode="decimal" placeholder="Otomatik" value="${esc(st.dur)}" data-vx-dur aria-label="Video süresi (saniye)"> <span>saniye</span></label>
          <small>Boş bırakırsanız sahnenin doğal süresi kullanılır. Örnek: 3,5</small></div>
        <div class="vx-sec vx-row"><label class="vx-check"><input type="checkbox" data-vx-music ${st.music ? "checked" : ""} ${music ? "" : "disabled"}>
          <span><b>Müziği ekle</b><small>${music ? "Davetiyedeki Müzik modülünün dosyası, baştan itibaren video süresince (sonu yumuşak kısılır)." : "Davetiyede yüklü müzik yok (Modül Ekle → Müzik)."}</small></span></label></div>
        <p class="vx-note">Video, editördeki önizlemeyle aynı motorla kare kare çizilir. İşlem sırasında bu sekmeyi açık tutun. Animasyonun efekt sesleri videoya eklenmez.</p>
        <div class="vx-actions"><button type="button" class="btn btn-gold" data-vx-go>⬇ Videoyu oluştur</button><button type="button" class="btn btn-outline" data-vx-close>Kapat</button></div>`;
    }
    function shell(body) {
      root.innerHTML = `<div class="vx-card"><header class="vx-head"><div><h2>⬇ MP4 İndir</h2><p>${esc((doc.meta && doc.meta.title) || "Davetiye")} · açılış videosu</p></div>
        <button type="button" class="vx-x" data-vx-close aria-label="Kapat">✕</button></header><div class="vx-body">${body}</div></div>`;
    }
    function drawForm(err, info) {
      shell((err ? `<div class="vx-error" role="alert"><b>Video oluşturulamadı.</b> ${esc(err)}</div>` : "") +
        (info ? `<div class="vx-warn" role="status" style="margin-top:14px">${esc(info)}</div>` : "") + formHTML());
    }
    function drawProgress() {
      shell(`<div class="vx-run"><div class="vx-preview" data-vx-host></div>
        <div class="vx-prog"><p class="vx-stage" data-vx-stage>Hazırlanıyor…</p><div class="vx-bar"><i data-vx-bar style="width:0%"></i></div>
          <p class="vx-small" data-vx-detail></p><button type="button" class="btn btn-outline" data-vx-cancel>İptal</button></div></div>`);
    }
    function setProg(stage, frac, detail) {
      const s = root.querySelector("[data-vx-stage]"), b = root.querySelector("[data-vx-bar]"), d = root.querySelector("[data-vx-detail]");
      if (s && stage != null) s.textContent = stage; if (b && frac != null) b.style.width = Math.round(Math.max(0, Math.min(1, frac)) * 100) + "%"; if (d && detail != null) d.textContent = detail;
    }
    function drawResult(r) {
      const partial = !!r.musicNote && st.music;
      const notes = [].concat(r.plan.notes, r.warnings || []);
      shell(`<div class="vx-done">
        <video class="vx-video" src="${r.url}" controls playsinline muted loop></video>
        <div class="vx-info">
          ${partial ? `<div class="vx-warn" role="alert"><b>⚠ Video müziksiz.</b> ${esc(r.musicNote)}</div>` : `<div class="vx-ok" role="status"><b>✓ Video hazır</b> ve doğrulandı.</div>`}
          ${!partial && r.musicNote ? `<p class="vx-small">${esc(r.musicNote)}</p>` : ""}
          <ul class="vx-facts"><li><span>Bölüm</span><b>${PARTS[r.part]}</b></li><li><span>Boyut</span><b>${r.width} × ${r.height}</b></li>
            <li><span>Süre</span><b>${fmtSec(r.seconds)} sn · ${r.frames} kare (30 fps)</b></li><li><span>Ses</span><b>${r.audio ? "Müzik (" + (r.audio.codec === "aac" ? "AAC" : r.audio.codec) + ")" : "Yok"}</b></li>
            <li><span>Dosya</span><b>${fmtMB(r.bytes)} MB · ${r.codec.startsWith("avc1") ? "H.264 MP4" : r.codec}</b></li></ul>
          ${notes.length ? `<div class="vx-notes"><b>Notlar</b><ul>${notes.map(n => `<li>${esc(n)}</li>`).join("")}</ul></div>` : ""}
          ${r.verifyNote ? `<p class="vx-small vx-warn-t">${esc(r.verifyNote)}</p>` : ""}
          <div class="vx-actions"><a class="btn btn-gold" href="${r.url}" download="${esc(r.fileName)}" data-vx-dl>⬇ ${partial ? "Müziksiz MP4'ü indir" : "MP4'ü indir"}</a>
            <button type="button" class="btn btn-outline" data-vx-again>Ayarları değiştir</button><button type="button" class="btn btn-outline" data-vx-close>Kapat</button></div>
        </div></div>`);
    }
    function close() {
      st.cancel = true;
      root.querySelectorAll("iframe").forEach(f => f.remove());
      if (st.url) { const u = st.url; setTimeout(() => URL.revokeObjectURL(u), 60000); }
      root.remove(); document.removeEventListener("keydown", onKey);
      if (o.onClose) o.onClose();
    }
    onKey = e => { if (e.key === "Escape" && !st.busy) close(); };
    document.addEventListener("keydown", onKey);

    function verify(url, r) {
      return new Promise(res => {
        const v = document.createElement("video"); v.muted = true; v.preload = "metadata";
        let done = false;
        const fin = x => { if (done) return; done = true; v.removeAttribute("src"); v.load(); res(x); };
        v.onloadedmetadata = () => {
          const okDur = Math.abs(v.duration - r.seconds) < 0.25, okSize = v.videoWidth === r.width && v.videoHeight === r.height;
          fin(okDur && okSize ? { ok: true } : { ok: false, msg: `Dosya beklenen ölçülerde değil (${v.videoWidth}×${v.videoHeight}, ${fmtSec(v.duration || 0)} sn).` });
        };
        v.onerror = () => fin({ ok: null });
        setTimeout(() => fin({ ok: null }), 10000);
        v.src = url;
      });
    }

    async function run() {
      const q = QUALITY[st.q];
      const sec = st.dur.trim() ? parseSec(st.dur) : null;
      if (st.dur.trim() && (!sec || sec < 0.5 || sec > 60)) { drawForm("Süre 0,5 ile 60 saniye arasında olmalı (örnek: 3,5)."); return; }
      st.busy = true; st.cancel = false;
      drawProgress();
      const host = root.querySelector("[data-vx-host]");
      root.querySelector("[data-vx-cancel]").onclick = () => { st.cancel = true; setProg("İptal ediliyor…"); };
      const dpr = q.w / CSS_W;
      let f1 = null, f2 = null;
      try {
        setProg("Sahne ölçülüyor…", 0.02, "Açılış baştan sona prova ediliyor");
        f1 = await makeFrame(host, dpr);
        const meas = await f1.contentWindow.SeozExportRunner.measure(doc, { onProgress: p => setProg(null, 0.02 + p * 0.06) });
        f1.remove(); f1 = null;
        if (st.cancel) throw new Error("İptal edildi.");
        if (meas.failed) throw new Error(`${meas.failed} katman görseli yüklenemedi. Görselleri kontrol edip tekrar deneyin.`);
        const plan = planFor(st.part, meas, sec);
        setProg("Kareler çiziliyor…", 0.08, `0 / ${plan.frames} kare`);
        f2 = await makeFrame(host, dpr);
        const t0 = performance.now();
        const res = await f2.contentWindow.SeozExportRunner.render(doc, plan, {
          width: q.w, height: q.h, music: st.music, testCodec: o.testCodec,
          cancelled: () => st.cancel,
          onProgress: (p, i, n, what) => {
            if (what === "audio") return setProg("Müzik ekleniyor…", 0.95, "");
            const el = (performance.now() - t0) / 1000, left = i ? el / i * (n - i) : 0;
            setProg("Kareler çiziliyor…", 0.08 + p * 0.86, `${i} / ${n} kare${i > 5 ? ` · yaklaşık ${Math.max(1, Math.round(left))} sn kaldı` : ""}`);
          }
        });
        f2.remove(); f2 = null;
        setProg("Dosya doğrulanıyor…", 0.98, "");
        const blob = new Blob([res.blob], { type: "video/mp4" });
        if (st.url) URL.revokeObjectURL(st.url);
        const url = URL.createObjectURL(blob); st.url = url;
        const r = Object.assign({}, res, { url, plan, part: st.part, bytes: blob.size });
        const vr = await verify(url, r);
        if (vr.ok === false) throw new Error(vr.msg + " Lütfen tekrar deneyin.");
        if (vr.ok === null) r.verifyNote = "Bu tarayıcı oluşturulan videoyu önizleyemedi; dosyayı indirip telefonunuzda kontrol edin.";
        const slug = String((doc.meta && doc.meta.title) || "davetiye").toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "davetiye";
        r.fileName = `${slug}-${st.part === "ikisi" ? "acilis-kart" : st.part}-${q.w}x${q.h}.mp4`;
        st.busy = false; st.last = r;
        if (o.onDone) o.onDone(r);
        drawResult(r);
      } catch (err) {
        st.busy = false;
        [f1, f2].forEach(f => { if (f) f.remove(); });
        const msg = (err && err.message) || String(err);
        if (o.onError) o.onError(msg);
        if (msg === "İptal edildi.") drawForm(null, "İşlem iptal edildi; dosya oluşturulmadı."); else drawForm(msg);
      }
    }

    root.addEventListener("click", e => {
      if (e.target === root && !st.busy) return close();
      const t = e.target.closest("[data-vx-close],[data-vx-go],[data-vx-again]"); if (!t) return;
      if (t.matches("[data-vx-close]")) { if (!st.busy) close(); return; }
      if (t.matches("[data-vx-go]")) return run();
      if (t.matches("[data-vx-again]")) return drawForm();
    });
    root.addEventListener("change", e => {
      const t = e.target;
      if (t.name === "vx-part") st.part = t.value;
      else if (t.name === "vx-q") st.q = t.value;
      else if (t.matches("[data-vx-music]")) st.music = t.checked;
    });
    root.addEventListener("input", e => { if (e.target.matches("[data-vx-dur]")) st.dur = e.target.value; });
    drawForm();
    return { close, root, state: st };
  }

  global.SeozVideoExport = { open, supportedType, planFor };
})(window);
