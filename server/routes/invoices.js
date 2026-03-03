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
        const {
            InvoiceNo, Type, Counterparty, Description, PaymentMethod, items,
            ShipDate, PaymentDays, IsOpen, TaxOffice, TaxNumber, Address, Phone,
            WaybillNo, Carrier, PlateNo, InternalNote,
            GrandTotal, SubTotal, TotalDiscount, TotalVat
        } = req.body;

        if (!Counterparty || !items || items.length === 0) {
            return res.status(400).json({ error: 'Counterparty and items are required' });
        }

        const db = getDb();
        if (!db) return res.status(503).json({ error: 'Database not available' });

        const createInvoice = db.transaction(() => {
            const totalAmount = GrandTotal !== undefined ? GrandTotal : items.reduce((sum, i) => sum + (i.Qty * i.UnitPrice), 0);

            // Find account by name
            const account = db.prepare('SELECT * FROM Accounts WHERE Name = ?').get(Counterparty);
            const accountID = account ? account.ID : null;

            // Insert invoice with AccountID and new fields
            const invoiceInfo = db.prepare(
                `INSERT INTO Invoices (
                    InvoiceNo, Type, Counterparty, TotalAmount, SubTotal, TotalDiscount, TotalVat, Description, AccountID,
                    ShipDate, PaymentDays, IsOpen, TaxOffice, TaxNumber, Address, Phone,
                    WaybillNo, Carrier, PlateNo, InternalNote
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).run(
                InvoiceNo || null, Type || 'Fatura', Counterparty, totalAmount, SubTotal || 0, TotalDiscount || 0, TotalVat || 0, Description || null, accountID,
                ShipDate || null, PaymentDays || 0, IsOpen === false ? 0 : 1, TaxOffice || null, TaxNumber || null, Address || null, Phone || null,
                WaybillNo || null, Carrier || null, PlateNo || null, InternalNote || null
            );
            const invoiceID = invoiceInfo.lastInsertRowid;

            let stockMultiplier = 1;
            let txnType = 'Purchase';
            let txnAmountMultiplier = -1; // Cash impact (e.g. Purchase reduces cash if paid from till/bank)
            let ledgerType = 'Alacak'; // Bizim borcumuz, tedarikçinin alacağı
            let balanceMultiplier = 1; // Pozitif bakiye = Borcumuz/Alacağımız artar

            // Satış -> Stok düşer, kasa girişi olur (+), müşterinin bize borcu artar (Borç)
            if (Type === 'Satış Faturası') {
                stockMultiplier = -1;
                txnType = 'Sale';
                txnAmountMultiplier = 1;
                ledgerType = 'Borç';
                balanceMultiplier = 1;
            }
            // Satış İade -> Stok artar, kasa çıkışı olur (-), müşterinin borcu azalır (Alacak)
            else if (Type === 'Satış İade') {
                stockMultiplier = 1;
                txnType = 'Sale Return';
                txnAmountMultiplier = -1;
                ledgerType = 'Alacak';
                balanceMultiplier = -1;
            }
            // Alış İade -> Stok düşer, kasa girişi gibi etki (+), tedarikçiye borcumuz azalır (Borç)
            else if (Type === 'Alış İade') {
                stockMultiplier = -1;
                txnType = 'Purchase Return';
                txnAmountMultiplier = 1;
                ledgerType = 'Borç';
                balanceMultiplier = -1;
            }
            // İrsaliye -> Yalnızca Stok hareketi (finansal kayıtlar isteğe bağlı olarak veya hiç açılmaz ama şimdilik standart bırakıp txn eklemeyebiliriz. Mevcut yapı hepsine Invoice ekliyor. Stok çıkışı olarak varsayalım, sadece çıkış.)
            else if (Type === 'İrsaliye') {
                stockMultiplier = -1; // Çıkış irsaliyesi varsayımı
            }

            // Insert items + update stock
            for (const item of items) {
                db.prepare(`
                    INSERT INTO InvoiceItems (
                        InvoiceID, ProductID, Qty, UnitPrice,
                        VatRate, VatType, Disc1, Disc2, Disc3, RowTotal
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                    invoiceID, item.ProductID, item.Qty, item.UnitPrice,
                    item.VatRate || 0, item.VatType || 'Hariç', item.Disc1 || 0, item.Disc2 || 0, item.Disc3 || 0, item.RowTotal || 0
                );
                db.prepare('UPDATE Products SET Stock = Stock + ? WHERE ID = ?')
                    .run(item.Qty * stockMultiplier, item.ProductID);
            }

            // Account transaction
            if (Type !== 'İrsaliye') {
                db.prepare(
                    `INSERT INTO AccountTransactions (Type, Amount, Description, Counterparty, InvoiceID, AccountID, PaymentMethod)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`
                ).run(txnType, totalAmount * txnAmountMultiplier, `${Type} #${InvoiceNo || invoiceID} — ${Counterparty}`, Counterparty, invoiceID, accountID, PaymentMethod || 'Cash');

                // Cari hareket
                if (accountID) {
                    db.prepare(
                        `INSERT INTO AccountLedger (AccountID, Type, Amount, Description, RefType, RefID)
                         VALUES (?, ?, ?, ?, 'Invoice', ?)`
                    ).run(accountID, ledgerType, totalAmount, `${Type} #${InvoiceNo || invoiceID}`, invoiceID);

                    db.prepare('UPDATE Accounts SET Balance = Balance + ? WHERE ID = ?')
                        .run(totalAmount * balanceMultiplier, accountID);
                }
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
            let stockMultiplier = 1;
            let balanceMultiplier = 1;

            if (invoice.Type === 'Satış Faturası') {
                stockMultiplier = -1;
                balanceMultiplier = 1;
            } else if (invoice.Type === 'Satış İade') {
                stockMultiplier = 1;
                balanceMultiplier = -1;
            } else if (invoice.Type === 'Alış İade') {
                stockMultiplier = -1;
                balanceMultiplier = -1;
            } else if (invoice.Type === 'İrsaliye') {
                stockMultiplier = -1;
            }

            // Reverse stock
            for (const item of items) {
                db.prepare('UPDATE Products SET Stock = Stock - ? WHERE ID = ?').run(item.Qty * stockMultiplier, item.ProductID);
            }

            // Reverse cari ledger + balance
            if (invoice.AccountID && invoice.Type !== 'İrsaliye') {
                db.prepare('DELETE FROM AccountLedger WHERE RefType = ? AND RefID = ? AND AccountID = ?')
                    .run('Invoice', req.params.id, invoice.AccountID);
                db.prepare('UPDATE Accounts SET Balance = Balance - ? WHERE ID = ?')
                    .run(invoice.TotalAmount * balanceMultiplier, invoice.AccountID);
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
