import { Router } from 'express';
import { getDb } from '../config/db.js';
import { courierAuth } from '../middleware/courierAuth.js';
import { io } from '../index.js';
import sql from 'mssql';

const router = Router();

// GET /api/couriers — list all couriers
router.get('/', async (req, res) => {
    try {
        const pool = await getDb();
        if (!pool) {
            if (process.env.USE_MOCK_DATA === 'true') {
                console.warn("⚠️ DB not available, returning mock couriers");
                return res.json([
                    { ID: 1, Name: 'Ahmet Yılmaz', Phone: '+90 532 111 2233', Status: 'Delivering' },
                    { ID: 2, Name: 'Mehmet Demir', Phone: '+90 535 222 3344', Status: 'Idle' }
                ]);
            }
            return res.status(503).json({ error: 'Database not available' });
        }
        const result = await pool.request().query('SELECT * FROM Couriers ORDER BY Name');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/couriers — add a new courier
router.post('/', async (req, res) => {
    try {
        const { Name, Phone } = req.body;
        if (!Name) return res.status(400).json({ error: 'Name is required' });

        const pool = await getDb();
        if (!pool) return res.status(503).json({ error: 'Database not available' });

        const result = await pool.request()
            .input('Name', sql.NVarChar, Name)
            .input('Phone', sql.NVarChar, Phone || '')
            .input('Status', sql.NVarChar, 'Offline')
            .query('INSERT INTO Couriers (Name, Phone, Status) OUTPUT INSERTED.ID VALUES (@Name, @Phone, @Status)');

        const newId = result.recordset[0].ID;

        const createdResult = await pool.request()
            .input('id', sql.Int, newId)
            .query('SELECT * FROM Couriers WHERE ID = @id');

        res.status(201).json(createdResult.recordset[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/couriers/:id — remove a courier
router.delete('/:id', async (req, res) => {
    try {
        const pool = await getDb();
        if (!pool) return res.status(503).json({ error: 'Database not available' });

        const id = Number(req.params.id);

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            // Clear ALL foreign key references before deleting
            await (new sql.Request(transaction))
                .input('id', sql.Int, id)
                .query('UPDATE Sales SET CourierID = NULL WHERE CourierID = @id');

            await (new sql.Request(transaction))
                .input('id', sql.Int, id)
                .query('DELETE FROM CourierDailyStats WHERE CourierID = @id');

            await (new sql.Request(transaction))
                .input('id', sql.Int, id)
                .query('DELETE FROM CourierSettlements WHERE CourierID = @id');

            await (new sql.Request(transaction))
                .input('id', sql.Int, id)
                .query('DELETE FROM Couriers WHERE ID = @id');

            await transaction.commit();
        } catch (txErr) {
            await transaction.rollback();
            throw txErr;
        }

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

        const pool = await getDb();
        if (!pool) return res.status(503).json({ success: false, error: 'Database not available' });

        // Today's date YYYY-MM-DD
        const today = new Date().toISOString().split('T')[0];

        // Update or insert daily stats
        if (distanceKm !== undefined || packagesDelivered !== undefined) {
            const statsResult = await pool.request()
                .input('courierId', sql.Int, courierId)
                .input('today', sql.NVarChar, today)
                .query('SELECT * FROM CourierDailyStats WHERE CourierID = @courierId AND Date = @today');

            if (statsResult.recordset.length > 0) {
                const stats = statsResult.recordset[0];
                // Update
                await pool.request()
                    .input('distanceKm', sql.Float, distanceKm)
                    .input('packagesDelivered', sql.Int, packagesDelivered)
                    .input('statsId', sql.Int, stats.ID)
                    .query(`
                        UPDATE CourierDailyStats
                        SET 
                          TotalDistanceKm = COALESCE(@distanceKm, TotalDistanceKm),
                          PackagesDelivered = COALESCE(@packagesDelivered, PackagesDelivered)
                        WHERE ID = @statsId
                    `);
            } else {
                // Insert
                await pool.request()
                    .input('courierId', sql.Int, courierId)
                    .input('today', sql.NVarChar, today)
                    .input('distanceKm', sql.Float, distanceKm)
                    .input('packagesDelivered', sql.Int, packagesDelivered)
                    .query(`
                        INSERT INTO CourierDailyStats (CourierID, Date, TotalDistanceKm, PackagesDelivered)
                        VALUES (@courierId, @today, COALESCE(@distanceKm, 0), COALESCE(@packagesDelivered, 0))
                    `);
            }
        }

        // Persist last known location to Couriers table for initial map load on POS
        if (latitude !== undefined && longitude !== undefined) {
            await pool.request()
                .input('lat', sql.Float, latitude)
                .input('lng', sql.Float, longitude)
                .input('lastSeen', sql.Float, Date.now())
                .input('courierId', sql.Int, courierId)
                .query(`
                    UPDATE Couriers 
                    SET lat = @lat, lng = @lng, lastSeen = @lastSeen
                    WHERE ID = @courierId
                `);
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
        const pool = await getDb();
        if (!pool) return res.status(503).json({ success: false, error: 'Database not available' });

        // MSSQL Date/Time logic translation
        const statsResult = await pool.request()
            .input('courierId', sql.Int, courierId)
            .query(`
            SELECT 
                SUM(CASE WHEN CAST(Date AS DATE) = CAST(GETDATE() AS DATE) THEN PackagesDelivered ELSE 0 END) as dailyPackages,
                SUM(CASE WHEN CAST(Date AS DATE) = CAST(GETDATE() AS DATE) THEN TotalDistanceKm ELSE 0 END) as dailyDistance,
                SUM(CASE WHEN CAST(Date AS DATE) >= CAST(DATEADD(day, -6, GETDATE()) AS DATE) THEN PackagesDelivered ELSE 0 END) as weeklyPackages,
                SUM(CASE WHEN CAST(Date AS DATE) >= CAST(DATEADD(day, -6, GETDATE()) AS DATE) THEN TotalDistanceKm ELSE 0 END) as weeklyDistance,
                SUM(CASE WHEN YEAR(CAST(Date AS DATE)) = YEAR(GETDATE()) AND MONTH(CAST(Date AS DATE)) = MONTH(GETDATE()) THEN PackagesDelivered ELSE 0 END) as monthlyPackages,
                SUM(CASE WHEN YEAR(CAST(Date AS DATE)) = YEAR(GETDATE()) AND MONTH(CAST(Date AS DATE)) = MONTH(GETDATE()) THEN TotalDistanceKm ELSE 0 END) as monthlyDistance
            FROM CourierDailyStats 
            WHERE CourierID = @courierId
        `);

        const stats = statsResult.recordset[0] || {};

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
        const pool = await getDb();
        if (!pool) return res.status(503).json({ error: 'Database not available' });

        await pool.request()
            .input('status', sql.NVarChar, status)
            .input('id', sql.Int, req.params.id)
            .query('UPDATE Couriers SET Status = @status WHERE ID = @id');

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

        const pool = await getDb();
        if (!pool) return res.status(503).json({ success: false, error: 'Database not available' });

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            // 1. Update CourierID in Sales table for the given saleIds
            const idsList = saleIds.join(','); // Valid if they are definitely integers, OR can use parameters

            const reqSalesUpdate = new sql.Request(transaction);
            let inClauseQuery = [];
            saleIds.forEach((id, index) => {
                reqSalesUpdate.input(`id${index}`, sql.Int, id);
                inClauseQuery.push(`@id${index}`);
            });
            reqSalesUpdate.input('courierId', sql.Int, courierId);
            await reqSalesUpdate.query(`UPDATE Sales SET CourierID = @courierId WHERE ID IN (${inClauseQuery.join(', ')})`);

            // Update courier status
            const reqCourierUpdate = new sql.Request(transaction);
            await reqCourierUpdate
                .input('status', sql.NVarChar, 'Delivering')
                .input('courierId', sql.Int, courierId)
                .query('UPDATE Couriers SET Status = @status WHERE ID = @courierId');

            await transaction.commit();
        } catch (txErr) {
            await transaction.rollback();
            throw txErr;
        }

        // 2. Fetch the detailed sales data to send via socket
        const fetchRequest = pool.request();
        let fetchInClause = [];
        saleIds.forEach((id, index) => {
            fetchRequest.input(`id${index}`, sql.Int, id);
            fetchInClause.push(`@id${index}`);
        });

        const salesDataResult = await fetchRequest.query(`
             SELECT 
                s.ID as deliveryId, s.ID as saleId, s.TotalAmount as totalAmount, s.PaymentMethod as paymentMethod,
                a.Name as customerName, a.Phone as customerPhone, a.Address as customerAddress
             FROM Sales s
             LEFT JOIN Accounts a ON s.AccountID = a.ID
             WHERE s.ID IN (${fetchInClause.join(', ')})
        `);
        const salesData = salesDataResult.recordset;

        const deliveriesPayload = await Promise.all(salesData.map(async (sale) => {
            const itemsResult = await pool.request()
                .input('saleId', sql.Int, sale.saleId)
                .query(`
                    SELECT p.Name as name, si.Qty as qty, si.UnitPrice as price
                    FROM SaleItems si
                    JOIN Products p ON si.ProductID = p.ID
                    WHERE si.SaleID = @saleId
                `);
            const items = itemsResult.recordset;

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
        }));

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
