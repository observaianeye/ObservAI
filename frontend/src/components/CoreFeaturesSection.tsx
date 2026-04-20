import { Camera, BarChart3, Package, Brain, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import CameraAnalyticsVisual from './visuals/CameraAnalyticsVisual';
import SalesPOSVisual from './visuals/SalesPOSVisual';
import InventoryVisual from './visuals/InventoryVisual';
import AIRecommendationsVisual from './visuals/AIRecommendationsVisual';
import EmployeeManagementVisual from './visuals/EmployeeManagementVisual';

interface Feature {
  icon: typeof Camera;
  title: string;
  description: string;
  gradient: string;
  borderColor: string;
  Visual: React.ComponentType;
}

const features: Feature[] = [
  {
    icon: Camera,
    title: 'Camera Analytics',
    description: 'Detects guests, estimates demographics, finds hot zones, and tracks dwell times.',
    gradient: 'from-violet-500/20 to-violet-500/10',
    borderColor: 'border-violet-500/30',
    Visual: CameraAnalyticsVisual
  },
  {
    icon: BarChart3,
    title: 'Sales & POS Integration',
    description: 'Syncs sales from POS to visualize revenue, best-sellers, and peak hours.',
    gradient: 'from-accent-500/20 to-accent-500/10',
    borderColor: 'border-accent-500/30',
    Visual: SalesPOSVisual
  },
  {
    icon: Package,
    title: 'Inventory & Cost Tracking',
    description: 'Monitors stock levels, alerts for shortages, and links purchase prices to profit margins.',
    gradient: 'from-warning/20 to-warning/10',
    borderColor: 'border-warning/30',
    Visual: InventoryVisual
  },
  {
    icon: Brain,
    title: 'AI Recommendations',
    description: 'Suggests pricing, discounts, and staffing based on real-time performance data.',
    gradient: 'from-danger/20 to-danger/10',
    borderColor: 'border-danger/30',
    Visual: AIRecommendationsVisual
  },
  {
    icon: Users,
    title: 'Employee Management',
    description: 'Staff scheduling, attendance tracking, and automatic payroll.',
    gradient: 'from-brand-500/20 to-brand-500/10',
    borderColor: 'border-brand-500/30',
    Visual: EmployeeManagementVisual
  }
];

export default function CoreFeaturesSection() {
  const [visibleCards, setVisibleCards] = useState<boolean[]>(new Array(features.length).fill(false));
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observers = cardRefs.current.map((ref, index) => {
      if (!ref) return null;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setVisibleCards((prev) => {
                const newState = [...prev];
                newState[index] = true;
                return newState;
              });
            }
          });
        },
        { threshold: 0.2 }
      );

      observer.observe(ref);
      return observer;
    });

    return () => {
      observers.forEach((observer) => observer?.disconnect());
    };
  }, []);

  return (
    <section className="relative py-32 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-20 space-y-6">
          <h2 className="font-display text-5xl md:text-6xl font-semibold text-ink-0 leading-tight tracking-tight">
            Automation. Insight.{' '}
            <span className="text-gradient-brand">
              Control.
            </span>
          </h2>
          <p className="text-xl text-ink-3 max-w-3xl mx-auto leading-relaxed">
            ObservAI brings together AI analytics, POS data, and staff management
            to make your café run smarter.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="space-y-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            const Visual = feature.Visual;
            const isEven = index % 2 === 0;

            return (
              <div
                key={index}
                ref={(el) => (cardRefs.current[index] = el)}
                className={`transform transition-all duration-700 ${
                  visibleCards[index]
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-20'
                }`}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <div className="group relative">
                  {/* Glow Effect */}
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-brand-500 via-accent-500 to-violet-500 rounded-3xl blur opacity-0 group-hover:opacity-30 transition duration-500" />

                  {/* Card Container */}
                  <div
                    className={`relative bg-surface-1/80 backdrop-blur-xl border ${feature.borderColor} rounded-3xl overflow-hidden hover:scale-[1.02] transition-all duration-500`}
                  >
                    <div
                      className={`grid lg:grid-cols-2 gap-8 p-8 md:p-12 ${
                        isEven ? '' : 'lg:grid-flow-dense'
                      }`}
                    >
                      {/* Content Side */}
                      <div
                        className={`flex flex-col justify-center space-y-6 ${
                          isEven ? 'lg:order-1' : 'lg:order-2'
                        }`}
                      >
                        {/* Icon */}
                        <div className="inline-flex">
                          <div
                            className={`w-20 h-20 bg-gradient-to-br ${feature.gradient} backdrop-blur-sm border ${feature.borderColor} rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-500`}
                          >
                            <Icon className="w-10 h-10 text-ink-0" strokeWidth={1.5} />
                          </div>
                        </div>

                        {/* Title */}
                        <h3 className="font-display text-3xl md:text-4xl font-semibold text-ink-0 group-hover:text-gradient-brand transition-all tracking-tight">
                          {feature.title}
                        </h3>

                        {/* Description */}
                        <p className="text-lg text-ink-3 leading-relaxed">
                          {feature.description}
                        </p>

                        {/* Learn More Link */}
                        <button className="inline-flex items-center space-x-2 text-brand-300 hover:text-brand-200 transition-colors group/link">
                          <span className="font-medium">Learn more</span>
                          <svg
                            className="w-5 h-5 transform group-hover/link:translate-x-1 transition-transform"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17 8l4 4m0 0l-4 4m4-4H3"
                            />
                          </svg>
                        </button>
                      </div>

                      {/* Visual Side */}
                      <div
                        className={`flex items-center justify-center ${
                          isEven ? 'lg:order-2' : 'lg:order-1'
                        }`}
                      >
                        <div className="w-full max-w-md transform group-hover:scale-105 transition-transform duration-500">
                          <Visual />
                        </div>
                      </div>
                    </div>

                    {/* Decorative Gradient Overlay */}
                    <div
                      className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA Section */}
        <div className="mt-24 text-center">
          <div className="relative inline-block">
            {/* Glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-brand-500 via-accent-500 to-violet-500 blur-3xl opacity-30" />

            {/* Content */}
            <div className="relative surface-card rounded-3xl p-12 md:p-16">
              <h3 className="font-display text-3xl md:text-4xl font-semibold text-ink-0 mb-6 tracking-tight">
                See how ObservAI transforms cafés like yours.
              </h3>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                {/* Primary CTA */}
                <button className="group relative">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-brand-500 via-accent-500 to-violet-500 rounded-xl blur opacity-75 group-hover:opacity-100 transition duration-300 animate-pulse" />
                  <div className="relative px-8 py-4 bg-gradient-to-r from-brand-500 to-accent-500 rounded-xl leading-none flex items-center justify-center space-x-3 shadow-glow-brand">
                    <span className="text-white font-semibold text-lg">Get Demo</span>
                  </div>
                </button>

                {/* Secondary CTA */}
                <button className="group px-8 py-4 bg-white/[0.04] backdrop-blur-sm border border-white/[0.08] rounded-xl hover:bg-white/[0.08] hover:border-brand-500/30 transition-all duration-300 flex items-center justify-center space-x-3">
                  <span className="text-ink-0 font-medium text-lg">Explore Dashboard</span>
                  <svg
                    className="w-5 h-5 text-brand-300 transform group-hover:translate-x-1 transition-transform"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M17 8l4 4m0 0l-4 4m4-4H3"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
