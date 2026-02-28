import { useCourierStore } from '../../store/courierStore';
import { Truck, MapPin, Phone } from 'lucide-react';

const statusStyle = {
    Delivering: 'badge-cyan',
    Idle: 'badge-amber',
    Offline: 'badge-danger',
};

export default function CourierCard({ courier }) {
    return (
        <div className="glass-card p-4 flex items-center gap-4">
            {/* Avatar */}
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                style={{
                    background: courier.Status === 'Delivering'
                        ? 'linear-gradient(135deg, rgba(6,182,212,0.2), rgba(6,182,212,0.05))'
                        : courier.Status === 'Idle'
                            ? 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.05))'
                            : 'linear-gradient(135deg, rgba(100,116,139,0.2), rgba(100,116,139,0.05))'
                }}>
                <Truck size={20} className={courier.Status === 'Delivering' ? 'text-cyan-accent' : courier.Status === 'Idle' ? 'text-amber-accent' : 'text-text-muted'} />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-primary truncate">{courier.Name}</p>
                <div className="flex items-center gap-3 mt-0.5">
                    <span className="flex items-center gap-1 text-xs text-text-muted">
                        <Phone size={11} /> {courier.Phone}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-text-muted">
                        <MapPin size={11} /> {courier.DailyDistanceKM.toFixed(1)} km
                    </span>
                </div>
            </div>

            {/* Status */}
            <span className={`badge ${statusStyle[courier.Status] || 'badge-cyan'}`}>
                {courier.Status}
            </span>
        </div>
    );
}
