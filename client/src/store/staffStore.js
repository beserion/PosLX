import { create } from 'zustand';
import api from '../lib/api';

export const useStaffStore = create((set) => ({
  staff: [],
  currentStaff: null,
  loading: false,
  error: null,

  fetchStaff: async () => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.get('/staff');
      set({ staff: data, loading: false });
    } catch (err) {
      set({ error: err.response?.data?.error || err.message, loading: false });
    }
  },

  createStaff: async (payload) => {
    const { data } = await api.post('/staff', payload);
    set((state) => ({ staff: [...state.staff, data] }));
    return data;
  },

  updateStaff: async (id, updates) => {
    const { data } = await api.put(`/staff/${id}`, updates);
    set((state) => ({
      staff: state.staff.map((s) => (s.ID === id ? data : s)),
    }));
    return data;
  },

  deleteStaff: async (id) => {
    await api.delete(`/staff/${id}`);
    set((state) => ({
      staff: state.staff.map((s) =>
        s.ID === id ? { ...s, IsActive: 0 } : s
      ),
    }));
  },

  loginWithPin: async (pin) => {
    const { data } = await api.post('/staff/login', { Pin: pin });
    set({ currentStaff: data });
    return data;
  },

  logout: () => set({ currentStaff: null }),
}));

