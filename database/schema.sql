-- ============================================
-- PosLX — SQLite Schema
-- ============================================

-- Categories Table
CREATE TABLE IF NOT EXISTS Categories (
    ID        INTEGER PRIMARY KEY AUTOINCREMENT,
    Name      TEXT NOT NULL UNIQUE,
    CreatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Products Table
CREATE TABLE IF NOT EXISTS Products (
    ID        INTEGER PRIMARY KEY AUTOINCREMENT,
    Name      TEXT    NOT NULL,
    Stock     INTEGER NOT NULL DEFAULT 0,
    CostPrice REAL    NOT NULL DEFAULT 0,
    SalePrice REAL    NOT NULL DEFAULT 0,
    Category  TEXT,
    ImageURL  TEXT,
    CreatedAt TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ProductBarcodes Table (many-to-one: multiple barcodes per product)
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

-- Sales Table
CREATE TABLE IF NOT EXISTS Sales (
    ID            INTEGER PRIMARY KEY AUTOINCREMENT,
    TotalAmount   REAL    NOT NULL DEFAULT 0,
    Tax           REAL    NOT NULL DEFAULT 0,
    Discount      REAL    NOT NULL DEFAULT 0,
    PaymentMethod TEXT    NOT NULL DEFAULT 'Cash',
    CourierID     INTEGER,
    CreatedAt     TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- SaleItems Table
CREATE TABLE IF NOT EXISTS SaleItems (
    ID        INTEGER PRIMARY KEY AUTOINCREMENT,
    SaleID    INTEGER NOT NULL,
    ProductID INTEGER NOT NULL,
    Qty       INTEGER NOT NULL DEFAULT 1,
    UnitPrice REAL    NOT NULL DEFAULT 0,
    FOREIGN KEY (SaleID)    REFERENCES Sales(ID),
    FOREIGN KEY (ProductID) REFERENCES Products(ID)
);

-- Couriers Table
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

-- ============================================
-- Seed data
-- ============================================

-- Seed Categories
INSERT OR IGNORE INTO Categories (Name) VALUES
    ('Hot Drinks'), ('Cold Drinks'), ('Desserts'), ('Pastry'), ('Food');

-- Seed Products + Barcodes
INSERT OR IGNORE INTO Products (ID, Name, Stock, CostPrice, SalePrice, Category) VALUES
    (1, 'Espresso',          120, 8,  25, 'Hot Drinks'),
    (2, 'Americano',           95, 9,  28, 'Hot Drinks'),
    (3, 'Latte',               80, 12, 35, 'Hot Drinks'),
    (4, 'Cappuccino',          70, 12, 35, 'Hot Drinks'),
    (5, 'Iced Tea',           150, 5,  18, 'Cold Drinks'),
    (6, 'Fresh Orange Juice',  45, 15, 30, 'Cold Drinks'),
    (7, 'Chocolate Cake',      30, 20, 45, 'Desserts'),
    (8, 'Croissant',           60, 10, 22, 'Pastry'),
    (9, 'Sandwich',            40, 18, 38, 'Food'),
    (10, 'Mineral Water',     200, 2,   8, 'Cold Drinks'),
    (11, 'Turkish Coffee',     90, 10, 20, 'Hot Drinks'),
    (12, 'Tiramisu',           25, 22, 48, 'Desserts');

INSERT OR IGNORE INTO ProductBarcodes (ProductID, Barcode) VALUES
    (1, '8690000001'), (1, '8690000001A'),
    (2, '8690000002'),
    (3, '8690000003'), (3, '8690000003A'),
    (4, '8690000004'),
    (5, '8690000005'),
    (6, '8690000006'),
    (7, '8690000007'),
    (8, '8690000008'),
    (9, '8690000009'),
    (10, '8690000010'),
    (11, '8690000011'),
    (12, '8690000012');

-- Seed Couriers
INSERT OR IGNORE INTO Couriers (ID, Name, Phone, Status, Lat, Lng, DailyDistanceKM) VALUES
    (1, 'Ahmet Yılmaz',  '+90 532 111 2233', 'Delivering', 41.0082, 28.9784, 14.3),
    (2, 'Mehmet Demir',  '+90 535 222 3344', 'Idle',       41.0135, 28.9553, 7.1),
    (3, 'Ayşe Kaya',     '+90 538 333 4455', 'Delivering', 41.0251, 29.0130, 22.6),
    (4, 'Fatma Çelik',   '+90 541 444 5566', 'Offline',    40.9923, 28.8950, 0),
    (5, 'Ali Öztürk',    '+90 544 555 6677', 'Delivering', 41.0390, 28.9860, 18.9);
