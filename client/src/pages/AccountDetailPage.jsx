import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAccountStore } from '../store/accountStore';
import {
    ArrowLeft, User, Building2, Phone, MapPin, CreditCard,
    ArrowUpRight, ArrowDownLeft, DollarSign, Calendar, Plus, X,
    Banknote, Clock, Hash
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

export default function AccountDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { currentAccount, ledger, fetchAccount, fetchLedger, recordPayment } = useAccountStore();

    const [showPayment, setShowPayment] = useState(false);
    const [selectedLedgerEntry, setSelectedLedgerEntry] = useState(null);

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
                    <KpiCard
                        label={isCustomer ? "Bize Kalan Borç" : "Kalan Alacağı (Bizim Borcumuz)"}
                        value={fmtMoney(Math.abs(acc.calculatedBalance))}
                        icon={DollarSign}
                        color={
                            (isCustomer && acc.calculatedBalance > 0) ? '#ef4444' :
                                (isCustomer && acc.calculatedBalance < 0) ? '#10b981' :
                                    (!isCustomer && acc.calculatedBalance < 0) ? '#ef4444' :
                                        '#10b981'
                        }
                    />
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
                                    <tr key={entry.ID} onClick={() => navigate(`/accounts/${id}/ledger/${entry.ID}`)} className="border-b border-white/5 hover:bg-cyan-500/5 transition-all cursor-pointer group">
                                        <td className="p-3 pl-4 border-r border-white/5 text-text-muted">
                                            {entry.CreatedAt ? new Date(entry.CreatedAt.replace(' ', 'T')).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                                        </td>
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
                                            ${entry.RunningBalance > 0 ? (isCustomer ? 'text-red-400' : 'text-emerald-400')
                                                : entry.RunningBalance < 0 ? (isCustomer ? 'text-emerald-400' : 'text-red-400') : 'text-text-muted'}`}>
                                            {fmtMoney(Math.abs(entry.RunningBalance))} {entry.RunningBalance < 0 ? '(A)' : entry.RunningBalance > 0 ? '(B)' : ''}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {showPayment && <PaymentModal accountId={id} accountName={acc.Name} accountType={acc.Type} onClose={() => setShowPayment(false)} />}
            {selectedLedgerEntry && <LedgerDetailModal entry={selectedLedgerEntry} accountId={id} onClose={() => setSelectedLedgerEntry(null)} />}
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
    const toast = useToast();
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
            toast.error(err.response?.data?.error || err.message);
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

function LedgerDetailModal({ entry, accountId, onClose }) {
    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(false);
    const toast = useToast();

    useEffect(() => {
        setLoading(true);
        import('../lib/api').then(({ default: api }) => {
            api.get(`/accounts/${accountId}/ledger/${entry.ID}/details`)
                .then(res => setDetails(res.data))
                .catch(err => toast.error(err.response?.data?.error || 'Detaylar alınamadı'))
                .finally(() => setLoading(false));
        });
    }, [entry, accountId]);

    const hasItems = details && !details.noDetails && details.items && details.items.length > 0;
    const hasDiscounts = hasItems && details.items.some(i => (i.Disc1 || 0) > 0 || (i.Disc2 || 0) > 0 || (i.Disc3 || 0) > 0);

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div onClick={(e) => e.stopPropagation()}
                className="glass-card p-6 rounded-2xl w-full max-w-3xl flex flex-col gap-4 max-h-[90vh]">
                
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div>
                        <h2 className="text-lg font-bold text-text-primary">İşlem Detayı</h2>
                        <div className="text-xs text-text-muted flex items-center gap-2 mt-1">
                            <span>{fmtDate(entry.CreatedAt)} {fmtTime(entry.CreatedAt)}</span>
                            <span>•</span>
                            <span className={entry.Type === 'Borç' ? 'text-red-400' : 'text-emerald-400'}>{entry.Type}</span>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors cursor-pointer bg-white/5 hover:bg-white/10 p-2 rounded-xl">
                        <X size={20} />
                    </button>
                </div>

                <div className="overflow-y-auto pr-2 flex flex-col gap-4">
                    {/* Ledger entry info */}
                    <div className="glass-card-static p-4 rounded-xl flex flex-col gap-2">
                        <div className="flex justify-between items-start">
                            <div className="text-sm text-text-muted font-medium w-24">Açıklama</div>
                            <div className="text-sm text-text-primary flex-1 text-right break-words">{entry.Description || '—'}</div>
                        </div>
                        <div className="flex justify-between items-center">
                            <div className="text-sm text-text-muted font-medium w-24">Tutar</div>
                            <div className={`text-sm font-bold ${entry.Type === 'Borç' ? 'text-red-400' : 'text-emerald-400'}`}>
                                {fmtMoney(entry.Amount)}
                            </div>
                        </div>
                        <div className="flex justify-between items-center">
                            <div className="text-sm text-text-muted font-medium w-24">Tür</div>
                            <div className="text-sm text-text-primary">
                                {entry.RefType || 'Manuel İşlem'}
                            </div>
                        </div>
                    </div>

                    {/* Invoice/Sale summary */}
                    {hasItems && details.invoiceNo && (
                        <div className="glass-card-static p-4 rounded-xl">
                            <h3 className="text-sm font-bold text-text-primary mb-2">
                                {details.source === 'sale' ? 'Satış Bilgileri' : 'Fatura Bilgileri'}
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-text-muted">Evrak No:</span>
                                    <span className="text-text-primary font-medium">{details.invoiceNo || '—'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-text-muted">Tip:</span>
                                    <span className="text-text-primary font-medium">{details.invoiceType || '—'}</span>
                                </div>
                                {details.counterparty && (
                                    <div className="flex justify-between">
                                        <span className="text-text-muted">Cari:</span>
                                        <span className="text-text-primary font-medium">{details.counterparty}</span>
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <span className="text-text-muted">Alt Toplam:</span>
                                    <span className="text-text-primary font-medium">{fmtMoney(details.subTotal)}</span>
                                </div>
                                {(details.totalDiscount || 0) > 0 && (
                                    <div className="flex justify-between">
                                        <span className="text-text-muted">İskonto:</span>
                                        <span className="text-orange-400 font-medium">-{fmtMoney(details.totalDiscount)}</span>
                                    </div>
                                )}
                                {(details.totalVat || 0) > 0 && (
                                    <div className="flex justify-between">
                                        <span className="text-text-muted">KDV:</span>
                                        <span className="text-text-primary font-medium">{fmtMoney(details.totalVat)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <span className="text-text-muted font-semibold">G.Toplam:</span>
                                    <span className="text-cyan-accent font-bold">{fmtMoney(details.totalAmount)}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Items table */}
                    {(loading || hasItems) && (
                        <div className="flex flex-col gap-2">
                            <h3 className="text-sm font-bold text-text-primary">
                                Kalemler ({hasItems ? details.items.length : '…'})
                            </h3>
                            {loading ? (
                                <div className="text-center text-text-muted py-6">Yükleniyor…</div>
                            ) : hasItems ? (
                                <div className="glass-card-static rounded-xl overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead className="bg-white/5">
                                            <tr className="text-left text-text-muted">
                                                <th className="p-3 font-medium">Ürün</th>
                                                <th className="p-3 font-medium text-right">Miktar</th>
                                                <th className="p-3 font-medium text-right">B.Fiyat</th>
                                                {hasDiscounts && <th className="p-3 font-medium text-right">İsk.</th>}
                                                <th className="p-3 font-medium text-right">KDV</th>
                                                <th className="p-3 font-medium text-right">Toplam</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {details.items.map((item, idx) => {
                                                const disc = [item.Disc1, item.Disc2, item.Disc3].filter(d => d && d > 0);
                                                const discStr = disc.length > 0 ? disc.map(d => `%${d}`).join('+') : '';
                                                const rowTotal = item.RowTotal || (item.Qty * item.UnitPrice);
                                                return (
                                                    <tr key={idx} className="hover:bg-white/[0.02]">
                                                        <td className="p-3 text-text-primary">{item.ProductName}</td>
                                                        <td className="p-3 text-right">{item.Qty}</td>
                                                        <td className="p-3 text-right">{fmtMoney(item.UnitPrice)}</td>
                                                        {hasDiscounts && (
                                                            <td className="p-3 text-right text-orange-400">
                                                                {discStr || '—'}
                                                            </td>
                                                        )}
                                                        <td className="p-3 text-right text-text-muted">
                                                            {item.VatRate ? `%${item.VatRate}` : '—'}
                                                        </td>
                                                        <td className="p-3 text-right font-medium text-cyan-accent">
                                                            {fmtMoney(rowTotal)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center text-text-muted py-6 glass-card-static rounded-xl">İçerik detayı bulunamadı</div>
                            )}
                        </div>
                    )}

                    {/* No details found */}
                    {!loading && details && details.noDetails && (
                        <div className="text-center text-text-muted py-6 glass-card-static rounded-xl">
                            Bu işleme ait detaylı kalem bilgisi bulunamadı.
                        </div>
                    )}
                </div>

                <div className="pt-2 border-t border-white/10">
                    <button type="button" onClick={onClose}
                        className="btn-primary w-full py-2.5 rounded-xl text-sm font-bold">
                        Kapat
                    </button>
                </div>
            </div>
        </div>
    );
}
