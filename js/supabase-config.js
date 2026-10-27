/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — supabase-config.js
   -----------------------------------------------------------------------------
   Supabase bağlantı bilgilerinin TEK yeri. Hem editör (index.html) hem
   müşteri sayfası (view.html) bu dosyayı okur.

   NEREDEN BULUNUR: Supabase panelinde projenizi açın →
   Project Settings → API (veya "API Keys").

   !!! ÇOK ÖNEMLİ !!!
   - Buraya YALNIZCA "anon" / "publishable" anahtarı yazılır.
   - "service_role" / "secret" anahtarını ASLA buraya yazmayın. Bu dosya
     müşterinin tarayıcısına gider; herkes okuyabilir. (Yanlışlıkla
     yazılırsa sistem bunu fark edip bağlantıyı kullanmayı reddeder.)

   Alanlar boş bırakılırsa editör eskisi gibi çalışır: "Yayına Hazırla"
   yalnızca bu tarayıcıya yerel yayın yapar, Supabase'e hiçbir şey gitmez.
   ========================================================================= */

window.SEOZ_SUPABASE_CONFIG = {
  // ör. "https://abcdefghijkl.supabase.co"
  url: "https://wzpbegueescmrtlflayp.supabase.co",            // ← BURAYA SUPABASE PROJECT URL

  // ör. "eyJhbGciOi..." (eski anon key) veya "sb_publishable_..." (yeni)
  anonKey: "sb_publishable_w5Sev5_9V5FMPpPWh9eQZA_ZcuQ1ahb",        // ← BURAYA ANON / PUBLISHABLE KEY

  // Görsel / video / müzik dosyalarının yükleneceği Storage bucket'ı.
  // Supabase'de bu adla PUBLIC bir bucket oluşturulmalı (bkz. rehber).
  assetsBucket: "davetiye-medya",

  // Müşteriye verilecek bağlantının adresi: view.html'in yayında olduğu
  // tam adres. ör. "https://davet.studioseoz.com/view.html"
  // Boş bırakılırsa editörün açık olduğu adresteki view.html kullanılır
  // (bu, yalnızca editör de aynı sitede yayındaysa doğru olur).
 publicViewUrl: "https://seoz-davet.pages.dev/view.html",

  // KISA BAĞLANTI: davetiyeler "<bu adres><slug>" olarak paylaşılır (ör. https://davet.studioseoz.com/kina-8vsgeh).
  // Önce alan adı Cloudflare'de müşteri projesine (seoz-davet) bağlanmalı; sonra buraya yazılır.
  // Boşsa kısa bağlantı publicViewUrl'in alan adıyla üretilir (ör. https://seoz-davet.pages.dev/kina-8vsgeh).
  shortBaseUrl: ""
};

/* ÖNİZLEME KORUMASI — Cloudflare'in dal önizleme adreslerinde (ör. animasyon-uyum.studio-seoz-davet.pages.dev)
   canlı veritabanına ve depoya YAZMA engellenir: yayınlama, katılım/anket gönderme, dosya yükleme, giriş
   bağlantısı çalışmaz; yayındaki davetiyeleri OKUMA ve okuma amaçlı sorgular çalışır. Gerçek (canlı) adreslerde
   (studio-seoz-davet.pages.dev, seoz-davet.pages.dev, kendi alan adınız) ve bilgisayarda bu blok hiçbir şey yapmaz. */
(function () {
  var h = location.hostname;
  if (!(/\.pages\.dev$/.test(h) && h.split(".").length > 3)) return;
  window.SEOZ_PREVIEW = true;
  var READ_RPC = /\/rest\/v1\/rpc\/[a-z_]*(_get|_get_own|_accepts)$/;
  var realFetch = window.fetch;
  window.fetch = function (input, init) {
    var url = String(input && input.url ? input.url : input), method = String((init && init.method) || (input && input.method) || "GET").toUpperCase();
    if (/supabase\.co\//.test(url) && method !== "GET" && method !== "HEAD" && !READ_RPC.test(url.split("?")[0])) {
      console.warn("[Studio SEOZ] Önizleme: canlı veriye yazma kapalı →", method, url.split("?")[0]);
      return Promise.reject(new Error("Önizleme sürümünde yayınlama ve veri kaydı kapalıdır."));
    }
    return realFetch.apply(this, arguments);
  };
  document.addEventListener("DOMContentLoaded", function () {
    var b = document.createElement("div");
    b.textContent = "ÖNİZLEME · yayın ve veri kaydı kapalı";
    b.setAttribute("style", "position:fixed;left:8px;bottom:8px;z-index:2147483000;background:rgba(122,31,43,.92);color:#fff;font:600 11px/1.2 Manrope,system-ui,sans-serif;letter-spacing:.04em;padding:5px 9px;border-radius:999px;pointer-events:none");
    document.body.appendChild(b);
  });
})();
