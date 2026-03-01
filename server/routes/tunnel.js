import { Router } from 'express';
import { getDb } from '../config/db.js';
import { getTunnelStatus } from '../tunnel/tunnelManager.js';

const router = Router();

// GET /api/tunnel/status — tunnel health
router.get('/status', (_req, res) => {
    try {
        const status = getTunnelStatus();
        res.json(status);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/tunnel/qr-data — data for QR code (public URL + token)
router.get('/qr-data', (_req, res) => {
    try {
        const db = getDb();
        if (!db) return res.status(503).json({ error: 'Database not available' });

        const status = getTunnelStatus();
        const tokenRow = db.prepare("SELECT value FROM system_settings WHERE key = 'courier_api_token'").get();

        res.json({
            url: status.url || null,
            token: tokenRow?.value || null,
            connected: status.connected,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
