import { TrendingUp, TrendingDown, Users, DollarSign, ShoppingCart, Eye } from 'lucide-react';
import GlassGaugeChart from '../../components/charts/GlassGaugeChart';
import GlassLineChart from '../../components/charts/GlassLineChart';
import Tooltip from '../../components/Tooltip';
import CountUp from 'react-countup';
import { motion } from 'framer-motion';

const kpis = [
  {
    label: 'Total Revenue',
    value: 45231,
    prefix: '$',
    change: '+12.5%',
    trend: 'up',
    icon: DollarSign,
    tooltip: 'Total revenue from all sales during the current period. Includes all payment methods and tips.'
  },
  {
    label: 'Total Visitors',
    value: 8234,
    prefix: '',
    change: '+8.2%',
    trend: 'up',
    icon: Eye,
    tooltip: 'Number of customers detected by camera analytics. Helps track foot traffic patterns and peak hours.'
  },
  {
    label: 'Average Order Value',
    value: 7.46,
    prefix: '$',
    change: '-0.2%',
    trend: 'down',
    icon: ShoppingCart,
    tooltip: 'Average Order Value (AOV) is calculated by dividing total revenue by the number of orders. A higher AOV indicates customers are purchasing more per transaction.'
  },
  {
    label: 'Active Staff',
    value: 23,
    prefix: '',
    change: '+2',
    trend: 'up',
    icon: Users,
    tooltip: 'Number of employees currently on shift or scheduled to work today. Use this to optimize staffing levels.'
  }
];

const weeklyData = [
  { label: 'Mon', value: 4200 },
  { label: 'Tue', value: 4850 },
  { label: 'Wed', value: 5100 },
  { label: 'Thu', value: 6200 },
  { label: 'Fri', value: 7800 },
  { label: 'Sat', value: 8900 },
  { label: 'Sun', value: 7200 }
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 100
    }
  }
} as const;

export default function OverviewPage() {
  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-semibold text-white">Dashboard Overview</h1>
        <p className="text-sm text-gray-400 mt-1">Welcome back! Here's what's happening today.</p>
      </motion.div>

      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        variants={containerVariants}
      >
        {kpis.map((kpi, index) => {
          const Icon = kpi.icon;
          const TrendIcon = kpi.trend === 'up' ? TrendingUp : TrendingDown;
          const isUp = kpi.trend === 'up';

          return (
            <motion.div
              key={index}
              variants={itemVariants}
              className="bg-[#0a0b10]/40 backdrop-blur-md rounded-xl border border-white/10 p-6 hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] transition-all duration-300 group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                  <Icon className="w-6 h-6 text-blue-400" />
                </div>
                <div className="flex items-center gap-2">
                  <div className={`flex items-center space-x-1 text-xs font-medium ${isUp ? 'text-[#39ff14]' : 'text-red-400'
                    }`}>
                    <TrendIcon className="w-3 h-3" />
                    <span>{kpi.change}</span>
                  </div>
                  <Tooltip content={kpi.tooltip} title={kpi.label} />
                </div>
              </div>
              <div className="text-2xl font-semibold text-white mb-1">
                {kpi.prefix}
                <CountUp end={kpi.value} decimals={kpi.value % 1 !== 0 ? 2 : 0} separator="," duration={2} />
              </div>
              <div className="text-sm text-gray-400">{kpi.label}</div>
            </motion.div>
          );
        })}
      </motion.div>

      <motion.div variants={itemVariants} className="w-full">
        <h2 className="text-lg font-semibold text-white mb-4">Weekly Revenue Trend</h2>
        <div className="w-full max-w-full overflow-hidden">
          <GlassLineChart
            data={weeklyData}
            height={300}
            color="#00f2ea"
            gradient={true}
            animate={true}
            showGrid={true}
            showTooltip={true}
          />
        </div>
      </motion.div>

      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        variants={containerVariants}
      >
        <motion.div variants={itemVariants}>
          <GlassGaugeChart
            value={87}
            max={100}
            label="Daily Goal"
            size={180}
            color="auto"
            animate={true}
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <GlassGaugeChart
            value={73}
            max={100}
            label="Staff Utilization"
            size={180}
            color="auto"
            animate={true}
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <GlassGaugeChart
            value={92}
            max={100}
            label="Customer Satisfaction"
            size={180}
            color="auto"
            animate={true}
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <GlassGaugeChart
            value={68}
            max={100}
            label="Inventory Health"
            size={180}
            color="auto"
            animate={true}
          />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
