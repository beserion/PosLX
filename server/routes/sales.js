import { Router } from 'express';
import { getDb } from '../config/db.js';
import { io } from '../index.js';
import { courierSockets } from '../sockets/courierSocket.js';

const router = Router();

// POST /api/sales — create a sale with items (transaction)
router.post('/', async (req, res) => {
    try {
        const { items, paymentMethod, tax, discount, serviceFee, courierID } = req.body;
        const db = getDb();
        if (!db) {
            if (process.env.USE_MOCK_DATA === 'true') {
                console.warn("⚠️ DB not available, mocking sale creation");
                return res.json({ success: true, saleID: Math.floor(Math.random() * 1000) });
            }
            return res.status(503).json({ error: 'Database not available' });
        }

        const insertSale = db.prepare(
            `INSERT INTO Sales (TotalAmount, Tax, Discount, ServiceFee, PaymentMethod, CourierID)
             VALUES (?, ?, ?, ?, ?, ?)`
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

            const totalAmount = calculatedTotal + (serviceFee || 0) - (discount || 0);
            const saleInfo = insertSale.run(totalAmount, tax || 0, discount || 0, serviceFee || 0, paymentMethod || 'Cash', courierID || null);
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
            // Map table ID (Int) to String for map lookup
            const targetSocketId = courierSockets.get(courierID) || courierSockets.get(String(courierID)) || courierSockets.get(Number(courierID));

            // Fetch sale items with product names
            const saleItems = db.prepare(`
                SELECT p.Name as name, si.Qty as qty, si.UnitPrice as price
                FROM SaleItems si
                JOIN Products p ON si.ProductID = p.ID
                WHERE si.SaleID = ?
            `).all(saleID);

            // Fetch customer info if AccountID exists
            const saleRow = db.prepare('SELECT AccountID FROM Sales WHERE ID = ?').get(saleID);
            let customerInfo = { name: 'Müşteri', address: '', phone: '' };
            if (saleRow?.AccountID) {
                const account = db.prepare('SELECT Name, Address, Phone FROM Accounts WHERE ID = ?').get(saleRow.AccountID);
                if (account) {
                    customerInfo = {
                        name: account.Name || 'Müşteri',
                        address: account.Address || '',
                        phone: account.Phone || '',
                    };
                }
            }

            const deliveryPayload = {
                saleId: Number(saleID),
                deliveryId: Number(saleID),
                totalAmount: totalAmount,
                paymentMethod: paymentMethod || 'Cash',
                customer: customerInfo,
                items: saleItems,
                assignedAt: new Date().toISOString(),
            };

            if (targetSocketId) {
                const courierNsp = io.of('/couriers');
                courierNsp.to(targetSocketId).emit('delivery_started', deliveryPayload);
                console.log(`📦 Assigned Sale #${saleID} to Courier ID: ${courierID} (Socket: ${targetSocketId})`);
            } else {
                // Fallback: broadcast to all couriers namespace — courier will filter by their ID
                console.warn(`⚠️ Courier ID ${courierID} socket not found, broadcasting to namespace`);
                io.of('/couriers').emit('delivery_started', deliveryPayload);
            }

            // Update courier status to Delivering
            db.prepare('UPDATE Couriers SET Status = ? WHERE ID = ?').run('Delivering', courierID);
            io.of('/couriers').emit('status:changed', { courierID: Number(courierID), status: 'Delivering' });
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

// GET /api/sales/unassigned — get unassigned orders
router.get('/unassigned', async (req, res) => {
    try {
        const db = getDb();
        if (!db) return res.status(503).json({ error: 'Database not available' });

        const rows = db.prepare(`
            SELECT 
                s.ID, s.TotalAmount, s.PaymentMethod, s.CreatedAt, s.CourierID,
            a.Name as CustomerName, a.Address, a.Phone,
            GROUP_CONCAT(p.Name || ' (' || si.Qty || ')', ', ') as ItemsSummary
            FROM Sales s
            LEFT JOIN Accounts a ON s.AccountID = a.ID
            LEFT JOIN SaleItems si ON si.SaleID = s.ID
            LEFT JOIN Products p ON si.ProductID = p.ID
            WHERE s.CourierID IS NULL 
            GROUP BY s.ID
            ORDER BY s.CreatedAt DESC
            `).all();

        res.json(rows);
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
            COUNT(s.ID) as orders
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
