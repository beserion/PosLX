import { useEffect, useState } from 'react';
import { usePosStore } from '../store/posStore';
import { useAccountStore } from '../store/accountStore';
import api from '../lib/api';
import {
    FileText, Plus, X, Trash2, Package, User, Hash,
    CreditCard, Banknote, Calendar, ClipboardList
} from 'lucide-react';

function fmtMoney(v) {
    return `₺${Number(v || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function InvoicesPage() {
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    const fetchInvoices = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/invoices');
            setInvoices(data);
        } catch (err) {
            console.error('Failed to fetch invoices:', err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchInvoices(); }, []);

    const handleDelete = async (id) => {
        if (!confirm('Bu faturayı silmek ve stokları geri almak istediğinize emin misiniz?')) return;
        try {
            await api.delete(`/invoices/${id}`);
            fetchInvoices();
        } catch (err) {
            alert(err.response?.data?.error || err.message);
        }
    };

    return (
        <>
            <div className="flex flex-col gap-5">
                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                        <h1 className="text-xl font-bold text-text-primary">Stok Giriş / Fatura</h1>
                        <span className="badge badge-cyan">
                            <FileText size={10} /> {invoices.length} Kayıt
                        </span>
                    </div>
                    <button
                        id="btn-add-invoice"
                        onClick={() => setShowModal(true)}
                        className="btn-primary flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold"
                    >
                        <Plus size={16} /> Yeni Fatura / İrsaliye
                    </button>
                </div>

                {/* Invoices Table */}
                <div className="glass-card p-4 rounded-2xl overflow-x-auto">
                    {loading ? (
                        <div className="text-center text-text-muted py-10">Yükleniyor…</div>
                    ) : invoices.length === 0 ? (
                        <div className="text-center text-text-muted py-10">Henüz fatura/irsaliye kaydı yok</div>
                    ) : (
                        <table className="w-full text-sm" id="invoices-table">
                            <thead>
                                <tr className="text-left text-text-muted border-b border-white/5">
                                    <th className="pb-2 pr-3">Tarih</th>
                                    <th className="pb-2 pr-3">No</th>
                                    <th className="pb-2 pr-3">Tür</th>
                                    <th className="pb-2 pr-3">Cari</th>
                                    <th className="pb-2 pr-3">Ürünler</th>
                                    <th className="pb-2 pr-3 text-right">Tutar</th>
                                    <th className="pb-2 pr-3"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoices.map((inv) => (
                                    <tr key={inv.ID} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                        <td className="py-3 pr-3 text-text-muted whitespace-nowrap">
                                            {inv.CreatedAt ? new Date(inv.CreatedAt.replace(' ', 'T')).toLocaleDateString('tr-TR') : ''}
                                        </td>
                                        <td className="py-3 pr-3 text-text-primary font-mono">
                                            {inv.InvoiceNo || `#${inv.ID}`}
                                        </td>
                                        <td className="py-3 pr-3">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold
                                                ${inv.Type === 'İrsaliye' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                                <FileText size={12} /> {inv.Type}
                                            </span>
                                        </td>
                                        <td className="py-3 pr-3 text-text-primary">
                                            <div className="flex items-center gap-1">
                                                <User size={12} className="text-text-muted" />
                                                {inv.Counterparty}
                                            </div>
                                        </td>
                                        <td className="py-3 pr-3 text-text-muted text-xs max-w-[200px] truncate">
                                            {inv.ItemsSummary || '—'}
                                        </td>
                                        <td className="py-3 pr-3 text-right font-bold text-red-400 whitespace-nowrap">
                                            {fmtMoney(inv.TotalAmount)}
                                        </td>
                                        <td className="py-3 text-right">
                                            <button
                                                onClick={() => handleDelete(inv.ID)}
                                                className="text-text-muted hover:text-red-400 transition-colors cursor-pointer"
                                                title="Sil"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {showModal && (
                <CreateInvoiceModal
                    onClose={() => setShowModal(false)}
                    onCreated={fetchInvoices}
                />
            )}
        </>
    );
}

