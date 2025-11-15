import { useState } from 'react';
import { Check, X, Clock, User, Calendar as CalendarIcon } from 'lucide-react';

interface ShiftRequest {
  id: string;
  userId: string;
  userName: string;
  requestedDate: string;
  requestedStartTime: string;
  requestedEndTime: string;
  reason?: string;
  createdAt: string;
}

interface ManagerApprovalCardProps {
  request: ShiftRequest;
  onApprove: (id: string) => void;
  onDecline: (id: string) => void;
}

export default function ManagerApprovalCard({ request, onApprove, onDecline }: ManagerApprovalCardProps) {
  const [isApproving, setIsApproving] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const handleApprove = () => {
    setIsApproving(true);
    setTimeout(() => {
      onApprove(request.id);
    }, 500);
  };

  const handleDecline = () => {
    setIsDeclining(true);
    setTimeout(() => {
      onDecline(request.id);
    }, 500);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return `${minutes}m ago`;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const startX = touch.clientX;
    setSwipeX(startX);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (swipeX > 100) {
      handleApprove();
    } else if (swipeX < -100) {
      handleDecline();
    }
    setSwipeX(0);
  };

  return (
    <div
      className={`relative overflow-hidden rounded-xl transition-all duration-500 ${
        isApproving ? 'scale-95 opacity-0' : isDeclining ? 'scale-95 opacity-0' : ''
      }`}
      style={{
        transform: `translateX(${swipeX}px)`,
        background: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.3)'
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {isApproving && (
        <div className="absolute inset-0 bg-green-500 flex items-center justify-center z-10 animate-fade-in">
          <Check className="w-16 h-16 text-white animate-scale-in" />
        </div>
      )}

      {isDeclining && (
        <div className="absolute inset-0 bg-red-500 flex items-center justify-center z-10 animate-fade-in">
          <X className="w-16 h-16 text-white animate-scale-in" />
        </div>
      )}

      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-violet-500 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-lg">{request.userName}</p>
              <p className="text-sm text-gray-500">{formatTimeAgo(request.createdAt)}</p>
            </div>
          </div>
          <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold rounded-full">
            PENDING
          </span>
        </div>

        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-3 p-3 bg-white/50 rounded-lg">
            <CalendarIcon className="w-5 h-5 text-blue-600" />
            <div>
              <p className="text-xs text-gray-600 font-medium">Date</p>
              <p className="text-sm font-bold text-gray-900">{formatDate(request.requestedDate)}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-white/50 rounded-lg">
            <Clock className="w-5 h-5 text-violet-600" />
            <div>
              <p className="text-xs text-gray-600 font-medium">Time</p>
              <p className="text-sm font-bold text-gray-900">
                {request.requestedStartTime} - {request.requestedEndTime}
              </p>
            </div>
          </div>

          {request.reason && (
            <div className="p-3 bg-white/50 rounded-lg">
              <p className="text-xs text-gray-600 font-medium mb-1">Reason</p>
              <p className="text-sm text-gray-900">{request.reason}</p>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleDecline}
            disabled={isApproving || isDeclining}
            className="flex-1 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <X className="w-5 h-5" />
            Decline
          </button>
          <button
            onClick={handleApprove}
            disabled={isApproving || isDeclining}
            className="flex-1 px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Check className="w-5 h-5" />
            Approve
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes scale-in {
          from {
            transform: scale(0);
          }
          to {
            transform: scale(1);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }

        .animate-scale-in {
          animation: scale-in 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
      `}</style>
    </div>
  );
}
