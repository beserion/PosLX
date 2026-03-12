import sql from 'mssql';
import crypto from 'crypto';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

// Harici config.json okuma (Önce CWD'ye, yoksa .exe'nin bulunduğu klasöre bakar)
let externalConfig = {};
try {
  let configPath = path.join(process.cwd(), 'config.json');
  if (!fs.existsSync(configPath) && process.execPath) {
    configPath = path.join(path.dirname(process.execPath), 'config.json');
  }

  if (fs.existsSync(configPath)) {
    externalConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log(`📂 Harici config.json yapılandırması yüklendi.`);
  }
} catch (err) {
  console.warn('⚠️ config.json okunamadı veya JSON hatalı:', err.message);
}

// Ortam değişkenini veya config.json'ı okuyan yardımcı fonksiyon (Öncelik config.json'da)
const getEnvOrConfig = (key) => externalConfig[key] || process.env[key];

// Parse server\instance format
const rawServer = getEnvOrConfig('DB_SERVER') || 'localhost';
const serverParts = rawServer.split('\\');
const serverHost = serverParts[0];
const instanceName = serverParts.length > 1 ? serverParts[1] : undefined;

const config = {
  user: getEnvOrConfig('DB_USER') || 'sa',
  password: getEnvOrConfig('DB_PASS') || 'YourPassword123!',
  server: serverHost,
  database: getEnvOrConfig('DB_NAME') || 'poslx',
  ...(instanceName ? {} : { port: parseInt(getEnvOrConfig('DB_PORT')) || 1433 }),
  options: {
    encrypt: String(getEnvOrConfig('DB_ENCRYPT')) === 'true',
    trustServerCertificate: String(getEnvOrConfig('DB_TRUST_SERVER_CERTIFICATE')) !== 'false',
    enableArithAbort: true,
    ...(instanceName ? { instanceName } : {})
  }
};

// Cloud DB Config
const rawCloudServer = getEnvOrConfig('CLOUD_DB_SERVER');
let cloudServerHost = undefined;
let cloudInstanceName = undefined;
if (rawCloudServer) {
  const cloudServerParts = rawCloudServer.split('\\');
  cloudServerHost = cloudServerParts[0];
  cloudInstanceName = cloudServerParts.length > 1 ? cloudServerParts[1] : undefined;
}

const cloudConfig = rawCloudServer ? {
  user: getEnvOrConfig('CLOUD_DB_USER'),
  password: getEnvOrConfig('CLOUD_DB_PASS'),
  server: cloudServerHost,
  database: getEnvOrConfig('CLOUD_DB_NAME'),
  ...(cloudInstanceName ? {} : { port: parseInt(getEnvOrConfig('CLOUD_DB_PORT')) || 1433 }),
  options: {
    encrypt: String(getEnvOrConfig('CLOUD_DB_ENCRYPT')) === 'true',
    trustServerCertificate: String(getEnvOrConfig('CLOUD_DB_TRUST_SERVER_CERTIFICATE')) !== 'false',
    enableArithAbort: true,
    ...(cloudInstanceName ? { instanceName: cloudInstanceName } : {})
  }
} : null;

let poolPromise = null;
let cloudPoolPromise = null;

export async function getDb() {
  if (!poolPromise) {
    poolPromise = sql.connect(config)
      .then(async pool => {
        console.log(`✅ Local MSSQL connected: ${config.server}/${config.database}`);
        await initSchema(pool);
        return pool;
      })
      .catch(err => {
        console.error('❌ Local MSSQL connection failed:', err.message);
        poolPromise = null;
        throw err;
      });
  }
  return poolPromise;
}

export async function getCloudDb() {
  if (!cloudConfig) return null;
  if (!cloudPoolPromise) {
    cloudPoolPromise = sql.connect(cloudConfig)
      .then(async pool => {
        console.log(`☁️ Cloud MSSQL connected: ${cloudConfig.server}/${cloudConfig.database}`);
        await initSchema(pool);
        return pool;
      })
      .catch(err => {
        console.error('❌ Cloud MSSQL connection failed:', err.message);
        cloudPoolPromise = null;
        return null; // Don't crash local server if cloud is down
      });
  }
  return cloudPoolPromise;
}

