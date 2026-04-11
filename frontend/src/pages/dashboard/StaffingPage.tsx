import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface Recommendation {
  hour: number;
  avgCustomers: number;
  staffCount: number;
  ratio: number;
  status: 'optimal' | 'understaffed' | 'overstaffed';
  optimal: number;
}

const STATUS_STYLES = {
  optimal: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Uygun' },
  understaffed: { bg: 'bg-red-500/10', text: 'text-red-400', label: 'Yetersiz' },
  overstaffed: { bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'Fazla' },
};

export default function StaffingPage() {
  const [hourlyStaff, setHourlyStaff] = useState<number[]>(new Array(24).fill(0));
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [branchId, setBranchId] = useState('');
  const [cameraId, setCameraId] = useState('');

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
      // Refresh recommendations
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Personel Planlama</h2>
          <p className="text-sm text-gray-400 mt-1">Vardiya planlama ve müşteri/personel oranı analizi</p>
        </div>
        <button
          onClick={saveShifts}
          disabled={saving}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium text-sm hover:bg-purple-700 transition-colors disabled:opacity-50"
        >
          {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
            <p className="text-xs text-gray-400">Yetersiz Saatler</p>
            <p className="text-2xl font-bold text-red-400">{summary.understaffedHours}</p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
            <p className="text-xs text-gray-400">Fazla Saatler</p>
            <p className="text-2xl font-bold text-amber-400">{summary.overstaffedHours}</p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
            <p className="text-xs text-gray-400">Kritik Saatler</p>
            <p className="text-2xl font-bold text-red-500">{summary.criticalHours?.length || 0}</p>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex gap-2">
        <button onClick={() => copyToAll(1)} className="px-3 py-1.5 bg-gray-700/50 text-gray-300 rounded-lg text-xs hover:bg-gray-700">Tüm saatlere 1 kişi</button>
        <button onClick={() => copyToAll(2)} className="px-3 py-1.5 bg-gray-700/50 text-gray-300 rounded-lg text-xs hover:bg-gray-700">Tüm saatlere 2 kişi</button>
        <button onClick={() => copyToAll(3)} className="px-3 py-1.5 bg-gray-700/50 text-gray-300 rounded-lg text-xs hover:bg-gray-700">Tüm saatlere 3 kişi</button>
      </div>

      {/* Staff Input Grid */}
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b border-gray-700/50">
              <th className="text-left text-xs text-gray-400 px-4 py-3 font-medium">Saat</th>
              <th className="text-center text-xs text-gray-400 px-4 py-3 font-medium">Personel</th>
              <th className="text-center text-xs text-gray-400 px-4 py-3 font-medium">Ort. Müşteri</th>
              <th className="text-center text-xs text-gray-400 px-4 py-3 font-medium">Oran</th>
              <th className="text-center text-xs text-gray-400 px-4 py-3 font-medium">Önerilen</th>
              <th className="text-center text-xs text-gray-400 px-4 py-3 font-medium">Durum</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 17 }, (_, i) => i + 7).map(hour => {
              const rec = recommendations.find(r => r.hour === hour);
              const style = rec ? STATUS_STYLES[rec.status] : STATUS_STYLES.optimal;
              return (
                <tr key={hour} className={`border-b border-gray-700/20 ${style.bg}`}>
                  <td className="px-4 py-2 text-sm text-white font-medium">{String(hour).padStart(2, '0')}:00</td>
                  <td className="px-4 py-2 text-center">
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={hourlyStaff[hour]}
                      onChange={e => updateStaff(hour, parseInt(e.target.value) || 0)}
                      className="w-16 text-center text-sm bg-gray-700/50 border border-gray-600/50 rounded px-2 py-1 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </td>
                  <td className="px-4 py-2 text-center text-sm text-gray-300">{rec?.avgCustomers ?? '-'}</td>
                  <td className="px-4 py-2 text-center text-sm text-gray-300">
                    {rec && rec.staffCount > 0 ? `${rec.ratio}:1` : '-'}
                  </td>
                  <td className="px-4 py-2 text-center text-sm text-purple-400 font-medium">{rec?.optimal ?? '-'}</td>
                  <td className="px-4 py-2 text-center">
                    <span className={`text-xs font-medium ${style.text}`}>{style.label}</span>
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
