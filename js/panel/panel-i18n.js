/* =============================================================================
   STUDIO SEOZ — panel/panel-i18n.js  (MÜŞTERİ PANELİ — TÜRKÇE / İNGİLİZCE)
   -----------------------------------------------------------------------------
   Yalnızca ARAYÜZ metinlerini çevirir. Hiçbir kayıt değiştirilmez:
   - Davetli adları, form soruları ve cevapları, müşterinin verdiği masa ve
     kart isimleri olduğu gibi gösterilir (bunlar müşterinin kendi içeriğidir).
   - Panelin kendisinin ürettiği varsayılan adlar ("Masa 7", "Toplam yanıt")
     veritabanında eskisi gibi Türkçe saklanır; ekranda seçilen dilde
     gösterilir (bkz. autoTableNo / defaultLabel).
   Dil tercihi: kullanıcının bu tarayıcıda TR/EN düğmesiyle seçtiği dil
   (localStorage) → yoksa adresteki #...&lang=en (Studio SEOZ'un yurt dışı
   müşterilerine gönderdiği bağlantı için ilk açılış dili) → Türkçe (varsayılan).
   Kullanıcının kendi seçimi her zaman önceliklidir.
   ========================================================================= */

(function (global) {
  "use strict";

  const STORE_KEY = "seoz_panel_lang";
  const LANGS = ["tr", "en"];
  const pl = (n, one, many) => (Number(n) === 1 ? one : many);

  /* Her anahtar: { tr, en }. Değer metin ({ad} yer tutuculu) ya da v => metin. */
  const D = {
    /* --- genel --- */
    brand: { tr: "STUDIO SEOZ · KATILIMCI PANELİ", en: "STUDIO SEOZ · GUEST PANEL" },
    docTitle: { tr: "Katılımcı Paneli", en: "Guest Panel" },
    langAria: { tr: "Dil", en: "Language" },
    loading: { tr: "Panel yükleniyor...", en: "Loading panel..." },
    untitledEvent: { tr: "Etkinlik", en: "Event" },
    reportDate: { tr: "Rapor tarihi: {d}", en: "Report date: {d}" },
    lastUpdate: { tr: "Son güncelleme: {d}", en: "Last updated: {d}" },
    pillOpen: { tr: "● Yanıtlara açık", en: "● Accepting responses" },
    pillClosed: { tr: "● Yanıtlara kapalı", en: "● Closed to responses" },
    closeForm: { tr: "Formu kapat", en: "Close form" },
    openForm: { tr: "Formu aç", en: "Reopen form" },
    refresh: { tr: "↻ Yenile", en: "↻ Refresh" },
    cancel: { tr: "Vazgeç", en: "Cancel" },
    close: { tr: "Kapat", en: "Close" },
    yes: { tr: "Evet", en: "Yes" },
    no: { tr: "Hayır", en: "No" },
    unnamed: { tr: "İsimsiz", en: "Unnamed" },
    unnamedGuest: { tr: "İsimsiz katılımcı", en: "Unnamed guest" },
    guestsN: { tr: "{n} kişi", en: v => `${v.n} ${pl(v.n, "guest", "guests")}` },
    responsesN: { tr: "{n} yanıt", en: v => `${v.n} ${pl(v.n, "response", "responses")}` },

    /* --- davetiyeyi paylaş --- */
    inviteLink: { tr: "Davetiye bağlantısı", en: "Invitation link" },
    shareTouch: { tr: "Davetiyeyi paylaş", en: "Share invitation" },
    shareDesk: { tr: "Paylaş — bağlantıyı kopyala", en: "Share — copy link" },
    linkCopied: { tr: "Bağlantı kopyalandı — mesaja yapıştırıp gönderin.", en: "Link copied — paste it into a message to send." },
    copyPrompt: { tr: "Bağlantıyı kopyalayın:", en: "Copy the link:" },

    /* --- özet kartları --- */
    dupAlert: {
      tr: "⚠ {n} isim birden fazla kez yanıt vermiş görünüyor. Tabloda <b>Olası tekrar</b> etiketiyle işaretlendi; gerekirse ayrıntıdan silebilirsiniz.",
      en: v => `⚠ ${v.n} ${pl(v.n, "name appears", "names appear")} to have responded more than once. ${pl(v.n, "It's", "They're")} marked <b>Possible duplicate</b> in the table; you can delete extras from the details view if needed.`
    },
    lbl_total: { tr: "Toplam yanıt", en: "Total responses" },
    lbl_yes: { tr: "Katılacak", en: "Attending" },
    lbl_no: { tr: "Katılmayacak", en: "Not attending" },
    lbl_people: { tr: "Toplam gelecek kişi", en: "Total guests attending" },
    cardNameAria: { tr: "Kart ismi", en: "Card name" },
    labelsSave: { tr: "İsimleri kaydet", en: "Save names" },
    labelsEdit: { tr: "Kart isimlerini düzenle", en: "Edit card names" },
    labelsSaved: { tr: "Kart isimleri kaydedildi.", en: "Card names saved." },

    /* --- sekmeler / araç çubuğu --- */
    tabResponses: { tr: "Yanıtlar", en: "Responses" },
    tabPeople: { tr: "Kişi Listesi", en: "Guest List" },
    tabCharts: { tr: "Grafikler", en: "Charts" },
    tabSeating: { tr: "Yerleşim", en: "Seating" },
    /* --- Etkileşimler (Dilek Ağacı) --- */
    tabInteractions: { tr: "Etkileşimler", en: "Interactions" },
    wishTitle: { tr: "Dilek Ağacı", en: "Wish Tree" },
    wishVisPublic: { tr: "Herkese Açık — misafirler dilekleri okuyabilir", en: "Public — guests can read the wishes" },
    wishVisLocked: { tr: "Kilitli — dilekleri yalnızca siz okuyabilirsiniz", en: "Locked — only you can read the wishes" },
    wishRetention: { tr: "Dilekleri etkinlikten sonraki 30 gün içinde Excel veya PDF olarak indirin. Bu sürenin sonunda kayıtlar silinecektir.", en: "Please download the wishes as Excel or PDF within 30 days after your event. After this period, the records will be deleted." },
    wishRetentionDate: { tr: "Son indirme tarihi: {d}", en: "Download by: {d}" },
    wishNone: { tr: "Henüz dilek bırakılmadı.", en: "No wishes yet." },
    wishRemoved: { tr: "Dilek Ağacı davetiyeden kaldırıldı; misafirler artık görmüyor. Kayıtlı dilekler siz silene kadar burada: indirebilir veya silebilirsiniz.", en: "The Wish Tree was removed from the invitation; guests no longer see it. Saved wishes stay here until you delete them: you can download or delete them." },
    wishCount: { tr: v => `${v.n} dilek · ${v.h} gizli`, en: v => `${v.n} ${pl(v.n, "wish", "wishes")} · ${v.h} hidden` },
    wishHidden: { tr: "Gizli", en: "Hidden" },
    wishInitialsOk: { tr: "Baş harfler görünür: {i}", en: "Initials shown: {i}" },
    wishHide: { tr: "Gizle", en: "Hide" },
    wishShow: { tr: "Göster", en: "Show" },
    wishDelete: { tr: "Sil", en: "Delete" },
    wishConfirmDelete: { tr: "\"{name}\" adlı misafirin dileği kalıcı olarak silinsin mi?", en: "Permanently delete the wish from \"{name}\"?" },
    wishHiddenToast: { tr: "Dilek gizlendi — misafirler artık görmez.", en: "Wish hidden — guests no longer see it." },
    wishShownToast: { tr: "Dilek yeniden görünür.", en: "Wish is visible again." },
    wishDeletedToast: { tr: "Dilek silindi.", en: "Wish deleted." },
    exWishes: { tr: "⬇ Excel — Dilekler", en: "⬇ Excel — Wishes" },
    printWishes: { tr: "🖨 Dilekleri yazdır / PDF", en: "🖨 Print wishes / PDF" },
    fileWishes: { tr: "dilekler", en: "wishes" },
    csvWish: { tr: "Dilek", en: "Wish" },
    csvDate: { tr: "Tarih", en: "Date" },
    csvInitials: { tr: "Baş harfler gösterilsin", en: "Show initials" },
    csvHidden: { tr: "Gizli", en: "Hidden" },
    excelWishes: { tr: "{n} dilek Excel dosyasına aktarıldı.", en: "{n} wishes exported to Excel." },
    searchPh: { tr: "İsim veya cevap ara...", en: "Search names or answers..." },
    statusAria: { tr: "Durum", en: "Status" },
    all: { tr: "Tümü", en: "All" },
    exSeating: { tr: "⬇ Excel — Masa listesi", en: "⬇ Excel — Seating chart" },
    printSeating: { tr: "🖨 Masa listesini yazdır / PDF", en: "🖨 Print seating chart / PDF" },
    exResponses: { tr: "⬇ Excel — Yanıtlar", en: "⬇ Excel — Responses" },
    exPeople: { tr: "⬇ Excel — Kişi listesi", en: "⬇ Excel — Guest list" },
    print: { tr: "🖨 Yazdır / PDF", en: "🖨 Print / PDF" },

    /* --- filtreler --- */
    removeFilter: { tr: "Filtreyi kaldır", en: "Remove filter" },
    filterByQ: { tr: "+ Soruya göre filtrele", en: "+ Filter by question" },
    filterByQAria: { tr: "Soruya göre filtrele", en: "Filter by question" },
    answerAria: { tr: "Cevap", en: "Answer" },
    chooseAnswer: { tr: "Cevap seçin", en: "Choose an answer" },
    fAnswered: { tr: "Yanıtlayanlar", en: "Answered" },
    fEmpty: { tr: "Boş bırakanlar", en: "Left blank" },
    fLabelAnswered: { tr: "{q}: yanıtlayanlar", en: "{q}: answered" },
    fLabelEmpty: { tr: "{q}: boş bırakanlar", en: "{q}: left blank" },
    untitledQ: { tr: "(başlıksız soru)", en: "(untitled question)" },
    question: { tr: "Soru", en: "Question" },
    removedQ: { tr: "{q} (kaldırılmış soru)", en: "{q} (removed question)" },

    /* --- durumlar --- */
    stRegistered: { tr: "Kayıtlı", en: "Registered" },
    stYes: { tr: "Katılıyor", en: "Attending" },
    stNo: { tr: "Katılmıyor", en: "Not attending" },
    stUnknown: { tr: "Belirtilmedi", en: "No answer" },

    /* --- yanıtlar tablosu --- */
    countLine: { tr: "{n} yanıt · {p} kişi", en: v => `${v.n} ${pl(v.n, "response", "responses")} · ${v.p} ${pl(v.p, "guest", "guests")}` },
    countNarrowed: { tr: " (toplam {t} yanıttan süzüldü)", en: " (filtered from {t} total)" },
    noResponses: { tr: "Henüz yanıt yok. Davetli linkini paylaştığınızda yanıtlar burada görünecek.", en: "No responses yet. Once you share the invitation link, responses will appear here." },
    noMatch: { tr: "Bu arama/filtreyle eşleşen yanıt yok.", en: "No responses match this search or filter." },
    badgeUpdated: { tr: "Güncellendi", en: "Updated" },
    badgeDup: { tr: "Olası tekrar", en: "Possible duplicate" },
    thName: { tr: "Ad Soyad", en: "Name" },
    thStatus: { tr: "Durum", en: "Status" },
    thGuests: { tr: "Kişi", en: "Guests" },
    thCompanions: { tr: "Diğer katılımcılar", en: "Additional guests" },
    thResponded: { tr: "Yanıt", en: "Responded" },
    chartsFail: { tr: "Grafikler yüklenemedi.", en: "Charts couldn't be loaded." },
    seatingNarrowed: { tr: "Arama ve filtreler yalnızca Yerleştirilmemiş listesini süzer; masalar her zaman tam görünür.", en: "Search and filters only narrow the Unassigned list; tables always show in full." },
    seatingFail: { tr: "Yerleşim yüklenemedi.", en: "Seating couldn't be loaded." },
    noPeople: { tr: "Bu süzgeçte gelecek kişi yok.", en: "No attending guests match this filter." },
    respondent: { tr: "(yanıtlayan)", en: "(respondent)" },

    /* --- yanıt ayrıntısı --- */
    detailAria: { tr: "Yanıt ayrıntısı", en: "Response details" },
    firstResponse: { tr: "İlk yanıt", en: "First response" },
    updatedTimes: { tr: "({n} kez güncellendi)", en: v => `(updated ${v.n} ${pl(v.n, "time", "times")})` },
    consent: { tr: "Onay", en: "Consent" },
    consentChecked: { tr: "Onay metni işaretlendi", en: "Consent box checked" },
    deleteResponse: { tr: "Yanıtı sil", en: "Delete response" },
    confirmDeleteResponse: {
      tr: "\"{name}\" yanıtı kalıcı olarak silinsin mi?\n\nBu işlem geri alınamaz. Genellikle yalnızca mükerrer kayıtlar için kullanılır.",
      en: "Permanently delete the response from \"{name}\"?\n\nThis can't be undone. It's usually only used for duplicate entries."
    },
    responseDeleted: { tr: "Yanıt silindi.", en: "Response deleted." },

    /* --- form aç/kapat --- */
    confirmCloseForm: {
      tr: "Form yanıtlara kapatılsın mı?\n\nDavetliler yeni yanıt gönderemez ve mevcut yanıtlarını değiştiremez. İstediğiniz zaman tekrar açabilirsiniz.",
      en: "Close the form to new responses?\n\nGuests won't be able to submit new responses or change their existing ones. You can reopen it at any time."
    },
    confirmOpenForm: { tr: "Form tekrar yanıtlara açılsın mı?", en: "Reopen the form to responses?" },
    formClosed: { tr: "Form kapatıldı.", en: "Form closed." },
    formOpened: { tr: "Form açıldı.", en: "Form reopened." },

    /* --- Excel --- */
    excelGuests: { tr: "Excel dosyası indirildi ({n} kişi).", en: v => `Excel file downloaded (${v.n} ${pl(v.n, "guest", "guests")}).` },
    excelResponses: { tr: "Excel dosyası indirildi ({n} yanıt).", en: v => `Excel file downloaded (${v.n} ${pl(v.n, "response", "responses")}).` },
    csvPartySize: { tr: "Kişi sayısı", en: "Party size" },
    csvLastUpdate: { tr: "Son güncelleme", en: "Last updated" },
    csvUpdateCount: { tr: "Güncelleme sayısı", en: "Times updated" },
    csvNo: { tr: "Sıra", en: "No." },
    csvParty: { tr: "Grup (yanıtlayan)", en: "Party (respondent)" },
    csvPartyPos: { tr: "Gruptaki sıra", en: "Position in party" },
    csvArea: { tr: "Masa / Alan", en: "Table / Area" },
    csvAreaNo: { tr: "Masa no", en: "Table no." },
    csvCapacity: { tr: "Kapasite", en: "Capacity" },
    csvAtTable: { tr: "Masadaki kişi", en: "Guests at table" },
    csvEmpty: { tr: "(boş)", en: "(empty)" },
    fileResponses: { tr: "yanitlar", en: "responses" },
    filePeople: { tr: "kisi-listesi", en: "guest-list" },
    fileSeating: { tr: "masa-listesi", en: "seating-chart" },
    fileEvent: { tr: "etkinlik", en: "event" },

    /* --- hatalar / ekranlar --- */
    invalidTitle: { tr: "Panel linki geçersiz", en: "Invalid panel link" },
    invalidText: { tr: "Bu panel linki geçersiz ya da yenilenmiş. Lütfen Studio SEOZ ile iletişime geçin.", en: "This panel link is invalid or has been replaced. Please contact Studio SEOZ." },
    networkAlert: { tr: "Bağlantı kurulamadı. İnternetinizi kontrol edip tekrar deneyin.", en: "Couldn't connect. Check your internet connection and try again." },
    actionFailed: { tr: "İşlem yapılamadı: {m}", en: "Something went wrong: {m}" },
    unknownError: { tr: "bilinmeyen hata", en: "unknown error" },
    netTitle: { tr: "Bağlantı kurulamadı", en: "Couldn't connect" },
    netText: { tr: "İnternet bağlantınızı kontrol edip sayfayı yenileyin.", en: "Check your internet connection and refresh the page." },
    failTitle: { tr: "Panel açılamadı", en: "Couldn't open the panel" },
    failText: { tr: "Lütfen daha sonra tekrar deneyin.", en: "Please try again later." },
    missingTitle: { tr: "Panel linki eksik", en: "Panel link missing" },
    missingText: { tr: "Bu sayfa yalnızca size özel panel linkiyle açılır. Lütfen size gönderilen linki kullanın.", en: "This page only opens with your private panel link. Please use the link you were sent." },
    pinTitle: { tr: "Panel PIN ile korunuyor", en: "This panel is PIN-protected" },
    pinWrong: { tr: "PIN hatalı, lütfen tekrar deneyin.", en: "Incorrect PIN. Please try again." },
    pinAsk: { tr: "Devam etmek için size verilen PIN'i girin.", en: "Enter the PIN you were given to continue." },
    pinButton: { tr: "Giriş", en: "Sign in" },

    /* --- grafikler --- */
    unnamedOption: { tr: "(adsız seçenek)", en: "(unnamed option)" },
    partyOfN: { tr: "{n} kişilik", en: "Party of {n}" },
    thAnswer: { tr: "Cevap", en: "Answer" },
    thShare: { tr: "Oran", en: "Share" },
    unitGuests: { tr: "Kişi", en: "Guests" },
    unitResponses: { tr: "Yanıt", en: "Responses" },
    viewAria: { tr: "Görünüm", en: "View" },
    viewChart: { tr: "Grafik", en: "Chart" },
    viewTable: { tr: "Tablo", en: "Table" },
    noAnswersYet: { tr: "Henüz bu soruya cevap yok.", en: "No answers to this question yet." },
    stAvg: { tr: "Ortalama", en: "Average" },
    stMin: { tr: "En az", en: "Min" },
    stMax: { tr: "En çok", en: "Max" },
    stSum: { tr: "Toplam", en: "Total" },
    basedOn: { tr: "{n} yanıt üzerinden", en: v => `Based on ${v.n} ${pl(v.n, "response", "responses")}` },
    countBy: { tr: "Sayım:", en: "Count by:" },
    countTypeAria: { tr: "Sayım türü", en: "Count type" },
    hintPeople: { tr: "Her yanıt, gruptaki kişi sayısı kadar sayılır (grubun cevabı gruptaki herkes için geçerli kabul edilir).", en: "Each response counts once per guest in the party (the party's answer applies to everyone in it)." },
    hintResponses: { tr: "Her yanıt 1 sayılır.", en: "Each response counts once." },
    chartsNarrowed: { tr: "Grafikler arama/filtre sonucundaki {n} yanıta göre çizildi (toplam {t}).", en: v => `Charts reflect the ${v.n} ${pl(v.n, "response", "responses")} matching your search or filters (of ${v.t} total).` },
    noChartData: { tr: "Grafik için henüz yanıt yok.", en: "No responses to chart yet." },
    chAttendance: { tr: "Katılım durumu", en: "Attendance" },
    chPartySize: { tr: "Grup büyüklüğü", en: "Party size" },
    chPartySizeSub: { tr: "Katılan {n} yanıtın kaç kişilik olduğu", en: v => `Party size across ${v.n} attending ${pl(v.n, "response", "responses")}` },
    nAnswered: { tr: "{n} {u} cevapladı", en: v => `${v.n} ${v.u} answered` },
    nBlank: { tr: "{n} {u} boş bıraktı", en: v => `${v.n} ${v.u} left it blank` },
    unitWord: { tr: v => (v.people ? "kişi" : "yanıt"), en: v => (v.people ? pl(v.n, "guest", "guests") : pl(v.n, "response", "responses")) },
    multiNote: { tr: "birden fazla seçilebildiği için oranların toplamı %100'ü geçebilir", en: "multiple choices allowed, so percentages may add up to more than 100%" },
    inactiveQ: { tr: "pasif soru", en: "inactive question" },
    noChoiceQs: {
      tr: "Formda seçenekli soru (Evet/Hayır, Tek seçim, Çoktan seçmeli, Açılır liste, Çoklu seçim) yok. Böyle bir soru eklendiğinde dağılımı burada otomatik görünür.",
      en: "The form has no multiple-choice questions (Yes/No, Single choice, Multiple choice, Dropdown, Checkboxes). When you add one, its breakdown will appear here automatically."
    },

    /* --- yerleşim --- */
    tableN: { tr: "Masa {n}", en: "Table {n}" },
    unnamedArea: { tr: "Adsız alan", en: "Unnamed area" },
    seatLoading: { tr: "Yerleşim yükleniyor...", en: "Loading seating..." },
    seatNotInstalled: { tr: "<b>Yerleşim planı henüz etkin değil.</b><br>Studio SEOZ bu özelliği açtığında masa planınızı buradan hazırlayabileceksiniz.", en: "<b>Seating isn't enabled yet.</b><br>Once Studio SEOZ turns on this feature, you'll be able to plan your tables here." },
    seatLoadFail: { tr: "Yerleşim bilgileri yüklenemedi.", en: "Seating information couldn't be loaded." },
    retry: { tr: "Tekrar dene", en: "Try again" },
    seatNoGuests: { tr: "Henüz gelecek katılımcı yok. Masaları şimdiden hazırlayabilirsiniz; yanıt geldikçe kişiler burada görünür.", en: "No attending guests yet. You can set up tables now; guests will appear here as responses come in." },
    seatUnplacedAlert: { tr: "⚠ <b>Yerleştirilmemiş: {n} kişi</b>", en: v => `⚠ <b>Unassigned: ${v.n} ${pl(v.n, "guest", "guests")}</b>` },
    seatCapLow: { tr: " · Toplam kapasite ({c}) gelecek kişi sayısından ({t}) az.", en: " · Total capacity ({c}) is less than the number of attending guests ({t})." },
    seatAllPlaced: { tr: "✓ Herkes yerleştirildi.", en: "✓ Everyone has a seat." },
    seatOverAlert: { tr: "{n} masada kapasite aşıldı: {list}", en: v => `Over capacity at ${v.n} ${pl(v.n, "table", "tables")}: ${v.list}` },
    statAreas: { tr: "Masa / alan", en: "Tables / areas" },
    statCapacity: { tr: "Toplam kapasite", en: "Total capacity" },
    statSeated: { tr: "Yerleşen kişi", en: "Seated guests" },
    statUnplaced: { tr: "Yerleştirilmemiş", en: "Unassigned" },
    addArea: { tr: "+ Masa / alan ekle", en: "+ Add table / area" },
    viewPlan: { tr: "Salon planı", en: "Floor plan" },
    viewList: { tr: "Masa listesi", en: "Table list" },
    renumber: { tr: "Numaraları sırala", en: "Renumber tables" },
    planHint: { tr: "Masaları sürükleyerek salondaki yerlerine taşıyın. Bir masaya dokunarak adını, numarasını ve kapasitesini değiştirebilirsiniz.", en: "Drag tables to arrange them on the floor plan. Tap a table to change its name, number, or capacity." },
    unplacedAria: { tr: "Yerleştirilmemiş katılımcılar", en: "Unassigned guests" },
    selOne: { tr: "<b>{name}</b> seçildi", en: "<b>{name}</b> selected" },
    selMany: { tr: "<b>{n} kişi</b> seçildi", en: "<b>{n} guests</b> selected" },
    selHintSwap: { tr: "Bir masaya dokunun ya da yer değiştireceği kişiye dokunun.", en: "Tap a table, or tap another guest to swap seats." },
    selHintPlace: { tr: "Şimdi yerleştirmek istediğiniz masaya dokunun.", en: "Now tap the table where you want to seat them." },
    selWholeParty: { tr: "Tüm grubu seç ({n} kişi)", en: "Select whole party ({n} guests)" },
    removeFromTable: { tr: "Masadan çıkar", en: "Remove from table" },
    chipGroup: { tr: "{g} grubu", en: "{g}'s party" },
    chipInGroup: { tr: "{name} — {g} grubundan", en: "{name} — in {g}'s party" },
    chipPartyOf: { tr: "{name} — {n} kişilik grup", en: "{name} — party of {n}" },
    unseatAria: { tr: "{name} masadan çıkar", en: "Remove {name} from table" },
    sideTitle: { tr: "Yerleştirilmemiş Katılımcılar", en: "Unassigned Guests" },
    sideNoGuests: { tr: "Katılacağını bildiren kişiler burada listelenir.", en: "Guests who RSVP yes will be listed here." },
    sideAllPlaced: { tr: "Herkes bir masaya yerleştirildi. Bir kişiyi masadan çıkarmak için ✕ işaretine dokunun ya da buraya sürükleyin.", en: "Everyone has been seated. To remove a guest from a table, tap ✕ or drag them here." },
    sideHint: { tr: "Kişiye dokunup masaya dokunun ya da sürükleyip bırakın.", en: "Tap a guest, then tap a table — or drag and drop." },
    sideFiltered: { tr: "Arama/filtreye uyan {n} kişi gösteriliyor.", en: v => `Showing ${v.n} ${pl(v.n, "guest", "guests")} matching your search or filters.` },
    selVisible: { tr: "Görünenlerin hepsini seç ({n} kişi)", en: v => `Select all shown (${v.n} ${pl(v.n, "guest", "guests")})` },
    sideNoMatch: { tr: "Bu arama/filtreyle eşleşen yerleştirilmemiş kişi yok.", en: "No unassigned guests match this search or filter." },
    whereOne: { tr: " · {n} kişisi {area}'da", en: " · {n} already at {area}" },
    whereMany: { tr: " · {n} kişisi {area} ve diğer masalarda", en: " · {n} at {area} and other tables" },
    partyOfGroup: { tr: "{n} kişilik grup", en: "Party of {n}" },
    selParty: { tr: "Grubu seç ({n})", en: "Select party ({n})" },
    tcFull: { tr: "{area} kapasitesine ulaştı – {n}/{c}", en: "{area} is full – {n}/{c}" },
    tcOver: { tr: "Kapasite aşıldı – {n}/{c} ({x} kişi fazla)", en: "Over capacity – {n}/{c} ({x} too many)" },
    tcAria: { tr: "{area}, {n}/{c} kişi", en: "{area}, {n}/{c} guests" },
    edit: { tr: "Düzenle", en: "Edit" },
    tcEmpty: { tr: "Boş — kişileri buraya sürükleyin ya da dokunarak yerleştirin.", en: "Empty — drag guests here or tap to seat them." },
    tcFree: { tr: "{n} boş yer", en: v => `${v.n} open ${pl(v.n, "seat", "seats")}` },
    noAreas: { tr: "Henüz masa veya alan yok.<br><b>+ Masa / alan ekle</b> düğmesiyle başlayın; her birine istediğiniz kapasiteyi verebilirsiniz.", en: "No tables or areas yet.<br>Start with <b>+ Add table / area</b> — you can give each one any capacity." },
    nodeEmpty: { tr: "boş", en: "empty" },
    printTitle: { tr: "Masa listesi", en: "Seating chart" },
    printEmpty: { tr: "Boş", en: "Empty" },
    printUnplaced: { tr: "Yerleştirilmemiş ({n} kişi)", en: v => `Unassigned (${v.n} ${pl(v.n, "guest", "guests")})` },
    confirmOverCap: {
      tr: "{area} kapasitesi {c} kişi.\nBu yerleşimle {after}/{c} olacak ({x} kişi fazla).\n\nYine de yerleştirilsin mi?",
      en: "{area} seats {c}.\nThis will make it {after}/{c} ({x} over capacity).\n\nSeat them anyway?"
    },
    placedMany: { tr: "{n} kişi yerleştirildi → {area}", en: "{n} guests seated → {area}" },
    unplacedMany: { tr: "{n} kişi Yerleştirilmemiş listesine alındı.", en: "{n} guests moved to Unassigned." },
    unplacedOne: { tr: "{name} masadan çıkarıldı.", en: "{name} removed from table." },
    sameSpot: { tr: "İkisi zaten aynı yerde.", en: "They're already at the same table." },
    swapped: { tr: "{a} ↔ {b} yer değiştirdi.", en: "{a} ↔ {b} swapped seats." },
    confirmRenumber: {
      tr: "Masa numaraları salon planındaki yerlerine göre (yukarıdan aşağıya, soldan sağa) 1'den başlayarak yeniden verilsin mi?\n\n\"Masa 7\" gibi isimler yeni numarayla güncellenir; özel isimler (ör. VIP, Sahne önü) değişmez.",
      en: "Renumber tables from 1 based on their position on the floor plan (top to bottom, left to right)?\n\nNames like \"Table 7\" will be updated to the new number; custom names (e.g., VIP, Head Table) won't change."
    },
    renumbered: { tr: "Numaralar yeniden sıralandı.", en: "Tables renumbered." },
    maxAreas: { tr: "En fazla {n} masa/alan eklenebilir.", en: "You can add up to {n} tables/areas." },
    dlgAdd: { tr: "Masa / alan ekle", en: "Add table / area" },
    dlgEditAria: { tr: "Masa / alan düzenle", en: "Edit table / area" },
    fName: { tr: "Ad", en: "Name" },
    fNamePh: { tr: "ör. Masa {n}, VIP, Sahne önü", en: "e.g., Table {n}, VIP, Head Table" },
    fNumber: { tr: "Numara", en: "Number" },
    fCapacity: { tr: "Kapasite", en: "Capacity" },
    fShape: { tr: "Şekil", en: "Shape" },
    shapeRound: { tr: "◯ Yuvarlak", en: "◯ Round" },
    shapeRect: { tr: "▭ Dikdörtgen", en: "▭ Rectangle" },
    fQty: { tr: "Adet", en: "Quantity" },
    multiHint: { tr: "Birden fazla eklerseniz numaralar sırayla verilir (ör. Masa {a}, Masa {b}...).", en: "If you add more than one, they're numbered in order (e.g., Table {a}, Table {b}...)." },
    seatedHere: { tr: "Bu masadakiler ({n}/{c})", en: "Seated here ({n}/{c})" },
    noOneYet: { tr: "Henüz kimse yok.", en: "No one yet." },
    del: { tr: "Sil", en: "Delete" },
    add: { tr: "Ekle", en: "Add" },
    save: { tr: "Kaydet", en: "Save" },
    confirmDeleteArea: { tr: "\"{area}\" silinsin mi?", en: "Delete \"{area}\"?" },
    confirmDeleteAreaPeople: { tr: "\n\nBu masadaki {n} kişi Yerleştirilmemiş listesine döner.", en: v => `\n\nThe ${v.n} ${pl(v.n, "guest", "guests")} seated here will move back to Unassigned.` },
    areaDeleted: { tr: "{area} silindi.", en: "{area} deleted." },
    areaDeletedPeople: { tr: " {n} kişi Yerleştirilmemiş listesine döndü.", en: v => ` ${v.n} ${pl(v.n, "guest", "guests")} moved back to Unassigned.` },
    errCapacity: { tr: "Kapasite 1 ile 500 arasında olmalı.", en: "Capacity must be between 1 and 500." },
    errNumber: { tr: "Numara 0 ile 9999 arasında olmalı.", en: "Number must be between 0 and 9999." },
    areasAdded: { tr: "{n} masa/alan eklendi.", en: "{n} tables/areas added." },
    areaAdded: { tr: "{area} eklendi.", en: "{area} added." },
    saved: { tr: "Kaydedildi.", en: "Saved." },
    savedOver: { tr: "Kaydedildi. Dikkat: {area} kapasiteyi aşıyor – {n}/{c}", en: "Saved. Note: {area} is over capacity – {n}/{c}" }
  };

  /* ---------------- dil seçimi ---------------- */
  function fromHash() {
    const m = String(global.location.hash || "").match(/[#&]lang=(tr|en)\b/i);
    return m ? m[1].toLowerCase() : "";
  }
  function stored() {
    try { const v = global.localStorage.getItem(STORE_KEY); return LANGS.includes(v) ? v : ""; } catch (e) { return ""; }
  }
  let lang = stored() || fromHash() || "tr";
  const listeners = [];

  function setLang(l) {
    if (!LANGS.includes(l) || l === lang) return;
    lang = l;
    try { global.localStorage.setItem(STORE_KEY, l); } catch (e) { /* gizli sekme: yalnızca bu oturum */ }
    apply();
    listeners.forEach(fn => { try { fn(l); } catch (e) { console.error(e); } });
  }
  function apply() { document.documentElement.setAttribute("lang", lang); }

  function t(key, vars) {
    const e = D[key];
    if (!e) return key;
    let v = e[lang] != null ? e[lang] : e.tr;
    if (typeof v === "function") return v(vars || {});
    if (vars) v = v.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
    return v;
  }

  const locale = () => (lang === "en" ? "en-US" : "tr-TR");
  function fmtDate(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return "";
    return d.toLocaleDateString(locale(), { day: "numeric", month: "short" }) + " " + d.toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" });
  }
  function fmtNum(n) { return Number(n).toLocaleString(locale(), { maximumFractionDigits: 1 }); }
  function pct(n) { return lang === "en" ? n + "%" : "%" + n; }

  /* Panelin ürettiği masa adları ("Masa 7") veritabanında Türkçe saklanır.
     İki dildeki kalıbı da tanır; numarayı döndürür (yoksa null). */
  function autoTableNo(label) {
    const m = /^\s*(masa|table)\s*(\d+)\s*$/i.exec(String(label || ""));
    return m ? parseInt(m[2], 10) : null;
  }
  const canonicalTable = n => "Masa " + n;              // kayıt biçimi (eskisiyle aynı)
  function displayAreaLabel(label) {
    const n = autoTableNo(label);
    return n == null ? String(label || "") : t("tableN", { n });
  }
  /* Özet kartlarının varsayılan adları: kayıtta Türkçe varsayılan (ya da İngilizce
     karşılığı) duruyorsa seçilen dilde gösterilir; müşterinin yazdığı ad aynen kalır. */
  function isDefaultLabel(key, v) {
    const e = D["lbl_" + key];
    return !!e && (v == null || v === "" || v === e.tr || v === e.en);
  }
  function displayLabel(key, v) { return isDefaultLabel(key, v) ? t("lbl_" + key) : v; }
  function storeLabel(key, v) { return isDefaultLabel(key, v) ? D["lbl_" + key].tr : v; }

  /* Sağ üstteki TR / EN seçici */
  function switchHtml() {
    return `<div class="pn-lang pn-noprint" role="group" aria-label="Dil / Language">${LANGS.map(l =>
      `<button type="button" data-lang="${l}" lang="${l}" aria-pressed="${l === lang}" title="${l === "tr" ? "Türkçe" : "English"}">${l.toUpperCase()}</button>`).join("")}</div>`;
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest("[data-lang]");
    if (b && b.closest(".pn-lang")) setLang(b.getAttribute("data-lang"));
  });
  // Adres değişirse (yeni bağlantı yapıştırıldı): kullanıcı henüz dil seçmediyse bağlantının dili uygulanır.
  global.addEventListener("hashchange", () => {
    const h = fromHash();
    if (!h || stored() || h === lang) return;
    lang = h; apply(); listeners.forEach(fn => { try { fn(h); } catch (e) { console.error(e); } });
  });
  apply();

  global.SeozPanelI18n = {
    t, setLang, lang: () => lang, locale, fmtDate, fmtNum, pct, switchHtml,
    onChange: fn => listeners.push(fn),
    autoTableNo, canonicalTable, displayAreaLabel, displayLabel, storeLabel, isDefaultLabel, dict: D
  };
})(window);
