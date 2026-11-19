/* =============================================================================
   STUDIO SEOZ — music-admin-panel.js  (MÜZİK DENETİMİ · yalnızca Studio SEOZ)
   Kütüphanedeki "♪ Müzik Denetimi" düğmesi açar.
   - Depolama: toplam müzik alanı / 8 GB sınır; dolunca yeni yüklemeler kendiliğinden durur
     (mevcut müzikler çalmaya devam eder). Yer, buradan elle silinen müziklerle açılır.
   - Liste: dosya, boyut, yükleme ve telif onayı tarihi / metin sürümü, ETKİNLİK TARİHİ.
     "Etkinliği bitenler" süzgeci; "Müziği Sil" yalnızca elle (onay sorulur). Kendiliğinden hiçbir şey silinmez.
   - Telif şikâyetinde "Devre dışı bırak": müzik ~1 dakika içinde çalmayı bırakır, müşteri yeni dosya yükleyemez.
   - Yarım kalan yüklemeler (kaydı tamamlanmamış dosyalar) varsa "Temizle".
   Supabase: music_owner_list / music_owner_usage / music_owner_set_disabled (yalnızca Studio SEOZ hesabı).
   Silme ve temizleme R2'ye dokunduğu için müşteri sitesindeki /api/muzik/yonetici üzerinden yapılır
   (adres: SEOZ_SUPABASE_CONFIG.musicApiBase; yetki Supabase oturumuyla denetlenir).
   ========================================================================= */
