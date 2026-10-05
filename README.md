# Sesli Nota

**Sesli Nota**, Windows'ta görme engelli kullanıcıların klavye ve ekran okuyucu ile kitap, kişisel not ve müzik notası okuyup yazabilmesi için hazırlanmış açık kaynaklı bir masaüstü uygulamasıdır.

> Uygulama fare kullanımı zorunlu olmadan çalışır. Tüm temel kontrollerin erişilebilir adı vardır; durum değişiklikleri ekran okuyucuya duyurulur.

## Neler yapar?

- Yeni not yazma, düzenleme ve **TXT** olarak kaydetme
- **BRF**, **TXT** ve metin katmanı içeren **PDF** dosyalarını açma
- Metni Windows'un yüklü konuşma seslerinden biriyle okuma
- Okuma hızını değiştirme, sesi seçme, tüm metni veya yalnızca seçili kısmı seslendirme
- **MusicXML** ve **MIDI** dosyalarındaki notaları Türkçe solfej adlarıyla seslendirme (do, re, mi; diyez/bemol; oktav; nota değeri)
- **BRF olarak kaydetme** seçeneği
- Yüksek kontrast, görünür klavye odağı, büyütülebilir yazı ve yalnızca klavyeyle tam kullanım

## Dosya desteği ve sınırlar

| Tür | Durum | Açıklama |
|---|---|---|
| TXT | Desteklenir | UTF-8 ve UTF-16 notlar açılır. |
| BRF | Desteklenir | Braille Ready Format içeriği açılır ve düzenlenebilir. Türkçe Braille kısaltmalarının çözümü, dosyanın oluşturulduğu standarda/braille display ayarına bağlıdır. |
| PDF | Desteklenir | Sadece seçilebilir metin katmanı bulunan PDF'ler. Görüntü olarak taranmış sayfalar için OCR henüz yoktur. |
| MusicXML | Desteklenir | Nota adları, alterasyon, oktav, süre ve suslar konuşma metnine çevrilir. |
| MIDI | Desteklenir | Nota başlangıçları do–si ve oktav olarak seslendirilir. |

Uygulama yalnızca kullanıcının oluşturduğu, sahip olduğu veya yasal olarak erişme hakkı bulunduğu belgelerle kullanılmalıdır.

## Klavye kısayolları

| Kısayol | İşlem |
|---|---|
| `Ctrl+O` | Dosya aç |
| `Ctrl+N` | Yeni not |
| `Ctrl+S` | TXT veya BRF olarak kaydet |
| `F5` | Okumayı başlat / durdur |
| `Ctrl+R` | Metin alanındaki seçimi oku |
| `Ctrl+Home` | Metnin başına git |
| `F1` | Klavye yardımını aç |
| `Escape` | Okumayı ya da açık pencereyi kapat |

## Windows için EXE oluşturma

### Ön koşullar

- Windows 10 veya Windows 11
- [Node.js 20 LTS veya üzeri](https://nodejs.org/)

### Kurulumdan EXE üretmeye

PowerShell'i bu klasörde açıp aşağıdaki komutları sırayla çalıştırın:

```powershell
npm install
npm run dist
```

İşlem bittiğinde yükleyici şurada oluşur:

```text
dist\Sesli Nota-1.0.0-Windows-Setup.exe
```

Bu dosya, başka bir Windows bilgisayara kurulabilir. Kullanıcıya Windows Defender tarafından "bilinmeyen yayımlayıcı" uyarısı gösterilebilir; uygulamanın kod imzalama sertifikasıyla imzalanması dağıtım öncesi önerilir.

Kurulum yapmadan taşınabilir sürüm için:

```powershell
npm run dist:portable
```

### Geliştirici olarak çalıştırma

```powershell
npm install
npm start
```

## Kalite kontrolleri

```powershell
npm test
npm run lint
```

## Erişilebilirlik notları

- Uygulama ekran okuyucunun varsayılan tarama ve biçim tuşlarını engellemez.
- Durum duyuruları ARIA canlı bölgesiyle verilir; yalnızca renk ile bilgi iletilmez.
- Odak her zaman görünürdür ve diyalog açıldığında doğru kontrole taşınır.
- Konuşma için Windows'ta etkinleştirilmiş bir ses gerekir. Türkçe ses eklemek için Windows Ayarlar > Erişilebilirlik > Konuşma bölümündeki ses ayarlarını kullanın.

## Gizlilik

Belgeler yalnızca bilgisayarınızda açılır ve kaydedilir. Uygulama belge içeriğini bir sunucuya göndermez.
