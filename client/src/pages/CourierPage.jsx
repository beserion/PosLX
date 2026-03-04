import CourierCard from '../components/courier/CourierCard';
import CourierManagerModal from '../components/courier/CourierManagerModal';
import { useCourierStore } from '../store/courierStore';
import { useTunnelStore } from '../store/tunnelStore';
import { useToast } from '../hooks/useToast';
import { useRealtimeUpdates } from '../hooks/useRealtimeUpdates';
import { Plus, MapPin } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Leaflet default icon fix
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom Icon for couriers based on status
const createCourierIcon = (status) => {
    let color = '#64748b'; // Idle
    if (status === 'Delivering') color = '#06b6d4';
    if (status === 'Offline') color = '#ef4444';

    return L.divIcon({
        className: 'custom-courier-icon',
        html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
                 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 18H3c-.6 0-1-.4-1-1V7c0-.6.4-1 1-1h10c.6 0 1 .4 1 1v11"/><path d="M14 9h4l4 4v5c0 .6-.4 1-1 1h-2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>
               </div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
    });
};

function MapUpdater({ center }) {
    const map = useMap();
    useEffect(() => {
        if (center) {
            map.setView(center, map.getZoom(), { animate: true });
        }
    }, [center, map]);
    return null;
}

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
        fetchQrData();
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

    // Harita merkezini belirle: İlk kuryenin konumu yoksa Türkiye geneli
    const activeCouriers = couriers.filter(c =>
        c.Status !== 'Offline' &&
        ((c.lat !== undefined || c.Lat !== undefined) && (c.lng !== undefined || c.Lng !== undefined))
    );
    const mapCenter = activeCouriers.length > 0
        ? [activeCouriers[0].lat || activeCouriers[0].Lat, activeCouriers[0].lng || activeCouriers[0].Lng]
        : [41.0082, 28.9784]; // Istanbul

    return (
        <div className="flex flex-col gap-4 h-[calc(100vh-2rem)]">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <h1 className="text-xl font-bold text-text-primary">Kurye Takip</h1>
                    <span className="badge badge-amber">{delivering} Aktif Teslimat</span>
                </div>

                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="flex text-sm items-center gap-2 px-4 py-2 bg-emerald-accent/15 text-emerald-accent border border-emerald-accent/30 rounded-xl hover:bg-emerald-accent/20 transition-colors font-medium"
                >
                    <Plus size={16} /> Yeni Kurye
                </button>
            </div>

            {/* Layout */}
            <div className="flex flex-col lg:flex-row gap-5 flex-1 min-h-0">
                {/* Map Section (Left/Top) */}
                <div className="glass-card flex-1 min-h-[300px] lg:min-h-0 rounded-2xl overflow-hidden relative border border-glass-border shadow-lg">
                    <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%', background: '#0a0e1a' }}>
                        <MapUpdater center={mapCenter} />
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                        />
                        {activeCouriers.map(c => (
                            <Marker
                                key={c.ID}
                                position={[c.lat || c.Lat, c.lng || c.Lng]}
                                icon={createCourierIcon(c.Status)}
                            >
                                <Popup className="courier-popup">
                                    <div className="font-semibold text-[13px]">{c.Name}</div>
                                    <div className="text-[11px] text-gray-500">{c.Status}</div>
                                </Popup>
                            </Marker>
                        ))}
                    </MapContainer>

                    {/* Map Overlay Badge */}
                    <div className="absolute top-4 left-4 z-[400] bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2">
                        <MapPin size={14} className="text-cyan-accent" />
                        <span className="text-xs font-medium text-white shadow-sm">{activeCouriers.length} Online</span>
                    </div>
                </div>

                {/* Courier Cards Section (Right/Bottom) */}
                <div className="w-full lg:w-[350px] shrink-0 flex flex-col gap-3 overflow-y-auto pr-2 pb-5">
                    {couriers.map((c) => (
                        <CourierCard key={c.ID} courier={c} />
                    ))}
                    {couriers.length === 0 && (
                        <div className="text-center py-10 text-sm text-text-muted">
                            Sistemde kurye bulunmamaktadır.
                        </div>
                    )}
                </div>
            </div>

            <CourierManagerModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSave={handleAddCourier}
            />
        </div>
    );
}
