import { Clock, CheckCircle, Users } from 'lucide-react';

export default function EmployeeManagementVisual() {
  const shifts = [
    { name: 'Sarah M.', time: '8AM-2PM', status: 'active' },
    { name: 'John D.', time: '2PM-8PM', status: 'scheduled' },
    { name: 'Emma K.', time: '8AM-2PM', status: 'completed' }
  ];

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="relative w-full aspect-square">
      {/* Main Container */}
      <div className="relative w-full h-full bg-gradient-to-br from-blue-500/10 to-blue-600/10 backdrop-blur-sm border border-blue-500/20 rounded-2xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-sm text-blue-300 mb-1">Staff Schedule</div>
            <div className="text-2xl font-bold text-white">This Week</div>
          </div>
          <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
            <Users className="w-6 h-6 text-blue-400" />
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="mb-6">
          <div className="grid grid-cols-7 gap-2 mb-2">
            {days.map((day, i) => (
              <div key={i} className="text-center">
                <div className="text-xs text-gray-400 mb-2">{day}</div>
                <div
                  className={`w-full aspect-square rounded-lg flex items-center justify-center text-xs font-medium transition-all ${
                    i === 2
                      ? 'bg-blue-500/40 text-white border-2 border-blue-400'
                      : i < 2
                      ? 'bg-green-500/20 text-green-300'
                      : 'bg-blue-500/10 text-blue-300'
                  }`}
                >
                  {i + 1}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Today's Shifts */}
        <div className="space-y-3 mb-6">
          {shifts.map((shift, i) => (
            <div
              key={i}
              className="bg-blue-500/10 backdrop-blur-sm border border-blue-500/20 rounded-xl p-3 hover:bg-blue-500/15 transition-all animate-fade-in-up"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {/* Avatar */}
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {shift.name.charAt(0)}
                  </div>

                  {/* Info */}
                  <div>
                    <div className="text-sm font-medium text-white">{shift.name}</div>
                    <div className="flex items-center space-x-1 text-xs text-gray-400">
                      <Clock className="w-3 h-3" />
                      <span>{shift.time}</span>
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div
                  className={`px-3 py-1 rounded-full text-xs font-medium flex items-center space-x-1 ${
                    shift.status === 'active'
                      ? 'bg-green-500/20 text-green-300'
                      : shift.status === 'completed'
                      ? 'bg-gray-500/20 text-gray-400'
                      : 'bg-blue-500/20 text-blue-300'
                  }`}
                >
                  {shift.status === 'active' && (
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  )}
                  {shift.status === 'completed' && <CheckCircle className="w-3 h-3" />}
                  <span className="capitalize">{shift.status}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Stats Footer */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-blue-500/10 backdrop-blur-sm border border-blue-500/20 rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-white">12</div>
            <div className="text-xs text-blue-300">Staff</div>
          </div>
          <div className="bg-blue-500/10 backdrop-blur-sm border border-blue-500/20 rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-white">42h</div>
            <div className="text-xs text-blue-300">This Week</div>
          </div>
          <div className="bg-blue-500/10 backdrop-blur-sm border border-blue-500/20 rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-white">$4.2k</div>
            <div className="text-xs text-blue-300">Payroll</div>
          </div>
        </div>
      </div>
    </div>
  );
}
