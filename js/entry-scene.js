/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — entry-scene.js
   -----------------------------------------------------------------------------
   FAZ 3: Giriş sahnesinin gerçek mantığı. Editör ("Girişi Yeniden Oynat")
   ve view.html (ilk yükleme + misafirin "Baştan İzle"si) AYNI play()
   fonksiyonunu çağırır — iki ayrı giriş mantığı yoktur.

   TASARIM KARARI: Giriş sahnesi, canvas'ın içine değil, tüm ekranı kaplayan
   SABİT (position:fixed) bir katman olarak gösterilir. Bunun nedeni:
   davetiyenin kendisi (canvas) içerik arttıkça çok uzun bir sayfa
   olabilirken, giriş görseli/videosu genelde tek bir telefon ekranı
   oranında tasarlanır (zarf, kapı, sandık vb.). İkisini aynı koordinat
   uzayında birleştirmeye çalışmak görseli gerilterek bozardı. Bu yüzden
   giriş ekranı görüntü alanını (viewport) kaplar, bittiğinde kaybolur ve
   altındaki (kendi ölçeğinde çizilmiş) davetiye ortaya çıkar.

   SİSTEM HİÇBİR ANİMASYONA (zarf, kapı, sandık...) KODLA BAĞLI DEĞİLDİR:
   yalnızca "bir PNG göster, tıklanınca kapat" veya "bir video oynat,
   bitince kapat" yapar. Görselin/videonun ne anlattığı tamamen sizin
   yüklediğiniz dosyaya bağlıdır.
   ========================================================================= */

