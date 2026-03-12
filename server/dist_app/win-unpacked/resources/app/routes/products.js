import { Router } from 'express';
import { getDb } from '../config/db.js';
import sql from 'mssql';

const router = Router();

// ── Mock data helper ─────────────────────────────────────────
function getMockProducts() {
    const mockProducts = [];
    let idCounter = 1;
    const categories = [
        { name: 'Hot Drinks', basePrice: 15, items: ['Espresso', 'Americano', 'Latte', 'Cappuccino', 'Mocha', 'Macchiato', 'Flat White', 'Cortado', 'Affogato', 'Irish Coffee', 'Turkish Coffee', 'Filter Coffee', 'Hot Chocolate', 'White Hot Chocolate', 'Chai Tea Latte', 'Earl Grey Tea', 'Green Tea', 'Herbal Tea', 'Black Tea', 'Winter Tea'] },
        { name: 'Desserts', basePrice: 30, items: ['Cheesecake', 'Tiramisu', 'Brownie', 'Apple Pie', 'Chocolate Cake', 'Carrot Cake', 'Red Velvet', 'Profiterole', 'Macaron', 'Muffin', 'Cookie', 'Waffle', 'Pancakes', 'Crepe', 'Ice Cream', 'Baklava', 'Rice Pudding', 'Magnolia', 'Souffle', 'Tart'] },
        { name: 'Food', basePrice: 40, items: ['Club Sandwich', 'Tuna Sandwich', 'Chicken Wrap', 'Meatball Wrap', 'Caesar Salad', 'Quinoa Salad', 'Toast', 'Bagel', 'Croissant', 'Pizza Slice', 'Hamburger', 'Cheeseburger', 'French Fries', 'Chicken Nuggets', 'Onion Rings', 'Pasta', 'Soup', 'Omelette', 'Menemen', 'Avocado Toast'] }
    ];

    categories.forEach((cat, catIdx) => {
        cat.items.forEach((item, itemIdx) => {
            const primaryBarcode = '86900' + (catIdx + 1) + itemIdx.toString().padStart(3, '0');
            const barcodes = [primaryBarcode];
            if (itemIdx % 3 === 0) {
                barcodes.push('ALT' + primaryBarcode);
            }
            mockProducts.push({
                ID: idCounter++,
                Name: item,
                Stock: Math.floor(Math.random() * 100) + 10,
                CostPrice: cat.basePrice * 0.4,
                SalePrice: cat.basePrice + (Math.random() * 10),
                Category: cat.name,
                ImageURL: null,
                Barcodes: barcodes
            });
        });
    });

    return mockProducts;
}

