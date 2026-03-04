import { create } from 'zustand';
import api from '../lib/api';

export const useTunnelStore = create((set) => ({
    connected: false,
    url: null,
    lanUrl: null,
    token: null,
    loading: true,
    error: null,

    fetchStatus: async () => {
        try {
            const { data } = await api.get('/tunnel/status');
            set({ connected: data.connected, url: data.url, loading: false, error: null });
        } catch (err) {
            set({ connected: false, url: null, loading: false, error: err.message });
        }
    },

    fetchQrData: async () => {
        try {
            const { data } = await api.get('/tunnel/qr-data');
            set({
                connected: data.connected,
                url: data.url,
                lanUrl: data.lanUrl,
                token: data.token,
                loading: false,
                error: null,
            });
        } catch (err) {
            set({ loading: false, error: err.message });
        }
    },
}));
