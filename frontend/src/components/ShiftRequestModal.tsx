import { useState } from 'react';
import { X, Clock, Calendar as CalendarIcon, CheckCircle } from 'lucide-react';

interface ShiftRequestModalProps {
  selectedDate: string;
  onClose: () => void;
  onSubmit: (date: string, startTime: number, endTime: number, reason: string) => void;
}

export default function ShiftRequestModal({ selectedDate, onClose, onSubmit }: ShiftRequestModalProps) {
  const [startTime, setStartTime] = useState(9);
  const [endTime, setEndTime] = useState(17);
  const [reason, setReason] = useState('');
  const [shiftType, setShiftType] = useState<'opening' | 'mid' | 'closing'>('mid');
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = () => {
    onSubmit(selectedDate, startTime, endTime, reason);
    setShowSuccess(true);
    setTimeout(() => {
      onClose();
    }, 2000);
  };

  const formatTime = (hour: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:00 ${period}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  const duration = endTime - startTime;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {showSuccess && (
          <div className="absolute inset-0 z-10 bg-white/95 backdrop-blur-sm flex items-center justify-center">
            <div className="text-center animate-fade-in">
              <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-scale-in">
                <CheckCircle className="w-12 h-12 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Request Submitted!</h3>
              <p className="text-gray-600">Your manager will review your shift request.</p>
            </div>
          </div>
        )}

        <div className="bg-gradient-to-r from-blue-600 to-violet-600 p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <CalendarIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Request Shift</h2>
              <p className="text-blue-100 text-sm">{formatDate(selectedDate)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Shift Type
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(['opening', 'mid', 'closing'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setShiftType(type)}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    shiftType === type
                      ? 'border-blue-600 bg-blue-50 text-blue-900 shadow-lg scale-105'
                      : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700'
                  }`}
                >
                  <p className="text-sm font-bold capitalize">{type}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Time Range
            </label>
            <div className="glass-slider-container rounded-xl p-6" style={{
              background: 'rgba(59, 130, 246, 0.05)',
              border: '1px solid rgba(59, 130, 246, 0.2)'
            }}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-xs text-gray-600 font-medium">Start Time</p>
                    <p className="text-2xl font-bold text-gray-900">{formatTime(startTime)}</p>
                  </div>
                </div>
                <div className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold">
                  {duration}h
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs text-gray-600 font-medium">End Time</p>
                    <p className="text-2xl font-bold text-gray-900">{formatTime(endTime)}</p>
                  </div>
                  <Clock className="w-5 h-5 text-blue-600" />
                </div>
              </div>

              <div className="relative">
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full transition-all duration-300"
                    style={{
                      marginLeft: `${(startTime / 24) * 100}%`,
                      width: `${((endTime - startTime) / 24) * 100}%`
                    }}
                  />
                </div>

                <div className="relative mt-2">
                  <input
                    type="range"
                    min="0"
                    max="24"
                    value={startTime}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (val < endTime - 1) setStartTime(val);
                    }}
                    className="time-slider absolute w-full"
                    style={{ zIndex: 2 }}
                  />
                  <input
                    type="range"
                    min="0"
                    max="24"
                    value={endTime}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (val > startTime + 1) setEndTime(val);
                    }}
                    className="time-slider absolute w-full"
                    style={{ zIndex: 1 }}
                  />
                </div>

                <div className="flex justify-between mt-8 text-xs text-gray-500 font-medium">
                  <span>12 AM</span>
                  <span>6 AM</span>
                  <span>12 PM</span>
                  <span>6 PM</span>
                  <span>12 AM</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Reason (Optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Add any notes or reason for this shift request..."
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all resize-none"
              rows={3}
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 border-2 border-gray-200 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-violet-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all transform hover:scale-105"
            >
              Submit Request
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .time-slider {
          -webkit-appearance: none;
          appearance: none;
          height: 40px;
          background: transparent;
          cursor: pointer;
        }

        .time-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 24px;
          height: 24px;
          background: white;
          border: 3px solid rgb(59, 130, 246);
          border-radius: 50%;
          cursor: grab;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          transition: all 0.2s;
        }

        .time-slider::-webkit-slider-thumb:hover {
          transform: scale(1.2);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        }

        .time-slider::-webkit-slider-thumb:active {
          cursor: grabbing;
          transform: scale(1.1);
        }

        .time-slider::-moz-range-thumb {
          width: 24px;
          height: 24px;
          background: white;
          border: 3px solid rgb(59, 130, 246);
          border-radius: 50%;
          cursor: grab;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          transition: all 0.2s;
        }

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
