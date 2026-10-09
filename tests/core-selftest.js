// GEÇİCİ TEST DOSYASI — teslim edilen projenin parçası değildir.
global.window = global;

// Basit localStorage polyfill
const store = {};
global.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; }
};

require("../js/core/document-model.js");
require("../js/core/storage.js");
require("../js/core/blob-store.js");
require("../js/core/renderer.js");
require("../js/entry-scene.js");
require("../js/modules/module-registry.js");
require("../js/modules/location.js");
require("../js/modules/music.js");
require("../js/modules/countdown.js");
require("../js/modules/rsvp.js");
require("../js/modules/gallery.js");
require("../js/modules/guest-upload.js");
require("../js/modules/celebration.js");
require("../js/modules/poll.js");
require("../js/modules/feedback.js");
require("../js/modules/gift.js");
require("../js/modules/calendar.js");
require("../js/editor/publish.js");
require("../js/editor/export-package.js");
require("../js/fonts-library.js");

function assert(cond, msg) {
  if (!cond) throw new Error("BAŞARISIZ: " + msg);
  console.log("OK: " + msg);
}

// 1) Boş belge oluşturma
const doc = SeozDocModel.createEmptyDocument("Test Davetiyesi", "dugun");
assert(doc.id && doc.meta.title === "Test Davetiyesi", "createEmptyDocument temel alanlar");
assert(Array.isArray(doc.layers) && doc.layers.length === 0, "yeni belge boş layers dizisiyle başlıyor");

// 2) Metin katmanı ekleme
const textLayer = SeozDocModel.createTextLayer({ z: SeozDocModel.nextZ(doc) });
doc.layers.push(textLayer);
assert(doc.layers.length === 1, "metin katmanı eklendi");
assert(textLayer.content.fontSize === 28, "varsayılan font boyutu");

// 3) Görsel katmanı ekleme
const imgLayer = SeozDocModel.createImageLayer({ z: SeozDocModel.nextZ(doc), w: 300, h: 200 });
doc.layers.push(imgLayer);
assert(doc.layers.length === 2, "görsel katmanı eklendi");
assert(imgLayer.type === "image" && imgLayer.w === 300 && imgLayer.h === 200, "görsel katman boyutları");

// 4) nextZ mantığı artan mı?
assert(imgLayer.z > textLayer.z, "nextZ her seferinde artıyor");

// 4b) FAZ 3 — giriş sahnesi varsayılanları
assert(doc.entry.type === "none", "yeni belge giriş türü varsayılan olarak 'none'");
assert(doc.entry.allowReplayForGuest === false, "misafir tekrar izleme varsayılan olarak kapalı");
doc.entry.type = "png";
doc.entry.pngSrc = "data:image/png;base64,AAAA";
assert(doc.entry.pngSrc, "giriş türü ve görseli ayarlanabiliyor");

// 5) Taslak kaydetme + okuma
SeozStorage.saveDraft(doc);
const loaded = SeozStorage.loadDraft(doc.id);
assert(loaded && loaded.layers.length === 2, "taslak kaydedilip geri okunabiliyor");
assert(loaded.meta.updatedAt, "kayıt sırasında updatedAt dolduruluyor");

// 6) Liste (index) doğru mu?
const list = SeozStorage.listDocuments();
assert(list.some(d => d.id === doc.id), "belge kütüphane listesinde görünüyor");

// 7) Kopyalama farklı id üretiyor mu?
const dup = SeozStorage.duplicateDocument(doc.id);
assert(dup.id !== doc.id, "kopya farklı bir id alıyor");
assert(dup.layers.length === 2, "kopya aynı katman sayısına sahip");
assert(dup.meta.title.includes("kopya"), "kopya başlığı işaretleniyor");

// 8) Yayınlama — taslak değiştirilse bile yayın eski kalmalı
const published1 = SeozStorage.publish(doc.id);
assert(SeozStorage.isPublished(doc.id), "yayınlandıktan sonra isPublished true");
assert(published1.layers.length === 2, "ilk yayın anlık görüntüsü doğru");
assert(published1.entry.type === "png" && published1.entry.pngSrc, "yayın anlık görüntüsü giriş sahnesi verisini de koruyor");

// Taslağı değiştir (yeni bir metin ekle) ama YENİDEN YAYINLAMA
const draftAgain = SeozStorage.loadDraft(doc.id);
draftAgain.layers.push(SeozDocModel.createTextLayer({ z: SeozDocModel.nextZ(draftAgain) }));
SeozStorage.saveDraft(draftAgain);

const stillPublished = SeozStorage.loadPublished(doc.id);
assert(stillPublished.layers.length === 2, "taslak değişse de YENİDEN yayınlamadan yayın sürümü değişmiyor (kritik davranış)");

// Şimdi yeniden yayınla → güncellenmeli
SeozStorage.publish(doc.id);
const republished = SeozStorage.loadPublished(doc.id);
assert(republished.layers.length === 3, "yeniden yayınlayınca yayın sürümü güncelleniyor");

// 9) Dışa/içe aktarma round-trip
const json = SeozStorage.exportJSON(doc.id);
const imported = SeozStorage.importJSON(json);
assert(imported.id !== doc.id, "içe aktarılan belge çakışmayı önlemek için yeni id alıyor");
assert(imported.layers.length === 3, "içe aktarılan belge katmanları koruyor");

// 10) Silme
SeozStorage.deleteDocument(dup.id);
assert(!SeozStorage.loadDraft(dup.id), "silinen belge artık taslak olarak okunamıyor");
assert(!SeozStorage.listDocuments().some(d => d.id === dup.id), "silinen belge listeden kayboluyor");

// 11) Geçersiz JSON içe aktarma reddediliyor mu?
let threw = false;
try { SeozStorage.importJSON("{\"bad\": true}"); } catch (e) { threw = true; }
assert(threw, "geçersiz belge içe aktarımı hata fırlatıyor (validateDocument çalışıyor)");

