/* =============================================================================
   STUDIO SEOZ — "MÜZİĞİMİ YÖNET" İŞLEMLERİ
     POST /api/muzik/yukle     (müşteri, gizli anahtarla)
     POST /api/muzik/sil       (müşteri, gizli anahtarla)
     POST /api/muzik/yonetici  (Studio SEOZ, Müzik Denetimi: müziği sil / yarım kalan yüklemeleri temizle)
   -----------------------------------------------------------------------------
   Müşterinin gizli anahtarı "X-Muzik-Anahtar" başlığıyla gelir (adreste / kayıtlarda görünmez).
   YÜKLE: 1) anahtar + devre dışı + günlük sınır + telif onayı (TR ya da EN metin; sürüm + özet birebir),
          2) dosya boyutu (Content-Length) en çok 10 MB olmalı — gövde okunmadan önce,
          3) MALİYET KONTROLÜ: Supabase'de tek kilit altında YER AYRILIR (toplam 8 GB). Yer yoksa ya da genel
             günlük sınır dolduysa R2'ye HİÇBİR ŞEY yazılmaz; eş zamanlı yüklemeler de sınırı aşamaz,
          4) içerik gerçekten MP3 olmalı (uzantıya bakılmaz); değilse ayrılan yer geri bırakılır,
          5) rastgele adla R2'ye yazılır, ayırmayla birlikte onay kaydedilir (reddedilirse dosya silinir,
             yer bırakılır), değiştirilen eski dosya R2'den silinir.
   SİL:   kayıt boşaltılır, dosya R2'den silinir (erişim anında biter, yer açılır).
   YÖNETİCİ: yalnızca Studio SEOZ hesabı (Supabase oturumu; sahiplik Supabase'de denetlenir) ve yalnızca
          editör adreslerinden. Kendiliğinden hiçbir müzik silinmez.
   Önizleme (dal) adreslerinde canlı veriye yazma kapalıdır.
   ========================================================================= */
import { supabaseConfig } from "../../[slug].js";
import { MAX_BYTES, MIN_BYTES, TOKEN_RE, KEY_RE, SLUG_RE, isPreviewHost, adminOrigins, json, rpc, sha256hex, randomHex, readCapped, looksLikeMp3, cleanName } from "../../../lib/muzik-sunucu.js";

const ERR = {
  invalid_token: [403, "Bu bağlantı geçersiz ya da yenilenmiş."],
  music_disabled: [423, "Bu davetiyenin müziği Studio SEOZ tarafından devre dışı bırakıldı."],
  consent_required: [400, "Yüklemeden önce kullanım hakkı onayını vermelisiniz."],
  daily_limit: [429, "Bugünkü yükleme hakkınız doldu. Yarın tekrar deneyin."],
  capacity_full: [507, "Müzik yükleme şu anda kullanılamıyor. Lütfen Studio SEOZ ile iletişime geçin."],
  service_busy: [503, "Müzik yükleme şu anda kullanılamıyor. Lütfen Studio SEOZ ile iletişime geçin."],
  length_required: [411, "Yükleme yapılamadı. Lütfen tekrar deneyin."],
  too_large: [413, "Dosya en fazla 10 MB olabilir."],
  not_mp3: [415, "Yalnızca MP3 dosyası yüklenebilir."],
  storage_not_ready: [503, "Müzik deposu henüz hazır değil. Lütfen Studio SEOZ ile iletişime geçin."],
  preview: [403, "Önizleme sürümünde yükleme kapalıdır."],
  server: [503, "İşlem şu anda yapılamadı. Lütfen biraz sonra tekrar deneyin."]
};
// Veritabanının hata adlarını müşteriye gösterilecek koda çevir
const MAP = { invalid_file_size: "too_large", reservation_invalid: "server", invalid_file_key: "server", invalid_file_hash: "server" };
const codeOf = c => (ERR[c] ? c : MAP[c] || "server");
const denied = c => /not_owner|permission denied|JWT|jwt/i.test(String(c || ""));
const fail = (code, extra) => { const [s, m] = ERR[code] || ERR.server; return json(s, { ok: false, error: ERR[code] ? code : "server", message: m }, extra); };

