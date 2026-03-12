/**
 * MarcaPOS → PosLX Veri Aktarım Scripti (Batch Insert - Hızlı Versiyon)
 * 
 * Kullanım:
 *   node scripts/migrate.js
 * 
 * Çalıştırmadan önce aşağıdaki SOURCE_CONFIG bilgilerini
 * müşterinin eski veritabanına göre düzenleyin.
 */

import sql from 'mssql';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const BATCH_SIZE = 200; // Toplu ekleme boyutu (MSSQL max 2100 parametre sınırı nedeniyle 200'e düşürüldü)

// ═══════════════════════════════════════════════════════════════
// YAPILANDIRMA — MÜŞTERİNİN ESKİ VERİTABANI BİLGİLERİ
// ═══════════════════════════════════════════════════════════════
const SOURCE_RAW_SERVER = 'localhost\\MSSQLSERVER01';
const SOURCE_SERVER_PARTS = SOURCE_RAW_SERVER.split('\\');
const SOURCE_HOST = SOURCE_SERVER_PARTS[0];
const SOURCE_INSTANCE = SOURCE_SERVER_PARTS.length > 1 ? SOURCE_SERVER_PARTS[1] : undefined;

const SOURCE_CONFIG = {
  user: 'sa',
  password: '123',
  server: SOURCE_HOST,
  database: 'MarcaPOS',
  ...(SOURCE_INSTANCE ? {} : { port: 1433 }),
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
    ...(SOURCE_INSTANCE ? { instanceName: SOURCE_INSTANCE } : {}),
  }
};

