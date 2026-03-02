/**
 * Receipt Printer utility — supports Web Print API, ESC/POS USB, and Bluetooth.
 */

/**
 * Print a receipt using the browser's window.print() API via a hidden iframe.
 * @param {HTMLElement} receiptElement - The DOM element containing the receipt HTML
 */
export function printViaWebAPI(receiptElement) {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.top = '-10000px';
    iframe.style.left = '-10000px';
    iframe.style.width = '80mm';
    iframe.style.height = 'auto';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        @page { size: 80mm auto; margin: 0; }
        body {
          margin: 0; padding: 4mm;
          font-family: 'Courier New', monospace;
          font-size: 12px;
          width: 80mm;
          color: #000;
        }
        table { width: 100%; border-collapse: collapse; }
      </style>
    </head>
    <body>${receiptElement.innerHTML}</body>
    </html>
  `);
    doc.close();

    iframe.contentWindow.focus();
    iframe.contentWindow.print();

    // Cleanup after print dialog
    setTimeout(() => document.body.removeChild(iframe), 2000);
}

/**
 * Generate a downloadable PDF-like receipt (using print-to-PDF fallback).
 * In the browser, this triggers the print dialog where user can choose "Save as PDF."
 */
export function downloadReceiptAsPDF(receiptElement) {
    printViaWebAPI(receiptElement);
}

/**
 * Check if Web Serial API is available (for ESC/POS USB thermal printers).
 */
export function isSerialAvailable() {
    return 'serial' in navigator;
}

/**
 * Check if Web Bluetooth API is available.
 */
export function isBluetoothAvailable() {
    return 'bluetooth' in navigator;
}

/**
 * Print via ESC/POS over Web Serial API (USB thermal printer).
 * Sends raw text commands.
 */
export async function printViaSerial(saleData) {
    if (!isSerialAvailable()) {
        throw new Error('Web Serial API is not supported in this browser');
    }

    try {
        const port = await navigator.serial.requestPort();
        await port.open({ baudRate: 9600 });

        const encoder = new TextEncoder();
        const writer = port.writable.getWriter();

        // ESC/POS commands
        const ESC = '\x1B';
        const GS = '\x1D';
        const commands = [
            `${ESC}@`,                    // Initialize
            `${ESC}a\x01`,               // Center align
            `${ESC}!0x10`,               // Double height
            `${saleData.storeName || 'PosLX Store'}\n`,
            `${ESC}!0x00`,               // Normal
            `${saleData.storeAddress || 'Istanbul, Turkey'}\n`,
            `Tel: ${saleData.storePhone || '+90 212 000 0000'}\n`,
            `--------------------------------\n`,
            `${ESC}a\x00`,               // Left align
            `Fis No: #${saleData.receiptNo}\n`,
            `Tarih: ${new Date().toLocaleDateString('tr-TR')}\n`,
            `Odeme: ${saleData.paymentMethod === 'Cash' ? 'Nakit' : 'Kart'}\n`,
            `--------------------------------\n`,
        ];

        // Items
        for (const item of saleData.items) {
            const line = `${item.Name.substring(0, 18).padEnd(18)} ${String(item.qty).padStart(3)} ${('₺' + (item.SalePrice * item.qty).toFixed(2)).padStart(9)}\n`;
            commands.push(line);
        }

        commands.push(
            `--------------------------------\n`,
            `${'Ara Toplam:'.padEnd(22)}${('₺' + saleData.subtotal.toFixed(2)).padStart(10)}\n`,
            `${'KDV (%8):'.padEnd(22)}${('₺' + saleData.tax.toFixed(2)).padStart(10)}\n`,
            `${ESC}!0x10`,               // Double height
            `${'TOPLAM:'.padEnd(22)}${('₺' + saleData.total.toFixed(2)).padStart(10)}\n`,
            `${ESC}!0x00`,               // Normal
            `--------------------------------\n`,
            `${ESC}a\x01`,               // Center
            `Tesekkur ederiz!\n`,
            `Iade suresi: 7 gun\n\n\n`,
            `${GS}V\x41\x03`,           // Cut paper
        );

        for (const cmd of commands) {
            await writer.write(encoder.encode(cmd));
        }

        writer.releaseLock();
        await port.close();
        return true;
    } catch (err) {
        console.error('Serial print failed:', err);
        throw err;
    }
}
