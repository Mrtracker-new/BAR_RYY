import React, { useEffect } from 'react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';

const TOAST_CONFIGS = {
  success: {
    Icon: CheckCircle,
    color: '#22C55E',
    bg: 'rgba(34,197,94,0.08)',
    border: 'rgba(34,197,94,0.18)',
  },
  error: {
    Icon: AlertCircle,
    color: '#EF4444',
    bg: 'rgba(239,68,68,0.08)',
    border: 'rgba(239,68,68,0.18)',
  },
  info: {
    Icon: AlertCircle,
    color: '#E8A020',
    bg: 'rgba(232,160,32,0.08)',
    border: 'rgba(232,160,32,0.18)',
  },
};

const Toast = ({ message, type = 'success', onClose, duration = 3000 }) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const { Icon, color, bg, border } = TOAST_CONFIGS[type] || TOAST_CONFIGS.info;

  return (
    <div
      style={{
        position: 'fixed',
        top: '68px',
        right: '1rem',
        zIndex: 150,
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem 1rem',
        borderRadius: '0.75rem',
        border: `1px solid ${border}`,
        background: `${bg}`,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
        maxWidth: '22rem',
        animation: 'fade-in-up 0.3s cubic-bezier(0.16,1,0.3,1) both',
      }}
    >
      <Icon size={15} style={{ color, flexShrink: 0 }} />
      <p
        style={{
          fontSize: '0.8125rem',
          fontWeight: 500,
          color: '#cccccc',
          flex: 1,
          letterSpacing: '-0.01em',
        }}
      >
        {message}
      </p>
      <button
        onClick={onClose}
        style={{
          flexShrink: 0,
          width: 22,
          height: 22,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'rgba(255,255,255,0.25)',
          borderRadius: '0.25rem',
          transition: 'color 0.15s ease',
        }}
        onMouseOver={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
        onMouseOut={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.25)')}
      >
        <X size={13} />
      </button>
    </div>
  );
};

export default Toast;
