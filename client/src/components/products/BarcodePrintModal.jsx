import { useRef } from "react";
import Barcode from "react-barcode";
import { X, Printer } from "lucide-react";
import { motion } from "framer-motion";

export default function BarcodePrintModal({ product, onClose }) {
    if (!product || !product.Barcodes || product.Barcodes.length === 0) return null;

    const barcodeValue = product.Barcodes[0];

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm barcode-print-modal-overlay">
            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    .barcode-print-modal-overlay { background: transparent !important; backdrop-filter: none !important; }
                    .barcode-print-area, .barcode-print-area * { visibility: visible; }
                    .barcode-print-area {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin: 0;
                        padding: 0;
                        box-shadow: none !important;
                    }
                    .no-print { display: none !important; }
                }
            `}</style>
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="glass-card p-6 w-full max-w-sm flex flex-col items-center gap-6 relative"
            >
                <div className="absolute top-4 right-4 flex items-center gap-2 no-print">
                    <button
                        onClick={onClose}
                        className="p-1.5 text-text-muted hover:text-text-primary bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="text-center no-print">
                    <h2 className="text-lg font-bold text-text-primary">Etiket Yazdır</h2>
                    <p className="text-sm text-text-muted mt-1">{product.Name}</p>
                </div>

                <div className="barcode-print-area flex flex-col items-center bg-white p-4 rounded-xl">
                    <div className="text-black text-xs font-bold mb-1 text-center w-full truncate max-w-[200px]">
                        {product.Name}
                    </div>
                    <Barcode
                        value={barcodeValue}
                        format="CODE128"
                        width={2}
                        height={60}
                        displayValue={true}
                        background="#ffffff"
                        lineColor="#000000"
                        fontSize={14}
                        margin={0}
                    />
                    <div className="text-black font-bold text-lg mt-1 border-t border-black/10 pt-1 w-full text-center">
                        ₺{product.SalePrice}
                    </div>
                </div>

                <button
                    onClick={handlePrint}
                    className="btn-primary w-full py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 no-print"
                >
                    <Printer size={18} />
                    Yazdır
                </button>
            </motion.div>
        </div>
    );
}
