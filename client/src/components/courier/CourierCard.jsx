import { useCourierStore } from '../../store/courierStore';
import { useTunnelStore } from '../../store/tunnelStore';
import { Truck, Phone, QrCode, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useToast } from '../../hooks/useToast';

const statusStyle = {
    Delivering: 'badge-cyan',
    Idle: 'badge-amber',
    Offline: 'badge-danger',
};

export default function CourierCard({ courier }) {
    const { url, token } = useTunnelStore();
    const deleteCourier = useCourierStore((s) => s.deleteCourier);
    const [showQr, setShowQr] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const toast = useToast();

    const qrPayload = url && token ? JSON.stringify({ url, token, courierId: courier.ID }) : null;

    const handleDelete = async () => {
        if (!confirm(`"${courier.Name}" isimli kuryeyi silmek istediğinize emin misiniz?`)) return;
        try {
            setIsDeleting(true);
            await deleteCourier(courier.ID);
            toast.success("Kurye başarıyla silindi.");
        } catch (err) {
            toast.error(err.message || "Kurye silinemedi.");
            setIsDeleting(false);
        }
    };

    return (
        <div className="glass-card flex flex-col">
            <div className="p-4 flex items-center gap-4">
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
                    </div>
                </div>

                {/* Right side: Status and Actions */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={`badge ${statusStyle[courier.Status] || 'badge-cyan'}`}>
                        {courier.Status}
                    </span>

                    <div className="flex items-center gap-1">
                        {qrPayload && (
                            <button
                                onClick={() => setShowQr(!showQr)}
                                className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-text-muted hover:text-cyan-accent"
                                title="QR Göster"
                            >
                                <QrCode size={16} />
                            </button>
                        )}
                        <button
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-text-muted hover:text-danger"
                            title="Kuryeyi Sil"
                        >
                            <Trash2 size={16} className={isDeleting ? "opacity-50" : ""} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Expanded QR Area */}
            {showQr && qrPayload && (
                <div className="px-4 pb-4 pt-1 border-t border-glass-border/30 flex flex-col items-center">
                    <p className="text-xs text-text-muted mb-3 flex items-center text-center leading-tight">
                        Bu QR kod, {courier.Name} (ID: {courier.ID}) için özel üretilmiştir. APK üzerinden okutun.
                    </p>
                    <div className="p-2.5 rounded-xl bg-white">
                        <QRCodeSVG
                            value={qrPayload}
                            size={140}
                            level="M"
                            bgColor="#ffffff"
                            fgColor="#0a0e1a"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