// 12) FAZ 3 — SeozEntryScene.hasUsableEntry mantığı (DOM'suz, saf mantık)
assert(SeozEntryScene.hasUsableEntry({ type: "none" }) === false, "giriş yok -> kullanılabilir değil");
assert(SeozEntryScene.hasUsableEntry({ type: "png", pngSrc: "" }) === false, "png ama görsel boş -> kullanılabilir değil");
assert(SeozEntryScene.hasUsableEntry({ type: "png", pngSrc: "data:x" }) === true, "png ve görsel dolu -> kullanılabilir");
assert(SeozEntryScene.hasUsableEntry({ type: "video", videoSrc: "data:x" }) === true, "video ve dosya dolu -> kullanılabilir");
assert(SeozEntryScene.hasUsableEntry({ type: "video", videoSrc: "" }) === false, "video ama dosya boş -> kullanılabilir değil");

// FAZ 6 düzeltmesi — iç kart görseli (cardSrc)
assert(doc.entry.cardSrc === "", "yeni belge iç kart görseli olmadan başlıyor (varsayılan boş)");
assert(SeozEntryScene.hasUsableEntry({ type: "png", pngSrc: "data:x", cardSrc: "" }) === true, "kart olmadan PNG giriş hâlâ kullanılabilir (geriye dönük uyumlu)");
assert(SeozEntryScene.hasUsableEntry({ type: "png", pngSrc: "", cardSrc: "data:x" }) === false, "zarf görseli olmadan yalnızca kart olması girişi kullanılabilir yapmıyor (zarf hâlâ zorunlu)");
doc.entry.type = "png";
doc.entry.cardSrc = "data:image/png;base64,BBBB";
assert(doc.entry.cardSrc === "data:image/png;base64,BBBB", "iç kart görseli ayarlanabiliyor");

// 13) FAZ 4/5/6 — modül kayıt sistemi
const modules = SeozModuleRegistry.listModules();
assert(modules.length === 11, "11 modül kayıtlı (konum, müzik, geri sayım, RSVP, galeri, anı yükle, kutlama efekti, anket, görüş bildir, hediye, takvime ekle)");
assert(SeozModuleRegistry.getModule("location") && SeozModuleRegistry.getModule("music") && SeozModuleRegistry.getModule("countdown") && SeozModuleRegistry.getModule("rsvp") && SeozModuleRegistry.getModule("gallery") && SeozModuleRegistry.getModule("guest-upload") && SeozModuleRegistry.getModule("celebration"), "her yedi modül id'siyle bulunabiliyor");
assert(SeozModuleRegistry.getModule("olmayan-modul") === null, "kayıtlı olmayan modül null döner (renderer güvenli şekilde çöküyor değil)");

// 14) FAZ 4/5/6 — modül katmanı oluşturma, her modülün kendi varsayılanlarıyla
["location", "music", "countdown", "rsvp", "gallery", "guest-upload", "celebration"].forEach(id => {
  const def = SeozModuleRegistry.getModule(id);
  const layer = SeozDocModel.createModuleLayer(id, def.defaultSettings, { z: SeozDocModel.nextZ(doc) });
  assert(layer.type === "module" && layer.moduleId === id, `${id} katmanı doğru type/moduleId ile oluşuyor`);
  assert(JSON.stringify(layer.settings) === JSON.stringify(def.defaultSettings), `${id} katmanı modülün varsayılan ayarlarını kopyalıyor (referans değil, bağımsız kopya)`);
  layer.settings.__test = "x";
  assert(def.defaultSettings.__test === undefined, `${id} katmanının ayarlarını değiştirmek modülün varsayılanlarını BOZMUYOR (derin kopya doğrulaması)`);
  doc.layers.push(layer);
});
assert(doc.layers.filter(l => l.type === "module").length === 7, "7 modül katmanı belgeye eklendi");

// 15) settingsSchema her modülde eksiksiz mi? (panel formu bunlardan üretiliyor)
modules.forEach(m => {
  // Anket kendi özel panelini (poll-panel.js) kullandığı için şeması bilinçli olarak boştur.
  assert(Array.isArray(m.settingsSchema) && (m.id === "poll" || m.settingsSchema.length > 0), `${m.id} modülünün settingsSchema'sı dolu`);
  assert(m.defaultLayerSize && m.defaultLayerSize.w > 0 && m.defaultLayerSize.h > 0, `${m.id} modülünün varsayılan katman boyutu tanımlı`);
});

// 16) Modül katmanlarını içeren belge kaydedilip geri okunabiliyor mu?
SeozStorage.saveDraft(doc);
const reloaded = SeozStorage.loadDraft(doc.id);
assert(reloaded.layers.filter(l => l.type === "module").length === 7, "modül katmanları kayıttan sonra korunuyor");

// 17) FAZ 4 düzeltmesi — blob-store.js referans mantığı (IndexedDB'ye
// dokunmadan, saf mantık testi)
assert(SeozBlobStore.isRef("idb:abc123") === true, "idb: ile başlayan değer bir referans olarak tanınıyor");
assert(SeozBlobStore.isRef("data:image/png;base64,AAAA") === false, "eski gömülü data URL bir referans DEĞİL (geriye dönük uyumluluk)");
assert(SeozBlobStore.isRef("") === false, "boş değer referans değil");
assert(SeozBlobStore.isRef(null) === false, "null değer referans değil (çökme yok)");

let resolvedPassthrough = null;
SeozBlobStore.resolveToObjectURL("data:image/png;base64,AAAA").then(url => { resolvedPassthrough = url; });
// Promise mikro görev kuyruğuna düştüğü için senkron test ortamında hemen
// okunamaz — bu satır yalnızca çağrının hata FIRLATMADIĞINI doğrular.
assert(true, "resolveToObjectURL eski (idb: olmayan) bir değer için hata fırlatmıyor");

// 18) FAZ 5 — RSVP modülünün showIf koşulları doğru mod kombinasyonlarında çalışıyor mu?
const rsvpDef = SeozModuleRegistry.getModule("rsvp");
assert(rsvpDef.defaultSettings.rsvpMode === "kapali", "RSVP varsayılan olarak Kapalı");

function fieldByKey(key) { return rsvpDef.settingsSchema.find(f => f.key === key); }

