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

        // Courier sends its GPS position
        socket.on('location:update', (data) => {
            // data = { courierID, lat, lng }

            // Persist to database (mirror REST endpoint logic)
            try {
                const db = getDb();
                if (db && data.courierID && data.lat != null && data.lng != null) {
                    // Calculate distance from previous position
                    const current = db.prepare('SELECT Lat, Lng, DailyDistanceKM FROM Couriers WHERE ID = ?').get(data.courierID);

                    let addedKM = 0;
                    if (current && current.Lat != null && current.Lng != null && current.Lat !== 0 && current.Lng !== 0) {
                        // Haversine inline (avoids import issues)
                        const toRad = (deg) => (deg * Math.PI) / 180;
                        const R = 6371; // Earth radius in km
                        const dLat = toRad(data.lat - current.Lat);
                        const dLng = toRad(data.lng - current.Lng);
                        const a = Math.sin(dLat / 2) ** 2 +
                            Math.cos(toRad(current.Lat)) * Math.cos(toRad(data.lat)) *
                            Math.sin(dLng / 2) ** 2;
                        addedKM = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                    }

                    db.prepare('UPDATE Couriers SET Lat = ?, Lng = ?, DailyDistanceKM = DailyDistanceKM + ? WHERE ID = ?')
                        .run(data.lat, data.lng, addedKM, data.courierID);

                    console.log(`📍 Socket location saved: Courier ${data.courierID} → ${data.lat}, ${data.lng} (+${addedKM.toFixed(2)} km)`);
                }
            } catch (err) {
                console.error('Error persisting socket location:', err.message);
            }

            // Broadcast to all dashboard clients (ensure courierID is always a number)
            courierNsp.emit('location:changed', {
                courierID: Number(data.courierID),
                lat: data.lat,
                lng: data.lng,
            });
        });

        // Courier changes status
        socket.on('status:update', (data) => {
            // data = { courierID, status }

            try {
                const db = getDb();
                if (db && data.courierID && data.status) {
                    db.prepare('UPDATE Couriers SET Status = ? WHERE ID = ?').run(data.status, data.courierID);
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
        socket.on('delivery:complete', (data) => {
            // data = { courierId, deliveryId }
            const { courierId, deliveryId } = data;
            console.log(`📦 Courier ${courierId} completed delivery #${deliveryId}`);

            try {
                const db = getDb();
                if (db && courierId) {
                    // Update courier status to Idle
                    db.prepare('UPDATE Couriers SET Status = ? WHERE ID = ?').run('Idle', courierId);

                    // Optional: You could also update the sale status here if there was a status column in Sales
                    // db.prepare('UPDATE Sales SET Status = ? WHERE ID = ?').run('Completed', deliveryId);
                }

                // Notify dashboard of status change
                courierNsp.emit('status:changed', {
                    courierID: Number(courierId),
                    status: 'Idle',
                });

                // Notify back to courier to clear their active delivery state
                socket.emit('delivery_completed', { deliveryId });

            } catch (err) {
                console.error('Error handling delivery:complete:', err.message);
            }
        });

        socket.on('disconnect', () => {
            console.log(`🔌 Courier socket disconnected: ${socket.id}`);
            // Remove from registry
            for (const [courierId, socketId] of courierSockets.entries()) {
                if (socketId === socket.id) {
                    courierSockets.delete(courierId);
                    console.log(`🔌 Courier ${courierId} unregistered.`);
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
