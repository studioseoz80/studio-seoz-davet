/* =============================================================================
   STUDIO SEOZ — export/export-runner.js  (MP4 DIŞA AKTARMA · çekim)
   -----------------------------------------------------------------------------
   Editörün gizli çerçevesinde (video-cikti) çalışır. İki adım:

   1) measure(): sahneyi sanal saatle hızlıca baştan sona "prova" eder ve
      önemli anları ölçer: açılışın başladığı an, iç kartın gelmeye başladığı
      an, kartın tamamen göründüğü an, kartın ekranda kalma süresi.
   2) render(): aynı sahneyi (aynı rastgele tohumla) kare kare oynatır, her
      kareyi frame-compositor ile çizer, WebCodecs ile H.264'e (ses: AAC)
      kodlar ve mp4-mux ile .mp4 dosyası üretir.

   Hiçbir şey sunucuya gönderilmez; bütün iş tarayıcıda yapılır.
   ========================================================================= */
(function (W) {
  "use strict";
  const C = W.__vclock;
  const FPS = 30, STEP = 1000 / FPS;
  const TAP_AT = 1200;   // eski giriş türlerinde "dokunuş" anı (misafir sahneyi görür, sonra açar)
  const realWait = ms => new Promise(r => C.real.setTimeout(r, ms));

  /* ---------------- sahne ---------------- */
  function prepDoc(doc) {
    const d = JSON.parse(JSON.stringify(doc));
    const e = d.entry || (d.entry = { type: "none" });
    if (e.type === "cinema" && e.cinema) {
      e.cinema.sound = false;            // efekt sesleri çekim sırasında çalmasın
      e.cinema.start = "auto";           // açılış kendiliğinden başlar
      e.cinema.lite = !!e.cinema.lite;
      // dokunma dışı kapılar (çekme, kaydırma, basılı tutma) videoda kendiliğinden geçilir
      ["actions", "exitActions"].forEach(k => (e.cinema[k] || []).forEach(a => { if (a && (a.start === "pull" || a.start === "swipe" || a.start === "hold")) a.start = "tap"; }));
    }
    return d;
  }
  function startScene(doc) {
    const e = doc.entry;
    const sc = { type: e.type, marks: { tapAt: null, cardStart: null, cardShown: null, holdEnd: null, exitAt: null }, overlay: null, ready: null, errors: [] };
    if (e.type === "cinema") {
      if (W.SeozRenderer && W.SeozRenderer.setMotion) W.SeozRenderer.setMotion(doc.motion || null);
      let phase = "loading", hintSince = null;
      const hd = W.SeozCinema.play(doc, () => {}, {
        reduced: false,
        onPhase: p => {
          phase = p;
          if (p === "opening" && sc.marks.tapAt == null) { sc.marks.tapAt = C.now; if (C.cardMark) C.cardMark.after = C.now; }
          if (p === "card" && sc.marks.cardShown == null) sc.marks.cardShown = C.now;
          if (p === "exit" && sc.marks.exitAt == null) sc.marks.exitAt = C.now;
        }
      });
      sc.hd = hd; sc.overlay = hd.overlay;
      const hasCard = () => !!(hd.ctx && hd.ctx.hasCard);
      sc.ready = hd.ready.then(() => {
        const cr = hd.ctx && (hd.ctx.cardWrap || hd.ctx.cardEl);
        C.cardMark = { at: null, after: null, test: el => !!cr && C.cardMark.after != null && (cr === el || cr.contains(el)) };
        sc.hasCard = hasCard();
      }).then(() => (W.SeozModel3D ? W.SeozModel3D.ready(hd.overlay) : true));   // 3D modeller açılana kadar bekle
      // ara kapılarda (dokunarak devam) misafirin dokunuşu taklit edilir
      sc.tick = () => {
        const hint = hd.overlay.querySelector(".sc-hint");
        const waiting = (phase === "opening" || phase === "attention") && hint && hint.style.display !== "none" && getComputedStyle(hint).display !== "none";
        if (!waiting) { hintSince = null; return; }
        if (hintSince == null) hintSince = C.now;
        else if (C.now - hintSince >= 900) { hintSince = null; hd.overlay.dispatchEvent(new MouseEvent("click", { bubbles: true })); }
      };
      sc.cardStartNow = () => (C.cardMark && C.cardMark.at != null ? C.cardMark.at : null);
      sc.hold = e.cardDisplayDuration === "tap" ? Infinity : Math.max(1, Number(e.cardDisplayDuration) || 10) * 1000;
    } else {
      W.SeozEntryScene.play(doc, () => {});
      const ov = document.querySelector(".seoz-entry-overlay");
      sc.overlay = ov;
      const media = Array.from(ov.querySelectorAll("img, video"));
      sc.ready = Promise.all(media.map(m => m.tagName === "IMG"
        ? new Promise(r => { if (m.complete && m.naturalWidth) r(); else { m.addEventListener("load", r, { once: true }); m.addEventListener("error", r, { once: true }); C.real.setTimeout(r, 15000); } })
        : new Promise(r => { if (m.readyState >= 2) r(); else { m.addEventListener("loadeddata", r, { once: true }); m.addEventListener("error", r, { once: true }); C.real.setTimeout(r, 15000); } })))
        .then(() => realWait(30));
      sc.hasCard = e.type === "card" ? true : !!e.cardSrc;
      sc.hold = e.cardDisplayDuration === "tap" ? Infinity : Math.max(1, Number(e.cardDisplayDuration) || 10) * 1000;
      let tapped = false;
      const card = () => ov.querySelector(e.type === "card" ? ".seoz-entry-card-only" : (e.type === "dual-wing" ? ".seoz-entry-card-inline" : ".seoz-entry-card"));
      const busy = el => !!el && el.getAnimations().some(a => a.playState !== "finished" && (a.effect && isFinite(a.effect.getComputedTiming().endTime)));
      sc.tick = () => {
        if (e.type === "card") {
          if (sc.marks.cardStart == null) sc.marks.cardStart = 0;
          if (sc.marks.cardShown == null && !busy(card()) && C.now >= 300) sc.marks.cardShown = C.now;
          return;
        }
        if (!tapped && C.now >= TAP_AT) { tapped = true; sc.marks.tapAt = C.now; ov.dispatchEvent(new MouseEvent("click", { bubbles: true })); return; }
        if (!tapped) return;
        const c = card();
        if (e.type === "png") {
          if (sc.marks.cardStart == null && c && c.classList.contains("emerging")) sc.marks.cardStart = C.now;
          if (sc.marks.cardStart != null && sc.marks.cardShown == null && C.now > sc.marks.cardStart && !busy(c)) sc.marks.cardShown = C.now;
          if (c && c.classList.contains("leaving") && sc.marks.holdEnd == null) sc.marks.holdEnd = C.now;
        } else if (e.type === "dual-wing") {
          const wings = Array.from(ov.querySelectorAll(".seoz-entry-wing"));
          if (sc.marks.cardShown == null && C.now > sc.marks.tapAt + 100 && !wings.some(busy)) { sc.marks.cardShown = C.now; sc.marks.cardStart = sc.marks.cardShown; }
          if (c && c.classList.contains("leaving") && sc.marks.holdEnd == null) sc.marks.holdEnd = C.now;
        }
        if (!document.body.contains(ov) && sc.marks.exitAt == null) sc.marks.exitAt = C.now;
      };
      sc.cardStartNow = () => sc.marks.cardStart;
    }
    return sc;
  }

  /* ---------------- 1) prova: anları ölç ---------------- */
  async function measure(doc, o) {
    o = o || {};
    C.seed(0x5e02);
    const d = prepDoc(doc);
    const sc = startScene(d);
    await sc.ready;
    const LIMIT = 45000;
    while (C.now < LIMIT) {
      await C.advanceTo(C.now + STEP);
      if (sc.tick) sc.tick();
      if (sc.cardStartNow && sc.marks.cardStart == null && sc.cardStartNow() != null) sc.marks.cardStart = sc.cardStartNow();
      const m = sc.marks;
      if (m.exitAt != null) break;
      if (m.cardShown != null && C.now > m.cardShown + 2600) break;
      if (!sc.hasCard && m.tapAt != null && C.now > m.tapAt + 15000) break;
      if (o.onProgress) o.onProgress(Math.min(1, C.now / 12000));
    }
    const m = sc.marks;
    if (m.cardShown != null && m.cardStart == null) m.cardStart = Math.max(m.tapAt || 0, m.cardShown - 1300);
    const res = { type: sc.type, hasCard: !!sc.hasCard, marks: m, hold: sc.hold, end: C.now, log: C.log.slice(0, 5), failed: sc.overlay && sc.overlay.dataset ? Number(sc.overlay.dataset.scFailed || 0) : 0 };
    return res;
  }

  /* ---------------- kodlayıcılar ---------------- */
  async function pickVideoCodec(w, h, test) {
    if (typeof W.VideoEncoder === "undefined") return { error: "Bu tarayıcı video kodlamayı (WebCodecs) desteklemiyor. Google Chrome, Microsoft Edge veya Safari'nin güncel sürümüyle tekrar deneyin." };
    const bitrate = w * h >= 1080 * 1920 ? 10_000_000 : 5_000_000;
    const cands = test === "vp9" ? [{ codec: "vp09.00.40.08", kind: "vp9" }] : [
      { codec: "avc1.640028", kind: "avc" }, { codec: "avc1.4d0028", kind: "avc" }, { codec: "avc1.420028", kind: "avc" }, { codec: "avc1.640033", kind: "avc" }];
    for (const c of cands) {
      for (const hw of ["no-preference", "prefer-software"]) {
        const cfg = { codec: c.codec, width: w, height: h, bitrate, framerate: FPS, hardwareAcceleration: hw, latencyMode: c.kind === "vp9" ? "realtime" : "quality" };
        if (c.kind === "avc") cfg.avc = { format: "avc" };
        try { const s = await W.VideoEncoder.isConfigSupported(cfg); if (s && s.supported) return { cfg, kind: c.kind }; } catch (e) { /* sıradaki */ }
      }
    }
    return { error: "Bu tarayıcı H.264 (MP4) video kodlamayı desteklemiyor. Google Chrome, Microsoft Edge veya Safari'nin güncel sürümüyle tekrar deneyin." };
  }
  async function pickAudioCodec(rate, ch, test) {
    if (typeof W.AudioEncoder === "undefined") return null;
    const list = test === "vp9" ? [{ codec: "opus", kind: "opus" }, { codec: "mp4a.40.2", kind: "aac" }] : [{ codec: "mp4a.40.2", kind: "aac" }];
    for (const c of list) {
      for (const r of [rate, 48000, 44100]) {
        const cfg = { codec: c.codec, sampleRate: r, numberOfChannels: ch, bitrate: 160000 };
        try { const s = await W.AudioEncoder.isConfigSupported(cfg); if (s && s.supported) return { cfg, kind: c.kind }; } catch (e) { /* sıradaki */ }
      }
    }
    return null;
  }
  /* müzik: davetiyedeki Müzik modülünün dosyası, baştan itibaren video süresi kadar (son 0,8 sn yumuşak kısılır) */
  async function decodeMusic(doc) {
    const L = (doc.layers || []).find(l => l && l.moduleId === "music" && l.settings && l.settings.audioSrc);
    if (!L) return { none: true };
    const url = await W.SeozBlobStore.resolveToObjectURL(L.settings.audioSrc);
    if (!url) return { error: "Müzik dosyası bu tarayıcıda bulunamadı." };
    const buf = await (await fetch(url)).arrayBuffer();
    const AC = W.OfflineAudioContext || W.webkitOfflineAudioContext;
    const ac = new AC(2, 1, 48000);
    const audio = await new Promise((res, rej) => { const p = ac.decodeAudioData(buf, res, rej); if (p && p.then) p.then(res, rej); });
    return { audio };
  }
  async function encodeAudio(audio, seconds, codec, mux) {
    const rate = codec.cfg.sampleRate, ch = codec.cfg.numberOfChannels;
    // istenen örnekleme hızına çevir (OfflineAudioContext ile)
    const frames = Math.ceil(seconds * rate);
    const ctx = new W.OfflineAudioContext(ch, frames, rate);
    const src = ctx.createBufferSource(); src.buffer = audio;
    const g = ctx.createGain();
    const fade = Math.min(0.8, seconds / 4);
    g.gain.setValueAtTime(1, 0); g.gain.setValueAtTime(1, Math.max(0, seconds - fade)); g.gain.linearRampToValueAtTime(0, seconds);
    src.connect(g); g.connect(ctx.destination); src.start(0);
    const out = await ctx.startRendering();
    let desc = null, err = null, chunks = 0;
    const enc = new W.AudioEncoder({
      output: (chunk, meta) => {
        if (meta && meta.decoderConfig && meta.decoderConfig.description && !desc) desc = new Uint8Array(meta.decoderConfig.description);
        const b = new Uint8Array(chunk.byteLength); chunk.copyTo(b); mux.addAudio(b, chunk.timestamp, chunk.duration || 0); chunks++;
      },
      error: e => { err = e; }
    });
    enc.configure(codec.cfg);
    const N = 1024 * 4;
    for (let i = 0; i < frames; i += N) {
      const n = Math.min(N, frames - i);
      const data = new Float32Array(n * ch);
      for (let c = 0; c < ch; c++) data.set(out.getChannelData(Math.min(c, out.numberOfChannels - 1)).subarray(i, i + n), c * n);
      const ad = new W.AudioData({ format: "f32-planar", sampleRate: rate, numberOfFrames: n, numberOfChannels: ch, timestamp: Math.round(i * 1e6 / rate), data });
      enc.encode(ad); ad.close();
    }
    await enc.flush(); enc.close();
    if (err) throw err;
    return { desc, chunks };
  }

  /* ---------------- 2) çekim ---------------- */
  /* plan: { a, b, bMax, k, frames } (ms, sanal saat) */
  async function render(doc, plan, o) {
    o = o || {};
    const OW = o.width, OH = o.height, cssW = W.innerWidth, cssH = W.innerHeight;
    const vc = await pickVideoCodec(OW, OH, o.testCodec);
    if (vc.error) throw new Error(vc.error);
    const warnings = [];
    let music = null, musicNote = null;
    if (o.music) {
      try {
        const m = await decodeMusic(doc);
        if (m.none) musicNote = "Davetiyede müzik yüklü değil; video sessiz oluşturuldu.";
        else if (m.error) musicNote = m.error + " Video müziksiz oluşturuldu.";
        else {
          const ac = await pickAudioCodec(48000, 2, o.testCodec);
          if (!ac) musicNote = "Bu tarayıcı AAC ses kodlamayı desteklemiyor; video MÜZİKSİZ oluşturuldu. Müzikli video için Chrome veya Edge (Windows/Mac) ya da Safari kullanın.";
          else music = { audio: m.audio, codec: ac };
        }
      } catch (e) { musicNote = "Müzik dosyası okunamadı (" + (e && e.message || e) + "); video müziksiz oluşturuldu."; }
    }
    C.seed(0x5e02);
    const d = prepDoc(doc);
    const sc = startScene(d);
    await sc.ready;
    const comp = W.SeozFrameCompositor.create({ width: OW, height: OH, canvas: o.canvas });

    let vdesc = null, verr = null, vchunks = 0;
    const totalFrames = plan.frames;
    const muxer = W.SeozMp4;
    const pending = [];
    const enc = new W.VideoEncoder({
      output: (chunk, meta) => {
        if (meta && meta.decoderConfig && meta.decoderConfig.description && !vdesc) vdesc = new Uint8Array(meta.decoderConfig.description);
        const b = new Uint8Array(chunk.byteLength); chunk.copyTo(b);
        pending.push({ b, ts: chunk.timestamp, dur: chunk.duration || Math.round(1e6 / FPS), key: chunk.type === "key" }); vchunks++;
      },
      error: e => { verr = e; }
    });
    enc.configure(vc.cfg);

    // başlangıç: pencerenin başına kadar çizmeden ilerle (aynı adımlarla → aynı sahne)
    while (C.now + STEP <= plan.a) {
      if (o.cancelled && o.cancelled()) throw new Error("İptal edildi.");
      await C.advanceTo(C.now + STEP);
      if (sc.tick) sc.tick();
    }
    let frozen = false;
    const perf = { advance: 0, seek: 0, draw: 0, encode: 0 }, pt = () => C.real.perfNow();
    for (let i = 0; i < totalFrames; i++) {
      let t0 = pt();
      if (o.cancelled && o.cancelled()) { try { enc.close(); } catch (e) { /* önemsiz */ } throw new Error("İptal edildi."); }
      if (verr) throw new Error("Video kodlayıcı hata verdi: " + (verr.message || verr));
      const target = plan.a + i * STEP * plan.k;
      if (target > plan.bMax + 0.5) frozen = true;
      if (!frozen) {
        // hızlandırılmış bölümde de ara adımlar atlanmaz (zamanlayıcılar ve parçacıklar doğru işler)
        while (C.now + STEP < target - 0.01) { await C.advanceTo(C.now + STEP); if (sc.tick) sc.tick(); }
        await C.advanceTo(Math.max(C.now, target), { realFrame: true });
        if (sc.tick) sc.tick();
        perf.advance += pt() - t0; t0 = pt();
        // videolar o kareye konumlanır
        const vids = Array.from(sc.overlay.querySelectorAll("video"));
        const ok = await Promise.all(vids.map(v => C.seekVideo(v)));
        if (ok.some(x => !x)) warnings.push("Videolu bir katmanın bazı kareleri tam zamanında çözülemedi.");
        perf.seek += pt() - t0; t0 = pt();
        await comp.render(sc.overlay, cssW, cssH);
        perf.draw += pt() - t0; t0 = pt();
      }
      const vf = new W.VideoFrame(comp.canvas, { timestamp: Math.round(i * 1e6 / FPS), duration: Math.round(1e6 / FPS) });
      enc.encode(vf, { keyFrame: i % (FPS * 2) === 0 });
      vf.close();
      while (enc.encodeQueueSize > 3) await realWait(4);
      perf.encode += pt() - t0;
      if (o.onProgress) o.onProgress((i + 1) / totalFrames, i + 1, totalFrames);
    }
    await enc.flush(); enc.close();
    if (verr) throw new Error("Video kodlayıcı hata verdi: " + (verr.message || verr));
    if (vchunks !== totalFrames) throw new Error(`Video eksik kodlandı (${vchunks}/${totalFrames} kare). Tekrar deneyin.`);
    if (vc.kind === "avc" && !vdesc) throw new Error("Video kodlayıcı H.264 başlık bilgisini vermedi; dosya oluşturulamadı.");

    const seconds = totalFrames / FPS;
    let audioInfo = null, audioChunks = [], audioDesc = null;
    if (music) {
      if (o.onProgress) o.onProgress(1, totalFrames, totalFrames, "audio");
      try {
        const r = await encodeAudio(music.audio, seconds, music.codec, { addAudio: (b, ts, dur) => audioChunks.push({ b, ts, dur }) });
        audioDesc = r.desc;   // gelmezse paketleyici standart AAC-LC yapılandırmasını yazar
        audioInfo = { codec: music.codec.kind, chunks: r.chunks };
        if (!r.chunks) throw new Error("ses parçası üretilmedi");
      } catch (e) { musicNote = "Müzik kodlanamadı (" + (e && e.message || e) + "); video MÜZİKSİZ oluşturuldu."; music = null; audioChunks = []; audioInfo = null; }
    }
    const M = muxer.create({
      video: { codec: vc.kind, width: OW, height: OH, description: vdesc, timescale: 90000 },
      audio: music ? { codec: music.codec.kind, sampleRate: music.codec.cfg.sampleRate, channels: music.codec.cfg.numberOfChannels, bitrate: 160000, description: audioDesc } : null
    });
    pending.forEach(p => M.addVideo(p.b, p.ts, p.dur, p.key));
    audioChunks.forEach(c => M.addAudio(c.b, c.ts, c.dur));
    const bytes = M.finish();
    comp.warnings.forEach(w => warnings.push(w));
    (C.log || []).slice(0, 3).forEach(l => warnings.push("Sahne uyarısı: " + l));
    try { if (sc.hd) sc.hd.destroy(); } catch (e) { /* önemsiz */ }
    return {
      blob: new Blob([bytes], { type: "video/mp4" }), bytes: bytes.length, frames: totalFrames, seconds, width: OW, height: OH,
      codec: vc.cfg.codec, audio: audioInfo, musicNote, warnings: Array.from(new Set(warnings)),
      perf: Object.assign({ frame: comp.perf }, Object.fromEntries(Object.entries(perf).map(([k, v]) => [k, Math.round(v / Math.max(1, totalFrames))])))
    };
  }

  /* kare kare karşılaştırma testi için: sahneyi t anına getir ve çiz */
  async function seekAndDraw(doc, t, o) {
    C.seed(0x5e02);
    const d = prepDoc(doc), sc = startScene(d);
    await sc.ready;
    while (C.now + STEP <= t) { await C.advanceTo(C.now + STEP); if (sc.tick) sc.tick(); }
    await C.advanceTo(t, { realFrame: true });
    await Promise.all(Array.from(sc.overlay.querySelectorAll("video")).map(v => C.seekVideo(v)));
    const comp = W.SeozFrameCompositor.create({ width: o.width, height: o.height, canvas: o.canvas });
    await comp.render(sc.overlay, W.innerWidth, W.innerHeight);
    await C.realFrame(); await C.realFrame();
    return { warnings: Array.from(comp.warnings), sc };
  }

  W.SeozExportRunner = { measure, render, seekAndDraw, FPS };
})(window);
