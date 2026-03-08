import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Save, Settings, Printer, Plug, Trash2, Plus, Info, LayoutTemplate } from 'lucide-react';
import { useToast } from '../hooks/useToast';
import api from '../lib/api';

export default function SettingsPage() {
    const toast = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('general'); // 'general' | 'printers'

    const [settings, setSettings] = useState({
        storeName: '',
        storeAddress: '',
        storePhone: '',
        taxOffice: '',
        taxNumber: '',
        footerText: '',
        serviceFeeAmount: '0',
        taxRate: '8',
        assignedPosPrinterId: '',
        assignedReportPrinterId: ''
    });

    const [printers, setPrinters] = useState([]);
    const [newPrinter, setNewPrinter] = useState({ Name: '', Path: '', Type: 'Thermal' });

    useEffect(() => {
        const fetchAll = async () => {
            try {
                const [settingsRes, printersRes] = await Promise.all([
                    api.get('/settings'),
                    api.get('/printers')
                ]);

                const data = settingsRes.data;
                setSettings({
                    storeName: data.storeName || '',
                    storeAddress: data.storeAddress || '',
                    storePhone: data.storePhone || '',
                    taxOffice: data.taxOffice || '',
                    taxNumber: data.taxNumber || '',
                    footerText: data.footerText || '',
                    serviceFeeAmount: data.serviceFeeAmount || '0',
                    taxRate: data.taxRate || '8',
                    assignedPosPrinterId: data.assignedPosPrinterId || '',
                    assignedReportPrinterId: data.assignedReportPrinterId || ''
                });

                setPrinters(printersRes.data || []);
            } catch (err) {
                console.error("Failed to fetch settings/printers", err);
                toast.error('Ayarlar yüklenirken bir hata oluştu');
            } finally {
                setLoading(false);
            }
        };
        fetchAll();
    }, []);

    const handleChange = (e) => {
        setSettings({ ...settings, [e.target.name]: e.target.value });
    };

    const handleSaveGeneral = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await Promise.all([
                api.put('/settings/storeName', { value: settings.storeName }),
                api.put('/settings/storeAddress', { value: settings.storeAddress }),
                api.put('/settings/storePhone', { value: settings.storePhone }),
                api.put('/settings/taxOffice', { value: settings.taxOffice }),
                api.put('/settings/taxNumber', { value: settings.taxNumber }),
                api.put('/settings/footerText', { value: settings.footerText }),
                api.put('/settings/serviceFeeAmount', { value: settings.serviceFeeAmount }),
                api.put('/settings/taxRate', { value: settings.taxRate }),
                api.put('/settings/assignedPosPrinterId', { value: settings.assignedPosPrinterId }),
                api.put('/settings/assignedReportPrinterId', { value: settings.assignedReportPrinterId })
            ]);
            toast.success('Ayarlar başarıyla kaydedildi.');
        } catch (err) {
            console.error("Saving failed", err);
            toast.error('Ayarları kaydederken hata oluştu.');
        } finally {
            setSaving(false);
        }
    };

    const handleAddPrinter = async (e) => {
        e.preventDefault();
        try {
            const { data } = await api.post('/printers', newPrinter);
            setPrinters([...printers, data]);
            setNewPrinter({ Name: '', Path: '', Type: 'Thermal' });
            toast.success('Yazıcı başarıyla eklendi.');
        } catch (err) {
            console.error(err);
            toast.error('Yazıcı eklenirken hata oluştu.');
        }
    };

    const handleDeletePrinter = async (id) => {
        if (!window.confirm('Bu yazıcıyı silmek istediğinize emin misiniz?')) return;
        try {
            await api.delete(`/printers/${id}`);
            setPrinters(printers.filter(p => p.ID !== id));

            // Eğer silinen yazıcı atanmış durumdaysa, atama state'ini temizle
            if (settings.assignedPosPrinterId == id) setSettings(s => ({ ...s, assignedPosPrinterId: '' }));
            if (settings.assignedReportPrinterId == id) setSettings(s => ({ ...s, assignedReportPrinterId: '' }));

            toast.success('Yazıcı silindi.');
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.error || 'Yazıcı silinemedi.');
        }
    };

    if (loading) return <div className="p-6 text-text-muted">Yükleniyor...</div>;

    const fmtTime = (t) => {
        if (!t) return '—';
        return new Date(t).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    return (
        <div className="max-w-3xl mx-auto py-6 space-y-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-cyan-accent/20 rounded-xl">
                    <Settings className="text-cyan-accent" size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-text-primary">Sistem Ayarları</h1>
                    <p className="text-sm text-text-muted">Mağaza bilgileri, fiş yazdırma ayarları ve yazıcılar</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex bg-white/5 p-1 rounded-xl mb-6">
                <button
                    onClick={() => setActiveTab('general')}
                    className={`flex-1 py-2.5 px-4 text-sm font-semibold rounded-lg transition-all ${activeTab === 'general' ? 'bg-cyan-accent/20 text-cyan-accent shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
                >
                    Genel Ayarlar
                </button>
                <button
                    onClick={() => setActiveTab('printers')}
                    className={`flex-1 py-2.5 px-4 text-sm font-semibold rounded-lg transition-all ${activeTab === 'printers' ? 'bg-emerald-500/20 text-emerald-400 shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
                >
                    Yazıcılar & Çıktı
                </button>
            </div>

            {/* ── Settings Form ── */}
            {activeTab === 'general' && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass-card p-6"
                >
                    <form onSubmit={handleSaveGeneral} className="space-y-5">

                        <div>
                            <label className="block text-sm font-semibold text-text-secondary mb-1">Mağaza Adı (Fiş Başlığı)</label>
                            <input
                                type="text"
                                name="storeName"
                                value={settings.storeName}
                                onChange={handleChange}
                                placeholder="PosLX Store"
                                className="glass-input w-full"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-text-secondary mb-1">Mağaza Adresi</label>
                            <textarea
                                name="storeAddress"
                                value={settings.storeAddress}
                                onChange={handleChange}
                                placeholder="Adres Bilgisi..."
                                rows={2}
                                className="glass-input w-full resize-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-text-secondary mb-1">Telefon Numarası</label>
                            <input
                                type="text"
                                name="storePhone"
                                value={settings.storePhone}
                                onChange={handleChange}
                                placeholder="+90 555 000 0000"
                                className="glass-input w-full"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-text-secondary mb-1">Vergi Dairesi</label>
                                <input
                                    type="text"
                                    name="taxOffice"
                                    value={settings.taxOffice}
                                    onChange={handleChange}
                                    placeholder="Örn: Beyoğlu V.D."
                                    className="glass-input w-full"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-text-secondary mb-1">Vergi Numarası</label>
                                <input
                                    type="text"
                                    name="taxNumber"
                                    value={settings.taxNumber}
                                    onChange={handleChange}
                                    placeholder="Örn: 1234567890"
                                    className="glass-input w-full"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-text-secondary mb-1">Servis Ücreti (₺)</label>
                                <input
                                    type="number"
                                    name="serviceFeeAmount"
                                    value={settings.serviceFeeAmount}
                                    onChange={handleChange}
                                    placeholder="Örn: 50"
                                    className="glass-input w-full"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-text-secondary mb-1">KDV Oranı (%)</label>
                                <input
                                    type="number"
                                    name="taxRate"
                                    value={settings.taxRate}
                                    onChange={handleChange}
                                    placeholder="Örn: 8 veya 20"
                                    className="glass-input w-full"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-text-secondary mb-1">Fiş Alt Bilgisi (Teşekkür & İade vs.)</label>
                            <textarea
                                name="footerText"
                                value={settings.footerText}
                                onChange={handleChange}
                                placeholder="Bizi tercih ettiğiniz için teşekkür ederiz. İade süresi 7 gündür."
                                rows={2}
                                className="glass-input w-full resize-none"
                            />
                        </div>

                        <div className="pt-4 border-t border-glass-border">
                            <button
                                type="submit"
                                disabled={saving}
                                className="btn-primary w-full flex justify-center items-center gap-2 py-3"
                            >
                                <Save size={18} />
                                {saving ? 'Kaydediliyor...' : 'Ayarları Kaydet'}
                            </button>
                        </div>

                    </form>
                </motion.div>
            )}

            {activeTab === 'printers' && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-6"
                >
                    {/* Add Printer Form */}
                    <div className="glass-card p-6">
                        <h2 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
                            <Plus size={18} className="text-emerald-400" />
                            Yeni Yazıcı Ekle
                        </h2>
                        <form onSubmit={handleAddPrinter} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                            <div className="md:col-span-3">
                                <label className="block text-xs font-semibold text-text-secondary mb-1">Yazıcı Adı</label>
                                <input
                                    type="text" required
                                    value={newPrinter.Name}
                                    onChange={(e) => setNewPrinter({ ...newPrinter, Name: e.target.value })}
                                    placeholder="Örn: Mutfak Yazıcısı"
                                    className="glass-input w-full"
                                />
                            </div>
                            <div className="md:col-span-4">
                                <label className="block text-xs font-semibold text-text-secondary mb-1">IP Adresi veya Paylaşım Adı</label>
                                <input
                                    type="text" required
                                    value={newPrinter.Path}
                                    onChange={(e) => setNewPrinter({ ...newPrinter, Path: e.target.value })}
                                    placeholder="Örn: 192.168.1.50 veya \\Masaustu\POS80"
                                    className="glass-input w-full"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-semibold text-text-secondary mb-1">Tür</label>
                                <select
                                    value={newPrinter.Type}
                                    onChange={(e) => setNewPrinter({ ...newPrinter, Type: e.target.value })}
                                    className="glass-input w-full"
                                >
                                    <option value="Thermal">Termal</option>
                                    <option value="A4">A4 Standart</option>
                                </select>
                            </div>
                            <div className="md:col-span-3">
                                <button type="submit" className="w-full py-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 font-bold hover:bg-emerald-500/30 transition-colors flex items-center justify-center gap-2">
                                    <Save size={16} /> Ekle
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Printer List */}
                    <div className="glass-card overflow-hidden">
                        <div className="p-4 border-b border-white/5">
                            <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                                <Plug size={18} className="text-violet-400" />
                                Ekli Yazıcılar
                            </h2>
                        </div>
                        {printers.length === 0 ? (
                            <div className="p-6 text-center text-text-muted text-sm">Hiç yazıcı eklenmemiş.</div>
                        ) : (
                            <table className="w-full text-sm text-left">
                                <thead>
                                    <tr className="bg-white/5 text-text-muted">
                                        <th className="px-4 py-3 font-semibold w-1/4">İsim</th>
                                        <th className="px-4 py-3 font-semibold flex-1">IP / Paylaşım Yolu</th>
                                        <th className="px-4 py-3 font-semibold w-32">Tür</th>
                                        <th className="px-4 py-3 font-semibold w-20 text-right">İşlem</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {printers.map(p => (
                                        <tr key={p.ID} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                            <td className="px-4 py-3 font-medium text-text-primary">{p.Name}</td>
                                            <td className="px-4 py-3 text-text-secondary font-mono text-xs">{p.Path}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${p.Type === 'Thermal' ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                                    {p.Type}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button onClick={() => handleDeletePrinter(p.ID)} className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors cursor-pointer">
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Printer Assignment Form */}
                    <div className="glass-card p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <LayoutTemplate size={18} className="text-cyan-accent" />
                            <h2 className="text-lg font-bold text-text-primary">Yazıcı Atamaları</h2>
                        </div>
                        <div className="p-3 mb-5 border border-amber-500/20 bg-amber-500/5 rounded-xl flex items-start gap-3 text-amber-500/80 text-sm">
                            <Info size={16} className="mt-0.5 shrink-0" />
                            <p>POS Fiş Yazıcısı seçimi arka planda doğrudan termal baskı için kullanılır. Rapor yazdırmaları tarayıcı yazdırma ekranını (window.print) tetikler, buradaki atamalar önizleme ekranında sizin için sadece bilgi amaçlıdır.</p>
                        </div>
                        <form onSubmit={handleSaveGeneral} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-semibold text-text-secondary mb-2">POS Fiş Yazıcısı (Direct Print)</label>
                                <select
                                    name="assignedPosPrinterId"
                                    value={settings.assignedPosPrinterId}
                                    onChange={handleChange}
                                    className="glass-input w-full py-2.5"
                                >
                                    <option value="">-- Yazıcı Seçin --</option>
                                    {printers.filter(p => p.Type === 'Thermal').map(p => (
                                        <option key={p.ID} value={p.ID}>{p.Name} ({p.Path})</option>
                                    ))}
                                </select>
                                <p className="text-xs text-text-muted mt-1.5">Ödeme tamamlandığında otomatik çıktı verecek termal yazıcı.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-text-secondary mb-2">Rapor Yazıcısı</label>
                                <select
                                    name="assignedReportPrinterId"
                                    value={settings.assignedReportPrinterId}
                                    onChange={handleChange}
                                    className="glass-input w-full py-2.5"
                                >
                                    <option value="">-- Yazıcı Seçin --</option>
                                    {printers.map(p => (
                                        <option key={p.ID} value={p.ID}>{p.Name} ({p.Type})</option>
                                    ))}
                                </select>
                                <p className="text-xs text-text-muted mt-1.5">Hesap dökümü, stok listesi gibi A4 kağıt raporları için tercih edilen yazıcı.</p>
                            </div>

                            <div className="md:col-span-2 pt-4 border-t border-white/5">
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="btn-primary w-full md:w-auto md:px-8 py-2.5 rounded-xl font-bold flex justify-center items-center gap-2 ml-auto"
                                >
                                    <Save size={18} />
                                    {saving ? 'Kaydediliyor...' : 'Atamaları Kaydet'}
                                </button>
                            </div>
                        </form>
                    </div>

                </motion.div>
            )}
        </div>
    );
}
