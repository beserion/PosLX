import { Router } from 'express';
import { getDb } from '../config/db.js';
import sql from 'mssql';

const router = Router();

// List staff
router.get('/', async (_req, res) => {
  try {
    const pool = await getDb();
    if (!pool) return res.status(503).json({ error: 'Database not available' });

    const result = await pool.request().query('SELECT ID, Name, Role, IsActive, CreatedAt FROM Staff ORDER BY Name');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create staff
router.post('/', async (req, res) => {
  try {
    const pool = await getDb();
    if (!pool) return res.status(503).json({ error: 'Database not available' });

    const { Name, Role = 'Cashier', Pin } = req.body || {};
    if (!Name || !Pin) {
      return res.status(400).json({ error: 'Name and Pin are required' });
    }

    const result = await pool.request()
      .input('name', sql.NVarChar, Name)
      .input('role', sql.NVarChar, Role)
      .input('pin', sql.NVarChar, String(Pin))
      .query(`
            INSERT INTO Staff (Name, Role, Pin, IsActive) 
            OUTPUT INSERTED.ID 
            VALUES (@name, @role, @pin, 1)
        `);

    const newId = result.recordset[0].ID;

    const created = await pool.request()
      .input('id', sql.Int, newId)
      .query('SELECT ID, Name, Role, IsActive, CreatedAt FROM Staff WHERE ID = @id');

    res.status(201).json(created.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update staff
router.put('/:id', async (req, res) => {
  try {
    const pool = await getDb();
    if (!pool) return res.status(503).json({ error: 'Database not available' });
    const id = Number(req.params.id);

    const check = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM Staff WHERE ID = @id');

    if (check.recordset.length === 0) return res.status(404).json({ error: 'Staff not found' });
    const current = check.recordset[0];

    const Name = req.body.Name ?? current.Name;
    const Role = req.body.Role ?? current.Role;
    const Pin = req.body.Pin ? String(req.body.Pin) : current.Pin;
    const IsActive =
      typeof req.body.IsActive === 'number' || typeof req.body.IsActive === 'boolean'
        ? (req.body.IsActive ? 1 : 0)
        : current.IsActive;

    await pool.request()
      .input('name', sql.NVarChar, Name)
      .input('role', sql.NVarChar, Role)
      .input('pin', sql.NVarChar, Pin)
      .input('isActive', sql.Int, IsActive)
      .input('id', sql.Int, id)
      .query('UPDATE Staff SET Name = @name, Role = @role, Pin = @pin, IsActive = @isActive WHERE ID = @id');

    const updated = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT ID, Name, Role, IsActive, CreatedAt FROM Staff WHERE ID = @id');

    res.json(updated.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Soft delete
router.delete('/:id', async (req, res) => {
  try {
    const pool = await getDb();
    if (!pool) return res.status(503).json({ error: 'Database not available' });
    const id = Number(req.params.id);

    await pool.request()
      .input('id', sql.Int, id)
      .query('UPDATE Staff SET IsActive = 0 WHERE ID = @id');

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Simple PIN login
router.post('/login', async (req, res) => {
  try {
    const pool = await getDb();
    if (!pool) return res.status(503).json({ error: 'Database not available' });
    const { Pin } = req.body || {};
    if (!Pin) return res.status(400).json({ error: 'Pin is required' });

    const result = await pool.request()
      .input('pin', sql.NVarChar, String(Pin))
      .query('SELECT ID, Name, Role, IsActive FROM Staff WHERE Pin = @pin AND IsActive = 1');

    if (result.recordset.length === 0) return res.status(401).json({ error: 'Geçersiz PIN veya pasif kullanıcı' });

    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

