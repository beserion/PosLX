import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Pencil, Trash2, Tag, Check, AlertTriangle } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import api from '../../lib/api';

export default function CategoryManagerModal({ isOpen, onClose }) {
    const [categories, setCategories] = useState([]);
    const [productCounts, setProductCounts] = useState({});
    const [newName, setNewName] = useState('');
    const [editingCat, setEditingCat] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [deletingCat, setDeletingCat] = useState(null);
    const toast = useToast();

    // Fetch categories and product counts
    const loadData = async () => {
        try {
            const [catRes, prodRes] = await Promise.all([
                api.get('/categories'),
                api.get('/products'),
            ]);
            setCategories(catRes.data);
            // Compute product counts per category
            const counts = {};
            prodRes.data.forEach((p) => {
                counts[p.Category] = (counts[p.Category] || 0) + 1;
            });
            setProductCounts(counts);
        } catch (err) {
            console.error('Failed to load categories:', err.message);
        }
    };

    useEffect(() => {
        if (isOpen) loadData();
    }, [isOpen]);

    const handleAdd = async () => {
        const trimmed = newName.trim();
        if (!trimmed) return;
        try {
            await api.post('/categories', { Name: trimmed });
            setNewName('');
            toast.success(`"${trimmed}" kategorisi eklendi`);
            loadData();
            // Refresh the posStore categories too
            const { usePosStore } = await import('../../store/posStore');
            usePosStore.getState().fetchCategories();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Kategori eklenemedi');
        }
    };

    const handleRename = async (cat) => {
        const trimmed = editValue.trim();
        if (!trimmed || trimmed === cat.Name) {
            setEditingCat(null);
            return;
        }
        try {
            await api.put(`/categories/${cat.ID}`, { Name: trimmed });
            setEditingCat(null);
            toast.success(`"${cat.Name}" → "${trimmed}" olarak güncellendi`);
            loadData();
            // Refresh posStore
            const { usePosStore } = await import('../../store/posStore');
            usePosStore.getState().fetchCategories();
            usePosStore.getState().fetchProducts();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Kategori güncellenemedi');
        }
    };

    const handleDelete = async (cat) => {
        try {
            const count = productCounts[cat.Name] || 0;
            await api.delete(`/categories/${cat.ID}`);
            setDeletingCat(null);
            toast.success(`"${cat.Name}" silindi${count > 0 ? ` — ${count} ürün "Genel" kategorisine taşındı` : ''}`);
            loadData();
            // Refresh posStore
            const { usePosStore } = await import('../../store/posStore');
            usePosStore.getState().fetchCategories();
            usePosStore.getState().fetchProducts();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Kategori silinemedi');
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/70 z-[100]"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed inset-0 z-[101] flex items-center justify-center p-4"
                    >
                        <div className="glass-card-static p-6 max-w-md w-full max-h-[80vh] flex flex-col">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-5">
                                <div className="flex items-center gap-2">
                                    <Tag size={20} className="text-cyan-accent" />
                                    <h3 className="text-lg font-bold text-text-primary">Kategori Yönetimi</h3>
                                    <span className="badge badge-cyan">{categories.length}</span>
                                </div>
                                <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Add new */}
                            <div className="flex gap-2 mb-4">
                                <input
                                    type="text"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                                    placeholder="Yeni kategori adı..."
                                    className="glass-input flex-1"
                                />
                                <button
                                    onClick={handleAdd}
                                    disabled={!newName.trim()}
                                    className="btn-primary flex items-center gap-1.5 px-4"
                                >
                                    <Plus size={16} /> Ekle
                                </button>
                            </div>

                            {/* Category list */}
                            <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                                <AnimatePresence>
                                    {categories.map((cat) => {
                                        const count = productCounts[cat.Name] || 0;
                                        const isEditing = editingCat === cat.ID;

                                        return (
                                            <motion.div
                                                key={cat.ID}
                                                initial={{ opacity: 0, y: -8 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, x: -20 }}
                                                className="flex items-center gap-2 px-3 py-2.5 rounded-xl glass-card group"
                                            >
                                                {isEditing ? (
                                                    <>
                                                        <input
                                                            autoFocus
                                                            type="text"
                                                            value={editValue}
                                                            onChange={(e) => setEditValue(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') handleRename(cat);
                                                                if (e.key === 'Escape') setEditingCat(null);
                                                            }}
                                                            className="glass-input flex-1 py-1 text-sm"
                                                        />
                                                        <button
                                                            onClick={() => handleRename(cat)}
                                                            className="w-7 h-7 rounded-lg bg-emerald-accent/15 flex items-center justify-center text-emerald-accent hover:bg-emerald-accent/25 transition-colors"
                                                        >
                                                            <Check size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => setEditingCat(null)}
                                                            className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Tag size={14} className="text-text-muted" />
                                                        <span className="flex-1 text-sm font-medium text-text-primary">{cat.Name}</span>
                                                        <span className="text-xs text-text-muted mr-1">{count} ürün</span>
                                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => { setEditingCat(cat.ID); setEditValue(cat.Name); }}
                                                                className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-text-secondary hover:text-cyan-accent transition-colors"
                                                                title="Yeniden adlandır"
                                                            >
                                                                <Pencil size={12} />
                                                            </button>
                                                            <button
                                                                onClick={() => setDeletingCat(cat)}
                                                                className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-text-secondary hover:text-danger transition-colors"
                                                                title="Sil"
                                                            >
                                                                <Trash2 size={12} />
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </motion.div>
                                        );
                                    })}
                                </AnimatePresence>

                                {categories.length === 0 && (
                                    <div className="text-center py-8 text-text-muted text-sm">
                                        Henüz kategori yok
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>

                    {/* Delete Confirmation */}
                    <AnimatePresence>
                        {deletingCat && (
                            <>
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onClick={() => setDeletingCat(null)}
                                    className="fixed inset-0 bg-black/50 z-[102]"
                                />
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    className="fixed inset-0 z-[103] flex items-center justify-center p-4"
                                >
                                    <div className="glass-card-static p-6 max-w-sm w-full text-center">
                                        <div className="w-12 h-12 rounded-full bg-danger/15 flex items-center justify-center mx-auto mb-4">
                                            <AlertTriangle size={24} className="text-danger" />
                                        </div>
                                        <h3 className="text-lg font-bold text-text-primary mb-2">Kategoriyi Sil?</h3>
                                        <p className="text-sm text-text-secondary mb-1">
                                            <strong>"{deletingCat.Name}"</strong> kategorisi silinecek.
                                        </p>
                                        {(productCounts[deletingCat.Name] || 0) > 0 && (
                                            <p className="text-xs text-amber-accent mb-4">
                                                ⚠ {productCounts[deletingCat.Name]} ürün "Genel" kategorisine taşınacak
                                            </p>
                                        )}
                                        <div className="flex gap-2 mt-4">
                                            <button onClick={() => setDeletingCat(null)} className="btn-ghost flex-1">
                                                İptal
                                            </button>
                                            <button
                                                onClick={() => handleDelete(deletingCat)}
                                                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white"
                                                style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: '0 4px 16px rgba(239,68,68,0.3)' }}
                                            >
                                                Evet, Sil
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>
                </>
            )}
        </AnimatePresence>
    );
}
