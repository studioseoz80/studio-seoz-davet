/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — modules/guest-upload.js
   -----------------------------------------------------------------------------
   DÜZELTME 1 (tuval görünümü): Tuvalde artık YALNIZCA buton görünür —
   başlık, açıklama ve herhangi bir çerçeve/kart alanı KALDIRILDI. Bu
   alanlar hâlâ sağ özellik panelinden düzenlenebilir (ör. ileride farklı
   bir görünüme dönüştürülebilir), ama canvas'ta artık gösterilmiyor.

   DÜZELTME 2 (tıklama çalışmıyordu): Tuvaldeki tüm alan doğrudan
   butonun kendisi — tıklanabilir yüzeyle görünen yüzey birebir aynı.

   SON DÜZELTME — DOĞRUDAN DOSYA SEÇİMİNE BAĞLAMA: Buton artık
   window.open(uploadUrl) ile ayrı bir sayfa AÇMIYOR. Bunun yerine:
   1) Gizli bir <input type="file" accept="image/*,video/*" multiple>
      butonun kendi click event handler'ı İÇİNDE, doğrudan kullanıcı
      dokunuşuyla aynı çağrı yığınında .click() ile açılıyor — bu,
      iPhone/Android'de dosya/kamera seçicisinin engellenmemesi için
      ZORUNLU (tarayıcılar yalnızca doğrudan kullanıcı jestinden gelen
      .click() çağrılarına izin verir; setTimeout/Promise.then içinden
      çağrılsa engellenirdi).
   2) Seçilen her dosya FileReader ile base64'e çevrilip (yalnızca
      "data:...;base64," ön ekinden SONRAKİ kısım), doğrulanmış Apps
      Script sözleşmesine göre { data, type, name } JSON gövdesiyle
      s.uploadUrl'e POST edilir.
   3) ÖNEMLİ CORS NOTU: İstek, preflight (OPTIONS) tetiklememesi için
      Content-Type: text/plain ile gönderiliyor (Apps Script
      e.postData.contents ham gövdeyi okuduğu için içerik yine doğru
      JSON olarak parse edilir — bu, base64 gövdeyi bozmayan, yaygın
      bilinen bir teknik). AMA: yanıtın GERÇEKTEN okunabilir olup
      olmadığı (Apps Script deploy'unuzun CORS başlıkları) test
      edilmeden bilinemez — bu kod NETWORK ERİŞİMİ OLMADAN
      doğrulanamadı. Başarı mesajı YALNIZCA fetch'in GERÇEKTEN
      tamamlanıp yanıtın success:true döndürdüğü durumda gösterilir;
      mode:"no-cors" KULLANILMADI ve hiçbir sahte başarı varsayımı
      YAPILMADI — CORS/ağ hatası olursa dürüstçe hata mesajı gösterilir.
   ========================================================================= */

(function (global) {
  "use strict";

  const DEFAULTS = {
    title: "Anılarınızı Paylaşın",
    description: "Düğünümüzden çektiğiniz fotoğraf ve videoları bizimle paylaşır mısınız?",
    buttonText: "Anı Yükle",
    uploadUrl: "",
    fontFamily: "Manrope",
    textColor: "#1E2A22",
    bgColor: "#93703F",
    metallic: "none",
    buttonWidth: 220,
    buttonHeight: 46,
    borderRadius: 24
  };

  const SETTINGS_SCHEMA = [
    { key: "title", type: "text", label: "Başlık (yalnızca panelde — tuvalde gösterilmez)" },
    { key: "description", type: "textarea", label: "Açıklama (yalnızca panelde — tuvalde gösterilmez)" },
    { key: "buttonText", type: "text", label: "Buton Yazısı" },
    { key: "uploadUrl", type: "url", label: "Google Apps Script Yükleme Adresi (/exec)" },
    { key: "fontFamily", type: "font-select", label: "Font" },
    { key: "textColor", type: "color", label: "Yazı Rengi" },
    { key: "bgColor", type: "color", label: "Buton Rengi" },
    {
      key: "metallic", type: "select", label: "Buton Metalik Efekti",
      options: [{ value: "none", label: "Yok" }, { value: "gold", label: "Altın (Koyu Zemin)" }, { value: "silver", label: "Gümüş (Koyu Zemin)" }, { value: "copper-gold", label: "Bakır Altın (Açık Zemin)" }, { value: "dark-silver", label: "Koyu Gümüş (Açık Zemin)" }]
    },
    { key: "buttonWidth", type: "number", label: "Buton Genişliği", unit: "px", min: 60 },
    { key: "buttonHeight", type: "number", label: "Buton Yüksekliği", unit: "px", min: 30 },
    { key: "borderRadius", type: "number", label: "Köşe Yuvarlaklığı", unit: "px", min: 0 }
  ];

  function buttonBackground(s) {
    const g = global.SeozRenderer && global.SeozRenderer.METALLIC_GRADIENTS;
    return (g && g[s.metallic]) || s.bgColor;
  }

  // Bir dosyayı base64'e çevirir ve "data:...;base64," ön ekini ATARAK
  // yalnızca doğrulanmış Apps Script sözleşmesinin beklediği HAM base64
  // gövdeyi döndürür.
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result || "";
        const commaIdx = result.indexOf(",");
        resolve(commaIdx !== -1 ? result.slice(commaIdx + 1) : result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Doğrulanmış sözleşmeye göre tek bir dosyayı yükler:
  // POST { data, type, name } — Content-Type: text/plain (CORS preflight
  // TETİKLEMEMESİ için; Apps Script e.postData.contents ham gövdeyi okur,
  // içerik yine JSON olarak doğru parse edilir).
  // GÜVENLİK/DÜRÜSTLÜK: yanıt gerçekten okunamıyorsa (CORS/ağ hatası)
  // BAŞARILI SAYILMAZ — mode:"no-cors" kullanılmaz, sahte başarı YOKTUR.
  function uploadOne(uploadUrl, file) {
    return fileToBase64(file).then(base64 =>
      fetch(uploadUrl, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ data: base64, type: file.type, name: file.name })
      })
    ).then(response => {
      if (!response.ok) throw new Error("HTTP " + response.status);
      return response.json();
    }).then(result => {
      if (!result || result.success !== true) throw new Error("Sunucu success:true döndürmedi");
      return result;
    });
  }

  function render(settings, mode, ctx) {
    const s = Object.assign({}, DEFAULTS, settings);

    // Tuvaldeki katmanın TAMAMI butonun kendisidir — ayrı bir dış
    // sarmalayıcı/kart YOK. Bu sayede görünen yüzey ile tıklanabilir
    // yüzey birebir aynıdır.
    const btn = document.createElement("button");
    btn.type = "button";
    const originalText = s.buttonText || "Anı Yükle";
    btn.textContent = originalText;
    // MADDE 7 (önceki düzeltme, korunuyor): bağlantı yoksa buton görsel
    // ve işlevsel olarak PASİF — yanlış bir yere yönlendirmek yerine.
    const hasLink = !!s.uploadUrl;
    Object.assign(btn.style, {
      width: "100%",
      height: "100%",
      minWidth: s.buttonWidth + "px",
      minHeight: s.buttonHeight + "px",
      borderRadius: s.borderRadius + "px",
      background: buttonBackground(s),
      color: s.textColor,
      fontFamily: `"${s.fontFamily}", sans-serif`,
      border: "none",
      cursor: hasLink ? "pointer" : "not-allowed",
      opacity: hasLink ? "1" : ".45",
      display: "block"
    });
    if (!hasLink) btn.disabled = true;

    // Gizli dosya seçici — ekranda GÖRÜNMEZ, ama DOM'da gerçek bir
    // input olduğu için iOS/Android'de kamera/galeri/dosya seçim
    // sayfasını normal şekilde açabilir.
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*,video/*";
    fileInput.multiple = true;
    Object.assign(fileInput.style, {
      position: "absolute",
      width: "1px", height: "1px",
      padding: "0", margin: "-1px",
      overflow: "hidden",
      clip: "rect(0,0,0,0)",
      border: "0"
    });
    btn.appendChild(fileInput);

    let uploading = false;

    function setButtonState(text, disabled) {
      btn.textContent = text;
      btn.disabled = disabled;
      btn.style.cursor = disabled ? "not-allowed" : "pointer";
    }

    fileInput.addEventListener("change", () => {
      const files = Array.from(fileInput.files || []);
      fileInput.value = ""; // aynı dosyayı tekrar seçebilmek için sıfırla
      if (files.length === 0) return; // Madde 5/6: seçim yapılmadıysa veya iptal edildiyse HİÇBİR ŞEY yapma, hata gösterme

      uploading = true;
      setButtonState("Yükleniyor...", true);

      // Madde 10: birden fazla dosya SIRAYLA (art arda, aynı anda değil —
      // Apps Script tek seferde bir isteği işlediği için bu daha güvenli).
      let chain = Promise.resolve();
      files.forEach(file => {
        chain = chain.then(() => uploadOne(s.uploadUrl, file));
      });

      chain.then(() => {
        uploading = false;
        setButtonState("Anınız yüklendi ✓", false);
        setTimeout(() => { if (!uploading) setButtonState(originalText, false); }, 2500);
      }).catch(() => {
        uploading = false;
        setButtonState("Yükleme sırasında bir sorun oluştu. Lütfen tekrar deneyin.", false);
        setTimeout(() => { if (!uploading) setButtonState(originalText, false); }, 3500);
      });
    });

    btn.addEventListener("click", () => {
      // GÜVENLİK (MADDE 7 — korunuyor): yalnızca BU modülün kendi
      // "uploadUrl" değeri kullanılır. Konum'un mapsUrl'ine veya RSVP'nin
      // googleFormUrl/whatsappNumber'ına ASLA fallback yapılmaz.
      if (!s.uploadUrl || uploading) return;
      // ÖNEMLİ: .click() burada, DOĞRUDAN kullanıcı dokunuşuyla aynı
      // çağrı yığınında (senkron) tetikleniyor — bu, iOS/Android'in
      // dosya/kamera seçiciyi engellememesi için ZORUNLUDUR.
      fileInput.click();
    });

    return btn;
  }

  global.SeozModuleRegistry.registerModule({
    id: "guest-upload",
    label: "Anı Yükle",
    defaultSettings: DEFAULTS,
    defaultLayerSize: { w: 220, h: 46 },
    settingsSchema: SETTINGS_SCHEMA,
    render: render,
    validate: (s) => (!s.uploadUrl ? "Anı Yükle: harici yükleme bağlantısı girilmemiş." : null)
  });
})(window);
