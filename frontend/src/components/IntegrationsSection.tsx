export default function IntegrationsSection() {
  const integrations = [
    { name: 'Square', logo: 'SQ' },
    { name: 'Stripe', logo: 'ST' },
    { name: 'Shopify', logo: 'SH' },
    { name: 'Toast', logo: 'TO' },
    { name: 'AWS', logo: 'AWS' },
    { name: 'Azure', logo: 'AZ' },
    { name: 'Google Cloud', logo: 'GC' }
  ];

  return (
    <section className="relative py-20 px-6 bg-surface-0 border-t border-white/[0.08]">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Text Content */}
          <div className="animate-fade-in-up">
            <h2 className="font-display text-3xl md:text-4xl font-semibold text-ink-0 mb-4 tracking-tight">
              Seamlessly integrated with your tech stack
            </h2>
            <p className="text-lg text-ink-3 mb-8">
              Connect POS, payments, and cloud tools in minutes.
            </p>
            <button className="px-8 py-3 bg-gradient-to-r from-brand-500 to-accent-500 text-white text-base font-semibold rounded-xl hover:shadow-glow-brand focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-2 focus:ring-offset-surface-0 transition-all">
              Request a Demo
            </button>
          </div>

          {/* Logo Grid */}
          <div className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-6">
              {integrations.map((integration, index) => (
                <div
                  key={index}
                  className="group relative aspect-square surface-card rounded-xl hover:border-brand-500/30 hover:shadow-glow-brand transition-all duration-200 flex items-center justify-center"
                  role="img"
                  aria-label={integration.name}
                >
                  {/* Logo Placeholder */}
                  <div className="text-center">
                    <div className="font-display text-2xl font-semibold text-ink-4 group-hover:text-brand-300 transition-colors duration-200">
                      {integration.logo}
                    </div>
                    <div className="text-xs text-ink-4 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 font-mono">
                      {integration.name}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Additional Note */}
            <p className="text-sm text-ink-4 mt-6 text-center font-mono">
              + 50 more integrations available via API
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