// ── Schema + Seed ────────────────────────────────────────────
async function initSchema(pool) {
  const request = pool.request();

  // Helper macro to run query and ignore "already exists" errors
  const tryExec = async (query) => {
    try {
      await pool.request().query(query);
    } catch (err) {
      if (err.message.includes('already an object named') || err.message.includes('already exists')) {
        // Ignore table/index already exists
      } else {
        console.warn(`Schema init warning: ${err.message}`);
      }
    }
  };

  const createTables = `
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Categories' AND xtype='U')
    CREATE TABLE Categories (
      ID        INT IDENTITY(1,1) PRIMARY KEY,
      Name      NVARCHAR(255) NOT NULL UNIQUE,
      CreatedAt DATETIME NOT NULL DEFAULT GETDATE()
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Products' AND xtype='U')
    CREATE TABLE Products (
      ID            INT IDENTITY(1,1) PRIMARY KEY,
      Name          NVARCHAR(255) NOT NULL,
      Stock         INT NOT NULL DEFAULT 0,
      CostPrice     FLOAT NOT NULL DEFAULT 0,
      SalePrice     FLOAT NOT NULL DEFAULT 0,
      Price2        FLOAT NOT NULL DEFAULT 0,
      Category      NVARCHAR(255),
      ImageURL      NVARCHAR(1000),
      CriticalStock INT NOT NULL DEFAULT 5,
      ShelfLifeDays INT,
      CostMethod    NVARCHAR(50) NOT NULL DEFAULT 'WeightedAvg',
      IsDeleted     INT NOT NULL DEFAULT 0,
      ShowInPos     INT NOT NULL DEFAULT 1,
      CreatedAt     DATETIME NOT NULL DEFAULT GETDATE()
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ProductBarcodes' AND xtype='U')
    CREATE TABLE ProductBarcodes (
      ID        INT IDENTITY(1,1) PRIMARY KEY,
      ProductID INT NOT NULL,
      Barcode   NVARCHAR(255) NOT NULL,
      FOREIGN KEY (ProductID) REFERENCES Products(ID) ON DELETE CASCADE
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Accounts' AND xtype='U')
    CREATE TABLE Accounts (
      ID        INT IDENTITY(1,1) PRIMARY KEY,
      Name      NVARCHAR(255) NOT NULL,
      Type      NVARCHAR(50) NOT NULL DEFAULT 'Müşteri',
      Phone     NVARCHAR(100),
      Email     NVARCHAR(255),
      Address   NVARCHAR(MAX),
      TaxOffice NVARCHAR(255),
      TaxNo     NVARCHAR(100),
      Balance   FLOAT NOT NULL DEFAULT 0,
      CreatedAt DATETIME NOT NULL DEFAULT GETDATE()
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='AccountLedger' AND xtype='U')
    CREATE TABLE AccountLedger (
      ID          INT IDENTITY(1,1) PRIMARY KEY,
      AccountID   INT NOT NULL,
      Type        NVARCHAR(50) NOT NULL DEFAULT 'Borç',
      Amount      FLOAT NOT NULL DEFAULT 0,
      Description NVARCHAR(MAX),
      RefType     NVARCHAR(50),
      RefID       INT,
      CreatedAt   DATETIME NOT NULL DEFAULT GETDATE(),
      FOREIGN KEY (AccountID) REFERENCES Accounts(ID)
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Couriers' AND xtype='U')
    CREATE TABLE Couriers (
      ID              INT IDENTITY(1,1) PRIMARY KEY,
      Name            NVARCHAR(255) NOT NULL,
      Phone           NVARCHAR(100),
      Status          NVARCHAR(50) NOT NULL DEFAULT 'Idle',
      lat             FLOAT,
      lng             FLOAT,
      lastSeen        BIGINT,
      CreatedAt       DATETIME NOT NULL DEFAULT GETDATE()
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Sales' AND xtype='U')
    CREATE TABLE Sales (
      ID            INT IDENTITY(1,1) PRIMARY KEY,
      TotalAmount   FLOAT NOT NULL DEFAULT 0,
      Tax           FLOAT NOT NULL DEFAULT 0,
      Discount      FLOAT NOT NULL DEFAULT 0,
      ServiceFee    FLOAT NOT NULL DEFAULT 0,
      PaymentMethod NVARCHAR(50) NOT NULL DEFAULT 'Cash',
      CourierID     INT,
      AccountID     INT,
      CreatedAt     DATETIME NOT NULL DEFAULT GETDATE()
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SaleItems' AND xtype='U')
    CREATE TABLE SaleItems (
      ID        INT IDENTITY(1,1) PRIMARY KEY,
      SaleID    INT NOT NULL,
      ProductID INT NOT NULL,
      Qty       INT NOT NULL DEFAULT 1,
      UnitPrice FLOAT NOT NULL DEFAULT 0,
      FOREIGN KEY (SaleID)    REFERENCES Sales(ID),
      FOREIGN KEY (ProductID) REFERENCES Products(ID)
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='AccountTransactions' AND xtype='U')
    CREATE TABLE AccountTransactions (
      ID            INT IDENTITY(1,1) PRIMARY KEY,
      Type          NVARCHAR(50) NOT NULL DEFAULT 'Sale',
      Amount        FLOAT NOT NULL DEFAULT 0,
      Description   NVARCHAR(MAX),
      Counterparty  NVARCHAR(255),
      SaleID        INT,
      InvoiceID     INT,
      AccountID     INT,
      PaymentMethod NVARCHAR(50) NOT NULL DEFAULT 'Cash',
      CreatedAt     DATETIME NOT NULL DEFAULT GETDATE(),
      FOREIGN KEY (SaleID) REFERENCES Sales(ID),
      FOREIGN KEY (AccountID) REFERENCES Accounts(ID)
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Invoices' AND xtype='U')
    CREATE TABLE Invoices (
      ID            INT IDENTITY(1,1) PRIMARY KEY,
      InvoiceNo     NVARCHAR(100),
      Type          NVARCHAR(50) NOT NULL DEFAULT 'Fatura',
      Counterparty  NVARCHAR(255) NOT NULL,
      TotalAmount   FLOAT NOT NULL DEFAULT 0,
      SubTotal      FLOAT NOT NULL DEFAULT 0,
      TotalDiscount FLOAT NOT NULL DEFAULT 0,
      TotalVat      FLOAT NOT NULL DEFAULT 0,
      Description   NVARCHAR(MAX),
      AccountID     INT,
      TaxOffice     NVARCHAR(255),
      TaxNumber     NVARCHAR(100),
      Address       NVARCHAR(MAX),
      Phone         NVARCHAR(100),
      WaybillNo     NVARCHAR(100),
      Carrier       NVARCHAR(255),
      PlateNo       NVARCHAR(100),
      InternalNote  NVARCHAR(MAX),
      ShipDate      DATETIME,
      PaymentDays   INT,
      IsOpen        INT NOT NULL DEFAULT 1,
      CreatedAt     DATETIME NOT NULL DEFAULT GETDATE(),
      FOREIGN KEY (AccountID) REFERENCES Accounts(ID)
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='InvoiceItems' AND xtype='U')
    CREATE TABLE InvoiceItems (
      ID            INT IDENTITY(1,1) PRIMARY KEY,
      InvoiceID     INT NOT NULL,
      ProductID     INT NOT NULL,
      Qty           INT NOT NULL DEFAULT 1,
      UnitPrice     FLOAT NOT NULL DEFAULT 0,
      VatRate       FLOAT NOT NULL DEFAULT 0,
      VatType       NVARCHAR(50) NOT NULL DEFAULT 'Hariç',
      Disc1         FLOAT NOT NULL DEFAULT 0,
      Disc2         FLOAT NOT NULL DEFAULT 0,
      Disc3         FLOAT NOT NULL DEFAULT 0,
      RowTotal      FLOAT NOT NULL DEFAULT 0,
      FOREIGN KEY (InvoiceID) REFERENCES Invoices(ID) ON DELETE CASCADE,
      FOREIGN KEY (ProductID) REFERENCES Products(ID)
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='CashRegisters' AND xtype='U')
    CREATE TABLE CashRegisters (
      ID        INT IDENTITY(1,1) PRIMARY KEY,
      Name      NVARCHAR(255) NOT NULL,
      Type      NVARCHAR(50) NOT NULL DEFAULT 'Nakit',
      Balance   FLOAT NOT NULL DEFAULT 0,
      CreatedAt DATETIME NOT NULL DEFAULT GETDATE()
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='CashMovements' AND xtype='U')
    CREATE TABLE CashMovements (
      ID              INT IDENTITY(1,1) PRIMARY KEY,
      CashRegisterID  INT NOT NULL,
      Type            NVARCHAR(50) NOT NULL DEFAULT 'Giriş',
      Amount          FLOAT NOT NULL DEFAULT 0,
      Description     NVARCHAR(MAX),
      RefType         NVARCHAR(50),
      RefID           INT,
      CreatedAt       DATETIME NOT NULL DEFAULT GETDATE(),
      FOREIGN KEY (CashRegisterID) REFERENCES CashRegisters(ID)
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='StockBatches' AND xtype='U')
    CREATE TABLE StockBatches (
      ID           INT IDENTITY(1,1) PRIMARY KEY,
      ProductID    INT NOT NULL,
      Qty          INT NOT NULL DEFAULT 0,
      RemainingQty INT NOT NULL DEFAULT 0,
      UnitCost     FLOAT NOT NULL DEFAULT 0,
      ExpiryDate   DATETIME,
      InvoiceID    INT,
      CreatedAt    DATETIME NOT NULL DEFAULT GETDATE(),
      FOREIGN KEY (ProductID) REFERENCES Products(ID),
      FOREIGN KEY (InvoiceID) REFERENCES Invoices(ID)
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='PurchaseOrders' AND xtype='U')
    CREATE TABLE PurchaseOrders (
      ID            INT IDENTITY(1,1) PRIMARY KEY,
      Counterparty  NVARCHAR(255) NOT NULL,
      AccountID     INT,
      Status        NVARCHAR(50) NOT NULL DEFAULT 'Beklemede',
      TotalAmount   FLOAT NOT NULL DEFAULT 0,
      Description   NVARCHAR(MAX),
      PaymentMethod NVARCHAR(50) NOT NULL DEFAULT 'Cash',
      InvoiceID     INT,
      ReceivedAt    DATETIME,
      CreatedAt     DATETIME NOT NULL DEFAULT GETDATE(),
      FOREIGN KEY (AccountID) REFERENCES Accounts(ID)
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='PurchaseOrderItems' AND xtype='U')
    CREATE TABLE PurchaseOrderItems (
      ID              INT IDENTITY(1,1) PRIMARY KEY,
      PurchaseOrderID INT NOT NULL,
      ProductID       INT NOT NULL,
      Qty             INT NOT NULL DEFAULT 1,
      UnitPrice       FLOAT NOT NULL DEFAULT 0,
      FOREIGN KEY (PurchaseOrderID) REFERENCES PurchaseOrders(ID) ON DELETE CASCADE,
      FOREIGN KEY (ProductID) REFERENCES Products(ID)
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='CourierSettlements' AND xtype='U')
    CREATE TABLE CourierSettlements (
      ID             INT IDENTITY(1,1) PRIMARY KEY,
      CourierID      INT NOT NULL,
      Date           NVARCHAR(50) NOT NULL,
      CashDelivered  FLOAT NOT NULL DEFAULT 0,
      Pos1Amount     FLOAT NOT NULL DEFAULT 0,
      Pos2Amount     FLOAT NOT NULL DEFAULT 0,
      Pos3Amount     FLOAT NOT NULL DEFAULT 0,
      PosTotal       FLOAT NOT NULL DEFAULT 0,
      Difference     FLOAT NOT NULL DEFAULT 0,
      CourierPayment FLOAT NOT NULL DEFAULT 0,
      Turnover       FLOAT NOT NULL DEFAULT 0,
      SalesAmount    FLOAT NOT NULL DEFAULT 0,
      ServiceAmount  FLOAT NOT NULL DEFAULT 0,
      ServiceCount   INT NOT NULL DEFAULT 0,
      CreatedAt      DATETIME NOT NULL DEFAULT GETDATE(),
      FOREIGN KEY (CourierID) REFERENCES Couriers(ID)
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='CourierDailyStats' AND xtype='U')
    CREATE TABLE CourierDailyStats (
      ID                INT IDENTITY(1,1) PRIMARY KEY,
      CourierID         INT NOT NULL,
      Date              NVARCHAR(50) NOT NULL,
      TotalDistanceKm   FLOAT NOT NULL DEFAULT 0,
      PackagesDelivered INT NOT NULL DEFAULT 0,
      CreatedAt         DATETIME NOT NULL DEFAULT GETDATE(),
      FOREIGN KEY (CourierID) REFERENCES Couriers(ID)
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='system_settings' AND xtype='U')
    CREATE TABLE system_settings (
      [key]   NVARCHAR(255) PRIMARY KEY,
      [value] NVARCHAR(MAX)
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Printers' AND xtype='U')
    CREATE TABLE Printers (
      ID        INT IDENTITY(1,1) PRIMARY KEY,
      Name      NVARCHAR(255) NOT NULL,
      Path      NVARCHAR(500) NOT NULL,
      Type      NVARCHAR(50) NOT NULL DEFAULT 'Thermal',
      CreatedAt DATETIME NOT NULL DEFAULT GETDATE()
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SpecialPrices' AND xtype='U')
    CREATE TABLE SpecialPrices (
      ID            INT IDENTITY(1,1) PRIMARY KEY,
      ProductID     INT NOT NULL,
      AccountID     INT,
      Name          NVARCHAR(255),
      SpecialPrice  FLOAT NOT NULL,
      StartDate     DATETIME,
      EndDate       DATETIME,
      IsActive      INT NOT NULL DEFAULT 1,
      CreatedAt     DATETIME NOT NULL DEFAULT GETDATE(),
      FOREIGN KEY (ProductID) REFERENCES Products(ID),
      FOREIGN KEY (AccountID) REFERENCES Accounts(ID)
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='PriceChanges' AND xtype='U')
    CREATE TABLE PriceChanges (
      ID          INT IDENTITY(1,1) PRIMARY KEY,
      ProductID   INT NOT NULL,
      OldPrice    FLOAT NOT NULL,
      NewPrice    FLOAT NOT NULL,
      Reason      NVARCHAR(MAX),
      PerformedBy NVARCHAR(255),
      ChangedAt   DATETIME NOT NULL DEFAULT GETDATE(),
      FOREIGN KEY (ProductID) REFERENCES Products(ID)
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Staff' AND xtype='U')
    CREATE TABLE Staff (
      ID        INT IDENTITY(1,1) PRIMARY KEY,
      Name      NVARCHAR(255) NOT NULL,
      Role      NVARCHAR(50) NOT NULL DEFAULT 'Cashier',
      Pin       NVARCHAR(50) NOT NULL,
      IsActive  INT NOT NULL DEFAULT 1,
      CreatedAt DATETIME NOT NULL DEFAULT GETDATE()
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='CancellationLogs' AND xtype='U')
    CREATE TABLE CancellationLogs (
      ID        INT IDENTITY(1,1) PRIMARY KEY,
      RefType   NVARCHAR(50) NOT NULL,
      RefID     INT NOT NULL,
      Reason    NVARCHAR(MAX),
      StaffID   INT,
      CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
      FOREIGN KEY (StaffID) REFERENCES Staff(ID)
    );
  `;

  // Safely alter tables to add missing columns in case of old schema
  const alterTables = `
    IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'AccountID' AND Object_ID = Object_ID(N'Sales'))
    BEGIN
        ALTER TABLE Sales ADD AccountID INT;
    END

    IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'IsDeleted' AND Object_ID = Object_ID(N'Products'))
    BEGIN
        ALTER TABLE Products ADD IsDeleted INT NOT NULL DEFAULT 0;
    END

    IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'ShowInPos' AND Object_ID = Object_ID(N'Products'))
    BEGIN
        ALTER TABLE Products ADD ShowInPos INT NOT NULL DEFAULT 1;
    END
    
    IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'Price2' AND Object_ID = Object_ID(N'Products'))
    BEGIN
        ALTER TABLE Products ADD Price2 FLOAT NOT NULL DEFAULT 0;
    END
    
    IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'isIngredient' AND Object_ID = Object_ID(N'Products'))
    BEGIN
        ALTER TABLE Products ADD isIngredient BIT NOT NULL DEFAULT 0;
    END

    IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'CriticalStock' AND Object_ID = Object_ID(N'Products'))
    BEGIN
        ALTER TABLE Products ADD CriticalStock INT NOT NULL DEFAULT 5;
    END

    IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'ShelfLifeDays' AND Object_ID = Object_ID(N'Products'))
    BEGIN
        ALTER TABLE Products ADD ShelfLifeDays INT;
    END

    IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'CostMethod' AND Object_ID = Object_ID(N'Products'))
    BEGIN
        ALTER TABLE Products ADD CostMethod NVARCHAR(50) NOT NULL DEFAULT 'WeightedAvg';
    END

    IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'ServiceFee' AND Object_ID = Object_ID(N'Sales'))
    BEGIN
        ALTER TABLE Sales ADD ServiceFee FLOAT NOT NULL DEFAULT 0;
    END

    IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'lat' AND Object_ID = Object_ID(N'Couriers'))
    BEGIN
        ALTER TABLE Couriers ADD lat FLOAT;
    END

    IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'lng' AND Object_ID = Object_ID(N'Couriers'))
    BEGIN
        ALTER TABLE Couriers ADD lng FLOAT;
    END

    IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'lastSeen' AND Object_ID = Object_ID(N'Couriers'))
    BEGIN
        ALTER TABLE Couriers ADD lastSeen BIGINT;
    END
  `;

  const tablesToSync = [
    'Categories', 'Products', 'Accounts', 'AccountLedger', 'Couriers',
    'Sales', 'SaleItems', 'AccountTransactions', 'Invoices', 'InvoiceItems',
    'CashRegisters', 'CashMovements', 'PurchaseOrders', 'PurchaseOrderItems',
    'SpecialPrices', 'Staff'
  ];

  let addSyncColumns = '';
  for (const table of tablesToSync) {
    addSyncColumns += `
      IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'GlobalID' AND Object_ID = Object_ID(N'${table}'))
      BEGIN
          ALTER TABLE ${table} ADD GlobalID UNIQUEIDENTIFIER DEFAULT NEWID();
      END

      IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'SyncStatus' AND Object_ID = Object_ID(N'${table}'))
      BEGIN
          ALTER TABLE ${table} ADD SyncStatus INT NOT NULL DEFAULT 0;
      END

      IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'LastUpdated' AND Object_ID = Object_ID(N'${table}'))
      BEGIN
          ALTER TABLE ${table} ADD LastUpdated DATETIME NOT NULL DEFAULT GETDATE();
      END
    `;
  }

  await tryExec(createTables);
  await tryExec(alterTables);
  await tryExec(addSyncColumns);

  // Indexes using tryExec
  await tryExec(`CREATE UNIQUE INDEX IX_ProductBarcodes_Barcode ON ProductBarcodes(Barcode)`);
  await tryExec(`CREATE INDEX IX_ProductBarcodes_ProductID ON ProductBarcodes(ProductID)`);
  await tryExec(`CREATE INDEX IX_Sales_AccountID ON Sales(AccountID)`);
  await tryExec(`CREATE UNIQUE INDEX IX_CourierDailyStats_Date_CourierID ON CourierDailyStats(Date, CourierID)`);

  // Cleanup soft-deleted product barcodes
  await tryExec(`DELETE FROM ProductBarcodes WHERE ProductID IN (SELECT ID FROM Products WHERE ISNULL(IsDeleted, 0) = 1)`);

  // Seed courier API token
  const tokenTest = await request.query(`SELECT value FROM system_settings WHERE [key] = 'courier_api_token'`);
  if (tokenTest.recordset.length === 0) {
    const token = crypto.randomUUID();
    await request
      .input('key', sql.NVarChar, 'courier_api_token')
      .input('value', sql.NVarChar, token)
      .query(`INSERT INTO system_settings ([key], [value]) VALUES (@key, @value)`);
    console.log(`🔑 Generated courier API token: ${token}`);
  }
}

export default getDb;

