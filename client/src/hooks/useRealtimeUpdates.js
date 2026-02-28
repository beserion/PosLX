import { useEffect } from 'react';
import { courierSocket, salesSocket } from '../lib/socket';
import { useDashboardStore } from '../store/dashboardStore';
import { useCourierStore } from '../store/courierStore';

/**
 * Hook to manage real-time Socket.io connections for Dashboard.
 * Listens for new sales and courier location updates.
 */
export function useRealtimeUpdates() {
    const addRealtimeSale = useDashboardStore((s) => s.addRealtimeSale);
    const setConnected = useDashboardStore((s) => s.setConnected);
    const updateLocation = useCourierStore((s) => s.updateLocation);
    const updateStatus = useCourierStore((s) => s.updateStatus);

    useEffect(() => {
        // Connect sockets
        salesSocket.connect();
        courierSocket.connect();

        // Connection status
        salesSocket.on('connect', () => setConnected(true));
        salesSocket.on('disconnect', () => setConnected(false));

        // Listen for new sales
        salesSocket.on('sale:new', (data) => {
            addRealtimeSale(data);
        });

        // Listen for courier location changes
        courierSocket.on('location:changed', (data) => {
            updateLocation(data.courierID, data.lat, data.lng);
        });

        courierSocket.on('status:changed', (data) => {
            updateStatus(data.courierID, data.status);
        });

        return () => {
            salesSocket.off('sale:new');
            salesSocket.off('connect');
            salesSocket.off('disconnect');
            courierSocket.off('location:changed');
            courierSocket.off('status:changed');
            salesSocket.disconnect();
            courierSocket.disconnect();
        };
    }, [addRealtimeSale, setConnected, updateLocation, updateStatus]);
}
