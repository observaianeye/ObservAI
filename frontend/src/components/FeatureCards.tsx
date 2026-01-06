import { useNavigate } from 'react-router-dom';
import { useScrollAnimation } from '../hooks/useScrollAnimation';
import { Camera, TrendingUp, Users, Brain, Zap, Shield, Clock, DollarSign } from 'lucide-react';

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
  delay?: string;
}

function FeatureCard({ icon, title, description, gradient, delay = '0ms' }: FeatureCardProps) {
  const navigate = useNavigate();
  const { ref, isVisible } = useScrollAnimation(0.2);

  return (
    <div
      ref={ref}
      className={`group glass rounded-2xl p-8 hover:shadow-2xl cursor-pointer transform transition-all duration-500 ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'
      }`}
      style={{ transitionDelay: isVisible ? delay : '0ms' }}
      onClick={() => navigate('/login')}
    >
      <div className={`inline-flex p-4 rounded-xl bg-gradient-to-br ${gradient} text-white mb-6 transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
        {icon}
      </div>

      <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors">
        {title}
      </h3>

      <p className="text-gray-600 leading-relaxed mb-6">
        {description}
      </p>

      <div className="flex items-center text-blue-600 font-semibold text-sm group-hover:translate-x-2 transition-transform">
        Learn more
        <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>

      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500/5 via-violet-500/5 to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    </div>
  );
}

export default function FeatureCards() {
  const { ref: titleRef, isVisible: titleVisible } = useScrollAnimation(0.2);

  const features = [
    {
      icon: <Camera className="w-7 h-7" />,
      title: 'AI Camera Analytics',
      description: 'Real-time computer vision tracking for customer flow, queue management, and heat mapping. Monitor every corner of your restaurant.',
      gradient: 'from-blue-500 to-blue-600'
    },
    {
      icon: <TrendingUp className="w-7 h-7" />,
      title: 'Sales Intelligence',
      description: 'Track revenue, transactions, and trends in real-time. Predictive analytics help you forecast and optimize pricing strategies.',
      gradient: 'from-violet-500 to-violet-600'
    },
    {
      icon: <Users className="w-7 h-7" />,
      title: 'Labor Optimization',
      description: 'Smart scheduling, performance tracking, and payroll management. Reduce labor costs while maintaining optimal coverage.',
      gradient: 'from-teal-500 to-teal-600'
    },
    {
      icon: <Brain className="w-7 h-7" />,
      title: 'AI Recommendations',
      description: 'Machine learning-powered insights suggest actions to improve operations, reduce waste, and increase profitability.',
      gradient: 'from-blue-600 to-violet-600'
    },
    {
      icon: <Zap className="w-7 h-7" />,
      title: 'Speed Analytics',
      description: 'Monitor service times, identify bottlenecks, and optimize kitchen operations for faster customer service.',
      gradient: 'from-orange-500 to-red-500'
    },
    {
      icon: <DollarSign className="w-7 h-7" />,
      title: 'Spend Management',
      description: 'Track inventory costs, vendor spending, and identify savings opportunities. Full visibility into where every dollar goes.',
      gradient: 'from-green-500 to-emerald-600'
    },
    {
      icon: <Shield className="w-7 h-7" />,
      title: 'Secure & Compliant',
      description: 'Enterprise-grade security with role-based access control. Your data is encrypted and fully compliant with industry standards.',
      gradient: 'from-gray-600 to-gray-700'
    },
    {
      icon: <Clock className="w-7 h-7" />,
      title: 'Real-time Alerts',
      description: 'Instant notifications for critical events. Stay informed about issues before they impact your operations.',
      gradient: 'from-rose-500 to-pink-600'
    }
  ];

  return (
    <section className="relative py-24 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-white via-blue-50/30 to-white" />

      <div className="relative max-w-7xl mx-auto px-6">
        <div
          ref={titleRef}
          className={`text-center mb-16 transform transition-all duration-1000 ${
            titleVisible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'
          }`}
        >
          <div className="inline-block px-4 py-2 glass rounded-full text-sm font-semibold text-blue-600 mb-4">
            Powerful Features
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
            Everything You Need to Succeed
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Comprehensive analytics tools designed specifically for modern restaurant operations.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, idx) => (
            <FeatureCard
              key={idx}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
              gradient={feature.gradient}
              delay={`${idx * 50}ms`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
