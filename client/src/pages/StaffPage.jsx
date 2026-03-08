import { useEffect, useState } from 'react';
import { useStaffStore } from '../store/staffStore';
import { useAuthStore } from '../store/authStore';
import { Users, Plus, X } from 'lucide-react';

export default function StaffPage() {
  const { staff, fetchStaff, createStaff, updateStaff, deleteStaff } =
    useStaffStore();
  const currentUser = useAuthStore((s) => s.user);

  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchStaff();
  }, []);



  return (
    <>
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-text-primary">Personel & Yetki</h1>
            <span className="badge badge-cyan">
              <Users size={10} /> {staff.length} Kayıt
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowModal(true)}
              className="btn-primary flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold"
            >
              <Plus size={16} /> Yeni Personel
            </button>
          </div>
        </div>

        {currentUser && (
          <div className="glass-card p-3 rounded-2xl text-sm flex items-center gap-2">
            <span className="text-text-muted">Aktif Kullanıcı:</span>
            <span className="font-semibold text-text-primary">
              {currentUser.Name} ({currentUser.Role})
            </span>
          </div>
        )}

        <div className="glass-card p-4 rounded-2xl overflow-x-auto">
          {staff.length === 0 ? (
            <div className="text-center text-text-muted py-10">
              Henüz personel kaydı yok.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-text-muted border-b border-white/5">
                  <th className="pb-2 pr-3">Ad</th>
                  <th className="pb-2 pr-3">Rol</th>
                  <th className="pb-2 pr-3">Durum</th>
                  <th className="pb-2 pr-3">Oluşturma</th>
                  <th className="pb-2 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr
                    key={s.ID}
                    className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="py-2 pr-3 text-text-primary">{s.Name}</td>
                    <td className="py-2 pr-3 text-text-muted">{s.Role}</td>
                    <td className="py-2 pr-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${s.IsActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-300'
                          }`}
                      >
                        {s.IsActive ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-text-muted text-xs">
                      {s.CreatedAt ? s.CreatedAt.slice(0, 10) : ''}
                    </td>
                    <td className="py-2 pr-3 text-right text-xs">
                      {s.IsActive && (
                        <button
                          onClick={() => deleteStaff(s.ID)}
                          className="text-text-muted hover:text-red-400"
                        >
                          Pasif Yap
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && <StaffModal onClose={() => setShowModal(false)} onCreated={fetchStaff} />}
    </>
  );
}

function StaffModal({ onClose, onCreated }) {
  const { createStaff } = useStaffStore();
  const [name, setName] = useState('');
  const [role, setRole] = useState('Cashier');
  const [pin, setPin] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !pin) return;
    setSaving(true);
    try {
      await createStaff({ Name: name, Role: role, Pin: pin });
      await onCreated();
      onClose();
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
        className="glass-card p-6 rounded-2xl w-full max-w-md flex flex-col gap-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-text-primary">Yeni Personel</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-text-muted font-medium">Ad *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="glass-card-static rounded-xl px-3 py-2 text-sm text-text-primary bg-transparent outline-none"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-text-muted font-medium">Rol</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="glass-card-static rounded-xl px-3 py-2 text-sm text-text-primary bg-transparent outline-none"
          >
            <option value="Owner">Owner</option>
            <option value="Manager">Manager</option>
            <option value="Cashier">Cashier</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-text-muted font-medium">PIN *</label>
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            required
            className="glass-card-static rounded-xl px-3 py-2 text-sm text-text-primary bg-transparent outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={saving || !name || !pin}
          className="btn-primary w-full py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
        >
          {saving ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </form>
    </div>
  );
}

