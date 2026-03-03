/**
 * Receipt Template — 80mm thermal printer compatible HTML.
 * Rendered inside a hidden div for printing or inside a preview modal.
 */
export default function ReceiptTemplate({ sale }) {
    if (!sale) return null;

    const {
        receiptNo = '0001',
        items = [],
        subtotal = 0,
        tax = 0,
        total = 0,
        discount = 0,
        serviceFee = 0,
        serviceFeeCount = 1, // Optional: if added later
        paymentMethod = 'Cash',
        taxRate = 8,
        date = new Date(),
        storeName = 'PosLX Store',
        storeAddress = 'İstanbul, Turkey',
        storePhone = '+90 212 000 0000',
    } = sale;

    const dateStr = date.toLocaleDateString('tr-TR');
    const timeStr = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    const divider = '─'.repeat(32);

    return (
        <div className="receipt-content" style={{
            fontFamily: "'Courier New', monospace",
            fontSize: '12px',
            lineHeight: 1.5,
            color: '#000',
            background: '#fff',
            width: '302px',
            padding: '12px',
        }}>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
                <p style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 2 }}>{storeName}</p>
                <p style={{ fontSize: 10, opacity: 0.7 }}>{storeAddress}</p>
                <p style={{ fontSize: 10, opacity: 0.7 }}>Tel: {storePhone}</p>
            </div>

            <p style={{ textAlign: 'center', opacity: 0.4 }}>{divider}</p>

            {/* Info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>Fiş No: #{receiptNo}</span>
                <span>{dateStr}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>Ödeme: {paymentMethod === 'Cash' ? 'Nakit' : 'Kart'}</span>
                <span>{timeStr}</span>
            </div>

            <p style={{ opacity: 0.4 }}>{divider}</p>

            {/* Items */}
            <table style={{ width: '100%', borderCollapse: 'collapse', margin: '4px 0' }}>
                <thead>
                    <tr style={{ borderBottom: '1px dashed #999' }}>
                        <th style={{ textAlign: 'left', fontWeight: 'bold', fontSize: 11 }}>Ürün</th>
                        <th style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 11, width: 30 }}>Ad.</th>
                        <th style={{ textAlign: 'right', fontWeight: 'bold', fontSize: 11, width: 60 }}>Tutar</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, i) => (
                        <tr key={i}>
                            <td style={{ textAlign: 'left', paddingTop: 2, fontSize: 11 }}>{item.Name}</td>
                            <td style={{ textAlign: 'center', paddingTop: 2, fontSize: 11 }}>{item.qty}</td>
                            <td style={{ textAlign: 'right', paddingTop: 2, fontSize: 11 }}>
                                ₺{(item.SalePrice * item.qty).toFixed(2)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <p style={{ opacity: 0.4 }}>{divider}</p>

            {/* Totals */}
            <div style={{ marginTop: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Ara Toplam:</span>
                    <span>₺{subtotal.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>KDV (%{taxRate}):</span>
                    <span>₺{tax.toFixed(2)}</span>
                </div>
                {serviceFee > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Servis Ücreti:</span>
                        <span>+₺{serviceFee.toFixed(2)}</span>
                    </div>
                )}
                {discount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>İndirim:</span>
                        <span>-₺{discount.toFixed(2)}</span>
                    </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: 14, marginTop: 4 }}>
                    <span>TOPLAM:</span>
                    <span>₺{total.toFixed(2)}</span>
                </div>
            </div>

            <p style={{ opacity: 0.4, marginTop: 8 }}>{divider}</p>

            {/* Footer */}
            <div style={{ textAlign: 'center', marginTop: 8, fontSize: 10, opacity: 0.6 }}>
                <p>Teşekkür ederiz!</p>
                <p>İade süresi: 7 gün</p>
                <p style={{ marginTop: 4, fontFamily: 'monospace', letterSpacing: 2 }}>* * * * *</p>
            </div>
        </div>
    );
}
