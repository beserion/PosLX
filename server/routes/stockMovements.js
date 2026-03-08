import { Router } from 'express';
import { getDb } from '../config/db.js';
import sql from 'mssql';

const router = Router();

// ── GET /api/stock-movements ───────────────────────────────────
// Hesaplama mantığı:
// - Satın alma hareketleri: Invoices + InvoiceItems (Qty, UnitPrice)
// - Satış hareketleri: Sales + SaleItems (Qty, UnitPrice)
// - Son stok ve stok değeri: Products tablosundaki Stock ve CostPrice
router.get('/', async (req, res) => {
  try {
    const pool = await getDb();
    if (!pool) {
      return res.status(503).json({ error: 'Database not available' });
    }

    const {
      startDate,
      endDate,
      groupOrProduct, // ürün adı veya kategori filtre metni
      operation, // all | purchased | notPurchased | sold | notSold
    } = req.query;

    const sd = startDate || new Date().toISOString().slice(0, 10);
    const ed = endDate || sd;

    // Ana sorgu: ürün bazında alım/satım toplamları
    const result = await pool.request()
      .input('sd', sql.NVarChar, sd)
      .input('ed', sql.NVarChar, ed)
      .query(`
        WITH PurchaseAgg AS (
          SELECT
            ii.ProductID,
            COALESCE(SUM(ii.Qty), 0)        AS PurchaseQty,
            COALESCE(SUM(ii.Qty * ii.UnitPrice), 0) AS PurchaseTotal
          FROM InvoiceItems ii
          JOIN Invoices i ON i.ID = ii.InvoiceID
          WHERE CAST(i.CreatedAt AS DATE) BETWEEN CAST(@sd AS DATE) AND CAST(@ed AS DATE)
          GROUP BY ii.ProductID
        ),
        SalesAgg AS (
          SELECT
            si.ProductID,
            COALESCE(SUM(si.Qty), 0)        AS SalesQty,
            COALESCE(SUM(si.Qty * si.UnitPrice), 0) AS SalesTotal
          FROM SaleItems si
          JOIN Sales s ON s.ID = si.SaleID
          WHERE CAST(s.CreatedAt AS DATE) BETWEEN CAST(@sd AS DATE) AND CAST(@ed AS DATE)
          GROUP BY si.ProductID
        ),
        FirstBarcode AS (
          SELECT
            ProductID,
            MIN(Barcode) AS Barcode
          FROM ProductBarcodes
          GROUP BY ProductID
        )
        SELECT
          p.ID,
          p.Name,
          p.Category,
          fb.Barcode,
          p.Stock,
          p.CostPrice,
          COALESCE(pa.PurchaseQty, 0)   AS PurchaseQty,
          COALESCE(pa.PurchaseTotal, 0) AS PurchaseTotal,
          COALESCE(sa.SalesQty, 0)      AS SalesQty,
          COALESCE(sa.SalesTotal, 0)    AS SalesTotal,
          (p.Stock * p.CostPrice)     AS StockValue
        FROM Products p
        LEFT JOIN PurchaseAgg pa ON pa.ProductID = p.ID
        LEFT JOIN SalesAgg sa    ON sa.ProductID = p.ID
        LEFT JOIN FirstBarcode fb ON fb.ProductID = p.ID
        WHERE COALESCE(p.IsDeleted, 0) = 0
      `);

    let filtered = result.recordset;

    // JS tarafında metin filtresi ve işlem filtresi
    if (groupOrProduct && groupOrProduct.trim() !== '') {
      const q = groupOrProduct.trim().toLowerCase();
      filtered = filtered.filter(
        (r) =>
          (r.Name && r.Name.toLowerCase().includes(q)) ||
          (r.Category && r.Category.toLowerCase().includes(q)) ||
          (r.Barcode && r.Barcode.toLowerCase().includes(q))
      );
    }

    switch (operation) {
      case 'purchased':
        filtered = filtered.filter((r) => r.PurchaseQty > 0);
        break;
      case 'notPurchased':
        filtered = filtered.filter((r) => r.PurchaseQty === 0);
        break;
      case 'sold':
        filtered = filtered.filter((r) => r.SalesQty > 0);
        break;
      case 'notSold':
        filtered = filtered.filter((r) => r.SalesQty === 0);
        break;
      default:
        // all
        break;
    }

    res.json({
      startDate: sd,
      endDate: ed,
      count: filtered.length,
      rows: filtered,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

