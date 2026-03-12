import { getDb } from './config/db.js';
import sql from 'mssql';

async function run() {
    try {
        const pool = await getDb();
        const entryDate = new Date('2026-03-02T20:26:01.073Z');
        
        const possibleInvoices = await pool.request()
            .input('accountId', sql.Int, 175)
            .input('date', sql.Date, entryDate)
            .input('amount', sql.Float, 205.32)
            .query(`
                SELECT * FROM Invoices 
                WHERE AccountID = @accountId 
                AND CAST(CreatedAt AS DATE) = @date 
                AND ABS(TotalAmount - @amount) < 1.0
            `);
            
        console.log("Matched Invoices:", possibleInvoices.recordset.length);
        
        // Let's see what @date actually evaluates to
        const debugDate = await pool.request()
            .input('date', sql.Date, entryDate)
            .query(`SELECT @date as PassedDate, CAST('2026-03-02T20:26:01.073Z' AS DATE) as DbCast`);
        console.log("Debug Dates:", debugDate.recordset);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
