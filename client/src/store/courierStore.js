import { create } from 'zustand';
import api from '../lib/api';

export const useCourierStore = create((set) => ({
    couriers: [],
    loading: false,
    error: null,

    // Fetch couriers from API
    fetchCouriers: async () => {
        set({ loading: true, error: null });
        try {
            const { data } = await api.get('/couriers');
            set({ couriers: data, loading: false });
        } catch (err) {
            set({ error: err.response?.data?.error || err.message, loading: false });
        }
    },

    // Client-side optimistic updates (also triggered by socket events)
    updateLocation: (courierID, lat, lng) =>
        set((state) => ({
            couriers: state.couriers.map((c) =>
                c.ID === courierID ? { ...c, Lat: lat, Lng: lng } : c
            ),
        })),

    updateStatus: (courierID, status) =>
        set((state) => ({
            couriers: state.couriers.map((c) =>
                c.ID === courierID ? { ...c, Status: status } : c
            ),
        })),
}));
