/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — image-utils.js (yalnızca editör)
   -----------------------------------------------------------------------------
   DÜZELTME: Görseller/videolar/müzik artık işlendikten sonra doğrudan
   belgeye gömülü base64 olarak DEĞİL, js/core/blob-store.js üzerinden
   IndexedDB'ye kaydediliyor — dönen değer belgeye yazılacak KÜÇÜK bir
   referans dizesidir ("idb:..."), devasa bir base64 dizesi değil. Bu,
   önceki FAZ'larda karşılaşılan "Kaydedilemedi — depolama dolu" hatasının
   kök nedenini çözer (bkz. blob-store.js başındaki açıklama).

   Görsel küçültme mantığı DEĞİŞMEDİ: büyük görseller hâlâ makul bir
   azami boyuta küçültülüyor, PNG'ler şeffaflık için PNG kalıyor.
   ========================================================================= */

(function (global) {
  "use strict";

  const MAX_DIMENSION = 1600; // px — bundan büyük görseller küçültülür

  function readFileAsImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function canvasToBlob(canvas, mimeType, quality) {
    return new Promise(resolve => {
      if (canvas.toBlob) {
        canvas.toBlob(blob => resolve(blob), mimeType, quality);
      } else {
        // Çok eski tarayıcılar için yedek yol.
        const dataURL = canvas.toDataURL(mimeType, quality);
        fetch(dataURL).then(r => r.blob()).then(resolve);
      }
    });
  }

  /* Bir görsel dosyasını küçültür ve IndexedDB'ye kaydeder.
     Döner: { ref, naturalWidth, naturalHeight }
     "ref", katmanın content.src alanına yazılacak değerdir. */
  function processImageFile(file) {
    return readFileAsImage(file).then(img => {
      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const scale = MAX_DIMENSION / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      const keepPng = file.type === "image/png";
      const mimeType = keepPng ? "image/png" : "image/jpeg";
      const quality = keepPng ? undefined : 0.86;

      return canvasToBlob(canvas, mimeType, quality).then(blob =>
        SeozBlobStore.putBlob(blob).then(ref => ({
          ref,
          naturalWidth: width,
          naturalHeight: height
        }))
      );
    });
  }

  /* Video/ses gibi canvas'ta yeniden işlenemeyen dosyalar için: dosyayı
     (zaten bir Blob'dur) olduğu gibi IndexedDB'ye kaydeder — boyut
     küçültme YAPILMAZ (video/ses yeniden kodlamak tarayıcıda pratik
     değildir). Döner: ref (string). */
  function storeRawFile(file) {
    return SeozBlobStore.putBlob(file);
  }

  function estimateFileSizeMB(file) {
    return file.size / (1024 * 1024);
  }

  /* Geriye dönük uyumluluk için tutulan eski yardımcılar — yeni kod bu
     ikisini KULLANMAZ (yerlerini storeRawFile / estimateFileSizeMB aldı),
     ama başka bir yerde referans verilmiş olma ihtimaline karşı kaldırılmadı. */
  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function estimateDataURLSizeMB(dataURL) {
    const bytes = (dataURL.length * 3) / 4;
    return bytes / (1024 * 1024);
  }

  /* EK MADDE — ZEMİN PNG OTOMATİK ÜST/ALT RENK TAMAMLAMA:
     Yalnızca ZEMİN görseli yüklenirken kullanılır (diğer tüm görsel
     yükleme yolları — içerik katmanları, ürün kartları vb. —
     processImageFile'ı DEĞİŞMEDEN kullanmaya devam eder, bu fonksiyon
     onu hiç etkilemez).
     Üst ve alt kenardan birkaç piksel satırı örnekleyip, HER RENK
     KANALI İÇİN AYRI AYRI MEDYAN değeri hesaplar (tek bir piksel değil
     — bu, küçük bir dekoratif objenin (ör. bir balonun köşesi) rengini
     yanlışlıkla "zemin rengi" sanmayı önler; medyan, ortalamadan daha
     dirençlidir). Neredeyse tam şeffaf pikseller (PNG alfa kanalı)
     örneklemeden hariç tutulur — aksi halde şeffaf kenarlı PNG'lerde
     yanlış (siyah/beyaz) bir renk çıkabilirdi. */
  const EDGE_SAMPLE_STRIP_PX = 8; // kenardan kaç piksel satırı örneklenecek

  function medianOfChannel(values) {
    values.sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)];
  }

  function sampleEdgeColor(ctx, width, height, fromTop) {
    const stripHeight = Math.min(EDGE_SAMPLE_STRIP_PX, height);
    if (stripHeight <= 0) return null;
    const y = fromTop ? 0 : height - stripHeight;
    let imageData;
    try {
      imageData = ctx.getImageData(0, y, width, stripHeight);
    } catch (e) {
      // Bazı ortamlarda (ör. CORS kısıtlı canvas) getImageData başarısız
      // olabilir — bu durumda otomatik renk tamamlama sessizce atlanır,
      // zemin görseli eskisi gibi (rengsiz tamamlama olmadan) çalışmaya
      // devam eder.
      return null;
    }
    const data = imageData.data;
    const rs = [], gs = [], bs = [];
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 10) continue; // neredeyse tam şeffaf piksel — örneklemeye katma
      rs.push(data[i]); gs.push(data[i + 1]); bs.push(data[i + 2]);
    }
    if (rs.length === 0) return null; // tüm şerit şeffaf — renk çıkarılamadı
    const r = medianOfChannel(rs), g = medianOfChannel(gs), b = medianOfChannel(bs);
    return `rgb(${r}, ${g}, ${b})`;
  }

  /* processImageFile ile AYNI küçültme/kaydetme mantığını kullanır —
     tek fark, aynı çizilmiş canvas üzerinden EK olarak üst/alt kenar
     renklerini de hesaplayıp döndürmesidir.
     Döner: { ref, naturalWidth, naturalHeight, topColor, bottomColor }
     (topColor/bottomColor, renk çıkarılamazsa null olabilir — çağıran
     taraf bu durumda otomatik tamamlamayı uygulamaz.) */
  function processBackgroundImageFile(file) {
    return readFileAsImage(file).then(img => {
      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const scale = MAX_DIMENSION / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      const topColor = sampleEdgeColor(ctx, width, height, true);
      const bottomColor = sampleEdgeColor(ctx, width, height, false);

      const keepPng = file.type === "image/png";
      const mimeType = keepPng ? "image/png" : "image/jpeg";
      const quality = keepPng ? undefined : 0.86;

      return canvasToBlob(canvas, mimeType, quality).then(blob =>
        SeozBlobStore.putBlob(blob).then(ref => ({
          ref,
          naturalWidth: width,
          naturalHeight: height,
          topColor,
          bottomColor
        }))
      );
    });
  }

  global.SeozImageUtils = {
    processImageFile,
    processBackgroundImageFile,
    storeRawFile,
    estimateFileSizeMB,
    readFileAsDataURL,
    estimateDataURLSizeMB,
    MAX_DIMENSION
  };
})(window);
