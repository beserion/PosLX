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
    const activeCouriers = couriers.filter((c) => c.Lat != null && c.Lng != null);

    return (
        <div className="glass-card-static overflow-hidden h-full" style={{ minHeight: 400 }}>
            <MapContainer
                center={[41.015, 28.979]}
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
                                <span style={{ fontSize: 11, opacity: 0.7 }}>{courier.Phone}</span>
                            </div>
                        </Popup>
                    </CircleMarker>
                ))}
            </MapContainer>
        </div>
    );
}
