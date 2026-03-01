import RevenueCard from '../components/dashboard/RevenueCard';
import StockAlert from '../components/dashboard/StockAlert';
import CourierPerformance from '../components/dashboard/CourierPerformance';
import DateRangeFilter from '../components/dashboard/DateRangeFilter';
import TunnelStatusPanel from '../components/dashboard/TunnelStatusPanel';
import { useRealtimeUpdates } from '../hooks/useRealtimeUpdates';
import { useDashboardStore } from '../store/dashboardStore';
import { Clock, Wifi, WifiOff } from 'lucide-react';
import { useEffect } from 'react';

export default function DashboardPage() {
    useRealtimeUpdates();
    const isConnected = useDashboardStore((s) => s.isConnected);
    const fetchSummary = useDashboardStore((s) => s.fetchSummary);

    useEffect(() => { fetchSummary(); }, []);

    const now = new Date();
    const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    return (
        <div className="flex flex-col gap-5">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <h1 className="text-xl font-bold text-text-primary">Dashboard</h1>
                    <span className={`badge ${isConnected ? 'badge-emerald' : 'badge-danger'}`}>
                        {isConnected ? <><Wifi size={10} /> Live</> : <><WifiOff size={10} /> Offline</>}
                    </span>
                </div>
                <div className="flex items-center gap-2 text-text-muted text-sm">
                    <Clock size={14} />
                    <span className="hidden sm:inline">{dateStr} · </span>
                    <span>{timeStr}</span>
                </div>
            </div>

            {/* Date Filter */}
            <DateRangeFilter />

            {/* KPI Row */}
            <RevenueCard />

            {/* Lower Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <StockAlert />
                <CourierPerformance />
            </div>

            {/* Tunnel Connectivity */}
            <TunnelStatusPanel />
        </div>
    );
}

