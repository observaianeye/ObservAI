import { motion } from 'framer-motion';
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';

interface ToastProps {
  id: string;
  type: 'success' | 'error' | 'warning';
  message: string;
  onClose: (id: string) => void;
}

export function Toast({ id, type, message, onClose }: ToastProps) {
  const icons = {
    success: <CheckCircle className="w-5 h-5 text-success" strokeWidth={1.5} />,
    error: <XCircle className="w-5 h-5 text-danger" strokeWidth={1.5} />,
    warning: <AlertCircle className="w-5 h-5 text-warning" strokeWidth={1.5} />
  };

  const colors = {
    success: 'bg-success/10 border-success/40',
    error: 'bg-danger/10 border-danger/40',
    warning: 'bg-warning/10 border-warning/40'
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 100 }}
      className={`flex items-start space-x-3 p-4 rounded-xl border ${colors[type]} shadow-lg min-w-[300px] max-w-md backdrop-blur-xl bg-surface-1/90`}
    >
      {icons[type]}
      <p className="text-sm text-ink-0 flex-1">{message}</p>
      <button onClick={() => onClose(id)} className="text-ink-4 hover:text-ink-0 transition-colors">
        <X className="w-4 h-4" strokeWidth={1.5} />
      </button>
    </motion.div>
  );
}
