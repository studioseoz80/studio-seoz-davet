/* =============================================================================
   STUDIO SEOZ — APPLE TAKVİM (.ics) ADRESİ (Cloudflare Pages Functions)
   -----------------------------------------------------------------------------
   /takvim/<slug>/<katman-id>.ics

   iPhone Safari, tarayıcıda üretilen (blob/data) .ics dosyasını takvime
   EKLEMEZ: dosyayı sessizce "Dosyalar > İndirilenler"e kaydeder ya da hiç
   açmaz. Takvim penceresini ("Takvime Ekle") yalnızca sitenin kendisinden
   text/calendar olarak gelen bir dosya açar. Bu adres, yayınlanmış
   davetiyedeki "Takvime Ekle" modülünün ayarlarından standart bir .ics
   (RFC 5545) üretir.

   - Etkinlik bilgisi YALNIZCA yayınlanmış davetiyeden okunur (salt okuma);
     adres dışarıdan içerik almaz.
   - Saatler js/modules/calendar.js ile BİREBİR aynı yöntemle hesaplanır:
     girilen saat, modülün saat diliminde (varsayılan Europe/Istanbul) duvar
     saati kabul edilir ve kesin UTC anına çevrilip "Z" ile yazılır.
   - UID sabittir (davetiye + katman): aynı etkinlik iki kez eklenirse
     takvim uygulaması onu aynı etkinlik olarak tanır.
   - Davetiye/katman yoksa 404; editör projesinde (EDITOR_PASSWORD) çalışmaz.
   ========================================================================= */
import { supabaseConfig } from "../../[slug].js";

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,78}[a-z0-9])$/;
const LAYER_RE = /^[A-Za-z0-9_-]{1,80}$/;
const DEFAULT_TZ = "Europe/Istanbul";
const DEFAULT_DURATION_MIN = 120;

const pad = n => String(n).padStart(2, "0");
function parseDate(str) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str || ""); return m ? { y: +m[1], mo: +m[2], d: +m[3] } : null; }
function parseTime(str) { const m = /^(\d{1,2}):(\d{2})/.exec(str || ""); if (!m) return null; const h = +m[1], mi = +m[2]; return (h < 24 && mi < 60) ? { h, mi } : null; }
const wall = (date, time) => new Date(Date.UTC(date.y, date.mo - 1, date.d, time.h, time.mi, 0));

export function computeRange(s) {
  const date = parseDate(s.date), start = parseTime(s.startTime);
  if (!date || !start) return null;
  const startWall = wall(date, start), end = parseTime(s.endTime);
  let endWall;
  if (end) { endWall = wall(date, end); if (endWall.getTime() <= startWall.getTime()) endWall = new Date(endWall.getTime() + 86400000); }
  else endWall = new Date(startWall.getTime() + DEFAULT_DURATION_MIN * 60000);
  return { startWall, endWall };
}
function tzOffsetMinutes(utcMs, timeZone) {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const p = {}; fmt.formatToParts(new Date(utcMs)).forEach(x => { p[x.type] = x.value; });
    return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - utcMs) / 60000);
  } catch (e) { return 180; }
}
function wallToUtc(wallDate, timeZone) {
  const guess = wallDate.getTime(), off = tzOffsetMinutes(guess, timeZone);
  let utc = guess - off * 60000; const off2 = tzOffsetMinutes(utc, timeZone);
  if (off2 !== off) utc = guess - off2 * 60000;
  return new Date(utc);
}
const icsEscape = str => String(str || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r\n|\r|\n/g, "\\n");
const ENC = new TextEncoder();
function foldLine(line) {
  const out = []; let cur = "", bytes = 0;
  for (const ch of line) { const b = ENC.encode(ch).length, limit = out.length === 0 ? 75 : 74; if (bytes + b > limit) { out.push(cur); cur = ""; bytes = 0; } cur += ch; bytes += b; }
  out.push(cur); return out.join("\r\n ");
}
const utcStamp = d => d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + "T" + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + "Z";

export function buildIcs(s, uid, now) {
  const r = computeRange(s);
  if (!r) return null;
  const tz = s.timezone || DEFAULT_TZ;
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Studio SEOZ//Dijital Davetiye//TR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT", "UID:" + uid, "DTSTAMP:" + utcStamp(now || new Date()),
    "DTSTART:" + utcStamp(wallToUtc(r.startWall, tz)), "DTEND:" + utcStamp(wallToUtc(r.endWall, tz)),
    "SUMMARY:" + icsEscape(s.title || "Etkinlik"), "DESCRIPTION:" + icsEscape(s.description), "LOCATION:" + icsEscape(s.location),
    "END:VEVENT", "END:VCALENDAR"
  ].map(foldLine).join("\r\n") + "\r\n";
}
function fileName(title) {
  const map = { "ç": "c", "ğ": "g", "ı": "i", "ö": "o", "ş": "s", "ü": "u", "Ç": "c", "Ğ": "g", "İ": "i", "Ö": "o", "Ş": "s", "Ü": "u" };
  const slug = String(title || "").replace(/[çğıöşüÇĞİÖŞÜ]/g, c => map[c]).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return (slug || "davetiye") + ".ics";
}
const notFound = () => new Response("Takvim bilgisi bulunamadı.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

export async function onRequest(context) {
  const { request, env, params, next } = context;
  if (env.EDITOR_PASSWORD) return next();
  if (request.method !== "GET" && request.method !== "HEAD") return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
  const slug = String(params.slug || "").toLowerCase();
  const layer = String(params.layer || "").replace(/\.ics$/i, "");
  if (!SLUG_RE.test(slug) || !LAYER_RE.test(layer)) return notFound();
  let doc;
  try {
    const cfg = await supabaseConfig(env, request);
    if (!cfg) return notFound();
    const res = await fetch(`${cfg.url}/rest/v1/published_invitations?slug=eq.${encodeURIComponent(slug)}&select=document_data&limit=1`,
      { headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, Accept: "application/json" }, cf: { cacheTtl: 60 } });
    if (!res.ok) return new Response("Takvim bilgisi şu anda alınamadı.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
    const rows = await res.json();
    doc = Array.isArray(rows) && rows[0] && rows[0].document_data;
  } catch (e) { return new Response("Takvim bilgisi şu anda alınamadı.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } }); }
  const L = doc && Array.isArray(doc.layers) ? doc.layers.find(l => l && l.type === "module" && l.moduleId === "calendar" && l.id === layer) : null;
  const s = Object.assign({ timezone: DEFAULT_TZ }, L && L.settings);
  if (!s.title && doc && doc.meta && doc.meta.lang === "en") s.title = "Event";   // İngilizce davetiye: başlıksız etkinlik
  const text = L ? buildIcs(s, `${slug}-${layer}@studioseoz`) : null;
  if (!text) return notFound();
  return new Response(request.method === "HEAD" ? null : text, {
    status: 200,
    headers: {
      // inline: iPhone Safari dosyayı indirmek yerine "Takvime Ekle" penceresini açar
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${fileName(s.title)}"`,
      "Cache-Control": "public, max-age=60",
      "X-Robots-Tag": "noindex, nofollow",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
