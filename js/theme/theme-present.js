/* =============================================================================
   STUDIO SEOZ — theme/theme-present.js  (İç Zemin · MODÜL SUNUM BİÇİMLERİ)
   -----------------------------------------------------------------------------
   Bir modülün (veya herhangi bir katmanın) NASIL SUNULDUĞUNU değiştirir;
   modülün işini (kaydetme, müzik çalma, form gönderme…) asla yeniden yazmaz.

   layer.present = {
     frame:   ""|"bilet"|"kartpostal"|"polaroid"|"cam"|"parsomen"|"tabela"|"altin"|"isikli",
     open:    ""|"cevir"|"kapak"|"zarf",      // açılış etkileşimi (müşteri görünümünde)
     special: ""|"plak"|"kaset"|"dalga"|"cevirmeli"|"kumsaati"|"takvim"|
              "polaroid-yigin"|"film"|"vitrin"|"harita"|"pusula",
     title:   "Kapak yazısı"                   // çevrilen kart / kapak / zarf üzerinde
   }
   - Çerçeveler katmanın DIŞINA çizilir (kutunun ölçüsü ve içerik aynı kalır).
   - Özel biçimler modülün verisini başka biçimde gösterir; tıklama gibi
     işler modülün kendi düğmesine iletilir (ör. plağa dokununca müzik
     modülünün kendi oynat düğmesi çalışır).
   ========================================================================= */
