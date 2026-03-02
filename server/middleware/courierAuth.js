import { getDb } from '../config/db.js';

/**
 * Express middleware that verifies the courier API token.
 * Expects header: Authorization: Bearer <token>
 * Token is read from system_settings.courier_api_token
 */
export function courierAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing or invalid Authorization header' });
        }

        const token = authHeader.slice(7); // strip "Bearer "

        const db = getDb();
        if (!db) return res.status(503).json({ error: 'Database not available' });

        const row = db.prepare("SELECT value FROM system_settings WHERE key = 'courier_api_token'").get();
        if (!row) {
            return res.status(500).json({ error: 'API token not configured' });
        }

        if (token !== row.value) {
            return res.status(401).json({ error: 'Invalid API token' });
        }

        next();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}
