import Database from 'better-sqlite3';

const dbPath = './data/poslx.db';
const db = new Database(dbPath);

console.log("=== Couriers Table PRAGMA ===");
const info = db.pragma('table_info(Couriers)');
console.log(info);

console.log("=== First Courier ===");
const firstCourier = db.prepare('SELECT * FROM Couriers LIMIT 1').get();
console.log(firstCourier);

db.close();
