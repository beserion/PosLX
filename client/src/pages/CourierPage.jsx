import CourierMap from '../components/courier/CourierMap';
import CourierCard from '../components/courier/CourierCard';
import CourierManagerModal from '../components/courier/CourierManagerModal';
import { useCourierStore } from '../store/courierStore';
import { useTunnelStore } from '../store/tunnelStore';
import { useToast } from '../hooks/useToast';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useRealtimeUpdates } from '../hooks/useRealtimeUpdates';
import { Truck, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function CourierPage() {
    const couriers = useCourierStore((s) => s.couriers);
    const fetchCouriers = useCourierStore((s) => s.fetchCouriers);
    const fetchQrData = useTunnelStore((s) => s.fetchQrData);
    const addCourier = useCourierStore((s) => s.addCourier);
    const delivering = couriers.filter((c) => c.Status === 'Delivering').length;
    const isMobile = useMediaQuery('(max-width: 767px)');
    const toast = useToast();
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    // Subscribe to real-time location/status changes via Socket.io
    useRealtimeUpdates();

    useEffect(() => {
        fetchCouriers();
    }, [fetchCouriers, fetchQrData]);

    const handleAddCourier = async (data) => {
        try {
            await addCourier(data);
            toast.success(`${data.Name} adlı kurye eklendi.`);
            setIsAddModalOpen(false);
        } catch (err) {
            toast.error(err.message || 'Kurye eklenemedi.');
        }
    };

    return (
        <div className="flex flex-col gap-4 h-[calc(100vh-2rem)]">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <h1 className="text-xl font-bold text-text-primary">Courier Tracking</h1>
                    <span className="badge badge-amber">{delivering} Active</span>
                </div>

                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="flex text-sm items-center gap-2 px-4 py-2 bg-emerald-accent/15 text-emerald-accent border border-emerald-accent/30 rounded-xl hover:bg-emerald-accent/20 transition-colors font-medium"
                >
                    <Plus size={16} /> Yeni Kurye
                </button>
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

            <CourierManagerModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSave={handleAddCourier}
            />
        </div>
    );
}
