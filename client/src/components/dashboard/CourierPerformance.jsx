import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import { Truck } from 'lucide-react';

const performanceData = [
    { name: 'Ahmet', orders: 8, km: 14.3 },
    { name: 'Mehmet', orders: 4, km: 7.1 },
    { name: 'Ayşe', orders: 12, km: 22.6 },
    { name: 'Fatma', orders: 0, km: 0 },
    { name: 'Ali', orders: 10, km: 18.9 },
];

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload) return null;
    return (
        <div className="glass-card-static px-3 py-2 text-xs" style={{ backdropFilter: 'blur(20px)' }}>
            <p className="font-bold text-text-primary mb-1">{label}</p>
            {payload.map((p, i) => (
                <p key={i} style={{ color: p.color }}>
                    {p.name}: {p.value}{p.name === 'km' ? ' km' : ''}
                </p>
            ))}
        </div>
    );
};

export default function CourierPerformance() {
    return (
        <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, rgba(6,182,212,0.2), rgba(6,182,212,0.05))' }}>
                    <Truck size={18} className="text-cyan-accent" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-text-primary">Courier Performance</h3>
                    <p className="text-xs text-text-muted">Orders delivered vs. KM traveled</p>
                </div>
            </div>

            <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={performanceData} barGap={4}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                        <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                        <Bar dataKey="orders" name="Orders" fill="#06b6d4" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="km" name="km" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
