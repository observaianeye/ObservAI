import { useState, useEffect, useRef } from 'react';
import { X, Send, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from 'react-router-dom';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const quickActions = [
  'Explain KPI deltas',
  'Suggest staffing',
  'Find anomalies'
];

const demoResponses: Record<string, string> = {
  'explain kpi deltas': 'Your AOV decreased by 8% this week primarily due to increased single-item orders during afternoon hours (2-4 PM). Consider promoting combo deals during this timeframe.',
  'suggest staffing': 'Based on traffic patterns, I recommend adding 1 barista during peak hours (12-2 PM) and reducing evening staff by 1 person after 7 PM to optimize labor costs.',
  'find anomalies': 'I detected 3 anomalies: 1) Milk costs up 15% this week, 2) Queue times spiking at 2 PM daily, 3) Oat milk inventory critically low (<15%).',
  'why is aov down today': 'AOV is down 8% today due to increased single-item purchases and fewer combo orders. Morning rush shows normal patterns, but afternoon sales lack upsells.',
  'default': 'I can help you understand your data better. Try asking about specific KPIs, staffing needs, or anomalies in your operations.'
};

// Collision detection utility
function checkCollision(pos1: { x: number; y: number }, pos2: { x: number; y: number }, size: number = 64, margin: number = 10) {
  const distance = Math.sqrt(Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2));
  return distance < (size + margin);
}

export default function GlobalChatbot() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = sessionStorage.getItem('chatMessages');
    return saved ? JSON.parse(saved) : [];
  });
  const [input, setInput] = useState('');
  const [position, setPosition] = useState(() => {
    const saved = localStorage.getItem('chatbotPosition');
    return saved ? JSON.parse(saved) : { x: window.innerWidth - 90, y: window.innerHeight - 90 };
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [hasDragged, setHasDragged] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isDashboard = location.pathname.startsWith('/dashboard');
  const shouldShow = isAuthenticated && isDashboard;

  if (!shouldShow) return null;

  useEffect(() => {
    sessionStorage.setItem('chatMessages', JSON.stringify(messages.slice(-20)));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('chatbotPosition', JSON.stringify(position));
    // Broadcast position change for collision detection
    window.dispatchEvent(new CustomEvent('chatbotPositionChange', { detail: position }));
  }, [position]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      inputRef.current?.focus();
    }
  }, [messages, isOpen]);

  // Listen for alerts position to avoid collision
  useEffect(() => {
    const handleAlertsPosition = (e: Event) => {
      const customEvent = e as CustomEvent;
      const alertsPos = customEvent.detail;
      if (checkCollision(position, alertsPos)) {
        // Move chatbot to avoid collision
        setPosition({ x: window.innerWidth - 90, y: window.innerHeight - 170 });
      }
    };
    window.addEventListener('alertsPositionChange', handleAlertsPosition);
    return () => window.removeEventListener('alertsPositionChange', handleAlertsPosition);
  }, [position]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isOpen) return; // Don't drag when panel is open
    e.preventDefault();
    setHasDragged(false);
    setDragStartPos({ x: e.clientX, y: e.clientY });
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (dragStartPos.x === 0 && dragStartPos.y === 0) return;

      const distanceMoved = Math.sqrt(
        Math.pow(e.clientX - dragStartPos.x, 2) +
        Math.pow(e.clientY - dragStartPos.y, 2)
      );

      if (distanceMoved > 5 && !hasDragged) {
        setIsDragging(true);
        setHasDragged(true);
      }

      if (isDragging) {
        const newX = Math.max(0, Math.min(e.clientX - dragOffset.x, window.innerWidth - 64));
        const newY = Math.max(0, Math.min(e.clientY - dragOffset.y, window.innerHeight - 64));
        setPosition({ x: newX, y: newY });
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        setDragStartPos({ x: 0, y: 0 });
      }
    };

    if (dragStartPos.x !== 0 || dragStartPos.y !== 0) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, dragStartPos, hasDragged]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');

    setTimeout(() => {
      const responseKey = input.toLowerCase();
      const response = Object.keys(demoResponses).find(key =>
        responseKey.includes(key)
      ) || 'default';

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: demoResponses[response],
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    }, 1000);
  };

  const handleQuickAction = (action: string) => {
    setInput(action);
    setTimeout(() => handleSend(), 100);
  };

  const handleClick = () => {
    if (!hasDragged) {
      setIsOpen(!isOpen);
    }
    setHasDragged(false);
  };

  return (
    <>
      {!isOpen && (
        <button
          onMouseDown={handleMouseDown}
          onClick={handleClick}
          style={{ left: `${position.x}px`, top: `${position.y}px` }}
          className={`fixed z-50 w-14 h-14 bg-gradient-to-br from-purple-600 to-blue-600 text-white rounded-full shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center ${
            isDragging ? 'cursor-grabbing' : 'cursor-pointer'
          }`}
          aria-label="AI Assistant"
        >
          <Sparkles className="w-6 h-6" />
        </button>
      )}

      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div
            role="dialog"
            aria-label="AI Chatbot"
            className="fixed bottom-4 right-4 w-full sm:w-96 h-[600px] max-h-[calc(100vh-2rem)] bg-white rounded-xl shadow-2xl z-50 flex flex-col border border-gray-200"
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">ObservAI Assistant</h2>
                  <p className="text-xs text-gray-600">Always here to help</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                aria-label="Close chat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-8 h-8 text-purple-600" />
                  </div>
                  <p className="text-sm font-medium text-gray-900 mb-2">Hi! I'm your AI assistant</p>
                  <p className="text-xs text-gray-600 mb-4">Ask me anything about your data</p>

                  <div className="space-y-2">
                    {quickActions.map((action, index) => (
                      <button
                        key={index}
                        onClick={() => handleQuickAction(action)}
                        className="w-full px-3 py-2 bg-gray-50 text-gray-900 text-xs font-medium rounded-lg hover:bg-gray-100 transition-colors text-left"
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map(message => (
                  <div
                    key={message.id}
                    className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        message.type === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-gray-200">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex space-x-2"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about today's data…"
                  className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
