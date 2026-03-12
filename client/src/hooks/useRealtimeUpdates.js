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

        const handleConnect = () => setConnected(true);
        const handleDisconnect = () => setConnected(false);
        const handleNewSale = (data) => {
            addRealtimeSale(data);
            fetchSummary();
        };
        const handleNewTransaction = () => {
            fetchSummary();
        };
        const handleStatusChanged = (data) => {
            updateStatus(data.courierID, data.status);
        };
        const handleLocationUpdate = (data) => {
            console.log('📌 Socket Location Update Received:', data);
            if (data.courierId && data.latitude && data.longitude) {
                updateLocation(data.courierId, data.latitude, data.longitude);
            }
        };

        // Connection status
        salesSocket.on('connect', handleConnect);
        salesSocket.on('disconnect', handleDisconnect);

        // Listen for new sales and transactions
        salesSocket.on('sale:new', handleNewSale);
        salesSocket.on('transaction:new', handleNewTransaction);

        courierSocket.on('status:changed', handleStatusChanged);
        courierSocket.on('location:update', handleLocationUpdate);

        return () => {
            salesSocket.off('connect', handleConnect);
            salesSocket.off('disconnect', handleDisconnect);
            salesSocket.off('sale:new', handleNewSale);
            salesSocket.off('transaction:new', handleNewTransaction);

            courierSocket.off('status:changed', handleStatusChanged);
            courierSocket.off('location:update', handleLocationUpdate);

            salesSocket.disconnect();
            courierSocket.disconnect();
        };
    }, [addRealtimeSale, setConnected, updateStatus, updateLocation, fetchSummary]);
}
