import React, { useState, useEffect, useRef } from 'react';
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

export const COOLDOWN_MS  = 30_000;
export const COOLDOWN_KEY = 'wakeup_last_attempt';
export const MAX_WAKE_TIME_MS = 75_000; // Render cold-starts take ~35-55s
export const POLL_INTERVAL_MS = 3_000;

export function getBackendHealthUrl() {
  const envUrl = import.meta.env.VITE_BACKEND_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    return `${envUrl.trim().replace(/\/+$/, '')}/health`;
  }
  // In production on HTTPS (e.g. Vercel), fall back to the live Render deployment
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    return 'https://bar-web-backend-139d.onrender.com/health';
  }
  // In local dev, use relative /health (which is proxied by Vite) or fallback
  return '/health';
}

export function isOnCooldown(memoryTimestamp = null) {
  try {
    const last = localStorage.getItem(COOLDOWN_KEY) || (memoryTimestamp ? memoryTimestamp.toString() : null);
    if (!last) return false;
    return Date.now() - parseInt(last, 10) < COOLDOWN_MS;
  } catch {
    if (memoryTimestamp) {
      return Date.now() - memoryTimestamp < COOLDOWN_MS;
    }
    return false;
  }
}

export function getRemainingCooldown(memoryTimestamp = null) {
  try {
    const last = localStorage.getItem(COOLDOWN_KEY) || (memoryTimestamp ? memoryTimestamp.toString() : null);
    if (!last) return 0;
    const remaining = COOLDOWN_MS - (Date.now() - parseInt(last, 10));
    return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
  } catch {
    if (memoryTimestamp) {
      const remaining = COOLDOWN_MS - (Date.now() - memoryTimestamp);
      return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
    }
    return 0;
  }
}

/* ─────────────────────────────────────────────────────────────
   COMPONENT
───────────────────────────────────────────────────────────── */
const WakeUpButton = ({ compact = false }) => {
  const [status, setStatus]             = useState('idle');
  const [cooldownTime, setCooldownTime] = useState(0);

  const isMountedRef        = useRef(true);
  const timerRef            = useRef(null);
  const intervalRef         = useRef(null);
  const pollTimeoutRef      = useRef(null);
  const abortControllerRef  = useRef(null);
  const memoryTimestampRef  = useRef(null);

  /* Clear all active timers & abort active network requests */
  const cleanupTimers = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  /* Check cooldown on mount and cleanup on unmount */
  useEffect(() => {
    isMountedRef.current = true;
    if (isOnCooldown(memoryTimestampRef.current)) {
      setCooldownTime(getRemainingCooldown(memoryTimestampRef.current));
      setStatus('cooldown');
    }

    return () => {
      isMountedRef.current = false;
      cleanupTimers();
    };
  }, []);

  /* Tick cooldown countdown */
  useEffect(() => {
    if (status !== 'cooldown') return;
    intervalRef.current = setInterval(() => {
      const remaining = getRemainingCooldown(memoryTimestampRef.current);
      if (!isMountedRef.current) return;
      setCooldownTime(remaining);
      if (remaining <= 0) {
        setStatus('idle');
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [status]);

  const handleWakeUp = async () => {
    // Guard against duplicate clicks when already in-flight or on cooldown
    if (status === 'loading' || status === 'success') return;

    if (isOnCooldown(memoryTimestampRef.current)) {
      setCooldownTime(getRemainingCooldown(memoryTimestampRef.current));
      setStatus('cooldown');
      return;
    }

    // Cancel any existing timers from previous attempts
    cleanupTimers();
    setStatus('loading');

    const healthUrl = getBackendHealthUrl();
    const startTime = Date.now();

    const checkServer = async () => {
      if (!isMountedRef.current) return;

      let pingTimeout = null;
      try {
        const controller = new AbortController();
        abortControllerRef.current = controller;

        // Individual ping timeout: 15s per attempt
        pingTimeout = setTimeout(() => {
          try {
            controller.abort();
          } catch {
            // Ignore abort error
          }
        }, 15_000);

        const response = await fetch(healthUrl, {
          method: 'GET',
          signal: controller.signal,
          mode:   'cors',
          cache:  'no-cache',
        });

        if (response.ok) {
          // Parse JSON to verify it's our actual API and not an HTML SPA fallback
          const data = await response.json().catch(() => null);
          if (data && (data.status === 'healthy' || data.service)) {
            if (!isMountedRef.current) return;

            // Server is awake! Record cooldown start
            const now = Date.now();
            memoryTimestampRef.current = now;
            try {
              localStorage.setItem(COOLDOWN_KEY, now.toString());
            } catch {
              // Ignore localStorage errors in private browsing
            }

            setStatus('success');

            // Show "Ready!" for 3s, then transition to cooldown if remaining, else idle
            timerRef.current = setTimeout(() => {
              if (!isMountedRef.current) return;
              const r = getRemainingCooldown(memoryTimestampRef.current);
              if (r > 0) {
                setCooldownTime(r);
                setStatus('cooldown');
              } else {
                setStatus('idle');
              }
            }, 3000);
            return;
          }
        }
      } catch (err) {
        // Only log if not an intentional abort on unmount/retry
        if (err.name !== 'AbortError') {
          console.debug('[WakeUpButton] Ping attempt error:', err.message || err);
        }
      } finally {
        if (pingTimeout) {
          clearTimeout(pingTimeout);
        }
      }

      // Check if we exceeded total max wake time
      if (Date.now() - startTime >= MAX_WAKE_TIME_MS) {
        if (!isMountedRef.current) return;
        try {
          localStorage.removeItem(COOLDOWN_KEY);
        } catch {
          // Ignore
        }
        memoryTimestampRef.current = null;
        console.error('[WakeUpButton] Wake up timed out after', MAX_WAKE_TIME_MS, 'ms');
        setStatus('error');
        timerRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            setStatus('idle');
          }
        }, 4000);
        return;
      }

      // If still within deadline, poll again after POLL_INTERVAL_MS
      pollTimeoutRef.current = setTimeout(checkServer, POLL_INTERVAL_MS);
    };

    // Begin first check immediately
    checkServer();
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
    minHeight: 40,
    padding: compact ? '0 0.875rem' : '0 1.25rem',
    minWidth: compact ? 'unset' : 160,
    borderRadius: '0.75rem',
    border: `1px solid ${cfg.border}`,
    background: cfg.bg,
    color: cfg.color,
    fontSize: '0.875rem',
    fontWeight: 600,
    letterSpacing: '-0.01em',
    cursor: cfg.cursor,
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    transition: 'background 0.18s ease, border-color 0.18s ease, color 0.18s ease',
    fontFamily: 'inherit',
    overflow: 'hidden',
    animation: cfg.pulse ? 'bar-pulse 1.4s ease-in-out infinite' : 'none',
  };

  return (
    <>
      <style>{`
        @keyframes bar-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes bar-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.65; }
        }
      `}</style>
      <button
        onClick={handleWakeUp}
        disabled={disabled}
        style={btnStyle}
        onMouseOver={e => {
          if (!disabled && status === 'idle') {
            e.currentTarget.style.background  = T.surfaceH;
            e.currentTarget.style.borderColor = T.borderHover;
            e.currentTarget.style.color       = T.textPrimary;
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
            : status === 'loading'
            ? 'Pinging server to wake from sleep (~35-55s)...'
            : status === 'success'
            ? 'Server is online and ready!'
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
    </>
  );
};

export default WakeUpButton;
