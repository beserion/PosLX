import { useDashboardStore } from '../../store/dashboardStore';
import { Calendar, CalendarDays } from 'lucide-react';

const presets = [
    { key: 'today', label: 'Bugün' },
    { key: 'week', label: 'Bu Hafta' },
    { key: 'month', label: 'Bu Ay' },
    { key: 'quarter', label: 'Son 3 Ay' },
];

export default function DateRangeFilter() {
    const datePreset = useDashboardStore((s) => s.datePreset);
    const setDatePreset = useDashboardStore((s) => s.setDatePreset);
    const setCustomRange = useDashboardStore((s) => s.setCustomRange);
    const customStart = useDashboardStore((s) => s.customStart);
    const customEnd = useDashboardStore((s) => s.customEnd);

    return (
        <div className="flex items-center gap-2 flex-wrap">
            <CalendarDays size={16} className="text-text-muted" />

            {/* Preset buttons */}
            {presets.map(({ key, label }) => (
                <button
                    key={key}
                    onClick={() => setDatePreset(key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200
            ${datePreset === key
                            ? 'bg-cyan-accent/15 text-cyan-accent border border-cyan-accent/30'
                            : 'text-text-muted hover:text-text-secondary hover:bg-white/5 border border-transparent'}`}
                >
                    {label}
                </button>
            ))}

            {/* Custom */}
            <button
                onClick={() => setDatePreset('custom')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200
          ${datePreset === 'custom'
                        ? 'bg-amber-accent/15 text-amber-accent border border-amber-accent/30'
                        : 'text-text-muted hover:text-text-secondary hover:bg-white/5 border border-transparent'}`}
            >
                <Calendar size={12} className="inline mr-1" />
                Özel
            </button>

            {/* Date inputs for custom */}
            {datePreset === 'custom' && (
                <div className="flex items-center gap-2 ml-1">
                    <input
                        type="date"
                        value={customStart || ''}
                        onChange={(e) => setCustomRange(e.target.value, customEnd)}
                        className="glass-input text-xs py-1 px-2"
                    />
                    <span className="text-text-muted text-xs">—</span>
                    <input
                        type="date"
                        value={customEnd || ''}
                        onChange={(e) => setCustomRange(customStart, e.target.value)}
                        className="glass-input text-xs py-1 px-2"
                    />
                </div>
            )}
        </div>
    );
}
