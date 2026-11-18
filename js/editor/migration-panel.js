/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — editor/migration-panel.js · TAŞIMA PAKETİ PENCERESİ
   Davetiyelerim ekranındaki "Taşıma Paketi" düğmesi. İşi editor/migration.js yapar.
   ========================================================================= */
(function (global) {
  "use strict";
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const mb = n => (n / 1048576).toFixed(1).replace(".", ",") + " MB";
  function countsText(c) {
    return `${c.taslak} davetiye taslağı · ${c.yayin} yayın kopyası · ${c.baglanti} link eşleşmesi · ` +
      `${c.katilimPaneli} Katılım Paneli, ${c.albumPaneli} Anı Albümü, ${c.anketPaneli} anket paneli anahtarı · ${c.gorsel} görsel/dosya`;
  }

  async function open() {
    const T = global.SeozTasima;
    const ov = document.createElement("div");
    ov.className = "modal-overlay";
    ov.innerHTML = `
      <div class="modal-card" style="max-width:640px;max-height:90vh;overflow:auto" data-tasima-panel>
        <h2>Taşıma Paketi</h2>
        <p class="sub" style="margin-top:-4px">Editör verileri bu tarayıcıda, bu adreste saklanır. Başka bir adrese (ör. editor.studioseoz.com) geçerken
          taslakları, görselleri, davetiye kimliklerini, link eşleşmelerini ve panel anahtarlarını eksiksiz taşır. Yayındaki davetiyelere, müşteri linklerine ve Supabase'e dokunmaz.</p>

        <h3 style="margin:18px 0 6px">1 · Bu editördeki veriyi pakete al</h3>
        <p data-summary style="font-size:13px;opacity:.85">Okunuyor...</p>
        <div class="field"><label>Taşıma şifresi (en az 8 karakter — yükleme sırasında aynısı istenir)</label><input type="password" data-pw1 autocomplete="new-password"></div>
        <div class="field"><label>Şifre (tekrar)</label><input type="password" data-pw2 autocomplete="new-password"></div>
        <button class="btn btn-primary" data-t-export>Taşıma Paketini İndir</button>
        <p data-export-msg style="font-size:13px"></p>

        <h3 style="margin:22px 0 6px">2 · Yeni editörde paketi yükle</h3>
        <div class="field"><label>Taşıma Paketi dosyası (.seoztasima)</label><input type="file" accept=".seoztasima,application/octet-stream" data-file></div>
        <div class="field"><label>Taşıma şifresi</label><input type="password" data-pw3 autocomplete="off"></div>
        <label style="display:flex;gap:8px;align-items:flex-start;font-size:13px;margin:6px 0 10px">
          <input type="checkbox" data-overwrite> <span>Bu tarayıcıda AYNI davetiyenin farklı bir hâli varsa paketteki sürümü kullan
          (varsayılan: buradaki korunur; her iki durumda da önceki hâl geri alma kaydında saklanır)</span></label>
        <div class="prop-actions" style="justify-content:flex-start;gap:8px">
          <button class="btn btn-outline" data-t-check>Önce Kontrol Et</button>
          <button class="btn btn-primary" data-t-import>Taşı</button>
        </div>
        <pre data-import-msg style="white-space:pre-wrap;font-size:12.5px;background:rgba(0,0,0,.04);padding:10px;border-radius:8px;display:none"></pre>

        <h3 style="margin:22px 0 6px">Geri alma</h3>
        <p data-backup style="font-size:13px"></p>
        <div class="prop-actions" style="justify-content:flex-start;gap:8px">
          <button class="btn btn-outline" data-rollback>Son Taşımayı Geri Al</button>
          <button class="btn btn-outline" data-clear-backup>Taşımayı Onayla (geri alma kaydını sil)</button>
        </div>
        <div class="prop-actions"><button class="btn btn-outline" data-close>Kapat</button></div>
      </div>`;
    document.body.appendChild(ov);
    const $ = s => ov.querySelector(s);
    const out = (txt) => { const p = $("[data-import-msg]"); p.style.display = "block"; p.textContent = txt; };
    const close = () => { ov.remove(); };
    $("[data-close]").addEventListener("click", () => { close(); location.reload(); });

    async function refresh() {
      try { const s = await T.summary(); $("[data-summary]").textContent = countsText(s) + " · yaklaşık " + mb(s.bytes) + (s.eksikGorsel.length ? ` · ⚠ ${s.eksikGorsel.length} görsel bu tarayıcıda zaten yok` : ""); }
      catch (e) { $("[data-summary]").textContent = "Okunamadı: " + e.message; }
      const b = await T.lastBackup().catch(() => null);
      $("[data-backup]").textContent = b ? `Son taşıma: ${new Date(b.tarih).toLocaleString("tr-TR")} · ${b.kayit} kayıt, ${b.gorsel} görsel eklendi. İsterseniz tamamen geri alabilirsiniz.` : "Geri alınacak bir taşıma yok.";
      $("[data-rollback]").disabled = !b; $("[data-clear-backup]").disabled = !b;
    }
    refresh();

    $("[data-t-export]").addEventListener("click", async () => {
      const p1 = $("[data-pw1]").value, p2 = $("[data-pw2]").value, msg = $("[data-export-msg]");
      if (p1 !== p2) { msg.textContent = "Şifreler aynı değil."; return; }
      try {
        const r = await T.exportPackage(p1, t => { msg.textContent = t; });
        const a = document.createElement("a"); a.href = URL.createObjectURL(r.blob); a.download = r.filename; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 60000);
        msg.innerHTML = `✓ <b>${esc(r.filename)}</b> indirildi (${mb(r.bytes)}). Bu editördeki hiçbir şey değişmedi.<br>⚠ Dosyada müşteri panel anahtarları var: kimseyle paylaşmayın, taşıma bitince silin.`;
      } catch (e) { msg.textContent = "İndirilemedi: " + e.message; }
    });

    function show(r) {
      const lines = [
        `Paket: ${r.kaynak} · ${new Date(r.olusturma).toLocaleString("tr-TR")}`,
        countsText(r.paket),
        `Eklenecek/güncellenecek kayıt: ${r.yazilacak} · zaten aynı: ${r.ayni}`,
        `Yeni görsel: ${r.gorselYeni} · zaten var: ${r.gorselAyni}`,
        r.cakisan.length ? `Çakışan (bu tarayıcıdaki korundu): ${r.cakisan.length}\n  ${r.cakisan.slice(0, 8).join("\n  ")}` : "Çakışma yok.",
        r.gorselCakisan.length ? `Çakışan görsel (korundu): ${r.gorselCakisan.length}` : "",
        r.eksikGorsel.length ? `Not: ${r.eksikGorsel.length} görsel eski editörde de yoktu (taşıma kaynaklı değil).` : "",
        `Doğrulama: ${Array.isArray(r.dogrulama) ? "SORUN → " + r.dogrulama.join(", ") : r.dogrulama}`
      ].filter(Boolean);
      out(lines.join("\n"));
    }
    async function run(dry) {
      const f = $("[data-file]").files[0];
      if (!f) { out("Önce Taşıma Paketi dosyasını seçin."); return; }
      out(dry ? "Kontrol ediliyor (hiçbir şey yazılmaz)..." : "Taşınıyor...");
      try {
        const r = await T.importPackage(f, $("[data-pw3]").value, { dryRun: dry, overwrite: $("[data-overwrite]").checked });
        show(r);
        if (!dry) { await refresh(); out($("[data-import-msg]").textContent + "\n\n✓ Taşıma tamamlandı. Davetiyelerinizi açıp kontrol edin; sorun görürseniz \"Son Taşımayı Geri Al\"."); }
      } catch (e) { out("✗ " + e.message); }
    }
    $("[data-t-check]").addEventListener("click", () => run(true));
    $("[data-t-import]").addEventListener("click", () => run(false));
    $("[data-rollback]").addEventListener("click", async () => {
      if (!global.confirm("Son taşıma tamamen geri alınsın mı? Taşımayla eklenen taslaklar ve görseller bu tarayıcıdan kaldırılır (eski editör ve yayındaki davetiyeler etkilenmez).")) return;
      try { const r = await T.rollback(); out(`✓ Geri alındı: ${r.geriAlinanKayit} kayıt eski hâline döndü, ${r.silinenGorsel} görsel kaldırıldı.`); await refresh(); }
      catch (e) { out("✗ " + e.message); }
    });
    $("[data-clear-backup]").addEventListener("click", async () => {
      if (!global.confirm("Taşıma onaylansın mı? Geri alma kaydı silinir; taşınan veriler kalır.")) return;
      await T.clearBackup(); out("✓ Taşıma onaylandı."); await refresh();
    });
  }
  global.SeozTasimaPanel = { open };
})(window);
