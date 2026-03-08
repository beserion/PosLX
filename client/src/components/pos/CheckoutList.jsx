import { usePosStore } from '../../store/posStore';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../lib/api';
import { Minus, Plus, Trash2, CreditCard, Banknote, ShoppingBag, CheckCircle2, Truck } from 'lucide-react';
import { useState, useEffect } from 'react';
import BarcodeInput from './BarcodeInput';
import ReceiptPreviewModal from './ReceiptPreviewModal';
import { useToast } from '../../hooks/useToast';
import { useCourierStore } from '../../store/courierStore';

export default function CheckoutList({ onClose }) {
    const cart = usePosStore((s) => s.cart);
    const updateQty = usePosStore((s) => s.updateQty);
    const removeFromCart = usePosStore((s) => s.removeFromCart);
    const paymentMethod = usePosStore((s) => s.paymentMethod);
    const setPaymentMethod = usePosStore((s) => s.setPaymentMethod);
    const getItemPrice = usePosStore((s) => s.getItemPrice);
    const getSubtotal = usePosStore((s) => s.getSubtotal);
    const getTax = usePosStore((s) => s.getTax);
    const getTotal = usePosStore((s) => s.getTotal);
    const completeSale = usePosStore((s) => s.completeSale);
    const checkoutCourierID = usePosStore((s) => s.checkoutCourierID);
    const setCheckoutCourierID = usePosStore((s) => s.setCheckoutCourierID);
    const discountAmount = usePosStore((s) => s.discountAmount);
    const setDiscountAmount = usePosStore((s) => s.setDiscountAmount);
    const serviceFeeCount = usePosStore((s) => s.serviceFeeCount);
    const addServiceFee = usePosStore((s) => s.addServiceFee);
    const removeServiceFee = usePosStore((s) => s.removeServiceFee);
    const serviceFeeSetting = usePosStore((s) => s.serviceFeeSetting);
    const fetchSettings = usePosStore((s) => s.fetchSettings);
    const taxRateSetting = usePosStore((s) => s.taxRateSetting);

    const couriers = useCourierStore((s) => s.couriers);
    const fetchCouriers = useCourierStore((s) => s.fetchCouriers);

    const [showReceipt, setShowReceipt] = useState(false);
    const [receiptData, setReceiptData] = useState(null);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const toast = useToast();

    useEffect(() => {
        fetchCouriers();
        fetchSettings();
    }, [fetchCouriers, fetchSettings]);

    const handleComplete = async () => {
        if (cart.length === 0) return;
        try {
            const sale = await completeSale();
            if (sale) {
                // Background direct print via Node
                api.post('/print', sale).then(() => {
                    toast.success('Termal yazıcıdan fiş basılıyor...');
                }).catch(err => {
                    console.error('Yazdırma hatası:', err);
                    toast.error('Fiş yazdırma başarısız. Yazıcıyı kontrol edin.');
                });

                setReceiptData(sale);
                // setShowReceipt(true); // Optional: if we want to still show UI popup. Commented out since user wants fully silent.
                toast.success(`Satış #${sale.receiptNo} tamamlandı — ₺${sale.total.toFixed(2)}`);
            }
        } catch (err) {
            console.error('Complete sale failed:', err);
            toast.error('Satış tamamlanırken bir hata oluştu.');
        }
    };

    return (
        <>
            <div className="glass-card-static flex flex-col h-full">
                {/* Header */}
                <div className="flex items-center gap-2 px-5 py-4 border-b border-glass-border">
                    <ShoppingBag size={22} className="text-cyan-accent" />
                    <h2 className="text-lg font-bold text-text-primary">Checkout</h2>
                    <span className="badge badge-cyan ml-auto text-sm">{cart.length} items</span>
                </div>

                {/* Barcode */}
                <div className="px-5 py-3 border-b border-glass-border">
                    <BarcodeInput />
                </div>

                {/* Cart Items */}
                <div className="flex-1 overflow-y-auto px-5 py-2 space-y-1">
                    <AnimatePresence>
                        {cart.map((item) => (
                            <motion.div
                                key={item.ID}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="flex items-center gap-3 py-2.5 border-b border-glass-border/50"
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="text-base font-semibold text-text-primary truncate">{item.Name}</p>
                                    <p className="text-sm text-text-muted">
                                        ₺{getItemPrice(item).toFixed(2)} each
                                    </p>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <button onClick={() => updateQty(item.ID, item.qty - 1)}
                                        className="w-7 h-7 rounded-lg glass-card flex items-center justify-center text-text-secondary hover:text-text-primary">
                                        <Minus size={14} />
                                    </button>
                                    <span className="w-7 text-center text-sm font-bold text-text-primary">{item.qty}</span>
                                    <button onClick={() => updateQty(item.ID, item.qty + 1)}
                                        className="w-7 h-7 rounded-lg glass-card flex items-center justify-center text-text-secondary hover:text-text-primary">
                                        <Plus size={14} />
                                    </button>
                                </div>
                                <span className="text-base font-bold text-cyan-accent w-20 text-right">
                                    ₺{(getItemPrice(item) * item.qty).toFixed(0)}
                                </span>
                                <button onClick={() => removeFromCart(item.ID)}
                                    className="text-text-muted hover:text-danger transition-colors">
                                    <Trash2 size={14} />
                                </button>
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {cart.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-text-muted">
                            <ShoppingBag size={32} className="mb-2 opacity-30" />
                            <p className="text-sm">Cart is empty</p>
                        </div>
                    )}
                </div>

                {/* Courier Assignment */}
                <div className="px-5 py-3 border-t border-glass-border">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-text-muted flex items-center gap-1">
                            <Truck size={14} /> Siparişi Kuryeye Ata
                        </label>
                        <select
                            className="glass-input w-full cursor-pointer bg-surface-dark"
                            value={checkoutCourierID || ''}
                            onChange={(e) => setCheckoutCourierID(e.target.value ? Number(e.target.value) : null)}
                        >
                            <option value="">-- Masadan Satış / Gel-Al --</option>
                            {couriers.map(c => (
                                <option key={c.ID} value={c.ID}>{c.Name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Payment Method */}
                <div className="px-5 py-3 border-t border-glass-border">
                    <div className="flex gap-2">
                        <button onClick={() => setPaymentMethod('Cash')}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-base font-medium transition-all
                ${paymentMethod === 'Cash'
                                    ? 'bg-emerald-accent/15 text-emerald-accent border border-emerald-accent/30'
                                    : 'glass-card text-text-secondary'}`}>
                            <Banknote size={18} /> Cash
                        </button>
                        <button onClick={() => setPaymentMethod('Card')}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-base font-medium transition-all
                ${paymentMethod === 'Card'
                                    ? 'bg-cyan-accent/15 text-cyan-accent border border-cyan-accent/30'
                                    : 'glass-card text-text-secondary'}`}>
                            <CreditCard size={18} /> Card
                        </button>
                    </div>
                </div>

                {/* Extra Actions */}
                {serviceFeeSetting > 0 && (
                    <div className="px-5 py-3 border-t border-glass-border">
                        <div className="flex items-center justify-between bg-surface-dark rounded-xl p-1.5 border border-glass-border">
                            <button
                                onClick={addServiceFee}
                                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold text-text-primary hover:bg-emerald-accent/10 hover:text-emerald-accent transition-colors"
                            >
                                <Plus size={16} /> Servis Ücreti Ekle (₺{serviceFeeSetting})
                            </button>
                            {serviceFeeCount > 0 && (
                                <div className="flex items-center gap-3 px-3 border-l border-glass-border ml-1">
                                    <button onClick={removeServiceFee} className="text-text-muted hover:text-danger p-1 transition-colors">
                                        <Minus size={16} />
                                    </button>
                                    <span className="font-bold text-emerald-accent w-4 text-center">{serviceFeeCount}</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Totals & Discounts */}
                <div className="px-5 py-4 border-t border-glass-border space-y-2">
                    <div className="flex justify-between items-center text-sm text-text-secondary">
                        <span>İndirim (₺)</span>
                        <input
                            type="number"
                            className="glass-input w-16 h-7 px-1.5 py-0 font-medium text-right text-sm"
                            value={discountAmount || ''}
                            onChange={(e) => setDiscountAmount(Number(e.target.value))}
                            placeholder="0"
                            min="0"
                        />
                    </div>

                    <div className="flex justify-between text-sm text-text-secondary pt-1">
                        <span>Subtotal</span><span>₺{getSubtotal().toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-text-secondary">
                        <span>Tax (%{taxRateSetting})</span><span>₺{getTax().toFixed(2)}</span>
                    </div>
                    {serviceFeeCount > 0 && (
                        <div className="flex justify-between text-sm text-emerald-accent">
                            <span>Service Fee (x{serviceFeeCount})</span><span>+ ₺{(serviceFeeCount * serviceFeeSetting).toFixed(2)}</span>
                        </div>
                    )}
                    {discountAmount > 0 && (
                        <div className="flex justify-between text-sm text-danger">
                            <span>Discount</span><span>- ₺{discountAmount.toFixed(2)}</span>
                        </div>
                    )}
                    <div className="flex justify-between text-xl font-bold text-text-primary pt-1 mt-1 border-t border-glass-border/30">
                        <span>Total</span><span className="text-cyan-accent glow-cyan">₺{getTotal().toFixed(2)}</span>
                    </div>
                </div>

                {/* Complete Button */}
                <div className="px-5 pb-5">
                    <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => {
                            if (cart.length === 0) return;
                            if (checkoutCourierID) {
                                setShowConfirmModal(true);
                            } else {
                                handleComplete();
                            }
                        }}
                        disabled={cart.length === 0}
                        className={`w-full py-4 rounded-xl font-bold text-base transition-all duration-300
              ${cart.length > 0
                                ? 'btn-success'
                                : 'bg-white/5 text-text-muted cursor-not-allowed border border-glass-border'}`}
                    >
                        Complete Sale — ₺{getTotal().toFixed(2)}
                    </motion.button>
                </div>
            </div>

            {/* Receipt Modal */}
            <ReceiptPreviewModal
                sale={receiptData}
                isOpen={showReceipt}
                onClose={() => setShowReceipt(false)}
                autoPrint={true}
            />

            {/* Courier Confirm Modal */}
            <AnimatePresence>
                {showConfirmModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-surface-dark border border-glass-border rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
                        >
                            <div className="p-6 text-center">
                                <div className="w-16 h-16 rounded-full bg-cyan-accent/20 text-cyan-accent flex items-center justify-center mx-auto mb-4">
                                    <Truck size={32} />
                                </div>
                                <h3 className="text-xl font-bold text-text-primary mb-2">Kurye Onayı</h3>
                                <p className="text-text-secondary mb-6">
                                    Bu siparişi kuryeye atamak ve satışı tamamlamak üzeresiniz. Onaylıyor musunuz?
                                </p>
                                <div className="flex gap-3 justify-center">
                                    <button
                                        onClick={() => setShowConfirmModal(false)}
                                        className="flex-1 px-4 py-3 rounded-xl font-semibold text-text-primary bg-white/5 hover:bg-white/10 transition-colors"
                                    >
                                        İptal
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowConfirmModal(false);
                                            handleComplete();
                                        }}
                                        className="flex-1 px-4 py-3 rounded-xl font-semibold text-white bg-cyan-accent hover:bg-cyan-accent/90 transition-colors shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                                    >
                                        Onayla
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}
