import { Router } from 'express';
import { getDb } from '../config/db.js';
import sql from 'mssql';

const router = Router();

// ── GET /api/courier-settlements/summary ───────────────────────
// Belirli kurye + tarih için satış özetini ve varsa kayıtlı mutabakatı döner
router.get('/summary', async (req, res) => {
  try {
    const pool = await getDb();
    if (!pool) return res.status(503).json({ error: 'Database not available' });

    const courierId = Number(req.query.courierId || 0);
    const date = req.query.date || new Date().toISOString().slice(0, 10);

    if (!courierId) {
      return res.status(400).json({ error: 'courierId is required' });
    }

    const summaryResult = await pool.request()
      .input('date', sql.NVarChar, date)
      .input('courierId', sql.Int, courierId)
      .query(`
        SELECT
          c.ID           AS CourierID,
          c.Name         AS CourierName,
          COALESCE(COUNT(s.ID), 0) AS ServiceCount,
          COALESCE(SUM(s.TotalAmount), 0) AS Turnover,
          COALESCE(SUM(CASE WHEN s.PaymentMethod = 'Cash' THEN s.TotalAmount ELSE 0 END), 0) AS CashAmount,
          COALESCE(SUM(CASE WHEN s.PaymentMethod = 'Card' THEN s.TotalAmount ELSE 0 END), 0) AS PosAmount
        FROM Couriers c
        LEFT JOIN Sales s
          ON s.CourierID = c.ID
         AND CAST(s.CreatedAt AS DATE) = CAST(@date AS DATE)
        WHERE c.ID = @courierId
        GROUP BY c.ID, c.Name
      `);

    const settlementResult = await pool.request()
      .input('date', sql.NVarChar, date)
      .input('courierId', sql.Int, courierId)
      .query(`
        SELECT TOP 1 *
        FROM CourierSettlements
        WHERE CourierID = @courierId AND CAST(Date AS DATE) = CAST(@date AS DATE)
        ORDER BY Date DESC
      `);

    res.json({
      date,
      summary: summaryResult.recordset.length > 0 ? summaryResult.recordset[0] : null,
      settlement: settlementResult.recordset.length > 0 ? settlementResult.recordset[0] : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/courier-settlements ──────────────────────────────
router.post('/', async (req, res) => {
  try {
    const pool = await getDb();
    if (!pool) return res.status(503).json({ error: 'Database not available' });

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
      FuelAmount,
      MaintenanceAmount,
      Turnover,
      SalesAmount,
      ServiceAmount,
      ServiceCount,
    } = req.body;

    if (!CourierID || !Date) {
      return res.status(400).json({ error: 'CourierID and Date are required' });
    }

    const result = await pool.request()
      .input('CourierID', sql.Int, CourierID)
      .input('Date', sql.NVarChar, Date)
      .input('CashDelivered', sql.Float, CashDelivered ?? 0)
      .input('Pos1Amount', sql.Float, Pos1Amount ?? 0)
      .input('Pos2Amount', sql.Float, Pos2Amount ?? 0)
      .input('Pos3Amount', sql.Float, Pos3Amount ?? 0)
      .input('PosTotal', sql.Float, PosTotal ?? 0)
      .input('Difference', sql.Float, Difference ?? 0)
      .input('CourierPayment', sql.Float, CourierPayment ?? 0)
      .input('FuelAmount', sql.Float, FuelAmount ?? 0)
      .input('MaintenanceAmount', sql.Float, MaintenanceAmount ?? 0)
      .input('Turnover', sql.Float, Turnover ?? 0)
      .input('SalesAmount', sql.Float, SalesAmount ?? 0)
      .input('ServiceAmount', sql.Float, ServiceAmount ?? 0)
      .input('ServiceCount', sql.Int, ServiceCount ?? 0)
      .query(`
        INSERT INTO CourierSettlements (
          CourierID, Date, CashDelivered,
          Pos1Amount, Pos2Amount, Pos3Amount, PosTotal,
          Difference, CourierPayment,
          FuelAmount, MaintenanceAmount,
          Turnover, SalesAmount, ServiceAmount, ServiceCount
        ) 
        OUTPUT INSERTED.ID
        VALUES (
          @CourierID, @Date, @CashDelivered,
          @Pos1Amount, @Pos2Amount, @Pos3Amount, @PosTotal,
          @Difference, @CourierPayment,
          @FuelAmount, @MaintenanceAmount,
          @Turnover, @SalesAmount, @ServiceAmount, @ServiceCount
        )
      `);

    const newId = result.recordset[0].ID;

    const created = await pool.request()
      .input('id', sql.Int, newId)
      .query('SELECT * FROM CourierSettlements WHERE ID = @id');

    res.status(201).json(created.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/courier-settlements/history ───────────────────────
router.get('/history', async (req, res) => {
  try {
    const pool = await getDb();
    if (!pool) return res.status(503).json({ error: 'Database not available' });

    const conditions = [];

    const request = pool.request();

    if (req.query.courierId) {
      conditions.push('s.CourierID = @courierId');
      request.input('courierId', sql.Int, Number(req.query.courierId));
    }
    if (req.query.startDate) {
      conditions.push('CAST(s.Date AS DATE) >= CAST(@startDate AS DATE)');
      request.input('startDate', sql.NVarChar, req.query.startDate);
    }
    if (req.query.endDate) {
      conditions.push('CAST(s.Date AS DATE) <= CAST(@endDate AS DATE)');
      request.input('endDate', sql.NVarChar, req.query.endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const historyResult = await request.query(`
        SELECT s.*, c.Name as CourierName
        FROM CourierSettlements s
        LEFT JOIN Couriers c ON c.ID = s.CourierID
        ${whereClause}
        ORDER BY s.Date DESC, s.ID DESC
      `);

    res.json(historyResult.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

// ── GET /api/courier-settlements/daily-orders ───────────────────────
router.get('/daily-orders', async (req, res) => {
    try {
        const pool = await getDb();
        if (!pool) return res.status(503).json({ error: 'Database not available' });

        const courierId = Number(req.query.courierId || 0);
        const date = req.query.date || new Date().toISOString().slice(0, 10);

        if (!courierId) {
            return res.status(400).json({ error: 'courierId is required' });
        }

        const salesResult = await pool.request()
            .input('date', sql.NVarChar, date)
            .input('courierId', sql.Int, courierId)
            .query(`
                SELECT 
                    s.ID as SaleID, s.TotalAmount, s.PaymentMethod, s.CreatedAt, s.CourierID,
                    a.Name as CustomerName, a.Address, a.Phone
                FROM Sales s
                LEFT JOIN Accounts a ON s.AccountID = a.ID
                WHERE s.CourierID = @courierId 
                  AND CAST(s.CreatedAt AS DATE) = CAST(@date AS DATE)
                ORDER BY s.CreatedAt DESC
            `);

        const sales = salesResult.recordset;

        // Fetch items for each sale
        for (const sale of sales) {
            const itemsResult = await pool.request()
                .input('SaleID', sql.Int, sale.SaleID)
                .query(`
                    SELECT si.Qty, si.UnitPrice, p.Name
                    FROM SaleItems si
                    JOIN Products p ON si.ProductID = p.ID
                    WHERE si.SaleID = @SaleID
                `);
            sale.items = itemsResult.recordset;
        }

        res.json(sales);
    } catch (err) {
            res.status(500).json({ error: err.message });
    }
});
