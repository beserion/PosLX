import { create } from 'zustand';
import api from '../lib/api';

export const useDashboardStore = create((set, get) => ({
    // Date filter
    datePreset: 'week', // today | week | month | quarter | custom
    customStart: null,
    customEnd: null,

    // Dashboard data
    revenue: 0,
    profit: 0,
    salesCount: 0,
    loading: false,

    // Realtime
    recentSales: [],
    isConnected: false,

    // Actions
    setDatePreset: (preset) => {
        set({ datePreset: preset });
        get().fetchSummary();
    },

    setCustomRange: (start, end) => {
        set({ datePreset: 'custom', customStart: start, customEnd: end });
        get().fetchSummary();
    },

    setConnected: (val) => set({ isConnected: val }),

    addRealtimeSale: (sale) =>
        set((state) => ({
            recentSales: [sale, ...state.recentSales].slice(0, 50),
        })),

    // Fetch summary from API
    fetchSummary: async () => {
        set({ loading: true });
        try {
            const state = get();
            const params = {};
            if (state.datePreset !== 'custom') {
                params.preset = state.datePreset;
            } else {
                params.start = state.customStart;
                params.end = state.customEnd;
            }
            const { data } = await api.get('/sales/summary', { params });
            set({
                revenue: data.TotalRevenue || 0,
                profit: data.NetProfit || 0,
                salesCount: data.TotalSales || 0,
                loading: false,
            });
        } catch (err) {
            console.error('Dashboard summary fetch failed:', err.message);
            set({ loading: false });
        }
    },

    // Getter for compatibility with existing components
    getData: () => {
        const state = get();
        return {
            revenue: state.revenue,
            profit: state.profit,
            salesCount: state.salesCount,
            sparkData: [],
            change: 0,
        };
    },
}));
