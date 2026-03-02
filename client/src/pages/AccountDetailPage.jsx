import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAccountStore } from '../store/accountStore';
import {
    ArrowLeft, User, Building2, Phone, MapPin, CreditCard,
    ArrowUpRight, ArrowDownLeft, DollarSign, Calendar, Plus, X,
    Banknote, Clock, Hash
} from 'lucide-react';

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

export default function AccountDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { currentAccount, ledger, fetchAccount, fetchLedger, recordPayment } = useAccountStore();

    const [showPayment, setShowPayment] = useState(false);

    useEffect(() => {
        fetchAccount(id);
        fetchLedger(id);
    }, [id]);

    if (!currentAccount) return <div className="text-center text-text-muted py-20">Yükleniyor…</div>;

    const acc = currentAccount;
    const isCustomer = acc.Type === 'Müşteri';

    return (
        <>
            <div className="flex flex-col gap-5">
                {/* Back + Header */}
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/accounts')}
                        className="glass-card-static w-9 h-9 rounded-xl flex items-center justify-center text-text-muted hover:text-text-primary transition-colors cursor-pointer">
                        <ArrowLeft size={18} />
                    </button>
                    <div className="flex items-center gap-3 flex-1">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center
                            ${isCustomer ? 'bg-blue-500/20' : 'bg-orange-500/20'}`}>
                            {isCustomer ? <User size={20} className="text-blue-400" /> : <Building2 size={20} className="text-orange-400" />}
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-text-primary">{acc.Name}</h1>
                            <span className={`text-xs font-semibold ${isCustomer ? 'text-blue-400' : 'text-orange-400'}`}>
                                {acc.Type}
                            </span>
                        </div>
                    </div>
                    <button onClick={() => setShowPayment(true)}
                        className="btn-primary flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold">
                        <Plus size={16} /> {isCustomer ? 'Tahsilat' : 'Ödeme'}
                    </button>
                </div>

                {/* Info Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <KpiCard label="Toplam Borç" value={fmtMoney(acc.totalDebt)} icon={ArrowUpRight} color="#ef4444" />
                    <KpiCard label="Toplam Alacak" value={fmtMoney(acc.totalCredit)} icon={ArrowDownLeft} color="#10b981" />
                    <KpiCard label="Net Bakiye" value={fmtMoney(acc.calculatedBalance)} icon={DollarSign}
                        color={acc.calculatedBalance > 0 ? '#ef4444' : '#10b981'} />
                    <KpiCard label="İşlem Sayısı" value={ledger.length} icon={Hash} color="#a78bfa" />
                </div>

                {/* Contact Info */}
                <div className="glass-card p-4 rounded-2xl">
                    <h3 className="text-sm font-semibold text-text-muted mb-3">İletişim Bilgileri</h3>
                    <div className="flex flex-wrap gap-4">
                        {acc.Phone && acc.Phone !== '-' && (
                            <div className="flex items-center gap-2 text-sm text-text-primary">
                                <Phone size={14} className="text-text-muted" /> {acc.Phone}
                            </div>
                        )}
                        {acc.Address && (
                            <div className="flex items-center gap-2 text-sm text-text-primary">
                                <MapPin size={14} className="text-text-muted" /> {acc.Address}
                            </div>
                        )}
                        {acc.TaxNo && (
                            <div className="flex items-center gap-2 text-sm text-text-primary">
                                <CreditCard size={14} className="text-text-muted" /> VKN: {acc.TaxNo}
                            </div>
                        )}
                    </div>
                </div>

                {/* Ledger Table */}
                <div className="glass-card p-4 rounded-2xl overflow-x-auto">
                    <h3 className="text-sm font-semibold text-text-muted mb-3">Hareket Defteri</h3>

                    {ledger.length === 0 ? (
                        <div className="text-center text-text-muted py-10">Henüz hareket yok</div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-text-muted border-b border-white/5">
                                    <th className="pb-2 pr-3">Tarih</th>
                                    <th className="pb-2 pr-3">Saat</th>
                                    <th className="pb-2 pr-3">Tür</th>
                                    <th className="pb-2 pr-3">Açıklama</th>
                                    <th className="pb-2 pr-3">Ref</th>
                                    <th className="pb-2 pr-3 text-right">Borç</th>
                                    <th className="pb-2 pr-3 text-right">Alacak</th>
                                    <th className="pb-2 text-right">Bakiye</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ledger.map(entry => (
                                    <tr key={entry.ID} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                        <td className="py-3 pr-3 text-text-muted whitespace-nowrap">{fmtDate(entry.CreatedAt)}</td>
                                        <td className="py-3 pr-3 text-text-muted whitespace-nowrap">
                                            <div className="flex items-center gap-1"><Clock size={12} />{fmtTime(entry.CreatedAt)}</div>
                                        </td>
                                        <td className="py-3 pr-3">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold
                                                ${entry.Type === 'Borç' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                                {entry.Type === 'Borç' ? <ArrowUpRight size={12} /> : <ArrowDownLeft size={12} />}
                                                {entry.Type}
                                            </span>
                                        </td>
                                        <td className="py-3 pr-3 text-text-primary max-w-[200px] xl:max-w-[300px]">
                                            {entry.Description ? (
                                                <div className="relative group cursor-help">
                                                    <div className="truncate">{entry.Description.split(' | ')[0]} {entry.Description.includes(' | ') ? '...' : ''}</div>
                                                    <div className="absolute left-0 bottom-full mb-2 hidden group-hover:flex flex-col gap-1 w-max max-w-xs md:max-w-md p-3 bg-bg-dark border border-white/10 rounded-xl shadow-2xl z-50 text-xs text-text-muted whitespace-pre-wrap">
                                                        {entry.Description.split(' | ').map((part, i) => (
                                                            <span key={i} className={i === 0 ? "text-text-primary font-semibold border-b border-white/5 pb-1 mb-1" : ""}>
                                                                {part.trim()}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : '—'}
                                        </td>
                                        <td className="py-3 pr-3 text-text-muted text-xs">{entry.RefType || '—'}</td>
                                        <td className="py-3 pr-3 text-right font-bold text-red-400">
                                            {entry.Type === 'Borç' ? fmtMoney(entry.Amount) : ''}
                                        </td>
                                        <td className="py-3 pr-3 text-right font-bold text-emerald-400">
                                            {entry.Type === 'Alacak' ? fmtMoney(entry.Amount) : ''}
                                        </td>
                                        <td className={`py-3 text-right font-bold whitespace-nowrap
                                            ${entry.RunningBalance > 0 ? 'text-red-400' : entry.RunningBalance < 0 ? 'text-emerald-400' : 'text-text-muted'}`}>
                                            {fmtMoney(entry.RunningBalance)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {showPayment && <PaymentModal accountId={id} accountName={acc.Name} accountType={acc.Type} onClose={() => setShowPayment(false)} />}
        </>
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

function PaymentModal({ accountId, accountName, accountType, onClose }) {
    const isSupplier = accountType === 'Tedarikçi';
    const actionLabel = isSupplier ? 'Ödeme' : 'Tahsilat';
    const { recordPayment } = useAccountStore();
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('Cash');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!amount || Number(amount) <= 0) return;
        setSubmitting(true);
        try {
            await recordPayment(accountId, {
                Amount: Number(amount),
                Description: description || null,
                PaymentMethod: paymentMethod
            });
            onClose();
        } catch (err) {
            alert(err.response?.data?.error || err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <form onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}
                className="glass-card p-6 rounded-2xl w-full max-w-md flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-text-primary">{actionLabel} — {accountName}</h2>
                    <button type="button" onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors cursor-pointer">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-xs text-text-muted font-medium">Tutar (₺)</label>
                    <input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00" required
                        className="glass-card-static rounded-xl px-3 py-2 text-sm text-text-primary bg-transparent outline-none" />
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-xs text-text-muted font-medium">Açıklama</label>
                    <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                        placeholder={`${actionLabel} notu...`}
                        className="glass-card-static rounded-xl px-3 py-2 text-sm text-text-primary bg-transparent outline-none" />
                </div>

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

                <button type="submit" disabled={submitting || !amount}
                    className="btn-primary w-full py-2.5 rounded-xl text-sm font-bold mt-2 disabled:opacity-50">
                    {submitting ? 'Kaydediliyor…' : `${actionLabel} Kaydet`}
                </button>
            </form>
        </div>
    );
}
