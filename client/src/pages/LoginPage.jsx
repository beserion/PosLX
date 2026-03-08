import { useState, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Lock, Delete, LogIn } from 'lucide-react';

export default function LoginPage() {
    const { login, loading, error } = useAuthStore();
    const [pin, setPin] = useState('');
    const [shake, setShake] = useState(false);

    const handleDigit = useCallback((d) => {
        setPin((prev) => (prev.length < 4 ? prev + d : prev));
    }, []);

    const handleBackspace = useCallback(() => {
        setPin((prev) => prev.slice(0, -1));
    }, []);

    const handleSubmit = async () => {
        if (!pin || pin.length < 4) return;
        try {
            await login(pin);
        } catch {
            setShake(true);
            setPin('');
            setTimeout(() => setShake(false), 600);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSubmit();
        } else if (e.key === 'Backspace') {
            handleBackspace();
        } else if (/^[0-9]$/.test(e.key)) {
            handleDigit(e.key);
        }
    };

    const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'];

    return (
        <div
            className="fixed inset-0 z-[999] flex items-center justify-center"
            style={{
                background:
                    'radial-gradient(ellipse 80% 60% at 10% 20%, rgba(6,182,212,0.12) 0%, transparent 60%), ' +
                    'radial-gradient(ellipse 50% 50% at 85% 80%, rgba(139,92,246,0.08) 0%, transparent 50%), ' +
                    'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(16,185,129,0.05) 0%, transparent 50%), ' +
                    '#0a0e1a',
            }}
            onKeyDown={handleKeyDown}
            tabIndex={0}
        >
            <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col items-center gap-8 w-full max-w-sm px-6"
            >
                {/* Logo */}
                <div className="flex flex-col items-center gap-3">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}
                        className="flex items-center justify-center w-20 h-20 rounded-2xl"
                        style={{
                            background: 'linear-gradient(135deg, #06b6d4, #10b981)',
                            boxShadow: '0 8px 40px rgba(6,182,212,0.35)',
                        }}
                    >
                        <Package size={40} className="text-white" />
                    </motion.div>
                    <h1
                        className="text-2xl font-bold"
                        style={{
                            background: 'linear-gradient(135deg, #06b6d4, #10b981)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                        }}
                    >
                        PosLX
                    </h1>
                    <p className="text-text-muted text-sm">Giriş yapmak için PIN kodunuzu girin</p>
                </div>

                {/* PIN Dots */}
                <motion.div
                    animate={shake ? { x: [-12, 12, -8, 8, -4, 4, 0] } : {}}
                    transition={{ duration: 0.5 }}
                    className="flex items-center gap-3"
                >
                    {[0, 1, 2, 3].map((i) => (
                        <motion.div
                            key={i}
                            animate={{
                                scale: pin.length > i ? 1.2 : 1,
                                backgroundColor: pin.length > i
                                    ? 'rgba(6,182,212,1)'
                                    : 'rgba(255,255,255,0.08)',
                            }}
                            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                            className="w-4 h-4 rounded-full border border-white/10"
                            style={{
                                boxShadow: pin.length > i ? '0 0 16px rgba(6,182,212,0.5)' : 'none',
                            }}
                        />
                    ))}
                </motion.div>

                {/* Error */}
                <AnimatePresence>
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
                            style={{
                                background: 'rgba(239,68,68,0.12)',
                                color: '#f87171',
                                border: '1px solid rgba(239,68,68,0.2)',
                            }}
                        >
                            <Lock size={14} />
                            {error}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Numpad */}
                <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
                    {digits.map((d, idx) => {
                        if (d === '') return <div key={idx} />;
                        if (d === 'back') {
                            return (
                                <button
                                    key="back"
                                    onClick={handleBackspace}
                                    className="flex items-center justify-center h-16 rounded-2xl text-text-muted hover:text-text-primary hover:bg-white/10 transition-all duration-200 cursor-pointer active:scale-95"
                                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                                >
                                    <Delete size={22} />
                                </button>
                            );
                        }
                        return (
                            <motion.button
                                key={d}
                                whileTap={{ scale: 0.92 }}
                                onClick={() => handleDigit(d)}
                                className="flex items-center justify-center h-16 rounded-2xl text-xl font-semibold text-text-primary hover:bg-white/10 transition-all duration-200 cursor-pointer"
                                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                            >
                                {d}
                            </motion.button>
                        );
                    })}
                </div>

                {/* Submit */}
                <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleSubmit}
                    disabled={loading || pin.length < 4}
                    className="w-full max-w-[280px] flex items-center justify-center gap-2 py-4 rounded-2xl text-white font-bold text-base disabled:opacity-40 cursor-pointer transition-all duration-300"
                    style={{
                        background: 'linear-gradient(135deg, #06b6d4, #10b981)',
                        boxShadow: pin.length >= 4 ? '0 8px 32px rgba(6,182,212,0.35)' : 'none',
                    }}
                >
                    {loading ? (
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                            className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                        />
                    ) : (
                        <>
                            <LogIn size={20} />
                            Giriş Yap
                        </>
                    )}
                </motion.button>
            </motion.div>
        </div>
    );
}
