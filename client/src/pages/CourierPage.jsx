import CourierMap from '../components/courier/CourierMap';
import CourierCard from '../components/courier/CourierCard';
import { useCourierStore } from '../store/courierStore';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { Truck } from 'lucide-react';
import { useEffect } from 'react';

export default function CourierPage() {
    const couriers = useCourierStore((s) => s.couriers);
    const fetchCouriers = useCourierStore((s) => s.fetchCouriers);
    const delivering = couriers.filter((c) => c.Status === 'Delivering').length;
    const isMobile = useMediaQuery('(max-width: 767px)');

    useEffect(() => { fetchCouriers(); }, []);

    return (
        <div className="flex flex-col gap-4 h-[calc(100vh-2rem)]">
            {/* Header */}
            <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-text-primary">Courier Tracking</h1>
                <span className="badge badge-amber">{delivering} Active</span>
            </div>

            {isMobile ? (
                /* Mobile — Full map + horizontal scroll courier cards */
                <div className="flex flex-col flex-1 gap-3 min-h-0">
                    <div className="flex-1 min-h-0">
                        <CourierMap />
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                        {couriers.map((c) => (
                            <div key={c.ID} className="min-w-[260px] shrink-0">
                                <CourierCard courier={c} />
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                /* Desktop — Map + sidebar cards */
                <div className="flex gap-4 flex-1 min-h-0">
                    <div className="flex-1 min-w-0">
                        <CourierMap />
                    </div>
                    <div className="w-[320px] shrink-0 flex flex-col gap-3 overflow-y-auto">
                        <p className="text-xs text-text-muted uppercase tracking-wider font-medium flex items-center gap-1.5">
                            <Truck size={12} /> All Couriers ({couriers.length})
                        </p>
                        {couriers.map((c) => (
                            <CourierCard key={c.ID} courier={c} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
