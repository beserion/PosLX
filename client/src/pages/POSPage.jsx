import ProductGrid from '../components/pos/ProductGrid';
import CheckoutList from '../components/pos/CheckoutList';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { usePosStore } from '../store/posStore';
import { ShoppingBag } from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { salesSocket } from '../lib/socket';

export default function POSPage() {
    const isMobile = useMediaQuery('(max-width: 767px)');
    const [drawerOpen, setDrawerOpen] = useState(false);
    const cart = usePosStore((s) => s.cart);
    const fetchProducts = usePosStore((s) => s.fetchProducts);
    const fetchSpecialPrices = usePosStore((s) => s.fetchSpecialPrices);

    useEffect(() => {
        fetchProducts();
        fetchSpecialPrices();

        salesSocket.connect();

        const handleUpdate = () => {
            fetchProducts();
        };

        salesSocket.on('sale:new', handleUpdate);

        return () => {
            salesSocket.off('sale:new', handleUpdate);
        };
    }, []);

    return (
        <div className={`flex ${isMobile ? 'flex-col' : 'gap-4'} h-[calc(100vh-2rem)]`}>
            {/* Left — Product Grid */}
            <div className="flex-1 min-w-0 flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                    <h1 className="text-xl font-bold text-text-primary">Point of Sale</h1>
                    <span className="badge badge-cyan">Live</span>
                </div>
                <div className="flex-1 min-h-0">
                    <ProductGrid />
                </div>
            </div>

            {/* Right — Checkout (Desktop) */}
            {!isMobile && (
                <div className="w-[460px] shrink-0">
                    <CheckoutList />
                </div>
            )}

            {/* Mobile — Floating Cart Button */}
            {isMobile && !drawerOpen && (
                <motion.button
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setDrawerOpen(true)}
                    className="fixed bottom-20 right-4 z-40 w-14 h-14 rounded-2xl btn-primary flex items-center justify-center shadow-lg"
                >
                    <ShoppingBag size={22} />
                    {cart.length > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                            {cart.length}
                        </span>
                    )}
                </motion.button>
            )}

            {/* Mobile — Checkout Drawer */}
            <AnimatePresence>
                {isMobile && drawerOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setDrawerOpen(false)}
                            className="fixed inset-0 bg-black/60 z-40"
                        />
                        {/* Drawer */}
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                            className="fixed bottom-0 left-0 right-0 z-50 max-h-[85vh]"
                            style={{ borderRadius: '24px 24px 0 0' }}
                        >
                            {/* Drag handle */}
                            <div className="flex justify-center pt-3 pb-1 bg-surface-dark" style={{ borderRadius: '24px 24px 0 0' }}>
                                <div className="w-10 h-1 rounded-full bg-white/20" onClick={() => setDrawerOpen(false)} />
                            </div>
                            <div className="h-[80vh]">
                                <CheckoutList onClose={() => setDrawerOpen(false)} />
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
