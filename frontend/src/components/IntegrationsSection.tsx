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
    <section className="relative py-20 px-6 bg-white border-t border-gray-200">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Text Content */}
          <div className="animate-fade-in-up">
            <h2 className="text-3xl md:text-4xl font-semibold text-gray-900 mb-4">
              Seamlessly integrated with your tech stack
            </h2>
            <p className="text-lg text-gray-600 mb-8">
              Connect POS, payments, and cloud tools in minutes.
            </p>
            <button className="px-8 py-3 bg-blue-600 text-white text-base font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors">
              Request a Demo
            </button>
          </div>

          {/* Logo Grid */}
          <div className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-6">
              {integrations.map((integration, index) => (
                <div
                  key={index}
                  className="group relative aspect-square bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all duration-200 flex items-center justify-center"
                  role="img"
                  aria-label={integration.name}
                >
                  {/* Logo Placeholder */}
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-400 group-hover:text-blue-600 transition-colors duration-200">
                      {integration.logo}
                    </div>
                    <div className="text-xs text-gray-500 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      {integration.name}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Additional Note */}
            <p className="text-sm text-gray-500 mt-6 text-center">
              + 50 more integrations available via API
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
