import { create } from 'zustand';
import api from '../lib/api';

const STORAGE_KEY = 'poslx_auth';

// Read initial state from localStorage
function getPersistedUser() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw);
    } catch (_) { /* ignore */ }
    return null;
}

export const useAuthStore = create((set) => ({
    user: getPersistedUser(),
    get isAuthenticated() { return !!this.user; },
    loading: false,
    error: null,

    login: async (pin) => {
        set({ loading: true, error: null });
        try {
            const { data } = await api.post('/staff/login', { Pin: pin });
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            set({ user: data, loading: false, error: null });
            return data;
        } catch (err) {
            const msg = err.response?.data?.error || err.message;
            set({ loading: false, error: msg });
            throw err;
        }
    },

    logout: () => {
        localStorage.removeItem(STORAGE_KEY);
        set({ user: null, error: null });
    },
}));