const modeKapali = { rsvpMode: "kapali" };
const modeTek = { rsvpMode: "whatsapp-tek" };
const modeForm = { rsvpMode: "google-form" };
const modeIki = { rsvpMode: "whatsapp-iki" };

assert(fieldByKey("whatsappNumber").showIf(modeTek) === true, "WhatsApp tek buton modunda numara alanı görünür");
assert(fieldByKey("whatsappNumber").showIf(modeIki) === true, "WhatsApp iki buton modunda numara alanı görünür");
assert(fieldByKey("whatsappNumber").showIf(modeForm) === false, "Google Form modunda numara alanı GİZLİ");
assert(fieldByKey("whatsappNumber").showIf(modeKapali) === false, "Kapalı modda numara alanı GİZLİ");

assert(fieldByKey("googleFormUrl").showIf(modeForm) === true, "Google Form modunda form bağlantısı alanı görünür");
assert(fieldByKey("googleFormUrl").showIf(modeTek) === false, "WhatsApp tek buton modunda form bağlantısı alanı GİZLİ");

assert(fieldByKey("acceptMessage").showIf(modeIki) === true, "İki buton modunda 'Katılıyorum' mesajı alanı görünür");
assert(fieldByKey("acceptMessage").showIf(modeTek) === false, "Tek buton modunda 'Katılıyorum' mesajı alanı GİZLİ (o moda özgü değil)");
assert(fieldByKey("declineMessage").showIf(modeIki) === true, "İki buton modunda 'Katılamıyorum' mesajı alanı görünür");

assert(fieldByKey("buttonText").showIf(modeTek) === true, "Tek buton modunda ortak buton yazısı alanı görünür");
assert(fieldByKey("buttonText").showIf(modeForm) === true, "Google Form modunda da ortak buton yazısı alanı görünür");
assert(fieldByKey("buttonText").showIf(modeIki) === false, "İki buton modunda ortak buton yazısı yerine ayrı alanlar kullanılır");

assert(fieldByKey("bgColor").showIf(modeKapali) === false, "Kapalı modda stil alanları (renk vb.) GİZLİ");
assert(fieldByKey("bgColor").showIf(modeTek) === true, "Herhangi bir aktif modda stil alanları görünür");
assert(fieldByKey("rsvpMode").reRenderPanel === true, "Mod seçici değiştiğinde panel yeniden kurulacak şekilde işaretli");

// 19) RSVP katmanı oluşturma ve kaydetme
const rsvpLayer = SeozDocModel.createModuleLayer("rsvp", rsvpDef.defaultSettings, { z: SeozDocModel.nextZ(doc) });
doc.layers.push(rsvpLayer);
SeozStorage.saveDraft(doc);
const reloadedWithRsvp = SeozStorage.loadDraft(doc.id);
assert(reloadedWithRsvp.layers.some(l => l.moduleId === "rsvp"), "RSVP katmanı kayıt/yükleme sonrası korunuyor");

// 20) FAZ 6 — Galeri modülü
const galleryDef = SeozModuleRegistry.getModule("gallery");
assert(Array.isArray(galleryDef.defaultSettings.images) && galleryDef.defaultSettings.images.length === 0, "Galeri varsayılan olarak boş fotoğraf listesiyle başlıyor");
assert(galleryDef.settingsSchema.some(f => f.type === "image-list"), "Galeri şemasında 'image-list' tipinde bir alan var");

const galleryLayer = SeozDocModel.createModuleLayer("gallery", galleryDef.defaultSettings, { z: SeozDocModel.nextZ(doc) });
galleryLayer.settings.images.push({ ref: "idb:test1", naturalWidth: 800, naturalHeight: 600 });
assert(galleryDef.defaultSettings.images.length === 0, "Bir galeri katmanına fotoğraf eklemek modülün asıl varsayılanlarını BOZMUYOR (derin kopya doğrulaması)");
doc.layers.push(galleryLayer);

// 21) FAZ 5 düzeltmesi — Anı Yükle modülü artık harici bağlantı butonu
// (Blob/IndexedDB kullanmıyor; saf ayar/şema testi)
const guestDef = SeozModuleRegistry.getModule("guest-upload");
assert(guestDef.label === "Anı Yükle", "Anı Yükle modülünün etiketi doğru");
assert(guestDef.defaultSettings.uploadUrl === "", "Anı Yükle varsayılan olarak boş bir harici bağlantıyla başlıyor");
assert(guestDef.settingsSchema.some(f => f.key === "uploadUrl" && f.type === "url"), "Şemada harici bağlantı alanı var");
assert(guestDef.settingsSchema.some(f => f.key === "title"), "Şemada başlık alanı var");
assert(guestDef.settingsSchema.some(f => f.key === "description"), "Şemada açıklama alanı var");
assert(!guestDef.settingsSchema.some(f => f.type === "image-list" || f.type === "file-audio"), "Şemada artık dosya yükleme/önizleme alanı YOK");
assert(typeof global.SeozGuestUploads === "undefined", "Eski SeozGuestUploads (Blob/IndexedDB) sistemi tamamen kaldırıldı");

const guestLayer = SeozDocModel.createModuleLayer("guest-upload", guestDef.defaultSettings, { z: SeozDocModel.nextZ(doc) });
guestLayer.settings.uploadUrl = "https://drive.google.com/drive/folders/ornek";
assert(guestDef.defaultSettings.uploadUrl === "", "Bir katmanın bağlantısını değiştirmek modülün asıl varsayılanlarını BOZMUYOR (derin kopya doğrulaması)");
doc.layers.push(guestLayer);

// 22) Galeri + Anı Yükle katmanları da dahil belge kaydedilip geri okunabiliyor mu?
SeozStorage.saveDraft(doc);
const reloadedFull = SeozStorage.loadDraft(doc.id);
assert(reloadedFull.layers.some(l => l.moduleId === "gallery" && l.settings.images.length === 1), "Galeri katmanı, içindeki fotoğraf listesiyle birlikte kayıt/yükleme sonrası korunuyor");
assert(reloadedFull.layers.some(l => l.moduleId === "guest-upload" && l.settings.uploadUrl === "https://drive.google.com/drive/folders/ornek"), "Anı Yükle katmanı, harici bağlantısıyla birlikte kayıt/yükleme sonrası korunuyor");

