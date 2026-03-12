import sql from 'mssql';
import { getDb } from '../config/db.js';

const mockStaff = [
    { Name: 'Yönetici', Role: 'Owner', Pin: '9999' },
    { Name: 'Kasap Ahmet', Role: 'Cashier', Pin: '1111' },
    { Name: 'Şef Mehmet', Role: 'Manager', Pin: '2222' }
];

const mockCategories = [
    { Name: 'Sıcak İçecekler' },
    { Name: 'Soğuk İçecekler' },
    { Name: 'Tatlılar' },
    { Name: 'Sandviçler' },
    { Name: 'Hammadde' }
];

const mockAccounts = [
    { Name: 'Genel Müşteri', Type: 'Müşteri', Phone: '5551234567', Balance: 0 },
    { Name: 'Toptancı A.Ş.', Type: 'Tedarikçi', Phone: '5559876543', Balance: 5000 },
    { Name: 'Ahmet Bey', Type: 'Cari', Phone: '5551112233', Balance: -150 }
];

const mockCouriers = [
    { Name: 'Ali Kurye', Phone: '5550001122', Status: 'Idle' },
    { Name: 'Veli Kurye', Phone: '5553334455', Status: 'Delivering' }
];

const mockCashRegisters = [
    { Name: 'Ana Kasa', Type: 'Nakit', Balance: 15400.50 },
    { Name: 'Kredi Kartı 1', Type: 'Banka', Balance: 8500.00 }
];

// Define products separately so we can get their inserted IDs for barcodes & inventory later
const mockProducts = [
    { Name: 'Filtre Kahve', Stock: 150, CostPrice: 5.5, SalePrice: 45, Category: 'Sıcak İçecekler', isIngredient: false },
    { Name: 'Caffe Latte', Stock: 100, CostPrice: 8, SalePrice: 65, Category: 'Sıcak İçecekler', isIngredient: false },
    { Name: 'Soğuk Çay', Stock: 50, CostPrice: 4, SalePrice: 35, Category: 'Soğuk İçecekler', isIngredient: false },
    { Name: 'Cheesecake', Stock: 24, CostPrice: 20, SalePrice: 90, Category: 'Tatlılar', isIngredient: false },
    { Name: 'Kahve Çekirdeği (1KG)', Stock: 50, CostPrice: 250, SalePrice: 400, Category: 'Hammadde', isIngredient: true },
    { Name: 'Süt (1L)', Stock: 200, CostPrice: 15, SalePrice: 25, Category: 'Hammadde', isIngredient: true }
];

