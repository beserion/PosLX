import { useEffect, useState } from 'react';
import { useStaffStore } from '../store/staffStore';
import { useAuthStore } from '../store/authStore';
import { Users, Plus, X, Edit2, Play, PowerOff } from 'lucide-react';
import { useToast } from '../hooks/useToast';

export default function StaffPage() {
  const { staff, fetchStaff, createStaff, updateStaff, deleteStaff } =
    useStaffStore();
  const currentUser = useAuthStore((s) => s.user);

  const [showModal, setShowModal] = useState(false);
  const [staffToEdit, setStaffToEdit] = useState(null);

  const handleEdit = (staffData) => {
    setStaffToEdit(staffData);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setStaffToEdit(null);
  };

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
              onClick={() => {
                setStaffToEdit(null);
                setShowModal(true);
              }}
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
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => handleEdit(s)}
                          className="text-text-muted hover:text-cyan-400 transition-colors p-1"
                          title="Düzenle"
                        >
                          <Edit2 size={16} />
                        </button>
                        {s.IsActive ? (
                          <button
                            onClick={() => deleteStaff(s.ID)}
                            className="text-text-muted hover:text-red-400 transition-colors p-1"
                            title="Pasif Yap"
                          >
                            <PowerOff size={16} />
                          </button>
                        ) : (
                          <button
                            onClick={() => updateStaff(s.ID, { IsActive: 1 })}
                            className="text-text-muted hover:text-emerald-400 transition-colors p-1"
                            title="Aktif Yap"
                          >
                            <Play size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && (
        <StaffModal
          onClose={handleCloseModal}
          onCreated={fetchStaff}
          initialData={staffToEdit}
        />
      )}
    </>
  );
}

function StaffModal({ onClose, onCreated, initialData }) {
  const { createStaff, updateStaff } = useStaffStore();
  const toast = useToast();
  const [name, setName] = useState(initialData?.Name || '');
  const [role, setRole] = useState(initialData?.Role || 'Cashier');
  const [pin, setPin] = useState('');
  const [saving, setSaving] = useState(false);

  const isEditing = !!initialData;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name) return;
    if (!isEditing && !pin) return;

    setSaving(true);
    try {
      if (isEditing) {
        const payload = { Name: name, Role: role };
        if (pin) payload.Pin = pin; // Update PIN only if entered
        await updateStaff(initialData.ID, payload);
        toast.success('Personel bilgileri güncellendi.');
      } else {
        await createStaff({ Name: name, Role: role, Pin: pin });
        toast.success('Yeni personel eklendi.');
      }
      await onCreated();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
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
          <h2 className="text-lg font-bold text-text-primary">
            {isEditing ? 'Personel Düzenle' : 'Yeni Personel'}
          </h2>
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
          <label className="text-xs text-text-muted font-medium">
            {isEditing ? 'Yeni PIN (Değiştirmek için doldurun)' : 'PIN *'}
          </label>
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            required={!isEditing}
            className="glass-card-static rounded-xl px-3 py-2 text-sm text-text-primary bg-transparent outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={saving || !name || (!isEditing && !pin)}
          className="btn-primary w-full py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
        >
          {saving ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </form>
    </div>
  );
}

