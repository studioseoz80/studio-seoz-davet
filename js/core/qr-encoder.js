/* =============================================================================
   STUDIO SEOZ EDİTÖRÜ — core/qr-encoder.js  (YENİ — QR KOD MOTORU)
   -----------------------------------------------------------------------------
   Tamamen tarayıcı tarafında, HİÇBİR harici API/servis/üyelik olmadan
   çalışan bir QR kod kodlayıcı. ISO/IEC 18004 standardının genel
   algoritmasını (Reed-Solomon hata düzeltme + matris yerleştirme)
   uygular — bu standart, herkesin kendi bağımsız uygulamasını
   yazabileceği açık, patentsiz bir algoritmadır.

   KASITLI SINIRLAMA (risk azaltma): Yalnızca 1-5 arası QR sürümleri
   (Reed-Solomon TEK BLOK — birden fazla blok "interleaving" gerektiren
   daha yüksek sürümler desteklenmez) ve Hata Düzeltme Seviyesi L
   (%7 — en yüksek veri kapasitesi) desteklenir. Bu, ~106 bayta kadar
   (çoğu web sitesi/Google Form/PDF bağlantısı için yeterli) güvenilir
   şekilde kodlama yapar. Daha uzun bir bağlantı girilirse, QR modülü
   YANLIŞ/TARANAMAZ bir kod üretmek yerine AÇIKÇA bir hata gösterir
   (bkz. modules/qrcode.js).
   ========================================================================= */

