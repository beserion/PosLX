import { Router } from 'express';
import { getDb } from '../config/db.js';
import { io } from '../index.js';
import { courierSockets } from '../sockets/courierSocket.js';
import sql from 'mssql';

const router = Router();

// POST /api/sales — create a sale with items (transaction)
router.post('/', async (req, res) => {
    try {
        const { items, paymentMethod, tax, discount, serviceFee, courierID } = req.body;
        const pool = await getDb();
        if (!pool) {
            if (process.env.USE_MOCK_DATA === 'true') {
                console.warn("⚠️ DB not available, mocking sale creation");
                return res.json({ success: true, saleID: Math.floor(Math.random() * 1000) });
            }
            return res.status(503).json({ error: 'Database not available' });
        }

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        let saleID;
        let totalAmount;
        try {
            let calculatedTotal = 0;

            // First pass: determine actual unit prices with special prices
            const pricedItems = [];
            for (const i of items) {
                const reqProd = new sql.Request(transaction);
                const prodResult = await reqProd
                    .input('productID', sql.Int, i.productID)
                    .query('SELECT ID, SalePrice, Price2 FROM Products WHERE ID = @productID');
                const prod = prodResult.recordset.length > 0 ? prodResult.recordset[0] : null;

                const reqSpecial = new sql.Request(transaction);
                const spResult = await reqSpecial
                    .input('productID', sql.Int, i.productID)
                    .query(`
                        SELECT TOP 1 SpecialPrice
                        FROM SpecialPrices
                        WHERE ProductID = @productID
                          AND AccountID IS NULL
                          AND IsActive = 1
                          AND (StartDate IS NULL OR CAST(StartDate AS DATE) <= CAST(GETDATE() AS DATE))
                          AND (EndDate   IS NULL OR CAST(EndDate AS DATE)   >= CAST(GETDATE() AS DATE))
                        ORDER BY
                          CASE WHEN StartDate IS NULL THEN 1 ELSE 0 END,
                          StartDate DESC,
                          ID DESC
                    `);
                const sp = spResult.recordset.length > 0 ? spResult.recordset[0] : null;

                let finalPrice = i.unitPrice;
                if (prod) {
                    finalPrice = prod.SalePrice;
                    if (sp && sp.SpecialPrice !== null && sp.SpecialPrice >= 0) {
                        finalPrice = sp.SpecialPrice;
                    }
                    if (courierID && prod.Price2 > 0) {
                        finalPrice = prod.Price2; // Kurye fiyatı her zaman önceliklidir
                    }
                }
                console.log(`Debug Sale item: ID=${i.productID}, prod?=${!!prod}, courierID=${courierID}, SalePrice=${prod?.SalePrice}, Price2=${prod?.Price2}, SpecialPrice=${sp?.SpecialPrice}, finalPrice=${finalPrice}`);
                const lineTotal = finalPrice * i.qty;
                calculatedTotal += lineTotal;
                pricedItems.push({ ...i, unitPrice: finalPrice });
            }

            totalAmount = calculatedTotal + (serviceFee || 0) - (discount || 0);

            const reqSale = new sql.Request(transaction);
            const courierIdType = courierID ? sql.Int : sql.Int;
            const insertSaleResult = await reqSale
                .input('TotalAmount', sql.Float, totalAmount)
                .input('Tax', sql.Float, tax || 0)
                .input('Discount', sql.Float, discount || 0)
                .input('ServiceFee', sql.Float, serviceFee || 0)
                .input('PaymentMethod', sql.NVarChar, paymentMethod || 'Cash')
                .input('CourierID', courierIdType, courierID || null)
                .query(`
                    INSERT INTO Sales (TotalAmount, Tax, Discount, ServiceFee, PaymentMethod, CourierID)
                    OUTPUT INSERTED.ID
                    VALUES (@TotalAmount, @Tax, @Discount, @ServiceFee, @PaymentMethod, @CourierID)
                `);
            saleID = insertSaleResult.recordset[0].ID;

            for (const item of pricedItems) {
                const reqItem = new sql.Request(transaction);
                await reqItem
                    .input('SaleID', sql.Int, saleID)
                    .input('ProductID', sql.Int, item.productID)
                    .input('Qty', sql.Float, item.qty)
                    .input('UnitPrice', sql.Float, item.unitPrice)
                    .query(`
                        INSERT INTO SaleItems (SaleID, ProductID, Qty, UnitPrice)
                        VALUES (@SaleID, @ProductID, @Qty, @UnitPrice)
                    `);

                const reqStock = new sql.Request(transaction);
                await reqStock
                    .input('Qty', sql.Float, item.qty)
                    .input('ProductID', sql.Int, item.productID)
                    .query('UPDATE Products SET Stock = Stock - @Qty WHERE ID = @ProductID');
            }

            // Record account transaction
            const reqAccTx = new sql.Request(transaction);
            await reqAccTx
                .input('Amount', sql.Float, totalAmount)
                .input('Description', sql.NVarChar, 'Satış #' + saleID)
                .input('SaleID', sql.Int, saleID)
                .input('PaymentMethod', sql.NVarChar, paymentMethod || 'Cash')
                .query(`
                    INSERT INTO AccountTransactions(Type, Amount, Description, SaleID, PaymentMethod)
                    VALUES('Sale', @Amount, @Description, @SaleID, @PaymentMethod)
                        `);

            await transaction.commit();
        } catch (txErr) {
            console.error('Sale Creation Error:', txErr);
            try {
                await transaction.rollback();
            } catch (rollbackErr) {
                console.error('Rollback failed:', rollbackErr.message);
            }
            throw txErr;
        }

        // -------------------------------------------------------------
        // POSLx-Kurye (Courier APK) Delivery Assignment Socket Dispatch
        // -------------------------------------------------------------
        if (courierID) {
            // Map table ID (Int) to String for map lookup
            const targetSocketId = courierSockets.get(courierID) || courierSockets.get(String(courierID)) || courierSockets.get(Number(courierID));

            // Fetch sale items with product names
            const saleItemsResult = await pool.request()
                .input('saleID', sql.Int, saleID)
                .query(`
                SELECT p.Name as name, si.Qty as qty, si.UnitPrice as price
                FROM SaleItems si
                JOIN Products p ON si.ProductID = p.ID
                WHERE si.SaleID = @saleID
                    `);
            const saleItems = saleItemsResult.recordset;

            // Fetch customer info if AccountID exists
            const saleRowResult = await pool.request()
                .input('saleID', sql.Int, saleID)
                .query('SELECT AccountID FROM Sales WHERE ID = @saleID');
            const saleRow = saleRowResult.recordset[0];

            let customerInfo = { name: 'Müşteri', address: '', phone: '' };
            if (saleRow?.AccountID) {
                const accountResult = await pool.request()
                    .input('AccountID', sql.Int, saleRow.AccountID)
                    .query('SELECT Name, Address, Phone FROM Accounts WHERE ID = @AccountID');
                const account = accountResult.recordset.length > 0 ? accountResult.recordset[0] : null;
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
                console.log('📦 Assigned Sale #' + saleID + ' to Courier ID: ' + courierID + ' (Socket: ' + targetSocketId + ')');
            } else {
                // Fallback: broadcast to all couriers namespace — courier will filter by their ID
                console.warn('⚠️ Courier ID ' + courierID + ' socket not found, broadcasting to namespace');
                io.of('/couriers').emit('delivery_started', deliveryPayload);
            }

            // Update courier status to Delivering
            await pool.request()
                .input('courierID', sql.Int, courierID)
                .query("UPDATE Couriers SET Status = 'Delivering' WHERE ID = @courierID");
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
        const pool = await getDb();
        if (!pool) {
            if (process.env.USE_MOCK_DATA === 'true') {
                console.warn("⚠️ DB not available, returning mock sales summary");
                return res.json({ TotalSales: 45, TotalRevenue: 15200.5, NetProfit: 6300.25 });
            }
            return res.status(503).json({ error: 'Database not available' });
        }
        const result = await pool.request().query(`
            SELECT
                COUNT(DISTINCT s.ID) AS TotalSales,
                    COALESCE(SUM(s.TotalAmount), 0) AS TotalRevenue,
                    COALESCE(SUM(s.TotalAmount) - SUM(si.Qty * p.CostPrice), 0) AS NetProfit
            FROM Sales s
            JOIN SaleItems si ON si.SaleID = s.ID
            JOIN Products p ON p.ID = si.ProductID
                    `);
        res.json(result.recordset[0] || { TotalSales: 0, TotalRevenue: 0, NetProfit: 0 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/sales/unassigned — get unassigned orders
router.get('/unassigned', async (req, res) => {
    try {
        const pool = await getDb();
        if (!pool) return res.status(503).json({ error: 'Database not available' });

        const result = await pool.request().query(`
            SELECT 
                s.ID, s.TotalAmount, s.PaymentMethod, s.CreatedAt, s.CourierID,
                a.Name as CustomerName, a.Address, a.Phone,
                si.ItemsSummary
            FROM Sales s
            LEFT JOIN Accounts a ON s.AccountID = a.ID
            LEFT JOIN (
                SELECT si.SaleID, STRING_AGG(CAST(p.Name + ' (' + CAST(si.Qty AS NVARCHAR(MAX)) + ')' AS NVARCHAR(MAX)), ', ') AS ItemsSummary
                FROM SaleItems si
                JOIN Products p ON si.ProductID = p.ID
                GROUP BY si.SaleID
            ) si ON si.SaleID = s.ID
            WHERE s.CourierID IS NULL 
            ORDER BY s.CreatedAt DESC
        `);

        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/sales/courier-performance — get stats for dashboard
router.get('/courier-performance', async (req, res) => {
    try {
        const pool = await getDb();
        if (!pool) return res.status(503).json({ error: 'Database not available' });

        const result = await pool.request().query(`
            SELECT 
                c.Name as name,
                    COUNT(s.ID) as orders
            FROM Couriers c
            LEFT JOIN Sales s ON s.CourierID = c.ID AND CAST(s.CreatedAt AS DATE) = CAST(GETDATE() AS DATE)
            GROUP BY c.ID, c.Name
            ORDER BY orders DESC
                    `);

        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
