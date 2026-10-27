/* =============================================================================
   STUDIO SEOZ — export/mp4-mux.js  (MP4 DIŞA AKTARMA · dosya paketleyici)
   -----------------------------------------------------------------------------
   Tarayıcının kodladığı video (H.264) ve ses (AAC) parçalarını standart bir
   .mp4 dosyasına yerleştirir (ISO BMFF: ftyp + moov + mdat). "moov" başta
   yazılır (faststart): dosya telefonlarda, Instagram'da ve WhatsApp'ta
   indirmeden oynamaya başlar. Video ve ses ~1 sn'lik parçalar hâlinde
   iç içe dizilir.

   Desteklenen kodlar: video avc1 (H.264) — testler için ayrıca vp09 (VP9);
   ses mp4a (AAC-LC) — testler için ayrıca Opus.
   Tarayıcıda window.SeozMp4, Node'da module.exports olarak kullanılır.
   ========================================================================= */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SeozMp4 = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ---------------- bayt yazıcı ---------------- */
  function concat(parts) {
    let n = 0; parts.forEach(p => { n += p.length; });
    const out = new Uint8Array(n); let o = 0;
    parts.forEach(p => { out.set(p, o); o += p.length; });
    return out;
  }
  const u8 = v => new Uint8Array([v & 255]);
  const u16 = v => new Uint8Array([(v >>> 8) & 255, v & 255]);
  const u24 = v => new Uint8Array([(v >>> 16) & 255, (v >>> 8) & 255, v & 255]);
  const u32 = v => new Uint8Array([(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255]);
  const i32 = v => u32(v >>> 0);
  const str = s => new Uint8Array(Array.from(s).map(c => c.charCodeAt(0) & 255));
  const zeros = n => new Uint8Array(n);
  function box(type, ...payload) {
    const body = concat(payload.flat().filter(Boolean));
    return concat([u32(body.length + 8), str(type), body]);
  }
  const full = (type, version, flags, ...payload) => box(type, u8(version), u24(flags), ...payload);
  const MATRIX = concat([u32(0x00010000), u32(0), u32(0), u32(0), u32(0x00010000), u32(0), u32(0), u32(0), u32(0x40000000)]);

  /* ---------------- kodlayıcı ayarları ---------------- */
  /* WebCodecs Opus "description" = OpusHead (küçük uçlu) → MP4 dOps (büyük uçlu) */
  function dOps(desc, channels, sampleRate) {
    let ch = channels, pre = 312, rate = sampleRate, gain = 0;
    if (desc && desc.length >= 19 && String.fromCharCode.apply(null, desc.slice(0, 8)) === "OpusHead") {
      const dv = new DataView(desc.buffer, desc.byteOffset, desc.byteLength);
      ch = desc[9]; pre = dv.getUint16(10, true); rate = dv.getUint32(12, true); gain = dv.getInt16(16, true);
    }
    return box("dOps", u8(0), u8(ch), u16(pre), u32(rate), u16(gain & 0xffff), u8(0));
  }
  /* AAC: ES_Descriptor (esds) içinde AudioSpecificConfig */
  function desc(tag, body) {
    // uzunluk: 4 baytlık genişletilmiş biçim (her oynatıcı okur)
    const n = body.length;
    return concat([u8(tag), u8(0x80 | ((n >>> 21) & 127)), u8(0x80 | ((n >>> 14) & 127)), u8(0x80 | ((n >>> 7) & 127)), u8(n & 127), body]);
  }
  function esds(asc, bitrate) {
    const dsi = desc(0x05, asc);
    const dcd = desc(0x04, concat([u8(0x40), u8(0x15), u24(0), u32(bitrate || 128000), u32(bitrate || 128000), dsi]));
    const sl = desc(0x06, u8(0x02));
    return full("esds", 0, 0, desc(0x03, concat([u16(1), u8(0), dcd, sl])));
  }
  function ascFor(sampleRate, channels) {   // AAC-LC AudioSpecificConfig (açıklama gelmezse)
    const rates = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];
    const i = Math.max(0, rates.indexOf(sampleRate));
    return new Uint8Array([(2 << 3) | (i >> 1), ((i & 1) << 7) | (channels << 3)]);
  }
  function vpcC(o) {
    // profil 0, 8 bit, 4:2:0, BT.709, sınırlı aralık
    const level = o.level || (o.width * o.height > 1280 * 720 ? 40 : 31);
    return full("vpcC", 1, 0, u8(0), u8(level), u8((8 << 4) | (1 << 1) | 0), u8(1), u8(1), u8(1), u16(0));
  }
  function visualEntry(type, o, extra) {
    return box(type, zeros(6), u16(1), u16(0), u16(0), zeros(12), u16(o.width), u16(o.height),
      u32(0x00480000), u32(0x00480000), u32(0), u16(1), zeros(32), u16(0x0018), u16(0xffff), extra);
  }
  function audioEntry(type, o, extra) {
    return box(type, zeros(6), u16(1), zeros(8), u16(o.channels), u16(16), u16(0), u16(0), u32((o.sampleRate & 0xffff) << 16 >>> 0), extra);
  }

  /* ---------------- iz (track) tabloları ---------------- */
  function sttsOf(durs) {
    const runs = [];
    durs.forEach(d => { const r = runs[runs.length - 1]; if (r && r[1] === d) r[0]++; else runs.push([1, d]); });
    return full("stts", 0, 0, u32(runs.length), ...runs.map(r => concat([u32(r[0]), u32(r[1])])));
  }
  function stscOf(chunks) {
    const runs = [];
    chunks.forEach((c, i) => { const r = runs[runs.length - 1]; if (!r || r[1] !== c.samples.length) runs.push([i + 1, c.samples.length]); });
    return full("stsc", 0, 0, u32(runs.length), ...runs.map(r => concat([u32(r[0]), u32(r[1]), u32(1)])));
  }

  function create(opt) {
    const tracks = [];
    if (opt.video) tracks.push({ kind: "video", o: opt.video, timescale: opt.video.timescale || 90000, samples: [] });
    if (opt.audio) tracks.push({ kind: "audio", o: opt.audio, timescale: opt.audio.sampleRate, samples: [] });
    const T = k => tracks.find(t => t.kind === k);

    function add(t, data, tsUs, durUs, key) {
      if (!t) return;
      const d = data instanceof Uint8Array ? data : new Uint8Array(data);
      t.samples.push({ data: d, ts: tsUs, dur: durUs, key: !!key });
    }

    function finish() {
      // zaman damgalarını izin ölçeğine çevir; süreleri ardışık damgalardan hesapla (kaymayı önler)
      tracks.forEach(t => {
        const s = t.samples;
        s.sort((a, b) => a.ts - b.ts);
        const toTs = us => Math.round(us * t.timescale / 1e6);
        const t0 = s.length ? s[0].ts : 0;
        s.forEach((x, i) => {
          const a = toTs(x.ts - t0), b = i + 1 < s.length ? toTs(s[i + 1].ts - t0) : a + Math.max(1, toTs(x.dur || 0));
          x.d = Math.max(1, b - a);
        });
        t.duration = s.reduce((n, x) => n + x.d, 0);
        t.t0us = t0;
        // ~1 sn'lik parçalar
        t.chunks = []; let cur = null;
        s.forEach(x => { const sec = Math.floor((x.ts - t0) / 1e6); if (!cur || cur.sec !== sec) { cur = { sec, samples: [], start: x.ts }; t.chunks.push(cur); } cur.samples.push(x); });
      });
      // mdat sırası: parçalar başlangıç zamanına göre iç içe
      const order = [];
      tracks.forEach(t => t.chunks.forEach(c => order.push({ t, c })));
      order.sort((a, b) => a.c.start - b.c.start || (a.t.kind === "video" ? -1 : 1));

      const build = (offsets) => {
        const movieDur = Math.max(1, ...tracks.map(t => Math.round(t.duration * 1000 / t.timescale)));
        const traks = tracks.map((t, ti) => {
          const o = t.o, isV = t.kind === "video";
          let entry;
          if (isV && o.codec === "vp9") entry = visualEntry("vp09", o, vpcC(o));
          else if (isV) entry = visualEntry("avc1", o, box("avcC", o.description));
          else if (o.codec === "opus") entry = audioEntry("Opus", o, dOps(o.description, o.channels, o.sampleRate));
          else entry = audioEntry("mp4a", o, esds(o.description && o.description.length ? o.description : ascFor(o.sampleRate, o.channels), o.bitrate));
          const stbl = box("stbl",
            full("stsd", 0, 0, u32(1), entry),
            sttsOf(t.samples.map(x => x.d)),
            isV && t.samples.some(x => !x.key) ? full("stss", 0, 0, u32(t.samples.filter(x => x.key).length), ...t.samples.map((x, i) => x.key ? u32(i + 1) : null).filter(Boolean)) : null,
            stscOf(t.chunks),
            full("stsz", 0, 0, u32(0), u32(t.samples.length), ...t.samples.map(x => u32(x.data.length))),
            full("stco", 0, 0, u32(t.chunks.length), ...t.chunks.map(c => u32(offsets ? offsets.get(c) : 0))));
          const minf = box("minf",
            isV ? full("vmhd", 0, 1, zeros(8)) : full("smhd", 0, 0, u16(0), u16(0)),
            box("dinf", full("dref", 0, 0, u32(1), full("url ", 0, 1))),
            stbl);
          const mdia = box("mdia",
            full("mdhd", 0, 0, u32(0), u32(0), u32(t.timescale), u32(t.duration), u16(0x55c4), u16(0)),
            full("hdlr", 0, 0, u32(0), str(isV ? "vide" : "soun"), zeros(12), str(isV ? "Studio SEOZ Video\0" : "Studio SEOZ Ses\0")),
            minf);
          const tkhd = full("tkhd", 0, 3, u32(0), u32(0), u32(ti + 1), u32(0), u32(Math.round(t.duration * 1000 / t.timescale)), zeros(8),
            u16(0), u16(isV ? 0 : 1), u16(isV ? 0 : 0x0100), u16(0), MATRIX, u32(isV ? (o.width << 16) >>> 0 : 0), u32(isV ? (o.height << 16) >>> 0 : 0));
          return box("trak", tkhd, mdia);
        });
        const mvhd = full("mvhd", 0, 0, u32(0), u32(0), u32(1000), u32(movieDur), u32(0x00010000), u16(0x0100), zeros(10), MATRIX, zeros(24), u32(tracks.length + 1));
        return box("moov", mvhd, ...traks);
      };
      const ftyp = box("ftyp", str("isom"), u32(0x200), str("isom"), str("iso2"), str(tracks[0] && tracks[0].o.codec === "vp9" ? "vp09" : "avc1"), str("mp41"));
      const moovSize = build(null).length;
      let pos = ftyp.length + moovSize + 8;
      const offsets = new Map();
      const parts = [];
      order.forEach(({ c }) => { offsets.set(c, pos); c.samples.forEach(x => { parts.push(x.data); pos += x.data.length; }); });
      const moov = build(offsets);
      if (moov.length !== moovSize) throw new Error("MP4 başlığı hesaplanamadı");
      const mdatLen = pos - (ftyp.length + moovSize);
      return concat([ftyp, moov, u32(mdatLen), str("mdat"), ...parts]);
    }

    return {
      addVideo: (data, tsUs, durUs, key) => add(T("video"), data, tsUs, durUs, key),
      addAudio: (data, tsUs, durUs) => add(T("audio"), data, tsUs, durUs, true),
      finish,
      stats: () => tracks.map(t => ({ kind: t.kind, samples: t.samples.length }))
    };
  }

  /* H.264 Annex-B (00 00 01 başlıklı) → MP4 için uzunluk önekli + avcC (testler ve yedek yol) */
  function annexBToAvc(buf) {
    const nals = []; let i = 0, start = -1;
    while (i + 3 <= buf.length) {
      if (buf[i] === 0 && buf[i + 1] === 0 && (buf[i + 2] === 1 || (buf[i + 2] === 0 && buf[i + 3] === 1))) {
        if (start >= 0) nals.push(buf.subarray(start, i));
        i += buf[i + 2] === 1 ? 3 : 4; start = i;
      } else i++;
    }
    if (start >= 0) nals.push(buf.subarray(start));
    return nals.map(n => { let e = n.length; while (e > 0 && n[e - 1] === 0) e--; return n.subarray(0, e); }).filter(n => n.length);
  }
  function avcC(sps, pps) {
    return concat([u8(1), u8(sps[1]), u8(sps[2]), u8(sps[3]), u8(0xff), u8(0xe1), u16(sps.length), sps, u8(1), u16(pps.length), pps]);
  }
  function lengthPrefixed(nals) { return concat(nals.map(n => concat([u32(n.length), n]))); }

  return { create, annexBToAvc, avcC, lengthPrefixed, ascFor };
});
