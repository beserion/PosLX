import { Router } from 'express';
import { getDb } from '../config/db.js';
import sql from 'mssql';

const router = Router();

// ── GET /api/invoices — paginated invoice list ──
router.get('/', async (req, res) => {
    try {
        const pool = await getDb();
        if (!pool) {
            if (process.env.USE_MOCK_DATA === 'true') {
                return res.json(getMockInvoices());
            }
            return res.status(503).json({ error: 'Database not available' });
        }

        const page     = Math.max(1, parseInt(req.query.page)     || 1);
        const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize) || 50));
        const search   = (req.query.search || '').trim();
        const type     = (req.query.type   || '').trim();
        const offset   = (page - 1) * pageSize;

        const request = pool.request()
            .input('search',   sql.NVarChar, search ? `%${search}%` : null)
            .input('type',     sql.NVarChar, type   || null)
            .input('pageSize', sql.Int, pageSize)
            .input('offset',   sql.Int, offset);

        const whereClause = `
            WHERE (@search IS NULL OR InvoiceNo LIKE @search OR Counterparty LIKE @search)
              AND (@type   IS NULL OR Type = @type)
        `;

        const countResult = await request.query(
            `SELECT COUNT(*) AS Total FROM Invoices ${whereClause}`
        );
        const total = countResult.recordset[0].Total;

        const dataResult = await request.query(`
            SELECT ID, InvoiceNo, Type, Counterparty, TotalAmount, SubTotal, TotalDiscount,
                   TotalVat, AccountID, IsOpen, PaymentDays, WaybillNo, CreatedAt
            FROM Invoices
            ${whereClause}
            ORDER BY CreatedAt DESC
            OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
        `);

        res.json({ data: dataResult.recordset, total, page, pageSize });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/invoices/:id — single invoice with items ──