// ═══════════════════════════════════════════════════════════════
// PosLX (Yeni) veritabanı — .env / config.json'dan okunur
// ═══════════════════════════════════════════════════════════════
let externalConfig = {};
try {
  let configPath = path.join(process.cwd(), 'config.json');
  if (!fs.existsSync(configPath)) configPath = path.join(__dirname, '..', 'config.json');
  if (fs.existsSync(configPath)) externalConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch { }

const getEnvOrConfig = (key) => externalConfig[key] || process.env[key];
const rawServer = getEnvOrConfig('DB_SERVER') || 'localhost';
const serverParts = rawServer.split('\\');
const serverHost = serverParts[0];
const instanceName = serverParts.length > 1 ? serverParts[1] : undefined;

const TARGET_CONFIG = {
  user: getEnvOrConfig('DB_USER') || 'sa',
  password: getEnvOrConfig('DB_PASS') || 'YourPassword123!',
  server: serverHost,
  database: getEnvOrConfig('DB_NAME') || 'poslx',
  ...(instanceName ? {} : { port: parseInt(getEnvOrConfig('DB_PORT')) || 1433 }),
  options: {
    encrypt: String(getEnvOrConfig('DB_ENCRYPT')) === 'true',
    trustServerCertificate: String(getEnvOrConfig('DB_TRUST_SERVER_CERTIFICATE')) !== 'false',
    enableArithAbort: true,
    ...(instanceName ? { instanceName } : {}),
  }
};

// ═══════════════════════════════════════════════════════════════
// YARDIMCI FONKSİYONLAR
// ═══════════════════════════════════════════════════════════════

function safeStr(val) {
  if (val === null || val === undefined) return null;
  return String(val).trim();
}
function safeNum(val) {
  if (val === null || val === undefined) return 0;
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}
function safeInt(val) {
  if (val === null || val === undefined) return 0;
  const n = parseInt(val);
  return isNaN(n) ? 0 : n;
}

const stats = {};
function logStep(step, count) {
  stats[step] = count;
  console.log(`  ✅ ${step}: ${count} kayıt aktarıldı`);
}

// ═══════════════════════════════════════════════════════════════
// ÖNBELLEKLER (Hız için tüm eşleştirmeler belleğe yüklenir)
// ═══════════════════════════════════════════════════════════════
const cache = {
  barcodeToProductId: {},   // barkot string → Products.ID
  barkotToAccountId: {},    // müşteri/toptancı barkot → Accounts.ID
  cariIdToAccountId: {},    // CariList.CARIID → Accounts.ID
  oldCatIdToNewCatId: {},   // UrunGrup.Id → Categories.ID
  oldStaffToNewStaff: {},   // Personel.PersonelNo → Staff.ID
  oldCourierToNew: {},      // KuryeList.id → Couriers.ID
  oldKasaToNew: {},         // Kasa.KasaNo → CashRegisters.ID
};

// ═══════════════════════════════════════════════════════════════
// ANA FONKSİYON
// ═══════════════════════════════════════════════════════════════
async function migrate() {
  let sourcePool, targetPool;

  try {
    console.log('\n══════════════════════════════════════════');
    console.log('  MarcaPOS → PosLX Veri Aktarım (HIZLI)');
    console.log('══════════════════════════════════════════\n');

    console.log(`Kaynak: ${SOURCE_CONFIG.server}${SOURCE_INSTANCE ? '\\' + SOURCE_INSTANCE : ''}/${SOURCE_CONFIG.database}`);
    console.log(`Hedef:  ${TARGET_CONFIG.server}${instanceName ? '\\' + instanceName : ''}/${TARGET_CONFIG.database}\n`);

    sourcePool = await new sql.ConnectionPool(SOURCE_CONFIG).connect();
    console.log('✅ Eski veritabanına bağlanıldı.');

    targetPool = await new sql.ConnectionPool(TARGET_CONFIG).connect();
    console.log('✅ Yeni veritabanına bağlanıldı.\n');

    // ── ÖNCE TEMİZLE ─────────────────────────────────────────
    console.log('── 0. Mevcut veriler temizleniyor...');
    await cleanTargetDb(targetPool);
    console.log('  ✅ Veritabanı temizlendi.\n');

    // ── ADIMLAR ──────────────────────────────────────────────
    const t0 = Date.now();

    console.log('── 1. Kategoriler...');
    await migrateCategories(sourcePool, targetPool);

    console.log('── 2. Ürünler...');
    await migrateProducts(sourcePool, targetPool);

    // Barkot → ProductID önbelleğini yükle
    await loadBarcodeCache(targetPool);

    console.log('── 3. Müşteriler...');
    await migrateMusteri(sourcePool, targetPool);

    console.log('── 4. Toptancılar...');
    await migrateToptanci(sourcePool, targetPool);

    console.log('── 5. Cari Hesaplar...');
    await migrateCariList(sourcePool, targetPool);

    console.log('── 6. Personel...');
    await migratePersonel(sourcePool, targetPool);

    console.log('── 7. Kuryeler...');
    await migrateKuryeler(sourcePool, targetPool);

    console.log('── 8. Kasalar...');
    await migrateKasalar(sourcePool, targetPool);

    console.log('── 9. Satışlar (TOPLU)...');
    await migrateSalesBatch(sourcePool, targetPool);

    console.log('── 10. Alış Faturaları...');
    await migrateAlisFaturasi(sourcePool, targetPool);

    console.log('── 11. Genel Faturalar...');
    await migrateFaturaList(sourcePool, targetPool);

    console.log('── 12. Cari Hareketler...');
    await migrateCariHareketler(sourcePool, targetPool);

    console.log('── 13. Muhasebe İşlemleri...');
    await migrateAccountTransactions(sourcePool, targetPool);

    const elapsed = ((Date.now() - t0) / 1000 / 60).toFixed(1);

    console.log('\n══════════════════════════════════════════');
    console.log('  AKTARIM TAMAMLANDI 🎉');
    console.log(`  Toplam süre: ${elapsed} dakika`);
    console.log('══════════════════════════════════════════');
    console.log('\nÖzet:');
    for (const [step, count] of Object.entries(stats)) {
      console.log(`  ${step}: ${count}`);
    }

  } catch (err) {
    console.error('\n❌ KRİTİK HATA:', err.message);
    console.error(err.stack);
  } finally {
    if (sourcePool) await sourcePool.close();
    if (targetPool) await targetPool.close();
  }
}

// ═══════════════════════════════════════════════════════════════
// 0. HEDEF VERİTABANINI TEMİZLE (sıralama FK kısıtlamalarına uygun)
// ═══════════════════════════════════════════════════════════════
async function cleanTargetDb(tgt) {
  const tables = [
    'CashMovements', 'CancellationLogs', 'AccountLedger',
    'AccountTransactions', 'InvoiceItems', 'SaleItems',
    'PurchaseOrderItems', 'StockBatches', 'CourierSettlements', 'CourierDailyStats',
    'SpecialPrices', 'PriceChanges', 'ProductBarcodes',
    'PurchaseOrders', 'Invoices', 'Sales',
    'CashRegisters', 'Couriers', 'Staff',
    'Accounts', 'Products', 'Categories'
  ];
  for (const t of tables) {
    try { await tgt.request().query(`DELETE FROM ${t}`); } catch { }
  }
  // Identity'leri sıfırla
  for (const t of tables) {
    try { await tgt.request().query(`DBCC CHECKIDENT('${t}', RESEED, 0)`); } catch { }
  }
}

// ═══════════════════════════════════════════════════════════════
// BARKOT ÖNBELLEK YÜKLE
// ═══════════════════════════════════════════════════════════════
async function loadBarcodeCache(tgt) {
  const { recordset } = await tgt.request().query(`SELECT ProductID, Barcode FROM ProductBarcodes`);
  for (const row of recordset) {
    cache.barcodeToProductId[row.Barcode] = row.ProductID;
  }
  console.log(`  📦 Barkot önbelleği: ${recordset.length} kayıt yüklendi.\n`);
}

// ═══════════════════════════════════════════════════════════════
// 1. KATEGORİLER
// ═══════════════════════════════════════════════════════════════
async function migrateCategories(src, tgt) {
  const { recordset: rows } = await src.request().query(`SELECT Id, Isim FROM UrunGrup`);
  let count = 0;
  for (const row of rows) {
    const name = safeStr(row.Isim) || 'Genel';
    try {
      const r = await tgt.request().input('n', sql.NVarChar, name)
        .query(`INSERT INTO Categories (Name) OUTPUT INSERTED.ID VALUES (@n)`);
      if (r.recordset[0]) {
        cache.oldCatIdToNewCatId[row.Id] = r.recordset[0].ID;
        count++;
      }
    } catch { }
  }
  logStep('Kategoriler', count);
}

// ═══════════════════════════════════════════════════════════════
// 2. ÜRÜNLER (toplu)
// ═══════════════════════════════════════════════════════════════
async function migrateProducts(src, tgt) {
  const { recordset: rows } = await src.request().query(`
    SELECT u.UrunId, u.GrupId, u.Barkot, u.Adi, u.AlisFiyati, u.SatisFiyati,
           u.SatisFiyatiKrediKarti, u.StokAdedi, u.Aktif, u.KDV, u.Birim,
           u.MinStok, u.SatisFiyati2, ug.Isim AS GrupIsim
    FROM Urun u LEFT JOIN UrunGrup ug ON u.GrupId = ug.Id
  `);

  let prodCount = 0;
  let barcodeCount = 0;

  // Ürünleri batch halinde ekle
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    for (const row of batch) {
      const name = safeStr(row.Adi) || 'İsimsiz Ürün';
      const barcode = safeStr(row.Barkot);
      const categoryName = safeStr(row.GrupIsim);
      try {
        const r = await tgt.request()
          .input('name', sql.NVarChar, name)
          .input('stock', sql.Int, safeInt(row.StokAdedi))
          .input('cost', sql.Float, safeNum(row.AlisFiyati))
          .input('sale', sql.Float, safeNum(row.SatisFiyati))
          .input('p2', sql.Float, safeNum(row.SatisFiyatiKrediKarti || row.SatisFiyati2))
          .input('cat', sql.NVarChar, categoryName)
          .input('crit', sql.Int, safeInt(row.MinStok) || 5)
          .input('del', sql.Int, row.Aktif ? 0 : 1)
          .query(`INSERT INTO Products (Name,Stock,CostPrice,SalePrice,Price2,Category,CriticalStock,IsDeleted,ShowInPos)
                  OUTPUT INSERTED.ID VALUES (@name,@stock,@cost,@sale,@p2,@cat,@crit,@del,1)`);

        const newId = r.recordset[0]?.ID;
        if (newId && barcode) {
          try {
            await tgt.request()
              .input('pid', sql.Int, newId)
              .input('bc', sql.NVarChar, barcode)
              .query(`INSERT INTO ProductBarcodes (ProductID, Barcode) VALUES (@pid, @bc)`);
            barcodeCount++;
          } catch { }
          prodCount++;
        } else if (newId) {
          prodCount++;
        }
      } catch { }
    }

    // İlerleme
    if (i % 1000 === 0 && i > 0) process.stdout.write(`  ... ${i}/${rows.length}\r`);
  }
  logStep('Ürünler', prodCount);
  logStep('Barkodlar', barcodeCount);
}

