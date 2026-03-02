import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { useCourierStore } from '../../store/courierStore';
import 'leaflet/dist/leaflet.css';

const statusColors = {
    Delivering: '#06b6d4',
    Idle: '#f59e0b',
    Offline: '#64748b',
};

export default function CourierMap() {
    const couriers = useCourierStore((s) => s.couriers);
    const activeCouriers = couriers.filter(
        (c) => c.Lat != null && c.Lng != null
    );

    const initialCenter = activeCouriers.length
        ? [activeCouriers[0].Lat, activeCouriers[0].Lng]
        : [41.015, 28.979];

    return (
        <div className="glass-card-static overflow-hidden h-full relative" style={{ minHeight: 400 }}>
            <MapContainer
                center={initialCenter}
                zoom={12}
                className="w-full h-full"
                style={{ minHeight: 400, borderRadius: 16 }}
                zoomControl={true}
            >
                <TileLayer
                    attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />
                {activeCouriers.map((courier) => (
                    <CircleMarker
                        key={courier.ID}
                        center={[courier.Lat, courier.Lng]}
                        radius={10}
                        pathOptions={{
                            color: statusColors[courier.Status] || '#64748b',
                            fillColor: statusColors[courier.Status] || '#64748b',
                            fillOpacity: 0.6,
                            weight: 2,
                        }}
                    >
                        <Popup>
                            <div style={{ color: '#0f172a', fontFamily: 'Inter, sans-serif' }}>
                                <strong>{courier.Name}</strong><br />
                                <span style={{ fontSize: 12 }}>{courier.Status} · {courier.DailyDistanceKM.toFixed(1)} km</span><br />
                                <span style={{ fontSize: 11, opacity: 0.7 }}>
                                    Lat: {courier.Lat?.toFixed?.(5)} · Lng: {courier.Lng?.toFixed?.(5)}
                                </span><br />
                                <span style={{ fontSize: 11, opacity: 0.7 }}>{courier.Phone}</span>
                            </div>
                        </Popup>
                    </CircleMarker>
                ))}
            </MapContainer>

            {/* Simple debug/info overlay to understand API status on the map */}
            <div className="absolute top-3 left-3 z-[1000] flex flex-col gap-1 text-xs">
                <div className="px-2 py-1 rounded-lg bg-slate-900/80 text-slate-100 border border-slate-700/60 shadow-sm">
                    <span className="font-semibold">Harita durumu:</span>{' '}
                    {activeCouriers.length > 0 ? (
                        <span>{activeCouriers.length} kurye konumu yüklendi</span>
                    ) : (
                        <span>Aktif kurye konumu yok (API&apos;den Lat/Lng gelmiyor ya da 0)</span>
                    )}
                </div>
            </div>
        </div>
    );
}
