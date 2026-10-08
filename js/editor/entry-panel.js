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
        </select>
      </div>

      <div data-entry-body></div>

      <div class="field" style="margin-top:14px;">
        <label style="display:flex;align-items:center;gap:6px;">
          <input type="checkbox" data-allow-replay ${entry.allowReplayForGuest ? "checked" : ""} style="width:auto;">
          Misafirler "Baştan İzle" butonunu görebilsin
        </label>
      </div>

      <button type="button" class="btn btn-outline" data-replay-entry style="width:100%;margin-top:6px;">
        ▶ Girişi Yeniden Oynat
      </button>
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
          ${entry.pngSrc ? `<img data-preview-envelope style="width:100%;max-height:160px;object-fit:cover;margin-bottom:8px;">` : ""}
          <button type="button" class="btn btn-outline" data-upload-png style="width:100%;">
            ${entry.pngSrc ? "Görseli Değiştir" : "Görsel Yükle"}
          </button>
          <input type="file" accept="image/png,image/jpeg,image/webp" data-upload-png-input class="hidden">
        </div>
        <div class="field" style="margin-top:16px;padding-top:14px;border-top:1px dashed var(--line);">
          <label style="font-size:.76rem;color:var(--ink-soft);margin-bottom:5px;display:block;">İç Kart Görseli (isteğe bağlı)</label>
          ${entry.cardSrc ? `<img data-preview-card style="width:100%;max-height:160px;object-fit:cover;margin-bottom:8px;">` : ""}
          <button type="button" class="btn btn-outline" data-upload-card style="width:100%;">
            ${entry.cardSrc ? "Kartı Değiştir" : "Kart Görseli Yükle"}
          </button>
          <input type="file" accept="image/png,image/jpeg,image/webp" data-upload-card-input class="hidden">
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
        const sizeMB = SeozImageUtils.estimateFileSizeMB(file);
        if (!confirmLargeFile(sizeMB, "image")) return;
        SeozImageUtils.processImageFile(file).then(result => {
          entry.pngSrc = result.ref;
          renderBody();
          cb.onChange();
        }).catch(() => alert("Görsel yüklenemedi. Lütfen PNG, JPG veya WebP deneyin."));
      });

      const cardInput = bodyEl.querySelector("[data-upload-card-input]");
      bodyEl.querySelector("[data-upload-card]").addEventListener("click", () => cardInput.click());
      cardInput.addEventListener("change", () => {
        const file = cardInput.files[0];
        if (!file) return;
        const sizeMB = SeozImageUtils.estimateFileSizeMB(file);
        if (!confirmLargeFile(sizeMB, "image")) return;
        SeozImageUtils.processImageFile(file).then(result => {
          entry.cardSrc = result.ref;
          renderBody();
          cb.onChange();
        }).catch(() => alert("Kart görseli yüklenemedi. Lütfen PNG, JPG veya WebP deneyin."));
      });

      const removeCardBtn = bodyEl.querySelector("[data-remove-card]");
      if (removeCardBtn) {
        removeCardBtn.addEventListener("click", () => {
          entry.cardSrc = "";
          renderBody();
          cb.onChange();
        });
      }

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
            ${entry.cardOnlySrc ? `<img data-preview-card-only style="width:100%;max-height:160px;object-fit:cover;margin-bottom:8px;">` : ""}
            <button type="button" class="btn btn-outline" data-upload-card-only style="width:100%;">
              ${entry.cardOnlySrc ? "Kartı Değiştir" : "Kart Görseli Yükle"}
            </button>
            <input type="file" accept="image/png,image/jpeg,image/webp" data-upload-card-only-input class="hidden">
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
          const sizeMB = SeozImageUtils.estimateFileSizeMB(file);
          if (!confirmLargeFile(sizeMB, "image")) return;
          SeozImageUtils.processImageFile(file).then(result => {
            entry.cardOnlySrc = result.ref;
            renderBody();
            cb.onChange();
          }).catch(() => alert("Görsel yüklenemedi. Lütfen PNG, JPG veya WebP deneyin."));
        });

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