(function (global) {
  "use strict";

  let activeOverlay = null;
  let activeTimeouts = [];

  function clearActiveTimeouts() {
    activeTimeouts.forEach(id => clearTimeout(id));
    activeTimeouts = [];
  }

  function removeOverlay() {
    clearActiveTimeouts();
    if (activeOverlay) {
      activeOverlay.remove();
      activeOverlay = null;
    }
  }

  function hasUsableEntry(entry) {
    if (!entry) return false;
    if (entry.type === "card") return !!entry.cardOnlySrc;
    if (entry.type === "png") return !!entry.pngSrc;
    // MADDE 1: Çift Kanat da AYNI zarf görselini (pngSrc) kullanır —
    // yalnızca animasyonu farklıdır, yükleme alanları ortaktır.
    if (entry.type === "dual-wing") return !!entry.pngSrc;
    if (entry.type === "video") return !!entry.videoSrc;
    return false;
  }

  // MADDE 3: zarf ve kart artık AYNI iki ölçü değerini (masaüstü px,
  // telefon %) paylaşır — CSS özel değişkenleri (custom properties)
  // olarak tek bir yerden set edilir, her iki görsel de bunları okur.
  // Böylece "aynı ölçüde hazırlanmış zarf ve kart farklı büyüklükte
  // görünüyor" hatası kökten ortadan kalkar: iki görsel de HER ZAMAN
  // birebir aynı max-width/max-height kısıtına tabidir.
  // SON DÜZELTME — ZARF/İÇ KART OTOMATİK BOYUT VE HİZALAMA:
  // 1) Güvenli sınırlar: aşırı bir değer girilirse (elle/programatik)
  //    görsel viewport dışına taşmasın diye masaüstü 160-900px, mobil
  //    %40-100 aralığına sıkıştırılır.
  // 2) ZARF ANA REFERANS: kart genişliği kullanıcı tarafından
  //    özelleştirilmemişse (null) ZARFIN %90'ı olarak otomatik
  //    hesaplanır — böylece kart her zaman zarfın içine güvenle sığar,
  //    kullanıcı hiçbir ince ayar yapmadan doğru oranı görür.
  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

  function applySizeVars(overlay, entry) {
    const desktopW = clamp(entry.desktopWidthPx || 420, 160, 900);
    const mobileW = clamp(entry.mobileWidthPercent || 90, 40, 100);
    // Kart genişliği "null/undefined" ise ZARFIN %90'ı otomatik kullanılır.
    const desktopCardW = clamp(
      entry.desktopCardWidthPx != null ? entry.desktopCardWidthPx : Math.round(desktopW * 0.9),
      160, 900
    );
    const mobileCardW = clamp(
      entry.mobileCardWidthPercent != null ? entry.mobileCardWidthPercent : Math.round(mobileW * 0.9),
      40, 100
    );
    overlay.style.setProperty("--seoz-entry-desktop-w", desktopW + "px");
    overlay.style.setProperty("--seoz-entry-mobile-w", mobileW + "vw");
    overlay.style.setProperty("--seoz-entry-desktop-card-w", desktopCardW + "px");
    overlay.style.setProperty("--seoz-entry-mobile-card-w", mobileCardW + "vw");
  }

  // MADDE 2: "Kart Ekranda Kalma Süresi" — saniye cinsinden bir sayı
  // VEYA "tap" (kullanıcı dokunana kadar). Sayı ise, o süre sonunda
  // OTOMATİK olarak bir sonraki aşamaya geçilir; "tap" ise yalnızca
  // kullanıcının dokunması geçişi tetikler (otomatik zamanlayıcı YOK).
  function scheduleAutoAdvance(duration, callback) {
    if (duration === "tap") return null;
    const seconds = Number(duration);
    const ms = (Number.isFinite(seconds) && seconds > 0 ? seconds : 10) * 1000;
    const t = setTimeout(callback, ms);
    activeTimeouts.push(t);
    return t;
  }

  /* DÜZELTME (iç kart): entry.cardSrc doluysa, zarfa dokunulduğunda
     doğrudan kapanmak yerine iki aşamalı bir geçiş oynanır: zarf
     "açılma" hissi verir, kart onun içinden yukarı doğru çıkar, kısa
     süre görünür, sonra ana davetiyeye geçilir. cardSrc BOŞSA davranış
     ESKİSİYLE BİREBİR AYNIDIR (zarfa dokun → doğrudan davetiye). */
  function buildPngOverlay(entry, onFinish) {
    const overlay = document.createElement("div");
    overlay.className = "seoz-entry-overlay";
    applySizeVars(overlay, entry);

    const img = document.createElement("img");
    img.className = "seoz-entry-image";
    img.alt = "";
    // DÜZELTME: entry.pngSrc artık çoğunlukla bir IndexedDB referansı —
    // gerçek adrese asenkron çevrilip öyle atanıyor.
    SeozBlobStore.resolveToObjectURL(entry.pngSrc).then(url => { img.src = url; });
    overlay.appendChild(img);

    const hint = document.createElement("div");
    hint.className = "seoz-entry-hint";
    hint.textContent = "Açmak için dokunun";
    overlay.appendChild(hint);

    const hasCard = !!entry.cardSrc;
    let cardImg = null;
    if (hasCard) {
      cardImg = document.createElement("img");
      cardImg.className = "seoz-entry-card";
      cardImg.alt = "";
      SeozBlobStore.resolveToObjectURL(entry.cardSrc).then(url => { cardImg.src = url; });
      overlay.appendChild(cardImg);
    }

    let phase = "envelope"; // "envelope" -> "card" -> "leaving"

    function finish() {
      removeOverlay();
      onFinish();
    }

    function leaveCardPhase() {
      phase = "leaving";
      cardImg.classList.add("leaving");
      const t = setTimeout(finish, 400);
      activeTimeouts.push(t);
    }

    function goToCardPhase() {
      phase = "card";
      hint.style.display = "none";
      // 1) Zarfın "açılma" hissi (küçülüp solar).
      img.classList.add("opening");
      // 2) Kart, zarfın içinden yukarı doğru çıkar.
      const t1 = setTimeout(() => { cardImg.classList.add("emerging"); }, 150);
      activeTimeouts.push(t1);
      // 3) Zarf tamamen kaybolduktan sonra ekrandan da kaldırılır (temizlik).
      const t2 = setTimeout(() => { img.style.visibility = "hidden"; }, 550);
      activeTimeouts.push(t2);
      // 4) MADDE 2: Kart, editörde ayarlanan süre kadar (veya "tap"
      // seçiliyse süresiz — yalnızca dokunma) görünür kalır.
      scheduleAutoAdvance(entry.cardDisplayDuration, leaveCardPhase);
    }

    overlay.addEventListener("click", () => {
      if (phase === "envelope") {
        hint.style.display = "none";
        if (!hasCard) { finish(); return; } // ESKİ DAVRANIŞ — kart yoksa doğrudan geç
        goToCardPhase();
      } else if (phase === "card") {
        // Kart gösterilirken tekrar dokunmak hemen ayrılış aşamasına geçirir.
        clearActiveTimeouts();
        leaveCardPhase();
      } else if (phase === "leaving") {
        clearActiveTimeouts();
        finish();
      }
    });

    return overlay;
  }

  /* MADDE 1 (YENİ) — TEK KART PNG: zarf gerektirmez, tek bir görsel
     ekranda ortalı ve büyük gösterilir. Tıklama VEYA (editörde
     ayarlanan) süre sonunda ana siteye geçilir. */
  function buildCardOnlyOverlay(entry, onFinish) {
    const overlay = document.createElement("div");
    overlay.className = "seoz-entry-overlay";
    applySizeVars(overlay, entry);

    const img = document.createElement("img");
    img.className = "seoz-entry-card-only";
    img.alt = "";
    SeozBlobStore.resolveToObjectURL(entry.cardOnlySrc).then(url => { img.src = url; });
    overlay.appendChild(img);

    function finish() {
      removeOverlay();
      onFinish();
    }

    overlay.addEventListener("click", finish);
    scheduleAutoAdvance(entry.cardDisplayDuration, finish);

    return overlay;
  }

  /* MADDE 1 (YENİ) — ÇİFT KANAT / ORTADAN AÇILAN ZARF: AYNI zarf
     (pngSrc) ve kart (cardSrc) yükleme alanlarını kullanır — yalnızca
     zarfın GÖSTERİMİ farklıdır: tek bir görsel yerine, aynı görsel iki
     "kanada" (sol yarı + sağ yarı) bölünüp, tıklanınca sol kanat sola,
     sağ kanat sağa doğru kayarak açılır. Kart, tıpkı üstten açılan
     türde olduğu gibi ortada belirir. */
  function buildDualWingOverlay(entry, onFinish) {
    const overlay = document.createElement("div");
    overlay.className = "seoz-entry-overlay";
    applySizeVars(overlay, entry);

    const wrap = document.createElement("div");
    wrap.className = "seoz-entry-dualwing";

    // "Hayalet" görsel: yalnızca sarmalayıcının gerçek en-boy oranını
    // (kırpılmadan) belirlemek için var — kendisi hiç görünmez.
    const ghost = document.createElement("img");
    ghost.className = "seoz-entry-dualwing-ghost";
    ghost.alt = "";
    wrap.appendChild(ghost);

    // SON DÜZELTME (Madde 1): İç kart artık en baştan, zarfın "içinde"
    // hazır duruyor — ayrı bir giriş animasyonuyla SONRADAN gelmiyor.
    // Bunu z-index sırasıyla sağlıyoruz: kart burada, kanatların
    // ARKASINDA (daha düşük z-index) eklenir; kanatlar henüz kapalıyken
    // onu tamamen örter. Kanatlar rotateY ile döndükçe (bkz. CSS —
    // backface-visibility:hidden), kapanan yüzeyleri görünmez hale gelip
    // ARKADAKİ kartı kademeli olarak ortaya çıkarır. Kartın kendi ayrı
    // bir "belirme" animasyonu YOKTUR — yalnızca kanatlar tarafından
    // açığa çıkarılır.
    const hasCard = !!entry.cardSrc;
    let cardImg = null;
    if (hasCard) {
      cardImg = document.createElement("img");
      cardImg.className = "seoz-entry-card-inline";
      cardImg.alt = "";
      SeozBlobStore.resolveToObjectURL(entry.cardSrc).then(url => { cardImg.src = url; });
      wrap.appendChild(cardImg);
    }

    const leftWing = document.createElement("div");
    leftWing.className = "seoz-entry-wing seoz-entry-wing-left";
    const leftImg = document.createElement("img");
    leftImg.className = "seoz-entry-wing-img";
    leftImg.alt = "";
    leftWing.appendChild(leftImg);
    wrap.appendChild(leftWing);

    const rightWing = document.createElement("div");
    rightWing.className = "seoz-entry-wing seoz-entry-wing-right";
    const rightImg = document.createElement("img");
    rightImg.className = "seoz-entry-wing-img";
    rightImg.alt = "";
    rightWing.appendChild(rightImg);
    wrap.appendChild(rightWing);

    SeozBlobStore.resolveToObjectURL(entry.pngSrc).then(url => {
      ghost.src = url; leftImg.src = url; rightImg.src = url;
    });

    overlay.appendChild(wrap);

    const hint = document.createElement("div");
    hint.className = "seoz-entry-hint";
    hint.textContent = "Açmak için dokunun";
    overlay.appendChild(hint);

    let phase = "envelope";
    // Kanat açılış animasyonunun toplam süresi (bkz. canvas.css —
    // .seoz-entry-wing transition: transform 2.2s). Kartın okuma süresi,
    // kanatlar TAMAMEN açıldıktan sonra başlar (Madde 1 — "Kapaklar
    // tamamen açıldıktan sonra kartın ekranda kalma süresi başlasın").
    const WING_ANIMATION_MS = 2300;

    function finish() {
      removeOverlay();
      onFinish();
    }

    function leaveCardPhase() {
      phase = "leaving";
      cardImg.classList.add("leaving");
      const t = setTimeout(finish, 400);
      activeTimeouts.push(t);
    }

    function goToCardPhase() {
      phase = "card";
      hint.style.display = "none";
      // Kanatlar sol/sağa doğru AÇILIR — kart zaten içeride, kanatlar
      // döndükçe kendiliğinden ortaya çıkar (yukarıdaki nota bkz.).
      leftWing.classList.add("opening");
      rightWing.classList.add("opening");
      // Kanatlar tamamen açıldıktan sonra temizlik için gizlenir — YALNIZ
      // kanatlar (wrap'in kendisi DEĞİL, çünkü kart artık wrap'in içinde
      // yaşıyor; wrap'i gizlemek kartı da gizlerdi).
      const t1 = setTimeout(() => {
        leftWing.style.visibility = "hidden";
        rightWing.style.visibility = "hidden";
      }, WING_ANIMATION_MS);
      activeTimeouts.push(t1);
      // MADDE 1 + 2: Kartın okuma süresi, kanatlar TAMAMEN açılmadan
      // BAŞLAMAZ — kullanıcı kartı yeterince okumadan ana ekrana
      // geçilmez.
      const t2 = setTimeout(() => {
        if (hasCard) scheduleAutoAdvance(entry.cardDisplayDuration, leaveCardPhase);
        else scheduleAutoAdvance(entry.cardDisplayDuration, finish);
      }, WING_ANIMATION_MS);
      activeTimeouts.push(t2);
    }

    overlay.addEventListener("click", () => {
      if (phase === "envelope") {
        hint.style.display = "none";
        if (!hasCard) {
          leftWing.classList.add("opening");
          rightWing.classList.add("opening");
          const t = setTimeout(finish, WING_ANIMATION_MS);
          activeTimeouts.push(t);
          phase = "leaving";
          return;
        }
        goToCardPhase();
      } else if (phase === "card") {
        clearActiveTimeouts();
        leaveCardPhase();
      } else if (phase === "leaving") {
        clearActiveTimeouts();
        finish();
      }
    });

    return overlay;
  }

  function buildVideoOverlay(entry, onFinish) {
    const overlay = document.createElement("div");
    overlay.className = "seoz-entry-overlay";

    const video = document.createElement("video");
    video.className = "seoz-entry-video";
    // Mobil tarayıcılarda otomatik oynatmanın çalışması için üçü de gerekli:
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.addEventListener("ended", () => { removeOverlay(); onFinish(); }, { once: true });
    overlay.appendChild(video);

    // Video herhangi bir sebeple oynamazsa (tarayıcı engeli, bozuk dosya
    // vb.) misafir sıkışıp kalmasın diye her zaman bir "Geç" seçeneği var.
    const skip = document.createElement("button");
    skip.type = "button";
    skip.className = "seoz-entry-skip";
    skip.textContent = "Geç";
    skip.addEventListener("click", () => { removeOverlay(); onFinish(); });
    overlay.appendChild(skip);

    // Tıklayarak da geçilebilir (video'ya tıklamak = geç).
    video.addEventListener("click", () => { removeOverlay(); onFinish(); });

    // DÜZELTME: entry.videoSrc artık çoğunlukla bir IndexedDB referansı —
    // gerçek adres çözüldükten SONRA src atanıp oynatma başlatılıyor.
    SeozBlobStore.resolveToObjectURL(entry.videoSrc).then(url => {
      video.src = url;
      video.play().catch(() => { /* otomatik oynatma engellenmiş olabilir — "Geç" veya tıklama her zaman çalışır */ });
    });

    return overlay;
  }

  function play(doc, onFinish) {
    removeOverlay();
    const entry = doc.entry || { type: "none" };
    const done = onFinish || function () {};

    if (!hasUsableEntry(entry)) {
      done();
      return;
    }

    let overlay;
    if (entry.type === "card") overlay = buildCardOnlyOverlay(entry, done);
    else if (entry.type === "dual-wing") overlay = buildDualWingOverlay(entry, done);
    else if (entry.type === "png") overlay = buildPngOverlay(entry, done);
    else overlay = buildVideoOverlay(entry, done);

    document.body.appendChild(overlay);
    activeOverlay = overlay;
  }

  /* Geriye dönük uyumluluk: FAZ 1-2'de kullanılan çağrı şekli. */
  function initEntryScene(doc, onDone) {
    play(doc, onDone);
  }

  global.SeozEntryScene = { initEntryScene, play, removeOverlay, hasUsableEntry };
})(window);
