import { create } from 'zustand';
import api from '../lib/api';

export const usePosStore = create((set, get) => ({
    products: [],
    categories: [],
    cart: [],
    paymentMethod: 'Cash',
    checkoutCourierID: null,
    lastSale: null,
    loading: false,
    error: null,
    discountAmount: 0,
    serviceFeeCount: 0,
    serviceFeeSetting: 0,
    taxRateSetting: 8,

    setDiscountAmount: (amount) => set({ discountAmount: amount }),
    addServiceFee: () => set((state) => ({ serviceFeeCount: state.serviceFeeCount + 1 })),
    removeServiceFee: () => set((state) => ({ serviceFeeCount: Math.max(0, state.serviceFeeCount - 1) })),

    fetchSettings: async () => {
        try {
            const { data } = await api.get('/settings');
            if (data.serviceFeeAmount) {
                set({ serviceFeeSetting: Number(data.serviceFeeAmount) });
            }
            if (data.taxRate) {
                set({ taxRateSetting: Number(data.taxRate) });
            }
        } catch (err) {
            console.error('Failed to fetch settings for POS:', err.message);
        }
    },

    setCheckoutCourierID: (id) => set({ checkoutCourierID: id }),

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
        const { data } = await api.delete(`/products/${productID}`);
        // Whether hard or soft delete, remove from local lists
        if (data?.success) {
            set((state) => ({
                products: state.products.filter((p) => p.ID !== productID),
                cart: state.cart.filter((c) => c.ID !== productID),
            }));
        }
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

    // ── Special Prices ────────────────────────────
    fetchSpecialPrices: async () => {
        try {
            const { data } = await api.get('/special-prices');
            set({ specialPrices: data });
        } catch (err) {
            console.error('Failed to fetch special prices:', err.message);
        }
    },

    // ── Cart Actions (client-side only) ──────────
    addToCart: (product) =>
        set((state) => {
            // Find active global special price for this product (AccountID null)
            const today = new Date().toISOString().slice(0, 10);
            const sp = state.specialPrices?.find((p) => {
                if (p.ProductID !== product.ID) return false;
                if (p.AccountID) return false;
                if (p.IsActive === 0) return false;
                if (p.StartDate && p.StartDate.slice(0, 10) > today) return false;
                if (p.EndDate && p.EndDate.slice(0, 10) < today) return false;
                return true;
            });
            const effectivePrice = sp?.SpecialPrice ?? product.SalePrice;

            const existing = state.cart.find((c) => c.ID === product.ID);
            if (existing) {
                return {
                    cart: state.cart.map((c) =>
                        c.ID === product.ID ? { ...c, qty: c.qty + 1 } : c
                    ),
                };
            }
            return {
                cart: [
                    ...state.cart,
                    { ...product, qty: 1, EffectivePrice: effectivePrice },
                ],
            };
        }),

    removeFromCart: (productID) =>
        set((state) => ({ cart: state.cart.filter((c) => c.ID !== productID) })),

    updateQty: (productID, qty) =>
        set((state) => {
            if (qty <= 0) return { cart: state.cart.filter((c) => c.ID !== productID) };
            return { cart: state.cart.map((c) => (c.ID === productID ? { ...c, qty } : c)) };
        }),

    setPaymentMethod: (method) => set({ paymentMethod: method }),

    clearCart: () => set({ cart: [], paymentMethod: 'Cash', checkoutCourierID: null, discountAmount: 0, serviceFeeCount: 0 }),

    getSubtotal: () =>
        get().cart.reduce(
            (sum, c) => sum + (c.EffectivePrice ?? c.SalePrice) * c.qty,
            0
        ),
    getTax: () => get().getSubtotal() * (get().taxRateSetting / 100), // Adjust tax logic as needed based on net vs gross 
    getTotal: () => {
        const subtotal = get().getSubtotal();
        const tax = get().getTax();
        let total = subtotal + tax;
        if (get().serviceFeeCount > 0) {
            total += get().serviceFeeCount * get().serviceFeeSetting;
        }
        total -= get().discountAmount;
        return total > 0 ? total : 0;
    },

    findByBarcode: (barcode) => get().products.find((p) => p.Barcodes?.includes(barcode) || p.Barcode === barcode) || null,

    completeSale: async () => {
        const state = get();
        if (state.cart.length === 0) return null;

        const subtotal = state.getSubtotal();
        const tax = state.getTax();
        const total = state.getTotal();

        try {
            const appliedServiceFee = state.serviceFeeCount * state.serviceFeeSetting;
            const { data } = await api.post('/sales', {
                items: state.cart.map((c) => ({
                    productID: c.ID,
                    qty: c.qty,
                    unitPrice: c.EffectivePrice ?? c.SalePrice,
                })),
                paymentMethod: state.paymentMethod,
                tax,
                discount: state.discountAmount,
                serviceFee: appliedServiceFee,
                courierID: state.checkoutCourierID || null,
            });

            const saleData = {
                receiptNo: String(data.saleID).padStart(4, '0'),
                items: [...state.cart],
                subtotal,
                tax,
                discount: state.discountAmount,
                serviceFee: appliedServiceFee,
                total,
                paymentMethod: state.paymentMethod,
                date: new Date(),
            };

            set({ lastSale: saleData, cart: [], paymentMethod: 'Cash', checkoutCourierID: null, discountAmount: 0, serviceFeeCount: 0 });

            // Refresh product stock from server
            get().fetchProducts();

            return saleData;
        } catch (err) {
            console.error('Sale failed:', err.message);
            throw err;
        }
    },
}));
