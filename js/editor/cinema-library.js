/* =============================================================================
   STUDIO SEOZ — editor/cinema-library.js  (A2.5 · KURGU KÜTÜPHANESİ)
   -----------------------------------------------------------------------------
   Animasyon Stüdyosu için hazır kurgular ve kullanıcının kendi kayıtlı
   kurguları. Bu dosya yalnızca EDİTÖRDE çalışır; bir kurgu uygulandığında
   davetiyeye yazılan şey her zamanki "hareket listesi"dir (entry.cinema.actions),
   yani müşteri sayfası bu dosyayı hiç yüklemez.

   - Hazır kurgular belirli bir nesneye değil ROLLERE bağlıdır ("ana görsel",
     "mühür", "anahtar"…). Uygularken her rol kullanıcının bir katmanına bağlanır.
   - Kayıtlı kurgular bu bilgisayarda saklanır (localStorage); görseller
     tarayıcının kendi deposunda (IndexedDB) kalır. Supabase'e hiçbir şey yazılmaz.
   - Dışa aktarma: yalnız kurgu (.json) ya da görsellerle birlikte (.zip).
     İçe aktarma ikisini de kabul eder.
   ========================================================================= */
(function (global) {
  "use strict";

  const KEY = "seoz_cinema_kurgular_v1";
  const FORMAT = "studio-seoz-kurgu";

  /* -------------------------------------------------------------------------
     HAZIR KURGULAR
     roles: [{ key, label, need (zorunlu mu), hint }]
     acts : [{ role, move, start, delay, duration, easing, repeat, params, gdir }]
     set  : oynatma ayarları (konsept, ipucu, geçiş…)
     tags : hangi davet/işletme paketlerine önerildiği (İç Zemin paketleri kullanır)
     ------------------------------------------------------------------------- */
  const ANA = { key: "ana", label: "Ana görsel", need: true, hint: "Kapı, zarf, kutu, kart… açılacak olan görsel" };
  const BUILTIN = [
    { id: "k:zarif", label: "Zarif dokunuş", group: "Tek görsel", tags: ["dugun", "nisan", "kurumsal", "danisman"],
      desc: "Görsel süzülür, üzerinden ışık geçer; dokununca yakınlaşır, ışık patlar ve kart gelir.",
      roles: [ANA], set: { concept: "zarif" },
      acts: [{ role: "ana", move: "float", start: "with", repeat: 0, duration: 2.6 }, { role: "ana", move: "sheen", start: "with", repeat: 0, duration: 1.5 },
        { role: "ana", move: "zoom", start: "tap", duration: 1.4 }, { role: "ana", move: "light-burst", start: "with", delay: 0.2, duration: 1.4 },
        { role: "ana", move: "card", start: "with", delay: 0.6, duration: 1.4 }] },
    { id: "k:kapi", label: "Ortadan açılan kapı", group: "Tek görsel", tags: ["dugun", "kurumsal", "magaza", "halloween", "kuafor", "emlak"],
      desc: "Kapı titrer; dokununca tam ortadan iki yana açılır, arkadan ışık patlar, kamera içeri ilerler.",
      roles: [Object.assign({}, ANA, { label: "Kapı görseli" })], set: { concept: "altin" },
      acts: [{ role: "ana", move: "shake", start: "with", repeat: 0, duration: 0.7 }, { role: "ana", move: "split-h", start: "tap", duration: 1.8, easing: "agir" },
        { role: "ana", move: "light-burst", start: "with", delay: 0.3, duration: 1.4 }, { role: "ana", move: "camera-push", start: "after", duration: 1.6 },
        { role: "ana", move: "card", start: "with", delay: 0.5, duration: 1.4 }] },
    { id: "k:cek", label: "Çekerek açılan kapı", group: "Etkileşimli", tags: ["dugun", "nisan", "lansman", "emlak"],
      desc: "Kapı aralanıp kapanarak bekler; misafir parmağıyla çekince açılır.",
      roles: [Object.assign({}, ANA, { label: "Kapı görseli" })], set: { concept: "zarif" },
      acts: [{ role: "ana", move: "tease", start: "with", repeat: 0, duration: 2.4 }, { role: "ana", move: "split-h", start: "pull", gdir: "any", duration: 1.8, easing: "agir" },
        { role: "ana", move: "light-burst", start: "with", delay: 0.4, duration: 1.4 }, { role: "ana", move: "card", start: "with", delay: 1, duration: 1.4 }] },
    { id: "k:zarf", label: "Mühürlü zarf", group: "Çok katmanlı", tags: ["dugun", "nisan", "sevgililer", "dernek"],
      desc: "Mühür ikiye kırılıp düşer, zarf dört yana açılır, kart yükselir.",
      roles: [{ key: "zarf", label: "Zarf görseli", need: true }, { key: "muhur", label: "Mühür görseli", need: true, hint: "Zarfın önünde, ayrı PNG" }], set: { concept: "dugun" },
      acts: [{ role: "zarf", move: "float", start: "with", repeat: 0, duration: 3 }, { role: "muhur", move: "seal", start: "tap", duration: 1.3 },
        { role: "zarf", move: "quad", start: "after", duration: 1.6, params: { style: "don" } }, { role: "zarf", move: "card", start: "with", delay: 0.6, duration: 1.4 }] },
    { id: "k:perde", label: "Gala perdesi", group: "Tek görsel", tags: ["mezuniyet", "lansman", "dernek", "kurumsal"],
      desc: "Spot ışıkları sahneyi tarar; dokununca perde iki yana toplanır, konfeti patlar.",
      roles: [Object.assign({}, ANA, { label: "Perde görseli" })], set: { concept: "gala" },
      acts: [{ role: "ana", move: "spotlight", start: "with", repeat: 0, duration: 3 }, { role: "ana", move: "curtain", start: "tap", duration: 2, params: { dir: "both" } },
        { role: "ana", move: "confetti", start: "with", delay: 1, params: { palette: "altin" } }, { role: "ana", move: "card", start: "with", delay: 1.2, duration: 1.4 }] },
    { id: "k:hediye", label: "Hediye patlaması", group: "Etkileşimli", tags: ["dogumgunu", "yilbasi", "butik"],
      desc: "Kutu sabırsızca sallanır; basılı tutunca parçalanarak patlar, konfeti ve ışık çıkar.",
      roles: [Object.assign({}, ANA, { label: "Hediye kutusu" })], set: { concept: "dogumgunu", hintText: "Açmak için basılı tutun" },
      acts: [{ role: "ana", move: "shake", start: "with", repeat: 0, duration: 0.9, params: { mode: "sallanma" } }, { role: "ana", move: "burst", start: "hold", duration: 1.6, params: { palette: "renkli" } },
        { role: "ana", move: "card", start: "with", delay: 0.9, duration: 1.2 }] },
    { id: "k:kitap", label: "Masal kitabı", group: "Çok katmanlı", tags: ["mezuniyet", "kafe", "dugun"],
      desc: "Kapak menteşesinden açılır, sayfalar çevrilir, altın tozu arasında kart yükselir.",
      roles: [{ key: "kapak", label: "Kapak görseli", need: true }, { key: "sayfa", label: "Sayfa / iç görsel", need: true, hint: "Kapağın arkasında" }], set: { concept: "toz" },
      acts: [{ role: "kapak", move: "float", start: "with", repeat: 0, duration: 3 }, { role: "kapak", move: "page-turn", start: "tap", duration: 1.3, params: { pages: 1 } },
        { role: "sayfa", move: "page-turn", start: "after", duration: 1, params: { pages: 3 } }, { role: "sayfa", move: "glitter", start: "with", repeat: 1, duration: 2.5 },
        { role: "sayfa", move: "card", start: "with", delay: 0.6, duration: 1.4 }] },
    { id: "k:kurdele", label: "Kurdele kesimi", group: "Çok katmanlı", tags: ["magaza", "lansman", "butik", "kafe"],
      desc: "Mağaza açılışı: makas kurdeleyi keser, uçlar düşer, kapı açılır, konfeti patlar.",
      roles: [{ key: "kurdele", label: "Kurdele görseli", need: true }, { key: "ana", label: "Kapı / vitrin görseli", need: true }, { key: "makas", label: "Makas görseli", need: false }],
      set: { concept: "konfeti" },
      acts: [{ role: "kurdele", move: "ribbon-cut", start: "tap", duration: 1.8, params: { scissors: "@makas" } }, { role: "ana", move: "split-h", start: "after", duration: 1.6, easing: "agir" },
        { role: "ana", move: "confetti", start: "with", delay: 0.3, params: { palette: "renkli" } }, { role: "ana", move: "card", start: "with", delay: 0.8, duration: 1.4 }] },
    { id: "k:anahtar", label: "Anahtar ve kapı", group: "Çok katmanlı", tags: ["emlak", "organizasyon", "kurumsal"],
      desc: "Emlak: anahtar kilide gidip döner, kilit düşer, kapı menteşesinden açılır.",
      roles: [{ key: "ana", label: "Kapı görseli", need: true }, { key: "kilit", label: "Kilit görseli", need: true }, { key: "anahtar", label: "Anahtar görseli", need: false }],
      set: { concept: "altin" },
      acts: [{ role: "kilit", move: "lock", start: "tap", duration: 2.2, params: { key: "@anahtar", after: "dus" } }, { role: "ana", move: "hinge", start: "after", duration: 2, easing: "agir", params: { side: "left" } },
        { role: "ana", move: "light-leak", start: "with", duration: 1, params: { style: "kenar" } }, { role: "ana", move: "card", start: "with", delay: 1.1, duration: 1.4 }] },
    { id: "k:gizem", label: "Gizemli ışık", group: "Tek görsel", tags: ["halloween", "nisan", "lansman"],
      desc: "Sis içinde aralıktan ışık sızar; dokununca görsel yukarı ve aşağı açılır, ışık taşar.",
      roles: [ANA], set: { concept: "gizem" },
      acts: [{ role: "ana", move: "fog", start: "with", repeat: 0, duration: 6 }, { role: "ana", move: "light-leak", start: "with", repeat: 1, duration: 1.4, params: { style: "aralik" } },
        { role: "ana", move: "split-v", start: "tap", duration: 1.6 }, { role: "ana", move: "light-burst", start: "with", delay: 0.2, duration: 1.4, params: { color: "beyaz" } },
        { role: "ana", move: "card", start: "with", delay: 0.7, duration: 1.4 }] },
    { id: "k:yildiz", label: "Yıldızlı gece", group: "Etkileşimli", tags: ["yilbasi", "mezuniyet", "sevgililer"],
      desc: "Yıldızlar parlar; yukarı kaydırınca görsel yükselir, havai fişekler patlar.",
      roles: [ANA], set: { concept: "yilbasi" },
      acts: [{ role: "ana", move: "stars", start: "with", repeat: 0, duration: 8 }, { role: "ana", move: "float", start: "with", repeat: 0, duration: 2.6 },
        { role: "ana", move: "rise", start: "swipe", gdir: "up", duration: 1.6 }, { role: "ana", move: "fireworks", start: "with", delay: 0.4, duration: 3 },
        { role: "ana", move: "card", start: "with", delay: 0.8, duration: 1.4 }] },
    { id: "k:surpriz", label: "Parçalanan sürpriz", group: "Tek görsel", tags: ["dogumgunu", "lansman", "butik"],
      desc: "Görsel parıltılar arasında bekler; dokununca gerçek parçalarına ayrılır, konfeti patlar.",
      roles: [ANA], set: { concept: "konfeti" },
      acts: [{ role: "ana", move: "glitter", start: "with", repeat: 0, duration: 3 }, { role: "ana", move: "shatter", start: "tap", duration: 1.6 },
        { role: "ana", move: "confetti", start: "with", delay: 0.2, params: { palette: "renkli" } }, { role: "ana", move: "card", start: "with", delay: 0.7, duration: 1.4 }] },
    { id: "k:cicek", label: "Çiçek bahçesi", group: "Tek görsel", tags: ["sevgililer", "dugun", "guzellik"],
      desc: "Yapraklar uçuşur, görsel nefes alır gibi süzülür; dokununca katlanarak açılır.",
      roles: [ANA], set: { concept: "bahar" },
      acts: [{ role: "ana", move: "petals", start: "with", repeat: 0, duration: 8 }, { role: "ana", move: "tease", start: "with", repeat: 0, duration: 2.6 },
        { role: "ana", move: "fold", start: "tap", duration: 1.6, params: { dir: "left", strips: 6 } }, { role: "ana", move: "card", start: "with", delay: 0.8, duration: 1.4 }] },
    { id: "k:sade", label: "Sade ve profesyonel", group: "Tek görsel", tags: ["danisman", "kurumsal", "dernek", "emlak"],
      desc: "Efektsiz, kısa ve şık: dokununca görsel sola kayar, kart yükselir.",
      roles: [ANA], set: { concept: "sade", exitStyle: "fade" },
      acts: [{ role: "ana", move: "slide", start: "tap", duration: 1.1, params: { dir: "left" } }, { role: "ana", move: "card", start: "with", delay: 0.4, duration: 1.2 }] },
    { id: "k:gizli", label: "Gizli görsel", group: "Çok katmanlı", tags: ["dogumgunu", "lansman", "sevgililer"],
      desc: "Ön görsel ortadan açılınca arkasındaki gizli görsel ışıkla ortaya çıkar.",
      roles: [{ key: "ana", label: "Önde açılan görsel", need: true }, { key: "gizli", label: "Gizli görsel", need: true, hint: "Arkada, başta görünmez" }], set: { concept: "isilti" },
      acts: [{ role: "ana", move: "shake", start: "with", repeat: 0, duration: 0.7 }, { role: "ana", move: "split-h", start: "tap", duration: 1.6 },
        { role: "gizli", move: "reveal", start: "with", delay: 0.4, duration: 1.4, params: { style: "parla" } }, { role: "gizli", move: "card", start: "after", delay: 1.2, duration: 1.4 }] }
  ];

  function uid(p) { return p + Math.random().toString(36).slice(2, 9); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* Rolleri kullanıcının katmanlarına kendiliğinden eşler: adı rol adına
     benzeyen katman önce, sonra sıradaki (arka plan olmayan) katman. */
  function autoRoles(k, layers) {
    const pool = (layers || []).filter(l => !l.backdrop);
    const used = new Set(), out = {};
    const norm = s => String(s || "").toLocaleLowerCase("tr");
    k.roles.forEach(r => {
      const byName = pool.find(l => !used.has(l.id) && (norm(l.name).includes(r.key) || norm(l.name).includes(norm(r.label).split(" ")[0])));
      if (byName) { out[r.key] = byName.id; used.add(byName.id); }
    });
    // ilk rol (açılacak ana görsel) en büyük katmana, diğerleri öndeki (listede son) katmanlara
    const area = l => (l.box ? l.box.w * l.box.h : 0) * (l.scale || 1) * (l.scale || 1);
    const rest = pool.slice().reverse();
    k.roles.forEach((r, i) => {
      if (out[r.key] || !r.need) return;
      const cand = rest.filter(x => !used.has(x.id));
      const l = i === 0 ? cand.slice().sort((a, b) => area(b) - area(a))[0] : cand[0];
      if (l) { out[r.key] = l.id; used.add(l.id); }
    });
    return out;
  }
  function missing(k, map) { return k.roles.filter(r => r.need && !map[r.key]); }
  function needCount(k) { return k.roles.filter(r => r.need).length; }

  /* Hazır kurguyu uygular: hareket listesi yeniden kurulur, katmanlara dokunulmaz. */
  function applyBuiltin(cin, k, map) {
    const acts = [];
    k.acts.forEach(t => {
      const layer = map[t.role];
      if (!layer) return;                     // isteğe bağlı rol boşsa o adım atlanır
      const a = { id: uid("A"), layer, move: t.move, start: t.start, delay: t.delay || 0, duration: t.duration != null ? t.duration : 1.4,
        easing: t.easing || "", params: {} };
      if (t.repeat != null) a.repeat = t.repeat;
      if (t.gdir) a.gdir = t.gdir;
      Object.keys(t.params || {}).forEach(p => {
        const v = t.params[p];
        if (typeof v === "string" && v.charAt(0) === "@") { if (map[v.slice(1)]) a.params[p] = map[v.slice(1)]; }
        else a.params[p] = v;
      });
      if (!a.easing) delete a.easing;
      acts.push(a);
    });
    cin.actions = acts;
    cin.preset = null;
    Object.assign(cin, clone(k.set || {}));
    cin.kurgu = k.id;
    return cin;
  }

  /* ----------------------------- kayıtlı kurgular ----------------------------- */
  function readSaved() {
    try { const v = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  }
  function writeSaved(list) { localStorage.setItem(KEY, JSON.stringify(list)); }
  const SETTING_KEYS = ["speed", "depth", "intensity", "sound", "start", "lite", "hintText", "cardMode", "cardTitle", "cardSubtitle", "concept", "brand", "exitStyle", "exitDuration"];
  function snapshot(cin, name) {
    const settings = {}; SETTING_KEYS.forEach(k => { if (cin[k] !== undefined) settings[k] = clone(cin[k]); });
    return { id: uid("K"), name: name || "Kurgum", createdAt: new Date().toISOString(),
      data: { layers: clone(cin.layers || []), actions: clone(cin.actions || []), preset: cin.preset ? clone(cin.preset) : null, settings } };
  }
  function save(cin, name) { const list = readSaved(); const k = snapshot(cin, name); list.unshift(k); writeSaved(list); return k; }
  function remove(id) { writeSaved(readSaved().filter(k => k.id !== id)); }

  /* Kayıtlı (veya içe aktarılmış) kurgu: katmanları ve hareketleri yeni
     kimliklerle kopyalar; katmanlar arası bağlar (parent, anahtar…) korunur. */
  function applySaved(cin, k) {
    const d = clone(k.data), idMap = {};
    d.layers.forEach(l => { const n = uid("L"); idMap[l.id] = n; l.id = n; });
    d.layers.forEach(l => { if (l.parent) l.parent = idMap[l.parent] || undefined; if (!l.parent) delete l.parent; });
    d.actions.forEach(a => {
      a.id = uid("A"); a.layer = idMap[a.layer] || a.layer;
      Object.keys(a.params || {}).forEach(p => { if (idMap[a.params[p]]) a.params[p] = idMap[a.params[p]]; });
    });
    if (d.preset && d.preset.roles) Object.keys(d.preset.roles).forEach(r => { d.preset.roles[r] = idMap[d.preset.roles[r]] || d.preset.roles[r]; });
    cin.layers = d.layers; cin.actions = d.actions; cin.preset = d.preset || null;
    Object.assign(cin, d.settings || {});
    cin.kurgu = null;
    return cin;
  }

  /* ----------------------------- dışa / içe aktarma ----------------------------- */
  function refsOf(k) {
    const out = new Set();
    (function walk(v) {
      if (typeof v === "string") { if (global.SeozBlobStore && SeozBlobStore.isRef(v)) out.add(v); }
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object") Object.keys(v).forEach(x => walk(v[x]));
    })(k.data);
    return Array.from(out);
  }
  function replaceRefs(obj, map) {
    if (typeof obj === "string") return map[obj] || obj;
    if (Array.isArray(obj)) return obj.map(x => replaceRefs(x, map));
    if (obj && typeof obj === "object") { const o = {}; Object.keys(obj).forEach(x => { o[x] = replaceRefs(obj[x], map); }); return o; }
    return obj;
  }
  const EXT = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };
  async function exportBlob(k, withImages) {
    const payload = { format: FORMAT, version: 1, name: k.name, createdAt: k.createdAt, data: k.data };
    if (!withImages) return { blob: new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), ext: "json", images: 0 };
    if (!global.JSZip) throw new Error("ZIP aracı yüklenemedi (internet bağlantısını kontrol edin).");
    const zip = new global.JSZip(), map = {};
    let n = 0;
    for (const ref of refsOf(k)) {
      const blob = await SeozBlobStore.getBlob(ref.slice(4)).catch(() => null);
      if (!blob) continue;
      const name = `gorseller/${++n}.${EXT[blob.type] || "png"}`;
      zip.file(name, blob); map[ref] = "zip:" + name;
    }
    payload.data = replaceRefs(k.data, map);
    zip.file("kurgu.json", JSON.stringify(payload, null, 2));
    return { blob: await zip.generateAsync({ type: "blob" }), ext: "zip", images: n };
  }
  async function importFile(file) {
    let payload, zip = null;
    const isZip = /\.zip$/i.test(file.name) || file.type === "application/zip" || file.type === "application/x-zip-compressed";
    if (isZip) {
      if (!global.JSZip) throw new Error("ZIP aracı yüklenemedi.");
      zip = await global.JSZip.loadAsync(file);
      const j = zip.file("kurgu.json"); if (!j) throw new Error("Bu ZIP bir Studio SEOZ kurgusu değil (kurgu.json yok).");
      payload = JSON.parse(await j.async("string"));
    } else payload = JSON.parse(await file.text());
    if (!payload || payload.format !== FORMAT || !payload.data || !Array.isArray(payload.data.actions)) throw new Error("Bu dosya bir Studio SEOZ kurgusu değil.");
    if (zip) {
      const map = {};
      const names = new Set();
      (function walk(v) { if (typeof v === "string" && v.indexOf("zip:") === 0) names.add(v); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === "object") Object.keys(v).forEach(x => walk(v[x])); })(payload.data);
      for (const ref of names) {
        const f = zip.file(ref.slice(4)); if (!f) continue;
        const ext = ref.split(".").pop().toLowerCase();
        const blob = new Blob([await f.async("arraybuffer")], { type: ext === "jpg" ? "image/jpeg" : "image/" + ext });
        map[ref] = await SeozBlobStore.putBlob(blob);
      }
      payload.data = replaceRefs(payload.data, map);
    }
    (payload.data.layers || []).forEach(l => { ["src", "backSrc"].forEach(f => { if (typeof l[f] === "string" && l[f].indexOf("zip:") === 0) delete l[f]; }); });
    const k = { id: uid("K"), name: payload.name || file.name.replace(/\.(json|zip)$/i, ""), createdAt: new Date().toISOString(), data: payload.data };
    const list = readSaved(); list.unshift(k); writeSaved(list);
    return k;
  }

  global.SeozCinemaLibrary = {
    BUILTIN, builtin: id => BUILTIN.find(k => k.id === id) || null, byTag: tag => BUILTIN.filter(k => k.tags.includes(tag)),
    autoRoles, missing, needCount, applyBuiltin,
    readSaved, save, remove, applySaved, exportBlob, importFile, FORMAT
  };
})(window);
