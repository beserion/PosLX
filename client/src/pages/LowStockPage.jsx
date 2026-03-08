import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import {
    AlertTriangle, Package, ArrowRight, Plus, X, Trash2,
    ShoppingCart, Building2, Send, TrendingDown, Banknote, CreditCard
} from 'lucide-react';
import { useToast } from '../hooks/useToast';

function fmtMoney(v) {
    return `₺${Number(v || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function LowStockPage() {
    const navigate = useNavigate();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState([]); // IDs of selected products

    const fetchLowStock = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/products/low-stock');
            setProducts(data);
        } catch (err) {
            console.error('Failed to fetch low stock:', err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchLowStock(); }, []);

    const toggleSelect = (id) => {
        setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };
    const selectAll = () => {
        setSelected(selected.length === products.length ? [] : products.map(p => p.ID));
    };

    const selectedProducts = products.filter(p => selected.includes(p.ID));

    const getStockLevel = (stock, critical) => {
        if (stock <= 0) return { label: 'Tükendi', color: '#ef4444', bg: 'bg-red-500/20' };
        if (stock <= critical * 0.5) return { label: 'Kritik', color: '#f97316', bg: 'bg-orange-500/20' };
        return { label: 'Düşük', color: '#eab308', bg: 'bg-yellow-500/20' };
    };

    return (
        <>
            <div className="flex flex-col gap-5">
                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                        <h1 className="text-xl font-bold text-text-primary">Min Stock</h1>
                        <span className={`badge ${products.length > 0 ? 'bg-red-500/20 text-red-400' : 'badge-cyan'}`}>
                            <AlertTriangle size={10} /> {products.length} Ürün
                        </span>
                    </div>
                    {selected.length > 0 && (
                        <button
                            onClick={() => {
                                navigate('/invoices', {
                                    state: {
                                        openNewForm: true,
                                        initialItems: selectedProducts
                                    }
                                });
                            }}
                            className="btn-primary flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold cursor-pointer"
                        >
                            <Send size={16} /> Hızlı Sipariş ({selected.length})
                        </button>
                    )}
                </div>

                {/* KPI */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="glass-card p-4 rounded-2xl flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-500/20 shrink-0">
                                <AlertTriangle size={20} className="text-red-400" />
                            </div>
                            <div className="flex flex-col text-right w-full">
                                <span className="text-xs text-text-muted font-medium">Tükenen</span>
                                <span className="text-lg font-bold text-red-400 leading-tight">{products.filter(p => p.Stock <= 0).length}</span>
                            </div>
                        </div>
                    </div>
                    <div className="glass-card p-4 rounded-2xl flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-orange-500/20 shrink-0">
                                <TrendingDown size={20} className="text-orange-400" />
                            </div>
                            <div className="flex flex-col text-right w-full">
                                <span className="text-xs text-text-muted font-medium">Kritik</span>
                                <span className="text-lg font-bold text-orange-400 leading-tight">
                                    {products.filter(p => p.Stock > 0 && p.Stock <= p.CriticalStock * 0.5).length}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="glass-card p-4 rounded-2xl flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-yellow-500/20 shrink-0">
                                <Package size={20} className="text-yellow-400" />
                            </div>
                            <div className="flex flex-col text-right w-full">
                                <span className="text-xs text-text-muted font-medium">Düşük</span>
                                <span className="text-lg font-bold text-yellow-400 leading-tight">
                                    {products.filter(p => p.Stock > p.CriticalStock * 0.5).length}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="glass-card p-4 rounded-2xl flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-cyan-500/20 shrink-0">
                                <ShoppingCart size={20} className="text-cyan-400" />
                            </div>
                            <div className="flex flex-col text-right w-full">
                                <span className="text-xs text-text-muted font-medium">Seçilen</span>
                                <span className="text-lg font-bold text-cyan-400 leading-tight">{selected.length}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="glass-card p-4 rounded-2xl overflow-x-auto">
                    {loading ? (
                        <div className="text-center text-text-muted py-10">Yükleniyor…</div>
                    ) : products.length === 0 ? (
                        <div className="text-center py-10">
                            <div className="text-3xl mb-2">🎉</div>
                            <div className="text-text-muted">Tüm stoklar yeterli seviyede!</div>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-text-muted border-b border-white/5">
                                    <th className="pb-2 pr-3 w-8">
                                        <input type="checkbox" checked={selected.length === products.length && products.length > 0}
                                            onChange={selectAll}
                                            className="accent-cyan-500 cursor-pointer" />
                                    </th>
                                    <th className="pb-2 pr-3">Ürün</th>
                                    <th className="pb-2 pr-3">Kategori</th>
                                    <th className="pb-2 pr-3 text-center">Mevcut</th>
                                    <th className="pb-2 pr-3 text-center">Kritik</th>
                                    <th className="pb-2 pr-3">Durum</th>
                                    <th className="pb-2 pr-3 text-right">Alış ₺</th>
                                </tr>
                            </thead>
                            <tbody>
                                {products.map(p => {
                                    const level = getStockLevel(p.Stock, p.CriticalStock);
                                    return (
                                        <tr key={p.ID}
                                            onClick={() => toggleSelect(p.ID)}
                                            className={`border-b border-white/5 hover:bg-white/[0.03] transition-colors cursor-pointer
                                                ${selected.includes(p.ID) ? 'bg-cyan-500/5' : ''}`}>
                                            <td className="py-3 pr-3">
                                                <input type="checkbox" checked={selected.includes(p.ID)}
                                                    onChange={() => toggleSelect(p.ID)}
                                                    className="accent-cyan-500 cursor-pointer" />
                                            </td>
                                            <td className="py-3 pr-3">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${level.bg}`}>
                                                        <Package size={14} style={{ color: level.color }} />
                                                    </div>
                                                    <span className="text-text-primary font-medium">{p.Name}</span>
                                                </div>
                                            </td>
                                            <td className="py-3 pr-3 text-text-muted text-xs">{p.Category}</td>
                                            <td className="py-3 pr-3 text-center">
                                                <span className="font-bold" style={{ color: level.color }}>{p.Stock}</span>
                                            </td>
                                            <td className="py-3 pr-3 text-center text-text-muted">{p.CriticalStock}</td>
                                            <td className="py-3 pr-3">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold ${level.bg}`}
                                                    style={{ color: level.color }}>
                                                    {level.label}
                                                </span>
                                            </td>
                                            <td className="py-3 pr-3 text-right text-text-muted">{fmtMoney(p.CostPrice)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </>
    );
}


