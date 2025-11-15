import { useState } from 'react';
import { Plus, X, UserPlus, Package, Calendar, DollarSign, FileText, Bell } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function QuickActions() {
  const [isOpen, setIsOpen] = useState(false);
  const { userRole } = useAuth();

  const managerActions = [
    { icon: UserPlus, label: 'Add Employee', action: () => console.log('Add Employee') },
    { icon: Package, label: 'New Inventory', action: () => console.log('New Inventory') },
    { icon: Calendar, label: 'Schedule Shift', action: () => console.log('Schedule Shift') },
    { icon: FileText, label: 'Generate Report', action: () => console.log('Generate Report') },
  ];

  const employeeActions = [
    { icon: Calendar, label: 'Request Time Off', action: () => console.log('Request Time Off') },
    { icon: DollarSign, label: 'View Payroll', action: () => console.log('View Payroll') },
    { icon: Bell, label: 'Notifications', action: () => console.log('Notifications') },
  ];

  const actions = userRole === 'manager' ? managerActions : employeeActions;

  return (
    <div className="fixed bottom-8 right-8 z-notification">
      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          <div className="relative mb-4 space-y-3">
            {actions.map((action, index) => {
              const Icon = action.icon;
              return (
                <button
                  key={index}
                  onClick={() => {
                    action.action();
                    setIsOpen(false);
                  }}
                  className="flex items-center gap-3 ml-auto bg-white hover:bg-gray-50 text-gray-900 px-4 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  style={{
                    animation: `slideUp 0.3s ease-out ${index * 50}ms both`
                  }}
                >
                  <Icon className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-semibold whitespace-nowrap">{action.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 transform hover:scale-110 focus:outline-none focus:ring-4 focus:ring-blue-500 focus:ring-offset-2 ${
          isOpen
            ? 'bg-red-500 hover:bg-red-600 rotate-45'
            : 'bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700'
        }`}
        aria-label={isOpen ? 'Close quick actions' : 'Open quick actions'}
      >
        {isOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <Plus className="w-6 h-6 text-white" />
        )}
      </button>

      <style>{`
        @keyframes slideUp {
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
