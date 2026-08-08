# Yemekhane Yönetim Sistemi

Günlük menü, öğrenci sayısı, yemek tüketimi, israf miktarı ve maliyet takibi yapan; en çok ve en az tüketilen yemekleri analiz eden bir yemekhane yönetim paneli.

## Özellikler

- **Ana Sayfa** — özet istatistikler, maliyet ve tüketim trend grafikleri
- **Günlük Menü** — her gün için öğrenci sayısı ve yemek listesi ekleme/düzenleme/silme
- **Öğrenci Sayısı** — günlük katılım trendi ve tablosu
- **Tüketim & İsraf** — yemek bazlı tüketim oranı ve israf (kg) analizi
- **Maliyet Analizi** — günlük/yemek bazlı toplam maliyet ve israf kaynaklı kayıp
- **Analiz Raporları** — en çok / en az tüketilen ve en çok israf edilen yemekler
- Sol üst köşedeki menü (☰) ile bölümler arasında geçiş

## Kurulum ve Çalıştırma

Node.js (LTS) kurulu olmalı: https://nodejs.org

```bash
git clone https://github.com/aysegulbozkrtt/yemekhane-yonetim-sistemi.git
cd yemekhane-yonetim-sistemi
npm install
npm start
```

Sunucu ayağa kalktıktan sonra tarayıcıdan **http://localhost:3000** adresini aç.

## Örnek Veri

Depoda 21 günlük gerçekçi örnek veri (`data/db.json`) hazır gelir. Sıfırdan yeni örnek veri üretmek istersen:

```bash
npm run seed
```

> Not: Bu komut `data/db.json` dosyasının üzerine yazar, mevcut kayıtlar silinir.

## Proje Yapısı

```
server.js        Express sunucusu ve REST API (/api/days, /api/dishes, /api/analysis)
seed.js           Örnek veri üretici
data/db.json      Veri deposu (JSON dosya)
public/           Frontend (index.html, style.css, app.js)
```

## Veri Modeli

Her gün kaydı; tarih, öğrenci sayısı ve o güne ait yemekleri içerir. Her yemek için:

- `plannedPortion` — hazırlanan porsiyon
- `consumedPortion` — tüketilen porsiyon
- `wasteKg` — israf edilen miktar (kg)
- `unitCost` — porsiyon başı maliyet (₺)

Toplam maliyet, israf maliyeti ve tüketim oranları bu alanlardan sunucu tarafında hesaplanır.
