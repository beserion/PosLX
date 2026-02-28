import { useEffect, useState } from 'react';
import api from '../lib/api';
import {
    Package, Clock, CheckCircle2, XCircle, Trash2, Truck,
    User, Calendar, CreditCard, Banknote, ShoppingCart, FileText
} from 'lucide-react';
import { useToast } from '../hooks/useToast';

function fmtMoney(v) {
    return `₺${Number(v || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(dt) {
    if (!dt) return '';
    return new Date(dt.replace(' ', 'T')).toLocaleDateString('tr-TR');
}
function fmtTime(dt) {
    if (!dt) return '';
    return new Date(dt.replace(' ', 'T')).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

const statusConfig = {
    'Beklemede': { color: '#eab308', bg: 'bg-yellow-500/20', icon: Clock },
    'Teslim Alındı': { color: '#10b981', bg: 'bg-emerald-500/20', icon: CheckCircle2 },
    'İptal': { color: '#ef4444', bg: 'bg-red-500/20', icon: XCircle },
};

export default function OrdersPage() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const toast = useToast();

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const url = filter ? `/orders?status=${encodeURIComponent(filter)}` : '/orders';
            const { data } = await api.get(url);
            setOrders(data);
        } catch (err) {
            console.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchOrders(); }, [filter]);

    const handleReceive = async (id) => {
        if (!confirm('Sipariş teslim alındı olarak işaretlensin mi? Stok ve muhasebe güncellenecek.')) return;
        try {
            await api.post(`/orders/${id}/receive`);
            toast.success('Sipariş teslim alındı ve işlendi');
            fetchOrders();
        } catch (err) {
            toast.error(err.response?.data?.error || err.message);
        }
    };

    const handleCancel = async (id) => {
        if (!confirm('Bu siparişi iptal etmek istediğinize emin misiniz?')) return;
        try {
            await api.post(`/orders/${id}/cancel`);
            toast.success('Sipariş iptal edildi');
            fetchOrders();
        } catch (err) {
            toast.error(err.response?.data?.error || err.message);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Siparişi silmek istediğinize emin misiniz?')) return;
        try {
            await api.delete(`/orders/${id}`);
            toast.success('Sipariş silindi');
            fetchOrders();
        } catch (err) {
            toast.error(err.response?.data?.error || err.message);
        }
    };

    const pending = orders.filter(o => o.Status === 'Beklemede');
    const received = orders.filter(o => o.Status === 'Teslim Alındı');
    const cancelled = orders.filter(o => o.Status === 'İptal');

    return (
        <div className="flex flex-col gap-5">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <h1 className="text-xl font-bold text-text-primary">Siparişler</h1>
                    <span className="badge badge-cyan">
                        <ShoppingCart size={10} /> {orders.length} Kayıt
                    </span>
                </div>
                <select value={filter} onChange={(e) => setFilter(e.target.value)}
                    className="glass-card-static rounded-xl px-3 py-2 text-sm text-text-primary bg-transparent outline-none">
                    <option value="">Tümü</option>
                    <option value="Beklemede">Beklemede</option>
                    <option value="Teslim Alındı">Teslim Alındı</option>
                    <option value="İptal">İptal</option>
                </select>
            </div>

            {/* KPI */}
            <div className="grid grid-cols-3 gap-3">
                <KpiCard label="Beklemede" value={pending.length} icon={Clock} color="#eab308" />
                <KpiCard label="Teslim Alındı" value={received.length} icon={CheckCircle2} color="#10b981" />
                <KpiCard label="İptal" value={cancelled.length} icon={XCircle} color="#ef4444" />
            </div>

            {/* Table */}
            <div className="glass-card p-4 rounded-2xl overflow-x-auto">
                {loading ? (
                    <div className="text-center text-text-muted py-10">Yükleniyor…</div>
                ) : orders.length === 0 ? (
                    <div className="text-center text-text-muted py-10">Henüz sipariş yok</div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-text-muted border-b border-white/5">
                                <th className="pb-2 pr-3">Tarih</th>
                                <th className="pb-2 pr-3">Tedarikçi</th>
                                <th className="pb-2 pr-3">Ürünler</th>
                                <th className="pb-2 pr-3 text-right">Tutar</th>
                                <th className="pb-2 pr-3">Durum</th>
                                <th className="pb-2 pr-3">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map(order => {
                                const st = statusConfig[order.Status] || statusConfig['Beklemede'];
                                const StIcon = st.icon;
                                return (
                                    <tr key={order.ID} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                        <td className="py-3 pr-3 text-text-muted whitespace-nowrap">
                                            <div>{fmtDate(order.CreatedAt)}</div>
                                            <div className="text-xs">{fmtTime(order.CreatedAt)}</div>
                                        </td>
                                        <td className="py-3 pr-3">
                                            <div className="flex items-center gap-1.5 text-text-primary font-medium">
                                                <User size={14} className="text-text-muted" />
                                                {order.Counterparty}
                                            </div>
                                        </td>
                                        <td className="py-3 pr-3 text-text-muted text-xs max-w-[200px] truncate">
                                            {order.ItemsSummary || '—'}
                                        </td>
                                        <td className="py-3 pr-3 text-right font-bold text-cyan-accent whitespace-nowrap">
                                            {fmtMoney(order.TotalAmount)}
                                        </td>
                                        <td className="py-3 pr-3">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold ${st.bg}`}
                                                style={{ color: st.color }}>
                                                <StIcon size={12} /> {order.Status}
                                            </span>
                                        </td>
                                        <td className="py-3 pr-3">
                                            <div className="flex items-center gap-1.5">
                                                {order.Status === 'Beklemede' && (
                                                    <>
                                                        <button onClick={() => handleReceive(order.ID)}
                                                            title="Teslim Al"
                                                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors cursor-pointer">
                                                            <Truck size={14} /> Teslim Al
                                                        </button>
                                                        <button onClick={() => handleCancel(order.ID)}
                                                            title="İptal Et"
                                                            className="text-text-muted hover:text-red-400 transition-colors cursor-pointer">
                                                            <XCircle size={16} />
                                                        </button>
                                                    </>
                                                )}
                                                {order.Status !== 'Teslim Alındı' && (
                                                    <button onClick={() => handleDelete(order.ID)}
                                                        title="Sil"
                                                        className="text-text-muted hover:text-red-400 transition-colors cursor-pointer">
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                                {order.Status === 'Teslim Alındı' && (
                                                    <span className="text-xs text-text-muted flex items-center gap-1">
                                                        <FileText size={12} /> Fatura #{order.InvoiceID}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

function KpiCard({ label, value, icon: Icon, color }) {
    return (
        <div className="glass-card p-4 rounded-2xl flex flex-col gap-2">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}20` }}>
                    <Icon size={20} style={{ color }} />
                </div>
                <div className="flex flex-col text-right w-full">
                    <span className="text-xs text-text-muted font-medium">{label}</span>
                    <span className="text-lg font-bold text-text-primary leading-tight">{value}</span>
                </div>
            </div>
        </div>
    );
}