// ═══════════════════════════════════════════════════════════════
// 3. MÜŞTERİLER
// ═══════════════════════════════════════════════════════════════
async function migrateMusteri(src, tgt) {
  const { recordset: rows } = await src.request().query(`
    SELECT MusteriNo, Barkot, Isim, Telefon, Borc, Alacak,
           VergiNo, VergiDaire, Adres, EPosta, CepTelefonu, il, ilce, FirmaAdi
    FROM Musteri
  `);
  let count = 0;
  for (const row of rows) {
    const name = safeStr(row.Isim) || safeStr(row.FirmaAdi) || 'Müşteri';
    const phone = safeStr(row.CepTelefonu) || safeStr(row.Telefon);
    const balance = safeNum(row.Borc) - safeNum(row.Alacak);
    const addr = [safeStr(row.Adres), safeStr(row.il), safeStr(row.ilce)].filter(Boolean).join(', ');
    try {
      const r = await tgt.request()
        .input('n', sql.NVarChar, name).input('t', sql.NVarChar, 'Müşteri')
        .input('p', sql.NVarChar, phone).input('e', sql.NVarChar, safeStr(row.EPosta))
        .input('a', sql.NVarChar, addr || null).input('to', sql.NVarChar, safeStr(row.VergiDaire))
        .input('tn', sql.NVarChar, safeStr(row.VergiNo)).input('b', sql.Float, balance)
        .query(`INSERT INTO Accounts(Name,Type,Phone,Email,Address,TaxOffice,TaxNo,Balance)
                OUTPUT INSERTED.ID VALUES(@n,@t,@p,@e,@a,@to,@tn,@b)`);
      const id = r.recordset[0]?.ID;
      if (id) { cache.barkotToAccountId[safeStr(row.Barkot)] = id; count++; }
    } catch { }
  }
  logStep('Müşteriler', count);
}

// ═══════════════════════════════════════════════════════════════
// 4. TOPTANCILAR
// ═══════════════════════════════════════════════════════════════
async function migrateToptanci(src, tgt) {
  const { recordset: rows } = await src.request().query(`
    SELECT ToptanciNo, Barkot, Isim, Telefon, Borc, Alacak,
           VergiNo, VergiDaire, Adres, Il, Ilce, Email
    FROM Toptanci
  `);
  let count = 0;
  for (const row of rows) {
    const name = safeStr(row.Isim) || 'Tedarikçi';
    const balance = safeNum(row.Borc) - safeNum(row.Alacak);
    const addr = [safeStr(row.Adres), safeStr(row.Il), safeStr(row.Ilce)].filter(Boolean).join(', ');
    try {
      const r = await tgt.request()
        .input('n', sql.NVarChar, name).input('t', sql.NVarChar, 'Tedarikçi')
        .input('p', sql.NVarChar, safeStr(row.Telefon)).input('e', sql.NVarChar, safeStr(row.Email))
        .input('a', sql.NVarChar, addr || null).input('to', sql.NVarChar, safeStr(row.VergiDaire))
        .input('tn', sql.NVarChar, safeStr(row.VergiNo)).input('b', sql.Float, balance)
        .query(`INSERT INTO Accounts(Name,Type,Phone,Email,Address,TaxOffice,TaxNo,Balance)
                OUTPUT INSERTED.ID VALUES(@n,@t,@p,@e,@a,@to,@tn,@b)`);
      const id = r.recordset[0]?.ID;
      if (id) { cache.barkotToAccountId[safeStr(row.Barkot)] = id; count++; }
    } catch { }
  }
  logStep('Toptancılar', count);
}

// ═══════════════════════════════════════════════════════════════
// 5. CARİ HESAPLAR
// ═══════════════════════════════════════════════════════════════
async function migrateCariList(src, tgt) {
  const { recordset: rows } = await src.request().query(`
    SELECT cl.CARIID, cl.UNVAN, cl.TEL1, cl.CEPTEL, cl.EMAIL,
           cl.VD, cl.VN, cl.TCKN, cl.CARIKODU,
           cb.BORC, cb.ALACAK, cb.BAKIYE,
           ct.ACIKLAMA AS TipiAciklama,
           ca.ADRES, ca.IL, ca.ILCE
    FROM CariList cl
    LEFT JOIN CariBakiye cb ON cl.CARIID = cb.CARIID
    LEFT JOIN CariTipleri ct ON cl.TIPI = ct.ID
    LEFT JOIN (SELECT CARIID, MIN(ID) AS MinID FROM CariAdresler GROUP BY CARIID) caMin ON cl.CARIID = caMin.CARIID
    LEFT JOIN CariAdresler ca ON ca.ID = caMin.MinID
  `);
  let count = 0;
  for (const row of rows) {
    const name = safeStr(row.UNVAN) || 'Cari';
    const phone = safeStr(row.CEPTEL) || safeStr(row.TEL1);
    const tipi = safeStr(row.TipiAciklama) || '';
    const tipiLower = tipi.toLowerCase();
    const nameLower = name.toLowerCase();
    const isSupplier = tipiLower.includes('tedarik') || tipiLower.includes('toptanc')
                    || tipiLower.includes('satıcı') || tipiLower.includes('satici')
                    || tipiLower.includes('üretici') || tipiLower.includes('uretici')
                    || tipiLower.includes('distribü') || tipiLower.includes('dağıtım') || tipiLower.includes('dagitim')
                    || tipiLower.includes('supplier') || tipiLower.includes('vendor');
    const type = isSupplier ? 'Tedarikçi' : 'Müşteri';
    const balance = safeNum(row.BAKIYE) || (safeNum(row.BORC) - safeNum(row.ALACAK));
    const addr = [safeStr(row.ADRES), safeStr(row.IL), safeStr(row.ILCE)].filter(Boolean).join(', ');
    try {
      const r = await tgt.request()
        .input('n', sql.NVarChar, name).input('t', sql.NVarChar, type)
        .input('p', sql.NVarChar, phone).input('e', sql.NVarChar, safeStr(row.EMAIL))
        .input('a', sql.NVarChar, addr || null).input('to', sql.NVarChar, safeStr(row.VD))
        .input('tn', sql.NVarChar, safeStr(row.VN) || safeStr(row.TCKN)).input('b', sql.Float, balance)
        .query(`INSERT INTO Accounts(Name,Type,Phone,Email,Address,TaxOffice,TaxNo,Balance)
                OUTPUT INSERTED.ID VALUES(@n,@t,@p,@e,@a,@to,@tn,@b)`);
      const id = r.recordset[0]?.ID;
      if (id) {
        cache.cariIdToAccountId[row.CARIID] = id;
        const kodu = safeStr(row.CARIKODU);
        if (kodu) cache.barkotToAccountId[kodu] = id;
        count++;
      }
    } catch { }
  }
  logStep('Cari Hesaplar', count);
}

