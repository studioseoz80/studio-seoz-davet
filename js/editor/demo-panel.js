/* =============================================================================
   GÜVENLİ ÖN İZLEME + NİHAİ YAYINA AL (yalnızca editör)
   -----------------------------------------------------------------------------
   Güvenli Ön İzleme Oluştur:
     - Davetiyenin o anki hâlinin kopyası korumalı ön izleme tablosuna yazılır (supabase/guvenli-onizleme.sql);
       kalıcı davetiye (published_invitations) OLUŞTURULMAZ / DEĞİŞMEZ.
     - Müşteriye <müşteri-sitesi>/onizleme#t=<anahtar> verilir: tahmin edilemez anahtar (24 bayt), varsayılan
       7 gün; süre ve iptal sunucuda denetlenir. Sayfada "PREVIEW — STUDIO SEOZ" filigranı vardır.
     - Medya, gerçek davetiye adresinden bağımsız bir klasöre yüklenir (adres sızmaz).
     - Mühürlü Kart gizli mesajları ve veri gönderen dış adresler kopyaya konmaz (sunucu da çıkarır).
   Nihai Yayına Al:
     - Yalnızca yöneticinin açık ödeme onayıyla (onay kutusu) çalışır; ödeme otomatik varsayılmaz.
     - Mevcut "Yayına Hazırla" akışını aynen çalıştırır (kalıcı bağlantı, katılım paneli, anı albümü,
       anket/dilek hazırlığı, teslimat paketi) ve sonra onay kaydını yazıp açık ön izlemeleri kapatır.
   Ön izleme anahtarı sunucuda saklanmaz (yalnızca özeti); bu tarayıcıda hatırlanır ki bağlantı tekrar kopyalanabilsin.
   ============================================================================= */
