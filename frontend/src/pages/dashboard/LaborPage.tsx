import { useState } from 'react';
import { Users, Clock, DollarSign, TrendingUp, CheckCircle } from 'lucide-react';
import ManagerApprovalCard from '../../components/ManagerApprovalCard';

const laborKpis = [
  { label: 'Total Labor Cost', value: '$12,450', change: '+3.2%', icon: DollarSign },
  { label: 'Total Hours', value: '1,847', change: '+5.1%', icon: Clock },
  { label: 'Labor Cost %', value: '27.5%', change: '-1.2%', icon: TrendingUp },
  { label: 'Active Staff', value: '23', change: '+2', icon: Users }
];

const staffPerformance = [
  { name: 'Sarah Martinez', role: 'Barista', hours: 168, sales: '$8,430', efficiency: 95 },
  { name: 'John Davis', role: 'Barista', hours: 165, sales: '$7,890', efficiency: 92 },
  { name: 'Emma Kim', role: 'Server', hours: 160, sales: '$6,540', efficiency: 88 },
  { name: 'Michael Chen', role: 'Manager', hours: 172, sales: '$9,120', efficiency: 96 },
  { name: 'Lisa Johnson', role: 'Barista', hours: 158, sales: '$6,230', efficiency: 85 }
];

const demoRequests = [
  {
    id: '1',
    userId: '1',
    userName: 'Sarah Martinez',
    requestedDate: '2025-10-22',
    requestedStartTime: '09:00',
    requestedEndTime: '17:00',
    reason: 'Need this shift for extra hours',
    createdAt: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: '2',
    userId: '2',
    userName: 'John Davis',
    requestedDate: '2025-10-23',
    requestedStartTime: '13:00',
    requestedEndTime: '21:00',
    reason: 'Available for evening shift',
    createdAt: new Date(Date.now() - 7200000).toISOString()
  },
  {
    id: '3',
    userId: '3',
    userName: 'Emma Kim',
    requestedDate: '2025-10-24',
    requestedStartTime: '10:00',
    requestedEndTime: '18:00',
    createdAt: new Date(Date.now() - 10800000).toISOString()
  }
];

export default function LaborPage() {
  const [shiftRequests, setShiftRequests] = useState(demoRequests);

  const handleApprove = (id: string) => {
    setShiftRequests(requests => requests.filter(r => r.id !== id));
  };

  const handleDecline = (id: string) => {
    setShiftRequests(requests => requests.filter(r => r.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Labor Management</h1>
          <p className="text-sm text-gray-600 mt-1">Monitor staff performance, hours, and labor costs</p>
        </div>
        {shiftRequests.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-yellow-100 rounded-lg border border-yellow-300">
            <CheckCircle className="w-5 h-5 text-yellow-700" />
            <span className="text-sm font-semibold text-yellow-900">
              {shiftRequests.length} Pending Request{shiftRequests.length > 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {laborKpis.map((kpi, index) => {
          const Icon = kpi.icon;

          return (
            <div key={index} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
                  <Icon className="w-6 h-6 text-purple-600" />
                </div>
                <span className="text-xs font-medium text-gray-600">{kpi.change}</span>
              </div>
              <div className="text-2xl font-semibold text-gray-900 mb-1">{kpi.value}</div>
              <div className="text-sm text-gray-600">{kpi.label}</div>
            </div>
          );
        })}
      </div>

      {shiftRequests.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Pending Shift Requests</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {shiftRequests.map(request => (
              <ManagerApprovalCard
                key={request.id}
                request={request}
                onApprove={handleApprove}
                onDecline={handleDecline}
              />
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Staff Performance</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 text-xs font-semibold text-gray-700">Name</th>
                  <th className="text-left py-3 text-xs font-semibold text-gray-700">Role</th>
                  <th className="text-right py-3 text-xs font-semibold text-gray-700">Hours</th>
                  <th className="text-right py-3 text-xs font-semibold text-gray-700">Sales</th>
                  <th className="text-right py-3 text-xs font-semibold text-gray-700">Efficiency</th>
                </tr>
              </thead>
              <tbody>
                {staffPerformance.map((staff, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                          {staff.name.charAt(0)}
                        </div>
                        <span className="text-sm font-medium text-gray-900">{staff.name}</span>
                      </div>
                    </td>
                    <td className="py-4 text-sm text-gray-600">{staff.role}</td>
                    <td className="py-4 text-sm text-gray-900 text-right">{staff.hours}h</td>
                    <td className="py-4 text-sm text-gray-900 text-right">{staff.sales}</td>
                    <td className="py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full"
                            style={{ width: `${staff.efficiency}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-900 w-10">{staff.efficiency}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Hours Breakdown</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">Regular Hours</span>
                <span className="font-medium text-gray-900">1,520h</span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full" style={{ width: '82%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">Overtime</span>
                <span className="font-medium text-gray-900">247h</span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: '13%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">Break Time</span>
                <span className="font-medium text-gray-900">80h</span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-gray-400 rounded-full" style={{ width: '5%' }} />
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-purple-50 rounded-lg">
            <p className="text-xs font-medium text-purple-900 mb-1">Labor Efficiency</p>
            <p className="text-2xl font-semibold text-purple-700">91.3%</p>
            <p className="text-xs text-purple-600 mt-1">Above target by 3.3%</p>
          </div>
        </div>
      </div>
    </div>
  );
}
