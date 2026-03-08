import express from 'express';
import { getDb } from '../config/db.js';
import sql from 'mssql';

const router = express.Router();

// GET all printers
router.get('/', async (req, res) => {
    try {
        const pool = await getDb();
        const result = await pool.request().query('SELECT * FROM Printers ORDER BY Name ASC');
        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch printers' });
    }
});

// GET single printer
router.get('/:id', async (req, res) => {
    try {
        const pool = await getDb();
        const result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('SELECT * FROM Printers WHERE ID = @id');

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Printer not found' });
        }
        res.json(result.recordset[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch printer' });
    }
});

// POST create printer
router.post('/', async (req, res) => {
    try {
        const { Name, Path, Type = 'Thermal' } = req.body;
        if (!Name || !Path) {
            return res.status(400).json({ error: 'Name and Path are required' });
        }

        const pool = await getDb();
        const result = await pool.request()
            .input('name', sql.NVarChar, Name)
            .input('path', sql.NVarChar, Path)
            .input('type', sql.NVarChar, Type)
            .query(`
                INSERT INTO Printers (Name, Path, Type)
                OUTPUT INSERTED.*
                VALUES (@name, @path, @type)
            `);
        res.status(201).json(result.recordset[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create printer' });
    }
});

// PUT update printer
router.put('/:id', async (req, res) => {
    try {
        const { Name, Path, Type } = req.body;
        if (!Name || !Path) {
            return res.status(400).json({ error: 'Name and Path are required' });
        }

        const pool = await getDb();
        const result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('name', sql.NVarChar, Name)
            .input('path', sql.NVarChar, Path)
            .input('type', sql.NVarChar, Type || 'Thermal')
            .query(`
                UPDATE Printers 
                SET Name = @name, Path = @path, Type = @type
                OUTPUT INSERTED.*
                WHERE ID = @id
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Printer not found' });
        }
        res.json(result.recordset[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update printer' });
    }
});

// DELETE printer
router.delete('/:id', async (req, res) => {
    try {
        const pool = await getDb();

        // Check if printer is assigned in settings before deleting
        const settings = await pool.request().query("SELECT [key], [value] FROM system_settings WHERE [key] IN ('pos_printer_id', 'report_printer_id')");
        for (const s of settings.recordset) {
            if (s.value === req.params.id) {
                return res.status(400).json({ error: 'Cannot delete a printer that is currently assigned in settings.' });
            }
        }

        const result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query(`
                DELETE FROM Printers 
                OUTPUT DELETED.ID
                WHERE ID = @id
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Printer not found' });
        }
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete printer' });
    }
});

export default router;
