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
      className={`group surface-card rounded-2xl p-8 hover:border-brand-500/30 hover:shadow-glow-brand cursor-pointer transform transition-all duration-500 relative overflow-hidden ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'
      }`}
      style={{ transitionDelay: isVisible ? delay : '0ms' }}
      onClick={() => navigate('/login')}
    >
      <div className={`inline-flex p-4 rounded-xl bg-gradient-to-br ${gradient} text-white mb-6 transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
        {icon}
      </div>

      <h3 className="font-display text-xl font-semibold text-ink-0 mb-3 group-hover:text-brand-300 transition-colors">
        {title}
      </h3>

      <p className="text-ink-3 leading-relaxed mb-6">
        {description}
      </p>

      <div className="flex items-center text-brand-300 font-semibold text-sm group-hover:translate-x-2 transition-transform">
        Learn more
        <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
        </svg>
      </div>

      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-brand-500/5 via-accent-500/5 to-violet-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
    </div>
  );
}

export default function FeatureCards() {
  const { ref: titleRef, isVisible: titleVisible } = useScrollAnimation(0.2);

  const features = [
    {
      icon: <Camera className="w-7 h-7" strokeWidth={1.5} />,
      title: 'AI Camera Analytics',
      description: 'Real-time computer vision tracking for customer flow, queue management, and heat mapping. Monitor every corner of your restaurant.',
      gradient: 'from-brand-500 to-accent-500'
    },
    {
      icon: <TrendingUp className="w-7 h-7" strokeWidth={1.5} />,
      title: 'Sales Intelligence',
      description: 'Track revenue, transactions, and trends in real-time. Predictive analytics help you forecast and optimize pricing strategies.',
      gradient: 'from-violet-500 to-accent-500'
    },
    {
      icon: <Users className="w-7 h-7" strokeWidth={1.5} />,
      title: 'Labor Optimization',
      description: 'Smart scheduling, performance tracking, and payroll management. Reduce labor costs while maintaining optimal coverage.',
      gradient: 'from-accent-500 to-success'
    },
    {
      icon: <Brain className="w-7 h-7" strokeWidth={1.5} />,
      title: 'AI Recommendations',
      description: 'Machine learning-powered insights suggest actions to improve operations, reduce waste, and increase profitability.',
      gradient: 'from-brand-500 to-violet-500'
    },
    {
      icon: <Zap className="w-7 h-7" strokeWidth={1.5} />,
      title: 'Speed Analytics',
      description: 'Monitor service times, identify bottlenecks, and optimize kitchen operations for faster customer service.',
      gradient: 'from-warning to-danger'
    },
    {
      icon: <DollarSign className="w-7 h-7" strokeWidth={1.5} />,
      title: 'Spend Management',
      description: 'Track inventory costs, vendor spending, and identify savings opportunities. Full visibility into where every dollar goes.',
      gradient: 'from-success to-accent-500'
    },
    {
      icon: <Shield className="w-7 h-7" strokeWidth={1.5} />,
      title: 'Secure & Compliant',
      description: 'Enterprise-grade security with role-based access control. Your data is encrypted and fully compliant with industry standards.',
      gradient: 'from-surface-3 to-surface-4'
    },
    {
      icon: <Clock className="w-7 h-7" strokeWidth={1.5} />,
      title: 'Real-time Alerts',
      description: 'Instant notifications for critical events. Stay informed about issues before they impact your operations.',
      gradient: 'from-danger to-violet-500'
    }
  ];

  return (
    <section className="relative py-24 overflow-hidden bg-surface-0">
      <div className="absolute inset-0 grid-floor opacity-30" />

      <div className="relative max-w-7xl mx-auto px-6">
        <div
          ref={titleRef}
          className={`text-center mb-16 transform transition-all duration-1000 ${
            titleVisible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'
          }`}
        >
          <div className="inline-block px-4 py-2 surface-card rounded-full text-sm font-semibold text-brand-300 mb-4">
            Powerful Features
          </div>
          <h2 className="font-display text-4xl lg:text-5xl font-semibold text-ink-0 mb-4 tracking-tight">
            Everything You Need to Succeed
          </h2>
          <p className="text-xl text-ink-3 max-w-2xl mx-auto">
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
