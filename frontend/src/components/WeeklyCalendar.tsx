import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';

interface Shift {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'approved' | 'pending' | 'declined';
  shiftType: 'opening' | 'mid' | 'closing';
}

interface WeeklyCalendarProps {
  shifts: Shift[];
  onRequestShift: (date: string) => void;
}

export default function WeeklyCalendar({ shifts, onRequestShift }: WeeklyCalendarProps) {
  const [currentWeek, setCurrentWeek] = useState(new Date());

  const getWeekDates = (date: Date) => {
    const week = [];
    const first = date.getDate() - date.getDay() + 1;

    for (let i = 0; i < 7; i++) {
      const day = new Date(date);
      day.setDate(first + i);
      week.push(day);
    }
    return week;
  };

  const weekDates = getWeekDates(currentWeek);
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const goToPreviousWeek = () => {
    const newDate = new Date(currentWeek);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentWeek(newDate);
  };

  const goToNextWeek = () => {
    const newDate = new Date(currentWeek);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentWeek(newDate);
  };

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const getShiftsForDate = (date: Date) => {
    const dateStr = formatDate(date);
    return shifts.filter(shift => shift.date === dateStr);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 border-green-300 text-green-800';
      case 'pending':
        return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      case 'declined':
        return 'bg-red-100 border-red-300 text-red-800';
      default:
        return 'bg-gray-100 border-gray-300 text-gray-800';
    }
  };

  const formatWeekRange = () => {
    const start = weekDates[0];
    const end = weekDates[6];
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Week of {formatWeekRange()}</h2>
          <p className="text-sm text-gray-600 mt-1">View and manage your weekly schedule</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={goToPreviousWeek}
            className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-700" />
          </button>
          <button
            onClick={() => setCurrentWeek(new Date())}
            className="px-4 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors text-sm font-semibold text-gray-700"
          >
            Today
          </button>
          <button
            onClick={goToNextWeek}
            className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-700" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-4">
        {weekDates.map((date, index) => {
          const dayShifts = getShiftsForDate(date);
          const isToday = formatDate(date) === formatDate(new Date());
          const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));

          return (
            <div
              key={index}
              className={`glass-card rounded-xl border-2 overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-xl ${
                isToday ? 'border-blue-400 ring-2 ring-blue-200' : 'border-white/30'
              } ${isPast ? 'opacity-60' : ''}`}
              style={{
                background: 'rgba(255, 255, 255, 0.7)',
                backdropFilter: 'blur(10px)',
                animationDelay: `${index * 50}ms`
              }}
            >
              <div className={`p-3 text-center ${isToday ? 'bg-blue-600 text-white' : 'bg-white/50 text-gray-900'}`}>
                <p className="text-xs font-semibold uppercase tracking-wide">{weekDays[index]}</p>
                <p className="text-2xl font-bold mt-1">{date.getDate()}</p>
              </div>

              <div className="p-3 space-y-2 min-h-[200px]">
                {dayShifts.length > 0 ? (
                  dayShifts.map((shift) => (
                    <div
                      key={shift.id}
                      className={`p-3 rounded-lg border-2 ${getStatusColor(shift.status)} shift-card-animate`}
                      style={{
                        backdropFilter: 'blur(5px)'
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wide">
                          {shift.shiftType}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                          shift.status === 'approved' ? 'bg-green-200' :
                          shift.status === 'pending' ? 'bg-yellow-200' :
                          'bg-red-200'
                        }`}>
                          {shift.status}
                        </span>
                      </div>
                      <p className="text-sm font-bold">
                        {shift.startTime} - {shift.endTime}
                      </p>
                    </div>
                  ))
                ) : (
                  <button
                    onClick={() => onRequestShift(formatDate(date))}
                    disabled={isPast}
                    className={`w-full h-32 rounded-lg border-2 border-dashed transition-all duration-200 ${
                      isPast
                        ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                        : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/50 cursor-pointer group'
                    }`}
                  >
                    {!isPast && (
                      <div className="flex flex-col items-center justify-center">
                        <Plus className="w-8 h-8 text-gray-400 group-hover:text-blue-600 transition-colors" />
                        <p className="text-xs text-gray-500 group-hover:text-blue-600 mt-2 font-medium">
                          Request Shift
                        </p>
                      </div>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes shift-card-slide {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .shift-card-animate {
          animation: shift-card-slide 0.3s ease-out;
        }

        .glass-card {
          animation: fade-in-up 0.5s ease-out forwards;
          opacity: 0;
        }

        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