// 23) FAZ 6 — Kutlama Efekti modülü
const celebrationDef = SeozModuleRegistry.getModule("celebration");
assert(celebrationDef.defaultSettings.triggerMode === "auto", "Kutlama Efekti varsayılan olarak otomatik tetiklenir");
assert(celebrationDef.defaultSettings.allowReplay === true, "Kutlama Efekti varsayılan olarak misafirin tekrar oynatmasına izin verir");
assert(celebrationDef.defaultSettings.intensity === "orta", "Kutlama Efekti varsayılan yoğunluğu 'orta'");

function celebrationField(key) { return celebrationDef.settingsSchema.find(f => f.key === key); }
assert(celebrationField("triggerMode").reRenderPanel === true, "Tetikleme seçicisi değiştiğinde panel yeniden kurulacak şekilde işaretli");
assert(celebrationField("allowReplay").type === "checkbox", "'Misafir tekrar oynatabilsin' bir onay kutusu (checkbox)");
assert(celebrationField("allowReplay").showIf({ triggerMode: "auto" }) === true, "Otomatik modda tekrar oynatma izni alanı görünür");
assert(celebrationField("allowReplay").showIf({ triggerMode: "button" }) === false, "Buton modunda tekrar oynatma izni alanı GİZLİ (anlamsız)");
assert(celebrationField("buttonText").showIf({ triggerMode: "button" }) === true, "Buton modunda buton yazısı alanı görünür");
assert(celebrationField("buttonText").showIf({ triggerMode: "auto" }) === false, "Otomatik modda buton yazısı alanı GİZLİ");
assert(celebrationField("bgColor").showIf({ triggerMode: "button" }) === true, "Buton modunda stil alanları görünür");
assert(celebrationField("bgColor").showIf({ triggerMode: "auto" }) === false, "Otomatik modda stil alanları GİZLİ (görünür bir buton yok)");

const celebrationLayer = SeozDocModel.createModuleLayer("celebration", celebrationDef.defaultSettings, { z: SeozDocModel.nextZ(doc) });
celebrationLayer.settings.effectType = "sparkle";
assert(celebrationDef.defaultSettings.effectType === "confetti", "Bir katmanın efekt türünü değiştirmek modülün asıl varsayılanlarını BOZMUYOR (derin kopya doğrulaması)");
doc.layers.push(celebrationLayer);

SeozStorage.saveDraft(doc);
const reloadedWithCelebration = SeozStorage.loadDraft(doc.id);
assert(reloadedWithCelebration.layers.some(l => l.moduleId === "celebration" && l.settings.effectType === "sparkle"), "Kutlama Efekti katmanı, seçilen efekt türüyle birlikte kayıt/yükleme sonrası korunuyor");

// 24) FAZ 8 — duyarlı (responsive) geometri çözümleme
const respLayer = SeozDocModel.createTextLayer({ x: 10, y: 20, w: 300, z: SeozDocModel.nextZ(doc) });

// override kapalıyken mobile ve desktop AYNI (mobil öncelikli tek tasarım)
const geoMobile1 = SeozDocModel.resolveGeometry(respLayer, "mobile");
const geoDesktop1 = SeozDocModel.resolveGeometry(respLayer, "desktop");
assert(geoMobile1.x === 10 && geoMobile1.y === 20 && geoMobile1.w === 300, "override kapalıyken mobile geometri doğru");
assert(geoDesktop1.x === 10 && geoDesktop1.y === 20 && geoDesktop1.w === 300, "override kapalıyken desktop geometri mobil ile BİREBİR AYNI");
assert(respLayer.desktopOverride.enabled === false, "yeni katmanda masaüstü override varsayılan olarak kapalı");

// desktop'ta konum değiştirmek yalnızca override'ı etkiler, mobile'a dokunmaz
SeozDocModel.setGeometry(respLayer, "desktop", { x: 500, y: 600 });
assert(respLayer.desktopOverride.enabled === true, "setGeometry('desktop', ...) override'ı otomatik etkinleştiriyor");
assert(respLayer.x === 10 && respLayer.y === 20, "masaüstü için konum değiştirmek MOBİL (asıl) x/y'yi BOZMUYOR");
const geoDesktop2 = SeozDocModel.resolveGeometry(respLayer, "desktop");
assert(geoDesktop2.x === 500 && geoDesktop2.y === 600, "override etkinleştikten sonra desktop geometri yeni değerleri kullanıyor");
assert(geoDesktop2.w === 300, "override'da belirtilmeyen alanlar (w) mobil değerden MİRAS ALINIYOR");
const geoMobile2 = SeozDocModel.resolveGeometry(respLayer, "mobile");
assert(geoMobile2.x === 10 && geoMobile2.y === 20, "masaüstü override'ı etkinleştirmek mobile geometriyi ETKİLEMİYOR");

// sıfırlama
SeozDocModel.clearDesktopOverride(respLayer);
assert(respLayer.desktopOverride.enabled === false, "clearDesktopOverride override'ı kapatıyor");
const geoDesktop3 = SeozDocModel.resolveGeometry(respLayer, "desktop");
assert(geoDesktop3.x === 10 && geoDesktop3.y === 20, "sıfırlama sonrası desktop tekrar mobil ile aynı");

// setGeometry('mobile', ...) doğrudan asıl alanlara yazmalı (override'a değil)
SeozDocModel.setGeometry(respLayer, "mobile", { x: 99 });
assert(respLayer.x === 99, "setGeometry('mobile', ...) doğrudan katmanın kendi x/y/w/h'sine yazıyor");
assert(respLayer.desktopOverride.enabled === false, "mobile için yazmak masaüstü override'ını ETKİNLEŞTİRMİYOR");

