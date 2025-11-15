import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Shift {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'approved' | 'pending' | 'declined';
}

interface MonthlyHeatmapProps {
  shifts: Shift[];
  onDayClick: (date: string) => void;
}

export default function MonthlyHeatmap({ shifts, onDayClick }: MonthlyHeatmapProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const getShiftCountForDate = (date: Date | null) => {
    if (!date) return 0;
    const dateStr = formatDate(date);
    return shifts.filter(shift => shift.date === dateStr).length;
  };

  const getIntensityColor = (count: number) => {
    if (count === 0) return 'bg-gray-100';
    if (count === 1) return 'bg-blue-200';
    if (count === 2) return 'bg-blue-400';
    return 'bg-blue-600';
  };

  const getShiftsForDate = (date: Date | null) => {
    if (!date) return [];
    const dateStr = formatDate(date);
    return shifts.filter(shift => shift.date === dateStr);
  };

  const monthDays = getDaysInMonth(currentMonth);
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">
          {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={goToPreviousMonth}
            className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-700" />
          </button>
          <button
            onClick={() => setCurrentMonth(new Date())}
            className="px-4 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors text-sm font-semibold text-gray-700"
          >
            This Month
          </button>
          <button
            onClick={goToNextMonth}
            className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-700" />
          </button>
        </div>
      </div>

      <div
        className="glass-card rounded-2xl p-6"
        style={{
          background: 'rgba(255, 255, 255, 0.7)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.3)'
        }}
      >
        <div className="grid grid-cols-7 gap-2 mb-4">
          {weekDays.map((day) => (
            <div key={day} className="text-center text-sm font-bold text-gray-600 py-2">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {monthDays.map((date, index) => {
            if (!date) {
              return <div key={`empty-${index}`} className="aspect-square" />;
            }

            const dateStr = formatDate(date);
            const shiftCount = getShiftCountForDate(date);
            const dayShifts = getShiftsForDate(date);
            const isToday = dateStr === formatDate(new Date());
            const isHovered = hoveredDay === dateStr;

            return (
              <div
                key={index}
                className="relative aspect-square"
                onMouseEnter={() => setHoveredDay(dateStr)}
                onMouseLeave={() => setHoveredDay(null)}
              >
                <button
                  onClick={() => onDayClick(dateStr)}
                  className={`w-full h-full rounded-xl ${getIntensityColor(shiftCount)} transition-all duration-200 hover:scale-110 hover:shadow-lg ${
                    isToday ? 'ring-2 ring-blue-600 ring-offset-2' : ''
                  }`}
                >
                  <div className="flex flex-col items-center justify-center h-full">
                    <span className={`text-lg font-bold ${shiftCount > 2 ? 'text-white' : 'text-gray-900'}`}>
                      {date.getDate()}
                    </span>
                    {shiftCount > 0 && (
                      <span className={`text-xs font-semibold mt-1 ${shiftCount > 2 ? 'text-white/90' : 'text-gray-700'}`}>
                        {shiftCount} shift{shiftCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </button>

                {isHovered && dayShifts.length > 0 && (
                  <div
                    className="absolute z-10 bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 bg-black/90 backdrop-blur-xl rounded-xl p-4 shadow-2xl animate-fade-in"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 rotate-45 w-3 h-3 bg-black/90" />
                    <p className="text-white font-bold text-sm mb-3">
                      {date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                    </p>
                    <div className="space-y-2">
                      {dayShifts.map((shift) => (
                        <div
                          key={shift.id}
                          className={`p-2 rounded-lg ${
                            shift.status === 'approved' ? 'bg-green-500/20 border border-green-500/30' :
                            shift.status === 'pending' ? 'bg-yellow-500/20 border border-yellow-500/30' :
                            'bg-red-500/20 border border-red-500/30'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-white text-sm font-semibold">
                              {shift.startTime} - {shift.endTime}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                              shift.status === 'approved' ? 'bg-green-400 text-green-900' :
                              shift.status === 'pending' ? 'bg-yellow-400 text-yellow-900' :
                              'bg-red-400 text-red-900'
                            }`}>
                              {shift.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-center gap-6 mt-6 pt-6 border-t border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gray-100 rounded" />
            <span className="text-sm text-gray-600 font-medium">No shifts</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-200 rounded" />
            <span className="text-sm text-gray-600 font-medium">1 shift</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-400 rounded" />
            <span className="text-sm text-gray-600 font-medium">2 shifts</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-600 rounded" />
            <span className="text-sm text-gray-600 font-medium">3+ shifts</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translate(-50%, -10px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
