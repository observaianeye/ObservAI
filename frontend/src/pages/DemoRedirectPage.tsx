import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export default function DemoRedirectPage() {
  const { demoLogin, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
      return;
    }

    const startDemo = async () => {
      const success = await demoLogin();
      if (success) {
        navigate('/dashboard', { replace: true });
      } else {
        setError('Demo session could not be started. Please try again.');
      }
    };

    startDemo();
  }, [demoLogin, navigate, isAuthenticated]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-0 grid-floor">
        <div className="text-center">
          <p className="text-danger mb-4 font-mono">{error}</p>
          <button
            onClick={() => navigate('/login')}
            className="text-brand-300 hover:text-brand-200 font-mono"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-0 grid-floor">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-300 mx-auto mb-4" strokeWidth={1.5} />
        <p className="text-ink-3 font-mono">Starting demo session...</p>
      </div>
    </div>
  );
}
