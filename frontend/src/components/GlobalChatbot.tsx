import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Send, Sparkles, Wifi, WifiOff, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useLocation } from 'react-router-dom';
import { markdownLiteToHtml } from '../lib/markdownLite';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isError?: boolean;
}

interface AIStatus {
  provider: string;
  ollama: { status: string; model: string | null };
  available: boolean;
  // Stage 6 — true when backend has ENABLE_AI_STREAMING=true AND provider=ollama.
  streamingEnabled?: boolean;
}

/** Generate a short opaque ID — good enough for a per-browser chat conversation. */
function newConversationId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return (crypto as Crypto).randomUUID();
  }
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// 65s — slightly longer than backend OLLAMA_TIMEOUT_MS so user sees the
// backend's structured error (not an abort) when the model is genuinely slow.
const REQUEST_TIMEOUT_MS = 180_000;

export default function GlobalChatbot() {
  const { isAuthenticated } = useAuth();
  const { lang, t } = useLanguage();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = sessionStorage.getItem('chatMessages');
    return saved ? JSON.parse(saved) : [];
  });
  // conversationId persists across sessions (localStorage, not sessionStorage) so
  // the backend can thread follow-ups like "peki cinsiyet dağılımı?" correctly.
  const [conversationId, setConversationId] = useState<string>(() => {
    const existing = localStorage.getItem('chatConversationId');
    if (existing) return existing;
    const fresh = newConversationId();
    localStorage.setItem('chatConversationId', fresh);
    return fresh;
  });
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [thinkingSeconds, setThinkingSeconds] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);
  const [showQuickActions, setShowQuickActions] = useState(true);

  const isDashboard = location.pathname.startsWith('/dashboard');
  const shouldShow = isAuthenticated && isDashboard;

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  const quickActions = [
    { label: t('chatbot.q.visitorCount'), command: t('chatbot.q.visitorCount.cmd') },
    { label: t('chatbot.q.peakHours'), command: t('chatbot.q.peakHours.cmd') },
    { label: t('chatbot.q.demographics'), command: t('chatbot.q.demographics.cmd') },
    { label: t('chatbot.q.weather'), command: t('chatbot.q.weather.cmd') },
    { label: t('chatbot.q.queue'), command: t('chatbot.q.queue.cmd') },
    { label: t('chatbot.q.fewerVisitors'), command: t('chatbot.q.fewerVisitors.cmd') },
  ];

  const fetchAIStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/ai/status`, { credentials: 'include' });
      if (res.ok) setAiStatus(await res.json());
    } catch {
      setAiStatus(null);
    }
  }, [API_URL]);

  useEffect(() => {
    if (isOpen) {
      fetchAIStatus();
      const interval = setInterval(fetchAIStatus, 30000);
      return () => clearInterval(interval);
    }
  }, [isOpen, fetchAIStatus]);

  useEffect(() => {
    sessionStorage.setItem('chatMessages', JSON.stringify(messages.slice(-20)));
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      inputRef.current?.focus();
    }
  }, [messages, isOpen]);

  // Elapsed-time counter so user can see *something* happening during long waits.
  useEffect(() => {
    if (!isSending) { setThinkingSeconds(0); return; }
    const start = Date.now();
    const id = setInterval(() => {
      setThinkingSeconds(Math.floor((Date.now() - start) / 1000));
    }, 250);
    return () => clearInterval(id);
  }, [isSending]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) setIsOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  // Cancel any in-flight request when component unmounts.
  useEffect(() => () => abortRef.current?.abort(), []);

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isSending) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: messageText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsSending(true);

    const loadingId = `${Date.now()}-loading`;
    setMessages(prev => [...prev, {
      id: loadingId,
      type: 'assistant',
      content: '__thinking__',
      timestamp: new Date()
    }]);

    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    // Streaming path is only taken when backend announces streamingEnabled in /status.
    const useStream = aiStatus?.streamingEnabled === true;
    const endpoint = useStream ? '/api/ai/chat/stream' : '/api/ai/chat';

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: messageText, lang, conversationId }),
        signal: controller.signal,
      });

      if (useStream && response.ok && response.body) {
        // SSE path — swap the "__thinking__" placeholder for an empty bubble we
        // append chunks to. We never push a second assistant bubble; we mutate
        // this one in place so the UI looks like a typewriter.
        const assistantId = `${Date.now()}-stream`;
        setMessages(prev => {
          const filtered = prev.filter(m => m.id !== loadingId);
          return [...filtered, {
            id: assistantId,
            type: 'assistant' as const,
            content: '',
            timestamp: new Date(),
          }];
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let errored = false;

        readLoop: while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // SSE event separator is a blank line; split and parse each `data: {...}` entry.
          const events = buffer.split('\n\n');
          buffer = events.pop() ?? '';
          for (const evt of events) {
            const line = evt.split('\n').find(l => l.startsWith('data:'));
            if (!line) continue;
            try {
              const payload = JSON.parse(line.slice(5).trim()) as
                | { type: 'chunk'; content: string }
                | { type: 'done'; model: string; fullResponse: string }
                | { type: 'error'; error: string; errorCode?: string };
              if (payload.type === 'chunk') {
                setMessages(prev => prev.map(m =>
                  m.id === assistantId ? { ...m, content: m.content + payload.content } : m
                ));
              } else if (payload.type === 'error') {
                errored = true;
                setMessages(prev => prev.map(m =>
                  m.id === assistantId ? { ...m, content: payload.error || t('chatbot.unavailable'), isError: true } : m
                ));
                break readLoop;
              } else if (payload.type === 'done') {
                break readLoop;
              }
            } catch {
              // Ignore malformed SSE frames — the stream may recover.
            }
          }
        }

        clearTimeout(timeoutId);
        if (!errored) {
          // No-op: the bubble already has the full text appended chunk-by-chunk.
        }
      } else {
        clearTimeout(timeoutId);

        // Non-streaming JSON path (pre-Stage-6 behaviour).
        const ct = response.headers.get('content-type') || '';
        const data = ct.includes('application/json') ? await response.json().catch(() => ({})) : {};

        let content: string;
        let isError = false;

        if (response.ok && data.message) {
          content = data.message;
        } else {
          isError = true;
          content = data.error || `${t('chatbot.unavailable')} (HTTP ${response.status})`;
        }

        setMessages(prev => {
          const filtered = prev.filter(m => m.id !== loadingId);
          return [...filtered, {
            id: (Date.now() + 1).toString(),
            type: 'assistant' as const,
            content,
            timestamp: new Date(),
            isError,
          }];
        });
      }
    } catch (error) {
      clearTimeout(timeoutId);
      const isAbort = (error as Error)?.name === 'AbortError';
      setMessages(prev => {
        // Remove the thinking placeholder if it's still there (non-streaming path
        // never swapped it out). In the streaming path the id changed already, so
        // this filter simply no-ops for that case.
        const filtered = prev.filter(m => m.id !== loadingId);
        return [...filtered, {
          id: (Date.now() + 1).toString(),
          type: 'assistant' as const,
          content: isAbort ? t('chatbot.timeout') : t('chatbot.connectionError'),
          timestamp: new Date(),
          isError: true,
        }];
      });
    } finally {
      abortRef.current = null;
      setIsSending(false);
    }
  };

  const handleSend = () => sendMessage(input);
  const handleQuickAction = (command: string) => sendMessage(command);

  const handleReset = () => {
    abortRef.current?.abort();
    setMessages([]);
    sessionStorage.removeItem('chatMessages');
    // Rotate conversationId so the next turn starts a fresh context on the backend.
    const fresh = newConversationId();
    localStorage.setItem('chatConversationId', fresh);
    setConversationId(fresh);
    setShowQuickActions(true);
  };

  if (!shouldShow) return null;

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 z-50 w-14 h-14 bg-gradient-to-br from-violet-500 via-brand-500 to-accent-500 text-white rounded-full shadow-glow-brand hover:scale-105 transition-transform flex items-center justify-center cursor-pointer ring-1 ring-white/15"
          aria-label={t('chatbot.openLabel')}
          data-testid="chatbot-toggle"
        >
          <Sparkles className="w-6 h-6" />
        </button>
      )}

      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            onClick={() => setIsOpen(false)}
          />
          <div
            role="dialog"
            aria-label="AI Chatbot"
            className="fixed bottom-4 right-4 w-full sm:w-96 h-[600px] max-h-[calc(100vh-2rem)] surface-card-elevated z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-gradient-to-r from-violet-500/10 via-brand-500/10 to-accent-500/10 rounded-t-2xl">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-violet-500 via-brand-500 to-accent-500 rounded-full flex items-center justify-center ring-1 ring-white/15">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-ink-1">{t('chatbot.title')}</h2>
                  <div className="flex items-center gap-1.5">
                    {aiStatus ? (
                      aiStatus.available ? (
                        <>
                          <Wifi className="w-3 h-3 text-success-400" />
                          <p className="text-xs text-success-300">
                            {aiStatus.ollama.status === 'online'
                              ? `Ollama (${aiStatus.ollama.model || 'connected'})`
                              : t('chatbot.usingFallback')}
                          </p>
                        </>
                      ) : (
                        <>
                          <WifiOff className="w-3 h-3 text-danger-400" />
                          <p className="text-xs text-danger-300">{t('chatbot.aiOffline')}</p>
                        </>
                      )
                    ) : (
                      <p className="text-xs text-ink-3">{t('chatbot.subtitle')}</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    onClick={handleReset}
                    className="p-1 text-ink-3 hover:text-ink-1 hover:bg-white/10 rounded transition-colors"
                    aria-label={t('chatbot.newChat')}
                    title={t('chatbot.newChat')}
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-ink-3 hover:text-ink-1 hover:bg-white/10 rounded transition-colors"
                  aria-label={t('common.close')}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {messages.length === 0 && (
                <div className="text-center py-6">
                  <div className="w-14 h-14 bg-gradient-to-br from-violet-500/20 via-brand-500/20 to-accent-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-brand-500/30">
                    <Sparkles className="w-7 h-7 text-brand-300" />
                  </div>
                  <p className="text-sm font-medium text-ink-1 mb-1">{t('chatbot.empty.title')}</p>
                  <p className="text-xs text-ink-3 mb-4">{t('chatbot.empty.subtitle')}</p>
                </div>
              )}

              {messages.map(message => {
                const isThinking = message.content === '__thinking__';
                return (
                  <div
                    key={message.id}
                    className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap shadow-sm ${
                        message.type === 'user'
                          ? 'bg-brand-600 text-white rounded-br-sm'
                          : message.isError
                            ? 'bg-danger-500/10 text-danger-200 border border-danger-500/30 rounded-bl-sm'
                            : 'bg-white/5 text-ink-2 border border-white/[0.06] rounded-bl-sm'
                      }`}
                    >
                      {isThinking ? (
                        <span className="inline-flex items-center gap-2 text-ink-3">
                          <span className="flex gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" style={{ animationDelay: '0ms' }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" style={{ animationDelay: '150ms' }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" style={{ animationDelay: '300ms' }} />
                          </span>
                          <span className="text-xs">{t('chatbot.thinking')} {thinkingSeconds}s</span>
                        </span>
                      ) : message.type === 'assistant' && !message.isError ? (
                        // Yan #56: assistant replies often contain **bold** / *italic* /
                        // line breaks. markdownLiteToHtml HTML-escapes the content first
                        // (XSS guard) and then promotes only those three markers.
                        <p
                          className="markdown-lite"
                          dangerouslySetInnerHTML={{ __html: markdownLiteToHtml(message.content) }}
                        />
                      ) : (
                        <p>{message.content}</p>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Actions */}
            <div className="border-t border-white/10">
              <button
                onClick={() => setShowQuickActions(prev => !prev)}
                className="w-full flex items-center justify-between px-4 py-2 text-xs text-ink-3 hover:text-ink-2 hover:bg-white/5 transition-colors"
              >
                <span>{t('chatbot.quickQuestions')}</span>
                {showQuickActions ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
              </button>
              {showQuickActions && (
                <div className="px-3 pb-2 flex flex-wrap gap-1.5">
                  {quickActions.map((action, index) => (
                    <button
                      key={index}
                      onClick={() => handleQuickAction(action.command)}
                      disabled={isSending}
                      className="px-2.5 py-1 bg-white/5 text-ink-3 text-[11px] rounded-full hover:bg-brand-500/20 hover:text-brand-200 transition-colors border border-white/5 disabled:opacity-40"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-white/10">
              <form
                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                className="flex space-x-2"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={t('chatbot.placeholder')}
                  className="flex-1 px-4 py-2 bg-surface-2/50 border border-white/10 rounded-lg text-sm text-ink-1 placeholder-ink-4 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isSending}
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </>
      )}
    </>
  );
}
