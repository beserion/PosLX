import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import {
    ArrowLeft, FileText, User, Package, ClipboardList,
    Printer, Banknote, Download, CreditCard, Clock, Hash,
    ArrowUpRight, ArrowDownLeft
} from 'lucide-react';
import { useToast } from '../hooks/useToast';
import { exportToExcel } from '../lib/excelExport';
import { printReport } from '../lib/printExport';

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

export default function TransactionDetailPage() {
    const { accountId, ledgerId } = useParams();
    const navigate = useNavigate();
    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const toast = useToast();

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const { data } = await api.get(`/accounts/${accountId}/ledger/${ledgerId}/details`);
                
                // If it's a direct invoice, we might want to redirect, but user asked for detail page here.
                // However, if we have a robust InvoiceDetailPage, we could just use that.
                // For now, let's render it here to provide a consistent "Transaction Detail" experience.
                setDetails(data);
            } catch (err) {
                console.error(err);
                toast.error('İşlem detayları yüklenemedi.');
            } finally {
                setLoading(false);
            }
        };
        fetchDetails();
    }, [accountId, ledgerId]);

    if (loading) return <div className="p-4 text-text-muted text-center py-20">Yükleniyor...</div>;
    if (!details) return <div className="p-4 text-text-muted text-center py-20">İşlem bulunamadı.</div>;

    const hasItems = details.items && details.items.length > 0;
    const isInvoiceOrSale = details.source === 'invoice' || details.source === 'sale';

    const handlePrint = () => {
        if (!hasItems) {
            toast.info('Bu işlem için yazdırılacak kalem bulunmuyor.');
            return;
        }
        const columns = [
            { header: 'Ürün', key: 'ProductName' },
            { header: 'Miktar', key: 'Qty' },
            { header: 'Birim Fiyat', key: 'UnitPrice', formatter: v => fmtMoney(v) },
            { header: 'Toplam', key: 'RowTotal', formatter: (v, row) => fmtMoney(v || (row.Qty * row.UnitPrice)) }
        ];
        printReport(details.items, columns, { title: `İşlem Detayı: ${details.invoiceNo || '#' + ledgerId}` });
    };

    return (
        <div className="flex flex-col gap-5 text-text-primary">
            {/* Header */}
            <div className="flex items-center gap-3">
                <button onClick={() => navigate(-1)}
                    className="glass-card-static w-9 h-9 rounded-xl flex items-center justify-center text-text-muted hover:text-text-primary transition-colors cursor-pointer">
                    <ArrowLeft size={18} />
                </button>
                <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                        <Hash size={20} className="text-cyan-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-text-primary">İşlem Detayı</h1>
                        <span className="text-xs font-semibold text-text-muted">
                            Ref No: {details.invoiceNo || `#${ledgerId}`}
                        </span>
                    </div>
                </div>
                <div className="flex gap-2">
                    {hasItems && (
                        <button onClick={handlePrint}
                            className="glass-card-static flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-all cursor-pointer">
                            <Printer size={16} /> Yazdır
                        </button>
                    )}
                </div>
            </div>

            {/* Main Info Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass-card p-4 rounded-2xl flex flex-col gap-2">
                    <span className="text-xs text-text-muted font-medium">İşlem Türü</span>
                    <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold
                            ${details.invoiceType?.includes('İade') || details.invoiceType === 'Gider' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                            {details.invoiceType || 'Genel İşlem'}
                        </span>
                    </div>
                </div>
                <div className="glass-card p-4 rounded-2xl flex flex-col gap-2">
                    <span className="text-xs text-text-muted font-medium">Tarih & Saat</span>
                    <div className="flex items-center gap-2 text-sm">
                        <Clock size={14} className="text-text-muted" />
                        {fmtDate(details.createdAt)} {fmtTime(details.createdAt)}
                    </div>
                </div>
                <div className="glass-card p-4 rounded-2xl flex flex-col gap-2">
                    <span className="text-xs text-text-muted font-medium">Toplam Tutar</span>
                    <span className="text-lg font-bold text-cyan-accent">{fmtMoney(details.totalAmount)}</span>
                </div>
            </div>

            {/* Counterparty & Description */}
            <div className="glass-card p-5 rounded-2xl flex flex-col md:flex-row gap-8">
                <div className="flex-1 flex flex-col gap-3">
                    <h3 className="text-sm font-semibold text-text-muted flex items-center gap-2">
                        <User size={14} /> Cari Bilgisi
                    </h3>
                    <div className="text-text-primary font-bold text-lg">
                        {details.counterparty || 'Belirtilmedi'}
                    </div>
                </div>
                <div className="flex-[2] flex flex-col gap-3">
                    <h3 className="text-sm font-semibold text-text-muted flex items-center gap-2">
                        <ClipboardList size={14} /> Açıklama
                    </h3>
                    <div className="text-text-primary text-sm whitespace-pre-wrap bg-white/5 p-3 rounded-xl border border-white/5">
                        {details.description || 'Açıklama bulunmuyor.'}
                    </div>
                </div>
            </div>

            {/* Items Table (if any) */}
            {hasItems && (
                <div className="glass-card rounded-2xl overflow-hidden">
                    <div className="p-4 border-b border-white/5 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                            <Package size={16} className="text-cyan-accent" /> İşlem Kalemleri
                        </h3>
                        <span className="badge badge-cyan">{details.items.length} Kalem</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-white/5 text-text-muted">
                                <tr>
                                    <th className="p-3 pl-5 font-medium">Ürün</th>
                                    <th className="p-3 font-medium text-right">Miktar</th>
                                    <th className="p-3 font-medium text-right">Birim Fiyat</th>
                                    <th className="p-3 font-medium text-right">Vergi</th>
                                    <th className="p-3 pr-5 font-medium text-right">Toplam</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {details.items.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                                        <td className="p-3 pl-5 text-text-primary font-medium">{item.ProductName}</td>
                                        <td className="p-3 text-right font-mono">{item.Qty}</td>
                                        <td className="p-3 text-right font-mono">{fmtMoney(item.UnitPrice)}</td>
                                        <td className="p-3 text-right text-text-muted text-xs">
                                            {item.VatRate ? `%${item.VatRate} KDV` : '—'}
                                        </td>
                                        <td className="p-3 pr-5 text-right font-bold text-cyan-accent font-mono">
                                            {fmtMoney(item.RowTotal || (item.Qty * item.UnitPrice))}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    
                    {/* Summary Footer for Invoices/Sales */}
                    {isInvoiceOrSale && (
                        <div className="bg-white/[0.02] p-5 flex flex-col items-end gap-2 border-t border-white/5">
                            <div className="flex justify-between w-full max-w-[250px] text-sm">
                                <span className="text-text-muted">Ara Toplam:</span>
                                <span>{fmtMoney(details.subTotal)}</span>
                            </div>
                            {(details.totalDiscount || 0) > 0 && (
                                <div className="flex justify-between w-full max-w-[250px] text-sm">
                                    <span className="text-text-muted">İskonto:</span>
                                    <span className="text-orange-400">-{fmtMoney(details.totalDiscount)}</span>
                                </div>
                            )}
                            {(details.totalVat || 0) > 0 && (
                                <div className="flex justify-between w-full max-w-[250px] text-sm">
                                    <span className="text-text-muted">KDV:</span>
                                    <span>{fmtMoney(details.totalVat)}</span>
                                </div>
                            )}
                            <div className="flex justify-between w-full max-w-[250px] text-lg font-bold border-t border-white/10 pt-2 mt-1">
                                <span className="text-text-primary">Genel Toplam:</span>
                                <span className="text-cyan-accent">{fmtMoney(details.totalAmount)}</span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Payment Details Card (if payment) */}
            {details.source === 'payment' && (
                <div className="glass-card p-6 rounded-2xl flex flex-col gap-4 items-center justify-center text-center py-12">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-2">
                        <Banknote size={32} className="text-emerald-400" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-text-primary">{details.invoiceType} İşlemi</h3>
                        <p className="text-text-muted text-sm mt-1 max-w-md mx-auto">
                            Bu işlem doğrudan bir ödeme veya tahsilat kaydıdır. Herhangi bir ürün kalemi içermez.
                        </p>
                    </div>
                    <div className="flex gap-4 mt-2">
                        <div className="px-6 py-3 rounded-2xl bg-white/5 border border-white/5">
                            <span className="block text-[10px] uppercase tracking-widest text-text-muted font-bold mb-1">Yöntem</span>
                            <span className="text-text-primary font-bold">{details.paymentMethod || 'Nakit'}</span>
                        </div>
                        <div className="px-6 py-3 rounded-2xl bg-white/5 border border-white/5">
                            <span className="block text-[10px] uppercase tracking-widest text-text-muted font-bold mb-1">Tutar</span>
                            <span className="text-emerald-400 font-bold">{fmtMoney(details.totalAmount)}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