export async function onRequest(context) {
  const { request, env, params } = context;
  const islem = String(params.islem || "");
  if (islem === "yonetici") return admin(context);
  if (islem === "r2-test") return r2Test(context);
  if (request.method !== "POST" || (islem !== "yukle" && islem !== "sil")) return json(405, { ok: false, error: "method" });
  if (isPreviewHost(request.url)) return fail("preview");
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) return json(403, { ok: false, error: "origin" });
  const bucket = env.MUSIC_BUCKET;
  if (!bucket) return fail("storage_not_ready");
  const token = String(request.headers.get("X-Muzik-Anahtar") || "");
  if (!TOKEN_RE.test(token)) return fail("invalid_token");
  const cfg = await supabaseConfig(env, request);
  if (!cfg) return fail("server");

  const info = await rpc(cfg, "music_manage_info", { p_token: token });
  if (!info.ok) return fail(info.code === "not_installed" ? "storage_not_ready" : "server");
  if (!info.data) return fail("invalid_token");
  const slug = info.data.slug;

  if (islem === "sil") {
    const r = await rpc(cfg, "music_manage_delete", { p_token: token });
    if (!r.ok) return fail(codeOf(r.code));
    const old = r.data && r.data.old_key;
    if (old && KEY_RE.test(old) && old.startsWith(`m/${slug}/`)) await bucket.delete(old);
    return json(200, { ok: true });
  }

  // ---- YÜKLE ---- (gövde okunmadan ve R2'ye dokunulmadan önce bütün ucuz denetimler)
  if (info.data.disabled) return fail("music_disabled");
  if (!(info.data.uploads_left_today > 0)) return fail("daily_limit");
  const ver = request.headers.get("X-Onay-Surum"), osha = request.headers.get("X-Onay-Ozet");
  const all = info.data.consents ? Object.values(info.data.consents) : [info.data.consent];
  const consent = all.find(c => c && c.version === ver && c.sha256 === osha);
  if (!consent) return fail("consent_required");
  const declared = Number(request.headers.get("Content-Length") || "0");
  if (!Number.isInteger(declared) || declared <= 0) return fail("length_required");
  if (declared > MAX_BYTES) return fail("too_large");
  if (declared < MIN_BYTES) return fail("not_mp3");
  if (info.data.upload_available === false) return fail("capacity_full");

  // Yer ayır (tek kilit: eş zamanlı yüklemeler toplam sınırı aşamaz)
  const key = `m/${slug}/${randomHex(16)}.mp3`;
  const rv = await rpc(cfg, "music_manage_reserve", { p_token: token, p_file_key: key, p_size: declared });
  if (!rv.ok) return fail(codeOf(rv.code));
  const reservation = rv.data && rv.data.reservation;
  const release = () => rpc(cfg, "music_manage_release", { p_token: token, p_reservation: reservation });

  const bytes = await readCapped(request, declared);       // bildirilen boyuttan fazlası okunmaz
  if (bytes === null) { await release(); return fail("too_large"); }
  if (bytes.length < MIN_BYTES || !looksLikeMp3(bytes)) { await release(); return fail("not_mp3"); }

  const sha = await sha256hex(bytes);
  const name = cleanName(request.headers.get("X-Dosya-Adi"));
  try {
    await bucket.put(key, bytes, { httpMetadata: { contentType: "audio/mpeg" }, customMetadata: { slug, sha256: sha } });
  } catch (e) { await release(); return fail("server"); }

  const c = await rpc(cfg, "music_manage_commit", {
    p_token: token, p_reservation: reservation, p_file_key: key, p_file_size: bytes.length, p_file_sha256: sha, p_original_name: name || null,
    p_consent_version: consent.version, p_consent_sha256: consent.sha256
  });
  if (!c.ok) {
    await bucket.delete(key);                              // kayıt yoksa dosya da kalmaz
    await release();
    return fail(codeOf(c.code));
  }
  const old = c.data && c.data.old_key;
  if (old && old !== key && KEY_RE.test(old) && old.startsWith(`m/${slug}/`)) await bucket.delete(old);
  return json(200, { ok: true, file_name: name, file_size: bytes.length, file_sha256: sha, uploaded_at: c.data && c.data.uploaded_at });
}

/* ---------------- YÖNETİCİ (Müzik Denetimi) ---------------- */
async function admin(context) {
  const { request, env } = context;
  const own = new URL(request.url).origin;
  const origin = request.headers.get("Origin") || "";
  const allowed = origin === own || adminOrigins(env).includes(origin);
  const cors = allowed && origin ? { "Access-Control-Allow-Origin": origin, "Vary": "Origin" } : {};
  if (request.method === "OPTIONS") {
    if (!allowed) return new Response(null, { status: 403 });
    return new Response(null, { status: 204, headers: Object.assign({}, cors, {
      "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Max-Age": "600" }) });
  }
  if (request.method !== "POST") return json(405, { ok: false, error: "method" }, cors);
  if (!allowed) return json(403, { ok: false, error: "origin" });
  if (isPreviewHost(request.url)) return fail("preview", cors);
  const bucket = env.MUSIC_BUCKET;
  if (!bucket) return fail("storage_not_ready", cors);
  const m = /^Bearer\s+([A-Za-z0-9._-]{10,4096})$/.exec(request.headers.get("Authorization") || "");
  if (!m) return json(401, { ok: false, error: "auth_required" }, cors);
  const bearer = m[1];
  const cfg = await supabaseConfig(env, request);
  if (!cfg) return fail("server", cors);
  let body = null;
  try { body = await request.json(); } catch (e) { body = null; }
  const what = body && body.islem;

  if (what === "sil") {
    const slug = String(body.slug || "");
    if (!SLUG_RE.test(slug)) return json(400, { ok: false, error: "invalid_slug" }, cors);
    const r = await rpc(cfg, "music_owner_delete", { p_slug: slug }, bearer);
    if (!r.ok) return json(denied(r.code) ? 403 : 400, { ok: false, error: denied(r.code) ? "not_owner" : (r.code || "server") }, cors);
    const old = r.data && r.data.old_key;
    if (old && KEY_RE.test(old) && old.startsWith(`m/${slug}/`)) await bucket.delete(old);
    return json(200, { ok: true, freed_bytes: (r.data && r.data.freed_bytes) || 0 }, cors);
  }
  if (what === "temizle") {
    const u = await rpc(cfg, "music_owner_usage", {}, bearer);
    if (!u.ok) return json(denied(u.code) ? 403 : 400, { ok: false, error: denied(u.code) ? "not_owner" : (u.code || "server") }, cors);
    const keys = ((u.data && u.data.stale) || []).map(x => x.file_key).filter(k => KEY_RE.test(String(k || "")));
    for (const k of keys) await bucket.delete(k);          // yarım kalmış (kaydı tamamlanmamış) dosyalar
    const f = keys.length ? await rpc(cfg, "music_owner_forget_stale", { p_keys: keys }, bearer) : { ok: true, data: { removed: 0 } };
    if (!f.ok) return json(400, { ok: false, error: f.code || "server" }, cors);
    return json(200, { ok: true, removed: (f.data && f.data.removed) || 0 }, cors);
  }
  return json(400, { ok: false, error: "unknown" }, cors);
}

