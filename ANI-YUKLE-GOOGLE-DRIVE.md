# Anı Yükle — Google Drive kurulumu (müşterinin kendi Drive'ı)

Anı Yükle modülünde **"Fotoğraflar nereye yüklensin?"** ayarı iki seçenek sunar:

| Yöntem | Ne zaman? | Kurulum |
|---|---|---|
| **Studio SEOZ depolaması** (yeni eklenenlerde varsayılan) | Müşteri fotoğrafları Studio SEOZ'un verdiği **gizli albüm linkinden** görüp indirsin | Bir kez: `supabase/ani-yukleme.sql`. Albüm linki "Yayına Hazırla"dan sonra paylaşım penceresinde çıkar. |
| **Müşterinin Google Drive'ı** | Fotoğraflar doğrudan müşterinin Drive klasörüne düşsün | Aşağıdaki 10 dakikalık kurulum (müşterinin Google hesabıyla) |

## Neden daha önce çalışmıyordu?

Yayındaki davetiyelerin hiçbirinde gerçek bir yükleme adresi yoktu ("İŞ", "wsd" gibi yazılar girilmişti)
ve Google tarafında yükleme betiği kurulmamıştı. Tarayıcı fotoğrafı davetiye sitesinin kendisine
göndermeye çalışıp hata veriyordu. Artık editör adresi doğrular, "Yayına Hazırla" geçersiz adres için
uyarır, misafir de galeri açılmadan anlaşılır bir mesaj görür.

## Kurulum (Google Drive)

1. Müşterinin Google hesabıyla **drive.google.com** → yeni klasör (ör. "Ada'nın Kınası — Anılar").
   Klasörü açın; adres çubuğundaki `folders/` sonrasındaki kısım **klasör kimliğidir** (ör. `1AbCdEf...`).
2. **script.new** adresine gidin (yeni Apps Script projesi açılır). Adını "Anı Yükle" yapın.
3. `Code.gs` içindekileri silip aşağıdaki kodu yapıştırın. `KLASOR_KIMLIGI` yerine 1. adımdaki kimliği yazın. Kaydedin.
4. **Dağıt → Yeni dağıtım** → tür: **Web uygulaması**
   - Şu kullanıcı olarak yürüt: **Ben**
   - Erişimi olan: **Herkes** ← (bu seçilmezse misafirler yükleyemez)
5. **Dağıt** → Google izin ister: **Erişimi yetkilendir** → hesabı seçin → "Google bu uygulamayı doğrulamadı" çıkarsa
   **Gelişmiş → Anı Yükle'ye git (güvenli değil)** → **İzin ver**. (Betik sizin hesabınızda, yalnızca bu klasöre dosya ekler.)
6. Çıkan **Web uygulaması URL'sini** (…`/exec` ile biter) kopyalayın.
7. Editörde Anı Yükle katmanı → "Fotoğraflar nereye yüklensin?" = **Müşterinin Google Drive'ı** → adresi yapıştırın.
8. **"Google Drive bağlantısını test et"** düğmesine basın: "Bağlantı çalışıyor ✓ Klasör: …" görmelisiniz.
9. "Yayına Hazırla". Telefondan davetiyeyi açıp bir fotoğraf yükleyin; Drive klasöründe görünmelidir.

> Betikte değişiklik yaparsanız: **Dağıt → Dağıtımları yönet → kalem → Sürüm: Yeni sürüm → Dağıt**.
> Böylece adres değişmez. "Yeni dağıtım" derseniz adres değişir ve editördeki adresi güncellemeniz gerekir.

## Betik (Code.gs)

```javascript
// Studio SEOZ — Anı Yükle (Google Drive). Yalnızca aşağıdaki klasöre dosya EKLER; okumaz, silmez.
const KLASOR_KIMLIGI = "BURAYA_KLASOR_KIMLIGI";
const EN_COK_MB = 30;

// Editördeki "bağlantıyı test et" düğmesi bunu çağırır.
function doGet(e) {
  const klasor = DriveApp.getFolderById(KLASOR_KIMLIGI);
  return json({ ok: true, folder: klasor.getName() });
}

// Misafirin telefonundan gelen fotoğraf/video: { data: base64, type, name }
function doPost(e) {
  try {
    const govde = JSON.parse(e.postData.contents);
    const tur = String(govde.type || "");
    if (!/^(image|video)\//.test(tur)) return json({ success: false, error: "type" });
    const bayt = Utilities.base64Decode(String(govde.data || ""));
    if (bayt.length > EN_COK_MB * 1024 * 1024) return json({ success: false, error: "too_large" });
    const ad = new Date().toISOString().replace(/[:.]/g, "-") + "_" + String(govde.name || "ani").replace(/[^\w.\-]+/g, "_").slice(0, 80);
    const dosya = DriveApp.getFolderById(KLASOR_KIMLIGI).createFile(Utilities.newBlob(bayt, tur, ad));
    return json({ success: true, id: dosya.getId() });
  } catch (hata) {
    return json({ success: false, error: String(hata) });
  }
}

function json(nesne) {
  return ContentService.createTextOutput(JSON.stringify(nesne)).setMimeType(ContentService.MimeType.JSON);
}
```

## Sınırlar

- Fotoğraflar yüklemeden önce telefonda küçültülür (en uzun kenar 2560 px, JPEG). Videolar olduğu gibi gider.
- Google Drive yönteminde dosya başına en çok 30 MB, Studio SEOZ depolamasında 25 MB.
- Google'ın günlük Apps Script kotaları geçerlidir (normal bir düğün/kına için yeterlidir).
