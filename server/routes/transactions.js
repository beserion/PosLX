import { Router } from 'express';
import { getDb } from '../config/db.js';
import sql from 'mssql';

const router = Router();

// ── GET /api/transactions — list transactions with date range ──
router.get('/', async (req, res) => {
    try {
        const pool = await getDb();
        if (!pool) {
            if (process.env.USE_MOCK_DATA === 'true') {
                return res.json(getMockTransactions());
            }
            return res.status(503).json({ error: 'Database not available' });
        }

        const { startDate, endDate } = req.query;

        let result;
        if (startDate && endDate) {
            result = await pool.request()
                .input('startDate', sql.NVarChar, startDate)
                .input('endDate', sql.NVarChar, endDate)
                .query(`
                SELECT * FROM AccountTransactions
                WHERE CAST(CreatedAt AS DATE) BETWEEN CAST(@startDate AS DATE) AND CAST(@endDate AS DATE)
                ORDER BY CreatedAt DESC
            `);
        } else {
            // Default: today
            result = await pool.request().query(`
                SELECT * FROM AccountTransactions
                WHERE CAST(CreatedAt AS DATE) = CAST(GETDATE() AS DATE)
                ORDER BY CreatedAt DESC
            `);
        }

        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/transactions/daily-report — summary for a date range ──
router.get('/daily-report', async (req, res) => {
    try {
        const pool = await getDb();
        if (!pool) {
            if (process.env.USE_MOCK_DATA === 'true') {
                return res.json({
                    totalIncome: 1250.00,
                    totalExpense: 320.50,
                    netAmount: 929.50,
                    transactionCount: 18,
                    byPaymentMethod: { Cash: 750, Card: 500 },
                    byType: { Sale: { total: 1250, count: 12 }, Expense: { total: -320.50, count: 6 } }
                });
            }
            return res.status(503).json({ error: 'Database not available' });
        }

        const { startDate, endDate } = req.query;
        const sd = startDate || new Date().toISOString().slice(0, 10);
        const ed = endDate || sd;

        // Aggregates
        const totalsResult = await pool.request()
            .input('sd', sql.NVarChar, sd)
            .input('ed', sql.NVarChar, ed)
            .query(`
            SELECT
                COALESCE(SUM(CASE WHEN Type IN ('Sale','Adjustment') AND Amount > 0 THEN Amount ELSE 0 END), 0) AS totalIncome,
                COALESCE(SUM(CASE WHEN Type IN ('Expense','Refund','Purchase') OR Amount < 0 THEN ABS(Amount) ELSE 0 END), 0) AS totalExpense,
                COALESCE(SUM(Amount), 0) AS netAmount,
                COUNT(*) AS transactionCount
            FROM AccountTransactions
            WHERE CAST(CreatedAt AS DATE) BETWEEN CAST(@sd AS DATE) AND CAST(@ed AS DATE)
        `);

        // Breakdown by payment method
        const byPaymentResult = await pool.request()
            .input('sd', sql.NVarChar, sd)
            .input('ed', sql.NVarChar, ed)
            .query(`
            SELECT PaymentMethod, COALESCE(SUM(Amount), 0) AS total
            FROM AccountTransactions
            WHERE CAST(CreatedAt AS DATE) BETWEEN CAST(@sd AS DATE) AND CAST(@ed AS DATE)
            GROUP BY PaymentMethod
        `);

        const byPaymentMethod = {};
        for (const row of byPaymentResult.recordset) {
            byPaymentMethod[row.PaymentMethod] = row.total;
        }

        // Breakdown by type
        const byTypeResult = await pool.request()
            .input('sd', sql.NVarChar, sd)
            .input('ed', sql.NVarChar, ed)
            .query(`
            SELECT Type, COALESCE(SUM(Amount), 0) AS total, COUNT(*) AS count
            FROM AccountTransactions
            WHERE CAST(CreatedAt AS DATE) BETWEEN CAST(@sd AS DATE) AND CAST(@ed AS DATE)
            GROUP BY Type
        `);

        const byType = {};
        for (const row of byTypeResult.recordset) {
            byType[row.Type] = { total: row.total, count: row.count };
        }

        res.json({ ...totalsResult.recordset[0], byPaymentMethod, byType });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/transactions — create a manual transaction + update ledger ──
router.post('/', async (req, res) => {
    try {
        const { Type, Amount, Description, PaymentMethod, Counterparty } = req.body;

        if (!Type || Amount === undefined) {
            return res.status(400).json({ error: 'Type and Amount are required' });
        }

        const pool = await getDb();
        if (!pool) return res.status(503).json({ error: 'Database not available' });

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        let txId;
        try {
            // Find account by name
            let accountID = null;
            if (Counterparty) {
                const reqAccount = new sql.Request(transaction);
                const accountResult = await reqAccount
                    .input('Counterparty', sql.NVarChar, Counterparty)
                    .query('SELECT * FROM Accounts WHERE Name = @Counterparty');
                if (accountResult.recordset.length > 0) {
                    accountID = accountResult.recordset[0].ID;
                }
            }

            const reqTx = new sql.Request(transaction);
            const accountIdType = accountID ? sql.Int : sql.Int;
            const insertResult = await reqTx
                .input('Type', sql.NVarChar, Type)
                .input('Amount', sql.Float, Amount)
                .input('Description', sql.NVarChar, Description || null)
                .input('Counterparty', sql.NVarChar, Counterparty || null)
                .input('AccountID', accountIdType, accountID)
                .input('PaymentMethod', sql.NVarChar, PaymentMethod || 'Cash')
                .query(`
                    INSERT INTO AccountTransactions (Type, Amount, Description, Counterparty, AccountID, PaymentMethod)
                    OUTPUT INSERTED.ID
                    VALUES (@Type, @Amount, @Description, @Counterparty, @AccountID, @PaymentMethod)
                `);

            txId = insertResult.recordset[0].ID;

            // Cari hareket kaydı
            if (accountID) {
                const isDebt = Amount < 0; // Gider/iade = borçlanma, gelir = alacak
                const ledgerType = isDebt ? 'Borç' : 'Alacak';
                const ledgerAmount = Math.abs(Amount);

                const reqLedger = new sql.Request(transaction);
                await reqLedger
                    .input('AccountID', sql.Int, accountID)
                    .input('ledgerType', sql.NVarChar, ledgerType)
                    .input('ledgerAmount', sql.Float, ledgerAmount)
                    .input('Description', sql.NVarChar, Description || `${Type} işlemi`)
                    .input('txId', sql.Int, txId)
                    .query(`
                        INSERT INTO AccountLedger (AccountID, Type, Amount, Description, RefType, RefID)
                        VALUES (@AccountID, @ledgerType, @ledgerAmount, @Description, 'Manual', @txId)
                    `);

                // Borç = bakiye artar, Alacak = bakiye azalır
                const balanceChange = isDebt ? ledgerAmount : -ledgerAmount;
                const reqAccountUpdate = new sql.Request(transaction);
                await reqAccountUpdate
                    .input('balanceChange', sql.Float, balanceChange)
                    .input('AccountID', sql.Int, accountID)
                    .query('UPDATE Accounts SET Balance = Balance + @balanceChange WHERE ID = @AccountID');
            }

            await transaction.commit();
        } catch (err) {
            await transaction.rollback();
            throw err;
        }

        const createdResult = await pool.request()
            .input('id', sql.Int, txId)
            .query('SELECT * FROM AccountTransactions WHERE ID = @id');

        res.status(201).json(createdResult.recordset[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Mock data ──
function getMockTransactions() {
    const today = new Date().toISOString().slice(0, 10);
    return [
        { ID: 1, Type: 'Sale', Amount: 125.50, Description: 'Satış #101', Counterparty: null, SaleID: 101, PaymentMethod: 'Cash', CreatedAt: `${today} 09:15:00` },
        { ID: 2, Type: 'Purchase', Amount: -850.00, Description: 'Fatura #F-001', Counterparty: 'ABC Tedarik', InvoiceID: 1, PaymentMethod: 'Cash', CreatedAt: `${today} 10:00:00` },
        { ID: 3, Type: 'Sale', Amount: 89.00, Description: 'Satış #102', Counterparty: null, SaleID: 102, PaymentMethod: 'Card', CreatedAt: `${today} 10:30:00` },
        { ID: 4, Type: 'Expense', Amount: -45.00, Description: 'Malzeme alımı', Counterparty: 'Market', PaymentMethod: 'Cash', CreatedAt: `${today} 11:00:00` },
        { ID: 5, Type: 'Sale', Amount: 210.00, Description: 'Satış #103', Counterparty: null, SaleID: 103, PaymentMethod: 'Cash', CreatedAt: `${today} 12:45:00` },
        { ID: 6, Type: 'Purchase', Amount: -420.00, Description: 'İrsaliye #I-002', Counterparty: 'XYZ Dağıtım', InvoiceID: 2, PaymentMethod: 'Cash', CreatedAt: `${today} 14:00:00` },
        { ID: 7, Type: 'Sale', Amount: 67.50, Description: 'Satış #104', Counterparty: null, SaleID: 104, PaymentMethod: 'Card', CreatedAt: `${today} 15:20:00` },
        { ID: 8, Type: 'Sale', Amount: 155.00, Description: 'Satış #105', Counterparty: null, SaleID: 105, PaymentMethod: 'Cash', CreatedAt: `${today} 17:30:00` },
    ];
}

export default router;
