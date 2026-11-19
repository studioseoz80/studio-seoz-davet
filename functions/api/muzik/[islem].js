/* =============================================================================
   STUDIO SEOZ — "MÜZİĞİMİ YÖNET" İŞLEMLERİ  ( POST /api/muzik/yukle · POST /api/muzik/sil )
   -----------------------------------------------------------------------------
   Müşterinin gizli anahtarı "X-Muzik-Anahtar" başlığıyla gelir (adreste / kayıtlarda görünmez).
   YÜKLE: 1) anahtar + devre dışı + günlük sınır Supabase'de denetlenir,
          2) telif onayının (Türkçe ya da İngilizce metin) sürümü ve metin özeti birebir tutmalı,
          3) dosya en çok 10 MB olmalı ve İÇERİĞİ gerçekten MP3 olmalı (uzantıya bakılmaz),
          4) rastgele adla R2'ye yazılır, Supabase'e onayla birlikte kaydedilir
             (kayıt reddedilirse yazılan dosya hemen silinir), eski dosya R2'den silinir.
   SİL:   kayıt boşaltılır, dosya R2'den silinir (erişim anında biter).
   Önizleme (dal) adreslerinde canlı veriye yazma kapalıdır.
   ========================================================================= */
import { supabaseConfig } from "../../[slug].js";
import { MAX_BYTES, MIN_BYTES, TOKEN_RE, KEY_RE, isPreviewHost, json, rpc, sha256hex, randomHex, readCapped, looksLikeMp3, cleanName } from "../../../lib/muzik-sunucu.js";

const ERR = {
  invalid_token: [403, "Bu bağlantı geçersiz ya da yenilenmiş."],
  music_disabled: [423, "Bu davetiyenin müziği Studio SEOZ tarafından devre dışı bırakıldı."],
  consent_required: [400, "Yüklemeden önce kullanım hakkı onayını vermelisiniz."],
  daily_limit: [429, "Bugünkü yükleme hakkınız doldu. Yarın tekrar deneyin."],
  too_large: [413, "Dosya en fazla 10 MB olabilir."],
  not_mp3: [415, "Yalnızca MP3 dosyası yüklenebilir."],
  storage_not_ready: [503, "Müzik deposu henüz hazır değil. Lütfen Studio SEOZ ile iletişime geçin."],
  preview: [403, "Önizleme sürümünde yükleme kapalıdır."],
  server: [503, "İşlem şu anda yapılamadı. Lütfen biraz sonra tekrar deneyin."]
};
const fail = (code) => { const [s, m] = ERR[code] || ERR.server; return json(s, { ok: false, error: ERR[code] ? code : "server", message: m }); };

export async function onRequest(context) {
  const { request, env, params } = context;
  const islem = String(params.islem || "");
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
    if (!r.ok) return fail(ERR[r.code] ? r.code : "server");
    const old = r.data && r.data.old_key;
    if (old && KEY_RE.test(old) && old.startsWith(`m/${slug}/`)) await bucket.delete(old);
    return json(200, { ok: true });
  }

  // ---- YÜKLE ----
  if (info.data.disabled) return fail("music_disabled");
  if (!(info.data.uploads_left_today > 0)) return fail("daily_limit");
  // Onaylanan metin: Türkçe ya da İngilizce (sayfada hangisi gösterildiyse); sürüm + özet birebir tutmalı.
  const ver = request.headers.get("X-Onay-Surum"), osha = request.headers.get("X-Onay-Ozet");
  const all = info.data.consents ? Object.values(info.data.consents) : [info.data.consent];
  const consent = all.find(c => c && c.version === ver && c.sha256 === osha);
  if (!consent) return fail("consent_required");

  const bytes = await readCapped(request, MAX_BYTES);
  if (bytes === null) return fail("too_large");
  if (bytes.length < MIN_BYTES || !looksLikeMp3(bytes)) return fail("not_mp3");

  const sha = await sha256hex(bytes);
  const key = `m/${slug}/${randomHex(16)}.mp3`;
  const name = cleanName(request.headers.get("X-Dosya-Adi"));
  await bucket.put(key, bytes, { httpMetadata: { contentType: "audio/mpeg" }, customMetadata: { slug, sha256: sha } });

  const c = await rpc(cfg, "music_manage_commit", {
    p_token: token, p_file_key: key, p_file_size: bytes.length, p_file_sha256: sha, p_original_name: name || null,
    p_consent_version: consent.version, p_consent_sha256: consent.sha256
  });
  if (!c.ok) {
    await bucket.delete(key);                              // kayıt yoksa dosya da kalmaz
    return fail(ERR[c.code] ? c.code : "server");
  }
  const old = c.data && c.data.old_key;
  if (old && old !== key && KEY_RE.test(old) && old.startsWith(`m/${slug}/`)) await bucket.delete(old);
  return json(200, { ok: true, file_name: name, file_size: bytes.length, file_sha256: sha, uploaded_at: c.data && c.data.uploaded_at });
}
