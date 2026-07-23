import React, { useEffect } from 'react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';

const TOAST_CONFIGS = {
  success: {
    Icon: CheckCircle,
    color: '#3F7D3A',
    bg: 'rgba(63,125,58,0.08)',
    border: 'rgba(63,125,58,0.18)',
  },
  error: {
    Icon: AlertCircle,
    color: '#B33A2E',
    bg: 'rgba(179,58,46,0.08)',
    border: 'rgba(179,58,46,0.18)',
  },
  info: {
    Icon: AlertCircle,
    color: '#B4791E',
    bg: 'rgba(180,121,30,0.08)',
    border: 'rgba(180,121,30,0.18)',
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
        /* 72px = 56px (new navbar height) + 16px gap */
        top: '72px',
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
        boxShadow: '0 4px 24px rgba(60,45,20,0.12)',
        maxWidth: '22rem',
        animation: 'fade-in-up 0.3s cubic-bezier(0.16,1,0.3,1) both',
      }}
    >
      <Icon size={16} style={{ color, flexShrink: 0 }} />
      <p
        style={{
          /* Raised from 0.8125rem (13px) — below 14px minimum */
          fontSize: '0.9375rem',
          fontWeight: 500,
          color: '#2A2018',
          flex: 1,
          letterSpacing: '-0.01em',
          lineHeight: 1.5,
        }}
      >
        {message}
      </p>
      <button
        onClick={onClose}
        style={{
          flexShrink: 0,
          /* 28×28 — better touch target for close action */
          width: 28,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'rgba(60,45,20,0.35)',
          borderRadius: '0.375rem',
          /* Specific transition — more performant than 'all' */
          transition: 'color 0.15s ease',
        }}
        onMouseOver={e => (e.currentTarget.style.color = 'rgba(60,45,20,0.65)')}
        onMouseOut={e => (e.currentTarget.style.color = 'rgba(60,45,20,0.30)')}
      >
        <X size={13} />
      </button>
    </div>
  );
};

export default Toast;
