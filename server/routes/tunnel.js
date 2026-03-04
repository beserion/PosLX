import { Router } from 'express';
import { getDb } from '../config/db.js';
import { getTunnelStatus } from '../tunnel/tunnelManager.js';
import { networkInterfaces } from 'os';

const router = Router();

/**
 * Get the local LAN IP address of the server.
 */
function getLocalIP() {
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // Skip internal (loopback) and non-IPv4 addresses
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }
    return null;
}

// GET /api/tunnel/status — tunnel health
router.get('/status', (_req, res) => {
    try {
        const status = getTunnelStatus();
        res.json(status);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/tunnel/qr-data — data for QR code (public URL + LAN URL + token)
router.get('/qr-data', (_req, res) => {
    try {
        const db = getDb();
        if (!db) return res.status(503).json({ error: 'Database not available' });

        const status = getTunnelStatus();
        const tokenRow = db.prepare("SELECT value FROM system_settings WHERE key = 'courier_api_token'").get();

        const localIP = getLocalIP();
        const PORT = process.env.PORT || 3001;
        const lanUrl = localIP ? `http://${localIP}:${PORT}` : null;

        res.json({
            url: status.url || null,
            lanUrl: lanUrl,
            token: tokenRow?.value || null,
            connected: status.connected,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;

