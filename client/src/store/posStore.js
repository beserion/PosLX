import { create } from 'zustand';
import api from '../lib/api';

export const usePosStore = create((set, get) => ({
    products: [],
    categories: [],
    cart: [],
    paymentMethod: 'Cash',
    lastSale: null,
    loading: false,
    error: null,

    // ── Fetch from API ────────────────────────────
    fetchProducts: async () => {
        set({ loading: true, error: null });
        try {
            const { data } = await api.get('/products');
            set({ products: data, loading: false });
        } catch (err) {
            set({ error: err.response?.data?.error || err.message, loading: false });
        }
    },

    fetchCategories: async () => {
        try {
            const { data } = await api.get('/categories');
            set({ categories: data.map((c) => c.Name) });
        } catch (err) {
            console.error('Failed to fetch categories:', err.message);
        }
    },

    // ── Product CRUD (API-driven) ────────────────
    addProduct: async (productData) => {
        const { data } = await api.post('/products', productData);
        set((state) => ({ products: [...state.products, data] }));
        return data;
    },

    updateProduct: async (productID, updates) => {
        const { data } = await api.put(`/products/${productID}`, updates);
        set((state) => ({
            products: state.products.map((p) => (p.ID === productID ? data : p)),
        }));
        return data;
    },

    deleteProduct: async (productID) => {
        await api.delete(`/products/${productID}`);
        set((state) => ({
            products: state.products.filter((p) => p.ID !== productID),
            cart: state.cart.filter((c) => c.ID !== productID),
        }));
    },

    // ── Category CRUD (API-driven) ───────────────
    addCategory: async (name) => {
        const { data } = await api.post('/categories', { Name: name });
        set((state) => ({ categories: [...state.categories, data.Name] }));
        return data;
    },

    renameCategory: async (categoryId, newName) => {
        const { data } = await api.put(`/categories/${categoryId}`, { Name: newName });
        // Refresh products since category names may have changed
        get().fetchProducts();
        set((state) => ({
            categories: state.categories.map((c) => (c === data.Name ? data.Name : c)),
        }));
        // Refresh categories from server to stay in sync
        get().fetchCategories();
        return data;
    },

    deleteCategory: async (categoryId) => {
        await api.delete(`/categories/${categoryId}`);
        // Refresh both since products may have moved to 'Genel'
        get().fetchProducts();
        get().fetchCategories();
    },

    // ── Cart Actions (client-side only) ──────────
    addToCart: (product) =>
        set((state) => {
            const existing = state.cart.find((c) => c.ID === product.ID);
            if (existing) {
                return { cart: state.cart.map((c) => (c.ID === product.ID ? { ...c, qty: c.qty + 1 } : c)) };
            }
            return { cart: [...state.cart, { ...product, qty: 1 }] };
        }),

    removeFromCart: (productID) =>
        set((state) => ({ cart: state.cart.filter((c) => c.ID !== productID) })),

    updateQty: (productID, qty) =>
        set((state) => {
            if (qty <= 0) return { cart: state.cart.filter((c) => c.ID !== productID) };
            return { cart: state.cart.map((c) => (c.ID === productID ? { ...c, qty } : c)) };
        }),

    setPaymentMethod: (method) => set({ paymentMethod: method }),

    clearCart: () => set({ cart: [], paymentMethod: 'Cash' }),

    getSubtotal: () => get().cart.reduce((sum, c) => sum + c.SalePrice * c.qty, 0),
    getTax: () => get().getSubtotal() * 0.08,
    getTotal: () => get().getSubtotal() + get().getTax(),

    findByBarcode: (barcode) => get().products.find((p) => p.Barcodes?.includes(barcode) || p.Barcode === barcode) || null,

    completeSale: async () => {
        const state = get();
        if (state.cart.length === 0) return null;

        const subtotal = state.getSubtotal();
        const tax = state.getTax();
        const total = state.getTotal();

        try {
            const { data } = await api.post('/sales', {
                items: state.cart.map((c) => ({
                    productID: c.ID,
                    qty: c.qty,
                    unitPrice: c.SalePrice,
                })),
                paymentMethod: state.paymentMethod,
                tax,
                discount: 0,
            });

            const saleData = {
                receiptNo: String(data.saleID).padStart(4, '0'),
                items: [...state.cart],
                subtotal,
                tax,
                total,
                paymentMethod: state.paymentMethod,
                date: new Date(),
            };

            set({ lastSale: saleData, cart: [], paymentMethod: 'Cash' });

            // Refresh product stock from server
            get().fetchProducts();

            return saleData;
        } catch (err) {
            console.error('Sale failed:', err.message);
            throw err;
        }
    },
}));