// eski (FAZ 1-7'de kaydedilmiş, "mobile" adlı eski alanı olan) bir katman
// çökmeden çalışmaya devam etmeli (desktopOverride alanı yoksa bile)
const legacyLayer = { id: "legacy1", type: "text", x: 5, y: 6, w: 100, mobile: { override: false } };
const geoLegacy = SeozDocModel.resolveGeometry(legacyLayer, "desktop");
assert(geoLegacy.x === 5 && geoLegacy.y === 6, "desktopOverride alanı hiç olmayan eski bir katman çökmeden mobil değerlerini döndürüyor");

// 25) FAZ 9 — modül bazlı "Yayına Hazırla" doğrulaması (validate kancası)
assert(typeof SeozModuleRegistry.getModule("location").validate === "function", "Konum modülünün validate kancası tanımlı");
assert(SeozModuleRegistry.getModule("location").validate({ mapsUrl: "" }) !== null, "Konum: boş Maps bağlantısı uyarı üretiyor");
assert(SeozModuleRegistry.getModule("location").validate({ mapsUrl: "https://maps.google.com/x" }) === null, "Konum: dolu Maps bağlantısında uyarı YOK");

assert(SeozModuleRegistry.getModule("music").validate({ audioSrc: "" }) !== null, "Müzik: boş ses dosyası uyarı üretiyor");
assert(SeozModuleRegistry.getModule("music").validate({ audioSrc: "idb:x" }) === null, "Müzik: dolu ses dosyasında uyarı YOK");

assert(SeozModuleRegistry.getModule("countdown").validate({ targetDate: "" }) !== null, "Geri Sayım: boş tarih uyarı üretiyor");
assert(SeozModuleRegistry.getModule("countdown").validate({ targetDate: "2027-01-01" }) === null, "Geri Sayım: dolu tarihte uyarı YOK");

assert(SeozModuleRegistry.getModule("guest-upload").validate({ uploadUrl: "" }) !== null, "Anı Yükle: boş bağlantı uyarı üretiyor");
assert(SeozModuleRegistry.getModule("guest-upload").validate({ uploadUrl: "https://drive.google.com/x" }) === null, "Anı Yükle: dolu bağlantıda uyarı YOK");

const rsvpModuleDef = SeozModuleRegistry.getModule("rsvp");
assert(rsvpModuleDef.validate({ rsvpMode: "kapali" }) === null, "RSVP: Kapalı modda uyarı YOK");
assert(rsvpModuleDef.validate({ rsvpMode: "whatsapp-tek", whatsappNumber: "" }) !== null, "RSVP: WhatsApp tek buton, numara boşsa uyarı üretiyor");
assert(rsvpModuleDef.validate({ rsvpMode: "whatsapp-tek", whatsappNumber: "905551112233" }) === null, "RSVP: WhatsApp tek buton, numara doluysa uyarı YOK");
assert(rsvpModuleDef.validate({ rsvpMode: "whatsapp-iki", whatsappNumber: "" }) !== null, "RSVP: WhatsApp iki buton, numara boşsa uyarı üretiyor");
assert(rsvpModuleDef.validate({ rsvpMode: "google-form", googleFormUrl: "" }) !== null, "RSVP: Google Form, bağlantı boşsa uyarı üretiyor");
assert(rsvpModuleDef.validate({ rsvpMode: "google-form", googleFormUrl: "https://forms.gle/x" }) === null, "RSVP: Google Form, bağlantı doluysa uyarı YOK");
assert(SeozModuleRegistry.getModule("gallery").validate === undefined, "Galeri'nin validate kancası YOK (boş galeri geçerli bir durumdur, zorunlu değil)");
assert(SeozModuleRegistry.getModule("celebration").validate === undefined, "Kutlama Efekti'nin validate kancası YOK (her zaman kendi varsayılanıyla geçerlidir)");

// validateForPublish — tüm belge üzerinden uçtan uca
const publishTestDoc = SeozDocModel.createEmptyDocument("Yayın Testi", "bos-sayfa");
const emptyWarnings = SeozPublish.validateForPublish(publishTestDoc);
assert(emptyWarnings.some(w => w.indexOf("hiç içerik") !== -1), "Hiç katmanı olmayan belge için 'içerik yok' uyarısı üretiliyor");

publishTestDoc.layers.push(SeozDocModel.createTextLayer({ z: 1 }));
const withTextWarnings = SeozPublish.validateForPublish(publishTestDoc);
assert(!withTextWarnings.some(w => w.indexOf("hiç içerik") !== -1), "Bir metin katmanı eklenince 'içerik yok' uyarısı kayboluyor");

const locDef = SeozModuleRegistry.getModule("location");
const locLayer = SeozDocModel.createModuleLayer("location", locDef.defaultSettings, { z: 2 });
publishTestDoc.layers.push(locLayer);
const withEmptyLocationWarnings = SeozPublish.validateForPublish(publishTestDoc);
assert(withEmptyLocationWarnings.some(w => w.indexOf("Konum") !== -1), "Boş Konum ayarlarıyla eklenen modül, doğru uyarıyı belgenin genel taramasına yansıtıyor");
locLayer.settings.mapsUrl = "https://maps.google.com/x";
const withFilledLocationWarnings = SeozPublish.validateForPublish(publishTestDoc);
assert(!withFilledLocationWarnings.some(w => w.indexOf("Konum") !== -1), "Konum bağlantısı doldurulunca ilgili uyarı kayboluyor");

publishTestDoc.entry.type = "png";
publishTestDoc.entry.pngSrc = "";
const withEmptyEntryWarnings = SeozPublish.validateForPublish(publishTestDoc);
assert(withEmptyEntryWarnings.some(w => w.indexOf("Giriş sahnesi") !== -1), "Giriş türü seçilip görsel yüklenmemişse uyarı üretiliyor");
publishTestDoc.entry.pngSrc = "idb:x";
const withFilledEntryWarnings = SeozPublish.validateForPublish(publishTestDoc);
assert(!withFilledEntryWarnings.some(w => w.indexOf("Giriş sahnesi") !== -1), "Giriş görseli doldurulunca ilgili uyarı kayboluyor");

