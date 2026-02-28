import { Router } from 'express';
import { getDb } from '../config/db.js';

const router = Router();

// ── GET /api/orders — list all purchase orders ──
router.get('/', async (req, res) => {
    try {
        const db = getDb();
        if (!db) return res.status(503).json({ error: 'Database not available' });

        const { status } = req.query;
        let rows;
        if (status) {
            rows = db.prepare(`
                SELECT po.*,
                    GROUP_CONCAT(p.Name || ' x' || poi.Qty, ', ') AS ItemsSummary
                FROM PurchaseOrders po
                LEFT JOIN PurchaseOrderItems poi ON poi.PurchaseOrderID = po.ID
                LEFT JOIN Products p ON p.ID = poi.ProductID
                WHERE po.Status = ?
                GROUP BY po.ID
                ORDER BY po.CreatedAt DESC
            `).all(status);
        } else {
            rows = db.prepare(`
                SELECT po.*,
                    GROUP_CONCAT(p.Name || ' x' || poi.Qty, ', ') AS ItemsSummary
                FROM PurchaseOrders po
                LEFT JOIN PurchaseOrderItems poi ON poi.PurchaseOrderID = po.ID
                LEFT JOIN Products p ON p.ID = poi.ProductID
                GROUP BY po.ID
                ORDER BY po.CreatedAt DESC
            `).all();
        }
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/orders/:id — single order with items ──
router.get('/:id', async (req, res) => {
    try {
        const db = getDb();
        if (!db) return res.status(503).json({ error: 'Database not available' });

        const order = db.prepare('SELECT * FROM PurchaseOrders WHERE ID = ?').get(req.params.id);
        if (!order) return res.status(404).json({ error: 'Sipariş bulunamadı' });

        const items = db.prepare(`
            SELECT poi.*, p.Name AS ProductName, p.Stock AS CurrentStock, p.CriticalStock
            FROM PurchaseOrderItems poi
            JOIN Products p ON p.ID = poi.ProductID
            WHERE poi.PurchaseOrderID = ?
        `).all(req.params.id);

        res.json({ ...order, items });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/orders — create a new purchase order (Beklemede) ──
router.post('/', async (req, res) => {
    try {
        const { Counterparty, Description, PaymentMethod, items } = req.body;
        if (!Counterparty || !items || items.length === 0) {
            return res.status(400).json({ error: 'Tedarikçi ve ürün kalemleri zorunludur' });
        }

        const db = getDb();
        if (!db) return res.status(503).json({ error: 'Database not available' });

        const createOrder = db.transaction(() => {
            const totalAmount = items.reduce((sum, i) => sum + (i.Qty * i.UnitPrice), 0);
            const account = db.prepare('SELECT * FROM Accounts WHERE Name = ?').get(Counterparty);
            const accountID = account ? account.ID : null;

            const info = db.prepare(
                `INSERT INTO PurchaseOrders (Counterparty, AccountID, TotalAmount, Description, PaymentMethod, Status)
                 VALUES (?, ?, ?, ?, ?, 'Beklemede')`
            ).run(Counterparty, accountID, totalAmount, Description || null, PaymentMethod || 'Cash');

            const orderID = info.lastInsertRowid;
            for (const item of items) {
                db.prepare(
                    'INSERT INTO PurchaseOrderItems (PurchaseOrderID, ProductID, Qty, UnitPrice) VALUES (?, ?, ?, ?)'
                ).run(orderID, item.ProductID, item.Qty, item.UnitPrice);
            }

            return orderID;
        });

        const orderID = createOrder();
        const order = db.prepare('SELECT * FROM PurchaseOrders WHERE ID = ?').get(orderID);
        res.status(201).json(order);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/orders/:id/receive — mark order as received → create invoice + stock + ledger ──
router.post('/:id/receive', async (req, res) => {
    try {
        const db = getDb();
        if (!db) return res.status(503).json({ error: 'Database not available' });

        const order = db.prepare('SELECT * FROM PurchaseOrders WHERE ID = ?').get(req.params.id);
        if (!order) return res.status(404).json({ error: 'Sipariş bulunamadı' });
        if (order.Status !== 'Beklemede') return res.status(400).json({ error: 'Bu sipariş zaten işlendi' });

        const items = db.prepare('SELECT * FROM PurchaseOrderItems WHERE PurchaseOrderID = ?').all(req.params.id);

        const receiveOrder = db.transaction(() => {
            // 1. Create invoice
            const invoiceInfo = db.prepare(
                `INSERT INTO Invoices (InvoiceNo, Type, Counterparty, TotalAmount, Description, AccountID)
                 VALUES (?, 'Fatura', ?, ?, ?, ?)`
            ).run(`SIP-${order.ID}`, order.Counterparty, order.TotalAmount, `Sipariş #${order.ID} teslim alındı`, order.AccountID);
            const invoiceID = invoiceInfo.lastInsertRowid;

            // 2. Insert invoice items + increment stock
            for (const item of items) {
                db.prepare('INSERT INTO InvoiceItems (InvoiceID, ProductID, Qty, UnitPrice) VALUES (?, ?, ?, ?)')
                    .run(invoiceID, item.ProductID, item.Qty, item.UnitPrice);
                db.prepare('UPDATE Products SET Stock = Stock + ? WHERE ID = ?')
                    .run(item.Qty, item.ProductID);
            }

            // 3. Account transaction
            db.prepare(
                `INSERT INTO AccountTransactions (Type, Amount, Description, Counterparty, InvoiceID, AccountID, PaymentMethod)
                 VALUES ('Purchase', ?, ?, ?, ?, ?, ?)`
            ).run(-order.TotalAmount, `Sipariş #${order.ID} — ${order.Counterparty}`, order.Counterparty, invoiceID, order.AccountID, order.PaymentMethod);

            // 4. Cari ledger (borçlanma)
            if (order.AccountID) {
                db.prepare(
                    `INSERT INTO AccountLedger (AccountID, Type, Amount, Description, RefType, RefID)
                     VALUES (?, 'Borç', ?, ?, 'Invoice', ?)`
                ).run(order.AccountID, order.TotalAmount, `Sipariş #${order.ID} teslim`, invoiceID);

                db.prepare('UPDATE Accounts SET Balance = Balance + ? WHERE ID = ?')
                    .run(order.TotalAmount, order.AccountID);
            }

            // 5. Update order status
            db.prepare(
                `UPDATE PurchaseOrders SET Status = 'Teslim Alındı', InvoiceID = ?, ReceivedAt = datetime('now') WHERE ID = ?`
            ).run(invoiceID, req.params.id);

            return invoiceID;
        });

        receiveOrder();
        const updated = db.prepare('SELECT * FROM PurchaseOrders WHERE ID = ?').get(req.params.id);
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/orders/:id/cancel — cancel a pending order ──
router.post('/:id/cancel', async (req, res) => {
    try {
        const db = getDb();
        if (!db) return res.status(503).json({ error: 'Database not available' });

        const order = db.prepare('SELECT * FROM PurchaseOrders WHERE ID = ?').get(req.params.id);
        if (!order) return res.status(404).json({ error: 'Sipariş bulunamadı' });
        if (order.Status !== 'Beklemede') return res.status(400).json({ error: 'Sadece bekleyen siparişler iptal edilebilir' });

        db.prepare("UPDATE PurchaseOrders SET Status = 'İptal' WHERE ID = ?").run(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── DELETE /api/orders/:id — delete order (only pending/cancelled) ──
router.delete('/:id', async (req, res) => {
    try {
        const db = getDb();
        if (!db) return res.status(503).json({ error: 'Database not available' });

        const order = db.prepare('SELECT * FROM PurchaseOrders WHERE ID = ?').get(req.params.id);
        if (!order) return res.status(404).json({ error: 'Sipariş bulunamadı' });
        if (order.Status === 'Teslim Alındı') return res.status(400).json({ error: 'Teslim alınmış sipariş silinemez' });

        db.transaction(() => {
            db.prepare('DELETE FROM PurchaseOrderItems WHERE PurchaseOrderID = ?').run(req.params.id);
            db.prepare('DELETE FROM PurchaseOrders WHERE ID = ?').run(req.params.id);
        })();

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
