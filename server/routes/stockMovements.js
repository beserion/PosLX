import { Router } from 'express';
import { getDb } from '../config/db.js';

const router = Router();

// ── GET /api/stock-movements ───────────────────────────────────
// Hesaplama mantığı:
// - Satın alma hareketleri: Invoices + InvoiceItems (Qty, UnitPrice)
// - Satış hareketleri: Sales + SaleItems (Qty, UnitPrice)
// - Son stok ve stok değeri: Products tablosundaki Stock ve CostPrice
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    if (!db) {
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
    const rows = db
      .prepare(
        `
        WITH PurchaseAgg AS (
          SELECT
            ii.ProductID,
            IFNULL(SUM(ii.Qty), 0)        AS PurchaseQty,
            IFNULL(SUM(ii.Qty * ii.UnitPrice), 0) AS PurchaseTotal
          FROM InvoiceItems ii
          JOIN Invoices i ON i.ID = ii.InvoiceID
          WHERE date(i.CreatedAt) BETWEEN date(?) AND date(?)
          GROUP BY ii.ProductID
        ),
        SalesAgg AS (
          SELECT
            si.ProductID,
            IFNULL(SUM(si.Qty), 0)        AS SalesQty,
            IFNULL(SUM(si.Qty * si.UnitPrice), 0) AS SalesTotal
          FROM SaleItems si
          JOIN Sales s ON s.ID = si.SaleID
          WHERE date(s.CreatedAt) BETWEEN date(?) AND date(?)
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
          IFNULL(pa.PurchaseQty, 0)   AS PurchaseQty,
          IFNULL(pa.PurchaseTotal, 0) AS PurchaseTotal,
          IFNULL(sa.SalesQty, 0)      AS SalesQty,
          IFNULL(sa.SalesTotal, 0)    AS SalesTotal,
          (p.Stock * p.CostPrice)     AS StockValue
        FROM Products p
        LEFT JOIN PurchaseAgg pa ON pa.ProductID = p.ID
        LEFT JOIN SalesAgg sa    ON sa.ProductID = p.ID
        LEFT JOIN FirstBarcode fb ON fb.ProductID = p.ID
        WHERE IFNULL(p.IsDeleted, 0) = 0
      `
      )
      .all(sd, ed, sd, ed);

    // JS tarafında metin filtresi ve işlem filtresi
    let filtered = rows;

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

