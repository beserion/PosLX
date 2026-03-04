import Database from 'better-sqlite3';
const db = new Database('./data/poslx.db');
db.pragma('foreign_keys = ON');
try {
    console.log("FK Hatasını Tetikliyoruz...");
    console.log("Mevcut Couriers count:", db.prepare('SELECT COUNT(*) as c FROM Couriers').get().c);
    // Id 1 olan kuryeyi silmeye çalışıp hatayı catch'e düşürelim
    db.prepare('DELETE FROM Couriers WHERE ID = 1').run();
    console.log("Silme BASARILI (Hata YOK)");
} catch (e) {
    console.log("HATA GELDİ:", e.message);
    // Hangi tablo engelliyor? 
    // better-sqlite3 detailed error message for FK?
}
