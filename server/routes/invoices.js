import { Router } from 'express';
import { getDb } from '../config/db.js';

const router = Router();

// ── GET /api/invoices — list all invoices ──
router.get('/', async (req, res) => {
    try {
        const db = getDb();
        if (!db) {
            if (process.env.USE_MOCK_DATA === 'true') {
                return res.json(getMockInvoices());
            }
            return res.status(503).json({ error: 'Database not available' });
        }

        const rows = db.prepare(`
            SELECT i.*,
                   GROUP_CONCAT(p.Name || ' x' || ii.Qty, ', ') AS ItemsSummary
            FROM Invoices i
            LEFT JOIN InvoiceItems ii ON ii.InvoiceID = i.ID
            LEFT JOIN Products p ON p.ID = ii.ProductID
            GROUP BY i.ID
            ORDER BY i.CreatedAt DESC
        `).all();

        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/invoices/:id — single invoice with items ──
router.get('/:id', async (req, res) => {
    try {
        const db = getDb();
        if (!db) return res.status(503).json({ error: 'Database not available' });

        const invoice = db.prepare('SELECT * FROM Invoices WHERE ID = ?').get(req.params.id);
        if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

        const items = db.prepare(`
            SELECT ii.*, p.Name AS ProductName
            FROM InvoiceItems ii
            JOIN Products p ON p.ID = ii.ProductID
            WHERE ii.InvoiceID = ?
        `).all(req.params.id);

        res.json({ ...invoice, items });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/invoices — create invoice + update stock + log transaction + update ledger ──
router.post('/', async (req, res) => {
    try {
        const { InvoiceNo, Type, Counterparty, Description, PaymentMethod, items } = req.body;

        if (!Counterparty || !items || items.length === 0) {
            return res.status(400).json({ error: 'Counterparty and items are required' });
        }

        const db = getDb();
        if (!db) return res.status(503).json({ error: 'Database not available' });

        const createInvoice = db.transaction(() => {
            const totalAmount = items.reduce((sum, i) => sum + (i.Qty * i.UnitPrice), 0);

            // Find account by name
            const account = db.prepare('SELECT * FROM Accounts WHERE Name = ?').get(Counterparty);
            const accountID = account ? account.ID : null;

            // Insert invoice with AccountID
            const invoiceInfo = db.prepare(
                `INSERT INTO Invoices (InvoiceNo, Type, Counterparty, TotalAmount, Description, AccountID)
                 VALUES (?, ?, ?, ?, ?, ?)`
            ).run(InvoiceNo || null, Type || 'Fatura', Counterparty, totalAmount, Description || null, accountID);
            const invoiceID = invoiceInfo.lastInsertRowid;

            // Insert items + increment stock
            for (const item of items) {
                db.prepare('INSERT INTO InvoiceItems (InvoiceID, ProductID, Qty, UnitPrice) VALUES (?, ?, ?, ?)')
                    .run(invoiceID, item.ProductID, item.Qty, item.UnitPrice);
                db.prepare('UPDATE Products SET Stock = Stock + ? WHERE ID = ?')
                    .run(item.Qty, item.ProductID);
            }

            // Account transaction
            const typeLabel = (Type || 'Fatura') === 'İrsaliye' ? 'İrsaliye' : 'Fatura';
            db.prepare(
                `INSERT INTO AccountTransactions (Type, Amount, Description, Counterparty, InvoiceID, AccountID, PaymentMethod)
                 VALUES ('Purchase', ?, ?, ?, ?, ?, ?)`
            ).run(-totalAmount, `${typeLabel} #${InvoiceNo || invoiceID} — ${Counterparty}`, Counterparty, invoiceID, accountID, PaymentMethod || 'Cash');

            // Cari hareket: Tedarikçiye borçlanma (Borç = biz borçluyuz)
            if (accountID) {
                db.prepare(
                    `INSERT INTO AccountLedger (AccountID, Type, Amount, Description, RefType, RefID)
                     VALUES (?, 'Borç', ?, ?, 'Invoice', ?)`
                ).run(accountID, totalAmount, `${typeLabel} #${InvoiceNo || invoiceID}`, invoiceID);

                db.prepare('UPDATE Accounts SET Balance = Balance + ? WHERE ID = ?')
                    .run(totalAmount, accountID);
            }

            return { invoiceID, totalAmount };
        });

        const result = createInvoice();
        const invoice = db.prepare('SELECT * FROM Invoices WHERE ID = ?').get(result.invoiceID);
        res.status(201).json(invoice);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── DELETE /api/invoices/:id ──
router.delete('/:id', async (req, res) => {
    try {
        const db = getDb();
        if (!db) return res.status(503).json({ error: 'Database not available' });

        const invoice = db.prepare('SELECT * FROM Invoices WHERE ID = ?').get(req.params.id);
        if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

        const items = db.prepare('SELECT * FROM InvoiceItems WHERE InvoiceID = ?').all(req.params.id);

        const deleteInvoice = db.transaction(() => {
            // Reverse stock
            for (const item of items) {
                db.prepare('UPDATE Products SET Stock = Stock - ? WHERE ID = ?').run(item.Qty, item.ProductID);
            }

            // Reverse cari ledger + balance
            if (invoice.AccountID) {
                db.prepare('DELETE FROM AccountLedger WHERE RefType = ? AND RefID = ? AND AccountID = ?')
                    .run('Invoice', req.params.id, invoice.AccountID);
                db.prepare('UPDATE Accounts SET Balance = Balance - ? WHERE ID = ?')
                    .run(invoice.TotalAmount, invoice.AccountID);
            }

            db.prepare('DELETE FROM AccountTransactions WHERE InvoiceID = ?').run(req.params.id);
            db.prepare('DELETE FROM InvoiceItems WHERE InvoiceID = ?').run(req.params.id);
            db.prepare('DELETE FROM Invoices WHERE ID = ?').run(req.params.id);

            // Cancellation log
            const reason = req.body?.reason || null;
            const staffId = req.body?.staffId || null;
            db.prepare(
                `INSERT INTO CancellationLogs (RefType, RefID, Reason, StaffID)
                 VALUES ('Invoice', ?, ?, ?)`
            ).run(req.params.id, reason, staffId || null);
        });

        deleteInvoice();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Mock data ──
function getMockInvoices() {
    const today = new Date().toISOString().slice(0, 10);
    return [
        { ID: 1, InvoiceNo: 'F-001', Type: 'Fatura', Counterparty: 'ABC Tedarik', TotalAmount: 850, Description: 'Aylık malzeme', ItemsSummary: 'Espresso x50, Latte x30', CreatedAt: `${today} 10:00:00` },
        { ID: 2, InvoiceNo: 'I-002', Type: 'İrsaliye', Counterparty: 'XYZ Dağıtım', TotalAmount: 420, Description: 'Haftalık dağıtım', ItemsSummary: 'Croissant x100, Sandwich x50', CreatedAt: `${today} 14:00:00` },
    ];
}

export default router;
