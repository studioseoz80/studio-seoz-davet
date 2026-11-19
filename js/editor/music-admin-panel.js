/* =============================================================================
   STUDIO SEOZ — music-admin-panel.js  (MÜZİK DENETİMİ · yalnızca Studio SEOZ)
   Kütüphanedeki "♪ Müzik Denetimi" düğmesi açar. Müşterilerin yüklediği müzikleri listeler:
   dosya adı, boyut, yükleme ve telif onayı tarihi / metin sürümü.
   Telif şikâyetinde "Devre dışı bırak": müzik ~1 dakika içinde misafirlere çalmayı bırakır,
   müşteri yeni dosya yükleyemez (silebilir). "Yeniden etkinleştir" geri açar.
   Supabase: music_owner_list / music_owner_set_disabled (yalnızca Studio SEOZ hesabı).
   ========================================================================= */
(function (global) {
  "use strict";
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const mb = n => n ? (n / 1048576).toLocaleString("tr-TR", { maximumFractionDigits: 1 }) + " MB" : "";
  const when = d => { if (!d) return ""; try { return new Date(d).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } };
  function siteBase(slug) {
    try { return new URL(global.SeozCloudStore.customerUrl(slug)).origin; } catch (e) { return ""; }
  }

  function open() {
    const ov = document.createElement("div");
    ov.className = "modal-overlay";
    ov.setAttribute("data-music-admin", "");
    ov.innerHTML = `<div class="modal-card" role="dialog" aria-label="Müzik Denetimi" style="max-width:760px;max-height:88vh;overflow:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:6px">
        <h2 style="margin:0">♪ Müzik Denetimi</h2>
        <button type="button" class="btn btn-outline" data-ma-close>Kapat</button>
      </div>
      <p class="sub" style="margin:0 0 12px;color:#6B6A5E;font-size:.88rem">Müşterilerin "Müziğimi Yönet" ile yüklediği müzikler. Telif şikâyetinde <b>Devre dışı bırak</b>: müzik hemen çalmayı bırakır, müşteri yeni dosya yükleyemez.</p>
      <input type="search" data-ma-q placeholder="Davetiye adına göre ara…" style="width:100%;margin-bottom:10px">
      <div data-ma-list><p>Yükleniyor…</p></div>
    </div>`;
    document.body.appendChild(ov);
    const close = () => ov.remove();
    ov.querySelector("[data-ma-close]").addEventListener("click", close);
    ov.addEventListener("click", e => { if (e.target === ov) close(); });
    const list = ov.querySelector("[data-ma-list]"), q = ov.querySelector("[data-ma-q]");
    let rows = [];

    function draw() {
      const term = q.value.trim().toLowerCase();
      const shown = rows.filter(r => !term || r.slug.indexOf(term) !== -1);
      if (!shown.length) { list.innerHTML = `<p style="color:#6B6A5E">${rows.length ? "Eşleşen davetiye yok." : "Henüz müşteri müziği yok."}</p>`; return; }
      list.innerHTML = shown.map(r => {
        const st = r.disabled_at ? `<b style="color:#9A3B2E">Devre dışı</b>${r.disabled_reason ? " — " + esc(r.disabled_reason) : ""}`
          : r.has_music ? `<b style="color:#2F6B4F">Çalıyor</b>` : `<span style="color:#6B6A5E">Müzik yok</span>`;
        const listen = r.has_music && !r.disabled_at && siteBase(r.slug) ? `<a class="btn btn-outline" target="_blank" rel="noopener" href="${esc(siteBase(r.slug) + "/muzik/" + r.slug)}">Dinle</a>` : "";
        return `<div data-ma-row="${esc(r.slug)}" style="border:1px solid #E7E0D3;padding:12px;margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center">
            <div style="min-width:0;overflow-wrap:anywhere"><b>${esc(r.slug)}</b><br><small>${st}</small></div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">${listen}
              ${r.disabled_at ? `<button type="button" class="btn btn-outline" data-ma-enable>Yeniden etkinleştir</button>`
                : `<button type="button" class="btn btn-outline" data-ma-disable style="color:#9A3B2E">Devre dışı bırak</button>`}</div>
          </div>
          <small style="display:block;color:#6B6A5E;margin-top:6px">${r.has_music ? `${esc(r.file_name || "dosya")} · ${mb(r.file_size)} · yüklendi ${esc(when(r.uploaded_at))}<br>` : ""}${r.consent_at ? `Son telif onayı: ${esc(when(r.consent_at))} (${esc(r.consent_version)}) · toplam yükleme: ${esc(r.uploads_total)}` : "Telif onayı kaydı yok"}</small>
          <div data-ma-reason hidden style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
            <input type="text" maxlength="300" placeholder="Neden (ör. telif şikâyeti — gönderen, tarih)" style="flex:1 1 240px" data-ma-reason-in>
            <button type="button" class="btn btn-primary" data-ma-disable-ok>Devre dışı bırak</button>
          </div>
          <small data-ma-msg style="color:#9A3B2E"></small>
        </div>`;
      }).join("");
    }

    function act(slug, disabled, reason, rowEl) {
      const msg = rowEl.querySelector("[data-ma-msg]");
      rowEl.querySelectorAll("button").forEach(b => { b.disabled = true; });
      msg.textContent = "Kaydediliyor…";
      global.SeozEventStore.ownerMusicSetDisabled(slug, disabled, reason)
        .then(load)
        .catch(err => { msg.textContent = "Yapılamadı: " + ((err && (err.code || err.message)) || ""); rowEl.querySelectorAll("button").forEach(b => { b.disabled = false; }); });
    }

    list.addEventListener("click", e => {
      const row = e.target.closest("[data-ma-row]"); if (!row) return;
      const slug = row.getAttribute("data-ma-row");
      if (e.target.closest("[data-ma-disable]")) { const r = row.querySelector("[data-ma-reason]"); r.hidden = false; r.querySelector("input").focus(); }
      else if (e.target.closest("[data-ma-disable-ok]")) act(slug, true, row.querySelector("[data-ma-reason-in]").value.trim(), row);
      else if (e.target.closest("[data-ma-enable]")) act(slug, false, null, row);
    });
    q.addEventListener("input", draw);

    function load() {
      return global.SeozEventStore.ownerMusicList().then(r => { rows = Array.isArray(r) ? r : []; draw(); }).catch(err => {
        const code = (err && (err.code || err.message)) || "";
        list.innerHTML = `<p style="color:#9A3B2E">${code === "AUTH_REQUIRED" ? "Önce Studio SEOZ hesabıyla giriş yapın (editörde ☁ Giriş Yap)." :
          /music_owner_list|PGRST202|Could not find/i.test(code) ? "Supabase'de müzik yönetimi henüz kurulu değil (supabase/muzik-yonetimi.sql)." : "Liste alınamadı: " + esc(code)}</p>`;
      });
    }
    load();
  }

  global.SeozMusicAdmin = { open };
})(window);
