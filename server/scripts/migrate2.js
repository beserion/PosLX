/**
 * MarcaPOS → PosLX TAM Veri Aktarım Scripti
 *
 * KULLANIM:
 *   1. create_missing_tables.sql dosyasını POSLX DB'de çalıştırın
 *   2. node scripts/migrate.js
 *
 * Aktarılan tablolar:
 *   Mevcut: Categories, Products, ProductBarcodes, Accounts, Staff,
 *            Couriers, CashRegisters, Sales, SaleItems, Invoices,
 *            InvoiceItems, AccountLedger, AccountTransactions, CashMovements
 *   YENİ:   SalePayments, DeliveryOrders, StockMovements, StockAdjustments,
 *            VoidItems, PriceChangeLog, DailyReports, LegacyParameters,
 *            Cities, Districts, ProductLocations, MiscMovements
 */

import sql from 'mssql';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const BATCH_SIZE = 200;

// ════════════════════════════════════════════════════════════════
// KAYNAK VERİTABANI (MarcaPOS)
// ════════════════════════════════════════════════════════════════
const SOURCE_RAW = process.env.SOURCE_SERVER || 'localhost\\MSSQLSERVER01';
const [SRC_HOST, SRC_INST] = SOURCE_RAW.includes('\\')
  ? SOURCE_RAW.split('\\') : [SOURCE_RAW, undefined];

const SOURCE_CONFIG = {
  user: process.env.SOURCE_USER || 'sa',
  password: process.env.SOURCE_PASS || '123',
  server: SRC_HOST,
  database: process.env.SOURCE_DB || 'MarcaPOS',
  ...(SRC_INST ? {} : { port: 1433 }),
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
    ...(SRC_INST ? { instanceName: SRC_INST } : {}),
  },
};

// ════════════════════════════════════════════════════════════════
// HEDEF VERİTABANI (PosLX)
// ════════════════════════════════════════════════════════════════
let extCfg = {};
try {
  const cfgPath = [
    path.join(process.cwd(), 'config.json'),
    path.join(__dirname, '..', 'config.json'),
  ].find(p => fs.existsSync(p));
  if (cfgPath) extCfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
} catch { }

const ec = k => extCfg[k] || process.env[k];
const rawTgt = ec('DB_SERVER') || 'localhost';
const [TGT_HOST, TGT_INST] = rawTgt.includes('\\') ? rawTgt.split('\\') : [rawTgt, undefined];

const TARGET_CONFIG = {
  user: ec('DB_USER') || 'sa',
  password: ec('DB_PASS') || 'YourPassword123!',
  server: TGT_HOST,
  database: ec('DB_NAME') || 'poslx',
  ...(TGT_INST ? {} : { port: parseInt(ec('DB_PORT')) || 1433 }),
  options: {
    encrypt: String(ec('DB_ENCRYPT')) === 'true',
    trustServerCertificate: String(ec('DB_TRUST_SERVER_CERTIFICATE')) !== 'false',
    enableArithAbort: true,
    ...(TGT_INST ? { instanceName: TGT_INST } : {}),
  },
};

// ════════════════════════════════════════════════════════════════
// YARDIMCILAR
// ════════════════════════════════════════════════════════════════
const safeStr = v => (v == null ? null : String(v).trim());
const safeNum = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const safeInt = v => { const n = parseInt(v); return isNaN(n) ? 0 : n; };

const stats = {};
const errors = [];
const logStep = (step, count, skipped = 0) => {
  stats[step] = count;
  const s = skipped > 0 ? ` (${skipped} atlandı)` : '';
  console.log(`  ✅ ${step}: ${count.toLocaleString()} kayıt${s}`);
};
const logError = (ctx, e) => {
  const m = `[${ctx}] ${e.message}`;
  errors.push(m);
  console.warn(`  ⚠️  ${m}`);
};

// ID eşleştirme önbellekleri
const cache = {
  barcodeToProductId: {},   // barkot → Products.ID
  barkotToAccountId: {},   // müşteri/toptancı barkot → Accounts.ID
  cariIdToAccountId: {},   // CariList.CARIID → Accounts.ID
  oldStaffToNewStaff: {},   // Personel.PersonelNo → Staff.ID
  oldCourierToNew: {},   // KuryeList.id → Couriers.ID
  oldKasaToNew: {},   // Kasa.KasaNo → CashRegisters.ID
};

// ════════════════════════════════════════════════════════════════
// ANA FONKSİYON
// ════════════════════════════════════════════════════════════════
async function migrate() {
  let src, tgt;
  try {
    console.log('\n══════════════════════════════════════════════');
    console.log('  MarcaPOS → PosLX TAM Veri Aktarımı');
    console.log('══════════════════════════════════════════════\n');

    src = await new sql.ConnectionPool(SOURCE_CONFIG).connect();
    console.log(`✅ Kaynak: ${SOURCE_CONFIG.server}/${SOURCE_CONFIG.database}`);
    tgt = await new sql.ConnectionPool(TARGET_CONFIG).connect();
    console.log(`✅ Hedef:  ${TARGET_CONFIG.server}/${TARGET_CONFIG.database}\n`);

    // Eski DB'deki HareketTuru kodlarını göster
    const { recordset: turler } = await src.request().query(
      `SELECT HareketTuru, COUNT(*) AS Adet FROM HareketBaslik GROUP BY HareketTuru ORDER BY Adet DESC`
    );
    console.log('📋 HareketTuru kodları:', turler.map(r => `${r.HareketTuru}(${r.Adet})`).join('  '));
    console.log('');

    console.log('── 0. Temizleniyor...');
    await cleanTargetDb(tgt);
    console.log('  ✅ Temizlendi.\n');

    const t0 = Date.now();

    // ── Temel tablolar ───────────────────────────────────────
    console.log('── 1. Kategoriler...'); await migrateCategories(src, tgt);
    console.log('── 2. Ürünler...'); await migrateProducts(src, tgt);
    await loadBarcodeCache(tgt);
    console.log('── 3. Müşteriler...'); await migrateMusteri(src, tgt);
    console.log('── 4. Toptancılar...'); await migrateToptanci(src, tgt);
    console.log('── 5. Cari Hesaplar...'); await migrateCariList(src, tgt);
    console.log('── 6. Personel...'); await migratePersonel(src, tgt);
    console.log('── 7. Kuryeler...'); await migrateKuryeler(src, tgt);
    console.log('── 8. Kasalar...'); await migrateKasalar(src, tgt);

    // ── Satışlar ─────────────────────────────────────────────
    console.log('── 9. Satışlar (SA/SI)...'); await migrateSales(src, tgt);
    console.log('── 10. Ödeme Detayları...'); await migrateSalePayments(src, tgt);

    // ── Faturalar ────────────────────────────────────────────
    console.log('── 11. Alış Faturaları...'); await migrateAlisFaturasi(src, tgt);
    console.log('── 12. Genel Faturalar...'); await migrateFaturaList(src, tgt);

    // ── Cari / Muhasebe ──────────────────────────────────────
    console.log('── 13. Cari Hareketler...'); await migrateCariHareketler(src, tgt);
    console.log('── 14. Muhasebe...'); await migrateAccountTransactions(src, tgt);

    // ── YENİ: Daha önce aktarılmayan tablolar ────────────────
    console.log('── 15. Muhtelif Hareketler (MG/MC)...');
    await migrateMiscMovements(src, tgt);

    console.log('── 16. Servis/Teslimat Siparişleri...');
    await migrateDeliveryOrders(src, tgt);

    console.log('── 17. Stok Hareketleri...');
    await migrateStockMovements(src, tgt);

    console.log('── 18. Stok Başlangıç/Düzeltme...');
    await migrateStockAdjustments(src, tgt);

    console.log('── 19. İptal Logları...');
    await migrateVoidItems(src, tgt);

    console.log('── 20. Fiyat Değişiklik Geçmişi...');
    await migratePriceChangeLog(src, tgt);

    console.log('── 21. Günlük Raporlar...');
    await migrateDailyReports(src, tgt);

    console.log('── 22. Ürün Konumları (UrunLoc)...');
    await migrateProductLocations(src, tgt);

    console.log('── 23. Sistem Parametreleri...');
    await migrateParameters(src, tgt);

    console.log('── 24. İl / İlçe...');
    await migrateCities(src, tgt);

    // ── Özet ─────────────────────────────────────────────────
    const mins = ((Date.now() - t0) / 60000).toFixed(1);
    console.log('\n══════════════════════════════════════════════');
    console.log('  AKTARIM TAMAMLANDI 🎉  ' + mins + ' dakika');
    console.log('══════════════════════════════════════════════');
    for (const [step, count] of Object.entries(stats))
      console.log(`  ${step}: ${count.toLocaleString()}`);
    if (errors.length)
      console.log(`\n⚠️  ${errors.length} uyarı — ilk 10:\n` + errors.slice(0, 10).join('\n'));

  } catch (e) {
    console.error('\n❌ KRİTİK HATA:', e.message, '\n', e.stack);
  } finally {
    if (src) await src.close();
    if (tgt) await tgt.close();
  }
}

