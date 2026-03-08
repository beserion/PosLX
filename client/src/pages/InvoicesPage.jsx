import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePosStore } from '../store/posStore';
import { useAccountStore } from '../store/accountStore';
import api from '../lib/api';
import {
    FileText, Plus, X, Trash2, Package, User,
    CreditCard, Banknote, Calendar, ClipboardList, Barcode,
    Save, Printer, ArrowRightCircle, CheckCircle2,
    ListFilter, Download
} from 'lucide-react';
import { exportToExcel } from '../lib/excelExport';
import { printReport } from '../lib/printExport';

function fmtMoney(v) {
    return `₺${Number(v || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Main Page Component (Acts as a container for List vs Form) ──
export default function InvoicesPage() {
    const navigate = useNavigate();
    const [view, setView] = useState('list'); // 'list' | 'form'
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);

    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('Tümü');

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
        const reason = prompt('İptal/İade sebebini yazın (opsiyonel):') || '';
        try {
            await api.delete(`/invoices/${id}`, { data: { reason } });
            fetchInvoices();
        } catch (err) {
            alert(err.response?.data?.error || err.message);
        }
    };

    if (view === 'form') {
        return (
            <InvoiceForm
                onClose={() => {
                    setView('list');
                    fetchInvoices();
                }}
            />
        );
    }

    const filteredInvoices = invoices.filter(inv => {
        const matchesSearch = (inv.InvoiceNo?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
            (inv.Counterparty?.toLowerCase() || '').includes(searchQuery.toLowerCase());
        const matchesType = filterType === 'Tümü' || inv.Type === filterType;
        return matchesSearch && matchesType;
    });

    // ── LIST VIEW ──
    return (
        <div className="flex flex-col gap-4 h-[calc(100vh-2rem)] w-full">
            {/* Header Ribbon */}
            <div className="flex flex-col gap-4 shrink-0">
                <div className="flex items-center justify-between">
                    <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
                        <FileText className="text-cyan-accent" />
                        Faturalar / İrsaliyeler
                    </h1>
                    <span className="badge badge-cyan">{filteredInvoices.length} Kayıt</span>
                </div>

                <div className="flex flex-col md:flex-row items-start md:items-center gap-4 glass-card p-3 rounded-2xl border border-white/5">
                    <button
                        onClick={() => setView('form')}
                        className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl shadow-lg border-0 shrink-0 cursor-pointer"
                    >
                        <Plus size={18} /> Yeni Oluştur
                    </button>
                    <button
                        onClick={() => {
                            const columns = [
                                { header: 'Tarih', key: 'CreatedAt', formatter: (v) => v ? new Date(v.replace(' ', 'T')).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '' },
                                { header: 'Belge No', key: 'InvoiceNo', formatter: (v, row) => v || `#${row.ID}` },
                                { header: 'Tür', key: 'Type' },
                                { header: 'Cari', key: 'Counterparty' },
                                { header: 'Durum', key: 'IsOpen', formatter: (v) => v ? 'Açık' : 'Kapalı' },
                                { header: 'Ödeme Tipi', key: 'PaymentMethod', formatter: (v) => v === 'Card' ? 'Kredi Kartı' : v === 'Account' ? 'Cari Hesap' : 'Nakit' },
                                { header: 'Vade (Gün)', key: 'PaymentDays' },
                                { header: 'İsk. Öncesi Toplam (₺)', key: 'SubTotal', formatter: (v) => Number(v || 0).toFixed(2) },
                                { header: 'İskonto Tutarı (₺)', key: 'TotalDiscount', formatter: (v) => Number(v || 0).toFixed(2) },
                                { header: 'KDV Toplamı (₺)', key: 'TotalVat', formatter: (v) => Number(v || 0).toFixed(2) },
                                { header: 'Genel Toplam (₺)', key: 'TotalAmount', formatter: (v) => Number(v || 0).toFixed(2) },
                                { header: 'Vergi Dairesi', key: 'TaxOffice' },
                                { header: 'Vergi/TC No', key: 'TaxNumber' },
                                { header: 'Telefon', key: 'Phone' },
                                { header: 'Adres', key: 'Address' },
                                { header: 'Sevk Tarihi', key: 'ShipDate', formatter: (v) => v ? new Date(v.replace(' ', 'T')).toLocaleDateString('tr-TR') : '' },
                                { header: 'İrsaliye No', key: 'WaybillNo' },
                                { header: 'Taşıyıcı', key: 'Carrier' },
                                { header: 'Araç Plaka', key: 'PlateNo' },
                                { header: 'Dahili Not', key: 'InternalNote' },
                                { header: 'İçerik', key: 'ItemsSummary' },
                            ];
                            printReport(filteredInvoices, columns, { title: 'Fatura & İrsaliye Listesi' });
                        }}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-all cursor-pointer shrink-0"
                    >
                        <Printer size={16} /> Yazdır
                    </button>
                    <button
                        onClick={() => exportToExcel(
                            filteredInvoices,
                            [
                                { header: 'Tarih', key: 'CreatedAt', formatter: (v) => v ? new Date(v.replace(' ', 'T')).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '' },
                                { header: 'Belge No', key: 'InvoiceNo', formatter: (v, row) => v || `#${row.ID}` },
                                { header: 'Tür', key: 'Type' },
                                { header: 'Cari', key: 'Counterparty' },
                                { header: 'Durum', key: 'IsOpen', formatter: (v) => v ? 'Açık' : 'Kapalı' },
                                { header: 'Ödeme Tipi', key: 'PaymentMethod', formatter: (v) => v === 'Card' ? 'Kredi Kartı' : v === 'Account' ? 'Cari Hesap' : 'Nakit' },
                                { header: 'Vade (Gün)', key: 'PaymentDays' },
                                { header: 'İsk. Öncesi Toplam (₺)', key: 'SubTotal', formatter: (v) => Number(v || 0).toFixed(2) },
                                { header: 'İskonto Tutarı (₺)', key: 'TotalDiscount', formatter: (v) => Number(v || 0).toFixed(2) },
                                { header: 'KDV Toplamı (₺)', key: 'TotalVat', formatter: (v) => Number(v || 0).toFixed(2) },
                                { header: 'Genel Toplam (₺)', key: 'TotalAmount', formatter: (v) => Number(v || 0).toFixed(2) },
                                { header: 'Vergi Dairesi', key: 'TaxOffice' },
                                { header: 'Vergi/TC No', key: 'TaxNumber' },
                                { header: 'Telefon', key: 'Phone' },
                                { header: 'Adres', key: 'Address' },
                                { header: 'Sevk Tarihi', key: 'ShipDate', formatter: (v) => v ? new Date(v.replace(' ', 'T')).toLocaleDateString('tr-TR') : '' },
                                { header: 'İrsaliye No', key: 'WaybillNo' },
                                { header: 'Taşıyıcı', key: 'Carrier' },
                                { header: 'Araç Plaka', key: 'PlateNo' },
                                { header: 'Dahili Not', key: 'InternalNote' },
                                { header: 'İçerik', key: 'ItemsSummary' },
                            ],
                            'Faturalar',
                            { title: 'Fatura & İrsaliye Listesi' }
                        )}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all cursor-pointer shrink-0"
                    >
                        <Download size={16} /> Excel'e Aktar
                    </button>

                    <div className="w-full md:w-px h-px md:h-8 bg-white/10 shrink-0" />

                    <div className="flex-1 flex flex-col md:flex-row items-center gap-3 w-full">
                        <input
                            type="text"
                            placeholder="Belge No veya Cari ara..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="glass-card-static rounded-xl text-sm w-full outline-none px-4 py-2.5 focus:border-cyan-accent/50 transition-colors"
                        />
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="glass-card-static rounded-xl text-sm w-full md:w-48 outline-none px-4 py-2.5 cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M7%2010L12%2015L17%2010%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_12px_center] pr-10"
                        >
                            <option value="Tümü">Tümü</option>
                            <option value="Alış Faturası">Alış Faturası</option>
                            <option value="Satış Faturası">Satış Faturası</option>
                            <option value="Alış İade">Alış İade</option>
                            <option value="Satış İade">Satış İade</option>
                            <option value="İrsaliye">İrsaliye</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Invoices Table */}
            <div className="glass-card rounded-2xl flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-auto bg-bg-dark/20 relative custom-scrollbar">
                    {loading ? (
                        <div className="text-center text-text-muted py-10">Yükleniyor…</div>
                    ) : filteredInvoices.length === 0 ? (
                        <div className="text-center text-text-muted py-10">Henüz kayıt yok</div>
                    ) : (
                        <table className="w-full text-sm text-left whitespace-nowrap min-w-max">
                            <thead className="sticky top-0 bg-[#161b26] text-text-muted shadow-sm shadow-[#0a0e1a]/50 z-10 select-none">
                                <tr>
                                    <th className="p-3 font-semibold text-xs tracking-wider border-b border-r border-white/5 pl-4 w-32">Tarih</th>
                                    <th className="p-3 font-semibold text-xs tracking-wider border-b border-r border-white/5 w-32">Belge No</th>
                                    <th className="p-3 font-semibold text-xs tracking-wider border-b border-r border-white/5 w-32">Tür</th>
                                    <th className="p-3 font-semibold text-xs tracking-wider border-b border-r border-white/5 w-48">Cari</th>
                                    <th className="p-3 font-semibold text-xs tracking-wider border-b border-r border-white/5">İçerik</th>
                                    <th className="p-3 font-semibold text-xs tracking-wider border-b border-r border-white/5 text-right w-32">Genel Toplam</th>
                                    <th className="p-3 font-semibold text-xs tracking-wider border-b border-white/5 w-12 text-center">İşlem</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredInvoices.map((inv) => (
                                    <tr key={inv.ID} onClick={() => navigate(`/invoices/${inv.ID}`)} className="border-b border-white/5 hover:bg-white/[0.04] transition-colors cursor-pointer group">
                                        <td className="p-3 pl-4 border-r border-white/5 text-text-muted whitespace-nowrap">
                                            {inv.CreatedAt ? new Date(inv.CreatedAt.replace(' ', 'T')).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                                        </td>
                                        <td className="p-3 border-r border-white/5 font-mono text-cyan-accent/90">
                                            {inv.InvoiceNo || `#${inv.ID}`}
                                        </td>
                                        <td className="p-3 border-r border-white/5">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold
                                                ${inv.Type === 'İrsaliye' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                                {inv.Type}
                                            </span>
                                        </td>
                                        <td className="p-3 border-r border-white/5 text-text-primary">
                                            <div className="flex items-center gap-1.5">
                                                <User size={14} className="text-text-muted" />
                                                <span className="truncate max-w-[150px]">{inv.Counterparty}</span>
                                            </div>
                                        </td>
                                        <td className="p-3 border-r border-white/5 text-text-muted text-xs">
                                            <span className="truncate inline-block max-w-[200px] xl:max-w-[400px]">{inv.ItemsSummary || '—'}</span>
                                        </td>
                                        <td className="p-3 border-r border-white/5 text-right font-bold text-red-400 whitespace-nowrap bg-red-500/[0.02]">
                                            {fmtMoney(inv.TotalAmount)}
                                        </td>
                                        <td className="p-2 text-center">
                                            <button onClick={(e) => { e.stopPropagation(); handleDelete(inv.ID); }} className="text-text-muted hover:text-red-400 p-1.5 cursor-pointer rounded-lg hover:bg-white/5 transition-colors opacity-50 group-hover:opacity-100">
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
        </div>
    );
}

// ── FORM VIEW (ERP Style) ──
function InvoiceForm({ onClose }) {
    const products = usePosStore((s) => s.products);
    const fetchProducts = usePosStore((s) => s.fetchProducts);
    const { accounts, fetchAccounts } = useAccountStore();

    // Tabs
    const [activeTab, setActiveTab] = useState('genel'); // genel, cari, sevk, not

    // Header Fields
    const [type, setType] = useState('Alış Faturası');
    const [invoiceNo, setInvoiceNo] = useState('');
    const [docNo, setDocNo] = useState('');
    const [counterparty, setCounterparty] = useState('');
    const [docDate, setDocDate] = useState(() => new Date().toISOString().slice(0, 16));
    const [shipDate, setShipDate] = useState(() => new Date().toISOString().slice(0, 16));
    const [paymentDays, setPaymentDays] = useState('0');
    const [isOpen, setIsOpen] = useState(true); // Açık/Kapalı fatura durumu
    const [syncLedger, setSyncLedger] = useState(true); // Cari hareketlere işlensin
    const [syncStock, setSyncStock] = useState(true); // Stok hareketlerine işlensin
    const [paymentMethod, setPaymentMethod] = useState('Cash'); // Cash/Card 

    // Cari Bilgiler Tab State
    const [taxOffice, setTaxOffice] = useState('');
    const [taxNumber, setTaxNumber] = useState('');
    const [address, setAddress] = useState('');
    const [phone, setPhone] = useState('');

    // Sevk Bilgileri Tab State
    const [waybillNo, setWaybillNo] = useState('');
    const [carrier, setCarrier] = useState('');
    const [plateNo, setPlateNo] = useState('');

    // Not Tab State
    const [internalNote, setInternalNote] = useState('');

    // Grid (Items)
    const [items, setItems] = useState([]);
    const [barcodeInput, setBarcodeInput] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => { fetchProducts(); fetchAccounts(); }, []);

    // Auto-fill Cari Bilgiler when counterparty changes
    useEffect(() => {
        const acc = accounts.find(a => a.Name === counterparty);
        if (acc) {
            setTaxOffice(acc.TaxOffice || '');
            setTaxNumber(acc.TaxNumber || '');
            setAddress(acc.Address || '');
            setPhone(acc.Phone || '');
        } else {
            setTaxOffice('');
            setTaxNumber('');
            setAddress('');
            setPhone('');
        }
    }, [counterparty, accounts]);

    // Helpers for Grid
    const updateRow = (idx, field, value) => {
        const updated = [...items];
        updated[idx] = { ...updated[idx], [field]: value };
        setItems(updated);
    };

    const removeRow = (idx) => {
        setItems(items.filter((_, i) => i !== idx));
    };

    const handleBarcodeSubmit = (e) => {
        e.preventDefault();
        const code = barcodeInput.trim();
        if (!code) return;

        const product = products.find(p => p.Barcodes?.includes(code) || p.Barcode === code);
        if (!product) {
            alert('Bu barkod ile ürün bulunamadı.');
            setBarcodeInput('');
            return;
        }

        // Add to grid
        setItems(prev => {
            const existingIdx = prev.findIndex(i => i.ProductID === product.ID);
            if (existingIdx >= 0) {
                const updated = [...prev];
                // Update object immutably to prevent duplicate increments in React StrictMode
                updated[existingIdx] = {
                    ...updated[existingIdx],
                    Qty: Number(updated[existingIdx].Qty) + 1
                };
                return updated;
            }
            return [...prev, {
                ProductID: product.ID,
                Name: product.Name,
                Qty: 1,
                Unit: 'Adet',
                OldPrice: product.CostPrice || 0,
                VatType: 'Hariç',
                VatRate: 20, // varsayılan
                UnitPrice: product.CostPrice || product.SalePrice || 0,
                Disc1: 0,
                Disc2: 0,
                Disc3: 0
            }];
        });
        setBarcodeInput('');
    };

    // Computations
    let totalSubtotal = 0; // İskontosuz Ara Toplam
    let totalDiscount = 0; // Toplam İskonto Tutarı
    let vatTotals = { 1: 0, 8: 0, 10: 0, 20: 0 }; // KDV Dağılım matrahları

    const processedItems = items.map(item => {
        const qty = Number(item.Qty) || 0;
        const price = Number(item.UnitPrice) || 0;
        const d1 = Number(item.Disc1) || 0;
        const d2 = Number(item.Disc2) || 0;
        const d3 = Number(item.Disc3) || 0;
        const vatRate = Number(item.VatRate) || 0;

        const rowGross = qty * price;
        const discMultiplier = (1 - d1 / 100) * (1 - d2 / 100) * (1 - d3 / 100);
        const rowNet = rowGross * discMultiplier;
        const rowDiscAmount = rowGross - rowNet;

        let rowVatAmount = 0;
        let finalUnitPrice = price; // db'ye gidecek net fiyat (vergili veya vergisiz)

        if (item.VatType === 'Hariç') {
            rowVatAmount = rowNet * (vatRate / 100);
            finalUnitPrice = price * discMultiplier; // Net birim fiyat
        } else {
            // KDV Dahil ise, rowNet = KDV dahil fiyattır.
            const vatFactor = 1 + (vatRate / 100);
            const netBeforeVat = rowNet / vatFactor;
            rowVatAmount = rowNet - netBeforeVat;
            finalUnitPrice = (price / vatFactor) * discMultiplier;
        }

        const rowTotal = item.VatType === 'Hariç' ? rowNet + rowVatAmount : rowNet;

        // Ağaç hesaplamalarına ekle
        totalSubtotal += rowGross;
        totalDiscount += rowDiscAmount;

        // KDV matrahlarını topla (Vergi matrahı = İskontolu net tutar)
        if (vatTotals[vatRate] !== undefined) {
            vatTotals[vatRate] += rowVatAmount;
        } else {
            vatTotals[vatRate] = rowVatAmount;
        }

        return { ...item, rowTotal, rowNet, rowGross, finalUnitPrice };
    });

    const netTotalBeforeVat = totalSubtotal - totalDiscount;
    const totalVat = Object.values(vatTotals).reduce((a, b) => a + b, 0);
    const grandTotal = netTotalBeforeVat + totalVat;

    const handleSubmit = async () => {
        if (!counterparty) return alert('Cari seçimi zorunludur.');
        if (items.length === 0) return alert('Lütfen faturaya en az bir ürün ekleyin.');

        setSubmitting(true);

        let combinedDesc = `${type} - Vade: ${paymentDays} gün`;

        try {
            await api.post('/invoices', {
                InvoiceNo: invoiceNo || docNo || null,
                Type: type.includes('İrsaliye') ? 'İrsaliye' : type,
                Counterparty: counterparty,
                Description: combinedDesc, // Keep a small descriptive string for backwards compatibility or general list view
                PaymentMethod: paymentMethod, // Nakit/Kart
                ShipDate: shipDate,
                PaymentDays: Number(paymentDays) || 0,
                IsOpen: isOpen,
                TaxOffice: taxOffice,
                TaxNumber: taxNumber,
                Address: address,
                Phone: phone,
                WaybillNo: waybillNo,
                Carrier: carrier,
                PlateNo: plateNo,
                InternalNote: internalNote,
                GrandTotal: grandTotal,
                SubTotal: totalSubtotal,
                TotalDiscount: totalDiscount,
                TotalVat: totalVat,
                items: processedItems.map(i => ({
                    ProductID: i.ProductID,
                    Qty: i.Qty,
                    UnitPrice: i.UnitPrice, // Send raw UnitPrice instead of final net price
                    VatRate: i.VatRate,
                    VatType: i.VatType,
                    Disc1: i.Disc1,
                    Disc2: i.Disc2,
                    Disc3: i.Disc3,
                    RowTotal: i.rowTotal
                }))
            });

            // Başarılı
            onClose();
        } catch (err) {
            alert(err.response?.data?.error || err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-2rem)] gap-4 w-full text-text-primary">
            {/* Ribbon / Top Bar */}
            <div className="glass-card flex flex-col md:flex-row items-center justify-between p-3 rounded-2xl shrink-0 gap-3">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <button onClick={onClose} className="p-2 text-text-muted hover:text-text-primary hover:bg-white/5 rounded-xl transition-colors cursor-pointer shrink-0">
                        <X size={20} />
                    </button>
                    <div className="flex gap-1 overflow-x-auto pb-1 md:pb-0 hide-scrollbar w-full md:w-auto">
                        {['Alış Faturası', 'Satış Faturası', 'Alış İade', 'Satış İade', 'İrsaliye'].map(t => (
                            <button
                                key={t}
                                onClick={() => setType(t)}
                                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap border ${type === t ? 'bg-cyan-accent text-bg-dark border-cyan-accent shadow-[0_0_15px_rgba(34,211,238,0.3)]' : 'border-white/5 hover:bg-white/5 text-text-muted'}`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <button className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl border border-white/5 hover:bg-white/10 text-text-primary transition-all cursor-pointer">
                        <Printer size={16} /> <span className="hidden sm:inline">Yazdır</span>
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="btn-primary flex items-center gap-2 px-6 py-2 text-sm font-bold rounded-xl shadow-lg border-0"
                    >
                        <Save size={16} /> {submitting ? 'Kaydediliyor...' : 'Faturayı Kaydet'}
                    </button>
                </div>
            </div>

            {/* Header Form & Tabs */}
            <div className="glass-card rounded-2xl flex flex-col shrink-0">
                {/* Tabs */}
                <div className="flex border-b border-white/5 px-2 pt-2 gap-1 overflow-x-auto hide-scrollbar">
                    {[
                        { id: 'genel', label: 'Genel Bilgiler', icon: <FileText size={14} /> },
                        { id: 'cari', label: 'Cari Bilgiler', icon: <User size={14} /> },
                        { id: 'sevk', label: 'Sevk Bilgileri', icon: <Package size={14} /> },
                        { id: 'not', label: 'Not', icon: <ClipboardList size={14} /> },
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

                {/* Tab Content (Genel Bilgiler) */}
                <div className="p-4 bg-white/[0.01]">
                    {activeTab === 'genel' && (
                        <div className="flex flex-wrap gap-x-8 gap-y-4 items-start">
                            {/* Left Col */}
                            <div className="flex w-full md:w-auto flex-col gap-3 min-w-[250px]">
                                <div className="flex items-center gap-2">
                                    <label className="text-xs text-text-muted font-medium w-24">Evrak No</label>
                                    <input type="text" value={docNo} onChange={e => setDocNo(e.target.value)} className="glass-card-static rounded-lg text-sm flex-1 outline-none px-3 py-1.5 focus:border-cyan-accent/50 transition-colors" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-xs text-text-muted font-medium w-24">Belge No</label>
                                    <input type="text" value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} className="glass-card-static rounded-lg text-sm flex-1 outline-none px-3 py-1.5 focus:border-cyan-accent/50 transition-colors" />
                                </div>
                            </div>

                            {/* Middle Col */}
                            <div className="flex w-full md:w-auto flex-col gap-3 min-w-[300px]">
                                <div className="flex items-center gap-2">
                                    <label className="text-xs text-text-muted font-medium w-24">Cari Seçimi</label>
                                    <select value={counterparty} onChange={e => setCounterparty(e.target.value)} className="glass-card-static rounded-lg text-sm flex-1 outline-none px-3 py-1.5 cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M7%2010L12%2015L17%2010%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_8px_center] pr-10">
                                        <option value="">Seçiniz...</option>
                                        {accounts.map(a => <option key={a.ID} value={a.Name}>{a.Name}</option>)}
                                    </select>
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-xs text-text-muted font-medium w-24">Fatura Tarihi</label>
                                    <input type="datetime-local" value={docDate} onChange={e => setDocDate(e.target.value)} className="glass-card-static rounded-lg text-sm flex-1 outline-none px-3 py-1.5 [color-scheme:dark]" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-xs text-text-muted font-medium w-24">Sevk Tarihi</label>
                                    <input type="datetime-local" value={shipDate} onChange={e => setShipDate(e.target.value)} className="glass-card-static rounded-lg text-sm flex-1 outline-none px-3 py-1.5 [color-scheme:dark]" />
                                </div>
                            </div>

                            {/* Right Col */}
                            <div className="flex w-full md:w-auto flex-col gap-3 min-w-[250px]">
                                <div className="flex items-center gap-2">
                                    <label className="text-xs text-text-muted font-medium w-24">Açık/Kapalı</label>
                                    <select value={isOpen ? 'Açık' : 'Kapalı'} onChange={e => setIsOpen(e.target.value === 'Açık')} className="glass-card-static rounded-lg text-sm w-28 outline-none px-3 py-1.5 cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M7%2010L12%2015L17%2010%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_8px_center]">
                                        <option value="Açık">Açık</option>
                                        <option value="Kapalı">Kapalı</option>
                                    </select>
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-xs text-text-muted font-medium w-24">Ödeme Vadesi</label>
                                    <div className="flex items-center gap-2 flex-1">
                                        <input type="number" min="0" value={paymentDays} onChange={e => setPaymentDays(e.target.value)} className="glass-card-static rounded-lg text-sm w-16 px-2 py-1.5 outline-none text-center" />
                                        <span className="text-xs font-medium text-text-muted">Gün</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 mt-1">
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${syncLedger ? 'bg-cyan-accent border-cyan-accent text-bg-dark' : 'border-white/20 group-hover:border-white/40'}`}>
                                            {syncLedger && <CheckCircle2 size={12} strokeWidth={3} />}
                                        </div>
                                        <span className="text-xs text-text-muted group-hover:text-text-primary transition-colors select-none font-medium">Cari Hareketlere İşlensin</span>
                                        <input type="checkbox" checked={syncLedger} onChange={e => setSyncLedger(e.target.checked)} className="hidden" />
                                    </label>
                                </div>
                                <div className="flex items-center gap-1 mt-0.5">
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${syncStock ? 'bg-cyan-accent border-cyan-accent text-bg-dark' : 'border-white/20 group-hover:border-white/40'}`}>
                                            {syncStock && <CheckCircle2 size={12} strokeWidth={3} />}
                                        </div>
                                        <span className="text-xs text-text-muted group-hover:text-text-primary transition-colors select-none font-medium">Stok Hareketlerine İşlensin</span>
                                        <input type="checkbox" checked={syncStock} onChange={e => setSyncStock(e.target.checked)} className="hidden" />
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tab Content (Cari Bilgiler) */}
                    {activeTab === 'cari' && (
                        <div className="flex flex-wrap gap-x-8 gap-y-4 items-start">
                            <div className="flex w-full md:w-1/2 lg:w-1/3 flex-col gap-3">
                                <div className="flex items-center gap-2">
                                    <label className="text-xs text-text-muted font-medium w-24 shrink-0">Vergi Dairesi</label>
                                    <input type="text" value={taxOffice} onChange={e => setTaxOffice(e.target.value)} placeholder="Örn: Beyoğlu VD" className="glass-card-static rounded-lg text-sm flex-1 outline-none px-3 py-1.5 focus:border-cyan-accent/50 transition-colors" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-xs text-text-muted font-medium w-24 shrink-0">Vergi/TC No</label>
                                    <input type="text" value={taxNumber} onChange={e => setTaxNumber(e.target.value)} placeholder="Örn: 1234567890" className="glass-card-static rounded-lg text-sm flex-1 outline-none px-3 py-1.5 focus:border-cyan-accent/50 transition-colors font-mono" />
                                </div>
                            </div>
                            <div className="flex w-full md:w-1/2 lg:w-1/3 flex-col gap-3">
                                <div className="flex items-center gap-2">
                                    <label className="text-xs text-text-muted font-medium w-24 shrink-0">Telefon</label>
                                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="0500 000 0000" className="glass-card-static rounded-lg text-sm flex-1 outline-none px-3 py-1.5 focus:border-cyan-accent/50 transition-colors" />
                                </div>
                                <div className="flex items-start gap-2">
                                    <label className="text-xs text-text-muted font-medium w-24 shrink-0 mt-2">Adres</label>
                                    <textarea value={address} onChange={e => setAddress(e.target.value)} rows={2} placeholder="Teslimat / Fatura Adresi" className="glass-card-static rounded-lg text-sm flex-1 outline-none px-3 py-2 focus:border-cyan-accent/50 transition-colors resize-none"></textarea>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tab Content (Sevk Bilgileri) */}
                    {activeTab === 'sevk' && (
                        <div className="flex flex-wrap gap-x-8 gap-y-4 items-start">
                            <div className="flex w-full md:w-1/3 flex-col gap-3">
                                <div className="flex items-center gap-2">
                                    <label className="text-xs text-text-muted font-medium w-24 shrink-0">İrsaliye No</label>
                                    <input type="text" value={waybillNo} onChange={e => setWaybillNo(e.target.value)} placeholder="Basılı irsaliye numarası" className="glass-card-static rounded-lg text-sm flex-1 outline-none px-3 py-1.5 focus:border-cyan-accent/50 transition-colors font-mono" />
                                </div>
                            </div>
                            <div className="flex w-full md:w-1/3 flex-col gap-3">
                                <div className="flex items-center gap-2">
                                    <label className="text-xs text-text-muted font-medium w-24 shrink-0">Taşıyıcı</label>
                                    <input type="text" value={carrier} onChange={e => setCarrier(e.target.value)} placeholder="Kargo firması, Kurye vb." className="glass-card-static rounded-lg text-sm flex-1 outline-none px-3 py-1.5 focus:border-cyan-accent/50 transition-colors" />
                                </div>
                            </div>
                            <div className="flex w-full md:w-1/3 flex-col gap-3">
                                <div className="flex items-center gap-2">
                                    <label className="text-xs text-text-muted font-medium w-24 shrink-0">Araç Plaka</label>
                                    <input type="text" value={plateNo} onChange={e => setPlateNo(e.target.value)} placeholder="34 ABC 123" className="glass-card-static rounded-lg text-sm flex-1 outline-none px-3 py-1.5 focus:border-cyan-accent/50 transition-colors uppercase" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tab Content (Not) */}
                    {activeTab === 'not' && (
                        <div className="flex flex-col gap-2 h-full">
                            <textarea
                                value={internalNote}
                                onChange={e => setInternalNote(e.target.value)}
                                rows={4}
                                placeholder="Fatura ile tutulacak dahili veya harici notlar. (Örn: Müşteri siparişi acele istedi, kapıya bırakılacak vb.)"
                                className="glass-card-static rounded-xl text-sm w-full lg:w-2/3 outline-none p-4 focus:border-cyan-accent/50 transition-colors resize-none"
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Data Grid Area */}
            <div className="glass-card rounded-2xl flex-1 flex flex-col overflow-hidden">
                {/* Minimal Barcode Input Strip above grid */}
                <form onSubmit={handleBarcodeSubmit} className="flex items-center gap-2 p-2 border-b border-white/5 bg-white/[0.02]">
                    <Barcode size={18} className="text-text-muted ml-2" />
                    <input
                        type="text"
                        value={barcodeInput}
                        onChange={e => setBarcodeInput(e.target.value)}
                        placeholder="Satır eklemek için bir ürün barkodu okutun veya yazın..."
                        className="flex-1 bg-transparent border-none outline-none text-sm text-text-primary px-2 py-1 placeholder:text-text-muted/50 font-medium"
                        autoFocus
                    />
                    <button type="submit" className="hidden">Ekle</button>
                </form>

                {/* The Grid Table */}
                <div className="flex-1 overflow-auto bg-bg-dark/20 relative custom-scrollbar">
                    <table className="w-full text-xs text-left whitespace-nowrap min-w-max">
                        <thead className="sticky top-0 bg-[#161b26] text-text-muted shadow-sm shadow-[#0a0e1a]/50 z-10 select-none">
                            <tr>
                                <th className="p-2.5 font-semibold text-[11px] uppercase tracking-wider border-r border-b border-white/5 w-10 text-center">#</th>
                                <th className="p-2.5 font-semibold text-[11px] uppercase tracking-wider border-r border-b border-white/5 min-w-[180px]">Stok Adı</th>
                                <th className="p-2.5 font-semibold text-[11px] uppercase tracking-wider border-r border-b border-white/5 w-24 text-right">Miktar</th>
                                <th className="p-2.5 font-semibold text-[11px] uppercase tracking-wider border-r border-b border-white/5 w-20 text-center text-text-muted/70">Birim</th>
                                <th className="p-2.5 font-semibold text-[11px] uppercase tracking-wider border-r border-b border-white/5 w-24 text-right">KDV</th>
                                <th className="p-2.5 font-semibold text-[11px] uppercase tracking-wider border-r border-b border-white/5 w-24 text-center">KDV Dah/Har</th>
                                <th className="p-2.5 font-semibold text-[11px] uppercase tracking-wider border-r border-b border-white/5 w-28 text-right">Birim Fiyat</th>
                                <th className="p-2.5 font-semibold text-[11px] uppercase tracking-wider border-r border-b border-white/5 w-16 text-center text-amber-500/70">İsk 1 (%)</th>
                                <th className="p-2.5 font-semibold text-[11px] uppercase tracking-wider border-r border-b border-white/5 w-16 text-center text-amber-500/70">İsk 2 (%)</th>
                                <th className="p-2.5 font-semibold text-[11px] uppercase tracking-wider border-r border-b border-white/5 w-16 text-center text-amber-500/70">İsk 3 (%)</th>
                                <th className="p-2.5 font-semibold text-[11px] uppercase tracking-wider border-b border-white/5 w-32 text-right text-cyan-accent">Toplam</th>
                                <th className="p-2.5 font-semibold text-[11px] uppercase tracking-wider border-b border-white/5 w-10 text-center"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {processedItems.map((item, idx) => (
                                <tr key={idx} className="hover:bg-white/[0.04] group border-b border-white/5 transition-colors focus-within:bg-white/[0.04]">
                                    <td className="p-2 border-r border-white/5 text-center text-text-muted/50 font-mono text-[11px]">{idx + 1}</td>
                                    <td className="p-2 border-r border-white/5 font-semibold text-text-primary">{item.Name}</td>
                                    <td className="p-0 border-r border-white/5 focus-within:bg-white/5 transition-colors">
                                        <input type="number" step="0.01" min="0" value={item.Qty || ''} onChange={e => updateRow(idx, 'Qty', e.target.value)} className="w-full h-full p-2 bg-transparent text-right outline-none text-text-primary font-mono text-[13px]" placeholder="0.00" />
                                    </td>
                                    <td className="p-2 border-r border-white/5 text-center text-text-muted/70">{item.Unit}</td>
                                    <td className="p-0 border-r border-white/5 focus-within:bg-white/5 transition-colors">
                                        <input type="number" step="1" value={item.VatRate === 0 ? '' : item.VatRate} onChange={e => updateRow(idx, 'VatRate', e.target.value)} className="w-full h-full p-2 bg-transparent text-right outline-none text-text-primary font-mono text-[13px]" placeholder="0" />
                                    </td>
                                    <td className="p-0 border-r border-white/5 focus-within:bg-white/5 transition-colors">
                                        <select value={item.VatType} onChange={e => updateRow(idx, 'VatType', e.target.value)} className="w-full h-full py-2 bg-transparent outline-none text-center text-text-primary appearance-none cursor-pointer">
                                            <option value="Hariç">Hariç</option>
                                            <option value="Dahil">Dahil</option>
                                        </select>
                                    </td>
                                    <td className="p-0 border-r border-white/5 focus-within:bg-white/5 transition-colors relative">
                                        <input type="number" step="0.01" value={item.UnitPrice === 0 ? '' : item.UnitPrice} onChange={e => updateRow(idx, 'UnitPrice', e.target.value)} className="w-full h-full p-2 bg-transparent text-right outline-none text-text-primary font-mono text-[13px]" placeholder="0.00" />
                                    </td>
                                    <td className="p-0 border-r border-white/5 focus-within:bg-white/5 transition-colors bg-amber-500/[0.02]">
                                        <input type="number" step="0.01" value={item.Disc1 === 0 ? '' : item.Disc1} onChange={e => updateRow(idx, 'Disc1', e.target.value)} className="w-full h-full p-2 bg-transparent text-center outline-none text-amber-400 font-mono text-[13px]" placeholder="0" />
                                    </td>
                                    <td className="p-0 border-r border-white/5 focus-within:bg-white/5 transition-colors bg-amber-500/[0.02]">
                                        <input type="number" step="0.01" value={item.Disc2 === 0 ? '' : item.Disc2} onChange={e => updateRow(idx, 'Disc2', e.target.value)} className="w-full h-full p-2 bg-transparent text-center outline-none text-amber-400 font-mono text-[13px]" placeholder="0" />
                                    </td>
                                    <td className="p-0 border-r border-white/5 focus-within:bg-white/5 transition-colors bg-amber-500/[0.02]">
                                        <input type="number" step="0.01" value={item.Disc3 === 0 ? '' : item.Disc3} onChange={e => updateRow(idx, 'Disc3', e.target.value)} className="w-full h-full p-2 bg-transparent text-center outline-none text-amber-400 font-mono text-[13px]" placeholder="0" />
                                    </td>
                                    <td className="p-2 text-right font-bold text-cyan-accent font-mono text-[13px] bg-cyan-accent/5">
                                        {fmtMoney(item.rowTotal)}
                                    </td>
                                    <td className="p-1 text-center">
                                        <button onClick={() => removeRow(idx)} className="text-text-muted hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-colors cursor-pointer rounded">
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {/* Empty Add Row trigger (visually subtle) */}
                            {items.length < 5 && Array.from({ length: 5 - items.length }).map((_, i) => (
                                <tr key={`empty-${i}`} className="border-b border-white/5">
                                    <td className="p-2 border-r border-white/5 text-center text-text-muted/20">{items.length + i + 1}</td>
                                    <td colSpan="11" className="p-2 border-white/5"></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Footer / Calculation Area */}
            <div className="glass-card rounded-2xl p-4 shrink-0 grid grid-cols-1 lg:grid-cols-4 gap-6 items-start bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-cyan-900/10 via-bg-dark to-bg-dark border border-white/10">

                {/* Column 1: Payment Method Selection */}
                <div className="flex flex-col gap-2 lg:border-r border-white/10 lg:pr-6">
                    <span className="text-xs font-bold text-text-muted uppercase tracking-widest mb-1 flex items-center gap-1"><Banknote size={14} /> Ödeme Tipi</span>
                    <button onClick={() => setPaymentMethod('Cash')} className={`flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer ${paymentMethod === 'Cash' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'border-white/5 hover:bg-white/5 text-text-muted'}`}>
                        <div className="flex items-center gap-2 text-sm font-semibold">Nakit</div>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${paymentMethod === 'Cash' ? 'border-emerald-400 bg-emerald-400' : 'border-white/20'}`}>
                            {paymentMethod === 'Cash' && <div className="w-1.5 h-1.5 bg-bg-dark rounded-full" />}
                        </div>
                    </button>
                    <button onClick={() => setPaymentMethod('Card')} className={`flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer ${paymentMethod === 'Card' ? 'bg-blue-500/10 border-blue-500/50 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 'border-white/5 hover:bg-white/5 text-text-muted'}`}>
                        <div className="flex items-center gap-2 text-sm font-semibold">Kredi Kartı</div>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${paymentMethod === 'Card' ? 'border-blue-400 bg-blue-400' : 'border-white/20'}`}>
                            {paymentMethod === 'Card' && <div className="w-1.5 h-1.5 bg-bg-dark rounded-full" />}
                        </div>
                    </button>
                    <button onClick={() => setPaymentMethod('Account')} className={`flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer ${paymentMethod === 'Account' ? 'bg-violet-500/10 border-violet-500/50 text-violet-400 shadow-[0_0_15px_rgba(139,92,246,0.1)]' : 'border-white/5 hover:bg-white/5 text-text-muted'}`}>
                        <div className="flex items-center gap-2 text-sm font-semibold">Cari Hesaba Yaz</div>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${paymentMethod === 'Account' ? 'border-violet-400 bg-violet-400' : 'border-white/20'}`}>
                            {paymentMethod === 'Account' && <div className="w-1.5 h-1.5 bg-bg-dark rounded-full" />}
                        </div>
                    </button>
                </div>

                {/* Column 2: Empty Space / Potential Future Info */}
                <div className="hidden lg:flex flex-col gap-2 lg:border-r border-white/10 pr-6 justify-center text-text-muted/50 text-xs text-center h-full">
                    {/* Placeholder for future extensions like Stopaj vs */}
                    Satır Toplamları, KDV ve Genel Toplam otomatik hesaplanmaktadır.
                </div>

                {/* Column 3: VAT Dist */}
                <div className="flex flex-col gap-2 lg:border-r border-white/10 lg:pr-6 h-full">
                    <span className="text-xs font-bold text-text-muted uppercase tracking-widest mb-1">KDV Dağılımı</span>
                    <div className="flex flex-col gap-1.5 text-sm p-3 glass-card-static rounded-xl h-full justify-center">
                        {Object.entries(vatTotals).filter(([, val]) => val > 0).map(([rate, val]) => (
                            <div key={rate} className="flex items-center justify-between text-text-primary">
                                <span className="text-text-muted font-medium">KDV (%{rate})</span>
                                <span className="font-mono font-semibold">{fmtMoney(val)}</span>
                            </div>
                        ))}
                        {Object.values(vatTotals).every(v => v === 0) && (
                            <div className="text-text-muted italic text-[11px] text-center">Faturada ekli vergi tutarı bulunmuyor.</div>
                        )}
                    </div>
                </div>

                {/* Column 4: Grand Totals */}
                <div className="flex flex-col gap-2 relative">
                    <div className="flex items-center justify-between text-sm px-2">
                        <span className="text-text-muted font-medium">İsk. Öncesi Toplam</span>
                        <span className="font-mono text-text-primary font-semibold">{fmtMoney(totalSubtotal)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm px-2">
                        <span className="text-text-muted font-medium">İskonto Tutarı</span>
                        <span className="font-mono text-amber-400 font-semibold">-{fmtMoney(totalDiscount)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm px-2">
                        <span className="text-text-muted font-medium">Ara Toplam</span>
                        <span className="font-mono text-text-primary font-semibold">{fmtMoney(netTotalBeforeVat)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm px-2 pb-3 border-b border-white/10">
                        <span className="text-text-muted font-medium">KDV Toplamı</span>
                        <span className="font-mono text-text-primary font-semibold">{fmtMoney(totalVat)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1 px-2">
                        <span className="text-sm font-black text-text-primary uppercase tracking-widest">Genel Toplam</span>
                        <span className="text-2xl font-bold text-cyan-accent font-mono tracking-tight">{fmtMoney(grandTotal)}</span>
                    </div>
                    <div className="absolute inset-x-0 -bottom-8 h-8 bg-cyan-accent/20 blur-xl rounded-full z-0 opacity-50" />
                </div>

            </div>
        </div>
    );
}
