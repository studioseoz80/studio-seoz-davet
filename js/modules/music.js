/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — modules/music.js
   Müzik modülü: yuvarlak bir oynat/durdur butonu. Hem editörde hem
   yayınlanan sayfada aynı şekilde çalışır — tıklanınca modüle atanmış
   müziği çalar/duraklatır, ikon Play/Pause durumuna göre değişir.
   Yayında, davetli açılış ekranına (zarf/sinematik açılış) dokunduğunda
   müzik aynı dokunuşla başlatılmaya çalışılır (bkz. SeozMusic, view-app.js);
   tarayıcı izin vermezse misafir nota düğmesiyle başlatır.
   ========================================================================= */

(function (global) {
  "use strict";
  // Davetiye dili (TR/EN): misafirin gördüğü metinler. Türkçede metin aynen döner. Bkz. core/invite-i18n.js
  const L = (t, v) => (global.SeozInviteI18n ? global.SeozInviteI18n.L(t, v) : String(t).replace(/\{(\w+)\}/g, (m, k) => (v && v[k] != null ? v[k] : m)));

  const DEFAULTS = {
    audioSrc: "",
    // MADDE 6: yuvarlak arka plan/buton KALDIRILDI — yalnızca zarif bir
    // müzik notası ikonu var. Eski "bgColor"/"iconColor"/"size" alanları
    // (geriye dönük uyumluluk için silinmedi, eski kayıtlarda durabilir
    // ama artık okunmuyor) yerine nota kendisine özel ayarlar:
    noteColor: "#93703F",
    noteSize: 30,
    metallic: "none"
  };

  const SETTINGS_SCHEMA = [
    { key: "audioSrc", type: "file-audio", label: "Müzik Dosyası" },
    { key: "noteColor", type: "color", label: "Nota Rengi" },
    { key: "noteSize", type: "number", label: "Nota Boyutu", unit: "px", min: 16 },
    {
      key: "metallic", type: "select", label: "Nota Metalik Efekti",
      options: [{ value: "none", label: "Yok" }, { value: "gold", label: "Altın (Koyu Zemin)" }, { value: "silver", label: "Gümüş (Koyu Zemin)" }, { value: "copper-gold", label: "Bakır Altın (Açık Zemin)" }, { value: "dark-silver", label: "Koyu Gümüş (Açık Zemin)" }, { value: "copper", label: "Bakır" }]
    }
  ];

  // MADDE 6: metalik efekt seçiliyse notaya da (metin katmanlarındaki AYNI
  // gradyan) uygulanır: sol anahtarı şekli bir MASKE olur, arkasına gradyan konur;
  // aksi halde düz noteColor kullanılır.
  function noteFillStyle(s) {
    const g = global.SeozRenderer && global.SeozRenderer.METALLIC_GRADIENTS;
    return (g && g[s.metallic]) || null;
  }

  /* SOL ANAHTARI (𝄞) — VEKTÖR YOL.
     DÜZELTME (müzik butonu kesiliyordu / metalik nota görünmüyordu): Eskiden şekil bir
     yazı tipi karakteriydi (<text>𝄞</text>). (1) Karakter 24'lük kutudan taşıyordu ve
     SVG taşanı kestiği için nota üstten/alttan kesiliyordu; telefonlarda farklı yazı tipi
     devreye girince daha da büyüyordu. (2) Metalik seçenekte şekil bir maske resmi olarak
     kullanılır; resim içinde yazı tipi yüklenmediği için nota hiç görünmüyordu.
     Artık şekil, kutunun %92'sine ortalanmış sabit bir vektör yoldur (GNU FreeSerif'in
     sol anahtarı çiziminden; yazı tipi istisnası kapsamında): her cihazda aynı görünür,
     taşmaz, metalik maskede de çizilir. */
  const CLEF_PATH = "M13.91 17.61Q14.47 19.55 14.47 20.8Q14.47 21.78 13.78 22.41Q13.09 23.04 12.11 23.04Q11.18 23.04 10.5 22.49Q9.81 21.95 9.81 21.17Q9.81 20.61 10.19 20.12Q10.57 19.63 11.12 19.63Q11.67 19.63 12.01 20.03Q12.35 20.43 12.35 20.95Q12.35 22.09 11.05 22.09Q11.39 22.61 12.13 22.61Q12.41 22.61 12.7 22.53Q12.98 22.45 13.3 22.24Q13.61 22.04 13.81 21.6Q14 21.17 14 20.56Q14 20.17 13.48 17.76Q13.08 17.87 12.46 17.87Q10.67 17.87 9.38 16.53Q8.09 15.2 8.09 13.34Q8.09 12.7 8.3 12.03Q8.51 11.36 8.78 10.85Q9.05 10.34 9.58 9.7Q10.11 9.06 10.47 8.68Q10.83 8.3 11.48 7.65Q11.05 6.13 11.05 4.87Q11.05 3.2 11.67 2.08Q12.28 0.96 12.89 0.96Q13.08 0.96 13.31 1.2Q13.54 1.44 13.76 1.87Q13.98 2.29 14.14 2.99Q14.3 3.69 14.3 4.48Q14.3 7.43 12.2 9.36L12.69 11.55Q12.98 11.49 13.22 11.49Q14.35 11.49 15.13 12.41Q15.91 13.33 15.91 14.64Q15.91 16.83 13.91 17.61ZM13.76 3.82Q13.76 2.8 13.17 2.8Q12.5 2.8 12.04 3.78Q11.57 4.76 11.57 5.97Q11.57 6.74 11.81 7.32Q12.52 6.89 13.14 5.79Q13.76 4.69 13.76 3.82ZM15.1 15.27Q15.1 14.25 14.5 13.64Q13.91 13.03 12.96 13.03L13.8 17.22Q15.1 16.68 15.1 15.27ZM13.41 17.33 12.56 13.07Q12.06 13.18 11.64 13.68Q11.22 14.18 11.22 14.72Q11.22 14.99 11.33 15.26Q11.44 15.53 11.6 15.72Q11.76 15.9 11.93 16.05Q12.09 16.2 12.2 16.26Q12.32 16.33 12.32 16.33L12.17 16.42Q11.56 16.25 11.01 15.68Q10.46 15.11 10.46 14.23Q10.46 13.36 11.01 12.63Q11.56 11.9 12.22 11.66L11.89 9.67Q8.98 12.1 8.98 14.36Q8.98 15.72 10 16.63Q11.02 17.53 12.32 17.53Q12.63 17.53 13.41 17.33Z";
  /* Müzik kapalıyken anahtarın üzerinde ince bir çizgi (sessiz); açıkken çizgi yok + hafif nabız. */
  const MUTE_LINE = '<path d="M18.6 4.6 L5.4 19.4" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" fill="none"/>';
  function noteSVG(size, color, muted) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" style="display:block;overflow:visible;max-width:100%;max-height:100%;color:${color}"><path fill="${color}" d="${CLEF_PATH}"/>${muted ? MUTE_LINE.replace("currentColor", color) : ""}</svg>`;
  }
  const maskUrl = muted => `url("data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#000" d="${CLEF_PATH}"/>${muted ? MUTE_LINE.replace("currentColor", "#000") : ""}</svg>`)}")`;

  /* ---------------------------------------------------------------------------
     ORTAK MÜZİK ÇALAR (SeozMusic) — her müzik dosyası için TEK bir <audio>.
     - Sayfa yeniden çizilse de (telefon yan çevrilince, editörde her değişiklikte)
       aynı ses öğesi kullanılır: müzik üst üste binmez, baştan başlamaz.
     - Zarf/açılış ekranına dokunulduğunda (view-app.js) aynı dokunuşla müzik
       başlatılmaya çalışılır (iPhone/Android yalnızca dokunuş anında izin verir).
       Tarayıcı izin vermezse sessizce vazgeçilir; misafir nota düğmesiyle başlatır.
     - Misafir müziği kapattıysa hiçbir şey onu kendiliğinden yeniden açmaz.
     --------------------------------------------------------------------------- */
  const Music = global.SeozMusic || (global.SeozMusic = (function () {
    const players = new Map();
    function get(src) {
      let p = players.get(src);
      if (p) return p;
      const a = document.createElement("audio");
      a.loop = true; a.preload = "auto";
      a.setAttribute("playsinline", ""); a.setAttribute("webkit-playsinline", "");
      p = { audio: a, src, ready: false, wantPlay: false, userPaused: false, uis: new Set() };
      const setSrc = url => { if (!url) return; a.src = url; p.ready = true; if (p.wantPlay && !p.userPaused) tryPlay(p); };
      if (global.SeozBlobStore && global.SeozBlobStore.isRef && global.SeozBlobStore.isRef(src)) global.SeozBlobStore.resolveToObjectURL(src).then(setSrc);
      else setSrc(src);   // http adresi: hemen hazır (dokunuş anında çalabilsin)
      const sync = () => { p.uis.forEach(fn => { if (!fn()) p.uis.delete(fn); }); };
      ["play", "playing", "pause", "ended"].forEach(ev => a.addEventListener(ev, sync));
      players.set(src, p);
      return p;
    }
    function tryPlay(p) {
      p.wantPlay = false;
      try { const r = p.audio.play(); if (r && r.catch) r.catch(() => { /* tarayıcı izin vermedi: misafir düğmeyle başlatır */ }); } catch (e) { /* aynı */ }
    }
    function musicLayer(doc) {
      return (doc && Array.isArray(doc.layers) ? doc.layers : []).find(l => l && l.type === "module" && l.moduleId === "music" && l.settings && l.settings.audioSrc) || null;
    }
    /* Belge açılır açılmaz: ses öğesi hazırlanır (adres önceden yüklenir). */
    function prepare(doc) { const l = musicLayer(doc); return l ? get(l.settings.audioSrc) : null; }
    /* Kullanıcı dokunuşu içinden çağrılır: müzik henüz çalmıyorsa ve misafir kapatmadıysa BİR KEZ başlatır. */
    function startFromGesture(doc) {
      const p = prepare(doc);
      if (!p || p.userPaused || !p.audio.paused) return false;
      if (p.ready) tryPlay(p); else p.wantPlay = true;
      return true;
    }
    function toggle(p) {
      if (p.audio.paused) { p.userPaused = false; if (p.ready) tryPlay(p); else p.wantPlay = true; }
      else { p.userPaused = true; p.wantPlay = false; p.audio.pause(); }
    }
    return { get, prepare, startFromGesture, toggle, musicLayer };
  })());

  function render(settings, mode) {
    const s = Object.assign({}, DEFAULTS, settings);
    const size = Math.max(16, Number(s.noteSize) || DEFAULTS.noteSize);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("aria-label", L("Müziği aç/kapat"));
    // Görsel olarak yuvarlak arka plan/buton YOK (şeffaf). Kutunun tamamı düğme
    // sayılır; ancak YAYINDA yalnızca nota ve çevresindeki rahat dokunma alanı
    // tıklanır — böylece büyük, şeffaf kutu alttaki başka düğmeleri/yazıları kapatmaz.
    Object.assign(btn.style, {
      width: "100%",
      height: "100%",
      background: "transparent",
      border: "none",
      padding: "0",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: s.audioSrc ? "pointer" : "default",
      pointerEvents: mode === "view" ? "none" : "auto",
      WebkitTapHighlightColor: "transparent"
    });

    const iconHost = document.createElement("span");
    Object.assign(iconHost.style, {
      display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
      maxWidth: "100%", maxHeight: "100%",
      minWidth: "44px", minHeight: "44px",            // parmakla rahat basılsın (nota küçük olsa bile)
      transition: "opacity .2s ease, transform .2s ease",
      pointerEvents: "auto", opacity: ".55"
    });
    const glyph = document.createElement("span");
    glyph.style.display = "block";
    glyph.style.maxWidth = "100%";
    iconHost.appendChild(glyph);
    const gradient = noteFillStyle(s);
    function paint(playing) {
      const muted = !playing;
      if (gradient) {
        // Metalik: şekil maske, arkasında metin katmanlarıyla AYNI gradyan
        Object.assign(glyph.style, { width: size + "px", height: size + "px", background: gradient,
          WebkitMaskImage: maskUrl(muted), maskImage: maskUrl(muted), WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
          WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskPosition: "center", maskPosition: "center" });
      } else {
        glyph.innerHTML = noteSVG(size, s.noteColor, muted);
      }
      iconHost.style.opacity = playing ? "1" : ".55";
      iconHost.style.animation = playing ? "seozNotePulse 1.6s ease-in-out infinite" : "none";
      btn.setAttribute("aria-pressed", playing ? "true" : "false");
      btn.dataset.playing = playing ? "1" : "0";
    }
    paint(false);
    btn.appendChild(iconHost);

    if (s.audioSrc) {
      const p = Music.get(s.audioSrc);
      // Aynı ses öğesi yeni düğmeye taşınır (Tema sunumları <audio>'yu düğmenin içinde arar).
      btn.appendChild(p.audio);
      p.uis.add(() => { if (!btn.isConnected && btn.dataset.drawn) return false; paint(!p.audio.paused); return true; });   // eski (silinmiş) düğmeler listeden düşer
      paint(!p.audio.paused);
      btn.addEventListener("click", () => Music.toggle(p));
    }

    // YAYIN: nota tuvalin dışına ya da telefonun çentik/kenar boşluğuna taşarsa içeri alınır
    // (kutunun konumu değişmez; yalnızca nota görünür alana kaydırılır).
    const later = global.requestAnimationFrame || (f => setTimeout(f, 16));
    later(() => { btn.dataset.drawn = "1"; });
    if (mode === "view") {
      const fit = () => {
        const canvas = btn.closest(".seoz-canvas");
        if (!canvas || !btn.isConnected) return;
        iconHost.style.left = "0px"; iconHost.style.top = "0px";
        const cr = canvas.getBoundingClientRect(), ir = iconHost.getBoundingClientRect();
        const scale = canvas.offsetWidth ? cr.width / canvas.offsetWidth : 1;
        const probe = document.createElement("div");
        probe.style.cssText = "position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right);padding-top:env(safe-area-inset-top)";
        document.body.appendChild(probe);
        const ps = getComputedStyle(probe), safeL = parseFloat(ps.paddingLeft) || 0, safeR = parseFloat(ps.paddingRight) || 0, safeT = parseFloat(ps.paddingTop) || 0;
        probe.remove();
        const minX = Math.max(cr.left, safeL) + 2, maxX = Math.min(cr.right, global.innerWidth - safeR) - 2;
        const minY = Math.max(cr.top, safeT - global.scrollY) + 2, maxY = cr.bottom - 2;
        let dx = 0, dy = 0;
        if (ir.left < minX) dx = minX - ir.left; else if (ir.right > maxX) dx = maxX - ir.right;
        if (ir.top < minY) dy = minY - ir.top; else if (ir.bottom > maxY) dy = maxY - ir.bottom;
        if (dx || dy) { iconHost.style.left = (dx / scale) + "px"; iconHost.style.top = (dy / scale) + "px"; }
      };
      later(() => later(fit));
    }

    return btn;
  }

  global.SeozModuleRegistry.registerModule({
    id: "music",
    label: "Müzik",
    defaultSettings: DEFAULTS,
    defaultLayerSize: { w: 64, h: 64 },
    settingsSchema: SETTINGS_SCHEMA,
    render: render,
    validate: (s) => (!s.audioSrc ? "Müzik: ses dosyası yüklenmemiş." : null)
  });
})(window);
