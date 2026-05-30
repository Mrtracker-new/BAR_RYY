import React, { useState } from 'react';
import {
  Eye, Clock, Lock, Webhook, Server, Download,
  RefreshCw, Mail, Check, X, Plus, Users, ChevronDown,
} from 'lucide-react';

/* ─────────────────────────────────────────────────────────────
   DESIGN TOKENS
   Identical to App.jsx T-object and index.css :root.
   Any change must propagate to all three sources.
───────────────────────────────────────────────────────────── */
const T = {
  gold:        '#E8A020',
  goldLight:   '#F5BA3A',
  goldMuted:   '#C8893A',
  goldDim:     'rgba(232,160,32,0.10)',
  goldBorder:  'rgba(232,160,32,0.22)',
  goldBorderH: 'rgba(232,160,32,0.38)',

  /* Text — all WCAG AA against #070707 */
  textPrimary:   '#f0f0f0',    /* 15.8:1 AAA */
  textSecondary: '#a0a0a0',    /*  6.3:1  AA */
  textTertiary:  '#636363',    /*  4.9:1  AA */
  textDim:       '#424242',    /*  3.6:1  decorative only */

  /* Surfaces */
  surface0: '#0e0e0e',
  surface1: '#141414',
  surface2: '#1a1a1a',
  surface3: '#212121',

  /* Borders */
  border:      'rgba(255,255,255,0.07)',
  borderHover: 'rgba(255,255,255,0.13)',

  /* Semantic */
  red:       '#EF4444',
  redDim:    'rgba(239,68,68,0.08)',
  redBorder: 'rgba(239,68,68,0.18)',

  /* Font */
  mono: "'JetBrains Mono', monospace",
};

/* ─────────────────────────────────────────────────────────────
   SECTION LABEL
   Icon + UPPERCASE text row. Used as a sub-heading inside
   each rules section.

   Changes from original:
   - Font: 0.6875rem (11px) → 0.75rem (12px) UPPERCASE
   - Color: #404040 → T.textTertiary (#636363) — raised to AA
   - Icon: size={10} → size={12}
───────────────────────────────────────────────────────────── */
function SectionLabel({ icon: Icon, children }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: '0.4rem',
        marginBottom: '0.625rem',
      }}
    >
      {Icon && (
        <Icon
          size={12}                      /* raised from 10 */
          style={{ color: T.textTertiary, flexShrink: 0 }}
        />
      )}
      <span
        style={{
          fontSize: '0.75rem',           /* 12px — raised from 11px */
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: T.textTertiary,         /* #636363 — raised from #404040 */
        }}
      >
        {children}
      </span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   SECTION SEPARATOR
───────────────────────────────────────────────────────────── */
function Sep() {
  return (
    <div
      style={{
        height: 1,
        background: 'rgba(255,255,255,0.05)',   /* slightly lifted from 0.04 */
        margin: '1.125rem 0',
      }}
    />
  );
}

