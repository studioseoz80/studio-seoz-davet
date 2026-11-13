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
  // Davetiye dili (TR/EN): misafirin gördüğü metinler. Türkçede metin aynen döner. Bkz. core/invite-i18n.js
  const L = (t, v) => (global.SeozInviteI18n ? global.SeozInviteI18n.L(t, v) : String(t).replace(/\{(\w+)\}/g, (m, k) => (v && v[k] != null ? v[k] : m)));
  const D = (t) => (global.SeozInviteI18n ? global.SeozInviteI18n.D(t) : t);

  let activeOverlay = null;
  let activeTimeouts = [];

  function clearActiveTimeouts() {
    activeTimeouts.forEach(id => clearTimeout(id));
    activeTimeouts = [];
  }

  function removeOverlay() {
    clearActiveTimeouts();
    if (activeOverlay && global.SeozMedia) global.SeozMedia.stop(activeOverlay);
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
    // ÜSTTEN AÇILIŞ (ayrı katmanlar): gövde ve üst kapak görselleri ikisi de gerekli.
    if (entry.type === "flap") return !!(entry.flapBodySrc && entry.flapSrc);
    // AÇILIŞ STÜDYOSU (A1): Sinematik Açılış görsel yüklenmeden de çalışır —
    // yüklenmeyen katmanlarda kodla çizilmiş görünüm kullanılır.
    if (entry.type === "cinema") return !!(global.SeozCinema && global.SeozCinema.models().length);
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

  /* MP4 (core/media.js): zarf, iç kart ve tek kart görseli video olabilir. "media" alanı yoksa
     (bütün eski davetiyeler) eskisi gibi <img> kullanılır. */
  function mediaEl(ref, media, cls) {
    const M = global.SeozMedia;
    if (M && M.isVideo(media)) {
      const v = M.makeVideo("", media, null, cls);
      SeozBlobStore.resolveToObjectURL(ref).then(url => { if (url) v.src = url; });
      return v;
    }
    const img = document.createElement("img");
    img.className = cls; img.alt = "";
    SeozBlobStore.resolveToObjectURL(ref).then(url => { img.src = url; });
    return img;
  }
  // video yardımcıları (video yoksa hiçbir şey yapmaz)
  const vStart = (root, phase) => { if (global.SeozMedia) global.SeozMedia.start(root, phase); };
  const vUnmute = root => { if (global.SeozMedia) global.SeozMedia.unmute(root); };

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

    // DÜZELTME: entry.pngSrc artık çoğunlukla bir IndexedDB referansı —
    // gerçek adrese asenkron çevrilip öyle atanıyor. (MP4 ise <video>)
    const img = mediaEl(entry.pngSrc, entry.pngMedia, "seoz-entry-image");
    overlay.appendChild(img);

    const hint = document.createElement("div");
    hint.className = "seoz-entry-hint";
    hint.textContent = L("Açmak için dokunun");
    overlay.appendChild(hint);

    const hasCard = !!entry.cardSrc;
    let cardImg = null;
    if (hasCard) {
      cardImg = mediaEl(entry.cardSrc, entry.cardMedia, "seoz-entry-card");
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
      vUnmute(overlay);
      if (phase === "envelope") {
        hint.style.display = "none";
        if (!hasCard) { finish(); return; } // ESKİ DAVRANIŞ — kart yoksa doğrudan geç
        vStart(overlay, "open");
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

    const img = mediaEl(entry.cardOnlySrc, entry.cardOnlyMedia, "seoz-entry-card-only");
    overlay.appendChild(img);

    function finish() {
      removeOverlay();
      onFinish();
    }

    // "Ses açık" MP4 kartta ilk dokunuş sesi açar (kart kapanmaz); sonraki dokunuş eskisi gibi geçer.
    // Görsel kartta ve sessiz videoda davranış aynen eskisi gibidir.
    let soundOn = !(global.SeozMedia && global.SeozMedia.isVideo(entry.cardOnlyMedia) && entry.cardOnlyMedia.sound);
    overlay.addEventListener("click", () => {
      if (!soundOn) { soundOn = true; vUnmute(overlay); return; }
      finish();
    });
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
      cardImg = mediaEl(entry.cardSrc, entry.cardMedia, "seoz-entry-card-inline");
      wrap.appendChild(cardImg);
    }

    // MP4 zarf: iki kanat aynı videonun eşzamanlı oynayan iki kopyasıdır (ikincisi sessiz)
    const pngVideo = !!(global.SeozMedia && global.SeozMedia.isVideo(entry.pngMedia));
    const wingMedia = side => {
      if (!pngVideo) { const i = document.createElement("img"); i.className = "seoz-entry-wing-img"; i.alt = ""; return i; }
      const v = global.SeozMedia.makeVideo("", entry.pngMedia, null, "seoz-entry-wing-img");
      if (side === "r") v.dataset.clone = "1";
      return v;
    };
    const leftWing = document.createElement("div");
    leftWing.className = "seoz-entry-wing seoz-entry-wing-left";
    const leftImg = wingMedia("l");
    leftWing.appendChild(leftImg);
    wrap.appendChild(leftWing);

    const rightWing = document.createElement("div");
    rightWing.className = "seoz-entry-wing seoz-entry-wing-right";
    const rightImg = wingMedia("r");
    rightWing.appendChild(rightImg);
    wrap.appendChild(rightWing);

    SeozBlobStore.resolveToObjectURL(entry.pngSrc).then(url => {
      leftImg.src = url; rightImg.src = url;
      // ölçü için görünmez "hayalet": videoda kapak görseli (ilk kare) kullanılır
      if (!pngVideo) ghost.src = url;
      else if (entry.pngMedia.poster) SeozBlobStore.resolveToObjectURL(entry.pngMedia.poster).then(u => { if (u) ghost.src = u; });
      else { ghost.style.aspectRatio = `${entry.pngMedia.w || 9} / ${entry.pngMedia.h || 16}`; }
    });

    overlay.appendChild(wrap);

    const hint = document.createElement("div");
    hint.className = "seoz-entry-hint";
    hint.textContent = L("Açmak için dokunun");
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
      vUnmute(overlay);
      if (phase === "envelope") {
        hint.style.display = "none";
        vStart(overlay, "open");
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


  /* ÜSTTEN AÇILIŞ — AYRI KATMANLI ZARF (entry.type "flap")
     Katmanlar (arkadan öne): iç kart → zarf gövdesi (ön yüz) → üst kapak (üçgen) → mühür/fiyonk.
     Kapak görselinin ÜST kenarı menteşedir (zarfın üst kenarıyla aynı hizada hazırlanır).
     Dokununca: (isteğe bağlı) mühür kaybolur → kapak geriye doğru katlanır (3B, rotateX) →
     iç kart gövdenin içinden yukarı yükselir → öne ve ortaya gelir → süre/dokunuşla davetiye açılır.
     Tek parça görselden kapak ayırma YAPILMAZ: gövde ve kapak ayrı yüklenir.
     Yalnızca transform/opacity canlandırılır (mobilde akıcı). Diğer giriş türlerine dokunmaz. */
  function buildFlapOverlay(entry, onFinish) {
    const overlay = document.createElement("div");
    overlay.className = "seoz-entry-overlay seoz-flap-overlay";
    applySizeVars(overlay, entry);
    const reduce = !!(global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const T = ms => (reduce ? Math.round(ms * 0.35) : ms);

    const wrap = document.createElement("div");
    wrap.className = "seoz-flap";
    const img = (ref, cls) => {
      const i = document.createElement("img");
      i.className = cls; i.alt = ""; i.draggable = false;
      SeozBlobStore.resolveToObjectURL(ref).then(u => { if (u) i.src = u; });
      return i;
    };
    const hasCard = !!entry.cardSrc;
    let cardBox = null, pocket = null;
    if (hasCard) {
      // "cep": kart zarfın içinde durur — gövdenin altından taşan kısmı görünmez, üstten çıkabilir
      pocket = document.createElement("div");
      pocket.className = "seoz-flap-pocket";
      cardBox = document.createElement("div");
      cardBox.className = "seoz-flap-card";
      cardBox.appendChild(mediaEl(entry.cardSrc, entry.cardMedia, "seoz-flap-card-media"));
      pocket.appendChild(cardBox);
      wrap.appendChild(pocket);
    }
    const body = img(entry.flapBodySrc, "seoz-flap-body");
    wrap.appendChild(body);
    const lid = document.createElement("div");
    lid.className = "seoz-flap-lid";
    const lidImg = img(entry.flapSrc, "seoz-flap-lid-img");
    lid.appendChild(lidImg);
    wrap.appendChild(lid);

    const exit = ["solarak", "yukari", "kalsin"].indexOf(entry.flapSealExit) >= 0 ? entry.flapSealExit : "solarak";
    let seal = null;
    if (entry.flapSealSrc) {
      seal = img(entry.flapSealSrc, "seoz-flap-seal");
      seal.style.width = clamp(Number(entry.flapSealSize) || 24, 6, 60) + "%";
      seal.style.top = "40%";   // yükleme sonrası fit() ile kesinleşir
      // "Kapakla birlikte kalsın": mühür kapağın parçası gibi onunla katlanır (konumu gövdeye göre %)
      if (exit === "kalsin") { lid.appendChild(seal); seal.classList.add("in-lid"); } else wrap.appendChild(seal);
    }
    overlay.appendChild(wrap);

    // Ölçü: zarf genişliği editördeki değerden; çok uzun görsellerde ekran yüksekliğine sığacak kadar küçülür.
    // Kapak, gövdeyle aynı genişlikte; mühürün "kapakta" yüzdesi gövde yüksekliğine göre hesaplanır.
    function fit() {
      const nw = body.naturalWidth, nh = body.naturalHeight;
      if (!nw || !nh) return;
      wrap.style.width = "";
      const cssW = wrap.getBoundingClientRect().width || 360;
      const maxH = global.innerHeight * 0.66;
      const w = Math.min(cssW, maxH * nw / nh);
      wrap.style.width = Math.round(w) + "px";
      // Mühürün dikey yeri: zarfın üst kenarından, zarf GENİŞLİĞİNİN %'si olarak (kapağın ucu, yüklemede ölçülür)
      if (seal) seal.style.top = Math.round(w * clamp(Number(entry.flapSealTop) || 40, 0, 200) / 100) + "px";
    }
    let fitted = false;
    const tryFit = () => { if (!fitted && body.naturalWidth) { fitted = true; fit(); } };
    body.addEventListener("load", tryFit); lidImg.addEventListener("load", tryFit);
    const onResize = () => { fitted = false; tryFit(); };
    global.addEventListener("resize", onResize);

    const hint = document.createElement("div");
    hint.className = "seoz-entry-hint";
    hint.textContent = L("Açmak için dokunun");
    overlay.appendChild(hint);

    let phase = "envelope";
    const anims = [];
    const A = (el, kf, o) => { const a = el.animate(kf, Object.assign({ fill: "forwards" }, o)); anims.push(a); return a; };
    function finish() {
      global.removeEventListener("resize", onResize);
      removeOverlay();
      onFinish();
    }
    function leaveCardPhase() {
      phase = "leaving";
      const t = setTimeout(finish, 450);
      activeTimeouts.push(t);
      if (cardBox) A(cardBox, [{ opacity: 1 }, { opacity: 0, transform: cardBox.__end + " translateY(-26px) scale(.98)" }], { duration: 420, easing: "ease" });
    }
    const later = (ms, fn) => { const t = setTimeout(fn, ms); activeTimeouts.push(t); };

    function open() {
      phase = "opening";
      hint.style.display = "none";
      let t = 0;
      // 1) mühür / fiyonk (isteğe bağlı)
      if (seal && exit !== "kalsin") {
        A(seal, exit === "yukari"
          ? [{ opacity: 1, transform: "translate(-50%,-50%)" }, { opacity: 0, transform: "translate(-50%,-50%) translateY(-60px) scale(.7) rotate(-12deg)" }]
          : [{ opacity: 1, transform: "translate(-50%,-50%) scale(1)" }, { opacity: 0, transform: "translate(-50%,-50%) scale(1.25)" }],
          { duration: T(480), easing: "cubic-bezier(.4,0,.2,1)" });
        t += T(380);
      }
      // 2) kapak geriye doğru katlanır (menteşe: üst kenar). Yarıda kartın arkasına geçer.
      const LID = T(1050);
      later(t, () => {
        A(lid, [{ transform: "rotateX(0deg)", filter: "brightness(1)" },
                { transform: "rotateX(95deg)", filter: "brightness(.78)", offset: 0.5 },
                { transform: "rotateX(180deg)", filter: "brightness(.9)" }], { duration: LID, easing: "cubic-bezier(.45,.05,.25,1)" });
        later(LID * 0.5, () => { lid.style.zIndex = "0"; });
      });
      t += LID;
      if (!hasCard) {   // kart yoksa: zarf hafifçe iner ve kaybolur
        later(t, () => {
          A(wrap, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(24px) scale(.97)" }], { duration: T(550), easing: "ease-in" });
          later(T(560), finish);
        });
        phase = "leaving";
        return;
      }
      // 3) iç kart gövdenin içinden yükselir
      const RISE = T(950);
      later(t, () => {
        const h = cardBox.getBoundingClientRect().height, rise = Math.round(h * 0.58);
        cardBox.__rise = rise;
        A(cardBox, [{ transform: "translateX(-50%) translateY(0)" }, { transform: `translateX(-50%) translateY(${-rise}px)` }], { duration: RISE, easing: "cubic-bezier(.22,.61,.36,1)" });
      });
      t += RISE;
      // 4) kart öne ve ortaya gelir; zarf aşağı süzülüp solar
      const FRONT = T(800);
      later(t, () => {
        const r = cardBox.getBoundingClientRect(), o = overlay.getBoundingClientRect();
        const dx = Math.round((o.left + o.width / 2) - (r.left + r.width / 2)), dy = Math.round((o.top + o.height / 2) - (r.top + r.height / 2));
        const maxH = o.height * 0.86, s = r.height > maxH ? maxH / r.height : 1;
        pocket.style.zIndex = "6"; pocket.style.clipPath = "none";
        cardBox.__end = `translateX(-50%) translateY(${-cardBox.__rise}px) translate(${dx}px, ${dy}px) scale(${s.toFixed(3)})`;
        A(cardBox, [{ transform: `translateX(-50%) translateY(${-cardBox.__rise}px)` }, { transform: cardBox.__end }], { duration: FRONT, easing: "cubic-bezier(.22,.61,.36,1)" });
        [body, lidImg].concat(seal ? [seal] : []).forEach(el => A(el, [{ opacity: 1 }, { opacity: 0 }], { duration: FRONT, easing: "ease-in" }));
      });
      t += FRONT;
      later(t, () => {
        phase = "card";
        scheduleAutoAdvance(entry.cardDisplayDuration, leaveCardPhase);
      });
    }

    overlay.addEventListener("click", () => {
      vUnmute(overlay);
      if (phase === "envelope") { vStart(overlay, "open"); open(); }
      else if (phase === "card") { clearActiveTimeouts(); leaveCardPhase(); }
      else if (phase === "leaving") { clearActiveTimeouts(); finish(); }
      // "opening": animasyon sürerken dokunuşlar yok sayılır (sarsıntı olmasın)
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
    skip.textContent = L("Geç");
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
    if (global.SeozCinema) global.SeozCinema.stop();
    const entry = doc.entry || { type: "none" };
    const done = onFinish || function () {};

    if (!hasUsableEntry(entry)) {
      done();
      return;
    }

    // Sinematik Açılış kendi motoruyla oynar (js/cinema/). Diğer 5 giriş
    // türü aşağıda, eskisiyle birebir aynı kodla çalışmaya devam eder.
    if (entry.type === "cinema") {
      // Hazırlık (K1): açılış ekranı TAMAMEN kalkınca davetiyeye haber verilir; İç Zemin'in
      // parçacıkları, süs hareketleri ve "kaydırınca canlanma" o ana kadar bekler.
      global.__seozEntryActive = true;
      global.SeozCinema.play(doc, done, { onGone: () => {
        global.__seozEntryActive = false;
        try { global.dispatchEvent(new CustomEvent("seoz:entry-end")); } catch (e) { /* çok eski tarayıcı */ }
      } });
      return;
    }

    let overlay;
    if (entry.type === "card") overlay = buildCardOnlyOverlay(entry, done);
    else if (entry.type === "dual-wing") overlay = buildDualWingOverlay(entry, done);
    else if (entry.type === "png") overlay = buildPngOverlay(entry, done);
    else if (entry.type === "flap") overlay = buildFlapOverlay(entry, done);
    else overlay = buildVideoOverlay(entry, done);
    // ✨ Sahne uyumu (core/motion.js): belgede açıksa zarf ve kart aynı doğal eğrilerle, birbirine bağlı oynar
    if (global.SeozMotion && global.SeozMotion.of(doc)) overlay.classList.add("seoz-entry-nat");

    document.body.appendChild(overlay);
    activeOverlay = overlay;
    vStart(overlay, entry.type === "card" ? "open" : "show");
  }

  /* Geriye dönük uyumluluk: FAZ 1-2'de kullanılan çağrı şekli. */
  function initEntryScene(doc, onDone) {
    play(doc, onDone);
  }

  global.SeozEntryScene = { initEntryScene, play, removeOverlay, hasUsableEntry };
})(window);
