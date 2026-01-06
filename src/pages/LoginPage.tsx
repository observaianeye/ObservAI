import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, Lock, Mail, ArrowRight, Loader2 } from 'lucide-react';
import ParticleBackground from '../components/visuals/ParticleBackground';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [passwordFieldPosition, setPasswordFieldPosition] = useState({ x: 0, y: 0 });
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const navigate = useNavigate();
  const { login } = useAuth();

  const updatePasswordFieldPosition = useCallback(() => {
    if (passwordInputRef.current) {
      const rect = passwordInputRef.current.getBoundingClientRect();
      setPasswordFieldPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      });
    }
  }, []);

  useEffect(() => {
    updatePasswordFieldPosition();
    window.addEventListener('resize', updatePasswordFieldPosition);
    window.addEventListener('scroll', updatePasswordFieldPosition);

    return () => {
      window.removeEventListener('resize', updatePasswordFieldPosition);
      window.removeEventListener('scroll', updatePasswordFieldPosition);
    };
  }, [updatePasswordFieldPosition]);

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    setIsTyping(true);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = window.setTimeout(() => {
      setIsTyping(false);
    }, 500);
  };

  const handlePasswordFocus = () => {
    setIsPasswordFocused(true);
    updatePasswordFieldPosition();
  };

  const handlePasswordBlur = () => {
    setIsPasswordFocused(false);
    setIsTyping(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const success = await login(email, password);

    if (success) {
      navigate('/dashboard');
    } else {
      setError('Invalid email or password');
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#050505] overflow-hidden">
      <ParticleBackground
        isPasswordFocused={isPasswordFocused}
        isTyping={isTyping}
        passwordFieldPosition={passwordFieldPosition}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md px-4"
      >
        <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600/20 mb-4">
              <Activity className="w-6 h-6 text-blue-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Welcome Back</h2>
            <p className="text-gray-400 text-sm">Enter your credentials to access the command center.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-mono text-blue-400 uppercase tracking-wider">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                  placeholder="admin@observai.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-mono text-blue-400 uppercase tracking-wider">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  ref={passwordInputRef}
                  type="password"
                  value={password}
                  onChange={handlePasswordChange}
                  onFocus={handlePasswordFocus}
                  onBlur={handlePasswordBlur}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                  placeholder="Type to see cameras watching..."
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/20 transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Access System
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          {error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg">
              <p className="text-sm text-red-400 text-center">{error}</p>
            </div>
          )}

          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500">
              Don't have an account?{' '}
              <Link to="/register" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
                Request Access
              </Link>
            </p>
          </div>
        </div>

        <div className="absolute -top-20 -left-20 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -z-10" />
        <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -z-10" />
      </motion.div>
    </div>
  );
}
