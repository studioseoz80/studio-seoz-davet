/* =============================================================================
   STUDIO SEOZ — ESKİ UZUN BAĞLANTIYA ÖNİZLEME (Cloudflare Pages Functions)
   -----------------------------------------------------------------------------
   Eski bağlantılar  /view.html?slug=<slug>  biçimindedir. Cloudflare bunu
   /view?slug=<slug> adresine yönlendirir; bu dosya o adreste çalışır ve
   sayfaya kısa bağlantıdakiyle AYNI önizleme bilgisini (kapak, başlık,
   açıklama) ekler. Böylece müşterinin elindeki eski bağlantı da Instagram ve
   WhatsApp'ta görselli kart olur. og:url kısa bağlantıyı gösterir.

   Hiçbir şey değişmez:
   - ?slug= yoksa ya da geçersizse (ör. editörün ?doc= önizlemesi) sayfa
     her zamanki gibi sunulur.
   - Davetiye bulunamazsa ya da Supabase'e ulaşılamazsa sayfa her zamanki
     gibi sunulur (davetiye sayfası kendi mesajını gösterir).
   - Editör projesinde (EDITOR_PASSWORD tanımlı) hiçbir şey yapmaz.
   ========================================================================= */
import { renderInvite, htmlHeaders, isInviteSlug } from "./[slug].js";

export async function onRequest(context) {
  const { request, env, next } = context;
  if (env.EDITOR_PASSWORD || request.method !== "GET" && request.method !== "HEAD") return next();
  const q = new URL(request.url).searchParams;
  const slug = String(q.get("slug") || "").toLowerCase();
  if (q.get("doc") || !isInviteSlug(slug)) return next();
  const r = await renderInvite(context, slug);
  if (!r || !r.found) return next();
  return new Response(request.method === "HEAD" ? null : r.html, { status: 200, headers: htmlHeaders });
}
