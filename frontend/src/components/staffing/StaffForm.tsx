import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Mail, Phone, User, Loader2 } from 'lucide-react';

export interface StaffRecord {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  role: string;
  isActive: boolean;
  branchId?: string | null;
}

interface Props {
  open: boolean;
  initial?: Partial<StaffRecord> | null;
  branchId?: string | null;
  onClose: () => void;
  onSubmit: (payload: Partial<StaffRecord>) => Promise<void>;
}

const ROLES = [
  { value: 'server', label: 'Garson' },
  { value: 'chef', label: 'Asci' },
  { value: 'cashier', label: 'Kasiyer' },
  { value: 'host', label: 'Karsilayici' },
  { value: 'manager', label: 'Yonetici' },
];

export function StaffForm({ open, initial, branchId, onClose, onSubmit }: Props) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('server');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setFirstName(initial?.firstName ?? '');
      setLastName(initial?.lastName ?? '');
      setEmail(initial?.email ?? '');
      setPhone(initial?.phone ?? '');
      setRole(initial?.role ?? 'server');
      setError(null);
    }
  }, [open, initial]);

  const isEdit = !!initial?.id;

  const handleSubmit = async () => {
    setError(null);
    if (!firstName.trim() || !lastName.trim()) {
      setError('Ad ve soyad zorunlu');
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        role,
        branchId: branchId ?? undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kaydetme basarisiz');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 8 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="surface-card rounded-2xl p-6 w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-ink-4 font-medium">Personel</p>
                <h3 className="text-xl font-bold text-ink-0">
                  {isEdit ? 'Duzenle' : 'Yeni personel ekle'}
                </h3>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-ink-3 hover:text-ink-0 hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Ad" icon={User}>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Ayse"
                    className="w-full px-3 py-2 bg-surface-2/70 border border-white/[0.08] rounded-lg text-ink-0 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                  />
                </Field>
                <Field label="Soyad">
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Yilmaz"
                    className="w-full px-3 py-2 bg-surface-2/70 border border-white/[0.08] rounded-lg text-ink-0 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                  />
                </Field>
              </div>

              <Field label="Gorev">
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2/70 border border-white/[0.08] rounded-lg text-ink-0 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </Field>

              <Field label="E-posta" icon={Mail} hint="Vardiya bildirimi bu adrese gider">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ayse@kafe.com"
                  className="w-full px-3 py-2 bg-surface-2/70 border border-white/[0.08] rounded-lg text-ink-0 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                />
              </Field>

              <Field label="Telefon" icon={Phone}>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+90 ..."
                  className="w-full px-3 py-2 bg-surface-2/70 border border-white/[0.08] rounded-lg text-ink-0 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                />
              </Field>

              {error && (
                <div className="text-sm text-danger-300 bg-danger-500/10 border border-danger-500/30 rounded-lg px-3 py-2">{error}</div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-ink-2 hover:text-ink-0 rounded-lg transition-colors"
                >
                  Iptal
                </button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleSubmit}
                  disabled={saving}
                  className="px-5 py-2 bg-gradient-to-r from-brand-500 to-accent-500 text-white rounded-lg font-semibold flex items-center gap-2 hover:shadow-glow-brand disabled:opacity-60"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Kaydediliyor...' : (isEdit ? 'Guncelle' : 'Ekle')}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({ label, icon: Icon, hint, children }: { label: string; icon?: React.ComponentType<{ className?: string }>; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-medium text-ink-2 mb-1.5">
        {Icon && <Icon className="w-3.5 h-3.5 text-ink-3" />}
        {label}
      </label>
      {children}
      {hint && <p className="text-[10px] text-ink-4 mt-1">{hint}</p>}
    </div>
  );
}
