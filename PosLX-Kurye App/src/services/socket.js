/**
 * Socket.io client wrapper for real-time courier communication.
 * Connects to the /couriers namespace on the PosLX backend.
 * All connection status is managed through the zustand store so the UI
 * always reflects the correct state even when socket instances are swapped
 * during LAN→Public fallback.
 */
import { io } from 'socket.io-client';
import { useStore } from '../store/useStore';

let socket = null;
let deliveryCallback = null;
let deliveryCompletedCallback = null;

/**
 * Attach event listeners that survive socket instance swaps.
 * Called every time a new socket instance is created.
 */
function attachListeners(sock, token, courierId) {
    const store = useStore.getState;

    sock.on('connect', () => {
        console.log('🔌 Socket connected:', sock.id);
        store().setSocketConnected();

        // Auto-register courier on connect
        const id = Number(courierId);
        sock.emit('courier:register', { courierId: id });
        console.log('🔌 Registered courier:', id);

        // Set status to Idle
        store().setStatus('Idle');
    });

    sock.on('connect_error', (err) => {
        console.error('🔌 Socket connection error:', err.message);
        store().setSocketFailed(err.message || 'Bağlantı hatası');
    });

    sock.on('disconnect', (reason) => {
        console.log('🔌 Socket disconnected:', reason);
        store().setSocketConnecting();
    });

    sock.io.on('error', (err) => {
        console.error('🔌 Socket.IO Manager error:', err.message || err);
    });

    // Re-attach delivery listeners if they were registered
    if (deliveryCallback) {
        sock.on('new_deliveries', deliveryCallback);
        sock.on('delivery_started', deliveryCallback);
    }
    if (deliveryCompletedCallback) {
        sock.on('delivery_completed', deliveryCompletedCallback);
    }
}

/**
 * Connect to the courier namespace.
 * Tries LAN first (if available and not previously failed), then falls back to Public URL.
 */
export function connectSocket(url, lanUrl, token, courierId) {
    if (socket?.connected) return socket;

    const { preferPublic } = useStore.getState();
    useStore.getState().setSocketConnecting();

    // Clean URLs
    const cleanUrl = url ? url.replace(/\/+$/, '') : null;
    const cleanLanUrl = lanUrl ? lanUrl.replace(/\/+$/, '') : null;

    // Decide which URL to use
    const primaryUrl = (preferPublic && cleanUrl) ? cleanUrl : (cleanLanUrl || cleanUrl);
    const fallbackUrl = (primaryUrl === cleanLanUrl && cleanUrl) ? cleanUrl : null;

    console.log('🔌 Socket connecting to:', primaryUrl, '| fallback:', fallbackUrl, '| preferPublic:', preferPublic);

    // Disconnect old socket if any
    if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
        socket = null;
    }

    socket = io(primaryUrl + '/couriers', {
        auth: { token },
        path: '/socket.io/',
        transports: ['websocket', 'polling'],
        upgrade: true,
        reconnection: true,
        reconnectionAttempts: fallbackUrl ? 2 : Infinity, // If we have a fallback, only try primary twice
        reconnectionDelay: 2000,
        timeout: (primaryUrl === cleanLanUrl) ? 3000 : 10000,
        forceNew: true,
        withCredentials: false,
    });

    attachListeners(socket, token, courierId);

    // If we have a fallback, set up the switch mechanism
    if (fallbackUrl) {
        let switchAttempted = false;

        socket.io.on('reconnect_failed', () => {
            if (!switchAttempted) {
                switchAttempted = true;
                console.log('🔄 Primary exhausted retries, switching to Public URL:', fallbackUrl);
                switchToFallback(fallbackUrl, token, courierId);
            }
        });

        // Also switch on first connect_error if it's a network/timeout issue
        const originalErrorHandler = () => {
            // After 2 failed connection attempts, socket.io triggers reconnect_failed
            // But we can also handle it here for faster switching
            if (!switchAttempted && socket && !socket.connected) {
                // Wait for reconnect_failed to handle it
            }
        };
    }

    return socket;
}

/**
 * Switch to fallback (public) URL.
 */
function switchToFallback(fallbackUrl, token, courierId) {
    console.log('🔄 Switching socket to fallback:', fallbackUrl);
    useStore.getState().setPreferPublic(true);
    useStore.getState().setSocketConnecting();

    // Destroy old socket
    if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
        socket = null;
    }

    // Create new socket to public URL with infinite reconnection
    socket = io(fallbackUrl + '/couriers', {
        auth: { token },
        path: '/socket.io/',
        transports: ['websocket', 'polling'],
        upgrade: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 2000,
        timeout: 10000,
        forceNew: true,
        withCredentials: false,
    });

    attachListeners(socket, token, courierId);
}

/**
 * Listen for new delivery assignments from POS.
 */
export function onNewDeliveries(callback) {
    deliveryCallback = callback;
    if (!socket) return;
    socket.off('new_deliveries');
    socket.on('new_deliveries', callback);
    socket.off('delivery_started');
    socket.on('delivery_started', callback);
}

/**
 * Listen for delivery completed confirmation from server.
 */
export function onDeliveryCompleted(callback) {
    deliveryCompletedCallback = callback;
    if (!socket) return;
    socket.off('delivery_completed');
    socket.on('delivery_completed', callback);
}

/**
 * Register courier on the socket (called externally if needed).
 */
export function registerCourier(courierId) {
    if (socket?.connected) {
        const id = Number(courierId);
        socket.emit('courier:register', { courierId: id });
        console.log('🔌 Registered courier:', id);
    }
}

/**
 * Emit delivery completion.
 */
export function completeDelivery(courierId, deliveryId) {
    if (socket?.connected) {
        socket.emit('delivery:complete', { courierId, deliveryId });
        console.log('🔌 Delivery complete emitted:', deliveryId);
    }
}

/**
 * Disconnect socket (logout / app close).
 */
export function disconnectSocket() {
    deliveryCallback = null;
    deliveryCompletedCallback = null;
    if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
        socket = null;
    }
}

/**
 * Get the current socket instance.
 */
export function getSocket() {
    return socket;
}
