import { useEffect, useState } from 'react';
import { useCourierStore } from '../store/courierStore';
import api from '../lib/api';
import { Calendar, User, DollarSign, CreditCard, Banknote, Check, Calculator, LayoutTemplate } from 'lucide-react';

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
  const delivered = (Number(cashDelivered) || 0) + posTotal;
  const expected = summary ? Number(summary.Turnover || 0) : 0;
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
    <div className="flex flex-col gap-6 h-full pb-10">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
            <LayoutTemplate size={20} className="text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Kurye Gün Sonu</h1>
            <p className="text-sm text-text-muted">Kurye teslimat hesaplaşması ve raporlama</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sol Kolon: Seçimler ve Özet */}
        <div className="col-span-1 lg:col-span-4 flex flex-col gap-6">
          {/* Seçimler */}
          <div className="glass-card p-5 rounded-2xl flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <User size={16} className="text-cyan-accent" />
              Kurye ve Tarih Seçimi
            </h2>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-text-muted font-medium">Kurye Seçimi</label>
                <div className="flex items-center gap-2 glass-card-static px-3 py-2.5 rounded-xl border border-white/5 focus-within:border-cyan-500/50 transition-colors">
                  <User size={16} className="text-text-muted" />
                  <select
                    value={selectedCourier}
                    onChange={(e) => setSelectedCourier(e.target.value)}
                    className="flex-1 text-sm text-text-primary bg-transparent outline-none cursor-pointer"
                  >
                    <option value="" className="bg-dark-bg text-text-muted">Kurye seçin…</option>
                    {couriers.map((c) => (
                      <option key={c.ID} value={c.ID} className="bg-dark-bg text-text-primary">
                        {c.Name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-text-muted font-medium">Tarih</label>
                <div className="flex items-center gap-2 glass-card-static px-3 py-2.5 rounded-xl border border-white/5 focus-within:border-cyan-500/50 transition-colors">
                  <Calendar size={16} className="text-text-muted" />
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="flex-1 bg-transparent border-none outline-none text-sm text-text-primary cursor-pointer"
                    style={{ colorScheme: 'dark' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Özet kutusu */}
          <div className="glass-card p-5 rounded-2xl flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Calculator size={16} className="text-cyan-accent" />
              Sistem Kayıtları (Beklenen)
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <Kpi label="Ciro" value={fmtMoney(expected)} highlight={true} className="col-span-2" />
              <Kpi label="Satış" value={fmtMoney(summary?.Turnover || 0)} />
              <Kpi label="Hizmet" value={fmtMoney(0)} />
              <Kpi
                label="Servis Adedi"
                value={`${summary?.ServiceCount || 0} Paket`}
                className="col-span-2"
              />
            </div>
          </div>
        </div>

        {/* Sağ Kolon: Kurye Teslim Formu */}
        <div className="col-span-1 lg:col-span-8">
          <div className="glass-card p-6 rounded-2xl flex flex-col h-full relative overflow-hidden">
            {/* Arka plan süsü */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none"></div>

            <h2 className="text-lg font-semibold text-text-primary mb-6 flex items-center gap-2 relative z-10">
              <Banknote size={20} className="text-emerald-400" />
              Kuryeden Teslim Alınan Değerler
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 mb-8 relative z-10">
              {/* Sol taraf nakit ve pos girişleri */}
              <div className="flex flex-col gap-4">
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                  Tahsilatlar
                </h3>
                <RowMoney label="Nakit Teslim" icon={Banknote} value={cashDelivered} onChange={setCashDelivered} />
                <div className="flex flex-col gap-3 mt-2">
                  <RowMoney label="Pos 1" icon={CreditCard} value={pos1} onChange={setPos1} />
                  <RowMoney label="Pos 2" icon={CreditCard} value={pos2} onChange={setPos2} />
                  <RowMoney label="Pos 3" icon={CreditCard} value={pos3} onChange={setPos3} />
                </div>
              </div>

              {/* Sağ taraf ekstra giderler ve ödemeler */}
              <div className="flex flex-col gap-4">
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>
                  Ödemeler
                </h3>
                <RowMoney
                  label="Kurye Ödemesi (Hakediş)"
                  icon={DollarSign}
                  value={courierPayment}
                  onChange={setCourierPayment}
                />
              </div>
            </div>

            {/* Toplamlar Bölümü (Kuryeden teslim alınanlar kısmı total hesaplaması) */}
            <div className="mt-auto flex flex-col gap-4 p-5 rounded-2xl bg-gradient-to-br from-cyan-950/40 to-dark-bg border border-cyan-500/20 relative z-10">
              <h3 className="text-xs font-semibold text-cyan-400 uppercase tracking-wide flex items-center gap-2">
                <Calculator size={14} />
                Hesaplaşma Özeti
              </h3>

              <div className="flex flex-wrap items-center gap-6 justify-between">
                <div className="flex flex-wrap gap-6">
                  <SummaryCell label="Pos Toplamı" value={fmtMoney(posTotal)} icon={CreditCard} />
                  <SummaryCell label="Nakit Toplamı" value={fmtMoney(Number(cashDelivered) || 0)} icon={Banknote} />
                </div>

                <div className="w-px h-12 bg-white/10 hidden md:block"></div>

                <div className="flex flex-wrap gap-6">
                  <SummaryCell
                    label="Teslim Edilen Toplam"
                    value={fmtMoney(delivered)}
                    valueClass="text-emerald-400"
                    size="large"
                  />
                  <SummaryCell
                    label="Fark (Teslim - Beklenen)"
                    value={fmtMoney(difference)}
                    valueClass={difference === 0 ? 'text-emerald-400' : (difference > 0 ? 'text-cyan-400' : 'text-red-400')}
                    subtext={difference === 0 ? 'Tam' : (difference > 0 ? 'Fazla' : 'Eksik')}
                    size="large"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={saving || !selectedCourier}
              className="btn-primary mt-6 w-full py-4 rounded-xl text-base font-bold disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 transition-all duration-300 relative z-10"
            >
              <Check size={20} />
              {saving ? 'Rapor Kaydediliyor…' : 'Gün Sonu Raporunu Kaydet'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, highlight, className = '' }) {
  return (
    <div className={`glass-card-static rounded-xl p-4 flex flex-col gap-1.5 ${highlight ? 'border border-cyan-500/30 bg-cyan-500/5' : ''} ${className}`}>
      <span className={`text-xs font-medium ${highlight ? 'text-cyan-400/80' : 'text-text-muted'}`}>{label}</span>
      <span className={`text-xl font-bold ${highlight ? 'text-cyan-400' : 'text-emerald-400'}`}>{value}</span>
    </div>
  );
}

function RowMoney({ label, icon: Icon, value, onChange }) {
  const handleFocus = (e) => e.target.select();

  return (
    <div className="flex flex-col gap-1.5 group">
      <label className="text-xs font-medium text-text-muted group-focus-within:text-cyan-accent transition-colors flex items-center gap-1.5">
        <Icon size={14} className="opacity-70" />
        {label}
      </label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
          <span className="text-text-muted text-sm font-semibold">₺</span>
        </div>
        <input
          type="number"
          step="0.01"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={handleFocus}
          className="w-full glass-card-static rounded-xl pl-8 pr-4 py-2.5 text-sm font-semibold text-text-primary bg-dark-bg/50 outline-none border border-white/5 focus:border-cyan-500/50 transition-all"
          placeholder="0.00"
        />
      </div>
    </div>
  );
}

function SummaryCell({ label, value, valueClass = "text-text-primary", subtext, icon: Icon, size = "normal" }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] text-text-muted font-medium uppercase tracking-wider flex items-center gap-1.5">
        {Icon && <Icon size={12} className="opacity-70" />}
        {label}
      </span>
      <div className="flex items-center gap-2">
        <span className={`font-bold ${size === "large" ? "text-2xl" : "text-lg"} ${valueClass}`}>
          {value}
        </span>
        {subtext && (
          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-white/10 text-text-muted">
            {subtext}
          </span>
        )}
      </div>
    </div>
  );
}


