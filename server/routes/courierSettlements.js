import { Router } from 'express';
import { getDb } from '../config/db.js';

const router = Router();

// ── GET /api/courier-settlements/summary ───────────────────────
// Belirli kurye + tarih için satış özetini ve varsa kayıtlı mutabakatı döner
router.get('/summary', async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database not available' });

    const courierId = Number(req.query.courierId || 0);
    const date = req.query.date || new Date().toISOString().slice(0, 10);

    if (!courierId) {
      return res.status(400).json({ error: 'courierId is required' });
    }

    const summary = db
      .prepare(
        `
        SELECT
          c.ID           AS CourierID,
          c.Name         AS CourierName,
          IFNULL(COUNT(s.ID), 0) AS ServiceCount,
          IFNULL(SUM(s.TotalAmount), 0) AS Turnover,
          IFNULL(SUM(CASE WHEN s.PaymentMethod = 'Cash' THEN s.TotalAmount ELSE 0 END), 0) AS CashAmount,
          IFNULL(SUM(CASE WHEN s.PaymentMethod = 'Card' THEN s.TotalAmount ELSE 0 END), 0) AS PosAmount
        FROM Couriers c
        LEFT JOIN Sales s
          ON s.CourierID = c.ID
         AND date(s.CreatedAt) = date(?)
        WHERE c.ID = ?
        GROUP BY c.ID, c.Name
      `
      )
      .get(date, courierId);

    const settlement = db
      .prepare(
        `
        SELECT *
        FROM CourierSettlements
        WHERE CourierID = ? AND date(Date) = date(?)
        ORDER BY Date DESC
        LIMIT 1
      `
      )
      .get(courierId, date);

    res.json({
      date,
      summary: summary || null,
      settlement: settlement || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/courier-settlements ──────────────────────────────
router.post('/', async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database not available' });

    const {
      CourierID,
      Date,
      CashDelivered,
      Pos1Amount,
      Pos2Amount,
      Pos3Amount,
      PosTotal,
      Difference,
      CourierPayment,
      Turnover,
      SalesAmount,
      ServiceAmount,
      ServiceCount,
    } = req.body;

    if (!CourierID || !Date) {
      return res.status(400).json({ error: 'CourierID and Date are required' });
    }

    const info = db
      .prepare(
        `
        INSERT INTO CourierSettlements (
          CourierID, Date, CashDelivered,
          Pos1Amount, Pos2Amount, Pos3Amount, PosTotal,
          Difference, CourierPayment,
          Turnover, SalesAmount, ServiceAmount, ServiceCount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      )
      .run(
        CourierID,
        Date,
        CashDelivered ?? 0,
        Pos1Amount ?? 0,
        Pos2Amount ?? 0,
        Pos3Amount ?? 0,
        PosTotal ?? 0,
        Difference ?? 0,
        CourierPayment ?? 0,
        Turnover ?? 0,
        SalesAmount ?? 0,
        ServiceAmount ?? 0,
        ServiceCount ?? 0
      );

    const created = db
      .prepare('SELECT * FROM CourierSettlements WHERE ID = ?')
      .get(info.lastInsertRowid);

    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