(function (global) {
  "use strict";

  // ---- GF(256) tabloları (QR'nin ilkel polinomu: x^8 + x^4 + x^3 + x^2 + 1 = 0x11D) ----
  const GF_EXP = new Array(512);
  const GF_LOG = new Array(256);
  (function initGF() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      GF_EXP[i] = x;
      GF_LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11D;
    }
    for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
  })();

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return GF_EXP[GF_LOG[a] + GF_LOG[b]];
  }

  // Reed-Solomon üretici polinomu (derece = ecCount)
  function rsGeneratorPoly(ecCount) {
    let poly = [1];
    for (let i = 0; i < ecCount; i++) {
      const next = new Array(poly.length + 1).fill(0);
      for (let j = 0; j < poly.length; j++) {
        next[j] ^= gfMul(poly[j], 1);
        next[j + 1] ^= gfMul(poly[j], GF_EXP[i]);
      }
      poly = next;
    }
    return poly; // yüksek dereceden düşüğe
  }

  // Veri kodsözcüklerinden Reed-Solomon hata düzeltme kodsözcüklerini üretir.
  function rsEncode(dataCodewords, ecCount) {
    const generator = rsGeneratorPoly(ecCount);
    const result = dataCodewords.concat(new Array(ecCount).fill(0));
    for (let i = 0; i < dataCodewords.length; i++) {
      const coef = result[i];
      if (coef === 0) continue;
      for (let j = 0; j < generator.length; j++) {
        result[i + j] ^= gfMul(generator[j], coef);
      }
    }
    return result.slice(dataCodewords.length);
  }

  // ---- Sürüm 1-5, Hata Düzeltme Seviyesi L — TEK BLOK tablosu ----
  // [toplam kodsözcük, veri kodsözcüğü, hata düzeltme kodsözcüğü]
  const VERSION_TABLE = {
    1: { total: 26, data: 19, ec: 7 },
    2: { total: 44, data: 34, ec: 10 },
    3: { total: 70, data: 55, ec: 15 },
    4: { total: 100, data: 80, ec: 20 },
    5: { total: 134, data: 108, ec: 26 }
  };

  function sizeForVersion(v) { return 17 + 4 * v; }

  // Sürüm 2-5 için tek hizalama deseni merkezi (sürüm 1'de hizalama deseni yok).
  function alignmentCenter(v) {
    if (v === 1) return null;
    return sizeForVersion(v) - 7;
  }

  // ---- Format bilgisi (15 bit, BCH(15,5)) — algoritmik olarak hesaplanır,
  // ezbere bir tablo yerine — yanlış hatırlanan bir tablo riskini önler. ----
  function computeFormatBits(ecLevelBits, maskPattern) {
    const data = (ecLevelBits << 3) | maskPattern; // 5 bit
    let d = data << 10;
    const gen = 0x537; // derece 10 üretici polinom (QR standardı)
    for (let i = 4; i >= 0; i--) {
      if (d & (1 << (i + 10))) d ^= gen << i;
    }
    const bits = (data << 10) | d;
    return bits ^ 0x5412; // sabit format maskesi
  }

  function encodeByteMode(text, version) {
    const bytes = [];
    // UTF-8 kodlama (URL'ler ASCII olur genelde, ama Türkçe açıklama vs. için güvenli).
    for (let i = 0; i < text.length; i++) {
      const code = text.codePointAt(i);
      if (code > 0xFFFF) i++; // sürrogat çifti atla
      if (code < 0x80) bytes.push(code);
      else if (code < 0x800) {
        bytes.push(0xC0 | (code >> 6), 0x80 | (code & 0x3F));
      } else if (code < 0x10000) {
        bytes.push(0xE0 | (code >> 12), 0x80 | ((code >> 6) & 0x3F), 0x80 | (code & 0x3F));
      } else {
        bytes.push(0xF0 | (code >> 18), 0x80 | ((code >> 12) & 0x3F), 0x80 | ((code >> 6) & 0x3F), 0x80 | (code & 0x3F));
      }
    }

    const table = VERSION_TABLE[version];
    const capacityBits = table.data * 8;

    const bits = [];
    function pushBits(value, len) {
      for (let i = len - 1; i >= 0; i--) bits.push((value >> i) & 1);
    }
    pushBits(0b0100, 4); // bayt modu göstergesi
    pushBits(bytes.length, 8); // karakter sayısı göstergesi (sürüm 1-9, bayt modu: 8 bit)
    bytes.forEach(b => pushBits(b, 8));

    // Sonlandırıcı (en fazla 4 bit, kapasiteyi aşmadan).
    const terminatorLen = Math.min(4, capacityBits - bits.length);
    if (terminatorLen > 0) pushBits(0, terminatorLen);

    // Bayt sınırına tamamla.
    while (bits.length % 8 !== 0) bits.push(0);

    // Kodsözcüklere çevir.
    const codewords = [];
    for (let i = 0; i < bits.length; i += 8) {
      let byte = 0;
      for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
      codewords.push(byte);
    }

    // Dolgu kodsözcükleri (0xEC, 0x11 dönüşümlü) — kapasiteye ulaşana kadar.
    const padBytes = [0xEC, 0x11];
    let padIdx = 0;
    while (codewords.length < table.data) {
      codewords.push(padBytes[padIdx % 2]);
      padIdx++;
    }

    return codewords;
  }

  // Verilen metin için en küçük UYGUN sürümü seçer (1-5 arası).
  // Sığmıyorsa null döner — modules/qrcode.js bunu kullanıcıya AÇIKÇA bildirir.
  function pickVersion(text) {
    // Kaba bir üst sınır tahmini (UTF-8 en kötü durum: karakter başına 4 bayt).
    for (let v = 1; v <= 5; v++) {
      const table = VERSION_TABLE[v];
      // Gerçek bayt uzunluğunu hesaplamadan önce hızlı bir kaba kontrol:
      const roughBytes = encodeByteMode(text, v).length <= table.data ? true : null;
      // encodeByteMode zaten dolgu ekliyor; asıl kontrol edilmesi gereken
      // dolgudan ÖNCEKİ ham veri + başlık bitinin kapasiteye sığıp
      // sığmadığıdır — bunu ayrı, net bir şekilde tekrar hesaplayalım:
      const bytesLen = (() => {
        let n = 0;
        for (let i = 0; i < text.length; i++) {
          const code = text.codePointAt(i);
          if (code > 0xFFFF) i++;
          n += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
        }
        return n;
      })();
      const neededBits = 4 + 8 + bytesLen * 8;
      if (neededBits <= table.data * 8) return v;
    }
    return null;
  }

  // ---- Matris yerleştirme ----
  function buildMatrix(version, dataCodewordsWithEC) {
    const size = sizeForVersion(version);
    const modules = Array.from({ length: size }, () => new Array(size).fill(null));
    const reserved = Array.from({ length: size }, () => new Array(size).fill(false));

    function setModule(r, c, val, isReserved) {
      if (r < 0 || r >= size || c < 0 || c >= size) return;
      modules[r][c] = val;
      if (isReserved) reserved[r][c] = true;
    }

    function placeFinder(r, c) {
      for (let dr = -1; dr <= 7; dr++) {
        for (let dc = -1; dc <= 7; dc++) {
          const rr = r + dr, cc = c + dc;
          if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
          const isBorder = dr === -1 || dr === 7 || dc === -1 || dc === 7;
          const isRing = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6 && (dr === 0 || dr === 6 || dc === 0 || dc === 6);
          const isCore = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
          setModule(rr, cc, !isBorder && (isRing || isCore), true);
        }
      }
    }
    placeFinder(0, 0);
    placeFinder(0, size - 7);
    placeFinder(size - 7, 0);

    // Zamanlama desenleri (timing patterns).
    for (let i = 8; i < size - 8; i++) {
      setModule(6, i, i % 2 === 0, true);
      setModule(i, 6, i % 2 === 0, true);
    }

    // Hizalama deseni (yalnızca sürüm >= 2).
    const ac = alignmentCenter(version);
    if (ac != null) {
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const isBorder = dr === -2 || dr === 2 || dc === -2 || dc === 2;
          const isCore = dr === 0 && dc === 0;
          setModule(ac + dr, ac + dc, isBorder || isCore, true);
        }
      }
    }

    // Karanlık modül (her zaman sabit, (4*version+9, 8) konumunda — sürüm 1: (13,8)).
    setModule(4 * version + 9, 8, true, true);

    // Format bilgisi için 15 bit alan ayır (gerçek değerler daha sonra yazılacak).
    for (let i = 0; i <= 8; i++) { if (i !== 6) { setModule(8, i, false, true); setModule(i, 8, false, true); } }
    for (let i = 0; i < 8; i++) { setModule(8, size - 1 - i, false, true); setModule(size - 1 - i, 8, false, true); }
    setModule(size - 8, 8, true, true); // her zaman koyu modül (format alanının bir parçası)

    // ---- Veri bitlerini zigzag düzeninde yerleştir ----
    const bits = [];
    dataCodewordsWithEC.forEach(byte => {
      for (let i = 7; i >= 0; i--) bits.push((byte >> i) & 1);
    });
    let bitIdx = 0;
    let upward = true;
    for (let colPair = size - 1; colPair > 0; colPair -= 2) {
      if (colPair === 6) colPair--; // sütun 6 zamanlama şeridi için atlanır
      for (let rowStep = 0; rowStep < size; rowStep++) {
        const row = upward ? size - 1 - rowStep : rowStep;
        for (let cOff = 0; cOff < 2; cOff++) {
          const col = colPair - cOff;
          if (reserved[row][col]) continue;
          const bit = bitIdx < bits.length ? bits[bitIdx] : 0;
          bitIdx++;
          // Maske deseni 0: (row+col) çift ise tersine çevir.
          const masked = (row + col) % 2 === 0 ? bit ^ 1 : bit;
          modules[row][col] = !!masked;
        }
      }
      upward = !upward;
    }

    // ---- Format bilgisini yaz (EC seviyesi L = 01, maske deseni = 0) ----
    const formatBits = computeFormatBits(0b01, 0);
    // 15 bit -> iki bölgeye (spec'e göre) yazılır.
    for (let i = 0; i <= 5; i++) setModule(8, i, !!((formatBits >> i) & 1), true);
    setModule(8, 7, !!((formatBits >> 6) & 1), true);
    setModule(8, 8, !!((formatBits >> 7) & 1), true);
    setModule(7, 8, !!((formatBits >> 8) & 1), true);
    for (let i = 9; i <= 14; i++) setModule(14 - i, 8, !!((formatBits >> i) & 1), true);
    for (let i = 0; i <= 7; i++) setModule(size - 1 - i, 8, !!((formatBits >> i) & 1), true);
    for (let i = 8; i <= 14; i++) setModule(8, size - 15 + i, !!((formatBits >> i) & 1), true);

    // null kalan (kullanılmayan reserved) hücreleri false yap.
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (modules[r][c] === null) modules[r][c] = false;

    return { size, modules };
  }

  function generateMatrix(text) {
    const version = pickVersion(text || "");
    if (!version) return null; // metin cok uzun - modules/qrcode.js bunu kullaniciya bildirir
    const dataCodewords = encodeByteMode(text, version);
    const table = VERSION_TABLE[version];
    const ecCodewords = rsEncode(dataCodewords, table.ec);
    const allCodewords = dataCodewords.concat(ecCodewords);
    return buildMatrix(version, allCodewords);
  }

  global.SeozQREncoder = { generateMatrix, MAX_VERSION: 5 };
})(window);