// ════════════════════════════════════════════════════════════════
// 0. TEMİZLE
// ════════════════════════════════════════════════════════════════
async function cleanTargetDb(tgt) {
  const tables = [
    // yeni tablolar (önce bağımlılar)
    'MiscMovements', 'VoidItems', 'PriceChangeLog', 'DailyReports',
    'StockAdjustments', 'StockMovements', 'DeliveryOrders', 'SalePayments',
    'ProductLocations', 'LegacyParameters', 'Districts', 'Cities',
    // mevcut tablolar
    'CashMovements', 'CancellationLogs', 'AccountLedger', 'AccountTransactions',
    'InvoiceItems', 'SaleItems', 'PurchaseOrderItems', 'StockBatches',
    'CourierSettlements', 'CourierDailyStats', 'SpecialPrices', 'PriceChanges',
    'ProductBarcodes', 'PurchaseOrders', 'Invoices', 'Sales',
    'CashRegisters', 'Couriers', 'Staff', 'Accounts', 'Products', 'Categories',
  ];
  for (const t of tables) {
    try { await tgt.request().query(`IF OBJECT_ID('${t}') IS NOT NULL DELETE FROM ${t}`); }
    catch (e) { logError(`Temizle(${t})`, e); }
  }
  for (const t of tables) {
    try { await tgt.request().query(`IF OBJECT_ID('${t}') IS NOT NULL DBCC CHECKIDENT('${t}', RESEED, 0)`); }
    catch { }
  }
}

// ════════════════════════════════════════════════════════════════
// BARKOT ÖNBELLEĞİ
// ════════════════════════════════════════════════════════════════
async function loadBarcodeCache(tgt) {
  const { recordset } = await tgt.request()
    .query(`SELECT ProductID, Barcode FROM ProductBarcodes`);
  for (const r of recordset) cache.barcodeToProductId[r.Barcode] = r.ProductID;
  console.log(`  📦 Barkot önbelleği: ${recordset.length.toLocaleString()} kayıt\n`);
}

// ════════════════════════════════════════════════════════════════
// 1. KATEGORİLER
// ════════════════════════════════════════════════════════════════
async function migrateCategories(src, tgt) {
  const { recordset } = await src.request().query(`SELECT Id, Isim FROM UrunGrup`);
  let n = 0;
  for (const r of recordset) {
    try {
      const res = await tgt.request().input('nm', sql.NVarChar, safeStr(r.Isim) || 'Genel')
        .query(`INSERT INTO Categories(Name) OUTPUT INSERTED.ID VALUES(@nm)`);
      if (res.recordset[0]) n++;
    } catch (e) { logError('Kategori', e); }
  }
  logStep('Kategoriler', n);
}

// ════════════════════════════════════════════════════════════════
// 2. ÜRÜNLER
// ════════════════════════════════════════════════════════════════
async function migrateProducts(src, tgt) {
  const { recordset } = await src.request().query(`
    SELECT u.*, ug.Isim AS GrupIsim
    FROM Urun u LEFT JOIN UrunGrup ug ON u.GrupId = ug.Id
  `);
  let prods = 0, barcodes = 0, errs = 0;
  for (let i = 0; i < recordset.length; i++) {
    const r = recordset[i];
    try {
      const res = await tgt.request()
        .input('nm', sql.NVarChar, safeStr(r.Adi) || 'İsimsiz')
        .input('stk', sql.Int, safeInt(r.StokAdedi))
        .input('cost', sql.Decimal(18, 2), safeNum(r.AlisFiyati))
        .input('sale', sql.Decimal(18, 2), safeNum(r.SatisFiyati))
        .input('p2', sql.Decimal(18, 2), safeNum(r.SatisFiyatiKrediKarti || r.SatisFiyati2))
        .input('cat', sql.NVarChar, safeStr(r.GrupIsim))
        .input('crit', sql.Int, safeInt(r.MinStok) || 5)
        .input('del', sql.Int, r.Aktif ? 0 : 1)
        .query(`INSERT INTO Products(Name,Stock,CostPrice,SalePrice,Price2,Category,CriticalStock,IsDeleted,ShowInPos)
                OUTPUT INSERTED.ID VALUES(@nm,@stk,@cost,@sale,@p2,@cat,@crit,@del,1)`);
      const newId = res.recordset[0]?.ID;
      if (!newId) continue;
      prods++;
      const bc = safeStr(r.Barkot);
      if (bc) {
        try {
          await tgt.request().input('pid', sql.Int, newId).input('bc', sql.NVarChar, bc)
            .query(`INSERT INTO ProductBarcodes(ProductID,Barcode) VALUES(@pid,@bc)`);
          barcodes++;
        } catch { }
      }
    } catch (e) { errs++; if (errs <= 3) logError(`Ürün(${r.Adi})`, e); }
    if (i % 500 === 0 && i > 0) process.stdout.write(`  ... ${i}/${recordset.length}\r`);
  }
  console.log('');
  logStep('Ürünler', prods, errs);
  logStep('Barkodlar', barcodes);
}

// ════════════════════════════════════════════════════════════════
// 3. MÜŞTERİLER
// ════════════════════════════════════════════════════════════════
async function migrateMusteri(src, tgt) {
  const { recordset } = await src.request().query(`
    SELECT MusteriNo,Barkot,Isim,Telefon,Borc,Alacak,
           VergiNo,VergiDaire,Adres,EPosta,CepTelefonu,il,ilce,FirmaAdi
    FROM Musteri
  `);
  let n = 0, errs = 0;
  for (const r of recordset) {
    const name = safeStr(r.Isim) || safeStr(r.FirmaAdi) || 'Müşteri';
    const addr = [r.Adres, r.il, r.ilce].map(safeStr).filter(Boolean).join(', ');
    try {
      const res = await tgt.request()
        .input('nm', sql.NVarChar, name)
        .input('ph', sql.NVarChar, safeStr(r.CepTelefonu) || safeStr(r.Telefon))
        .input('em', sql.NVarChar, safeStr(r.EPosta))
        .input('ad', sql.NVarChar, addr || null)
        .input('to', sql.NVarChar, safeStr(r.VergiDaire))
        .input('tn', sql.NVarChar, safeStr(r.VergiNo))
        .input('bl', sql.Float, safeNum(r.Borc) - safeNum(r.Alacak))
        .query(`INSERT INTO Accounts(Name,Type,Phone,Email,Address,TaxOffice,TaxNo,Balance)
                OUTPUT INSERTED.ID VALUES(@nm,'Müşteri',@ph,@em,@ad,@to,@tn,@bl)`);
      const id = res.recordset[0]?.ID;
      if (id) { cache.barkotToAccountId[safeStr(r.Barkot)] = id; n++; }
    } catch (e) { errs++; if (errs <= 3) logError('Müşteri', e); }
  }
  logStep('Müşteriler', n, errs);
}

// ════════════════════════════════════════════════════════════════
// 4. TOPTANCILAR
// ════════════════════════════════════════════════════════════════
async function migrateToptanci(src, tgt) {
  const { recordset } = await src.request().query(`
    SELECT ToptanciNo,Barkot,Isim,Telefon,Borc,Alacak,
           VergiNo,VergiDaire,Adres,Il,Ilce,Email
    FROM Toptanci
  `);
  let n = 0, errs = 0;
  for (const r of recordset) {
    const addr = [r.Adres, r.Il, r.Ilce].map(safeStr).filter(Boolean).join(', ');
    try {
      const res = await tgt.request()
        .input('nm', sql.NVarChar, safeStr(r.Isim) || 'Tedarikçi')
        .input('ph', sql.NVarChar, safeStr(r.Telefon))
        .input('em', sql.NVarChar, safeStr(r.Email))
        .input('ad', sql.NVarChar, addr || null)
        .input('to', sql.NVarChar, safeStr(r.VergiDaire))
        .input('tn', sql.NVarChar, safeStr(r.VergiNo))
        .input('bl', sql.Float, safeNum(r.Borc) - safeNum(r.Alacak))
        .query(`INSERT INTO Accounts(Name,Type,Phone,Email,Address,TaxOffice,TaxNo,Balance)
                OUTPUT INSERTED.ID VALUES(@nm,'Tedarikçi',@ph,@em,@ad,@to,@tn,@bl)`);
      const id = res.recordset[0]?.ID;
      if (id) { cache.barkotToAccountId[safeStr(r.Barkot)] = id; n++; }
    } catch (e) { errs++; if (errs <= 3) logError('Toptancı', e); }
  }
  logStep('Toptancılar', n, errs);
}