router.get('/:id', async (req, res) => {
    try {
        const pool = await getDb();
        if (!pool) return res.status(503).json({ error: 'Database not available' });

        const invoiceResult = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('SELECT * FROM Invoices WHERE ID = @id');

        if (invoiceResult.recordset.length === 0) return res.status(404).json({ error: 'Invoice not found' });
        const invoice = invoiceResult.recordset[0];

        const itemsResult = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query(`
            SELECT ii.*, p.Name AS ProductName
            FROM InvoiceItems ii
            JOIN Products p ON p.ID = ii.ProductID
            WHERE ii.InvoiceID = @id
        `);

        res.json({ ...invoice, items: itemsResult.recordset });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/invoices — create invoice + update stock + log transaction + update ledger ──
router.post('/', async (req, res) => {
    try {
        const {
            InvoiceNo, Type, Counterparty, Description, PaymentMethod, items,
            ShipDate, PaymentDays, IsOpen, TaxOffice, TaxNumber, Address, Phone,
            WaybillNo, Carrier, PlateNo, InternalNote,
            GrandTotal, SubTotal, TotalDiscount, TotalVat
        } = req.body;

        if (!Counterparty || !items || items.length === 0) {
            return res.status(400).json({ error: 'Counterparty and items are required' });
        }

        const pool = await getDb();
        if (!pool) return res.status(503).json({ error: 'Database not available' });

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        let invoiceID;
        let totalAmount;
        try {
            totalAmount = GrandTotal !== undefined ? GrandTotal : items.reduce((sum, i) => sum + (i.Qty * i.UnitPrice), 0);

            // Find account by name
            const reqAccount = new sql.Request(transaction);
            const accountResult = await reqAccount
                .input('Counterparty', sql.NVarChar, Counterparty)
                .query('SELECT * FROM Accounts WHERE Name = @Counterparty');
            const accountID = accountResult.recordset.length > 0 ? accountResult.recordset[0].ID : null;

            // Insert invoice with AccountID and new fields
            const reqInvoice = new sql.Request(transaction);
            const accountIdType = accountID ? sql.Int : sql.Int;
            const insertResult = await reqInvoice
                .input('InvoiceNo', sql.NVarChar, InvoiceNo || null)
                .input('Type', sql.NVarChar, Type || 'Fatura')
                .input('Counterparty', sql.NVarChar, Counterparty)
                .input('TotalAmount', sql.Float, totalAmount)
                .input('SubTotal', sql.Float, SubTotal || 0)
                .input('TotalDiscount', sql.Float, TotalDiscount || 0)
                .input('TotalVat', sql.Float, TotalVat || 0)
                .input('Description', sql.NVarChar, Description || null)
                .input('AccountID', accountIdType, accountID)
                .input('ShipDate', sql.DateTime, ShipDate ? new Date(ShipDate) : null)
                .input('PaymentDays', sql.Int, PaymentDays || 0)
                .input('IsOpen', sql.Int, IsOpen === false ? 0 : 1)
                .input('TaxOffice', sql.NVarChar, TaxOffice || null)
                .input('TaxNumber', sql.NVarChar, TaxNumber || null)
                .input('Address', sql.NVarChar, Address || null)
                .input('Phone', sql.NVarChar, Phone || null)
                .input('WaybillNo', sql.NVarChar, WaybillNo || null)
                .input('Carrier', sql.NVarChar, Carrier || null)
                .input('PlateNo', sql.NVarChar, PlateNo || null)
                .input('InternalNote', sql.NVarChar, InternalNote || null)
                .query(`
                    INSERT INTO Invoices (
                        InvoiceNo, Type, Counterparty, TotalAmount, SubTotal, TotalDiscount, TotalVat, Description, AccountID,
                        ShipDate, PaymentDays, IsOpen, TaxOffice, TaxNumber, Address, Phone,
                        WaybillNo, Carrier, PlateNo, InternalNote
                     ) 
                     OUTPUT INSERTED.ID
                     VALUES (@InvoiceNo, @Type, @Counterparty, @TotalAmount, @SubTotal, @TotalDiscount, @TotalVat, @Description, @AccountID, 
                     @ShipDate, @PaymentDays, @IsOpen, @TaxOffice, @TaxNumber, @Address, @Phone, 
                     @WaybillNo, @Carrier, @PlateNo, @InternalNote)
                `);
            invoiceID = insertResult.recordset[0].ID;

            let stockMultiplier = 1;
            let txnType = 'Purchase';
            let txnAmountMultiplier = -1; // Cash impact (e.g. Purchase reduces cash if paid from till/bank)
            let ledgerType = 'Alacak'; // Bizim borcumuz, tedarikçinin alacağı
            let balanceMultiplier = 1; // Pozitif bakiye = Borcumuz/Alacağımız artar

            // Satış -> Stok düşer, kasa girişi olur (+), müşterinin bize borcu artar (Borç)
            if (Type === 'Satış Faturası') {
                stockMultiplier = -1;
                txnType = 'Sale';
                txnAmountMultiplier = 1;
                ledgerType = 'Borç';
                balanceMultiplier = 1;
            }
            // Satış İade -> Stok artar, kasa çıkışı olur (-), müşterinin borcu azalır (Alacak)
            else if (Type === 'Satış İade') {
                stockMultiplier = 1;
                txnType = 'Sale Return';
                txnAmountMultiplier = -1;
                ledgerType = 'Alacak';
                balanceMultiplier = -1;
            }
            // Alış İade -> Stok düşer, kasa girişi gibi etki (+), tedarikçiye borcumuz azalır (Borç)
            else if (Type === 'Alış İade') {
                stockMultiplier = -1;
                txnType = 'Purchase Return';
                txnAmountMultiplier = 1;
                ledgerType = 'Borç';
                balanceMultiplier = -1;
            }
            // İrsaliye -> Yalnızca Stok hareketi
            else if (Type === 'İrsaliye') {
                stockMultiplier = -1; // Çıkış irsaliyesi varsayımı
            }

            // Insert items + update stock
            for (const item of items) {
                const reqItem = new sql.Request(transaction);
                await reqItem
                    .input('InvoiceID', sql.Int, invoiceID)
                    .input('ProductID', sql.Int, item.ProductID)
                    .input('Qty', sql.Float, item.Qty)
                    .input('UnitPrice', sql.Float, item.UnitPrice)
                    .input('VatRate', sql.Float, item.VatRate || 0)
                    .input('VatType', sql.NVarChar, item.VatType || 'Hariç')
                    .input('Disc1', sql.Float, item.Disc1 || 0)
                    .input('Disc2', sql.Float, item.Disc2 || 0)
                    .input('Disc3', sql.Float, item.Disc3 || 0)
                    .input('RowTotal', sql.Float, item.RowTotal || 0)
                    .query(`
                        INSERT INTO InvoiceItems (
                            InvoiceID, ProductID, Qty, UnitPrice,
                            VatRate, VatType, Disc1, Disc2, Disc3, RowTotal
                        ) VALUES (@InvoiceID, @ProductID, @Qty, @UnitPrice, @VatRate, @VatType, @Disc1, @Disc2, @Disc3, @RowTotal)
                    `);

                const reqStock = new sql.Request(transaction);
                await reqStock
                    .input('qtyChange', sql.Float, item.Qty * stockMultiplier)
                    .input('ProductID', sql.Int, item.ProductID)
                    .query('UPDATE Products SET Stock = Stock + @qtyChange WHERE ID = @ProductID');
            }

            // Account transaction
            if (Type !== 'İrsaliye') {
                const reqAccTx = new sql.Request(transaction);
                await reqAccTx
                    .input('txnType', sql.NVarChar, txnType)
                    .input('amount', sql.Float, totalAmount * txnAmountMultiplier)
                    .input('description', sql.NVarChar, Type + ' #' + (InvoiceNo || invoiceID) + ' — ' + Counterparty)
                    .input('Counterparty', sql.NVarChar, Counterparty)
                    .input('InvoiceID', sql.Int, invoiceID)
                    .input('AccountID', accountIdType, accountID)
                    .input('PaymentMethod', sql.NVarChar, PaymentMethod || 'Cash')
                    .query(`
                        INSERT INTO AccountTransactions(Type, Amount, Description, Counterparty, InvoiceID, AccountID, PaymentMethod)
                        VALUES(@txnType, @amount, @description, @Counterparty, @InvoiceID, @AccountID, @PaymentMethod)
                            `);

                // Cari hareket
                if (accountID) {
                    const reqLedger = new sql.Request(transaction);
                    await reqLedger
                        .input('AccountID', sql.Int, accountID)
                        .input('ledgerType', sql.NVarChar, ledgerType)
                        .input('totalAmount', sql.Float, totalAmount)
                        .input('description', sql.NVarChar, Type + ' #' + (InvoiceNo || invoiceID))
                        .input('InvoiceID', sql.Int, invoiceID)
                        .query(`
                            INSERT INTO AccountLedger(AccountID, Type, Amount, Description, RefType, RefID)
                            VALUES(@AccountID, @ledgerType, @totalAmount, @description, 'Invoice', @InvoiceID)
                            `);

                    const reqBalance = new sql.Request(transaction);
                    await reqBalance
                        .input('balanceChange', sql.Float, totalAmount * balanceMultiplier)
                        .input('AccountID', sql.Int, accountID)
                        .query('UPDATE Accounts SET Balance = Balance + @balanceChange WHERE ID = @AccountID');
                }
            }

            await transaction.commit();
        } catch (txErr) {
            console.error('Invoice Creation Error:', txErr);
            try {
                await transaction.rollback();
            } catch (rollbackErr) {
                console.error('Rollback failed:', rollbackErr.message);
            }
            throw txErr;
        }

        const invoiceResult = await pool.request()
            .input('id', sql.Int, invoiceID)
            .query('SELECT * FROM Invoices WHERE ID = @id');
        res.status(201).json(invoiceResult.recordset[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── DELETE /api/invoices/:id ──
router.delete('/:id', async (req, res) => {
    try {
        const pool = await getDb();
        if (!pool) return res.status(503).json({ error: 'Database not available' });

        const invoiceResult = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('SELECT * FROM Invoices WHERE ID = @id');
        if (invoiceResult.recordset.length === 0) return res.status(404).json({ error: 'Invoice not found' });
        const invoice = invoiceResult.recordset[0];

        const itemsResult = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('SELECT * FROM InvoiceItems WHERE InvoiceID = @id');
        const items = itemsResult.recordset;

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            let stockMultiplier = 1;
            let balanceMultiplier = 1;

            if (invoice.Type === 'Satış Faturası') {
                stockMultiplier = -1;
                balanceMultiplier = 1;
            } else if (invoice.Type === 'Satış İade') {
                stockMultiplier = 1;
                balanceMultiplier = -1;
            } else if (invoice.Type === 'Alış İade') {
                stockMultiplier = -1;
                balanceMultiplier = -1;
            } else if (invoice.Type === 'İrsaliye') {
                stockMultiplier = -1;
            }

            // Reverse stock
            for (const item of items) {
                const reqStock = new sql.Request(transaction);
                await reqStock
                    .input('qtyChange', sql.Float, item.Qty * stockMultiplier)
                    .input('ProductID', sql.Int, item.ProductID)
                    .query('UPDATE Products SET Stock = Stock - @qtyChange WHERE ID = @ProductID');
            }

            // Reverse cari ledger + balance
            if (invoice.AccountID && invoice.Type !== 'İrsaliye') {
                const reqLedger = new sql.Request(transaction);
                await reqLedger
                    .input('id', sql.Int, req.params.id)
                    .input('AccountID', sql.Int, invoice.AccountID)
                    .query("DELETE FROM AccountLedger WHERE RefType = 'Invoice' AND RefID = @id AND AccountID = @AccountID");

                const reqBalance = new sql.Request(transaction);
                await reqBalance
                    .input('balanceChange', sql.Float, invoice.TotalAmount * balanceMultiplier)
                    .input('AccountID', sql.Int, invoice.AccountID)
                    .query('UPDATE Accounts SET Balance = Balance - @balanceChange WHERE ID = @AccountID');
            }

            const reqDelTx = new sql.Request(transaction);
            await reqDelTx
                .input('id', sql.Int, req.params.id)
                .query('DELETE FROM AccountTransactions WHERE InvoiceID = @id');

            const reqDelItems = new sql.Request(transaction);
            await reqDelItems
                .input('id', sql.Int, req.params.id)
                .query('DELETE FROM InvoiceItems WHERE InvoiceID = @id');

            const reqDelInv = new sql.Request(transaction);
            await reqDelInv
                .input('id', sql.Int, req.params.id)
                .query('DELETE FROM Invoices WHERE ID = @id');

            // Cancellation log
            const reason = req.body?.reason || null;
            const staffId = req.body?.staffId || null;
            const reqLog = new sql.Request(transaction);
            const staffIdType = staffId ? sql.Int : sql.Int;
            await reqLog
                .input('id', sql.Int, req.params.id)
                .input('reason', sql.NVarChar, reason)
                .input('staffId', staffIdType, staffId)
                .query(`
                    INSERT INTO CancellationLogs(RefType, RefID, Reason, StaffID)
                    VALUES('Invoice', @id, @reason, @staffId)
                            `);

            await transaction.commit();
        } catch (txErr) {
            await transaction.rollback();
            throw txErr;
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Mock data ──
function getMockInvoices() {
    const today = new Date().toISOString().slice(0, 10);
    return [
        { ID: 1, InvoiceNo: 'F-001', Type: 'Fatura', Counterparty: 'ABC Tedarik', TotalAmount: 850, Description: 'Aylık malzeme', ItemsSummary: 'Espresso x50, Latte x30', CreatedAt: `${today} 10:00:00` },
        { ID: 2, InvoiceNo: 'I-002', Type: 'İrsaliye', Counterparty: 'XYZ Dağıtım', TotalAmount: 420, Description: 'Haftalık dağıtım', ItemsSummary: 'Croissant x100, Sandwich x50', CreatedAt: `${today} 14:00:00` },
    ];
}

export default router;
