import { useEffect, useState } from 'react';
import { useAccountStore } from '../store/accountStore';
import { useNavigate } from 'react-router-dom';
import {
    Users, Plus, X, Edit2, Trash2, Search, Phone, MapPin,
    Building2, User, ArrowUpRight, ArrowDownLeft, Filter, Mail, Download, Printer
} from 'lucide-react';
import { exportToExcel } from '../lib/excelExport';
import { printReport } from '../lib/printExport';

function fmtMoney(v) {
    return `₺${Number(v || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function AccountsPage() {
    const { accounts, loading, fetchAccounts, deleteAccount } = useAccountStore();
    const navigate = useNavigate();

    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingAccount, setEditingAccount] = useState(null);

    useEffect(() => { fetchAccounts(); }, []);

    const filtered = accounts.filter(a => {
        const matchSearch = !search || a.Name.toLowerCase().includes(search.toLowerCase()) || a.Phone?.includes(search);
        const matchType = !filterType || a.Type === filterType;
        return matchSearch && matchType;
    });

    const totalDebtors = accounts.filter(a => a.Balance > 0).reduce((s, a) => s + a.Balance, 0);
    const totalCreditors = accounts.filter(a => a.Balance < 0).reduce((s, a) => s + Math.abs(a.Balance), 0);

    const handleDelete = async (id, name) => {
        if (!confirm(`"${name}" carisini silmek istediğinize emin misiniz?`)) return;
        try {
            await deleteAccount(id);
        } catch (err) {
            alert(err.response?.data?.error || err.message);
        }
    };

    return (
        <>
            <div className="flex flex-col gap-5">
                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                        <h1 className="text-xl font-bold text-text-primary">Cari Hesaplar</h1>
                        <span className="badge badge-cyan">
                            <Users size={10} /> {accounts.length} Kayıt
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                const columns = [
                                    { header: 'Cari Adı', key: 'Name' },
                                    { header: 'Tür', key: 'Type' },
                                    { header: 'Telefon', key: 'Phone', formatter: (v) => v || '—' },
                                    { header: 'E-Posta', key: 'Email', formatter: (v) => v || '—' },
                                    { header: 'Vergi Dairesi', key: 'TaxOffice', formatter: (v) => v || '—' },
                                    { header: 'Vergi No', key: 'TaxNo', formatter: (v) => v || '—' },
                                    { header: 'Adres', key: 'Address', formatter: (v) => v || '—' },
                                    { header: 'Bakiye (₺)', key: 'Balance', formatter: (v) => Number(v || 0).toFixed(2) },
                                ];
                                printReport(filtered, columns, { title: 'Cari Hesaplar Listesi' });
                            }}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-all cursor-pointer"
                        >
                            <Printer size={16} /> Yazdır
                        </button>
                        <button
                            onClick={() => {
                                const columns = [
                                    { header: 'Cari Adı', key: 'Name' },
                                    { header: 'Tür', key: 'Type' },
                                    { header: 'Telefon', key: 'Phone', formatter: (v) => v || '—' },
                                    { header: 'E-Posta', key: 'Email', formatter: (v) => v || '—' },
                                    { header: 'Vergi Dairesi', key: 'TaxOffice', formatter: (v) => v || '—' },
                                    { header: 'Vergi No', key: 'TaxNo', formatter: (v) => v || '—' },
                                    { header: 'Adres', key: 'Address', formatter: (v) => v || '—' },
                                    { header: 'Bakiye (₺)', key: 'Balance', formatter: (v) => Number(v || 0).toFixed(2) },
                                ];
                                exportToExcel(filtered, columns, 'Cari_Hesaplar');
                            }}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all cursor-pointer"
                        >
                            <Download size={16} /> Excel
                        </button>
                        <button
                            onClick={() => { setEditingAccount(null); setShowModal(true); }}
                            className="btn-primary flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold ml-2"
                        >
                            <Plus size={16} /> Yeni Cari
                        </button>
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="glass-card p-4 rounded-2xl flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-cyan-500/20 shrink-0">
                                <Users size={20} className="text-cyan-400" />
                            </div>
                            <div className="flex flex-col text-right w-full">
                                <span className="text-xs text-text-muted font-medium">Toplam Cari</span>
                                <span className="text-lg font-bold text-text-primary leading-tight">{accounts.length}</span>
                            </div>
                        </div>
                    </div>
                    <div className="glass-card p-4 rounded-2xl flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-500/20 shrink-0">
                                <ArrowUpRight size={20} className="text-red-400" />
                            </div>
                            <div className="flex flex-col text-right w-full">
                                <span className="text-xs text-text-muted font-medium">Toplam Alacak</span>
                                <span className="text-lg font-bold text-red-400 leading-tight">{fmtMoney(totalDebtors)}</span>
                            </div>
                        </div>
                    </div>
                    <div className="glass-card p-4 rounded-2xl flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-500/20 shrink-0">
                                <ArrowDownLeft size={20} className="text-emerald-400" />
                            </div>
                            <div className="flex flex-col text-right w-full">
                                <span className="text-xs text-text-muted font-medium">Toplam Borç</span>
                                <span className="text-lg font-bold text-emerald-400 leading-tight">{fmtMoney(totalCreditors)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Search + Filter */}
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="glass-card-static flex items-center gap-2 px-3 py-2 rounded-xl flex-1 min-w-[200px]">
                        <Search size={14} className="text-text-muted" />
                        <input type="text" placeholder="Cari ara..."
                            value={search} onChange={(e) => setSearch(e.target.value)}
                            className="bg-transparent border-none outline-none text-sm text-text-primary flex-1" />
                    </div>
                    <div className="glass-card-static flex items-center gap-2 px-3 py-2 rounded-xl">
                        <Filter size={14} className="text-text-muted" />
                        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
                            className="bg-transparent border-none outline-none text-sm text-text-primary">
                            <option value="">Tümü</option>
                            <option value="Müşteri">Müşteriler</option>
                            <option value="Tedarikçi">Tedarikçiler</option>
                        </select>
                    </div>
                </div>

                {/* Table */}
                <div className="glass-card p-4 rounded-2xl overflow-x-auto">
                    {loading ? (
                        <div className="text-center text-text-muted py-10">Yükleniyor…</div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center text-text-muted py-10">Kayıt bulunamadı</div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-text-muted border-b border-white/5">
                                    <th className="pb-2 pr-3">Cari Adı</th>
                                    <th className="pb-2 pr-3">Tür</th>
                                    <th className="pb-2 pr-3">Telefon</th>
                                    <th className="pb-2 pr-3">Vergi Dairesi</th>
                                    <th className="pb-2 pr-3">Vergi No</th>
                                    <th className="pb-2 pr-3">Adres</th>
                                    <th className="pb-2 pr-3 text-right">Bakiye</th>
                                    <th className="pb-2"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(a => (
                                    <tr key={a.ID}
                                        onClick={() => navigate(`/accounts/${a.ID}`)}
                                        className="border-b border-white/5 hover:bg-white/[0.03] transition-colors cursor-pointer">
                                        <td className="py-3 pr-3">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center
                                                    ${a.Type === 'Müşteri' ? 'bg-blue-500/20' : 'bg-orange-500/20'}`}>
                                                    {a.Type === 'Müşteri'
                                                        ? <User size={14} className="text-blue-400" />
                                                        : <Building2 size={14} className="text-orange-400" />}
                                                </div>
                                                <span className="text-text-primary font-medium">{a.Name}</span>
                                            </div>
                                        </td>
                                        <td className="py-3 pr-3">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold
                                                ${a.Type === 'Müşteri' ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'}`}>
                                                {a.Type}
                                            </span>
                                        </td>
                                        <td className="py-3 pr-3 text-text-muted">
                                            {a.Phone && a.Phone !== '-' ? (
                                                <div className="flex items-center gap-1"><Phone size={12} /> {a.Phone}</div>
                                            ) : '—'}
                                            {a.Email && a.Email !== '-' ? (
                                                <div className="flex items-center gap-1 mt-1 text-xs"><Mail size={12} /> {a.Email}</div>
                                            ) : null}
                                        </td>
                                        <td className="py-3 pr-3 text-text-muted text-xs">
                                            {a.TaxOffice || '—'}
                                        </td>
                                        <td className="py-3 pr-3 text-text-muted text-xs">
                                            {a.TaxNo || '—'}
                                        </td>
                                        <td className="py-3 pr-3 text-text-muted text-xs max-w-[200px] truncate">
                                            {a.Address ? (
                                                <div className="flex items-center gap-1"><MapPin size={12} className="shrink-0" /> <span className="truncate">{a.Address}</span></div>
                                            ) : '—'}
                                        </td>
                                        <td className={`py-3 pr-3 text-right font-bold whitespace-nowrap
                                            ${a.Balance > 0 ? 'text-red-400' : a.Balance < 0 ? 'text-emerald-400' : 'text-text-muted'}`}>
                                            {fmtMoney(a.Balance)}
                                        </td>
                                        <td className="py-3 text-right" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center gap-1 justify-end">
                                                <button onClick={() => { setEditingAccount(a); setShowModal(true); }}
                                                    className="text-text-muted hover:text-cyan-400 transition-colors p-1 cursor-pointer">
                                                    <Edit2 size={14} />
                                                </button>
                                                <button onClick={() => handleDelete(a.ID, a.Name)}
                                                    className="text-text-muted hover:text-red-400 transition-colors p-1 cursor-pointer">
                                                    <Trash2 size={14} />
                                                </button>
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
                <AccountFormModal
                    account={editingAccount}
                    onClose={() => setShowModal(false)}
                />
            )}
        </>
    );
}

