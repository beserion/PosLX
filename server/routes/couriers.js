import { Router } from 'express';
import { getDb } from '../config/db.js';
import { haversine } from '../utils/haversine.js';
import { courierAuth } from '../middleware/courierAuth.js';

const router = Router();

// GET /api/couriers — list all couriers
router.get('/', async (req, res) => {
    try {
        const db = getDb();
        if (!db) {
            if (process.env.USE_MOCK_DATA === 'true') {
                console.warn("⚠️ DB not available, returning mock couriers");
                return res.json([
                    { ID: 1, Name: 'Ahmet Yılmaz', Phone: '+90 532 111 2233', Status: 'Delivering', Lat: 41.0082, Lng: 28.9784, DailyDistanceKM: 14.3 },
                    { ID: 2, Name: 'Mehmet Demir', Phone: '+90 535 222 3344', Status: 'Idle', Lat: 41.0135, Lng: 28.9553, DailyDistanceKM: 7.1 }
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

// PUT /api/couriers/:id/status — update status
router.put('/:id/status', async (req, res) => {
    try {
        const { status } = req.body; // Idle | Delivering | Offline
        const db = getDb();
        if (!db) return res.status(503).json({ error: 'Database not available' });
        db.prepare('UPDATE Couriers SET Status = ? WHERE ID = ?').run(status, req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/couriers/:id/location — update GPS + compute distance (requires courier API token)
router.put('/:id/location', courierAuth, async (req, res) => {
    try {
        const { lat, lng } = req.body;
        const db = getDb();
        if (!db) return res.status(503).json({ error: 'Database not available' });

        // Get current location to calculate distance
        const current = db.prepare('SELECT Lat, Lng, DailyDistanceKM FROM Couriers WHERE ID = ?').get(req.params.id);

        let addedKM = 0;
        if (current && current.Lat != null && current.Lng != null) {
            addedKM = haversine(current.Lat, current.Lng, lat, lng);
        }

        db.prepare('UPDATE Couriers SET Lat = ?, Lng = ?, DailyDistanceKM = DailyDistanceKM + ? WHERE ID = ?')
            .run(lat, lng, addedKM, req.params.id);

        res.json({ success: true, addedKM });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
