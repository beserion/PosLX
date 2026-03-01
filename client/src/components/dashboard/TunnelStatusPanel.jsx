import { useEffect, useState, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useTunnelStore } from '../../store/tunnelStore';
import { Wifi, WifiOff, Copy, Check, RefreshCw, QrCode, Globe, Shield } from 'lucide-react';

const POLL_INTERVAL = 30_000; // 30 seconds

export default function TunnelStatusPanel() {
    const { connected, url, token, loading, fetchQrData } = useTunnelStore();
    const [copied, setCopied] = useState(null); // 'url' | 'token' | null
    const [showQr, setShowQr] = useState(true);

    // Initial fetch + polling
    useEffect(() => {
        fetchQrData();
        const id = setInterval(fetchQrData, POLL_INTERVAL);
        return () => clearInterval(id);
    }, [fetchQrData]);

    const copyToClipboard = useCallback((text, key) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(key);
            setTimeout(() => setCopied(null), 2000);
        });
    }, []);

    // QR data: JSON with url and token for courier APK
    const qrPayload = url && token ? JSON.stringify({ url, token }) : null;

    return (
        <div className="glass-card-static p-5 flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl" style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' }}>
                        <Globe size={18} className="text-white" />
                    </div>
                    <h3 className="text-sm font-bold text-text-primary">Tunnel Bağlantısı</h3>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchQrData}
                        className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-text-muted hover:text-text-primary"
                        title="Yenile"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <span className={`badge ${connected ? 'badge-emerald' : 'badge-danger'}`}>
                        {connected
                            ? <><Wifi size={10} /> Connected</>
                            : <><WifiOff size={10} /> Disconnected</>
                        }
                    </span>
                </div>
            </div>

            {/* Status Alert */}
            {!connected && !loading && (
                <div className="flex items-center gap-2 p-3 rounded-xl text-sm"
                    style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                    <WifiOff size={14} className="text-danger shrink-0" />
                    <span className="text-red-400">
                        Tunnel bağlantısı kesildi. cloudflared kurulu olduğundan emin olun.
                    </span>
                </div>
            )}

            {/* Public URL */}
            <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-muted flex items-center gap-1">
                    <Globe size={12} /> Public URL
                </label>
                <div className="flex items-center gap-2">
                    <div className="glass-input flex-1 text-xs font-mono truncate select-all"
                        style={{ padding: '8px 12px' }}>
                        {url || '—'}
                    </div>
                    {url && (
                        <button
                            onClick={() => copyToClipboard(url, 'url')}
                            className="p-2 rounded-xl hover:bg-white/5 transition-colors text-text-muted hover:text-text-primary shrink-0"
                            title="URL Kopyala"
                        >
                            {copied === 'url' ? <Check size={14} className="text-emerald-accent" /> : <Copy size={14} />}
                        </button>
                    )}
                </div>
            </div>

            {/* API Token */}
            <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-muted flex items-center gap-1">
                    <Shield size={12} /> Kurye API Token
                </label>
                <div className="flex items-center gap-2">
                    <div className="glass-input flex-1 text-xs font-mono truncate select-all"
                        style={{ padding: '8px 12px' }}>
                        {token || '—'}
                    </div>
                    {token && (
                        <button
                            onClick={() => copyToClipboard(token, 'token')}
                            className="p-2 rounded-xl hover:bg-white/5 transition-colors text-text-muted hover:text-text-primary shrink-0"
                            title="Token Kopyala"
                        >
                            {copied === 'token' ? <Check size={14} className="text-emerald-accent" /> : <Copy size={14} />}
                        </button>
                    )}
                </div>
            </div>

            {/* QR Code */}
            <div className="flex flex-col gap-2">
                <button
                    onClick={() => setShowQr(!showQr)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-text-primary transition-colors"
                >
                    <QrCode size={12} />
                    Kurye Bağlantı QR
                    <span className="text-[10px] ml-auto opacity-60">{showQr ? 'Gizle' : 'Göster'}</span>
                </button>

                {showQr && (
                    <div className="flex justify-center p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                        {qrPayload ? (
                            <div className="p-3 rounded-xl bg-white">
                                <QRCodeSVG
                                    value={qrPayload}
                                    size={160}
                                    level="M"
                                    bgColor="#ffffff"
                                    fgColor="#0a0e1a"
                                />
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-2 py-6 text-text-muted">
                                <QrCode size={32} className="opacity-30" />
                                <span className="text-xs">Tunnel bağlantısı bekleniyor...</span>
                            </div>
                        )}
                    </div>
                )}

                {qrPayload && (
                    <p className="text-[11px] text-text-muted text-center leading-relaxed">
                        Kurye APK bu QR kodunu okuyarak bağlantı bilgilerini (URL + Token) otomatik alır.
                    </p>
                )}
            </div>
        </div>
    );
}
