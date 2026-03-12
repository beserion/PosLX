import { useState, useEffect } from 'react';
import api from '../../lib/api';
import { useCourierStore } from '../../store/courierStore';
import { Calendar, User, Search, RefreshCw, ChevronDown, CheckCircle2, XCircle, Download, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { exportToExcel } from '../../lib/excelExport';
import { printReport } from '../../lib/printExport';

function fmtMoney(v) {
    return `₺${Number(v || 0).toLocaleString('tr-TR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

export default function CourierHistoryTable({ onRowClick }) {
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

    const getColumns = () => [
        { header: 'Tarih', key: 'Date', formatter: (v) => format(new Date(v), 'dd.MM.yyyy') },
        { header: 'Kurye', key: 'CourierName', formatter: (v, row) => v || `Kurye #${row.CourierID}` },
        { header: 'Nakit Teslim', key: 'CashDelivered', formatter: (v) => Number(v || 0) },
        { header: 'POS Toplamı', key: 'PosTotal', formatter: (v) => Number(v || 0) },
        { header: 'Teslim Edilen', key: 'Delivered', formatter: (v, row) => (Number(row.CashDelivered) || 0) + (Number(row.PosTotal) || 0) },
        { header: 'Yakıt', key: 'FuelAmount', formatter: (v) => Number(v || 0) },
        { header: 'Bakım', key: 'MaintenanceAmount', formatter: (v) => Number(v || 0) },
        { header: 'Ciro (Beklenen)', key: 'Turnover', formatter: (v) => Number(v || 0) },
        {
            header: 'Fark', key: 'Difference', formatter: (v, row) => {
                const delivered = (Number(row.CashDelivered) || 0) + (Number(row.PosTotal) || 0);
                const expected = Number(row.Turnover) || 0;
                return delivered - expected;
            }
        },
        {
            header: 'Durum', key: 'Status', formatter: (v, row) => {
                const delivered = (Number(row.CashDelivered) || 0) + (Number(row.PosTotal) || 0);
                const expected = Number(row.Turnover) || 0;
                const difference = delivered - expected;
                if (difference === 0) return 'Tam';
                if (difference > 0) return 'Fazla';
                return 'Eksik';
            }
        }
    ];

    const getReportDetails = () => {
        let filename = 'Kurye_Raporlari';
        let reportTitle = 'Kurye Gün Sonu Raporları';
        if (filter.courierId) {
            const courier = couriers.find(c => c.ID === Number(filter.courierId));
            if (courier) {
                filename = `Kurye_Raporu_${courier.Name.replace(/\s+/g, '_')}`;
                reportTitle = `${courier.Name} - Kurye Gün Sonu Raporu`;
            }
        }
        return { filename, reportTitle };
    };

    const handleExportExcel = () => {
        if (!history || history.length === 0) return;
        const columns = getColumns();
        const { filename, reportTitle } = getReportDetails();

        exportToExcel(history, columns, filename, {
            title: reportTitle
        });
    };

    const handlePrint = () => {
        if (!history || history.length === 0) return;
        const columns = getColumns();
        const { reportTitle } = getReportDetails();

        printReport(history, columns, {
            title: reportTitle
        });
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

                <div className="flex gap-2">
                    <button
                        onClick={handlePrint}
                        disabled={loading || history.length === 0}
                        className="btn-ghost px-4 h-[42px] rounded-xl flex items-center justify-center gap-2 shrink-0 border border-white/10 hover:border-cyan-500/50 hover:text-cyan-400 transition-colors text-sm font-medium"
                    >
                        <Printer size={18} />
                        Yazdır
                    </button>
                    <button
                        onClick={handleExportExcel}
                        disabled={loading || history.length === 0}
                        className="btn-ghost px-4 h-[42px] rounded-xl flex items-center justify-center gap-2 shrink-0 border border-white/10 hover:border-emerald-500/50 hover:text-emerald-400 transition-colors text-sm font-medium"
                    >
                        <Download size={18} />
                        Excel'e Aktar
                    </button>
                    <button
                        onClick={loadHistory}
                        disabled={loading}
                        className="btn-primary px-4 h-[42px] rounded-xl flex items-center justify-center gap-2 shrink-0 text-sm font-medium"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        Yenile
                    </button>
                </div>
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
                                <th className="py-4 px-4 text-[11px] font-bold text-text-muted uppercase tracking-wider border-b border-white/5 text-right bg-white/5">Teslim Edilen</th>
                                <th className="py-4 px-4 text-[11px] font-bold text-text-muted uppercase tracking-wider border-b border-white/5 text-right text-rose-400/80">Yakıt</th>
                                <th className="py-4 px-4 text-[11px] font-bold text-text-muted uppercase tracking-wider border-b border-white/5 text-right text-rose-400/80">Bakım</th>
                                <th className="py-4 px-4 text-[11px] font-bold text-text-muted uppercase tracking-wider border-b border-white/5 text-right">Ciro (Beklenen)</th>
                                <th className="py-4 px-4 text-[11px] font-bold text-text-muted uppercase tracking-wider border-b border-white/5 text-right">Fark</th>
                                <th className="py-4 px-4 text-[11px] font-bold text-text-muted uppercase tracking-wider border-b border-white/5 text-right">Durum</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading && history.length === 0 ? (
                                <tr>
                                    <td colSpan="10" className="py-12 text-center text-text-muted text-sm">
                                        Yükleniyor...
                                    </td>
                                </tr>
                            ) : history.length === 0 ? (
                                <tr>
                                    <td colSpan="10" className="py-12 text-center text-text-muted text-sm">
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
                                        <tr 
                                            key={row.ID} 
                                            className="hover:bg-white/[0.02] transition-colors group cursor-pointer"
                                            onClick={() => onRowClick && onRowClick(row)}
                                        >
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
                                            <td className="py-3 px-4 text-right text-sm text-rose-400/80 font-mono">
                                                {fmtMoney(row.FuelAmount)}
                                            </td>
                                            <td className="py-3 px-4 text-right text-sm text-rose-400/80 font-mono">
                                                {fmtMoney(row.MaintenanceAmount)}
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
