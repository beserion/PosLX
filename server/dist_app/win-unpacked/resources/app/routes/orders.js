import { Router } from 'express';
import { getDb } from '../config/db.js';
import sql from 'mssql';

const router = Router();

// ── GET /api/orders — list all purchase orders ──
router.get('/', async (req, res) => {
    try {
        const pool = await getDb();
        if (!pool) return res.status(503).json({ error: 'Database not available' });

        const { status } = req.query;
        let result;
        if (status) {
            result = await pool.request()
                .input('status', sql.NVarChar, status)
                .query(`
                SELECT po.*, poi.ItemsSummary
                FROM PurchaseOrders po
                LEFT JOIN (
                    SELECT poi.PurchaseOrderID, STRING_AGG(CAST(p.Name + ' x' + CAST(poi.Qty AS NVARCHAR(MAX)) AS NVARCHAR(MAX)), ', ') AS ItemsSummary
                    FROM PurchaseOrderItems poi
                    JOIN Products p ON p.ID = poi.ProductID
                    GROUP BY poi.PurchaseOrderID
                ) poi ON poi.PurchaseOrderID = po.ID
                WHERE po.Status = @status
                ORDER BY po.CreatedAt DESC
            `);
        } else {
            result = await pool.request().query(`
                SELECT po.*, poi.ItemsSummary
                FROM PurchaseOrders po
                LEFT JOIN (
                    SELECT poi.PurchaseOrderID, STRING_AGG(CAST(p.Name + ' x' + CAST(poi.Qty AS NVARCHAR(MAX)) AS NVARCHAR(MAX)), ', ') AS ItemsSummary
                    FROM PurchaseOrderItems poi
                    JOIN Products p ON p.ID = poi.ProductID
                    GROUP BY poi.PurchaseOrderID
                ) poi ON poi.PurchaseOrderID = po.ID
                ORDER BY po.CreatedAt DESC
            `);
        }
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/orders/:id — single order with items ──
router.get('/:id', async (req, res) => {
    try {
        const pool = await getDb();
        if (!pool) return res.status(503).json({ error: 'Database not available' });

        const orderResult = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('SELECT * FROM PurchaseOrders WHERE ID = @id');

        if (orderResult.recordset.length === 0) return res.status(404).json({ error: 'Sipariş bulunamadı' });
        const order = orderResult.recordset[0];

        const itemsResult = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query(`
            SELECT poi.*, p.Name AS ProductName, p.Stock AS CurrentStock, p.CriticalStock
            FROM PurchaseOrderItems poi
            JOIN Products p ON p.ID = poi.ProductID
            WHERE poi.PurchaseOrderID = @id
        `);

        res.json({ ...order, items: itemsResult.recordset });
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

        const pool = await getDb();
        if (!pool) return res.status(503).json({ error: 'Database not available' });

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        let orderID;
        try {
            const totalAmount = items.reduce((sum, i) => sum + (i.Qty * i.UnitPrice), 0);

            const reqAccount = new sql.Request(transaction);
            const accountResult = await reqAccount
                .input('Counterparty', sql.NVarChar, Counterparty)
                .query('SELECT * FROM Accounts WHERE Name = @Counterparty');

            const accountID = accountResult.recordset.length > 0 ? accountResult.recordset[0].ID : null;

            const reqOrder = new sql.Request(transaction);
            let accountIdParamType = accountID ? sql.Int : sql.Int;
            const orderInsertResult = await reqOrder
                .input('Counterparty', sql.NVarChar, Counterparty)
                .input('AccountID', accountIdParamType, accountID)
                .input('TotalAmount', sql.Float, totalAmount)
                .input('Description', sql.NVarChar, Description || null)
                .input('PaymentMethod', sql.NVarChar, PaymentMethod || 'Cash')
                .query(`
                    INSERT INTO PurchaseOrders (Counterparty, AccountID, TotalAmount, Description, PaymentMethod, Status)
                    OUTPUT INSERTED.ID
                    VALUES (@Counterparty, @AccountID, @TotalAmount, @Description, @PaymentMethod, 'Beklemede')
                `);

            orderID = orderInsertResult.recordset[0].ID;

            for (const item of items) {
                const reqItem = new sql.Request(transaction);
                await reqItem
                    .input('PurchaseOrderID', sql.Int, orderID)
                    .input('ProductID', sql.Int, item.ProductID)
                    .input('Qty', sql.Float, item.Qty)
                    .input('UnitPrice', sql.Float, item.UnitPrice)
                    .query('INSERT INTO PurchaseOrderItems (PurchaseOrderID, ProductID, Qty, UnitPrice) VALUES (@PurchaseOrderID, @ProductID, @Qty, @UnitPrice)');
            }

            await transaction.commit();
        } catch (txErr) {
            await transaction.rollback();
            throw txErr;
        }

        const createdOrderResult = await pool.request()
            .input('id', sql.Int, orderID)
            .query('SELECT * FROM PurchaseOrders WHERE ID = @id');

        res.status(201).json(createdOrderResult.recordset[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/orders/:id/receive — mark order as received → create invoice + stock + ledger ──
router.post('/:id/receive', async (req, res) => {
    try {
        const pool = await getDb();
        if (!pool) return res.status(503).json({ error: 'Database not available' });

        const orderResult = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('SELECT * FROM PurchaseOrders WHERE ID = @id');

        if (orderResult.recordset.length === 0) return res.status(404).json({ error: 'Sipariş bulunamadı' });
        const order = orderResult.recordset[0];

        if (order.Status !== 'Beklemede') return res.status(400).json({ error: 'Bu sipariş zaten işlendi' });

        const itemsResult = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('SELECT * FROM PurchaseOrderItems WHERE PurchaseOrderID = @id');
        const items = itemsResult.recordset;

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        let invoiceID;
        try {
            // 1. Create invoice
            const reqInvoice = new sql.Request(transaction);
            const invoiceInsertResult = await reqInvoice
                .input('InvoiceNo', sql.NVarChar, `SIP-${order.ID}`)
                .input('Counterparty', sql.NVarChar, order.Counterparty)
                .input('TotalAmount', sql.Float, order.TotalAmount)
                .input('Description', sql.NVarChar, `Sipariş #${order.ID} teslim alındı`)
                .input('AccountID', sql.Int, order.AccountID)
                .query(`
                    INSERT INTO Invoices (InvoiceNo, Type, Counterparty, TotalAmount, Description, AccountID)
                    OUTPUT INSERTED.ID
                    VALUES (@InvoiceNo, 'Fatura', @Counterparty, @TotalAmount, @Description, @AccountID)
                `);
            invoiceID = invoiceInsertResult.recordset[0].ID;

            // 2. Insert invoice items + increment stock
            for (const item of items) {
                const reqItem = new sql.Request(transaction);
                await reqItem
                    .input('InvoiceID', sql.Int, invoiceID)
                    .input('ProductID', sql.Int, item.ProductID)
                    .input('Qty', sql.Float, item.Qty)
                    .input('UnitPrice', sql.Float, item.UnitPrice)
                    .query('INSERT INTO InvoiceItems (InvoiceID, ProductID, Qty, UnitPrice) VALUES (@InvoiceID, @ProductID, @Qty, @UnitPrice)');

                const reqStock = new sql.Request(transaction);
                await reqStock
                    .input('Qty', sql.Float, item.Qty)
                    .input('ProductID', sql.Int, item.ProductID)
                    .query('UPDATE Products SET Stock = Stock + @Qty WHERE ID = @ProductID');
            }

            // 3. Account transaction
            const reqAccTx = new sql.Request(transaction);
            await reqAccTx
                .input('Amount', sql.Float, -order.TotalAmount)
                .input('Description', sql.NVarChar, `Sipariş #${order.ID} — ${order.Counterparty}`)
                .input('Counterparty', sql.NVarChar, order.Counterparty)
                .input('InvoiceID', sql.Int, invoiceID)
                .input('AccountID', sql.Int, order.AccountID)
                .input('PaymentMethod', sql.NVarChar, order.PaymentMethod)
                .query(`
                    INSERT INTO AccountTransactions (Type, Amount, Description, Counterparty, InvoiceID, AccountID, PaymentMethod)
                    VALUES ('Purchase', @Amount, @Description, @Counterparty, @InvoiceID, @AccountID, @PaymentMethod)
                `);

            // 4. Cari ledger (borçlanma)
            if (order.AccountID) {
                const reqLedger = new sql.Request(transaction);
                await reqLedger
                    .input('AccountID', sql.Int, order.AccountID)
                    .input('Amount', sql.Float, order.TotalAmount)
                    .input('Description', sql.NVarChar, `Sipariş #${order.ID} teslim`)
                    .input('InvoiceID', sql.Int, invoiceID)
                    .query(`
                        INSERT INTO AccountLedger (AccountID, Type, Amount, Description, RefType, RefID)
                        VALUES (@AccountID, 'Borç', @Amount, @Description, 'Invoice', @InvoiceID)
                    `);

                const reqAccUpdate = new sql.Request(transaction);
                await reqAccUpdate
                    .input('Amount', sql.Float, order.TotalAmount)
                    .input('AccountID', sql.Int, order.AccountID)
                    .query('UPDATE Accounts SET Balance = Balance + @Amount WHERE ID = @AccountID');
            }

            // 5. Update order status
            const reqOrderUpdate = new sql.Request(transaction);
            await reqOrderUpdate
                .input('InvoiceID', sql.Int, invoiceID)
                .input('id', sql.Int, req.params.id)
                .query(`UPDATE PurchaseOrders SET Status = 'Teslim Alındı', InvoiceID = @InvoiceID, ReceivedAt = GETDATE() WHERE ID = @id`);

            await transaction.commit();
        } catch (txErr) {
            await transaction.rollback();
            throw txErr;
        }

        const updatedResult = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('SELECT * FROM PurchaseOrders WHERE ID = @id');

        res.json(updatedResult.recordset[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/orders/:id/cancel — cancel a pending order ──
router.post('/:id/cancel', async (req, res) => {
    try {
        const pool = await getDb();
        if (!pool) return res.status(503).json({ error: 'Database not available' });

        const orderResult = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('SELECT * FROM PurchaseOrders WHERE ID = @id');

        if (orderResult.recordset.length === 0) return res.status(404).json({ error: 'Sipariş bulunamadı' });
        const order = orderResult.recordset[0];

        if (order.Status !== 'Beklemede') return res.status(400).json({ error: 'Sadece bekleyen siparişler iptal edilebilir' });

        await pool.request()
            .input('id', sql.Int, req.params.id)
            .query("UPDATE PurchaseOrders SET Status = 'İptal' WHERE ID = @id");

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── DELETE /api/orders/:id — delete order (only pending/cancelled) ──
router.delete('/:id', async (req, res) => {
    try {
        const pool = await getDb();
        if (!pool) return res.status(503).json({ error: 'Database not available' });

        const orderResult = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('SELECT * FROM PurchaseOrders WHERE ID = @id');

        if (orderResult.recordset.length === 0) return res.status(404).json({ error: 'Sipariş bulunamadı' });
        const order = orderResult.recordset[0];
        if (order.Status === 'Teslim Alındı') return res.status(400).json({ error: 'Teslim alınmış sipariş silinemez' });

        const transaction = new sql.Transaction(pool);
        await transaction.begin();
        try {
            const reqItemsDelete = new sql.Request(transaction);
            await reqItemsDelete
                .input('id', sql.Int, req.params.id)
                .query('DELETE FROM PurchaseOrderItems WHERE PurchaseOrderID = @id');

            const reqOrderDelete = new sql.Request(transaction);
            await reqOrderDelete
                .input('id', sql.Int, req.params.id)
                .query('DELETE FROM PurchaseOrders WHERE ID = @id');

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

export default router;
