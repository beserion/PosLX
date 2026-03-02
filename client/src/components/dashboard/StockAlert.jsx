import { AlertTriangle, Package } from 'lucide-react';
import { usePosStore } from '../../store/posStore';
import { useEffect, useState } from 'react';
import api from '../../lib/api';

export default function StockAlert() {
    const [lowStockItems, setLowStockItems] = useState([]);
    const [loading, setLoading] = useState(true);

    // Fetch low stock directly here or from store, opting for direct since it's dashboard specific
    useEffect(() => {
        const fetchLowStock = async () => {
            try {
                const { data } = await api.get('/products/low-stock');
                setLowStockItems(data);
            } catch (err) {
                console.error("Failed to fetch low stock items:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchLowStock();
    }, []);

    return (
        <div className="glass-card p-5 h-full flex flex-col">
            <div className="flex items-center gap-2 mb-4 shrink-0">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.05))' }}>
                    <AlertTriangle size={18} className="text-amber-accent" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-text-primary">Low Stock Alert</h3>
                    <p className="text-xs text-text-muted">{lowStockItems.length} items need attention</p>
                </div>
            </div>

            <div className="space-y-2 flex-1 overflow-y-auto pr-1">
                {loading ? (
                    <div className="text-center py-4 text-xs text-text-muted">Yükleniyor...</div>
                ) : lowStockItems.length === 0 ? (
                    <div className="text-center py-4 text-xs text-text-muted">Eksilen ürün yok. Tüm stoklar güvende!</div>
                ) : (
                    lowStockItems.map((item) => (
                        <div key={item.ID}
                            className="flex items-center gap-3 p-3 rounded-xl transition-colors"
                            style={{ background: 'rgba(255,255,255,0.02)' }}>
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                style={{ background: 'rgba(255,255,255,0.04)' }}>
                                <Package size={14} className="text-text-muted" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-text-primary truncate">{item.Name}</p>
                                <p className="text-xs text-text-muted">{item.CategoryName || 'Kategori Yok'}</p>
                            </div>
                            <span className={`badge shrink-0 ${item.Stock <= 10 ? 'badge-danger' : 'badge-amber'}`}>
                                {item.Stock} left
                            </span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
