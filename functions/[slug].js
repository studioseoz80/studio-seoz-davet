/* =============================================================================
   STUDIO SEOZ — KISA DAVETİYE BAĞLANTISI (Cloudflare Pages Functions)
   -----------------------------------------------------------------------------
   Müşteri sitesinde  https://<alan-adı>/<slug>  adresini davetiyeye çevirir:
     - view.html'i (davetiye sayfasının kendisi) aynen sunar; sayfa slug'ı
       adresten okur (bkz. js/view-app.js).
     - Sayfanın <head> kısmına paylaşım önizlemesi (Open Graph) bilgilerini
       ekler: kapak görseli, başlık, açıklama. WhatsApp, Instagram, Facebook,
       Telegram vb. bağlantı kartını bu bilgilerden oluşturur (JavaScript
       çalıştırmazlar).
   - Kapak görseli HER ZAMAN küçük, boyutu bilinen bir görseldir (Instagram /
     Facebook büyük ya da boyutu bilinmeyen görselleri ilk paylaşımda çoğu
     zaman göstermez): editörün hazırladığı 1200×630 kapak; yoksa davetiyenin
     kendi küçük (≤ 250 KB — WhatsApp daha büyük küçük resmi atlar) görseli; o da yoksa Studio SEOZ'un hazır
     "Davetlisiniz" kapağı (assets/og/davetiye-paylasim.jpg).
   ESKİ UZUN BAĞLANTILAR (view.html?slug=...) da aynı önizlemeyi alır: bkz.
   functions/view.js (bu dosyadaki renderInvite'ı kullanır).

   GÜVENLİK
   - Yalnızca herkese açık okuma yapar (yayınlanmış davetiye; tarayıcının da
     kullandığı "publishable" anahtar). Hiçbir şey yazmaz.
   - Editör projesinde (EDITOR_PASSWORD tanımlı) hiçbir şey yapmaz.
   - Davetiye bulunamazsa ya da Supabase'e ulaşılamazsa sayfa yine açılır;
     yalnızca önizleme bilgisi eklenmez.
   ========================================================================= */

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,78})[a-z0-9]$/;
// Site dosyalarıyla çakışan adlar (Cloudflare .html uzantısız adresleri de sunar)
const RESERVED = new Set(["view", "index", "panel", "album", "paket", "anket", "anket-panel", "anket-sonuc", "css", "js", "assets", "functions"]);
const DEFAULT_DESC = "Davetlisiniz! Davetiyeyi açmak için dokunun.";
const DEFAULT_IMG = { path: "/assets/og/davetiye-paylasim.jpg", w: 1200, h: 630, type: "image/jpeg" };
// İngilizce davetiye (meta.lang "en"): hazır açıklama, hazır kapak ve sayfa dili İngilizce
const DEFAULT_DESC_EN = "You're invited! Tap to open your invitation.";
const DEFAULT_IMG_EN = { path: "/assets/og/davetiye-paylasim-en.jpg", w: 1200, h: 630, type: "image/jpeg" };
const SMALL_MAX = 250000;    // WhatsApp ~300 KB üstü küçük resmi sessizce atlar; güvenli pay
const imgType = u => (/\.png(\?|$)/i.test(u) ? "image/png" : /\.jpe?g(\?|$)/i.test(u) ? "image/jpeg" : /\.webp(\?|$)/i.test(u) ? "image/webp" : "");
let CFG = null;

const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clip = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s; };
const isHttp = u => /^https:\/\//i.test(String(u || ""));

export async function supabaseConfig(env, request) {
  if (CFG) return CFG;
  if (env.SUPABASE_URL && env.SUPABASE_ANON_KEY) return (CFG = { url: env.SUPABASE_URL, key: env.SUPABASE_ANON_KEY });
  // Tarayıcının kullandığı yapılandırma dosyası tek kaynak: kod iki yerde tutulmaz.
  const res = await env.ASSETS.fetch(new URL("/js/supabase-config.js", request.url));
  const text = res.ok ? await res.text() : "";
  const url = (text.match(/url:\s*"([^"]+)"/) || [])[1];
  const key = (text.match(/anonKey:\s*"([^"]+)"/) || [])[1];
  if (!url || !key) return null;
  return (CFG = { url: url.replace(/\/+$/, ""), key });
}

// Paylaşım bilgisi: editörün yayında hazırladığı meta.share; yoksa davetiyenin kendi kapağı.
function shareInfo(doc) {
  const meta = (doc && doc.meta) || {}, share = meta.share || {}, entry = (doc && doc.entry) || {};
  const cin = entry.cinema || {};
  // MP4 alanlarında (media.type "video") paylaşım görseli olarak videonun kapak görseli kullanılır
  // MP4 → kapak görseli; 3D model (GLB) → modelin kapak görseli
  const pic = (src, m, mo) => (mo && mo.type === "glb" ? mo.poster : m && m.type === "video" ? m.poster : src);
  const firstLayer = Array.isArray(cin.layers) ? cin.layers.find(l => isHttp(l && pic(l.src, l.media, l.model))) : null;
  const bg = doc && doc.canvas && doc.canvas.background;
  const fallbacks = [pic(entry.cardOnlySrc, entry.cardOnlyMedia), pic(entry.cardSrc, entry.cardMedia), pic(entry.pngSrc, entry.pngMedia), firstLayer && pic(firstLayer.src, firstLayer.media, firstLayer.model), bg && bg.type === "image" ? bg.value : ""].filter(isHttp);
  const cover = isHttp(share.image) ? share.image : "";
  const en = meta.lang === "en";
  return {
    en,
    title: clip(share.title || meta.title || (en ? "Invitation" : "Davetiye"), 90),
    description: clip(share.description || (en ? DEFAULT_DESC_EN : DEFAULT_DESC), 200),
    image: cover,
    imageW: cover ? share.w || 1200 : 0,
    imageH: cover ? share.h || 630 : 0,
    imageType: cover ? imgType(cover) || "image/jpeg" : "",
    fallbacks
  };
}

