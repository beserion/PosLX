import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, 'poslx.db');

console.log('--- Database Cleaning & Seeding Started ---');

// 1. Open existing database
const db = new Database(dbPath);
db.pragma('foreign_keys = OFF'); // Temporarily disable to facilitate deletion

const tables = [
    'SaleItems', 'Sales', 'ProductBarcodes', 'PriceChanges',
    'StockBatches', 'InvoiceItems', 'Invoices', 'PurchaseOrderItems',
    'PurchaseOrders', 'CourierSettlements', 'CourierDailyStats',
    'AccountLedger', 'AccountTransactions', 'Products', 'Categories',
    'Accounts', 'CashMovements', 'CashRegisters', 'Staff', 'CancellationLogs'
];

console.log('Cleaning tables...');
db.transaction(() => {
    for (const table of tables) {
        try {
            db.prepare(`DELETE FROM ${table}`).run();
            // Reset autoincrement
            db.prepare(`DELETE FROM sqlite_sequence WHERE name = ?`).run(table);
        } catch (e) {
            console.log(`Note: Table ${table} might not exist yet or error: ${e.message}`);
        }
    }
})();

db.pragma('foreign_keys = ON');

// 2. Insert Rich Seeding Data
console.log('Inserting custom seed data...');

const categories = [
    'Electronics', 'Home & Garden', 'Fashion', 'Health & Beauty', 'Sports',
    'Beverages', 'Bakery', 'Main Course', 'Desserts'
];

const insertCategory = db.prepare('INSERT INTO Categories (Name) VALUES (?)');
categories.forEach(cat => insertCategory.run(cat));

const products = [
    { name: 'Smartphone Pro', category: 'Electronics', cost: 600, sale: 999, stock: 15 },
    { name: 'Wireless Headphones', category: 'Electronics', cost: 40, sale: 89, stock: 30 },
    { name: 'Mechanical Keyboard', category: 'Electronics', cost: 35, sale: 75, stock: 12 },
    { name: 'Coffee Grinder', category: 'Home & Garden', cost: 25, sale: 55, stock: 10 },
    { name: 'Cotton T-Shirt', category: 'Fashion', cost: 8, sale: 25, stock: 100 },
    { name: 'Running Shoes', category: 'Sports', cost: 45, sale: 110, stock: 20 },
    { name: 'Moisturizer Cream', category: 'Health & Beauty', cost: 12, sale: 29, stock: 45 },
    { name: 'Espresso', category: 'Beverages', cost: 5, sale: 15, stock: 200 },
    { name: 'Caramel Macchiato', category: 'Beverages', cost: 8, sale: 22, stock: 150 },
    { name: 'Blueberry Muffin', category: 'Bakery', cost: 4, sale: 12, stock: 40 },
    { name: 'Cheeseburger XL', category: 'Main Course', cost: 15, sale: 35, stock: 25 },
    { name: 'Chocolate Souffle', category: 'Desserts', cost: 10, sale: 28, stock: 15 }
];

const insertProduct = db.prepare('INSERT INTO Products (Name, Category, CostPrice, SalePrice, Stock) VALUES (@name, @category, @cost, @sale, @stock)');
const insertBarcode = db.prepare('INSERT INTO ProductBarcodes (ProductID, Barcode) VALUES (?, ?)');

products.forEach((p, index) => {
    const result = insertProduct.run(p);
    const productId = result.lastInsertRowid;
    insertBarcode.run(productId, `BC-${1000 + index}`);
    insertBarcode.run(productId, `BC-${1000 + index}A`);
});

const couriers = [
    { name: 'Caner Akın', phone: '+90 555 123 4567', status: 'Delivering', lat: 41.0082, lng: 28.9784, distance: 12.5 },
    { name: 'Selin Yılmaz', phone: '+90 555 987 6543', status: 'Idle', lat: 41.0135, lng: 28.9553, distance: 4.2 },
    { name: 'Burak Demir', phone: '+90 532 555 0011', status: 'Delivering', lat: 41.0251, lng: 29.0130, distance: 25.8 },
    { name: 'Zeynep Kaya', phone: '+90 533 444 2233', status: 'Offline', lat: 40.9923, lng: 28.8950, distance: 0 },
    { name: 'Mert Öztürk', phone: '+90 541 333 1122', status: 'Delivering', lat: 41.0390, lng: 28.9860, distance: 19.1 }
];

const insertCourier = db.prepare('INSERT INTO Couriers (Name, Phone, Status) VALUES (@name, @phone, @status)');
couriers.forEach(c => insertCourier.run(c));

// Add some Sample Sales
console.log('Generating historical sales...');
const insertSale = db.prepare('INSERT INTO Sales (TotalAmount, Tax, Discount, PaymentMethod, CourierID, CreatedAt) VALUES (?, ?, ?, ?, ?, ?)');
const insertSaleItem = db.prepare('INSERT INTO SaleItems (SaleID, ProductID, Qty, UnitPrice) VALUES (?, ?, ?, ?)');

const methods = ['Cash', 'Credit Card', 'Mobile'];
const dates = [
    '2026-03-01 10:30:00', '2026-03-01 14:15:00', '2026-03-02 11:00:00',
    '2026-03-02 18:45:00', '2026-03-03 12:20:00', '2026-03-03 20:10:00'
];

for (let i = 0; i < dates.length; i++) {
    const courierId = (i % 3) + 1;
    const method = methods[i % 3];
    const saleResult = insertSale.run(150, 15, 0, method, courierId, dates[i]);
    const saleId = saleResult.lastInsertRowid;

    const prod1Idx = (i % products.length);
    const prod2Idx = ((i + 3) % products.length);

    insertSaleItem.run(saleId, prod1Idx + 1, 1, products[prod1Idx].sale);
    insertSaleItem.run(saleId, prod2Idx + 1, 2, products[prod2Idx].sale);

    const total = products[prod1Idx].sale + (products[prod2Idx].sale * 2);
    db.prepare('UPDATE Sales SET TotalAmount = ? WHERE ID = ?').run(total, saleId);
}

console.log('--- Seeding Completed Successfully ---');
db.close();
