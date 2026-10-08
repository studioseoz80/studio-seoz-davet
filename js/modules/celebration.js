/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — modules/celebration.js
   -----------------------------------------------------------------------------
   Kutlama Efekti modülü: konfeti veya parıltı. Hiçbir etkinliğe (ör.
   doğum günü) kilitli değildir — Aç/Kapa yerine katman olarak eklenir,
   istediğiniz her davetiyede kullanabilirsiniz.

   PERFORMANS GÜVENLİĞİ: Efekt, ekranı geçici olarak kaplayan TEK bir
   <canvas> üzerinde, sınırlı sayıda parçacıkla (yoğunluk ayarına göre en
   fazla 160 parçacık) ~4 saniye çalışır ve kendini TAMAMEN temizler
   (requestAnimationFrame iptal edilir, canvas DOM'dan kaldırılır, resize
   dinleyicisi kaldırılır). Sınırsız/aşırı parçacık sayısı, ağır kütüphane
   veya kalıcı DOM elemanı YOKTUR.

   TETİKLEME:
   - "Sayfa açılışında otomatik": Yayınlanan sayfa yüklendiğinde BİR KEZ
     oynar. Editörde asla otomatik oynamaz (sürekli düzenlerken rahatsız
     etmemesi için) — bunun yerine "▶ Test Et" butonuyla istediğiniz an
     önizleyebilirsiniz. Pencere yeniden boyutlandırıldığında da TEKRAR
     OYNAMAZ (yalnızca gerçek bir sayfa yüklemesinde bir kez).
   - "Bir butona basınca": Konum/RSVP modüllerinde kanıtlanmış desenle,
     buton hem editörde hem yayında aynı şekilde tıklanabilir.
   ========================================================================= */

