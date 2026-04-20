import { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface Recommendation {
  hour: number;
  avgCustomers: number;
  staffCount: number;
  ratio: number;
  status: 'optimal' | 'understaffed' | 'overstaffed';
  optimal: number;
}

export default function StaffingPage() {
  const { t } = useLanguage();
  const [hourlyStaff, setHourlyStaff] = useState<number[]>(new Array(24).fill(0));
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [branchId, setBranchId] = useState('');
  const [cameraId, setCameraId] = useState('');

  const STATUS_STYLES: Record<'optimal' | 'understaffed' | 'overstaffed', { bg: string; text: string; labelKey: string }> = {
    optimal: { bg: 'bg-success-500/10', text: 'text-success-300', labelKey: 'staffing.statusLabel.optimal' },
    understaffed: { bg: 'bg-danger-500/10', text: 'text-danger-300', labelKey: 'staffing.statusLabel.understaffed' },
    overstaffed: { bg: 'bg-warning-500/10', text: 'text-warning-300', labelKey: 'staffing.statusLabel.overstaffed' },
  };

  useEffect(() => {
    const storedBranch = localStorage.getItem('selectedBranchId') || 'default';
    const storedCamera = localStorage.getItem('selectedCameraId') || 'default';
    setBranchId(storedBranch);
    setCameraId(storedCamera);
    fetchData(storedBranch, storedCamera);
  }, []);

  const fetchData = async (bid: string, cid: string) => {
    setLoading(true);
    try {
      const [shiftRes, recRes] = await Promise.all([
        fetch(`${API_URL}/api/staffing/${bid}/current`).then(r => r.ok ? r.json() : null),
        fetch(`${API_URL}/api/staffing/${bid}/recommendations?cameraId=${cid}`).then(r => r.ok ? r.json() : null),
      ]);
      if (shiftRes?.hourlyStaff) setHourlyStaff(shiftRes.hourlyStaff);
      if (recRes) {
        setRecommendations(recRes.recommendations || []);
        setSummary(recRes.summary || null);
      }
    } catch (e) {
      console.error('Failed to fetch staffing data:', e);
    } finally {
      setLoading(false);
    }
  };

  const updateStaff = (hour: number, value: number) => {
    const updated = [...hourlyStaff];
    updated[hour] = Math.max(0, value);
    setHourlyStaff(updated);
  };

  const copyToAll = (value: number) => {
    setHourlyStaff(new Array(24).fill(value));
  };

  const saveShifts = async () => {
    setSaving(true);
    try {
      const shifts = hourlyStaff
        .map((staffCount, hour) => ({ hour, staffCount }))
        .filter(s => s.staffCount > 0);

      await fetch(`${API_URL}/api/staffing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId,
          date: new Date().toISOString(),
          shifts,
          createdBy: 'current-user',
        }),
      });
      fetchData(branchId, cameraId);
    } catch (e) {
      console.error('Failed to save shifts:', e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-gradient-brand tracking-tight">{t('staffing.page.title')}</h2>
          <p className="text-sm text-ink-3 mt-1">{t('staffing.page.subtitle2')}</p>
        </div>
        <button
          onClick={saveShifts}
          disabled={saving}
          className="px-4 py-2 bg-gradient-to-r from-brand-500 to-accent-500 text-white rounded-xl font-medium text-sm hover:shadow-glow-brand transition-all disabled:opacity-50"
        >
          {saving ? t('staffing.page.saving') : t('staffing.page.save')}
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-3 gap-4">
          <div className="surface-card rounded-xl p-4">
            <p className="text-xs text-ink-3">{t('staffing.page.understaffedHours')}</p>
            <p className="font-display text-2xl font-bold text-danger-300 font-mono">{summary.understaffedHours}</p>
          </div>
          <div className="surface-card rounded-xl p-4">
            <p className="text-xs text-ink-3">{t('staffing.page.overstaffedHours')}</p>
            <p className="font-display text-2xl font-bold text-warning-300 font-mono">{summary.overstaffedHours}</p>
          </div>
          <div className="surface-card rounded-xl p-4">
            <p className="text-xs text-ink-3">{t('staffing.page.criticalHours')}</p>
            <p className="font-display text-2xl font-bold text-danger-400 font-mono">{summary.criticalHours?.length || 0}</p>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex gap-2">
        <button onClick={() => copyToAll(1)} className="px-3 py-1.5 bg-white/[0.04] text-ink-2 rounded-xl text-xs hover:bg-white/[0.08] border border-white/[0.08] transition-colors">{t('staffing.page.copyAll1')}</button>
        <button onClick={() => copyToAll(2)} className="px-3 py-1.5 bg-white/[0.04] text-ink-2 rounded-xl text-xs hover:bg-white/[0.08] border border-white/[0.08] transition-colors">{t('staffing.page.copyAll2')}</button>
        <button onClick={() => copyToAll(3)} className="px-3 py-1.5 bg-white/[0.04] text-ink-2 rounded-xl text-xs hover:bg-white/[0.08] border border-white/[0.08] transition-colors">{t('staffing.page.copyAll3')}</button>
      </div>

      {/* Staff Input Grid */}
      <div className="surface-card rounded-xl overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b border-white/[0.08]">
              <th className="text-left text-xs text-ink-3 px-4 py-3 font-medium">{t('staffing.page.col.hour')}</th>
              <th className="text-center text-xs text-ink-3 px-4 py-3 font-medium">{t('staffing.page.col.staff')}</th>
              <th className="text-center text-xs text-ink-3 px-4 py-3 font-medium">{t('staffing.page.col.avgCustomers')}</th>
              <th className="text-center text-xs text-ink-3 px-4 py-3 font-medium">{t('staffing.page.col.ratio')}</th>
              <th className="text-center text-xs text-ink-3 px-4 py-3 font-medium">{t('staffing.page.col.recommended')}</th>
              <th className="text-center text-xs text-ink-3 px-4 py-3 font-medium">{t('staffing.page.col.status')}</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 17 }, (_, i) => i + 7).map(hour => {
              const rec = recommendations.find(r => r.hour === hour);
              const style = rec ? STATUS_STYLES[rec.status] : STATUS_STYLES.optimal;
              return (
                <tr key={hour} className={`border-b border-white/[0.06] ${style.bg}`}>
                  <td className="px-4 py-2 text-sm text-ink-0 font-medium font-mono">{String(hour).padStart(2, '0')}:00</td>
                  <td className="px-4 py-2 text-center">
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={hourlyStaff[hour]}
                      onChange={e => updateStaff(hour, parseInt(e.target.value) || 0)}
                      className="w-16 text-center text-sm bg-surface-2/70 border border-white/[0.08] rounded-lg px-2 py-1 text-ink-0 focus:outline-none focus:ring-2 focus:ring-brand-500/40 font-mono"
                    />
                  </td>
                  <td className="px-4 py-2 text-center text-sm text-ink-1 font-mono">{rec?.avgCustomers ?? '-'}</td>
                  <td className="px-4 py-2 text-center text-sm text-ink-1 font-mono">
                    {rec && rec.staffCount > 0 ? `${rec.ratio}:1` : '-'}
                  </td>
                  <td className="px-4 py-2 text-center text-sm text-brand-300 font-medium font-mono">{rec?.optimal ?? '-'}</td>
                  <td className="px-4 py-2 text-center">
                    <span className={`text-xs font-medium ${style.text}`}>{t(style.labelKey)}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