// ════════════════════════════════════════════════════════════════
// 5. CARİ HESAPLAR
// ════════════════════════════════════════════════════════════════
async function migrateCariList(src, tgt) {
  const { recordset } = await src.request().query(`
    SELECT cl.CARIID,cl.UNVAN,cl.TEL1,cl.CEPTEL,cl.EMAIL,
           cl.VD,cl.VN,cl.TCKN,cl.CARIKODU,
           cb.BORC,cb.ALACAK,cb.BAKIYE,
           ct.ACIKLAMA AS TipiAciklama,
           ca.ADRES,ca.IL,ca.ILCE
    FROM CariList cl
    LEFT JOIN CariBakiye cb ON cl.CARIID = cb.CARIID
    LEFT JOIN CariTipleri ct ON cl.TIPI = ct.ID
    LEFT JOIN (SELECT CARIID, MIN(ID) AS MinID FROM CariAdresler GROUP BY CARIID) x ON cl.CARIID = x.CARIID
    LEFT JOIN CariAdresler ca ON ca.ID = x.MinID
  `);
  let n = 0, errs = 0;
  for (const r of recordset) {
    const tipi = (safeStr(r.TipiAciklama) || '').toLowerCase();
    const isSupplier = ['tedarik', 'toptanc', 'satici', 'satıcı', 'supplier', 'vendor']
      .some(k => tipi.includes(k));
    const addr = [r.ADRES, r.IL, r.ILCE].map(safeStr).filter(Boolean).join(', ');
    try {
      const res = await tgt.request()
        .input('nm', sql.NVarChar, safeStr(r.UNVAN) || 'Cari')
        .input('tp', sql.NVarChar, isSupplier ? 'Tedarikçi' : 'Müşteri')
        .input('ph', sql.NVarChar, safeStr(r.CEPTEL) || safeStr(r.TEL1))
        .input('em', sql.NVarChar, safeStr(r.EMAIL))
        .input('ad', sql.NVarChar, addr || null)
        .input('to', sql.NVarChar, safeStr(r.VD))
        .input('tn', sql.NVarChar, safeStr(r.VN) || safeStr(r.TCKN))
        .input('bl', sql.Float, safeNum(r.BAKIYE) || (safeNum(r.BORC) - safeNum(r.ALACAK)))
        .query(`INSERT INTO Accounts(Name,Type,Phone,Email,Address,TaxOffice,TaxNo,Balance)
                OUTPUT INSERTED.ID VALUES(@nm,@tp,@ph,@em,@ad,@to,@tn,@bl)`);
      const id = res.recordset[0]?.ID;
      if (id) {
        cache.cariIdToAccountId[r.CARIID] = id;
        if (r.CARIKODU) cache.barkotToAccountId[safeStr(r.CARIKODU)] = id;
        n++;
      }
    } catch (e) { errs++; if (errs <= 3) logError('Cari', e); }
  }
  logStep('Cari Hesaplar', n, errs);
}

// ════════════════════════════════════════════════════════════════
// 6. PERSONEL
// ════════════════════════════════════════════════════════════════
async function migratePersonel(src, tgt) {
  const { recordset } = await src.request().query(`
    SELECT p.PersonelNo,p.Isim,p.Sifre,p.Aktif,
           ISNULL(py.Yonetici,0) AS Yonetici
    FROM Personel p
    LEFT JOIN PersonelYetki py ON py.PersonelNo = p.PersonelNo
  `);
  let n = 0;
  for (const r of recordset) {
    try {
      const res = await tgt.request()
        .input('nm', sql.NVarChar, safeStr(r.Isim) || 'Personel')
        .input('rl', sql.NVarChar, r.Yonetici ? 'Admin' : 'Cashier')
        .input('pn', sql.NVarChar, safeStr(r.Sifre) || '1234')
        .input('ac', sql.Int, r.Aktif ? 1 : 0)
        .query(`INSERT INTO Staff(Name,Role,Pin,IsActive) OUTPUT INSERTED.ID VALUES(@nm,@rl,@pn,@ac)`);
      const id = res.recordset[0]?.ID;
      if (id) { cache.oldStaffToNewStaff[r.PersonelNo] = id; n++; }
    } catch (e) { logError('Personel', e); }
  }
  logStep('Personel', n);
}

// ════════════════════════════════════════════════════════════════
// 7. KURYELER
// ════════════════════════════════════════════════════════════════
async function migrateKuryeler(src, tgt) {
  const { recordset } = await src.request().query(`SELECT id,KuryeAdi,Telefon FROM KuryeList`);
  let n = 0;
  for (const r of recordset) {
    try {
      const res = await tgt.request()
        .input('nm', sql.NVarChar, safeStr(r.KuryeAdi) || 'Kurye')
        .input('ph', sql.NVarChar, safeStr(r.Telefon))
        .query(`INSERT INTO Couriers(Name,Phone,Status) OUTPUT INSERTED.ID VALUES(@nm,@ph,'Idle')`);
      const id = res.recordset[0]?.ID;
      if (id) { cache.oldCourierToNew[r.id] = id; n++; }
    } catch (e) { logError('Kurye', e); }
  }
  logStep('Kuryeler', n);
}

// ════════════════════════════════════════════════════════════════
// 8. KASALAR
// ════════════════════════════════════════════════════════════════
async function migrateKasalar(src, tgt) {
  const { recordset } = await src.request().query(`SELECT KasaNo,KasaAdi,KasaTipi FROM Kasa`);
  let n = 0;
  for (const r of recordset) {
    const tp = r.KasaTipi === 0 ? 'Nakit' : r.KasaTipi === 2 ? 'POS' : 'Banka';
    try {
      const res = await tgt.request()
        .input('nm', sql.NVarChar, safeStr(r.KasaAdi) || 'Kasa')
        .input('tp', sql.NVarChar, tp)
        .query(`INSERT INTO CashRegisters(Name,Type,Balance) OUTPUT INSERTED.ID VALUES(@nm,@tp,0)`);
      const id = res.recordset[0]?.ID;
      if (id) { cache.oldKasaToNew[r.KasaNo] = id; n++; }
    } catch (e) { logError('Kasa', e); }
  }
  logStep('Kasalar', n);
}

// ════════════════════════════════════════════════════════════════
// 9. SATIŞLAR (SA = normal, SI = iade)
// ════════════════════════════════════════════════════════════════
async function migrateSales(src, tgt) {
  // Geçici OldRef sütunu — Sales ile SaleItems/SalePayments eşleştirmek için
  try {
    await tgt.request().query(`
      IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name='OldRef' AND Object_ID=OBJECT_ID('Sales'))
        ALTER TABLE Sales ADD OldRef BIGINT
    `);
  } catch { }

  console.log('  📖 Başlıklar okunuyor...');
  const { recordset: headers } = await src.request().query(`
    SELECT hb.HareketNo, hb.Tarih, hb.Toplam, hb.KDV, hb.Iskonto,
           hb.Barkod, hb.HareketTuru, ho.OdemeTuru
    FROM HareketBaslik hb
    LEFT JOIN (
      SELECT HareketNo, MIN(OdemeTuru) AS OdemeTuru
      FROM HareketOdeme GROUP BY HareketNo
    ) ho ON hb.HareketNo = ho.HareketNo
    WHERE hb.HareketTuru IN ('SA','SI') AND hb.Toplam <> 0
    ORDER BY hb.HareketNo
  `);
  console.log(`  📊 ${headers.length.toLocaleString()} satış`);

  const pmMap = { 1: 'Cash', 2: 'CreditCard', 3: 'Cheque', 4: 'Veresiye', 5: 'Coupon' };
  let saleOk = 0, saleErr = 0;

  for (let i = 0; i < headers.length; i += BATCH_SIZE) {
    const batch = headers.slice(i, i + BATCH_SIZE);
    const req = tgt.request();
    const vals = [];
    for (let j = 0; j < batch.length; j++) {
      const h = batch[j], x = `${i}_${j}`;
      req.input(`ta${x}`, sql.Float, safeNum(h.Toplam));
      req.input(`tx${x}`, sql.Float, safeNum(h.KDV));
      req.input(`di${x}`, sql.Float, safeNum(h.Iskonto));
      req.input(`pm${x}`, sql.NVarChar, pmMap[safeInt(h.OdemeTuru)] || 'Cash');
      req.input(`ai${x}`, sql.Int, cache.barkotToAccountId[safeStr(h.Barkod)] || null);
      req.input(`ca${x}`, sql.DateTime, h.Tarih);
      req.input(`or${x}`, sql.BigInt, h.HareketNo);
      vals.push(`(@ta${x},@tx${x},@di${x},0,@pm${x},@ai${x},@ca${x},@or${x})`);
    }
    try {
      await req.query(`INSERT INTO Sales(TotalAmount,Tax,Discount,ServiceFee,PaymentMethod,AccountID,CreatedAt,OldRef) VALUES ${vals.join(',')}`);
      saleOk += batch.length;
    } catch (e) { saleErr += batch.length; logError(`Sales batch(${i})`, e); }
    if (i % 20000 === 0 && i > 0) process.stdout.write(`  ... ${i.toLocaleString()}/${headers.length.toLocaleString()}\r`);
  }
  console.log('');
  logStep('Satışlar', saleOk, saleErr);

  // ID eşleştirme haritası
  console.log('  🔗 ID eşleştirmesi...');
  const { recordset: map } = await tgt.request()
    .query(`SELECT ID, OldRef FROM Sales WHERE OldRef IS NOT NULL`);
  const saleIdMap = {};
  for (const r of map) saleIdMap[r.OldRef] = r.ID;

  // Satış kalemleri
  console.log('  📖 Kalemler okunuyor...');
  const { recordset: items } = await src.request().query(`
    SELECT h.HareketNo, h.Barkot, h.Adet, h.SatisFiyati
    FROM Hareket h
    INNER JOIN HareketBaslik hb ON hb.HareketNo = h.HareketNo
    WHERE hb.HareketTuru IN ('SA','SI') AND hb.Toplam <> 0
  `);
  console.log(`  📊 ${items.length.toLocaleString()} kalem`);

  const validItems = [];
  let skipItems = 0;
  for (const it of items) {
    const saleId = saleIdMap[it.HareketNo];
    const productId = cache.barcodeToProductId[safeStr(it.Barkot)];
    if (!saleId || !productId) { skipItems++; continue; }
    validItems.push({ saleId, productId, qty: safeInt(it.Adet) || 1, up: safeNum(it.SatisFiyati) });
  }

  let itemOk = 0, itemErr = 0;
  for (let i = 0; i < validItems.length; i += BATCH_SIZE) {
    const batch = validItems.slice(i, i + BATCH_SIZE);
    const req = tgt.request();
    const vals = [];
    for (let j = 0; j < batch.length; j++) {
      const it = batch[j], x = `${i}_${j}`;
      req.input(`si${x}`, sql.Int, it.saleId);
      req.input(`pi${x}`, sql.Int, it.productId);
      req.input(`qt${x}`, sql.Int, it.qty);
      req.input(`up${x}`, sql.Decimal(18, 2), it.up);
      vals.push(`(@si${x},@pi${x},@qt${x},@up${x})`);
    }
    try {
      await req.query(`INSERT INTO SaleItems(SaleID,ProductID,Qty,UnitPrice) VALUES ${vals.join(',')}`);
      itemOk += batch.length;
    } catch (e) { itemErr += batch.length; logError(`SaleItems batch(${i})`, e); }
    if (i % 50000 === 0 && i > 0) process.stdout.write(`  ... ${i.toLocaleString()}/${validItems.length.toLocaleString()}\r`);
  }
  console.log('');
  logStep('Satış Kalemleri', itemOk, skipItems + itemErr);

  // OldRef sütununu bırak — SalePayments adımı da kullanacak
  // migrateSalePayments bittikten sonra kaldırılacak
}

