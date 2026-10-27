/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — modules/guest-upload.js  (Anı Yükle)
   -----------------------------------------------------------------------------
   Tuvalde YALNIZCA buton görünür (görünen yüzey = dokunulan yüzey). Dokununca
   telefonun galeri/kamera/dosya seçicisi açılır; seçilen fotoğraf ve videolar
   hemen yüklenir. İki yükleme yöntemi vardır (ayar: method):

   1) "seoz"  — Studio SEOZ depolaması (Supabase Storage, "ani-yukleme" alanı).
      Dosya davetiyenin klasörüne eklenir; misafir listeleyemez/silemez.
      Fotoğrafları müşteri, yayında verilen gizli albüm linkinden görür/indirir
      (album.html#k=...). Kurulum: supabase/ani-yukleme.sql.
   2) "drive" — müşterinin kendi Google Drive'ı (Google Apps Script /exec adresi).
      Kurulum ve betik: ANI-YUKLE-GOOGLE-DRIVE.md. Eski kayıtlar (method alanı
      olmayanlar) bu yöntemle, eskisi gibi çalışır.

   Eski sürümdeki hata: yükleme adresi alanına gerçek bir Apps Script adresi
   yerine düz yazı ("İŞ" gibi) girilebiliyordu; tarayıcı dosyayı davetiye
   sitesinin kendisine göndermeye çalışıp hata veriyordu. Artık adres
   doğrulanır, ayarlı değilse galeri hiç açılmadan anlaşılır mesaj çıkar.

   Telefonda hız ve kota için büyük fotoğraflar yüklemeden önce en uzun kenarı
   2560 px olacak şekilde JPEG'e küçültülür (videolar olduğu gibi gider).
   ÖNEMLİ: input.click() doğrudan dokunuşla aynı çağrı yığınında çağrılır —
   iPhone/Android'in seçiciyi engellememesi için zorunludur.
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
  const BUCKET = "ani-yukleme";
  const MAX_MB = { seoz: 25, drive: 30 };
  const DRIVE_RE = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{20,}\/exec\/?$/;
  const isDrive = s => (s.method || "drive") === "drive";   // method alanı olmayan eski kayıtlar: Google Drive

  const SETTINGS_SCHEMA = [
    { key: "title", type: "text", label: "Başlık (yalnızca panelde — tuvalde gösterilmez)" },
    { key: "description", type: "textarea", label: "Açıklama (yalnızca panelde — tuvalde gösterilmez)" },
    { key: "buttonText", type: "text", label: "Buton Yazısı" },
    { key: "method", type: "select", label: "Fotoğraflar nereye yüklensin?", reRenderPanel: true,
      options: [{ value: "drive", label: "Müşterinin Google Drive'ı (Apps Script)" }, { value: "seoz", label: "Studio SEOZ depolaması (albüm linki)" }] },
    { key: "uploadUrl", type: "url", label: "Google Apps Script adresi (https://script.google.com/macros/s/…/exec)", showIf: s => isDrive(s) },
    { key: "_driveTest", type: "action-button", label: "Google Drive bağlantısını test et", action: "testDrive", showIf: s => isDrive(s) },
    { key: "fontFamily", type: "font-select", label: "Font" },
    { key: "textColor", type: "color", label: "Yazı Rengi" },
    { key: "bgColor", type: "color", label: "Buton Rengi" },
    {
      key: "metallic", type: "select", label: "Buton Metalik Efekti",
      options: [{ value: "none", label: "Yok" }, { value: "gold", label: "Altın (Koyu Zemin)" }, { value: "silver", label: "Gümüş (Koyu Zemin)" }, { value: "copper-gold", label: "Bakır Altın (Açık Zemin)" }, { value: "dark-silver", label: "Koyu Gümüş (Açık Zemin)" }, { value: "copper", label: "Bakır" }]
    },
    { key: "buttonWidth", type: "number", label: "Buton Genişliği", unit: "px", min: 60 },
    { key: "buttonHeight", type: "number", label: "Buton Yüksekliği", unit: "px", min: 30 },
    { key: "borderRadius", type: "number", label: "Köşe Yuvarlaklığı", unit: "px", min: 0 }
  ];

  function buttonBackground(s) {
    const g = global.SeozRenderer && global.SeozRenderer.METALLIC_GRADIENTS;
    return (g && g[s.metallic]) || s.bgColor;
  }
  const cfg = () => global.SEOZ_SUPABASE_CONFIG || {};
  const base = () => String(cfg().url || "").trim().replace(/\/+$/, "");
  const key = () => String(cfg().anonKey || "").trim();
  function currentSlug() {
    if (global.SeozCloudStore && global.SeozCloudStore.currentSlug) return global.SeozCloudStore.currentSlug();
    try { return new URLSearchParams(global.location.search).get("slug") || ""; } catch (e) { return ""; }
  }

  /* ---------------- misafire anlaşılır mesaj (ekranın altında) ---------------- */
  function toast(text, kind) {
    let t = document.querySelector(".gu-toast");
    if (!t) {
      t = document.createElement("div"); t.className = "gu-toast"; t.setAttribute("role", "status"); t.setAttribute("aria-live", "polite");
      Object.assign(t.style, { position: "fixed", left: "50%", bottom: "calc(18px + env(safe-area-inset-bottom, 0px))", transform: "translateX(-50%)", zIndex: "3000",
        maxWidth: "min(92vw, 420px)", padding: "12px 16px", borderRadius: "14px", font: "600 14px/1.35 Manrope, system-ui, sans-serif", textAlign: "center",
        boxShadow: "0 10px 30px rgba(0,0,0,.25)", transition: "opacity .3s", pointerEvents: "none" });
      document.body.appendChild(t);
    }
    t.textContent = text;
    Object.assign(t.style, { background: kind === "err" ? "#7A1F2B" : kind === "ok" ? "#1F6B45" : "#2B2622", color: "#fff", opacity: "1" });
    clearTimeout(toast.tm); toast.tm = setTimeout(() => { t.style.opacity = "0"; }, kind === "err" ? 6500 : 4200);
  }

  /* ---------------- dosya hazırlama: büyük fotoğrafı küçült ---------------- */
  function shrinkImage(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 1.5 * 1024 * 1024) return Promise.resolve(file);
    return new Promise(resolve => {
      const url = URL.createObjectURL(file), im = new Image();
      im.onload = () => {
        try {
          const k = Math.min(1, 2560 / Math.max(im.naturalWidth, im.naturalHeight));
          const c = document.createElement("canvas"); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
          const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
          c.toBlob(b => { URL.revokeObjectURL(url); resolve(b && b.size < file.size ? Object.assign(b, { name: file.name.replace(/\.\w+$/, "") + ".jpg" }) : file); }, "image/jpeg", 0.86);
        } catch (e) { URL.revokeObjectURL(url); resolve(file); }
      };
      im.onerror = () => { URL.revokeObjectURL(url); resolve(file); };   // çözülemeyen biçim (ör. HEIC): olduğu gibi
      im.src = url;
    });
  }
  function typeOf(f) {
    if (f.type) return f.type;
    const ext = (String(f.name || "").split(".").pop() || "").toLowerCase();
    return { heic: "image/heic", heif: "image/heif", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", mov: "video/quicktime", mp4: "video/mp4" }[ext] || "";
  }
  function fail(code, extra) { const e = new Error(code); e.code = code; if (extra) Object.assign(e, extra); return e; }

  /* ---------------- yöntem 1: Studio SEOZ depolaması ---------------- */
  async function uploadSeoz(file, slug) {
    if (!base() || !key()) throw fail("not_configured");
    const blob = await shrinkImage(file), type = typeOf(blob) || typeOf(file);
    const ext = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/heic": "heic", "image/heif": "heif", "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm" })[type];
    if (!ext) throw fail("type");
    if (blob.size > MAX_MB.seoz * 1048576) throw fail("too_large");
    // Tahmin edilemez dosya adı: 16 bayt (128 bit) güvenli rastgele → 22 karakter (A-Z a-z 0-9 - _).
    // Sunucudaki depolama kuralı yalnızca bu biçimdeki adları kabul eder.
    if (!(global.crypto && global.crypto.getRandomValues)) throw fail("server", { detail: "crypto_unavailable" });
    const rnd = btoa(String.fromCharCode.apply(null, global.crypto.getRandomValues(new Uint8Array(16)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const path = `${slug}/${Date.now().toString(36)}-${rnd}.${ext}`;
    let res;
    try {
      res = await fetch(`${base()}/storage/v1/object/${BUCKET}/${path}`, { method: "POST", headers: { apikey: key(), Authorization: "Bearer " + key(), "Content-Type": type, "x-upsert": "false", "cache-control": "3600" }, body: blob });
    } catch (e) { throw fail("network"); }
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      if (res.status === 413 || /too large|exceed/i.test(t)) throw fail("too_large");
      if (/row-level security|unauthori|403/i.test(t) || res.status === 403) throw fail("closed");
      throw fail("server", { detail: res.status + " " + t.slice(0, 200) });
    }
    let r;
    try {
      r = await fetch(`${base()}/rest/v1/rpc/memory_register`, { method: "POST", headers: { apikey: key(), Authorization: "Bearer " + key(), "Content-Type": "application/json" },
        body: JSON.stringify({ p_slug: slug, p_path: path, p_mime: type, p_size: blob.size, p_name: null }) });
    } catch (e) { throw fail("network"); }
    if (!r.ok) { const t = await r.text().catch(() => ""); throw fail(/album_closed/.test(t) ? "closed" : "server", { detail: t.slice(0, 200) }); }
    return true;
  }

  /* ---------------- yöntem 2: Google Drive (Apps Script) ----------------
     POST { data, type, name } — Content-Type: text/plain (CORS ön isteği olmasın diye;
     Apps Script e.postData.contents'ı JSON olarak okur). Başarı yalnızca yanıt gerçekten
     success:true ise sayılır; sahte başarı yok. */
  function toBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => { const r = String(reader.result || ""); const i = r.indexOf(","); resolve(i !== -1 ? r.slice(i + 1) : r); };
      reader.onerror = reject; reader.readAsDataURL(blob);
    });
  }
  async function uploadDrive(file, url) {
    const blob = await shrinkImage(file), type = typeOf(blob) || typeOf(file);
    if (!/^(image|video)\//.test(type)) throw fail("type");
    if (blob.size > MAX_MB.drive * 1048576) throw fail("too_large");
    const data = await toBase64(blob);
    let res;
    try {
      res = await fetch(url, { method: "POST", mode: "cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ data, type, name: blob.name || file.name || "ani" }) });
    } catch (e) { throw fail("network_or_permission"); }   // Apps Script "Herkes" erişimine açık değilse tarayıcı yanıtı okuyamaz
    if (!res.ok) throw fail("server", { detail: "HTTP " + res.status });
    let j = null; try { j = await res.json(); } catch (e) { throw fail("server", { detail: "JSON değil" }); }
    if (!j || j.success !== true) throw fail("server", { detail: j && j.error });
    return true;
  }

  const MSG = {
    not_configured: "Anı yükleme henüz ayarlanmamış. Lütfen davet sahibine bildirin.",
    closed: "Anı yükleme şu anda kapalı.",
    network: "İnternet bağlantısı kurulamadı. Bağlantınızı kontrol edip tekrar deneyin.",
    network_or_permission: "Yükleme adresine ulaşılamadı. İnternet bağlantınızı kontrol edin; sorun sürerse davet sahibine bildirin.",
    too_large: "Dosya çok büyük",
    type: "Bu dosya türü desteklenmiyor (fotoğraf veya video seçin).",
    server: "Yükleme sırasında bir sorun oluştu. Lütfen biraz sonra tekrar deneyin.",
    preview: "Bu bir önizleme: yükleme, yayınlanan davetiyede çalışır."
  };

  function render(settings, mode) {
    const s = Object.assign({}, DEFAULTS, settings);
    const drive = isDrive(s);
    const btn = document.createElement("button");
    btn.type = "button";
    const originalText = s.buttonText || "Anı Yükle";
    btn.textContent = originalText;
    const hasLink = drive ? !!s.uploadUrl : true;   // görünüm eskisiyle aynı: Drive'da adres hiç yoksa soluk
    Object.assign(btn.style, {
      width: "100%", height: "100%", minWidth: s.buttonWidth + "px", minHeight: s.buttonHeight + "px", borderRadius: s.borderRadius + "px",
      background: buttonBackground(s), color: s.textColor, fontFamily: `"${s.fontFamily}", sans-serif`, border: "none",
      cursor: hasLink ? "pointer" : "not-allowed", opacity: hasLink ? "1" : ".45", display: "block"
    });
    if (!hasLink) btn.disabled = true;

    const fileInput = document.createElement("input");
    fileInput.type = "file"; fileInput.accept = "image/*,video/*"; fileInput.multiple = true;
    Object.assign(fileInput.style, { position: "absolute", width: "1px", height: "1px", padding: "0", margin: "-1px", overflow: "hidden", clip: "rect(0,0,0,0)", border: "0" });
    btn.appendChild(fileInput);

    let uploading = false;
    const setText = t => { btn.firstChild && btn.firstChild.nodeType === 3 ? (btn.firstChild.nodeValue = t) : btn.insertBefore(document.createTextNode(t), btn.firstChild); };
    const setBusy = (t, on) => { setText(t); btn.disabled = on; btn.style.cursor = on ? "progress" : "pointer"; };

    fileInput.addEventListener("change", () => {
      const files = Array.from(fileInput.files || []);
      fileInput.value = "";
      if (!files.length) return;   // seçim iptal edildi: hiçbir şey yapma
      const slug = currentSlug();
      uploading = true;
      let done = 0, ok = 0; const errs = [];
      const up = f => (drive ? uploadDrive(f, s.uploadUrl.trim()) : uploadSeoz(f, slug));
      let chain = Promise.resolve();
      files.forEach((f, i) => {
        chain = chain.then(() => { setBusy(files.length > 1 ? `Yükleniyor ${i + 1}/${files.length}…` : "Yükleniyor…", true); toast(files.length > 1 ? `Yükleniyor: ${i + 1}/${files.length}` : "Yükleniyor…"); })
          .then(() => up(f)).then(() => { ok++; }, e => { errs.push({ f, e }); if (e && e.detail) console.warn("[Studio SEOZ] Anı Yükle:", e.code, e.detail); })
          .then(() => { done++; });
      });
      chain.then(() => {
        uploading = false;
        if (!errs.length) {
          setBusy("Yüklendi ✓", false);
          toast(`Teşekkürler! ${ok} ${ok === 1 ? "dosya" : "dosya"} yüklendi ✓`, "ok");
        } else {
          const e0 = errs[0].e || {}, code = e0.code || "server";
          const why = code === "too_large" ? `${MSG.too_large} (en çok ${drive ? MAX_MB.drive : MAX_MB.seoz} MB): ${errs.map(x => x.f.name).slice(0, 2).join(", ")}` : (MSG[code] || MSG.server);
          setBusy(ok ? "Kısmen yüklendi" : "Yüklenemedi", false);
          toast(ok ? `${ok} dosya yüklendi, ${errs.length} dosya yüklenemedi. ${why}` : why, "err");
        }
        setTimeout(() => { if (!uploading) setBusy(originalText, false); }, 3000);
      });
    });

    btn.addEventListener("click", e => {
      if (uploading) return;
      // GÜVENLİK: yalnızca BU modülün kendi uploadUrl değeri kullanılır; başka modüllerin bağlantılarına asla geçilmez.
      if (drive) {
        if (!s.uploadUrl) return;
        if (!DRIVE_RE.test(String(s.uploadUrl).trim())) { e.preventDefault(); toast(MSG.not_configured, "err"); return; }
      } else {
        if (!base() || !key()) { toast(MSG.not_configured, "err"); return; }
        if (!currentSlug()) { toast(MSG.preview); return; }
      }
      fileInput.click();   // doğrudan dokunuşla aynı çağrı yığınında (iOS/Android)
    });
    return btn;
  }

  // Editör: Google Drive betiğine "ping" atar (doGet) — betik doğru kurulmuş ve herkese açık mı?
  function testDrive(layer) {
    const url = String((layer.settings || {}).uploadUrl || "").trim();
    if (!DRIVE_RE.test(url)) { alert("Adres geçersiz.\n\nGoogle Apps Script'te Dağıt → Yeni dağıtım → Web uygulaması ile alınan, https://script.google.com/macros/s/…/exec biçimindeki adresi yapıştırın.\n\nAyrıntılı kurulum: ANI-YUKLE-GOOGLE-DRIVE.md"); return; }
    fetch(url + (url.indexOf("?") < 0 ? "?" : "&") + "ping=1", { method: "GET" })
      .then(r => r.json()).then(j => {
        if (j && j.ok) alert("Bağlantı çalışıyor ✓\n\nKlasör: " + (j.folder || "?") + "\nYüklenen fotoğraflar bu klasöre gelecek.");
        else alert("Betik yanıt verdi ama beklenen biçimde değil. Betiğin ANI-YUKLE-GOOGLE-DRIVE.md'deki kodla aynı olduğundan emin olun.");
      })
      .catch(() => alert("Betiğe ulaşılamadı.\n\nEn sık neden: dağıtımda \"Erişimi olan: Herkes\" seçilmemiş ya da betik yetkilendirilmemiş. ANI-YUKLE-GOOGLE-DRIVE.md'deki adımları kontrol edin."));
  }

  global.SeozModuleRegistry.registerModule({
    id: "guest-upload",
    label: "Anı Yükle",
    defaultSettings: Object.assign({}, DEFAULTS, { method: "seoz" }),   // yeni eklenen: Studio SEOZ depolaması
    defaultLayerSize: { w: 220, h: 46 },
    settingsSchema: SETTINGS_SCHEMA,
    render: render,
    panelActions: { testDrive },
    validate: (s) => {
      s = Object.assign({}, DEFAULTS, s);
      if (!isDrive(s)) return null;
      if (!s.uploadUrl) return "Anı Yükle: Google Drive yükleme adresi girilmemiş.";
      if (!DRIVE_RE.test(String(s.uploadUrl).trim())) return "Anı Yükle: Google Drive yükleme adresi geçersiz (https://script.google.com/macros/s/…/exec olmalı). Misafirler yükleme yapamaz.";
      return null;
    }
  });
  global.SeozGuestUpload = { DRIVE_RE, isDrive };
})(window);
