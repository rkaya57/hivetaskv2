TASK HIVE - FIREBASE READY

Bu proje HTML + CSS + JavaScript + Firebase ile hazırlandı.

SENİN DEĞİŞTİRECEĞİN YERLER:

1) firebase.js dosyasında firebaseConfig alanı
2) Firebase Console tarafında Authentication ve Firestore açılması
3) Firestore Security Rules

KULLANIM:
- auth.html: kayıt / giriş
- admin.html: görev ekleme
- tasks.html: görevleri listeleme ve kanıt gönderme
- dashboard.html: kullanıcı bilgileri
- leaderboard.html: puana göre sıralama

NOT:
Bu sürüm Wallet Connect içermez. Sadece email/password auth hazırdır.


V3 GÜNCELLEME:
- Admin paneline Onayla / Reddet butonları eklendi.
- Onaylanan submission için:
  - submissions.status = approved
  - users.points alanına görev ödülü eklenir
- Reddedilen submission için:
  - submissions.status = rejected

NOT:
Firestore rules içinde users koleksiyonuna yazma izni olmalı.


V8 GÜNCELLEME:
- Firebase Storage entegrasyonu eklendi.
- Kullanıcı artık ekran görüntüsü linki yerine dosya yükler.
- Dosya şu klasöre gider:
  screenshots/{userId}/
- tasks.js dosyası screenshot linkini otomatik üretir.

EK GEREKEN:
- Firebase Console > Storage > Get started
- Rules başlangıç için:
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /screenshots/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}


V9 GÜNCELLEME - ÇEKİM TALEPLERİ:
- Yeni sayfa: withdrawals.html
- Yeni script: withdrawals.js
- Yeni koleksiyon: withdrawals

WITHDRAWALS ALANLARI:
- userId
- userEmail
- walletAddress
- tokenAmount
- pointAmount
- note
- status (pending / paid / rejected)
- txHash
- txExplorerUrl
- rejectReason
- createdAt

AKIŞ:
1. Kullanıcı çekim talebi gönderir.
2. Admin paneline düşer.
3. Admin manuel transfer yapar.
4. TX hash girer.
5. Sistem talebi paid yapar ve kullanıcı puanını düşer.
6. Kullanıcı ödeme geçmişinde TX hash ile kontrol eder.

NOT:
- Puan -> token oranı withdrawals.js içinde POINTS_PER_TOKEN sabitinden değişir.
- Şu an 100 puan = 1 THIVE olarak ayarlandı.
