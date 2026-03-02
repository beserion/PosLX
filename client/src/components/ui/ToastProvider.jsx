import { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

let toastId = 0;

const icons = {
    success: CheckCircle2,
    error: XCircle,
    warning: AlertTriangle,
    info: Info,
};

const styles = {
    success: {
        border: 'rgba(16, 185, 129, 0.3)',
        bg: 'rgba(16, 185, 129, 0.1)',
        icon: '#34d399',
        glow: '0 0 20px rgba(16, 185, 129, 0.15)',
    },
    error: {
        border: 'rgba(239, 68, 68, 0.3)',
        bg: 'rgba(239, 68, 68, 0.1)',
        icon: '#f87171',
        glow: '0 0 20px rgba(239, 68, 68, 0.15)',
    },
    warning: {
        border: 'rgba(245, 158, 11, 0.3)',
        bg: 'rgba(245, 158, 11, 0.1)',
        icon: '#fbbf24',
        glow: '0 0 20px rgba(245, 158, 11, 0.15)',
    },
    info: {
        border: 'rgba(6, 182, 212, 0.3)',
        bg: 'rgba(6, 182, 212, 0.1)',
        icon: '#22d3ee',
        glow: '0 0 20px rgba(6, 182, 212, 0.15)',
    },
};

function Toast({ toast, onDismiss }) {
    const Icon = icons[toast.type] || Info;
    const style = styles[toast.type] || styles.info;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 80, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl max-w-sm w-full"
            style={{
                background: style.bg,
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: `1px solid ${style.border}`,
                boxShadow: style.glow,
            }}
        >
            <Icon size={18} style={{ color: style.icon, marginTop: 2, flexShrink: 0 }} />
            <div className="flex-1 min-w-0">
                {toast.title && (
                    <p className="text-sm font-semibold text-text-primary">{toast.title}</p>
                )}
                <p className="text-sm text-text-secondary leading-snug">{toast.message}</p>
            </div>
            <button
                onClick={() => onDismiss(toast.id)}
                className="text-text-muted hover:text-text-primary transition-colors mt-0.5 shrink-0"
            >
                <X size={14} />
            </button>
        </motion.div>
    );
}

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const dismiss = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const addToast = useCallback((type, message, title, duration = 4000) => {
        const id = ++toastId;
        setToasts((prev) => [...prev, { id, type, message, title }]);
        if (duration > 0) {
            setTimeout(() => dismiss(id), duration);
        }
        return id;
    }, [dismiss]);

    const toast = useCallback({
        success: (message, title) => addToast('success', message, title),
        error: (message, title) => addToast('error', message, title),
        warning: (message, title) => addToast('warning', message, title),
        info: (message, title) => addToast('info', message, title),
    }, [addToast]);

    return (
        <ToastContext.Provider value={toast}>
            {children}
            {/* Toast Container */}
            <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none max-md:top-auto max-md:bottom-20 max-md:right-4 max-md:left-4 max-md:items-center">
                <AnimatePresence mode="popLayout">
                    {toasts.map((t) => (
                        <Toast key={t.id} toast={t} onDismiss={dismiss} />
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within ToastProvider');
    return ctx;
}
