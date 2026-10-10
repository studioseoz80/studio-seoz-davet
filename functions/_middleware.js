/* =============================================================================
   STUDIO SEOZ — EDİTÖR KİLİDİ (Cloudflare Pages Functions)
   -----------------------------------------------------------------------------
   Bu dosya tarayıcıya GİTMEZ; Cloudflare'in sunucusunda çalışır. Siteye
   gelen her istekten önce şifre sorar (tarayıcının kendi giriş penceresi).

   ŞİFRE KODDA YOK: Şifre Cloudflare panelinde, projenin gizli ayarında
   (Settings → Variables and Secrets → EDITOR_PASSWORD) durur.

   - EDITOR_PASSWORD tanımlı olan projede (editör: studio-seoz-davet)
     → şifre sorulur.
   - Tanımlı olmayan projede (müşteri sitesi: seoz-davet)
     → hiçbir şey sorulmaz, davetiyeler herkese açık çalışır.
   Kullanıcı adı varsayılan "seoz"; istenirse EDITOR_USER ile değiştirilir.
   ========================================================================= */

const encoder = new TextEncoder();

// Zamanlama saldırısına karşı sabit süreli karşılaştırma.
async function safeEqual(a, b) {
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(String(a))),
    crypto.subtle.digest("SHA-256", encoder.encode(String(b)))
  ]);
  const x = new Uint8Array(ha), y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

function decodeBasic(header) {
  if (!header || !header.startsWith("Basic ")) return null;
  try {
    const bin = atob(header.slice(6).trim());
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    const text = new TextDecoder().decode(bytes); // Türkçe karakterli şifreler için
    const i = text.indexOf(":");
    if (i < 0) return null;
    return { user: text.slice(0, i), pass: text.slice(i + 1) };
  } catch (e) {
    return null;
  }
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const password = env.EDITOR_PASSWORD;

  // Şifre tanımlı değilse (müşteri sitesi) dokunma.
  if (!password) return next();

  const expectedUser = env.EDITOR_USER || "seoz";
  const creds = decodeBasic(request.headers.get("Authorization"));
  if (creds) {
    const [okUser, okPass] = await Promise.all([
      safeEqual(creds.user, expectedUser),
      safeEqual(creds.pass, password)
    ]);
    if (okUser && okPass) {
      const res = await next();
      const out = new Response(res.body, res);
      out.headers.set("Cache-Control", "private, no-store");
      return out;
    }
  }

  return new Response("Bu sayfa için giriş gerekiyor.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Studio SEOZ Editor", charset="UTF-8"',
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
