import React from 'react';
import { Eye, Clock, Lock, Webhook, Server, Download } from 'lucide-react';

/* ─────────────────────────────────────────────
   Small label above form sections
───────────────────────────────────────────── */
function FieldLabel({ children }) {
  return (
    <p
      style={{
        fontSize: '0.6875rem',
        fontWeight: 600,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: '#555555',
        marginBottom: '0.625rem',
      }}
    >
      {children}
    </p>
  );
}

/* ─────────────────────────────────────────────
   Divider
───────────────────────────────────────────── */
function Divider() {
  return (
    <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', margin: '1.25rem 0' }} />
  );
}

/* ─────────────────────────────────────────────
   Main
───────────────────────────────────────────── */
const RulesPanel = ({ rules, onRulesChange }) => {
  const handleMaxViewsChange = (value) =>
    onRulesChange({ ...rules, maxViews: parseInt(value) || 1 });

  const handleExpiryChange = (value, unit) => {
    const multipliers = { minutes: 1, hours: 60, days: 1440 };
    const minutes = parseInt(value) * multipliers[unit] || 0;
    onRulesChange({ ...rules, expiryMinutes: minutes, expiryUnit: unit, expiryValue: value });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>

      {/* ── Storage Mode ── */}
      <div style={{ marginBottom: '1.25rem' }}>
        <FieldLabel>Storage Mode</FieldLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          {[
            {
              value: 'client',
              label: 'Client-Side',
              sub: 'Download .bar file',
              Icon: Download,
            },
            {
              value: 'server',
              label: 'Server-Side',
              sub: 'Shareable link',
              Icon: Server,
            },
          ].map(({ value, label, sub, Icon }) => {
            const active = rules.storageMode === value || (!rules.storageMode && value === 'client');
            return (
              <label
                key={value}
                className={`radio-card${active ? ' active' : ''}`}
                style={{ cursor: 'pointer' }}
              >
                <input
                  type="radio"
                  name="storageMode"
                  value={value}
                  checked={active}
                  onChange={() => onRulesChange({ ...rules, storageMode: value })}
                  style={{ display: 'none' }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <Icon
                    size={13}
                    style={{ color: active ? '#E8A020' : '#555555', flexShrink: 0 }}
                  />
                  <span
                    style={{
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: active ? '#e0e0e0' : '#666666',
                    }}
                  >
                    {label}
                  </span>
                </div>
                <p style={{ fontSize: '0.7rem', color: '#444444', lineHeight: 1.4 }}>
                  {sub}
                </p>
              </label>
            );
          })}
        </div>
      </div>

      <Divider />

      {/* ── Max Views (server only) ── */}
      {rules.storageMode === 'server' ? (
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <Eye size={13} style={{ color: '#555555' }} />
              <FieldLabel>Self-Destruct Limit</FieldLabel>
            </div>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                fontFamily: "'JetBrains Mono', monospace",
                color: '#E8A020',
                background: 'rgba(232,160,32,0.08)',
                border: '1px solid rgba(232,160,32,0.18)',
                borderRadius: '0.375rem',
                padding: '0.125rem 0.5rem',
              }}
            >
              {rules.maxViews} {rules.maxViews > 1 ? 'views' : 'view'}
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="10"
            value={rules.maxViews}
            onChange={(e) => handleMaxViewsChange(e.target.value)}
            style={{ width: '100%', marginBottom: 0 }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
            <span style={{ fontSize: '0.625rem', color: '#333333' }}>1</span>
            <span style={{ fontSize: '0.625rem', color: '#333333' }}>10</span>
          </div>
        </div>
      ) : (
        <div
          style={{
            marginBottom: '1.25rem',
            padding: '0.75rem',
            borderRadius: '0.5rem',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.04)',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: '0.75rem', color: '#444444' }}>
            Switch to <span style={{ color: '#aaaaaa' }}>Server-Side</span> to set view limits
          </p>
        </div>
      )}

      {/* ── Auto-Expiry ── */}
      <div style={{ marginBottom: '1.25rem' }}>
        <FieldLabel>Auto-Expiration</FieldLabel>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="number"
            min="0"
            value={rules.expiryValue || 0}
            onChange={(e) => handleExpiryChange(e.target.value, rules.expiryUnit || 'minutes')}
            className="input-field"
            style={{ width: '5rem', textAlign: 'center', flexShrink: 0 }}
            placeholder="0"
          />
          <select
            value={rules.expiryUnit || 'minutes'}
            onChange={(e) => handleExpiryChange(rules.expiryValue || 0, e.target.value)}
            className="input-field"
            style={{ flex: 1, cursor: 'pointer' }}
          >
            <option value="minutes">Minutes</option>
            <option value="hours">Hours</option>
            <option value="days">Days</option>
          </select>
        </div>
        {(rules.expiryMinutes || 0) === 0 && (
          <p style={{ fontSize: '0.7rem', color: '#444444', marginTop: '0.375rem' }}>
            Set to 0 to disable expiry
          </p>
        )}
      </div>

      {/* ── Refresh Control (server only) ── */}
      {rules.storageMode === 'server' && (
        <>
          <Divider />
          <div style={{ marginBottom: '1.25rem' }}>
            <FieldLabel>Refresh Control</FieldLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.625rem' }}>
              {[
                {
                  id: 'threshold',
                  label: 'View Threshold',
                  sub: 'Prevents rapid refresh',
                  isActive:
                    (rules.viewRefreshMinutes || 0) > 0 || !(rules.autoRefreshSeconds || 0),
                  onSelect: () =>
                    onRulesChange({
                      ...rules,
                      viewRefreshMinutes: rules.viewRefreshMinutes || 5,
                      autoRefreshSeconds: 0,
                    }),
                },
                {
                  id: 'auto',
                  label: 'Auto-Refresh',
                  sub: 'Forces page reload',
                  isActive: (rules.autoRefreshSeconds || 0) > 0,
                  onSelect: () =>
                    onRulesChange({
                      ...rules,
                      viewRefreshMinutes: 0,
                      autoRefreshSeconds: rules.autoRefreshSeconds || 30,
                    }),
                },
              ].map(({ id, label, sub, isActive, onSelect }) => (
                <label
                  key={id}
                  className={`radio-card${isActive ? ' active' : ''}`}
                  style={{ cursor: 'pointer' }}
                >
                  <input
                    type="radio"
                    name="refreshControl"
                    checked={isActive}
                    onChange={onSelect}
                    style={{ display: 'none' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.25rem' }}>
                    <Clock size={12} style={{ color: isActive ? '#E8A020' : '#555555' }} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: isActive ? '#e0e0e0' : '#666666' }}>
                      {label}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.675rem', color: '#444444' }}>{sub}</p>
                </label>
              ))}
            </div>

            {(rules.viewRefreshMinutes || 0) > 0 || !(rules.autoRefreshSeconds || 0) ? (
              <select
                value={rules.viewRefreshMinutes || 0}
                onChange={(e) =>
                  onRulesChange({
                    ...rules,
                    viewRefreshMinutes: parseInt(e.target.value),
                    autoRefreshSeconds: 0,
                  })
                }
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
                onChange={(e) =>
                  onRulesChange({
                    ...rules,
                    viewRefreshMinutes: 0,
                    autoRefreshSeconds: parseInt(e.target.value),
                  })
                }
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

      <Divider />

      {/* ── Advanced Options ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        {/* Password */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.5rem' }}>
            <Lock size={12} style={{ color: '#E8A020' }} />
            <FieldLabel>Password Protection</FieldLabel>
          </div>
          <input
            type="password"
            value={rules.password || ''}
            onChange={(e) => onRulesChange({ ...rules, password: e.target.value })}
            className="input-field"
            placeholder="Leave blank for no password"
            autoComplete="new-password"
          />
        </div>

        {/* Webhook */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.5rem' }}>
            <Webhook size={12} style={{ color: '#E8A020' }} />
            <FieldLabel>Tamper Webhook</FieldLabel>
          </div>
          <input
            type="url"
            value={rules.webhookUrl || ''}
            onChange={(e) => onRulesChange({ ...rules, webhookUrl: e.target.value })}
            className="input-field"
            placeholder="https://discord.com/api/webhooks/…"
          />
        </div>

        {/* Server-only toggles */}
        {rules.storageMode === 'server' && (
          <>
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={rules.viewOnly || false}
                onChange={(e) => onRulesChange({ ...rules, viewOnly: e.target.checked })}
                style={{ marginTop: 1 }}
              />
              <div>
                <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#cccccc', marginBottom: '0.125rem' }}>
                  View Only Mode
                </p>
                <p style={{ fontSize: '0.7rem', color: '#555555', lineHeight: 1.4 }}>
                  Recipients can view but cannot download the file
                </p>
              </div>
            </label>

            <label className="toggle-row">
              <input
                type="checkbox"
                checked={rules.requireOtp || false}
                onChange={(e) => onRulesChange({ ...rules, requireOtp: e.target.checked })}
                style={{ marginTop: 1 }}
              />
              <div>
                <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#cccccc', marginBottom: '0.125rem' }}>
                  Require Email OTP (2FA)
                </p>
                <p style={{ fontSize: '0.7rem', color: '#555555', lineHeight: 1.4 }}>
                  A 6-digit code sent to recipient's email
                </p>
              </div>
            </label>

            {rules.requireOtp && (
              <div style={{ marginTop: '-0.25rem' }}>
                <input
                  type="email"
                  value={rules.otpEmail || ''}
                  onChange={(e) => onRulesChange({ ...rules, otpEmail: e.target.value })}
                  className="input-field"
                  placeholder="recipient@example.com"
                  required={rules.requireOtp}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default RulesPanel;
