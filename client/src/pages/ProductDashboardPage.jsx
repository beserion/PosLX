import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    AreaChart,
    Area
} from 'recharts';
import { ArrowLeft, Package, Tag, Layers, TrendingUp, TrendingDown, Clock, Activity, ShoppingBag, Banknote, Calendar } from 'lucide-react';

function fmtMoney(v) {
    return `₺${Number(v || 0).toLocaleString('tr-TR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function fmtDate(d) {
    if (!d) return 'İşlem yok';
    return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function ProductDashboardPage() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [product, setProduct] = useState(null);
    const [chartData, setChartData] = useState([]);
    const [metrics, setMetrics] = useState(null);
    const [timeRange, setTimeRange] = useState(6); // 1, 3 veya 6 aylık veri kontrolü
    const [chartType, setChartType] = useState('bar'); // 'bar' | 'area'

    useEffect(() => {
        const fetchDashboard = async () => {
            setLoading(true);
            try {
                const { data } = await api.get(`/products/${id}/dashboard`);
                setProduct(data.product);
                setChartData(data.chartData);
                setMetrics(data.metrics);
            } catch (err) {
                console.error('Failed to fetch product dashboard:', err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchDashboard();
    }, [id]);

    if (loading) {
        return <div className="p-10 text-center text-text-muted">Ürün bilgileri yükleniyor...</div>;
    }

    if (!product) {
        return (
            <div className="p-10 text-center flex flex-col items-center gap-4">
                <div className="text-text-muted">Ürün bulunamadı veya silinmiş.</div>
                <button className="btn-ghost px-4 py-2 rounded-xl" onClick={() => navigate(-1)}>
                    Geri Dön
                </button>
            </div>
        );
    }

    // Slice chart data based on time range (default 6 months means full array since backend returns 6)
    const displayChartData = chartData.slice(-timeRange);

    return (
        <div className="flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-300">
            {/* Header Actions */}
            <div className="flex items-center gap-3">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 rounded-xl glass-card-static text-text-muted hover:text-white transition-colors"
                    title="Geri Dön"
                >
                    <ArrowLeft size={18} />
                </button>
                <h1 className="text-2xl font-bold text-text-primary mr-auto">
                    Ürün Detayı
                </h1>
                <div className="badge badge-emerald flex items-center gap-1.5 px-3">
                    <Package size={14} /> ID: {product.ID}
                </div>
            </div>

            {/* Main Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Name & Category */}
                <div className="glass-card p-5 rounded-2xl flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-text-muted text-sm font-medium uppercase tracking-wider">
                        <Tag size={16} className="text-cyan-accent" />
                        Ürün Adı
                    </div>
                    <div className="text-xl font-bold text-white break-words">{product.Name}</div>
                    <div className="text-sm font-medium text-text-muted">
                        Kategori: <span className="text-white">{product.Category || 'Belirtilmemiş'}</span>
                    </div>
                </div>

                {/* Stock */}
                <div className="glass-card p-5 rounded-2xl flex flex-col gap-2 relative overflow-hidden group">
                    <div className="flex items-center gap-2 text-text-muted text-sm font-medium uppercase tracking-wider z-10">
                        <Layers size={16} className="text-emerald-400" />
                        Mevcut Stok
                    </div>
                    <div className="text-3xl font-bold text-white z-10">{product.Stock} <span className="text-base text-text-muted font-medium">adet</span></div>
                    {product.Stock <= (product.CriticalStock || 0) && (
                        <div className="mt-1 badge bg-red-500/10 text-red-500 border-red-500/20 z-10 self-start">Kritik Stok Seviyesi</div>
                    )}
                    <div className="absolute right-0 bottom-0 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-500 blur-[2px]">
                        <Layers size={100} />
                    </div>
                </div>

                {/* Pricing Info */}
                <div className="glass-card p-5 rounded-2xl flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-text-muted text-sm font-medium uppercase tracking-wider">
                        <TrendingUp size={16} className="text-blue-400" />
                        Fiyatlandırma
                    </div>
                    <div className="flex flex-col gap-1 mt-1">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-text-muted">Satış Fiyatı:</span>
                            <span className="text-white font-bold">{fmtMoney(product.SalePrice)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-text-muted">Alış Maliyeti:</span>
                            <span className="text-white">{fmtMoney(product.CostPrice)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm mt-1 pt-1 border-t border-white/5">
                            <span className="text-text-muted">Kâr Marjı:</span>
                            <span className="text-emerald-400 font-semibold">
                                {product.SalePrice > 0 ? `%${(((product.SalePrice - product.CostPrice) / product.SalePrice) * 100).toFixed(1)}` : '-'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Barcodes */}
                <div className="glass-card p-5 rounded-2xl flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-text-muted text-sm font-medium uppercase tracking-wider">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400"><path d="M3 5v14" /><path d="M8 5v14" /><path d="M12 5v14" /><path d="M17 5v14" /><path d="M21 5v14" /></svg>
                        Barkodlar
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                        {product.Barcodes && product.Barcodes.length > 0 ? (
                            product.Barcodes.map((b, i) => (
                                <span key={i} className="bg-white/5 border border-white/10 px-2 py-1 flex items-center justify-center rounded-lg text-xs font-mono text-white/90">
                                    {b}
                                </span>
                            ))
                        ) : (
                            <div className="text-sm text-text-muted italic">Kayıtlı barkod yok</div>
                        )}
                    </div>
                </div>
            </div>

            {/* All-time Performance Metrics */}
            {metrics && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="glass-card p-5 rounded-2xl flex items-start gap-4">
                        <div className="p-3 bg-cyan-500/10 text-cyan-accent rounded-xl">
                            <ShoppingBag size={24} />
                        </div>
                        <div className="flex flex-col gap-1 w-full">
                            <span className="text-sm font-medium text-text-muted uppercase tracking-wider">Tüm Zamanlar Satış</span>
                            <div className="flex justify-between items-end mt-1">
                                <div>
                                    <div className="text-2xl font-bold text-white">{fmtMoney(metrics.totalSalesRevenue)}</div>
                                    <div className="text-sm text-text-muted">{metrics.totalSalesQty} adet satıldı</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="glass-card p-5 rounded-2xl flex items-start gap-4">
                        <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
                            <Banknote size={24} />
                        </div>
                        <div className="flex flex-col gap-1 w-full">
                            <span className="text-sm font-medium text-text-muted uppercase tracking-wider">Tüm Zamanlar Alış</span>
                            <div className="flex justify-between items-end mt-1">
                                <div>
                                    <div className="text-2xl font-bold text-white">{fmtMoney(metrics.totalPurchaseCost)}</div>
                                    <div className="text-sm text-text-muted">{metrics.totalPurchaseQty} adet alındı</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="glass-card p-5 rounded-2xl flex items-start gap-4">
                        <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl">
                            <Calendar size={24} />
                        </div>
                        <div className="flex flex-col gap-2 w-full">
                            <span className="text-sm font-medium text-text-muted uppercase tracking-wider">Son İşlem Tarihleri</span>
                            <div className="flex flex-col gap-1 mt-1 text-sm">
                                <div className="flex justify-between items-center border-b border-white/5 pb-1">
                                    <span className="text-text-muted">Son Satış:</span>
                                    <span className="text-white font-medium">{fmtDate(metrics.lastSaleDate)}</span>
                                </div>
                                <div className="flex justify-between items-center pt-1">
                                    <span className="text-text-muted">Son Alış:</span>
                                    <span className="text-white font-medium">{fmtDate(metrics.lastPurchaseDate)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Charts Section */}
            <div className="glass-card p-5 rounded-2xl flex flex-col gap-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-4">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <TrendingDown size={20} className="text-cyan-accent" />
                        Alış ve Satış Hareketleri Grafiği
                    </h2>

                    <div className="flex items-center gap-2">
                        {/* Time Range Filter */}
                        <div className="flex p-1 rounded-xl bg-white/[0.02] border border-white/5">
                            {[
                                { label: 'Son 1 Ay', value: 1 },
                                { label: 'Son 3 Ay', value: 3 },
                                { label: 'Son 6 Ay', value: 6 },
                            ].map((t) => (
                                <button
                                    key={t.value}
                                    onClick={() => setTimeRange(t.value)}
                                    className={`text-xs px-3 py-1.5 rounded-lg transition-all font-medium ${timeRange === t.value
                                        ? 'bg-cyan-accent/20 text-cyan-accent shadow-sm'
                                        : 'text-text-muted hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>

                        {/* Chart Type Toggle */}
                        <button
                            onClick={() => setChartType(prev => prev === 'bar' ? 'area' : 'bar')}
                            className="p-1.5 rounded-xl bg-white/[0.02] border border-white/5 text-text-muted hover:text-white hover:bg-white/5 transition-all"
                            title="Grafik Tipini Değiştir"
                        >
                            <Clock size={16} />
                        </button>
                    </div>
                </div>

                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        {chartType === 'bar' ? (
                            <BarChart data={displayChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                <XAxis
                                    dataKey="monthName"
                                    stroke="#ffffff50"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    dy={10}
                                />
                                <YAxis
                                    stroke="#ffffff50"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip
                                    cursor={{ fill: '#ffffff05' }}
                                    contentStyle={{
                                        backgroundColor: '#1E1E1E',
                                        borderColor: '#ffffff10',
                                        borderRadius: '12px',
                                        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                                        color: '#fff'
                                    }}
                                    itemStyle={{ color: '#E2E8F0', padding: '2px 0' }}
                                />
                                <Legend
                                    iconType="circle"
                                    wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }}
                                />
                                <Bar name="Satış Miktarı" dataKey="salesQty" fill="#38BDF8" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                <Bar name="Alım Miktarı" dataKey="purchaseQty" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                            </BarChart>
                        ) : (
                            <AreaChart data={displayChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#38BDF8" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorPurchases" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                <XAxis
                                    dataKey="monthName"
                                    stroke="#ffffff50"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    dy={10}
                                />
                                <YAxis
                                    stroke="#ffffff50"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#1E1E1E',
                                        borderColor: '#ffffff10',
                                        borderRadius: '12px',
                                        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                                        color: '#fff'
                                    }}
                                />
                                <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }} />
                                <Area type="monotone" name="Satış Miktarı" dataKey="salesQty" stroke="#38BDF8" fillOpacity={1} fill="url(#colorSales)" />
                                <Area type="monotone" name="Alım Miktarı" dataKey="purchaseQty" stroke="#10B981" fillOpacity={1} fill="url(#colorPurchases)" />
                            </AreaChart>
                        )}
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}