// Editörün kapağı yoksa: davetiyenin kendi görseli yalnızca küçükse (JPEG/PNG, ≤ 250 KB) kullanılır,
// değilse hazır "Davetlisiniz" kapağı. Görsel kontrolü kısa sürer; yanıt gecikirse hazır kapak.
async function settleImage(info, origin) {
  if (info.image) return info;
  for (const u of info.fallbacks.slice(0, 2)) {
    const t = imgType(u); if (t !== "image/jpeg" && t !== "image/png") continue;
    try {
      const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 1500);
      const r = await fetch(u, { method: "HEAD", signal: ctl.signal, cf: { cacheTtl: 3600 } });
      clearTimeout(timer);
      const n = Number(r.headers.get("content-length") || 0);
      if (r.ok && n > 0 && n <= SMALL_MAX) return Object.assign(info, { image: u, imageType: t });
    } catch (e) { /* zaman aşımı ya da ağ hatası: sıradaki */ }
  }
  const d = info.en ? DEFAULT_IMG_EN : DEFAULT_IMG;
  return Object.assign(info, { image: origin + d.path, imageW: d.w, imageH: d.h, imageType: d.type });
}

function injectMeta(html, info, pageUrl) {
  const tags = [
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="Studio SEOZ">`,
    `<meta property="og:locale" content="${info.en ? "en_US" : "tr_TR"}">`,
    `<meta property="og:title" content="${esc(info.title)}">`,
    `<meta property="og:description" content="${esc(info.description)}">`,
    `<meta property="og:url" content="${esc(pageUrl)}">`,
    `<meta name="description" content="${esc(info.description)}">`,
    info.image ? `<meta property="og:image" content="${esc(info.image)}">\n<meta property="og:image:secure_url" content="${esc(info.image)}">` : "",
    info.image && info.imageType ? `<meta property="og:image:type" content="${info.imageType}">` : "",
    info.image && info.imageW ? `<meta property="og:image:width" content="${info.imageW}">\n<meta property="og:image:height" content="${info.imageH}">` : "",
    info.image ? `<meta property="og:image:alt" content="${esc(info.title)}">` : "",
    info.image ? `<meta name="twitter:image" content="${esc(info.image)}">` : "",
    `<meta name="twitter:card" content="${info.image ? "summary_large_image" : "summary"}">`,
    `<link rel="canonical" href="${esc(pageUrl)}">`
  ].filter(Boolean).join("\n");
  let out = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(info.title)}</title>`);
  out = out.replace(/<meta charset="UTF-8">/i, m => m + "\n" + tags);
  // Davetiye yüklenmeden önceki mesajlar ("Davetiye yükleniyor..." vb.) da İngilizce olsun: bkz. js/view-app.js
  if (info.en) out = out.replace(/<html lang="tr">/i, '<html lang="en" data-invite-lang="en">');
  return out;
}

// Davetiye sayfasını önizleme bilgileriyle hazırlar. Davetiye bulunamazsa null döner.
// og:url her zaman kısa bağlantıdır (alan-adı/<slug>): uzun bağlantı da aynı karta bağlanır.
export async function renderInvite(context, slug) {
  const { request, env } = context;
  const page = await env.ASSETS.fetch(new URL("/view.html", request.url));
  if (!page.ok) return null;
  let html = await page.text();
  const pageUrl = new URL("/" + slug, request.url).href;
  try {
    const cfg = await supabaseConfig(env, request);
    if (!cfg) return null;
    const res = await fetch(`${cfg.url}/rest/v1/published_invitations?slug=eq.${encodeURIComponent(slug)}&select=document_data&limit=1`,
      { headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, Accept: "application/json" }, cf: { cacheTtl: 60 } });
    if (!res.ok) return null;
    const rows = await res.json();
    if (!(Array.isArray(rows) && rows[0] && rows[0].document_data)) return { html, found: false };
    const info = await settleImage(shareInfo(rows[0].document_data), new URL(request.url).origin);
    return { html: injectMeta(html, info, pageUrl), found: true };
  } catch (e) { return null; /* önizleme bilgisi eklenemedi; sayfa yine açılır */ }
}

export const htmlHeaders = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=60", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "strict-origin-when-cross-origin", "X-Content-Type-Options": "nosniff" };
export const isInviteSlug = s => SLUG_RE.test(s) && !RESERVED.has(s);

export async function onRequest(context) {
  const { request, env, params, next } = context;
  const slug = String(params.slug || "").toLowerCase();
  if (env.EDITOR_PASSWORD || request.method !== "GET" && request.method !== "HEAD") return next();
  if (!isInviteSlug(slug)) return next();
  const r = await renderInvite(context, slug);
  if (!r) {
    // Supabase'e ulaşılamadı: sayfa önizlemesiz açılır (davetiye yine yüklenir)
    const page = await context.env.ASSETS.fetch(new URL("/view.html", request.url));
    if (!page.ok) return next();
    return new Response(request.method === "HEAD" ? null : await page.text(), { status: 200, headers: htmlHeaders });
  }
  return new Response(request.method === "HEAD" ? null : r.html, { status: r.found ? 200 : 404, headers: htmlHeaders });
}
