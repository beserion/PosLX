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

    // Add a new courier
    addCourier: async (courierData) => {
        try {
            const { data } = await api.post('/couriers', courierData);
            set((state) => ({ couriers: [...state.couriers, data] }));
            return data;
        } catch (err) {
            throw new Error(err.response?.data?.error || err.message);
        }
    },

    // Delete a courier
    deleteCourier: async (id) => {
        try {
            await api.delete(`/couriers/${id}`);
            set((state) => ({ couriers: state.couriers.filter(c => c.ID !== id) }));
        } catch (err) {
            throw new Error(err.response?.data?.error || err.message);
        }
    },

    // Client-side optimistic updates (also triggered by socket events)
    updateLocation: (courierID, lat, lng) =>
        set((state) => ({
            couriers: state.couriers.map((c) =>
                c.ID === Number(courierID) ? { ...c, Lat: lat, Lng: lng } : c
            ),
        })),

    updateStatus: (courierID, status) =>
        set((state) => ({
            couriers: state.couriers.map((c) =>
                c.ID === Number(courierID) ? { ...c, Status: status } : c
            ),
        })),
}));
