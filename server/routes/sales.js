import { Router } from 'express';
import { getDb } from '../config/db.js';
import { io } from '../index.js';
import { courierSockets } from '../sockets/courierSocket.js';

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
        const getProduct = db.prepare(
            'SELECT ID, SalePrice FROM Products WHERE ID = ?'
        );
        const getSpecialPrice = db.prepare(`
            SELECT SpecialPrice
            FROM SpecialPrices
            WHERE ProductID = ?
              AND IsActive = 1
              AND (StartDate IS NULL OR date(StartDate) <= date('now','localtime'))
              AND (EndDate   IS NULL OR date(EndDate)   >= date('now','localtime'))
            ORDER BY
              CASE WHEN StartDate IS NULL THEN 1 ELSE 0 END,
              StartDate DESC,
              ID DESC
            LIMIT 1
        `);

        const createSale = db.transaction(() => {
            let calculatedTotal = 0;

            // First pass: determine actual unit prices with special prices
            const pricedItems = items.map((i) => {
                const prod = getProduct.get(i.productID);
                const basePrice = prod ? prod.SalePrice : i.unitPrice;
                const sp = getSpecialPrice.get(i.productID);
                const finalPrice =
                    sp && sp.SpecialPrice !== null && sp.SpecialPrice >= 0
                        ? sp.SpecialPrice
                        : basePrice;
                const lineTotal = finalPrice * i.qty;
                calculatedTotal += lineTotal;
                return { ...i, unitPrice: finalPrice };
            });

            const totalAmount = calculatedTotal;
            const saleInfo = insertSale.run(totalAmount, tax || 0, discount || 0, paymentMethod || 'Cash', courierID || null);
            const saleID = saleInfo.lastInsertRowid;

            for (const item of pricedItems) {
                insertItem.run(saleID, item.productID, item.qty, item.unitPrice);
                decrementStock.run(item.qty, item.productID);
            }

            // Record account transaction
            insertTransaction.run(totalAmount, `Satış #${saleID}`, saleID, paymentMethod || 'Cash');

            return { saleID, totalAmount };
        });

        const { saleID, totalAmount } = createSale();

        // -------------------------------------------------------------
        // POSLx-Kurye (Courier APK) Delivery Assignment Socket Dispatch
        // -------------------------------------------------------------
        if (courierID) {
            const getCourier = db.prepare('SELECT Name, Phone FROM Couriers WHERE ID = ?').get(courierID);

            // Map table ID (Int) to String for map lookup, if required,
            // or just check with loosely equals inside the payload.
            const targetSocketId = courierSockets.get(courierID) || courierSockets.get(String(courierID));

            if (targetSocketId) {
                // Determine courier namespace
                const courierNsp = io.of('/couriers');

                // Construct the exact payload format the React Native APK expects (`activeDelivery`)
                const deliveryPayload = {
                    id: saleID,
                    saleId: saleID,
                    status: 'started',
                    total: totalAmount,
                    customer: 'Müşteri', // or pull from AccountID if available
                    timestamp: new Date().toISOString()
                };

                // Send private event to that specific courier socket
                courierNsp.to(targetSocketId).emit('delivery_started', deliveryPayload);
                console.log(`📦 Assigned Sale #${saleID} to Courier ID: ${courierID} (Socket: ${targetSocketId})`);
            } else {
                console.warn(`⚠️ Courier ID ${courierID} is not currently connected via WebSockets.`);
            }
        }

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

// GET /api/sales/courier-performance — get stats for dashboard
router.get('/courier-performance', async (req, res) => {
    try {
        const db = getDb();
        if (!db) return res.status(503).json({ error: 'Database not available' });

        const rows = db.prepare(`
            SELECT 
                c.Name as name,
                COUNT(s.ID) as orders,
                IFNULL(c.DailyDistanceKM, 0) as km
            FROM Couriers c
            LEFT JOIN Sales s ON s.CourierID = c.ID AND date(s.CreatedAt) = date('now')
            GROUP BY c.ID
            ORDER BY orders DESC
        `).all();

        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
