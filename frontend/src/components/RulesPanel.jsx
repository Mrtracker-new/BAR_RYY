import React from 'react';
import { Eye, Clock, Lock, Webhook, Server, Download, RefreshCw, Mail, Check } from 'lucide-react';

/* ── Design tokens ── */
const T = {
  gold:    '#E8A020',
  goldM:   '#C8893A',
  border:  'rgba(255,255,255,0.06)',
  borderH: 'rgba(255,255,255,0.11)',
  s0:      '#0d0d0d',
  s1:      '#111111',
  s2:      '#161616',
  text:    '#c8c8c8',
  textT:   '#404040',
  textD:   '#292929',
  mono:    "'JetBrains Mono', monospace",
};

/* ── Section label ── */
function SectionLabel({ icon: Icon, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.625rem' }}>
      {Icon && <Icon size={10} style={{ color: T.textT, flexShrink: 0 }} />}
      <span
        style={{
          fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: T.textT,
        }}
      >
        {children}
      </span>
    </div>
  );
}

/* ── Divider ── */
function Sep() {
  return <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '1.125rem 0' }} />;
}

/* ── Storage mode card ── */
function ModeCard({ active, icon: Icon, label, sub, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: '0.75rem 0.875rem', borderRadius: '0.5rem',
        border: active ? '1px solid rgba(232,160,32,0.28)' : `1px solid ${T.border}`,
        background: active ? 'rgba(232,160,32,0.07)' : 'rgba(255,255,255,0.02)',
        cursor: 'pointer', textAlign: 'left',
        transition: 'border-color 0.18s ease, background 0.18s ease',
        position: 'relative',
      }}
    >
      {/* Active checkmark */}
      {active && (
        <div
          style={{
            position: 'absolute', top: 6, right: 6,
            width: 14, height: 14, borderRadius: '50%',
            background: T.gold, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Check size={8} style={{ color: '#000' }} strokeWidth={3} />
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
        <Icon size={11} style={{ color: active ? T.gold : '#555', flexShrink: 0 }} />
        <span
          style={{
            fontSize: '0.8125rem', fontWeight: 600, letterSpacing: '-0.01em',
            color: active ? '#e0e0e0' : '#555',
          }}
        >
          {label}
        </span>
      </div>
      <p style={{ fontSize: '0.6875rem', color: '#3a3a3a', lineHeight: 1.4 }}>{sub}</p>
    </button>
  );
}

/* ── Stepper control ── */
function Stepper({ value, min, max, onChange, unit }) {
  const decrement = () => onChange(Math.max(min, value - 1));
  const increment = () => onChange(Math.min(max, value + 1));

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <div className="stepper">
        <button className="stepper-btn" onClick={decrement} title="Decrease">−</button>
        <span className="stepper-value">{value}</span>
        <button className="stepper-btn" onClick={increment} title="Increase">+</button>
      </div>
      <span style={{ fontSize: '0.8125rem', color: '#555', fontFamily: T.mono }}>
        {value} {unit && (value > 1 ? `${unit}s` : unit)}
      </span>
    </div>
  );
}

/* ── Toggle switch row ── */
function ToggleRow({ checked, onChange, label, description }) {
  return (
    <label
      style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        gap: '0.875rem', padding: '0.625rem 0.5rem', borderRadius: '0.5rem',
        cursor: 'pointer', transition: 'background 0.15s ease',
      }}
      onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
      onMouseOut={e => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#c0c0c0', marginBottom: '0.125rem', letterSpacing: '-0.01em' }}>
          {label}
        </p>
        <p style={{ fontSize: '0.6875rem', color: '#3a3a3a', lineHeight: 1.5 }}>
          {description}
        </p>
      </div>
      {/* Toggle switch */}
      <label className="toggle-switch">
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

/* ── Main ── */
const RulesPanel = ({ rules, onRulesChange }) => {
  const set = (patch) => onRulesChange({ ...rules, ...patch });

  const handleExpiryChange = (value, unit) => {
    const multipliers = { minutes: 1, hours: 60, days: 1440 };
    const minutes = parseInt(value) * multipliers[unit] || 0;
    set({ expiryMinutes: minutes, expiryUnit: unit, expiryValue: value });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>

      {/* ── Storage mode ── */}
      <div style={{ marginBottom: '1.125rem' }}>
        <SectionLabel>Storage Mode</SectionLabel>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
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

      {/* ── Self-destruct (server only) ── */}
      {rules.storageMode === 'server' ? (
        <div style={{ marginBottom: '1.125rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <SectionLabel icon={Eye}>Self-Destruct Limit</SectionLabel>
          </div>
          <Stepper
            value={rules.maxViews}
            min={1}
            max={10}
            unit="view"
            onChange={v => set({ maxViews: v })}
          />
        </div>
      ) : (
        <div
          style={{
            marginBottom: '1.125rem', padding: '0.625rem 0.75rem',
            borderRadius: '0.5rem', background: 'rgba(255,255,255,0.02)',
            border: `1px solid rgba(255,255,255,0.04)`,
          }}
        >
          <p style={{ fontSize: '0.75rem', color: '#303030', lineHeight: 1.5 }}>
            Switch to <span style={{ color: '#555' }}>Server-Side</span> to set view limits
          </p>
        </div>
      )}

      {/* ── Expiry ── */}
      <div style={{ marginBottom: '1.125rem' }}>
        <SectionLabel icon={Clock}>Auto-Expiration</SectionLabel>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="number" min="0"
            value={rules.expiryValue || 0}
            onChange={e => handleExpiryChange(e.target.value, rules.expiryUnit || 'minutes')}
            className="input-field"
            style={{ width: '5rem', textAlign: 'center', flexShrink: 0 }}
            placeholder="0"
          />
          <select
            value={rules.expiryUnit || 'minutes'}
            onChange={e => handleExpiryChange(rules.expiryValue || 0, e.target.value)}
            className="input-field"
            style={{ flex: 1 }}
          >
            <option value="minutes">Minutes</option>
            <option value="hours">Hours</option>
            <option value="days">Days</option>
          </select>
        </div>
        {(rules.expiryMinutes || 0) === 0 && (
          <p style={{ fontSize: '0.6875rem', color: T.textD, marginTop: '0.375rem' }}>
            Set to 0 to disable auto-expiry
          </p>
        )}
      </div>

      {/* ── Refresh control (server only) ── */}
      {rules.storageMode === 'server' && (
        <>
          <Sep />
          <div style={{ marginBottom: '1.125rem' }}>
            <SectionLabel icon={RefreshCw}>Refresh Control</SectionLabel>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.625rem' }}>
              {[
                {
                  id: 'threshold', label: 'View Threshold', sub: 'Prevents rapid refresh',
                  isActive: (rules.viewRefreshMinutes || 0) > 0 || !(rules.autoRefreshSeconds || 0),
                  onSelect: () => set({ viewRefreshMinutes: rules.viewRefreshMinutes || 5, autoRefreshSeconds: 0 }),
                },
                {
                  id: 'auto', label: 'Auto-Refresh', sub: 'Forces page reload',
                  isActive: (rules.autoRefreshSeconds || 0) > 0,
                  onSelect: () => set({ viewRefreshMinutes: 0, autoRefreshSeconds: rules.autoRefreshSeconds || 30 }),
                },
              ].map(({ id, label, sub, isActive, onSelect }) => (
                <button
                  key={id}
                  onClick={onSelect}
                  style={{
                    flex: 1, padding: '0.625rem 0.75rem', borderRadius: '0.5rem',
                    border: isActive ? '1px solid rgba(232,160,32,0.25)' : `1px solid ${T.border}`,
                    background: isActive ? 'rgba(232,160,32,0.06)' : 'rgba(255,255,255,0.02)',
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.18s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.25rem' }}>
                    <Clock size={10} style={{ color: isActive ? T.gold : '#555' }} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: isActive ? '#e0e0e0' : '#555' }}>
                      {label}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.6875rem', color: '#3a3a3a', lineHeight: 1.4 }}>{sub}</p>
                </button>
              ))}
            </div>

            {(rules.viewRefreshMinutes || 0) > 0 || !(rules.autoRefreshSeconds || 0) ? (
              <select
                value={rules.viewRefreshMinutes || 0}
                onChange={e => set({ viewRefreshMinutes: parseInt(e.target.value), autoRefreshSeconds: 0 })}
                className="input-field"
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

      {/* ── Password ── */}
      <div style={{ marginBottom: '0.875rem' }}>
        <SectionLabel icon={Lock}>Password Protection</SectionLabel>
        <input
          type="password"
          value={rules.password || ''}
          onChange={e => set({ password: e.target.value })}
          className="input-field"
          placeholder="Leave blank for no password"
          autoComplete="new-password"
        />
      </div>

      {/* ── Webhook ── */}
      <div style={{ marginBottom: rules.storageMode === 'server' ? '0.875rem' : 0 }}>
        <SectionLabel icon={Webhook}>Tamper Webhook</SectionLabel>
        <input
          type="url"
          value={rules.webhookUrl || ''}
          onChange={e => set({ webhookUrl: e.target.value })}
          className="input-field"
          placeholder="https://discord.com/api/webhooks/…"
        />
      </div>

      {/* ── Server-only toggles ── */}
      {rules.storageMode === 'server' && (
        <>
          <Sep />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
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
              <div style={{ paddingLeft: '0.5rem', paddingRight: '0.5rem', paddingBottom: '0.5rem' }}>
                <input
                  type="email"
                  value={rules.otpEmail || ''}
                  onChange={e => set({ otpEmail: e.target.value })}
                  className="input-field"
                  placeholder="recipient@example.com"
                  required={rules.requireOtp}
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default RulesPanel;
