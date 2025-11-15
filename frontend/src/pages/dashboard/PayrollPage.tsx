import { useState } from 'react';
import { DollarSign, Clock, TrendingUp, Download, Calendar, Users, Filter, Mail, FileDown } from 'lucide-react';
import GlassLineChart from '../../components/charts/GlassLineChart';
import GlassDonutChart from '../../components/charts/GlassDonutChart';

interface PayPeriod {
  id: string;
  startDate: string;
  endDate: string;
  regularHours: number;
  regularRate: number;
  overtimeHours: number;
  overtimeRate: number;
  tips: number;
  bonuses: number;
  grossPay: number;
  deductions: number;
  netPay: number;
  status: 'paid' | 'pending' | 'processing';
}

interface Employee {
  id: string;
  name: string;
  position: string;
  department: string;
  hoursWorked: number;
  grossPay: number;
  netPay: number;
  status: 'paid' | 'pending' | 'processing';
}

const demoPayPeriods: PayPeriod[] = [
  {
    id: '1',
    startDate: '2025-10-01',
    endDate: '2025-10-15',
    regularHours: 80,
    regularRate: 18.50,
    overtimeHours: 4,
    overtimeRate: 27.75,
    tips: 145,
    bonuses: 100,
    grossPay: 1735,
    deductions: 208,
    netPay: 1527,
    status: 'pending'
  },
  {
    id: '2',
    startDate: '2025-09-16',
    endDate: '2025-09-30',
    regularHours: 80,
    regularRate: 18.50,
    overtimeHours: 2,
    overtimeRate: 27.75,
    tips: 132,
    bonuses: 50,
    grossPay: 1717.5,
    deductions: 206,
    netPay: 1511.5,
    status: 'paid'
  },
  {
    id: '3',
    startDate: '2025-09-01',
    endDate: '2025-09-15',
    regularHours: 82,
    regularRate: 18.50,
    overtimeHours: 0,
    overtimeRate: 27.75,
    tips: 156,
    bonuses: 0,
    grossPay: 1673,
    deductions: 201,
    netPay: 1472,
    status: 'paid'
  }
];

const demoEmployees: Employee[] = [
  { id: '1', name: 'Sarah Martinez', position: 'Barista', department: 'Front Counter', hoursWorked: 84, grossPay: 1590, netPay: 1380, status: 'paid' },
  { id: '2', name: 'John Davis', position: 'Server', department: 'Dining', hoursWorked: 80, grossPay: 1520, netPay: 1320, status: 'pending' },
  { id: '3', name: 'Emma Kim', position: 'Manager', department: 'Management', hoursWorked: 88, grossPay: 2640, netPay: 2240, status: 'paid' },
  { id: '4', name: 'Michael Chen', position: 'Barista', department: 'Front Counter', hoursWorked: 78, grossPay: 1480, netPay: 1285, status: 'processing' },
  { id: '5', name: 'Lisa Johnson', position: 'Server', department: 'Dining', hoursWorked: 82, grossPay: 1558, netPay: 1354, status: 'paid' }
];

const statusConfig = {
  paid: { color: 'bg-green-100 text-green-800 border-green-300', label: 'Paid' },
  pending: { color: 'bg-yellow-100 text-yellow-800 border-yellow-300', label: 'Pending' },
  processing: { color: 'bg-blue-100 text-blue-800 border-blue-300', label: 'Processing' }
};

