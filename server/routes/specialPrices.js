import { Router } from 'express';
import { getDb } from '../config/db.js';
import sql from 'mssql';

const router = Router();

// List all special prices
router.get('/', async (_req, res) => {
  try {
    const pool = await getDb();
    if (!pool) return res.status(503).json({ error: 'Database not available' });

    const result = await pool.request().query(`
        SELECT sp.*, p.Name AS ProductName, a.Name AS AccountName
        FROM SpecialPrices sp
        JOIN Products p ON p.ID = sp.ProductID
        LEFT JOIN Accounts a ON a.ID = sp.AccountID
        ORDER BY sp.IsActive DESC, sp.StartDate DESC, sp.ID DESC
    `);

    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create special price
router.post('/', async (req, res) => {
  try {
    const pool = await getDb();
    if (!pool) return res.status(503).json({ error: 'Database not available' });

    const { ProductID, AccountID, Name, SpecialPrice, StartDate, EndDate, IsActive } = req.body;

    if (!ProductID || SpecialPrice === undefined) {
      return res.status(400).json({ error: 'ProductID and SpecialPrice are required' });
    }

    const insertResult = await pool.request()
      .input('ProductID', sql.Int, ProductID)
      .input('AccountID', sql.Int, AccountID || null)
      .input('Name', sql.NVarChar, Name || null)
      .input('SpecialPrice', sql.Float, SpecialPrice)
      .input('StartDate', sql.NVarChar, StartDate || null)
      .input('EndDate', sql.NVarChar, EndDate || null)
      .input('IsActive', sql.Int, IsActive ? 1 : 1)
      .query(`
        INSERT INTO SpecialPrices (ProductID, AccountID, Name, SpecialPrice, StartDate, EndDate, IsActive)
        OUTPUT INSERTED.ID
        VALUES (@ProductID, @AccountID, @Name, @SpecialPrice, @StartDate, @EndDate, @IsActive)
      `);

    const newId = insertResult.recordset[0].ID;

    const createdResult = await pool.request()
      .input('id', sql.Int, newId)
      .query(`
        SELECT sp.*, p.Name AS ProductName, a.Name AS AccountName
        FROM SpecialPrices sp
        JOIN Products p ON p.ID = sp.ProductID
        LEFT JOIN Accounts a ON a.ID = sp.AccountID
        WHERE sp.ID = @id
      `);

    res.status(201).json(createdResult.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update special price
router.put('/:id', async (req, res) => {
  try {
    const pool = await getDb();
    if (!pool) return res.status(503).json({ error: 'Database not available' });

    const id = Number(req.params.id);
    const existingResult = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM SpecialPrices WHERE ID = @id');

    if (existingResult.recordset.length === 0) return res.status(404).json({ error: 'Special price not found' });
    const existing = existingResult.recordset[0];

    const {
      ProductID = existing.ProductID,
      AccountID = existing.AccountID,
      Name = existing.Name,
      SpecialPrice = existing.SpecialPrice,
      StartDate = existing.StartDate,
      EndDate = existing.EndDate,
      IsActive = existing.IsActive,
    } = req.body || {};

    await pool.request()
      .input('ProductID', sql.Int, ProductID)
      .input('AccountID', sql.Int, AccountID || null)
      .input('Name', sql.NVarChar, Name || null)
      .input('SpecialPrice', sql.Float, SpecialPrice)
      .input('StartDate', sql.NVarChar, StartDate || null)
      .input('EndDate', sql.NVarChar, EndDate || null)
      .input('IsActive', sql.Int, IsActive ? 1 : 0)
      .input('id', sql.Int, id)
      .query(`
          UPDATE SpecialPrices
          SET ProductID = @ProductID, AccountID = @AccountID, Name = @Name, SpecialPrice = @SpecialPrice, StartDate = @StartDate, EndDate = @EndDate, IsActive = @IsActive
          WHERE ID = @id
        `);

    const updatedResult = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT sp.*, p.Name AS ProductName, a.Name AS AccountName
        FROM SpecialPrices sp
        JOIN Products p ON p.ID = sp.ProductID
        LEFT JOIN Accounts a ON a.ID = sp.AccountID
        WHERE sp.ID = @id
      `);

    res.json(updatedResult.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Soft delete / deactivate
router.delete('/:id', async (req, res) => {
  try {
    const pool = await getDb();
    if (!pool) return res.status(503).json({ error: 'Database not available' });

    const id = Number(req.params.id);
    await pool.request()
      .input('id', sql.Int, id)
      .query('UPDATE SpecialPrices SET IsActive = 0 WHERE ID = @id');

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

