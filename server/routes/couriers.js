import { Router } from 'express';
import { getDb } from '../config/db.js';
import { courierAuth } from '../middleware/courierAuth.js';
import { io } from '../index.js';

const router = Router();

// GET /api/couriers — list all couriers
router.get('/', async (req, res) => {
    try {
        const db = getDb();
        if (!db) {
            if (process.env.USE_MOCK_DATA === 'true') {
                console.warn("⚠️ DB not available, returning mock couriers");
                return res.json([
                    { ID: 1, Name: 'Ahmet Yılmaz', Phone: '+90 532 111 2233', Status: 'Delivering' },
                    { ID: 2, Name: 'Mehmet Demir', Phone: '+90 535 222 3344', Status: 'Idle' }
                ]);
            }
            return res.status(503).json({ error: 'Database not available' });
        }
        const rows = db.prepare('SELECT * FROM Couriers ORDER BY Name').all();
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/couriers — add a new courier
router.post('/', async (req, res) => {
    try {
        const { Name, Phone } = req.body;
        if (!Name) return res.status(400).json({ error: 'Name is required' });

        const db = getDb();
        if (!db) return res.status(503).json({ error: 'Database not available' });

        const info = db.prepare('INSERT INTO Couriers (Name, Phone, Status) VALUES (?, ?, ?)')
            .run(Name, Phone || '', 'Offline');

        const newCourier = db.prepare('SELECT * FROM Couriers WHERE ID = ?').get(info.lastInsertRowid);
        res.status(201).json(newCourier);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/couriers/:id — remove a courier
router.delete('/:id', async (req, res) => {
    try {
        const db = getDb();
        if (!db) return res.status(503).json({ error: 'Database not available' });

        db.prepare('DELETE FROM Couriers WHERE ID = ?').run(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/couriers/:id/status — update status
router.put('/:id/status', async (req, res) => {
    try {
        const { status } = req.body; // Idle | Delivering | Offline
        const db = getDb();
        if (!db) return res.status(503).json({ error: 'Database not available' });

        db.prepare('UPDATE Couriers SET Status = ? WHERE ID = ?').run(status, req.params.id);

        // Notify dashboard clients
        io.of('/couriers').emit('status:changed', { courierID: Number(req.params.id), status });

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


export default router;
