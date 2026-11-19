/* =============================================================================
   STUDIO SEOZ — MÜŞTERİ MÜZİĞİ · SUNUCU YARDIMCILARI (Cloudflare Pages Functions)
   -----------------------------------------------------------------------------
   functions/muzik/[slug].js (misafire çalma) ve functions/api/muzik/[islem].js
   (müşterinin yükleme / silme işlemleri) bu dosyayı kullanır. Tarayıcıya gönderilmez;
   gizli bilgi içermez (Supabase'in herkese açık "publishable" anahtarı kullanılır,
   bütün yetki denetimi Supabase fonksiyonlarında yapılır: supabase/muzik-yonetimi.sql).

   Dosyalar Cloudflare R2'de durur (proje ayarı: R2 bağlaması adı MUSIC_BUCKET).
   Bucket herkese KAPALIDIR; dosyaya yalnızca bu fonksiyonlar üzerinden ulaşılır.
   ========================================================================= */

export const MAX_BYTES = 10 * 1024 * 1024;     // 10 MB
export const MIN_BYTES = 8 * 1024;             // 8 KB (boş / bozuk dosya)
export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,118})[a-z0-9]$/;
export const TOKEN_RE = /^[A-Za-z0-9_-]{20,100}$/;
export const KEY_RE = /^m\/[a-z0-9-]+\/[0-9a-f]{32}\.mp3$/;

/* Müzik Denetimi (editör) hangi adreslerden yönetici işlemi yapabilir? Proje ayarında MUSIC_ADMIN_ORIGINS
   (virgülle ayrılmış) verilirse o liste; yoksa editörün bilinen adresleri. Yetki ayrıca Supabase'de (sahip hesabı) denetlenir. */
export function adminOrigins(env) {
  const raw = String((env && env.MUSIC_ADMIN_ORIGINS) || "https://editor.studioseoz.com,https://studio-seoz-davet.pages.dev");
  return raw.split(",").map(x => x.trim().replace(/\/+$/, "")).filter(Boolean);
}

/* Cloudflare dal önizleme adresleri (ör. muzik-yonetimi.seoz-davet.pages.dev): canlı veriye yazma kapalı. */
export function isPreviewHost(url) {
  const h = new URL(url).hostname;
  return /\.pages\.dev$/.test(h) && h.split(".").length > 3;
}

export function json(status, obj, extra) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: Object.assign({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }, extra || {})
  });
}

/* Supabase fonksiyonu çağır. Dönen: { ok, status, data, code }  (code: fonksiyonun hata adı, ör. invalid_token) */
/* bearer: yöneticinin Supabase oturum anahtarı (yalnızca Studio SEOZ işlemleri); yoksa herkese açık anahtar. */
export async function rpc(cfg, name, args, bearer) {
  let res;
  try {
    res = await fetch(`${cfg.url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { apikey: cfg.key, Authorization: `Bearer ${bearer || cfg.key}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(args || {})
    });
  } catch (e) {
    return { ok: false, status: 0, data: null, code: "network" };
  }
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
  if (!res.ok) {
    const msg = data && (data.message || data.code) ? String(data.message || data.code) : "HTTP " + res.status;
    return { ok: false, status: res.status, data: null, code: res.status === 404 ? "not_installed" : msg.slice(0, 80) };
  }
  return { ok: true, status: res.status, data, code: null };
}

export async function sha256hex(buf) {
  const h = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export function randomHex(bytes) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map(b => b.toString(16).padStart(2, "0")).join("");
}

/* İstek gövdesini en fazla max bayt okur; fazlası gelirse null döner (belleğe sınırsız yazılmaz). */
export async function readCapped(request, max) {
  const len = Number(request.headers.get("Content-Length") || "0");
  if (len > max) return null;
  if (!request.body) return new Uint8Array(0);
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) { try { await reader.cancel(); } catch (e) { /* önemsiz */ } return null; }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.byteLength; }
  return out;
}

/* ---------- MP3 doğrulama: uzantıya değil, dosyanın İÇİNE bakılır ----------
   ID3 etiketi (varsa) atlanır; ardından art arda İKİ geçerli MPEG ses (Layer III) çerçeve başlığı aranır.
   WAV/HTML/çalıştırılabilir dosya ya da adı .mp3 yapılmış başka bir dosya reddedilir. */
const BITRATES = {
  1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],       // MPEG-1 Layer III
  2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]            // MPEG-2 / 2.5 Layer III
};
const RATES = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };
function frameAt(b, i) {
  if (i + 4 > b.length || b[i] !== 0xFF || (b[i + 1] & 0xE0) !== 0xE0) return 0;
  const ver = (b[i + 1] >> 3) & 3, layer = (b[i + 1] >> 1) & 3;
  if (ver === 1 || layer !== 1) return 0;                 // ayrılmış sürüm / Layer III değil
  const bi = (b[i + 2] >> 4) & 15, si = (b[i + 2] >> 2) & 3, pad = (b[i + 2] >> 1) & 1;
  if (bi === 0 || bi === 15 || si === 3) return 0;
  const br = BITRATES[ver === 3 ? 1 : 2][bi] * 1000, sr = RATES[ver][si];
  return Math.floor((ver === 3 ? 144 : 72) * br / sr) + pad;
}
export function looksLikeMp3(b) {
  if (!b || b.length < MIN_BYTES) return false;
  let start = 0;
  if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) {           // "ID3"
    const size = ((b[6] & 0x7F) << 21) | ((b[7] & 0x7F) << 14) | ((b[8] & 0x7F) << 7) | (b[9] & 0x7F);
    start = 10 + size + ((b[5] & 0x10) ? 10 : 0);
  }
  const end = Math.min(b.length - 4, start + 64 * 1024);           // etiketten sonra en çok 64 KB boşluk
  for (let i = start; i < end; i++) {
    const n = frameAt(b, i);
    if (n >= 24 && frameAt(b, i + n) > 0) return true;
  }
  return false;
}

/* Range: "bytes=a-b" | "bytes=a-" | "bytes=-n" → { offset, length } | null (yok) | "invalid" */
export function parseRange(header, size) {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(header).trim());
  if (!m || (m[1] === "" && m[2] === "")) return "invalid";
  let start, end;
  if (m[1] === "") { const n = Number(m[2]); if (!n) return "invalid"; start = Math.max(0, size - n); end = size - 1; }
  else { start = Number(m[1]); end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1); }
  if (start >= size || end < start) return "invalid";
  return { offset: start, length: end - start + 1 };
}

/* Yüklenen dosyanın görünen adı: yalnızca bilgi amaçlı (kayıtta), en çok 120 karakter. */
export function cleanName(raw) {
  let s = "";
  try { s = decodeURIComponent(String(raw || "")); } catch (e) { s = String(raw || ""); }
  return s.replace(/[\u0000-\u001f\u007f<>"\\/]/g, "").trim().slice(0, 120);
}
