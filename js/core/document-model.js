/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — document-model.js
   -----------------------------------------------------------------------------
   Bir "davetiye belgesi"nin şeması burada tanımlıdır. Editör de, yayın
   sayfası (view.html) da HER ZAMAN bu şekle uyan bir nesneyle çalışır.

   ÖNEMLİ TASARIM KARARI (canvas mantığı):
   Her katmanın konumu/boyutu, YÜZDE değil, sabit bir "tasarım genişliği"
   (canvas.baseWidth, örn. 430px) içinde GERÇEK PİKSEL olarak tutulur.
   Editör ve yayın sayfası bu 430px'lik alanı ekrana göre TEK PARÇA halinde
   ölçekler (bkz. layout-engine.js). Bunun 3 önemli sonucu var:
     1) "Bir metni 52px yaptıysam diğerini de 52px yapabilmeliyim" isteği
        tam anlamıyla karşılanır — px değerleri her yerde birebir aynı anlama gelir.
     2) Editörde gördüğünüz ile yayınlanan site birebir aynı görünür,
        çünkü ikisi de aynı 430px koordinat uzayını aynı şekilde ölçekler.
     3) Katmanın x/y/w/h alanları HER ZAMAN bu tek koordinat uzayındaki
        (mobil öncelikli) varsayılan tasarımı temsil eder. FAZ 8'de buna
        isteğe bağlı bir "desktopOverride" eklendi: yalnızca masaüstü
        önizlemesindeyken, açıkça açtığınız katmanlar için farklı bir
        konum/boyut kaydedebilirsiniz. Kapalıyken (varsayılan) masaüstü,
        mobil ile birebir aynı orantılı tasarımı gösterir.
   ========================================================================= */