async function seedMSSQL() {
    try {
        console.log("Bağlanılıyor...");
        const pool = await getDb();
        if (!pool) throw new Error("Database not connected");

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            console.log("Taban verileri temizleniyor...");
            // Clean up existing data to safely re-seed
            await transaction.request().query(`
                EXEC sp_MSForEachTable 'ALTER TABLE ? NOCHECK CONSTRAINT ALL'
                EXEC sp_MSForEachTable 'DELETE FROM ?'
                EXEC sp_MSForEachTable 'IF OBJECTPROPERTY(object_id(''?''), ''TableHasIdentity'') = 1 DBCC CHECKIDENT (''?'', RESEED, 0)'
                EXEC sp_MSForEachTable 'ALTER TABLE ? WITH CHECK CHECK CONSTRAINT ALL'
            `);

            console.log("Kategoriler ekleniyor...");
            for (const cat of mockCategories) {
                await transaction.request()
                    .input('Name', sql.NVarChar, cat.Name)
                    .query('INSERT INTO Categories (Name) VALUES (@Name)');
            }

            console.log("Personeller ekleniyor...");
            for (const staff of mockStaff) {
                await transaction.request()
                    .input('Name', sql.NVarChar, staff.Name)
                    .input('Role', sql.NVarChar, staff.Role)
                    .input('Pin', sql.NVarChar, staff.Pin)
                    .query('INSERT INTO Staff (Name, Role, Pin) VALUES (@Name, @Role, @Pin)');
            }

            console.log("Hesaplar ekleniyor...");
            for (const acc of mockAccounts) {
                await transaction.request()
                    .input('Name', sql.NVarChar, acc.Name)
                    .input('Type', sql.NVarChar, acc.Type)
                    .input('Phone', sql.NVarChar, acc.Phone)
                    .input('Balance', sql.Float, acc.Balance)
                    .query('INSERT INTO Accounts (Name, Type, Phone, Balance) VALUES (@Name, @Type, @Phone, @Balance)');
            }

            console.log("Kuryeler ve Kasalar ekleniyor...");
            for (const c of mockCouriers) {
                await transaction.request()
                    .input('Name', sql.NVarChar, c.Name)
                    .input('Phone', sql.NVarChar, c.Phone)
                    .input('Status', sql.NVarChar, c.Status)
                    .query('INSERT INTO Couriers (Name, Phone, Status) VALUES (@Name, @Phone, @Status)');
            }

            for (const c of mockCashRegisters) {
                await transaction.request()
                    .input('Name', sql.NVarChar, c.Name)
                    .input('Type', sql.NVarChar, c.Type)
                    .input('Balance', sql.Float, c.Balance)
                    .query('INSERT INTO CashRegisters (Name, Type, Balance) VALUES (@Name, @Type, @Balance)');
            }

            console.log("Ürünler ekleniyor...");
            for (const p of mockProducts) {
                const isIngredientType = p.isIngredient ? 1 : 0;
                const result = await transaction.request()
                    .input('Name', sql.NVarChar, p.Name)
                    .input('Stock', sql.Float, p.Stock)
                    .input('CostPrice', sql.Float, p.CostPrice)
                    .input('SalePrice', sql.Float, p.SalePrice)
                    .input('Category', sql.NVarChar, p.Category)
                    .input('isIngredient', sql.Bit, isIngredientType)
                    .query('INSERT INTO Products (Name, Stock, CostPrice, SalePrice, Category, isIngredient) OUTPUT INSERTED.ID VALUES (@Name, @Stock, @CostPrice, @SalePrice, @Category, @isIngredient)');

                const productId = result.recordset[0].ID;

                // Barkod Ekle
                await transaction.request()
                    .input('ProductID', sql.Int, productId)
                    .input('Barcode', sql.NVarChar, '869000' + productId)
                    .query('INSERT INTO ProductBarcodes (ProductID, Barcode) VALUES (@ProductID, @Barcode)');
            }

            console.log("Demo Satışlar oluşturuluyor...");
            for (let i = 0; i < 5; i++) {
                const saleResult = await transaction.request()
                    .input('TotalAmount', sql.Float, 110)
                    .input('PaymentMethod', sql.NVarChar, 'Cash')
                    .query("INSERT INTO Sales (TotalAmount, PaymentMethod) OUTPUT INSERTED.ID VALUES (@TotalAmount, @PaymentMethod)");

                const saleId = saleResult.recordset[0].ID;

                await transaction.request()
                    .input('SaleID', sql.Int, saleId)
                    .input('ProductID', sql.Int, 1) // Filtre Kahve
                    .input('Qty', sql.Float, 1)
                    .input('UnitPrice', sql.Float, 45)
                    .query('INSERT INTO SaleItems (SaleID, ProductID, Qty, UnitPrice) VALUES (@SaleID, @ProductID, @Qty, @UnitPrice)');

                await transaction.request()
                    .input('SaleID', sql.Int, saleId)
                    .input('ProductID', sql.Int, 2) // Caffe Latte
                    .input('Qty', sql.Float, 1)
                    .input('UnitPrice', sql.Float, 65)
                    .query('INSERT INTO SaleItems (SaleID, ProductID, Qty, UnitPrice) VALUES (@SaleID, @ProductID, @Qty, @UnitPrice)');

                // Hesap Hareketi
                await transaction.request()
                    .input('Amount', sql.Float, 110)
                    .input('Description', sql.NVarChar, 'Satış #' + saleId)
                    .input('SaleID', sql.Int, saleId)
                    .query("INSERT INTO AccountTransactions (Type, Amount, Description, SaleID) VALUES ('Sale', @Amount, @Description, @SaleID)");
            }

            console.log("Demo Faturalar oluşturuluyor...");
            const invoiceResult = await transaction.request()
                .input('Counterparty', sql.NVarChar, 'Toptancı A.Ş.')
                .input('TotalAmount', sql.Float, 1500)
                .input('Type', sql.NVarChar, 'Alış Faturası')
                .input('AccountID', sql.Int, 2)
                .query("INSERT INTO Invoices (Counterparty, TotalAmount, Type, AccountID) OUTPUT INSERTED.ID VALUES (@Counterparty, @TotalAmount, @Type, @AccountID)");

            const invoiceId = invoiceResult.recordset[0].ID;

            await transaction.request()
                .input('InvoiceID', sql.Int, invoiceId)
                .input('ProductID', sql.Int, 5) // Kahve Çekirdeği
                .input('Qty', sql.Float, 6)
                .input('UnitPrice', sql.Float, 250)
                .query('INSERT INTO InvoiceItems (InvoiceID, ProductID, Qty, UnitPrice) VALUES (@InvoiceID, @ProductID, @Qty, @UnitPrice)');

            await transaction.request()
                .input('AccountID', sql.Int, 2)
                .input('TotalAmount', sql.Float, 1500)
                .input('Description', sql.NVarChar, 'Alış Faturası #' + invoiceId)
                .input('InvoiceID', sql.Int, invoiceId)
                .query("INSERT INTO AccountLedger (AccountID, Type, Amount, Description, RefType, RefID) VALUES (@AccountID, 'Alacak', @TotalAmount, @Description, 'Invoice', @InvoiceID)");

            await transaction.commit();
            console.log("✅ Tüm demo veriler MSSQL'e başarıyla eklendi.");
            process.exit(0);

        } catch (err) {
            await transaction.rollback();
            console.error("❌ Hata oluştu, işlem geri alınıyor.", err);
            process.exit(1);
        }
    } catch (err) {
        console.error("Veritabanına bağlanılamadı:", err);
        process.exit(1);
    }
}

seedMSSQL();
