import { Router } from 'express';
import { getDb } from '../config/db.js';

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
            const primaryBarcode = `86900${catIdx + 1}${itemIdx.toString().padStart(3, '0')}`;
            const barcodes = [primaryBarcode];
            if (itemIdx % 3 === 0) {
                barcodes.push(`ALT${primaryBarcode}`);
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
        const db = getDb();
        if (!db) {
            if (process.env.USE_MOCK_DATA === 'true') {
                console.warn("⚠️ DB not available, returning mock products");
                return res.json(getMockProducts());
            }
            return res.status(503).json({ error: 'Database not available' });
        }
        const rows = db.prepare(`
            SELECT p.*, GROUP_CONCAT(pb.Barcode) AS BarcodesCsv
            FROM Products p
            LEFT JOIN ProductBarcodes pb ON pb.ProductID = p.ID
            WHERE IFNULL(p.IsDeleted, 0) = 0
            GROUP BY p.ID
            ORDER BY p.Name
        `).all();
        const products = rows.map(row => ({
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
        const db = getDb();
        if (!db) return res.status(503).json({ error: 'Database not available' });

        const rows = db.prepare(`
            SELECT p.*, GROUP_CONCAT(pb.Barcode) AS BarcodesCsv
            FROM Products p
            LEFT JOIN ProductBarcodes pb ON pb.ProductID = p.ID
            WHERE p.Stock <= p.CriticalStock
              AND IFNULL(p.IsDeleted, 0) = 0
            GROUP BY p.ID
            ORDER BY CAST(p.Stock AS REAL) / MAX(p.CriticalStock, 1) ASC
        `).all();

        const products = rows.map(row => ({
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
        const db = getDb();
        if (!db) {
            if (process.env.USE_MOCK_DATA === 'true') {
                const products = getMockProducts();
                const found = products.find(p => p.Barcodes.includes(req.params.barcode));
                if (!found) return res.status(404).json({ error: 'Product not found' });
                return res.json(found);
            }
            return res.status(503).json({ error: 'Database not available' });
        }
        const row = db.prepare(`
            SELECT p.*, GROUP_CONCAT(pb2.Barcode) AS BarcodesCsv
            FROM Products p
            JOIN ProductBarcodes pb ON pb.ProductID = p.ID AND pb.Barcode = ?
            LEFT JOIN ProductBarcodes pb2 ON pb2.ProductID = p.ID
            WHERE IFNULL(p.IsDeleted, 0) = 0
            GROUP BY p.ID
        `).get(req.params.barcode);
        if (!row) return res.status(404).json({ error: 'Product not found' });
        res.json({ ...row, Barcodes: row.BarcodesCsv ? row.BarcodesCsv.split(',') : [], BarcodesCsv: undefined });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/products — create product with multiple barcodes ──
router.post('/', async (req, res) => {
    try {
        const { Barcodes, Name, Stock, CostPrice, SalePrice, Category, ImageURL, ShowInPos } = req.body;
        const barcodeList = Array.isArray(Barcodes) ? Barcodes : (Barcodes ? [Barcodes] : []);

        const db = getDb();
        if (!db) return res.status(503).json({ error: 'Database not available' });

        const insertProduct = db.prepare(
            `INSERT INTO Products (Name, Stock, CostPrice, SalePrice, Category, ImageURL, ShowInPos)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
        );
        const insertBarcode = db.prepare(
            'INSERT INTO ProductBarcodes (ProductID, Barcode) VALUES (?, ?)'
        );
        const getProduct = db.prepare('SELECT * FROM Products WHERE ID = ?');

        const createTx = db.transaction(() => {
            const info = insertProduct.run(Name, Stock || 0, CostPrice || 0, SalePrice || 0, Category || null, ImageURL || null, ShowInPos !== undefined ? ShowInPos : 1);
            const productId = info.lastInsertRowid;
            for (const barcode of barcodeList) {
                insertBarcode.run(productId, barcode);
            }
            return getProduct.get(productId);
        });

        try {
            const product = createTx();
            res.status(201).json({ ...product, Barcodes: barcodeList });
        } catch (innerErr) {
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
        const { Barcodes, Name, Stock, CostPrice, SalePrice, Category, ImageURL, ShowInPos } = req.body;
        const barcodeList = Array.isArray(Barcodes) ? Barcodes : (Barcodes ? [Barcodes] : []);

        const db = getDb();
        if (!db) return res.status(503).json({ error: 'Database not available' });

        const updateProduct = db.prepare(
            `UPDATE Products
             SET Name = ?, Stock = ?, CostPrice = ?, SalePrice = ?, Category = ?, ImageURL = ?, ShowInPos = ?
             WHERE ID = ?`
        );
        const deleteBarcodes = db.prepare('DELETE FROM ProductBarcodes WHERE ProductID = ?');
        const insertBarcode = db.prepare('INSERT INTO ProductBarcodes (ProductID, Barcode) VALUES (?, ?)');
        const getProduct = db.prepare('SELECT * FROM Products WHERE ID = ?');

        const updateTx = db.transaction(() => {
            const info = updateProduct.run(Name, Stock || 0, CostPrice || 0, SalePrice || 0, Category || null, ImageURL || null, ShowInPos !== undefined ? ShowInPos : 1, req.params.id);
            if (info.changes === 0) return null;
            deleteBarcodes.run(req.params.id);
            for (const barcode of barcodeList) {
                insertBarcode.run(req.params.id, barcode);
            }
            return getProduct.get(req.params.id);
        });

        try {
            const product = updateTx();
            if (!product) return res.status(404).json({ error: 'Product not found' });
            res.json({ ...product, Barcodes: barcodeList });
        } catch (innerErr) {
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
        const db = getDb();
        if (!db) return res.status(503).json({ error: 'Database not available' });

        const id = req.params.id;

        // Check if product is referenced in sales or invoices
        const saleUsage = db
            .prepare('SELECT COUNT(*) AS cnt FROM SaleItems WHERE ProductID = ?')
            .get(id);
        const invoiceUsage = db
            .prepare('SELECT COUNT(*) AS cnt FROM InvoiceItems WHERE ProductID = ?')
            .get(id);

        const usedInHistory = (saleUsage?.cnt || 0) > 0 || (invoiceUsage?.cnt || 0) > 0;

        if (usedInHistory) {
            // Soft delete: keep history intact, hide product from UI
            const tx = db.transaction(() => {
                // Mark product as deleted
                const info = db
                    .prepare('UPDATE Products SET IsDeleted = 1 WHERE ID = ?')
                    .run(id);
                // Free barcodes so they can be reused
                db.prepare('DELETE FROM ProductBarcodes WHERE ProductID = ?').run(id);
                return info;
            });

            const info = tx();
            if (info.changes === 0) {
                return res.status(404).json({ error: 'Ürün bulunamadı' });
            }

            return res.json({ success: true, softDeleted: true });
        }

        // Hard delete if never used
        const info = db.prepare('DELETE FROM Products WHERE ID = ?').run(id);
        if (info.changes === 0) {
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
        const db = getDb();
        if (!db) return res.status(503).json({ error: 'Database not available' });
        db.prepare('UPDATE Products SET Stock = ? WHERE ID = ?').run(stock, req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/products/:id/dashboard — product details and chart stats ──
router.get('/:id/dashboard', async (req, res) => {
    try {
        const id = req.params.id;
        const db = getDb();
        if (!db) return res.status(503).json({ error: 'Database not available' });

        const product = db.prepare(`
            SELECT p.*, GROUP_CONCAT(pb.Barcode) AS BarcodesCsv
            FROM Products p
            LEFT JOIN ProductBarcodes pb ON pb.ProductID = p.ID
            WHERE p.ID = ? AND IFNULL(p.IsDeleted, 0) = 0
            GROUP BY p.ID
        `).get(id);

        if (!product) return res.status(404).json({ error: 'Product not found' });
        product.Barcodes = product.BarcodesCsv ? product.BarcodesCsv.split(',') : [];
        product.BarcodesCsv = undefined;

        // Son 6 ayın etiketlerini üret (YYYY-MM)
        const monthLabels = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            monthLabels.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
        }

        const statsRaw = db.prepare(`
            SELECT 
              'sale' as type, strftime('%Y-%m', s.CreatedAt) as month, SUM(si.Qty) as qty
            FROM SaleItems si JOIN Sales s ON s.ID = si.SaleID
            WHERE si.ProductID = ? AND s.CreatedAt >= date('now', '-5 months', 'start of month')
            GROUP BY month
            UNION ALL
            SELECT 
              'purchase' as type, strftime('%Y-%m', i.CreatedAt) as month, SUM(ii.Qty) as qty
            FROM InvoiceItems ii JOIN Invoices i ON i.ID = ii.InvoiceID
            WHERE ii.ProductID = ? AND i.CreatedAt >= date('now', '-5 months', 'start of month')
            GROUP BY month
        `).all(id, id);

        const chartData = monthLabels.map(m => {
            const sRow = statsRaw.find(r => r.type === 'sale' && r.month === m);
            const pRow = statsRaw.find(r => r.type === 'purchase' && r.month === m);

            // Ay isimlerini Türkçeleştirmek için:
            const [year, month] = m.split('-');
            const dateObj = new Date(year, month - 1);
            const monthName = dateObj.toLocaleString('tr-TR', { month: 'short' });

            return {
                rawMonth: m,
                monthName: `${monthName} ${year.slice(-2)}`,
                salesQty: sRow ? sRow.qty : 0,
                purchaseQty: pRow ? pRow.qty : 0
            };
        });

        const metrics = db.prepare(`
            SELECT
              (SELECT IFNULL(SUM(si.Qty), 0) FROM SaleItems si WHERE si.ProductID = ?) as totalSalesQty,
              (SELECT IFNULL(SUM(si.Qty * si.UnitPrice), 0) FROM SaleItems si WHERE si.ProductID = ?) as totalSalesRevenue,
              (SELECT MAX(s.CreatedAt) FROM SaleItems si JOIN Sales s ON s.ID = si.SaleID WHERE si.ProductID = ?) as lastSaleDate,
              (SELECT IFNULL(SUM(ii.Qty), 0) FROM InvoiceItems ii WHERE ii.ProductID = ?) as totalPurchaseQty,
              (SELECT IFNULL(SUM(ii.Qty * ii.UnitPrice), 0) FROM InvoiceItems ii WHERE ii.ProductID = ?) as totalPurchaseCost,
              (SELECT MAX(i.CreatedAt) FROM InvoiceItems ii JOIN Invoices i ON i.ID = ii.InvoiceID WHERE ii.ProductID = ?) as lastPurchaseDate
        `).get(id, id, id, id, id, id);

        res.json({ product, chartData, metrics });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
