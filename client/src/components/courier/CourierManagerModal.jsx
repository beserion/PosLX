import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Truck, Phone } from 'lucide-react';

export default function CourierManagerModal({ isOpen, onClose, onSave }) {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            await onSave({ Name: name, Phone: phone });
            setName('');
            setPhone('');
            onClose();
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
                    {/* Backdrop */}
                    <motion.div
                        key="courier-modal-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60"
                    />

                    {/* Modal */}
                    <motion.div
                        key="courier-modal-content"
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        className="relative w-full max-w-sm glass-card overflow-hidden"
                    >
                        <div className="flex items-center justify-between p-4 border-b border-glass-border bg-white/5">
                            <div className="flex items-center gap-2">
                                <Truck className="text-cyan-accent" size={20} />
                                <h2 className="text-lg font-bold text-text-primary">Yeni Kurye Ekle</h2>
                            </div>
                            <button onClick={onClose} className="text-text-muted hover:text-danger transition-colors p-1 rounded-lg hover:bg-white/5">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-5">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1.5 ml-1">Kurye Adı</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="glass-input w-full pl-3 pr-3 py-2.5"
                                        placeholder="Mehmet Yılmaz"
                                        autoFocus
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1.5 ml-1 flex items-center gap-1.5">
                                        <Phone size={14} /> Telefon Numarası
                                    </label>
                                    <input
                                        type="text"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        className="glass-input w-full pl-3 pr-3 py-2.5"
                                        placeholder="+90 5XX XXX XX XX"
                                    />
                                </div>
                            </div>

                            <div className="mt-6 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2 rounded-xl text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
                                >
                                    İptal
                                </button>
                                <button
                                    type="submit"
                                    disabled={!name || loading}
                                    className={`px-5 py-2 rounded-xl text-sm font-bold transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)]
                                        ${name && !loading ? 'bg-cyan-accent text-background hover:bg-cyan-accent/90 cursor-pointer' : 'bg-white/10 text-text-muted cursor-not-allowed'}`}
                                >
                                    {loading ? 'Ekleniyor...' : 'Kuryeyi Kaydet'}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
