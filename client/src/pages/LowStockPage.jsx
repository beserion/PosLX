import { useEffect, useState } from 'react';
import { useAccountStore } from '../store/accountStore';
import api from '../lib/api';
import {
    AlertTriangle, Package, ArrowRight, Plus, X, Trash2,
    ShoppingCart, Building2, Send, TrendingDown, Banknote, CreditCard
} from 'lucide-react';

function fmtMoney(v) {
    return `₺${Number(v || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function LowStockPage() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState([]); // IDs of selected products
    const [showOrder, setShowOrder] = useState(false);

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
                            onClick={() => setShowOrder(true)}
                            className="btn-primary flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold"
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

            {showOrder && (
                <QuickOrderModal
                    products={selectedProducts}
                    onClose={() => setShowOrder(false)}
                    onOrdered={() => { setSelected([]); fetchLowStock(); setShowOrder(false); }}
                />
            )}
        </>
    );
}

// ─── Quick Order Modal ───────────────────────────────────────
function QuickOrderModal({ products, onClose, onOrdered }) {
    const { accounts, fetchAccounts } = useAccountStore();
    const [counterparty, setCounterparty] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('Cash');
    const [items, setItems] = useState(
        products.map(p => ({
            ProductID: p.ID,
            Name: p.Name,
            CurrentStock: p.Stock,
            CriticalStock: p.CriticalStock,
            Qty: Math.max(p.CriticalStock * 2 - p.Stock, 1), // smart default
            UnitPrice: p.CostPrice
        }))
    );
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => { fetchAccounts(); }, []);

    const suppliers = accounts.filter(a => a.Type === 'Tedarikçi');

    const updateItem = (idx, field, value) => {
        const updated = [...items];
        updated[idx] = { ...updated[idx], [field]: value };
        setItems(updated);
    };

    const removeItem = (idx) => {
        if (items.length <= 1) return;
        setItems(items.filter((_, i) => i !== idx));
    };

    const total = items.reduce((s, i) => s + (Number(i.Qty) || 0) * (Number(i.UnitPrice) || 0), 0);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!counterparty) return alert('Tedarikçi seçiniz');
        setSubmitting(true);
        try {
            await api.post('/orders', {
                Counterparty: counterparty,
                Description: 'Min stock siparişi',
                PaymentMethod: paymentMethod,
                items: items.map(i => ({
                    ProductID: i.ProductID,
                    Qty: Number(i.Qty) || 1,
                    UnitPrice: Number(i.UnitPrice) || 0
                }))
            });
            onOrdered();
        } catch (err) {
            alert(err.response?.data?.error || err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <form onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}
                className="glass-card p-6 rounded-2xl w-full max-w-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-text-primary">Hızlı Sipariş — {items.length} Ürün</h2>
                    <button type="button" onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors cursor-pointer">
                        <X size={20} />
                    </button>
                </div>

                {/* Supplier */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1 col-span-2">
                        <label className="text-xs text-text-muted font-medium">Tedarikçi *</label>
                        <select value={counterparty} onChange={(e) => setCounterparty(e.target.value)} required
                            className="glass-card-static rounded-xl px-3 py-2 text-sm text-text-primary bg-transparent outline-none">
                            <option value="">Tedarikçi seçin…</option>
                            {suppliers.map(a => (
                                <option key={a.ID} value={a.Name}>{a.Name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Payment method */}
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-text-muted font-medium">Ödeme Yöntemi</label>
                    <div className="flex gap-2">
                        <button type="button" onClick={() => setPaymentMethod('Cash')}
                            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer
                                ${paymentMethod === 'Cash' ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/50' : 'glass-card-static text-text-muted hover:text-text-primary'}`}>
                            <Banknote size={16} /> Nakit
                        </button>
                        <button type="button" onClick={() => setPaymentMethod('Card')}
                            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer
                                ${paymentMethod === 'Card' ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/50' : 'glass-card-static text-text-muted hover:text-text-primary'}`}>
                            <CreditCard size={16} /> Kart
                        </button>
                    </div>
                </div>

                {/* Items */}
                <div className="flex flex-col gap-2">
                    <label className="text-xs text-text-muted font-medium">Sipariş Kalemleri</label>
                    {items.map((item, idx) => (
                        <div key={item.ProductID} className="glass-card-static rounded-xl p-3 flex items-center gap-2 flex-wrap">
                            <div className="flex-1 min-w-[120px]">
                                <span className="text-sm text-text-primary font-medium">{item.Name}</span>
                                <div className="text-xs text-text-muted">
                                    Stok: <span className="text-red-400 font-bold">{item.CurrentStock}</span> / {item.CriticalStock}
                                </div>
                            </div>
                            <div className="w-20">
                                <input type="number" min="1" value={item.Qty}
                                    onChange={(e) => updateItem(idx, 'Qty', e.target.value)}
                                    className="w-full bg-transparent rounded-lg px-2 py-1.5 text-sm text-text-primary outline-none border border-white/10 text-center" />
                            </div>
                            <div className="w-28">
                                <input type="number" step="0.01" min="0" value={item.UnitPrice}
                                    onChange={(e) => updateItem(idx, 'UnitPrice', e.target.value)}
                                    placeholder="Birim ₺"
                                    className="w-full bg-transparent rounded-lg px-2 py-1.5 text-sm text-text-primary outline-none border border-white/10 text-right" />
                            </div>
                            <span className="text-sm text-cyan-accent font-bold w-24 text-right">
                                {fmtMoney((Number(item.Qty) || 0) * (Number(item.UnitPrice) || 0))}
                            </span>
                            {items.length > 1 && (
                                <button type="button" onClick={() => removeItem(idx)}
                                    className="text-text-muted hover:text-red-400 cursor-pointer">
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>

                {/* Total + Submit */}
                <div className="flex items-center justify-between border-t border-white/10 pt-3">
                    <span className="text-sm text-text-muted">Toplam:</span>
                    <span className="text-lg font-bold text-cyan-accent">{fmtMoney(total)}</span>
                </div>

                <button type="submit" disabled={submitting}
                    className="btn-primary w-full py-2.5 rounded-xl text-sm font-bold disabled:opacity-50">
                    {submitting ? 'Kaydediliyor…' : 'Sipariş Oluştur'}
                </button>
            </form>
        </div>
    );
}
