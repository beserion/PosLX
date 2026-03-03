/**
 * Zustand global store for PosLX Courier app.
 */
import { create } from 'zustand';

export const useStore = create((set, get) => ({
    // --- Session ---
    session: null, // { url, lanUrl, token, courierId }
    isAuthenticated: false,
    preferPublic: false, // Set to true if LAN times out

    setSession: (session) =>
        set({ session, isAuthenticated: !!session, preferPublic: false }),

    setPreferPublic: (preferPublic) => set({ preferPublic }),

    // --- Socket Connection ---
    socketStatus: 'idle', // 'idle' | 'connecting' | 'connected' | 'error'
    socketError: '',
    setSocketStatus: (socketStatus) => set({ socketStatus }),
    setSocketError: (socketError) => set({ socketError }),
    setSocketConnected: () => set({ socketStatus: 'connected', socketError: '' }),
    setSocketConnecting: () => set({ socketStatus: 'connecting', socketError: '' }),
    setSocketFailed: (error) => set({ socketStatus: 'error', socketError: error }),

    // --- Deliveries ---
    deliveries: [],

    addDeliveries: (newDeliveries) =>
        set((state) => {
            // Avoid duplicates by saleId
            const existingIds = new Set(state.deliveries.map((d) => d.saleId));
            const unique = newDeliveries.filter((d) => !existingIds.has(d.saleId));
            return { deliveries: [...state.deliveries, ...unique] };
        }),

    removeDelivery: (saleId) =>
        set((state) => ({
            deliveries: state.deliveries.filter((d) => d.saleId !== saleId),
        })),

    clearDeliveries: () => set({ deliveries: [] }),

    // --- Status ---
    status: 'Idle', // 'Idle' | 'Delivering' | 'Offline'
    setStatus: (status) => set({ status }),

    // --- Stats ---
    stats: null,
    setStats: (stats) => set({ stats }),

    // --- Logout ---
    logout: () =>
        set({
            session: null,
            isAuthenticated: false,
            deliveries: [],
            stats: null,
            status: 'Offline',
            socketStatus: 'idle',
            socketError: '',
            preferPublic: false,
        }),
}));
