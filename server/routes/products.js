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
        const { Barcodes, Name, Stock, CostPrice, SalePrice, Category, ImageURL } = req.body;
        const barcodeList = Array.isArray(Barcodes) ? Barcodes : (Barcodes ? [Barcodes] : []);

        const db = getDb();
        if (!db) return res.status(503).json({ error: 'Database not available' });

        const insertProduct = db.prepare(
            `INSERT INTO Products (Name, Stock, CostPrice, SalePrice, Category, ImageURL)
             VALUES (?, ?, ?, ?, ?, ?)`
        );
        const insertBarcode = db.prepare(
            'INSERT INTO ProductBarcodes (ProductID, Barcode) VALUES (?, ?)'
        );
        const getProduct = db.prepare('SELECT * FROM Products WHERE ID = ?');

        const createTx = db.transaction(() => {
            const info = insertProduct.run(Name, Stock || 0, CostPrice || 0, SalePrice || 0, Category || null, ImageURL || null);
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
        const { Barcodes, Name, Stock, CostPrice, SalePrice, Category, ImageURL } = req.body;
        const barcodeList = Array.isArray(Barcodes) ? Barcodes : (Barcodes ? [Barcodes] : []);

        const db = getDb();
        if (!db) return res.status(503).json({ error: 'Database not available' });

        const updateProduct = db.prepare(
            `UPDATE Products
             SET Name = ?, Stock = ?, CostPrice = ?, SalePrice = ?, Category = ?, ImageURL = ?
             WHERE ID = ?`
        );
        const deleteBarcodes = db.prepare('DELETE FROM ProductBarcodes WHERE ProductID = ?');
        const insertBarcode = db.prepare('INSERT INTO ProductBarcodes (ProductID, Barcode) VALUES (?, ?)');
        const getProduct = db.prepare('SELECT * FROM Products WHERE ID = ?');

        const updateTx = db.transaction(() => {
            const info = updateProduct.run(Name, Stock || 0, CostPrice || 0, SalePrice || 0, Category || null, ImageURL || null, req.params.id);
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

// ── DELETE /api/products/:id — delete product (barcodes auto-cascade) ──
router.delete('/:id', async (req, res) => {
    try {
        const db = getDb();
        if (!db) return res.status(503).json({ error: 'Database not available' });
        db.prepare('DELETE FROM Products WHERE ID = ?').run(req.params.id);
        res.json({ success: true });
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

export default router;
