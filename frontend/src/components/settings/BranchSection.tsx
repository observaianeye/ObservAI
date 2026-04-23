import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Plus, Pencil, Trash2, Star, MapPin, Loader2, X, Search, ExternalLink } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface Branch {
  id: string;
  name: string;
  city: string;
  latitude: number;
  longitude: number;
  timezone: string;
  isDefault: boolean;
  cameras?: { id: string; name: string; isActive: boolean }[];
}

export function BranchSection() {
  const { showToast } = useToast();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/branches`, { credentials: 'include' });
      if (res.ok) setBranches(await res.json());
    } catch (err) {
      console.error('[BranchSection] load:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm('Bu subeyi silmek istediginizden emin misiniz?')) return;
    const res = await fetch(`${API_URL}/api/branches/${id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) {
      showToast('success', 'Sube silindi');
      load();
    }
  };

  const handleSetDefault = async (id: string) => {
    const res = await fetch(`${API_URL}/api/branches/${id}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isDefault: true }),
    });
    if (res.ok) { showToast('success', 'Varsayilan sube guncellendi'); load(); }
  };

  const handleSubmit = async (data: Partial<Branch>) => {
    const url = editing ? `${API_URL}/api/branches/${editing.id}` : `${API_URL}/api/branches`;
    const method = editing ? 'PATCH' : 'POST';
    const res = await fetch(url, {
      method, credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string; details?: Array<{ path?: string[]; message?: string }> };
      // The backend returns a Zod issue list as `details`. Surface the first
      // one so the user sees which field failed instead of just "Validation
      // error" — saves a debug round-trip.
      const detail = err.details?.[0];
      const fieldMsg = detail ? `${detail.path?.join('.') ?? 'field'}: ${detail.message ?? 'invalid'}` : null;
      throw new Error(fieldMsg ?? err.error ?? 'Kaydetme basarisiz');
    }
    showToast('success', editing ? 'Sube guncellendi' : 'Sube eklendi');
    setFormOpen(false); setEditing(null);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-3">
          Subelerinizi yonetin. Hava durumu, Trends ve Insights bu subenin konumuna gore hesaplanir.
        </p>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => { setEditing(null); setFormOpen(true); }}
          className="px-3 py-1.5 bg-gradient-to-r from-brand-500 to-accent-500 text-white rounded-lg font-medium text-sm flex items-center gap-1.5 hover:shadow-glow-brand"
        >
          <Plus className="w-4 h-4" /> Yeni sube
        </motion.button>
      </div>

      {loading ? (
        <div className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin mx-auto text-brand-400" /></div>
      ) : branches.length === 0 ? (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-8 text-center">
          <Building2 className="w-10 h-10 text-brand-300 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-ink-2 font-medium">Henuz sube eklenmedi</p>
          <p className="text-xs text-ink-4 mt-1">"Yeni sube" butonu ile baslayin.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <AnimatePresence>
            {branches.map((b) => (
              <motion.div
                key={b.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`rounded-xl border p-4 ${b.isDefault ? 'border-brand-500/40 bg-brand-500/5' : 'border-white/[0.08] bg-white/[0.02]'}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-ink-0">{b.name}</h4>
                      {b.isDefault && <span className="text-[10px] uppercase tracking-wide font-bold text-brand-300 flex items-center gap-0.5"><Star className="w-3 h-3 fill-brand-300" /> Varsayilan</span>}
                    </div>
                    <div className="text-xs text-ink-3 mt-0.5 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {b.city}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {!b.isDefault && (
                      <button onClick={() => handleSetDefault(b.id)} title="Varsayilan yap" className="p-1.5 rounded-lg text-ink-3 hover:text-brand-300 hover:bg-brand-500/10">
                        <Star className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button onClick={() => { setEditing(b); setFormOpen(true); }} className="p-1.5 rounded-lg text-ink-3 hover:text-ink-0 hover:bg-white/[0.06]">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(b.id)} className="p-1.5 rounded-lg text-danger-400 hover:bg-danger-500/10">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="text-[11px] text-ink-4 font-mono">
                  {b.latitude.toFixed(4)}, {b.longitude.toFixed(4)} · {b.timezone}
                </div>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${b.latitude},${b.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-[11px] text-brand-300 hover:text-brand-200"
                >
                  Haritada gor <ExternalLink className="w-3 h-3" />
                </a>
                {b.cameras && b.cameras.length > 0 && (
                  <div className="mt-2 text-[11px] text-ink-3">
                    {b.cameras.length} kamera &middot; {b.cameras.filter((c) => c.isActive).length} aktif
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <BranchForm
        open={formOpen}
        initial={editing}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

function BranchForm({
  open, initial, onClose, onSubmit,
}: {
  open: boolean;
  initial: Branch | null;
  onClose: () => void;
  onSubmit: (data: Partial<Branch>) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [timezone, setTimezone] = useState('Europe/Istanbul');
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [geocoding, setGeocoding] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '');
      setCity(initial?.city ?? '');
      setLat(initial?.latitude?.toString() ?? '');
      setLon(initial?.longitude?.toString() ?? '');
      setTimezone(initial?.timezone ?? 'Europe/Istanbul');
      setIsDefault(initial?.isDefault ?? false);
      setErr(null);
    }
  }, [open, initial]);

  if (!open) return null;

  // Resolve city → coordinates via OSM Nominatim. Returns the parsed floats
  // on success; throws a human-readable error on failure so both the "Bul"
  // button and the submit-time fallback can reuse it.
  const geocodeCity = async (cityQuery: string): Promise<{ lat: number; lon: number }> => {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityQuery)}&limit=1`, {
      headers: { 'Accept-Language': 'tr' },
    });
    if (!res.ok) throw new Error('Geocoding servisi ulasilamaz');
    const data = await res.json() as Array<{ lat: string; lon: string; display_name: string }>;
    if (!data.length) throw new Error('Konum bulunamadi — lutfen daha acik yazin');
    const latNum = parseFloat(data[0].lat);
    const lonNum = parseFloat(data[0].lon);
    if (Number.isNaN(latNum) || Number.isNaN(lonNum)) {
      throw new Error('Geocoding gecersiz koordinat dondurdu');
    }
    return { lat: latNum, lon: lonNum };
  };

  const geocode = async () => {
    if (!city.trim()) { setErr('Once sehir girin'); return; }
    setGeocoding(true); setErr(null);
    try {
      const { lat: la, lon: lo } = await geocodeCity(city.trim());
      setLat(la.toFixed(6));
      setLon(lo.toFixed(6));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Geocoding hatasi');
    } finally {
      setGeocoding(false);
    }
  };

  const submit = async () => {
    setErr(null);
    if (!name.trim() || !city.trim()) { setErr('Ad ve sehir zorunlu'); return; }

    let latNum = parseFloat(lat);
    let lonNum = parseFloat(lon);

    // Auto-geocode when the user hasn't provided coordinates. Keeps the
    // "just add a branch by name" flow working without forcing them to
    // click the Bul button first.
    if (Number.isNaN(latNum) || Number.isNaN(lonNum)) {
      setGeocoding(true);
      try {
        const coords = await geocodeCity(city.trim());
        latNum = coords.lat;
        lonNum = coords.lon;
        setLat(coords.lat.toFixed(6));
        setLon(coords.lon.toFixed(6));
      } catch (e) {
        setGeocoding(false);
        setErr(e instanceof Error
          ? `${e.message}. Koordinatlari manuel girin.`
          : 'Koordinatlar cozulemedi — manuel girin');
        return;
      }
      setGeocoding(false);
    }

    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        city: city.trim(),
        latitude: latNum,
        longitude: lonNum,
        timezone,
        isDefault,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Kaydetme basarisiz');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.95, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        className="surface-card rounded-2xl p-6 w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-ink-4 font-medium">Sube</p>
            <h3 className="text-lg font-bold text-ink-0">{initial ? 'Sube duzenle' : 'Yeni sube'}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-ink-3 hover:text-ink-0"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-ink-2 mb-1">Sube adi</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Mozart Cafe"
              className="w-full px-3 py-2 bg-surface-2/70 border border-white/[0.08] rounded-lg text-ink-0 focus:outline-none focus:ring-2 focus:ring-brand-500/40" />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-2 mb-1">Sehir / adres</label>
            <div className="flex gap-2">
              <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Istanbul, Besiktas"
                className="flex-1 px-3 py-2 bg-surface-2/70 border border-white/[0.08] rounded-lg text-ink-0 focus:outline-none focus:ring-2 focus:ring-brand-500/40" />
              <button onClick={geocode} disabled={geocoding || !city} title="Koordinat otomatik bul"
                className="px-3 py-2 bg-brand-500/15 text-brand-200 border border-brand-500/30 rounded-lg flex items-center gap-1 hover:bg-brand-500/25 disabled:opacity-50">
                {geocoding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span className="text-xs">Bul</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-2 mb-1">Enlem</label>
              <input type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="41.0082"
                className="w-full px-3 py-2 bg-surface-2/70 border border-white/[0.08] rounded-lg text-ink-0 focus:outline-none focus:ring-2 focus:ring-brand-500/40 font-mono text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-2 mb-1">Boylam</label>
              <input type="number" step="any" value={lon} onChange={(e) => setLon(e.target.value)} placeholder="28.9784"
                className="w-full px-3 py-2 bg-surface-2/70 border border-white/[0.08] rounded-lg text-ink-0 focus:outline-none focus:ring-2 focus:ring-brand-500/40 font-mono text-sm" />
            </div>
          </div>

          <p className="text-[10px] text-ink-4 leading-relaxed">
            Koordinatlari Google Maps'te sag tiklayip &ldquo;ne var burada?&rdquo; ile de alabilirsiniz.
            &quot;Bul&quot; butonu OpenStreetMap Nominatim servisini kullanir.
          </p>

          <div>
            <label className="block text-xs font-medium text-ink-2 mb-1">Zaman dilimi</label>
            <select value={timezone} onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-3 py-2 bg-surface-2/70 border border-white/[0.08] rounded-lg text-ink-0 focus:outline-none focus:ring-2 focus:ring-brand-500/40">
              <option>Europe/Istanbul</option>
              <option>Europe/London</option>
              <option>Europe/Berlin</option>
              <option>America/New_York</option>
              <option>Asia/Dubai</option>
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm text-ink-2 cursor-pointer">
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="accent-brand-500" />
            Varsayilan sube (dashboard filtresi bu subeye oturur)
          </label>

          {err && <div className="text-sm text-danger-300 bg-danger-500/10 border border-danger-500/30 rounded-lg px-3 py-2">{err}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-4 py-2 text-ink-2 hover:text-ink-0 rounded-lg">Iptal</button>
            <motion.button whileTap={{ scale: 0.97 }} onClick={submit} disabled={saving}
              className="px-4 py-2 bg-gradient-to-r from-brand-500 to-accent-500 text-white rounded-lg font-semibold flex items-center gap-2 disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {saving ? 'Kaydediliyor...' : (initial ? 'Guncelle' : 'Olustur')}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
