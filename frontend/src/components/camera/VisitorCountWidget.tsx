import { Users, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function VisitorCountWidget() {
  const [count, setCount] = useState(1000);
  const [todayCount, setTodayCount] = useState(287);

  useEffect(() => {
    const interval = setInterval(() => {
      setCount((prev) => prev + Math.floor(Math.random() * 3));
      if (Math.random() > 0.7) {
        setTodayCount((prev) => prev + 1);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all text-white">
      <div className="flex items-center justify-between mb-4">
        <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
          <Users className="w-6 h-6" />
        </div>
        <div className="flex items-center space-x-1 text-sm bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
          <TrendingUp className="w-4 h-4" />
          <span className="font-semibold">+12%</span>
        </div>
      </div>
      <div className="mb-1">
        <p className="text-sm font-medium text-blue-100">Total Visitors</p>
        <p className="text-4xl font-bold tracking-tight">{count.toLocaleString()}</p>
      </div>
      <div className="pt-3 border-t border-white/20">
        <p className="text-xs text-blue-100">Today: <span className="font-bold text-white">{todayCount}</span> visitors</p>
      </div>
    </div>
  );
}
