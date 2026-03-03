import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve DB path — default to <server>/data/poslx.db
const dbDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const dbPath = process.env.DB_PATH || path.join(dbDir, 'poslx.db');

let db = null;

export function getDb() {
  if (!db) {
    try {
      db = new Database(dbPath);
      db.pragma('journal_mode = WAL');
      db.pragma('foreign_keys = ON');
      initSchema(db);
      console.log(`✅ SQLite connected: ${dbPath}`);
    } catch (err) {
      console.error('❌ SQLite connection failed:', err.message);
      db = null;
    }
  }
  return db;
}

// ── Schema + Seed ────────────────────────────────────────────
function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS Categories (
      ID        INTEGER PRIMARY KEY AUTOINCREMENT,
      Name      TEXT NOT NULL UNIQUE,
      CreatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS Products (
      ID            INTEGER PRIMARY KEY AUTOINCREMENT,
      Name          TEXT    NOT NULL,
      Stock         INTEGER NOT NULL DEFAULT 0,
      CostPrice     REAL    NOT NULL DEFAULT 0,
      SalePrice     REAL    NOT NULL DEFAULT 0,
      Category      TEXT,
      ImageURL      TEXT,
      CriticalStock INTEGER NOT NULL DEFAULT 5,
      ShelfLifeDays INTEGER,
      CostMethod    TEXT    NOT NULL DEFAULT 'WeightedAvg',
      CreatedAt     TEXT    NOT NULL DEFAULT (datetime('now')),
      IsDeleted     INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS ProductBarcodes (
      ID        INTEGER PRIMARY KEY AUTOINCREMENT,
      ProductID INTEGER NOT NULL,
      Barcode   TEXT    NOT NULL,
      FOREIGN KEY (ProductID) REFERENCES Products(ID) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS IX_ProductBarcodes_Barcode
      ON ProductBarcodes(Barcode);

    CREATE INDEX IF NOT EXISTS IX_ProductBarcodes_ProductID
      ON ProductBarcodes(ProductID);

    CREATE TABLE IF NOT EXISTS Accounts (
      ID        INTEGER PRIMARY KEY AUTOINCREMENT,
      Name      TEXT    NOT NULL,
      Type      TEXT    NOT NULL DEFAULT 'Müşteri',   -- Müşteri | Tedarikçi
      Phone     TEXT,
      Email     TEXT,
      Address   TEXT,
      TaxOffice TEXT,
      TaxNo     TEXT,
      Balance   REAL    NOT NULL DEFAULT 0,
      CreatedAt TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS AccountLedger (
      ID          INTEGER PRIMARY KEY AUTOINCREMENT,
      AccountID   INTEGER NOT NULL,
      Type        TEXT    NOT NULL DEFAULT 'Borç',   -- Borç | Alacak
      Amount      REAL    NOT NULL DEFAULT 0,
      Description TEXT,
      RefType     TEXT,       -- Sale | Invoice | Payment | Manual
      RefID       INTEGER,
      CreatedAt   TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (AccountID) REFERENCES Accounts(ID)
    );

    CREATE INDEX IF NOT EXISTS IX_AccountLedger_AccountID
      ON AccountLedger(AccountID);
    CREATE INDEX IF NOT EXISTS IX_AccountLedger_CreatedAt
      ON AccountLedger(CreatedAt);

    CREATE TABLE IF NOT EXISTS Sales (
      ID            INTEGER PRIMARY KEY AUTOINCREMENT,
      TotalAmount   REAL    NOT NULL DEFAULT 0,
      Tax           REAL    NOT NULL DEFAULT 0,
      Discount      REAL    NOT NULL DEFAULT 0,
      ServiceFee    REAL    NOT NULL DEFAULT 0,
      PaymentMethod TEXT    NOT NULL DEFAULT 'Cash',
      CourierID     INTEGER,
      AccountID     INTEGER,
      CreatedAt     TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS IX_Sales_AccountID ON Sales(AccountID);

    CREATE TABLE IF NOT EXISTS SaleItems (
      ID        INTEGER PRIMARY KEY AUTOINCREMENT,
      SaleID    INTEGER NOT NULL,
      ProductID INTEGER NOT NULL,
      Qty       INTEGER NOT NULL DEFAULT 1,
      UnitPrice REAL    NOT NULL DEFAULT 0,
      FOREIGN KEY (SaleID)    REFERENCES Sales(ID),
      FOREIGN KEY (ProductID) REFERENCES Products(ID)
    );

    CREATE TABLE IF NOT EXISTS Couriers (
      ID              INTEGER PRIMARY KEY AUTOINCREMENT,
      Name            TEXT    NOT NULL,
      Phone           TEXT,
      Status          TEXT    NOT NULL DEFAULT 'Idle',
      Lat             REAL,
      Lng             REAL,
      DailyDistanceKM REAL    NOT NULL DEFAULT 0,
      CreatedAt       TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS AccountTransactions (
      ID            INTEGER PRIMARY KEY AUTOINCREMENT,
      Type          TEXT    NOT NULL DEFAULT 'Sale',
      Amount        REAL    NOT NULL DEFAULT 0,
      Description   TEXT,
      Counterparty  TEXT,
      SaleID        INTEGER,
      InvoiceID     INTEGER,
      AccountID     INTEGER,
      PaymentMethod TEXT    NOT NULL DEFAULT 'Cash',
      CreatedAt     TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (SaleID) REFERENCES Sales(ID),
      FOREIGN KEY (AccountID) REFERENCES Accounts(ID)
    );

    CREATE INDEX IF NOT EXISTS IX_AccountTransactions_CreatedAt
      ON AccountTransactions(CreatedAt);
    CREATE INDEX IF NOT EXISTS IX_AccountTransactions_AccountID
      ON AccountTransactions(AccountID);

    CREATE TABLE IF NOT EXISTS Invoices (
      ID            INTEGER PRIMARY KEY AUTOINCREMENT,
      InvoiceNo     TEXT,
      Type          TEXT    NOT NULL DEFAULT 'Fatura',
      Counterparty  TEXT    NOT NULL,
      TotalAmount   REAL    NOT NULL DEFAULT 0,
      SubTotal      REAL    NOT NULL DEFAULT 0,
      TotalDiscount REAL    NOT NULL DEFAULT 0,
      TotalVat      REAL    NOT NULL DEFAULT 0,
      Description   TEXT,
      AccountID     INTEGER,
      CreatedAt     TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (AccountID) REFERENCES Accounts(ID)
    );

    CREATE TABLE IF NOT EXISTS InvoiceItems (
      ID            INTEGER PRIMARY KEY AUTOINCREMENT,
      InvoiceID     INTEGER NOT NULL,
      ProductID     INTEGER NOT NULL,
      Qty           INTEGER NOT NULL DEFAULT 1,
      UnitPrice     REAL    NOT NULL DEFAULT 0,
      VatRate       REAL    NOT NULL DEFAULT 0,
      VatType       TEXT    NOT NULL DEFAULT 'Hariç',
      Disc1         REAL    NOT NULL DEFAULT 0,
      Disc2         REAL    NOT NULL DEFAULT 0,
      Disc3         REAL    NOT NULL DEFAULT 0,
      RowTotal      REAL    NOT NULL DEFAULT 0,
      FOREIGN KEY (InvoiceID) REFERENCES Invoices(ID) ON DELETE CASCADE,
      FOREIGN KEY (ProductID) REFERENCES Products(ID)
    );

    CREATE TABLE IF NOT EXISTS CashRegisters (
      ID        INTEGER PRIMARY KEY AUTOINCREMENT,
      Name      TEXT    NOT NULL,
      Type      TEXT    NOT NULL DEFAULT 'Nakit',   -- Nakit | Banka | POS
      Balance   REAL    NOT NULL DEFAULT 0,
      CreatedAt TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS CashMovements (
      ID              INTEGER PRIMARY KEY AUTOINCREMENT,
      CashRegisterID  INTEGER NOT NULL,
      Type            TEXT    NOT NULL DEFAULT 'Giriş',  -- Giriş | Çıkış
      Amount          REAL    NOT NULL DEFAULT 0,
      Description     TEXT,
      RefType         TEXT,      -- Sale | Invoice | Expense | Manual
      RefID           INTEGER,
      CreatedAt       TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (CashRegisterID) REFERENCES CashRegisters(ID)
    );

    CREATE INDEX IF NOT EXISTS IX_CashMovements_RegisterID
      ON CashMovements(CashRegisterID);
    CREATE INDEX IF NOT EXISTS IX_CashMovements_CreatedAt
      ON CashMovements(CreatedAt);

    CREATE TABLE IF NOT EXISTS StockBatches (
      ID           INTEGER PRIMARY KEY AUTOINCREMENT,
      ProductID    INTEGER NOT NULL,
      Qty          INTEGER NOT NULL DEFAULT 0,
      RemainingQty INTEGER NOT NULL DEFAULT 0,
      UnitCost     REAL    NOT NULL DEFAULT 0,
      ExpiryDate   TEXT,
      InvoiceID    INTEGER,
      CreatedAt    TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (ProductID) REFERENCES Products(ID),
      FOREIGN KEY (InvoiceID) REFERENCES Invoices(ID)
    );

    CREATE INDEX IF NOT EXISTS IX_StockBatches_ProductID
      ON StockBatches(ProductID);

    CREATE TABLE IF NOT EXISTS PurchaseOrders (
      ID            INTEGER PRIMARY KEY AUTOINCREMENT,
      Counterparty  TEXT    NOT NULL,
      AccountID     INTEGER,
      Status        TEXT    NOT NULL DEFAULT 'Beklemede',  -- Beklemede | Teslim Alındı | İptal
      TotalAmount   REAL    NOT NULL DEFAULT 0,
      Description   TEXT,
      PaymentMethod TEXT    NOT NULL DEFAULT 'Cash',
      InvoiceID     INTEGER,
      CreatedAt     TEXT    NOT NULL DEFAULT (datetime('now')),
      ReceivedAt    TEXT,
      FOREIGN KEY (AccountID) REFERENCES Accounts(ID)
    );

    CREATE TABLE IF NOT EXISTS PurchaseOrderItems (
      ID              INTEGER PRIMARY KEY AUTOINCREMENT,
      PurchaseOrderID INTEGER NOT NULL,
      ProductID       INTEGER NOT NULL,
      Qty             INTEGER NOT NULL DEFAULT 1,
      UnitPrice       REAL    NOT NULL DEFAULT 0,
      FOREIGN KEY (PurchaseOrderID) REFERENCES PurchaseOrders(ID) ON DELETE CASCADE,
      FOREIGN KEY (ProductID) REFERENCES Products(ID)
    );

    CREATE INDEX IF NOT EXISTS IX_PurchaseOrders_Status
      ON PurchaseOrders(Status);

    CREATE TABLE IF NOT EXISTS CourierSettlements (
      ID             INTEGER PRIMARY KEY AUTOINCREMENT,
      CourierID      INTEGER NOT NULL,
      Date           TEXT    NOT NULL,
      CashDelivered  REAL    NOT NULL DEFAULT 0,
      Pos1Amount     REAL    NOT NULL DEFAULT 0,
      Pos2Amount     REAL    NOT NULL DEFAULT 0,
      Pos3Amount     REAL    NOT NULL DEFAULT 0,
      PosTotal       REAL    NOT NULL DEFAULT 0,
      Difference     REAL    NOT NULL DEFAULT 0,
      CourierPayment REAL    NOT NULL DEFAULT 0,
      Turnover       REAL    NOT NULL DEFAULT 0,
      SalesAmount    REAL    NOT NULL DEFAULT 0,
      ServiceAmount  REAL    NOT NULL DEFAULT 0,
      ServiceCount   INTEGER NOT NULL DEFAULT 0,
      CreatedAt      TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (CourierID) REFERENCES Couriers(ID)
    );

    CREATE INDEX IF NOT EXISTS IX_CourierSettlements_Date
      ON CourierSettlements(Date);

    CREATE INDEX IF NOT EXISTS IX_CourierSettlements_CourierID
      ON CourierSettlements(CourierID);

    CREATE TABLE IF NOT EXISTS system_settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS SpecialPrices (
      ID            INTEGER PRIMARY KEY AUTOINCREMENT,
      ProductID     INTEGER NOT NULL,
      AccountID     INTEGER,
      Name          TEXT,
      SpecialPrice  REAL    NOT NULL,
      StartDate     TEXT,
      EndDate       TEXT,
      IsActive      INTEGER NOT NULL DEFAULT 1,
      CreatedAt     TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (ProductID) REFERENCES Products(ID),
      FOREIGN KEY (AccountID) REFERENCES Accounts(ID)
    );

    CREATE INDEX IF NOT EXISTS IX_SpecialPrices_ProductID
      ON SpecialPrices(ProductID);

    CREATE INDEX IF NOT EXISTS IX_SpecialPrices_AccountID
      ON SpecialPrices(AccountID);

    CREATE TABLE IF NOT EXISTS PriceChanges (
      ID          INTEGER PRIMARY KEY AUTOINCREMENT,
      ProductID   INTEGER NOT NULL,
      OldPrice    REAL    NOT NULL,
      NewPrice    REAL    NOT NULL,
      ChangedAt   TEXT    NOT NULL DEFAULT (datetime('now')),
      Reason      TEXT,
      PerformedBy TEXT,
      FOREIGN KEY (ProductID) REFERENCES Products(ID)
    );

    CREATE TABLE IF NOT EXISTS Staff (
      ID        INTEGER PRIMARY KEY AUTOINCREMENT,
      Name      TEXT    NOT NULL,
      Role      TEXT    NOT NULL DEFAULT 'Cashier',
      Pin       TEXT    NOT NULL,
      IsActive  INTEGER NOT NULL DEFAULT 1,
      CreatedAt TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS CancellationLogs (
      ID        INTEGER PRIMARY KEY AUTOINCREMENT,
      RefType   TEXT    NOT NULL,              -- Sale | Invoice | Other
      RefID     INTEGER NOT NULL,
      Reason    TEXT,
      StaffID   INTEGER,
      CreatedAt TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (StaffID) REFERENCES Staff(ID)
    );
  `);

  // ── Safe ALTER TABLE for existing DBs that lack new columns ──
  const safeAddColumn = (table, column, def) => {
    try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`); } catch (_) { /* already exists */ }
  };
  safeAddColumn('Products', 'CriticalStock', 'INTEGER NOT NULL DEFAULT 5');
  safeAddColumn('Products', 'ShelfLifeDays', 'INTEGER');
  safeAddColumn('Products', 'CostMethod', "TEXT NOT NULL DEFAULT 'WeightedAvg'");
  safeAddColumn('Products', 'CostMethod', "TEXT NOT NULL DEFAULT 'WeightedAvg'");
  safeAddColumn('Products', 'IsDeleted', 'INTEGER NOT NULL DEFAULT 0');
  safeAddColumn('Products', 'ShowInPos', 'INTEGER NOT NULL DEFAULT 1');
  safeAddColumn('Sales', 'AccountID', 'INTEGER');
  safeAddColumn('Sales', 'ServiceFee', 'REAL NOT NULL DEFAULT 0');
  safeAddColumn('Invoices', 'AccountID', 'INTEGER');
  safeAddColumn('Invoices', 'SubTotal', 'REAL NOT NULL DEFAULT 0');
  safeAddColumn('Invoices', 'TotalDiscount', 'REAL NOT NULL DEFAULT 0');
  safeAddColumn('Invoices', 'TotalVat', 'REAL NOT NULL DEFAULT 0');
  safeAddColumn('Invoices', 'TaxOffice', 'TEXT');
  safeAddColumn('Invoices', 'TaxNumber', 'TEXT');
  safeAddColumn('Invoices', 'Address', 'TEXT');
  safeAddColumn('Invoices', 'Phone', 'TEXT');
  safeAddColumn('Invoices', 'WaybillNo', 'TEXT');
  safeAddColumn('Invoices', 'Carrier', 'TEXT');
  safeAddColumn('Invoices', 'PlateNo', 'TEXT');
  safeAddColumn('Invoices', 'InternalNote', 'TEXT');
  safeAddColumn('Invoices', 'ShipDate', 'TEXT');
  safeAddColumn('Invoices', 'PaymentDays', 'INTEGER');
  safeAddColumn('Invoices', 'IsOpen', 'INTEGER NOT NULL DEFAULT 1');
  safeAddColumn('InvoiceItems', 'VatRate', 'REAL NOT NULL DEFAULT 0');
  safeAddColumn('InvoiceItems', 'VatType', "TEXT NOT NULL DEFAULT 'Hariç'");
  safeAddColumn('InvoiceItems', 'Disc1', 'REAL NOT NULL DEFAULT 0');
  safeAddColumn('InvoiceItems', 'Disc2', 'REAL NOT NULL DEFAULT 0');
  safeAddColumn('InvoiceItems', 'Disc3', 'REAL NOT NULL DEFAULT 0');
  safeAddColumn('InvoiceItems', 'RowTotal', 'REAL NOT NULL DEFAULT 0');
  safeAddColumn('AccountTransactions', 'AccountID', 'INTEGER');

  // ── Seed data ──────────────────────────────────────────────

  // Default accounts
  const accCount = db.prepare('SELECT COUNT(*) AS cnt FROM Accounts').get();
  if (accCount.cnt === 0) {
    db.prepare(`INSERT INTO Accounts (Name, Type, Phone) VALUES ('Genel Müşteri', 'Müşteri', '-')`).run();
    db.prepare(`INSERT INTO Accounts (Name, Type, Phone) VALUES ('Genel Tedarikçi', 'Tedarikçi', '-')`).run();
  }

  // Default cash register
  const crCount = db.prepare('SELECT COUNT(*) AS cnt FROM CashRegisters').get();
  if (crCount.cnt === 0) {
    db.prepare(`INSERT INTO CashRegisters (Name, Type, Balance) VALUES ('Ana Kasa', 'Nakit', 0)`).run();
  }

  const catCount = db.prepare('SELECT COUNT(*) AS cnt FROM Categories').get();
  if (catCount.cnt === 0) {
    /* Test için yoruma alındı
    const insertCat = db.prepare('INSERT INTO Categories (Name) VALUES (?)');
    const seedCats = db.transaction((names) => {
      for (const n of names) insertCat.run(n);
    });
    seedCats(['Hot Drinks', 'Cold Drinks', 'Desserts', 'Pastry', 'Food']);
    */
  }

  const prodCount = db.prepare('SELECT COUNT(*) AS cnt FROM Products').get();
  if (prodCount.cnt === 0) {
    /* Test için yoruma alındı
    const insertProd = db.prepare(
      'INSERT INTO Products (Name, Stock, CostPrice, SalePrice, Category) VALUES (?, ?, ?, ?, ?)'
    );
    const insertBarcode = db.prepare(
      'INSERT INTO ProductBarcodes (ProductID, Barcode) VALUES (?, ?)'
    );

    const seedProducts = db.transaction(() => {
      const products = [
        ['Espresso', 120, 8, 25, 'Hot Drinks'],
        ['Americano', 95, 9, 28, 'Hot Drinks'],
        ['Latte', 80, 12, 35, 'Hot Drinks'],
        ['Cappuccino', 70, 12, 35, 'Hot Drinks'],
        ['Iced Tea', 150, 5, 18, 'Cold Drinks'],
        ['Fresh Orange Juice', 45, 15, 30, 'Cold Drinks'],
        ['Chocolate Cake', 30, 20, 45, 'Desserts'],
        ['Croissant', 60, 10, 22, 'Pastry'],
        ['Sandwich', 40, 18, 38, 'Food'],
        ['Mineral Water', 200, 2, 8, 'Cold Drinks'],
        ['Turkish Coffee', 90, 10, 20, 'Hot Drinks'],
        ['Tiramisu', 25, 22, 48, 'Desserts'],
      ];

      const barcodes = [
        [1, '8690000001'], [1, '8690000001A'],
        [2, '8690000002'],
        [3, '8690000003'], [3, '8690000003A'],
        [4, '8690000004'],
        [5, '8690000005'],
        [6, '8690000006'],
        [7, '8690000007'],
        [8, '8690000008'],
        [9, '8690000009'],
        [10, '8690000010'],
        [11, '8690000011'],
        [12, '8690000012'],
      ];

      for (const p of products) insertProd.run(...p);
      for (const b of barcodes) insertBarcode.run(...b);
    });
    seedProducts();
    */
  }

  const courierCount = db.prepare('SELECT COUNT(*) AS cnt FROM Couriers').get();
  if (courierCount.cnt === 0) {
    /* Test için yoruma alındı
    const insertCourier = db.prepare(
      'INSERT INTO Couriers (Name, Phone, Status, Lat, Lng, DailyDistanceKM) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const seedCouriers = db.transaction(() => {
      const couriers = [
        ['Ahmet Yılmaz', '+90 532 111 2233', 'Delivering', 41.0082, 28.9784, 14.3],
        ['Mehmet Demir', '+90 535 222 3344', 'Idle', 41.0135, 28.9553, 7.1],
        ['Ayşe Kaya', '+90 538 333 4455', 'Delivering', 41.0251, 29.0130, 22.6],
        ['Fatma Çelik', '+90 541 444 5566', 'Offline', 40.9923, 28.8950, 0],
        ['Ali Öztürk', '+90 544 555 6677', 'Delivering', 41.0390, 28.9860, 18.9],
      ];
      for (const c of couriers) insertCourier.run(...c);
    });
    seedCouriers();
    */
  }

  // Cleanup: remove barcodes of soft-deleted products so they can be reused
  try {
    db.exec(`DELETE FROM ProductBarcodes WHERE ProductID IN (SELECT ID FROM Products WHERE IFNULL(IsDeleted, 0) = 1)`);
  } catch (_) {
    // ignore
  }

  // Seed courier_api_token if not present
  const tokenRow = db.prepare("SELECT value FROM system_settings WHERE key = 'courier_api_token'").get();
  if (!tokenRow) {
    const token = crypto.randomUUID();
    db.prepare("INSERT INTO system_settings (key, value) VALUES ('courier_api_token', ?)").run(token);
    console.log(`🔑 Generated courier API token: ${token}`);
  }
}

export default getDb;
