import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { Calendar, Search, Filter, Download, Printer } from 'lucide-react';
import { exportToExcel } from '../lib/excelExport';
import { printReport } from '../lib/printExport';

function fmtMoney(v) {
  return `₺${Number(v || 0).toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function StockMovementsPage() {
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [groupOrProduct, setGroupOrProduct] = useState('');
  const [operation, setOperation] = useState('all'); // all | purchased | notPurchased | sold | notSold
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/stock-movements', {
        params: { startDate, endDate, groupOrProduct, operation },
      });
      setRows(data.rows || []);
    } catch (err) {
      console.error('Failed to fetch stock movements:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const totalStockValue = rows.reduce((s, r) => s + (Number(r.StockValue) || 0), 0);
  const totalPurchase = rows.reduce((s, r) => s + (Number(r.PurchaseTotal) || 0), 0);
  const totalSales = rows.reduce((s, r) => s + (Number(r.SalesTotal) || 0), 0);

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-text-primary">Ürün Hareket Raporu</h1>
          <span className="badge badge-cyan">
            <Filter size={10} /> {rows.length} Kayıt
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const columns = [
                { header: 'Barkod', key: 'Barcode', formatter: (v) => v || '—' },
                { header: 'İsim', key: 'Name' },
                { header: 'Grup', key: 'Category', formatter: (v) => v || '—' },
                { header: 'Stok Adedi', key: 'Stock' },
                { header: 'Stok Değeri (₺)', key: 'StockValue', formatter: (v) => Number(v || 0).toFixed(2) },
                { header: 'Alım Miktarı', key: 'PurchaseQty' },
                { header: 'Alım Değeri (₺)', key: 'PurchaseTotal', formatter: (v) => Number(v || 0).toFixed(2) },
                { header: 'Satış Miktarı', key: 'SalesQty' },
                { header: 'Satış Değeri (₺)', key: 'SalesTotal', formatter: (v) => Number(v || 0).toFixed(2) },
              ];
              printReport(rows, columns, { title: 'Ürün Hareket (Stok) Raporu' });
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-all cursor-pointer"
          >
            <Printer size={16} /> Yazdır
          </button>
          <button
            onClick={() => exportToExcel(
              rows,
              [
                { header: 'Barkod', key: 'Barcode', formatter: (v) => v || '—' },
                { header: 'İsim', key: 'Name' },
                { header: 'Grup', key: 'Category', formatter: (v) => v || '—' },
                { header: 'Stok Adedi', key: 'Stock' },
                { header: 'Stok Değeri (₺)', key: 'StockValue', formatter: (v) => Number(v || 0).toFixed(2) },
                { header: 'Alım Miktarı', key: 'PurchaseQty' },
                { header: 'Alım Değeri (₺)', key: 'PurchaseTotal', formatter: (v) => Number(v || 0).toFixed(2) },
                { header: 'Satış Miktarı', key: 'SalesQty' },
                { header: 'Satış Değeri (₺)', key: 'SalesTotal', formatter: (v) => Number(v || 0).toFixed(2) },
              ],
              'Urun_Hareket_Raporu',
              { title: 'Ürün Hareket (Stok) Raporu' }
            )}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all cursor-pointer"
          >
            <Download size={16} /> Excel'e Aktar
          </button>
          <button
            onClick={fetchReport}
            className="btn-primary flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold"
          >
            <Search size={16} /> Raporu Getir
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 rounded-2xl flex flex-col gap-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Tarih aralığı */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-muted font-medium">Tarih Aralığı</label>
            <div className="flex items-center gap-2 glass-card-static px-3 py-2 rounded-xl">
              <Calendar size={14} className="text-cyan-accent" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent border-none outline-none text-sm text-text-primary"
                style={{ colorScheme: 'dark' }}
              />
              <span className="text-text-muted text-xs">—</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent border-none outline-none text-sm text-text-primary"
                style={{ colorScheme: 'dark' }}
              />
            </div>
          </div>

          {/* Grup / Ürün adı */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-muted font-medium">Grup / Ürün Adı</label>
            <input
              type="text"
              value={groupOrProduct}
              onChange={(e) => setGroupOrProduct(e.target.value)}
              placeholder="Örn: BIRA-TUBORG*"
              className="glass-card-static rounded-xl px-3 py-2 text-sm text-text-primary bg-transparent outline-none"
            />
          </div>

          {/* İşlemler */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-muted font-medium">İşlemler</label>
            <select
              value={operation}
              onChange={(e) => setOperation(e.target.value)}
              className="glass-card-static rounded-xl px-3 py-2 text-sm text-text-primary bg-transparent outline-none"
            >
              <option value="all">Alınanlar, Alınmayanlar, Satılanlar, Satılmayanlar</option>
              <option value="purchased">Yalnızca Alınanlar</option>
              <option value="notPurchased">Alınmayanlar</option>
              <option value="sold">Yalnızca Satılanlar</option>
              <option value="notSold">Satılmayanlar</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <SummaryCard label="Stok Değeri" value={fmtMoney(totalStockValue)} />
        <SummaryCard label="Toplam Alım Tutarı" value={fmtMoney(totalPurchase)} />
        <SummaryCard label="Toplam Satış Tutarı" value={fmtMoney(totalSales)} />
      </div>

      {/* Table */}
      <div className="glass-card p-4 rounded-2xl overflow-x-auto">
        {loading ? (
          <div className="text-center text-text-muted py-10">Yükleniyor…</div>
        ) : rows.length === 0 ? (
          <div className="text-center text-text-muted py-10">
            Bu filtrelerle ürün hareketi bulunamadı.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-muted border-b border-white/5">
                <th className="pb-2 pr-3">Barkot</th>
                <th className="pb-2 pr-3">İsim</th>
                <th className="pb-2 pr-3">Grup</th>
                <th className="pb-2 pr-3 text-center">Stok Adedi</th>
                <th className="pb-2 pr-3 text-right">Stok Değeri</th>
                <th className="pb-2 pr-3 text-center">Alım Miktarı</th>
                <th className="pb-2 pr-3 text-right">Alım Değeri</th>
                <th className="pb-2 pr-3 text-center">Satış Miktarı</th>
                <th className="pb-2 pr-3 text-right">Satış Değeri</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.ID}
                  onClick={() => navigate(`/products/${r.ID}/dashboard`)}
                  className="border-b border-white/5 hover:bg-white/[0.04] transition-colors cursor-pointer"
                >
                  <td className="py-2 pr-3 text-text-muted whitespace-nowrap">
                    {r.Barcode || '—'}
                  </td>
                  <td className="py-2 pr-3 text-text-primary">{r.Name}</td>
                  <td className="py-2 pr-3 text-text-muted text-xs">{r.Category || '—'}</td>
                  <td className="py-2 pr-3 text-center text-text-primary font-medium">
                    {r.Stock}
                  </td>
                  <td className="py-2 pr-3 text-right text-text-muted">
                    {fmtMoney(r.StockValue)}
                  </td>
                  <td className="py-2 pr-3 text-center text-text-primary">
                    {r.PurchaseQty}
                  </td>
                  <td className="py-2 pr-3 text-right text-text-muted">
                    {fmtMoney(r.PurchaseTotal)}
                  </td>
                  <td className="py-2 pr-3 text-center text-text-primary">
                    {r.SalesQty}
                  </td>
                  <td className="py-2 pr-3 text-right text-text-muted">
                    {fmtMoney(r.SalesTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="glass-card p-4 rounded-2xl flex flex-col gap-1">
      <span className="text-xs text-text-muted font-medium uppercase tracking-wide">
        {label}
      </span>
      <span className="text-lg font-bold text-text-primary">{value}</span>
    </div>
  );
}

