/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — editor/poll-panel.js  (YENİ — ANKET ÖZEL PANELİ)
   -----------------------------------------------------------------------------
   Anket modülünün ayarları (sınırsız soru, her soruda serbest sayıda ve
   metinli seçenek, sıralama) genel module-panel.js'in basit alan-tabanlı
   şemasına sığmadığı için — tıpkı entry-panel.js gibi — kendi özel
   panelini kullanır. Diğer HİÇBİR modülün paneli bundan etkilenmez.
   render(containerEl, layer, cb) imzası, projedeki diğer panellerle
   (text-panel.js, image-panel.js, module-panel.js) AYNI kalıba uyar.
   ========================================================================= */

(function (global) {
  "use strict";

  function uid(prefix) {
    return prefix + "_" + Math.random().toString(36).slice(2, 9);
  }

  function render(containerEl, layer, cb) {
    const s = layer.settings;
    // Geriye dönük güvenlik: eski/eksik bir kayıt varsa alanları tamamla.
    if (!s.questions || !s.questions.length) {
      s.questions = [{ id: uid("q"), text: "", options: [{ id: uid("o"), text: "" }, { id: uid("o"), text: "" }] }];
    }
    if (s.collectName == null) s.collectName = "off";
    if (s.submitButtonText == null) s.submitButtonText = "Gönder";
    // Yanıt yöntemi: eski kayıtlarda alan yoktur; poll.js'teki AYNI kural
    // ile türetilir (pollFormUrl doluysa Google Form, değilse "yok").
    const pollDef = global.SeozModuleRegistry && global.SeozModuleRegistry.getModule("poll");
    const method = pollDef && pollDef.getResponseMethod ? pollDef.getResponseMethod(s) : (s.pollFormUrl ? "google-form" : "none");

    containerEl.innerHTML = `
      <div class="field">
        <label>Anket Başlığı</label>
        <input type="text" data-poll-title value="${escAttr(s.title || "")}">
      </div>
      <div class="field" style="margin-top:10px;">
        <label>Açıklama</label>
        <textarea data-poll-desc rows="2">${escHtml(s.description || "")}</textarea>
      </div>

      <div class="field" style="margin-top:16px;padding-top:14px;border-top:1px dashed var(--line);">
        <label>Sorular</label>
        <div data-poll-questions></div>
        <button type="button" class="btn btn-outline" data-add-question style="width:100%;margin-top:8px;">+ Soru Ekle</button>
      </div>

      <div class="field" style="margin-top:16px;padding-top:14px;border-top:1px dashed var(--line);">
        <label>Görüş Alanları</label>
        <p style="font-size:.72rem;color:var(--ink-soft);margin-bottom:8px;">
          Katılımcının serbestçe yazabileceği yazı kutuları. Zorunlu değildir;
          sorulardan sonra gösterilir.
        </p>
        <div data-poll-comments></div>
        <button type="button" class="btn btn-outline" data-add-comment style="width:100%;margin-top:8px;">+ Görüş Alanı Ekle</button>
      </div>

      <div class="field" style="margin-top:16px;padding-top:14px;border-top:1px dashed var(--line);">
        <label>Katılımcı Adı</label>
        <select data-poll-collect-name>
          <option value="off" ${s.collectName === "off" ? "selected" : ""}>İstenmesin (anonim)</option>
          <option value="optional" ${s.collectName === "optional" ? "selected" : ""}>İsteğe bağlı</option>
          <option value="required" ${s.collectName === "required" ? "selected" : ""}>Zorunlu</option>
        </select>
      </div>

      <div class="field" style="margin-top:10px;">
        <label>Gönder Butonu Yazısı</label>
        <input type="text" data-poll-submit-text value="${escAttr(s.submitButtonText)}">
      </div>

      <div class="field" style="margin-top:16px;padding-top:14px;border-top:1px dashed var(--line);">
        <label>Yanıt Yöntemi</label>
        <select data-poll-method>
          <option value="google-form" ${method === "google-form" ? "selected" : ""}>Google Form (müşterinin kendi formu)</option>
          <option value="whatsapp" ${method === "whatsapp" ? "selected" : ""}>WhatsApp</option>
          <option value="none" ${method === "none" ? "selected" : ""}>Gönderim yok (yalnızca görünüm)</option>
          <option value="seoz" disabled>Studio SEOZ sistemi (yakında)</option>
        </select>
        <p style="font-size:.72rem;color:var(--ink-soft);margin-top:6px;">
          Google Form ve WhatsApp yöntemlerinde yanıtlar doğrudan müşteriye
          gider; Studio SEOZ'a hiçbir veri gelmez.
        </p>
      </div>

      <div class="field" data-method-block="google-form" style="margin-top:10px;${method === "google-form" ? "" : "display:none;"}">
        <p style="font-size:.72rem;color:var(--ink-soft);margin-bottom:8px;">
          Bu bağlantı yalnızca ANKET içindir — RSVP, Konum, Anı Yükle veya
          Müzik bağlantılarıyla hiçbir şekilde paylaşılmaz.
        </p>
        <label style="display:block;margin-bottom:4px;font-size:.76rem;">Google Form Bağlantısı</label>
        <input type="url" data-poll-form-url placeholder="https://docs.google.com/forms/d/e/.../viewform" value="${escAttr(s.pollFormUrl || "")}">
        <label style="display:block;margin:8px 0 4px;font-size:.76rem;">Cevap Özeti Alan Kimliği (entry.XXXXXXX)</label>
        <input type="text" data-poll-field-id placeholder="entry.123456789" value="${escAttr(s.pollFormFieldId || "")}">
        <label style="display:block;margin:8px 0 4px;font-size:.76rem;">Ad Soyad Alan Kimliği (isteğe bağlı, entry.XXXXXXX)</label>
        <input type="text" data-poll-name-field-id placeholder="entry.987654321" value="${escAttr(s.pollFormNameFieldId || "")}">
        <p style="font-size:.72rem;color:var(--ink-soft);margin-top:8px;">
          Alan kimliklerini bulmak için Google Form'unuzu önizlemede açıp
          "Sayfa Kaynağını Görüntüle"den "entry." ile başlayan numaraları
          kopyalayabilirsiniz. Görüş alanlarına yazılanlar cevap özetinin
          sonuna eklenir.
        </p>
      </div>

      <div class="field" data-method-block="whatsapp" style="margin-top:10px;${method === "whatsapp" ? "" : "display:none;"}">
        <label style="display:block;margin-bottom:4px;font-size:.76rem;">WhatsApp Numarası (ülke koduyla, ör. 905551112233)</label>
        <input type="tel" data-poll-wa-number placeholder="905551112233" value="${escAttr(s.pollWhatsappNumber || "")}">
        <p style="font-size:.72rem;color:var(--ink-soft);margin-top:8px;">
          Katılımcı Gönder'e bastığında yanıtları hazır yazılmış bir mesajla
          WhatsApp açılır; mesajı katılımcı kendisi gönderir. Bu numara
          yalnızca ankete aittir, RSVP numarasıyla paylaşılmaz. Küçük gruplar
          için uygundur — yanıtlar tek bir listede toplanmaz.
        </p>
      </div>

      <div class="field" data-method-block="none" style="margin-top:10px;${method === "none" ? "" : "display:none;"}">
        <p style="font-size:.72rem;color:#b3452c;">
          Bu yöntemde katılımcıya teşekkür mesajı gösterilir ama yanıtlar
          hiçbir yere kaydedilmez.
        </p>
      </div>

      <div class="field" style="margin-top:16px;padding-top:14px;border-top:1px dashed var(--line);">
        <label>Yazı Rengi</label>
        <input type="color" data-poll-text-color value="${s.textColor || "#1E2A22"}" style="height:37px;padding:2px;">
      </div>
      <div class="field" style="margin-top:10px;">
        <label>Buton/Seçenek Rengi</label>
        <input type="color" data-poll-btn-color value="${s.buttonColor || "#93703F"}" style="height:37px;padding:2px;">
      </div>
      <div class="field" style="margin-top:10px;">
        <label>Buton Metalik Efekti (seçili şık ve Gönder)</label>
        <select data-poll-metallic>
          ${[["none","Yok"],["gold","Altın (Koyu Zemin)"],["silver","Gümüş (Koyu Zemin)"],["copper-gold","Bakır Altın (Açık Zemin)"],["dark-silver","Koyu Gümüş (Açık Zemin)"],["copper","Bakır"]]
            .map(([v, l]) => `<option value="${v}" ${(s.metallic || "none") === v ? "selected" : ""}>${l}</option>`).join("")}
        </select>
      </div>
      <div class="field" style="margin-top:10px;">
        <label>Yazı Boyutu</label>
        <div class="numeric-with-unit">
          <input type="number" data-poll-font-size value="${s.fontSize || 16}" min="10" max="32">
          <span>px</span>
        </div>
      </div>

      <div class="layer-actions" style="margin-top:16px;">
        <button type="button" class="btn-icon" data-bring-front title="Öne getir">⬆</button>
        <button type="button" class="btn-icon" data-send-back title="Arkaya gönder">⬇</button>
        <button type="button" class="btn-icon" data-duplicate title="Çoğalt">⧉</button>
        <button type="button" class="btn-icon btn-danger" data-delete title="Sil">🗑</button>
      </div>
    `;

    renderQuestions();
    renderComments();

    containerEl.querySelector("[data-poll-title]").addEventListener("input", (e) => {
      s.title = e.target.value; cb.onSettingsChange();
    });
    containerEl.querySelector("[data-poll-desc]").addEventListener("input", (e) => {
      s.description = e.target.value; cb.onSettingsChange();
    });
    containerEl.querySelector("[data-poll-collect-name]").addEventListener("change", (e) => {
      s.collectName = e.target.value; cb.onSettingsChange();
    });
    containerEl.querySelector("[data-poll-submit-text]").addEventListener("input", (e) => {
      s.submitButtonText = e.target.value; cb.onSettingsChange();
    });
    containerEl.querySelector("[data-poll-method]").addEventListener("change", (e) => {
      s.responseMethod = e.target.value;
      containerEl.querySelectorAll("[data-method-block]").forEach(b => {
        b.style.display = b.getAttribute("data-method-block") === s.responseMethod ? "" : "none";
      });
      cb.onSettingsChange();
    });
    containerEl.querySelector("[data-poll-wa-number]").addEventListener("input", (e) => {
      s.pollWhatsappNumber = e.target.value; cb.onSettingsChange();
    });
    containerEl.querySelector("[data-poll-form-url]").addEventListener("input", (e) => {
      s.pollFormUrl = e.target.value; cb.onSettingsChange();
    });
    containerEl.querySelector("[data-poll-field-id]").addEventListener("input", (e) => {
      s.pollFormFieldId = e.target.value; cb.onSettingsChange();
    });
    containerEl.querySelector("[data-poll-name-field-id]").addEventListener("input", (e) => {
      s.pollFormNameFieldId = e.target.value; cb.onSettingsChange();
    });
    containerEl.querySelector("[data-poll-text-color]").addEventListener("input", (e) => {
      s.textColor = e.target.value; cb.onSettingsChange();
    });
    containerEl.querySelector("[data-poll-metallic]").addEventListener("change", (e) => {
      s.metallic = e.target.value; cb.onSettingsChange();
    });
    containerEl.querySelector("[data-poll-btn-color]").addEventListener("input", (e) => {
      s.buttonColor = e.target.value; cb.onSettingsChange();
    });
    containerEl.querySelector("[data-poll-font-size]").addEventListener("input", (e) => {
      s.fontSize = parseInt(e.target.value, 10) || 16; cb.onSettingsChange();
    });

    containerEl.querySelector("[data-add-question]").addEventListener("click", () => {
      s.questions.push({ id: uid("q"), text: "", options: [{ id: uid("o"), text: "" }, { id: uid("o"), text: "" }] });
      renderQuestions();
      cb.onSettingsChange();
    });

    containerEl.querySelector("[data-add-comment]").addEventListener("click", () => {
      // Dizi yalnızca ilk görüş alanı eklenirken oluşturulur — eski
      // kayıtlar, kullanıcı bu butona basmadıkça hiç değişmez.
      if (!Array.isArray(s.commentFields)) s.commentFields = [];
      s.commentFields.push({
        id: uid("c"),
        title: "Görüş, Fikir ve Önerileriniz",
        placeholder: "Eklemek istediğiniz görüş, fikir veya önerinizi buraya yazabilirsiniz."
      });
      renderComments();
      cb.onSettingsChange();
    });

    containerEl.querySelector("[data-bring-front]").addEventListener("click", cb.onBringFront);
    containerEl.querySelector("[data-send-back]").addEventListener("click", cb.onSendBack);
    containerEl.querySelector("[data-duplicate]").addEventListener("click", cb.onDuplicate);
    containerEl.querySelector("[data-delete]").addEventListener("click", cb.onDelete);

    // Sorular ve seçenekler: her değişiklikte tam listeyi yeniden çizer
    // (basit ve güvenilir — soru/seçenek sayısı büyük değerlere ulaşmaz).
    function renderQuestions() {
      const host = containerEl.querySelector("[data-poll-questions]");
      host.innerHTML = s.questions.map((q, qi) => `
        <div class="poll-question-block" style="border:1px solid var(--line);border-radius:6px;padding:10px;margin-top:${qi === 0 ? 0 : 10}px;">
          <div style="display:flex;gap:6px;align-items:center;">
            <input type="text" data-q-text="${q.id}" placeholder="Soru metni" value="${escAttr(q.text || "")}" style="flex:1;">
            <button type="button" data-q-up="${q.id}" class="btn-icon" title="Yukarı taşı" ${qi === 0 ? "disabled" : ""}>↑</button>
            <button type="button" data-q-down="${q.id}" class="btn-icon" title="Aşağı taşı" ${qi === s.questions.length - 1 ? "disabled" : ""}>↓</button>
            <button type="button" data-q-remove="${q.id}" class="btn-icon btn-danger" title="Soruyu sil" ${s.questions.length <= 1 ? "disabled" : ""}>🗑</button>
          </div>
          <div style="margin-top:8px;display:flex;flex-direction:column;gap:6px;">
            ${(q.options || []).map(o => `
              <div style="display:flex;gap:6px;align-items:center;">
                <input type="text" data-o-text="${q.id}::${o.id}" placeholder="Seçenek metni" value="${escAttr(o.text || "")}" style="flex:1;">
                <button type="button" data-o-remove="${q.id}::${o.id}" class="btn-icon btn-danger" title="Seçeneği sil" ${(q.options || []).length <= 2 ? "disabled" : ""}>✕</button>
              </div>
            `).join("")}
          </div>
          <button type="button" data-add-option="${q.id}" class="btn btn-outline" style="width:100%;margin-top:8px;font-size:.78rem;padding:6px;">+ Seçenek Ekle</button>
        </div>
      `).join("");

      s.questions.forEach(q => {
        host.querySelector(`[data-q-text="${q.id}"]`).addEventListener("input", (e) => {
          q.text = e.target.value; cb.onSettingsChange();
        });
        const upBtn = host.querySelector(`[data-q-up="${q.id}"]`);
        if (upBtn && !upBtn.disabled) upBtn.addEventListener("click", () => { moveQuestion(q.id, -1); });
        const downBtn = host.querySelector(`[data-q-down="${q.id}"]`);
        if (downBtn && !downBtn.disabled) downBtn.addEventListener("click", () => { moveQuestion(q.id, 1); });
        const removeBtn = host.querySelector(`[data-q-remove="${q.id}"]`);
        if (removeBtn && !removeBtn.disabled) removeBtn.addEventListener("click", () => {
          s.questions = s.questions.filter(x => x.id !== q.id);
          renderQuestions(); cb.onSettingsChange();
        });
        host.querySelector(`[data-add-option="${q.id}"]`).addEventListener("click", () => {
          q.options.push({ id: uid("o"), text: "" });
          renderQuestions(); cb.onSettingsChange();
        });
        (q.options || []).forEach(o => {
          const key = `${q.id}::${o.id}`;
          host.querySelector(`[data-o-text="${key}"]`).addEventListener("input", (e) => {
            o.text = e.target.value; cb.onSettingsChange();
          });
          const oRemove = host.querySelector(`[data-o-remove="${key}"]`);
          if (oRemove && !oRemove.disabled) oRemove.addEventListener("click", () => {
            q.options = q.options.filter(x => x.id !== o.id);
            renderQuestions(); cb.onSettingsChange();
          });
        });
      });
    }

    // Görüş alanları: başlık düzenleme + silme. Şıklı sorulardan bağımsız.
    function renderComments() {
      const host = containerEl.querySelector("[data-poll-comments]");
      const list = Array.isArray(s.commentFields) ? s.commentFields : [];
      host.innerHTML = list.map((c, ci) => `
        <div class="poll-comment-block" style="border:1px solid var(--line);border-radius:6px;padding:10px;margin-top:${ci === 0 ? 0 : 10}px;">
          <div style="display:flex;gap:6px;align-items:center;">
            <input type="text" data-c-title="${c.id}" placeholder="Görüş alanı başlığı" value="${escAttr(c.title || "")}" style="flex:1;">
            <button type="button" data-c-remove="${c.id}" class="btn-icon btn-danger" title="Görüş alanını sil">🗑</button>
          </div>
          <p style="font-size:.72rem;color:var(--ink-soft);margin-top:6px;">Yazı kutusu (isteğe bağlı)</p>
        </div>
      `).join("");

      list.forEach(c => {
        host.querySelector(`[data-c-title="${c.id}"]`).addEventListener("input", (e) => {
          c.title = e.target.value; cb.onSettingsChange();
        });
        host.querySelector(`[data-c-remove="${c.id}"]`).addEventListener("click", () => {
          s.commentFields = s.commentFields.filter(x => x.id !== c.id);
          renderComments(); cb.onSettingsChange();
        });
      });
    }

    function moveQuestion(id, dir) {
      const idx = s.questions.findIndex(q => q.id === id);
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= s.questions.length) return;
      const tmp = s.questions[idx];
      s.questions[idx] = s.questions[newIdx];
      s.questions[newIdx] = tmp;
      renderQuestions();
      cb.onSettingsChange();
    }
  }

  function escHtml(str) {
    return String(str || "").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  }
  function escAttr(str) {
    return String(str || "").replace(/"/g, "&quot;");
  }

  global.SeozPollPanel = { render };
})(window);
