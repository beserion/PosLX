import { Router } from 'express';
import { getDb } from '../config/db.js';

const router = Router();

// List all special prices
router.get('/', async (_req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database not available' });

    const rows = db
      .prepare(
        `
        SELECT sp.*, p.Name AS ProductName, a.Name AS AccountName
        FROM SpecialPrices sp
        JOIN Products p ON p.ID = sp.ProductID
        LEFT JOIN Accounts a ON a.ID = sp.AccountID
        ORDER BY sp.IsActive DESC, sp.StartDate DESC, sp.ID DESC
      `
      )
      .all();

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create special price
router.post('/', async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database not available' });

    const { ProductID, AccountID, Name, SpecialPrice, StartDate, EndDate, IsActive } =
      req.body;

    if (!ProductID || SpecialPrice === undefined) {
      return res
        .status(400)
        .json({ error: 'ProductID and SpecialPrice are required' });
    }

    const info = db
      .prepare(
        `
        INSERT INTO SpecialPrices (ProductID, AccountID, Name, SpecialPrice, StartDate, EndDate, IsActive)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `
      )
      .run(
        ProductID,
        AccountID || null,
        Name || null,
        SpecialPrice,
        StartDate || null,
        EndDate || null,
        IsActive ? 1 : 1
      );

    const created = db
      .prepare(
        `
        SELECT sp.*, p.Name AS ProductName, a.Name AS AccountName
        FROM SpecialPrices sp
        JOIN Products p ON p.ID = sp.ProductID
        LEFT JOIN Accounts a ON a.ID = sp.AccountID
        WHERE sp.ID = ?
      `
      )
      .get(info.lastInsertRowid);

    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update special price
router.put('/:id', async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database not available' });

    const id = Number(req.params.id);
    const existing = db
      .prepare('SELECT * FROM SpecialPrices WHERE ID = ?')
      .get(id);
    if (!existing) return res.status(404).json({ error: 'Special price not found' });

    const {
      ProductID = existing.ProductID,
      AccountID = existing.AccountID,
      Name = existing.Name,
      SpecialPrice = existing.SpecialPrice,
      StartDate = existing.StartDate,
      EndDate = existing.EndDate,
      IsActive = existing.IsActive,
    } = req.body || {};

    db.prepare(
      `
      UPDATE SpecialPrices
      SET ProductID = ?, AccountID = ?, Name = ?, SpecialPrice = ?, StartDate = ?, EndDate = ?, IsActive = ?
      WHERE ID = ?
    `
    ).run(
      ProductID,
      AccountID || null,
      Name || null,
      SpecialPrice,
      StartDate || null,
      EndDate || null,
      IsActive ? 1 : 0,
      id
    );

    const updated = db
      .prepare(
        `
        SELECT sp.*, p.Name AS ProductName, a.Name AS AccountName
        FROM SpecialPrices sp
        JOIN Products p ON p.ID = sp.ProductID
        LEFT JOIN Accounts a ON a.ID = sp.AccountID
        WHERE sp.ID = ?
      `
      )
      .get(id);

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Soft delete / deactivate
router.delete('/:id', async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database not available' });

    const id = Number(req.params.id);
    db.prepare('UPDATE SpecialPrices SET IsActive = 0 WHERE ID = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

