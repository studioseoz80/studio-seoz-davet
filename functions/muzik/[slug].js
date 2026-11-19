/* =============================================================================
   STUDIO SEOZ — MÜŞTERİ MÜZİĞİNİ ÇALMA  ( /muzik/<davetiye-adı> )
   -----------------------------------------------------------------------------
   Davetiye sayfasındaki müzik (müzik modülü "Müşteri kendi müziğini yönetir" modunda)
   dosyayı bu adresten ister. Her istekte Supabase'e sorulur: müzik var mı, devre dışı mı?
     - Müzik yok / silindi / Studio SEOZ devre dışı bıraktı → 404 (davetiye müziksiz açılır).
     - Var → dosya R2'den akıtılır (iPhone için parça parça "Range" desteğiyle).
   Toplu listeleme yoktur: dosya yalnızca tam davetiye adıyla, o davetiyenin etkin dosyası olarak verilir.
   Önbellek: "no-cache" — tarayıcı her seferinde sorar; silinen / devre dışı müzik hemen durur.
   ========================================================================= */
import { supabaseConfig } from "../[slug].js";
import { SLUG_RE, KEY_RE, rpc, parseRange } from "../../lib/muzik-sunucu.js";

const NONE = (status) => new Response(null, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });

export async function onRequest(context) {
  const { request, env, params } = context;
  if (request.method !== "GET" && request.method !== "HEAD") return NONE(405);
  const slug = String(params.slug || "").toLowerCase();
  if (!SLUG_RE.test(slug)) return NONE(404);
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

  const head = await bucket.head(info.key);
  if (!head) return NONE(404);
  const size = head.size;
  const range = parseRange(request.headers.get("Range"), size);
  if (range === "invalid") return new Response(null, { status: 416, headers: Object.assign({}, base, { "Content-Range": `bytes */${size}` }) });

  if (request.method === "HEAD") {
    return new Response(null, { status: 200, headers: Object.assign({}, base, { "Content-Length": String(size) }) });
  }
  const obj = await bucket.get(info.key, range ? { range } : undefined);
  if (!obj) return NONE(404);
  if (range) {
    return new Response(obj.body, { status: 206, headers: Object.assign({}, base, {
      "Content-Length": String(range.length),
      "Content-Range": `bytes ${range.offset}-${range.offset + range.length - 1}/${size}`
    }) });
  }
  return new Response(obj.body, { status: 200, headers: Object.assign({}, base, { "Content-Length": String(size) }) });
}
