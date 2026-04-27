import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, ChevronLeft, ChevronRight, Plus, Send, Loader2, X, Check, AlertCircle } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { NotificationStatusBadge } from './NotificationStatusBadge';
import type { StaffRecord } from './StaffForm';

export interface Assignment {
  id: string;
  staffId: string;
  staff: StaffRecord;
  branchId: string;
  date: string; // ISO
  shiftStart: string;
  shiftEnd: string;
  role?: string | null;
  status: string;
  notifiedViaEmail: boolean;
  notifiedAt?: string | null;
}

interface Props {
  staff: StaffRecord[];
  assignments: Assignment[];
  loading: boolean;
  branchId: string | null;
  weekStart: Date;
  onWeekChange: (d: Date) => void;
  onCreate: (payload: { staffId: string; date: string; shiftStart: string; shiftEnd: string; role?: string; notifyNow: boolean }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onResendNotify: (id: string) => Promise<void>;
}

// Map Mon-first index 0..6 → JS getDay() index for `common.weekday.short.X`
// (Mon=1, Tue=2, ..., Sat=6, Sun=0).
const MON_FIRST_TO_JS = [1, 2, 3, 4, 5, 6, 0];

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = (x.getDay() + 6) % 7; // 0 = Monday
  x.setDate(x.getDate() - dow);
  return x;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d); x.setDate(x.getDate() + n); return x;
}
function toYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function ShiftCalendar({ staff, assignments, loading, branchId, weekStart, onWeekChange, onCreate, onDelete, onResendNotify }: Props) {
  const { t, lang } = useLanguage();
  const locale = lang === 'tr' ? 'tr-TR' : 'en-US';
  const [formOpen, setFormOpen] = useState(false);
  const [formDate, setFormDate] = useState<Date | null>(null);

  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const byDay = useMemo(() => {
    const map: Record<string, Assignment[]> = {};
    for (const d of week) map[toYmd(d)] = [];
    for (const a of assignments) {
      const key = toYmd(new Date(a.date));
      if (map[key]) map[key].push(a);
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => a.shiftStart.localeCompare(b.shiftStart));
    }
    return map;
  }, [assignments, week]);

  const addShiftTooltip = staff.length === 0
    ? t('shifts.tooltip.addStaffFirst')
    : !branchId
      ? t('shifts.tooltip.selectBranch')
      : t('shifts.tooltip.addShift');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-brand-300" />
          <h3 className="text-lg font-semibold text-ink-0">{t('shifts.title')}</h3>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => onWeekChange(addDays(weekStart, -7))} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-ink-2">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-ink-1 font-medium font-mono min-w-[160px] text-center">
            {week[0].toLocaleDateString(locale, { day: '2-digit', month: 'short' })} – {week[6].toLocaleDateString(locale, { day: '2-digit', month: 'short' })}
          </span>
          <button onClick={() => onWeekChange(addDays(weekStart, 7))} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-ink-2">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => onWeekChange(startOfWeek(new Date()))}
            className="px-2 py-1 rounded-lg text-xs text-ink-3 hover:text-ink-0 hover:bg-white/[0.06]"
          >
            {t('shifts.today')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 min-h-[420px]">
        {week.map((day, i) => {
          const key = toYmd(day);
          const dayAssignments = byDay[key] || [];
          const isToday = sameDay(day, new Date());
          return (
            <div
              key={key}
              className={`surface-card p-3 flex flex-col gap-2 ${isToday ? 'ring-1 ring-brand-500/40' : ''}`}
            >
              <div className="flex items-center justify-between mb-1">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-ink-4 font-mono">{t(`common.weekday.short.${MON_FIRST_TO_JS[i]}`)}</div>
                  <div className={`text-lg font-bold ${isToday ? 'text-brand-300' : 'text-ink-0'}`}>{day.getDate()}</div>
                </div>
                <button
                  onClick={() => { setFormDate(day); setFormOpen(true); }}
                  disabled={staff.length === 0 || !branchId}
                  title={addShiftTooltip}
                  className="p-1 rounded-lg text-ink-3 hover:text-ink-0 hover:bg-brand-500/15 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" strokeWidth={2} />
                </button>
              </div>

              <div className="flex-1 space-y-1.5 overflow-y-auto custom-scrollbar">
                <AnimatePresence>
                  {dayAssignments.map((a) => (
                    <motion.div
                      key={a.id}
                      layout
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.18 }}
                      className="relative group rounded-lg border border-brand-500/25 bg-gradient-to-br from-brand-500/20 via-brand-500/8 to-transparent p-2"
                    >
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <span className="text-[11px] font-medium text-ink-0 truncate">
                          {a.staff.firstName} {a.staff.lastName}
                        </span>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            title={t('shifts.action.resend')}
                            onClick={(e) => { e.stopPropagation(); onResendNotify(a.id); }}
                            className="p-0.5 rounded text-ink-3 hover:text-brand-300"
                          >
                            <Send className="w-3 h-3" />
                          </button>
                          <button
                            title={t('shifts.action.delete')}
                            onClick={(e) => { e.stopPropagation(); onDelete(a.id); }}
                            className="p-0.5 rounded text-ink-3 hover:text-danger-300"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <div className="text-[10px] font-mono text-ink-2 mb-1">{a.shiftStart} – {a.shiftEnd}</div>
                      <div className="flex items-center justify-between">
                        <NotificationStatusBadge email={a.notifiedViaEmail} notifiedAt={a.notifiedAt} compact />
                        <StatusPill status={a.status} />
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>

      {loading && <div className="text-center py-6 text-sm text-ink-3"><Loader2 className="w-4 h-4 inline-block animate-spin mr-2" /> {t('common.loading')}</div>}

      <AssignmentForm
        open={formOpen}
        date={formDate}
        staff={staff}
        onClose={() => setFormOpen(false)}
        onSubmit={onCreate}
      />
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const { t } = useLanguage();
  const styles: Record<string, string> = {
    pending: 'bg-warning-500/10 text-warning-300',
    accepted: 'bg-success-500/10 text-success-300',
    declined: 'bg-danger-500/10 text-danger-300',
    completed: 'bg-ink-3/10 text-ink-3',
  };
  const labelKey = `shifts.statusPill.${status}`;
  const label = t(labelKey);
  const icon = status === 'accepted' ? <Check className="w-2.5 h-2.5" /> : status === 'declined' ? <X className="w-2.5 h-2.5" /> : null;
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] ${styles[status] ?? 'bg-white/[0.05] text-ink-3'}`}>
      {icon}
      {label === labelKey ? status : label}
    </span>
  );
}

function AssignmentForm({
  open, date, staff, onClose, onSubmit,
}: {
  open: boolean;
  date: Date | null;
  staff: StaffRecord[];
  onClose: () => void;
  onSubmit: (payload: { staffId: string; date: string; shiftStart: string; shiftEnd: string; role?: string; notifyNow: boolean }) => Promise<void>;
}) {
  const { t, lang } = useLanguage();
  const locale = lang === 'tr' ? 'tr-TR' : 'en-US';
  const [staffId, setStaffId] = useState('');
  const [shiftStart, setShiftStart] = useState('09:00');
  const [shiftEnd, setShiftEnd] = useState('17:00');
  const [role, setRole] = useState('');
  const [notifyNow, setNotifyNow] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!open || !date) return null;

  const activeStaff = staff.filter((s) => s.isActive);

  const submit = async () => {
    setErr(null);
    if (!staffId) { setErr(t('shifts.form.error.selectStaff')); return; }
    setSaving(true);
    try {
      await onSubmit({
        staffId,
        date: toYmd(date),
        shiftStart, shiftEnd, role: role || undefined,
        notifyNow,
      });
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('shifts.form.error.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.95, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        className="surface-card rounded-2xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-ink-4 font-medium">{t('shifts.form.newShift')}</p>
            <h3 className="text-lg font-bold text-ink-0">
              {date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-ink-3 hover:text-ink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-ink-2 mb-1">{t('shifts.form.staff')}</label>
            <select
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              className="w-full px-3 py-2 bg-surface-2/70 border border-white/[0.08] rounded-lg text-ink-0 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            >
              <option value="">{t('shifts.form.selectStaff')}</option>
              {activeStaff.map((s) => (
                <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-ink-2 mb-1">{t('shifts.form.start')}</label>
              <input
                type="time"
                value={shiftStart}
                onChange={(e) => setShiftStart(e.target.value)}
                className="w-full px-3 py-2 bg-surface-2/70 border border-white/[0.08] rounded-lg text-ink-0 focus:outline-none focus:ring-2 focus:ring-brand-500/40 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-2 mb-1">{t('shifts.form.end')}</label>
              <input
                type="time"
                value={shiftEnd}
                onChange={(e) => setShiftEnd(e.target.value)}
                className="w-full px-3 py-2 bg-surface-2/70 border border-white/[0.08] rounded-lg text-ink-0 focus:outline-none focus:ring-2 focus:ring-brand-500/40 font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-2 mb-1">{t('shifts.form.role')}</label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder={t('shifts.form.rolePlaceholder')}
              className="w-full px-3 py-2 bg-surface-2/70 border border-white/[0.08] rounded-lg text-ink-0 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-ink-2 cursor-pointer">
            <input type="checkbox" checked={notifyNow} onChange={(e) => setNotifyNow(e.target.checked)} className="accent-brand-500" />
            {t('shifts.form.notifyNow')}
          </label>

          {err && (
            <div className="flex items-start gap-2 text-sm text-danger-300 bg-danger-500/10 border border-danger-500/30 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {err}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="px-4 py-2 text-ink-2 hover:text-ink-0 rounded-lg">{t('shifts.form.cancel')}</button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={submit}
              disabled={saving}
              className="px-4 py-2 bg-gradient-to-r from-brand-500 to-accent-500 text-white rounded-lg font-semibold flex items-center gap-2 disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {saving ? t('shifts.form.submitting') : t('shifts.form.submit')}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
