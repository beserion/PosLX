import express from 'express';
import { ThermalPrinter, PrinterTypes, CharacterSet, BreakLine } from 'node-thermal-printer';
import { getDb } from '../config/db.js';
import sql from 'mssql';

const router = express.Router();

// Define a route to trigger printing

// Helper function to map Turkish characters to English equivalents
// Since some cheap thermal printers simply drop accents from WPC1254/PC857
const tr = (str) => {
    if (!str) return '';
    return String(str)
        .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
        .replace(/ü/g, 'u').replace(/Ü/g, 'U')
        .replace(/ş/g, 's').replace(/Ş/g, 'S')
        .replace(/ı/g, 'i').replace(/İ/g, 'I')
        .replace(/ö/g, 'o').replace(/Ö/g, 'O')
        .replace(/ç/g, 'c').replace(/Ç/g, 'C');
};

router.post('/', async (req, res) => {
    try {
        const saleData = req.body;

        if (!saleData || !saleData.items) {
            return res.status(400).json({ error: 'Sale data missing items' });
        }

        // Fetch user settings
        const pool = await getDb();
        const settings = {};
        if (pool) {
            const result = await pool.request().query('SELECT [key], [value] FROM system_settings');
            for (const r of result.recordset) settings[r.key] = r.value;
        }

        // Determine POS Printer Path
        let printerPath = '\\\\127.0.0.1\\POS80 Printer'; // Varsayılan
        if (settings.assignedPosPrinterId) {
            const printerRes = await pool.request()
                .input('id', sql.Int, parseInt(settings.assignedPosPrinterId))
                .query('SELECT Path FROM Printers WHERE ID = @id');
            if (printerRes.recordset.length > 0 && printerRes.recordset[0].Path) {
                printerPath = printerRes.recordset[0].Path;
            }
        }

        let printer = new ThermalPrinter({
            type: PrinterTypes.EPSON,
            interface: printerPath,
            characterSet: CharacterSet.WPC1254_TURKISH,
            removeSpecialCharacters: false,
            lineCharacter: "=",
            breakLine: BreakLine.WORD,
            width: 45, // Limit characters per line to avoid left/right margin clip on 80mm
            options: {
                timeout: 5000
            }
        });

        // Skip isConnected check for Windows UNC shares as it's unreliable
        printer.alignCenter();
        printer.println(tr(settings.storeName || saleData.storeName || 'PosLX Store'));
        printer.println(tr(settings.storeAddress || saleData.storeAddress || 'Istanbul, Turkey'));
        if (settings.storePhone || saleData.storePhone) {
            printer.println(tr(`Tel: ${settings.storePhone || saleData.storePhone}`));
        }
        printer.drawLine();
        if (settings.taxOffice || settings.taxNumber) {
            const tOffice = settings.taxOffice ? `${settings.taxOffice} V.D.` : '';
            const tNo = settings.taxNumber ? `VKN: ${settings.taxNumber}` : '';
            printer.println(tr(`${tOffice} ${tNo}`.trim()));
        }
        printer.drawLine();

        printer.alignLeft();
        printer.println(tr(`Fis No: #${saleData.receiptNo}`));
        printer.println(tr(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`));
        printer.println(tr(`Odeme: ${saleData.paymentMethod === 'Cash' ? 'Nakit' : 'Kart'}`));
        printer.drawLine();

        // Items Header - Fix column widths to prevent 'TL' from getting clipped
        // Left (Name): 0.45, Center (Qty): 0.15, Right (Total): 0.40
        printer.tableCustom([
            { text: tr("Urun"), align: "LEFT", width: 0.45 },
            { text: tr("Miktar"), align: "CENTER", width: 0.15 },
            { text: tr("Tutar"), align: "RIGHT", width: 0.40 }
        ]);
        printer.drawLine();

        for (const item of saleData.items) {
            // Also trim and normalize the item name
            const itemName = tr(item.Name).substring(0, 18);
            printer.tableCustom([
                { text: itemName, align: "LEFT", width: 0.45 },
                { text: String(item.qty), align: "CENTER", width: 0.15 },
                { text: (item.SalePrice * item.qty).toFixed(2) + " TL", align: "RIGHT", width: 0.40 }
            ]);
        }

        printer.drawLine();
        printer.tableCustom([
            { text: tr("Ara Toplam:"), align: "LEFT", width: 0.5 },
            { text: "", align: "CENTER", width: 0.1 },
            { text: saleData.subtotal.toFixed(2) + " TL", align: "RIGHT", width: 0.40 }
        ]);
        const taxRate = settings.taxRate || '8';
        printer.tableCustom([
            { text: tr(`KDV (%${taxRate}):`), align: "LEFT", width: 0.5 },
            { text: "", align: "CENTER", width: 0.1 },
            { text: saleData.tax.toFixed(2) + " TL", align: "RIGHT", width: 0.40 }
        ]);

        if (saleData.serviceFee > 0) {
            printer.tableCustom([
                { text: tr("Servis Ucreti:"), align: "LEFT", width: 0.5 },
                { text: "", align: "CENTER", width: 0.1 },
                { text: "+" + saleData.serviceFee.toFixed(2) + " TL", align: "RIGHT", width: 0.40 }
            ]);
        }

        if (saleData.discount > 0) {
            printer.tableCustom([
                { text: tr("Indirim:"), align: "LEFT", width: 0.5 },
                { text: "", align: "CENTER", width: 0.1 },
                { text: "-" + saleData.discount.toFixed(2) + " TL", align: "RIGHT", width: 0.40 }
            ]);
        }

        // Double height for total
        printer.setTextDoubleHeight();
        printer.setTextDoubleWidth();
        printer.tableCustom([
            { text: tr("TOPLAM:"), align: "LEFT", width: 0.5 },
            { text: saleData.total.toFixed(2) + " TL", align: "RIGHT", width: 0.5 }
        ]);
        printer.setTextNormal();
        printer.drawLine();

        printer.alignCenter();
        printer.println(tr("Mali Degeri Yoktur."));

        if (settings.footerText) {
            printer.println(tr(settings.footerText));
        } else {
            printer.println(tr("Bizi tercih ettiginiz icin\ntesekkur ederiz."));
        }

        printer.cut();

        await printer.execute();

        res.status(200).json({ success: true, message: 'Printed successfully' });
    } catch (error) {
        console.error("Print Error:", error);
        res.status(500).json({ error: 'Printing failed', details: error.message });
    }
});

export default router;
