/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — modules/music.js
   Müzik modülü: yuvarlak bir oynat/durdur butonu. Hem editörde hem
   yayınlanan sayfada aynı şekilde çalışır — tıklanınca modüle atanmış
   müziği çalar/duraklatır, ikon Play/Pause durumuna göre değişir.
   Tarayıcıların otomatik oynatma kısıtlaması nedeniyle müzik yalnızca
   butona basıldığında başlar (bu her tarayıcıda güvenilir çalışır).
   ========================================================================= */

(function (global) {
  "use strict";

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
  // gradyan tekniğiyle — background-clip:text benzeri, burada SVG fill
  // yerine bir <span> arka planına maskeleme uygulanır) uygulanır; aksi
  // halde düz noteColor kullanılır.
  function noteFillStyle(s) {
    const g = global.SeozRenderer && global.SeozRenderer.METALLIC_GRADIENTS;
    return (g && g[s.metallic]) || null;
  }

  // MADDE 6: yuvarlak buton/arka plan YOK — yalnızca zarif, tek parça bir
  // müzik notası (♪) SVG'si. Çalarken TAM opak, durdurulmuşken hafif
  // soluk görünür — aktif/pasif durumu bu şekilde anlaşılır; ayrıca
  // çalarken çok hafif bir nabız (pulse) animasyonu eklenir.
  // MADDE 2 (SON DÜZELTME): elle çizilmiş bir SVG yolu yerine gerçek SOL
  // ANAHTARI (treble clef, Unicode U+1D11E "𝄞") karakteri kullanılıyor —
  // tarayıcının kendi font render motoruyla çizildiği için doğru ve
  // tanınabilir bir şekil garantisi verir (elle çizilmiş bir eğri
  // yanlışlıkla bozuk/okunaksız çıkabilirdi). fill, <svg> kökünde
  // ayarlanır ve <text>'e miras kalır (renk/boyut ayarları aynen çalışır).
  function noteSVG(size) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24"><text x="12" y="19" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="21">𝄞</text></svg>`;
  }

  function render(settings, mode) {
    const s = Object.assign({}, DEFAULTS, settings);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("aria-label", "Müziği aç/kapat");
    // Görsel olarak yuvarlak arka plan/buton YOK (şeffaf) — ancak mobilde
    // rahat basılabilsin diye TIKLANABİLİR ALAN katmanın tüm kutusunu
    // kaplamaya devam eder (bu, sürükle-bırak ile ayarlanan katman
    // boyutudur — nota'nın GÖRSEL boyutu ise ayrı, daha küçük olabilir).
    Object.assign(btn.style, {
      width: "100%",
      height: "100%",
      background: "transparent",
      border: "none",
      padding: "0",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: s.audioSrc ? "pointer" : "default"
    });

    const iconHost = document.createElement("span");
    iconHost.style.display = "flex";
    iconHost.style.transition = "opacity .2s ease, transform .2s ease";
    iconHost.style.opacity = ".55"; // başlangıçta (çalmıyorken) hafif soluk
    const gradient = noteFillStyle(s);
    if (gradient) {
      // Metalik efekt: SVG'nin kendisini bir maske olarak kullanıp
      // arkasına gradyanı koyuyoruz (metin katmanlarındaki teknikle aynı
      // görsel sonucu, ikon için de).
      iconHost.style.background = gradient;
      iconHost.style.webkitMaskImage = `url("data:image/svg+xml;utf8,${encodeURIComponent(noteSVG(s.noteSize).replace("<svg ", '<svg fill="#000" '))}")`;
      iconHost.style.maskImage = iconHost.style.webkitMaskImage;
      iconHost.style.webkitMaskRepeat = "no-repeat";
      iconHost.style.maskRepeat = "no-repeat";
      iconHost.style.width = s.noteSize + "px";
      iconHost.style.height = s.noteSize + "px";
    } else {
      iconHost.innerHTML = noteSVG(s.noteSize).replace("<svg ", `<svg fill="${s.noteColor}" `);
    }
    btn.appendChild(iconHost);

    // DÜZELTME: Önceden bu blok yalnızca mode === "view" iken çalışıyordu,
    // bu yüzden editördeki tuval butonu hiçbir zaman bir <audio> elemanına
    // veya tıklama olayına sahip olmuyordu (sağ paneldeki native oynatıcı
    // ayrı bir <audio> olduğu için o çalışıyordu). Artık editörde de,
    // yayında da AYNI şekilde çalışıyor — ikisi de aynı s.audioSrc
    // kaynağını (idb: referansını Blob resolver ile çözerek) kullanıyor.
    if (s.audioSrc) {
      const audio = document.createElement("audio");
      audio.loop = true;
      SeozBlobStore.resolveToObjectURL(s.audioSrc).then(url => { audio.src = url; });
      btn.appendChild(audio);

      let playing = false;
      btn.addEventListener("click", () => {
        if (playing) audio.pause(); else audio.play().catch(() => {});
        playing = !playing;
        // MADDE 6: aktif/pasif durumu — çalarken tam opak + çok hafif
        // nabız, durdurulunca soluk ve sabit.
        iconHost.style.opacity = playing ? "1" : ".55";
        iconHost.style.animation = playing ? "seozNotePulse 1.6s ease-in-out infinite" : "none";
      });
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
