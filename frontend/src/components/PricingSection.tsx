import { useNavigate } from 'react-router-dom';
import { useScrollAnimation } from '../hooks/useScrollAnimation';
import { Check, Sparkles, Zap, Crown } from 'lucide-react';

interface PricingTierProps {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  icon: React.ReactNode;
  delay?: string;
}

function PricingTier({ name, price, period, description, features, highlighted, icon, delay = '0ms' }: PricingTierProps) {
  const navigate = useNavigate();
  const { ref, isVisible } = useScrollAnimation(0.2);

  return (
    <div
      ref={ref}
      className={`relative surface-card rounded-2xl p-8 transform transition-all duration-700 ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'
      } ${
        highlighted ? 'ring-2 ring-brand-500/50 shadow-glow-brand-strong scale-105' : 'hover:border-brand-500/30 hover:shadow-glow-brand'
      }`}
      style={{ transitionDelay: isVisible ? delay : '0ms' }}
    >
      {highlighted && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-brand-500 to-accent-500 text-white text-sm font-semibold rounded-full shadow-glow-brand">
          Most Popular
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-display text-2xl font-semibold text-ink-0 mb-1">{name}</h3>
          <p className="text-sm text-ink-3">{description}</p>
        </div>
        <div className={`p-3 rounded-xl ${highlighted ? 'bg-gradient-to-br from-brand-500 to-accent-500 shadow-glow-brand' : 'bg-gradient-to-br from-surface-3 to-surface-4'} text-white`}>
          {icon}
        </div>
      </div>

      <div className="mb-6">
        <div className="flex items-baseline">
          <span className="font-display font-mono text-5xl font-semibold text-ink-0">{price}</span>
          <span className="text-ink-3 ml-2 font-mono">{period}</span>
        </div>
      </div>

      <button
        onClick={() => navigate('/register')}
        className={`w-full py-3 px-6 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 mb-8 ${
          highlighted
            ? 'bg-gradient-to-r from-brand-500 to-accent-500 text-white hover:shadow-glow-brand-strong'
            : 'bg-white/[0.04] text-ink-0 border border-white/[0.08] hover:border-brand-500/50 hover:bg-brand-500/10'
        }`}
      >
        Get Started
      </button>

      <div className="space-y-4">
        {features.map((feature, idx) => (
          <div key={idx} className="flex items-start space-x-3">
            <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
              highlighted ? 'bg-brand-500/20 border border-brand-500/30' : 'bg-white/[0.06] border border-white/[0.08]'
            }`}>
              <Check className={`w-3 h-3 ${highlighted ? 'text-brand-300' : 'text-ink-3'}`} strokeWidth={2} />
            </div>
            <span className="text-ink-2 text-sm">{feature}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PricingSection() {
  const navigate = useNavigate();
  const { ref: titleRef, isVisible: titleVisible } = useScrollAnimation(0.2);

  const tiers = [
    {
      name: 'Starter',
      price: '$199',
      period: '/month',
      description: 'Perfect for single locations',
      icon: <Sparkles className="w-6 h-6" strokeWidth={1.5} />,
      features: [
        'Up to 2 camera feeds',
        'Real-time sales analytics',
        'Basic labor management',
        'Email support',
        'Mobile app access',
        'Daily reports'
      ]
    },
    {
      name: 'Professional',
      price: '$499',
      period: '/month',
      description: 'For growing restaurants',
      icon: <Zap className="w-6 h-6" strokeWidth={1.5} />,
      highlighted: true,
      features: [
        'Up to 8 camera feeds',
        'Advanced AI analytics',
        'Full labor optimization',
        'Priority support',
        'Custom integrations',
        'Real-time alerts',
        'Advanced reporting',
        'API access'
      ]
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: 'pricing',
      description: 'Multi-location chains',
      icon: <Crown className="w-6 h-6" strokeWidth={1.5} />,
      features: [
        'Unlimited camera feeds',
        'White-label options',
        'Dedicated account manager',
        '24/7 phone support',
        'Custom development',
        'Advanced security',
        'SLA guarantee',
        'On-premise deployment'
      ]
    }
  ];

  return (
    <section className="relative py-24 overflow-hidden bg-surface-0">
      <div className="absolute inset-0 grid-floor opacity-30" />

      <div className="absolute top-20 left-20 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-6">
        <div
          ref={titleRef}
          className={`text-center mb-16 transform transition-all duration-1000 ${
            titleVisible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'
          }`}
        >
          <div className="inline-block px-4 py-2 surface-card rounded-full text-sm font-semibold text-brand-300 mb-4">
            Simple Pricing
          </div>
          <h2 className="font-display text-4xl lg:text-5xl font-semibold text-ink-0 mb-4 tracking-tight">
            Choose Your Plan
          </h2>
          <p className="text-xl text-ink-3 max-w-2xl mx-auto mb-8">
            Start with a 14-day free trial. No credit card required.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {tiers.map((tier, idx) => (
            <PricingTier
              key={idx}
              name={tier.name}
              price={tier.price}
              period={tier.period}
              description={tier.description}
              features={tier.features}
              highlighted={tier.highlighted}
              icon={tier.icon}
              delay={`${idx * 100}ms`}
            />
          ))}
        </div>

        <div className="text-center">
          <button
            onClick={() => navigate('/register')}
            className="inline-flex items-center px-8 py-4 surface-card text-ink-0 font-semibold rounded-xl hover:border-brand-500/30 transition-all"
          >
            Not sure? Book a demo
            <svg className="w-5 h-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}
