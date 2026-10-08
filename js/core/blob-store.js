/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — blob-store.js
   -----------------------------------------------------------------------------
   DÜZELTME (localStorage depolama sınırı hatası): Görseller, videolar ve
   müzik dosyaları artık doğrudan belgenin JSON'una (ve dolayısıyla
   localStorage'a) gömülü base64 olarak YAZILMIYOR. Bunun yerine tarayıcının
   IndexedDB'sine (localStorage'dan çok daha büyük bir kotaya sahip, genelde
   yüzlerce MB) bir Blob olarak kaydediliyor; belgede yalnızca küçük bir
   referans dizesi tutuluyor: "idb:<anahtar>".

   Bu, editör/view.html tarafında BAŞKA HİÇBİR ŞEYİ DEĞİŞTİRMEZ — bir
   katmanın/modülün "src" alanı hâlâ bir metin dizesidir, yalnızca artık
   bazen gerçek veri yerine bu küçük referansı tutar. Görseli/videoyu
   gerçekten göstermek isteyen kod (renderer.js, entry-scene.js,
   modules/music.js) SeozBlobStore.resolveToObjectURL() ile bu referansı
   kullanılabilir bir adrese çevirir.

   GERİYE DÖNÜK UYUMLULUK: Daha önce kaydedilmiş belgelerdeki eski, gerçek
   base64 data URL'leri hâlâ çalışır — resolveToObjectURL() "idb:" ile
   başlamayan bir değeri olduğu gibi geri döndürür.

   IndexedDB açılamazsa (çok eski tarayıcı, bazı gizli/kısıtlı mod
   durumları) sessizce eski davranışa (gömülü data URL) döner — uygulama
   hiçbir zaman bu yüzden çökmez.
   ========================================================================= */

(function (global) {
  "use strict";

  const DB_NAME = "seoz_editor_assets_v1";
  const STORE_NAME = "blobs";
  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!global.indexedDB) { reject(new Error("Bu tarayıcıda IndexedDB yok.")); return; }
      const req = global.indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE_NAME)) {
          req.result.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("IndexedDB açılamadı."));
    });
    return dbPromise;
  }

  function generateKey() {
    return "b" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /* Bir Blob'u (veya File'ı — File zaten bir Blob'dur) IndexedDB'ye
     kaydeder ve "idb:<anahtar>" referansını döndürür. IndexedDB
     kullanılamıyorsa, ESKİ DAVRANIŞA döner: gerçek bir base64 data URL
     üretip onu döndürür (bu durumda çağıran taraf normal şekilde çalışmaya
     devam eder, yalnızca localStorage sınırı riski geri gelir — bu yüzden
     konsola açık bir uyarı yazılır). */
  function putBlob(blob) {
    return openDB()
      .then(db => new Promise((resolve, reject) => {
        const key = generateKey();
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(blob, key);
        tx.oncomplete = () => resolve("idb:" + key);
        tx.onerror = () => reject(tx.error);
      }))
      .catch(err => {
        console.warn(
          "[Studio SEOZ] IndexedDB kullanılamadı, dosya eski yönteme " +
          "(gömülü data URL) göre kaydedilecek — büyük dosyalarda " +
          "localStorage sınırına ulaşma riski geri döner.", err
        );
        return blobToDataURL(blob);
      });
  }

  function getBlob(key) {
    return openDB().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    }));
  }

  function isRef(value) {
    return typeof value === "string" && value.indexOf("idb:") === 0;
  }

  const objectURLCache = new Map();

  /* Bir "src" alanını (ref olsun ya da olmasın) tarayıcıda doğrudan
     kullanılabilir bir adrese çevirir. Ref değilse (boş, http url, veya
     eski bir gömülü data URL) DEĞİŞTİRMEDEN geri döndürür. */
  function resolveToObjectURL(value) {
    if (!value) return Promise.resolve("");
    if (!isRef(value)) return Promise.resolve(value);
    if (objectURLCache.has(value)) return Promise.resolve(objectURLCache.get(value));
    const key = value.slice(4);
    return getBlob(key).then(blob => {
      if (!blob) return "";
      const url = URL.createObjectURL(blob);
      objectURLCache.set(value, url);
      return url;
    }).catch(() => "");
  }

  global.SeozBlobStore = { putBlob, getBlob, isRef, resolveToObjectURL };
})(window);
