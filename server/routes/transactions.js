import { Router } from 'express';
import { getDb } from '../config/db.js';

const router = Router();

// ── GET /api/transactions — list transactions with date range ──
router.get('/', async (req, res) => {
    try {
        const db = getDb();
        if (!db) {
            if (process.env.USE_MOCK_DATA === 'true') {
                return res.json(getMockTransactions());
            }
            return res.status(503).json({ error: 'Database not available' });
        }

        const { startDate, endDate } = req.query;

        let rows;
        if (startDate && endDate) {
            rows = db.prepare(`
                SELECT * FROM AccountTransactions
                WHERE date(CreatedAt) BETWEEN date(?) AND date(?)
                ORDER BY CreatedAt DESC
            `).all(startDate, endDate);
        } else {
            // Default: today
            rows = db.prepare(`
                SELECT * FROM AccountTransactions
                WHERE date(CreatedAt) = date('now', 'localtime')
                ORDER BY CreatedAt DESC
            `).all();
        }

        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/transactions/daily-report — summary for a date range ──
router.get('/daily-report', async (req, res) => {
    try {
        const db = getDb();
        if (!db) {
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
        const totals = db.prepare(`
            SELECT
                IFNULL(SUM(CASE WHEN Type IN ('Sale','Adjustment') AND Amount > 0 THEN Amount ELSE 0 END), 0) AS totalIncome,
                IFNULL(SUM(CASE WHEN Type IN ('Expense','Refund','Purchase') OR Amount < 0 THEN ABS(Amount) ELSE 0 END), 0) AS totalExpense,
                IFNULL(SUM(Amount), 0) AS netAmount,
                COUNT(*) AS transactionCount
            FROM AccountTransactions
            WHERE date(CreatedAt) BETWEEN date(?) AND date(?)
        `).get(sd, ed);

        // Breakdown by payment method
        const byPayment = db.prepare(`
            SELECT PaymentMethod, IFNULL(SUM(Amount), 0) AS total
            FROM AccountTransactions
            WHERE date(CreatedAt) BETWEEN date(?) AND date(?)
            GROUP BY PaymentMethod
        `).all(sd, ed);

        const byPaymentMethod = {};
        for (const row of byPayment) {
            byPaymentMethod[row.PaymentMethod] = row.total;
        }

        // Breakdown by type
        const byTypeRows = db.prepare(`
            SELECT Type, IFNULL(SUM(Amount), 0) AS total, COUNT(*) AS count
            FROM AccountTransactions
            WHERE date(CreatedAt) BETWEEN date(?) AND date(?)
            GROUP BY Type
        `).all(sd, ed);

        const byType = {};
        for (const row of byTypeRows) {
            byType[row.Type] = { total: row.total, count: row.count };
        }

        res.json({ ...totals, byPaymentMethod, byType });
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

        const db = getDb();
        if (!db) return res.status(503).json({ error: 'Database not available' });

        const createTx = db.transaction(() => {
            // Find account by name
            const account = Counterparty ? db.prepare('SELECT * FROM Accounts WHERE Name = ?').get(Counterparty) : null;
            const accountID = account ? account.ID : null;

            const info = db.prepare(
                `INSERT INTO AccountTransactions (Type, Amount, Description, Counterparty, AccountID, PaymentMethod)
                 VALUES (?, ?, ?, ?, ?, ?)`
            ).run(Type, Amount, Description || null, Counterparty || null, accountID, PaymentMethod || 'Cash');

            // Cari hareket kaydı
            if (accountID) {
                const isDebt = Amount < 0; // Gider/iade = borçlanma, gelir = alacak
                const ledgerType = isDebt ? 'Borç' : 'Alacak';
                const ledgerAmount = Math.abs(Amount);

                db.prepare(
                    `INSERT INTO AccountLedger (AccountID, Type, Amount, Description, RefType, RefID)
                     VALUES (?, ?, ?, ?, 'Manual', ?)`
                ).run(accountID, ledgerType, ledgerAmount, Description || `${Type} işlemi`, info.lastInsertRowid);

                // Borç = bakiye artar, Alacak = bakiye azalır
                const balanceChange = isDebt ? ledgerAmount : -ledgerAmount;
                db.prepare('UPDATE Accounts SET Balance = Balance + ? WHERE ID = ?')
                    .run(balanceChange, accountID);
            }

            return info.lastInsertRowid;
        });

        const txId = createTx();
        const created = db.prepare('SELECT * FROM AccountTransactions WHERE ID = ?').get(txId);
        res.status(201).json(created);
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
