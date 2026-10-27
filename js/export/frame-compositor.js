/* =============================================================================
   STUDIO SEOZ — export/frame-compositor.js  (MP4 DIŞA AKTARMA · kare çizici)
   -----------------------------------------------------------------------------
   Açılış sahnesinin (HTML katmanlar, 3D dönüşler, maskeler, filtreler, video)
   o anki görüntüsünü bir WebGL tuvaline çizer. Tarayıcılar bir sayfanın kendi
   ekran görüntüsünü izin istemeden vermediği için sahneyi CSS kurallarını
   izleyerek kendimiz çizeriz:

   - Konum ve 3D: her öğenin CSS dönüşümü, dönüşüm kökeni, perspektif ve
     preserve-3d / düzleştirme kuralları 4×4 matrislerle birebir hesaplanır;
     3D bağlamlarda katmanlar derinliğe göre sıralanır, arka yüzü gizli olanlar
     arkası dönünce çizilmez.
   - Görüntü: <img>, <video>, <canvas> (parçacıklar) doğrudan; arka plan,
     kenarlık, gölge, gradyan ve yazılar tarayıcının kendi çiziminden
     (SVG foreignObject) alınır — yani CSS ile aynı görünür.
   - Etkiler: saydamlık, filtre (parlaklık, bulanıklık, gölge, renk), maske,
     kırpma (clip-path, overflow) ve çarpma / ekran karışımı GPU'da uygulanır.

   Bilinen sınırlar (çıktı penceresinde ayrıca yazılır): kesişen 3D düzlemler
   bölünmez (öndeki/arkadaki tümüyle sıralanır), backdrop-filter ve
   multiply/screen dışındaki karışım modları yaklaşık çizilir.
   ========================================================================= */
