import { useState, useEffect } from 'react';
import { usePosStore } from '../store/posStore';
import { useToast } from '../hooks/useToast';
import ProductFormModal from '../components/products/ProductFormModal';
import CategoryManagerModal from '../components/products/CategoryManagerModal';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, Search, Edit2, Trash2, Package, ScanBarcode,
    AlertTriangle, ArrowUpDown, Tag
} from 'lucide-react';

export default function ProductsPage() {
    const products = usePosStore((s) => s.products);
    const storeCategories = usePosStore((s) => s.categories);
    const addProduct = usePosStore((s) => s.addProduct);
    const updateProduct = usePosStore((s) => s.updateProduct);
    const deleteProduct = usePosStore((s) => s.deleteProduct);
    const fetchProducts = usePosStore((s) => s.fetchProducts);
    const fetchCategories = usePosStore((s) => s.fetchCategories);
    const toast = useToast();

    const [search, setSearch] = useState('');
    const [filterCategory, setFilterCategory] = useState('All');
    const [sortField, setSortField] = useState('Name');
    const [sortAsc, setSortAsc] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [categoryModalOpen, setCategoryModalOpen] = useState(false);

    useEffect(() => {
        fetchProducts();
        fetchCategories();
    }, []);

    // Categories from store + include any orphan categories from products
    const extraCats = [...new Set(products.map((p) => p.Category).filter((c) => c && !storeCategories.includes(c)))];
    const categories = ['All', ...storeCategories, ...extraCats];

    // Filter + Search
    let filtered = products.filter((p) => {
        const matchSearch = !search ||
            p.Name.toLowerCase().includes(search.toLowerCase()) ||
            p.Barcodes?.some(b => b.includes(search)) ||
            p.Barcode?.includes(search);
        const matchCategory = filterCategory === 'All' || p.Category === filterCategory;
        return matchSearch && matchCategory;
    });

    // Sort
    filtered = [...filtered].sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        if (typeof aVal === 'string') return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        return sortAsc ? aVal - bVal : bVal - aVal;
    });

    const handleSort = (field) => {
        if (sortField === field) {
            setSortAsc(!sortAsc);
        } else {
            setSortField(field);
            setSortAsc(true);
        }
    };

    const handleAdd = async (formData) => {
        try {
            await addProduct(formData);
            toast.success(`"${formData.Name}" eklendi`);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Ürün eklenemedi');
        }
    };

    const handleEdit = async (formData) => {
        try {
            await updateProduct(editingProduct.ID, formData);
            toast.success(`"${formData.Name}" güncellendi`);
            setEditingProduct(null);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Ürün güncellenemedi');
        }
    };

    const handleDelete = async (product) => {
        try {
            await deleteProduct(product.ID);
            toast.success(`"${product.Name}" silindi`);
            setDeleteConfirm(null);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Ürün silinemedi');
        }
    };

    const SortHeader = ({ field, children }) => (
        <th
            onClick={() => handleSort(field)}
            className="text-left text-xs font-medium text-text-muted uppercase tracking-wider py-3 px-4 cursor-pointer hover:text-text-secondary transition-colors select-none"
        >
            <span className="flex items-center gap-1">
                {children}
                {sortField === field && (
                    <ArrowUpDown size={12} className={`transition-transform ${sortAsc ? '' : 'rotate-180'}`} />
                )}
            </span>
        </th>
    );

    return (
        <div className="flex flex-col gap-4 h-[calc(100vh-2rem)]">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <Package size={22} className="text-cyan-accent" />
                    <h1 className="text-xl font-bold text-text-primary">Ürün Yönetimi</h1>
                    <span className="badge badge-cyan">{products.length} ürün</span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setCategoryModalOpen(true)}
                        className="btn-ghost flex items-center gap-2"
                    >
                        <Tag size={16} /> Kategoriler
                    </button>
                    <button
                        onClick={() => { setEditingProduct(null); setModalOpen(true); }}
                        className="btn-primary flex items-center gap-2"
                    >
                        <Plus size={16} /> Yeni Ürün
                    </button>
                </div>
            </div>

            {/* Search & Filter Bar */}
            <div className="flex gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px] relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Ürün adı veya barkod ile ara..."
                        className="glass-input w-full pl-10"
                    />
                </div>
                <div className="flex gap-2 overflow-x-auto scrollbar-none">
                    {categories.map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setFilterCategory(cat)}
                            className={`px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all
                ${filterCategory === cat
                                    ? 'bg-cyan-accent/15 text-cyan-accent border border-cyan-accent/30'
                                    : 'glass-card text-text-secondary hover:text-text-primary'}`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* Products Table */}
            <div className="glass-card-static flex-1 min-h-0 overflow-hidden">
                <div className="overflow-auto h-full">
                    <table className="w-full">
                        <thead className="sticky top-0 z-10" style={{ background: 'rgba(10, 14, 26, 0.95)', backdropFilter: 'blur(8px)' }}>
                            <tr className="border-b border-glass-border">
                                <SortHeader field="Barcode">Barkod</SortHeader>
                                <SortHeader field="Name">Ürün Adı</SortHeader>
                                <SortHeader field="Category">Kategori</SortHeader>
                                <SortHeader field="CostPrice">Maliyet</SortHeader>
                                <SortHeader field="SalePrice">Satış</SortHeader>
                                <SortHeader field="Stock">Stok</SortHeader>
                                <th className="text-right text-xs font-medium text-text-muted uppercase tracking-wider py-3 px-4">
                                    İşlemler
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <AnimatePresence>
                                {filtered.map((product) => (
                                    <motion.tr
                                        key={product.ID}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="border-b border-glass-border/30 hover:bg-white/[0.02] transition-colors group"
                                    >
                                        <td className="py-3 px-4">
                                            <div className="flex flex-wrap items-center gap-1">
                                                <ScanBarcode size={14} className="text-text-muted flex-shrink-0" />
                                                {(product.Barcodes || [product.Barcode]).map((bc) => (
                                                    <span key={bc} className="text-xs font-mono text-text-secondary bg-white/5 px-1.5 py-0.5 rounded">
                                                        {bc}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className="text-sm font-semibold text-text-primary">{product.Name}</span>
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className="badge badge-cyan">{product.Category}</span>
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className="text-sm text-text-secondary">₺{product.CostPrice}</span>
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className="text-sm font-bold text-cyan-accent">₺{product.SalePrice}</span>
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className={`badge ${product.Stock < 20 ? 'badge-danger' : product.Stock < 50 ? 'badge-amber' : 'badge-emerald'}`}>
                                                {product.Stock}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => { setEditingProduct(product); setModalOpen(true); }}
                                                    className="w-8 h-8 rounded-lg glass-card flex items-center justify-center text-text-secondary hover:text-cyan-accent transition-colors"
                                                    title="Düzenle"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => setDeleteConfirm(product)}
                                                    className="w-8 h-8 rounded-lg glass-card flex items-center justify-center text-text-secondary hover:text-danger transition-colors"
                                                    title="Sil"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))}
                            </AnimatePresence>
                        </tbody>
                    </table>

                    {filtered.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 text-text-muted">
                            <Package size={40} className="mb-3 opacity-30" />
                            <p className="text-sm">
                                {search ? `"${search}" için sonuç bulunamadı` : 'Henüz ürün yok'}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <ProductFormModal
                isOpen={modalOpen}
                onClose={() => { setModalOpen(false); setEditingProduct(null); }}
                onSubmit={editingProduct ? handleEdit : handleAdd}
                editProduct={editingProduct}
                // Eğer belli bir kategori filtresindeyken yeni ürün ekleniyorsa,
                // varsayılan kategori olarak o filtreyi kullan
                initialCategory={filterCategory !== 'All' ? filterCategory : (storeCategories[0] || 'Hot Drinks')}
            />

            {/* Category Manager Modal */}
            <CategoryManagerModal
                isOpen={categoryModalOpen}
                onClose={() => setCategoryModalOpen(false)}
            />

            {/* Delete Confirmation */}
            <AnimatePresence>
                {deleteConfirm && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setDeleteConfirm(null)}
                            className="fixed inset-0 bg-black/70 z-[100]"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="fixed inset-0 z-[101] flex items-center justify-center p-4"
                        >
                            <div className="glass-card-static p-6 max-w-sm w-full text-center">
                                <div className="w-12 h-12 rounded-full bg-danger/15 flex items-center justify-center mx-auto mb-4">
                                    <AlertTriangle size={24} className="text-danger" />
                                </div>
                                <h3 className="text-lg font-bold text-text-primary mb-2">Ürünü Sil?</h3>
                                <p className="text-sm text-text-secondary mb-5">
                                    <strong>"{deleteConfirm.Name}"</strong> ürünü kalıcı olarak silinecek. Bu işlem geri alınamaz.
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setDeleteConfirm(null)}
                                        className="btn-ghost flex-1"
                                    >
                                        İptal
                                    </button>
                                    <button
                                        onClick={() => handleDelete(deleteConfirm)}
                                        className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white transition-all"
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
        </div>
    );
}
