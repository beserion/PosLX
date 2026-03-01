import { Router } from 'express';
import { getDb } from '../config/db.js';

const router = Router();

// GET /api/settings — list all settings
router.get('/', (_req, res) => {
    try {
        const db = getDb();
        if (!db) return res.status(503).json({ error: 'Database not available' });
        const rows = db.prepare('SELECT key, value FROM system_settings').all();
        const settings = {};
        for (const r of rows) settings[r.key] = r.value;
        res.json(settings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/settings/:key — get a single setting
router.get('/:key', (req, res) => {
    try {
        const db = getDb();
        if (!db) return res.status(503).json({ error: 'Database not available' });
        const row = db.prepare('SELECT value FROM system_settings WHERE key = ?').get(req.params.key);
        if (!row) return res.status(404).json({ error: 'Setting not found' });
        res.json({ key: req.params.key, value: row.value });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/settings/:key — upsert a setting
router.put('/:key', (req, res) => {
    try {
        const { value } = req.body;
        const db = getDb();
        if (!db) return res.status(503).json({ error: 'Database not available' });
        db.prepare('INSERT INTO system_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
            .run(req.params.key, value);
        res.json({ key: req.params.key, value });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
