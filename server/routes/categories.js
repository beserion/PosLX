import { Router } from 'express';
import { getDb } from '../config/db.js';

const router = Router();

// GET /api/categories — list all
router.get('/', async (req, res) => {
    try {
        const db = getDb();
        if (!db) {
            if (process.env.USE_MOCK_DATA === 'true') {
                console.warn("⚠️ DB not available, returning mock categories");
                return res.json([
                    { ID: 1, Name: 'Hot Drinks', CreatedAt: new Date().toISOString() },
                    { ID: 2, Name: 'Desserts', CreatedAt: new Date().toISOString() },
                    { ID: 3, Name: 'Food', CreatedAt: new Date().toISOString() }
                ]);
            }
            return res.status(503).json({ error: 'Database not available' });
        }
        const rows = db.prepare('SELECT * FROM Categories ORDER BY Name').all();
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/categories — create
router.post('/', async (req, res) => {
    try {
        const { Name } = req.body;
        if (!Name || !Name.trim()) return res.status(400).json({ error: 'Name is required' });

        const db = getDb();
        if (!db) return res.status(503).json({ error: 'Database not available' });

        const info = db.prepare('INSERT INTO Categories (Name) VALUES (?)').run(Name.trim());
        const created = db.prepare('SELECT * FROM Categories WHERE ID = ?').get(info.lastInsertRowid);
        res.status(201).json(created);
    } catch (err) {
        if (err.message.includes('UNIQUE') || err.message.includes('duplicate')) {
            return res.status(409).json({ error: 'Bu kategori zaten mevcut' });
        }
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/categories/:id — rename
router.put('/:id', async (req, res) => {
    try {
        const { Name } = req.body;
        if (!Name || !Name.trim()) return res.status(400).json({ error: 'Name is required' });

        const db = getDb();
        if (!db) return res.status(503).json({ error: 'Database not available' });

        // Get old name first for product migration
        const old = db.prepare('SELECT Name FROM Categories WHERE ID = ?').get(req.params.id);
        if (!old) return res.status(404).json({ error: 'Category not found' });

        const oldName = old.Name;
        const newName = Name.trim();

        const renameTx = db.transaction(() => {
            // Update category name
            db.prepare('UPDATE Categories SET Name = ? WHERE ID = ?').run(newName, req.params.id);
            // Update products with old category name
            db.prepare('UPDATE Products SET Category = ? WHERE Category = ?').run(newName, oldName);
        });
        renameTx();

        const updated = db.prepare('SELECT * FROM Categories WHERE ID = ?').get(req.params.id);
        res.json(updated);
    } catch (err) {
        if (err.message.includes('UNIQUE') || err.message.includes('duplicate')) {
            return res.status(409).json({ error: 'Bu kategori adı zaten kullanılıyor' });
        }
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/categories/:id — delete (move products to 'Genel')
router.delete('/:id', async (req, res) => {
    try {
        const db = getDb();
        if (!db) return res.status(503).json({ error: 'Database not available' });

        // Get category name before deleting
        const cat = db.prepare('SELECT Name FROM Categories WHERE ID = ?').get(req.params.id);
        if (!cat) return res.status(404).json({ error: 'Category not found' });

        const deleteTx = db.transaction(() => {
            // Move products to 'Genel'
            db.prepare("UPDATE Products SET Category = 'Genel' WHERE Category = ?").run(cat.Name);
            // Delete category
            db.prepare('DELETE FROM Categories WHERE ID = ?').run(req.params.id);
        });
        deleteTx();

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
