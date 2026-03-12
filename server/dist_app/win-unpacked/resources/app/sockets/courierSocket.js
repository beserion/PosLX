/**
 * Socket.io handler for real-time courier GPS tracking and sale notifications.
 */

import { getDb } from '../config/db.js';

export const courierSockets = new Map();

export function setupCourierSocket(io) {
    const courierNsp = io.of('/couriers');

    courierNsp.on('connection', (socket) => {
        console.log(`🔌 Courier socket connected: ${socket.id}`);

        socket.on('courier:register', (data) => {
            if (data && data.courierId) {
                courierSockets.set(data.courierId, socket.id);
                console.log(`🔌 Courier ${data.courierId} registered on socket: ${socket.id}`);
            }
        });


        // Courier changes status
        socket.on('status:update', async (data) => {
            // data = { courierID, status }
            try {
                const pool = await getDb();
                if (pool && data.courierID && data.status) {
                    await pool.request()
                        .input('status', data.status)
                        .input('id', data.courierID)
                        .query('UPDATE Couriers SET Status = @status WHERE ID = @id');
                }
            } catch (err) {
                console.error('Error updating courier status from socket:', err.message);
            }

            courierNsp.emit('status:changed', {
                courierID: Number(data.courierID),
                status: data.status,
            });
        });

        // Courier confirms delivery completion
        socket.on('delivery:complete', async (data) => {
            // data = { courierId, deliveryId }
            const { courierId, deliveryId } = data;
            console.log(`📦 Courier ${courierId} completed delivery #${deliveryId}`);

            try {
                const pool = await getDb();
                if (pool && courierId) {
                    await pool.request()
                        .input('status', 'Idle')
                        .input('id', courierId)
                        .query('UPDATE Couriers SET Status = @status WHERE ID = @id');
                }

                courierNsp.emit('status:changed', {
                    courierID: Number(courierId),
                    status: 'Idle',
                });

                socket.emit('delivery_completed', { deliveryId });
            } catch (err) {
                console.error('Error handling delivery:complete:', err.message);
            }
        });

        socket.on('disconnect', async () => {
            console.log(`🔌 Courier socket disconnected: ${socket.id}`);
            // Remove from registry
            for (const [courierId, socketId] of courierSockets.entries()) {
                if (socketId === socket.id) {
                    try {
                        const pool = await getDb();
                        if (pool) {
                            await pool.request()
                                .input('status', 'Offline')
                                .input('id', courierId)
                                .query('UPDATE Couriers SET Status = @status WHERE ID = @id');
                        }
                        courierNsp.emit('status:changed', {
                            courierID: Number(courierId),
                            status: 'Offline',
                        });
                    } catch (err) {
                        console.error('Error setting courier offline:', err.message);
                    }

                    courierSockets.delete(courierId);
                    console.log(`🔌 Courier ${courierId} unregistered and marked Offline.`);
                    break;
                }
            }
        });
    });

    // Sale notification namespace (used by POS → Dashboard)
    const salesNsp = io.of('/sales');

    salesNsp.on('connection', (socket) => {
        console.log(`🔌 Sales socket connected: ${socket.id}`);

        socket.on('sale:completed', (data) => {
            // Broadcast to all dashboard clients
            salesNsp.emit('sale:new', data);
        });

        socket.on('disconnect', () => {
            console.log(`🔌 Sales socket disconnected: ${socket.id}`);
        });
    });
}
