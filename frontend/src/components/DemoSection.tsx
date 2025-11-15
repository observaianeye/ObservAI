import { useScrollAnimation } from '../hooks/useScrollAnimation';
import { SalesDashboardMockup, LaborDashboardMockup, CameraDashboardMockup } from './DashboardMockup';

export default function DemoSection() {
  const { ref: salesRef, isVisible: salesVisible } = useScrollAnimation(0.2);
  const { ref: laborRef, isVisible: laborVisible } = useScrollAnimation(0.2);
  const { ref: cameraRef, isVisible: cameraVisible } = useScrollAnimation(0.2);

  return (
    <section className="relative py-24 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50 to-white" />

      <div className="relative max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="inline-block px-4 py-2 glass rounded-full text-sm font-semibold text-blue-600 mb-4">
            Interactive Demos
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
            See ObservAI in Action
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Explore our powerful analytics modules. Click any demo to sign in and experience the full platform.
          </p>
        </div>

        <div className="space-y-8">
          <div
            ref={salesRef}
            className={`transform transition-all duration-1000 ${
              salesVisible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'
            }`}
          >
            <SalesDashboardMockup />
          </div>

          <div
            ref={laborRef}
            className={`transform transition-all duration-1000 delay-200 ${
              laborVisible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'
            }`}
          >
            <LaborDashboardMockup />
          </div>

          <div
            ref={cameraRef}
            className={`transform transition-all duration-1000 delay-400 ${
              cameraVisible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'
            }`}
          >
            <CameraDashboardMockup />
          </div>
        </div>
      </div>
    </section>
  );
}