export default function PayrollPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<PayPeriod>(demoPayPeriods[0]);
  const [viewMode, setViewMode] = useState<'employee' | 'manager'>('employee');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name');

  const totalEarnings = demoPayPeriods
    .filter(p => p.status === 'paid')
    .reduce((sum, p) => sum + p.netPay, 0);

  const avgHoursPerWeek = demoPayPeriods.length > 0
    ? demoPayPeriods.reduce((sum, p) => sum + p.regularHours + p.overtimeHours, 0) / demoPayPeriods.length / 2
    : 0;

  const earningsBreakdown = [
    { label: 'Regular Pay', value: selectedPeriod.regularHours * selectedPeriod.regularRate, color: 'rgb(59, 130, 246)' },
    { label: 'Overtime', value: selectedPeriod.overtimeHours * selectedPeriod.overtimeRate, color: 'rgb(251, 146, 60)' },
    { label: 'Tips', value: selectedPeriod.tips, color: 'rgb(34, 197, 94)' },
    { label: 'Bonuses', value: selectedPeriod.bonuses, color: 'rgb(168, 85, 247)' }
  ];

  const earningsHistory = [
    { label: 'May', value: 2890 },
    { label: 'Jun', value: 3120 },
    { label: 'Jul', value: 2950 },
    { label: 'Aug', value: 3240 },
    { label: 'Sep', value: 2983.5 },
    { label: 'Oct', value: 1527 }
  ];

  const handleDownloadPayStub = () => {
    alert('Pay stub download would be generated here as PDF');
  };

  const handleEmailPayStub = () => {
    alert('Pay stub would be emailed to employee');
  };

  const handleExportCSV = () => {
    alert('Payroll data exported as CSV');
  };

  const handleBulkProcess = () => {
    alert('Bulk payroll processing initiated');
  };

  const filteredEmployees = demoEmployees
    .filter(emp => filterDepartment === 'all' || emp.department === filterDepartment)
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'hours') return b.hoursWorked - a.hoursWorked;
      if (sortBy === 'pay') return b.grossPay - a.grossPay;
      return 0;
    });

  const departments = ['all', ...new Set(demoEmployees.map(e => e.department))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Payroll</h1>
          <p className="text-sm text-gray-600 mt-1">
            {viewMode === 'employee' ? 'View your earnings and download pay stubs' : 'Manage employee payroll and process payments'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('employee')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              viewMode === 'employee'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            Employee View
          </button>
          <button
            onClick={() => setViewMode('manager')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              viewMode === 'manager'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            Manager View
          </button>
        </div>
      </div>

      {viewMode === 'employee' ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-card rounded-xl p-6" style={{
              background: 'rgba(255, 255, 255, 0.8)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.3)'
            }}>
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 font-medium">Total Earnings</p>
                  <p className="text-2xl font-bold text-gray-900">${totalEarnings.toLocaleString()}</p>
                </div>
              </div>
              <p className="text-xs text-gray-500">Last 30 days</p>
            </div>

            <div className="glass-card rounded-xl p-6" style={{
              background: 'rgba(255, 255, 255, 0.8)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.3)'
            }}>
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 font-medium">Avg Hours/Week</p>
                  <p className="text-2xl font-bold text-gray-900">{avgHoursPerWeek.toFixed(1)}h</p>
                </div>
              </div>
              <p className="text-xs text-gray-500">Based on recent periods</p>
            </div>

            <div className="glass-card rounded-xl p-6" style={{
              background: 'rgba(255, 255, 255, 0.8)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.3)'
            }}>
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 font-medium">Next Payment</p>
                  <p className="text-2xl font-bold text-gray-900">${selectedPeriod.netPay}</p>
                </div>
              </div>
              <p className="text-xs text-gray-500">Expected: Oct 31, 2025</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="glass-card rounded-xl p-6" style={{
                background: 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.3)'
              }}>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold text-gray-900">Pay Period Details</h2>
                  <select
                    value={selectedPeriod.id}
                    onChange={(e) => {
                      const period = demoPayPeriods.find(p => p.id === e.target.value);
                      if (period) setSelectedPeriod(period);
                    }}
                    className="px-4 py-2 border-2 border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    {demoPayPeriods.map(period => (
                      <option key={period.id} value={period.id}>
                        {new Date(period.startDate).toLocaleDateString()} - {new Date(period.endDate).toLocaleDateString()}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="text-sm font-bold text-gray-900">Pay Period</p>
                        <p className="text-xs text-gray-600">
                          {new Date(selectedPeriod.startDate).toLocaleDateString()} - {new Date(selectedPeriod.endDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border-2 ${statusConfig[selectedPeriod.status].color}`}>
                      {statusConfig[selectedPeriod.status].label}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white rounded-xl border border-gray-200">
                      <p className="text-xs text-gray-600 font-medium mb-1">Regular Hours</p>
                      <p className="text-2xl font-bold text-gray-900">{selectedPeriod.regularHours}h</p>
                      <p className="text-xs text-gray-500 mt-1">@ ${selectedPeriod.regularRate}/hr</p>
                    </div>
                    <div className="p-4 bg-white rounded-xl border border-gray-200">
                      <p className="text-xs text-gray-600 font-medium mb-1">Overtime Hours</p>
                      <p className="text-2xl font-bold text-orange-600">{selectedPeriod.overtimeHours}h</p>
                      <p className="text-xs text-gray-500 mt-1">@ ${selectedPeriod.overtimeRate}/hr</p>
                    </div>
                    <div className="p-4 bg-white rounded-xl border border-gray-200">
                      <p className="text-xs text-gray-600 font-medium mb-1">Tips</p>
                      <p className="text-2xl font-bold text-green-600">${selectedPeriod.tips}</p>
                    </div>
                    <div className="p-4 bg-white rounded-xl border border-gray-200">
                      <p className="text-xs text-gray-600 font-medium mb-1">Bonuses</p>
                      <p className="text-2xl font-bold text-violet-600">${selectedPeriod.bonuses}</p>
                    </div>
                  </div>

                  <div className="space-y-3 p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Regular Pay</span>
                      <span className="text-sm font-bold text-gray-900">
                        ${(selectedPeriod.regularHours * selectedPeriod.regularRate).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Overtime Pay</span>
                      <span className="text-sm font-bold text-gray-900">
                        ${(selectedPeriod.overtimeHours * selectedPeriod.overtimeRate).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Tips</span>
                      <span className="text-sm font-bold text-gray-900">${selectedPeriod.tips.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Bonuses</span>
                      <span className="text-sm font-bold text-gray-900">${selectedPeriod.bonuses.toFixed(2)}</span>
                    </div>
                    <div className="h-px bg-gray-300 my-2" />
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-gray-900">Gross Pay</span>
                      <span className="text-lg font-bold text-gray-900">${selectedPeriod.grossPay.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Deductions (12%)</span>
                      <span className="text-sm font-bold text-red-600">-${selectedPeriod.deductions.toFixed(2)}</span>
                    </div>
                    <div className="h-px bg-gray-300 my-2" />
                    <div className="flex items-center justify-between">
                      <span className="text-base font-bold text-gray-900">Net Pay</span>
                      <span className="text-2xl font-bold text-green-600">${selectedPeriod.netPay.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleDownloadPayStub}
                      className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg"
                    >
                      <Download className="w-4 h-4" />
                      Download Pay Stub (PDF)
                    </button>
                    <button
                      onClick={handleEmailPayStub}
                      className="px-4 py-3 bg-white hover:bg-gray-50 text-gray-900 font-semibold rounded-xl transition-all flex items-center justify-center gap-2 border-2 border-gray-200"
                    >
                      <Mail className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="glass-card rounded-xl p-6" style={{
                background: 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.3)'
              }}>
                <h2 className="text-lg font-bold text-gray-900 mb-4">Earnings Trend (Last 6 Months)</h2>
                <GlassLineChart
                  data={earningsHistory}
                  height={280}
                  color="rgb(59, 130, 246)"
                  gradient={true}
                  animate={true}
                  showGrid={true}
                  showTooltip={true}
                />
              </div>
            </div>

            <div className="space-y-6">
              <div className="glass-card rounded-xl p-6" style={{
                background: 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.3)'
              }}>
                <h2 className="text-lg font-bold text-gray-900 mb-4">Earnings Breakdown</h2>
                <GlassDonutChart
                  data={earningsBreakdown}
                  size={240}
                  innerRadius={0.6}
                  animate={true}
                  showLegend={true}
                />
              </div>

              <div className="glass-card rounded-xl p-6" style={{
                background: 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.3)'
              }}>
                <h2 className="text-lg font-bold text-gray-900 mb-6">Payment History</h2>
                <div className="space-y-3">
                  {demoPayPeriods.map((period) => (
                    <button
                      key={period.id}
                      onClick={() => setSelectedPeriod(period)}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                        selectedPeriod.id === period.id
                          ? 'border-blue-400 bg-blue-50 shadow-lg'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-gray-900">
                          {new Date(period.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-bold border ${statusConfig[period.status].color}`}>
                          {statusConfig[period.status].label}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-600">{period.regularHours + period.overtimeHours}h total</span>
                        <span className="text-sm font-bold text-gray-900">${period.netPay}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="glass-card rounded-xl p-6" style={{
              background: 'rgba(255, 255, 255, 0.8)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.3)'
            }}>
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg mb-3">
                <Users className="w-6 h-6 text-white" />
              </div>
              <p className="text-sm text-gray-600 font-medium mb-1">Total Employees</p>
              <p className="text-2xl font-bold text-gray-900">{demoEmployees.length}</p>
            </div>

            <div className="glass-card rounded-xl p-6" style={{
              background: 'rgba(255, 255, 255, 0.8)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.3)'
            }}>
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg mb-3">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <p className="text-sm text-gray-600 font-medium mb-1">Total Payroll</p>
              <p className="text-2xl font-bold text-gray-900">
                ${demoEmployees.reduce((sum, e) => sum + e.grossPay, 0).toLocaleString()}
              </p>
            </div>

            <div className="glass-card rounded-xl p-6" style={{
              background: 'rgba(255, 255, 255, 0.8)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.3)'
            }}>
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl flex items-center justify-center shadow-lg mb-3">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <p className="text-sm text-gray-600 font-medium mb-1">Pending</p>
              <p className="text-2xl font-bold text-gray-900">
                {demoEmployees.filter(e => e.status === 'pending').length}
              </p>
            </div>

            <div className="glass-card rounded-xl p-6" style={{
              background: 'rgba(255, 255, 255, 0.8)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.3)'
            }}>
              <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg mb-3">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <p className="text-sm text-gray-600 font-medium mb-1">Avg Hours</p>
              <p className="text-2xl font-bold text-gray-900">
                {(demoEmployees.reduce((sum, e) => sum + e.hoursWorked, 0) / demoEmployees.length).toFixed(1)}
              </p>
            </div>
          </div>

          <div className="glass-card rounded-xl p-6" style={{
            background: 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.3)'
          }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-900">Staff Payroll</h2>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-600" />
                  <select
                    value={filterDepartment}
                    onChange={(e) => setFilterDepartment(e.target.value)}
                    className="px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    {departments.map(dept => (
                      <option key={dept} value={dept}>
                        {dept === 'all' ? 'All Departments' : dept}
                      </option>
                    ))}
                  </select>
                </div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="name">Sort by Name</option>
                  <option value="hours">Sort by Hours</option>
                  <option value="pay">Sort by Pay</option>
                </select>
                <button
                  onClick={handleBulkProcess}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all"
                >
                  Process All
                </button>
                <button
                  onClick={handleExportCSV}
                  className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-900 font-semibold rounded-lg transition-all border-2 border-gray-200 flex items-center gap-2"
                >
                  <FileDown className="w-4 h-4" />
                  Export
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-3 px-4 text-xs font-bold text-gray-700 uppercase">Employee</th>
                    <th className="text-left py-3 px-4 text-xs font-bold text-gray-700 uppercase">Position</th>
                    <th className="text-left py-3 px-4 text-xs font-bold text-gray-700 uppercase">Department</th>
                    <th className="text-right py-3 px-4 text-xs font-bold text-gray-700 uppercase">Hours</th>
                    <th className="text-right py-3 px-4 text-xs font-bold text-gray-700 uppercase">Gross Pay</th>
                    <th className="text-right py-3 px-4 text-xs font-bold text-gray-700 uppercase">Net Pay</th>
                    <th className="text-center py-3 px-4 text-xs font-bold text-gray-700 uppercase">Status</th>
                    <th className="text-center py-3 px-4 text-xs font-bold text-gray-700 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((employee) => (
                    <tr key={employee.id} className="border-b border-gray-100 hover:bg-blue-50 transition-colors">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-violet-500 rounded-full flex items-center justify-center text-white font-bold">
                            {employee.name.charAt(0)}
                          </div>
                          <span className="text-sm font-bold text-gray-900">{employee.name}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-700">{employee.position}</td>
                      <td className="py-4 px-4 text-sm text-gray-700">{employee.department}</td>
                      <td className="py-4 px-4 text-sm font-bold text-gray-900 text-right">{employee.hoursWorked}h</td>
                      <td className="py-4 px-4 text-sm font-bold text-gray-900 text-right">${employee.grossPay}</td>
                      <td className="py-4 px-4 text-sm font-bold text-green-600 text-right">${employee.netPay}</td>
                      <td className="py-4 px-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusConfig[employee.status].color}`}>
                          {statusConfig[employee.status].label}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <button className="text-blue-600 hover:text-blue-700 text-sm font-semibold">
                          Process
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
