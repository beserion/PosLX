import { Router } from 'express';
import { getDb } from '../config/db.js';
import sql from 'mssql';

const router = Router();

// GET /api/categories — list all
router.get('/', async (req, res) => {
    try {
        const pool = await getDb();
        if (!pool) {
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
        const result = await pool.request().query('SELECT * FROM Categories ORDER BY Name');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/categories — create
router.post('/', async (req, res) => {
    try {
        const { Name } = req.body;
        if (!Name || !Name.trim()) return res.status(400).json({ error: 'Name is required' });

        const pool = await getDb();
        if (!pool) return res.status(503).json({ error: 'Database not available' });

        const result = await pool.request()
            .input('name', sql.NVarChar, Name.trim())
            .query('INSERT INTO Categories (Name) OUTPUT INSERTED.ID VALUES (@name)');

        const newId = result.recordset[0].ID;

        const created = await pool.request()
            .input('id', sql.Int, newId)
            .query('SELECT * FROM Categories WHERE ID = @id');

        res.status(201).json(created.recordset[0]);
    } catch (err) {
        if (err.message.includes('UNIQUE') || err.message.includes('duplicate') || err.message.includes('Violation of UNIQUE KEY constraint')) {
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

        const pool = await getDb();
        if (!pool) return res.status(503).json({ error: 'Database not available' });

        // Get old name first for product migration
        const oldCheck = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('SELECT Name FROM Categories WHERE ID = @id');

        if (oldCheck.recordset.length === 0) return res.status(404).json({ error: 'Category not found' });

        const oldName = oldCheck.recordset[0].Name;
        const newName = Name.trim();

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            const request = new sql.Request(transaction);

            // Update category name
            await request
                .input('newName', sql.NVarChar, newName)
                .input('id', sql.Int, req.params.id)
                .query('UPDATE Categories SET Name = @newName WHERE ID = @id');

            // Update products with old category name
            const request2 = new sql.Request(transaction);
            await request2
                .input('newName', sql.NVarChar, newName)
                .input('oldName', sql.NVarChar, oldName)
                .query('UPDATE Products SET Category = @newName WHERE Category = @oldName');

            await transaction.commit();
        } catch (txErr) {
            await transaction.rollback();
            throw txErr;
        }

        const updated = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('SELECT * FROM Categories WHERE ID = @id');

        res.json(updated.recordset[0]);
    } catch (err) {
        if (err.message.includes('UNIQUE') || err.message.includes('duplicate') || err.message.includes('Violation of UNIQUE KEY constraint')) {
            return res.status(409).json({ error: 'Bu kategori adı zaten kullanılıyor' });
        }
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/categories/:id — delete (move products to 'Genel')
router.delete('/:id', async (req, res) => {
    try {
        const pool = await getDb();
        if (!pool) return res.status(503).json({ error: 'Database not available' });

        // Get category name before deleting
        const catCheck = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('SELECT Name FROM Categories WHERE ID = @id');

        if (catCheck.recordset.length === 0) return res.status(404).json({ error: 'Category not found' });

        const catName = catCheck.recordset[0].Name;

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            // Move products to 'Genel'
            const request1 = new sql.Request(transaction);
            await request1
                .input('catName', sql.NVarChar, catName)
                .query("UPDATE Products SET Category = 'Genel' WHERE Category = @catName");

            // Delete category
            const request2 = new sql.Request(transaction);
            await request2
                .input('id', sql.Int, req.params.id)
                .query('DELETE FROM Categories WHERE ID = @id');

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
