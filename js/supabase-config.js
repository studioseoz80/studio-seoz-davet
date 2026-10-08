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
  publicViewUrl: ""
};
