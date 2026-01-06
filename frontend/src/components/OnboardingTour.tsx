import { useState } from 'react';
import { X, ChevronRight, ChevronLeft, Check } from 'lucide-react';

interface TourStep {
  title: string;
  description: string;
  target?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

const tourSteps: TourStep[] = [
  {
    title: 'Welcome to ObservAI!',
    description: 'Let\'s take a quick tour to help you get started. This will only take a minute. You can skip this tour at any time.',
  },
  {
    title: 'Your Dashboard',
    description: 'This is your command center. See real-time metrics, sales data, and AI-powered insights all in one place. Click on any widget to dive deeper.',
  },
  {
    title: 'Navigation Sidebar',
    description: 'Access all features from here: Sales, Camera Analytics, Inventory, Employee Management, and more. Your most-used pages will be highlighted.',
  },
  {
    title: 'Camera Analytics',
    description: 'View live camera feeds with AI overlays showing customer count, queue length, and heat maps. Perfect for optimizing service and layout.',
  },
  {
    title: 'AI Recommendations',
    description: 'Get intelligent suggestions based on your data: optimal staffing levels, inventory forecasts, pricing strategies, and more.',
  },
  {
    title: 'You\'re all set!',
    description: 'That\'s it! Explore at your own pace. Click the Help button in the sidebar anytime you need assistance. Let\'s get started!',
  }
];

interface OnboardingTourProps {
  onComplete: () => void;
  onSkip: () => void;
}

export default function OnboardingTour({ onComplete, onSkip }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep === tourSteps.length - 1) {
      onComplete();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const currentStepData = tourSteps[currentStep];
  const progress = ((currentStep + 1) / tourSteps.length) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        style={{ animation: 'fadeIn 0.3s ease-out' }}
      />

      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
        style={{ animation: 'slideUp 0.4s ease-out' }}
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-gray-200">
          <div
            className="h-full bg-gradient-to-r from-blue-600 to-violet-600 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="p-8">
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                  Step {currentStep + 1} of {tourSteps.length}
                </span>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-3">{currentStepData.title}</h2>
              <p className="text-lg text-gray-600 leading-relaxed">{currentStepData.description}</p>
            </div>
            <button
              onClick={onSkip}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-6 h-6 text-gray-500" />
            </button>
          </div>

          {currentStep === 0 && (
            <div className="my-8 p-6 bg-gradient-to-r from-blue-50 to-violet-50 rounded-xl border border-blue-200">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl font-bold text-white">1</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">Learn the Basics</p>
                </div>
                <div>
                  <div className="w-16 h-16 bg-violet-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl font-bold text-white">2</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">Explore Features</p>
                </div>
                <div>
                  <div className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Check className="w-8 h-8 text-white" />
                  </div>
                  <p className="text-sm font-semibold text-gray-900">Get Started</p>
                </div>
              </div>
            </div>
          )}

          {currentStep > 0 && currentStep < tourSteps.length - 1 && (
            <div className="my-8 aspect-video bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center border-2 border-gray-300">
              <div className="text-center">
                <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <span className="text-4xl">
                    {currentStep === 1 && '📊'}
                    {currentStep === 2 && '🧭'}
                    {currentStep === 3 && '📹'}
                    {currentStep === 4 && '🤖'}
                  </span>
                </div>
                <p className="text-gray-600 font-medium">Feature Preview</p>
              </div>
            </div>
          )}

          {currentStep === tourSteps.length - 1 && (
            <div className="my-8 p-8 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border-2 border-green-200 text-center">
              <div className="w-20 h-20 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">You're Ready!</h3>
              <p className="text-gray-600">Click below to start using ObservAI</p>
            </div>
          )}

          <div className="flex items-center justify-between pt-6 border-t border-gray-200">
            <button
              onClick={onSkip}
              className="px-6 py-3 text-gray-600 font-semibold hover:bg-gray-100 rounded-lg transition-colors"
            >
              Skip Tour
            </button>

            <div className="flex gap-3">
              {currentStep > 0 && (
                <button
                  onClick={handlePrevious}
                  className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold rounded-lg transition-all flex items-center gap-2"
                >
                  <ChevronLeft className="w-5 h-5" />
                  Previous
                </button>
              )}
              <button
                onClick={handleNext}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-violet-600 hover:shadow-lg text-white font-semibold rounded-lg transition-all flex items-center gap-2"
              >
                {currentStep === tourSteps.length - 1 ? 'Get Started' : 'Next'}
                {currentStep < tourSteps.length - 1 && <ChevronRight className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

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
