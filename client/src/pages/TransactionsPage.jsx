import { useEffect, useState } from 'react';
import { useTransactionStore } from '../store/transactionStore';
import {
    Receipt, TrendingUp, TrendingDown, DollarSign, Calendar,
    Plus, X, Printer, CreditCard, Banknote, ArrowUpCircle, ArrowDownCircle,
    Clock, Hash, ShoppingBag, User, Download
} from 'lucide-react';
import { useAccountStore } from '../store/accountStore';
import { printReport } from '../lib/printExport';
import { exportToExcel } from '../lib/excelExport';

// ─── Type helpers ────────────────────────────────────────────
const typeConfig = {
    Sale: { label: 'Satış', color: '#10b981', icon: ArrowUpCircle },
    Purchase: { label: 'Alım', color: '#f97316', icon: ShoppingBag },
    RefundSale: { label: 'Satış İade', color: '#f59e0b', icon: ArrowDownCircle },
    RefundPurchase: { label: 'Alış İade', color: '#eab308', icon: ArrowUpCircle },
    Expense: { label: 'Gider', color: '#ef4444', icon: TrendingDown },
    Adjustment: { label: 'Düzeltme', color: '#6366f1', icon: DollarSign },
    Payment: { label: 'Ödeme/Tahsilat', color: '#10b981', icon: DollarSign },
};

