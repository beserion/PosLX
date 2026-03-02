import { useEffect, useState } from 'react';
import api from '../lib/api';
import { AlertTriangle } from 'lucide-react';

export default function CancellationLogsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/cancellations');
      setRows(data);
    } catch (err) {
      console.error('Failed to fetch cancellations:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-text-primary">İptal / İade Kayıtları</h1>
          <span className="badge badge-danger">
            <AlertTriangle size={10} /> {rows.length} Kayıt
          </span>
        </div>
        <button
          onClick={load}
          className="glass-card-static px-3 py-2 rounded-xl text-xs font-semibold"
        >
          Yenile
        </button>
      </div>

      <div className="glass-card p-4 rounded-2xl overflow-x-auto">
        {loading ? (
          <div className="text-center text-text-muted py-10">Yükleniyor…</div>
        ) : rows.length === 0 ? (
          <div className="text-center text-text-muted py-10">
            Henüz iptal veya iade kaydı yok.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-muted border-b border-white/5">
                <th className="pb-2 pr-3">Tarih</th>
                <th className="pb-2 pr-3">Tür</th>
                <th className="pb-2 pr-3">Referans</th>
                <th className="pb-2 pr-3">Personel</th>
                <th className="pb-2 pr-3">Sebep</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.ID}
                  className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                >
                  <td className="py-2 pr-3 text-text-muted whitespace-nowrap">
                    {r.CreatedAt ? r.CreatedAt.replace('T', ' ').slice(0, 16) : ''}
                  </td>
                  <td className="py-2 pr-3 text-text-primary">{r.RefType}</td>
                  <td className="py-2 pr-3 text-text-muted">#{r.RefID}</td>
                  <td className="py-2 pr-3 text-text-muted text-xs">
                    {r.StaffName || '—'}
                  </td>
                  <td className="py-2 pr-3 text-text-primary text-xs">
                    {r.Reason || '—'}
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

