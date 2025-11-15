import { useState } from 'react';
import { Calendar, Clock, CheckCircle2, XCircle, AlertCircle, Grid3x3, CalendarDays } from 'lucide-react';
import WeeklyCalendar from '../../components/WeeklyCalendar';
import MonthlyHeatmap from '../../components/MonthlyHeatmap';
import ShiftRequestModal from '../../components/ShiftRequestModal';

type ShiftStatus = 'approved' | 'pending' | 'rejected';

interface ShiftRequest {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: ShiftStatus;
  hours: number;
}

const demoShifts: ShiftRequest[] = [
  { id: '1', date: '2025-10-16', startTime: '09:00', endTime: '17:00', status: 'approved', hours: 8 },
  { id: '2', date: '2025-10-17', startTime: '09:00', endTime: '17:00', status: 'approved', hours: 8 },
  { id: '3', date: '2025-10-18', startTime: '13:00', endTime: '21:00', status: 'approved', hours: 8 },
  { id: '4', date: '2025-10-19', startTime: '09:00', endTime: '13:00', status: 'pending', hours: 4 },
  { id: '5', date: '2025-10-20', startTime: '09:00', endTime: '17:00', status: 'approved', hours: 8 }
];

const statusConfig = {
  approved: { color: 'bg-green-50 text-green-700 border-green-200', icon: CheckCircle2, label: 'Approved' },
  pending: { color: 'bg-amber-50 text-amber-700 border-amber-200', icon: AlertCircle, label: 'Pending' },
  rejected: { color: 'bg-red-50 text-red-700 border-red-200', icon: XCircle, label: 'Rejected' }
};

export default function MyShiftsPage() {
  const [shifts, setShifts] = useState<ShiftRequest[]>(demoShifts);
  const [selectedDate, setSelectedDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestDate, setRequestDate] = useState('');

  const handleSubmitRequest = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedDate || !startTime || !endTime) return;

    const start = new Date(`${selectedDate}T${startTime}`);
    const end = new Date(`${selectedDate}T${endTime}`);
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

    const newShift: ShiftRequest = {
      id: Date.now().toString(),
      date: selectedDate,
      startTime,
      endTime,
      status: 'pending',
      hours
    };

    setShifts([...shifts, newShift].sort((a, b) => a.date.localeCompare(b.date)));
    setSelectedDate('');
    setStartTime('');
    setEndTime('');
  };

  const handleRequestShift = (date: string) => {
    setRequestDate(date);
    setShowRequestModal(true);
  };

  const handleShiftSubmit = (date: string, start: number, end: number, reason: string) => {
    const newShift: ShiftRequest = {
      id: Date.now().toString(),
      date: date,
      startTime: `${start.toString().padStart(2, '0')}:00`,
      endTime: `${end.toString().padStart(2, '0')}:00`,
      status: 'pending',
      hours: end - start
    };
    setShifts([...shifts, newShift].sort((a, b) => a.date.localeCompare(b.date)));
  };

  const handleDayClick = (date: string) => {
    handleRequestShift(date);
  };

  const totalHours = shifts
    .filter(s => s.status === 'approved')
    .reduce((sum, s) => sum + s.hours, 0);

  const pendingRequests = shifts.filter(s => s.status === 'pending').length;

  const calendarShifts = shifts.map(shift => ({
    id: shift.id,
    date: shift.date,
    startTime: shift.startTime,
    endTime: shift.endTime,
    status: shift.status as 'approved' | 'pending' | 'declined',
    shiftType: 'mid' as 'opening' | 'mid' | 'closing'
  }));

  return (
    <div className="space-y-6">
      {showRequestModal && (
        <ShiftRequestModal
          selectedDate={requestDate}
          onClose={() => setShowRequestModal(false)}
          onSubmit={handleShiftSubmit}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">My Shifts</h1>
          <p className="text-sm text-gray-600 mt-1">Request shift changes and view your schedule</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('week')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${
              viewMode === 'week'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            <Grid3x3 className="w-4 h-4" />
            Week
          </button>
          <button
            onClick={() => setViewMode('month')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${
              viewMode === 'month'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            Month
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Hours</p>
              <p className="text-2xl font-semibold text-gray-900">{totalHours}h</p>
            </div>
          </div>
          <p className="text-xs text-gray-500">Approved shifts this period</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Approved Shifts</p>
              <p className="text-2xl font-semibold text-gray-900">
                {shifts.filter(s => s.status === 'approved').length}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-500">Confirmed by manager</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-amber-50 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending Requests</p>
              <p className="text-2xl font-semibold text-gray-900">{pendingRequests}</p>
            </div>
          </div>
          <p className="text-xs text-gray-500">Awaiting manager approval</p>
        </div>
      </div>

      {viewMode === 'week' ? (
        <WeeklyCalendar shifts={calendarShifts} onRequestShift={handleRequestShift} />
      ) : (
        <MonthlyHeatmap shifts={calendarShifts} onDayClick={handleDayClick} />
      )}
    </div>
  );
}