(function (global) {
  "use strict";

  const FRAMES = [["", "Yok (bugünkü görünüm)"], ["bilet", "Bilet"], ["kartpostal", "Kartpostal"], ["polaroid", "Polaroid"], ["cam", "Cam panel"],
    ["parsomen", "Parşömen"], ["tabela", "Ahşap tabela"], ["altin", "Altın çerçeve"], ["isikli", "Işıklı tabela"]];
  const OPENS = [["", "Yok"], ["cevir", "Dokununca dönen kart"], ["kapak", "Kayınca açılan kapak"], ["zarf", "Küçük zarf (dokununca açılır)"]];
  const SPECIALS = {
    music: [["plak", "Plak çalar"], ["kaset", "Kaset"], ["dalga", "Ses dalgası"]],
    countdown: [["cevirmeli", "Çevirmeli saat"], ["kumsaati", "Kum saati"], ["takvim", "Takvim yaprağı"]],
    gallery: [["polaroid-yigin", "Polaroid yığını"], ["film", "Film şeridi"], ["vitrin", "3D dönen vitrin"]],
    location: [["harita", "Harita kartpostalı"], ["pusula", "Pusula"]],
    "attendance-form": [["zarf-form", "Zarf (açılınca form)"]]
  };
  const SIZE = { plak: { w: 170, h: 170 }, kaset: { w: 220, h: 140 }, dalga: { w: 220, h: 90 }, cevirmeli: { w: 330, h: 130 }, kumsaati: { w: 300, h: 170 }, takvim: { w: 200, h: 210 },
    "polaroid-yigin": { w: 300, h: 300 }, film: { w: 380, h: 170 }, vitrin: { w: 360, h: 260 }, harita: { w: 340, h: 200 }, pusula: { w: 300, h: 150 } };

  function el(tag, cls, css, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (css) Object.assign(e.style, css); if (html != null) e.innerHTML = html; return e; }
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const reduced = () => !!(global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches);

  /* önceki sunumu söker: kabuktaki asıl içerik kutusu katmana geri döner */
  function reset(wrap) {
    const host = wrap.querySelector(".seoz-module-content, .seoz-image-content, .seoz-text-content");
    const shellHost = wrap.querySelector(":scope > .tp-flipper .seoz-module-content, :scope > .tp-flipper .seoz-text-content");
    Array.from(wrap.children).forEach(ch => {
      if (ch.classList.contains("tp-flipper")) {
        const h = ch.querySelector(".tp-back > *");
        if (h) { h.classList.remove("tp-hidden"); wrap.insertBefore(h, ch); }
      }
    });
    wrap.querySelectorAll(":scope > .tp-deco, :scope > .tp-shell, :scope > .tp-flipper, :scope > .tp-cover, :scope > .tp-env, :scope > .tp-badge").forEach(n => {
      n.querySelectorAll("[data-interval-id]").forEach(x => clearInterval(Number(x.dataset.intervalId)));
      if (n.__cleanup) n.__cleanup();
      n.remove();
    });
    Array.from(wrap.classList).filter(c => c.indexOf("tp-") === 0).forEach(c => wrap.classList.remove(c));
    const h2 = host || shellHost;
    if (h2) { h2.classList.remove("tp-hidden"); h2.style.removeProperty("visibility"); }
    return h2;
  }

  function apply(wrap, layer, mode) {
    const host = reset(wrap);
    const p = normalize(layer.present);
    if (!p || !host) return;
    const handle = wrap.querySelector(":scope > .resize-handle");
    const before = handle || null;

    if (p.frame) {
      wrap.classList.add("tp-f", "tp-f-" + p.frame);
      const deco = el("div", "tp-deco tp-deco-" + p.frame);
      if (p.frame === "kartpostal") deco.innerHTML = `<span class="tp-stamp"></span><span class="tp-postmark"></span>`;
      if (p.frame === "isikli") deco.innerHTML = Array.from({ length: 22 }, (_, i) => `<i style="--i:${i}"></i>`).join("");
      wrap.insertBefore(deco, wrap.firstChild);
    }
    const sp = p.special && SPECIAL_BUILD[p.special];
    if (sp) {
      wrap.classList.add("tp-sp", "tp-sp-" + p.special);
      const shell = sp(layer, host, mode);
      if (shell) wrap.insertBefore(shell, before);
    }
    if (p.open) applyOpen(wrap, layer, host, p, mode, before);
  }

  /* ----------------------------- açılış etkileşimleri ----------------------------- */
  function moduleLabel(layer) {
    const m = layer.type === "module" && global.SeozModuleRegistry ? SeozModuleRegistry.getModule(layer.moduleId) : null;
    return m ? m.label : "";
  }
  const ICON = { location: "⌖", music: "♪", countdown: "⏳", gallery: "▦", "attendance-form": "✉", rsvp: "✉", gift: "🎁", calendar: "📅", appointment: "🗓", services: "✦", "price-list": "₺", "before-after": "◐", poll: "?", feedback: "✎", "social-media": "@", qrcode: "▣", celebration: "✶", "guest-upload": "⇪" };
  function coverHTML(layer, p, hint) {
    return `<span class="tp-cv-orn">✦</span><span class="tp-cv-ic">${esc(ICON[layer.moduleId] || "✦")}</span>
      <strong class="tp-cv-t">${esc(p.title || moduleLabel(layer) || "Sürpriz")}</strong><small class="tp-cv-h">${esc(hint)}</small>`;
  }
  function applyOpen(wrap, layer, host, p, mode, before) {
    if (mode !== "view") {
      const b = el("span", "tp-badge", null, { cevir: "↻ Dönen kart", kapak: "▲ Açılan kapak", zarf: "✉ Zarf" }[p.open] || "");
      b.title = "Müşteri sayfasında bu etkileşimle açılır";
      wrap.insertBefore(b, before); return;
    }
    if (p.open === "cevir") {
      wrap.classList.add("tp-o-cevir");
      const flipper = el("div", "tp-flipper"), front = el("button", "tp-face tp-front", null, coverHTML(layer, p, "Çevirmek için dokunun")), back = el("div", "tp-face tp-back");
      front.type = "button"; front.setAttribute("aria-label", (p.title || moduleLabel(layer) || "Kart") + " — çevir");
      wrap.insertBefore(flipper, host); back.appendChild(host); flipper.appendChild(front); flipper.appendChild(back);
      const again = el("button", "tp-flip-back", null, "↺"); again.type = "button"; again.setAttribute("aria-label", "Kartı geri çevir"); back.appendChild(again);
      front.addEventListener("click", e => { e.stopPropagation(); flipper.classList.add("is-flipped"); });
      again.addEventListener("click", e => { e.stopPropagation(); flipper.classList.remove("is-flipped"); });
    } else if (p.open === "kapak") {
      wrap.classList.add("tp-o-kapak");
      const cover = el("div", "tp-cover", null, coverHTML(layer, p, "")); wrap.insertBefore(cover, before);
      const open = () => cover.classList.add("is-open");
      if (reduced() || !global.IntersectionObserver) open();
      else {
        const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { setTimeout(open, 350); io.disconnect(); } }), { threshold: 0.6 });
        io.observe(wrap); cover.__cleanup = () => io.disconnect();
      }
      cover.addEventListener("click", open);
    } else if (p.open === "zarf") {
      wrap.classList.add("tp-o-zarf");
      const env = el("button", "tp-env", null, `<span class="tp-env-body"></span><span class="tp-env-flap"></span><span class="tp-env-seal">✦</span><strong class="tp-env-t">${esc(p.title || moduleLabel(layer) || "Size bir not var")}</strong><small class="tp-env-h">Açmak için dokunun</small>`);
      env.type = "button"; env.setAttribute("aria-label", (p.title || "Zarf") + " — aç");
      wrap.insertBefore(env, before);
      env.addEventListener("click", e => { e.stopPropagation(); env.classList.add("is-open"); setTimeout(() => { env.style.pointerEvents = "none"; }, 50); });
    }
  }

  /* ----------------------------- özel biçimler ----------------------------- */
  function hide(host) { host.classList.add("tp-hidden"); }
  function audioOf(host) { return host.querySelector("audio"); }
  function musicShell(kind) {
    return function (layer, host, mode) {
      if (layer.moduleId !== "music") return null;
      const btn = host.querySelector("button"), audio = audioOf(host);
      hide(host);
      const html = kind === "plak"
        ? `<span class="tp-vinyl"><span class="tp-vinyl-lbl">♪</span></span><span class="tp-arm"></span>`
        : kind === "kaset"
          ? `<span class="tp-cas"><span class="tp-cas-lbl">${esc((layer.present && layer.present.title) || "Bizim şarkımız")}</span><span class="tp-reel"></span><span class="tp-reel tp-reel-r"></span><span class="tp-cas-win"></span></span>`
          : `<span class="tp-wave">${Array.from({ length: 24 }, (_, i) => `<i style="--i:${i}"></i>`).join("")}</span>`;
      const shell = el("button", "tp-shell tp-music tp-" + kind, null, html + `<span class="tp-sr">Müziği aç/kapat</span>`);
      shell.type = "button";
      if (!btn || !audio) shell.classList.add("is-empty");
      shell.addEventListener("click", e => { e.stopPropagation(); if (btn) btn.click(); });
      if (audio) {
        const on = () => shell.classList.add("is-playing"), off = () => shell.classList.remove("is-playing");
        audio.addEventListener("play", on); audio.addEventListener("pause", off); audio.addEventListener("ended", off);
      }
      return shell;
    };
  }
  function remaining(s) {
    const t = new Date((s.targetDate || "2030-01-01") + "T" + (s.targetTime || "00:00") + ":00").getTime();
    let d = Math.max(0, t - Date.now());
    const g = Math.floor(d / 86400000); d -= g * 86400000; const h = Math.floor(d / 3600000); d -= h * 3600000;
    const m = Math.floor(d / 60000); d -= m * 60000; return { g, h, m, s: Math.floor(d / 1000), total: Math.max(0, t - Date.now()) };
  }
  const pad = n => String(n).padStart(2, "0");
  function countdownShell(kind) {
    return function (layer, host) {
      if (layer.moduleId !== "countdown") return null;
      const s = layer.settings || {};
      hide(host);
      const shell = el("div", "tp-shell tp-cd tp-" + kind);
      shell.style.setProperty("--tp-fg", s.textColor || "#2A2420");
      shell.style.fontFamily = `"${s.fontFamily || "Cormorant Garamond"}", serif`;
      const title = s.title ? `<div class="tp-cd-title">${esc(s.title)}</div>` : "";
      if (kind === "cevirmeli") {
        shell.innerHTML = title + `<div class="tp-flipclock">${[["g", "Gün"], ["h", "Saat"], ["m", "Dk"], ["s", "Sn"]].map(([k, l]) => `<div class="tp-fc" data-k="${k}"><span class="tp-fc-card"><b>00</b></span><small>${l}</small></div>`).join("")}</div>`;
      } else if (kind === "kumsaati") {
        shell.innerHTML = title + `<div class="tp-hg-row"><span class="tp-hg"><i class="tp-hg-top"></i><i class="tp-hg-bot"></i><i class="tp-hg-stream"></i></span>
          <div class="tp-hg-n"><b data-k="g">0</b><span>gün</span><small><b data-k="h">00</b>:<b data-k="m">00</b>:<b data-k="s">00</b></small></div></div>`;
      } else {
        shell.innerHTML = `<div class="tp-cal"><div class="tp-cal-top">${esc(s.title || "Geri sayım")}</div><div class="tp-cal-page"><b data-k="g">0</b><span>gün kaldı</span></div><div class="tp-cal-next"></div></div>`;
      }
      let lastG = null;
      function tick() {
        const r = remaining(s);
        shell.querySelectorAll("[data-k]").forEach(n => {
          const k = n.dataset.k, v = k === "g" ? (kind === "cevirmeli" ? pad(r.g) : String(r.g)) : pad(r[k]);
          const target = n.classList.contains("tp-fc") ? n.querySelector("b") : n;
          if (target.textContent !== v) {
            target.textContent = v;
            if (n.classList.contains("tp-fc")) { const c = n.querySelector(".tp-fc-card"); c.classList.remove("is-flip"); void c.offsetWidth; c.classList.add("is-flip"); }
          }
        });
        if (kind === "takvim" && lastG !== null && lastG !== r.g) { const pg = shell.querySelector(".tp-cal-next"); pg.classList.remove("is-tear"); void pg.offsetWidth; pg.classList.add("is-tear"); }
        lastG = r.g;
        if (kind === "kumsaati") shell.style.setProperty("--tp-sand", String(Math.min(1, (r.total / 86400000) / 100)));
      }
      tick();
      shell.dataset.intervalId = String(setInterval(tick, 1000));
      return shell;
    };
  }
  function imagesOf(layer) { return ((layer.settings && layer.settings.images) || []).map(x => x && x.ref).filter(Boolean); }
  function resolveInto(img, ref) { if (global.SeozBlobStore) SeozBlobStore.resolveToObjectURL(ref).then(u => { if (u) img.src = u; }); else img.src = ref; }
  function galleryShell(kind) {
    return function (layer, host, mode) {
      if (layer.moduleId !== "gallery") return null;
      const refs = imagesOf(layer);
      hide(host);
      const shell = el("div", "tp-shell tp-gal tp-" + kind);
      if (!refs.length) { shell.innerHTML = `<p class="tp-empty">Galeriye fotoğraf ekleyin</p>`; return shell; }
      if (kind === "polaroid-yigin") {
        const stack = el("button", "tp-pstack"); stack.type = "button"; stack.setAttribute("aria-label", "Sonraki fotoğraf");
        refs.slice(0, 12).forEach((r, i) => {
          const card = el("span", "tp-pol", { zIndex: String(100 - i) });
          card.style.setProperty("--r", `${((i * 37) % 17) - 8}deg`);
          const im = el("img"); im.alt = ""; resolveInto(im, r); card.appendChild(im); stack.appendChild(card);
        });
        stack.addEventListener("click", e => {
          e.stopPropagation();
          const cards = Array.from(stack.children).sort((a, b) => Number(b.style.zIndex) - Number(a.style.zIndex));
          const top = cards[0]; top.classList.add("is-out");
          setTimeout(() => { top.classList.remove("is-out"); top.style.zIndex = String(Number(cards[cards.length - 1].style.zIndex) - 1); }, 420);
        });
        shell.appendChild(stack);
        shell.appendChild(el("small", "tp-gal-h", null, "Dokununca sıradaki fotoğraf"));
      } else if (kind === "film") {
        const strip = el("div", "tp-film-strip"), track = el("div", "tp-film-track");
        const list = refs.concat(refs.length < 6 ? refs : []);
        list.concat(list).forEach(r => { const f = el("span", "tp-film-fr"), im = el("img"); im.alt = ""; resolveInto(im, r); f.appendChild(im); track.appendChild(f); });
        track.style.setProperty("--n", String(list.length)); strip.appendChild(track); shell.appendChild(strip);
      } else {
        const n = Math.min(10, Math.max(3, refs.length)), ring = el("div", "tp-ring");
        ring.style.setProperty("--n", String(n));
        for (let i = 0; i < n; i++) { const f = el("span", "tp-ring-f"); f.style.setProperty("--i", String(i)); const im = el("img"); im.alt = ""; resolveInto(im, refs[i % refs.length]); f.appendChild(im); ring.appendChild(f); }
        const stage = el("div", "tp-ring-stage"); stage.appendChild(ring); shell.appendChild(stage);
      }
      return shell;
    };
  }
  function locationShell(kind) {
    return function (layer, host) {
      if (layer.moduleId !== "location") return null;
      const shell = el("div", "tp-shell tp-loc tp-" + kind);
      if (kind === "harita") shell.innerHTML = `<span class="tp-map"><i class="tp-map-pin"></i></span><span class="tp-stamp"></span>`;
      else shell.innerHTML = `<span class="tp-compass"><i class="tp-needle"></i><b>K</b></span>`;
      return shell;     // modülün kendi içeriği (mekân adı + Konumu Gör düğmesi) yanında görünür kalır
    };
  }
  function attendanceEnvelope(layer, host, mode) {
    // zarf biçimi = "zarf" açılış etkileşimi + bilet çerçevesi
    return null;
  }
  const SPECIAL_BUILD = {
    plak: musicShell("plak"), kaset: musicShell("kaset"), dalga: musicShell("dalga"),
    cevirmeli: countdownShell("cevirmeli"), kumsaati: countdownShell("kumsaati"), takvim: countdownShell("takvim"),
    "polaroid-yigin": galleryShell("polaroid-yigin"), film: galleryShell("film"), vitrin: galleryShell("vitrin"),
    harita: locationShell("harita"), pusula: locationShell("pusula"), "zarf-form": attendanceEnvelope
  };

  /* Panel için: bir katmana uygun seçenekler */
  function optionsFor(layer) {
    return { frames: FRAMES, opens: OPENS, specials: (layer.type === "module" && SPECIALS[layer.moduleId]) || [] };
  }
  /* "zarf-form" gibi birleşik seçimleri açılış + çerçeve ayarına çevirir */
  function normalize(p) {
    if (p && p.special === "zarf-form") return Object.assign({}, p, { special: "", open: "zarf", frame: p.frame || "bilet" });
    return p;
  }

  global.SeozThemePresent = { apply, reset, optionsFor, normalize, FRAMES, OPENS, SPECIALS, SIZE };
})(window);