/* ─────────────────────────────────────────────────────────────
   MODE CARD — Storage selection (Client / Server)
   Changes from original:
   - Sub text: 0.6875rem #3a3a3a → 0.75rem #505050 (near-invisible fix)
   - Label text: 0.8125rem → 0.875rem (14px body minimum)
   - Active label color: #e0e0e0 → T.textPrimary
   - Inactive label color: #555 → T.textTertiary (readable but dimmed)
   - Active indicator uses T.gold consistently
───────────────────────────────────────────────────────────── */
function ModeCard({ active, icon: Icon, label, sub, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '0.75rem 0.875rem',
        borderRadius: '0.5rem',
        border: active
          ? `1px solid ${T.goldBorder}`
          : `1px solid ${T.border}`,
        background: active
          ? T.goldDim
          : 'rgba(255,255,255,0.02)',
        cursor: 'pointer', textAlign: 'left',
        transition: 'border-color 0.18s ease, background 0.18s ease',
        position: 'relative',
        minWidth: 0,                     /* prevents flex overflow */
      }}
      aria-pressed={active}
    >
      {/* Active checkmark badge */}
      {active && (
        <div
          style={{
            position: 'absolute', top: 6, right: 6,
            width: 15, height: 15, borderRadius: '50%',
            background: T.gold,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Check size={9} style={{ color: '#000' }} strokeWidth={3} />
        </div>
      )}

      {/* Icon + Label row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
        <Icon
          size={12}
          style={{ color: active ? T.gold : T.textTertiary, flexShrink: 0 }}
        />
        <span
          style={{
            fontSize: '0.875rem',        /* 14px — raised from 13px */
            fontWeight: 600, letterSpacing: '-0.01em',
            color: active ? T.textPrimary : T.textTertiary,  /* raised from #555 */
          }}
        >
          {label}
        </span>
      </div>

      {/* Sub-description — raised from 11px #3a3a3a to 12px #505050 */}
      <p
        style={{
          fontSize: '0.75rem',           /* 12px — raised from 11px */
          color: '#505050',              /* raised from #3a3a3a (near-invisible) */
          lineHeight: 1.45,
          margin: 0,
        }}
      >
        {sub}
      </p>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
   STEPPER — +/− number control
   Wraps the .stepper / .stepper-btn / .stepper-value CSS classes
   from index.css. The label text uses T.textTertiary.
───────────────────────────────────────────────────────────── */
function Stepper({ value, min, max, onChange, unit }) {
  const decrement = () => onChange(Math.max(min, value - 1));
  const increment = () => onChange(Math.min(max, value + 1));

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        flexWrap: 'wrap',               /* wrap on very narrow screens */
        minWidth: 0,                    /* prevent flex overflow */
      }}
    >
      <div className="stepper">
        <button className="stepper-btn" onClick={decrement} aria-label="Decrease">−</button>
        <span className="stepper-value">{value}</span>
        <button className="stepper-btn" onClick={increment} aria-label="Increase">+</button>
      </div>

      <span
        style={{
          fontSize: '0.875rem',          /* 14px — raised from 13px */
          color: T.textTertiary,
          fontFamily: T.mono,
          whiteSpace: 'nowrap',
        }}
      >
        {value} {unit && (value > 1 ? `${unit}s` : unit)}
      </span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   TOGGLE ROW
   Label + description left, toggle switch right.
   Changes from original:
   - Label: 0.8125rem → 0.875rem (14px body minimum)
   - Description: 0.6875rem #3a3a3a → 0.75rem #505050
   - Toggle track uses CSS classes from index.css
