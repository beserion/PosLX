import { usePosStore } from '../../store/posStore';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ProductGrid() {
    const products = usePosStore((s) => s.products);
    const addToCart = usePosStore((s) => s.addToCart);
    const [activeCategory, setActiveCategory] = useState('All');
    const [search, setSearch] = useState('');

    const posProducts = products.filter(p => p.ShowInPos !== 0 && p.ShowInPos !== false);
    const categories = ['All', ...new Set(posProducts.map((p) => p.Category).filter(Boolean))];

    const filtered = posProducts.filter(p => {
        const matchCat = activeCategory === 'All' || p.Category === activeCategory;
        const matchSearch = !search || p.Name?.toLowerCase().includes(search.toLowerCase());
        return matchCat && matchSearch;
    });

    return (
        <div className="flex flex-col gap-3 h-full">
            {/* Category Tabs — compact wrapping pills */}
            <div className="flex flex-wrap gap-1.5 items-center">
                {categories.map((cat) => (
                    <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer border
                            ${activeCategory === cat
                                ? 'bg-cyan-accent/20 text-cyan-accent border-cyan-accent/40 shadow-[0_0_8px_rgba(34,211,238,0.15)]'
                                : 'bg-white/5 text-text-muted hover:text-text-primary hover:bg-white/10 border-white/5'}`}
                    >
                        {cat === 'All' ? '⊞ Tümü' : cat}
                    </button>
                ))}

                {/* Inline search */}
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Ürün ara..."
                    className="ml-auto px-3 py-1 rounded-lg text-xs bg-white/5 border border-white/10 text-text-primary outline-none placeholder:text-text-muted/50 focus:border-cyan-accent/40 transition-colors w-36"
                />
            </div>

            {/* Product Grid — compact cards */}
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 overflow-y-auto flex-1 pr-1 content-start custom-scrollbar">
                <AnimatePresence mode="popLayout">
                    {filtered.map((product) => (
                        <motion.button
                            key={product.ID}
                            layout
                            initial={{ opacity: 0, scale: 0.92 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.92 }}
                            transition={{ duration: 0.12 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => addToCart(product)}
                            className="glass-card p-2.5 flex flex-col items-center justify-between gap-1 cursor-pointer text-center group relative overflow-hidden min-h-[80px] hover:border-cyan-accent/20 transition-all"
                        >
                            {/* Stock badge */}
                            <span className={`absolute top-1.5 right-1.5 text-[9px] font-bold px-1 py-0.5 rounded leading-none
                                ${product.Stock <= 0 ? 'bg-red-500/30 text-red-300' :
                                  product.Stock < 20 ? 'bg-amber-500/30 text-amber-300' :
                                  'bg-emerald-500/20 text-emerald-400'}`}>
                                {product.Stock}
                            </span>

                            <span className="text-[11px] font-semibold text-text-primary leading-tight line-clamp-2 pr-4 w-full">
                                {product.Name}
                            </span>
                            <span className="text-sm font-bold text-cyan-accent">
                                ₺{Number(product.SalePrice).toLocaleString('tr-TR')}
                            </span>
                        </motion.button>
                    ))}
                </AnimatePresence>

                {filtered.length === 0 && (
                    <div className="col-span-full text-center text-text-muted py-10 text-sm">
                        Ürün bulunamadı
                    </div>
                )}
            </div>
        </div>
    );
}
