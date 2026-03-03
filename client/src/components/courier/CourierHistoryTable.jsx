import { useState, useEffect } from 'react';
import api from '../../lib/api';
import { useCourierStore } from '../../store/courierStore';
import { Calendar, User, Search, RefreshCw, ChevronDown, CheckCircle2, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

function fmtMoney(v) {
    return `₺${Number(v || 0).toLocaleString('tr-TR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

export default function CourierHistoryTable() {
    const { couriers, fetchCouriers } = useCourierStore();

    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState({
        courierId: '',
        startDate: '',
        endDate: ''
    });

    useEffect(() => {
        fetchCouriers();
    }, []);

    const loadHistory = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/courier-settlements/history', { params: filter });
            setHistory(data);
        } catch (err) {
            console.error('Failed to load history:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadHistory();
    }, [filter]);

    const handleFilterChange = (key, value) => {
        setFilter(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="flex flex-col h-full gap-4">
            {/* Filters */}
            <div className="glass-card p-4 rounded-2xl flex flex-wrap gap-4 items-end">
                <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
                    <label className="text-xs text-text-muted font-medium">Kurye</label>
                    <div className="flex items-center gap-2 glass-card-static px-3 py-2 rounded-xl border border-white/5 focus-within:border-cyan-500/50 transition-colors">
                        <User size={16} className="text-text-muted" />
                        <select
                            value={filter.courierId}
                            onChange={(e) => handleFilterChange('courierId', e.target.value)}
                            className="flex-1 text-sm text-text-primary bg-transparent outline-none cursor-pointer"
                        >
                            <option value="" className="bg-dark-bg text-text-muted">Tüm Kuryeler</option>
                            {couriers.map((c) => (
                                <option key={c.ID} value={c.ID} className="bg-dark-bg text-text-primary">
                                    {c.Name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
                    <label className="text-xs text-text-muted font-medium">Başlangıç Tarihi</label>
                    <div className="flex items-center gap-2 glass-card-static px-3 py-2 rounded-xl border border-white/5 focus-within:border-cyan-500/50 transition-colors">
                        <Calendar size={16} className="text-text-muted" />
                        <input
                            type="date"
                            value={filter.startDate}
                            onChange={(e) => handleFilterChange('startDate', e.target.value)}
                            className="flex-1 bg-transparent border-none outline-none text-sm text-text-primary cursor-pointer w-full"
                            style={{ colorScheme: 'dark' }}
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
                    <label className="text-xs text-text-muted font-medium">Bitiş Tarihi</label>
                    <div className="flex items-center gap-2 glass-card-static px-3 py-2 rounded-xl border border-white/5 focus-within:border-cyan-500/50 transition-colors">
                        <Calendar size={16} className="text-text-muted" />
                        <input
                            type="date"
                            value={filter.endDate}
                            onChange={(e) => handleFilterChange('endDate', e.target.value)}
                            className="flex-1 bg-transparent border-none outline-none text-sm text-text-primary cursor-pointer w-full"
                            style={{ colorScheme: 'dark' }}
                        />
                    </div>
                </div>

                <button
                    onClick={loadHistory}
                    disabled={loading}
                    className="btn-primary p-2 h-[42px] w-[42px] rounded-xl flex items-center justify-center shrink-0"
                    title="Yenile"
                >
                    <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Table */}
            <div className="glass-card flex-1 rounded-2xl overflow-hidden border border-white/5 flex flex-col">
                <div className="overflow-auto flex-1 custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[1200px]">
                        <thead className="sticky top-0 z-10 bg-dark-bg/95 backdrop-blur-md">
                            <tr>
                                <th className="py-4 px-4 text-[11px] font-bold text-text-muted uppercase tracking-wider border-b border-white/5">Tarih</th>
                                <th className="py-4 px-4 text-[11px] font-bold text-text-muted uppercase tracking-wider border-b border-white/5">Kurye</th>
                                <th className="py-4 px-4 text-[11px] font-bold text-text-muted uppercase tracking-wider border-b border-white/5 text-right bg-white/5">Nakit Teslim</th>
                                <th className="py-4 px-4 text-[11px] font-bold text-text-muted uppercase tracking-wider border-b border-white/5 text-right bg-white/5">POS Toplamı</th>
                                <th className="py-4 px-4 text-[11px] font-bold text-text-muted uppercase tracking-wider border-b border-white/5 text-right text-emerald-400/80 bg-white/5">Teslim Edilen</th>
                                <th className="py-4 px-4 text-[11px] font-bold text-text-muted uppercase tracking-wider border-b border-white/5 text-right">Ciro (Beklenen)</th>
                                <th className="py-4 px-4 text-[11px] font-bold text-text-muted uppercase tracking-wider border-b border-white/5 text-right">Fark</th>
                                <th className="py-4 px-4 text-[11px] font-bold text-text-muted uppercase tracking-wider border-b border-white/5 text-right">Durum</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading && history.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="py-12 text-center text-text-muted text-sm">
                                        Yükleniyor...
                                    </td>
                                </tr>
                            ) : history.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="py-12 text-center text-text-muted text-sm">
                                        Kayıt bulunamadı.
                                    </td>
                                </tr>
                            ) : (
                                history.map((row) => {
                                    const delivered = (Number(row.CashDelivered) || 0) + (Number(row.PosTotal) || 0);
                                    const expected = Number(row.Turnover) || 0;
                                    const difference = delivered - expected;
                                    const isFull = difference === 0;
                                    const isOver = difference > 0;
                                    const isShort = difference < 0;

                                    return (
                                        <tr key={row.ID} className="hover:bg-white/[0.02] transition-colors group">
                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-2">
                                                    <Calendar size={14} className="text-cyan-500/70" />
                                                    <span className="text-sm text-text-primary">
                                                        {format(new Date(row.Date), 'dd MMM yyyy', { locale: tr })}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-2">
                                                    <User size={14} className="text-text-muted group-hover:text-cyan-400 transition-colors" />
                                                    <span className="text-sm font-medium text-text-primary">
                                                        {row.CourierName || `Kurye #${row.CourierID}`}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-right text-sm text-emerald-400/80 font-mono bg-white/[0.02]">
                                                {fmtMoney(row.CashDelivered)}
                                            </td>
                                            <td className="py-3 px-4 text-right text-sm text-cyan-400/80 font-mono bg-white/[0.02]">
                                                {fmtMoney(row.PosTotal)}
                                            </td>
                                            <td className="py-3 px-4 text-right text-sm font-bold text-emerald-400 font-mono bg-white/[0.02]">
                                                {fmtMoney(delivered)}
                                            </td>
                                            <td className="py-3 px-4 text-right text-sm font-semibold text-text-primary font-mono">
                                                {fmtMoney(row.Turnover)}
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <span className={`text-sm font-bold font-mono ${isFull ? 'text-emerald-400' : isOver ? 'text-cyan-400' : 'text-red-400'
                                                    }`}>
                                                    {fmtMoney(difference)}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${isFull
                                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                        : isOver
                                                            ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                                                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                                    }`}>
                                                    {isFull ? <CheckCircle2 size={14} /> : isOver ? <ChevronDown size={14} className="rotate-180" /> : <XCircle size={14} />}
                                                    {isFull ? 'Tam' : isOver ? 'Fazla' : 'Eksik'}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
