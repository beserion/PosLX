Mevcut React + Node.js + SQLite tabanlı POS uygulamasına dış ağdan güvenli erişim sağlayacak bir “Tunnel Connectivity Layer” eklemek istiyorum.

Amaç: Statik IP gerektirmeden kurye APK uygulamasının internet üzerinden POS backend’e güvenli şekilde istek gönderebilmesini sağlamak.

POS uygulaması yerel bilgisayarda (localhost) çalışmaktadır ve public IP garanti değildir (CGNAT olabilir).

🎯 Hedef Mimari

POS backend (localhost:3000)
↓
Cloudflare Tunnel (reverse proxy)
↓
Public HTTPS URL
↓
Kurye APK → /api/location endpoint

📦 Gereksinimler
1️⃣ Tunnel Yönetimi

POS uygulaması başlatıldığında:

cloudflared otomatik olarak başlatılmalı

http://localhost:3000
 adresi public HTTPS URL’e expose edilmelidir

Oluşan public URL uygulama içinde saklanmalıdır

Public URL:

SQLite içinde system_settings tablosuna kaydedilmeli

veya memory cache içinde tutulmalı

2️⃣ system_settings Tablosu (SQLite)

CREATE TABLE system_settings (
key TEXT PRIMARY KEY,
value TEXT
);

Buraya:

key: public_tunnel_url
value: https://random-name.trycloudflare.com

şeklinde kayıt atılmalı.

3️⃣ Backend Güncellemesi

POS backend içerisinde mevcut /api/location endpoint korunmalı

CORS ayarları public access için düzenlenmeli

HTTPS üzerinden gelen requestler desteklenmeli

4️⃣ QR Code Üretimi

POS dashboard içinde:

“Kurye Bağlantı QR” adında bir panel ekle

Bu QR code public_tunnel_url değerini encode etsin

Kurye APK bu QR’ı okuyarak base URL belirlesin

5️⃣ Tunnel Health Monitoring

Backend:

Public tunnel URL erişilebilir mi kontrol etmeli

Eğer bağlantı düşerse dashboard’da uyarı gösterilmeli:
“Tunnel bağlantısı kesildi”

6️⃣ Güvenlik

/api/location endpoint için basit token doğrulaması ekle

system_settings içinde courier_api_token saklanmalı

Kurye APK tüm requestlerde header olarak göndermeli:

Authorization: Bearer {token}

⚙️ Teknik Beklentiler

Cloudflared process yönetimi Node.js üzerinden yapılmalı (child_process ile)

Tunnel kapanırsa otomatik restart edilmeli

POS kapanınca tunnel düzgün şekilde terminate edilmeli

🗺️ React Dashboard Güncellemesi

Tunnel durumu için status badge ekle (Connected / Disconnected)

Public URL görüntüleme alanı ekle

QR code bileşeni oluştur

Bu geliştirme mevcut POS performansını etkilememeli ve tamamen modüler şekilde eklenmelidir.