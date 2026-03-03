import { usePosStore } from '../../store/posStore';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coffee, IceCreamCone, Cake, Sandwich, Droplets, Grid3X3 } from 'lucide-react';

const categoryIcons = {
    'Hot Drinks': Coffee,
    'Cold Drinks': Droplets,
    'Desserts': Cake,
    'Pastry': IceCreamCone,
    'Food': Sandwich,
};

export default function ProductGrid() {
    const products = usePosStore((s) => s.products);
    const addToCart = usePosStore((s) => s.addToCart);
    const [activeCategory, setActiveCategory] = useState('All');

    const posProducts = products.filter(p => p.ShowInPos !== 0 && p.ShowInPos !== false);
    const categories = ['All', ...new Set(posProducts.map((p) => p.Category))];
    const filtered = activeCategory === 'All' ? posProducts : posProducts.filter((p) => p.Category === activeCategory);

    return (
        <div className="flex flex-col gap-4 h-full">
            {/* Category Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {categories.map((cat) => {
                    const Icon = categoryIcons[cat] || Grid3X3;
                    return (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200
                ${activeCategory === cat
                                    ? 'bg-cyan-accent/15 text-cyan-accent border border-cyan-accent/30'
                                    : 'glass-card text-text-secondary hover:text-text-primary'}`}
                        >
                            <Icon size={14} />
                            {cat}
                        </button>
                    );
                })}
            </div>

            {/* Product Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 overflow-y-auto flex-1 pr-1 content-start">
                <AnimatePresence mode="popLayout">
                    {filtered.map((product) => (
                        <motion.button
                            key={product.ID}
                            layout
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => addToCart(product)}
                            className="glass-card p-4 flex flex-col items-center gap-2 cursor-pointer text-center group relative h-[140px] overflow-hidden"
                        >
                            {/* Emoji/icon placeholder */}
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                                style={{ background: 'linear-gradient(135deg, rgba(6,182,212,0.15), rgba(16,185,129,0.1))' }}>
                                {product.Category === 'Hot Drinks' ? '☕' :
                                    product.Category === 'Cold Drinks' ? '🧊' :
                                        product.Category === 'Desserts' ? '🍰' :
                                            product.Category === 'Food' ? '🥪' : '🥐'}
                            </div>
                            <span className="text-sm font-semibold text-text-primary leading-tight">{product.Name}</span>
                            <span className="text-base font-bold text-cyan-accent glow-cyan">₺{product.SalePrice}</span>

                            {/* Stock badge */}
                            <span className={`badge absolute top-2 right-2 ${product.Stock < 20 ? 'badge-danger' : 'badge-emerald'}`}>
                                {product.Stock}
                            </span>
                        </motion.button>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
}
