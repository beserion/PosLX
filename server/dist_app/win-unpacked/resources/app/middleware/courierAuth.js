import { getDb } from '../config/db.js';

/**
 * Express middleware that verifies the courier API token.
 * Expects header: Authorization: Bearer <token>
 * Token is read from system_settings.courier_api_token
 */
export async function courierAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing or invalid Authorization header' });
        }

        const token = authHeader.slice(7); // strip "Bearer "

        const pool = await getDb();
        if (!pool) return res.status(503).json({ error: 'Database not available' });

        const result = await pool.request().query("SELECT value FROM system_settings WHERE [key] = 'courier_api_token'");
        const row = result.recordset.length > 0 ? result.recordset[0] : null;

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