// ════════════════════════════════════════════════════════════════
// 10. ÖDEME DETAYLARI → SalePayments
// ════════════════════════════════════════════════════════════════
async function migrateSalePayments(src, tgt) {
  const { recordset: rows } = await src.request().query(`
    SELECT ho.HareketNo, ho.OdemeTuru, ho.Tutar, ho.KasaNo
    FROM HareketOdeme ho
    INNER JOIN HareketBaslik hb ON hb.HareketNo = ho.HareketNo
    WHERE hb.HareketTuru IN ('SA','SI') AND hb.Toplam <> 0
  `);

  // OldRef → SaleID haritası
  const { recordset: map } = await tgt.request()
    .query(`SELECT ID, OldRef FROM Sales WHERE OldRef IS NOT NULL`);
  const saleIdMap = {};
  for (const r of map) saleIdMap[r.OldRef] = r.ID;

  const pmMap = { 1: 'Cash', 2: 'CreditCard', 3: 'Cheque', 4: 'Account', 5: 'Coupon' };
  let n = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const req = tgt.request();
    const vals = [];
    for (let j = 0; j < batch.length; j++) {
      const r = batch[j], x = `${i}_${j}`;
      const saleId = saleIdMap[r.HareketNo] || null;
      const crId = cache.oldKasaToNew[safeInt(r.KasaNo)] || null;
      req.input(`si${x}`, sql.Int, saleId);
      req.input(`or${x}`, sql.BigInt, r.HareketNo);
      req.input(`pm${x}`, sql.NVarChar, pmMap[safeInt(r.OdemeTuru)] || 'Cash');
      req.input(`am${x}`, sql.Float, safeNum(r.Tutar));
      req.input(`cr${x}`, sql.Int, crId);
      vals.push(`(@si${x},@or${x},@pm${x},@am${x},@cr${x},GETDATE())`);
    }
    try {
      await req.query(`INSERT INTO SalePayments(SaleID,OldSaleRef,PaymentMethod,Amount,CashRegisterID,CreatedAt) VALUES ${vals.join(',')}`);
      n += batch.length;
    } catch (e) { logError(`SalePayments batch(${i})`, e); }
    if (i % 50000 === 0 && i > 0) process.stdout.write(`  ... ${i.toLocaleString()}/${rows.length.toLocaleString()}\r`);
  }
  console.log('');
  logStep('Ödeme Detayları', n);

  // Artık OldRef'e gerek yok
  try { await tgt.request().query(`ALTER TABLE Sales DROP COLUMN OldRef`); } catch { }
}

// ════════════════════════════════════════════════════════════════
// 11. ALIŞ FATURALARI
// ════════════════════════════════════════════════════════════════
async function migrateAlisFaturasi(src, tgt) {
  const { recordset: rows } = await src.request().query(`
    SELECT af.ID,af.Iade,af.ToptanciBarkot,af.Tarih,af.FaturaNo,af.IrsaliyeNo,
           af.Aciklama,af.ClosedInvoice, t.Isim AS TIsim
    FROM AlisFaturasi af LEFT JOIN Toptanci t ON af.ToptanciBarkot = t.Barkot
  `);
  let invN = 0, itemN = 0;
  const invMap = {};

  try { await tgt.request().query(`IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name='OldRef' AND Object_ID=OBJECT_ID('Invoices')) ALTER TABLE Invoices ADD OldRef NVARCHAR(50)`); } catch { }

  for (const r of rows) {
    const accId = cache.barkotToAccountId[safeStr(r.ToptanciBarkot)] || null;
    try {
      const res = await tgt.request()
        .input('ino', sql.NVarChar, safeStr(r.FaturaNo))
        .input('tp', sql.NVarChar, r.Iade ? 'Alış İade' : 'Alış Faturası')
        .input('cp', sql.NVarChar, safeStr(r.TIsim) || 'Bilinmeyen')
        .input('ai', sql.Int, accId)
        .input('wn', sql.NVarChar, safeStr(r.IrsaliyeNo))
        .input('ds', sql.NVarChar, safeStr(r.Aciklama))
        .input('io', sql.Int, r.ClosedInvoice ? 0 : 1)
        .input('ca', sql.DateTime, r.Tarih)
        .input('ref', sql.NVarChar, `AF_${r.ID}`)
        .query(`INSERT INTO Invoices(InvoiceNo,Type,Counterparty,TotalAmount,SubTotal,TotalDiscount,TotalVat,Description,AccountID,WaybillNo,IsOpen,CreatedAt,OldRef)
                OUTPUT INSERTED.ID VALUES(@ino,@tp,@cp,0,0,0,0,@ds,@ai,@wn,@io,@ca,@ref)`);
      const id = res.recordset[0]?.ID;
      if (id) { invMap[r.ID] = id; invN++; }
    } catch (e) { logError('AlisFaturasi', e); }
  }
  logStep('Alış Faturaları', invN);

  const { recordset: items } = await src.request()
    .query(`SELECT FaturaID,Barkot,Adet,BirimFiyat,KDV,IndirimOrani,Indirim,FiyatKDVDahil FROM AlisFaturasiUrun`);
  const valid = items.filter(it => invMap[it.FaturaID] && cache.barcodeToProductId[safeStr(it.Barkot)]);
  for (let i = 0; i < valid.length; i += BATCH_SIZE) {
    const batch = valid.slice(i, i + BATCH_SIZE);
    const req = tgt.request();
    const vals = [];
    for (let j = 0; j < batch.length; j++) {
      const it = batch[j], x = `${i}_${j}`;
      req.input(`ii${x}`, sql.Int, invMap[it.FaturaID]);
      req.input(`pi${x}`, sql.Int, cache.barcodeToProductId[safeStr(it.Barkot)]);
      req.input(`qt${x}`, sql.Int, safeInt(it.Adet) || 1);
      req.input(`up${x}`, sql.Float, safeNum(it.BirimFiyat));
      req.input(`vr${x}`, sql.Float, safeNum(it.KDV));
      req.input(`d1${x}`, sql.Float, safeNum(it.IndirimOrani));
      req.input(`rt${x}`, sql.Float, safeNum(it.FiyatKDVDahil) - safeNum(it.Indirim));
      vals.push(`(@ii${x},@pi${x},@qt${x},@up${x},@vr${x},N'Hariç',@d1${x},0,0,@rt${x})`);
    }
    try {
      await req.query(`INSERT INTO InvoiceItems(InvoiceID,ProductID,Qty,UnitPrice,VatRate,VatType,Disc1,Disc2,Disc3,RowTotal) VALUES ${vals.join(',')}`);
      itemN += batch.length;
    } catch (e) { logError('AlisFaturasiUrun batch', e); }
  }
  logStep('Alış Fatura Kalemleri', itemN);
  try { await tgt.request().query(`UPDATE Invoices SET TotalAmount=ISNULL((SELECT SUM(RowTotal) FROM InvoiceItems WHERE InvoiceID=Invoices.ID),0), SubTotal=ISNULL((SELECT SUM(Qty*UnitPrice) FROM InvoiceItems WHERE InvoiceID=Invoices.ID),0) WHERE OldRef LIKE 'AF_%'`); } catch { }
  try { await tgt.request().query(`ALTER TABLE Invoices DROP COLUMN OldRef`); } catch { }
}