(function (global) {
  "use strict";
  const esc = v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const TOK_KEY = id => "seoz_demo_tokens_v1_" + id, FOLDER_KEY = id => "seoz_demo_folder_v1_" + id;
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* yok say */ } };
  const tokens = id => { try { return JSON.parse(lsGet(TOK_KEY(id)) || "{}") || {}; } catch (e) { return {}; } };
  const rpc = (n, a) => global.SeozEventStore.ownerRpc(n, a);
  const ENDPOINT_KEYS = ["fbFormUrl", "pollFormUrl", "googleFormUrl", "uploadUrl"];

  function siteBase() {
    const c = global.SEOZ_SUPABASE_CONFIG || {};
    let u = String(c.shortBaseUrl || c.publicViewUrl || "").trim();
    try { return new URL(u || "view.html", global.location.href).origin; } catch (e) { return global.location.origin; }
  }
  const demoUrl = token => siteBase() + "/onizleme#t=" + token;

  function folderFor(docId) {
    let f = lsGet(FOLDER_KEY(docId));
    if (!/^onizleme-[a-z0-9]{12}$/.test(f || "")) {
      const a = new Uint8Array(12); (global.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach((_, i) => { a[i] = Math.random() * 256; });
      f = "onizleme-" + Array.from(a, b => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
      lsSet(FOLDER_KEY(docId), f);
    }
    return f;
  }
  // Ön izleme kopyası: gizli mesajlar ve veri gönderen dış adresler çıkarılır (sunucu da aynısını yapar)
  function cleanCopy(doc) {
    let out = JSON.parse(JSON.stringify(doc));
    if (global.SeozEventStore && global.SeozEventStore.stripSealed) out = global.SeozEventStore.stripSealed(out);
    const walk = n => {
      if (Array.isArray(n)) n.forEach(walk);
      else if (n && typeof n === "object") Object.keys(n).forEach(k => {
        if (ENDPOINT_KEYS.indexOf(k) >= 0 && typeof n[k] === "string" && n[k].trim()) n[k] = "#onizleme";
        else walk(n[k]);
      });
    };
    walk(out.layers);
    return out;
  }
  async function snapshotFor(doc, progress) {
    return global.SeozCloudStore.uploadSnapshotMedia(cleanCopy(doc), folderFor(doc.id), progress);
  }
  function errText(err) {
    const c = String((err && (err.code || err.message)) || "");
    if (c === "AUTH_REQUIRED") return "Studio SEOZ girişi gerekli: üstteki ☁ Giriş Yap ile giriş yapıp tekrar deneyin.";
    if (/PGRST202|Could not find the function|demo_owner|demo_preview/i.test(c) && /find|PGRST202/i.test(c)) return "Supabase'de güvenli ön izleme kurulmamış (supabase/guvenli-onizleme.sql çalıştırılmalı).";
    if (c === "network" || c === "NETWORK") return "Bağlantı kurulamadı. İnternetinizi kontrol edip tekrar deneyin.";
    if (/closed/.test(c)) return "Bu ön izleme kapalı (iptal edilmiş ya da nihai yayına alınmış).";
    if (/invalid_doc/.test(c)) return "Davetiye kopyası çok büyük ya da geçersiz.";
    return c || "Bilinmeyen hata.";
  }
  function fmt(d) { try { return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(d)); } catch (e) { return String(d); } }
  function stateOf(r) {
    const now = new Date(r.now || Date.now()).getTime(), exp = new Date(r.expires_at).getTime();
    if (r.finalized_at) return { cls: "fin", txt: "Kapalı — nihai yayına alındı", open: false };
    if (r.revoked_at) return { cls: "rev", txt: "İptal edildi", open: false };
    if (now >= exp) return { cls: "exp", txt: "Süresi doldu", open: false, expired: true };
    const days = Math.ceil((exp - now) / 86400000);
    return { cls: "on", txt: `Açık · ${days} gün kaldı (${fmt(r.expires_at)})`, open: true };
  }
  function shell(title, aria) {
    const old = document.querySelector(".sp-root.dp-root"); if (old) old.remove();
    const root = document.createElement("div");
    root.className = "sp-root dp-root"; root.setAttribute("role", "dialog"); root.setAttribute("aria-label", aria || title);
    root.innerHTML = `<div class="sp-card dp-card"><button type="button" class="sp-x" data-dp-close aria-label="Kapat">×</button><h3>${esc(title)}</h3><div data-dp-body></div></div>`;
    document.body.appendChild(root);
    const close = () => { root.remove(); document.removeEventListener("keydown", onKey); };
    const onKey = e => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    root.addEventListener("click", e => { if (e.target === root || e.target.closest("[data-dp-close]")) close(); });
    return { root, body: root.querySelector("[data-dp-body]"), close };
  }

  /* ---------------- GÜVENLİ ÖN İZLEME ---------------- */
  function open(doc) {
    const { body } = shell("Güvenli Ön İzleme", "Güvenli ön izleme bağlantıları");
    let list = [], busy = "", msg = "";
    const render = () => {
      const toks = tokens(doc.id);
      body.innerHTML = `
        <p class="sp-note">Müşteriye <b>filigranlı</b> ve <b>süreli</b> bir ön izleme bağlantısı verin. Kalıcı davetiye bağlantısından bağımsızdır.
          Ön izlemede tasarım, animasyon, müzik, galeri ve formların görünümü incelenir; <b>katılım yanıtı, dosya yükleme, dilek, anket gibi hiçbir kayıt yapılamaz</b> (sunucu reddeder).</p>
        <div class="dp-new"><label>Geçerlilik <select data-dp-days>${[3, 7, 14, 30].map(d => `<option value="${d}"${d === 7 ? " selected" : ""}>${d} gün</option>`).join("")}</select></label>
          <button type="button" class="btn btn-gold" data-dp-create ${busy ? "disabled" : ""}>${busy === "create" ? esc(msg || "Hazırlanıyor...") : "Güvenli Ön İzleme Oluştur"}</button></div>
        ${!busy && msg ? `<p class="sp-note dp-msg">${esc(msg)}</p>` : ""}
        <h4>Bu davetiyenin ön izlemeleri</h4>
        ${list.length ? list.map(r => {
          const st = stateOf(r), tok = toks[r.id];
          return `<div class="dp-item dp-${st.cls}" data-id="${esc(r.id)}">
            <div class="dp-row"><b class="dp-state">${esc(st.txt)}</b><small>Oluşturma: ${esc(fmt(r.created_at))} · Görüntülenme: ${Number(r.view_count) || 0}</small></div>
            ${tok && st.open ? `<div class="sp-link"><input readonly value="${esc(demoUrl(tok))}" aria-label="Ön izleme bağlantısı" data-dp-url></div>
              <div class="sp-actions"><button type="button" class="btn btn-outline" data-dp-copy>Kopyala</button>
                <a class="btn btn-outline" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(demoUrl(tok))}">WhatsApp</a>
                <a class="btn btn-outline" target="_blank" rel="noopener" href="${esc(demoUrl(tok))}">Aç</a></div>`
              : st.open ? `<p class="sp-note">Bağlantı yalnızca oluşturulduğu tarayıcıda gösterilir (güvenlik için sunucuda saklanmaz).</p>` : ""}
            <div class="dp-acts">
              ${st.open ? `<button type="button" class="btn btn-outline" data-dp-update>Son hâli yükle</button>` : ""}
              ${st.open || st.expired ? `<button type="button" class="btn btn-outline" data-dp-extend>Süreyi uzat (+7 gün)</button>` : ""}
              ${st.open || st.expired ? `<button type="button" class="btn btn-outline dp-danger" data-dp-revoke>İptal et</button>` : `<button type="button" class="btn btn-outline" data-dp-delete>Kaydı sil</button>`}
            </div></div>`;
        }).join("") : `<p class="sp-note">Henüz ön izleme yok.</p>`}`;
    };
    const load = () => rpc("demo_owner_list", { p_doc_id: doc.id }).then(r => { list = Array.isArray(r) ? r : []; render(); }).catch(err => { msg = errText(err); render(); });
    const act = (p, okMsg) => { busy = "act"; render(); return p.then(() => { msg = okMsg; }).catch(err => { msg = errText(err); }).then(() => { busy = ""; return load(); }); };
    body.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b || b.disabled) return;
      const item = b.closest("[data-id]"), id = item && item.getAttribute("data-id");
      if (b.matches("[data-dp-create]")) {
        const days = Number(body.querySelector("[data-dp-days]").value) || 7;
        busy = "create"; msg = "Hazırlanıyor..."; render();
        try { global.SeozStorage.saveDraft(doc); } catch (er) { /* yok say */ }
        snapshotFor(doc, t => { msg = t; const bt = body.querySelector("[data-dp-create]"); if (bt) bt.textContent = t; })
          .then(snap => rpc("demo_owner_create", { p_doc_id: doc.id, p_title: (doc.meta && doc.meta.title) || "", p_doc: snap, p_days: days }))
          .then(r => { const t = tokens(doc.id); t[r.id] = r.token; lsSet(TOK_KEY(doc.id), JSON.stringify(t)); msg = `Ön izleme hazır — ${days} gün geçerli. Bağlantıyı kopyalayıp müşteriye gönderin.`; })
          .catch(err => { console.error("[Studio SEOZ] Ön izleme oluşturulamadı:", err); msg = "Ön izleme oluşturulamadı: " + errText(err); })
          .then(() => { busy = ""; return load(); });
      } else if (b.matches("[data-dp-copy]")) {
        const inp = item.querySelector("[data-dp-url]"); inp.select();
        (navigator.clipboard ? navigator.clipboard.writeText(inp.value) : Promise.reject()).catch(() => document.execCommand("copy")).then(() => { b.textContent = "Kopyalandı ✓"; setTimeout(() => { b.textContent = "Kopyala"; }, 1600); });
      } else if (b.matches("[data-dp-update]")) {
        busy = "act"; render();
        snapshotFor(doc, () => {}).then(snap => rpc("demo_owner_update", { p_id: id, p_doc: snap, p_title: (doc.meta && doc.meta.title) || "" }))
          .then(() => { msg = "Ön izleme son hâliyle güncellendi (bağlantı aynı)."; }).catch(err => { msg = errText(err); }).then(() => { busy = ""; return load(); });
      } else if (b.matches("[data-dp-extend]")) act(rpc("demo_owner_extend", { p_id: id, p_days: 7 }), "Süre 7 gün uzatıldı.");
      else if (b.matches("[data-dp-revoke]")) { if (confirm("Bu ön izleme bağlantısı iptal edilsin mi?\n\nMüşteri bağlantıyı artık açamaz. Bu işlem geri alınamaz (gerekirse yeni ön izleme oluşturabilirsiniz).")) act(rpc("demo_owner_revoke", { p_id: id }), "Bağlantı iptal edildi."); }
      else if (b.matches("[data-dp-delete]")) { if (confirm("Kapanmış bu ön izleme kaydı silinsin mi? (Davetiyeye ve diğer kayıtlara dokunulmaz.)")) act(rpc("demo_owner_delete", { p_id: id }).then(() => { const t = tokens(doc.id); delete t[id]; lsSet(TOK_KEY(doc.id), JSON.stringify(t)); }), "Kayıt silindi."); }
    });
    render(); load();
  }

  /* ---------------- NİHAİ YAYINA AL ---------------- */
  // onConfirm(note): onay verilince mevcut yayın akışını nihai kipte başlatır (editor-app.js)
  function openFinal(doc, onConfirm) {
    const { body, close } = shell("Nihai Yayına Al", "Nihai yayına al — ödeme onayı");
    body.innerHTML = `
      <p class="sp-note">Ödeme onaylandıktan sonra kullanın. Davetiye <b>filigransız kalıcı bağlantıyla</b> yayınlanır; varsa <b>katılım (RSVP) paneli</b>, <b>anı albümü</b>
        ve interaktif modüller etkinleştirilir, <b>teslimat paketi</b> hazırlanır. Bu davetiyenin açık ön izleme bağlantıları kapatılır.</p>
      <div data-dp-hist></div>
      <label class="dp-check"><input type="checkbox" data-dp-paid> <span>Bu davetiyenin <b>ödemesinin alındığını kontrol ettim</b> ve nihai yayını onaylıyorum.</span></label>
      <label class="dp-note-in">Ödeme / sipariş notu (isteğe bağlı)<input type="text" maxlength="200" data-dp-note placeholder="Örn. Etsy sipariş #1042 · 16 Kasım"></label>
      <div class="sp-actions"><button type="button" class="btn btn-outline" data-dp-close>Vazgeç</button><button type="button" class="btn btn-gold" data-dp-go disabled>Nihai Yayına Al</button></div>
      <p class="sp-note">Ödeme otomatik doğrulanmaz; onay, giriş yapmış Studio SEOZ hesabıyla tarih ve notla kaydedilir.</p>`;
    const paid = body.querySelector("[data-dp-paid]"), go = body.querySelector("[data-dp-go]");
    paid.addEventListener("change", () => { go.disabled = !paid.checked; });
    go.addEventListener("click", () => { if (!paid.checked) return; const note = body.querySelector("[data-dp-note]").value.trim(); close(); onConfirm(note); });
    rpc("demo_owner_finalizations", { p_doc_id: doc.id }).then(r => {
      if (Array.isArray(r) && r.length) body.querySelector("[data-dp-hist]").innerHTML = `<p class="sp-note dp-msg">Daha önce nihai yayına alındı: ${esc(fmt(r[0].confirmed_at))}${r[0].note ? " · " + esc(r[0].note) : ""}. Tekrar yayınlamak bağlantıyı değiştirmez.</p>`;
    }).catch(() => {});
  }

  global.SeozDemoPanel = { open, openFinal, demoUrl, cleanCopy };
})(window);
