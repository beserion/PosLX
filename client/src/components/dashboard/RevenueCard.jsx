import { TrendingUp, DollarSign } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, XAxis } from 'recharts';
import { useDashboardStore } from '../../store/dashboardStore';

export default function RevenueCard() {
    const getData = useDashboardStore((s) => s.getData);
    const data = getData();

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Total Revenue */}
            <div className="glass-card p-5 box-glow-cyan">
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, rgba(6,182,212,0.2), rgba(6,182,212,0.05))' }}>
                        <DollarSign size={18} className="text-cyan-accent" />
                    </div>
                    <div>
                        <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Total Revenue</span>
                        <p className="text-xs text-text-muted">{data.salesCount} satış</p>
                    </div>
                </div>
                <p className="text-2xl font-bold text-text-primary glow-cyan">₺{data.revenue.toLocaleString()}</p>
                <div className="flex items-center gap-1 mt-1">
                    <TrendingUp size={12} className="text-emerald-accent" />
                    <span className="text-xs text-emerald-accent font-medium">+{data.change}% bu dönem</span>
                </div>
                <div className="h-12 mt-3">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data.sparkData}>
                            <defs>
                                <linearGradient id="cyanGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.3} />
                                    <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="date" hide />
                            <Area type="monotone" dataKey="v" stroke="#06b6d4" fill="url(#cyanGrad)" strokeWidth={2} dot={false} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Net Profit */}
            <div className="glass-card p-5 box-glow-emerald">
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.05))' }}>
                        <TrendingUp size={18} className="text-emerald-accent" />
                    </div>
                    <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Net Profit</span>
                </div>
                <p className="text-2xl font-bold text-text-primary glow-emerald">₺{data.profit.toLocaleString()}</p>
                <div className="flex items-center gap-1 mt-1">
                    <TrendingUp size={12} className="text-emerald-accent" />
                    <span className="text-xs text-emerald-accent font-medium">+{(data.change * 0.7).toFixed(1)}% bu dönem</span>
                </div>
                <div className="h-12 mt-3">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data.sparkData.map((d) => ({ ...d, v: d.v * 0.38 }))}>
                            <defs>
                                <linearGradient id="emeraldGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="date" hide />
                            <Area type="monotone" dataKey="v" stroke="#10b981" fill="url(#emeraldGrad)" strokeWidth={2} dot={false} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}
