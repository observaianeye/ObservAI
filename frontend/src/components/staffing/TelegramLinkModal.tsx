import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, CheckCircle, MessageSquare, RefreshCw, AlertCircle, Loader2, ExternalLink } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface Props {
  open: boolean;
  staffId: string | null;
  staffName?: string;
  onClose: () => void;
  onLinked?: () => void; // called after successful flow (we poll client-side)
}

interface LinkResponse {
  alreadyLinked: boolean;
  chatId?: string | null;
  url: string | null;
  botUsername: string | null;
  token?: string;
}

export function TelegramLinkModal({ open, staffId, staffName, onClose, onLinked }: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<LinkResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchLink = async () => {
    if (!staffId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/webhooks/telegram/link/${staffId}`, { credentials: 'include' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Link alinamadi');
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && staffId) fetchLink();
    if (!open) {
      setData(null);
      setCopied(false);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, staffId]);

  // Poll every 3s while modal is open and waiting for link; stop once linked.
  useEffect(() => {
    if (!open || !staffId || !data || data.alreadyLinked) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/api/webhooks/telegram/link/${staffId}`, { credentials: 'include' });
        if (!res.ok) return;
        const json = (await res.json()) as LinkResponse;
        if (json.alreadyLinked) {
          setData(json);
          onLinked?.();
        }
      } catch {
        /* swallow transient errors */
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [open, staffId, data, onLinked]);

  const rotate = async () => {
    if (!staffId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/webhooks/telegram/link/${staffId}/rotate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: '{}',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Yenileme basarisiz');
      setData({ alreadyLinked: false, url: json.url, botUsername: json.botUsername, token: json.token });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!data?.url) return;
    try {
      await navigator.clipboard.writeText(data.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  // Use a public QR image service so we avoid shipping a QR library. The URL
  // itself is a public Telegram deep link, so leaking it to the QR service is
  // acceptable — it's already shareable.
  const qrSrc = data?.url
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${encodeURIComponent(data.url)}`
    : null;

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
            className="surface-card rounded-2xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-ink-4 font-medium">Telegram</p>
                <h3 className="text-xl font-bold text-ink-0 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-brand-300" />
                  {staffName ? `${staffName} icin bagla` : 'Telegram bagla'}
                </h3>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg text-ink-3 hover:text-ink-0 hover:bg-white/5">
                <X className="w-5 h-5" />
              </button>
            </div>

            {loading && !data && (
              <div className="flex items-center justify-center py-12 text-ink-3">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Yukleniyor...
              </div>
            )}

            {error && (
              <div className="mb-4 text-sm text-danger-300 bg-danger-500/10 border border-danger-500/30 rounded-lg px-3 py-2 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {data?.alreadyLinked && (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-success-300 mx-auto mb-3" />
                <p className="text-ink-0 font-semibold">Baglanti tamamlandi</p>
                <p className="text-xs text-ink-3 mt-1">Chat ID: <span className="font-mono">{data.chatId}</span></p>
                <button
                  onClick={onClose}
                  className="mt-4 px-4 py-2 bg-gradient-to-r from-brand-500 to-accent-500 text-white rounded-lg font-medium"
                >
                  Kapat
                </button>
              </div>
            )}

            {data && !data.alreadyLinked && data.url && (
              <div className="space-y-4">
                <p className="text-sm text-ink-2">
                  Personelin bu QR kodu taramasi yeterli. Telegram acilacak, <span className="text-ink-0 font-semibold">Baslat</span> dokununca bildirim kanali otomatik baglanacak.
                </p>

                {qrSrc && (
                  <div className="flex justify-center">
                    <div className="p-3 bg-white rounded-xl">
                      <img src={qrSrc} alt="QR kod" width={240} height={240} />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-ink-4 font-medium">Ya da linki paylas</label>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={data.url}
                      className="flex-1 px-3 py-2 bg-surface-2/70 border border-white/[0.08] rounded-lg text-ink-1 text-xs font-mono"
                    />
                    <button
                      onClick={copy}
                      className="px-3 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-ink-1 flex items-center gap-1"
                      title="Kopyala"
                    >
                      {copied ? <CheckCircle className="w-4 h-4 text-success-300" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <a
                      href={data.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 bg-brand-500/20 hover:bg-brand-500/30 text-brand-200 rounded-lg flex items-center gap-1"
                      title="Telegram'da ac"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={rotate}
                    disabled={loading}
                    className="text-xs text-ink-3 hover:text-ink-1 flex items-center gap-1 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Linki yenile
                  </button>
                  <p className="text-[10px] text-ink-4">
                    Bu ekran acik iken otomatik kontrol ediliyor...
                  </p>
                </div>
              </div>
            )}

            {!loading && !data && !error && (
              <div className="text-sm text-ink-3 py-6 text-center">
                Bu personel icin link olusturulamadi. Once personeli kaydedin.
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
