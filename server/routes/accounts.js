import { Router } from 'express';
import { getDb } from '../config/db.js';

const router = Router();

// ── GET /api/accounts — list all accounts (filter by type) ──
router.get('/', async (req, res) => {
    try {
        const db = getDb();
        if (!db) return res.status(503).json({ error: 'Database not available' });

        const { type } = req.query; // Müşteri | Tedarikçi
        let rows;
        if (type) {
            rows = db.prepare('SELECT * FROM Accounts WHERE Type = ? ORDER BY Name').all(type);
        } else {
            rows = db.prepare('SELECT * FROM Accounts ORDER BY Type, Name').all();
        }
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/accounts/:id — single account with balance ──
router.get('/:id', async (req, res) => {
    try {
        const db = getDb();
        if (!db) return res.status(503).json({ error: 'Database not available' });

        const account = db.prepare('SELECT * FROM Accounts WHERE ID = ?').get(req.params.id);
        if (!account) return res.status(404).json({ error: 'Cari bulunamadı' });

        // Recalculate balance from ledger
        const balanceData = db.prepare(`
            SELECT
                IFNULL(SUM(CASE WHEN Type = 'Borç'   THEN Amount ELSE 0 END), 0) AS totalDebt,
                IFNULL(SUM(CASE WHEN Type = 'Alacak' THEN Amount ELSE 0 END), 0) AS totalCredit
            FROM AccountLedger WHERE AccountID = ?
        `).get(req.params.id);

        res.json({
            ...account,
            totalDebt: balanceData.totalDebt,
            totalCredit: balanceData.totalCredit,
            calculatedBalance: balanceData.totalDebt - balanceData.totalCredit
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/accounts/:id/ledger — ledger entries (date range) ──
router.get('/:id/ledger', async (req, res) => {
    try {
        const db = getDb();
        if (!db) return res.status(503).json({ error: 'Database not available' });

        const { startDate, endDate } = req.query;
        let rows;
        if (startDate && endDate) {
            rows = db.prepare(`
                SELECT * FROM AccountLedger
                WHERE AccountID = ? AND date(CreatedAt) BETWEEN date(?) AND date(?)
                ORDER BY CreatedAt DESC
            `).all(req.params.id, startDate, endDate);
        } else {
            rows = db.prepare(`
                SELECT * FROM AccountLedger
                WHERE AccountID = ?
                ORDER BY CreatedAt DESC
                LIMIT 200
            `).all(req.params.id);
        }

        // Running balance calculation
        const allEntries = db.prepare(`
            SELECT * FROM AccountLedger WHERE AccountID = ? ORDER BY CreatedAt ASC, ID ASC
        `).all(req.params.id);

        let runningBalance = 0;
        const balanceMap = {};
        for (const entry of allEntries) {
            runningBalance += entry.Type === 'Borç' ? entry.Amount : -entry.Amount;
            balanceMap[entry.ID] = runningBalance;
        }

        const enriched = rows.map(row => ({
            ...row,
            RunningBalance: balanceMap[row.ID] ?? 0
        }));

        res.json(enriched);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/accounts — create a new account ──
router.post('/', async (req, res) => {
    try {
        const { Name, Type, Phone, Email, Address, TaxOffice, TaxNo } = req.body;
        if (!Name) return res.status(400).json({ error: 'İsim zorunludur' });

        const db = getDb();
        if (!db) return res.status(503).json({ error: 'Database not available' });

        const info = db.prepare(
            'INSERT INTO Accounts (Name, Type, Phone, Email, Address, TaxOffice, TaxNo) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(Name, Type || 'Müşteri', Phone || null, Email || null, Address || null, TaxOffice || null, TaxNo || null);

        const created = db.prepare('SELECT * FROM Accounts WHERE ID = ?').get(info.lastInsertRowid);
        res.status(201).json(created);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── PUT /api/accounts/:id — update an account ──
router.put('/:id', async (req, res) => {
    try {
        const { Name, Type, Phone, Email, Address, TaxOffice, TaxNo } = req.body;
        const db = getDb();
        if (!db) return res.status(503).json({ error: 'Database not available' });

        db.prepare(
            'UPDATE Accounts SET Name = ?, Type = ?, Phone = ?, Email = ?, Address = ?, TaxOffice = ?, TaxNo = ? WHERE ID = ?'
        ).run(Name, Type, Phone || null, Email || null, Address || null, TaxOffice || null, TaxNo || null, req.params.id);

        const updated = db.prepare('SELECT * FROM Accounts WHERE ID = ?').get(req.params.id);
        if (!updated) return res.status(404).json({ error: 'Cari bulunamadı' });
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── DELETE /api/accounts/:id — delete an account (only if balance = 0) ──
router.delete('/:id', async (req, res) => {
    try {
        const db = getDb();
        if (!db) return res.status(503).json({ error: 'Database not available' });

        const account = db.prepare('SELECT * FROM Accounts WHERE ID = ?').get(req.params.id);
        if (!account) return res.status(404).json({ error: 'Cari bulunamadı' });

        // Check for outstanding balance
        const ledgerSum = db.prepare(`
            SELECT
                IFNULL(SUM(CASE WHEN Type = 'Borç' THEN Amount ELSE -Amount END), 0) AS balance
            FROM AccountLedger WHERE AccountID = ?
        `).get(req.params.id);

        if (Math.abs(ledgerSum.balance) > 0.01) {
            return res.status(400).json({ error: 'Bakiyesi olan cari silinemez' });
        }

        const deleteTx = db.transaction(() => {
            db.prepare('DELETE FROM AccountLedger WHERE AccountID = ?').run(req.params.id);
            db.prepare('DELETE FROM Accounts WHERE ID = ?').run(req.params.id);
        });
        deleteTx();

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/accounts/:id/payment — record a payment ──
router.post('/:id/payment', async (req, res) => {
    try {
        const { Amount, Description, PaymentMethod } = req.body;
        if (!Amount || Amount <= 0) return res.status(400).json({ error: 'Tutar zorunludur' });

        const db = getDb();
        if (!db) return res.status(503).json({ error: 'Database not available' });

        const account = db.prepare('SELECT * FROM Accounts WHERE ID = ?').get(req.params.id);
        if (!account) return res.status(404).json({ error: 'Cari bulunamadı' });

        const recordPayment = db.transaction(() => {
            const isSupplier = account.Type === 'Tedarikçi';
            const label = isSupplier ? 'Ödeme' : 'Tahsilat';

            // Ledger entry: Alacak (debt reduced)
            db.prepare(
                `INSERT INTO AccountLedger (AccountID, Type, Amount, Description, RefType)
                 VALUES (?, 'Alacak', ?, ?, 'Payment')`
            ).run(req.params.id, Amount, Description || `${label} — ${account.Name}`);

            // Update balance
            db.prepare('UPDATE Accounts SET Balance = Balance - ? WHERE ID = ?')
                .run(Amount, req.params.id);

            // Account transaction record
            db.prepare(
                `INSERT INTO AccountTransactions (Type, Amount, Description, AccountID, PaymentMethod)
                 VALUES ('Payment', ?, ?, ?, ?)`
            ).run(Amount, `${label} — ${account.Name}`, req.params.id, PaymentMethod || 'Cash');
        });

        recordPayment();
        const updated = db.prepare('SELECT * FROM Accounts WHERE ID = ?').get(req.params.id);
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