// ════════════════════════════════════════════════════════════════
// 12. GENEL FATURALAR
// ════════════════════════════════════════════════════════════════
async function migrateFaturaList(src, tgt) {
  const { recordset: rows } = await src.request().query(`
    SELECT FATID,CARIID,EVRAKNO,BELGENO,FATURATURU,CHISMI,FTTARIH,YEKUN,
           VD,VN,TCKN,TEL1,ADRES,IL,ILCE,NOT1,
           KDV1,KDV8,KDV18,ISK1TUTAR,ISK2TUTAR,ISK3TUTAR,ACIKKAPALI
    FROM FaturaList
  `);
  let invN = 0, itemN = 0;
  const invMap = {};
  const typeMap = { 1: 'Alış Faturası', 2: 'Satış Faturası', 3: 'Alış İade', 4: 'Satış İade' };

  for (const r of rows) {
    const addr = [r.ADRES, r.IL, r.ILCE].map(safeStr).filter(Boolean).join(', ');
    try {
      const res = await tgt.request()
        .input('ino', sql.NVarChar, safeStr(r.EVRAKNO) || safeStr(r.BELGENO))
        .input('tp', sql.NVarChar, typeMap[safeInt(r.FATURATURU)] || 'Fatura')
        .input('cp', sql.NVarChar, safeStr(r.CHISMI) || 'Bilinmeyen')
        .input('ta', sql.Float, safeNum(r.YEKUN))
        .input('tv', sql.Float, safeNum(r.KDV1) + safeNum(r.KDV8) + safeNum(r.KDV18))
        .input('td', sql.Float, safeNum(r.ISK1TUTAR) + safeNum(r.ISK2TUTAR) + safeNum(r.ISK3TUTAR))
        .input('ds', sql.NVarChar, safeStr(r.NOT1))
        .input('ai', sql.Int, cache.cariIdToAccountId[r.CARIID] || null)
        .input('to', sql.NVarChar, safeStr(r.VD))
        .input('tn', sql.NVarChar, safeStr(r.VN) || safeStr(r.TCKN))
        .input('ad', sql.NVarChar, addr || null)
        .input('ph', sql.NVarChar, safeStr(r.TEL1))
        .input('io', sql.Int, safeInt(r.ACIKKAPALI) === 1 ? 1 : 0)
        .input('ca', sql.DateTime, r.FTTARIH || new Date())
        .query(`INSERT INTO Invoices(InvoiceNo,Type,Counterparty,TotalAmount,SubTotal,TotalDiscount,TotalVat,Description,AccountID,TaxOffice,TaxNumber,Address,Phone,IsOpen,CreatedAt)
                OUTPUT INSERTED.ID VALUES(@ino,@tp,@cp,@ta,@ta,@td,@tv,@ds,@ai,@to,@tn,@ad,@ph,@io,@ca)`);
      const id = res.recordset[0]?.ID;
      if (id) { invMap[r.FATID] = id; invN++; }
    } catch (e) { logError('FaturaList', e); }
  }
  logStep('Genel Faturalar', invN);

  const { recordset: items } = await src.request()
    .query(`SELECT FATID,BARKOT,MIKTAR,BIRIMFIYAT,KDV,ISK1,ISK2,ISK3,TOPLAM,KDVLITP FROM FaturaIcerik`);
  const valid = items.filter(it => invMap[it.FATID] && cache.barcodeToProductId[safeStr(it.BARKOT)]);
  for (let i = 0; i < valid.length; i += BATCH_SIZE) {
    const batch = valid.slice(i, i + BATCH_SIZE);
    const req = tgt.request();
    const vals = [];
    for (let j = 0; j < batch.length; j++) {
      const it = batch[j], x = `${i}_${j}`;
      req.input(`ii${x}`, sql.Int, invMap[it.FATID]);
      req.input(`pi${x}`, sql.Int, cache.barcodeToProductId[safeStr(it.BARKOT)]);
      req.input(`qt${x}`, sql.Int, safeInt(it.MIKTAR) || 1);
      req.input(`up${x}`, sql.Float, safeNum(it.BIRIMFIYAT));
      req.input(`vr${x}`, sql.Float, safeNum(it.KDV));
      req.input(`d1${x}`, sql.Float, safeNum(it.ISK1));
      req.input(`d2${x}`, sql.Float, safeNum(it.ISK2));
      req.input(`d3${x}`, sql.Float, safeNum(it.ISK3));
      req.input(`rt${x}`, sql.Float, safeNum(it.KDVLITP) || safeNum(it.TOPLAM));
      vals.push(`(@ii${x},@pi${x},@qt${x},@up${x},@vr${x},N'Hariç',@d1${x},@d2${x},@d3${x},@rt${x})`);
    }
    try {
      await req.query(`INSERT INTO InvoiceItems(InvoiceID,ProductID,Qty,UnitPrice,VatRate,VatType,Disc1,Disc2,Disc3,RowTotal) VALUES ${vals.join(',')}`);
      itemN += batch.length;
    } catch (e) { logError('FaturaIcerik batch', e); }
  }
  logStep('Genel Fatura Kalemleri', itemN);
}

// ════════════════════════════════════════════════════════════════
// 13. CARİ HAREKETLER
// ════════════════════════════════════════════════════════════════
async function migrateCariHareketler(src, tgt) {
  const { recordset } = await src.request().query(`
    SELECT ch.CariId,ch.Tarih,ch.EvrakNo,ch.Tutar,ch.Aciklama,ch.BA,ch.FatID,
           fl.FATURATURU
    FROM CariHareketler ch
    LEFT JOIN FaturaList fl ON ch.FatID = fl.FATID
  `);
  const ftTypeMap = { 1: 'Borç', 2: 'Alacak', 3: 'Alacak', 4: 'Borç' };
  const valid = [];
  for (const r of recordset) {
    const accountId = cache.cariIdToAccountId[r.CariId];
    if (!accountId) continue;
    let type = ftTypeMap[safeInt(r.FATURATURU)];
    if (!type) {
      const d = (safeStr(r.Aciklama) || safeStr(r.EvrakNo) || '').toUpperCase();
      if (['IADE', 'İADE', 'TAHSILAT', 'TAHSİLAT', 'ODEME', 'ÖDEME', 'HAVALE'].some(k => d.includes(k))) type = 'Alacak';
      else if (['ALIS', 'ALIŞ', 'FATURA'].some(k => d.includes(k))) type = 'Borç';
      else type = safeInt(r.BA) === 1 ? 'Alacak' : 'Borç';
    }
    valid.push({ accountId, type, amount: safeNum(r.Tutar), desc: safeStr(r.Aciklama) || safeStr(r.EvrakNo) || '', createdAt: r.Tarih || new Date() });
  }
  let n = 0;
  for (let i = 0; i < valid.length; i += BATCH_SIZE) {
    const batch = valid.slice(i, i + BATCH_SIZE);
    const req = tgt.request();
    const vals = [];
    for (let j = 0; j < batch.length; j++) {
      const r = batch[j], x = `${i}_${j}`;
      req.input(`ai${x}`, sql.Int, r.accountId);
      req.input(`tp${x}`, sql.NVarChar, r.type);
      req.input(`am${x}`, sql.Float, r.amount);
      req.input(`ds${x}`, sql.NVarChar, r.desc);
      req.input(`ca${x}`, sql.DateTime, r.createdAt);
      vals.push(`(@ai${x},@tp${x},@am${x},@ds${x},NULL,NULL,@ca${x})`);
    }
    try {
      await req.query(`INSERT INTO AccountLedger(AccountID,Type,Amount,Description,RefType,RefID,CreatedAt) VALUES ${vals.join(',')}`);
      n += batch.length;
    } catch (e) { logError('CariHareketler batch', e); }
  }
  logStep('Cari Hareketler', n);
}

