import { Router } from 'express';
import { getDb } from '../config/db.js';

const router = Router();

// List cancellation logs
router.get('/', async (_req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database not available' });

    const rows = db
      .prepare(
        `
        SELECT cl.*, s.Name AS StaffName
        FROM CancellationLogs cl
        LEFT JOIN Staff s ON s.ID = cl.StaffID
        ORDER BY cl.CreatedAt DESC
        LIMIT 500
      `
      )
      .all();

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

