import { useState } from 'react';
import { HelpCircle } from 'lucide-react';

interface TooltipProps {
  content: string;
  title?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export default function Tooltip({ content, title, position = 'top' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  const positionStyles = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  };

  const arrowStyles = {
    top: 'top-full left-1/2 -translate-x-1/2 -mt-1',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 -mb-1 rotate-180',
    left: 'left-full top-1/2 -translate-y-1/2 -ml-1 -rotate-90',
    right: 'right-full top-1/2 -translate-y-1/2 -mr-1 rotate-90'
  };

  return (
    <div className="relative inline-block">
      <button
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={() => setIsVisible(!isVisible)}
        className="p-1 hover:bg-gray-100 rounded-full transition-colors"
      >
        <HelpCircle className="w-4 h-4 text-gray-500 hover:text-blue-600" />
      </button>

      {isVisible && (
        <div
          className={`absolute z-50 ${positionStyles[position]} animate-fade-in`}
          style={{ width: 'max-content', maxWidth: '320px' }}
        >
          <div
            className="glass-tooltip rounded-xl p-4 shadow-2xl"
            style={{
              background: 'rgba(0, 0, 0, 0.9)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}
          >
            {title && (
              <h4 className="text-sm font-bold text-white mb-2">{title}</h4>
            )}
            <p className="text-sm text-gray-200 leading-relaxed">{content}</p>
          </div>
          <div className={`absolute ${arrowStyles[position]} w-0 h-0`}>
            <div
              className="w-3 h-3"
              style={{
                background: 'rgba(0, 0, 0, 0.9)',
                transform: 'rotate(45deg)'
              }}
            />
          </div>
        </div>
      )}

      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: ${position === 'top' ? 'translate(-50%, 5px)' :
                        position === 'bottom' ? 'translate(-50%, -5px)' :
                        position === 'left' ? 'translate(5px, -50%)' :
                        'translate(-5px, -50%)'};
          }
          to {
            opacity: 1;
            transform: ${position === 'top' || position === 'bottom' ? 'translate(-50%, 0)' :
                        'translate(0, -50%)'};
          }
        }

        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