// ═══════════════════════════════════════════════════════════════
// 6. PERSONEL
// ═══════════════════════════════════════════════════════════════
async function migratePersonel(src, tgt) {
  const { recordset: rows } = await src.request().query(`SELECT PersonelNo, Isim, Sifre, Aktif FROM Personel`);
  let count = 0;
  for (const row of rows) {
    try {
      const r = await tgt.request()
        .input('n', sql.NVarChar, safeStr(row.Isim) || 'Personel')
        .input('p', sql.NVarChar, safeStr(row.Sifre) || '1234')
        .input('a', sql.Int, row.Aktif ? 1 : 0)
        .query(`INSERT INTO Staff(Name,Role,Pin,IsActive) OUTPUT INSERTED.ID VALUES(@n,'Cashier',@p,@a)`);
      const id = r.recordset[0]?.ID;
      if (id) { cache.oldStaffToNewStaff[row.PersonelNo] = id; count++; }
    } catch { }
  }
  logStep('Personel', count);
}

// ═══════════════════════════════════════════════════════════════
// 7. KURYELER
// ═══════════════════════════════════════════════════════════════
async function migrateKuryeler(src, tgt) {
  const { recordset: rows } = await src.request().query(`SELECT id, KuryeAdi, Telefon FROM KuryeList`);
  let count = 0;
  for (const row of rows) {
    try {
      const r = await tgt.request()
        .input('n', sql.NVarChar, safeStr(row.KuryeAdi) || 'Kurye')
        .input('p', sql.NVarChar, safeStr(row.Telefon))
        .query(`INSERT INTO Couriers(Name,Phone,Status) OUTPUT INSERTED.ID VALUES(@n,@p,'Idle')`);
      const id = r.recordset[0]?.ID;
      if (id) { cache.oldCourierToNew[row.id] = id; count++; }
    } catch { }
  }
  logStep('Kuryeler', count);
}

// ═══════════════════════════════════════════════════════════════
// 8. KASALAR
// ═══════════════════════════════════════════════════════════════
async function migrateKasalar(src, tgt) {
  const { recordset: rows } = await src.request().query(`SELECT KasaNo, KasaAdi, KasaTipi FROM Kasa`);
  let count = 0;
  for (const row of rows) {
    try {
      const r = await tgt.request()
        .input('n', sql.NVarChar, safeStr(row.KasaAdi) || 'Kasa')
        .input('t', sql.NVarChar, row.KasaTipi === 0 ? 'Nakit' : 'Banka')
        .query(`INSERT INTO CashRegisters(Name,Type,Balance) OUTPUT INSERTED.ID VALUES(@n,@t,0)`);
      const id = r.recordset[0]?.ID;
      if (id) { cache.oldKasaToNew[row.KasaNo] = id; count++; }
    } catch { }
  }
  logStep('Kasalar', count);
}

// ═══════════════════════════════════════════════════════════════
// 9. SATIŞLAR — TOPLU EKLEME (BATCH)
//    Strateji:
//    1) Sales tablosuna geçici OldRef sütunu ekle
//    2) Tüm satışları batch halinde INSERT et (OldRef = eski HareketNo)
//    3) SELECT ID, OldRef ile eşleştirme tablosu oluştur
//    4) Tüm satış kalemlerini batch halinde INSERT et
//    5) OldRef sütununu kaldır
// ═══════════════════════════════════════════════════════════════
async function migrateSalesBatch(src, tgt) {
  // Geçici sütun ekle
  try {
    await tgt.request().query(`
      IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name='OldRef' AND Object_ID=Object_ID('Sales'))
      ALTER TABLE Sales ADD OldRef BIGINT
    `);
  } catch { }

  // ── Tüm satış başlıklarını oku ──
  console.log('  📖 Satış başlıkları okunuyor...');
  const { recordset: headers } = await src.request().query(`
    SELECT hb.HareketNo, hb.Tarih, hb.Toplam, hb.KDV, hb.Iskonto,
           hb.Barkod, ho.OdemeTuru
    FROM HareketBaslik hb
    LEFT JOIN (
      SELECT HareketNo, MIN(OdemeTuru) AS OdemeTuru FROM HareketOdeme GROUP BY HareketNo
    ) ho ON hb.HareketNo = ho.HareketNo
    WHERE hb.HareketTuru = 'SA'
    ORDER BY hb.HareketNo ASC
  `);
  console.log(`  📊 ${headers.length} satış başlığı bulundu.`);

  // ── Satışları batch halinde ekle ──
  let saleCount = 0;
  for (let i = 0; i < headers.length; i += BATCH_SIZE) {
    const batch = headers.slice(i, i + BATCH_SIZE);

    // Dinamik multi-value INSERT oluştur
    let values = [];
    const req = tgt.request();

    for (let j = 0; j < batch.length; j++) {
      const h = batch[j];
      const idx = `${i}_${j}`;
      let pm = 'Cash';
      switch (safeInt(h.OdemeTuru)) {
        case 2: pm = 'CreditCard'; break;
        case 5: pm = 'Veresiye'; break;
      }
      const accId = cache.barkotToAccountId[safeStr(h.Barkod)] || null;

      req.input(`t${idx}`, sql.Float, safeNum(h.Toplam));
      req.input(`k${idx}`, sql.Float, safeNum(h.KDV));
      req.input(`d${idx}`, sql.Float, safeNum(h.Iskonto));
      req.input(`pm${idx}`, sql.NVarChar, pm);
      req.input(`ai${idx}`, sql.Int, accId);
      req.input(`ca${idx}`, sql.DateTime, h.Tarih);
      req.input(`or${idx}`, sql.BigInt, h.HareketNo);

      values.push(`(@t${idx}, @k${idx}, @d${idx}, 0, @pm${idx}, @ai${idx}, @ca${idx}, @or${idx})`);
    }

    if (values.length > 0) {
      try {
        await req.query(`
          INSERT INTO Sales (TotalAmount, Tax, Discount, ServiceFee, PaymentMethod, AccountID, CreatedAt, OldRef)
          VALUES ${values.join(',\n')}
        `);
        saleCount += values.length;
      } catch (err) {
        console.warn(`  ⚠️ Satış batch hatası (${i}): ${err.message}`);
      }
    }

    // İlerleme göster
    if (i % 5000 === 0) {
      process.stdout.write(`  ... ${i.toLocaleString()}/${headers.length.toLocaleString()} satış eklendi\r`);
    }
  }
  console.log('');
  logStep('Satışlar', saleCount);

  // ── Eşleştirme tablosunu bellekte oluştur ──
  console.log('  🔗 ID eşleştirmesi yapılıyor...');
  const { recordset: mapping } = await tgt.request().query(`SELECT ID, OldRef FROM Sales WHERE OldRef IS NOT NULL`);
  const saleIdMap = {};
  for (const row of mapping) {
    saleIdMap[row.OldRef] = row.ID;
  }
  console.log(`  📊 ${Object.keys(saleIdMap).length} satış eşleştirildi.`);

  // ── Tüm satış kalemlerini oku ──
  console.log('  📖 Satış kalemleri okunuyor...');
  const { recordset: allItems } = await src.request().query(`
    SELECT h.HareketNo, h.Barkot, h.Adet, h.SatisFiyati, h.Birim
    FROM Hareket h
    INNER JOIN HareketBaslik hb ON h.HareketNo = hb.HareketNo
    WHERE hb.HareketTuru = 'SA' AND h.HareketTuru = 'SA'
  `);
  console.log(`  📊 ${allItems.length} satış kalemi bulundu.`);

  // ── Satış kalemlerini batch halinde ekle ──
  let itemCount = 0;
  let skippedItems = 0;

  // Önce eklenecek kalemleri hazırla
  const validItems = [];
  for (const item of allItems) {
    const saleId = saleIdMap[item.HareketNo];
    const productId = cache.barcodeToProductId[safeStr(item.Barkot)];
    if (!saleId || !productId) { skippedItems++; continue; }

    validItems.push({
      saleId,
      productId,
      qty: safeInt(item.Adet) || 1,
      unitPrice: safeNum(item.SatisFiyati)
    });
  }

  for (let i = 0; i < validItems.length; i += BATCH_SIZE) {
    const batch = validItems.slice(i, i + BATCH_SIZE);
    const req = tgt.request();
    const values = [];

    for (let j = 0; j < batch.length; j++) {
      const it = batch[j];
      const idx = `${i}_${j}`;
      req.input(`s${idx}`, sql.Int, it.saleId);
      req.input(`p${idx}`, sql.Int, it.productId);
      req.input(`q${idx}`, sql.Int, it.qty);
      req.input(`u${idx}`, sql.Float, it.unitPrice);
      values.push(`(@s${idx}, @p${idx}, @q${idx}, @u${idx})`);
    }

    if (values.length > 0) {
      try {
        await req.query(`INSERT INTO SaleItems (SaleID, ProductID, Qty, UnitPrice) VALUES ${values.join(',')}`);
        itemCount += values.length;
      } catch (err) {
        console.warn(`  ⚠️ Kalem batch hatası (${i}): ${err.message}`);
      }
    }

    if (i % 10000 === 0 && i > 0) {
      process.stdout.write(`  ... ${i.toLocaleString()}/${validItems.length.toLocaleString()} kalem eklendi\r`);
    }
  }
  console.log('');
  logStep('Satış Kalemleri', itemCount);
  if (skippedItems > 0) console.log(`  ℹ️ ${skippedItems} kalem eşleşme bulunamadığı için atlandı.`);

  // Geçici sütunu kaldır
  try { await tgt.request().query(`ALTER TABLE Sales DROP COLUMN OldRef`); } catch { }
}

