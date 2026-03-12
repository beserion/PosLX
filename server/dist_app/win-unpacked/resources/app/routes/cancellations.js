import { Router } from 'express';
import { getDb } from '../config/db.js';

const router = Router();

// List cancellation logs
router.get('/', async (_req, res) => {
  try {
    const pool = await getDb();
    if (!pool) return res.status(503).json({ error: 'Database not available' });

    const result = await pool.request().query(`
        SELECT TOP 500 cl.*, s.Name AS StaffName
        FROM CancellationLogs cl
        LEFT JOIN Staff s ON s.ID = cl.StaffID
        ORDER BY cl.CreatedAt DESC
    `);

    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