// 26) FAZ 10 — genişletilmiş font kütüphanesi
// GÜÇLENDİRME: kütüphane büyüdü — eski 25 fontun HEPSİ hâlâ mevcut olmalı.
const ORIGINAL_25 = ["Alex Brush","Petit Formal Script","Dancing Script","Great Vibes","Parisienne","Cormorant Garamond","Playfair Display","Libre Baskerville","EB Garamond","Marcellus","Manrope","Poppins","Work Sans","Outfit","Jost","Pacifico","Baloo 2","Fredoka","Bungee","Caveat","Inter","Source Sans 3","Roboto","IBM Plex Sans","Lato"];
ORIGINAL_25.forEach(f => assert(SeozFonts.allFonts().includes(f), `eski font korunuyor: ${f}`));
["script", "serif", "modern", "party", "corporate"].forEach(id => assert(SeozFonts.FONT_CATEGORIES.some(c => c.id === id), `eski kategori korunuyor: ${id}`));
assert(SeozFonts.allFonts().length === 63, "Toplamda 63 font kayıtlı (25 eski + 38 yeni)");
assert(new Set(SeozFonts.allFonts()).size === SeozFonts.allFonts().length, "fontların hepsi birbirinden FARKLI (kazara tekrar eden font yok)");
// canvas.css her fontu yüklüyor mu?
const canvasCss = require("fs").readFileSync(__dirname + "/../css/canvas.css", "utf8");
SeozFonts.allFonts().forEach(f => assert(canvasCss.includes("family=" + f.replace(/ /g, "+")), `canvas.css fontu yüklüyor: ${f}`));
// Son kullanılan fontlar
SeozFonts.markFontUsed("Cinzel"); SeozFonts.markFontUsed("Allura"); SeozFonts.markFontUsed("Cinzel");
assert(JSON.stringify(SeozFonts.getRecentFonts().slice(0, 2)) === JSON.stringify(["Cinzel", "Allura"]), "Son kullanılan fontlar en yeni üstte, tekrar etmeden");
const opts = SeozFonts.optionsHTML("Cinzel");
assert(opts.indexOf("Son Kullanılanlar") !== -1 && (opts.match(/selected/g) || []).length === 1, "Font seçicide 'Son Kullanılanlar' var ve tek bir seçili öğe var");
assert(SeozFonts.optionsHTML("Fredoka").indexOf("⚠") !== -1, "Türkçe harfi eksik eski font uyarıyla gösteriliyor");

// 27) ACİL DÜZELTME — gerçek yayın paketi: idb: referanslarını genel
// (modül bilmeden) tarama ile bulma ve değiştirme mantığı
const sampleTree = {
  canvas: { background: { type: "image", value: "idb:bg1" } },
  entry: { type: "png", pngSrc: "idb:env1", videoSrc: "", cardSrc: "idb:card1" },
  layers: [
    { type: "image", content: { src: "idb:img1" } },
    { type: "text", content: { text: "Değişmemeli" } },
    { type: "module", moduleId: "music", settings: { audioSrc: "idb:music1", bgColor: "#000000" } },
    { type: "module", moduleId: "gallery", settings: { images: [{ ref: "idb:gal1" }, { ref: "idb:gal2" }] } },
    { type: "module", moduleId: "location", settings: { mapsUrl: "https://maps.google.com/x" } }
  ]
};

const foundRefs = new Set();
SeozExportPackage.collectIdbRefs(sampleTree, foundRefs);
assert(foundRefs.size === 7, "Belgenin HER köşesindeki (zemin, zarf, iç kart, görsel katman, müzik, galeri — 2 fotoğraf = 7 ayrı referans) idb: referansı, modül bilmeden tek bir genel taramayla bulunuyor");
assert(foundRefs.has("idb:bg1") && foundRefs.has("idb:env1") && foundRefs.has("idb:card1") && foundRefs.has("idb:img1") && foundRefs.has("idb:music1") && foundRefs.has("idb:gal1") && foundRefs.has("idb:gal2"), "Bulunan referansların TAMAMI (zemin/zarf/kart/görsel/müzik/galeri×2) doğru");
assert(!foundRefs.has("https://maps.google.com/x"), "idb: ile başlamayan normal bir bağlantı (ör. Konum'un Maps URL'si) yanlışlıkla referans sayılmıyor");

const refMap = new Map();
let n = 1;
foundRefs.forEach(ref => { refMap.set(ref, "assets/asset-" + (n++) + ".png"); });
const replaced = SeozExportPackage.replaceIdbRefs(sampleTree, refMap);

let remainingIdbCount = 0;
(function scan(node) {
  if (typeof node === "string") { if (node.indexOf("idb:") === 0) remainingIdbCount++; return; }
  if (Array.isArray(node)) { node.forEach(scan); return; }
  if (node && typeof node === "object") Object.keys(node).forEach(k => scan(node[k]));
})(replaced);
assert(remainingIdbCount === 0, "Değiştirme sonrası belgede TEK BİR 'idb:' referansı bile kalmıyor");
assert(replaced.canvas.background.value.indexOf("assets/") === 0, "Zemin referansı gerçek bir dosya yoluna çevrildi");
assert(replaced.entry.pngSrc.indexOf("assets/") === 0 && replaced.entry.cardSrc.indexOf("assets/") === 0, "Zarf ve iç kart referansları gerçek dosya yollarına çevrildi");
assert(replaced.layers[2].settings.audioSrc.indexOf("assets/") === 0, "Müzik referansı gerçek dosya yoluna çevrildi");
assert(replaced.layers[3].settings.images[0].ref.indexOf("assets/") === 0 && replaced.layers[3].settings.images[1].ref.indexOf("assets/") === 0, "Galerideki HER İKİ fotoğrafın referansı da gerçek dosya yoluna çevrildi");
assert(replaced.layers[4].settings.mapsUrl === "https://maps.google.com/x", "idb: olmayan alanlar (Konum bağlantısı gibi) DEĞİŞMEDEN kalıyor");
assert(replaced.layers[1].content.text === "Değişmemeli", "Metin içeriği gibi ilgisiz alanlar dokunulmadan kalıyor");

