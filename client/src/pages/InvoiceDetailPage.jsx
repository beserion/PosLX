import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import {
    ArrowLeft, FileText, User, Package, ClipboardList,
    Printer, Banknote
} from 'lucide-react';
import { useToast } from '../hooks/useToast';

function fmtMoney(v) {
    return `₺${Number(v || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function InvoiceDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [invoice, setInvoice] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('genel');
    const toast = useToast();

    useEffect(() => {
        const fetchInvoice = async () => {
            try {
                const { data } = await api.get(`/invoices/${id}`);
                setInvoice(data);
            } catch (err) {
                console.error(err);
                alert('Fatura detayı yüklenemedi.');
            } finally {
                setLoading(false);
            }
        };
        fetchInvoice();
    }, [id]);

    if (loading) return <div className="p-4 text-text-muted">Yükleniyor...</div>;
    if (!invoice) return <div className="p-4 text-text-muted">Fatura bulunamadı.</div>;

    const { items = [] } = invoice;
    const grandTotal = invoice.TotalAmount || items.reduce((sum, item) => sum + (item.Qty * item.UnitPrice), 0);

    const handlePrint = async () => {
        try {
            const saleData = {
                receiptNo: invoice.InvoiceNo || invoice.ID,
                items: items.map(i => ({
                    Name: i.ProductName,
                    qty: i.Qty,
                    SalePrice: i.UnitPrice
                })),
                subtotal: invoice.SubTotal || items.reduce((sum, i) => sum + (i.Qty * i.UnitPrice), 0),
                tax: invoice.TotalVat || 0,
                total: grandTotal,
                discount: invoice.TotalDiscount || 0,
                serviceFee: 0,
                paymentMethod: invoice.PaymentMethod === 'Card' ? 'Card' : 'Cash',
                date: invoice.CreatedAt
            };

            await api.post('/print', saleData);
            toast.success('Fiş termal yazıcıya gönderildi.');
        } catch (err) {
            console.error('Print Error:', err);
            toast.error('Fiş yazdırma başarısız. Yazıcı bağlantısını kontrol edin.');
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-2rem)] gap-4 w-full text-text-primary">
            {/* Ribbon / Top Bar */}
            <div className="glass-card flex flex-col md:flex-row items-center justify-between p-3 rounded-2xl shrink-0 gap-3">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/invoices')} className="p-2 text-text-muted hover:text-text-primary hover:bg-white/5 rounded-xl transition-colors cursor-pointer shrink-0">
                        <ArrowLeft size={20} />
                    </button>
                    <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
                        <FileText className="text-cyan-accent" />
                        Fatura Detayı: <span className="text-cyan-accent/80 ml-1">{invoice.InvoiceNo || `#${invoice.ID}`}</span>
                    </h1>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold ${invoice.Type === 'İrsaliye' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
                        {invoice.Type}
                    </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl border border-white/5 hover:bg-white/10 text-text-primary transition-all cursor-pointer">
                        <Printer size={16} /> <span className="hidden sm:inline">Yazdır</span>
                    </button>
                </div>
            </div>

            {/* Header Data & Tabs */}
            <div className="glass-card rounded-2xl flex flex-col shrink-0">
                <div className="flex border-b border-white/5 px-2 pt-2 gap-1 overflow-x-auto hide-scrollbar">
                    {[
                        { id: 'genel', label: 'Genel Bilgiler', icon: <FileText size={14} /> },
                        { id: 'cari', label: 'Cari Bilgiler', icon: <User size={14} /> },
                        { id: 'sevk', label: 'Sevk Bilgileri', icon: <Package size={14} /> },
                        { id: 'not', label: 'Not & Açıklama', icon: <ClipboardList size={14} /> },
                    ].map(t => (
                        <button
                            key={t.id}
                            onClick={() => setActiveTab(t.id)}
                            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-xl transition-all cursor-pointer border-b-2
                                ${activeTab === t.id ? 'border-cyan-accent text-cyan-accent bg-white/[0.03]' : 'border-transparent text-text-muted hover:text-text-primary hover:bg-white/[0.02]'}`}
                        >
                            {t.icon} {t.label}
                        </button>
                    ))}
                </div>

                <div className="p-4 bg-white/[0.01]">
                    {activeTab === 'genel' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="flex flex-col gap-1.5">
                                <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-1"><User size={12} /> Cari Hesap</span>
                                <span className="font-semibold text-lg text-text-primary">{invoice.Counterparty}</span>
                            </div>
                            <div className="flex flex-col gap-1.5 align-center">
                                <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-1"><FileText size={12} /> Fatura Tarihi</span>
                                <span className="font-medium text-text-primary/90">{invoice.CreatedAt ? new Date(invoice.CreatedAt.replace(' ', 'T')).toLocaleString('tr-TR') : '-'}</span>
                            </div>
                            <div className="flex flex-col gap-1.5 align-center">
                                <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-1"><Package size={12} /> Sevk Tarihi</span>
                                <span className="font-medium text-text-primary/90">{invoice.ShipDate ? new Date(invoice.ShipDate.replace(' ', 'T')).toLocaleString('tr-TR') : '-'}</span>
                            </div>
                            <div className="flex flex-col gap-1.5 align-center">
                                <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-1"><Banknote size={12} /> Ödeme Vadesi (Gün)</span>
                                <span className="font-medium text-text-primary/90">{invoice.PaymentDays || 0}</span>
                            </div>
                            <div className="flex flex-col gap-1.5 align-center">
                                <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-1">Durum</span>
                                <span className={`font-semibold ${invoice.IsOpen ? 'text-emerald-400' : 'text-text-muted'}`}>{invoice.IsOpen ? 'Açık' : 'Kapalı'}</span>
                            </div>
                        </div>
                    )}
                    {activeTab === 'cari' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                            <div className="flex flex-col gap-1.5">
                                <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-1">Vergi Dairesi</span>
                                <span className="font-medium text-text-primary/90">{invoice.TaxOffice || '-'}</span>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-1">Vergi/TC No</span>
                                <span className="font-medium text-text-primary/90">{invoice.TaxNumber || '-'}</span>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-1">Telefon</span>
                                <span className="font-medium text-text-primary/90">{invoice.Phone || '-'}</span>
                            </div>
                            <div className="flex flex-col gap-1.5 lg:col-span-2">
                                <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-1">Adres</span>
                                <span className="font-medium text-text-primary/90 whitespace-pre-wrap">{invoice.Address || '-'}</span>
                            </div>
                        </div>
                    )}
                    {activeTab === 'sevk' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="flex flex-col gap-1.5">
                                <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-1">İrsaliye No</span>
                                <span className="font-medium text-text-primary/90">{invoice.WaybillNo || '-'}</span>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-1">Taşıyıcı</span>
                                <span className="font-medium text-text-primary/90">{invoice.Carrier || '-'}</span>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-1">Araç Plaka</span>
                                <span className="font-medium text-text-primary/90">{invoice.PlateNo || '-'}</span>
                            </div>
                        </div>
                    )}
                    {activeTab === 'not' && (
                        <div className="text-sm text-text-primary/80 bg-white/5 p-4 rounded-xl border border-white/5 min-h-[80px]">
                            {invoice.InternalNote || invoice.Description || 'Açıklama veya not bulunmuyor.'}
                        </div>
                    )}
                </div>
            </div>

            {/* Grid Area */}
            <div className="glass-card rounded-2xl flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-auto bg-bg-dark/20 relative custom-scrollbar">
                    <table className="w-full text-xs text-left whitespace-nowrap min-w-max">
                        <thead className="sticky top-0 bg-[#161b26] text-text-muted shadow-sm shadow-[#0a0e1a]/50 z-10 select-none">
                            <tr>
                                <th className="p-2.5 font-semibold text-[11px] uppercase tracking-wider border-r border-b border-white/5 w-10 text-center">#</th>
                                <th className="p-2.5 font-semibold text-[11px] uppercase tracking-wider border-r border-b border-white/5 min-w-[180px]">Stok Adı</th>
                                <th className="p-2.5 font-semibold text-[11px] uppercase tracking-wider border-r border-b border-white/5 w-24 text-right">Miktar</th>
                                <th className="p-2.5 font-semibold text-[11px] uppercase tracking-wider border-r border-b border-white/5 w-24 text-right">KDV</th>
                                <th className="p-2.5 font-semibold text-[11px] uppercase tracking-wider border-r border-b border-white/5 w-24 text-center">KDV Dah/Har</th>
                                <th className="p-2.5 font-semibold text-[11px] uppercase tracking-wider border-r border-b border-white/5 w-28 text-right">Birim Fiyat</th>
                                <th className="p-2.5 font-semibold text-[11px] uppercase tracking-wider border-r border-b border-white/5 w-16 text-center text-amber-500/70">İsk 1 (%)</th>
                                <th className="p-2.5 font-semibold text-[11px] uppercase tracking-wider border-r border-b border-white/5 w-16 text-center text-amber-500/70">İsk 2 (%)</th>
                                <th className="p-2.5 font-semibold text-[11px] uppercase tracking-wider border-r border-b border-white/5 w-16 text-center text-amber-500/70">İsk 3 (%)</th>
                                <th className="p-2.5 font-semibold text-[11px] uppercase tracking-wider border-b border-white/5 w-32 text-right text-cyan-accent">Toplam</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, idx) => (
                                <tr key={idx} className="hover:bg-white/[0.04] group border-b border-white/5 transition-colors">
                                    <td className="p-2 border-r border-white/5 text-center text-text-muted/50 font-mono text-[11px]">{idx + 1}</td>
                                    <td className="p-2 border-r border-white/5 font-semibold text-text-primary">{item.ProductName}</td>
                                    <td className="p-2 border-r border-white/5 text-right text-text-primary font-mono text-[13px]">{item.Qty}</td>
                                    <td className="p-2 border-r border-white/5 text-right text-text-primary font-mono text-[13px]">{item.VatRate || 0}</td>
                                    <td className="p-2 border-r border-white/5 text-center text-text-primary text-[13px]">{item.VatType || 'Hariç'}</td>
                                    <td className="p-2 border-r border-white/5 text-right text-text-primary font-mono text-[13px]">{fmtMoney(item.UnitPrice)}</td>
                                    <td className="p-2 border-r border-white/5 text-center text-amber-400 font-mono text-[13px] bg-amber-500/[0.02]">{item.Disc1 || 0}</td>
                                    <td className="p-2 border-r border-white/5 text-center text-amber-400 font-mono text-[13px] bg-amber-500/[0.02]">{item.Disc2 || 0}</td>
                                    <td className="p-2 border-r border-white/5 text-center text-amber-400 font-mono text-[13px] bg-amber-500/[0.02]">{item.Disc3 || 0}</td>
                                    <td className="p-2 text-right font-bold text-cyan-accent font-mono text-[13px] bg-cyan-accent/5">
                                        {fmtMoney(item.RowTotal || (item.Qty * item.UnitPrice))}
                                    </td>
                                </tr>
                            ))}
                            {items.length === 0 && (
                                <tr>
                                    <td colSpan={10} className="p-8 text-center text-text-muted">Faturaya ait kalem bulunamadı.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Footer */}
            <div className="glass-card rounded-2xl p-5 shrink-0 grid grid-cols-1 md:grid-cols-2 gap-4 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-cyan-900/10 via-bg-dark to-bg-dark border border-white/10 relative overflow-hidden">
                <div className="flex flex-col justify-center relative z-10">
                    <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-1 flex items-center gap-1"><Banknote size={14} className="inline mr-1" />Ödeme Tipi</span>
                    <span className="font-semibold text-emerald-400 text-lg">{invoice.PaymentMethod === 'Card' ? 'Kredi Kartı' : 'Nakit'}</span>
                </div>
                <div className="flex flex-col gap-2 relative z-10 items-end justify-center w-full">
                    <div className="w-full max-w-[350px] flex flex-col gap-2">
                        <div className="flex items-center justify-between text-sm px-2">
                            <span className="text-text-muted font-medium">İsk. Öncesi Toplam</span>
                            <span className="font-mono text-text-primary font-semibold">{fmtMoney(invoice.SubTotal || 0)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm px-2">
                            <span className="text-text-muted font-medium">İskonto Tutarı</span>
                            <span className="font-mono text-amber-400 font-semibold">-{fmtMoney(invoice.TotalDiscount || 0)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm px-2 pb-3 border-b border-white/10">
                            <span className="text-text-muted font-medium">KDV Toplamı</span>
                            <span className="font-mono text-text-primary font-semibold">{fmtMoney(invoice.TotalVat || 0)}</span>
                        </div>
                        <div className="flex items-center justify-between mt-1 px-2">
                            <span className="text-sm font-black text-text-primary uppercase tracking-widest">Genel Toplam</span>
                            <span className="text-2xl font-bold text-cyan-accent font-mono tracking-tight">{fmtMoney(grandTotal)}</span>
                        </div>
                    </div>
                </div>
                <div className="absolute inset-x-0 -bottom-10 h-10 bg-cyan-accent/20 blur-2xl rounded-full z-0 opacity-40" />
            </div>
        </div>
    );
}
