/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — entry-panel.js (yalnızca editör)
   Sayfa düzeyinde bir ayar panelidir — herhangi bir katmanın seçili olup
   olmamasından bağımsız olarak her zaman görünür.

   DÜZELTME: Görsel/video artık IndexedDB'ye kaydediliyor (bkz.
   blob-store.js), bu yüzden büyük uyarı eşikleri de buna göre
   yükseltildi — localStorage'ın aksine IndexedDB onlarca/yüzlerce MB'ı
   rahatlıkla kaldırabilir. Panel önizlemeleri artık referansı asenkron
   olarak gerçek adrese çeviriyor (bkz. showPreview).
   ========================================================================= */

(function (global) {
  "use strict";

  const SIZE_WARNING_MB = 15;  // PNG için uyarı eşiği (IndexedDB ile artık çok daha yüksek)
  const VIDEO_WARNING_MB = 30; // Video için uyarı eşiği

  function confirmLargeFile(sizeMB, kind) {
    if (sizeMB < (kind === "video" ? VIDEO_WARNING_MB : SIZE_WARNING_MB)) return true;
    return confirm(
      `Bu dosya yaklaşık ${sizeMB.toFixed(1)} MB. Büyük dosyalar yüklemesi ` +
      `yavaş olabilir ve cihaz depolamasından daha fazla yer kaplar. Yine de ` +
      `bu dosyayı kullanmak istiyor musunuz?`
    );
  }

  function showPreview(el, ref) {
    if (!ref) { el.style.display = "none"; return; }
    SeozBlobStore.resolveToObjectURL(ref).then(url => {
      if (url) el.src = url;
    });
  }

  /* ---- MP4 desteği (zarf, iç kart, tek kart) ----
     Görsel yüklenince eskisi gibi yalnızca xxxSrc yazılır ve video bilgisi (xxxMedia) silinir;
     MP4 yüklenince xxxSrc videoyu, xxxMedia oynatma ayarlarını tutar. */
  const MD = window.SeozMedia || null;
  const ACCEPT = MD ? MD.ACCEPT_WITH_VIDEO : "image/png,image/jpeg,image/webp";
  const isVid = m => !!(MD && MD.isVideo(m));
  function slotPreviewHTML(src, media, attr) {
    if (!src) return "";
    if (isVid(media)) return `<video ${attr} muted loop playsinline autoplay preload="metadata" style="width:100%;max-height:160px;object-fit:cover;margin-bottom:8px;background:#111;border-radius:4px;"></video>`;
    return `<img ${attr} style="width:100%;max-height:160px;object-fit:cover;margin-bottom:8px;">`;
  }
  function slotOptsHTML(media, mediaKey) {
    if (!isVid(media)) return "";
    const o = MD.opts(media), sec = Number(media.duration) ? " · " + String(Math.round(media.duration * 10) / 10).replace(".", ",") + " sn" : "";
    const row = (k, label) => `<label style="display:flex;gap:8px;align-items:center;font-size:.78rem;margin:4px 0;cursor:pointer;"><input type="checkbox" data-vopt="${mediaKey}" data-vk="${k}" ${o[k] ? "checked" : ""} style="width:auto;"> ${label}</label>`;
    return `<div style="margin:6px 0 8px;padding:8px 10px;border:1px solid var(--line);border-radius:6px;">
      <div style="font-size:.74rem;color:var(--ink-soft);margin-bottom:4px;"><b>▶ MP4 video</b>${media.w ? ` · ${media.w}×${media.h}` : ""}${sec}</div>
      ${row("autoplay", "Otomatik oynat (kapalıysa açılış başlayınca oynar)")}${row("loop", "Döngü (bitince baştan)")}${row("sound", "Ses açık (misafirin ilk dokunuşunda açılır)")}</div>`;
  }
  /* Ortak yükleme: görsel ya da MP4 */
  function loadSlotFile(file, entry, srcKey, mediaKey) {
    if (MD && MD.isVideoFile(file)) {
      return MD.processVideoFile(file).then(res => {
        entry[srcKey] = res.ref; entry[mediaKey] = MD.newMedia(res, entry[mediaKey]);
        if (res.notes && res.notes.length > 1) alert("Video yüklendi.\n\n• " + res.notes.join("\n• "));
      });
    }
    const sizeMB = SeozImageUtils.estimateFileSizeMB(file);
    if (!confirmLargeFile(sizeMB, "image")) return Promise.resolve(false);
    return SeozImageUtils.processImageFile(file).then(result => { entry[srcKey] = result.ref; delete entry[mediaKey]; });
  }
  function wireSlotOpts(bodyEl, entry, cb) {
    bodyEl.querySelectorAll("[data-vopt]").forEach(inp => inp.addEventListener("change", () => {
      const m = entry[inp.dataset.vopt]; if (!m) return;
      m[inp.dataset.vk] = inp.checked; cb.onChange();
    }));
  }

  function render(containerEl, doc, cb) {
    const entry = doc.entry;

    containerEl.innerHTML = `
      <div class="field">
        <label>Giriş Türü</label>
        <select data-entry-type>
          <option value="none" ${entry.type === "none" ? "selected" : ""}>1) Doğrudan Site</option>
          <option value="card" ${entry.type === "card" ? "selected" : ""}>2) Tek Kart PNG</option>
          <option value="png" ${entry.type === "png" ? "selected" : ""}>3) Üstten Açılan Zarf + İç Kart</option>
          <option value="dual-wing" ${entry.type === "dual-wing" ? "selected" : ""}>4) Çift Kanat / Ortadan Açılan Zarf + İç Kart</option>
          <option value="video" ${entry.type === "video" ? "selected" : ""}>5) MP4 / WebM Video Giriş</option>
          ${global.SeozCinema ? `<option value="cinema" ${entry.type === "cinema" ? "selected" : ""}>6) Sinematik Açılış (Animasyon Stüdyosu)</option>` : ""}
        </select>
      </div>

      <div data-entry-body></div>

      <div class="field" style="margin-top:14px;">
        <label style="display:flex;align-items:center;gap:6px;">
          <input type="checkbox" data-allow-replay ${entry.allowReplayForGuest ? "checked" : ""} style="width:auto;">
          Misafirler "Baştan İzle" butonunu görebilsin
        </label>
      </div>

      <div style="display:flex;gap:6px;margin-top:6px;">
        <button type="button" class="btn btn-outline" data-replay-entry style="flex:1;">
          ▶ Girişi Yeniden Oynat
        </button>
        ${window.SeozVideoExport ? `<button type="button" class="btn btn-outline" data-entry-mp4 title="Açılışı video (.mp4) olarak indir — Instagram Reels için 1080×1920">⬇ MP4 İndir</button>` : ""}
      </div>
    `;

    renderBody();

    containerEl.querySelector("[data-entry-type]").addEventListener("change", (e) => {
      entry.type = e.target.value;
      renderBody();
      cb.onChange();
    });

    containerEl.querySelector("[data-allow-replay]").addEventListener("change", (e) => {
      entry.allowReplayForGuest = e.target.checked;
      cb.onChange();
    });

    containerEl.querySelector("[data-replay-entry]").addEventListener("click", () => {
      cb.onReplay();
    });
    const mp4Btn = containerEl.querySelector("[data-entry-mp4]");
    if (mp4Btn) mp4Btn.addEventListener("click", () => {
      if (!window.SeozVideoExport.supportedType(doc)) {
        alert(entry.type === "none" ? "Bu davetiyede giriş animasyonu yok. Önce bir giriş türü seçin." :
          entry.type === "video" ? "Giriş zaten bir video; MP4 İndir yalnızca animasyonlu açılışlar içindir." : "Önce açılış görselini (veya Animasyon Stüdyosu'nda katmanları) yükleyin.");
        return;
      }
      window.SeozVideoExport.open(doc);
    });

    // MADDE 2 — "Kart Ekranda Kalma Süresi": card / png / dual-wing
    // türlerinde ortak kullanılır (video ve "yok" türlerinde anlamsız).
    function durationFieldHTML() {
      const current = entry.cardDisplayDuration != null ? entry.cardDisplayDuration : 10;
      const options = [
        { value: "5", label: "5 saniye" },
        { value: "8", label: "8 saniye" },
        { value: "10", label: "10 saniye" },
        { value: "15", label: "15 saniye" },
        { value: "tap", label: "Kullanıcı dokunana kadar" }
      ];
      return `
        <div class="field" style="margin-top:14px;">
          <label style="font-size:.76rem;color:var(--ink-soft);margin-bottom:5px;display:block;">Kart Ekranda Kalma Süresi</label>
          <select data-entry-duration>
            ${options.map(o => `<option value="${o.value}" ${String(current) === o.value ? "selected" : ""}>${o.label}</option>`).join("")}
          </select>
          <p style="font-size:.72rem;color:var(--ink-soft);margin-top:6px;">
            Uzun davetiye metinleri okunamadan kart kaybolmasın — gerekiyorsa
            "Kullanıcı dokunana kadar" seçin.
          </p>
        </div>`;
    }

    // MADDE 3 — Masaüstü/Telefon boyutu: card / png / dual-wing türlerinde
    // ortak, BİRBİRİNDEN BAĞIMSIZ iki değer. Zarf ve kart bu değerleri
    // BİREBİR AYNI şekilde kullanır (bkz. entry-scene.js applySizeVars).
    // SON DÜZELTME (Madde 2): Zarf ve Kart genişlikleri artık TAMAMEN
    // AYRI — "includeEnvelope" false ise (Tek Kart PNG türü, zarf yok)
    // yalnızca kart alanları gösterilir.
    function sizeFieldsHTML(includeEnvelope) {
      const desktopW = entry.desktopWidthPx || 420;
      const mobileW = entry.mobileWidthPercent || 90;
      // ZARF ANA REFERANS: kart genişliği özelleştirilmemişse (null),
      // panelde de ZARFIN %90'ı olarak otomatik hesaplanan değer
      // gösterilir — kullanıcı, hiç dokunmasa bile doğru, orantılı bir
      // sayı görür. Bu alana dokunduğu an gerçek (sabit) bir değer olur.
      const desktopCardW = entry.desktopCardWidthPx != null ? entry.desktopCardWidthPx : Math.round(desktopW * 0.9);
      const mobileCardW = entry.mobileCardWidthPercent != null ? entry.mobileCardWidthPercent : Math.round(mobileW * 0.9);
      const envelopeBlock = includeEnvelope ? `
        <div class="field" style="margin-top:14px;padding-top:14px;border-top:1px dashed var(--line);">
          <label style="font-size:.76rem;color:var(--ink-soft);margin-bottom:5px;display:block;">Masaüstü Zarf Genişliği</label>
          <div class="numeric-with-unit">
            <input type="number" data-entry-desktop-w value="${desktopW}" min="200" max="900">
            <span>px</span>
          </div>
        </div>
        <div class="field" style="margin-top:10px;">
          <label style="font-size:.76rem;color:var(--ink-soft);margin-bottom:5px;display:block;">Telefon Zarf Genişliği</label>
          <div class="numeric-with-unit">
            <input type="number" data-entry-mobile-w value="${mobileW}" min="50" max="100">
            <span>% ekran</span>
          </div>
        </div>` : "";
      return `
        ${envelopeBlock}
        <div class="field" style="margin-top:${includeEnvelope ? 14 : 14}px;${includeEnvelope ? "" : "padding-top:14px;border-top:1px dashed var(--line);"}">
          <label style="font-size:.76rem;color:var(--ink-soft);margin-bottom:5px;display:block;">Masaüstü İç Kart Genişliği</label>
          <div class="numeric-with-unit">
            <input type="number" data-entry-desktop-card-w value="${desktopCardW}" min="200" max="900">
            <span>px</span>
          </div>
        </div>
        <div class="field" style="margin-top:10px;">
          <label style="font-size:.76rem;color:var(--ink-soft);margin-bottom:5px;display:block;">Telefon İç Kart Genişliği</label>
          <div class="numeric-with-unit">
            <input type="number" data-entry-mobile-card-w value="${mobileCardW}" min="50" max="100">
            <span>% ekran</span>
          </div>
          <p style="font-size:.72rem;color:var(--ink-soft);margin-top:6px;">
            ${includeEnvelope ? "Bu alana dokunmazsanız kart, zarfın yaklaşık %90'ı olarak otomatik hesaplanır ve içine güvenle sığar." : "Bu değer, kart ekranda ne kadar büyük görüneceğini belirler."}
          </p>
        </div>`;
    }

    function wireDurationAndSizeFields(bodyEl) {
      const durationSel = bodyEl.querySelector("[data-entry-duration]");
      if (durationSel) {
        durationSel.addEventListener("change", (e) => {
          entry.cardDisplayDuration = e.target.value === "tap" ? "tap" : parseInt(e.target.value, 10);
          cb.onChange();
        });
      }
      const desktopInput = bodyEl.querySelector("[data-entry-desktop-w]");
      if (desktopInput) {
        desktopInput.addEventListener("input", (e) => {
          entry.desktopWidthPx = parseInt(e.target.value, 10) || 420;
          // ZARF ANA REFERANS: kart hâlâ "otomatik" modundaysa (henüz
          // özelleştirilmediyse), gösterilen kart genişliği değerini de
          // canlı güncelle — paneli tamamen yeniden kurmadan (odak/
          // imleç kaybı olmasın diye doğrudan input.value değiştirilir).
          if (entry.desktopCardWidthPx == null) {
            const cardInput = bodyEl.querySelector("[data-entry-desktop-card-w]");
            if (cardInput) cardInput.value = Math.round(entry.desktopWidthPx * 0.9);
          }
          cb.onChange();
        });
      }
      const mobileInput = bodyEl.querySelector("[data-entry-mobile-w]");
      if (mobileInput) {
        mobileInput.addEventListener("input", (e) => {
          entry.mobileWidthPercent = parseInt(e.target.value, 10) || 90;
          if (entry.mobileCardWidthPercent == null) {
            const cardInput = bodyEl.querySelector("[data-entry-mobile-card-w]");
            if (cardInput) cardInput.value = Math.round(entry.mobileWidthPercent * 0.9);
          }
          cb.onChange();
        });
      }
      // Kart genişliği artık ayrı ve bağımsız — kullanıcı bu alanlara
      // dokunduğu an "otomatik" bağ kırılır, girilen değer sabitlenir.
      const desktopCardInput = bodyEl.querySelector("[data-entry-desktop-card-w]");
      if (desktopCardInput) {
        desktopCardInput.addEventListener("input", (e) => {
          entry.desktopCardWidthPx = parseInt(e.target.value, 10) || 420;
          cb.onChange();
        });
      }
      const mobileCardInput = bodyEl.querySelector("[data-entry-mobile-card-w]");
      if (mobileCardInput) {
        mobileCardInput.addEventListener("input", (e) => {
          entry.mobileCardWidthPercent = parseInt(e.target.value, 10) || 90;
          cb.onChange();
        });
      }
    }

    // MADDE 1 — "Üstten Açılan Zarf" ve "Çift Kanat" türleri AYNI
    // yükleme alanlarını (pngSrc + cardSrc) paylaşır — yalnızca
    // gösterim/animasyonları farklıdır. Kod tekrarını önlemek için
    // ortak bir fonksiyonda toplandı.
    function renderEnvelopeAndCardFields(bodyEl, animationNote) {
      bodyEl.innerHTML = `
        <div class="field">
          <label style="font-size:.76rem;color:var(--ink-soft);margin-bottom:5px;display:block;">Zarf / Giriş Görseli</label>
          ${slotPreviewHTML(entry.pngSrc, entry.pngMedia, "data-preview-envelope")}
          ${slotOptsHTML(entry.pngMedia, "pngMedia")}
          <button type="button" class="btn btn-outline" data-upload-png style="width:100%;">
            ${entry.pngSrc ? (isVid(entry.pngMedia) ? "Videoyu Değiştir" : "Görseli Değiştir") : "Görsel / MP4 Yükle"}
          </button>
          <input type="file" accept="${ACCEPT}" data-upload-png-input class="hidden">
        </div>
        <div class="field" style="margin-top:16px;padding-top:14px;border-top:1px dashed var(--line);">
          <label style="font-size:.76rem;color:var(--ink-soft);margin-bottom:5px;display:block;">İç Kart Görseli (isteğe bağlı)</label>
          ${slotPreviewHTML(entry.cardSrc, entry.cardMedia, "data-preview-card")}
          ${slotOptsHTML(entry.cardMedia, "cardMedia")}
          <button type="button" class="btn btn-outline" data-upload-card style="width:100%;">
            ${entry.cardSrc ? "Kartı Değiştir" : "Kart Görseli / MP4 Yükle"}
          </button>
          <input type="file" accept="${ACCEPT}" data-upload-card-input class="hidden">
          ${entry.cardSrc ? `<button type="button" class="btn-danger-text" data-remove-card style="margin-top:6px;">Kartı Kaldır</button>` : ""}
          <p style="font-size:.72rem;color:var(--ink-soft);margin-top:8px;">${animationNote}</p>
        </div>
        ${durationFieldHTML()}
        ${sizeFieldsHTML(true)}
      `;
      const envelopePreview = bodyEl.querySelector("[data-preview-envelope]");
      if (envelopePreview) showPreview(envelopePreview, entry.pngSrc);
      const cardPreview = bodyEl.querySelector("[data-preview-card]");
      if (cardPreview) showPreview(cardPreview, entry.cardSrc);

      const input = bodyEl.querySelector("[data-upload-png-input]");
      bodyEl.querySelector("[data-upload-png]").addEventListener("click", () => input.click());
      input.addEventListener("change", () => {
        const file = input.files[0];
        if (!file) return;
        loadSlotFile(file, entry, "pngSrc", "pngMedia").then(ok => {
          if (ok === false) return;
          renderBody();
          cb.onChange();
        }).catch(err => alert(MD && MD.isVideoFile(file) ? (err.message || "Video yüklenemedi.") : "Görsel yüklenemedi. Lütfen PNG, JPG, WebP veya MP4 deneyin."));
      });

      const cardInput = bodyEl.querySelector("[data-upload-card-input]");
      bodyEl.querySelector("[data-upload-card]").addEventListener("click", () => cardInput.click());
      cardInput.addEventListener("change", () => {
        const file = cardInput.files[0];
        if (!file) return;
        loadSlotFile(file, entry, "cardSrc", "cardMedia").then(ok => {
          if (ok === false) return;
          renderBody();
          cb.onChange();
        }).catch(err => alert(MD && MD.isVideoFile(file) ? (err.message || "Video yüklenemedi.") : "Kart görseli yüklenemedi. Lütfen PNG, JPG, WebP veya MP4 deneyin."));
      });

      const removeCardBtn = bodyEl.querySelector("[data-remove-card]");
      if (removeCardBtn) {
        removeCardBtn.addEventListener("click", () => {
          entry.cardSrc = "";
          delete entry.cardMedia;
          renderBody();
          cb.onChange();
        });
      }

      wireSlotOpts(bodyEl, entry, cb);
      wireDurationAndSizeFields(bodyEl);
    }

    function renderBody() {
      const bodyEl = containerEl.querySelector("[data-entry-body]");

      if (entry.type === "none") {
        bodyEl.innerHTML = `<p class="sidebar-empty">Davetiye doğrudan gösterilecek — giriş ekranı yok.</p>`;
        return;
      }

      if (entry.type === "card") {
        bodyEl.innerHTML = `
          <div class="field">
            <label style="font-size:.76rem;color:var(--ink-soft);margin-bottom:5px;display:block;">Kart Görseli</label>
            ${slotPreviewHTML(entry.cardOnlySrc, entry.cardOnlyMedia, "data-preview-card-only")}
            ${slotOptsHTML(entry.cardOnlyMedia, "cardOnlyMedia")}
            <button type="button" class="btn btn-outline" data-upload-card-only style="width:100%;">
              ${entry.cardOnlySrc ? "Kartı Değiştir" : "Kart Görseli / MP4 Yükle"}
            </button>
            <input type="file" accept="${ACCEPT}" data-upload-card-only-input class="hidden">
            <p style="font-size:.72rem;color:var(--ink-soft);margin-top:8px;">
              Zarf yok — bu görsel doğrudan ekranda ortalı ve büyük gösterilir.
            </p>
          </div>
          ${durationFieldHTML()}
          ${sizeFieldsHTML(false)}
        `;
        const preview = bodyEl.querySelector("[data-preview-card-only]");
        if (preview) showPreview(preview, entry.cardOnlySrc);

        const input = bodyEl.querySelector("[data-upload-card-only-input]");
        bodyEl.querySelector("[data-upload-card-only]").addEventListener("click", () => input.click());
        input.addEventListener("change", () => {
          const file = input.files[0];
          if (!file) return;
          loadSlotFile(file, entry, "cardOnlySrc", "cardOnlyMedia").then(ok => {
            if (ok === false) return;
            renderBody();
            cb.onChange();
          }).catch(err => alert(MD && MD.isVideoFile(file) ? (err.message || "Video yüklenemedi.") : "Görsel yüklenemedi. Lütfen PNG, JPG, WebP veya MP4 deneyin."));
        });

        wireSlotOpts(bodyEl, entry, cb);
        wireDurationAndSizeFields(bodyEl);
        return;
      }

      if (entry.type === "png") {
        renderEnvelopeAndCardFields(
          bodyEl,
          "Yüklerseniz, zarf açıldığında bu kart içinden yukarı doğru çıkar, kısa süre görünür, sonra davetiyeye geçilir. Boş bırakırsanız zarf açılır açılmaz doğrudan davetiyeye geçilir."
        );
        return;
      }

      if (entry.type === "dual-wing") {
        renderEnvelopeAndCardFields(
          bodyEl,
          "Aynı zarf görseli otomatik olarak iki kanada bölünür; tıklanınca sol kanat sola, sağ kanat sağa doğru açılır ve kart ortada belirir. Ayrı bir sol/sağ görsel yüklemenize gerek yoktur."
        );
        return;
      }

      // AÇILIŞ STÜDYOSU (A1): bütün ayarlar tam ekran stüdyoda yapılır;
      // burada yalnızca özet, stüdyoyu açan düğme ve kart süresi durur.
      if (entry.type === "cinema") {
        if (!entry.cinema || typeof entry.cinema !== "object") entry.cinema = { v: 2, layers: [], actions: [] };
        const sm = global.SeozCinemaStudio2.summary(entry) || { layers: 0, actions: 0, preset: "" };
        bodyEl.innerHTML = `
          <div class="field" style="padding:12px;border:1px solid var(--line);background:#FBF6EC;">
            <div style="font-weight:700;">🎬 Animasyon Stüdyosu</div>
            <div style="font-size:.78rem;color:var(--ink-soft);margin-top:2px;" data-cinema-summary>${sm.layers} katman · ${sm.actions} hareket${sm.preset ? " · " + sm.preset : ""}</div>
          </div>
          <button type="button" class="btn btn-gold" data-open-cinema-studio style="width:100%;">🎬 Animasyon Stüdyosu'nu Aç</button>
          <p style="font-size:.72rem;color:var(--ink-soft);margin-top:8px;">
            Kendi görsellerinizi katman olarak ekleyin, hareketleri menüden seçin.
            İsterseniz hazır kapı kurgularından birini kullanın.
          </p>
          ${durationFieldHTML()}
        `;
        bodyEl.querySelector("[data-open-cinema-studio]").addEventListener("click", () => {
          global.SeozCinemaStudio2.open(doc, { onChange: cb.onChange, onClose: () => renderBody() });
        });
        wireDurationAndSizeFields(bodyEl);
        return;
      }

      if (entry.type === "video") {
        bodyEl.innerHTML = `
          <div class="field">
            ${entry.videoSrc ? `<video data-preview muted loop autoplay playsinline style="width:100%;max-height:160px;object-fit:cover;margin-bottom:8px;"></video>` : ""}
            <button type="button" class="btn btn-outline" data-upload-video style="width:100%;">
              ${entry.videoSrc ? "Videoyu Değiştir" : "Video Yükle"}
            </button>
            <input type="file" accept="video/mp4,video/webm" data-upload-video-input class="hidden">
            <p style="font-size:.72rem;color:var(--ink-soft);margin-top:8px;">
              Öneri: 3-8 saniye, kısa bir klip. Video bittiğinde davetiye
              otomatik olarak açılır.
            </p>
          </div>
        `;
        const previewEl = bodyEl.querySelector("[data-preview]");
        if (previewEl) showPreview(previewEl, entry.videoSrc);

        const input = bodyEl.querySelector("[data-upload-video-input]");
        bodyEl.querySelector("[data-upload-video]").addEventListener("click", () => input.click());
        input.addEventListener("change", () => {
          const file = input.files[0];
          if (!file) return;
          const sizeMB = SeozImageUtils.estimateFileSizeMB(file);
          if (!confirmLargeFile(sizeMB, "video")) return;
          SeozImageUtils.storeRawFile(file).then(ref => {
            entry.videoSrc = ref;
            renderBody();
            cb.onChange();
          }).catch(() => alert("Video yüklenemedi. Lütfen MP4 veya WebM deneyin."));
        });
      }
    }
  }

  global.SeozEntryPanel = { render };
})(window);