function fmtMoney(v) {
    return `₺${Number(v || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtTime(dt) {
    if (!dt) return '';
    const d = new Date(dt.replace(' ', 'T'));
    return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(dt) {
    if (!dt) return '';
    const d = new Date(dt.replace(' ', 'T'));
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });
}

// ─── Main Page ───────────────────────────────────────────────
export default function TransactionsPage() {
    const {
        transactions, dailyReport, startDate, endDate, loading,
        setDateRange, fetchTransactions, fetchDailyReport
    } = useTransactionStore();

    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        fetchTransactions();
        fetchDailyReport();
    }, []);

    const income = dailyReport?.totalIncome ?? 0;
    const expense = dailyReport?.totalExpense ?? 0;
    const net = dailyReport?.netAmount ?? 0;
    const count = dailyReport?.transactionCount ?? 0;
    const isRange = startDate !== endDate;

    return (
        <>
            <div className="flex flex-col gap-5 transactions-page">
                {/* ── Header ───────────────────────────────*/}
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                        <h1 className="text-xl font-bold text-text-primary">Hesap Hareketleri</h1>
                        <span className="badge badge-cyan">
                            <Receipt size={10} /> {count} İşlem
                        </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Date range */}
                        <div className="glass-card-static flex items-center gap-2 px-3 py-2 rounded-xl">
                            <Calendar size={14} className="text-cyan-accent" />
                            <input
                                id="tx-start-date"
                                type="date"
                                value={startDate}
                                onChange={(e) => setDateRange(e.target.value, endDate)}
                                className="bg-transparent border-none outline-none text-sm text-text-primary"
                                style={{ colorScheme: 'dark' }}
                            />
                            <span className="text-text-muted text-xs">—</span>
                            <input
                                id="tx-end-date"
                                type="date"
                                value={endDate}
                                onChange={(e) => setDateRange(startDate, e.target.value)}
                                className="bg-transparent border-none outline-none text-sm text-text-primary"
                                style={{ colorScheme: 'dark' }}
                            />
                        </div>

                        <button
                            id="btn-add-transaction"
                            onClick={() => setShowModal(true)}
                            className="btn-primary flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold"
                        >
                            <Plus size={16} /> İşlem Ekle
                        </button>

                        <button
                            id="btn-print-report"
                            onClick={() => {
                                const columns = [
                                    { header: 'Tarih', key: 'CreatedAt', formatter: (v) => isRange ? fmtDate(v) : '' },
                                    { header: 'Saat', key: 'CreatedAt', formatter: (v) => fmtTime(v) },
                                    { header: 'Tür', key: 'Type', formatter: (v) => typeConfig[v]?.label || 'Bilinmiyor' },
                                    { header: 'Cari', key: 'Counterparty', formatter: (v) => v || '—' },
                                    { header: 'Açıklama', key: 'Description', formatter: (v) => v ? v.split(' | ')[0] : '—' },
                                    { header: 'Ödeme', key: 'PaymentMethod', formatter: (v) => v === 'Cash' ? 'Nakit' : 'Kart' },
                                    { header: 'Tutar (₺)', key: 'Amount', formatter: (v) => Number(v || 0).toFixed(2) },
                                ];
                                if (!isRange) columns.shift(); // Remove Date column if single day
                                printReport(transactions, columns, { title: 'Hesap Hareketleri Raporu' });
                            }}
                            className="glass-card-static flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-all cursor-pointer"
                        >
                            <Printer size={16} /> Yazdır
                        </button>

                        <button
                            id="btn-export-excel"
                            onClick={() => {
                                const columns = [
                                    { header: 'Tarih', key: 'CreatedAt', formatter: (v) => isRange ? fmtDate(v) : '' },
                                    { header: 'Saat', key: 'CreatedAt', formatter: (v) => fmtTime(v) },
                                    { header: 'Tür', key: 'Type', formatter: (v) => typeConfig[v]?.label || 'Bilinmiyor' },
                                    { header: 'Cari', key: 'Counterparty', formatter: (v) => v || '—' },
                                    { header: 'Açıklama', key: 'Description', formatter: (v) => v ? v.replace(/\n/g, ' - ') : '—' },
                                    { header: 'Ödeme', key: 'PaymentMethod', formatter: (v) => v === 'Cash' ? 'Nakit' : 'Kart' },
                                    { header: 'Tutar (₺)', key: 'Amount', formatter: (v) => Number(v || 0).toFixed(2) },
                                ];
                                if (!isRange) columns.shift();
                                exportToExcel(transactions, columns, 'Hesap_Hareketleri');
                            }}
                            className="glass-card-static flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all cursor-pointer"
                        >
                            <Download size={16} /> Excel
                        </button>
                    </div>
                </div>

                {/* ── KPI Cards ────────────────────────────*/}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <KpiCard label="Toplam Gelir" value={fmtMoney(income)} icon={TrendingUp} color="#10b981" />
                    <KpiCard label="Toplam Gider" value={fmtMoney(expense)} icon={TrendingDown} color="#ef4444" />
                    <KpiCard label="Net Tutar" value={fmtMoney(net)} icon={DollarSign} color="#06b6d4" />
                    <KpiCard label="İşlem Sayısı" value={count} icon={Hash} color="#a78bfa" />
                </div>

                {/* ── Payment Breakdown ────────────────────*/}
                {dailyReport?.byPaymentMethod && Object.keys(dailyReport.byPaymentMethod).length > 0 && (
                    <div className="glass-card p-4 rounded-2xl">
                        <h3 className="text-sm font-semibold text-text-muted mb-3">Ödeme Yöntemine Göre</h3>
                        <div className="flex flex-wrap gap-3">
                            {Object.entries(dailyReport.byPaymentMethod).map(([method, total]) => (
                                <div key={method} className="flex items-center gap-2 glass-card-static px-4 py-2 rounded-xl">
                                    {method === 'Cash'
                                        ? <Banknote size={16} className="text-emerald-400" />
                                        : <CreditCard size={16} className="text-blue-400" />}
                                    <span className="text-sm text-text-primary font-medium">{method === 'Cash' ? 'Nakit' : 'Kart'}</span>
                                    <span className="text-sm text-cyan-accent font-bold">{fmtMoney(total)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Transactions Table ───────────────────*/}
                <div className="glass-card p-4 rounded-2xl overflow-x-auto">
                    <h3 className="text-sm font-semibold text-text-muted mb-3">İşlem Geçmişi</h3>

                    {loading ? (
                        <div className="text-center text-text-muted py-10">Yükleniyor…</div>
                    ) : transactions.length === 0 ? (
                        <div className="text-center text-text-muted py-10">Bu tarih aralığında işlem bulunamadı</div>
                    ) : (
                        <table className="w-full text-sm" id="transactions-table">
                            <thead>
                                <tr className="text-left text-text-muted border-b border-white/5">
                                    {isRange && <th className="pb-2 pr-3">Tarih</th>}
                                    <th className="pb-2 pr-3">Saat</th>
                                    <th className="pb-2 pr-3">Tür</th>
                                    <th className="pb-2 pr-3">Cari</th>
                                    <th className="pb-2 pr-3">Açıklama</th>
                                    <th className="pb-2 pr-3">Ödeme</th>
                                    <th className="pb-2 text-right">Tutar</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.map((tx) => {
                                    const cfg = typeConfig[tx.Type] || typeConfig.Sale;
                                    const Icon = cfg.icon;
                                    const isNegative = tx.Amount < 0;
                                    return (
                                        <tr key={tx.ID} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                            {isRange && (
                                                <td className="py-3 pr-3 text-text-muted whitespace-nowrap">
                                                    {fmtDate(tx.CreatedAt)}
                                                </td>
                                            )}
                                            <td className="py-3 pr-3 text-text-muted whitespace-nowrap">
                                                <div className="flex items-center gap-1.5">
                                                    <Clock size={12} />
                                                    {fmtTime(tx.CreatedAt)}
                                                </div>
                                            </td>
                                            <td className="py-3 pr-3">
                                                <span
                                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold"
                                                    style={{ background: `${cfg.color}20`, color: cfg.color }}
                                                >
                                                    <Icon size={12} /> {cfg.label}
                                                </span>
                                            </td>
                                            <td className="py-3 pr-3 text-text-primary">
                                                {tx.Counterparty ? (
                                                    <div className="flex items-center gap-1">
                                                        <User size={12} className="text-text-muted" />
                                                        {tx.Counterparty}
                                                    </div>
                                                ) : (
                                                    <span className="text-text-muted">—</span>
                                                )}
                                            </td>
                                            <td className="py-3 pr-3 text-text-primary max-w-[200px] xl:max-w-[300px]">
                                                {tx.Description ? (
                                                    <div className="relative group cursor-help">
                                                        <div className="truncate">{tx.Description.split(' | ')[0]} {tx.Description.includes(' | ') ? '...' : ''}</div>
                                                        <div className="absolute left-0 bottom-full mb-2 hidden group-hover:flex flex-col gap-1 w-max max-w-xs md:max-w-md p-3 bg-bg-dark border border-white/10 rounded-xl shadow-2xl z-50 text-xs text-text-muted whitespace-pre-wrap">
                                                            {tx.Description.split(' | ').map((part, i) => (
                                                                <span key={i} className={i === 0 ? "text-text-primary font-semibold border-b border-white/5 pb-1 mb-1" : ""}>
                                                                    {part.trim()}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ) : '—'}
                                            </td>
                                            <td className="py-3 pr-3 text-text-muted">
                                                {tx.PaymentMethod === 'Cash' ? 'Nakit' : 'Kart'}
                                            </td>
                                            <td className={`py-3 text-right font-bold whitespace-nowrap ${isNegative ? 'text-red-400' : 'text-emerald-400'}`}>
                                                {isNegative ? '' : '+'}{fmtMoney(tx.Amount)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {showModal && <AddTransactionModal onClose={() => setShowModal(false)} />}

            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    .transactions-page, .transactions-page * { visibility: visible; }
                    .transactions-page { position: absolute; left: 0; top: 0; width: 100%; }
                    #btn-add-transaction, #btn-print-report, #btn-add-transaction *, #btn-print-report * { display: none !important; }
                    .glass-card, .glass-card-static { background: white !important; border: 1px solid #ddd !important; color: #111 !important; }
                    table { border-collapse: collapse; }
                    th, td { border-bottom: 1px solid #ccc; padding: 6px 8px; }
                }
            `}</style>
        </>
    );
}

