import { Router } from 'express';
import { getDb } from '../config/db.js';

const router = Router();

// List staff
router.get('/', async (_req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database not available' });
    const rows = db
      .prepare('SELECT ID, Name, Role, IsActive, CreatedAt FROM Staff ORDER BY Name')
      .all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create staff
router.post('/', async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database not available' });

    const { Name, Role = 'Cashier', Pin } = req.body || {};
    if (!Name || !Pin) {
      return res.status(400).json({ error: 'Name and Pin are required' });
    }

    const info = db
      .prepare(
        'INSERT INTO Staff (Name, Role, Pin, IsActive) VALUES (?, ?, ?, 1)'
      )
      .run(Name, Role, String(Pin));

    const created = db
      .prepare(
        'SELECT ID, Name, Role, IsActive, CreatedAt FROM Staff WHERE ID = ?'
      )
      .get(info.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update staff
router.put('/:id', async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database not available' });
    const id = Number(req.params.id);

    const current = db
      .prepare('SELECT * FROM Staff WHERE ID = ?')
      .get(id);
    if (!current) return res.status(404).json({ error: 'Staff not found' });

    const Name = req.body.Name ?? current.Name;
    const Role = req.body.Role ?? current.Role;
    const Pin = req.body.Pin ? String(req.body.Pin) : current.Pin;
    const IsActive =
      typeof req.body.IsActive === 'number' || typeof req.body.IsActive === 'boolean'
        ? (req.body.IsActive ? 1 : 0)
        : current.IsActive;

    db.prepare(
      'UPDATE Staff SET Name = ?, Role = ?, Pin = ?, IsActive = ? WHERE ID = ?'
    ).run(Name, Role, Pin, IsActive, id);

    const updated = db
      .prepare(
        'SELECT ID, Name, Role, IsActive, CreatedAt FROM Staff WHERE ID = ?'
      )
      .get(id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Soft delete
router.delete('/:id', async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database not available' });
    const id = Number(req.params.id);
    db.prepare('UPDATE Staff SET IsActive = 0 WHERE ID = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Simple PIN login
router.post('/login', async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database not available' });
    const { Pin } = req.body || {};
    if (!Pin) return res.status(400).json({ error: 'Pin is required' });

    const staff = db
      .prepare(
        'SELECT ID, Name, Role, IsActive FROM Staff WHERE Pin = ? AND IsActive = 1'
      )
      .get(String(Pin));
    if (!staff) return res.status(401).json({ error: 'Geçersiz PIN veya pasif kullanıcı' });

    res.json(staff);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

