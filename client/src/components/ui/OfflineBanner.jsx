import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Wifi } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useState, useEffect } from 'react';

export default function OfflineBanner() {
    const isOnline = useOnlineStatus();
    const [showReconnected, setShowReconnected] = useState(false);
    const [wasOffline, setWasOffline] = useState(false);

    useEffect(() => {
        if (!isOnline) {
            setWasOffline(true);
        } else if (wasOffline) {
            setShowReconnected(true);
            const timer = setTimeout(() => {
                setShowReconnected(false);
                setWasOffline(false);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [isOnline, wasOffline]);

    return (
        <AnimatePresence>
            {!isOnline && (
                <motion.div
                    initial={{ y: -50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -50, opacity: 0 }}
                    className="fixed top-0 left-0 right-0 z-[200] flex items-center justify-center gap-2 py-2 px-4 text-sm font-medium"
                    style={{
                        background: 'rgba(245, 158, 11, 0.15)',
                        backdropFilter: 'blur(12px)',
                        borderBottom: '1px solid rgba(245, 158, 11, 0.3)',
                        color: '#fbbf24',
                    }}
                >
                    <WifiOff size={16} />
                    <span>Çevrimdışı — Satışlar kaydediliyor, bağlantı gelince senkronize edilecek</span>
                </motion.div>
            )}

            {showReconnected && isOnline && (
                <motion.div
                    initial={{ y: -50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -50, opacity: 0 }}
                    className="fixed top-0 left-0 right-0 z-[200] flex items-center justify-center gap-2 py-2 px-4 text-sm font-medium"
                    style={{
                        background: 'rgba(16, 185, 129, 0.15)',
                        backdropFilter: 'blur(12px)',
                        borderBottom: '1px solid rgba(16, 185, 129, 0.3)',
                        color: '#34d399',
                    }}
                >
                    <Wifi size={16} />
                    <span>Bağlantı yeniden sağlandı ✓</span>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