// ─── KPI Card ────────────────────────────────────────────────
function KpiCard({ label, value, icon: Icon, color }) {
    return (
        <div className="glass-card p-4 rounded-2xl flex flex-col gap-2">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${color}20` }}>
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

// ─── Add Transaction Modal ───────────────────────────────────
function AddTransactionModal({ onClose }) {
    const createTransaction = useTransactionStore((s) => s.createTransaction);
    const { accounts, fetchAccounts } = useAccountStore();

    const [type, setType] = useState('Expense');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [counterparty, setCounterparty] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('Cash');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => { fetchAccounts(); }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!amount) return;
        setSubmitting(true);
        try {
            const numAmount = (type === 'Expense' || type === 'RefundSale') ? -Math.abs(Number(amount)) : Number(amount);
            await createTransaction({
                Type: type, Amount: numAmount, Description: description,
                Counterparty: counterparty || null, PaymentMethod: paymentMethod
            });
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
                className="glass-card p-6 rounded-2xl w-full max-w-md flex flex-col gap-4"
            >
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-text-primary">Yeni İşlem Ekle</h2>
                    <button type="button" onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors cursor-pointer">
                        <X size={20} />
                    </button>
                </div>

                {/* Type */}
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-text-muted font-medium">Tür</label>
                    <select
                        id="tx-type"
                        value={type}
                        onChange={(e) => setType(e.target.value)}
                        className="glass-card-static rounded-xl px-3 py-2 text-sm text-text-primary bg-transparent outline-none"
                    >
                        <option value="Expense">Gider</option>
                        <option value="RefundSale">Satış İade</option>
                        <option value="RefundPurchase">Alış İade</option>
                        <option value="Adjustment">Düzeltme</option>
                        <option value="Sale">Satış</option>
                    </select>
                </div>

                {/* Amount */}
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-text-muted font-medium">Tutar (₺)</label>
                    <input
                        id="tx-amount"
                        type="number" step="0.01" min="0"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00" required
                        className="glass-card-static rounded-xl px-3 py-2 text-sm text-text-primary bg-transparent outline-none"
                    />
                </div>

                {/* Counterparty */}
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-text-muted font-medium">Cari</label>
                    <select
                        id="tx-counterparty"
                        value={counterparty}
                        onChange={(e) => setCounterparty(e.target.value)}
                        className="glass-card-static rounded-xl px-3 py-2 text-sm text-text-primary bg-transparent outline-none"
                    >
                        <option value="">Cari seçin…</option>
                        {accounts.map(a => (
                            <option key={a.ID} value={a.Name}>{a.Name} ({a.Type})</option>
                        ))}
                    </select>
                </div>

                {/* Description */}
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-text-muted font-medium">Açıklama</label>
                    <input
                        id="tx-description"
                        type="text"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Açıklama girin..."
                        className="glass-card-static rounded-xl px-3 py-2 text-sm text-text-primary bg-transparent outline-none"
                    />
                </div>

                {/* Payment method */}
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-text-muted font-medium">Ödeme Yöntemi</label>
                    <div className="flex gap-2">
                        <button type="button"
                            onClick={() => setPaymentMethod('Cash')}
                            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer
                                ${paymentMethod === 'Cash' ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/50' : 'glass-card-static text-text-muted hover:text-text-primary'}`}
                        >
                            <Banknote size={16} /> Nakit
                        </button>
                        <button type="button"
                            onClick={() => setPaymentMethod('Card')}
                            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer
                                ${paymentMethod === 'Card' ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/50' : 'glass-card-static text-text-muted hover:text-text-primary'}`}
                        >
                            <CreditCard size={16} /> Kart
                        </button>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={submitting || !amount}
                    className="btn-primary w-full py-2.5 rounded-xl text-sm font-bold mt-2 disabled:opacity-50"
                >
                    {submitting ? 'Kaydediliyor…' : 'Kaydet'}
                </button>
            </form>
        </div>
    );
}
