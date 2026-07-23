import React, { useState, useEffect } from 'react';
import { Loader, CheckCircle, XCircle, Power, Clock } from 'lucide-react';

/* ─────────────────────────────────────────────────────────────
   DESIGN TOKENS — consistent with index.css :root
───────────────────────────────────────────────────────────── */
const T = {
  green:       '#3F7D3A',
  greenDim:    'rgba(63,125,58,0.08)',
  greenBorder: 'rgba(63,125,58,0.22)',
  red:         '#B33A2E',
  redDim:      'rgba(179,58,46,0.08)',
  redBorder:   'rgba(179,58,46,0.22)',
  gold:        '#B4791E',
  goldDim:     'rgba(180,121,30,0.08)',
  goldBorder:  'rgba(180,121,30,0.22)',
  /* Text */
  textPrimary:   '#2A2018',
  textSecondary: '#55483A',
  textTertiary:  '#857358',
  textDim:       '#857358',
  /* Surfaces */
  border:      'rgba(60,45,20,0.16)',
  borderHover: 'rgba(60,45,20,0.30)',
  surface1:    'rgba(60,45,20,0.06)',
  surfaceH:    'rgba(60,45,20,0.16)',
};

const STATES = {
  idle: {
    bg:      T.surface1,
    border:  T.border,
    color:   T.textSecondary,
    cursor:  'pointer',
    icon:    Power,
    label:   'Wake Server',
    pulse:   false,
  },
  loading: {
    bg:      T.goldDim,
    border:  T.goldBorder,
    color:   T.gold,
    cursor:  'wait',
    icon:    Loader,
    label:   'Waking…',
    pulse:   true,
    spin:    true,
  },
  success: {
    bg:      T.greenDim,
    border:  T.greenBorder,
    color:   T.green,
    cursor:  'default',
    icon:    CheckCircle,
    label:   'Ready!',
    pulse:   false,
  },
  error: {
    bg:      T.redDim,
    border:  T.redBorder,
    color:   T.red,
    cursor:  'pointer',
    icon:    XCircle,
    label:   'Failed — Retry',
    pulse:   false,
  },
  cooldown: {
    bg:      'rgba(60,45,20,0.04)',
    border:  'rgba(60,45,20,0.06)',
    color:   T.textDim,
    cursor:  'not-allowed',
    icon:    Clock,
    label:   null, // dynamic: 'Wait Xs'
    pulse:   false,
  },
};

const COOLDOWN_MS  = 30_000;
const COOLDOWN_KEY = 'wakeup_last_attempt';

function isOnCooldown() {
  const last = localStorage.getItem(COOLDOWN_KEY);
  if (!last) return false;
  return Date.now() - parseInt(last, 10) < COOLDOWN_MS;
}

function getRemainingCooldown() {
  const last = localStorage.getItem(COOLDOWN_KEY);
  if (!last) return 0;
  const remaining = COOLDOWN_MS - (Date.now() - parseInt(last, 10));
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

/* ─────────────────────────────────────────────────────────────
   COMPONENT
───────────────────────────────────────────────────────────── */
const WakeUpButton = ({ compact = false }) => {
  const [status, setCooldownStatus]     = useState('idle');
  const [cooldownTime, setCooldownTime] = useState(0);

  /* Check cooldown on mount */
  useEffect(() => {
    if (isOnCooldown()) {
      setCooldownTime(getRemainingCooldown());
      setCooldownStatus('cooldown');
    }
  }, []);

  /* Tick cooldown */
  useEffect(() => {
    if (status !== 'cooldown') return;
    const id = setInterval(() => {
      const remaining = getRemainingCooldown();
      setCooldownTime(remaining);
      if (remaining <= 0) {
        setCooldownStatus('idle');
        clearInterval(id);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [status]);

  const handleWakeUp = async () => {
    if (isOnCooldown()) {
      setCooldownTime(getRemainingCooldown());
      setCooldownStatus('cooldown');
      return;
    }
    setCooldownStatus('loading');
    localStorage.setItem(COOLDOWN_KEY, Date.now().toString());

    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
      const controller = new AbortController();
      const tId = setTimeout(() => controller.abort(), 60_000);
      const response = await fetch(`${backendUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
        mode:   'cors',
      });
      clearTimeout(tId);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      setCooldownStatus('success');
      setTimeout(() => {
        const r = getRemainingCooldown();
        if (r > 0) {
          setCooldownTime(r);
          setCooldownStatus('cooldown');
        } else {
          setCooldownStatus('idle');
        }
      }, 3000);
    } catch (err) {
      localStorage.removeItem(COOLDOWN_KEY);
      console.error('[WakeUpButton]', err);
      setCooldownStatus('error');
      setTimeout(() => setCooldownStatus('idle'), 3000);
    }
  };

  const disabled = status === 'loading' || status === 'success' || status === 'cooldown';
  const cfg = STATES[status] ?? STATES.idle;
  const Icon = cfg.icon;
  const label = status === 'cooldown' ? `Wait ${cooldownTime}s` : cfg.label;

  /* Base button styles — token-based */
  const btnStyle = {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.4375rem',
    /* 40px touch target for secondary action */
    minHeight: 40,
    padding: compact ? '0 0.875rem' : '0 1.25rem',
    minWidth: compact ? 'unset' : 160,
    borderRadius: '0.75rem',
    border: `1px solid ${cfg.border}`,
    background: cfg.bg,
    color: cfg.color,
    /* Minimum 14px */
    fontSize: '0.875rem',
    fontWeight: 600,
    letterSpacing: '-0.01em',
    cursor: cfg.cursor,
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    /* Specific transitions — more performant than 'all' */
    transition: 'background 0.18s ease, border-color 0.18s ease, color 0.18s ease',
    fontFamily: 'inherit',
    overflow: 'hidden',
    animation: cfg.pulse ? 'pulse 1.4s ease-in-out infinite' : 'none',
  };

  return (
    <button
      onClick={handleWakeUp}
      disabled={disabled}
      style={btnStyle}
      onMouseOver={e => {
        if (!disabled && status === 'idle') {
          e.currentTarget.style.background     = T.surfaceH;
          e.currentTarget.style.borderColor    = T.borderHover;
          e.currentTarget.style.color          = T.textPrimary;
        }
        if (!disabled && status === 'error') {
          e.currentTarget.style.background = 'rgba(179,58,46,0.14)';
        }
      }}
      onMouseOut={e => {
        if (!disabled || status === 'error') {
          e.currentTarget.style.background  = cfg.bg;
          e.currentTarget.style.borderColor = cfg.border;
          e.currentTarget.style.color       = cfg.color;
        }
      }}
      title={
        status === 'cooldown'
          ? `Please wait ${cooldownTime}s before trying again`
          : 'Wake up the Render server'
      }
      aria-label={label}
    >
      {/* Subtle highlight overlay */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'linear-gradient(135deg, rgba(60,45,20,0.06) 0%, transparent 60%)',
          borderRadius: 'inherit',
        }}
      />

      {/* Icon */}
      <Icon
        size={15}
        style={{
          flexShrink: 0,
          animation: cfg.spin ? 'bar-spin 0.8s linear infinite' : 'none',
        }}
      />

      {/* Label */}
      <span style={{ position: 'relative', zIndex: 1 }}>{label}</span>
    </button>
  );
};

export default WakeUpButton;
