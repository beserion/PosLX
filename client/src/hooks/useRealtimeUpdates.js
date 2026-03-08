import { useEffect } from 'react';
import { courierSocket, salesSocket } from '../lib/socket';
import { useDashboardStore } from '../store/dashboardStore';
import { useCourierStore } from '../store/courierStore';
import { useToast } from './useToast';

/**
 * Hook to manage real-time Socket.io connections for Dashboard.
 * Listens for new sales and courier location updates.
 */
export function useRealtimeUpdates() {
    const addRealtimeSale = useDashboardStore((s) => s.addRealtimeSale);
    const setConnected = useDashboardStore((s) => s.setConnected);
    const fetchSummary = useDashboardStore((s) => s.fetchSummary);
    const updateStatus = useCourierStore((s) => s.updateStatus);
    const updateLocation = useCourierStore((s) => s.updateLocation);
    const toast = useToast();

    useEffect(() => {
        // Connect sockets
        salesSocket.connect();
        courierSocket.connect();

        // Connection status
        salesSocket.on('connect', () => setConnected(true));
        salesSocket.on('disconnect', () => setConnected(false));

        // Listen for new sales and transactions
        salesSocket.on('sale:new', (data) => {
            addRealtimeSale(data);
            fetchSummary();
        });

        salesSocket.on('transaction:new', () => {
            fetchSummary();
        });

        courierSocket.on('status:changed', (data) => {
            updateStatus(data.courierID, data.status);
        });

        courierSocket.on('location:update', (data) => {
            if (data.courierId && data.latitude && data.longitude) {
                updateLocation(data.courierId, data.latitude, data.longitude);
            }
        });

        return () => {
            salesSocket.off('sale:new');
            salesSocket.off('transaction:new');
            salesSocket.off('connect');
            salesSocket.off('disconnect');
            courierSocket.off('location:changed');
            courierSocket.off('status:changed');
            salesSocket.disconnect();
            courierSocket.disconnect();
        };
    }, [addRealtimeSale, setConnected, updateStatus, updateLocation, fetchSummary]);
}