// ─── Create Invoice Modal ────────────────────────────────────
function CreateInvoiceModal({ onClose, onCreated }) {
    const products = usePosStore((s) => s.products);
    const fetchProducts = usePosStore((s) => s.fetchProducts);
    const { accounts, fetchAccounts } = useAccountStore();

    const [invoiceNo, setInvoiceNo] = useState('');
    const [type, setType] = useState('Fatura');
    const [counterparty, setCounterparty] = useState('');
    const [description, setDescription] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('Cash');
    const [items, setItems] = useState([{ ProductID: '', Qty: 1, UnitPrice: 0 }]);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => { fetchProducts(); fetchAccounts(); }, []);

    const addRow = () => setItems([...items, { ProductID: '', Qty: 1, UnitPrice: 0 }]);

    const removeRow = (idx) => {
        if (items.length <= 1) return;
        setItems(items.filter((_, i) => i !== idx));
    };

    const updateRow = (idx, field, value) => {
        const updated = [...items];
        updated[idx] = { ...updated[idx], [field]: value };
        setItems(updated);
    };

    const total = items.reduce((s, i) => s + (Number(i.Qty) || 0) * (Number(i.UnitPrice) || 0), 0);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!counterparty.trim()) return alert('Cari (tedarikçi) adı zorunludur');
        if (items.some(i => !i.ProductID)) return alert('Tüm satırlarda ürün seçilmelidir');
        setSubmitting(true);
        try {
            await api.post('/invoices', {
                InvoiceNo: invoiceNo || null,
                Type: type,
                Counterparty: counterparty.trim(),
                Description: description || null,
                PaymentMethod: paymentMethod,
                items: items.map(i => ({
                    ProductID: Number(i.ProductID),
                    Qty: Number(i.Qty) || 1,
                    UnitPrice: Number(i.UnitPrice) || 0
                }))
            });
            onCreated();
            onClose();
        } catch (err) {
            alert(err.response?.data?.error || err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={onClose}>
            <form
                onClick={(e) => e.stopPropagation()}
                onSubmit={handleSubmit}
                className="glass-card p-6 rounded-2xl w-full max-w-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
            >
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-text-primary">Yeni Fatura / İrsaliye</h2>
                    <button type="button" onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors cursor-pointer">
                        <X size={20} />
                    </button>
                </div>

                {/* Top fields: 2-column */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-text-muted font-medium">Tür</label>
                        <select value={type} onChange={(e) => setType(e.target.value)}
                            className="glass-card-static rounded-xl px-3 py-2 text-sm text-text-primary bg-transparent outline-none">
                            <option value="Fatura">Fatura</option>
                            <option value="İrsaliye">İrsaliye</option>
                        </select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-text-muted font-medium">Belge No</label>
                        <input type="text" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)}
                            placeholder="F-001"
                            className="glass-card-static rounded-xl px-3 py-2 text-sm text-text-primary bg-transparent outline-none" />
                    </div>
                    <div className="flex flex-col gap-1 col-span-2">
                        <label className="text-xs text-text-muted font-medium">Cari (Tedarikçi) *</label>
                        <select value={counterparty} onChange={(e) => setCounterparty(e.target.value)}
                            required
                            className="glass-card-static rounded-xl px-3 py-2 text-sm text-text-primary bg-transparent outline-none">
                            <option value="">Cari seçin…</option>
                            {accounts.map(a => (
                                <option key={a.ID} value={a.Name}>{a.Name} ({a.Type})</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-col gap-1 col-span-2">
                        <label className="text-xs text-text-muted font-medium">Açıklama</label>
                        <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                            placeholder="Not ekleyin..."
                            className="glass-card-static rounded-xl px-3 py-2 text-sm text-text-primary bg-transparent outline-none" />
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
                    <div className="flex items-center justify-between">
                        <label className="text-xs text-text-muted font-medium">Ürün Satırları</label>
                        <button type="button" onClick={addRow}
                            className="text-cyan-accent text-xs font-semibold flex items-center gap-1 hover:underline cursor-pointer">
                            <Plus size={12} /> Satır Ekle
                        </button>
                    </div>

                    {items.map((item, idx) => (
                        <div key={idx} className="glass-card-static rounded-xl p-3 flex items-center gap-2 flex-wrap">
                            <div className="flex-1 min-w-[150px]">
                                <select value={item.ProductID}
                                    onChange={(e) => updateRow(idx, 'ProductID', e.target.value)}
                                    className="w-full bg-transparent rounded-lg px-2 py-1.5 text-sm text-text-primary outline-none border border-white/10"
                                    required>
                                    <option value="">Ürün seçin…</option>
                                    {products.map(p => (
                                        <option key={p.ID} value={p.ID}>{p.Name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="w-20">
                                <input type="number" min="1" value={item.Qty}
                                    onChange={(e) => updateRow(idx, 'Qty', e.target.value)}
                                    placeholder="Adet"
                                    className="w-full bg-transparent rounded-lg px-2 py-1.5 text-sm text-text-primary outline-none border border-white/10 text-center" />
                            </div>
                            <div className="w-28">
                                <input type="number" step="0.01" min="0" value={item.UnitPrice}
                                    onChange={(e) => updateRow(idx, 'UnitPrice', e.target.value)}
                                    placeholder="Birim ₺"
                                    className="w-full bg-transparent rounded-lg px-2 py-1.5 text-sm text-text-primary outline-none border border-white/10 text-right" />
                            </div>
                            <span className="text-sm text-cyan-accent font-bold w-24 text-right">
                                {fmtMoney((Number(item.Qty) || 0) * (Number(item.UnitPrice) || 0))}
                            </span>
                            {items.length > 1 && (
                                <button type="button" onClick={() => removeRow(idx)}
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
                    {submitting ? 'Kaydediliyor…' : 'Kaydet & Stok Güncelle'}
                </button>
            </form>
        </div>
    );
}
