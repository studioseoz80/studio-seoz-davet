/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — cinema-guides.js (yalnızca editör)
   -----------------------------------------------------------------------------
   Açılış modellerinin KATMAN REHBERLERİNİ üretir. Rehberler ayrı dosya olarak
   saklanmaz; her seferinde modelin kendi katman tanımından (slots) çizilir.
   Böylece kod ile rehber hiçbir zaman birbirinden kopmaz.

   Rehber görseli, tasarımcının çizim programında EN ÜSTE koyup altına
   çizdiği yardımcı katmandır; dışa aktarmadan önce gizlenir.
   Ölçek: sahne 400×700 mantıksal birimdir, rehberler bunun 3 katıdır.
   ========================================================================= */

(function (global) {
  "use strict";

  const SCALE = 3;
  const RED = "#D7263D", BLUE = "#1F6FEB", GRAY = "rgba(80,80,80,.55)", INK = "#1E1E1E";
  const ALPHA_TEXT = {
    required: "Saydam zeminli PNG ŞART",
    recommended: "Saydam zeminli PNG önerilir",
    no: "PNG veya JPG (saydamlık gerekmez)"
  };

  function sizeOf(model, slot) {
    if (slot.backdrop) return (slot.guide && slot.guide.size) || [1024, 2048];
    const b = slot.box || { w: 400, h: 700 };
    return [Math.round(b.w * SCALE), Math.round(b.h * SCALE)];
  }

  function wrapText(ctx, text, maxW) {
    const words = String(text || "").split(/\s+/), lines = [];
    let line = "";
    words.forEach(w => {
      const t = line ? line + " " + w : w;
      if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
    });
    if (line) lines.push(line);
    return lines;
  }

  function label(ctx, text, x, y, o) {
    o = o || {};
    ctx.save();
    ctx.font = `${o.weight || 700} ${o.size || 22}px Manrope, system-ui, sans-serif`;
    const w = ctx.measureText(text).width, pad = o.pad != null ? o.pad : 8;
    const hh = (o.size || 22) + pad * 1.4;
    let lx = o.align === "center" ? x - w / 2 - pad : x;
    ctx.fillStyle = o.bg || "rgba(255,255,255,.92)";
    ctx.fillRect(lx, y - hh / 2, w + pad * 2, hh);
    ctx.fillStyle = o.color || INK;
    ctx.textBaseline = "middle";
    ctx.fillText(text, lx + pad, y + 1);
    ctx.restore();
  }

  function hatch(ctx, x, y, w, h, color, soft) {
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = soft ? "rgba(31,111,235,.07)" : "rgba(215,38,61,.10)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = color; ctx.globalAlpha = soft ? 0.35 : 0.55; ctx.lineWidth = 2;
    for (let i = -h; i < w + h; i += 26) { ctx.beginPath(); ctx.moveTo(x + i, y); ctx.lineTo(x + i + h, y + h); ctx.stroke(); }
    ctx.restore();
    ctx.save(); ctx.setLineDash([14, 10]); ctx.lineWidth = 3; ctx.strokeStyle = color; ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3); ctx.restore();
  }

  function infoBlock(ctx, model, slot, W, H, o) {
    const g = slot.guide || {};
    const [pw, ph] = sizeOf(model, slot);
    const maxW = Math.min(W - 40, 560);
    const fs = Math.max(15, Math.min(24, Math.round(W / 22)));
    ctx.save();
    ctx.font = `600 ${fs}px Manrope, system-ui, sans-serif`;
    const raw = [
      { t: slot.label, s: fs + 8, w: 800 },
      { t: `${(o && o.file) || g.file || slot.id}.png  ·  ${pw} × ${ph} px`, s: fs, w: 700, c: BLUE },
      { t: ALPHA_TEXT[g.alpha || "recommended"], s: fs, w: 700, c: g.alpha === "required" ? RED : INK },
      { t: g.note || "", s: fs - 2, w: 500 }
    ];
    const lines = [];
    raw.forEach(l => {
      ctx.font = `${l.w} ${l.s}px Manrope, system-ui, sans-serif`;
      wrapText(ctx, l.t, maxW - 32).forEach(t => lines.push(Object.assign({}, l, { t })));
    });
    const lh = l => l.s * 1.45;
    const boxH = lines.reduce((a, l) => a + lh(l), 0) + 28;
    const bx = (W - maxW) / 2, by = o && o.y != null ? o.y : Math.max(20, (H - boxH) / 2);
    ctx.fillStyle = "rgba(255,255,255,.93)"; ctx.fillRect(bx, by, maxW, boxH);
    ctx.strokeStyle = "rgba(0,0,0,.25)"; ctx.lineWidth = 2; ctx.strokeRect(bx, by, maxW, boxH);
    let yy = by + 14;
    lines.forEach(l => {
      ctx.font = `${l.w} ${l.s}px Manrope, system-ui, sans-serif`;
      ctx.fillStyle = l.c || INK; ctx.textBaseline = "top";
      ctx.fillText(l.t, bx + 16, yy); yy += lh(l);
    });
    ctx.restore();
  }

  /* Kemerli/eğik kenarlar gibi bilgileri göstermek için: komşu katmanların
     kutularını bu katmanın koordinatında kesikli gri çizgiyle çizer. */
  function neighbours(ctx, model, slot) {
    const b = slot.box;
    model.slots.forEach(o => {
      if (o === slot || o.backdrop || !o.box) return;
      const ob = o.box;
      if (ob.w >= 400 && ob.h >= 700) return; // tam sahne katmanları kalabalık yapmasın
      const x = (ob.x - b.x) * SCALE, y = (ob.y - b.y) * SCALE, w = ob.w * SCALE, h = ob.h * SCALE;
      ctx.save(); ctx.setLineDash([10, 8]); ctx.strokeStyle = GRAY; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h); ctx.restore();
      const cx = Math.max(10, Math.min(x + 10, b.w * SCALE - 200)), cy = Math.max(20, Math.min(y + 22, b.h * SCALE - 20));
      if (x < b.w * SCALE && x + w > 0 && y < b.h * SCALE && y + h > 0) label(ctx, o.label, cx, cy, { size: 16, weight: 600, color: "#555" });
    });
  }

  function drawHinge(ctx, side, W, H) {
    const x = side === "left" ? 4 : W - 4;
    ctx.save();
    ctx.strokeStyle = RED; ctx.lineWidth = 8; ctx.setLineDash([24, 14]);
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.translate(side === "left" ? 34 : W - 34, H * 0.22);
    ctx.rotate(side === "left" ? -Math.PI / 2 : Math.PI / 2);
    label(ctx, "MENTEŞE · DÖNME EKSENİ", 0, 0, { size: 20, align: "center", color: "#fff", bg: RED });
    ctx.restore();
  }

  function drawPivot(ctx, fx, fy, W, H) {
    const x = fx * W, y = fy * H;
    ctx.save(); ctx.strokeStyle = RED; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x - 22, y); ctx.lineTo(x + 22, y); ctx.moveTo(x, y - 22); ctx.lineTo(x, y + 22); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }

  function borderAndTitle(ctx, W, H) {
    ctx.save(); ctx.strokeStyle = "rgba(204,0,153,.8)"; ctx.lineWidth = 3; ctx.strokeRect(1.5, 1.5, W - 3, H - 3); ctx.restore();
  }

  /* Bir katmanın rehber görseli. back=true → kanat arka yüzü (menteşe ters tarafta). */
  function renderSlotGuide(model, slotId, opts) {
    opts = opts || {};
    const slot = model.slots.find(s => s.id === slotId);
    if (!slot) throw new Error("Katman yok: " + slotId);
    const [W, H] = sizeOf(model, slot);
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");
    const g = slot.guide || {};

    if (slot.backdrop) {
      drawBackdropGuide(ctx, model, W, H);
      infoBlock(ctx, model, slot, W, H, { y: 60 });
      borderAndTitle(ctx, W, H);
      return cv;
    }

    const small = W < 300 || H < 300;
    if (!small) neighbours(ctx, model, slot);
    (g.clear || []).forEach(r => {
      const x = (r.x - slot.box.x) * SCALE, y = (r.y - slot.box.y) * SCALE;
      hatch(ctx, x, y, r.w * SCALE, r.h * SCALE, r.soft ? BLUE : RED, r.soft);
      label(ctx, r.label || "SAYDAM BIRAKIN", x + r.w * SCALE / 2, y + 40, { size: 20, align: "center", color: r.soft ? BLUE : RED });
    });
    let hinge = g.hinge;
    if (opts.back && hinge) hinge = hinge === "left" ? "right" : "left";
    if (hinge) drawHinge(ctx, hinge, W, H);
    if (g.pivot) drawPivot(ctx, g.pivot[0], g.pivot[1], W, H);

    if (small) {
      // küçük parçalar (tokmak): bilgi kutusu sığmaz, yalnızca ölçü yazılır
      ctx.save(); ctx.font = "700 14px Manrope, system-ui, sans-serif"; ctx.fillStyle = BLUE; ctx.textBaseline = "bottom";
      ctx.fillText(`${W}×${H}`, 6, H - 6); ctx.restore();
    } else {
      const noteSlot = opts.back ? Object.assign({}, slot, { label: slot.label + " — ARKA YÜZ (isteğe bağlı)",
        guide: Object.assign({}, g, { alpha: g.alpha, note: "Kanadın arkadan görünüşü. Kanat açılınca izleyiciye bu yüz görünür. Arkadan bakıldığı için menteşe TERS taraftadır. Yüklenmezse ön yüzün koyulaştırılmış hâli kullanılır." }) }) : slot;
      infoBlock(ctx, model, noteSlot, W, H, { file: opts.back ? g.backFile : g.file });
    }
    borderAndTitle(ctx, W, H);
    return cv;
  }

  /* Arka plan rehberi: telefon ve bilgisayarda görünen alan + kapının yeri */
  function drawBackdropGuide(ctx, model, W, H) {
    const FW = 400, FH = 700;
    function crop(vw, vh, color, name) {
      const s = Math.max(vw / W, vh / H);           // object-fit: cover
      const cw = vw / s, ch = vh / s;
      const x = (W - cw) / 2, y = (H - ch) / 2;
      ctx.save(); ctx.setLineDash([18, 10]); ctx.lineWidth = 5; ctx.strokeStyle = color; ctx.strokeRect(x + 2.5, y + 2.5, cw - 5, ch - 5); ctx.restore();
      label(ctx, name, x + 14, y + 30, { size: 22, color: "#fff", bg: color });
      // kapı sahnesinin bu ekranda kapladığı alan (ekrana %96 sığdırılır)
      const fs = Math.min(vw / FW, vh / FH) * 0.96;
      const fw = FW * fs / s, fh = FH * fs / s;
      return { x: (W - fw) / 2, y: (H - fh) / 2, w: fw, h: fh };
    }
    const phone = crop(390, 844, BLUE, "TELEFONDA GÖRÜNEN");
    const desk = crop(1280, 800, "#2E7D32", "BİLGİSAYARDA GÖRÜNEN");
    [[phone, BLUE, "kapı (telefon)"], [desk, "#2E7D32", "kapı (bilgisayar)"]].forEach(([r, c, t]) => {
      ctx.save(); ctx.fillStyle = "rgba(0,0,0,.06)"; ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.setLineDash([6, 8]); ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.strokeRect(r.x, r.y, r.w, r.h); ctx.restore();
      label(ctx, t, r.x + r.w / 2, r.y + r.h - 24, { size: 18, align: "center", color: c });
    });
  }

  function renderCardGuide(model) {
    const cg = model.cardGuide || { file: "ic-kart", box: { w: 300, h: 520 }, note: "" };
    const W = cg.box.w * SCALE, H = cg.box.h * SCALE;
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");
    ctx.save(); ctx.strokeStyle = BLUE; ctx.setLineDash([12, 10]); ctx.lineWidth = 3;
    const m = 60; ctx.strokeRect(m, m, W - m * 2, H - m * 2); ctx.restore();
    label(ctx, "YAZILAR BU ÇİZGİNİN İÇİNDE KALSIN", W / 2, m + 30, { size: 20, align: "center", color: BLUE });
    infoBlock(ctx, model, { id: "card", label: "İç kart", box: cg.box, guide: { file: cg.file, alpha: "no", note: cg.note } }, W, H, {});
    borderAndTitle(ctx, W, H);
    return cv;
  }

  /* Genel bakış: bütün katmanlar sahnede üst üste, renkli kutular ve sıra numaralarıyla */
  function renderOverview(model) {
    const W = 400 * SCALE, H = 700 * SCALE;
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#F4F1EA"; ctx.fillRect(0, 0, W, H);
    const colors = ["#7B61FF", "#D7263D", "#1F6FEB", "#0E9F6E", "#E8890C", "#C2185B", "#00838F"];
    let n = 0;
    model.slots.forEach((s, i) => {
      if (s.backdrop) return;
      const b = s.box, c = colors[i % colors.length];
      n++;
      ctx.save(); ctx.globalAlpha = b.w >= 400 ? 0 : 0.10; ctx.fillStyle = c; ctx.fillRect(b.x * SCALE, b.y * SCALE, b.w * SCALE, b.h * SCALE); ctx.restore();
      ctx.save(); ctx.lineWidth = 4; ctx.strokeStyle = c; ctx.setLineDash(b.w >= 400 ? [20, 12] : []); ctx.strokeRect(b.x * SCALE + 2, b.y * SCALE + 2, b.w * SCALE - 4, b.h * SCALE - 4); ctx.restore();
      const g = s.guide || {};
      const lx = b.w >= 400 ? 20 + (n - 1) * 0 : b.x * SCALE + 10;
      const ly = b.w >= 400 ? 40 + (n - 1) * 44 : (b.h < 150 ? (b.y + b.h) * SCALE + 26 : b.y * SCALE + 40);
      label(ctx, `${g.file || s.id}  ·  ${s.label}`, lx, ly, { size: 20, color: "#fff", bg: c });
      if (g.hinge) {
        const hx = (g.hinge === "left" ? b.x : b.x + b.w) * SCALE;
        ctx.save(); ctx.strokeStyle = RED; ctx.lineWidth = 8; ctx.setLineDash([24, 14]);
        ctx.beginPath(); ctx.moveTo(hx, b.y * SCALE); ctx.lineTo(hx, (b.y + b.h) * SCALE); ctx.stroke(); ctx.restore();
      }
    });
    label(ctx, "kırmızı kesikli çizgi = menteşe (dönme ekseni)", W / 2, H - 90, { size: 20, align: "center", color: RED });
    (model.slots.find(s => s.id === "frame") || { guide: {} }).guide.clear && model.slots.find(s => s.id === "frame").guide.clear.forEach(r => {
      label(ctx, "açıklık (saydam)", (r.x + r.w / 2) * SCALE, (r.y + 24) * SCALE, { size: 18, align: "center", color: RED });
    });
    if (model.cardGuide) {
      const b = model.cardGuide.box;
      ctx.save(); ctx.setLineDash([6, 10]); ctx.strokeStyle = "#555"; ctx.lineWidth = 3; ctx.strokeRect(b.x * SCALE, b.y * SCALE, b.w * SCALE, b.h * SCALE); ctx.restore();
      label(ctx, `${model.cardGuide.file} · İç kart (açılınca belirir)`, (b.x + b.w / 2) * SCALE, (b.y + b.h - 18) * SCALE, { size: 18, align: "center", color: "#555" });
    }
    label(ctx, `${model.label} — katman yerleşimi (1200 × 2100 px sahne)`, W / 2, H - 40, { size: 26, align: "center" });
    return cv;
  }

  function readmeText(model) {
    const lines = [];
    lines.push(`STUDIO SEOZ — ${model.label.toUpperCase()} KATMAN REHBERİ`);
    lines.push("");
    lines.push("Nasıl kullanılır?");
    lines.push("1) Her katman için aynı adlı rehber PNG'yi çizim programınızda (Photoshop, Procreate, Canva, Figma) açın.");
    lines.push("2) Rehberi en üste koyup altına çizin. Rehber yalnızca yol göstericidir; dışa aktarmadan önce gizleyin.");
    lines.push("3) Görseli rehberle AYNI piksel boyutunda, saydam zeminli PNG olarak kaydedin.");
    lines.push("4) Editörde Giriş Türü → Sinematik Açılış → Açılış Stüdyosu → Katmanlar bölümünden ilgili yuvaya yükleyin.");
    lines.push("5) Gerekirse Hizalama Sahnesi'nde sürükleyerek konum, ölçek, dönme noktası, derinlik ve kalınlığı ince ayarlayın.");
    lines.push("");
    lines.push("Genel kurallar");
    lines.push("- Sahne 400×700 birimdir; rehberler bunun 3 katı çözünürlüktedir (1200×2100). Kenar en fazla 2048 px; daha büyükse editör küçültür.");
    lines.push("- Renk profili sRGB. Her dosya mümkünse 1,5 MB'ın altında olsun; bir davetiyedeki toplam görseller 15 MB'ı geçmesin.");
    lines.push("- Işık yönünü bütün katmanlarda aynı tutun (öneri: sol üstten). Gölgeyi parçanın içine çizin; zemine düşen gölgeyi çerçeve katmanına çizin.");
    lines.push("- Dönen parçalarda (kanatlar) menteşe kenarı rehberdeki kırmızı çizgiye tam oturmalı; aksi hâlde kanat havada dönüyormuş gibi görünür.");
    lines.push("- Yüklemediğiniz katmanların yerine kodla çizilmiş görünüm kullanılır; yani parça parça ilerleyebilirsiniz.");
    lines.push("");
    lines.push("Katmanlar");
    model.slots.forEach(s => {
      const g = s.guide || {};
      const [w, h] = sizeOf(model, s);
      lines.push(`- ${g.file || s.id}.png — ${s.label} — ${w}×${h} px — ${ALPHA_TEXT[g.alpha || "recommended"]}`);
      if (g.note) lines.push(`    ${g.note}`);
      if (g.backFile) lines.push(`  ${g.backFile}.png — ${s.label} ARKA YÜZÜ (isteğe bağlı) — ${w}×${h} px — menteşe ters tarafta, arkadan görünüş.`);
    });
    if (model.cardGuide) {
      const b = model.cardGuide.box;
      lines.push(`- ${model.cardGuide.file}.png — İç kart — ${b.w * SCALE}×${b.h * SCALE} px — ${model.cardGuide.note}`);
    }
    lines.push("");
    lines.push("00-genel-bakis.png bütün katmanların sahnede nerede durduğunu gösterir.");
    return lines.join("\r\n");
  }

  /* Bir modelin bütün rehberleri: [{ name, canvas }] + metin */
  function allGuides(model) {
    const out = [{ name: "00-genel-bakis.png", canvas: renderOverview(model) }];
    model.slots.forEach(s => {
      const g = s.guide || {};
      out.push({ name: (g.file || s.id) + ".png", canvas: renderSlotGuide(model, s.id) });
      if (s.back && g.backFile) out.push({ name: g.backFile + ".png", canvas: renderSlotGuide(model, s.id, { back: true }) });
    });
    if (model.cardGuide) out.push({ name: model.cardGuide.file + ".png", canvas: renderCardGuide(model) });
    return out;
  }

  function canvasBlob(cv) { return new Promise(res => cv.toBlob(res, "image/png")); }

  function download(blob, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  async function downloadSlotGuide(model, slotId, back) {
    const s = model.slots.find(x => x.id === slotId);
    const g = (s && s.guide) || {};
    const cv = slotId === "card" ? renderCardGuide(model) : renderSlotGuide(model, slotId, { back });
    const name = slotId === "card" ? model.cardGuide.file : (back ? g.backFile : g.file) || slotId;
    download(await canvasBlob(cv), `rehber-${model.id}-${name}.png`);
  }

  async function buildZip(model) {
    if (!global.JSZip) throw new Error("ZIP aracı yüklenemedi.");
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const zip = new global.JSZip();
    const dir = zip.folder(`${model.id}-katman-rehberi`);
    for (const g of allGuides(model)) dir.file(g.name, await canvasBlob(g.canvas));
    dir.file("OKU-BENI.txt", readmeText(model));
    return zip.generateAsync({ type: "blob" });
  }

  async function downloadZip(model) {
    download(await buildZip(model), `studio-seoz-${model.id}-katman-rehberi.zip`);
  }

  global.SeozCinemaGuides = { SCALE, sizeOf, renderSlotGuide, renderCardGuide, renderOverview, allGuides, readmeText, buildZip, downloadZip, downloadSlotGuide };
})(window);
