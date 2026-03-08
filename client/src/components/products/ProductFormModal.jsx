import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ScanBarcode, Save, Camera, Plus } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { usePosStore } from '../../store/posStore';
import BarcodePrintModal from './BarcodePrintModal';



const emptyForm = {
    Name: '',
    Barcodes: [],
    Category: 'Hot Drinks',
    CostPrice: '',
    SalePrice: '',
    Price2: '',
    Stock: '',
    ImageURL: '',
    ShowInPos: true,
};

export default function ProductFormModal({ isOpen, onClose, onSubmit, editProduct, initialCategory = 'Hot Drinks' }) {
    const [form, setForm] = useState(emptyForm);
    const [barcodeInput, setBarcodeInput] = useState('');
    const [scanning, setScanning] = useState(false);
    const [showPrintModal, setShowPrintModal] = useState(false);
    const barcodeRef = useRef(null);
    const toast = useToast();
    const categories = usePosStore((s) => s.categories);

    const isEdit = !!editProduct;

    useEffect(() => {
        if (editProduct) {
            setForm({
                Name: editProduct.Name || '',
                Barcodes: editProduct.Barcodes || (editProduct.Barcode ? [editProduct.Barcode] : []),
                Category: editProduct.Category || 'Hot Drinks',
                CostPrice: String(editProduct.CostPrice || ''),
                SalePrice: String(editProduct.SalePrice || ''),
                Price2: String(editProduct.Price2 || ''),
                Stock: String(editProduct.Stock || ''),
                ImageURL: editProduct.ImageURL || '',
                ShowInPos: editProduct.ShowInPos !== undefined ? !!editProduct.ShowInPos : true,
            });
        } else {
            setForm({
                ...emptyForm,
                Category: initialCategory || 'Hot Drinks',
            });
        }
        setBarcodeInput('');
    }, [editProduct, isOpen, initialCategory]);

    const handleChange = (field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }));
    };

    const addBarcode = () => {
        const trimmed = barcodeInput.trim();
        if (!trimmed) return;
        if (form.Barcodes.includes(trimmed)) {
            toast.error('Bu barkod zaten eklendi');
            return;
        }
        setForm((prev) => ({ ...prev, Barcodes: [...prev.Barcodes, trimmed] }));
        setBarcodeInput('');
        barcodeRef.current?.focus();
    };

    const removeBarcode = (barcode) => {
        setForm((prev) => ({ ...prev, Barcodes: prev.Barcodes.filter(b => b !== barcode) }));
    };

    const handleBarcodeScan = () => {
        setScanning(true);
        setTimeout(() => barcodeRef.current?.focus(), 100);
    };

    const handleBarcodeKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (barcodeInput.trim()) {
                addBarcode();
                if (scanning) {
                    toast.info(`Barkod okundu: ${barcodeInput.trim()}`);
                }
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.Name.trim()) {
            toast.error('Ürün adı zorunludur');
            return;
        }
        if (form.Barcodes.length === 0) {
            toast.error('En az bir barkod zorunludur');
            return;
        }
        if (!form.SalePrice || Number(form.SalePrice) <= 0) {
            toast.error('Satış fiyatı zorunludur');
            return;
        }

        await onSubmit({
            ...form,
            CostPrice: Number(form.CostPrice) || 0,
            SalePrice: Number(form.SalePrice) || 0,
            Price2: Number(form.Price2) || 0,
            Stock: Number(form.Stock) || 0,
            ShowInPos: form.ShowInPos ? 1 : 0,
        });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/70 z-[100]"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed inset-0 z-[101] flex items-center justify-center p-4"
                    >
                        <div className="glass-card-static p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-5">
                                <div className="flex items-center gap-3">
                                    <h3 className="text-lg font-bold text-text-primary">
                                        {isEdit ? 'Ürün Düzenle' : 'Yeni Ürün Ekle'}
                                    </h3>
                                    {isEdit && form.Barcodes.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setShowPrintModal(true)}
                                            className="btn-ghost px-3 py-1.5 text-xs flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300"
                                            title="Etiket Yazdır"
                                        >
                                            <ScanBarcode size={14} /> Etiket Yazdır
                                        </button>
                                    )}
                                </div>
                                <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                {/* Barcodes with scanner */}
                                <div>
                                    <label className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1 block">
                                        Barkodlar *
                                    </label>

                                    {/* Barcode tags */}
                                    {form.Barcodes.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mb-2">
                                            {form.Barcodes.map((barcode) => (
                                                <span
                                                    key={barcode}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-accent/10 border border-cyan-accent/25 text-xs font-mono text-cyan-accent"
                                                >
                                                    <ScanBarcode size={12} />
                                                    {barcode}
                                                    <button
                                                        type="button"
                                                        onClick={() => removeBarcode(barcode)}
                                                        className="ml-0.5 hover:text-danger transition-colors"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    {/* Input row */}
                                    <div className="flex gap-2">
                                        <input
                                            ref={barcodeRef}
                                            type="text"
                                            value={barcodeInput}
                                            onChange={(e) => setBarcodeInput(e.target.value)}
                                            onKeyDown={handleBarcodeKeyDown}
                                            placeholder="Barkod girin ve Enter'a basın..."
                                            className={`glass-input flex-1 ${scanning ? 'border-amber-accent shadow-[0_0_0_3px_rgba(245,158,11,0.2)]' : ''}`}
                                            autoFocus={scanning}
                                        />
                                        <button
                                            type="button"
                                            onClick={addBarcode}
                                            className="btn-ghost px-3 py-2"
                                            title="Barkod ekle"
                                        >
                                            <Plus size={18} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleBarcodeScan}
                                            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all
                        ${scanning
                                                    ? 'bg-amber-accent/15 text-amber-accent border border-amber-accent/30 animate-pulse'
                                                    : 'btn-ghost'}`}
                                        >
                                            <ScanBarcode size={18} />
                                            {scanning ? 'Okutun...' : 'Tara'}
                                        </button>
                                    </div>
                                    {scanning && (
                                        <p className="text-xs text-amber-accent mt-1 flex items-center gap-1">
                                            <Camera size={12} />
                                            Barkod okuyucuyu ürüne doğrultun veya manuel girin
                                        </p>
                                    )}
                                    <p className="text-xs text-text-muted mt-1">
                                        Bir ürüne birden fazla barkod eklenebilir. Her barkodu girdikten sonra Enter'a basın.
                                    </p>
                                </div>

                                {/* Product Name */}
                                <div>
                                    <label className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1 block">
                                        Ürün Adı *
                                    </label>
                                    <input
                                        type="text"
                                        value={form.Name}
                                        onChange={(e) => handleChange('Name', e.target.value)}
                                        placeholder="Ürün adını girin..."
                                        className="glass-input w-full"
                                        required
                                    />
                                </div>

                                {/* Category */}
                                <div>
                                    <label className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1 block">
                                        Kategori
                                    </label>
                                    <select
                                        value={form.Category}
                                        onChange={(e) => handleChange('Category', e.target.value)}
                                        className="glass-input w-full"
                                    >
                                        {categories.map((cat) => (
                                            <option key={cat} value={cat} style={{ background: '#111827', color: '#f1f5f9' }}>
                                                {cat}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Price Row */}
                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1 block">
                                            Maliyet Fiyatı (₺)
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={form.CostPrice}
                                            onChange={(e) => handleChange('CostPrice', e.target.value)}
                                            placeholder="0.00"
                                            className="glass-input w-full"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1 block">
                                            Satış Fiyatı (₺) *
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={form.SalePrice}
                                            onChange={(e) => handleChange('SalePrice', e.target.value)}
                                            placeholder="0.00"
                                            className="glass-input w-full"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1 block">
                                            Kurye Fiyatı (₺)
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={form.Price2}
                                            onChange={(e) => handleChange('Price2', e.target.value)}
                                            placeholder="0.00"
                                            className="glass-input w-full"
                                        />
                                    </div>
                                </div>

                                {/* Profit margin indicator */}
                                {form.CostPrice && form.SalePrice && Number(form.SalePrice) > 0 && (
                                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-accent/10 border border-emerald-accent/20">
                                        <span className="text-xs text-emerald-accent font-medium">
                                            Kâr Marjı: %{(((Number(form.SalePrice) - Number(form.CostPrice)) / Number(form.SalePrice)) * 100).toFixed(1)}
                                        </span>
                                        <span className="text-xs text-text-muted">
                                            (₺{(Number(form.SalePrice) - Number(form.CostPrice)).toFixed(2)} / birim)
                                        </span>
                                    </div>
                                )}

                                {/* Stock */}
                                <div>
                                    <label className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1 block">
                                        Stok Adedi
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={form.Stock}
                                        onChange={(e) => handleChange('Stock', e.target.value)}
                                        placeholder="0"
                                        className="glass-input w-full"
                                    />
                                </div>

                                {/* Show in POS */}
                                <div className="flex items-center gap-3">
                                    <label className="text-sm font-medium text-text-primary cursor-pointer flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={form.ShowInPos}
                                            onChange={(e) => handleChange('ShowInPos', e.target.checked)}
                                            className="w-4 h-4 rounded border-glass-border bg-black/20 text-cyan-accent focus:ring-cyan-accent/50 focus:ring-1"
                                        />
                                        POS Ekranında Göster
                                    </label>
                                </div>

                                {/* Submit */}
                                <div className="flex gap-2 pt-2">
                                    <button type="submit" className="btn-success flex-1 flex items-center justify-center gap-2">
                                        <Save size={16} />
                                        {isEdit ? 'Güncelle' : 'Ürün Ekle'}
                                    </button>
                                    <button type="button" onClick={onClose} className="btn-ghost px-6">
                                        İptal
                                    </button>
                                </div>
                            </form>
                        </div>
                    </motion.div>

                    {showPrintModal && (
                        <BarcodePrintModal
                            product={{ ...form, SalePrice: editProduct?.SalePrice || form.SalePrice, Name: form.Name || editProduct?.Name }}
                            onClose={() => setShowPrintModal(false)}
                        />
                    )}
                </>
            )}
        </AnimatePresence>
    );
}