// ─── Account Form Modal ──────────────────────────────────────
function AccountFormModal({ account, onClose }) {
    const { createAccount, updateAccount } = useAccountStore();
    const isEdit = !!account;

    const [name, setName] = useState(account?.Name || '');
    const [type, setType] = useState(account?.Type || 'Müşteri');
    const [phone, setPhone] = useState(account?.Phone || '');
    const [email, setEmail] = useState(account?.Email || '');
    const [address, setAddress] = useState(account?.Address || '');
    const [taxOffice, setTaxOffice] = useState(account?.TaxOffice || '');
    const [taxNo, setTaxNo] = useState(account?.TaxNo || '');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setSubmitting(true);
        try {
            const data = { Name: name.trim(), Type: type, Phone: phone || null, Email: email || null, Address: address || null, TaxOffice: taxOffice || null, TaxNo: taxNo || null };
            if (isEdit) {
                await updateAccount(account.ID, data);
            } else {
                await createAccount(data);
            }
            onClose();
        } catch (err) {
            alert(err.response?.data?.error || err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <form onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}
                className="glass-card p-6 rounded-2xl w-full max-w-md flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-text-primary">{isEdit ? 'Cari Düzenle' : 'Yeni Cari'}</h2>
                    <button type="button" onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors cursor-pointer">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-xs text-text-muted font-medium">Cari Adı *</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="İsim / Firma"
                        className="glass-card-static rounded-xl px-3 py-2 text-sm text-text-primary bg-transparent outline-none" />
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-xs text-text-muted font-medium">Tür</label>
                    <div className="flex gap-2">
                        <button type="button" onClick={() => setType('Müşteri')}
                            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer
                                ${type === 'Müşteri' ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/50' : 'glass-card-static text-text-muted hover:text-text-primary'}`}>
                            <User size={16} /> Müşteri
                        </button>
                        <button type="button" onClick={() => setType('Tedarikçi')}
                            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer
                                ${type === 'Tedarikçi' ? 'bg-orange-500/20 text-orange-400 ring-1 ring-orange-500/50' : 'glass-card-static text-text-muted hover:text-text-primary'}`}>
                            <Building2 size={16} /> Tedarikçi
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-text-muted font-medium">Telefon</label>
                        <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+90 5xx..."
                            className="glass-card-static rounded-xl px-3 py-2 text-sm text-text-primary bg-transparent outline-none" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-text-muted font-medium">E-Posta</label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ornek@mail.com"
                            className="glass-card-static rounded-xl px-3 py-2 text-sm text-text-primary bg-transparent outline-none" />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-text-muted font-medium">Vergi Dairesi</label>
                        <input type="text" value={taxOffice} onChange={(e) => setTaxOffice(e.target.value)} placeholder="Örn: Kadıköy V.D."
                            className="glass-card-static rounded-xl px-3 py-2 text-sm text-text-primary bg-transparent outline-none" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-text-muted font-medium">Vergi No / TCKN</label>
                        <input type="text" value={taxNo} onChange={(e) => setTaxNo(e.target.value)} placeholder="10 veya 11 Haneli"
                            className="glass-card-static rounded-xl px-3 py-2 text-sm text-text-primary bg-transparent outline-none" />
                    </div>
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-xs text-text-muted font-medium">Adres</label>
                    <textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Tam adres bilgisi..."
                        rows={3} className="glass-card-static rounded-xl px-3 py-2 text-sm text-text-primary bg-transparent outline-none resize-none" />
                </div>

                <button type="submit" disabled={submitting || !name.trim()}
                    className="btn-primary w-full py-2.5 rounded-xl text-sm font-bold mt-2 disabled:opacity-50">
                    {submitting ? 'Kaydediliyor…' : (isEdit ? 'Güncelle' : 'Kaydet')}
                </button>
            </form>
        </div>
    );
}
