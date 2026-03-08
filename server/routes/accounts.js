import { Router } from 'express';
import { getDb } from '../config/db.js';
import sql from 'mssql';

const router = Router();

// ── GET /api/accounts — list all accounts (filter by type) ──
router.get('/', async (req, res) => {
    try {
        const pool = await getDb();
        if (!pool) return res.status(503).json({ error: 'Database not available' });

        const { type } = req.query; // Müşteri | Tedarikçi
        let result;
        if (type) {
            result = await pool.request()
                .input('type', sql.NVarChar, type)
                .query('SELECT * FROM Accounts WHERE Type = @type ORDER BY Name');
        } else {
            result = await pool.request().query('SELECT * FROM Accounts ORDER BY Type, Name');
        }
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/accounts/:id — single account with balance ──
router.get('/:id', async (req, res) => {
    try {
        const pool = await getDb();
        if (!pool) return res.status(503).json({ error: 'Database not available' });

        const accountResult = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('SELECT * FROM Accounts WHERE ID = @id');
        if (accountResult.recordset.length === 0) return res.status(404).json({ error: 'Cari bulunamadı' });
        const account = accountResult.recordset[0];

        // Recalculate balance from ledger
        const balanceResult = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query(`
            SELECT
                COALESCE(SUM(CASE WHEN Type = 'Borç'   THEN Amount ELSE 0 END), 0) AS totalDebt,
                COALESCE(SUM(CASE WHEN Type = 'Alacak' THEN Amount ELSE 0 END), 0) AS totalCredit
            FROM AccountLedger WHERE AccountID = @id
        `);
        const balanceData = balanceResult.recordset[0];

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
        const pool = await getDb();
        if (!pool) return res.status(503).json({ error: 'Database not available' });

        const { startDate, endDate } = req.query;
        let result;

        if (startDate && endDate) {
            result = await pool.request()
                .input('id', sql.Int, req.params.id)
                .input('startDate', sql.NVarChar, startDate)
                .input('endDate', sql.NVarChar, endDate)
                .query(`
                SELECT * FROM AccountLedger
                WHERE AccountID = @id AND CAST(CreatedAt AS DATE) BETWEEN CAST(@startDate AS DATE) AND CAST(@endDate AS DATE)
                ORDER BY CreatedAt DESC
            `);
        } else {
            result = await pool.request()
                .input('id', sql.Int, req.params.id)
                .query(`
                SELECT TOP 200 * FROM AccountLedger
                WHERE AccountID = @id
                ORDER BY CreatedAt DESC
            `);
        }
        const rows = result.recordset;

        // Running balance calculation
        const allEntriesResult = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query(`
            SELECT * FROM AccountLedger WHERE AccountID = @id ORDER BY CreatedAt ASC, ID ASC
        `);
        const allEntries = allEntriesResult.recordset;

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

        const pool = await getDb();
        if (!pool) return res.status(503).json({ error: 'Database not available' });

        const insertResult = await pool.request()
            .input('Name', sql.NVarChar, Name)
            .input('Type', sql.NVarChar, Type || 'Müşteri')
            .input('Phone', sql.NVarChar, Phone || null)
            .input('Email', sql.NVarChar, Email || null)
            .input('Address', sql.NVarChar, Address || null)
            .input('TaxOffice', sql.NVarChar, TaxOffice || null)
            .input('TaxNo', sql.NVarChar, TaxNo || null)
            .query(`
                INSERT INTO Accounts (Name, Type, Phone, Email, Address, TaxOffice, TaxNo) 
                OUTPUT INSERTED.ID
                VALUES (@Name, @Type, @Phone, @Email, @Address, @TaxOffice, @TaxNo)
            `);

        const createdResult = await pool.request()
            .input('id', sql.Int, insertResult.recordset[0].ID)
            .query('SELECT * FROM Accounts WHERE ID = @id');

        res.status(201).json(createdResult.recordset[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── PUT /api/accounts/:id — update an account ──
router.put('/:id', async (req, res) => {
    try {
        const { Name, Type, Phone, Email, Address, TaxOffice, TaxNo } = req.body;
        const pool = await getDb();
        if (!pool) return res.status(503).json({ error: 'Database not available' });

        await pool.request()
            .input('Name', sql.NVarChar, Name)
            .input('Type', sql.NVarChar, Type)
            .input('Phone', sql.NVarChar, Phone || null)
            .input('Email', sql.NVarChar, Email || null)
            .input('Address', sql.NVarChar, Address || null)
            .input('TaxOffice', sql.NVarChar, TaxOffice || null)
            .input('TaxNo', sql.NVarChar, TaxNo || null)
            .input('id', sql.Int, req.params.id)
            .query(`
                UPDATE Accounts 
                SET Name = @Name, Type = @Type, Phone = @Phone, Email = @Email, Address = @Address, TaxOffice = @TaxOffice, TaxNo = @TaxNo 
                WHERE ID = @id
            `);

        const updatedResult = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('SELECT * FROM Accounts WHERE ID = @id');

        if (updatedResult.recordset.length === 0) return res.status(404).json({ error: 'Cari bulunamadı' });
        res.json(updatedResult.recordset[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── DELETE /api/accounts/:id — delete an account (only if balance = 0) ──
router.delete('/:id', async (req, res) => {
    try {
        const pool = await getDb();
        if (!pool) return res.status(503).json({ error: 'Database not available' });

        const accountResult = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('SELECT * FROM Accounts WHERE ID = @id');
        if (accountResult.recordset.length === 0) return res.status(404).json({ error: 'Cari bulunamadı' });

        // Check for outstanding balance
        const ledgerSumResult = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query(`
            SELECT
                COALESCE(SUM(CASE WHEN Type = 'Borç' THEN Amount ELSE -Amount END), 0) AS balance
            FROM AccountLedger WHERE AccountID = @id
        `);
        const ledgerSum = ledgerSumResult.recordset[0];

        if (Math.abs(ledgerSum.balance) > 0.01) {
            return res.status(400).json({ error: 'Bakiyesi olan cari silinemez' });
        }

        const transaction = new sql.Transaction(pool);
        await transaction.begin();
        try {
            await (new sql.Request(transaction))
                .input('id', sql.Int, req.params.id)
                .query('DELETE FROM AccountLedger WHERE AccountID = @id');

            await (new sql.Request(transaction))
                .input('id', sql.Int, req.params.id)
                .query('DELETE FROM Accounts WHERE ID = @id');

            await transaction.commit();
        } catch (txErr) {
            await transaction.rollback();
            throw txErr;
        }

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

        const pool = await getDb();
        if (!pool) return res.status(503).json({ error: 'Database not available' });

        const accountResult = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('SELECT * FROM Accounts WHERE ID = @id');
        if (accountResult.recordset.length === 0) return res.status(404).json({ error: 'Cari bulunamadı' });
        const account = accountResult.recordset[0];

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            const isSupplier = account.Type === 'Tedarikçi';
            const label = isSupplier ? 'Ödeme' : 'Tahsilat';
            // Tahsilat (Customer pays us) -> reduces their debt -> Alacak
            // Ödeme (We pay supplier) -> reduces our debt to them -> Borç (increases their balance towards positive/0)
            const ledgerType = isSupplier ? 'Borç' : 'Alacak';
            const balanceMultiplier = isSupplier ? 1 : -1;

            // Ledger entry
            const reqLedger = new sql.Request(transaction);
            await reqLedger
                .input('AccountID', sql.Int, req.params.id)
                .input('Type', sql.NVarChar, ledgerType)
                .input('Amount', sql.Float, Amount)
                .input('Description', sql.NVarChar, Description || `${label} — ${account.Name}`)
                .query(`
                    INSERT INTO AccountLedger (AccountID, Type, Amount, Description, RefType)
                    VALUES (@AccountID, @Type, @Amount, @Description, 'Payment')
                `);

            // Update balance
            const reqBalance = new sql.Request(transaction);
            await reqBalance
                .input('balanceChange', sql.Float, Amount * balanceMultiplier)
                .input('id', sql.Int, req.params.id)
                .query('UPDATE Accounts SET Balance = Balance + @balanceChange WHERE ID = @id');

            // Account transaction record
            const reqAccTx = new sql.Request(transaction);
            await reqAccTx
                .input('Amount', sql.Float, Amount * (isSupplier ? -1 : 1))
                .input('Description', sql.NVarChar, `${label} — ${account.Name}`)
                .input('AccountID', sql.Int, req.params.id)
                .input('PaymentMethod', sql.NVarChar, PaymentMethod || 'Cash')
                .query(`
                    INSERT INTO AccountTransactions (Type, Amount, Description, AccountID, PaymentMethod)
                    VALUES ('Payment', @Amount, @Description, @AccountID, @PaymentMethod)
                `);

            await transaction.commit();
        } catch (txErr) {
            await transaction.rollback();
            throw txErr;
        }

        const updatedResult = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('SELECT * FROM Accounts WHERE ID = @id');

        res.json(updatedResult.recordset[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
