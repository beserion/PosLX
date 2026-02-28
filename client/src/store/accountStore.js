import { create } from 'zustand';
import api from '../lib/api';

export const useAccountStore = create((set, get) => ({
    accounts: [],
    currentAccount: null,
    ledger: [],
    loading: false,
    error: null,

    fetchAccounts: async (type) => {
        set({ loading: true, error: null });
        try {
            const params = type ? { type } : {};
            const { data } = await api.get('/accounts', { params });
            set({ accounts: data, loading: false });
        } catch (err) {
            set({ error: err.response?.data?.error || err.message, loading: false });
        }
    },

    fetchAccount: async (id) => {
        try {
            const { data } = await api.get(`/accounts/${id}`);
            set({ currentAccount: data });
            return data;
        } catch (err) {
            console.error('Failed to fetch account:', err.message);
        }
    },

    fetchLedger: async (id, startDate, endDate) => {
        try {
            const params = {};
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;
            const { data } = await api.get(`/accounts/${id}/ledger`, { params });
            set({ ledger: data });
        } catch (err) {
            console.error('Failed to fetch ledger:', err.message);
        }
    },

    createAccount: async (accountData) => {
        const { data } = await api.post('/accounts', accountData);
        get().fetchAccounts();
        return data;
    },

    updateAccount: async (id, updates) => {
        const { data } = await api.put(`/accounts/${id}`, updates);
        get().fetchAccounts();
        return data;
    },

    deleteAccount: async (id) => {
        await api.delete(`/accounts/${id}`);
        get().fetchAccounts();
    },

    recordPayment: async (id, paymentData) => {
        const { data } = await api.post(`/accounts/${id}/payment`, paymentData);
        get().fetchAccount(id);
        get().fetchLedger(id);
        return data;
    },
}));
