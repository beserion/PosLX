import { useEffect, useState } from 'react';
import { useCourierStore } from '../store/courierStore';
import api from '../lib/api';
import { Calendar, User, DollarSign, CreditCard, Banknote, Check } from 'lucide-react';

function fmtMoney(v) {
  return `₺${Number(v || 0).toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function CourierSettlementPage() {
  const { couriers, fetchCouriers } = useCourierStore();

  const today = new Date().toISOString().slice(0, 10);
  const [selectedCourier, setSelectedCourier] = useState('');
  const [date, setDate] = useState(today);

  const [summary, setSummary] = useState(null);
  const [settlement, setSettlement] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [cashDelivered, setCashDelivered] = useState('0');
  const [pos1, setPos1] = useState('0');
  const [pos2, setPos2] = useState('0');
  const [pos3, setPos3] = useState('0');
  const [courierPayment, setCourierPayment] = useState('0');

  useEffect(() => {
    fetchCouriers();
  }, []);

  const loadSummary = async () => {
    if (!selectedCourier) return;
    setLoading(true);
    try {
      const { data } = await api.get('/courier-settlements/summary', {
        params: { courierId: selectedCourier, date },
      });
      setSummary(data.summary);
      setSettlement(data.settlement);

      if (data.settlement) {
        setCashDelivered(String(data.settlement.CashDelivered ?? 0));
        setPos1(String(data.settlement.Pos1Amount ?? 0));
        setPos2(String(data.settlement.Pos2Amount ?? 0));
        setPos3(String(data.settlement.Pos3Amount ?? 0));
        setCourierPayment(String(data.settlement.CourierPayment ?? 0));
      } else {
        setCashDelivered('0');
        setPos1('0');
        setPos2('0');
        setPos3('0');
        setCourierPayment('0');
      }
    } catch (err) {
      console.error('Failed to load courier settlement summary:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCourier) loadSummary();
  }, [selectedCourier, date]);

  const posTotal =
    (Number(pos1) || 0) + (Number(pos2) || 0) + (Number(pos3) || 0);
  const expected = summary ? Number(summary.Turnover || 0) : 0;
  const delivered = (Number(cashDelivered) || 0) + posTotal;
  const difference = delivered - expected;

  const handleSave = async () => {
    if (!selectedCourier) return;
    setSaving(true);
    try {
      await api.post('/courier-settlements', {
        CourierID: Number(selectedCourier),
        Date: date,
        CashDelivered: Number(cashDelivered) || 0,
        Pos1Amount: Number(pos1) || 0,
        Pos2Amount: Number(pos2) || 0,
        Pos3Amount: Number(pos3) || 0,
        PosTotal: posTotal,
        Difference: difference,
        CourierPayment: Number(courierPayment) || 0,
        Turnover: summary?.Turnover || 0,
        SalesAmount: summary?.Turnover || 0,
        ServiceAmount: 0,
        ServiceCount: summary?.ServiceCount || 0,
      });
      await loadSummary();
      alert('Kurye raporu kaydedildi.');
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-text-primary">Kurye Gün Sonu</h1>
        </div>
      </div>

      {/* Top selection + KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Seçimler */}
        <div className="glass-card p-4 rounded-2xl flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-muted font-medium">Kurye Seçim</label>
            <div className="flex items-center gap-2">
              <User size={14} className="text-cyan-accent" />
              <select
                value={selectedCourier}
                onChange={(e) => setSelectedCourier(e.target.value)}
                className="flex-1 glass-card-static rounded-xl px-3 py-2 text-sm text-text-primary bg-transparent outline-none"
              >
                <option value="">Kurye seçin…</option>
                {couriers.map((c) => (
                  <option key={c.ID} value={c.ID}>
                    {c.Name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-muted font-medium">Tarih</label>
            <div className="flex items-center gap-2 glass-card-static px-3 py-2 rounded-xl">
              <Calendar size={14} className="text-cyan-accent" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-transparent border-none outline-none text-sm text-text-primary"
                style={{ colorScheme: 'dark' }}
              />
            </div>
          </div>
        </div>

        {/* Özet kutusu */}
        <div className="glass-card p-4 rounded-2xl grid grid-cols-2 gap-3">
          <Kpi label="Ciro" value={fmtMoney(summary?.Turnover || 0)} />
          <Kpi label="Satış" value={fmtMoney(summary?.Turnover || 0)} />
          <Kpi label="Hizmet" value={fmtMoney(0)} />
          <Kpi
            label="Servis Ad."
            value={`${summary?.ServiceCount || 0} Adet`}
          />
        </div>
      </div>

      {/* Kurye Teslim Formu */}
      <div className="glass-card p-4 rounded-2xl max-w-xl">
        <h2 className="text-sm font-semibold text-text-primary mb-3">
          Kuryeden Teslim Alınan
        </h2>

        <div className="flex flex-col gap-2">
          <RowMoney
            label="Nakit"
            icon={Banknote}
            value={cashDelivered}
            onChange={setCashDelivered}
          />
          <RowMoney label="Pos 1" icon={CreditCard} value={pos1} onChange={setPos1} />
          <RowMoney label="Pos 2" icon={CreditCard} value={pos2} onChange={setPos2} />
          <RowMoney label="Pos 3" icon={CreditCard} value={pos3} onChange={setPos3} />

          <RowDisplay
            label="Pos Toplam"
            icon={CreditCard}
            value={fmtMoney(posTotal)}
            valueClass="text-emerald-400"
          />

          <RowDisplay
            label="Fark"
            icon={DollarSign}
            value={fmtMoney(difference)}
            valueClass={difference === 0 ? 'text-emerald-400' : 'text-red-400'}
          />

          <RowMoney
            label="Kurye Ödemesi"
            icon={DollarSign}
            value={courierPayment}
            onChange={setCourierPayment}
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !selectedCourier}
          className="btn-primary mt-4 w-full py-2.5 rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Check size={16} />
          {saving ? 'Kaydediliyor…' : 'Rapor Kaydet'}
        </button>
      </div>
    </div>
  );
}

function Kpi({ label, value }) {
  return (
    <div className="glass-card-static rounded-xl p-3 flex flex-col gap-1">
      <span className="text-xs text-text-muted font-medium">{label}</span>
      <span className="text-base font-bold text-emerald-400">{value}</span>
    </div>
  );
}

function RowMoney({ label, icon: Icon, value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-28 text-xs text-text-muted flex items-center gap-1">
        <Icon size={12} className="text-text-muted" />
        <span>{label}</span>
      </div>
      <input
        type="number"
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 glass-card-static rounded-xl px-3 py-1.5 text-sm text-text-primary bg-transparent outline-none text-right"
      />
    </div>
  );
}

function RowDisplay({ label, icon: Icon, value, valueClass }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-28 text-xs text-text-muted flex items-center gap-1">
        <Icon size={12} className="text-text-muted" />
        <span>{label}</span>
      </div>
      <div className="flex-1 glass-card-static rounded-xl px-3 py-1.5 text-sm text-right">
        <span className={valueClass}>{value}</span>
      </div>
    </div>
  );
}