(function (global) {
  "use strict";
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const mb = n => n ? (n / 1048576).toLocaleString("tr-TR", { maximumFractionDigits: 1 }) + " MB" : "";
  const gb = n => (n / 1073741824).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " GB";
  const when = d => { if (!d) return ""; try { return new Date(d).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } };
  const day = d => { if (!d) return ""; try { return new Date(d + "T12:00:00").toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" }); } catch (e) { return d; } };
  function apiBase() {
    const c = global.SEOZ_SUPABASE_CONFIG || {};
    if (c.musicApiBase) return String(c.musicApiBase).replace(/\/+$/, "");
    try { return new URL(global.SeozCloudStore.customerUrl("x")).origin; } catch (e) { return ""; }
  }
  async function adminCall(body) {
    const token = global.SeozCloudStore && global.SeozCloudStore.getAccessToken ? await global.SeozCloudStore.getAccessToken().catch(() => null) : null;
    if (!token) { const e = new Error("AUTH_REQUIRED"); e.code = "AUTH_REQUIRED"; throw e; }
    let res;
    try {
      res = await fetch(apiBase() + "/api/muzik/yonetici", { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } catch (e) { const er = new Error("network"); er.code = "network"; throw er; }
    const j = await res.json().catch(() => null);
    if (!res.ok || !j || !j.ok) { const er = new Error((j && (j.error || j.message)) || ("HTTP " + res.status)); er.code = j && j.error; throw er; }
    return j;
  }

  function open() {
    const ov = document.createElement("div");
    ov.className = "modal-overlay";
    ov.setAttribute("data-music-admin", "");
    ov.innerHTML = `<div class="modal-card" role="dialog" aria-label="Müzik Denetimi" style="max-width:780px;max-height:90vh;overflow:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:6px">
        <h2 style="margin:0">♪ Müzik Denetimi</h2>
        <button type="button" class="btn btn-outline" data-ma-close>Kapat</button>
      </div>
      <div data-ma-usage style="margin:4px 0 12px"></div>
      <p class="sub" style="margin:0 0 10px;color:#6B6A5E;font-size:.86rem">Telif şikâyetinde <b>Devre dışı bırak</b>: müzik hemen çalmayı bırakır. <b>Müziği Sil</b> dosyayı depodan kalıcı olarak siler ve yer açar. Hiçbir müzik kendiliğinden silinmez.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
        <input type="search" data-ma-q placeholder="Davetiye adına göre ara…" style="flex:1 1 220px">
        <select data-ma-f><option value="all">Hepsi</option><option value="ended">Etkinliği bitenler</option><option value="music">Müziği olanlar</option><option value="disabled">Devre dışı</option></select>
      </div>
      <div data-ma-list><p>Yükleniyor…</p></div>
    </div>`;
    document.body.appendChild(ov);
    const close = () => ov.remove();
    ov.querySelector("[data-ma-close]").addEventListener("click", close);
    ov.addEventListener("click", e => { if (e.target === ov) close(); });
    const list = ov.querySelector("[data-ma-list]"), q = ov.querySelector("[data-ma-q]"), f = ov.querySelector("[data-ma-f]"), usageEl = ov.querySelector("[data-ma-usage]");
    let rows = [], usage = null;

    function drawUsage() {
      if (!usage) { usageEl.innerHTML = ""; return; }
      const used = Number(usage.used_bytes) + Number(usage.reserved_bytes), quota = Number(usage.quota_bytes) || 1;
      const pct = Math.min(100, Math.round(used / quota * 1000) / 10);
      const maxFile = Number(usage.limits && usage.limits.max_file_bytes) || 10485760;
      const open = Number(usage.remaining_bytes) >= maxFile && Number(usage.uploads_24h) < Number(usage.global_daily);
      const color = pct >= 95 ? "#9A3B2E" : pct >= 80 ? "#8A5A00" : "#2F6B4F";
      const stale = usage.stale || [];
      usageEl.innerHTML = `<div style="border:1px solid #E7E0D3;padding:12px">
        <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:.9rem">
          <span><b>Depolama:</b> ${gb(used)} / ${gb(quota)} (%${pct.toLocaleString("tr-TR")}) · ${esc(usage.files)} müzik</span>
          <span data-ma-upload-state style="font-weight:700;color:${open ? "#2F6B4F" : "#9A3B2E"}">${open ? "Yükleme açık" : "Yükleme durduruldu"}</span>
        </div>
        <div style="height:8px;background:#EFEAE0;margin-top:8px;border-radius:99px;overflow:hidden" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Depolama doluluğu"><i style="display:block;height:100%;width:${pct}%;background:${color}"></i></div>
        <small style="display:block;color:#6B6A5E;margin-top:6px">Son 24 saatte ${esc(usage.uploads_24h)} / ${esc(usage.global_daily)} yükleme. ${open ? "" : "Yer açmak için etkinliği biten davetiyelerin müziklerini silebilirsiniz; yükleme kendiliğinden yeniden açılır."}</small>
        ${stale.length ? `<div style="margin-top:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap"><small style="color:#8A5A00">Yarım kalan ${stale.length} yükleme var (kaydı tamamlanmamış dosya).</small><button type="button" class="btn btn-outline" data-ma-clean>Temizle</button></div>` : ""}
      </div>`;
      const clean = usageEl.querySelector("[data-ma-clean]");
      if (clean) clean.addEventListener("click", () => {
        clean.disabled = true;
        adminCall({ islem: "temizle" }).then(load).catch(err => { clean.disabled = false; alert("Temizlenemedi: " + errText(err)); });
      });
    }

    function draw() {
      const term = q.value.trim().toLowerCase(), fil = f.value;
      const shown = rows.filter(r => (!term || r.slug.indexOf(term) !== -1)
        && (fil === "all" || (fil === "ended" && r.event_ended) || (fil === "music" && r.has_music) || (fil === "disabled" && r.disabled_at)));
      if (!shown.length) { list.innerHTML = `<p style="color:#6B6A5E">${rows.length ? "Eşleşen davetiye yok." : "Henüz müşteri müziği yok."}</p>`; return; }
      list.innerHTML = shown.map(r => {
        const st = r.disabled_at ? `<b style="color:#9A3B2E">Devre dışı</b>${r.disabled_reason ? " — " + esc(r.disabled_reason) : ""}`
          : r.has_music ? `<b style="color:#2F6B4F">Çalıyor</b>` : `<span style="color:#6B6A5E">Müzik yok</span>`;
        const ev = r.event_date ? `Etkinlik: ${esc(day(r.event_date))} ${r.event_ended ? `<b style="color:#8A5A00">· etkinlik bitti</b>` : "· henüz olmadı"}` : "Etkinlik tarihi yok";
        const listen = r.has_music && !r.disabled_at && apiBase() ? `<a class="btn btn-outline" target="_blank" rel="noopener" href="${esc(apiBase() + "/muzik/" + r.slug)}">Dinle</a>` : "";
        return `<div data-ma-row="${esc(r.slug)}" style="border:1px solid #E7E0D3;padding:12px;margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center">
            <div style="min-width:0;overflow-wrap:anywhere"><b>${esc(r.slug)}</b><br><small>${st}</small><br><small data-ma-event>${ev}</small></div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">${listen}
              ${r.disabled_at ? `<button type="button" class="btn btn-outline" data-ma-enable>Yeniden etkinleştir</button>`
                : `<button type="button" class="btn btn-outline" data-ma-disable style="color:#9A3B2E">Devre dışı bırak</button>`}
              ${r.has_music ? `<button type="button" class="btn btn-outline" data-ma-delete style="color:#9A3B2E">Müziği Sil</button>` : ""}</div>
          </div>
          <small style="display:block;color:#6B6A5E;margin-top:6px">${r.has_music ? `${esc(r.file_name || "dosya")} · ${mb(r.file_size)} · yüklendi ${esc(when(r.uploaded_at))}<br>` : ""}${r.consent_at ? `Son telif onayı: ${esc(when(r.consent_at))} (${esc(r.consent_version)}) · toplam yükleme: ${esc(r.uploads_total)}` : "Telif onayı kaydı yok"}</small>
          <div data-ma-reason style="margin-top:8px;display:none;gap:6px;flex-wrap:wrap">
            <input type="text" maxlength="300" placeholder="Neden (ör. telif şikâyeti — gönderen, tarih)" style="flex:1 1 240px" data-ma-reason-in>
            <button type="button" class="btn btn-primary" data-ma-disable-ok>Devre dışı bırak</button>
          </div>
          <small data-ma-msg style="color:#9A3B2E"></small>
        </div>`;
      }).join("");
    }
    function errText(err) {
      const c = (err && (err.code || err.message)) || "";
      return c === "AUTH_REQUIRED" ? "Önce Studio SEOZ hesabıyla giriş yapın (☁ Giriş Yap)." : c === "network" ? "Müşteri sitesine ulaşılamadı." : c === "storage_not_ready" ? "Müzik deposu (R2) bağlı değil." : c;
    }

    function act(slug, disabled, reason, rowEl) {
      const msg = rowEl.querySelector("[data-ma-msg]");
      rowEl.querySelectorAll("button").forEach(b => { b.disabled = true; });
      msg.textContent = "Kaydediliyor…";
      global.SeozEventStore.ownerMusicSetDisabled(slug, disabled, reason)
        .then(load)
        .catch(err => { msg.textContent = "Yapılamadı: " + errText(err); rowEl.querySelectorAll("button").forEach(b => { b.disabled = false; }); });
    }
    function del(slug, rowEl) {
      const r = rows.find(x => x.slug === slug) || {};
      const warn = r.event_ended ? "" : (r.event_date ? "\n\nDİKKAT: Bu davetiyenin etkinliği HENÜZ OLMADI (" + day(r.event_date) + ")." : "\n\nDİKKAT: Bu davetiyenin etkinlik tarihi bilinmiyor.");
      if (!confirm(`"${slug}" davetiyesinin müziği kalıcı olarak silinsin mi?\n\nDosya depodan silinir ve geri getirilemez; davetiye müziksiz açılır. Telif onayı kayıtları kanıt olarak kalır.${warn}`)) return;
      const msg = rowEl.querySelector("[data-ma-msg]");
      rowEl.querySelectorAll("button").forEach(b => { b.disabled = true; });
      msg.textContent = "Siliniyor…";
      adminCall({ islem: "sil", slug }).then(load).catch(err => { msg.textContent = "Silinemedi: " + errText(err); rowEl.querySelectorAll("button").forEach(b => { b.disabled = false; }); });
    }

    list.addEventListener("click", e => {
      const row = e.target.closest("[data-ma-row]"); if (!row) return;
      const slug = row.getAttribute("data-ma-row");
      if (e.target.closest("[data-ma-disable]")) { const r = row.querySelector("[data-ma-reason]"); r.style.display = "flex"; r.querySelector("input").focus(); }
      else if (e.target.closest("[data-ma-disable-ok]")) act(slug, true, row.querySelector("[data-ma-reason-in]").value.trim(), row);
      else if (e.target.closest("[data-ma-enable]")) act(slug, false, null, row);
      else if (e.target.closest("[data-ma-delete]")) del(slug, row);
    });
    q.addEventListener("input", draw);
    f.addEventListener("change", draw);

    function load() {
      return Promise.all([global.SeozEventStore.ownerMusicList(), global.SeozEventStore.ownerMusicUsage ? global.SeozEventStore.ownerMusicUsage().catch(() => null) : null])
        .then(([r, u]) => { rows = Array.isArray(r) ? r : []; usage = u; drawUsage(); draw(); })
        .catch(err => {
          const code = (err && (err.code || err.message)) || "";
          list.innerHTML = `<p style="color:#9A3B2E">${code === "AUTH_REQUIRED" ? "Önce Studio SEOZ hesabıyla giriş yapın (editörde ☁ Giriş Yap)." :
            /music_owner_list|PGRST202|Could not find/i.test(code) ? "Supabase'de müzik yönetimi henüz kurulu değil (supabase/muzik-yonetimi.sql)." : "Liste alınamadı: " + esc(code)}</p>`;
        });
    }
    load();
  }

  global.SeozMusicAdmin = { open };
})(window);
