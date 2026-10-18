/* =============================================================================
   STUDIO SEOZ — editor/theme-packs.js  (İç Zemin · KATEGORİ PAKETLERİ ve YERLEŞİM ŞABLONLARI)
   -----------------------------------------------------------------------------
   Bir paket tek seçimde zemini, tasarım dilini, modüllerin sunum biçimlerini,
   önerilen etkileşimi ve önerilen açılışı hazırlar. Her şey sonradan tek tek
   değiştirilebilir. Yeni bir kategori eklemek = bu listeye bir kayıt eklemek.

   Yalnızca EDİTÖRDE yüklenir. Uygulanınca belgeye yazılan şeyler sıradan
   alanlardır (doc.theme, katman konumları, layer.present, layer.reveal),
   müşteri sayfası bu dosyayı hiç yüklemez.
   ========================================================================= */
(function (global) {
  "use strict";

  /* ---------------- zemin yardımcıları ---------------- */
  let n = 0;
  const L = (art, x, y, w, h, o) => Object.assign({ id: "bl" + (++n), art, x, y, w, h, depth: 0, motion: "none", speed: 1, opacity: 1 }, o || {});

  /* ---------------- paketler ---------------- */
  const PACKS = [
    { id: "dugun", label: "Düğün", group: "Davet", template: "davet", icon: "cicek-dali",
      desc: "Sallanan çiçekli dallar, inci ışıltısı, akşama dönen bölüm zemini.",
      texts: { title: "Elif & Kerem", subtitle: "Evleniyoruz", date: "12 Haziran 2027 · Cumartesi", story: "Hayatımızın en güzel gününde sizi de aramızda görmek istiyoruz.", closing: "Sevgiyle bekliyoruz" },
      language: { palette: { paper: "#FBF6EE", ink: "#3A2E28", accent: "#B8925A", accent2: "#7A1F2B" }, fonts: { title: "Great Vibes", heading: "Cormorant Garamond", body: "Manrope" }, radius: 14 },
      variants: [
        { label: "Bahçe", canvas: "#F8F1E7", bg: { base: { type: "gradient", from: "#FBF4EA", to: "#F4E7D8", angle: 180 },
          sections: [{ y: 0, color: "rgba(255,248,236,0)" }, { y: 1400, color: "rgba(255,226,196,.35)" }, { y: 2300, color: "rgba(70,46,80,.28)" }],
          layers: [L("cicek-dali", -50, -14, 300, 190, { color: "#7D8F69", color2: "#F2C9D2", motion: "salinim", depth: 0.15 }), L("cicek-dali", 180, 120, 290, 180, { color: "#7D8F69", color2: "#F2C9D2", motion: "salinim", flip: true, depth: 0.35, speed: 0.8, opacity: 0.9 }),
            L("bulut", 10, 520, 170, 76, { color: "#FFFFFF", motion: "kayma", depth: 0.6, opacity: 0.7 }), L("yaprak-kose", 300, 1150, 150, 150, { color: "#9AAE85", motion: "salinim", depth: 0.4, rotate: 90 }),
            L("cicek-dali", -40, 2000, 300, 190, { color: "#7D8F69", color2: "#F2C9D2", motion: "salinim", depth: 0.3 })],
          particles: { type: "yaprak", density: 0.8, seconds: 0 }, light: { type: "gunes", strength: 0.55 } } },
        { label: "İnci", canvas: "#FBFAF7", bg: { base: { type: "radial", inner: "#FFFFFF", outer: "#EFE9E1" },
          layers: [L("inci-dizisi", 15, 10, 400, 100, { color: "#EDE6DA", motion: "suzulme", depth: 0.2 }), L("monogram", 145, 120, 140, 140, { color: "#C9A45C", motion: "donme", speed: 0.4, opacity: 0.55 }),
            L("inci-dizisi", 15, 1500, 400, 100, { color: "#EDE6DA", motion: "suzulme", depth: 0.3, flip: true })],
          particles: { type: "parilti", density: 0.7 }, light: { type: "altin", strength: 0.35 } } }
      ],
      present: { location: { frame: "kartpostal" }, music: { special: "plak" }, countdown: { special: "cevirmeli" }, "attendance-form": { open: "zarf", frame: "bilet" }, rsvp: { frame: "bilet" }, gallery: { special: "polaroid-yigin" }, "price-list": { frame: "parsomen" } },
      interactive: { kind: "kazi-kazan", title: "Büyük günü kazıyarak öğrenin", message: "12 · 06 · 2027", effect: "kalp" },
      kurgu: ["k:zarf", "k:kapi", "k:cek"], concept: "dugun" },

    { id: "nisan", label: "Nişan · Söz · Kına", group: "Davet", template: "davet", icon: "tul",
      desc: "Kadife ve altın süs, süzülen ışık zerreleri; kınada kırmızı tül.",
      texts: { title: "Ayşe & Mehmet", subtitle: "Nişanımıza davetlisiniz", date: "5 Mayıs 2027 · 19.00", story: "Bu mutlu günümüzde yanımızda olmanızı dileriz.", closing: "Sevgilerimizle" },
      language: { palette: { paper: "#FFF7F2", ink: "#3B1420", accent: "#C9A45C", accent2: "#8E1B2E" }, fonts: { title: "Pinyon Script", heading: "Playfair Display", body: "Manrope" }, radius: 12 },
      variants: [
        { label: "Kadife", canvas: "#FFF6F1", bg: { base: { type: "gradient", from: "#FFF8F3", to: "#F7E3DC", angle: 180 },
          layers: [L("tul", 0, 0, 430, 140, { color: "#B3243A", motion: "nefes", speed: 0.6, opacity: 0.85 }), L("kose-sus", 10, 160, 90, 90, { color: "#C9A45C" }), L("kose-sus", 330, 160, 90, 90, { color: "#C9A45C", flip: true })],
          particles: { type: "parilti", density: 0.9 }, light: { type: "altin", strength: 0.4 } } },
        { label: "Kına gecesi", canvas: "#3E0A16", dark: true, bg: { base: { type: "gradient", from: "#5A0F1E", to: "#2A0610", angle: 180 },
          layers: [L("tul", 0, 0, 430, 160, { color: "#D12B45", motion: "nefes", speed: 0.6, opacity: 0.8 }), L("halka", 115, 170, 200, 200, { color: "#F3D27A", motion: "nefes", opacity: 0.5 }),
            L("fener", 30, 900, 70, 100, { color: "#C9A45C", color2: "#FFE6A6", motion: "suzulme", depth: 0.4 }), L("fener", 335, 1300, 64, 92, { color: "#C9A45C", color2: "#FFE6A6", motion: "suzulme", depth: 0.5, speed: 0.8 })],
          particles: { type: "atesbocegi", density: 1 }, light: { type: "vinyet", strength: 0.5 } } }
      ],
      present: { gallery: { special: "polaroid-yigin" }, "attendance-form": { frame: "bilet" }, rsvp: { frame: "bilet" }, music: { special: "kaset" }, location: { frame: "altin" }, countdown: { frame: "altin" } },
      interactive: { kind: "dilek", title: "Bir dilek tutun", message: "Dileğiniz bizimle olsun", effect: "yildiz" },
      kurgu: ["k:zarif", "k:zarf", "k:gizem"], concept: "dugun" },

    { id: "dogumgunu", label: "Doğum günü · Baby shower", group: "Davet", template: "davet", icon: "balon",
      desc: "Uçuşan balonlar, konfeti ve pastel bulutlar.",
      texts: { title: "Deniz 5 Yaşında!", subtitle: "Doğum günü partimize bekleriz", date: "20 Nisan 2027 · 14.00", story: "Pasta, oyunlar ve bolca kahkaha seni bekliyor!", closing: "Gelirsen çok sevinirim!" },
      language: { palette: { paper: "#FFFDF8", ink: "#3D3A5C", accent: "#F28AA6", accent2: "#5BB4E5" }, fonts: { title: "Fredoka", heading: "Baloo 2", body: "Nunito" }, radius: 20 },
      variants: [
        { label: "Balonlar", canvas: "#FFF8F0", bg: { base: { type: "gradient", from: "#FFF6EC", to: "#EAF6FF", angle: 180 },
          layers: [L("balon", 14, 40, 70, 128, { color: "#F49AB0", motion: "suzulme", depth: 0.3 }), L("balon", 340, 90, 66, 120, { color: "#9FD3F5", motion: "suzulme", depth: 0.5, speed: 0.8 }),
            L("balon", 360, 760, 60, 110, { color: "#F7D774", motion: "suzulme", depth: 0.6 }), L("bulut", 120, 600, 180, 80, { color: "#FFFFFF", motion: "kayma", depth: 0.7, opacity: 0.85 }),
            L("konfeti-kose", 0, 1200, 160, 160, { color: "#F28AA6", color2: "#5BB4E5", motion: "parilti" })],
          particles: { type: "konfeti", density: 0.6 }, light: { type: "none" } } },
        { label: "Pastel bulutlar", canvas: "#F4F8FF", bg: { base: { type: "gradient", from: "#EEF5FF", to: "#FFF0F5", angle: 180 },
          layers: [L("bulut", -20, 30, 200, 90, { color: "#FFFFFF", motion: "kayma", depth: 0.4 }), L("bulut", 260, 200, 180, 80, { color: "#FFFFFF", motion: "kayma", depth: 0.6, speed: 0.7 }),
            L("yildiz", 40, 420, 40, 40, { color: "#F7D774", motion: "parilti" }), L("hilal", 350, 380, 56, 56, { color: "#F7D774", motion: "suzulme" })],
          particles: { type: "yildiz", density: 0.6 }, light: { type: "gunes", strength: 0.3 } } }
      ],
      present: { countdown: { special: "takvim" }, gallery: { special: "polaroid-yigin" }, "attendance-form": { frame: "polaroid" }, rsvp: { frame: "polaroid" }, gift: { open: "cevir" }, location: { frame: "kartpostal" } },
      interactive: { kind: "balon", title: "Balonları patlat!", message: "Seni partide bekliyoruz! 🎈", effect: "konfeti", count: 5 },
      kurgu: ["k:hediye", "k:surpriz"], concept: "dogumgunu" },

    { id: "mezuniyet", label: "Okul · Mezuniyet", group: "Davet", template: "davet", icon: "kep",
      desc: "Lacivert ve altın sahne, yıldızlar; program zaman çizelgesi gibi.",
      texts: { title: "Mezuniyet Töreni", subtitle: "2027 Dönemi", date: "28 Haziran 2027 · 17.00", story: "Emeklerimizin karşılığını birlikte kutlayalım.", closing: "Geleceğe birlikte!" },
      language: { palette: { paper: "#FBF7EE", ink: "#F5EBD6", accent: "#D9B26A", accent2: "#1B2E52" }, fonts: { title: "Cinzel", heading: "Cinzel", body: "Lato" }, radius: 10, dark: true },
      variants: [
        { label: "Lacivert sahne", canvas: "#0F1B33", dark: true, bg: { base: { type: "gradient", from: "#16284A", to: "#0A1324", angle: 180 },
          layers: [L("kep", 150, 40, 130, 92, { color: "#0A1324", color2: "#D9B26A", motion: "suzulme", opacity: 0.95 }), L("yildiz", 40, 160, 26, 26, { color: "#D9B26A", motion: "parilti" }),
            L("yildiz", 370, 220, 20, 20, { color: "#D9B26A", motion: "parilti", speed: 1.4 }), L("isik-huzmesi", 20, 0, 140, 420, { color: "#FFF1C4", opacity: 0.25, rotate: -12 }),
            L("isik-huzmesi", 270, 0, 140, 420, { color: "#FFF1C4", opacity: 0.25, rotate: 12 })],
          particles: { type: "yildiz", density: 0.9 }, light: { type: "vinyet", strength: 0.4 } } },
        { label: "Kara tahta", canvas: "#1F3A2E", dark: true, bg: { base: { type: "gradient", from: "#24433A", to: "#16291F", angle: 180 },
          layers: [L("sus-cizgi", 70, 120, 290, 48, { color: "#F5EBD6", opacity: 0.6 }), L("kep", 300, 30, 100, 72, { color: "#F5EBD6", color2: "#D9B26A", rotate: 12, opacity: 0.8 })],
          particles: { type: "none" }, light: { type: "kagit", strength: 0.6 } } }
      ],
      present: { "price-list": { frame: "parsomen" }, "attendance-form": { frame: "bilet" }, rsvp: { frame: "bilet" }, countdown: { special: "cevirmeli" }, location: { frame: "cam" }, gallery: { special: "film" } },
      modSettings: { countdown: { textColor: "#F5EBD6" }, location: { textColor: "#FFFFFF", bgColor: "#B8925A" } },
      interactive: { kind: "konfeti", title: "Kep fırlat!", message: "Tebrikler mezunlar! 🎓", effect: "yildiz" },
      kurgu: ["k:perde", "k:yildiz"], concept: "mezuniyet" },

    { id: "lansman", label: "Lansman", group: "Davet", template: "davet", icon: "neon-cizgi",
      desc: "Neon çizgiler, dönen ışık huzmeleri ve marka renkleri; dev geri sayım.",
      texts: { title: "YENİ ÜRÜN", subtitle: "Lansman Gecesi", date: "1 Eylül 2027 · 20.00", story: "Yeniliği ilk görenlerden olun.", closing: "Geri sayım başladı" },
      language: { palette: { paper: "#17132A", ink: "#F4F1FF", accent: "#FF3DBE", accent2: "#3DE0FF" }, fonts: { title: "Bungee", heading: "Outfit", body: "Outfit" }, radius: 16, dark: true },
      variants: [
        { label: "Neon", canvas: "#0D0B1A", dark: true, bg: { base: { type: "gradient", from: "#1B1033", to: "#0B0916", angle: 180 },
          layers: [L("neon-cizgi", 20, 30, 390, 64, { color: "#FF3DBE", motion: "parilti", speed: 1.4 }), L("neon-cizgi", 20, 980, 390, 64, { color: "#3DE0FF", motion: "parilti", flip: true }),
            L("halka", 90, 140, 250, 250, { color: "#3DE0FF", motion: "donme", speed: 0.6, opacity: 0.6 }), L("isik-huzmesi", 0, 0, 160, 500, { color: "#FF3DBE", opacity: 0.25, rotate: -18, motion: "salinim", origin: "50% 0%" })],
          particles: { type: "parilti", density: 0.8, colors: ["#FF3DBE", "#3DE0FF", "#FFFFFF"] }, light: { type: "neon", strength: 0.5 } } },
        { label: "Beyaz sahne", canvas: "#F7F7FB", bg: { base: { type: "radial", inner: "#FFFFFF", outer: "#E9E8F3" },
          layers: [L("neon-cizgi", 20, 30, 390, 64, { color: "#7B3FF2", opacity: 0.8 }), L("halka", 110, 160, 210, 210, { color: "#7B3FF2", motion: "donme", speed: 0.5, opacity: 0.35 })],
          particles: { type: "none" }, light: { type: "none" } } }
      ],
      present: { countdown: { special: "cevirmeli" }, "attendance-form": { frame: "isikli" }, rsvp: { frame: "isikli" }, location: { frame: "cam" }, gallery: { special: "vitrin" } },
      modSettings: { countdown: { textColor: "#F4F1FF" } },
      interactive: { kind: "foto-cevir", title: "Ürünü çevirin", message: "Çok yakında!", effect: "yildiz" },
      kurgu: ["k:perde", "k:surpriz", "k:gizli"], concept: "gala" },

    { id: "kurumsal", label: "Kurumsal · Bayi toplantısı · Konferans", group: "Davet", template: "davet", icon: "dalga",
      desc: "Sade derinlik katmanları, logo filigranı ve ince ışık.",
      texts: { title: "Bayi Toplantısı 2027", subtitle: "Birlikte büyüyoruz", date: "15 Mart 2027 · 10.00", story: "Yeni dönem hedeflerimizi paylaşacağımız toplantımıza davetlisiniz.", closing: "Katılımınız için teşekkür ederiz" },
      language: { palette: { paper: "#FFFFFF", ink: "#1E2733", accent: "#2F6FB0", accent2: "#0F2B4C" }, fonts: { title: "Montserrat", heading: "Montserrat", body: "Inter" }, radius: 10 },
      variants: [
        { label: "Açık", canvas: "#F6F7F9", bg: { base: { type: "gradient", from: "#FFFFFF", to: "#EEF2F7", angle: 180 },
          layers: [L("dalga", 0, 560, 430, 108, { color: "#DDE6F2", color2: "#C9D7EA", depth: 0.3 }), L("monogram", 285, 20, 130, 130, { color: "#2F6FB0", opacity: 0.12, motion: "donme", speed: 0.3 })],
          particles: { type: "none" }, light: { type: "none" } } },
        { label: "Gece mavisi", canvas: "#0F1E33", dark: true, bg: { base: { type: "gradient", from: "#13263F", to: "#0A1525", angle: 180 },
          layers: [L("dalga", 0, 520, 430, 108, { color: "#1B3354", color2: "#22406A", depth: 0.3 }), L("isik-huzmesi", 260, 0, 150, 360, { color: "#9CC3F0", opacity: 0.18, rotate: 14 })],
          particles: { type: "none" }, light: { type: "vinyet", strength: 0.3 } } }
      ],
      present: { "price-list": { frame: "cam" }, location: { frame: "cam" }, "attendance-form": { frame: "cam" }, rsvp: { frame: "cam" }, countdown: { frame: "cam" }, feedback: { frame: "cam" } },
      interactive: { kind: "foto-cevir", title: "Konuşmacıyı tanıyın", message: "Konuşmacı bilgisi", effect: "yok" },
      kurgu: ["k:sade", "k:kapi"], concept: "kurumsal" },

    { id: "magaza", label: "Mağaza açılışı", group: "İşletme", alsoDavet: true, template: "isletme", icon: "tente",
      desc: "Vitrin tentesi, konfeti ve ışıklı kurdele; kurdele kes ve indirim kazı-kazan.",
      texts: { title: "Mağazamız Açılıyor!", subtitle: "Büyük açılışa davetlisiniz", date: "10 Ekim 2027 · 11.00", story: "Açılışa özel sürprizler ve indirimler sizi bekliyor.", closing: "Görüşmek üzere!" },
      language: { palette: { paper: "#FFFDF6", ink: "#2A2420", accent: "#E04F5F", accent2: "#F7C548" }, fonts: { title: "Playfair Display", heading: "Playfair Display", body: "Poppins" }, radius: 14 },
      variants: [
        { label: "Vitrin", canvas: "#FFFBF2", bg: { base: { type: "gradient", from: "#FFFDF6", to: "#FFF1E3", angle: 180 },
          layers: [L("tente", 0, 0, 430, 96, { color: "#E04F5F", color2: "#FFFFFF" }), L("konfeti-kose", 0, 110, 150, 150, { color: "#E04F5F", color2: "#F7C548", motion: "parilti" }),
            L("konfeti-kose", 280, 110, 150, 150, { color: "#5BB4E5", color2: "#F7C548", flip: true, motion: "parilti", speed: 1.3 }), L("yaprak-saksi", 360, 820, 60, 86, { color: "#5E8C5A", motion: "salinim" })],
          particles: { type: "konfeti", density: 0.5 }, light: { type: "gunes", strength: 0.4 } } },
        { label: "Gece açılışı", canvas: "#1A1420", dark: true, bg: { base: { type: "gradient", from: "#241A2E", to: "#120D17", angle: 180 },
          layers: [L("tente", 0, 0, 430, 96, { color: "#F7C548", color2: "#2A2030" }), L("halka", 120, 140, 190, 190, { color: "#F7C548", motion: "nefes", opacity: 0.5 })],
          particles: { type: "parilti", density: 0.8 }, light: { type: "altin", strength: 0.5 } } }
      ],
      present: { services: { frame: "tabela" }, "price-list": { frame: "tabela" }, "attendance-form": { frame: "bilet" }, rsvp: { frame: "bilet" }, campaign: { frame: "" }, location: { special: "harita" }, hours: { frame: "cam" } },
      modSettings: { services: { textColor: "#FFF6E6" }, "price-list": { textColor: "#FFF6E6", accentColor: "#F7C548" } },
      interactive: { kind: "kurdele", title: "Kurdeleyi kesin, sürprizi görün", message: "Açılışa özel %20 indirim!", effect: "konfeti" },
      kurgu: ["k:kurdele", "k:kapi"], concept: "konfeti" },

    { id: "yilbasi", label: "Yılbaşı", group: "Davet", template: "davet", icon: "kar-tanesi",
      desc: "Kar yağışı, havai fişek ve altın ışıklar.",
      texts: { title: "Yeni Yıl Partisi", subtitle: "2028'e birlikte girelim", date: "31 Aralık 2027 · 21.00", story: "Yeni yılı müzik, ışık ve dostlarla karşılayalım.", closing: "Mutlu yıllar!" },
      language: { palette: { paper: "#FBF7EE", ink: "#F7EFE0", accent: "#D9B26A", accent2: "#C8323C" }, fonts: { title: "Cinzel Decorative", heading: "Cinzel", body: "Manrope" }, radius: 12, dark: true },
      variants: [
        { label: "Çam yeşili", canvas: "#0E2A22", dark: true, bg: { base: { type: "gradient", from: "#123A2F", to: "#071812", angle: 180 },
          layers: [L("yildiz", 185, 20, 60, 60, { color: "#F3D27A", motion: "parilti" }), L("hediye", 20, 640, 80, 80, { color: "#C8323C", color2: "#F3D27A", motion: "nefes" }),
            L("hediye", 340, 900, 70, 70, { color: "#D9B26A", color2: "#C8323C", motion: "nefes", speed: 0.8 }), L("kar-tanesi", 340, 120, 50, 50, { color: "#FFFFFF", motion: "donme", opacity: 0.6 }),
            L("kar-tanesi", 30, 300, 36, 36, { color: "#FFFFFF", motion: "donme", speed: 1.4, opacity: 0.5 })],
          particles: { type: "kar", density: 1 }, light: { type: "altin", strength: 0.45 } } },
        { label: "Karlı beyaz", canvas: "#F2F6FA", bg: { base: { type: "gradient", from: "#F8FBFF", to: "#E3ECF5", angle: 180 },
          layers: [L("kar-tanesi", 30, 40, 60, 60, { color: "#9CB8D6", motion: "donme" }), L("kar-tanesi", 330, 140, 46, 46, { color: "#9CB8D6", motion: "donme", speed: 1.3 })],
          particles: { type: "kar", density: 1.2, colors: ["#FFFFFF", "#D6E4F2"] }, light: { type: "none" } } }
      ],
      present: { location: { frame: "kartpostal" }, gallery: { special: "film" }, gift: { open: "zarf" }, "attendance-form": { frame: "altin" }, rsvp: { frame: "altin" }, countdown: { special: "cevirmeli" } },
      modSettings: { countdown: { textColor: "#F7EFE0" } },
      interactive: { kind: "dilek", title: "Yeni yıl dileğinizi bırakın", message: "Dileğiniz gerçek olsun! ✨", effect: "yildiz" },
      kurgu: ["k:yildiz", "k:hediye"], concept: "yilbasi" },

    { id: "halloween", label: "Halloween", group: "Davet", template: "davet", icon: "yarasa",
      desc: "Sis, yarasalar, dolunay ve gotik ışık; kapıyı çal.",
      texts: { title: "Cadılar Gecesi", subtitle: "Kostüm partisine davetlisin", date: "31 Ekim 2027 · 20.00", story: "Kostümünü giy, karanlığa hazır ol!", closing: "Korkmaya cesaretin var mı?" },
      language: { palette: { paper: "#F3E6D3", ink: "#F3E6D3", accent: "#F28C28", accent2: "#7E3FB2" }, fonts: { title: "Cinzel Decorative", heading: "Cinzel", body: "Manrope" }, radius: 6, dark: true },
      variants: [
        { label: "Dolunay", canvas: "#120A1A", dark: true, bg: { base: { type: "gradient", from: "#1F1030", to: "#0A0610", angle: 180 },
          layers: [L("ay", 280, 30, 120, 120, { color: "#F6E7B8", motion: "nefes", speed: 0.5 }), L("yarasa", 40, 90, 90, 45, { color: "#05030A", motion: "suzulme", depth: 0.5 }),
            L("yarasa", 180, 170, 60, 30, { color: "#05030A", motion: "suzulme", depth: 0.7, speed: 1.4 }), L("orumcek-agi", 0, 0, 150, 150, { color: "#CFC6D8", opacity: 0.5 })],
          particles: { type: "atesbocegi", density: 0.8, colors: ["#F28C28", "#FFD27A"] }, light: { type: "vinyet", strength: 0.7 } } },
        { label: "Mor sis", canvas: "#1A0F24", dark: true, bg: { base: { type: "radial", inner: "#3A1E55", outer: "#0B0610" },
          layers: [L("yarasa", 300, 60, 90, 45, { color: "#05030A", motion: "suzulme" }), L("orumcek-agi", 280, 0, 150, 150, { color: "#CFC6D8", opacity: 0.4, flip: true })],
          particles: { type: "none" }, light: { type: "kagit", strength: 0.4 } } }
      ],
      present: { location: { frame: "parsomen" }, "attendance-form": { frame: "tabela" }, rsvp: { frame: "tabela" }, music: { special: "kaset" }, countdown: { special: "kumsaati" } },
      modSettings: { countdown: { textColor: "#F3E6D3" } },
      interactive: { kind: "kapi-cal", title: "Kapıyı üç kez çal…", message: "Şaka mı şeker mi? 🎃", effect: "yildiz", color: "#5A3A28" },
      kurgu: ["k:gizem", "k:kapi"], concept: "halloween" },

    { id: "sevgililer", label: "Sevgililer Günü", group: "Davet", template: "davet", icon: "kalp",
      desc: "Uçuşan kalpler ve gül yaprakları; polaroid çifti ve mektup.",
      texts: { title: "Seninle Her Gün", subtitle: "Sevgililer Günü yemeğine davetlisin", date: "14 Şubat 2027 · 20.00", story: "Bu akşam sadece ikimiz için.", closing: "Seni seviyorum" },
      language: { palette: { paper: "#FFF5F6", ink: "#4A1C2A", accent: "#E2335C", accent2: "#F7A3B8" }, fonts: { title: "Alex Brush", heading: "Playfair Display", body: "Manrope" }, radius: 18 },
      variants: [
        { label: "Gül", canvas: "#FFF1F3", bg: { base: { type: "gradient", from: "#FFF6F7", to: "#FBE1E6", angle: 180 },
          layers: [L("kalp", 30, 40, 60, 54, { color: "#F7A3B8", motion: "suzulme" }), L("kalp", 340, 140, 44, 40, { color: "#E2335C", motion: "suzulme", speed: 1.3, opacity: 0.8 }),
            L("gul-yapragi", 300, 700, 50, 50, { color: "#E2335C", motion: "donme", speed: 0.6, opacity: 0.7 })],
          particles: { type: "kalp", density: 0.7 }, light: { type: "gunes", strength: 0.4 } } },
        { label: "Gece", canvas: "#2A0E18", dark: true, bg: { base: { type: "radial", inner: "#4A1427", outer: "#1A060E" },
          layers: [L("halka", 100, 120, 230, 230, { color: "#F06A8A", motion: "nefes", opacity: 0.45 })],
          particles: { type: "yaprak", density: 0.8, colors: ["#E2335C", "#B3243A"] }, light: { type: "vinyet", strength: 0.5 } } }
      ],
      present: { gallery: { special: "polaroid-yigin" }, music: { special: "plak" }, location: { frame: "kartpostal" }, "attendance-form": { open: "zarf" }, rsvp: { open: "zarf" } },
      interactive: { kind: "zarf", title: "Sana bir mektubum var", message: "Seninle her gün sevgililer günü ❤", effect: "kalp", color: "#E7B9C2" },
      kurgu: ["k:cicek", "k:zarf"], concept: "sevgililer" },

    { id: "dernek", label: "Dernek · Belediye · Vakıf", group: "Davet", template: "davet", icon: "monogram",
      desc: "Sade dalga, logo ve kurum renkleri; duyuru panosu ve program.",
      texts: { title: "Belediye Buluşması", subtitle: "Mahallemizi birlikte planlıyoruz", date: "8 Mayıs 2027 · 14.00", story: "Görüş ve önerilerinizle şehrimizi birlikte güzelleştirelim.", closing: "Katılımınızı bekliyoruz" },
      language: { palette: { paper: "#FFFFFF", ink: "#1F2D2A", accent: "#2E7D6B", accent2: "#0F4C3A" }, fonts: { title: "Raleway", heading: "Raleway", body: "Source Sans 3" }, radius: 12 },
      variants: [
        { label: "Kurum yeşili", canvas: "#F4F7F5", bg: { base: { type: "gradient", from: "#FFFFFF", to: "#EAF2EE", angle: 180 },
          layers: [L("dalga", 0, 0, 430, 108, { color: "#D6E8DF", color2: "#BFDACC", flip: true, rotate: 180 }), L("monogram", 160, 110, 110, 110, { color: "#2E7D6B", opacity: 0.15 })],
          particles: { type: "none" }, light: { type: "none" } } },
        { label: "Sıcak", canvas: "#FBF6EE", bg: { base: { type: "gradient", from: "#FFFBF4", to: "#F3E7D6", angle: 180 },
          layers: [L("dalga", 0, 600, 430, 108, { color: "#EADCC4", color2: "#E0CBA8" })], particles: { type: "none" }, light: { type: "kagit", strength: 0.3 } } }
      ],
      present: { "price-list": { frame: "cam" }, feedback: { frame: "altin" }, poll: { frame: "cam" }, location: { frame: "cam" }, "attendance-form": { frame: "cam" } },
      interactive: null,
      kurgu: ["k:sade", "k:zarf"], concept: "kurumsal" },

    /* ---------------- işletme ---------------- */
    { id: "kuafor", label: "Kuaför · Güzellik", group: "İşletme", template: "isletme", icon: "ayna",
      desc: "Ayna ışıltısı ve zarif ışıklar; ayna çerçeveli öncesi/sonrası, fiyat menüsü.",
      texts: { title: "Salon Elif", subtitle: "Saç · Makyaj · Bakım", date: "Randevu için bize yazın", story: "Size özel bakım, profesyonel dokunuş.", closing: "Güzelliğiniz bizim işimiz" },
      language: { palette: { paper: "#FFFAF8", ink: "#3A2A2E", accent: "#C9A08A", accent2: "#8E5A6B" }, fonts: { title: "Bodoni Moda", heading: "Bodoni Moda", body: "Jost" }, radius: 16 },
      variants: [
        { label: "Ayna", canvas: "#FFF8F5", bg: { base: { type: "gradient", from: "#FFFBF9", to: "#F6E8E2", angle: 180 },
          layers: [L("ayna", 160, 20, 110, 146, { color: "#C9A08A", opacity: 0.55 }), L("parilti", 300, 40, 30, 30, { color: "#F3D27A", motion: "parilti" }), L("parilti", 120, 150, 20, 20, { color: "#F3D27A", motion: "parilti", speed: 1.5 })],
          particles: { type: "parilti", density: 0.6 }, light: { type: "altin", strength: 0.3 } } },
        { label: "Siyah altın", canvas: "#16120F", dark: true, bg: { base: { type: "gradient", from: "#221B17", to: "#0E0B09", angle: 180 },
          layers: [L("ayna", 160, 20, 110, 146, { color: "#D9B26A", opacity: 0.6 })], particles: { type: "parilti", density: 0.8 }, light: { type: "altin", strength: 0.4 } } }
      ],
      present: { "before-after": { frame: "altin" }, "price-list": { frame: "cam" }, appointment: { open: "cevir" }, hours: { frame: "cam" }, services: { frame: "cam" }, campaign: { frame: "" }, gallery: { special: "polaroid-yigin" } },
      interactive: { kind: "kazi-kazan", title: "Kazı, indirimini öğren", message: "İlk randevuya %15 indirim!", effect: "yildiz" },
      kurgu: ["k:kapi", "k:cicek", "k:sade"], concept: "isilti" },

    { id: "kafe", label: "Butik · Kafe · Restoran", group: "İşletme", template: "isletme", icon: "kahve",
      desc: "Vitrin, tahta menü ve buhar; menü tahtası ve kart destesi.",
      texts: { title: "Kahve Durağı", subtitle: "Taze kahve · Ev yapımı tatlılar", date: "Her gün 08.00 – 22.00", story: "Mahallenin en sıcak köşesine hoş geldiniz.", closing: "Bir kahveye bekleriz" },
      language: { palette: { paper: "#FBF6EF", ink: "#2E2420", accent: "#8A5A3B", accent2: "#3E6B48" }, fonts: { title: "Pacifico", heading: "Playfair Display", body: "Work Sans" }, radius: 12 },
      variants: [
        { label: "Sıcak köşe", canvas: "#F8F1E8", bg: { base: { type: "gradient", from: "#FBF6EF", to: "#F1E4D3", angle: 180 },
          layers: [L("tente", 0, 0, 430, 90, { color: "#3E6B48", color2: "#FBF6EF" }), L("kahve", 330, 110, 80, 80, { color: "#8A5A3B", motion: "suzulme", opacity: 0.8 }),
            L("yaprak-saksi", 20, 700, 64, 90, { color: "#5E8C5A", motion: "salinim" })],
          particles: { type: "none" }, light: { type: "kagit", strength: 0.45 } } },
        { label: "Akşam", canvas: "#211915", dark: true, bg: { base: { type: "gradient", from: "#2C221C", to: "#140F0C", angle: 180 },
          layers: [L("tente", 0, 0, 430, 90, { color: "#8A5A3B", color2: "#2C221C" }), L("kahve", 330, 110, 80, 80, { color: "#D9B26A", motion: "suzulme", opacity: 0.7 })],
          particles: { type: "atesbocegi", density: 0.4, colors: ["#FFD27A"] }, light: { type: "altin", strength: 0.35 } } }
      ],
      present: { "price-list": { frame: "tabela" }, services: { frame: "kartpostal" }, hours: { frame: "tabela" }, location: { special: "harita" }, gallery: { special: "film" }, campaign: { frame: "" } },
      modSettings: { "price-list": { textColor: "#FFF6E6", accentColor: "#F3D27A" }, hours: { textColor: "#FFF6E6", accentColor: "#F3D27A" } },
      interactive: { kind: "kazi-kazan", title: "Kampanyayı kazıyın", message: "2. kahve bizden! ☕", effect: "konfeti" },
      kurgu: ["k:kurdele", "k:kitap", "k:hediye"], concept: "zarif" },

    { id: "danisman", label: "Diyetisyen · Psikolog · Danışman", group: "İşletme", template: "isletme", icon: "yaprak-kose",
      desc: "Minimal, yumuşak geçişler ve nefes alan şekiller; sade kartlar ve randevu.",
      texts: { title: "Dyt. Selin Aydın", subtitle: "Beslenme ve Diyet Danışmanlığı", date: "Online ve yüz yüze görüşme", story: "Size özel, sürdürülebilir bir yaşam planı.", closing: "İlk görüşme için yazın" },
      language: { palette: { paper: "#FFFFFF", ink: "#22302B", accent: "#6FA08A", accent2: "#3D6B5A" }, fonts: { title: "Tenor Sans", heading: "Tenor Sans", body: "Nunito Sans" }, radius: 18 },
      variants: [
        { label: "Nane", canvas: "#F3F8F5", bg: { base: { type: "gradient", from: "#F7FBF9", to: "#E6F0EB", angle: 180 },
          layers: [L("yaprak-kose", -10, -10, 150, 150, { color: "#B9D5C7", motion: "nefes", speed: 0.5 }), L("halka", 280, 500, 180, 180, { color: "#B9D5C7", motion: "nefes", speed: 0.4, opacity: 0.6 })],
          particles: { type: "none" }, light: { type: "none" } } },
        { label: "Kum", canvas: "#F8F4EE", bg: { base: { type: "gradient", from: "#FBF8F3", to: "#EFE7DB", angle: 180 },
          layers: [L("dalga", 0, 560, 430, 108, { color: "#E8DCCB", color2: "#DCCCB4", motion: "nefes", speed: 0.4 })], particles: { type: "none" }, light: { type: "keten", strength: 0.5 } } }
      ],
      present: { services: { frame: "cam" }, appointment: { frame: "cam" }, hours: { frame: "cam" }, "price-list": { frame: "cam" }, location: { frame: "cam" } },
      interactive: null,
      kurgu: ["k:sade", "k:zarif"], concept: "sade" },

    { id: "emlak", label: "Emlak · Organizasyon", group: "İşletme", template: "isletme", icon: "ev",
      desc: "Ev silueti ve sahne ışıkları; galeri vitrini ve harita kartı; anahtar çevir.",
      texts: { title: "Yıldız Emlak", subtitle: "Hayalinizdeki eve bir adım", date: "Satılık · Kiralık · Danışmanlık", story: "Doğru ev, doğru fiyat, güvenilir hizmet.", closing: "Size en uygun evi birlikte bulalım" },
      language: { palette: { paper: "#FFFFFF", ink: "#1F2630", accent: "#B08D57", accent2: "#24364F" }, fonts: { title: "Marcellus", heading: "Marcellus", body: "DM Sans" }, radius: 12 },
      variants: [
        { label: "Gün ışığı", canvas: "#F7F6F2", bg: { base: { type: "gradient", from: "#FFFFFF", to: "#EFEDE6", angle: 180 },
          layers: [L("ev", 230, 40, 190, 118, { color: "#24364F", opacity: 0.12 }), L("anahtar", 20, 520, 90, 38, { color: "#B08D57", motion: "salinim", origin: "18% 50%" })],
          particles: { type: "none" }, light: { type: "gunes", strength: 0.5 } } },
        { label: "Akşam", canvas: "#16202C", dark: true, bg: { base: { type: "gradient", from: "#1D2A3A", to: "#0E141C", angle: 180 },
          layers: [L("ev", 200, 40, 210, 130, { color: "#0B1118" }), L("isik-huzmesi", 30, 0, 140, 400, { color: "#F3D27A", opacity: 0.2, rotate: -10 })],
          particles: { type: "yildiz", density: 0.5 }, light: { type: "vinyet", strength: 0.4 } } }
      ],
      present: { gallery: { special: "vitrin" }, location: { special: "harita" }, services: { frame: "cam" }, appointment: { open: "cevir" }, hours: { frame: "cam" } },
      interactive: { kind: "kapi-cal", title: "Kapıyı çalın, evi görün", message: "Yeni evinizin anahtarı burada", effect: "yildiz", color: "#24364F" },
      kurgu: ["k:anahtar", "k:kapi"], concept: "altin" }
  ];

  /* ---------------- yerleşim şablonları ----------------
     Bir şablon bölümlerden oluşur. Bölüm; içine hangi metin rollerinin ve
     modüllerin gireceğini ve aralarındaki boşluğu söyler. Boş tasarıma
     uygulanınca bu bölümler gerçek katmanlarla doldurulur; mevcut tasarıma
     uygulanınca var olan katmanlar bu bölümlere göre sıraya dizilir. */
  const TEMPLATES = {
    davet: { label: "Davet (giriş · hikâye · detaylar · program · konum · katılım · galeri · kapanış)", sections: [
      { id: "giris", label: "Giriş", texts: ["title", "subtitle", "date"], modules: ["music"] },
      { id: "hikaye", label: "Hikâye", texts: ["story"], modules: ["interactive"] },
      { id: "detaylar", label: "Detaylar", modules: ["countdown", "calendar"] },
      { id: "program", label: "Program", modules: ["price-list", "services"] },
      { id: "konum", label: "Konum", modules: ["location"] },
      { id: "katilim", label: "Katılım", modules: ["attendance-form", "rsvp", "poll", "feedback", "gift"] },
      { id: "galeri", label: "Galeri", modules: ["gallery", "guest-upload", "before-after", "celebration"] },
      { id: "kapanis", label: "Kapanış", texts: ["closing"], modules: ["qrcode", "social-media"] }
    ], create: ["music", "interactive", "countdown", "location", "attendance-form", "gallery"] },
    isletme: { label: "İşletme sayfası (tanıtım · kampanya · hizmetler · fiyatlar · saatler · randevu · konum · sosyal medya)", sections: [
      { id: "giris", label: "Tanıtım", texts: ["title", "subtitle", "date", "story"], modules: [] },
      { id: "kampanya", label: "Kampanya", modules: ["campaign", "interactive"] },
      { id: "hizmetler", label: "Hizmetler", modules: ["services", "before-after"] },
      { id: "fiyat", label: "Fiyatlar", modules: ["price-list"] },
      { id: "saatler", label: "Çalışma saatleri", modules: ["hours"] },
      { id: "randevu", label: "Randevu", modules: ["appointment", "rsvp", "attendance-form", "feedback"] },
      { id: "konum", label: "Konum", modules: ["location"] },
      { id: "galeri", label: "Galeri", modules: ["gallery", "music", "countdown", "calendar", "poll", "gift", "guest-upload", "celebration"] },
      { id: "kapanis", label: "Kapanış", texts: ["closing"], modules: ["social-media", "qrcode"] }
    ], create: ["campaign", "services", "price-list", "hours", "appointment", "location", "social-media"] }
  };

  const TEXT_STYLE = {
    title: { font: "title", size: 46, w: 380, h: 70 },
    subtitle: { font: "heading", size: 22, w: 360, h: 34, accent: true },
    date: { font: "body", size: 15, w: 340, h: 24, spacing: 2 },
    story: { font: "heading", size: 20, w: 350, h: 60, italic: true },
    closing: { font: "title", size: 34, w: 360, h: 50 }
  };

  global.SeozThemePacks = { PACKS, TEMPLATES, TEXT_STYLE, pack: id => PACKS.find(p => p.id === id) || null };
})(window);
