/* =============================================================================
   STUDIO SEOZ — MÜŞTERİ MÜZİĞİNİ ÇALMA  ( /muzik/<davetiye-adı> )
   -----------------------------------------------------------------------------
   Davetiye sayfasındaki müzik (müzik modülü "Müşteri kendi müziğini yönetir" modunda)
   dosyayı bu adresten ister. Her istekte Supabase'e sorulur: müzik var mı, devre dışı mı?
     - Müzik yok / silindi / Studio SEOZ devre dışı bıraktı → 404 (davetiye müziksiz açılır).
     - Var → dosya akıtılır (iPhone için parça parça "Range" desteğiyle).
     - ?durum=1 → yalnızca "müzik var mı?" (R2'ye hiç dokunmaz).
   Toplu listeleme yoktur: dosya yalnızca tam davetiye adıyla, o davetiyenin etkin dosyası olarak verilir.

   MALİYET KONTROLÜ (R2 okuma işlemleri):
     - Cloudflare önbelleği: dosya adı her yüklemede rastgele ve değişmez olduğundan, R2'den bir kez okunan dosya
       Cloudflare'in önbelleğinde tutulur; sonraki dinlemeler R2 okuma işlemi harcamaz. (Önbellek yalnızca kendi
       alan adında — davet.studioseoz.com — çalışır; silme / devre dışı yine her istekte Supabase'den denetlenir.)
     - Önbellekte yoksa istek başına TEK R2 okuması (ayrı "head" sorgusu yok); tarayıcı "değişmedi" (304) derse R2'ye gidilmez.
     - Başka sitelerin dosyayı kendi sayfasına gömmesi (hotlink) engellenir.
   ========================================================================= */
import { supabaseConfig } from "../[slug].js";
import { SLUG_RE, KEY_RE, rpc, parseRange } from "../../lib/muzik-sunucu.js";

const NONE = (status) => new Response(null, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });

/* Dosyanın baytları: önce Cloudflare önbelleği, yoksa R2 (tek okuma) + önbelleğe yazma. */
async function loadBytes(context, bucket, key) {
  const cache = typeof caches !== "undefined" && caches.default ? caches.default : null;
  const ck = new Request(new URL("/__muzik-onbellek/" + key, context.request.url).href);
  if (cache) {
    try {
      const hit = await cache.match(ck);
      if (hit) return { bytes: new Uint8Array(await hit.arrayBuffer()), cached: true };
    } catch (e) { /* önbellek okunamadı: R2'den devam */ }
  }
  const obj = await bucket.get(key);
  if (!obj) return null;
  const bytes = new Uint8Array(await obj.arrayBuffer());
  if (cache) {
    const put = cache.put(ck, new Response(bytes, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=2592000" } })).catch(() => {});
    if (context.waitUntil) context.waitUntil(put);
  }
  return { bytes, cached: false };
}

export async function onRequest(context) {
  const { request, env, params } = context;
  if (request.method !== "GET" && request.method !== "HEAD") return NONE(405);
  const slug = String(params.slug || "").toLowerCase();
  if (!SLUG_RE.test(slug)) return NONE(404);
  // Hotlink: başka bir site <audio> ile gömemez (doğrudan açmak / kendi sayfalarımız serbest)
  if (request.headers.get("Sec-Fetch-Site") === "cross-site" && request.headers.get("Sec-Fetch-Mode") !== "navigate") return NONE(403);
  const bucket = env.MUSIC_BUCKET;
  if (!bucket) return NONE(503);                         // R2 bu projeye bağlı değil (ör. editör projesi)

  const cfg = await supabaseConfig(env, request);
  if (!cfg) return NONE(503);
  const r = await rpc(cfg, "music_public_get", { p_slug: slug });
  if (!r.ok) return NONE(r.code === "not_installed" ? 404 : 503);
  const info = r.data;
  const has = !!info && KEY_RE.test(String(info.key || "")) && String(info.key).startsWith(`m/${slug}/`);
  // ?durum=1 → davetiye sayfası "müzik var mı?" diye sorar (dosya indirilmez; yoksa tarayıcıya 404 hatası düşmez)
  if (new URL(request.url).searchParams.has("durum")) {
    return new Response(JSON.stringify({ available: has }), { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  }
  if (!has) return NONE(404);

  const etag = `"${String(info.sha256 || "").slice(0, 32)}"`;
  const base = {
    "Content-Type": "audio/mpeg",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-cache",
    "ETag": etag,
    "Content-Disposition": "inline",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex"
  };
  if (request.headers.get("If-None-Match") === etag && !request.headers.get("Range")) return new Response(null, { status: 304, headers: base });
  const size = Number(info.size) || 0;

  if (request.method === "HEAD") {
    return new Response(null, { status: 200, headers: Object.assign({}, base, size ? { "Content-Length": String(size) } : {}) });
  }
  const got = await loadBytes(context, bucket, info.key);
  if (!got) return NONE(404);
  const all = got.bytes, total = all.length;
  const range = parseRange(request.headers.get("Range"), total);
  if (range === "invalid") return new Response(null, { status: 416, headers: Object.assign({}, base, { "Content-Range": `bytes */${total}` }) });
  if (range) {
    return new Response(all.subarray(range.offset, range.offset + range.length), { status: 206, headers: Object.assign({}, base, {
      "Content-Length": String(range.length),
      "Content-Range": `bytes ${range.offset}-${range.offset + range.length - 1}/${total}`
    }) });
  }
  return new Response(all, { status: 200, headers: Object.assign({}, base, { "Content-Length": String(total) }) });
}