(function (global) {
  "use strict";

  const DEFAULTS = {
    effectType: "confetti",
    triggerMode: "auto",
    intensity: "orta",
    allowReplay: true,
    buttonText: "Kutlamayı Başlat",
    color1: "#93703F",
    color2: "#C9A97C",
    color3: "#6C7A52",
    color4: "#C99B8E",
    fontFamily: "Manrope",
    textColor: "#FFFFFF",
    bgColor: "#93703F",
    metallic: "none",
    buttonWidth: 200,
    buttonHeight: 46,
    borderRadius: 24
  };

  const SETTINGS_SCHEMA = [
    {
      key: "effectType", type: "select", label: "Efekt Türü",
      options: [{ value: "confetti", label: "Konfeti" }, { value: "sparkle", label: "Parıltı" }]
    },
    {
      key: "triggerMode", type: "select", label: "Tetikleme", reRenderPanel: true,
      options: [{ value: "auto", label: "Sayfa Açılışında Otomatik" }, { value: "button", label: "Bir Butona Basınca" }]
    },
    {
      key: "intensity", type: "select", label: "Yoğunluk",
      options: [{ value: "az", label: "Az" }, { value: "orta", label: "Orta" }, { value: "cok", label: "Çok" }]
    },
    { key: "allowReplay", type: "checkbox", label: "Misafir tekrar oynatabilsin", showIf: s => s.triggerMode === "auto" },
    { key: "buttonText", type: "text", label: "Buton Yazısı", showIf: s => s.triggerMode === "button" },
    { key: "color1", type: "color", label: "Renk 1" },
    { key: "color2", type: "color", label: "Renk 2" },
    { key: "color3", type: "color", label: "Renk 3" },
    { key: "color4", type: "color", label: "Renk 4" },
    { key: "fontFamily", type: "font-select", label: "Buton Fontu", showIf: s => s.triggerMode === "button" },
    { key: "textColor", type: "color", label: "Buton Yazı Rengi", showIf: s => s.triggerMode === "button" },
    { key: "bgColor", type: "color", label: "Buton Rengi", showIf: s => s.triggerMode === "button" },
    {
      key: "metallic", type: "select", label: "Buton Metalik Efekti", showIf: s => s.triggerMode === "button",
      options: [{ value: "none", label: "Yok" }, { value: "gold", label: "Altın (Koyu Zemin)" }, { value: "silver", label: "Gümüş (Koyu Zemin)" }, { value: "copper-gold", label: "Bakır Altın (Açık Zemin)" }, { value: "dark-silver", label: "Koyu Gümüş (Açık Zemin)" }]
    },
    { key: "buttonWidth", type: "number", label: "Buton Genişliği", unit: "px", min: 60, showIf: s => s.triggerMode === "button" },
    { key: "buttonHeight", type: "number", label: "Buton Yüksekliği", unit: "px", min: 30, showIf: s => s.triggerMode === "button" },
    { key: "borderRadius", type: "number", label: "Köşe Yuvarlaklığı", unit: "px", min: 0, showIf: s => s.triggerMode === "button" }
  ];

  function buttonBackground(s) {
    const g = global.SeozRenderer && global.SeozRenderer.METALLIC_GRADIENTS;
    return (g && g[s.metallic]) || s.bgColor;
  }

  const INTENSITY_COUNT = { az: 40, orta: 90, cok: 160 };

  /* ------------------------------------------------------------------
     EFEKTİN KENDİSİ — tam ekran, kendi kendini temizleyen bir katman.
     Modülün canvas'taki KUTUSUNDAN bağımsızdır (bkz. dosya başı notu).

     DÜZELTME (konfeti ekranın ortasında aniden kayboluyordu):
     - Hareket artık KARE sayısına değil ZAMANA bağlı: 60Hz ve 120Hz
       ekranlarda aynı hızda düşer. Her parçacığın konumu, başlangıçtan
       geçen süreden doğrudan hesaplanır (sekme arka plana alınıp geri
       gelince de birikmiş hata oluşmaz).
     - Her parçacığın düşüş süresi, ekranın ALTINA ulaşacak şekilde
       ekran yüksekliğinden hesaplanır — telefon, tablet, masaüstü fark
       etmez. Efekt, son parçacık ekrandan çıkınca biter; güvenlik sınırı
       aşılırsa kalanlar yumuşakça solarak kaybolur (ani kesilme yok).
     - Hafif yerçekimi (hızlanarak düşüş) ve sağa-sola sallanma.
     - Ekran boyutu değişince (mobil adres çubuğu) silme GÜNCEL ölçüyle.
     - Efekt oynarken yeni tetiklemeler yok sayılır (üst üste binmez).
     - "Hareketi azalt" açık cihazlarda kısa ve sade bir sürüm oynar.
     ------------------------------------------------------------------ */
  let effectRunning = false;

  function prefersReducedMotion() {
    try {
      return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch (e) { return false; }
  }

  function playEffect(s) {
    if (effectRunning) return;
    effectRunning = true;

    const overlay = document.createElement("div");
    Object.assign(overlay.style, {
      position: "fixed", inset: "0", zIndex: "6000", pointerEvents: "none"
    });
    const canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    overlay.appendChild(canvas);
    document.body.appendChild(overlay);

    const dpr = window.devicePixelRatio || 1;
    const ctx = canvas.getContext("2d");
    let vw = window.innerWidth;
    let vh = window.innerHeight;

    function resizeCanvas() {
      vw = window.innerWidth;
      vh = window.innerHeight;
      canvas.width = Math.round(vw * dpr);
      canvas.height = Math.round(vh * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resizeCanvas();

    const reduced = prefersReducedMotion();
    const colors = [s.color1, s.color2, s.color3, s.color4].filter(Boolean);
    const isSparkle = s.effectType === "sparkle";
    const baseCount = INTENSITY_COUNT[s.intensity] || INTENSITY_COUNT.orta;
    const count = reduced ? Math.min(24, Math.round(baseCount / 3)) : baseCount;

    // Süreler saniye cinsinden. Normalde parçacıklar 1 sn içinde sırayla
    // başlar ve 2,0–3,0 sn'de ekranın altına iner (toplam ~4 sn).
    const MAX_DELAY = reduced ? 0.3 : 1.0;
    const FALL_MIN = reduced ? 1.4 : 2.0;
    const FALL_RANGE = reduced ? 0.4 : 1.0;
    const HARD_LIMIT = MAX_DELAY + FALL_MIN + FALL_RANGE + 0.6; // güvenlik sınırı
    const FADE = 0.5;

    const particles = [];
    for (let i = 0; i < count; i++) {
      const startY = -12 - Math.random() * 60;
      particles.push({
        x0: Math.random() * vw,
        startY: startY,
        delay: Math.random() * MAX_DELAY,
        fall: FALL_MIN + Math.random() * FALL_RANGE,
        size: isSparkle ? (2 + Math.random() * 3) : (5 + Math.random() * 6),
        swayAmp: reduced ? 0 : (8 + Math.random() * 22),
        swayFreq: 1.2 + Math.random() * 1.8, // rad/sn çarpanı
        drift: (Math.random() - 0.5) * 40,    // px/sn yatay kayma
        color: colors[Math.floor(Math.random() * colors.length)] || "#93703F",
        rot0: Math.random() * 360,
        rotSpeed: reduced ? 0 : (Math.random() - 0.5) * 540, // derece/sn
        phase: Math.random() * Math.PI * 2
      });
    }

    const startTime = performance.now();
    let rafId = null;

    function cleanup() {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resizeCanvas);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      effectRunning = false;
    }

    function tick(now) {
      const t = (now - startTime) / 1000;
      ctx.clearRect(0, 0, vw, vh);

      // Güvenlik sınırına yaklaşınca kalanlar yumuşakça solar.
      const globalFade = t > HARD_LIMIT - FADE ? Math.max(0, (HARD_LIMIT - t) / FADE) : 1;
      let alive = 0;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const lt = t - p.delay;
        if (lt < 0) { alive++; continue; }
        const prog = lt / p.fall;
        // Hafif yerçekimi: yavaş başlar, hızlanarak iner.
        const eased = 0.45 * prog + 0.55 * prog * prog;
        const y = p.startY + (vh + 40 - p.startY) * eased;
        if (y > vh + 20) continue;
        alive++;
        const x = p.x0 + p.drift * lt + p.swayAmp * Math.sin(lt * p.swayFreq * Math.PI + p.phase);

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(((p.rot0 + p.rotSpeed * lt) * Math.PI) / 180);
        ctx.fillStyle = p.color;
        if (isSparkle) {
          const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(lt * 3.8 + p.phase));
          ctx.globalAlpha = twinkle * globalFade;
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Konfeti dönerken ince görünür (3B çevrilme hissi).
          const flip = reduced ? 1 : Math.abs(Math.cos(lt * 4 + p.phase)) * 0.7 + 0.3;
          ctx.globalAlpha = globalFade;
          ctx.fillRect(-p.size / 2, (-p.size / 4) * flip, p.size, (p.size / 2) * flip);
        }
        ctx.restore();
      }

      if (alive > 0 && t < HARD_LIMIT) {
        rafId = requestAnimationFrame(tick);
      } else {
        cleanup();
      }
    }

    window.addEventListener("resize", resizeCanvas);
    rafId = requestAnimationFrame(tick);
  }

  /* Bu sayfa oturumu boyunca "otomatik" tetiklenen katmanları takip eder
     — böylece bir pencere yeniden boyutlandırma (view-app.js'in yeniden
     çizmesine sebep olur) efekti TEKRAR TETİKLEMEZ. Gerçek bir sayfa
     yenilemesinde bu liste doğal olarak sıfırlanır. */
  const autoPlayedLayers = new Set();

  function buildTriggerButton(s) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = s.buttonText || "Kutlamayı Başlat";
    Object.assign(btn.style, {
      width: s.buttonWidth + "px",
      height: s.buttonHeight + "px",
      borderRadius: s.borderRadius + "px",
      background: buttonBackground(s),
      color: s.textColor,
      fontFamily: `"${s.fontFamily}", sans-serif`,
      border: "none",
      cursor: "pointer",
      flexShrink: "0"
    });
    btn.addEventListener("click", () => playEffect(s));
    return btn;
  }

  function render(settings, mode, context) {
    const s = Object.assign({}, DEFAULTS, settings);
    const wrap = document.createElement("div");
    wrap.style.width = "100%";
    wrap.style.height = "100%";
    wrap.style.display = "flex";
    wrap.style.alignItems = "center";
    wrap.style.justifyContent = "center";

    if (s.triggerMode === "button") {
      wrap.appendChild(buildTriggerButton(s));
      return wrap;
    }

    // triggerMode === "auto"
    if (mode === "edit") {
      const placeholder = document.createElement("div");
      Object.assign(placeholder.style, {
        display: "flex", flexDirection: "column", alignItems: "center", gap: "8px",
        fontFamily: "'Manrope', sans-serif", fontSize: "12px", color: "#9a9a90",
        border: "1px dashed #ccc", padding: "12px 16px", borderRadius: "6px", textAlign: "center"
      });
      const label = document.createElement("div");
      label.textContent = (s.effectType === "sparkle" ? "✨ Parıltı" : "🎉 Konfeti") + " — sayfa açılışında otomatik oynar";
      placeholder.appendChild(label);

      const testBtn = document.createElement("button");
      testBtn.type = "button";
      testBtn.textContent = "▶ Test Et";
      Object.assign(testBtn.style, {
        border: "1px solid #ccc", background: "#fff", borderRadius: "20px",
        padding: "6px 14px", fontSize: "11px", cursor: "pointer"
      });
      testBtn.addEventListener("click", () => playEffect(s));
      placeholder.appendChild(testBtn);

      wrap.appendChild(placeholder);
      return wrap;
    }

    // mode === "view", triggerMode === "auto"
    const layerKey = context ? context.layerId : "celebration-default";
    if (!autoPlayedLayers.has(layerKey)) {
      autoPlayedLayers.add(layerKey);
      setTimeout(() => playEffect(s), 400);
    }

    if (s.allowReplay) {
      const replayBtn = document.createElement("button");
      replayBtn.type = "button";
      replayBtn.textContent = "🎉 Tekrar Oynat";
      Object.assign(replayBtn.style, {
        border: "none", background: "rgba(0,0,0,.06)", borderRadius: "20px",
        padding: "8px 16px", fontSize: "12px", fontFamily: "'Manrope', sans-serif",
        color: "#333", cursor: "pointer"
      });
      replayBtn.addEventListener("click", () => playEffect(s));
      wrap.appendChild(replayBtn);
    }

    return wrap;
  }

  global.SeozModuleRegistry.registerModule({
    id: "celebration",
    label: "Kutlama Efekti",
    defaultSettings: DEFAULTS,
    defaultLayerSize: { w: 220, h: 100 },
    settingsSchema: SETTINGS_SCHEMA,
    render: render
  });
})(window);
