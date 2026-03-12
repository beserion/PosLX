/**
 * MarcaPOS Veri Tanı Scripti
 * Eski veritabanındaki tüm tablolarda kaç kayıt var gösterir.
 * Bu çıktıyı paylaşın — hangi verilerin aktarılmadığını birlikte belirleyelim.
 *
 * Kullanım: node scripts/diagnose.js
 */

import sql from 'mssql';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const SOURCE_RAW_SERVER = 'localhost\\MSSQLSERVER01';
const parts = SOURCE_RAW_SERVER.split('\\');

const SOURCE_CONFIG = {
    user: 'sa',
    password: '123',
    server: parts[0],
    database: 'MarcaPOS',
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true,
        instanceName: parts[1],
    }
};

async function diagnose() {
    const pool = await new sql.ConnectionPool(SOURCE_CONFIG).connect();
    console.log('✅ MarcaPOS veritabanına bağlanıldı.\n');

    // 1. Tüm tabloların satır sayısı
    console.log('═══════════════════════════════════════════════════');
    console.log('  TÜM TABLOLAR — KAYIT SAYILARI');
    console.log('═══════════════════════════════════════════════════');

    const { recordset: tables } = await pool.request().query(`
    SELECT
      t.name AS TableName,
      p.rows AS RecordCount
    FROM sys.tables t
    JOIN sys.partitions p ON t.object_id = p.object_id AND p.index_id IN (0,1)
    ORDER BY p.rows DESC
  `);

    const aktarilan = [
        'UrunGrup', 'Urun', 'Musteri', 'Toptanci', 'CariList', 'Personel',
        'KuryeList', 'Kasa', 'HareketBaslik', 'Hareket', 'AlisFaturasi',
        'AlisFaturasiUrun', 'FaturaList', 'FaturaIcerik', 'CariHareketler',
        'PersonelYetki', 'KuryeRapor', 'CariBakiye', 'CariGruplar', 'CariTipleri',
        'CariAdresler'
    ];

    let aktarilmayan = [];

    for (const t of tables) {
        const durum = aktarilan.includes(t.TableName) ? '✅ aktarıldı' : '❌ AKTARILMADI';
        const satir = t.RecordCount.toString().padStart(8);
        console.log(`  ${satir}  ${t.TableName.padEnd(40)} ${durum}`);
        if (!aktarilan.includes(t.TableName) && t.RecordCount > 0) {
            aktarilmayan.push({ table: t.TableName, rows: t.RecordCount });
        }
    }

    console.log('\n═══════════════════════════════════════════════════');
    console.log('  AKTARILMAYAN VE VERİSİ OLAN TABLOLAR');
    console.log('═══════════════════════════════════════════════════');
    if (aktarilmayan.length === 0) {
        console.log('  Tüm verili tablolar aktarıldı!');
    } else {
        for (const t of aktarilmayan) {
            console.log(`  ${t.rows.toString().padStart(8)} kayıt  →  ${t.table}`);
        }
    }

    // 2. HareketTuru dağılımı
    console.log('\n═══════════════════════════════════════════════════');
    console.log('  HareketBaslik — TÜM HareketTuru KODLARI');
    console.log('═══════════════════════════════════════════════════');
    const { recordset: turler } = await pool.request().query(`
    SELECT HareketTuru, COUNT(*) AS Adet
    FROM HareketBaslik
    GROUP BY HareketTuru
    ORDER BY Adet DESC
  `);
    for (const r of turler) {
        console.log(`  ${r.HareketTuru}  →  ${r.Adet.toLocaleString()} kayıt`);
    }

    // 3. Satış kalemleri HareketTuru dağılımı
    console.log('\n═══════════════════════════════════════════════════');
    console.log('  Hareket (detay) — HareketTuru KODLARI');
    console.log('═══════════════════════════════════════════════════');
    const { recordset: detayTurler } = await pool.request().query(`
    SELECT HareketTuru, COUNT(*) AS Adet
    FROM Hareket
    GROUP BY HareketTuru
    ORDER BY Adet DESC
  `);
    for (const r of detayTurler) {
        console.log(`  ${r.HareketTuru}  →  ${r.Adet.toLocaleString()} kayıt`);
    }

    // 4. Boş olmayan ama aktarılmayan tablolar için örnek sütunlar
    console.log('\n═══════════════════════════════════════════════════');
    console.log('  AKTARILMAYAN TABLOLARIN SÜTUNLARI (ilk 3 kayıt)');
    console.log('═══════════════════════════════════════════════════');
    for (const t of aktarilmayan.slice(0, 10)) {
        try {
            const { recordset: sample } = await pool.request()
                .query(`SELECT TOP 3 * FROM [${t.table}]`);
            console.log(`\n  ── ${t.table} (${t.rows} kayıt) ──`);
            if (sample.length > 0) {
                console.log('  Sütunlar:', Object.keys(sample[0]).join(', '));
            }
        } catch (e) {
            console.log(`  ── ${t.table}: okunamadı (${e.message})`);
        }
    }

    await pool.close();
    console.log('\n✅ Tanı tamamlandı. Bu çıktıyı paylaşın.\n');
}

diagnose().catch(console.error);