/* ---------------- R2 BAĞLANTI TESTİ (YALNIZCA ÖNİZLEME) ----------------
   GET /api/muzik/r2-test — yalnızca Cloudflare dal önizleme adreslerinde ve yalnızca Preview ortamına bağlı
   AYRI test deposu (MUSIC_TEST_BUCKET → seoz-muzik-test) varsa çalışır. Müşteri deposuna (MUSIC_BUCKET) ve
   Supabase'e HİÇ dokunmaz. "test/" altına küçük bir MP3 benzeri dosya yazar, okur, parça okur, siler; sonucu döner.
   Canlı (Production) ortamda bu adres 404 verir. */
function fakeMp3() {
  const frame = 417, n = 40, b = new Uint8Array(frame * n);      // MPEG-1 Layer III, 128 kbps, 44.1 kHz
  for (let i = 0; i < n; i++) { b[i * frame] = 0xFF; b[i * frame + 1] = 0xFB; b[i * frame + 2] = 0x90; b[i * frame + 3] = 0x64; }
  return b;
}
async function r2Test(context) {
  const { request, env } = context;
  const bucket = env.MUSIC_TEST_BUCKET;
  if (request.method !== "GET" || !isPreviewHost(request.url) || !bucket) return new Response(null, { status: 404 });
  const steps = [], t0 = Date.now();
  const step = (name, ok, detail) => steps.push({ name, ok: !!ok, detail: detail == null ? null : detail });
  const key = `test/${randomHex(8)}.mp3`;
  try {
    const data = fakeMp3(), sha = await sha256hex(data);
    step("MP3 içerik denetimi (sunucu kodu)", looksLikeMp3(data), data.length + " bayt");
    await bucket.put(key, data, { httpMetadata: { contentType: "audio/mpeg" }, customMetadata: { test: "1", sha256: sha } });
    step("R2'ye yazma (put)", true, key);
    const h = await bucket.head(key);
    step("R2 bilgi okuma (head)", h && h.size === data.length, h ? h.size : null);
    const g = await bucket.get(key);
    const back = g ? new Uint8Array(await g.arrayBuffer()) : null;
    step("R2'den tam okuma (get) + parmak izi aynı", back && (await sha256hex(back)) === sha, back ? back.length : null);
    const r = await bucket.get(key, { range: { offset: 417, length: 4 } });
    const part = r ? new Uint8Array(await r.arrayBuffer()) : null;
    step("R2 parça okuma (range)", part && part.length === 4 && part[0] === 0xFF && part[1] === 0xFB, part ? [...part] : null);
    const l = await bucket.list({ prefix: "test/", limit: 10 });
    step("Yalnızca test/ klasörü kullanılıyor", l && l.objects.every(o => o.key.startsWith("test/")), l ? l.objects.length : null);
    const none = await bucket.get("m/olmayan-davetiye-x1/" + "0".repeat(32) + ".mp3");
    step("Olmayan dosya → boş (null)", none === null, null);
    step("Cloudflare önbelleği (Cache API) mevcut", typeof caches !== "undefined" && !!caches.default, "pages.dev adresinde önbellek etkisizdir; alan adında çalışır");
  } catch (e) {
    step("Hata", false, String(e && e.message || e).slice(0, 200));
  } finally {
    try { await bucket.delete(key); const after = await bucket.head(key); step("Silme (delete) → dosya kalmadı", after === null, null); }
    catch (e) { step("Silme", false, String(e && e.message || e).slice(0, 200)); }
  }
  const ok = steps.every(x => x.ok);
  return json(ok ? 200 : 500, { ok, ortam: "önizleme (Preview) · depo: MUSIC_TEST_BUCKET", sure_ms: Date.now() - t0, adimlar: steps });
}