// ═══════════════════════════════════════════════════════════════
// 10. ALIŞ FATURALARI (batch)
// ═══════════════════════════════════════════════════════════════
async function migrateAlisFaturasi(src, tgt) {
  const { recordset: rows } = await src.request().query(`
    SELECT af.ID, af.ToptanciBarkot, af.Tarih, af.FaturaNo, af.IrsaliyeNo,
           af.KDV, af.Aciklama, af.ClosedInvoice, t.Isim AS ToptanciIsim
    FROM AlisFaturasi af LEFT JOIN Toptanci t ON af.ToptanciBarkot = t.Barkot
  `);

  let invCount = 0, itemCount = 0;
  const invoiceIdMap = {};

  // Geçici sütun
  try {
    await tgt.request().query(`
      IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name='OldRef' AND Object_ID=Object_ID('Invoices'))
      ALTER TABLE Invoices ADD OldRef NVARCHAR(50)
    `);
  } catch { }

  for (const row of rows) {
    const counterparty = safeStr(row.ToptanciIsim) || 'Bilinmeyen';
    const accountId = cache.barkotToAccountId[safeStr(row.ToptanciBarkot)] || null;
    try {
      const r = await tgt.request()
        .input('ino', sql.NVarChar, safeStr(row.FaturaNo))
        .input('tp', sql.NVarChar, 'Alış Faturası')
        .input('cp', sql.NVarChar, counterparty)
        .input('ai', sql.Int, accountId)
        .input('wn', sql.NVarChar, safeStr(row.IrsaliyeNo))
        .input('desc', sql.NVarChar, safeStr(row.Aciklama))
        .input('io', sql.Int, row.ClosedInvoice ? 0 : 1)
        .input('ca', sql.DateTime, row.Tarih)
        .input('oref', sql.NVarChar, `AF_${row.ID}`)
        .query(`INSERT INTO Invoices(InvoiceNo,Type,Counterparty,TotalAmount,SubTotal,TotalDiscount,TotalVat,
                Description,AccountID,WaybillNo,IsOpen,CreatedAt,OldRef)
                OUTPUT INSERTED.ID
                VALUES(@ino,@tp,@cp,0,0,0,0,@desc,@ai,@wn,@io,@ca,@oref)`);
      const id = r.recordset[0]?.ID;
      if (id) { invoiceIdMap[row.ID] = id; invCount++; }
    } catch { }
  }
  logStep('Alış Faturaları', invCount);

  // Kalemleri toplu ekle
  const { recordset: allItems } = await src.request().query(`
    SELECT FaturaID, Barkot, Adet, BirimFiyat, KDV, IndirimOrani, Indirim, FiyatKDVDahil
    FROM AlisFaturasiUrun
  `);

  const validItems = [];
  for (const it of allItems) {
    const invoiceId = invoiceIdMap[it.FaturaID];
    const productId = cache.barcodeToProductId[safeStr(it.Barkot)];
    if (!invoiceId || !productId) continue;
    validItems.push({
      invoiceId, productId,
      qty: safeInt(it.Adet) || 1,
      unitPrice: safeNum(it.BirimFiyat),
      vatRate: safeNum(it.KDV),
      disc1: safeNum(it.IndirimOrani),
      rowTotal: safeNum(it.FiyatKDVDahil) - safeNum(it.Indirim)
    });
  }

  for (let i = 0; i < validItems.length; i += BATCH_SIZE) {
    const batch = validItems.slice(i, i + BATCH_SIZE);
    const req = tgt.request();
    const vals = [];
    for (let j = 0; j < batch.length; j++) {
      const it = batch[j];
      const x = `${i}_${j}`;
      req.input(`i${x}`, sql.Int, it.invoiceId);
      req.input(`p${x}`, sql.Int, it.productId);
      req.input(`q${x}`, sql.Int, it.qty);
      req.input(`u${x}`, sql.Float, it.unitPrice);
      req.input(`v${x}`, sql.Float, it.vatRate);
      req.input(`d${x}`, sql.Float, it.disc1);
      req.input(`r${x}`, sql.Float, it.rowTotal);
      vals.push(`(@i${x},@p${x},@q${x},@u${x},@v${x},N'Hariç',@d${x},0,0,@r${x})`);
    }
    if (vals.length > 0) {
      try {
        await req.query(`INSERT INTO InvoiceItems(InvoiceID,ProductID,Qty,UnitPrice,VatRate,VatType,Disc1,Disc2,Disc3,RowTotal)
                         VALUES ${vals.join(',')}`);
        itemCount += vals.length;
      } catch { }
    }
  }
  logStep('Alış Fatura Kalemleri', itemCount);

  // Fatura toplamlarını güncelle
  try {
    await tgt.request().query(`
      UPDATE Invoices SET
        TotalAmount = ISNULL((SELECT SUM(RowTotal) FROM InvoiceItems WHERE InvoiceID = Invoices.ID), 0),
        SubTotal = ISNULL((SELECT SUM(Qty * UnitPrice) FROM InvoiceItems WHERE InvoiceID = Invoices.ID), 0)
      WHERE OldRef LIKE 'AF_%'
    `);
  } catch { }

  // Geçici sütunu kaldır
  try { await tgt.request().query(`ALTER TABLE Invoices DROP COLUMN OldRef`); } catch { }
}

