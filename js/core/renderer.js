/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — renderer.js
   -----------------------------------------------------------------------------
   Bir belgeyi (document model) ekrana çizen TEK fonksiyon seti. Editör de
   view.html de bunu çağırır — iki ayrı çizim mantığı YOKTUR. Fark:
     mode = "edit"  → katmanlara data-editable işareti eklenir (sürükleme/
                       seçim, drag-resize.js tarafından yönetilir)
     mode = "view"  → katmanlar salt-okunur, hiçbir etkileşim kodu
                       yüklenmez (view.html bu dosyanın editor/ klasörünü
                       hiç import etmediğini unutmayın)
   ========================================================================= */

(function (global) {
  "use strict";

  function el(tag, cls) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }

  /* EK ÖZELLİK — Altın / Gümüş metalik metin efekti. content.metallic
     "none" iken davranış BİREBİR ESKİSİYLE AYNIDIR (düz content.color).
     "gold"/"silver" iken düz renk yerine ince bir gradyan metne
     "boyanır" (background-clip:text) — gerçek bir metalik yansıma hissi
     verir, düz sarı/gri bir renk DEĞİLDİR. Bu fonksiyon editör VE yayın
     paketi tarafından AYNI şekilde kullanıldığı için (renderer.js her
     ikisine de birebir kopyalanır) mobil/masaüstü ve editör/yayın
     arasında görünüm otomatik olarak tutarlıdır. */
  // MADDE 5: Parlak Altın/Gümüş KOYU zeminlerde güzel görünür (korunuyor,
  // değiştirilmedi). AÇIK zemin için EK iki seçenek: "copper-gold" (Bakır
  // Altın — sıcak, zarif, bakıra yakın ama turuncuya kaçmayan, krem/beyaz
  // zeminde rahat okunur) ve "dark-silver" (Koyu Gümüş/Füme — açık fonda
  // kaybolmayacak kadar koyu). Mevcut "gold"/"silver" hiç değiştirilmedi.
  const METALLIC_GRADIENTS = {
    gold: "linear-gradient(115deg, #7c5a2e 0%, #d9b26a 22%, #fff3cf 42%, #b8863c 58%, #f4d998 76%, #6e4e26 100%)",
    silver: "linear-gradient(115deg, #6b6f73 0%, #d9dde0 22%, #ffffff 42%, #9aa0a6 58%, #eef1f3 76%, #5c6064 100%)",
    "copper-gold": "linear-gradient(115deg, #5e3c1c 0%, #a8763c 22%, #d9a55f 42%, #8a5f2e 58%, #c99a56 76%, #43290f 100%)",
    "dark-silver": "linear-gradient(115deg, #303336 0%, #6e7378 22%, #9aa0a6 42%, #4b4f53 58%, #83898f 76%, #202224 100%)"
  };

  function applyTextStyle(node, content) {
    node.textContent = content.text;
    node.style.fontFamily = `"${content.fontFamily}", serif`;
    node.style.fontSize = content.fontSize + "px";
    node.style.fontWeight = content.bold ? "700" : "400";
    node.style.fontStyle = content.italic ? "italic" : "normal";
    node.style.textDecoration = content.underline ? "underline" : "none";
    node.style.textAlign = content.align;
    node.style.letterSpacing = content.letterSpacing + "px";
    node.style.lineHeight = String(content.lineHeight);

    const metallic = content.metallic || "none";
    const gradient = METALLIC_GRADIENTS[metallic];
    if (gradient) {
      node.style.backgroundImage = gradient;
      node.style.webkitBackgroundClip = "text";
      node.style.backgroundClip = "text";
      node.style.color = "transparent";
      node.style.webkitTextFillColor = "transparent";
      node.style.textShadow = "0 1px 0 rgba(0,0,0,.12)";
    } else {
      node.style.backgroundImage = "none";
      node.style.webkitBackgroundClip = "unset";
      node.style.backgroundClip = "unset";
      node.style.webkitTextFillColor = "unset";
      node.style.textShadow = "none";
      node.style.color = content.color;
    }
  }

  function renderLayer(layer, mode, docId, breakpoint) {
    const geo = SeozDocModel.resolveGeometry(layer, breakpoint);
    const wrap = el("div", "seoz-layer seoz-layer-" + layer.type);
    wrap.dataset.layerId = layer.id;
    wrap.style.position = "absolute";
    wrap.style.left = geo.x + "px";
    wrap.style.top = geo.y + "px";
    wrap.style.width = geo.w + "px";
    wrap.style.zIndex = String(layer.z || 1);

    if (layer.type === "text") {
      const textNode = el("div", "seoz-text-content");
      applyTextStyle(textNode, layer.content);
      textNode.style.width = "100%";
      // Metin kutusunun yüksekliği içerik kadar (auto) — kullanıcı yalnızca
      // genişliği yeniden boyutlandırabilir, yükseklik satır sayısına göre
      // kendiliğinden ayarlanır.
      wrap.appendChild(textNode);
    }

    if (layer.type === "image") {
      wrap.style.height = geo.h + "px";
      const img = el("img", "seoz-image-content");
      img.alt = "";
      img.draggable = false;
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.display = "block";
      img.style.pointerEvents = "none"; // sürükleme her zaman wrap üzerinden yönetilir
      // DÜZELTME: content.src artık gerçek bir data URL DEĞİL, çoğunlukla
      // IndexedDB'ye işaret eden küçük bir referanstır ("idb:..."). Gerçek
      // gösterilebilir adrese SeozBlobStore ile (asenkron) çevriliyor. Eski
      // belgelerdeki gerçek data URL'ler de sorunsuz çalışmaya devam eder
      // (resolveToObjectURL böyle bir değeri olduğu gibi geri döndürür).
      img.dataset.srcRef = layer.content.src;
      SeozBlobStore.resolveToObjectURL(layer.content.src).then(url => { img.src = url; });
      wrap.appendChild(img);
    }

    if (layer.type === "module") {
      wrap.style.height = geo.h + "px";
      const host = el("div", "seoz-module-content");
      host.style.width = "100%";
      host.style.height = "100%";
      const moduleDef = global.SeozModuleRegistry ? global.SeozModuleRegistry.getModule(layer.moduleId) : null;
      // OTOMATİK YÜKSEKLİK: Yalnızca tanımında autoHeight: true olan
      // modüller (Anket, Görüş Bildir) için kutu yüksekliği içeriğe göre
      // belirlenir (bkz. css/canvas.css → .seoz-autoheight). Bu bayrağı
      // taşımayan TÜM modüller birebir eski sabit-yükseklik davranışında
      // kalır.
      if (moduleDef && moduleDef.autoHeight) wrap.classList.add("seoz-autoheight");
      if (moduleDef) {
        // Üçüncü parametre (bağlam), FAZ 6'da Anı Yükle modülü gibi
        // "hangi belge / hangi katman" bilgisine ihtiyaç duyan modüller
        // için eklendi. Konum/Müzik/Geri Sayım/RSVP bu parametreyi
        // KULLANMAZ — geriye dönük uyumlu, isteğe bağlı bir ekstra argüman.
        host.appendChild(moduleDef.render(layer.settings, mode, { docId: docId, layerId: layer.id }));
      } else {
        host.textContent = "Bilinmeyen modül: " + layer.moduleId;
      }
      wrap.appendChild(host);
    }

    if (mode === "edit") {
      wrap.classList.add("seoz-editable");
      wrap.setAttribute("tabindex", "0");
      const handle = el("div", "resize-handle");
      wrap.appendChild(handle);
    }

    return wrap;
  }

  function applyCanvasBackground(canvasEl, background, mode) {
    background = background || { type: "color", value: "#FBF8F2" };

    // Bu fonksiyon yalnızca tam bir renderDocument() döngüsünde DEĞİL,
    // "Zemin Görseli Ayarları" panelindeki kaydırıcılar her hareket
    // ettirildiğinde de TEK BAŞINA çağrılıyor (anında önizleme için).
    // Bu yüzden HER çağrıda önce mevcut zemin öğeleri (varsa) kaldırılır
    // — aksi halde eskiler yığılır (önceki bir hata buydu, düzeltildi).
    const existingBgImg = canvasEl.querySelector('[data-canvas-bg-img]');
    if (existingBgImg) existingBgImg.remove();
    const existingBackdrop = canvasEl.querySelector('[data-canvas-bg-backdrop]');
    if (existingBackdrop) existingBackdrop.remove();

    // EK MADDE — ZEMİN PNG OTOMATİK ÜST/ALT RENK TAMAMLAMA: zemin
    // görseli artık "cover" (kırparak doldurma) DEĞİL, "contain" (oranı
    // koruyarak, kırpmadan/germeden sığdırma) ile gösterilir. Görselin
    // doğal en-boy oranını bozan hiçbir şey yapılmaz — dolayısıyla
    // kanvas görselden daha uzunsa üstte/altta boşluk kalabilir. Bu
    // boşluk, ARTIK yüklemede otomatik hesaplanan kenar renkleriyle
    // (background.topColor/bottomColor — bkz. image-utils.js
    // processBackgroundImageFile) dolduruluyor: görselin ARKASINA,
    // offsetY'ye göre ikiye bölünmüş (üstte topColor, altta bottomColor)
    // düz bir katman yerleştirilir. Gerçek bir piksel-hassas kenar takibi
    // değildir (istenen de bu değil — "gradyan üretmek zorunda
    // değilsin"), ama aynı zemin tonuyla göze batmadan devam eder.
    if (background.type === "image" && background.value) {
      canvasEl.style.backgroundColor = "transparent";
      canvasEl.style.backgroundImage = "none";

      const scale = (background.scale || 100) / 100;
      const heightPercent = (background.heightPercent || 100) / 100;
      const offsetX = background.offsetX != null ? background.offsetX : 50;
      const offsetY = background.offsetY != null ? background.offsetY : 50;

      // Kenar renkleri hesaplanmışsa (yalnızca "Zemin Görseli Yükle" ile
      // eklenen görsellerde var), görselin ARKASINA bu renklerle
      // doldurulmuş bir katman eklenir. Hesaplanmamışsa (eski kayıtlı
      // belgeler, ya da renk çıkarılamayan tamamen şeffaf bir şerit)
      // sessizce atlanır — davranış öncekiyle aynı kalır, hata OLUŞMAZ.
      if (background.topColor || background.bottomColor) {
        const top = background.topColor || background.bottomColor;
        const bottom = background.bottomColor || background.topColor;
        const backdrop = document.createElement("div");
        backdrop.setAttribute("data-canvas-bg-backdrop", "");
        Object.assign(backdrop.style, {
          position: "absolute",
          top: "0", left: "0", right: "0", bottom: "0",
          background: `linear-gradient(to bottom, ${top} 0%, ${top} ${offsetY}%, ${bottom} ${offsetY}%, ${bottom} 100%)`,
          zIndex: "-1",
          pointerEvents: "none"
        });
        canvasEl.insertBefore(backdrop, canvasEl.firstChild);
      }

      const img = document.createElement("img");
      img.setAttribute("data-canvas-bg-img", "");
      img.alt = "";
      Object.assign(img.style, {
        position: "absolute",
        top: "0", left: "0", right: "0", bottom: "0",
        width: "100%",
        height: "100%",
        // "cover" -> "contain": görsel ASLA kırpılmaz veya gerilmez,
        // doğal en-boy oranı korunur (esnetme/tekrar/deformasyon YASAK).
        objectFit: "contain",
        objectPosition: `${offsetX}% ${offsetY}%`,
        transform: `scale(${scale}, ${scale * heightPercent})`,
        transformOrigin: "center center",
        zIndex: "0",
        pointerEvents: "none",
        display: "block"
      });
      // renderDocument çağrısında canvas zaten boştur (innerHTML="");
      // panel kaynaklı tekil çağrılarda ise az önce üstteki satır
      // eskisini temizlediği için burada da güvenle ilk çocuk olarak
      // eklenir.
      canvasEl.insertBefore(img, canvasEl.firstChild);

      SeozBlobStore.resolveToObjectURL(background.value).then(url => {
        if (url) img.src = url;
        // Daha önce burada AYNI görsel, YAYIN görünümünde document.body'ye
        // de AYRICA/BAĞIMSIZ olarak uygulanıyordu — bu, farklı bir
        // hatanın (görsel ölçek uyumsuzluğu) kaynağıydı ve daha önce
        // düzeltildi. Bkz. view.html/export-package.js içindeki
        // "seoz-view-outer" sınıfı — dış sarmalayıcı yayın sayfasında her
        // zaman en az ekran yüksekliği kadar tutulur, canvas'ın KENDİ
        // zemini tek doğruluk kaynağı olarak kalır.
      });
    } else {
      canvasEl.style.backgroundImage = "none";
      canvasEl.style.backgroundColor = background.value || "#FBF8F2";
    }
  }

  /* Bir DOM alt ağacındaki tüm "canlı" modül zamanlayıcılarını (ör.
     geri sayım) temizler. Katman yeniden çizilmeden/silinmeden ÖNCE
     çağrılmalıdır — aksi halde eski aralıklar (interval) görünmez
     şekilde çalışmaya devam eder (bellek/CPU sızıntısı). */
  function clearIntervalsWithin(root) {
    root.querySelectorAll("[data-interval-id]").forEach(node => {
      clearInterval(Number(node.dataset.intervalId));
    });
  }

  function renderDocument(doc, canvasEl, mode, breakpoint) {
    // breakpoint verilmezse (eski çağrılar/güvenlik için) "mobile" varsayılır
    // — bu, FAZ 8 öncesi davranışın birebir aynısıdır.
    const bp = breakpoint === "desktop" ? "desktop" : "mobile";
    clearIntervalsWithin(canvasEl);
    canvasEl.innerHTML = "";
    canvasEl.style.position = "relative";
    canvasEl.style.width = doc.canvas.baseWidth + "px";
    applyCanvasBackground(canvasEl, doc.canvas.background, mode);
    canvasEl.style.overflow = "hidden";

    const sorted = doc.layers.slice().sort((a, b) => (a.z || 0) - (b.z || 0));
    sorted.forEach(layer => {
      canvasEl.appendChild(renderLayer(layer, mode, doc.id, bp));
    });

    SeozLayoutEngine.recalcCanvasHeight(canvasEl, doc.canvas.minHeight);
  }

  global.SeozRenderer = { renderDocument, applyTextStyle, applyCanvasBackground, clearIntervalsWithin, METALLIC_GRADIENTS };
})(window);