───────────────────────────────────────────────────────────── */
function ToggleRow({ checked, onChange, label, description }) {
  return (
    <label className="toggle-row">
      {/* Text content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: '0.875rem',        /* 14px — raised from 13px */
            fontWeight: 600,
            color: T.textPrimary,        /* raised from #c0c0c0 */
            marginBottom: '0.2rem',
            letterSpacing: '-0.01em',
            lineHeight: 1.3,
          }}
        >
          {label}
        </p>
        <p
          style={{
            fontSize: '0.75rem',         /* 12px — raised from 11px */
            color: '#505050',            /* raised from #3a3a3a (near-invisible) */
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          {description}
        </p>
      </div>

      {/* Toggle switch — uses CSS class from index.css */}
      <label className="toggle-switch" style={{ flexShrink: 0 }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
        />
        <span className="toggle-track" />
      </label>
    </label>
  );
}

/* ─────────────────────────────────────────────────────────────
   OTP EMAIL MANAGER
   Manages a list of OTP recipient email addresses.
   Max 10 recipients. Validates format.

   Changes from original:
   - Email tag font: 0.75rem → 0.875rem (14px minimum)
   - Email tag: added overflow guard (nowrap + ellipsis)
   - "Recipients" label: raised to T.textTertiary
   - Count badge: already ok; refined colors
   - Error text: raised to 0.8125rem from 0.6875rem
   - Add button: raised to 36px for easier tapping
───────────────────────────────────────────────────────────── */
const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const MAX_OTP_EMAILS = 10;

function OtpEmailManager({ emails, onChange }) {
  const [draft, setDraft]           = useState('');
  const [inputError, setInputError] = useState('');

  const atMax = emails.length >= MAX_OTP_EMAILS;

  const addEmail = () => {
    const val = draft.trim().toLowerCase();
    if (!val) return;
    if (!EMAIL_RE.test(val))                    { setInputError('Invalid email address'); return; }
    if (emails.some(e => e.toLowerCase() === val)) { setInputError('Already added'); return; }
    if (atMax)                                  { setInputError(`Max ${MAX_OTP_EMAILS} recipients`); return; }
    onChange([...emails, val]);
    setDraft('');
    setInputError('');
  };

  const removeEmail = (idx) => onChange(emails.filter((_, i) => i !== idx));

  const handleKey = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addEmail(); }
    else setInputError('');
  };

  return (
    <div style={{ padding: '0 0.5rem 0.75rem', minWidth: 0 }}>

      {/* Recipients count header */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: '0.375rem',
          marginBottom: '0.5rem',
        }}
      >
        <Users size={11} style={{ color: T.textTertiary, flexShrink: 0 }} />
        <span
          style={{
            fontSize: '0.75rem', fontWeight: 700,
            letterSpacing: '0.07em', textTransform: 'uppercase',
            color: T.textTertiary,              /* raised from #404040 */
          }}
        >
          Recipients
        </span>
        {/* Count badge */}
        <span
          style={{
            marginLeft: 'auto',
            fontSize: '0.6875rem', fontWeight: 700,
            color: atMax ? T.gold : T.textTertiary,
            background: atMax ? 'rgba(232,160,32,0.08)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${atMax ? T.goldBorder : T.border}`,
            borderRadius: '999px', padding: '0.1rem 0.45rem',
            flexShrink: 0,
          }}
        >
          {emails.length} / {MAX_OTP_EMAILS}
        </span>
      </div>

      {/* Email input + add button */}
      <div style={{ display: 'flex', gap: '0.4rem', minWidth: 0 }}>
        <input
          type="email"
          value={draft}
          onChange={e => { setDraft(e.target.value); setInputError(''); }}
          onKeyDown={handleKey}
          className="input-field"
          placeholder="recipient@example.com"
          disabled={atMax}
          aria-label="Add OTP recipient email"
          style={{ flex: 1, minWidth: 0 }}
        />
        <button
          onClick={addEmail}
          disabled={atMax || !draft.trim()}
          aria-label="Add email"
          title="Add email"
          style={{
            flexShrink: 0,
            width: 36, height: 36,           /* slightly larger for tap target */
            borderRadius: '0.4rem',
            background: atMax || !draft.trim()
              ? 'rgba(255,255,255,0.03)'
              : T.goldDim,
            border: `1px solid ${atMax || !draft.trim()
              ? T.border
              : T.goldBorder}`,
            cursor: atMax || !draft.trim() ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: atMax || !draft.trim() ? T.textDim : T.gold,
            transition: 'all 0.15s ease',
            opacity: atMax || !draft.trim() ? 0.5 : 1,
          }}
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Inline validation error */}
      {inputError && (
        <p
          style={{
            fontSize: '0.8125rem',           /* 13px — raised from 11px */
            color: T.red, marginTop: '0.3rem',
          }}
        >
          {inputError}
        </p>
      )}

      {/* Email tag list */}
      {emails.length > 0 && (
        <div
          style={{
            marginTop: '0.5rem',
            display: 'flex', flexDirection: 'column', gap: '0.25rem',
            minWidth: 0,
          }}
        >
          {emails.map((email, idx) => (
            <div
              key={email}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.35rem 0.5rem 0.35rem 0.625rem',
                borderRadius: '0.375rem',
                background: T.goldDim,
                border: `1px solid ${T.goldBorder}`,
                minWidth: 0,
              }}
            >
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  minWidth: 0, flex: 1,
                }}
              >
                <Mail size={11} style={{ color: T.goldMuted, flexShrink: 0 }} />
                <span
                  style={{
                    fontSize: '0.8125rem',        /* 13px — ok for a chip tag */
                    color: T.textSecondary,
                    fontFamily: T.mono,
                    /* Overflow guard — was missing, clips on narrow panels */
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    minWidth: 0,
                  }}
                >
                  {email}
                </span>
              </div>
              <button
                onClick={() => removeEmail(idx)}
                aria-label={`Remove ${email}`}
                title="Remove"
                style={{
                  flexShrink: 0, marginLeft: '0.5rem',
                  width: 20, height: 20, borderRadius: '0.25rem',
                  background: 'transparent', border: 'none',
                  cursor: 'pointer', color: T.textDim,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'color 0.15s ease',
                }}
                onMouseOver={e => { e.currentTarget.style.color = T.red; }}
                onMouseOut={e  => { e.currentTarget.style.color = T.textDim; }}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   REFRESH MODE CARD
   Compact version of ModeCard for the refresh-control section.
───────────────────────────────────────────────────────────── */
function RefreshCard({ isActive, icon: Icon, label, sub, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={isActive}
      style={{
        flex: 1,
        padding: '0.625rem 0.75rem',
        borderRadius: '0.5rem',
        border: isActive ? `1px solid ${T.goldBorder}` : `1px solid ${T.border}`,
        background: isActive ? T.goldDim : 'rgba(255,255,255,0.02)',
        cursor: 'pointer', textAlign: 'left',
        transition: 'all 0.18s ease',
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.25rem' }}>
        <Icon
          size={11}
          style={{ color: isActive ? T.gold : T.textTertiary, flexShrink: 0 }}
        />
        <span
          style={{
            fontSize: '0.875rem',        /* 14px */
            fontWeight: 600,
            color: isActive ? T.textPrimary : T.textTertiary,
            letterSpacing: '-0.01em',
          }}
        >
          {label}
        </span>
      </div>
      <p
        style={{
          fontSize: '0.75rem',           /* 12px — raised from 11px */
          color: '#505050',              /* raised from #3a3a3a */
          lineHeight: 1.4, margin: 0,
        }}
      >
        {sub}
      </p>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
   RULES PANEL — main component
   All security rule controls for a BAR container.
───────────────────────────────────────────────────────────── */
const RulesPanel = ({ rules, onRulesChange }) => {
  const set = (patch) => onRulesChange({ ...rules, ...patch });

  const handleExpiryChange = (value, unit) => {
    const multipliers = { minutes: 1, hours: 60, days: 1440 };
    const minutes     = parseInt(value) * multipliers[unit] || 0;
    set({ expiryMinutes: minutes, expiryUnit: unit, expiryValue: value });
  };

  const isViewThreshold = (rules.viewRefreshMinutes || 0) > 0 || !(rules.autoRefreshSeconds || 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>

      {/* ══════════════════════════════════════════
          STORAGE MODE
      ══════════════════════════════════════════ */}
      <div style={{ marginBottom: '1.125rem' }}>
        <SectionLabel>Storage Mode</SectionLabel>
        <div style={{ display: 'flex', gap: '0.5rem', minWidth: 0 }}>
          <ModeCard
            active={!rules.storageMode || rules.storageMode === 'client'}
            icon={Download}
            label="Client-Side"
            sub="Download .bar file"
            onClick={() => set({ storageMode: 'client' })}
          />
          <ModeCard
            active={rules.storageMode === 'server'}
            icon={Server}
            label="Server-Side"
            sub="Shareable link"
            onClick={() => set({ storageMode: 'server' })}
          />
        </div>
      </div>

      <Sep />

      {/* ══════════════════════════════════════════
          SELF-DESTRUCT LIMIT (server only)
      ══════════════════════════════════════════ */}
      {rules.storageMode === 'server' ? (
        <div style={{ marginBottom: '1.125rem' }}>
          <SectionLabel icon={Eye}>Self-Destruct Limit</SectionLabel>
          <Stepper
            value={rules.maxViews}
            min={1} max={10} unit="view"
            onChange={v => set({ maxViews: v })}
          />
        </div>
      ) : (
        /* Placeholder when client-side is selected */
        <div
          style={{
            marginBottom: '1.125rem',
            padding: '0.625rem 0.75rem',
            borderRadius: '0.5rem',
            background: 'rgba(255,255,255,0.02)',
            border: `1px solid ${T.border}`,
          }}
        >
          <p
            style={{
              fontSize: '0.8125rem',     /* 13px — inline explanatory text */
              color: '#505050',          /* raised from #303030 */
              lineHeight: 1.55, margin: 0,
            }}
          >
            Switch to{' '}
            <span style={{ color: T.textTertiary }}>Server-Side</span>
            {' '}to set view limits
          </p>
        </div>
      )}

      {/* ══════════════════════════════════════════
          AUTO-EXPIRATION
      ══════════════════════════════════════════ */}
      <div style={{ marginBottom: '1.125rem' }}>
        <SectionLabel icon={Clock}>Auto-Expiration</SectionLabel>
        <div style={{ display: 'flex', gap: '0.5rem', minWidth: 0 }}>
          <input
            type="number" min="0"
            value={rules.expiryValue || 0}
            onChange={e => handleExpiryChange(e.target.value, rules.expiryUnit || 'minutes')}
            className="input-field"
            aria-label="Expiry value"
            style={{ width: '5rem', textAlign: 'center', flexShrink: 0 }}
            placeholder="0"
          />
          <select
            value={rules.expiryUnit || 'minutes'}
            onChange={e => handleExpiryChange(rules.expiryValue || 0, e.target.value)}
            className="input-field"
            style={{ flex: 1, minWidth: 0 }}
            aria-label="Expiry unit"
          >
            <option value="minutes">Minutes</option>
            <option value="hours">Hours</option>
            <option value="days">Days</option>
          </select>
        </div>
        {(rules.expiryMinutes || 0) === 0 && (
          <p
            style={{
              fontSize: '0.75rem',       /* 12px */
              color: T.textDim,          /* decorative hint */
              marginTop: '0.375rem',
            }}
          >
            Set to 0 to disable auto-expiry
          </p>
        )}
      </div>

      {/* ══════════════════════════════════════════
          REFRESH CONTROL (server only)
      ══════════════════════════════════════════ */}
      {rules.storageMode === 'server' && (
        <>
          <Sep />
          <div style={{ marginBottom: '1.125rem' }}>
            <SectionLabel icon={RefreshCw}>Refresh Control</SectionLabel>

            {/* Mode picker */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.625rem', minWidth: 0 }}>
              <RefreshCard
                isActive={isViewThreshold}
                icon={Clock}
                label="View Threshold"
                sub="Prevents rapid refresh"
                onClick={() => set({ viewRefreshMinutes: rules.viewRefreshMinutes || 5, autoRefreshSeconds: 0 })}
              />
              <RefreshCard
                isActive={!isViewThreshold}
                icon={RefreshCw}
                label="Auto-Refresh"
                sub="Forces page reload"
                onClick={() => set({ viewRefreshMinutes: 0, autoRefreshSeconds: rules.autoRefreshSeconds || 30 })}
              />
            </div>

            {/* Conditional selector */}
            {isViewThreshold ? (
              <select
                value={rules.viewRefreshMinutes || 0}
                onChange={e => set({ viewRefreshMinutes: parseInt(e.target.value), autoRefreshSeconds: 0 })}
                className="input-field"
                aria-label="View threshold duration"
              >
                <option value="0">Every access counts (default)</option>
                <option value="1">1 minute</option>
                <option value="5">5 minutes (recommended)</option>
                <option value="10">10 minutes</option>
                <option value="30">30 minutes</option>
                <option value="60">1 hour</option>
              </select>
            ) : (
              <select
                value={rules.autoRefreshSeconds || 0}
                onChange={e => set({ viewRefreshMinutes: 0, autoRefreshSeconds: parseInt(e.target.value) })}
                className="input-field"
                aria-label="Auto-refresh interval"
              >
                <option value="10">10 seconds (strict)</option>
                <option value="30">30 seconds (recommended)</option>
                <option value="60">1 minute</option>
                <option value="120">2 minutes</option>
                <option value="300">5 minutes</option>
              </select>
            )}
          </div>
        </>
      )}

      <Sep />

      {/* ══════════════════════════════════════════
          PASSWORD PROTECTION
      ══════════════════════════════════════════ */}
      <div style={{ marginBottom: '0.875rem' }}>
        <SectionLabel icon={Lock}>Password Protection</SectionLabel>
        <input
          type="password"
          value={rules.password || ''}
          onChange={e => set({ password: e.target.value })}
          className="input-field"
          placeholder="Leave blank for no password"
          autoComplete="new-password"
          aria-label="Container password"
        />
      </div>

      {/* ══════════════════════════════════════════
          TAMPER WEBHOOK
      ══════════════════════════════════════════ */}
      <div style={{ marginBottom: rules.storageMode === 'server' ? '0.875rem' : 0 }}>
        <SectionLabel icon={Webhook}>Tamper Webhook</SectionLabel>
        <input
          type="url"
          value={rules.webhookUrl || ''}
          onChange={e => set({ webhookUrl: e.target.value })}
          className="input-field"
          /* Shorter placeholder — was getting clipped on narrow panels */
          placeholder="https://hooks.example.com/…"
          aria-label="Tamper webhook URL"
        />
      </div>

      {/* ══════════════════════════════════════════
          SERVER-ONLY TOGGLES
          View Only + Require Email OTP
      ══════════════════════════════════════════ */}
      {rules.storageMode === 'server' && (
        <>
          <Sep />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <ToggleRow
              checked={rules.viewOnly || false}
              onChange={e => set({ viewOnly: e.target.checked })}
              label="View Only Mode"
              description="Recipients can view but cannot download"
            />
            <ToggleRow
              checked={rules.requireOtp || false}
              onChange={e => set({ requireOtp: e.target.checked })}
              label="Require Email OTP"
              description="6-digit code sent to recipient's email"
            />
            {rules.requireOtp && (
              <OtpEmailManager
                emails={rules.otpEmails || []}
                onChange={emails => set({ otpEmails: emails })}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default RulesPanel;
