import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Save, Settings } from 'lucide-react';
import { useToast } from '../hooks/useToast';
import api from '../lib/api';

export default function SettingsPage() {
    const toast = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [settings, setSettings] = useState({
        storeName: '',
        storeAddress: '',
        storePhone: '',
        taxOffice: '',
        taxNumber: '',
        footerText: '',
        serviceFeeAmount: '0',
        taxRate: '8'
    });

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const { data } = await api.get('/settings');
                setSettings({
                    storeName: data.storeName || '',
                    storeAddress: data.storeAddress || '',
                    storePhone: data.storePhone || '',
                    taxOffice: data.taxOffice || '',
                    taxNumber: data.taxNumber || '',
                    footerText: data.footerText || '',
                    serviceFeeAmount: data.serviceFeeAmount || '0',
                    taxRate: data.taxRate || '8'
                });
            } catch (err) {
                console.error("Failed to fetch settings", err);
                toast.error('Ayarlar yüklenirken bir hata oluştu');
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleChange = (e) => {
        setSettings({ ...settings, [e.target.name]: e.target.value });
    };

    const handleSave = async (e) => {
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
                api.put('/settings/taxRate', { value: settings.taxRate })
            ]);
            toast.success('Ayarlar başarıyla kaydedildi.');
        } catch (err) {
            console.error("Saving failed", err);
            toast.error('Ayarları kaydederken hata oluştu.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-6 text-text-muted">Yükleniyor...</div>;

    return (
        <div className="max-w-3xl mx-auto py-6 space-y-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-cyan-accent/20 rounded-xl">
                    <Settings className="text-cyan-accent" size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-text-primary">Sistem Ayarları</h1>
                    <p className="text-sm text-text-muted">Mağaza bilgileri ve fiş yazdırma ayarları</p>
                </div>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-6"
            >
                <form onSubmit={handleSave} className="space-y-5">

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
        </div>
    );
}
