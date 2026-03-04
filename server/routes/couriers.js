import { Router } from 'express';
import { getDb } from '../config/db.js';
import { courierAuth } from '../middleware/courierAuth.js';
import { io } from '../index.js';

const router = Router();

// GET /api/couriers — list all couriers
router.get('/', async (req, res) => {
    try {
        const db = getDb();
        if (!db) {
            if (process.env.USE_MOCK_DATA === 'true') {
                console.warn("⚠️ DB not available, returning mock couriers");
                return res.json([
                    { ID: 1, Name: 'Ahmet Yılmaz', Phone: '+90 532 111 2233', Status: 'Delivering' },
                    { ID: 2, Name: 'Mehmet Demir', Phone: '+90 535 222 3344', Status: 'Idle' }
                ]);
            }
            return res.status(503).json({ error: 'Database not available' });
        }
        const rows = db.prepare('SELECT * FROM Couriers ORDER BY Name').all();
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/couriers — add a new courier
router.post('/', async (req, res) => {
    try {
        const { Name, Phone } = req.body;
        if (!Name) return res.status(400).json({ error: 'Name is required' });

        const db = getDb();
        if (!db) return res.status(503).json({ error: 'Database not available' });

        const info = db.prepare('INSERT INTO Couriers (Name, Phone, Status) VALUES (?, ?, ?)')
            .run(Name, Phone || '', 'Offline');

        const newCourier = db.prepare('SELECT * FROM Couriers WHERE ID = ?').get(info.lastInsertRowid);
        res.status(201).json(newCourier);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/couriers/:id — remove a courier
router.delete('/:id', async (req, res) => {
    try {
        const db = getDb();
        if (!db) return res.status(503).json({ error: 'Database not available' });

        const id = req.params.id;
        // Clear ALL foreign key references before deleting
        db.prepare('UPDATE Sales SET CourierID = NULL WHERE CourierID = ?').run(id);
        db.prepare('DELETE FROM CourierDailyStats WHERE CourierID = ?').run(id);
        db.prepare('DELETE FROM CourierSettlements WHERE CourierID = ?').run(id);
        db.prepare('DELETE FROM Couriers WHERE ID = ?').run(id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/couriers/location — report location & updates stats
router.post('/location', courierAuth, async (req, res) => {
    try {
        const { courierId, latitude, longitude, heading, speed, distanceKm, batteryLevel, packagesDelivered } = req.body;
        console.log(`📍 Received location POST for Courier ${courierId}: Lat ${latitude}, Lng ${longitude}`);
        if (!courierId) return res.status(400).json({ success: false, error: 'CourierID is required' });

        const db = getDb();
        if (!db) return res.status(503).json({ success: false, error: 'Database not available' });

        // Today's date YYYY-MM-DD
        const today = new Date().toISOString().split('T')[0];

        // Update or insert daily stats
        if (distanceKm !== undefined || packagesDelivered !== undefined) {
            const stats = db.prepare('SELECT * FROM CourierDailyStats WHERE CourierID = ? AND Date = ?').get(courierId, today);
            if (stats) {
                // Update
                db.prepare(`
                UPDATE CourierDailyStats
                SET 
                  TotalDistanceKm = COALESCE(?, TotalDistanceKm),
                  PackagesDelivered = COALESCE(?, PackagesDelivered)
                WHERE ID = ?
             `).run(distanceKm, packagesDelivered, stats.ID);
            } else {
                // Insert
                db.prepare(`
                INSERT INTO CourierDailyStats (CourierID, Date, TotalDistanceKm, PackagesDelivered)
                VALUES (?, ?, COALESCE(?, 0), COALESCE(?, 0))
             `).run(courierId, today, distanceKm, packagesDelivered);
            }
        }

        // Persist last known location to Couriers table for initial map load on POS
        if (latitude !== undefined && longitude !== undefined) {
            db.prepare(`
                UPDATE Couriers 
                SET lat = ?, lng = ?, lastSeen = ?
                WHERE ID = ?
            `).run(latitude, longitude, Date.now(), courierId);
        }

        // Emit location via Socket to dashboards
        io.of('/couriers').emit('location:update', {
            courierId,
            latitude,
            longitude,
            heading,
            speed,
            batteryLevel,
            timestamp: new Date().toISOString()
        });

        res.json({ success: true, message: 'Location updated successfully' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/couriers/:id/stats — get daily/weekly/monthly stats
router.get('/:id/stats', courierAuth, async (req, res) => {
    try {
        const courierId = req.params.id;
        const db = getDb();
        if (!db) return res.status(503).json({ success: false, error: 'Database not available' });

        // Simple aggregation using sqlite date features
        const stats = db.prepare(`
            SELECT 
                SUM(CASE WHEN Date = date('now', 'localtime') THEN PackagesDelivered ELSE 0 END) as dailyPackages,
                SUM(CASE WHEN Date = date('now', 'localtime') THEN TotalDistanceKm ELSE 0 END) as dailyDistance,
                SUM(CASE WHEN Date >= date('now', '-6 days', 'localtime') THEN PackagesDelivered ELSE 0 END) as weeklyPackages,
                SUM(CASE WHEN Date >= date('now', '-6 days', 'localtime') THEN TotalDistanceKm ELSE 0 END) as weeklyDistance,
                SUM(CASE WHEN substr(Date, 1, 7) = substr(date('now', 'localtime'), 1, 7) THEN PackagesDelivered ELSE 0 END) as monthlyPackages,
                SUM(CASE WHEN substr(Date, 1, 7) = substr(date('now', 'localtime'), 1, 7) THEN TotalDistanceKm ELSE 0 END) as monthlyDistance
            FROM CourierDailyStats 
            WHERE CourierID = ?
        `).get(courierId);

        res.json({
            success: true,
            data: {
                daily: { packagesDelivered: stats.dailyPackages || 0, distanceKm: stats.dailyDistance || 0 },
                weekly: { packagesDelivered: stats.weeklyPackages || 0, distanceKm: stats.weeklyDistance || 0 },
                monthly: { packagesDelivered: stats.monthlyPackages || 0, distanceKm: stats.monthlyDistance || 0 }
            }
        });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});


// PUT /api/couriers/:id/status — update status
router.put('/:id/status', async (req, res) => {
    try {
        const { status } = req.body; // Idle | Delivering | Offline
        const db = getDb();
        if (!db) return res.status(503).json({ error: 'Database not available' });

        db.prepare('UPDATE Couriers SET Status = ? WHERE ID = ?').run(status, req.params.id);

        // Notify dashboard clients
        io.of('/couriers').emit('status:changed', { courierID: Number(req.params.id), status });

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/couriers/assign — assign one or multiple sales to courier
router.post('/assign', async (req, res) => {
    try {
        const { courierId, saleIds } = req.body;
        if (!courierId || !saleIds || !Array.isArray(saleIds) || saleIds.length === 0) {
            return res.status(400).json({ success: false, error: 'courierId and saleIds (array) are required' });
        }

        const db = getDb();
        if (!db) return res.status(503).json({ success: false, error: 'Database not available' });

        db.transaction(() => {
            // 1. Update CourierID in Sales table for the given saleIds
            const placeholders = saleIds.map(() => '?').join(',');
            db.prepare(`UPDATE Sales SET CourierID = ? WHERE ID IN (${placeholders})`)
                .run(courierId, ...saleIds);

            // Update courier status
            db.prepare('UPDATE Couriers SET Status = ? WHERE ID = ?').run('Delivering', courierId);
        })();

        // 2. Fetch the detailed sales data to send via socket
        const placeholders = saleIds.map(() => '?').join(',');
        const salesData = db.prepare(`
             SELECT 
                s.ID as deliveryId, s.ID as saleId, s.TotalAmount as totalAmount, s.PaymentMethod as paymentMethod,
                a.Name as customerName, a.Phone as customerPhone, a.Address as customerAddress
             FROM Sales s
             LEFT JOIN Accounts a ON s.AccountID = a.ID
             WHERE s.ID IN (${placeholders})
        `).all(...saleIds);

        // Fetch items for each sale
        const getItems = db.prepare(`
            SELECT p.Name as name, si.Qty as qty, si.UnitPrice as price
            FROM SaleItems si
            JOIN Products p ON si.ProductID = p.ID
            WHERE si.SaleID = ?
        `);

        const deliveriesPayload = salesData.map(sale => {
            const items = getItems.all(sale.saleId);
            return {
                deliveryId: sale.deliveryId,
                saleId: sale.saleId,
                totalAmount: sale.totalAmount,
                paymentMethod: sale.paymentMethod,
                customer: {
                    name: sale.customerName || 'Bilinmiyor',
                    phone: sale.customerPhone || '',
                    address: sale.customerAddress || 'Adres bilgisi yok'
                },
                items: items,
                assignedAt: new Date().toISOString()
            }
        });

        // 3. Emit via Socket.io to the specific courier
        io.of('/couriers').emit('new_deliveries', {
            courierId: Number(courierId),
            deliveries: deliveriesPayload
        });

        // Also notify dashboard of courier status change
        io.of('/couriers').emit('status:changed', { courierID: Number(courierId), status: 'Delivering' });

        res.json({ success: true, message: 'Sales explicitly assigned to courier', deliveriesAssigned: saleIds.length });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});


export default router;