(function (global) {
  "use strict";

  const SCHEMA_VERSION = 1;

  function generateId(prefix) {
    return (prefix || "id") + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  /* ------------------------------------------------------------------
     METİN KATMANI VARSAYILANLARI
     ------------------------------------------------------------------ */
  const DEFAULT_TEXT_CONTENT = {
    text: "Yeni metin",
    fontFamily: "Cormorant Garamond",
    fontSize: 28,        // px — canvas.baseWidth koordinat uzayında
    color: "#1E2A22",
    bold: false,
    italic: false,
    underline: false,
    align: "center",     // left | center | right
    letterSpacing: 0,     // px
    lineHeight: 1.3,      // birimsiz çarpan
    // EK ÖZELLİK: "none" | "gold" | "silver" — doluysa (gold/silver)
    // renderer.js normal "color" alanı yerine metalik bir gradyan
    // uygular. "none" iken davranış eskisiyle birebir aynıdır.
    metallic: "none"
  };

  function createTextLayer(overrides) {
    overrides = overrides || {};
    return {
      id: generateId("layer"),
      type: "text",
      z: overrides.z || 1,
      x: overrides.x != null ? overrides.x : 40,
      y: overrides.y != null ? overrides.y : 40,
      w: overrides.w != null ? overrides.w : 350,
      rotation: 0,
      // FAZ 8: masaüstüne özel isteğe bağlı override (bkz. dosya başı notu).
      // enabled:false iken hiçbir mantık bu alanı okumaz — mobil ile
      // birebir aynı orantılı tasarım kullanılır.
      desktopOverride: { enabled: false, x: null, y: null, w: null, h: null },
      content: Object.assign({}, DEFAULT_TEXT_CONTENT, overrides.content || {})
    };
  }

  /* ------------------------------------------------------------------
     FOTOĞRAF/GÖRSEL KATMANI VARSAYILANLARI
     "Zemin" (canvas.background) ve "Kart" (sıradan bir görsel katmanı)
     farklı kavramlar gibi görünse de, KART aslında ayrı bir sistem
     GEREKTİRMEZ — bu bir görsel katmanıdır: yüklenir, taşınır,
     boyutlandırılır, üzerine ayrıca metin katmanı eklenir. "Zemin" ise
     tek başına canvas.background alanında tutulur çünkü katman gibi
     taşınmaz, her zaman en arkada tüm alanı kaplar.
     ------------------------------------------------------------------ */
  const DEFAULT_IMAGE_CONTENT = {
    src: "",            // data URL (bkz. js/editor/image-utils.js)
    naturalWidth: 0,
    naturalHeight: 0,
    lockAspect: true
  };

  function createImageLayer(overrides) {
    overrides = overrides || {};
    return {
      id: generateId("layer"),
      type: "image",
      z: overrides.z || 1,
      x: overrides.x != null ? overrides.x : 40,
      y: overrides.y != null ? overrides.y : 40,
      w: overrides.w != null ? overrides.w : 200,
      h: overrides.h != null ? overrides.h : 200,
      rotation: 0,
      desktopOverride: { enabled: false, x: null, y: null, w: null, h: null },
      content: Object.assign({}, DEFAULT_IMAGE_CONTENT, overrides.content || {})
    };
  }

  /* ------------------------------------------------------------------
     MODÜL KATMANI (FAZ 4: Konum, Müzik, Geri Sayım — ve gelecekteki her
     yeni modül). "core" katmanı belirli modülleri TANIMAZ; ayarların
     varsayılan değerlerini çağıran taraf (editor-app.js), ilgili modülü
     js/modules/module-registry.js üzerinden sorarak sağlar. Böylece yeni
     bir modül eklemek bu dosyaya asla dokunmayı gerektirmez.
     ------------------------------------------------------------------ */
  function createModuleLayer(moduleId, defaultSettings, overrides) {
    overrides = overrides || {};
    return {
      id: generateId("layer"),
      type: "module",
      moduleId: moduleId,
      z: overrides.z || 1,
      x: overrides.x != null ? overrides.x : 40,
      y: overrides.y != null ? overrides.y : 40,
      w: overrides.w != null ? overrides.w : 240,
      h: overrides.h != null ? overrides.h : 120,
      rotation: 0,
      desktopOverride: { enabled: false, x: null, y: null, w: null, h: null },
      settings: JSON.parse(JSON.stringify(defaultSettings || {}))
    };
  }

  /* ------------------------------------------------------------------
     BELGE (davetiye) FABRİKASI
     ------------------------------------------------------------------ */
  function createEmptyDocument(title, eventType) {
    const now = new Date().toISOString();
    return {
      schemaVersion: SCHEMA_VERSION,
      id: generateId("doc"),
      meta: {
        title: title || "Adsız Davetiye",
        eventType: eventType || "bos-sayfa",
        createdAt: now,
        updatedAt: now
      },
      canvas: {
        baseWidth: 430,           // FAZ 1 tasarım genişliği (mobil öncelikli referans)
        minHeight: 640,
        // EK MADDE (SON DÜZELTME): scale/heightPercent/offsetX/offsetY
        // yalnızca type==="image" iken anlamlıdır; type==="color" iken
        // yok sayılır. Eski kayıtlı belgelerde bu alanlar bulunmayabilir
        // — applyCanvasBackground bunları || ile güvenle varsayılana
        // (100/100/50/50, yani "değişiklik yok") tamamlar.
        background: { type: "color", value: "#FBF8F2", scale: 100, heightPercent: 100, offsetX: 50, offsetY: 50 }
      },
      // FAZ 3'te gerçek işlevi kazandı — bkz. js/entry-scene.js
      // cardSrc: FAZ 6 düzeltmesi — zarftan sonra (isteğe bağlı) çıkan iç
      // kart görseli. Boşsa mevcut davranış (zarf açılınca doğrudan
      // davetiyeye geçiş) birebir korunur.
      // MADDE 1-3 GENİŞLETMESİ: "type" değerleri artık 5 seçeneği
      // kapsıyor: "none" (Doğrudan Site), "card" (Tek Kart PNG — YENİ,
      // cardOnlySrc kullanır), "png" (Üstten Açılan Zarf+Kart — mevcut,
      // pngSrc+cardSrc), "dual-wing" (Çift Kanat Zarf+Kart — YENİ, AYNI
      // pngSrc+cardSrc alanlarını kullanır, yalnızca animasyonu farklı),
      // "video" (mevcut, değişmedi). Eski kayıtlı belgeler ("none"/"png"/
      // "video") YENİ alanlar eksik olsa da aşağıdaki varsayılanlarla
      // sorunsuz çalışmaya devam eder (bkz. entry-scene.js/entry-panel.js
      // içindeki `Object.assign(DEFAULTS, entry)` deseni).
      entry: {
        type: "none",
        pngSrc: "", videoSrc: "", cardSrc: "", cardOnlySrc: "",
        // Kart ekranda kalma süresi: saniye cinsinden sayı VEYA "tap"
        // (kullanıcı dokunana kadar). "none"/"video" türlerinde kullanılmaz.
        cardDisplayDuration: 10,
        // Bu iki alan (desktopWidthPx/mobileWidthPercent) yalnızca ZARFA
        // aittir. Kart genişliği alanları BİLEREK "null" (yani "henüz
        // özelleştirilmedi") ile başlar — ZARF ANA REFERANS OLSUN: kart,
        // kullanıcı elle bir değer girene kadar zarf genişliğinin
        // otomatik olarak ~%90'ı kadar hesaplanır (bkz. entry-scene.js
        // applySizeVars). Kullanıcı panelden bir değer girdiği an bu
        // otomatik bağ kırılır ve girdiği değer sabitlenir.
        desktopWidthPx: 420,
        mobileWidthPercent: 90,
        desktopCardWidthPx: null,
        mobileCardWidthPercent: null,
        allowReplayForGuest: false
      },
      layers: []
    };
  }

  function cloneDocument(doc) {
    return JSON.parse(JSON.stringify(doc));
  }

  function touch(doc) {
    doc.meta.updatedAt = new Date().toISOString();
    return doc;
  }

  function nextZ(doc) {
    return doc.layers.reduce((max, l) => Math.max(max, l.z || 0), 0) + 1;
  }

  /* ------------------------------------------------------------------
     FAZ 8 — DUYARLI (RESPONSIVE) GEOMETRİ ÇÖZÜMLEME
     -----------------------------------------------------------------
     Bir katmanın belirli bir breakpoint'teki ("mobile" | "desktop")
     GERÇEK x/y/w/h değerini tek doğru yerden hesaplar. Editör
     (renderer.js, drag-resize.js, editor-app.js) ve yayın (view-app.js)
     HEP bu fonksiyonu kullanır — geometriyi asla doğrudan layer.x/y/w/h
     okuyarak/yazarak hesaplamazlar. Böylece mantık iki yerde
     tekrarlanıp birbirinden sapmaz.
     ------------------------------------------------------------------ */
  function resolveGeometry(layer, breakpoint) {
    const ov = layer.desktopOverride;
    if (breakpoint === "desktop" && ov && ov.enabled) {
      return {
        x: ov.x != null ? ov.x : layer.x,
        y: ov.y != null ? ov.y : layer.y,
        w: ov.w != null ? ov.w : layer.w,
        h: ov.h != null ? ov.h : layer.h
      };
    }
    return { x: layer.x, y: layer.y, w: layer.w, h: layer.h };
  }

  /* breakpoint "desktop" ise değişikliği desktopOverride'a yazar (ve
     onu otomatik olarak etkinleştirir); "mobile" ise doğrudan katmanın
     kendi (tek/varsayılan) alanlarına yazar. */
  function setGeometry(layer, breakpoint, patch) {
    if (breakpoint === "desktop") {
      if (!layer.desktopOverride) layer.desktopOverride = { enabled: false, x: null, y: null, w: null, h: null };
      layer.desktopOverride.enabled = true;
      Object.assign(layer.desktopOverride, patch);
    } else {
      Object.assign(layer, patch);
    }
  }

  function clearDesktopOverride(layer) {
    layer.desktopOverride = { enabled: false, x: null, y: null, w: null, h: null };
  }

  /* ------------------------------------------------------------------
     TEMEL DOĞRULAMA — henüz katı değil, ileride genişletilecek
     ------------------------------------------------------------------ */
  function validateDocument(doc) {
    const errors = [];
    if (!doc || typeof doc !== "object") { errors.push("Belge boş."); return errors; }
    if (!doc.id) errors.push("Belge id eksik.");
    if (!Array.isArray(doc.layers)) errors.push("layers dizisi eksik.");
    return errors;
  }

  /* ------------------------------------------------------------------
     MADDE 7 GÜVENLİK KATMANI — ANI YÜKLE / KONUM / RSVP BAĞLANTI TEMİZLİĞİ
     -----------------------------------------------------------------
     Geçmişte bir hata nedeniyle bu üç modülün bağlantıları karışmış
     olabilecek ESKİ kayıtlı belgeler için tek seferlik, güvenli bir
     temizlik. ASLA bir modülün URL'sini BAŞKA bir modülden doldurmaz —
     yalnızca başka bir modülle BİREBİR AYNI (yani şüpheli/muhtemelen
     yanlışlıkla kopyalanmış) bir değeri TEMİZLER (boşa çevirir).
     Kullanıcı doğru bağlantıyı elle yeniden girer — sessizce yanlış
     bir yere yönlendirmek yerine boş/pasif bırakmak her zaman daha
     güvenlidir. loadDraft/importJSON üzerinden, belge her yüklendiğinde
     çalışır (bkz. storage.js).
     ------------------------------------------------------------------ */
  function sanitizeDocument(doc) {
    if (!doc || !Array.isArray(doc.layers)) return doc;

    const seen = { mapsUrl: [], googleFormUrl: [] };
    doc.layers.forEach(layer => {
      if (layer.type !== "module" || !layer.settings) return;
      if (layer.moduleId === "location" && layer.settings.mapsUrl) seen.mapsUrl.push(layer.settings.mapsUrl);
      if (layer.moduleId === "rsvp" && layer.settings.googleFormUrl) seen.googleFormUrl.push(layer.settings.googleFormUrl);
    });

    // NOT: Yalnızca TEK YÖNLÜ (Anı Yükle'nin mağdur olduğu) temizlik
    // yapılır — kullanıcı tarafından bildirilen gerçek hata da hep bu
    // yöndeydi ("Anı Yükle → Konum/RSVP bağlantısını açtı"), tersi hiç
    // rapor edilmedi. SİMETRİK bir kontrol (Konum'un mapsUrl'ini de
    // "başka bir alanla aynı" diye temizlemeye çalışmak) yanlış pozitif
    // riski taşır: iki alan tesadüfen/tarihsel olarak aynı değeri
    // taşıyorsa, hangisinin "gerçek sahip" olduğunu ayırt edemeyiz ve
    // KULLANICININ DOĞRU değerini de silme riskine gireriz. Bu yüzden
    // yalnızca guest-upload.uploadUrl temizlenir; location/rsvp kendi
    // değerlerine ASLA dokunulmaz.
    let cleanedCount = 0;
    doc.layers.forEach(layer => {
      if (layer.type !== "module" || !layer.settings) return;
      if (layer.moduleId === "guest-upload" && layer.settings.uploadUrl &&
          (seen.mapsUrl.includes(layer.settings.uploadUrl) || seen.googleFormUrl.includes(layer.settings.uploadUrl))) {
        layer.settings.uploadUrl = "";
        cleanedCount++;
      }
    });

    if (cleanedCount > 0 && global.console) {
      console.warn(
        `[Studio SEOZ] ${cleanedCount} adet şüpheli "Anı Yükle" bağlantısı (Konum veya RSVP ile birebir aynıydı) ` +
        `güvenlik amacıyla temizlendi. Lütfen ilgili Anı Yükle modülüne kendi Google Drive bağlantınızı yeniden girin.`
      );
    }

    return doc;
  }

  global.SeozDocModel = {
    SCHEMA_VERSION,
    generateId,
    createEmptyDocument,
    createTextLayer,
    createImageLayer,
    createModuleLayer,
    cloneDocument,
    touch,
    nextZ,
    resolveGeometry,
    setGeometry,
    clearDesktopOverride,
    validateDocument,
    sanitizeDocument
  };
})(window);
