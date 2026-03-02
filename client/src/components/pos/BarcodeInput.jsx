import { useRef, useState } from 'react';
import { ScanBarcode } from 'lucide-react';
import { usePosStore } from '../../store/posStore';

export default function BarcodeInput() {
    const ref = useRef(null);
    const [value, setValue] = useState('');
    const findByBarcode = usePosStore((s) => s.findByBarcode);
    const addToCart = usePosStore((s) => s.addToCart);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!value.trim()) return;
        const product = findByBarcode(value.trim());
        if (product) {
            addToCart(product);
            setValue('');
        }
    };

    return (
        <form onSubmit={handleSubmit} className="relative">
            <ScanBarcode size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
                ref={ref}
                autoFocus
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Scan barcode or type code…"
                className="glass-input w-full pl-10 pr-4"
            />
        </form>
    );
}
