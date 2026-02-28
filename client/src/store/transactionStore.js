import { create } from 'zustand';
import api from '../lib/api';

const today = () => new Date().toISOString().slice(0, 10);

export const useTransactionStore = create((set, get) => ({
    transactions: [],
    dailyReport: null,
    startDate: today(),
    endDate: today(),
    loading: false,
    error: null,

    setDateRange: (start, end) => {
        set({ startDate: start, endDate: end });
        get().fetchTransactions();
        get().fetchDailyReport();
    },

    fetchTransactions: async () => {
        set({ loading: true, error: null });
        try {
            const { startDate, endDate } = get();
            const { data } = await api.get('/transactions', { params: { startDate, endDate } });
            set({ transactions: data, loading: false });
        } catch (err) {
            set({ error: err.response?.data?.error || err.message, loading: false });
        }
    },

    fetchDailyReport: async () => {
        try {
            const { startDate, endDate } = get();
            const { data } = await api.get('/transactions/daily-report', { params: { startDate, endDate } });
            set({ dailyReport: data });
        } catch (err) {
            console.error('Daily report fetch failed:', err.message);
        }
    },

    createTransaction: async (txData) => {
        const { data } = await api.post('/transactions', txData);
        get().fetchTransactions();
        get().fetchDailyReport();
        return data;
    },
}));