// ════════════════════════════════════════════════════════════════
// 14. MUHASEBE İŞLEMLERİ (TH/GI/KG/KC)
// ════════════════════════════════════════════════════════════════
async function migrateAccountTransactions(src, tgt) {
  const { recordset } = await src.request().query(`
    SELECT hb.HareketNo,hb.Tarih,hb.HareketTuru,hb.Toplam,hb.Barkod,
           hb.FaturaNo,hb.Aciklama,ho.OdemeTuru,ho.KasaNo
    FROM HareketBaslik hb
    LEFT JOIN (SELECT HareketNo,MIN(OdemeTuru) AS OdemeTuru,MIN(KasaNo) AS KasaNo FROM HareketOdeme GROUP BY HareketNo) ho ON hb.HareketNo = ho.HareketNo
    WHERE hb.HareketTuru IN ('TH','GI','KG','KC')
  `);
  const txItems = [], cashItems = [], ledgerItems = [];
  const typeMap = { TH: 'Collection', GI: 'Expense', KG: 'CashIn', KC: 'CashOut' };
  const cpMap = { TH: 'Tahsilat', KG: 'Kasa Giriş', KC: 'Kasa Çıkış' };

  for (const r of recordset) {
    const tur = safeStr(r.HareketTuru);
    const amount = safeNum(r.Toplam);
    const accId = cache.barkotToAccountId[safeStr(r.Barkod)] || null;
    const crId = cache.oldKasaToNew[safeInt(r.KasaNo)] || null;
    const desc = safeStr(r.Aciklama) || safeStr(r.FaturaNo) || '';
    const pm = safeInt(r.OdemeTuru) === 2 ? 'CreditCard' : 'Cash';
    const type = typeMap[tur] || 'Other';
    const cp = cpMap[tur] || safeStr(r.FaturaNo) || 'Gider';

    txItems.push({ type, amount, desc, cp, accId, pm, createdAt: r.Tarih });
    if (tur === 'TH' && accId)
      ledgerItems.push({ accId, type: 'Alacak', amount, desc: desc || 'Tahsilat', createdAt: r.Tarih || new Date() });
    if (crId)
      cashItems.push({ crId, type: (tur === 'KG' || tur === 'TH') ? 'Giriş' : 'Çıkış', amount, desc, createdAt: r.Tarih });
  }

  const batchInsert = async (items, query, buildRow) => {
    let n = 0;
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      const req = tgt.request();
      const vals = [];
      for (let j = 0; j < batch.length; j++) {
        vals.push(buildRow(req, batch[j], `${i}_${j}`));
      }
      try { await req.query(query + vals.join(',')); n += batch.length; } catch (e) { logError('AccTx batch', e); }
    }
    return n;
  };

  const txCount = await batchInsert(txItems,
    `INSERT INTO AccountTransactions(Type,Amount,Description,Counterparty,SaleID,InvoiceID,AccountID,PaymentMethod,CreatedAt) VALUES `,
    (req, r, x) => {
      req.input(`t${x}`, sql.NVarChar, r.type); req.input(`m${x}`, sql.Float, r.amount);
      req.input(`d${x}`, sql.NVarChar, r.desc); req.input(`c${x}`, sql.NVarChar, r.cp);
      req.input(`a${x}`, sql.Int, r.accId); req.input(`p${x}`, sql.NVarChar, r.pm);
      req.input(`ca${x}`, sql.DateTime, r.createdAt);
      return `(@t${x},@m${x},@d${x},@c${x},NULL,NULL,@a${x},@p${x},@ca${x})`;
    });
  logStep('Muhasebe İşlemleri', txCount);

  const ldCount = await batchInsert(ledgerItems,
    `INSERT INTO AccountLedger(AccountID,Type,Amount,Description,RefType,RefID,CreatedAt) VALUES `,
    (req, r, x) => {
      req.input(`a${x}`, sql.Int, r.accId); req.input(`t${x}`, sql.NVarChar, r.type);
      req.input(`m${x}`, sql.Float, r.amount); req.input(`d${x}`, sql.NVarChar, r.desc);
      req.input(`ca${x}`, sql.DateTime, r.createdAt);
      return `(@a${x},@t${x},@m${x},@d${x},NULL,NULL,@ca${x})`;
    });
  logStep('Tahsilat/Ödeme Ledger', ldCount);

  const cashCount = await batchInsert(cashItems,
    `INSERT INTO CashMovements(CashRegisterID,Type,Amount,Description,RefType,RefID,CreatedAt) VALUES `,
    (req, r, x) => {
      req.input(`cr${x}`, sql.Int, r.crId); req.input(`t${x}`, sql.NVarChar, r.type);
      req.input(`m${x}`, sql.Float, r.amount); req.input(`d${x}`, sql.NVarChar, r.desc);
      req.input(`ca${x}`, sql.DateTime, r.createdAt);
      return `(@cr${x},@t${x},@m${x},@d${x},NULL,NULL,@ca${x})`;
    });
  logStep('Kasa Hareketleri', cashCount);

  // Satışları ve faturaları AccountTransactions'a bağla
  try {
    const r1 = await tgt.request().query(`
      INSERT INTO AccountTransactions(Type,Amount,Description,SaleID,PaymentMethod,CreatedAt,AccountID)
      SELECT 'Sale',TotalAmount,'Satis #'+CAST(ID AS NVARCHAR),ID,PaymentMethod,CreatedAt,AccountID
      FROM Sales s WHERE NOT EXISTS(SELECT 1 FROM AccountTransactions a WHERE a.SaleID=s.ID)
    `);
    logStep('Hesap Hareketleri (Satışlar)', r1.rowsAffected[0]);
  } catch (e) { logError('AccTx Satışlar', e); }
  try {
    const r2 = await tgt.request().query(`
      INSERT INTO AccountTransactions(Type,Amount,Description,InvoiceID,PaymentMethod,CreatedAt,AccountID)
      SELECT CASE Type WHEN 'Satış Faturası' THEN 'Sale' WHEN 'Alış Faturası' THEN 'Purchase'
                       WHEN 'Satış İade' THEN 'Sale Return' WHEN 'Alış İade' THEN 'Purchase Return' ELSE 'Other' END,
             TotalAmount,Type+' #'+CAST(ID AS NVARCHAR),ID,'Nakit',CreatedAt,AccountID
      FROM Invoices i WHERE Type != 'İrsaliye' AND NOT EXISTS(SELECT 1 FROM AccountTransactions a WHERE a.InvoiceID=i.ID)
    `);
    logStep('Hesap Hareketleri (Faturalar)', r2.rowsAffected[0]);
  } catch (e) { logError('AccTx Faturalar', e); }
}

// ════════════════════════════════════════════════════════════════
// 15. MUHTELİF HAREKETLER (MG/MC) → MiscMovements
// ════════════════════════════════════════════════════════════════
async function migrateMiscMovements(src, tgt) {
  const { recordset: headers } = await src.request().query(`
    SELECT hb.HareketNo, hb.Tarih, hb.Toplam, hb.HareketTuru,
           hb.Aciklama, hb.FaturaNo, hb.Barkod, ho.OdemeTuru, ho.KasaNo
    FROM HareketBaslik hb
    LEFT JOIN (SELECT HareketNo,MIN(OdemeTuru) AS OdemeTuru,MIN(KasaNo) AS KasaNo FROM HareketOdeme GROUP BY HareketNo) ho ON hb.HareketNo=ho.HareketNo
    WHERE hb.HareketTuru IN ('MG','MC')
  `);
  if (!headers.length) { logStep('Muhtelif Hareketler', 0); return; }

  let n = 0;
  for (let i = 0; i < headers.length; i += BATCH_SIZE) {
    const batch = headers.slice(i, i + BATCH_SIZE);
    const req = tgt.request();
    const vals = [];
    for (let j = 0; j < batch.length; j++) {
      const r = batch[j], x = `${i}_${j}`;
      req.input(`hn${x}`, sql.BigInt, r.HareketNo);
      req.input(`tp${x}`, sql.NVarChar, safeStr(r.HareketTuru));
      req.input(`ta${x}`, sql.Float, safeNum(r.Toplam));
      req.input(`ds${x}`, sql.NVarChar, safeStr(r.Aciklama) || safeStr(r.FaturaNo) || '');
      req.input(`ai${x}`, sql.Int, cache.barkotToAccountId[safeStr(r.Barkod)] || null);
      req.input(`cr${x}`, sql.Int, cache.oldKasaToNew[safeInt(r.KasaNo)] || null);
      req.input(`pm${x}`, sql.NVarChar, safeInt(r.OdemeTuru) === 2 ? 'CreditCard' : 'Cash');
      req.input(`ca${x}`, sql.DateTime, r.Tarih);
      vals.push(`(@hn${x},@tp${x},@ta${x},@ds${x},@ai${x},@cr${x},@pm${x},@ca${x},GETDATE())`);
    }
    try {
      await req.query(`INSERT INTO MiscMovements(OldRef,MovementType,Amount,Description,AccountID,CashRegisterID,PaymentMethod,Date,CreatedAt) VALUES ${vals.join(',')}`);
      n += batch.length;
    } catch (e) { logError('MiscMovements batch', e); }
  }
  logStep('Muhtelif Hareketler', n);
}

// ════════════════════════════════════════════════════════════════
// 16. SERVİS/TESLİMAT → DeliveryOrders
// ════════════════════════════════════════════════════════════════
async function migrateDeliveryOrders(src, tgt) {
  const { recordset } = await src.request().query(`
    SELECT id,hbno,Telefon,AdiSoyadi,Adres,AdresTanim,
           ToplamTutar,Tarih,Kuryeid,KuryeAdi,
           HizmetBedelii,TeslimatDurum,iptal,FisNo
    FROM ServisListesi
  `);
  let n = 0;
  for (let i = 0; i < recordset.length; i += BATCH_SIZE) {
    const batch = recordset.slice(i, i + BATCH_SIZE);
    const req = tgt.request();
    const vals = [];
    for (let j = 0; j < batch.length; j++) {
      const r = batch[j], x = `${i}_${j}`;
      req.input(`or${x}`, sql.BigInt, r.hbno);
      req.input(`ph${x}`, sql.NVarChar, safeStr(r.Telefon));
      req.input(`nm${x}`, sql.NVarChar, safeStr(r.AdiSoyadi));
      req.input(`ad${x}`, sql.NVarChar, safeStr(r.Adres));
      req.input(`an${x}`, sql.NVarChar, safeStr(r.AdresTanim));
      req.input(`ta${x}`, sql.Float, safeNum(r.ToplamTutar));
      req.input(`sf${x}`, sql.Float, safeNum(r.HizmetBedelii));
      req.input(`ci${x}`, sql.Int, cache.oldCourierToNew[safeInt(r.Kuryeid)] || null);
      req.input(`cn${x}`, sql.NVarChar, safeStr(r.KuryeAdi));
      req.input(`dl${x}`, sql.Bit, r.TeslimatDurum ? 1 : 0);
      req.input(`ca${x}`, sql.Bit, r.iptal ? 1 : 0);
      req.input(`fn${x}`, sql.NVarChar, safeStr(r.FisNo));
      req.input(`dt${x}`, sql.DateTime, r.Tarih);
      vals.push(`(NULL,@or${x},@ph${x},@nm${x},@ad${x},@an${x},@ta${x},@sf${x},@ci${x},@cn${x},@dl${x},@ca${x},@fn${x},@dt${x})`);
    }
    try {
      await req.query(`INSERT INTO DeliveryOrders(SaleID,OldSaleRef,Phone,CustomerName,Address,AddressNote,TotalAmount,ServiceFee,CourierID,CourierName,IsDelivered,IsCancelled,ReceiptNo,CreatedAt) VALUES ${vals.join(',')}`);
      n += batch.length;
    } catch (e) { logError('DeliveryOrders batch', e); }
    if (i % 10000 === 0 && i > 0) process.stdout.write(`  ... ${i.toLocaleString()}/${recordset.length.toLocaleString()}\r`);
  }
  console.log('');
  logStep('Teslimat Siparişleri', n);
}

