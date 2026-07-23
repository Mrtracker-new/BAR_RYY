import React, { useState } from 'react';
import axios from '../config/axios';
import { Flame, Clock, AlertCircle, Loader } from 'lucide-react';

const T = {
  orange: '#C4461A', red: '#B33A2E', gold: '#B4791E',
  border: 'rgba(60,45,20,0.08)',
  text: '#2A2018', textS: '#55483A', textT: '#857358',
  mono: "'JetBrains Mono', monospace",
};

const PRESETS = [
  { label: '5 min',  secs: 300 },
  { label: '15 min', secs: 900 },
  { label: '1 hr',   secs: 3600 },
  { label: '24 hr',  secs: 86400 },
];

export function fmtSecs(s) {
  if (s < 60)    return `${s}s`;
  if (s < 3600)  return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

/**
 * CreateSessionForm — shared TTL picker + create button.
 *
 * Props:
 *   onCreated(data, ttlSeconds) — called on successful API response.
 *   compact                    — tighter spacing for the sidebar widget.
 */
export default function CreateSessionForm({ onCreated, compact = false }) {
  const [unit, setUnit]         = useState('minutes');
  const [value, setValue]       = useState(15);
  const [creating, setCreating] = useState(false);
  const [error, setError]       = useState(null);

  const ttlSeconds =
    unit === 'seconds' ? value
    : unit === 'minutes' ? value * 60
    : unit === 'hours'   ? value * 3600
    : value * 86400;

  const validTtl = ttlSeconds >= 30 && ttlSeconds <= 259200;

  const applyPreset = (secs) => {
    if (secs < 60)         { setUnit('seconds'); setValue(secs); }
    else if (secs < 3600)  { setUnit('minutes'); setValue(secs / 60); }
    else if (secs < 86400) { setUnit('hours');   setValue(secs / 3600); }
    else                   { setUnit('hours');   setValue(secs / 3600); }
  };

  const handleCreate = async () => {
    if (!validTtl) return;
    setCreating(true);
    setError(null);
    try {
      const { data } = await axios.post('/chat/create', { ttl_seconds: ttlSeconds });
      onCreated(data, ttlSeconds);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create session');
    } finally {
      setCreating(false);
    }
  };

  const gap      = compact ? '1rem'   : '1.25rem';
  const chipPad  = compact ? '0.3rem 0.75rem' : '0.4rem 1rem';
  const btnPad   = compact ? '0.875rem' : '1rem';
  const btnSize  = compact ? '0.9375rem' : '1rem';
  const iconSize = compact ? 14 : 15;
  const infoPad  = compact ? '0.625rem 0.875rem' : '0.75rem 1rem';
  const selectW  = compact ? 120 : 130;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>

      {/* Preset chips */}
      <div>
        <p style={{
          fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.07em',
          textTransform: 'uppercase', color: T.textT,
          marginBottom: compact ? '0.5rem' : '0.625rem',
        }}>
          Quick presets
        </p>
        <div style={{ display: 'flex', gap: compact ? '0.375rem' : '0.5rem', flexWrap: 'wrap' }}>
          {PRESETS.map(p => {
            const active = ttlSeconds === p.secs;
            return (
              <button
                key={p.secs}
                onClick={() => applyPreset(p.secs)}
                style={{
                  padding: chipPad, borderRadius: '999px',
                  fontSize: '0.8125rem', fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.15s ease',
                  background: active ? 'rgba(196,70,26,0.14)' : 'rgba(60,45,20,0.06)',
                  border: `1px solid ${active ? 'rgba(196,70,26,0.35)' : T.border}`,
                  color: active ? T.orange : T.textS,
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom TTL */}
      <div>
        <p style={{
          fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.07em',
          textTransform: 'uppercase', color: T.textT,
          marginBottom: compact ? '0.5rem' : '0.625rem',
        }}>
          Custom timer
        </p>
        <div style={{ display: 'flex', gap: compact ? '0.5rem' : '0.625rem' }}>
          <input
            type="number"
            min={1}
            max={9999}
            value={value}
            onChange={e => setValue(Math.max(1, parseInt(e.target.value) || 1))}
            className="input-field"
            style={{ flex: 1, fontFamily: T.mono, fontSize: compact ? '0.9rem' : '1rem' }}
          />
          <select
            value={unit}
            onChange={e => setUnit(e.target.value)}
            className="input-field"
            style={{ width: selectW }}
          >
            <option value="seconds">Seconds</option>
            <option value="minutes">Minutes</option>
            <option value="hours">Hours</option>
          </select>
        </div>
        {!validTtl && (
          <p style={{ fontSize: '0.75rem', color: T.red, marginTop: '0.375rem' }}>
            Must be between 30 seconds and 72 hours
          </p>
        )}
      </div>

      {/* Info row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: compact ? '0.5rem' : '0.625rem',
        padding: infoPad, borderRadius: compact ? '0.5rem' : '0.625rem',
        background: 'rgba(196,70,26,0.05)', border: '1px solid rgba(196,70,26,0.12)',
      }}>
        <Clock size={compact ? 13 : 14} style={{ color: T.orange, flexShrink: 0 }} />
        <p style={{ fontSize: '0.8125rem', color: T.textS, lineHeight: 1.5 }}>
          Session self-destructs in{' '}
          <strong style={{ color: T.orange }}>{fmtSecs(ttlSeconds)}</strong>.{' '}
          All messages vanish instantly — no recovery possible.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          display: 'flex', gap: '0.5rem',
          padding: compact ? '0.75rem' : '0.75rem 1rem',
          borderRadius: compact ? '0.5rem' : '0.625rem',
          background: 'rgba(179,58,46,0.07)', border: '1px solid rgba(179,58,46,0.15)',
        }}>
          <AlertCircle size={14} style={{ color: T.red, flexShrink: 0 }} />
          <p style={{ fontSize: '0.8125rem', color: '#8A2B22' }}>{error}</p>
        </div>
      )}

      {/* Create button */}
      <button
        onClick={handleCreate}
        disabled={creating || !validTtl}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
          padding: btnPad,
          borderRadius: compact ? '0.625rem' : '0.75rem',
          border: 'none',
          background: validTtl && !creating
            ? 'linear-gradient(160deg, #C4461A 0%, #9A3612 100%)'
            : 'rgba(60,45,20,0.08)',
          color: validTtl && !creating ? '#fff' : T.textT,
          fontWeight: 700, fontSize: btnSize,
          cursor: validTtl && !creating ? 'pointer' : 'not-allowed',
          transition: 'all 0.2s ease',
          boxShadow: validTtl && !creating ? '0 6px 24px rgba(196,70,26,0.25)' : 'none',
          letterSpacing: '-0.015em',
        }}
      >
        {creating
          ? <><Loader size={iconSize} style={{ animation: 'bar-spin 0.8s linear infinite' }} /> Creating session…</>
          : <><Flame size={iconSize} /> Create Burn Chat</>
        }
      </button>
    </div>
  );
}
