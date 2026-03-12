const { getDb } = require('./config/db.js');
const sql = require('mssql');
require('dotenv').config();

async function test() {
    const pool = await getDb();
    const result = await pool.request().query(`
        SELECT TOP 10 * FROM AccountLedger WHERE Description LIKE '%Fatura%' AND RefID IS NULL
    `);
    console.log(result.recordset);
    process.exit(0);
}
test();
