/* =============================================================================
   STUDIO SEOZ — theme/theme-art.js  (İç Zemin · hazır süsleme çizimleri)
   -----------------------------------------------------------------------------
   Zemin katmanlarında kullanılan hafif, vektör (SVG) süslemeler. Görsel
   yüklemeden de zemin kurulabilsin diye vardır; kullanıcı her zaman kendi
   PNG'sini de yükleyebilir. Her çizim tek renkle (veya iki renkle)
   boyanır ve her boyutta keskin görünür.
   art(id, color, color2) → SVG metni; ratio = genişlik/yükseklik.
   ========================================================================= */
(function (global) {
  "use strict";

  const A = {};
  function def(id, label, group, ratio, fn) { A[id] = { id, label, group, ratio, fn }; }
  const svg = (vb, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${body}</svg>`;

  /* ---------------- doğa ---------------- */
  def("dal", "Yapraklı dal", "Doğa", 1.6, (c) => svg("0 0 320 200",
    `<path d="M6 170 C80 150 150 120 300 40" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round"/>` +
    [[40, 158, -30], [70, 150, 20], [100, 136, -35], [130, 126, 25], [160, 110, -40], [190, 100, 22], [220, 82, -42], [250, 72, 18], [276, 56, -45]]
      .map(([x, y, r], i) => `<ellipse cx="${x}" cy="${y + (i % 2 ? 14 : -14)}" rx="20" ry="8" fill="${c}" opacity="${0.75 + (i % 3) * 0.08}" transform="rotate(${r} ${x} ${y + (i % 2 ? 14 : -14)})"/>`).join("")));
  def("cicek-dali", "Çiçekli dal", "Doğa", 1.6, (c, c2) => svg("0 0 320 200",
    `<path d="M8 180 C90 150 170 110 310 30" fill="none" stroke="${c}" stroke-width="3.5" stroke-linecap="round"/>` +
    [[60, 156], [120, 128], [180, 100], [240, 68], [290, 40]].map(([x, y], i) =>
      `<g transform="translate(${x} ${y - 10})">${[0, 72, 144, 216, 288].map(a => `<ellipse cx="0" cy="-9" rx="5.5" ry="9" fill="${c2 || "#F6D6DE"}" transform="rotate(${a + i * 9})"/>`).join("")}<circle r="4" fill="${c}"/></g>`).join("") +
    [[90, 146, -30], [150, 118, 30], [210, 88, -35], [265, 58, 25]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y + 12}" rx="15" ry="6" fill="${c}" opacity=".7" transform="rotate(${r} ${x} ${y + 12})"/>`).join("")));
  def("yaprak-kose", "Köşe yaprakları", "Doğa", 1, (c) => svg("0 0 200 200",
    [[0, 0, 40, 60], [10, 0, 75, 52], [0, 12, 30, 95], [20, 10, 110, 30], [5, 25, 60, 120]].map(([x, y, a, l], i) =>
      `<path d="M${x} ${y} q ${l * 0.6} ${l * 0.15} ${l} ${l * 0.9} q ${-l * 0.55} ${-l * 0.05} ${-l} ${-l * 0.9}" fill="${c}" opacity="${0.55 + i * 0.09}" transform="rotate(${a - 45} ${x} ${y})"/>`).join("")));
  def("bulut", "Bulut", "Doğa", 2.2, (c) => svg("0 0 220 100",
    `<path d="M30 86 a26 26 0 0 1 6-51 a34 34 0 0 1 64-14 a28 28 0 0 1 46 6 a24 24 0 0 1 44 20 a20 20 0 0 1 -6 39 z" fill="${c}"/>`));
  def("cicek", "Çiçek", "Doğa", 1, (c, c2) => svg("0 0 100 100",
    [0, 45, 90, 135, 180, 225, 270, 315].map(a => `<ellipse cx="50" cy="26" rx="11" ry="22" fill="${c2 || c}" opacity=".9" transform="rotate(${a} 50 50)"/>`).join("") + `<circle cx="50" cy="50" r="11" fill="${c}"/>`));
  def("gul-yapragi", "Gül yaprağı", "Doğa", 1, (c) => svg("0 0 100 100", `<path d="M50 8 C82 24 92 62 50 92 C8 62 18 24 50 8z" fill="${c}"/><path d="M50 18 C52 50 52 70 50 88" stroke="#000" stroke-opacity=".12" stroke-width="2" fill="none"/>`));
  def("dalga", "Dalga bandı", "Doğa", 4, (c, c2) => svg("0 0 400 100",
    `<path d="M0 40 C60 10 120 70 200 40 S340 10 400 40 V100 H0z" fill="${c}" opacity=".55"/><path d="M0 62 C70 34 130 90 210 60 S340 36 400 62 V100 H0z" fill="${c2 || c}" opacity=".8"/>`));

  /* ---------------- kutlama ---------------- */
  def("balon", "Balon", "Kutlama", 0.55, (c) => svg("0 0 110 200",
    `<ellipse cx="55" cy="60" rx="46" ry="56" fill="${c}"/><ellipse cx="38" cy="38" rx="10" ry="16" fill="#fff" opacity=".35" transform="rotate(-20 38 38)"/>` +
    `<path d="M49 116 h12 l-6 9z" fill="${c}"/><path d="M55 125 C45 150 66 165 52 198" stroke="${c}" stroke-width="2" fill="none" opacity=".7"/>`));
  def("kalp", "Kalp", "Kutlama", 1.1, (c) => svg("0 0 110 100", `<path d="M55 96 C10 64 0 38 12 20 C26 0 50 6 55 26 C60 6 84 0 98 20 C110 38 100 64 55 96z" fill="${c}"/>`));
  def("yildiz", "Yıldız", "Kutlama", 1, (c) => svg("0 0 100 100", `<path d="M50 4 L61 38 L96 38 L68 59 L79 94 L50 72 L21 94 L32 59 L4 38 L39 38z" fill="${c}"/>`));
  def("parilti", "Parıltı", "Kutlama", 1, (c) => svg("0 0 100 100", `<path d="M50 0 C54 36 64 46 100 50 C64 54 54 64 50 100 C46 64 36 54 0 50 C36 46 46 36 50 0z" fill="${c}"/>`));
  def("hediye", "Hediye kutusu", "Kutlama", 1, (c, c2) => svg("0 0 120 120",
    `<rect x="14" y="48" width="92" height="66" rx="4" fill="${c}"/><rect x="8" y="32" width="104" height="22" rx="4" fill="${c}" opacity=".85"/>` +
    `<rect x="53" y="32" width="14" height="82" fill="${c2 || "#F3D27A"}"/><path d="M60 32 C40 6 20 18 34 30z M60 32 C80 6 100 18 86 30z" fill="${c2 || "#F3D27A"}"/>`));
  def("konfeti-kose", "Konfeti köşesi", "Kutlama", 1, (c, c2) => svg("0 0 200 200",
    Array.from({ length: 26 }, (_, i) => { const x = (i * 37) % 190, y = (i * 53) % 190; return `<rect x="${x}" y="${y}" width="${6 + i % 4}" height="${12 - i % 5}" fill="${i % 2 ? c : (c2 || "#F7C548")}" transform="rotate(${i * 29} ${x} ${y})" opacity=".85"/>`; }).join("")));
  def("kep", "Mezuniyet kepi", "Kutlama", 1.4, (c, c2) => svg("0 0 140 100",
    `<path d="M70 8 L134 34 L70 60 L6 34z" fill="${c}"/><path d="M34 46 v22 c0 12 72 12 72 0 v-22 l-36 14z" fill="${c}" opacity=".85"/>` +
    `<path d="M118 40 v34" stroke="${c2 || "#F3D27A"}" stroke-width="3"/><circle cx="118" cy="78" r="5" fill="${c2 || "#F3D27A"}"/>`));
  def("fener", "Dilek feneri", "Kutlama", 0.7, (c, c2) => svg("0 0 84 120",
    `<path d="M14 18 Q42 4 70 18 L62 100 Q42 110 22 100z" fill="${c}"/><ellipse cx="42" cy="62" rx="14" ry="26" fill="${c2 || "#FFE6A6"}" opacity=".7"/><rect x="30" y="100" width="24" height="8" rx="2" fill="${c}" opacity=".7"/>`));
  def("kar-tanesi", "Kar tanesi", "Kutlama", 1, (c) => svg("0 0 100 100",
    `<g stroke="${c}" stroke-width="5" stroke-linecap="round" fill="none">${[0, 60, 120].map(a => `<g transform="rotate(${a} 50 50)"><path d="M50 6 V94"/><path d="M50 22 l-10 -10 M50 22 l10 -10 M50 78 l-10 10 M50 78 l10 10"/></g>`).join("")}</g>`));
  def("hilal", "Hilal ve yıldız", "Kutlama", 1, (c) => svg("0 0 100 100", `<path d="M62 10 A42 42 0 1 0 62 90 A34 34 0 1 1 62 10z" fill="${c}"/><path d="M78 40 l3 9 h9 l-7 6 3 9 -8 -5 -8 5 3 -9 -7 -6 h9z" fill="${c}"/>`));

  /* ---------------- gece / halloween ---------------- */
  def("yarasa", "Yarasa", "Gece", 2, (c) => svg("0 0 200 100",
    `<path d="M100 40 C92 30 88 34 86 42 C70 22 40 18 6 30 C30 36 38 50 34 64 C48 54 62 58 70 70 C78 60 88 58 100 66 C112 58 122 60 130 70 C138 58 152 54 166 64 C162 50 170 36 194 30 C160 18 130 22 114 42 C112 34 108 30 100 40z" fill="${c}"/>`));
  def("orumcek-agi", "Örümcek ağı", "Gece", 1, (c) => svg("0 0 200 200",
    `<g stroke="${c}" stroke-width="1.6" fill="none" opacity=".8">${[0, 15, 30, 45, 60, 75, 90].map(a => `<path d="M0 0 L${200 * Math.cos(a * Math.PI / 180)} ${200 * Math.sin(a * Math.PI / 180)}"/>`).join("")}${[40, 80, 120, 160].map(r => `<path d="M${r} 0 ${[15, 30, 45, 60, 75, 90].map(a => `Q ${r * 0.85 * Math.cos((a - 7.5) * Math.PI / 180)} ${r * 0.85 * Math.sin((a - 7.5) * Math.PI / 180)} ${r * Math.cos(a * Math.PI / 180)} ${r * Math.sin(a * Math.PI / 180)}`).join(" ")}"/>`).join("")}</g>`));
  def("ay", "Dolunay", "Gece", 1, (c) => svg("0 0 100 100", `<circle cx="50" cy="50" r="44" fill="${c}"/><circle cx="36" cy="38" r="8" fill="#000" opacity=".08"/><circle cx="62" cy="62" r="11" fill="#000" opacity=".07"/>`));

  /* ---------------- işletme ---------------- */
  def("ev", "Ev silueti", "İşletme", 1.6, (c) => svg("0 0 240 150",
    `<path d="M20 150 V80 L80 30 L140 80 V150z M140 150 V96 L186 60 L232 96 V150z" fill="${c}"/><rect x="66" y="104" width="28" height="46" fill="#fff" opacity=".25"/><rect x="176" y="112" width="20" height="20" fill="#fff" opacity=".25"/>`));
  def("anahtar", "Anahtar", "İşletme", 2.4, (c) => svg("0 0 240 100",
    `<circle cx="44" cy="50" r="34" fill="none" stroke="${c}" stroke-width="12"/><path d="M76 44 H226 V58 H206 V78 H190 V58 H170 V72 H156 V58 H76z" fill="${c}"/>`));
  def("makas", "Makas", "İşletme", 1.6, (c) => svg("0 0 160 100",
    `<circle cx="26" cy="26" r="16" fill="none" stroke="${c}" stroke-width="7"/><circle cx="26" cy="74" r="16" fill="none" stroke="${c}" stroke-width="7"/>` +
    `<path d="M38 36 L156 70 L150 76 L36 46z M38 64 L156 30 L150 24 L36 54z" fill="${c}"/>`));
  def("kahve", "Kahve fincanı", "İşletme", 1, (c) => svg("0 0 120 120",
    `<path d="M20 52 H88 V78 C88 98 72 108 54 108 C36 108 20 98 20 78z" fill="${c}"/><path d="M88 60 C108 60 108 86 86 86" fill="none" stroke="${c}" stroke-width="7"/>` +
    `<path d="M40 40 C32 30 46 24 38 12 M58 40 C50 30 64 24 56 12 M76 40 C68 30 82 24 74 12" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round" opacity=".6"/>`));
  def("ayna", "Ayna çerçevesi", "İşletme", 0.75, (c) => svg("0 0 150 200",
    `<ellipse cx="75" cy="100" rx="66" ry="92" fill="none" stroke="${c}" stroke-width="7"/><ellipse cx="75" cy="100" rx="56" ry="82" fill="${c}" opacity=".08"/>` +
    `<path d="M48 54 L60 42 M44 74 L74 44" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".6"/>`));
  def("tente", "Vitrin tentesi", "İşletme", 3, (c, c2) => svg("0 0 300 100",
    Array.from({ length: 8 }, (_, i) => `<path d="M${i * 37.5} 0 h37.5 v60 a18.75 18.75 0 0 1 -37.5 0z" fill="${i % 2 ? (c2 || "#fff") : c}"/>`).join("")));
  def("yaprak-saksi", "Saksı bitki", "İşletme", 0.7, (c) => svg("0 0 100 140",
    `<path d="M30 100 H70 L64 136 H36z" fill="${c}" opacity=".85"/>` + [[-40, 60], [-15, 70], [15, 70], [40, 60], [0, 78]].map(([a, l]) =>
      `<path d="M50 100 q -8 ${-l / 2} 0 ${-l} q 8 ${l / 2} 0 ${l}" fill="${c}" transform="rotate(${a} 50 100)"/>`).join("")));

  /* ---------------- süsleme ---------------- */
  def("sus-cizgi", "Süs çizgisi", "Süsleme", 6, (c) => svg("0 0 300 50",
    `<path d="M10 25 H120 M180 25 H290" stroke="${c}" stroke-width="2"/><path d="M150 10 l12 15 -12 15 -12 -15z" fill="${c}"/><circle cx="128" cy="25" r="3.5" fill="${c}"/><circle cx="172" cy="25" r="3.5" fill="${c}"/>`));
  def("kose-sus", "Köşe süsü", "Süsleme", 1, (c) => svg("0 0 120 120",
    `<path d="M6 114 V40 C6 20 20 6 40 6 H114" fill="none" stroke="${c}" stroke-width="3"/><path d="M18 114 V48 C18 30 30 18 48 18 H114" fill="none" stroke="${c}" stroke-width="1.5" opacity=".7"/>` +
    `<path d="M40 40 c8 -14 26 -14 30 0 c-14 4 -14 22 0 30 c-14 -4 -30 -12 -30 -30z" fill="${c}" opacity=".8"/>`));
  def("inci-dizisi", "İnci dizisi", "Süsleme", 4, (c) => svg("0 0 400 100",
    Array.from({ length: 21 }, (_, i) => { const x = 10 + i * 19, y = 20 + Math.sin(i / 20 * Math.PI) * 60; return `<circle cx="${x}" cy="${y}" r="7.5" fill="${c}"/><circle cx="${x - 2.5}" cy="${y - 2.5}" r="2.4" fill="#fff" opacity=".8"/>`; }).join("")));
  def("tul", "Tül perde", "Süsleme", 3, (c) => svg("0 0 300 100",
    `<path d="M0 0 H300 V18 C250 70 200 20 150 70 C100 20 50 70 0 18z" fill="${c}" opacity=".55"/><path d="M0 0 H300 V8 C240 44 210 12 150 44 C90 12 60 44 0 8z" fill="${c}" opacity=".7"/>`));
  def("monogram", "Monogram halkası", "Süsleme", 1, (c) => svg("0 0 120 120",
    `<circle cx="60" cy="60" r="54" fill="none" stroke="${c}" stroke-width="2"/><circle cx="60" cy="60" r="46" fill="none" stroke="${c}" stroke-width="1" stroke-dasharray="2 5"/>` +
    `<path d="M60 6 l5 8 -5 8 -5 -8z M60 98 l5 8 -5 8 -5 -8z" fill="${c}"/>`));
  def("neon-cizgi", "Neon çizgi", "Süsleme", 6, (c) => svg("0 0 300 50",
    `<path d="M4 25 L60 25 L80 8 L110 42 L140 8 L170 42 L200 8 L220 25 L296 25" fill="none" stroke="${c}" stroke-width="8" opacity=".25" stroke-linejoin="round"/>` +
    `<path d="M4 25 L60 25 L80 8 L110 42 L140 8 L170 42 L200 8 L220 25 L296 25" fill="none" stroke="${c}" stroke-width="3" stroke-linejoin="round"/>`));
  def("isik-huzmesi", "Işık huzmesi", "Süsleme", 0.6, (c) => svg("0 0 120 200",
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity=".9"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient></defs><path d="M50 0 H70 L120 200 H0z" fill="url(#g)"/>`));
  def("halka", "Işık halkası", "Süsleme", 1, (c) => svg("0 0 100 100",
    `<defs><radialGradient id="r"><stop offset=".55" stop-color="${c}" stop-opacity="0"/><stop offset=".72" stop-color="${c}" stop-opacity=".8"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient></defs><circle cx="50" cy="50" r="50" fill="url(#r)"/>`));

  function art(id, color, color2) {
    const a = A[id]; if (!a) return "";
    return a.fn(color || "#C9A45C", color2);
  }
  global.SeozThemeArt = { art, list: () => Object.keys(A).map(k => A[k]), get: id => A[id] || null };
})(window);
