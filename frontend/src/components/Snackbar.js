import React, { useEffect } from 'react';
import { X } from 'lucide-react';

const Snackbar = ({ message, type = 'info', onClose, duration = 4000 }) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const bgColor = type === 'error' ? 'bg-red-600' : type === 'success' ? 'bg-black' : 'bg-red-600';

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-slideIn">
      <div className={`${bgColor} text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px] max-w-[500px]`}>
        <span className="flex-1">{message}</span>
        <button
          onClick={onClose}
          className="hover:bg-white/20 p-1 rounded transition-colors"
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
};

export default Snackbar;
