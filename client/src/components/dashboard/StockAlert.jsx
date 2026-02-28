import { AlertTriangle, Package } from 'lucide-react';

const lowStockItems = [
    { ID: 12, Name: 'Tiramisu', Stock: 5, Category: 'Desserts' },
    { ID: 7, Name: 'Chocolate Cake', Stock: 8, Category: 'Desserts' },
    { ID: 9, Name: 'Sandwich', Stock: 12, Category: 'Food' },
    { ID: 6, Name: 'Fresh Orange Juice', Stock: 15, Category: 'Cold Drinks' },
];

export default function StockAlert() {
    return (
        <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.05))' }}>
                    <AlertTriangle size={18} className="text-amber-accent" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-text-primary">Low Stock Alert</h3>
                    <p className="text-xs text-text-muted">{lowStockItems.length} items need attention</p>
                </div>
            </div>

            <div className="space-y-2">
                {lowStockItems.map((item) => (
                    <div key={item.ID}
                        className="flex items-center gap-3 p-3 rounded-xl transition-colors"
                        style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ background: 'rgba(255,255,255,0.04)' }}>
                            <Package size={14} className="text-text-muted" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-text-primary truncate">{item.Name}</p>
                            <p className="text-xs text-text-muted">{item.Category}</p>
                        </div>
                        <span className={`badge ${item.Stock <= 10 ? 'badge-danger' : 'badge-amber'}`}>
                            {item.Stock} left
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
