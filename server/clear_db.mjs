import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, 'poslx.db');

console.log('--- Database Wipe Started ---');

const db = new Database(dbPath);
db.pragma('foreign_keys = OFF');

const tables = [
    'SaleItems', 'Sales', 'ProductBarcodes', 'PriceChanges',
    'StockBatches', 'InvoiceItems', 'Invoices', 'PurchaseOrderItems',
    'PurchaseOrders', 'CourierSettlements', 'CourierDailyStats',
    'AccountLedger', 'AccountTransactions', 'Products', 'Categories',
    'Accounts', 'Couriers', 'CashMovements', 'CashRegisters', 'Staff', 'CancellationLogs'
];

db.transaction(() => {
    for (const table of tables) {
        try {
            const result = db.prepare(`DELETE FROM ${table}`).run();
            db.prepare(`DELETE FROM sqlite_sequence WHERE name = ?`).run(table);
            console.log(`Cleared table: ${table} (${result.changes} rows)`);
        } catch (e) {
            console.log(`Note: Could not clear ${table}: ${e.message}`);
        }
    }
})();

db.pragma('foreign_keys = ON');
console.log('--- Database Wipe Completed ---');
db.close();