// Orijinal ağaç DEĞİŞTİRİLMEMİŞ olmalı (fonksiyon yeni bir kopya döner)
assert(sampleTree.canvas.background.value === "idb:bg1", "Orijinal belge (kopyalanmadan önceki) değiştirilmiyor — güvenli, yan etkisiz dönüşüm");

// 28) EK ÖZELLİK — Metin: Altın/Gümüş metalik efekt
const newTextLayer = SeozDocModel.createTextLayer({ z: 1 });
assert(newTextLayer.content.metallic === "none", "Yeni metin katmanı varsayılan olarak metalik efektsiz (none) başlıyor");
assert(typeof SeozRenderer.METALLIC_GRADIENTS === "object", "renderer.js metalik gradyanları dışa aktarıyor");
assert(typeof SeozRenderer.METALLIC_GRADIENTS.gold === "string" && SeozRenderer.METALLIC_GRADIENTS.gold.indexOf("gradient") !== -1, "Altın için gerçek bir CSS gradyanı tanımlı (düz renk değil)");
assert(typeof SeozRenderer.METALLIC_GRADIENTS.silver === "string" && SeozRenderer.METALLIC_GRADIENTS.silver.indexOf("gradient") !== -1, "Gümüş için gerçek bir CSS gradyanı tanımlı (düz renk değil)");
assert(SeozRenderer.METALLIC_GRADIENTS.gold !== SeozRenderer.METALLIC_GRADIENTS.silver, "Altın ve Gümüş birbirinden farklı gradyanlar");

newTextLayer.content.metallic = "gold";
assert(newTextLayer.content.metallic === "gold", "Metin katmanına metalik efekt atanabiliyor");
doc.layers.push(newTextLayer);
SeozStorage.saveDraft(doc);
const reloadedMetallic = SeozStorage.loadDraft(doc.id);
assert(reloadedMetallic.layers.some(l => l.content && l.content.metallic === "gold"), "Metalik efekt ayarı kayıt/yükleme sonrası korunuyor");

// 29) EK ÖZELLİK — Butonlar: Konum, Müzik, RSVP, Anı Yükle, Kutlama Efekti
["location", "music", "rsvp", "guest-upload"].forEach(id => {
  const def = SeozModuleRegistry.getModule(id);
  assert(def.defaultSettings.metallic === "none", `${id} modülünün varsayılan metalik ayarı 'none'`);
  assert(def.settingsSchema.some(f => f.key === "metallic" && f.type === "select"), `${id} modülünün şemasında metalik seçim alanı var`);
});
const celebDef = SeozModuleRegistry.getModule("celebration");
assert(celebDef.defaultSettings.metallic === "none", "Kutlama Efekti modülünün varsayılan metalik ayarı 'none'");
assert(celebDef.settingsSchema.find(f => f.key === "metallic").showIf({ triggerMode: "button" }) === true, "Kutlama Efekti: buton modunda metalik alanı görünür");
assert(celebDef.settingsSchema.find(f => f.key === "metallic").showIf({ triggerMode: "auto" }) === false, "Kutlama Efekti: otomatik modda metalik alanı GİZLİ (görünür bir buton yok)");

// Galeri ve Geri Sayım'da buton olmadığı için metalik alanı da YOK
assert(!SeozModuleRegistry.getModule("gallery").settingsSchema.some(f => f.key === "metallic"), "Galeri'de metalik alan YOK (buton içermiyor, kapsam dışı)");
assert(SeozModuleRegistry.getModule("countdown").settingsSchema.some(f => f.key === "metallic"), "Geri Sayım: başlık/rakam için metalik YAZI seçeneği var (güçlendirme)");
assert(SeozModuleRegistry.getModule("countdown").defaultSettings.metallic === "none", "Geri Sayım: metalik varsayılan KAPALI (eski görünüm değişmez)");


// ANKET — yanıt yöntemi (geriye dönük uyum) ve otomatik yükseklik
const pollDef = SeozModuleRegistry.getModule("poll");
assert(pollDef.autoHeight === true, "Anket otomatik yükseklikli");
assert(pollDef.getResponseMethod({ pollFormUrl: "https://docs.google.com/forms/x" }) === "google-form", "Anket: eski kayıt + form bağlantısı → google-form (eski davranış)");
assert(pollDef.getResponseMethod({ pollFormUrl: "" }) === "none", "Anket: eski kayıt + boş bağlantı → none (eski davranış)");
assert(pollDef.getResponseMethod({ responseMethod: "whatsapp", pollFormUrl: "https://x" }) === "whatsapp", "Anket: açık seçim türetmeden önce gelir");
assert(pollDef.validate({ questions: [{}], responseMethod: "whatsapp", pollWhatsappNumber: "" }) !== null, "Anket: WhatsApp numarası boşken uyarı");
assert(pollDef.validate({ questions: [{}], responseMethod: "whatsapp", pollWhatsappNumber: "905551112233" }) === null, "Anket: WhatsApp numarası doluyken uyarı YOK");
assert(pollDef.validate({ questions: [{}], pollFormUrl: "https://x", pollFormFieldId: "entry.1" }) === null, "Anket: mevcut Google Form kurulumu uyarı üretmiyor");
assert(pollDef.defaultSettings.pollWhatsappNumber === "" && SeozModuleRegistry.getModule("rsvp").defaultSettings.pollWhatsappNumber === undefined, "Anket WhatsApp numarası RSVP ile paylaşılmıyor");

