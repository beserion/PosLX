import { getDb } from './server/lib/db.js';

async function run() {
    const pool = await getDb();
    const result = await pool.request().query("SELECT * FROM Invoices WHERE Description LIKE '%98629%' OR InvoiceNo LIKE '%98629%' OR OldRef LIKE '%98629%'");
    console.log("Invoices:", result.recordset);
    
    const result2 = await pool.request().query("SELECT * FROM AccountLedger WHERE Description LIKE '%98629%'");
    console.log("Ledger:", result2.recordset);
    process.exit(0);
}

run().catch(console.error);
