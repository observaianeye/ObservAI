import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, CalendarDays, Sparkles, Plus, Send, TrendingUp, TrendingDown, Circle } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../../contexts/ToastContext';
import { StaffForm, type StaffRecord } from '../../components/staffing/StaffForm';
import { StaffList } from '../../components/staffing/StaffList';
import { ShiftCalendar, type Assignment } from '../../components/staffing/ShiftCalendar';
import { TelegramLinkModal } from '../../components/staffing/TelegramLinkModal';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

type Tab = 'staff' | 'schedule' | 'recommendations';

interface Recommendation {
  hour: number;
  avgCustomers: number;
  staffCount: number;
  ratio: number;
  status: 'optimal' | 'understaffed' | 'overstaffed';
  optimal: number;
}

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow);
  return x;
}

export default function StaffingPage() {
  const { t, lang } = useLanguage();
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>('staff');

  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StaffRecord | null>(null);

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(new Date()));
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);

  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [recSummary, setRecSummary] = useState<{ totalHoursOff?: number; efficiency?: number; message?: string } | null>(null);
  const [recLoading, setRecLoading] = useState(false);
  const [recMeta, setRecMeta] = useState<{ needsMoreData: boolean; daysCollected?: number; daysRemaining?: number; reason?: string }>({ needsMoreData: false });
  const [notifSummary, setNotifSummary] = useState<{ telegramSent: number; emailSent: number; attempted: number }>({ telegramSent: 0, emailSent: 0, attempted: 0 });

  const [branchId, setBranchId] = useState<string>('');
  const [cameraId, setCameraId] = useState<string>('');

  const [tgLinkStaff, setTgLinkStaff] = useState<StaffRecord | null>(null);

  useEffect(() => {
    setBranchId(localStorage.getItem('selectedBranchId') || 'default');
    setCameraId(localStorage.getItem('selectedCameraId') || 'default');
  }, []);

  // ── Staff CRUD ─────────────────────────────────────────────────────────
  const loadStaff = useCallback(async () => {
    setStaffLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/staff`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setStaff(data.staff || []);
      }
    } catch (err) {
      console.error('[staffing] load staff failed:', err);
    } finally {
      setStaffLoading(false);
    }
  }, []);

  useEffect(() => { loadStaff(); }, [loadStaff]);

  const handleSaveStaff = async (payload: Partial<StaffRecord>) => {
    const method = editing ? 'PATCH' : 'POST';
    const url = editing ? `${API_URL}/api/staff/${editing.id}` : `${API_URL}/api/staff`;
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to save staff');
    }
    showToast('success', editing ? 'Personel guncellendi' : 'Personel eklendi');
    setFormOpen(false);
    setEditing(null);
    loadStaff();
  };

  const handleDeleteStaff = async (id: string) => {
    if (!confirm(lang === 'tr' ? 'Bu personeli pasiflestirmek istediginizden emin misiniz?' : 'Deactivate this staff member?')) return;
    const res = await fetch(`${API_URL}/api/staff/${id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) {
      showToast('warning', 'Personel pasiflestirildi');
      loadStaff();
    }
  };

  const handleSendTest = async (s: StaffRecord, mode: 'telegram' | 'email' | 'both') => {
    try {
      const res = await fetch(`${API_URL}/api/notifications/test-staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          staffId: s.id,
          mode,
          preview: {
            date: new Date().toLocaleDateString('tr-TR'),
            shiftStart: '09:00',
            shiftEnd: '17:00',
            role: s.role,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast('error', data.error || 'Test bildirimi basarisiz');
        return;
      }
      const tg = data.result?.telegram;
      const em = data.result?.email;
      const parts: string[] = [];
      if (tg) parts.push(`Telegram: ${tg.sent ? 'OK' : `hata (${tg.error})`}`);
      if (em) parts.push(`Email: ${em.sent ? 'OK' : `hata (${em.error})`}`);
      showToast(parts.every((p) => p.includes('OK')) ? 'success' : 'warning', parts.join(' · ') || 'Bildirim gonderildi');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Network error');
    }
  };

  // ── Assignments ──────────────────────────────────────────────────────────
  const loadAssignments = useCallback(async () => {
    if (!branchId) return;
    setAssignmentsLoading(true);
    try {
      const from = new Date(weekStart);
      const to = new Date(weekStart); to.setDate(to.getDate() + 7);
      const qs = new URLSearchParams({
        branchId,
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
      });
      const res = await fetch(`${API_URL}/api/staff-assignments?${qs}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAssignments(data.assignments || []);
      }
    } catch (err) {
      console.error('[staffing] load assignments:', err);
    } finally {
      setAssignmentsLoading(false);
    }
  }, [branchId, weekStart]);

  useEffect(() => { loadAssignments(); }, [loadAssignments]);

  const handleCreateAssignment = async (payload: { staffId: string; date: string; shiftStart: string; shiftEnd: string; role?: string; notifyNow: boolean }) => {
    if (!branchId) throw new Error('Sube secili degil');
    const res = await fetch(`${API_URL}/api/staff-assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ...payload, branchId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Vardiya olusturulamadi');
    }
    const data = await res.json();
    const tg = data.notification?.telegram;
    const em = data.notification?.email;
    if (payload.notifyNow) {
      const ok = tg?.sent || em?.sent;
      showToast(ok ? 'success' : 'warning',
        ok ? 'Vardiya olusturuldu ve bildirim gonderildi' : `Vardiya olusturuldu (bildirim: ${tg?.error ?? em?.error ?? 'kanal eksik'})`);
    } else {
      showToast('success', 'Vardiya olusturuldu');
    }
    loadAssignments();
  };

  const handleDeleteAssignment = async (id: string) => {
    const res = await fetch(`${API_URL}/api/staff-assignments/${id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) {
      showToast('warning', 'Vardiya silindi');
      loadAssignments();
    }
  };

  const handleResendNotify = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/api/staff-assignments/${id}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mode: 'both' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gonderilemedi');
      const ok = data.result?.telegram?.sent || data.result?.email?.sent;
      showToast(ok ? 'success' : 'warning', ok ? 'Bildirim yeniden gonderildi' : 'Hicbir kanal hazir degil');
      loadAssignments();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Network error');
    }
  };

  // ── Recommendations (existing endpoint) ─────────────────────────────────
  const loadRecommendations = useCallback(async () => {
    if (!branchId) return;
    setRecLoading(true);
    try {
      const qs = cameraId && cameraId !== 'default' ? `?cameraId=${cameraId}` : '';
      const res = await fetch(`${API_URL}/api/staffing/${branchId}/recommendations${qs}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setRecommendations(data.recommendations || []);
        setRecSummary(data.summary || null);
        setRecMeta({
          needsMoreData: !!data.needsMoreData,
          daysCollected: data.daysCollected,
          daysRemaining: data.daysRemaining,
          reason: data.reason,
        });
      } else {
        setRecommendations([]);
        setRecMeta({ needsMoreData: true, reason: 'fetch_error' });
      }
    } catch (err) {
      console.error('[staffing] recommendations:', err);
      setRecMeta({ needsMoreData: true, reason: 'network_error' });
    } finally {
      setRecLoading(false);
    }
  }, [branchId, cameraId]);

  useEffect(() => {
    if (tab === 'recommendations') loadRecommendations();
  }, [tab, loadRecommendations]);

  // ── Notification summary (real KPI from NotificationLog) ──────────────
  const loadNotifSummary = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/notifications/summary?days=7`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setNotifSummary({
        telegramSent: data.totals?.telegram?.sent ?? 0,
        emailSent: data.totals?.email?.sent ?? 0,
        attempted: data.totals?.all?.attempted ?? 0,
      });
    } catch (err) {
      console.error('[staffing] notif summary:', err);
    }
  }, []);

  useEffect(() => { loadNotifSummary(); }, [loadNotifSummary, assignments.length]);

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const active = staff.filter((s) => s.isActive).length;
    const withTg = staff.filter((s) => s.isActive && s.telegramChatId).length;
    const thisWeek = assignments.length;
    // Real KPI comes from NotificationLog (7-day window): successful sends
    // across Telegram + Email. Falls back to the per-assignment flag count
    // when the summary endpoint hasn't loaded yet.
    const notifiedReal = notifSummary.telegramSent + notifSummary.emailSent;
    const notifiedFallback = assignments.filter((a) => a.notifiedViaTelegram || a.notifiedViaEmail).length;
    const notified = notifSummary.attempted > 0 ? notifiedReal : notifiedFallback;
    return { active, withTg, thisWeek, notified };
  }, [staff, assignments, notifSummary]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-gradient-brand tracking-tight">{t('nav.staffing') || 'Personel & Vardiya'}</h1>
          <p className="text-sm text-ink-3 mt-1">
            {lang === 'tr' ? 'Ekibinizi yonetin, vardiya planlayin, telegram/email ile anlik bildirim gonderin' : 'Manage your team, plan shifts, notify via Telegram/email instantly'}
          </p>
        </div>
        {tab === 'staff' && (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => { setEditing(null); setFormOpen(true); }}
            className="px-4 py-2 bg-gradient-to-r from-brand-500 to-accent-500 text-white rounded-xl font-semibold hover:shadow-glow-brand flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {lang === 'tr' ? 'Yeni personel' : 'Add staff'}
          </motion.button>
        )}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={Users}
          label={lang === 'tr' ? 'Aktif personel' : 'Active staff'}
          value={String(kpis.active)}
          accent="brand"
        />
        <KpiCard
          icon={Send}
          label={lang === 'tr' ? 'Telegram bagli' : 'Telegram linked'}
          value={`${kpis.withTg}/${kpis.active}`}
          accent="violet"
        />
        <KpiCard
          icon={CalendarDays}
          label={lang === 'tr' ? 'Bu hafta vardiya' : 'Shifts this week'}
          value={String(kpis.thisWeek)}
          accent="accent"
        />
        <KpiCard
          icon={Circle}
          label={lang === 'tr' ? 'Bildirim gonderildi (7g)' : 'Notifications sent (7d)'}
          value={notifSummary.attempted > 0 ? String(kpis.notified) : `${kpis.notified}/${kpis.thisWeek}`}
          accent="success"
        />
      </div>

      {/* Tabs */}
      <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-surface-1/60 border border-white/[0.08]">
        <TabButton active={tab === 'staff'} onClick={() => setTab('staff')} icon={<Users className="w-4 h-4" />} label={lang === 'tr' ? 'Personel' : 'Staff'} />
        <TabButton active={tab === 'schedule'} onClick={() => setTab('schedule')} icon={<CalendarDays className="w-4 h-4" />} label={lang === 'tr' ? 'Vardiya Takvimi' : 'Shift Calendar'} />
        <TabButton active={tab === 'recommendations'} onClick={() => setTab('recommendations')} icon={<Sparkles className="w-4 h-4" />} label={lang === 'tr' ? 'Tavsiyeler' : 'Recommendations'} />
      </div>

      <AnimatePresence mode="wait">
        {tab === 'staff' && (
          <motion.div key="staff" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            <StaffList
              staff={staff}
              loading={staffLoading}
              onEdit={(s) => { setEditing(s); setFormOpen(true); }}
              onDelete={handleDeleteStaff}
              onSendTest={handleSendTest}
              onLinkTelegram={(s) => setTgLinkStaff(s)}
            />
          </motion.div>
        )}

        {tab === 'schedule' && (
          <motion.div key="schedule" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            <ShiftCalendar
              staff={staff}
              assignments={assignments}
              loading={assignmentsLoading}
              branchId={branchId}
              weekStart={weekStart}
              onWeekChange={setWeekStart}
              onCreate={handleCreateAssignment}
              onDelete={handleDeleteAssignment}
              onResendNotify={handleResendNotify}
            />
          </motion.div>
        )}

        {tab === 'recommendations' && (
          <motion.div key="recs" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="space-y-4">
            {recSummary?.message && (
              <div className="surface-card rounded-xl p-4 text-sm text-ink-2">{recSummary.message}</div>
            )}
            {recLoading ? (
              <div className="text-center py-10 text-ink-3">
                {lang === 'tr' ? 'Yukleniyor...' : 'Loading...'}
              </div>
            ) : recommendations.length === 0 ? (
              <div className="surface-card rounded-xl p-10 text-center">
                <Sparkles className="w-8 h-8 text-brand-300 mx-auto mb-3" />
                <p className="text-ink-2 font-medium">
                  {recMeta.reason === 'no_branch'
                    ? (lang === 'tr' ? 'Once bir sube ekleyin' : 'Add a branch first')
                    : recMeta.reason === 'no_cameras'
                      ? (lang === 'tr' ? 'Bu subede henuz kamera yok' : 'No cameras configured for this branch')
                      : (lang === 'tr' ? 'Tavsiye uretmek icin daha fazla gecmis veri gerekiyor' : 'More historical data needed to generate recommendations')}
                </p>
                {typeof recMeta.daysCollected === 'number' && typeof recMeta.daysRemaining === 'number' && recMeta.daysRemaining > 0 && (
                  <div className="mt-4 max-w-sm mx-auto">
                    <div className="flex items-center justify-between text-xs text-ink-4 mb-1">
                      <span>
                        {lang === 'tr'
                          ? `Toplanan gun: ${recMeta.daysCollected}/3`
                          : `Days collected: ${recMeta.daysCollected}/3`}
                      </span>
                      <span>
                        {lang === 'tr'
                          ? `${recMeta.daysRemaining} gun kaldi`
                          : `${recMeta.daysRemaining} day${recMeta.daysRemaining === 1 ? '' : 's'} left`}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-brand-500 to-accent-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, ((recMeta.daysCollected ?? 0) / 3) * 100)}%` }}
                        transition={{ duration: 0.6 }}
                      />
                    </div>
                  </div>
                )}
                <p className="text-xs text-ink-4 mt-3">
                  {lang === 'tr'
                    ? 'Kamera ile birkac gun gecin veya Historical backfill calistirin.'
                    : 'Let the camera run for a few days or run the historical backfill script.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {recommendations.map((r) => (
                  <motion.div
                    key={r.hour}
                    layout
                    className={`surface-card rounded-xl p-4 border ${
                      r.status === 'optimal'
                        ? 'border-success-500/20'
                        : r.status === 'understaffed'
                          ? 'border-danger-500/30'
                          : 'border-warning-500/25'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-ink-4 font-mono">Saat</div>
                        <div className="text-2xl font-bold text-ink-0">{String(r.hour).padStart(2, '0')}:00</div>
                      </div>
                      <StatusBadge status={r.status} />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="text-ink-4">Ort. musteri</div>
                        <div className="text-ink-1 font-semibold">{Math.round(r.avgCustomers)}</div>
                      </div>
                      <div>
                        <div className="text-ink-4">Simdi / optimal</div>
                        <div className="text-ink-1 font-semibold">{r.staffCount} / {r.optimal}</div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <StaffForm
        open={formOpen}
        initial={editing}
        branchId={branchId || null}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onSubmit={handleSaveStaff}
      />

      <TelegramLinkModal
        open={!!tgLinkStaff}
        staffId={tgLinkStaff?.id ?? null}
        staffName={tgLinkStaff ? `${tgLinkStaff.firstName} ${tgLinkStaff.lastName}` : undefined}
        onClose={() => setTgLinkStaff(null)}
        onLinked={() => { loadStaff(); }}
      />
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
        active ? 'text-white' : 'text-ink-2 hover:text-ink-0'
      }`}
    >
      {active && (
        <motion.div
          layoutId="staffingTabBg"
          className="absolute inset-0 rounded-lg bg-gradient-to-r from-brand-500 to-accent-500 shadow-glow-brand"
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        />
      )}
      <span className="relative flex items-center gap-2">{icon}{label}</span>
    </motion.button>
  );
}

function StatusBadge({ status }: { status: 'optimal' | 'understaffed' | 'overstaffed' }) {
  const map = {
    optimal: { bg: 'bg-success-500/15 text-success-300 border-success-500/30', label: 'Uygun', icon: <Circle className="w-3 h-3" /> },
    understaffed: { bg: 'bg-danger-500/15 text-danger-300 border-danger-500/30', label: 'Az', icon: <TrendingDown className="w-3 h-3" /> },
    overstaffed: { bg: 'bg-warning-500/15 text-warning-300 border-warning-500/30', label: 'Fazla', icon: <TrendingUp className="w-3 h-3" /> },
  } as const;
  const s = map[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium ${s.bg}`}>
      {s.icon} {s.label}
    </span>
  );
}

function KpiCard({ icon: Icon, label, value, accent }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; accent: 'brand' | 'violet' | 'accent' | 'success' }) {
  const styles = {
    brand: 'bg-brand-500/10 text-brand-300 border-brand-500/20',
    violet: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
    accent: 'bg-accent-500/10 text-accent-300 border-accent-500/20',
    success: 'bg-success-500/10 text-success-300 border-success-500/20',
  } as const;
  return (
    <div className="surface-card p-4">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg border flex items-center justify-center ${styles[accent]}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-ink-4 font-medium">{label}</div>
          <div className="text-xl font-bold text-ink-0">{value}</div>
        </div>
      </div>
    </div>
  );
}