// GÖRÜŞ BİLDİR — bağımsız modül
const fbDef = SeozModuleRegistry.getModule("feedback");
assert(fbDef && fbDef.label === "Görüş Bildir" && fbDef.autoHeight === true, "Görüş Bildir kayıtlı ve otomatik yükseklikli");
assert(!require("fs").readFileSync(__dirname + "/../js/modules/feedback.js", "utf8").includes("SeozPoll") , "Görüş Bildir poll koduna bağımlı değil");
assert(Object.keys(fbDef.defaultSettings).every(k => !k.startsWith("poll")), "Görüş Bildir anket alanlarını kullanmıyor");
assert(fbDef.validate({ sendMethod: "none" }) !== null, "Görüş Bildir: yöntem yokken uyarı");
assert(fbDef.validate({ sendMethod: "whatsapp", fbWhatsappNumber: "+90 555 111 22 33" }) === null, "Görüş Bildir: WhatsApp numarası doluyken uyarı YOK");
assert(fbDef.validate({ sendMethod: "google-form", fbFormUrl: "https://x" }) !== null, "Görüş Bildir: alan kimliği eksikken uyarı");
assert(fbDef.validate({ sendMethod: "external-link", fbExternalUrl: "https://forms.office.com/x" }) === null, "Görüş Bildir: harici bağlantı doluyken uyarı YOK");
assert(SeozModuleRegistry.getModule("location").autoHeight === undefined, "Diğer modüller sabit yükseklikte kalıyor");
const fbLayer = SeozDocModel.createModuleLayer("feedback", fbDef.defaultSettings, { z: 1 });
assert(fbLayer.moduleId === "feedback" && fbLayer.settings.sendMethod === "none", "Görüş Bildir katmanı varsayılanlarla oluşuyor");


// GÜÇLENDİRME — Bakır metalik her buton modülünde ve renderer'da
assert(!!SeozRenderer.METALLIC_GRADIENTS.copper, "Renderer'da Bakır gradyanı var");
["calendar","celebration","feedback","guest-upload","location","music","rsvp","countdown","gift"].forEach(id => {
  const f = SeozModuleRegistry.getModule(id).settingsSchema.find(x => x.key === "metallic");
  assert(f && f.options.some(o => o.value === "copper") && f.options.some(o => o.value === "gold") && f.options.some(o => o.value === "silver"), `${id}: Altın, Gümüş, Bakır seçenekleri var`);
});

// GÜÇLENDİRME — Hediye modülü
const giftDef = SeozModuleRegistry.getModule("gift");
assert(giftDef && giftDef.label === "Hediye" && giftDef.autoHeight === true, "Hediye modülü kayıtlı");
assert(giftDef.defaultSettings.giftMode === "kapali", "Hediye varsayılan olarak KAPALI");
assert(giftDef.validate({ giftMode: "kapali" }) === null, "Kapalı hediye uyarı üretmiyor");
assert(giftDef._iban.isValidIban("TR33 0006 1005 1978 6457 8413 26"), "Geçerli bir TR IBAN doğrulanıyor");
assert(!giftDef._iban.isValidIban("TR33 0006 1005 1978 6457 8413 27"), "Hatalı kontrol haneli IBAN reddediliyor");
assert(giftDef._iban.formatIban("tr330006100519786457841326") === "TR33 0006 1005 1978 6457 8413 26", "IBAN 4'lü gruplarla gösteriliyor");
assert(giftDef._iban.compactIban("TR33 0006 1005 1978 6457 8413 26") === "TR330006100519786457841326", "IBAN boşluksuz kopyalanıyor");
assert(giftDef.validate({ giftMode: "both", giftUrl: "", accountHolder: "Ayşe", iban: "TR330006100519786457841326" }).indexOf("hediye linki") !== -1, "Link modunda boş link uyarısı");
assert(giftDef.validate({ giftMode: "iban", accountHolder: "Ayşe Yılmaz", iban: "TR330006100519786457841326" }) === null, "Dolu IBAN modunda uyarı YOK");
const giftShow = k => giftDef.settingsSchema.find(f => f.key === k).showIf;
assert(giftShow("giftUrl")({ giftMode: "link" }) && !giftShow("giftUrl")({ giftMode: "iban" }), "Link alanı yalnızca link modlarında görünür");
assert(giftShow("iban")({ giftMode: "both" }) && !giftShow("iban")({ giftMode: "link" }), "IBAN alanı yalnızca IBAN modlarında görünür");

// GÜÇLENDİRME — Görüş Bildir yöntemleri
const fbDef2 = SeozModuleRegistry.getModule("feedback");
const methods = fbDef2.settingsSchema.find(f => f.key === "sendMethod").options.map(o => o.value);
["seoz", "external-link", "whatsapp", "google-form", "none"].forEach(m => assert(methods.includes(m), `Görüş Bildir yöntemi var: ${m}`));
assert(fbDef2.defaultSettings.whatsappStyle === "form", "Eski WhatsApp kayıtları mevcut (form) davranışında kalıyor");
assert(fbDef2.settingsSchema.find(f => f.key === "waButtonText").showIf({ sendMethod: "whatsapp", whatsappStyle: "button" }) === true, "WhatsApp buton yazısı düzenlenebilir");
assert(fbDef2.validate({ sendMethod: "whatsapp", fbWhatsappNumber: "https://wa.me/905551112233" }) === null, "wa.me linki de numara olarak kabul ediliyor");
assert(!Object.keys(fbDef2.defaultSettings).some(k => k.startsWith("poll")), "Görüş Bildir hâlâ anketten bağımsız");

// GÜÇLENDİRME — Güvenlik: istemci kodunda gizli anahtar/parola yok
const fs2 = require("fs"), path2 = require("path");
function walk(d) { return fs2.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path2.join(d, e.name)) : [path2.join(d, e.name)]); }
const clientFiles = walk(path2.join(__dirname, "..", "js")).concat([path2.join(__dirname, "..", "index.html"), path2.join(__dirname, "..", "view.html")]);
clientFiles.forEach(f => {
  const src = fs2.readFileSync(f, "utf8");
  assert(!/sb_secret_[A-Za-z0-9]/.test(src), `${path2.basename(f)}: gizli (secret) anahtar yok`);
  assert(!/service_role["']?\s*[:=]\s*["']ey/i.test(src), `${path2.basename(f)}: service_role anahtarı yok`);
  assert(!/(password|parola|sifre|şifre)\s*[:=]\s*["'][^"']{3,}/i.test(src), `${path2.basename(f)}: sabit parola yok`);
});
assert(!/src="js\/editor\//.test(fs2.readFileSync(path2.join(__dirname, "..", "view.html"), "utf8")), "view.html editör kodu yüklemiyor");

console.log("\n✅ TÜM TESTLER GEÇTİ (" + list.length + " belge örneği ile çalışıldı)");
