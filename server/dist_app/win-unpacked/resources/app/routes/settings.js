import { Router } from 'express';
import { getDb } from '../config/db.js';
import sql from 'mssql';

const router = Router();

// GET /api/settings — list all settings
router.get('/', async (_req, res) => {
    try {
        const pool = await getDb();
        if (!pool) return res.status(503).json({ error: 'Database not available' });

        const result = await pool.request().query('SELECT [key], [value] FROM system_settings');
        const settings = {};
        for (const r of result.recordset) settings[r.key] = r.value;

        res.json(settings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/settings/:key — get a single setting
router.get('/:key', async (req, res) => {
    try {
        const pool = await getDb();
        if (!pool) return res.status(503).json({ error: 'Database not available' });

        const result = await pool.request()
            .input('key', sql.NVarChar, req.params.key)
            .query('SELECT [value] FROM system_settings WHERE [key] = @key');

        if (result.recordset.length === 0) return res.status(404).json({ error: 'Setting not found' });

        res.json({ key: req.params.key, value: result.recordset[0].value });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/settings/:key — upsert a setting
router.put('/:key', async (req, res) => {
    try {
        const { value } = req.body;
        const pool = await getDb();
        if (!pool) return res.status(503).json({ error: 'Database not available' });

        // MSSQL native UPSERT (MERGE)
        await pool.request()
            .input('key', sql.NVarChar, req.params.key)
            .input('val', sql.NVarChar, value)
            .query(`
                MERGE system_settings AS target
                USING (SELECT @key AS [key], @val AS [value]) AS source
                ON (target.[key] = source.[key])
                WHEN MATCHED THEN 
                    UPDATE SET [value] = source.[value]
                WHEN NOT MATCHED THEN   
                    INSERT ([key], [value]) VALUES (source.[key], source.[value]);
            `);

        res.json({ key: req.params.key, value });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