// ═══════════════════════════════════════════════════════════════
// 11. GENEL FATURALAR
// ═══════════════════════════════════════════════════════════════
async function migrateFaturaList(src, tgt) {
  const { recordset: rows } = await src.request().query(`
    SELECT FATID, CARIID, EVRAKNO, BELGENO, FATURATURU,
           CHISMI, FTTARIH, YEKUN, VD, VN, TCKN, TEL1, ADRES, IL, ILCE, NOT1,
           KDV1, KDV8, KDV18, ISK1TUTAR, ISK2TUTAR, ISK3TUTAR, ACIKKAPALI
    FROM FaturaList
  `);

  let invCount = 0, itemCount = 0;
  const invoiceIdMap = {};

  for (const row of rows) {
    const cp = safeStr(row.CHISMI) || 'Bilinmeyen';
    const accountId = cache.cariIdToAccountId[row.CARIID] || null;
    const totalVat = safeNum(row.KDV1) + safeNum(row.KDV8) + safeNum(row.KDV18);
    const totalDisc = safeNum(row.ISK1TUTAR) + safeNum(row.ISK2TUTAR) + safeNum(row.ISK3TUTAR);
    const addr = [safeStr(row.ADRES), safeStr(row.IL), safeStr(row.ILCE)].filter(Boolean).join(', ');
    let type = 'Fatura';
    switch (safeInt(row.FATURATURU)) {
      case 1: type = 'Alış Faturası'; break;
      case 2: type = 'Satış Faturası'; break;
      case 3: type = 'Alış İade'; break;
      case 4: type = 'Satış İade'; break;
    }
    try {
      const r = await tgt.request()
        .input('ino', sql.NVarChar, safeStr(row.EVRAKNO) || safeStr(row.BELGENO))
        .input('tp', sql.NVarChar, type).input('cp', sql.NVarChar, cp)
        .input('ta', sql.Float, safeNum(row.YEKUN)).input('tv', sql.Float, totalVat)
        .input('td', sql.Float, totalDisc).input('desc', sql.NVarChar, safeStr(row.NOT1))
        .input('ai', sql.Int, accountId).input('to', sql.NVarChar, safeStr(row.VD))
        .input('tn', sql.NVarChar, safeStr(row.VN) || safeStr(row.TCKN))
        .input('ad', sql.NVarChar, addr || null).input('ph', sql.NVarChar, safeStr(row.TEL1))
        .input('io', sql.Int, safeInt(row.ACIKKAPALI) === 1 ? 1 : 0)
        .input('ca', sql.DateTime, row.FTTARIH || new Date())
        .query(`INSERT INTO Invoices(InvoiceNo,Type,Counterparty,TotalAmount,SubTotal,TotalDiscount,TotalVat,
                Description,AccountID,TaxOffice,TaxNumber,Address,Phone,IsOpen,CreatedAt)
                OUTPUT INSERTED.ID
                VALUES(@ino,@tp,@cp,@ta,@ta,@td,@tv,@desc,@ai,@to,@tn,@ad,@ph,@io,@ca)`);
      const id = r.recordset[0]?.ID;
      if (id) { invoiceIdMap[row.FATID] = id; invCount++; }
    } catch { }
  }
  logStep('Genel Faturalar', invCount);

  // Kalemleri toplu
  const { recordset: allItems } = await src.request().query(`
    SELECT FATID, BARKOT, MIKTAR, BIRIMFIYAT, KDV, ISK1, ISK2, ISK3, TOPLAM, KDVLITP
    FROM FaturaIcerik
  `);
  const validItems = [];
  for (const it of allItems) {
    const invoiceId = invoiceIdMap[it.FATID];
    const productId = cache.barcodeToProductId[safeStr(it.BARKOT)];
    if (!invoiceId || !productId) continue;
    validItems.push({
      invoiceId, productId,
      qty: safeInt(it.MIKTAR) || 1,
      unitPrice: safeNum(it.BIRIMFIYAT),
      vatRate: safeNum(it.KDV),
      disc1: safeNum(it.ISK1), disc2: safeNum(it.ISK2), disc3: safeNum(it.ISK3),
      rowTotal: safeNum(it.KDVLITP) || safeNum(it.TOPLAM)
    });
  }
  for (let i = 0; i < validItems.length; i += BATCH_SIZE) {
    const batch = validItems.slice(i, i + BATCH_SIZE);
    const req = tgt.request();
    const vals = [];
    for (let j = 0; j < batch.length; j++) {
      const it = batch[j];
      const x = `${i}_${j}`;
      req.input(`i${x}`, sql.Int, it.invoiceId); req.input(`p${x}`, sql.Int, it.productId);
      req.input(`q${x}`, sql.Int, it.qty); req.input(`u${x}`, sql.Float, it.unitPrice);
      req.input(`v${x}`, sql.Float, it.vatRate); req.input(`d1${x}`, sql.Float, it.disc1);
      req.input(`d2${x}`, sql.Float, it.disc2); req.input(`d3${x}`, sql.Float, it.disc3);
      req.input(`r${x}`, sql.Float, it.rowTotal);
      vals.push(`(@i${x},@p${x},@q${x},@u${x},@v${x},N'Hariç',@d1${x},@d2${x},@d3${x},@r${x})`);
    }
    if (vals.length > 0) {
      try {
        await req.query(`INSERT INTO InvoiceItems(InvoiceID,ProductID,Qty,UnitPrice,VatRate,VatType,Disc1,Disc2,Disc3,RowTotal)
                         VALUES ${vals.join(',')}`);
        itemCount += vals.length;
      } catch { }
    }
  }
  logStep('Genel Fatura Kalemleri', itemCount);
}

