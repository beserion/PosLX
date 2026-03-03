import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Printer, Download, Usb } from 'lucide-react';
import ReceiptTemplate from './ReceiptTemplate';
import { printViaWebAPI, isSerialAvailable, printViaSerial } from '../../lib/receiptPrinter';
import { useToast } from '../../hooks/useToast';
import { usePosStore } from '../../store/posStore';

export default function ReceiptPreviewModal({ sale, isOpen, onClose, autoPrint = false }) {
    const receiptRef = useRef(null);
    const toast = useToast();
    const taxRateSetting = usePosStore((s) => s.taxRateSetting);

    const handlePrint = () => {
        if (receiptRef.current) {
            printViaWebAPI(receiptRef.current);
            toast.success('Yazdırma komutu gönderildi');
        }
    };

    useEffect(() => {
        if (isOpen && autoPrint && receiptRef.current) {
            // A brief timeout to ensure React has fully rendered the template into the DOM
            const timer = setTimeout(() => {
                handlePrint();
                // Optionally close immediately after print
                onClose();
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [isOpen, autoPrint, sale]);

    if (!isOpen || !sale) return null;

    const handleUSBPrint = async () => {
        try {
            await printViaSerial(sale);
            toast.success('Termal yazıcıya gönderildi');
        } catch (err) {
            toast.error('Yazıcı bağlantısı başarısız: ' + err.message);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/70 z-[100]"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed inset-0 z-[101] flex items-center justify-center p-4"
                    >
                        <div className="glass-card-static p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-text-primary">Fiş Önizleme</h3>
                                <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Receipt Preview */}
                            <div className="bg-white rounded-xl p-2 mb-4" ref={receiptRef}>
                                <ReceiptTemplate sale={{ ...sale, taxRate: taxRateSetting }} />
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2">
                                <button onClick={handlePrint} className="btn-primary flex-1 flex items-center justify-center gap-2">
                                    <Printer size={16} /> Yazdır
                                </button>
                                <button onClick={handlePrint} className="btn-ghost flex items-center justify-center gap-2 px-4">
                                    <Download size={16} /> PDF
                                </button>
                                {isSerialAvailable() && (
                                    <button onClick={handleUSBPrint} className="btn-amber flex items-center justify-center gap-2 px-4">
                                        <Usb size={16} /> USB
                                    </button>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