// ════════════════════════════════════════════════════════════════
// 17. STOK HAREKETLERİ → StockMovements
// ════════════════════════════════════════════════════════════════
async function migrateStockMovements(src, tgt) {
  const { recordset } = await src.request().query(`
    SELECT ID,URUNID,BARKOT,KODU,ISLEMTIPI,CARIID,TARIH,SAAT,KDV,KDVDURUM,
           BRUTMALIYET,NETMALIYET,MIKTAR,BIRIM,MIKTAR2,BIRIM2,TOPLAMISK,
           PERSONELID,EVRAKNO,EvrakID,ISK1,ISK2,ISK3
    FROM UrunHareket
  `);
  let n = 0;
  for (let i = 0; i < recordset.length; i += BATCH_SIZE) {
    const batch = recordset.slice(i, i + BATCH_SIZE);
    const req = tgt.request();
    const vals = [];
    for (let j = 0; j < batch.length; j++) {
      const r = batch[j], x = `${i}_${j}`;
      req.input(`pid${x}`, sql.Int, r.URUNID || cache.barcodeToProductId[safeStr(r.BARKOT)] || null);
      req.input(`bc${x}`, sql.NVarChar, safeStr(r.BARKOT));
      req.input(`kd${x}`, sql.NVarChar, safeStr(r.KODU));
      req.input(`tp${x}`, sql.Int, safeInt(r.ISLEMTIPI));
      req.input(`ai${x}`, sql.Int, r.CARIID ? (cache.cariIdToAccountId[r.CARIID] || null) : null);
      req.input(`dt${x}`, sql.DateTime, r.TARIH);
      req.input(`sa${x}`, sql.NVarChar, r.SAAT ? String(r.SAAT) : null);
      req.input(`kv${x}`, sql.Int, safeInt(r.KDV));
      req.input(`kvd${x}`, sql.Int, safeInt(r.KDVDURUM));
      req.input(`gm${x}`, sql.Decimal(18, 4), safeNum(r.BRUTMALIYET));
      req.input(`nm${x}`, sql.Decimal(18, 4), safeNum(r.NETMALIYET));
      req.input(`qt${x}`, sql.Decimal(10, 2), safeNum(r.MIKTAR));
      req.input(`un${x}`, sql.Int, safeInt(r.BIRIM));
      req.input(`q2${x}`, sql.Int, safeInt(r.MIKTAR2));
      req.input(`u2${x}`, sql.Int, safeInt(r.BIRIM2));
      req.input(`td${x}`, sql.Decimal(10, 2), safeNum(r.TOPLAMISK));
      req.input(`st${x}`, sql.Int, r.PERSONELID ? (cache.oldStaffToNewStaff[r.PERSONELID] || null) : null);
      req.input(`rf${x}`, sql.NVarChar, safeStr(r.EVRAKNO));
      req.input(`ri${x}`, sql.BigInt, r.EvrakID || null);
      req.input(`d1${x}`, sql.Decimal(18, 2), safeNum(r.ISK1));
      req.input(`d2${x}`, sql.Decimal(18, 2), safeNum(r.ISK2));
      req.input(`d3${x}`, sql.Decimal(18, 2), safeNum(r.ISK3));
      vals.push(`(@pid${x},@bc${x},@kd${x},@tp${x},@ai${x},@dt${x},@sa${x},@kv${x},@kvd${x},@gm${x},@nm${x},@qt${x},@un${x},@q2${x},@u2${x},@td${x},@st${x},@rf${x},@ri${x},@d1${x},@d2${x},@d3${x},GETDATE())`);
    }
    try {
      await req.query(`INSERT INTO StockMovements(ProductID,Barcode,Code,MovementType,AccountID,Date,Time,VatRate,VatType,GrossCost,NetCost,Qty,UnitID,Qty2,Unit2ID,TotalDisc,StaffID,RefNo,RefID,Disc1,Disc2,Disc3,CreatedAt) VALUES ${vals.join(',')}`);
      n += batch.length;
    } catch (e) { logError('StockMovements batch', e); }
    if (i % 10000 === 0 && i > 0) process.stdout.write(`  ... ${i.toLocaleString()}/${recordset.length.toLocaleString()}\r`);
  }
  console.log('');
  logStep('Stok Hareketleri', n);
}

// ════════════════════════════════════════════════════════════════
// 18. STOK BAŞLANGIÇ / DÜZELTMELERİ → StockAdjustments
// ════════════════════════════════════════════════════════════════
async function migrateStockAdjustments(src, tgt) {
  const { recordset } = await src.request().query(`
    SELECT ID,UrunId,Barkot,Adi,EskiStok,Stok,IslemTuru,Tarih,Personel,EvrakID
    FROM UrunHareketBaslangic
  `);
  let n = 0;
  for (let i = 0; i < recordset.length; i += BATCH_SIZE) {
    const batch = recordset.slice(i, i + BATCH_SIZE);
    const req = tgt.request();
    const vals = [];
    for (let j = 0; j < batch.length; j++) {
      const r = batch[j], x = `${i}_${j}`;
      req.input(`pid${x}`, sql.Int, r.UrunId || cache.barcodeToProductId[safeStr(r.Barkot)] || null);
      req.input(`bc${x}`, sql.NVarChar, safeStr(r.Barkot));
      req.input(`nm${x}`, sql.NVarChar, safeStr(r.Adi));
      req.input(`os${x}`, sql.Int, safeInt(r.EskiStok));
      req.input(`ns${x}`, sql.Int, safeInt(r.Stok));
      req.input(`mt${x}`, sql.NVarChar, safeStr(r.IslemTuru));
      req.input(`dt${x}`, sql.DateTime, r.Tarih);
      req.input(`st${x}`, sql.Int, r.Personel ? (cache.oldStaffToNewStaff[r.Personel] || null) : null);
      req.input(`ri${x}`, sql.BigInt, r.EvrakID || null);
      vals.push(`(@pid${x},@bc${x},@nm${x},@os${x},@ns${x},@mt${x},@dt${x},@st${x},@ri${x},GETDATE())`);
    }
    try {
      await req.query(`INSERT INTO StockAdjustments(ProductID,Barcode,ProductName,OldStock,NewStock,MovementType,Date,StaffID,RefID,CreatedAt) VALUES ${vals.join(',')}`);
      n += batch.length;
    } catch (e) { logError('StockAdjustments batch', e); }
    if (i % 10000 === 0 && i > 0) process.stdout.write(`  ... ${i.toLocaleString()}/${recordset.length.toLocaleString()}\r`);
  }
  console.log('');
  logStep('Stok Başlangıç/Düzeltme', n);
}

// ════════════════════════════════════════════════════════════════
// 19. İPTAL LOGLARI → VoidItems
// ════════════════════════════════════════════════════════════════
async function migrateVoidItems(src, tgt) {
  const { recordset } = await src.request()
    .query(`SELECT id,tarih,barkot,stokadi,Personel,Adet,BirimFiyat,Tutar FROM iptalislemler`);
  let n = 0;
  for (let i = 0; i < recordset.length; i += BATCH_SIZE) {
    const batch = recordset.slice(i, i + BATCH_SIZE);
    const req = tgt.request();
    const vals = [];
    for (let j = 0; j < batch.length; j++) {
      const r = batch[j], x = `${i}_${j}`;
      req.input(`dt${x}`, sql.DateTime, r.tarih);
      req.input(`bc${x}`, sql.NVarChar, safeStr(r.barkot));
      req.input(`nm${x}`, sql.NVarChar, safeStr(r.stokadi));
      req.input(`st${x}`, sql.NVarChar, safeStr(r.Personel));
      req.input(`qt${x}`, sql.Int, safeInt(r.Adet));
      req.input(`up${x}`, sql.Decimal(18, 2), safeNum(r.BirimFiyat));
      req.input(`am${x}`, sql.Decimal(18, 2), safeNum(r.Tutar));
      vals.push(`(@dt${x},@bc${x},@nm${x},@st${x},@qt${x},@up${x},@am${x},GETDATE())`);
    }
    try {
      await req.query(`INSERT INTO VoidItems(Date,Barcode,ProductName,StaffName,Qty,UnitPrice,Amount,CreatedAt) VALUES ${vals.join(',')}`);
      n += batch.length;
    } catch (e) { logError('VoidItems batch', e); }
    if (i % 10000 === 0 && i > 0) process.stdout.write(`  ... ${i.toLocaleString()}/${recordset.length.toLocaleString()}\r`);
  }
  console.log('');
  logStep('İptal Logları', n);
}