// ═══════════════════════════════════════════════════════════════
// 12. CARİ HAREKETLER (batch)
//    Strateji:
//    1) FaturaList.FATURATURU ile JOIN → fatura tipinden Borç/Alacak belirle
//    2) Açıklama/EvrakNo keyword analizi (İADE, DEPOZITO, ÖDEME vs.)
//    3) BA alanı fallback
// ═══════════════════════════════════════════════════════════════
async function migrateCariHareketler(src, tgt) {
  const { recordset: rows } = await src.request().query(`
    SELECT ch.CariId, ch.Tarih, ch.IslemTipi, ch.EvrakNo, ch.Tutar,
           ch.Aciklama, ch.BA, ch.FatID,
           fl.FATURATURU
    FROM CariHareketler ch
    LEFT JOIN FaturaList fl ON ch.FatID = fl.FATID
  `);

  const validRows = [];
  for (const row of rows) {
    const accountId = cache.cariIdToAccountId[row.CariId];
    if (!accountId) continue;

    let type = null;
    const desc = (safeStr(row.Aciklama) || safeStr(row.EvrakNo) || '').toUpperCase();

    // Strategy 1: FaturaList.FATURATURU (most reliable)
    if (row.FATURATURU != null) {
      const ft = safeInt(row.FATURATURU);
      if (ft === 1) type = 'Borç';       // Alış Faturası — we owe supplier
      else if (ft === 2) type = 'Alacak'; // Satış Faturası — customer owes us
      else if (ft === 3) type = 'Alacak'; // Alış İade — supplier owes us back
      else if (ft === 4) type = 'Borç';   // Satış İade — we owe customer back
    }

    // Strategy 2: Description keyword analysis
    if (!type) {
      if (desc.includes('IADE') || desc.includes('İADE')) {
        type = 'Alacak'; // Returns = credit
      } else if (desc.includes('DEPOZITO') || desc.includes('TAHSILAT') || desc.includes('TAHSİLAT')
              || desc.includes('ODEME') || desc.includes('ÖDEME') || desc.includes('TEDIYE')
              || desc.includes('TEDİYE') || desc.includes('HAVALE') || desc.includes('VIRMAN')) {
        type = 'Alacak'; // Payments/deposits/transfers = credit
      } else if (desc.includes('ALIS') || desc.includes('ALIŞ') || desc.includes('FATURA')) {
        type = 'Borç'; // Purchase invoices = debit
      }
    }

    // Strategy 3: BA field fallback
    if (!type) {
      type = safeInt(row.BA) === 1 ? 'Alacak' : 'Borç';
    }

    validRows.push({
      accountId,
      type,
      amount: safeNum(row.Tutar),
      description: safeStr(row.Aciklama) || safeStr(row.EvrakNo) || '',
      createdAt: row.Tarih || new Date()
    });
  }

  let count = 0;
  for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
    const batch = validRows.slice(i, i + BATCH_SIZE);
    const req = tgt.request();
    const vals = [];
    for (let j = 0; j < batch.length; j++) {
      const r = batch[j];
      const x = `${i}_${j}`;
      req.input(`a${x}`, sql.Int, r.accountId);
      req.input(`t${x}`, sql.NVarChar, r.type);
      req.input(`m${x}`, sql.Float, r.amount);
      req.input(`d${x}`, sql.NVarChar, r.description);
      req.input(`c${x}`, sql.DateTime, r.createdAt);
      vals.push(`(@a${x},@t${x},@m${x},@d${x},NULL,NULL,@c${x})`);
    }
    if (vals.length > 0) {
      try {
        await req.query(`INSERT INTO AccountLedger(AccountID,Type,Amount,Description,RefType,RefID,CreatedAt) VALUES ${vals.join(',')}`);
        count += vals.length;
      } catch { }
    }
  }
  logStep('Cari Hareketler', count);
}

