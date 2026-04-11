import { useState, useEffect, useCallback } from 'react';
import { cameraBackendService, type TableData } from '../../services/cameraBackendService';

const STATUS_CONFIG = {
  empty: { label: 'Boş', color: 'bg-emerald-500/20 border-emerald-500/50', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  occupied: { label: 'Dolu', color: 'bg-red-500/20 border-red-500/50', text: 'text-red-400', dot: 'bg-red-400' },
  needs_cleaning: { label: 'Temizlik Bekliyor', color: 'bg-amber-500/20 border-amber-500/50 animate-pulse', text: 'text-amber-400', dot: 'bg-amber-400' },
} as const;

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}sn`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}dk ${Math.round(seconds % 60)}sn`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}sa ${m}dk`;
}

export default function TableOccupancyPage() {
  const [tables, setTables] = useState<TableData[]>([]);
  const [connected, setConnected] = useState(false);

  const handleAnalytics = useCallback((data: any) => {
    if (data.tables && Array.isArray(data.tables)) {
      setTables(data.tables);
      setConnected(true);
    }
  }, []);

  useEffect(() => {
    const unsub = cameraBackendService.onAnalytics(handleAnalytics);
    const statusUnsub = cameraBackendService.onConnectionStatus((status: string) => {
      setConnected(status === 'connected');
    });
    return () => { unsub(); statusUnsub(); };
  }, [handleAnalytics]);

  const occupied = tables.filter(t => t.status === 'occupied').length;
  const empty = tables.filter(t => t.status === 'empty').length;
  const needsCleaning = tables.filter(t => t.status === 'needs_cleaning').length;
  const totalTurnover = tables.reduce((sum, t) => sum + t.turnoverCount, 0);
  const avgStay = tables.length > 0
    ? tables.reduce((sum, t) => sum + t.avgStaySeconds, 0) / tables.length
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Masa Durumu</h2>
          <p className="text-sm text-gray-400 mt-1">Gerçek zamanlı masa doluluk takibi</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
          connected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
        }`}>
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
          {connected ? 'Canlı' : 'Bağlantı Yok'}
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Toplam Masa" value={tables.length} color="text-white" />
        <StatCard label="Dolu" value={occupied} color="text-red-400" />
        <StatCard label="Bos" value={empty} color="text-emerald-400" />
        <StatCard label="Temizlik Bekliyor" value={needsCleaning} color="text-amber-400" />
        <StatCard label="Toplam Turnover" value={totalTurnover} color="text-blue-400" />
      </div>

      {/* Average Stay */}
      {avgStay > 0 && (
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
          <p className="text-sm text-gray-400">Ortalama Oturma Suresi</p>
          <p className="text-2xl font-bold text-white">{formatDuration(avgStay)}</p>
        </div>
      )}

      {/* Table Grid */}
      {tables.length === 0 ? (
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-12 text-center">
          <div className="text-gray-500 text-lg mb-2">Henüz masa tanımlanmadı</div>
          <p className="text-gray-600 text-sm">
            Zone Labeling sayfasından &quot;Masa (Table)&quot; tipinde zone ekleyin.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {tables.map(table => {
            const config = STATUS_CONFIG[table.status] || STATUS_CONFIG.empty;
            return (
              <div
                key={table.id}
                className={`relative border rounded-xl p-4 transition-all ${config.color}`}
              >
                {/* Status dot */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-white truncate">
                    {table.name || table.id}
                  </span>
                  <span className={`w-3 h-3 rounded-full ${config.dot}`} />
                </div>

                {/* Status label */}
                <div className={`text-xs font-medium mb-2 ${config.text}`}>
                  {config.label}
                </div>

                {/* Occupancy info */}
                {table.status === 'occupied' && (
                  <div className="space-y-1">
                    <div className="text-xs text-gray-400">
                      <span className="text-white font-medium">{table.currentOccupants}</span> kişi
                    </div>
                    <div className="text-xs text-gray-400">
                      Süre: <span className="text-white font-medium">{formatDuration(table.occupancyDuration)}</span>
                    </div>
                  </div>
                )}

                {/* Turnover */}
                <div className="mt-2 pt-2 border-t border-gray-700/30">
                  <div className="text-xs text-gray-500">
                    Turnover: <span className="text-gray-300">{table.turnoverCount}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
