import { useEffect, useState } from 'react';
import api from '../lib/api';
import { usePosStore } from '../store/posStore';
import { useAccountStore } from '../store/accountStore';
import { Percent, Plus, X, Calendar } from 'lucide-react';

function fmtMoney(v) {
  return `₺${Number(v || 0).toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function SpecialPricesPage() {
  const products = usePosStore((s) => s.products);
  const fetchProducts = usePosStore((s) => s.fetchProducts);
  const { accounts, fetchAccounts } = useAccountStore();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/special-prices');
      setRows(data);
    } catch (err) {
      console.error('Failed to fetch special prices:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchAccounts();
    load();
  }, []);

  const handleDeactivate = async (id) => {
    if (!confirm('Bu özel fiyatı pasif yapmak istediğinize emin misiniz?')) return;
    await api.delete(`/special-prices/${id}`);
    load();
  };

  return (
    <>
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-text-primary">Özel Fiyatlar / Kampanyalar</h1>
            <span className="badge badge-cyan">
              <Percent size={10} /> {rows.length} Kayıt
            </span>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold"
          >
            <Plus size={16} /> Yeni Özel Fiyat
          </button>
        </div>

        <div className="glass-card p-4 rounded-2xl overflow-x-auto">
          {loading ? (
            <div className="text-center text-text-muted py-10">Yükleniyor…</div>
          ) : rows.length === 0 ? (
            <div className="text-center text-text-muted py-10">
              Henüz tanımlı özel fiyat veya kampanya yok.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-text-muted border-b border-white/5">
                  <th className="pb-2 pr-3">Ürün</th>
                  <th className="pb-2 pr-3">Cari</th>
                  <th className="pb-2 pr-3 text-right">Özel Fiyat</th>
                  <th className="pb-2 pr-3">Ad</th>
                  <th className="pb-2 pr-3">Başlangıç</th>
                  <th className="pb-2 pr-3">Bitiş</th>
                  <th className="pb-2 pr-3">Durum</th>
                  <th className="pb-2 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.ID}
                    className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="py-2 pr-3 text-text-primary">
                      {r.ProductName || `#${r.ProductID}`}
                    </td>
                    <td className="py-2 pr-3 text-text-muted">
                      {r.AccountName || 'Tüm Müşteriler'}
                    </td>
                    <td className="py-2 pr-3 text-right text-cyan-accent font-bold">
                      {fmtMoney(r.SpecialPrice)}
                    </td>
                    <td className="py-2 pr-3 text-text-muted text-xs">{r.Name || '—'}</td>
                    <td className="py-2 pr-3 text-text-muted text-xs">
                      {r.StartDate ? r.StartDate.slice(0, 10) : '—'}
                    </td>
                    <td className="py-2 pr-3 text-text-muted text-xs">
                      {r.EndDate ? r.EndDate.slice(0, 10) : '—'}
                    </td>
                    <td className="py-2 pr-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${
                          r.IsActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-300'
                        }`}
                      >
                        {r.IsActive ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {r.IsActive ? (
                        <button
                          onClick={() => handleDeactivate(r.ID)}
                          className="text-text-muted hover:text-red-400 text-xs"
                        >
                          Pasif Yap
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && (
        <SpecialPriceModal
          products={products}
          accounts={accounts}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false);
            load();
          }}
        />
      )}
    </>
  );
}

function SpecialPriceModal({ products, accounts, onClose, onSaved }) {
  const [productId, setProductId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!productId || !price) return;
    setSaving(true);
    try {
      await api.post('/special-prices', {
        ProductID: Number(productId),
        AccountID: accountId ? Number(accountId) : null,
        Name: name || null,
        SpecialPrice: Number(price),
        StartDate: startDate || null,
        EndDate: endDate || null,
        IsActive: 1,
      });
      onSaved();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="glass-card p-6 rounded-2xl w-full max-w-xl flex flex-col gap-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-text-primary">Yeni Özel Fiyat</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1 col-span-2">
            <label className="text-xs text-text-muted font-medium">Ürün *</label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              required
              className="glass-card-static rounded-xl px-3 py-2 text-sm text-text-primary bg-transparent outline-none"
            >
              <option value="">Ürün seçin…</option>
              {products.map((p) => (
                <option key={p.ID} value={p.ID}>
                  {p.Name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1 col-span-2">
            <label className="text-xs text-text-muted font-medium">Cari (Opsiyonel)</label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="glass-card-static rounded-xl px-3 py-2 text-sm text-text-primary bg-transparent outline-none"
            >
              <option value="">Tüm müşteriler</option>
              {accounts.map((a) => (
                <option key={a.ID} value={a.ID}>
                  {a.Name} ({a.Type})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-muted font-medium">Özel Fiyat (₺) *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
              className="glass-card-static rounded-xl px-3 py-2 text-sm text-text-primary bg-transparent outline-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-muted font-medium">Ad / Kampanya İsmi</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn: Haftasonu İndirimi"
              className="glass-card-static rounded-xl px-3 py-2 text-sm text-text-primary bg-transparent outline-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-muted font-medium">Başlangıç Tarihi</label>
            <div className="flex items-center gap-2 glass-card-static px-3 py-2 rounded-xl">
              <Calendar size={14} className="text-cyan-accent" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent border-none outline-none text-sm text-text-primary"
                style={{ colorScheme: 'dark' }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-muted font-medium">Bitiş Tarihi</label>
            <div className="flex items-center gap-2 glass-card-static px-3 py-2 rounded-xl">
              <Calendar size={14} className="text-cyan-accent" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent border-none outline-none text-sm text-text-primary"
                style={{ colorScheme: 'dark' }}
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving || !productId || !price}
          className="btn-primary w-full py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
        >
          {saving ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </form>
    </div>
  );
}