// ═══════════════════════════════════════════════════════════════
// 13. MUHASEBE İŞLEMLERİ (batch)
// ═══════════════════════════════════════════════════════════════
async function migrateAccountTransactions(src, tgt) {
  const { recordset: rows } = await src.request().query(`
    SELECT hb.HareketNo, hb.Tarih, hb.HareketTuru, hb.Toplam, hb.Barkod,
           hb.FaturaNo, hb.Aciklama, ho.OdemeTuru, ho.KasaNo
    FROM HareketBaslik hb
    LEFT JOIN (
      SELECT HareketNo, MIN(OdemeTuru) AS OdemeTuru, MIN(KasaNo) AS KasaNo
      FROM HareketOdeme GROUP BY HareketNo
    ) ho ON hb.HareketNo = ho.HareketNo
    WHERE hb.HareketTuru IN ('TH','GI','KG','KC')
  `);

  const txItems = [];
  const cashItems = [];
  const ledgerItems = []; // AccountLedger entries for TH (payment/collection) records

  for (const row of rows) {
    const tur = safeStr(row.HareketTuru);
    const amount = safeNum(row.Toplam);
    const accountId = cache.barkotToAccountId[safeStr(row.Barkod)] || null;
    const cashRegisterId = cache.oldKasaToNew[safeInt(row.KasaNo)] || null;
    const desc = safeStr(row.Aciklama) || safeStr(row.FaturaNo) || '';
    let pm = 'Cash';
    if (safeInt(row.OdemeTuru) === 2) pm = 'CreditCard';

    let type = 'Other', cp = '';
    if (tur === 'TH') { type = 'Collection'; cp = 'Tahsilat'; }
    else if (tur === 'GI') { type = 'Expense'; cp = safeStr(row.FaturaNo) || 'Gider'; }
    else if (tur === 'KG') { type = 'CashIn'; cp = 'Kasa Giriş'; }
    else if (tur === 'KC') { type = 'CashOut'; cp = 'Kasa Çıkış'; }

    txItems.push({ type, amount, desc, cp, accountId, pm, createdAt: row.Tarih });

    // TH (Tahsilat/Ödeme) records with an accountId should also appear in AccountLedger
    if (tur === 'TH' && accountId) {
      ledgerItems.push({
        accountId,
        type: 'Alacak', // Payment/collection = Alacak (reduces what they owe us, or what we owe them)
        amount,
        description: desc || 'Tahsilat/Ödeme',
        createdAt: row.Tarih || new Date()
      });
    }

    if (cashRegisterId) {
      const cashType = (tur === 'KG' || tur === 'TH') ? 'Giriş' : 'Çıkış';
      cashItems.push({ cashRegisterId, type: cashType, amount, desc, createdAt: row.Tarih });
    }
  }

  // AccountTransactions batch
  let txCount = 0;
  for (let i = 0; i < txItems.length; i += BATCH_SIZE) {
    const batch = txItems.slice(i, i + BATCH_SIZE);
    const req = tgt.request();
    const vals = [];
    for (let j = 0; j < batch.length; j++) {
      const r = batch[j];
      const x = `${i}_${j}`;
      req.input(`t${x}`, sql.NVarChar, r.type); req.input(`m${x}`, sql.Float, r.amount);
      req.input(`d${x}`, sql.NVarChar, r.desc); req.input(`cp${x}`, sql.NVarChar, r.cp);
      req.input(`ai${x}`, sql.Int, r.accountId); req.input(`pm${x}`, sql.NVarChar, r.pm);
      req.input(`ca${x}`, sql.DateTime, r.createdAt);
      vals.push(`(@t${x},@m${x},@d${x},@cp${x},NULL,NULL,@ai${x},@pm${x},@ca${x})`);
    }
    if (vals.length > 0) {
      try {
        await req.query(`INSERT INTO AccountTransactions(Type,Amount,Description,Counterparty,SaleID,InvoiceID,AccountID,PaymentMethod,CreatedAt)
                         VALUES ${vals.join(',')}`);
        txCount += vals.length;
      } catch { }
    }
  }
  logStep('Muhasebe İşlemleri', txCount);

  // AccountLedger entries for TH records (payments/collections)
  let ledgerCount = 0;
  for (let i = 0; i < ledgerItems.length; i += BATCH_SIZE) {
    const batch = ledgerItems.slice(i, i + BATCH_SIZE);
    const req = tgt.request();
    const vals = [];
    for (let j = 0; j < batch.length; j++) {
      const r = batch[j];
      const x = `${i}_${j}`;
      req.input(`a${x}`, sql.Int, r.accountId);
      req.input(`t${x}`, sql.NVarChar, r.type);
      req.input(`m${x}`, sql.Float, r.amount);
      req.input(`d${x}`, sql.NVarChar, r.description);
      req.input(`c${x}`, sql.DateTime, r.createdAt);
      vals.push(`(@a${x},@t${x},@m${x},@d${x},NULL,NULL,@c${x})`);
    }
    if (vals.length > 0) {
      try {
        await req.query(`INSERT INTO AccountLedger(AccountID,Type,Amount,Description,RefType,RefID,CreatedAt) VALUES ${vals.join(',')}`);
        ledgerCount += vals.length;
      } catch { }
    }
  }
  logStep('Tahsilat/Ödeme Ledger', ledgerCount);

  // CashMovements batch
  let cashCount = 0;
  for (let i = 0; i < cashItems.length; i += BATCH_SIZE) {
    const batch = cashItems.slice(i, i + BATCH_SIZE);
    const req = tgt.request();
    const vals = [];
    for (let j = 0; j < batch.length; j++) {
      const r = batch[j];
      const x = `${i}_${j}`;
      req.input(`cr${x}`, sql.Int, r.cashRegisterId); req.input(`t${x}`, sql.NVarChar, r.type);
      req.input(`m${x}`, sql.Float, r.amount); req.input(`d${x}`, sql.NVarChar, r.desc);
      req.input(`ca${x}`, sql.DateTime, r.createdAt);
      vals.push(`(@cr${x},@t${x},@m${x},@d${x},NULL,NULL,@ca${x})`);
    }
    if (vals.length > 0) {
      try {
        await req.query(`INSERT INTO CashMovements(CashRegisterID,Type,Amount,Description,RefType,RefID,CreatedAt)
                         VALUES ${vals.join(',')}`);
        cashCount += vals.length;
      } catch { }
    }
  }
  logStep('Kasa Hareketleri', cashCount);

  // ═══════════════════════════════════════════════════════════════
  // Satışları ve Faturaları AccountTransactions'a Ekle
  // ═══════════════════════════════════════════════════════════════
  try {
    const resSales = await tgt.request().query(`
      INSERT INTO AccountTransactions (Type, Amount, Description, SaleID, PaymentMethod, CreatedAt, AccountID)
      SELECT 'Sale', TotalAmount, 'Satis #' + CAST(ID AS NVARCHAR), ID, PaymentMethod, CreatedAt, AccountID
      FROM Sales s
      WHERE NOT EXISTS (SELECT 1 FROM AccountTransactions a WHERE a.SaleID = s.ID)
    `);
    logStep('Hesap Hareketleri (Satışlar)', resSales.rowsAffected[0]);

    const resInvoices = await tgt.request().query(`
      INSERT INTO AccountTransactions (Type, Amount, Description, InvoiceID, PaymentMethod, CreatedAt, AccountID)
      SELECT
        CASE 
          WHEN Type = 'Satış Faturası' THEN 'Sale'
          WHEN Type = 'Alış Faturası' THEN 'Purchase'
          WHEN Type = 'Satış İade' THEN 'Sale Return'
          WHEN Type = 'Alış İade' THEN 'Purchase Return'
          ELSE 'Unknown'
        END,
        TotalAmount, 
        Type + ' #' + CAST(ID AS NVARCHAR), 
        ID, 
        'Nakit', 
        CreatedAt, 
        AccountID
      FROM Invoices i
      WHERE Type != 'İrsaliye' 
        AND NOT EXISTS (SELECT 1 FROM AccountTransactions a WHERE a.InvoiceID = i.ID)
    `);
    logStep('Hesap Hareketleri (Faturalar)', resInvoices.rowsAffected[0]);
  } catch (err) { }
}

// ════════════════════════════
// ÇALIŞTIR
// ════════════════════════════
migrate();