(function (W) {
  "use strict";

  const XHTML = "http://www.w3.org/1999/xhtml";
  const FLAT = new DOMMatrix([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
  const ID = new DOMMatrix();
  const PAD = 1;   // dokuların çevresindeki saydam kenar (kenar yumuşatma)

  /* ---------------- yardımcılar ---------------- */
  const px = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
  function qScale(r) { r = Math.max(1 / 16, Math.min(4, r || 1)); return Math.pow(2, Math.round(Math.log2(r) * 4) / 4); }
  function project(M, x, y) { const p = M.transformPoint(new DOMPoint(x, y, 0, 1)); return p; }
  function quadOut(M, q) {
    return [project(M, q.x, q.y), project(M, q.x + q.w, q.y), project(M, q.x, q.y + q.h), project(M, q.x + q.w, q.y + q.h)];
  }
  /* bir dikdörtgenin çıktıda kaç piksele denk geldiği → çizim ölçeği */
  function scaleOf(M, q) {
    const ps = quadOut(M, q);
    if (ps.some(p => p.w <= 1e-6)) return 1;
    const xs = ps.map(p => p.x / p.w), ys = ps.map(p => p.y / p.w);
    const ew = Math.max(Math.hypot(xs[1] - xs[0], ys[1] - ys[0]), Math.hypot(xs[3] - xs[2], ys[3] - ys[2]));
    const eh = Math.max(Math.hypot(xs[2] - xs[0], ys[2] - ys[0]), Math.hypot(xs[3] - xs[1], ys[3] - ys[1]));
    return Math.max(ew / Math.max(1e-3, q.w), eh / Math.max(1e-3, q.h));
  }
  function unionRect(a, b) { if (!a) return b; if (!b) return a; const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y); return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y }; }
  function interRect(a, b) { const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y); return { x, y, w: Math.max(0, Math.min(a.x + a.w, b.x + b.w) - x), h: Math.max(0, Math.min(a.y + a.h, b.y + b.h) - y) }; }
  function expandRect(a, l, t, r, b) { return { x: a.x - l, y: a.y - t, w: a.w + l + r, h: a.h + t + b }; }

  /* CSS filtre dizisini parçalara ayır: brightness(0.5) blur(4px) drop-shadow(rgba(...) 0px 6px 12px) */
  function parseFilter(s) {
    const out = []; if (!s || s === "none") return out;
    const re = /([a-z-]+)\(((?:[^()]|\([^()]*\))*)\)/g; let m;
    while ((m = re.exec(s))) out.push({ fn: m[1], arg: m[2].trim() });
    return out;
  }
  function parseColor(s) {
    const m = /rgba?\(([^)]+)\)/.exec(s || ""); if (!m) return [0, 0, 0, 1];
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat);
    return [p[0] / 255, p[1] / 255, p[2] / 255, p.length > 3 ? p[3] : 1];
  }
  function parseShadow(arg) {   // "rgba(0,0,0,.4) 0px 6px 12px"
    const col = (/rgba?\([^)]*\)/.exec(arg) || ["rgb(0,0,0)"])[0];
    const nums = arg.replace(col, "").trim().split(/\s+/).map(px);
    return { color: parseColor(col), x: nums[0] || 0, y: nums[1] || 0, blur: nums[2] || 0 };
  }
  function filterExtent(list) {
    let e = { l: 0, t: 0, r: 0, b: 0 };
    list.forEach(f => {
      if (f.fn === "blur") { const s = px(f.arg) * 3; e = { l: e.l + s, t: e.t + s, r: e.r + s, b: e.b + s }; }
      else if (f.fn === "drop-shadow") { const d = parseShadow(f.arg), s = d.blur * 1.5;
        e = { l: Math.max(e.l, s - d.x), t: Math.max(e.t, s - d.y), r: Math.max(e.r, s + d.x), b: Math.max(e.b, s + d.y) }; }
    });
    return e;
  }
  /* renk matrisi filtreleri (W3C Filter Effects tanımları) → 4×5 matris */
  function colorMatrix(f) {
    const a = f.arg ? (/%$/.test(f.arg) ? px(f.arg) / 100 : parseFloat(f.arg)) : 1;
    const v = isFinite(a) ? a : 1;
    const I = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
    switch (f.fn) {
      case "brightness": return [v, 0, 0, 0, 0, 0, v, 0, 0, 0, 0, 0, v, 0, 0, 0, 0, 0, 1, 0];
      case "contrast": { const o = 0.5 - 0.5 * v; return [v, 0, 0, 0, o, 0, v, 0, 0, o, 0, 0, v, 0, o, 0, 0, 0, 1, 0]; }
      case "opacity": return [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, v, 0];
      case "invert": { const k = 1 - 2 * v; return [k, 0, 0, 0, v, 0, k, 0, 0, v, 0, 0, k, 0, v, 0, 0, 0, 1, 0]; }
      case "saturate": case "grayscale": {
        const s = f.fn === "saturate" ? v : 1 - Math.min(1, v);
        return [0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s, 0, 0, 0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s, 0, 0,
          0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s, 0, 0, 0, 0, 0, 1, 0];
      }
      case "sepia": { const s = 1 - Math.min(1, v);
        return [0.393 + 0.607 * s, 0.769 - 0.769 * s, 0.189 - 0.189 * s, 0, 0, 0.349 - 0.349 * s, 0.686 + 0.314 * s, 0.168 - 0.168 * s, 0, 0,
          0.272 - 0.272 * s, 0.534 - 0.534 * s, 0.131 + 0.869 * s, 0, 0, 0, 0, 0, 1, 0]; }
      case "hue-rotate": {
        const deg = /rad$/.test(f.arg) ? px(f.arg) * 180 / Math.PI : (/turn$/.test(f.arg) ? px(f.arg) * 360 : px(f.arg));
        const t = deg * Math.PI / 180, c = Math.cos(t), s = Math.sin(t);
        return [0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928, 0, 0,
          0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283, 0, 0,
          0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072, 0, 0, 0, 0, 0, 1, 0];
      }
      default: return I;
    }
  }
  function mulCM(a, b) {   // a ∘ b (önce b, sonra a)
    const o = new Array(20);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) { let s = 0; for (let k = 0; k < 4; k++) s += a[r * 5 + k] * b[k * 5 + c]; o[r * 5 + c] = s; }
      let s = a[r * 5 + 4]; for (let k = 0; k < 4; k++) s += a[r * 5 + k] * b[k * 5 + 4]; o[r * 5 + 4] = s;
    }
    return o;
  }

  /* ---------------- foreignObject: tarayıcının kendi çizimi ---------------- */
  const SKIP_PROPS = /^(transition|animation|will-change|transform|translate|rotate|scale|perspective|backface|mask|-webkit-mask|clip-path|filter|backdrop|mix-blend|offset|view-transition|anchor|cursor|pointer-events|user-select|-webkit-user|touch-action|content-visibility|contain)/;
  function copyStyle(src, dst, root) {
    const cs = getComputedStyle(src); let s = "";
    for (let i = 0; i < cs.length; i++) {
      const p = cs[i]; if (SKIP_PROPS.test(p)) continue;
      if (root && /^(position|left|top|right|bottom|inset|margin|opacity|visibility|z-index|float)/.test(p)) continue;
      const v = cs.getPropertyValue(p); if (v) s += p + ":" + v + ";";
    }
    if (root) s += "position:relative;left:0;top:0;margin:0;opacity:1;visibility:visible;";
    dst.setAttribute("style", s);
  }
  function cloneForRaster(el, deep, w, h) {
    const c = el.cloneNode(false); c.removeAttribute("id"); copyStyle(el, c, true);
    c.style.width = w + "px"; c.style.height = h + "px"; c.style.boxSizing = "border-box";
    if (deep) {
      (function walk(s, d) {
        s.childNodes.forEach(n => {
          if (n.nodeType === 3) d.appendChild(document.createTextNode(n.textContent));
          else if (n.nodeType === 1) { const k = n.cloneNode(false); k.removeAttribute("id"); copyStyle(n, k, false); d.appendChild(k); walk(n, k); }
        });
      })(el, c);
    } else el.childNodes.forEach(n => { if (n.nodeType === 3) c.appendChild(document.createTextNode(n.textContent)); });
    return c;
  }
  const ser = new XMLSerializer();
  async function rasterHTML(node, cssW, cssH, margin, r, fontCSS) {
    const tw = Math.max(1, Math.ceil((cssW + 2 * margin) * r)), th = Math.max(1, Math.ceil((cssH + 2 * margin) * r));
    const wrap = document.createElementNS(XHTML, "div");
    wrap.setAttribute("style", `position:absolute;left:${margin}px;top:${margin}px;width:${cssW}px;height:${cssH}px;`);
    wrap.appendChild(node);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${tw}" height="${th}" viewBox="0 0 ${tw / r} ${th / r}">` +
      (fontCSS ? `<style>${fontCSS}</style>` : "") +
      `<foreignObject x="0" y="0" width="${tw / r}" height="${th / r}">${ser.serializeToString(wrap)}</foreignObject></svg>`;
    const img = new Image();
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    await img.decode();
    const cv = document.createElement("canvas"); cv.width = tw + 2 * PAD; cv.height = th + 2 * PAD;
    cv.getContext("2d").drawImage(img, PAD, PAD, tw, th);
    return cv;
  }

  /* veri adresi (foreignObject dış dosya yükleyemez) */
  const dataCache = new Map();
  function toDataURL(url) {
    if (/^data:/.test(url)) return Promise.resolve(url);
    if (!dataCache.has(url)) dataCache.set(url, fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.blob(); })
      .then(b => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(b); })));
    return dataCache.get(url);
  }
  async function inlineURLs(css) {
    const urls = Array.from(new Set((css.match(/url\(("[^"]*"|'[^']*'|[^)]*)\)/g) || []).map(u => u.slice(4, -1).replace(/^["']|["']$/g, ""))));
    let out = css;
    for (const u of urls) { try { const d = await toDataURL(u); out = out.split(u).join(d); } catch (e) { /* çizilemeyen adres boş kalır */ } }
    return out;
  }

  /* yazı tipleri: sayfadaki Google Fonts tanımlarından yalnızca kullanılan aileler gömülür */
  const fontCache = { css: null, rules: null, embedded: new Map() };
  async function fontRules() {
    if (fontCache.rules) return fontCache.rules;
    const rules = [];
    const imports = new Set();
    for (const sh of Array.from(document.styleSheets)) {
      let list = null; try { list = sh.cssRules; } catch (e) { if (sh.href) imports.add(sh.href); continue; }
      for (const r of Array.from(list || [])) {
        try {
          if (r.type === CSSRule.IMPORT_RULE && r.href) imports.add(new URL(r.href, sh.href || document.baseURI).href);
          else if (r.type === CSSRule.FONT_FACE_RULE) rules.push({ css: r.cssText, base: sh.href || document.baseURI });
        } catch (e) { /* geçersiz adres: atlanır */ }
      }
    }
    for (const u of imports) {
      try {
        const t = await (await fetch(u)).text();
        (t.match(/@font-face\s*{[^}]*}/g) || []).forEach(css => rules.push({ css, base: u }));
      } catch (e) { /* çevrimdışı: sistem yazı tipi kullanılır */ }
    }
    fontCache.rules = rules;
    return rules;
  }
  async function fontCSSFor(families) {
    const key = Array.from(families).sort().join("|");
    if (!key) return "";
    if (fontCache.embedded.has(key)) return fontCache.embedded.get(key);
    const p = (async () => {
      const rules = await fontRules(); let out = "";
      for (const r of rules) {
        const fam = (/font-family:\s*["']?([^;"']+)/i.exec(r.css) || [])[1];
        if (!fam || !families.has(fam.trim().toLowerCase())) continue;
        if (/unicode-range/i.test(r.css) && !/U\+0000|U\+0100|U\+0-|U\+00/i.test(r.css)) continue;   // yalnızca Latin + Latin Genişletilmiş (Türkçe)
        let css = r.css.replace(/url\(("[^"]*"|'[^']*'|[^)]*)\)/g, (m, u) => { try { return `url("${new URL(u.replace(/^["']|["']$/g, ""), r.base).href}")`; } catch (e) { return m; } });
        out += await inlineURLs(css);
      }
      return out;
    })();
    fontCache.embedded.set(key, p);
    return p;
  }

  /* ---------------- WebGL ---------------- */
  const VS = `attribute vec4 aPos; attribute vec2 aUV; varying vec2 vUV; void main(){ gl_Position = aPos; vUV = aUV; }`;
  const FS = {
    tex: `precision mediump float; varying vec2 vUV; uniform sampler2D t; uniform float a; void main(){ gl_FragColor = texture2D(t, vUV) * a; }`,
    // derinlik ön geçişi: yalnızca (neredeyse) tam opak pikseller derinlik yazar
    depth: `precision mediump float; varying vec2 vUV; uniform sampler2D t; uniform float a; void main(){ if (texture2D(t, vUV).a * a < 0.94) discard; gl_FragColor = vec4(0.0); }`,
    cm: `precision mediump float; varying vec2 vUV; uniform sampler2D t; uniform mat4 m; uniform vec4 o;
      void main(){ vec4 c = texture2D(t, vUV); vec3 rgb = c.a > 0.0 ? c.rgb / c.a : vec3(0.0); vec4 u = clamp(m * vec4(rgb, c.a) + o, 0.0, 1.0); gl_FragColor = vec4(u.rgb * u.a, u.a); }`,
    blur: `precision mediump float; varying vec2 vUV; uniform sampler2D t; uniform vec2 d; uniform float s;
      void main(){ vec4 acc = vec4(0.0); float ws = 0.0;
        for (int i = -12; i <= 12; i++) { float x = float(i); float w = exp(-x * x / (2.0 * s * s)); acc += texture2D(t, vUV + d * x) * w; ws += w; }
        gl_FragColor = acc / ws; }`,
    tint: `precision mediump float; varying vec2 vUV; uniform sampler2D t; uniform vec4 c; void main(){ gl_FragColor = vec4(c.rgb * c.a, c.a) * texture2D(t, vUV).a; }`,
    mask: `precision mediump float; varying vec2 vUV; uniform sampler2D t; uniform sampler2D mk; uniform vec4 mt;
      void main(){ vec2 m = vec2(vUV.x * mt.x + mt.z, (1.0 - vUV.y) * mt.y + mt.w);
        float k = (m.x < 0.0 || m.y < 0.0 || m.x > 1.0 || m.y > 1.0) ? 0.0 : texture2D(mk, m).a;
        gl_FragColor = texture2D(t, vUV) * k; }`
  };

  function create(opt) {
    const OW = opt.width, OH = opt.height;
    const canvas = opt.canvas || document.createElement("canvas");
    canvas.width = OW; canvas.height = OH;
    const ctxOpt = { alpha: false, antialias: true, depth: true, premultipliedAlpha: true, preserveDrawingBuffer: true };
    const gl = canvas.getContext("webgl2", ctxOpt) || canvas.getContext("webgl", ctxOpt);
    const GL2 = typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext;
    const ZR = 4000;   // 3D derinlik aralığı (CSS px): ±4000
    if (!gl) throw new Error("Bu tarayıcıda WebGL kullanılamıyor; video çizilemez.");
    const MAXT = Math.min(4096, gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096);
    const warnings = new Set();
    const exclude = opt.exclude || ".sc-ui, .sc-loading, .seoz-entry-hint, [data-export-skip]";

    function sh(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
    const progs = {};
    Object.keys(FS).forEach(k => {
      const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS[k]));
      gl.bindAttribLocation(p, 0, "aPos"); gl.bindAttribLocation(p, 1, "aUV"); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const u = {}; ["t", "a", "m", "o", "d", "s", "c", "mk", "mt"].forEach(n => { u[n] = gl.getUniformLocation(p, n); });
      progs[k] = { p, u };
    });
    const vbuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbuf);
    gl.enableVertexAttribArray(0); gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 24, 0); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 24, 16);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.enable(gl.BLEND);

    function newTex(w, h, src) {
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (src) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      return t;
    }
    function upload(t, src) {
      gl.bindTexture(gl.TEXTURE_2D, t);
      try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); }
      catch (e) { throw new Error("Bir görsel güvenlik nedeniyle videoya çizilemedi (başka siteden yüklenmiş olabilir). Görseli bilgisayarınızdan yeniden yükleyip tekrar deneyin."); }
    }
    /* çerçeve tamponu havuzu */
    const fboPool = [];
    function getFBO(w, h) {
      w = Math.max(1, Math.min(MAXT, Math.ceil(w))); h = Math.max(1, Math.min(MAXT, Math.ceil(h)));
      let i = fboPool.findIndex(f => !f.busy && f.w === w && f.h === h);
      if (i < 0) { const tex = newTex(w, h); const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0); fboPool.push({ fb, tex, w, h, busy: false, flip: true }); i = fboPool.length - 1; }
      const f = fboPool[i]; f.busy = true; f.used = frameNo; return f;
    }
    const release = f => { if (f && f.fb) f.busy = false; };
    function ensureDepth(f) {
      if (!f || f.depth) return;
      const rb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
      gl.renderbufferStorage(gl.RENDERBUFFER, GL2 ? gl.DEPTH_COMPONENT24 : gl.DEPTH_COMPONENT16, f.w, f.h);
      gl.bindFramebuffer(gl.FRAMEBUFFER, f.fb); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
      f.depth = rb;
    }
    function bindTarget(f) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, f ? f.fb : null);
      gl.viewport(0, 0, f ? f.w : OW, f ? f.h : OH);
    }
    function clear(f, opaque) { bindTarget(f); gl.clearColor(0, 0, 0, opaque ? 1 : 0); gl.clear(gl.COLOR_BUFFER_BIT); }
    function blendMode(b) {
      if (b === "multiply") gl.blendFuncSeparate(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      else if (b === "screen") gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR);
      else if (b === "copy") gl.blendFunc(gl.ONE, gl.ZERO);
      else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }
    const quadBuf = new Float32Array(24);
    function drawVerts(v) { gl.bufferData(gl.ARRAY_BUFFER, v, gl.DYNAMIC_DRAW); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }
    /* tam yüzey geçişi (efekt adımları): giriş ve çıkış aynı yönlü */
    function pass(prog, srcTex, dst, setU, uvRect) {
      bindTarget(dst); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(prog.p); blendMode("copy");
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, srcTex); gl.uniform1i(prog.u.t, 0);
      if (prog.u.a) gl.uniform1f(prog.u.a, 1);
      if (setU) setU(prog.u);
      const r = uvRect || [0, 0, 1, 1];
      drawVerts(new Float32Array([-1, -1, 0, 1, r[0], r[1], 1, -1, 0, 1, r[2], r[1], -1, 1, 0, 1, r[0], r[3], 1, 1, 0, 1, r[2], r[3]]));
    }
    /* düzlemi hedefe çiz (perspektif doğru doku eşlemesi: w GPU'ya verilir) */
    /* pl.Z: 3D bağlamındaki derinlik matrisi (varsa piksel başına derinlik testi yapılır: kesişen düzlemler doğru görünür) */
    function drawPlane(pl, target, prog) {
      const tw = target ? target.w : OW, th = target ? target.h : OH;
      const q = pl.quad, ps = quadOut(pl.M, q);
      if (pl.cull && ps.every(p => p.w > 1e-6)) {
        const a = ps[0], b = ps[1], c = ps[2];
        const cross = (b.x / b.w - a.x / a.w) * (c.y / c.w - a.y / a.w) - (b.y / b.w - a.y / a.w) * (c.x / c.w - a.x / a.w);
        if (cross < 0) return;
      }
      const zs = pl.Z ? quadOut(pl.Z, q) : null;
      const u0 = pl.uv[0], v0 = pl.uv[1], u1 = pl.uv[2], v1 = pl.uv[3];
      const uvs = [[u0, v0], [u1, v0], [u0, v1], [u1, v1]];
      for (let i = 0; i < 4; i++) {
        const p = ps[i];
        const dz = zs && zs[i].w > 1e-6 ? Math.max(-0.999, Math.min(0.999, -(zs[i].z / zs[i].w) / ZR)) : 0;
        quadBuf[i * 6] = 2 * p.x / tw - p.w; quadBuf[i * 6 + 1] = p.w - 2 * p.y / th; quadBuf[i * 6 + 2] = dz * p.w; quadBuf[i * 6 + 3] = p.w;
        quadBuf[i * 6 + 4] = uvs[i][0]; quadBuf[i * 6 + 5] = uvs[i][1];
      }
      const P = prog || progs.tex;
      bindTarget(target); gl.useProgram(P.p); blendMode(pl.blend);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, pl.tex); gl.uniform1i(P.u.t, 0); gl.uniform1f(P.u.a, pl.alpha);
      drawVerts(quadBuf);
    }
    /* bir yüzeye düzlem listesini çiz: 3D bağlamları (ctx) için önce derinlik, sonra renk */
    function drawList(list, target) {
      let i = 0;
      while (i < list.length) {
        const c = list[i].ctx;
        if (c == null) { gl.disable(gl.DEPTH_TEST); drawPlane(list[i], target); i++; continue; }
        let j = i; while (j < list.length && list[j].ctx === c) j++;
        const run = list.slice(i, j);
        if (target) ensureDepth(target);
        bindTarget(target);
        gl.enable(gl.DEPTH_TEST); gl.clearDepth(1); gl.depthMask(true); gl.clear(gl.DEPTH_BUFFER_BIT);
        gl.depthFunc(gl.LESS); gl.colorMask(false, false, false, false);
        run.forEach(pl => drawPlane(pl, target, progs.depth));
        gl.colorMask(true, true, true, true); gl.depthMask(false); gl.depthFunc(gl.LEQUAL);
        run.forEach(pl => drawPlane(pl, target));
        gl.depthMask(true); gl.disable(gl.DEPTH_TEST);
        i = j;
      }
    }

    /* ---------------- sahne ağacı ---------------- */
    let frameNo = 0;
    const rasterCache = new Map();   // el → { key, tex, w, h, quad }
    const maskCache = new Map();
    let fontFamilies = new Set(), fontCSS = "";

    function hasBoxPaint(cs) {
      if (cs.backgroundImage !== "none") return true;
      const bg = cs.backgroundColor; if (bg && bg !== "transparent" && !/rgba\([^)]*,\s*0\)$/.test(bg)) return true;
      if (cs.boxShadow !== "none") return true;
      if ((px(cs.borderTopWidth) && cs.borderTopStyle !== "none") || (px(cs.borderLeftWidth) && cs.borderLeftStyle !== "none") ||
          (px(cs.borderRightWidth) && cs.borderRightStyle !== "none") || (px(cs.borderBottomWidth) && cs.borderBottomStyle !== "none")) return true;
      if (cs.outlineStyle !== "none" && px(cs.outlineWidth)) return true;
      return false;
    }
    const ownText = el => Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim());
    const MEDIA = { IMG: 1, VIDEO: 1, CANVAS: 1 };
    function simpleSubtree(el) {   // yazı ağırlıklı, hareketsiz alt ağaç: tek parça çizilebilir
      for (const d of el.querySelectorAll("*")) {
        if (MEDIA[d.tagName] || d.tagName === "svg" || d.tagName === "IFRAME") return false;
        const cs = getComputedStyle(d);
        if (cs.transform !== "none" || cs.position === "absolute" || cs.position === "fixed" || cs.filter !== "none" || cs.opacity !== "1" ||
            cs.maskImage !== "none" || cs.clipPath !== "none" || cs.mixBlendMode !== "normal" || cs.translate !== "none" || cs.rotate !== "none" || cs.scale !== "none") return false;
        if (d.getAnimations && d.getAnimations().length) return false;
      }
      return true;
    }
    function transformOf(cs, w, h) {
      let m = cs.transform && cs.transform !== "none" ? new DOMMatrix(cs.transform) : null;
      const parts = [];
      if (cs.translate && cs.translate !== "none") { const t = cs.translate.split(/\s+/); parts.push(`translate3d(${t[0] || 0},${t[1] || 0},${t[2] || 0})`); }
      if (cs.rotate && cs.rotate !== "none") {
        const t = cs.rotate.trim().split(/\s+/);
        if (t.length === 1) parts.push(`rotate(${t[0]})`);
        else if (t.length === 2) parts.push(`rotate3d(${t[0] === "x" ? "1,0,0" : t[0] === "y" ? "0,1,0" : "0,0,1"},${t[1]})`);
        else parts.push(`rotate3d(${t[0]},${t[1]},${t[2]},${t[3]})`);
      }
      if (cs.scale && cs.scale !== "none") { const t = cs.scale.split(/\s+/); parts.push(`scale3d(${t[0]},${t[1] || t[0]},${t[2] || 1})`); }
      if (parts.length) { const ind = new DOMMatrix(parts.join(" ")); m = m ? ind.multiply(m) : ind; }
      if (!m || m.isIdentity) return null;
      const o = cs.transformOrigin.split(/\s+/).map(px);
      return new DOMMatrix().translate(o[0], o[1], o[2] || 0).multiply(m).translate(-o[0], -o[1], -(o[2] || 0));
    }

    /* düzen konumu (dönüşümsüz) kök öğeye göre */
    function build(root, cssW, cssH) {
      const posMemo = new Map();
      const rootRect = { x: 0, y: 0 };
      function pos(el) {
        if (el === root || !el) return rootRect;
        if (posMemo.has(el)) return posMemo.get(el);
        const cs = getComputedStyle(el);
        let r;
        const op = el.offsetParent;
        if ((cs.position === "absolute" || cs.position === "fixed") && op && root.contains(op) || op === root) {
          const p = pos(op);
          const ocs = getComputedStyle(op);
          if (cs.position === "absolute" || cs.position === "fixed") r = { x: p.x + px(ocs.borderLeftWidth) + px(cs.left) + px(cs.marginLeft), y: p.y + px(ocs.borderTopWidth) + px(cs.top) + px(cs.marginTop) };
          else r = { x: p.x + px(ocs.borderLeftWidth) + el.offsetLeft, y: p.y + px(ocs.borderTopWidth) + el.offsetTop };
        } else if (op && root.contains(op)) {
          const p = pos(op), ocs = getComputedStyle(op);
          r = { x: p.x + px(ocs.borderLeftWidth) + el.offsetLeft, y: p.y + px(ocs.borderTopWidth) + el.offsetTop };
        } else if (cs.position === "fixed" || cs.position === "absolute") r = { x: px(cs.left), y: px(cs.top) };
        else r = { x: el.offsetLeft || 0, y: el.offsetTop || 0 };
        posMemo.set(el, r);
        return r;
      }
      function sizeOf(el, cs) {
        if (el.tagName === "svg" || el instanceof SVGElement) { const b = el.getBoundingClientRect(); return { w: px(cs.width) || b.width, h: px(cs.height) || b.height }; }
        let w = px(cs.width), h = px(cs.height);
        if (cs.boxSizing !== "border-box") {
          w += px(cs.paddingLeft) + px(cs.paddingRight) + px(cs.borderLeftWidth) + px(cs.borderRightWidth);
          h += px(cs.paddingTop) + px(cs.paddingBottom) + px(cs.borderTopWidth) + px(cs.borderBottomWidth);
        }
        if (cs.display === "inline") { w = el.offsetWidth; h = el.offsetHeight; }
        return { w, h };
      }
      let order = 0;
      function node(el, parent, pcs) {
        if (el.nodeType !== 1 || el.matches(exclude)) return null;
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.display === "contents" && false) return null;
        const op = parseFloat(cs.opacity);
        if (op <= 0.002) return null;
        const { w, h } = sizeOf(el, cs);
        const n = { el, cs, w, h, opacity: isFinite(op) ? op : 1, children: [], order: order++, z: cs.zIndex === "auto" ? 0 : (parseInt(cs.zIndex, 10) || 0) };
        // yerel matris: ebeveynin perspektifi × konum × kendi dönüşümü
        let L = new DOMMatrix();
        if (parent && pcs.perspective !== "none") {
          const d = px(pcs.perspective), po = pcs.perspectiveOrigin.split(/\s+/).map(px);
          if (d > 0) L = L.translate(po[0], po[1]).multiply(new DOMMatrix([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, -1 / d, 0, 0, 0, 1])).translate(-po[0], -po[1]);
        }
        if (parent) { const a = pos(el), b = pos(parent.el); L = L.translate(a.x - b.x, a.y - b.y); }
        const T = transformOf(cs, w, h); if (T) L = L.multiply(T);
        n.local = L;
        n.filters = parseFilter(cs.filter);
        n.mask = cs.maskImage && cs.maskImage !== "none" ? cs.maskImage : (cs.webkitMaskImage && cs.webkitMaskImage !== "none" ? cs.webkitMaskImage : null);
        n.clipPath = cs.clipPath && cs.clipPath !== "none" ? cs.clipPath : null;
        // <img>/<video>/<canvas> kendi kutusuna zaten kırpılır (overflow:clip varsayılanı); ayrı yüzey gerekmez
        n.clip = el !== root && !MEDIA[el.tagName] && (cs.overflowX !== "visible" || cs.overflowY !== "visible") && !(el instanceof SVGElement);
        n.blend = cs.mixBlendMode || "normal";
        if (n.blend !== "normal" && n.blend !== "multiply" && n.blend !== "screen") warnings.add(`“${n.blend}” karışım modu videoda yaklaşık (normal) çizildi.`);
        if (cs.backdropFilter && cs.backdropFilter !== "none") warnings.add("Arka planı bulanıklaştırma (backdrop-filter) videoda uygulanmadı.");
        n.backHidden = cs.backfaceVisibility === "hidden";
        n.hidden = cs.visibility !== "visible";
        // boya: medya, svg, kutu, yazı
        const tag = el.tagName;
        if (!n.hidden) {
          if (MEDIA[tag]) n.paint = tag.toLowerCase();
          else if (tag === "svg") n.paint = "svg";
          else if (!(el instanceof SVGElement)) {
            const txt = ownText(el), box = hasBoxPaint(cs);
            if (el.children.length && (txt || box) && simpleSubtree(el)) n.paint = "deep";
            else if (txt || box) n.paint = "box";
          }
          if (n.paint === "deep" || (n.paint === "box" && ownText(el))) cs.fontFamily.split(",").forEach(f => fontFamilies.add(f.trim().replace(/^["']|["']$/g, "").toLowerCase()));
        }
        const flat3d = n.opacity < 1 || n.filters.length || n.mask || n.clipPath || n.clip || n.blend !== "normal";
        n.p3d = cs.transformStyle === "preserve-3d" && !flat3d;
        if (n.paint !== "deep" && tag !== "svg" && !MEDIA[tag]) {
          for (const c of el.children) { const k = node(c, n, cs); if (k) n.children.push(k); }
          n.children.sort((a, b) => a.z - b.z || a.order - b.order);
        }
        n.group = !!(n.filters.length || n.mask || n.clipPath || n.clip || (n.opacity < 1 && n.children.length) || (n.blend !== "normal" && n.children.length));
        return n;
      }
      const r = node(root, null, null);
      return r;
    }

    /* ---------------- çizim hazırlığı (async): yaprak dokuları ---------------- */
    function rasterKey(n, r) {
      const cs = n.cs;
      const sig = [n.paint, n.w.toFixed(2), n.h.toFixed(2), r, cs.backgroundColor, cs.backgroundImage, cs.backgroundSize, cs.backgroundPosition, cs.borderRadius,
        cs.boxShadow, cs.borderTopColor, cs.borderTopWidth, cs.borderLeftWidth, cs.color, cs.font, cs.letterSpacing, cs.textShadow, cs.textAlign, cs.objectFit, cs.objectPosition];
      if (n.paint === "deep" || n.paint === "svg") sig.push(n.el.innerHTML);
      else if (n.paint === "box") sig.push(n.el.textContent);
      if (n.paint === "img") sig.push(n.el.currentSrc || n.el.src);
      return sig.join("¦");
    }
    function shadowMargin(cs) {
      let m = 0;
      if (cs.boxShadow !== "none") cs.boxShadow.split(/,(?![^(]*\))/).forEach(s => { if (/inset/.test(s)) return; const nums = s.replace(/rgba?\([^)]*\)/, "").trim().split(/\s+/).map(px); m = Math.max(m, Math.abs(nums[0] || 0) + Math.abs(nums[1] || 0) + (nums[2] || 0) + Math.max(0, nums[3] || 0)); });
      if (cs.textShadow !== "none") m = Math.max(m, 24);
      return Math.ceil(m);
    }
    function fitRect(cs, bw, bh, iw, ih) {
      const fit = cs.objectFit || "fill";
      let w = bw, h = bh;
      if (fit === "contain" || fit === "scale-down") { const k = Math.min(bw / iw, bh / ih); w = iw * k; h = ih * k; if (fit === "scale-down" && k > 1) { w = iw; h = ih; } }
      else if (fit === "cover") { const k = Math.max(bw / iw, bh / ih); w = iw * k; h = ih * k; }
      else if (fit === "none") { w = iw; h = ih; }
      const op = (cs.objectPosition || "50% 50%").split(/\s+/);
      const ax = v => /%$/.test(v) ? parseFloat(v) / 100 : null;
      const fx = ax(op[0]), fy = ax(op[1] || "50%");
      const x = fx != null ? (bw - w) * fx : px(op[0]), y = fy != null ? (bh - h) * fy : px(op[1]);
      return { x, y, w, h };
    }
    function roundClip(ctx, cs, w, h, k) {
      const rad = ["borderTopLeftRadius", "borderTopRightRadius", "borderBottomRightRadius", "borderBottomLeftRadius"].map(p => {
        const v = cs[p].split(/\s+/); const f = (s, d) => /%$/.test(s) ? parseFloat(s) / 100 * d : px(s);
        return { x: f(v[0], w) * k, y: f(v[1] || v[0], h) * k };
      });
      if (!rad.some(r => r.x || r.y)) return;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(0, 0, w * k, h * k, rad.map(r => ({ x: r.x, y: r.y })));
      else ctx.rect(0, 0, w * k, h * k);
      ctx.clip();
    }
    async function rasterOwn(n, r) {
      const el = n.el, cs = n.cs;
      // videolar ve tuvaller her karede değişir; diğerleri anahtar değişmedikçe yeniden çizilmez
      const live = n.paint === "video" || n.paint === "canvas";
      const key = live ? null : rasterKey(n, r);
      const c0 = rasterCache.get(el);
      if (c0 && !live && c0.key === key) { c0.used = frameNo; return c0; }
      let cv, quad;
      if (n.paint === "img" || n.paint === "video" || n.paint === "canvas") {
        const iw = n.paint === "img" ? el.naturalWidth : n.paint === "video" ? el.videoWidth : el.width;
        const ih = n.paint === "img" ? el.naturalHeight : n.paint === "video" ? el.videoHeight : el.height;
        if (n.paint === "img" && !el.complete) { try { await el.decode(); } catch (e) { /* önemsiz */ } }
        if (!iw || !ih) return null;
        if (n.paint === "canvas" && cs.objectFit === "fill" && !/radius/.test(cs.borderRadius) && px(cs.borderRadius) === 0) {
          // tuval: doğrudan doku (en hızlı yol)
          const ent = c0 && c0.direct ? c0 : { direct: true, tex: newTex(1, 1) };
          upload(ent.tex, el);
          Object.assign(ent, { used: frameNo, quad: { x: 0, y: 0, w: n.w, h: n.h }, uv: [0, 0, 1, 1], pw: 0 });
          rasterCache.set(el, ent);
          return ent;
        }
        let k = r;
        if (n.paint === "img") k = Math.min(r, Math.max(iw / Math.max(1, n.w), ih / Math.max(1, n.h)) * 1.05);
        const tw = Math.max(1, Math.min(MAXT - 2, Math.ceil(n.w * k))), th = Math.max(1, Math.min(MAXT - 2, Math.ceil(n.h * k)));
        k = Math.min(tw / Math.max(1e-3, n.w), th / Math.max(1e-3, n.h));
        cv = c0 && c0.cv && c0.cv.width === tw + 2 * PAD && c0.cv.height === th + 2 * PAD ? c0.cv : document.createElement("canvas");
        cv.width = tw + 2 * PAD; cv.height = th + 2 * PAD;
        const ctx = cv.getContext("2d"); ctx.clearRect(0, 0, cv.width, cv.height);
        ctx.save(); ctx.translate(PAD, PAD); roundClip(ctx, cs, n.w, n.h, k);
        const f = fitRect(cs, n.w, n.h, iw, ih);
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
        try { ctx.drawImage(el, f.x * k, f.y * k, f.w * k, f.h * k); } catch (e) { ctx.restore(); return null; }
        ctx.restore();
        quad = { x: -PAD / k, y: -PAD / k, w: (tw + 2 * PAD) / k, h: (th + 2 * PAD) / k };
      } else if (n.paint === "svg") {
        const c = el.cloneNode(true);
        c.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        c.setAttribute("width", n.w); c.setAttribute("height", n.h);
        const srcAll = [el].concat(Array.from(el.querySelectorAll("*"))), dstAll = [c].concat(Array.from(c.querySelectorAll("*")));
        srcAll.forEach((s, i) => { const k = getComputedStyle(s), d = dstAll[i]; if (!d) return;
          d.setAttribute("style", `fill:${k.fill};stroke:${k.stroke};stroke-width:${k.strokeWidth};opacity:${i ? k.opacity : 1};fill-opacity:${k.fillOpacity};stroke-opacity:${k.strokeOpacity};stop-color:${k.stopColor};stop-opacity:${k.stopOpacity};color:${k.color}`); });
        const img = new Image(); img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(ser.serializeToString(c));
        try { await img.decode(); } catch (e) { return null; }
        const tw = Math.max(1, Math.ceil(n.w * r)), th = Math.max(1, Math.ceil(n.h * r));
        cv = document.createElement("canvas"); cv.width = tw + 2 * PAD; cv.height = th + 2 * PAD;
        cv.getContext("2d").drawImage(img, PAD, PAD, tw, th);
        quad = { x: -PAD / r, y: -PAD / r, w: (tw + 2 * PAD) / r, h: (th + 2 * PAD) / r };
      } else {
        const m = shadowMargin(cs) + (n.paint === "deep" || ownText(el) ? 16 : 0);
        const clone = cloneForRaster(el, n.paint === "deep", n.w, n.h);
        const html = clone.getAttribute("style") || "";
        if (/url\(/.test(html)) clone.setAttribute("style", await inlineURLs(html));
        try { cv = await rasterHTML(clone, n.w, n.h, m, r, fontCSS); }
        catch (e) { warnings.add("Bir süs öğesi çizilemedi ve videoda boş kaldı."); return null; }
        quad = { x: -m - PAD / r, y: -m - PAD / r, w: n.w + 2 * m + 2 * PAD / r, h: n.h + 2 * m + 2 * PAD / r };
      }
      const ent = c0 && c0.tex && !c0.direct ? c0 : { tex: newTex(1, 1) };
      upload(ent.tex, cv);
      Object.assign(ent, { key, cv: live ? cv : null, used: frameNo, quad, uv: [0, 0, 1, 1], direct: false });
      rasterCache.set(el, ent);
      return ent;
    }
    /* maske + kırpma: tarayıcıya aynı CSS ile siyah bir kutu çizdirilir (saydamlık = maske) */
    async function rasterMask(n, r) {
      const cs = n.cs;
      const style = ["background:#000", `width:${n.w}px`, `height:${n.h}px`];
      if (n.mask) ["mask-image", "mask-size", "mask-position", "mask-repeat", "mask-mode", "mask-origin", "mask-clip", "mask-composite"].forEach(p => {
        const v = cs.getPropertyValue(p) || cs.getPropertyValue("-webkit-" + p); if (v) { style.push(`${p}:${v}`, `-webkit-${p}:${v}`); }
      });
      if (n.mask && !cs.getPropertyValue("mask-image").replace("none", "")) { style.push(`-webkit-mask-image:${n.mask}`, `mask-image:${n.mask}`); }
      if (n.clipPath) style.push(`clip-path:${cs.clipPath}`);
      if (n.clip) style.push(`border-radius:${cs.borderRadius}`);
      let css = style.join(";");
      const key = css + "|" + r;
      const c0 = maskCache.get(n.el);
      if (c0 && c0.key === key) { c0.used = frameNo; return c0; }
      if (/url\(/.test(css)) css = await inlineURLs(css);
      const d = document.createElementNS(XHTML, "div"); d.setAttribute("style", css);
      let cv;
      try { cv = await rasterHTML(d, n.w, n.h, 0, r, ""); } catch (e) { warnings.add("Bir maske çizilemedi; katman maskesiz çizildi."); return null; }
      const ent = c0 || { tex: newTex(1, 1) };
      upload(ent.tex, cv);
      Object.assign(ent, { key, used: frameNo, tw: cv.width, th: cv.height, r });
      maskCache.set(n.el, ent);
      return ent;
    }

    /* çıktı matrislerini hesapla, gereken dokuları hazırla */
    async function prepare(n, Mout, parentFlat) {
      const M = parentFlat ? Mout.multiply(FLAT).multiply(n.local) : Mout.multiply(n.local);
      n.Mout = M;
      const box = { x: 0, y: 0, w: n.w, h: n.h };
      n.r = qScale(scaleOf(M, box) || 1);
      const jobs = [];
      if (n.paint) jobs.push(rasterOwn(n, n.r).then(e => { n.raster = e; }));
      if (n.group && (n.mask || n.clipPath || n.clip)) jobs.push(rasterMask(n, n.r).then(e => { n.maskTex = e; }));
      for (const c of n.children) jobs.push(prepare(c, M, !n.p3d));
      await Promise.all(jobs);
    }

    /* ---------------- çizim (GPU) ---------------- */
    function zw(D, x, y) { const p = D.transformPoint(new DOMPoint(x, y, 0, 1)); return p.w > 1e-6 ? p.z / p.w : -1e9; }
    let ctxSeq = 0;
    /* düğümün düzlemlerini "out" listesine ekler.
       M: düğüm → hedef yüzey · Z: dış 3D bağlamında derinlik matrisi (derinlik testi) · S: en içteki 3D bağlamında sıralama matrisi
       Ebeveyn düzse (preserve-3d değil) çocuklar ebeveynin düzlemine yassılır (FLAT). */
    function emit(n, M, Z, S, out, ctx, parentP3d) {
      const dk = S ? zw(S, n.w / 2, n.h / 2) : null;
      if (n.group) {
        const g = renderGroup(n, M);
        if (g) out.push({ tex: g.tex, quad: g.quad, uv: [0, 1, 1, 0], M, Z, ctx, alpha: n.opacity, blend: n.blend, cull: n.backHidden, dk, fbo: g.fbo });
        return;
      }
      const ctxRoot = n.p3d && !parentP3d;
      const list = ctxRoot ? [] : out;
      const Sin = ctxRoot ? n.local : S;
      const Zin = ctxRoot && !Z ? n.local : Z;
      const ctxIn = ctxRoot && ctx == null ? ++ctxSeq : ctx;
      const step = c => (n.p3d ? c.local : FLAT.multiply(c.local));
      const child = c => { const k = step(c); emit(c, M.multiply(k), Zin ? Zin.multiply(k) : null, Sin ? Sin.multiply(k) : null, list, ctxIn, n.p3d); };
      n.children.filter(c => c.z < 0).forEach(child);
      if (n.raster) list.push({ tex: n.raster.tex, quad: n.raster.quad, uv: n.raster.uv, M, Z: Zin, ctx: ctxIn, alpha: n.opacity, blend: n.blend, cull: n.backHidden, dk: Sin ? zw(Sin, n.w / 2, n.h / 2) : null });
      n.children.filter(c => c.z >= 0).forEach(child);
      if (ctxRoot) {
        list.forEach((p, i) => { p.seq = i; });
        list.sort((x, y) => (x.dk == null || y.dk == null ? 0 : x.dk - y.dk) || x.seq - y.seq);
        list.forEach(p => { p.dk = dk; out.push(p); });
      }
    }
    /* grup: alt ağacı kendi düzleminde bir yüzeye çiz, efektleri uygula */
    function renderGroup(n, M) {
      // içeriği düğümün yerel düzleminde topla (grup kendi içinde düz)
      const inner = [];
      const asLeaf = Object.assign({}, n, { group: false, p3d: false, opacity: 1, blend: "normal", backHidden: false });
      emit(asLeaf, ID, null, null, inner, null, false);
      if (!inner.length) return null;
      let B = null;
      inner.forEach(p => {
        const ps = quadOut(p.M, p.quad);
        if (ps.some(q => q.w <= 1e-6)) { B = unionRect(B, expandRect({ x: 0, y: 0, w: n.w, h: n.h }, n.w, n.h, n.w, n.h)); return; }
        const xs = ps.map(q => q.x / q.w), ys = ps.map(q => q.y / q.w);
        const x = Math.min(...xs), y = Math.min(...ys);
        B = unionRect(B, { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y });
      });
      const ext = filterExtent(n.filters);
      B = expandRect(B, ext.l, ext.t, ext.r, ext.b);
      if (n.clip || n.mask || n.clipPath) B = interRect(B, { x: 0, y: 0, w: n.w, h: n.h });
      // aşırı büyük yüzeyleri sınırla (ekran dışı)
      B = interRect(B, expandRect({ x: 0, y: 0, w: n.w, h: n.h }, Math.max(n.w, 600), Math.max(n.h, 600), Math.max(n.w, 600), Math.max(n.h, 600)));
      if (B.w < 0.5 || B.h < 0.5) return null;
      let r = qScale(scaleOf(M, B) || 1);
      r = Math.min(r, (MAXT - 2) / B.w, (MAXT - 2) / B.h);
      if (B.w * r * B.h * r > 3 * OW * OH) r = Math.sqrt(3 * OW * OH / (B.w * B.h));
      B = expandRect(B, PAD / r, PAD / r, PAD / r, PAD / r);
      const sw = Math.ceil(B.w * r), sh = Math.ceil(B.h * r);
      const base = new DOMMatrix().scale(r, r).translate(-B.x, -B.y);
      let surf = getFBO(sw, sh);
      clear(surf, false);
      inner.forEach(p => { p.M = base.multiply(p.M); });
      drawList(inner, surf);
      inner.forEach(p => { if (p.fbo) release(p.fbo); });
      // filtreler sırayla
      let cm = null;
      const flushCM = () => {
        if (!cm) return;
        const o = getFBO(sw, sh);
        pass(progs.cm, surf.tex, o, u => {
          gl.uniformMatrix4fv(u.m, false, new Float32Array([cm[0], cm[5], cm[10], cm[15], cm[1], cm[6], cm[11], cm[16], cm[2], cm[7], cm[12], cm[17], cm[3], cm[8], cm[13], cm[18]]));
          gl.uniform4f(u.o, cm[4], cm[9], cm[14], cm[19]);
        });
        release(surf); surf = o; cm = null;
      };
      for (const f of n.filters) {
        if (f.fn === "blur") { flushCM(); surf = blurSurf(surf, px(f.arg) * r); }
        else if (f.fn === "drop-shadow") { flushCM(); surf = dropShadow(surf, parseShadow(f.arg), r); }
        else if (f.fn === "url") warnings.add("SVG filtresi (url) videoda uygulanmadı.");
        else cm = cm ? mulCM(colorMatrix(f), cm) : colorMatrix(f);
      }
      flushCM();
      if (n.maskTex) {
        const mk = n.maskTex, o = getFBO(sw, sh);
        // yüzey uv → maske uv: css = B.x + u*B.w ; maske: (css*mr + PAD)/tw
        const mr = mk.r;
        pass(progs.mask, surf.tex, o, u => {
          gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, mk.tex); gl.uniform1i(u.mk, 1);
          gl.uniform4f(u.mt, B.w * mr / mk.tw, B.h * mr / mk.th, (B.x * mr + PAD) / mk.tw, (B.y * mr + PAD) / mk.th);
          gl.activeTexture(gl.TEXTURE0);
        });
        release(surf); surf = o;
      }
      return { tex: surf.tex, fbo: surf, quad: B };
    }
    function blurSurf(s, sigma) {
      if (sigma < 0.3) return s;
      // büyük bulanıklıkta önce küçült (kalite kaybı görünmez), sonra iki yönlü Gauss
      const f = Math.max(1, Math.ceil(sigma / 4));
      let src = s;
      if (f > 1) { const d = getFBO(s.w / f, s.h / f); pass(progs.tex, s.tex, d); release(s); src = d; }
      const sg = sigma / f;
      const a = getFBO(src.w, src.h);
      pass(progs.blur, src.tex, a, u => { gl.uniform2f(u.d, 1 / src.w * Math.max(1, sg / 4), 0); gl.uniform1f(u.s, Math.min(sg, 4) ); });
      const b = getFBO(src.w, src.h);
      pass(progs.blur, a.tex, b, u => { gl.uniform2f(u.d, 0, 1 / src.h * Math.max(1, sg / 4)); gl.uniform1f(u.s, Math.min(sg, 4)); });
      release(a); release(src);
      if (f > 1) { const up = getFBO(s.w, s.h); pass(progs.tex, b.tex, up); release(b); return up; }
      return b;
    }
    function dropShadow(s, d, r) {
      let sh = getFBO(s.w, s.h);
      pass(progs.tint, s.tex, sh, u => { gl.uniform4f(u.c, d.color[0], d.color[1], d.color[2], d.color[3]); });
      sh = blurSurf(sh, d.blur / 2 * r);
      const o = getFBO(s.w, s.h);
      const dx = d.x * r / s.w, dy = d.y * r / s.h;
      pass(progs.tex, sh.tex, o, null, [-dx, dy, 1 - dx, 1 + dy]);
      // kaynağı gölgenin üstüne
      bindTarget(o); gl.useProgram(progs.tex.p); blendMode("normal");
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, s.tex); gl.uniform1f(progs.tex.u.a, 1);
      drawVerts(new Float32Array([-1, -1, 0, 1, 0, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1]));
      release(sh); release(s);
      return o;
    }

    const perf = { build: 0, prepare: 0, gl: 0, n: 0 };
    async function render(root, cssW, cssH) {
      frameNo++;
      const tq = () => (W.__vclock ? W.__vclock.real.perfNow() : 0);
      let q0 = tq();
      fontFamilies = new Set();
      const tree = build(root, cssW, cssH);
      perf.build += tq() - q0; q0 = tq();
      if (!tree) throw new Error("Sahne bulunamadı.");
      const fam = Array.from(fontFamilies).filter(f => !/^(serif|sans-serif|cursive|monospace|system-ui|fantasy|-apple-system|blinkmacsystemfont|segoe ui|arial|helvetica)$/.test(f));
      fontCSS = await fontCSSFor(new Set(fam));
      const S = new DOMMatrix().scale(OW / cssW, OH / cssH);
      await prepare(tree, S, true);
      perf.prepare += tq() - q0; q0 = tq();
      const out = [];
      ctxSeq = 0;
      emit(tree, S.multiply(tree.local), null, null, out, null, false);
      clear(null, true);
      drawList(out, null);
      out.forEach(p => { if (p.fbo) release(p.fbo); });
      perf.gl += tq() - q0; perf.n++;
      fboPool.forEach(f => { f.busy = false; });
      // kullanılmayan dokuları bırak
      for (const [el, e] of rasterCache) if (frameNo - (e.used || 0) > 3) { gl.deleteTexture(e.tex); rasterCache.delete(el); }
      for (const [el, e] of maskCache) if (frameNo - (e.used || 0) > 3) { gl.deleteTexture(e.tex); maskCache.delete(el); }
      for (let i = fboPool.length - 1; i >= 0; i--) if (frameNo - (fboPool[i].used || 0) > 6) { if (fboPool[i].depth) gl.deleteRenderbuffer(fboPool[i].depth); gl.deleteFramebuffer(fboPool[i].fb); gl.deleteTexture(fboPool[i].tex); fboPool.splice(i, 1); }
      const err = gl.getError();
      if (err && err !== gl.NO_ERROR && !render.errWarned) { render.errWarned = true; warnings.add("Grafik kartı bir uyarı verdi (kod " + err + "); görüntüyü kontrol edin."); }
      if (gl.isContextLost()) throw new Error("Grafik bağlamı kayboldu (bellek yetersiz olabilir). Daha düşük kalite ile tekrar deneyin.");
    }

    return { canvas, gl, render, warnings, get perf() { const n = Math.max(1, perf.n); return { build: Math.round(perf.build / n), prepare: Math.round(perf.prepare / n), gl: Math.round(perf.gl / n) }; } };
  }

  W.SeozFrameCompositor = { create, _test: { parseFilter, colorMatrix, parseShadow } };
})(window);
