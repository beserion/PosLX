/**
 * Socket.io handler for real-time courier GPS tracking and sale notifications.
 */
export function setupCourierSocket(io) {
    const courierNsp = io.of('/couriers');

    courierNsp.on('connection', (socket) => {
        console.log(`🔌 Courier socket connected: ${socket.id}`);

        // Courier sends its GPS position
        socket.on('location:update', (data) => {
            // data = { courierID, lat, lng, status }
            // Broadcast to all dashboard clients
            courierNsp.emit('location:changed', data);
        });

        // Courier changes status
        socket.on('status:update', (data) => {
            // data = { courierID, status }
            courierNsp.emit('status:changed', data);
        });

        socket.on('disconnect', () => {
            console.log(`🔌 Courier socket disconnected: ${socket.id}`);
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