// ════════════════════════════════════════════════════════════════
// 20. FİYAT DEĞİŞİKLİK GEÇMİŞİ → PriceChangeLog
// ════════════════════════════════════════════════════════════════
async function migratePriceChangeLog(src, tgt) {
  const { recordset } = await src.request().query(`
    SELECT Id,UrunBarkot,EskiAlisFiyat,YeniAlisFiyat,EskiSatisFiyat,YeniSatisFiyat,
           PersonelAdi,Tarih,UrunAdi,GuncellemeYeri,EskiTaksitliFiyat,YeniTaksitliFiyat,
           EskiAdi,YeniAdi,Silindimi
    FROM UrunFiyatGuncellemeleri
  `);
  let n = 0;
  for (let i = 0; i < recordset.length; i += BATCH_SIZE) {
    const batch = recordset.slice(i, i + BATCH_SIZE);
    const req = tgt.request();
    const vals = [];
    for (let j = 0; j < batch.length; j++) {
      const r = batch[j], x = `${i}_${j}`;
      req.input(`pid${x}`, sql.Int, cache.barcodeToProductId[safeStr(r.UrunBarkot)] || null);
      req.input(`bc${x}`, sql.NVarChar, safeStr(r.UrunBarkot));
      req.input(`nm${x}`, sql.NVarChar, safeStr(r.UrunAdi));
      req.input(`ocp${x}`, sql.Decimal(10, 4), safeNum(r.EskiAlisFiyat));
      req.input(`ncp${x}`, sql.Decimal(10, 4), safeNum(r.YeniAlisFiyat));
      req.input(`osp${x}`, sql.Decimal(10, 4), safeNum(r.EskiSatisFiyat));
      req.input(`nsp${x}`, sql.Decimal(10, 4), safeNum(r.YeniSatisFiyat));
      req.input(`oip${x}`, sql.Decimal(10, 2), safeNum(r.EskiTaksitliFiyat));
      req.input(`nip${x}`, sql.Decimal(10, 2), safeNum(r.YeniTaksitliFiyat));
      req.input(`on${x}`, sql.NVarChar, safeStr(r.EskiAdi));
      req.input(`nn${x}`, sql.NVarChar, safeStr(r.YeniAdi));
      req.input(`by${x}`, sql.NVarChar, safeStr(r.PersonelAdi));
      req.input(`lc${x}`, sql.NVarChar, safeStr(r.GuncellemeYeri));
      req.input(`dl${x}`, sql.Bit, r.Silindimi ? 1 : 0);
      req.input(`dt${x}`, sql.DateTime, r.Tarih);
      vals.push(`(@pid${x},@bc${x},@nm${x},@ocp${x},@ncp${x},@osp${x},@nsp${x},@oip${x},@nip${x},@on${x},@nn${x},@by${x},@lc${x},@dl${x},@dt${x},GETDATE())`);
    }
    try {
      await req.query(`INSERT INTO PriceChangeLog(ProductID,Barcode,ProductName,OldCostPrice,NewCostPrice,OldSalePrice,NewSalePrice,OldInstPrice,NewInstPrice,OldName,NewName,ChangedBy,ChangeLocation,IsDeleted,ChangedAt,CreatedAt) VALUES ${vals.join(',')}`);
      n += batch.length;
    } catch (e) { logError('PriceChangeLog batch', e); }
  }
  logStep('Fiyat Değişiklik Geçmişi', n);
}

// ════════════════════════════════════════════════════════════════
// 21. GÜNLÜK RAPORLAR → DailyReports
// ════════════════════════════════════════════════════════════════
async function migrateDailyReports(src, tgt) {
  const { recordset } = await src.request().query(`
    SELECT ID,Tarih,Ciro,Kar,Nakit,KrediKarti,CekSenet,Kupon,Cari,Gider,
           Tahsilat,Odeme,Alim,iade,MusteriSayisi,AlisverisOrtalamasi,
           KarYuzde,SigaraYuzde,Sigara
    FROM GunlukRapor
  `);
  let n = 0;
  for (let i = 0; i < recordset.length; i += BATCH_SIZE) {
    const batch = recordset.slice(i, i + BATCH_SIZE);
    const req = tgt.request();
    const vals = [];
    for (let j = 0; j < batch.length; j++) {
      const r = batch[j], x = `${i}_${j}`;
      const d = (f) => { req.input(`${f}${x}`, sql.Decimal(18, 2), safeNum(r[f])); return `@${f}${x}`; };
      const dt = `dt${x}`; req.input(dt, sql.DateTime, r.Tarih);
      vals.push(`(@${dt},${d('Ciro')},${d('Kar')},${d('Nakit')},${d('KrediKarti')},${d('CekSenet')},${d('Kupon')},${d('Cari')},${d('Gider')},${d('Tahsilat')},${d('Odeme')},${d('Alim')},${d('iade')},${safeInt(r.MusteriSayisi)},${d('AlisverisOrtalamasi')},${d('KarYuzde')},${d('SigaraYuzde')},${d('Sigara')},GETDATE())`);
    }
    try {
      await req.query(`INSERT INTO DailyReports(Date,Turnover,Profit,Cash,CreditCard,ChequeAmount,CouponAmount,AccountSales,Expenses,Collections,Payments,Purchases,Returns,CustomerCount,AvgBasket,ProfitPct,TobaccoPct,TobaccoAmount,CreatedAt) VALUES ${vals.join(',')}`);
      n += batch.length;
    } catch (e) { logError('DailyReports batch', e); }
  }
  logStep('Günlük Raporlar', n);
}

// ════════════════════════════════════════════════════════════════
// 22. ÜRÜN KONUMLARI → ProductLocations
// UrunLoc: Ürünlerin mağaza içi konumu (raf/koridor)
// ════════════════════════════════════════════════════════════════
async function migrateProductLocations(src, tgt) {
  const { recordset } = await src.request().query(`SELECT ID,Adi FROM UrunLoc`);
  let n = 0;
  for (const r of recordset) {
    try {
      await tgt.request()
        .input('id', sql.Int, r.ID)
        .input('nm', sql.NVarChar, safeStr(r.Adi))
        .query(`INSERT INTO ProductLocations(ID,Name) VALUES(@id,@nm)`);
      n++;
    } catch (e) { logError('ProductLocations', e); }
  }
  logStep('Ürün Konumları', n);
}

// ════════════════════════════════════════════════════════════════
// 23. SİSTEM PARAMETRELERİ → LegacyParameters
// ════════════════════════════════════════════════════════════════
async function migrateParameters(src, tgt) {
  const { recordset } = await src.request().query(`SELECT Name,Value FROM Parameter`);
  let n = 0;
  for (const r of recordset) {
    try {
      await tgt.request()
        .input('nm', sql.NVarChar, safeStr(r.Name))
        .input('vl', sql.NVarChar, safeStr(r.Value))
        .query(`INSERT INTO LegacyParameters(Name,Value) VALUES(@nm,@vl)`);
      n++;
    } catch (e) { logError('LegacyParameters', e); }
  }
  logStep('Sistem Parametreleri', n);
}

// ════════════════════════════════════════════════════════════════
// 24. İL / İLÇE → Cities / Districts
// ════════════════════════════════════════════════════════════════
async function migrateCities(src, tgt) {
  const { recordset: iller } = await src.request().query(`SELECT no,adi FROM Il`);
  let cityN = 0;
  for (const r of iller) {
    try {
      await tgt.request()
        .input('id', sql.Int, r.no)
        .input('nm', sql.NVarChar, safeStr(r.adi))
        .query(`INSERT INTO Cities(ID,Name) VALUES(@id,@nm)`);
      cityN++;
    } catch (e) { logError('Il', e); }
  }
  logStep('İller', cityN);

  const { recordset: ilceler } = await src.request().query(`SELECT kod,ilno,adi FROM Ilce`);
  let distN = 0;
  for (let i = 0; i < ilceler.length; i += BATCH_SIZE) {
    const batch = ilceler.slice(i, i + BATCH_SIZE);
    const req = tgt.request();
    const vals = [];
    for (let j = 0; j < batch.length; j++) {
      const r = batch[j], x = `${i}_${j}`;
      req.input(`id${x}`, sql.Int, r.kod);
      req.input(`ci${x}`, sql.Int, r.ilno);
      req.input(`nm${x}`, sql.NVarChar, safeStr(r.adi));
      vals.push(`(@id${x},@ci${x},@nm${x})`);
    }
    try {
      await req.query(`INSERT INTO Districts(ID,CityID,Name) VALUES ${vals.join(',')}`);
      distN += batch.length;
    } catch (e) { logError('Ilce batch', e); }
  }
  logStep('İlçeler', distN);
}

// ════════════════════════════════════════════════════════════════
migrate();