// ── GET /api/products — list all products with barcodes ──────
router.get('/', async (req, res) => {
    try {
        const pool = await getDb();
        if (!pool) {
            if (process.env.USE_MOCK_DATA === 'true') {
                console.warn("⚠️ DB not available, returning mock products");
                return res.json(getMockProducts());
            }
            return res.status(503).json({ error: 'Database not available' });
        }
        const result = await pool.request().query(`
            SELECT p.*, pb.BarcodesCsv
            FROM Products p
            LEFT JOIN (
                SELECT ProductID, STRING_AGG(CAST(Barcode AS NVARCHAR(MAX)), ',') AS BarcodesCsv
                FROM ProductBarcodes
                GROUP BY ProductID
            ) pb ON pb.ProductID = p.ID
            WHERE COALESCE(p.IsDeleted, 0) = 0
            ORDER BY p.Name
        `);
        const products = result.recordset.map(row => ({
            ...row,
            Barcodes: row.BarcodesCsv ? row.BarcodesCsv.split(',') : [],
            BarcodesCsv: undefined
        }));
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/products/low-stock — products below critical stock ──
router.get('/low-stock', async (req, res) => {
    try {
        const pool = await getDb();
        if (!pool) return res.status(503).json({ error: 'Database not available' });

        const result = await pool.request().query(`
            SELECT p.*, pb.BarcodesCsv
            FROM Products p
            LEFT JOIN (
                SELECT ProductID, STRING_AGG(CAST(Barcode AS NVARCHAR(MAX)), ',') AS BarcodesCsv
                FROM ProductBarcodes
                GROUP BY ProductID
            ) pb ON pb.ProductID = p.ID
            WHERE p.Stock <= p.CriticalStock
              AND COALESCE(p.IsDeleted, 0) = 0
            ORDER BY CAST(p.Stock AS FLOAT) / IIF(p.CriticalStock > 1, p.CriticalStock, 1) ASC
        `);

        const products = result.recordset.map(row => ({
            ...row,
            Barcodes: row.BarcodesCsv ? row.BarcodesCsv.split(',') : [],
            BarcodesCsv: undefined
        }));
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/products/barcode/:barcode — lookup by any barcode ──
router.get('/barcode/:barcode', async (req, res) => {
    try {
        const pool = await getDb();
        if (!pool) {
            if (process.env.USE_MOCK_DATA === 'true') {
                const products = getMockProducts();
                const found = products.find(p => p.Barcodes.includes(req.params.barcode));
                if (!found) return res.status(404).json({ error: 'Product not found' });
                return res.json(found);
            }
            return res.status(503).json({ error: 'Database not available' });
        }
        const result = await pool.request()
            .input('barcode', sql.NVarChar, req.params.barcode)
            .query(`
            SELECT p.*, pb2.BarcodesCsv
            FROM Products p
            JOIN ProductBarcodes pb ON pb.ProductID = p.ID AND pb.Barcode = @barcode
            LEFT JOIN (
                SELECT ProductID, STRING_AGG(CAST(Barcode AS NVARCHAR(MAX)), ',') AS BarcodesCsv
                FROM ProductBarcodes
                GROUP BY ProductID
            ) pb2 ON pb2.ProductID = p.ID
            WHERE COALESCE(p.IsDeleted, 0) = 0
        `);
        if (result.recordset.length === 0) return res.status(404).json({ error: 'Product not found' });
        const row = result.recordset[0];
        res.json({ ...row, Barcodes: row.BarcodesCsv ? row.BarcodesCsv.split(',') : [], BarcodesCsv: undefined });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/products — create product with multiple barcodes ──
router.post('/', async (req, res) => {
    try {
        const { Barcodes, Name, Stock, CostPrice, SalePrice, Price2, Category, ImageURL, ShowInPos, isIngredient } = req.body;
        const barcodeList = Array.isArray(Barcodes) ? Barcodes : (Barcodes ? [Barcodes] : []);

        const pool = await getDb();
        if (!pool) return res.status(503).json({ error: 'Database not available' });

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            const reqProduct = new sql.Request(transaction);
            const insertResult = await reqProduct
                .input('Name', sql.NVarChar, Name)
                .input('Stock', sql.Float, Stock || 0)
                .input('CostPrice', sql.Float, CostPrice || 0)
                .input('SalePrice', sql.Float, SalePrice || 0)
                .input('Price2', sql.Float, Price2 || 0)
                .input('Category', sql.NVarChar, Category || null)
                .input('ImageURL', sql.NVarChar, ImageURL || null)
                .input('ShowInPos', sql.Int, ShowInPos !== undefined ? ShowInPos : 1)
                // Assuming isIngredient field is available inside Products, if not we fall back to not saving it in order to preserve existing schema.
                // NOTE: Previous SQLite code didn't save this. 
                .query(`
                    INSERT INTO Products(Name, Stock, CostPrice, SalePrice, Price2, Category, ImageURL, ShowInPos)
                    OUTPUT INSERTED.ID
            VALUES(@Name, @Stock, @CostPrice, @SalePrice, @Price2, @Category, @ImageURL, @ShowInPos)
                `);

            const productId = insertResult.recordset[0].ID;

            for (const barcode of barcodeList) {
                const reqBarcode = new sql.Request(transaction);
                await reqBarcode
                    .input('ProductID', sql.Int, productId)
                    .input('Barcode', sql.NVarChar, barcode)
                    .query('INSERT INTO ProductBarcodes (ProductID, Barcode) VALUES (@ProductID, @Barcode)');
            }

            await transaction.commit();

            const getResult = await pool.request()
                .input('id', sql.Int, productId)
                .query('SELECT * FROM Products WHERE ID = @id');
            const product = getResult.recordset[0];

            res.status(201).json({ ...product, Barcodes: barcodeList });
        } catch (innerErr) {
            await transaction.rollback();
            if (innerErr.message.includes('UNIQUE') || innerErr.message.includes('IX_ProductBarcodes_Barcode')) {
                return res.status(409).json({ error: 'Bu barkod zaten kullanılıyor' });
            }
            throw innerErr;
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── PUT /api/products/:id — update product + replace barcodes ──
router.put('/:id', async (req, res) => {
    try {
        const { Barcodes, Name, Stock, CostPrice, SalePrice, Price2, Category, ImageURL, ShowInPos, isIngredient } = req.body;
        const barcodeList = Array.isArray(Barcodes) ? Barcodes : (Barcodes ? [Barcodes] : []);

        const pool = await getDb();
        if (!pool) return res.status(503).json({ error: 'Database not available' });

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            const reqUpdate = new sql.Request(transaction);
            const updateResult = await reqUpdate
                .input('Name', sql.NVarChar, Name)
                .input('Stock', sql.Float, Stock || 0)
                .input('CostPrice', sql.Float, CostPrice || 0)
                .input('SalePrice', sql.Float, SalePrice || 0)
                .input('Price2', sql.Float, Price2 || 0)
                .input('Category', sql.NVarChar, Category || null)
                .input('ImageURL', sql.NVarChar, ImageURL || null)
                .input('ShowInPos', sql.Int, ShowInPos !== undefined ? ShowInPos : 1)
                .input('id', sql.Int, req.params.id)
                .query(`
                    UPDATE Products
                    SET Name = @Name, Stock = @Stock, CostPrice = @CostPrice, SalePrice = @SalePrice, Price2 = @Price2, Category = @Category, ImageURL = @ImageURL, ShowInPos = @ShowInPos
                    WHERE ID = @id
                `);

            if (updateResult.rowsAffected[0] === 0) {
                await transaction.rollback();
                return res.status(404).json({ error: 'Product not found' });
            }

            const reqDel = new sql.Request(transaction);
            await reqDel
                .input('id', sql.Int, req.params.id)
                .query('DELETE FROM ProductBarcodes WHERE ProductID = @id');

            for (const barcode of barcodeList) {
                const reqBarcode = new sql.Request(transaction);
                await reqBarcode
                    .input('ProductID', sql.Int, req.params.id)
                    .input('Barcode', sql.NVarChar, barcode)
                    .query('INSERT INTO ProductBarcodes (ProductID, Barcode) VALUES (@ProductID, @Barcode)');
            }

            await transaction.commit();

            const getResult = await pool.request()
                .input('id', sql.Int, req.params.id)
                .query('SELECT * FROM Products WHERE ID = @id');
            const product = getResult.recordset[0];

            res.json({ ...product, Barcodes: barcodeList });
        } catch (innerErr) {
            await transaction.rollback();
            if (innerErr.message.includes('UNIQUE') || innerErr.message.includes('IX_ProductBarcodes_Barcode')) {
                return res.status(409).json({ error: 'Bu barkod zaten kullanılıyor' });
            }
            throw innerErr;
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── DELETE /api/products/:id — delete product (soft delete if used in history) ──
router.delete('/:id', async (req, res) => {
    try {
        const pool = await getDb();
        if (!pool) return res.status(503).json({ error: 'Database not available' });

        const id = req.params.id;

        // Check if product is referenced in sales or invoices
        const saleUsageResult = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT COUNT(*) AS cnt FROM SaleItems WHERE ProductID = @id');
        const invoiceUsageResult = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT COUNT(*) AS cnt FROM InvoiceItems WHERE ProductID = @id');

        const usedInHistory = (saleUsageResult.recordset[0]?.cnt || 0) > 0 || (invoiceUsageResult.recordset[0]?.cnt || 0) > 0;

        if (usedInHistory) {
            // Soft delete: keep history intact, hide product from UI
            const transaction = new sql.Transaction(pool);
            await transaction.begin();

            try {
                const reqSoftDel = new sql.Request(transaction);
                const softDelResult = await reqSoftDel
                    .input('id', sql.Int, id)
                    .query('UPDATE Products SET IsDeleted = 1 WHERE ID = @id');

                const reqDelBarcode = new sql.Request(transaction);
                await reqDelBarcode
                    .input('id', sql.Int, id)
                    .query('DELETE FROM ProductBarcodes WHERE ProductID = @id');

                await transaction.commit();

                if (softDelResult.rowsAffected[0] === 0) {
                    return res.status(404).json({ error: 'Ürün bulunamadı' });
                }

                return res.json({ success: true, softDeleted: true });
            } catch (txErr) {
                await transaction.rollback();
                throw txErr;
            }
        }

        // Hard delete if never used
        const delResult = await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM Products WHERE ID = @id');

        if (delResult.rowsAffected[0] === 0) {
            return res.status(404).json({ error: 'Ürün bulunamadı' });
        }

        res.json({ success: true, softDeleted: false });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── PUT /api/products/:id/stock — adjust stock ──
router.put('/:id/stock', async (req, res) => {
    try {
        const { stock } = req.body;
        const pool = await getDb();
        if (!pool) return res.status(503).json({ error: 'Database not available' });
        await pool.request()
            .input('stock', sql.Float, stock)
            .input('id', sql.Int, req.params.id)
            .query('UPDATE Products SET Stock = @stock WHERE ID = @id');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/products/:id/dashboard — product details and chart stats ──
router.get('/:id/dashboard', async (req, res) => {
    try {
        const id = req.params.id;
        const pool = await getDb();
        if (!pool) return res.status(503).json({ error: 'Database not available' });

        const productResult = await pool.request()
            .input('id', sql.Int, id)
            .query(`
            SELECT p.*, pb.BarcodesCsv
            FROM Products p
            LEFT JOIN (
                SELECT ProductID, STRING_AGG(CAST(Barcode AS NVARCHAR(MAX)), ',') AS BarcodesCsv
                FROM ProductBarcodes
                GROUP BY ProductID
            ) pb ON pb.ProductID = p.ID
            WHERE p.ID = @id AND COALESCE(p.IsDeleted, 0) = 0
        `);

        if (productResult.recordset.length === 0) return res.status(404).json({ error: 'Product not found' });
        const product = productResult.recordset[0];
        product.Barcodes = product.BarcodesCsv ? product.BarcodesCsv.split(',') : [];
        product.BarcodesCsv = undefined;

        // Son 6 ayın etiketlerini üret (YYYY-MM)
        const monthLabels = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            monthLabels.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
        }

        const statsResult = await pool.request()
            .input('id', sql.Int, id)
            .query(`
            SELECT
            'sale' as type, FORMAT(s.CreatedAt, 'yyyy-MM') as month, SUM(si.Qty) as qty
            FROM SaleItems si JOIN Sales s ON s.ID = si.SaleID
            WHERE si.ProductID = @id AND s.CreatedAt >= DATEADD(month, DATEDIFF(month, 0, GETDATE()) - 5, 0)
            GROUP BY FORMAT(s.CreatedAt, 'yyyy-MM')
            UNION ALL
            SELECT
            'purchase' as type, FORMAT(i.CreatedAt, 'yyyy-MM') as month, SUM(ii.Qty) as qty
            FROM InvoiceItems ii JOIN Invoices i ON i.ID = ii.InvoiceID
            WHERE ii.ProductID = @id AND i.CreatedAt >= DATEADD(month, DATEDIFF(month, 0, GETDATE()) - 5, 0)
            GROUP BY FORMAT(i.CreatedAt, 'yyyy-MM')
                `);
        const statsRaw = statsResult.recordset;

        const chartData = monthLabels.map(m => {
            const sRow = statsRaw.find(r => r.type === 'sale' && r.month === m);
            const pRow = statsRaw.find(r => r.type === 'purchase' && r.month === m);

            // Ay isimlerini Türkçeleştirmek için:
            const [year, month] = m.split('-');
            const dateObj = new Date(year, month - 1);
            const monthName = dateObj.toLocaleString('tr-TR', { month: 'short' });

            return {
                rawMonth: m,
                monthName: monthName + ' ' + year.slice(-2),
                salesQty: sRow ? sRow.qty : 0,
                purchaseQty: pRow ? pRow.qty : 0
            };
        });

        const metricsResult = await pool.request()
            .input('id', sql.Int, id)
            .query(`
            SELECT
                (SELECT COALESCE(SUM(si.Qty), 0) FROM SaleItems si WHERE si.ProductID = @id) as totalSalesQty,
                (SELECT COALESCE(SUM(si.Qty * si.UnitPrice), 0) FROM SaleItems si WHERE si.ProductID = @id) as totalSalesRevenue,
            (SELECT MAX(s.CreatedAt) FROM SaleItems si JOIN Sales s ON s.ID = si.SaleID WHERE si.ProductID = @id) as lastSaleDate,
        (SELECT COALESCE(SUM(ii.Qty), 0) FROM InvoiceItems ii WHERE ii.ProductID = @id) as totalPurchaseQty,
            (SELECT COALESCE(SUM(ii.Qty * ii.UnitPrice), 0) FROM InvoiceItems ii WHERE ii.ProductID = @id) as totalPurchaseCost,
                (SELECT MAX(i.CreatedAt) FROM InvoiceItems ii JOIN Invoices i ON i.ID = ii.InvoiceID WHERE ii.ProductID = @id) as lastPurchaseDate
        `);
        const metrics = metricsResult.recordset[0];

        const movementsResult = await pool.request()
            .input('id', sql.Int, id)
            .query(`
            SELECT TOP 50 * FROM(
                SELECT 
                    'Satış' as Type,
                    s.CreatedAt as Date,
                    si.Qty as Qty,
                    si.UnitPrice as Price,
                    s.ID as RefID,
                    'Satış #' + CAST(s.ID AS NVARCHAR(255)) as RefNo,
                    a.Name as Counterparty
                FROM SaleItems si
                JOIN Sales s ON s.ID = si.SaleID
                LEFT JOIN Accounts a ON a.ID = s.AccountID
                WHERE si.ProductID = @id
                
                UNION ALL
                
                SELECT 
                    'Alım' as Type,
                    i.CreatedAt as Date,
                    ii.Qty as Qty,
                    ii.UnitPrice as Price,
                    i.ID as RefID,
                    i.InvoiceNo as RefNo,
                    i.Counterparty as Counterparty
                FROM InvoiceItems ii
                JOIN Invoices i ON i.ID = ii.InvoiceID
                WHERE ii.ProductID = @id
            ) as Movements
            ORDER BY Date DESC
        `);
        const movements = movementsResult.recordset;

        res.json({ product, chartData, metrics, movements });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
