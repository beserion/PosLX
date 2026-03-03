import CourierCard from '../components/courier/CourierCard';
import CourierManagerModal from '../components/courier/CourierManagerModal';
import { useCourierStore } from '../store/courierStore';
import { useTunnelStore } from '../store/tunnelStore';
import { useToast } from '../hooks/useToast';
import { useRealtimeUpdates } from '../hooks/useRealtimeUpdates';
import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function CourierPage() {
    const couriers = useCourierStore((s) => s.couriers);
    const fetchCouriers = useCourierStore((s) => s.fetchCouriers);
    const fetchQrData = useTunnelStore((s) => s.fetchQrData);
    const addCourier = useCourierStore((s) => s.addCourier);
    const delivering = couriers.filter((c) => c.Status === 'Delivering').length;
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

            <div className="flex flex-wrap gap-4 flex-1 overflow-y-auto">
                {couriers.map((c) => (
                    <div key={c.ID} className="w-full sm:w-[320px]">
                        <CourierCard courier={c} />
                    </div>
                ))}
            </div>

            <CourierManagerModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSave={handleAddCourier}
            />
        </div>
    );
}
