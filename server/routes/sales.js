import { Router } from 'express';
import { getDb } from '../config/db.js';

const router = Router();

// POST /api/sales — create a sale with items (transaction)
router.post('/', async (req, res) => {
    try {
        const { items, paymentMethod, tax, discount, courierID } = req.body;
        const db = getDb();
        if (!db) {
            if (process.env.USE_MOCK_DATA === 'true') {
                console.warn("⚠️ DB not available, mocking sale creation");
                return res.json({ success: true, saleID: Math.floor(Math.random() * 1000) });
            }
            return res.status(503).json({ error: 'Database not available' });
        }

        const insertSale = db.prepare(
            `INSERT INTO Sales (TotalAmount, Tax, Discount, PaymentMethod, CourierID)
             VALUES (?, ?, ?, ?, ?)`
        );
        const insertItem = db.prepare(
            `INSERT INTO SaleItems (SaleID, ProductID, Qty, UnitPrice)
             VALUES (?, ?, ?, ?)`
        );
        const decrementStock = db.prepare(
            'UPDATE Products SET Stock = Stock - ? WHERE ID = ?'
        );
        const insertTransaction = db.prepare(
            `INSERT INTO AccountTransactions (Type, Amount, Description, SaleID, PaymentMethod)
             VALUES ('Sale', ?, ?, ?, ?)`
        );

        const createSale = db.transaction(() => {
            const totalAmount = items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);
            const saleInfo = insertSale.run(totalAmount, tax || 0, discount || 0, paymentMethod || 'Cash', courierID || null);
            const saleID = saleInfo.lastInsertRowid;

            for (const item of items) {
                insertItem.run(saleID, item.productID, item.qty, item.unitPrice);
                decrementStock.run(item.qty, item.productID);
            }

            // Record account transaction
            insertTransaction.run(totalAmount, `Satış #${saleID}`, saleID, paymentMethod || 'Cash');

            return saleID;
        });

        const saleID = createSale();
        res.json({ success: true, saleID });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/sales/summary — revenue & profit aggregates
router.get('/summary', async (req, res) => {
    try {
        const db = getDb();
        if (!db) {
            if (process.env.USE_MOCK_DATA === 'true') {
                console.warn("⚠️ DB not available, returning mock sales summary");
                return res.json({ TotalSales: 45, TotalRevenue: 15200.5, NetProfit: 6300.25 });
            }
            return res.status(503).json({ error: 'Database not available' });
        }
        const row = db.prepare(`
            SELECT
                COUNT(DISTINCT s.ID) AS TotalSales,
                IFNULL(SUM(s.TotalAmount), 0) AS TotalRevenue,
                IFNULL(SUM(s.TotalAmount) - SUM(si.Qty * p.CostPrice), 0) AS NetProfit
            FROM Sales s
            JOIN SaleItems si ON si.SaleID = s.ID
            JOIN Products p ON p.ID = si.ProductID
        `).get();
        res.json(row || { TotalSales: 0, TotalRevenue: 0, NetProfit: 0 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
