import React, { useState, useEffect, useRef } from 'react';
import axios from '../config/axios';
import { copyToClipboard } from '../utils/clipboard';
import {
  Flame, Copy, Link2, Clock, AlertCircle,
  CheckCircle2, Loader, ArrowRight, Shield, Eye, EyeOff,
} from 'lucide-react';

/* ── Design tokens (match App.jsx) ────────────────────────── */
const T = {
  gold: '#E8A020', green: '#22C55E', red: '#EF4444',
  bg: '#070707', s0: '#0d0d0d', s1: '#111111', s2: '#161616',
  border: 'rgba(255,255,255,0.06)', borderH: 'rgba(255,255,255,0.11)',
  text: '#efefef', textS: '#888888', textT: '#404040', textD: '#292929',
  mono: "'JetBrains Mono', monospace",
  orange: '#F97316',
};

const PRESETS = [
  { label: '5 min',  secs: 300 },
  { label: '15 min', secs: 900 },
  { label: '1 hr',   secs: 3600 },
  { label: '24 hr',  secs: 86400 },
];

function fmtSecs(s) {
  if (s < 60)   return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default function BurnChatCreate({ onCreated }) {
  const [unit, setUnit]       = useState('minutes');
  const [value, setValue]     = useState(15);
  const [creating, setCreating] = useState(false);
  const [error, setError]     = useState(null);
  const [result, setResult]   = useState(null);
  const [copied, setCopied]   = useState('');
  const [copyFailed, setCopyFailed] = useState(false);
  const [pinVisible, setPinVisible] = useState(true);
  const pinTimerRef = useRef(null);

  // Auto-hide the PIN after 30 s. Cleared if user hides it manually first.
  useEffect(() => {
    if (!result) return;
    pinTimerRef.current = setTimeout(() => setPinVisible(false), 30_000);
    return () => clearTimeout(pinTimerRef.current);
  }, [result]);

  const togglePin = () => {
    clearTimeout(pinTimerRef.current);
    setPinVisible(v => !v);
  };

  const ttlSeconds = unit === 'seconds' ? value
    : unit === 'minutes' ? value * 60
    : unit === 'hours'   ? value * 3600
    : value * 86400;

  const validTtl = ttlSeconds >= 30 && ttlSeconds <= 259200;

  const applyPreset = (secs) => {
    if (secs < 60)        { setUnit('seconds'); setValue(secs); }
    else if (secs < 3600) { setUnit('minutes'); setValue(secs / 60); }
    else if (secs < 86400){ setUnit('hours');   setValue(secs / 3600); }
    else                  { setUnit('hours');   setValue(secs / 3600); }
  };

  const handleCreate = async () => {
    if (!validTtl) return;
    setCreating(true); setError(null);
    try {
      const { data } = await axios.post('/chat/create', { ttl_seconds: ttlSeconds });
      setResult(data);
      if (onCreated) onCreated(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create session');
    } finally { setCreating(false); }
  };

  const copy = async (text, key) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(key);
      setCopyFailed(false);
      setTimeout(() => setCopied(''), 2000);
    } else {
      setCopyFailed(true);
      setTimeout(() => setCopyFailed(false), 4000);
    }
  };

  const shareUrl = result
    ? `${window.location.origin}/chat/${result.token}`
    : '';

  /* ── Result screen ─────────────────────────────────────── */
  if (result) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Success header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <CheckCircle2 size={15} style={{ color: T.green }} />
        </div>
        <div>
          <p style={{ fontSize: '0.875rem', fontWeight: 700, color: T.text, letterSpacing: '-0.02em' }}>
            Burn Chat created
          </p>
          <p style={{ fontSize: '0.75rem', color: T.textS }}>
            Burns in {fmtSecs(ttlSeconds)}
          </p>
        </div>
      </div>

      {/* Creator PIN — shown ONCE */}
      <div style={{
        borderRadius: '0.625rem', border: '1px solid rgba(249,115,22,0.25)',
        background: 'rgba(249,115,22,0.05)', padding: '0.875rem 1rem',
      }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.5rem' }}>
          <Shield size={12} style={{ color: T.orange }} />
          <span style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: T.orange }}>
            Creator PIN — shown once
          </span>
          <button
            onClick={togglePin}
            title={pinVisible ? 'Hide PIN' : 'Reveal PIN'}
            style={{
              marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
              color: T.textS, display: 'flex', alignItems: 'center', padding: '0.1rem',
            }}
          >
            {pinVisible ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        </div>

        {/* PIN value */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            style={{
              fontFamily: T.mono, fontSize: '1.5rem', fontWeight: 700,
              letterSpacing: '0.15em', color: pinVisible ? T.text : T.textT,
              userSelect: pinVisible ? 'text' : 'none',
              transition: 'color 0.2s',
            }}
          >
            {pinVisible ? result.creator_pin : '••••••'}
          </span>
          <button
            onClick={() => pinVisible && copy(result.creator_pin, 'pin')}
            title={pinVisible ? 'Copy PIN' : 'Reveal PIN to copy'}
            disabled={!pinVisible}
            style={{
              marginLeft: 'auto', width: 28, height: 28, borderRadius: '0.375rem',
              background: copied === 'pin' ? 'rgba(34,197,94,0.1)' : copyFailed ? 'rgba(239,68,68,0.08)' : 'rgba(249,115,22,0.1)',
              border: `1px solid ${copied === 'pin' ? 'rgba(34,197,94,0.2)' : copyFailed ? 'rgba(239,68,68,0.2)' : 'rgba(249,115,22,0.2)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: pinVisible ? 'pointer' : 'not-allowed',
              color: copied === 'pin' ? T.green : copyFailed ? T.red : pinVisible ? T.orange : T.textT,
              opacity: pinVisible ? 1 : 0.4,
            }}
          >
            {copied === 'pin' ? <CheckCircle2 size={11} /> : copyFailed ? <AlertCircle size={11} /> : <Copy size={11} />}
          </button>
        </div>

        {/* Warning */}
        <p style={{ fontSize: '0.6875rem', color: T.textS, marginTop: '0.375rem' }}>
          Enter this PIN when connecting to claim the creator role.
          {' '}<strong style={{ color: T.orange }}>It cannot be recovered once you leave this page.</strong>
        </p>
      </div>

      {/* Share link */}
      <div style={{
        borderRadius: '0.625rem', border: `1px solid ${T.border}`,
        background: T.s2, overflow: 'hidden',
      }}>
        <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.textT, padding: '0.5rem 0.875rem 0.25rem' }}>
          Share Link
        </p>
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 0.875rem 0.625rem', gap: '0.5rem' }}>
          <input readOnly value={shareUrl} style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            fontSize: '0.8125rem', color: T.textS, fontFamily: T.mono, minWidth: 0,
          }} />
          <button
            onClick={() => copy(shareUrl, 'url')}
            title="Copy share link"
            style={{
              flexShrink: 0, width: 28, height: 28, borderRadius: '0.375rem',
              background: copied === 'url' ? 'rgba(34,197,94,0.08)' : copyFailed ? 'rgba(239,68,68,0.08)' : 'rgba(232,160,32,0.08)',
              border: `1px solid ${copied === 'url' ? 'rgba(34,197,94,0.16)' : copyFailed ? 'rgba(239,68,68,0.16)' : 'rgba(232,160,32,0.16)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              color: copied === 'url' ? T.green : copyFailed ? T.red : T.gold,
            }}
          >
            {copied === 'url' ? <CheckCircle2 size={11} /> : copyFailed ? <AlertCircle size={11} /> : <Copy size={11} />}
          </button>
        </div>
      </div>

      {/* Copy-failed toast */}
      {copyFailed && (
        <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.5rem 0.75rem', borderRadius:'0.5rem', background:'rgba(239,68,68,0.07)', border:'1px solid rgba(239,68,68,0.15)' }}>
          <AlertCircle size={13} style={{ color: T.red, flexShrink: 0 }} />
          <p style={{ fontSize:'0.8125rem', color:'#fca5a5' }}>Copy failed — please select and copy manually.</p>
        </div>
      )}

      {/* Go to chat */}
      <a
        href={shareUrl}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
          padding: '0.8125rem', borderRadius: '0.625rem', textDecoration: 'none',
          background: 'linear-gradient(160deg,#F97316 0%,#C05010 100%)',
          color: '#fff', fontWeight: 700, fontSize: '0.875rem', letterSpacing: '-0.01em',
          boxShadow: '0 4px 16px rgba(249,115,22,0.25)',
        }}
      >
        <Flame size={14} />
        Open Burn Chat
        <ArrowRight size={13} />
      </a>
    </div>
  );

  /* ── Create form ───────────────────────────────────────── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* Flame icon header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <div style={{
          width: 28, height: 28, borderRadius: '0.4rem',
          background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Flame size={13} style={{ color: T.orange }} />
        </div>
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#c0c0c0', letterSpacing: '-0.02em' }}>
          Burn Chat
        </span>
        <span style={{
          marginLeft: 'auto', fontSize: '0.625rem', fontWeight: 700,
          letterSpacing: '0.06em', textTransform: 'uppercase',
          color: T.orange, background: 'rgba(249,115,22,0.08)',
          border: '1px solid rgba(249,115,22,0.16)', borderRadius: '999px',
          padding: '0.15rem 0.5rem',
        }}>
          Ephemeral
        </span>
      </div>

      <p style={{ fontSize: '0.8125rem', color: T.textS, lineHeight: 1.6 }}>
        Messages exist only in memory. When the timer expires everything is gone — no logs, no traces.
      </p>

      {/* Preset chips */}
      <div>
        <p style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: T.textT, marginBottom: '0.5rem' }}>
          Quick presets
        </p>
        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
          {PRESETS.map(p => {
            const active = ttlSeconds === p.secs;
            return (
              <button key={p.secs} onClick={() => applyPreset(p.secs)} style={{
                padding: '0.3rem 0.75rem', borderRadius: '999px', fontSize: '0.8125rem',
                fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s ease',
                background: active ? 'rgba(249,115,22,0.12)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${active ? 'rgba(249,115,22,0.3)' : T.border}`,
                color: active ? T.orange : T.textS,
              }}>
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom TTL */}
      <div>
        <p style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: T.textT, marginBottom: '0.5rem' }}>
          Custom timer
        </p>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="number"
            min={1} max={9999}
            value={value}
            onChange={e => setValue(Math.max(1, parseInt(e.target.value) || 1))}
            className="input-field"
            style={{ flex: 1, fontFamily: T.mono, fontSize: '0.9rem' }}
          />
          <select
            value={unit}
            onChange={e => setUnit(e.target.value)}
            className="input-field"
            style={{ width: 120 }}
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
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        padding: '0.625rem 0.875rem', borderRadius: '0.5rem',
        background: 'rgba(249,115,22,0.04)', border: '1px solid rgba(249,115,22,0.1)',
      }}>
        <Clock size={13} style={{ color: T.orange, flexShrink: 0 }} />
        <p style={{ fontSize: '0.8125rem', color: T.textS }}>
          Session self-destructs in <strong style={{ color: T.orange }}>{fmtSecs(ttlSeconds)}</strong>. All messages vanish instantly.
        </p>
      </div>

      {error && (
        <div style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)' }}>
          <AlertCircle size={14} style={{ color: T.red, flexShrink: 0 }} />
          <p style={{ fontSize: '0.8125rem', color: '#fca5a5' }}>{error}</p>
        </div>
      )}

      {/* Create button */}
      <button
        onClick={handleCreate}
        disabled={creating || !validTtl}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
          padding: '0.875rem', borderRadius: '0.625rem', border: 'none',
          background: validTtl && !creating
            ? 'linear-gradient(160deg,#F97316 0%,#C05010 100%)'
            : 'rgba(255,255,255,0.06)',
          color: validTtl && !creating ? '#fff' : T.textT,
          fontWeight: 700, fontSize: '0.9375rem', cursor: validTtl && !creating ? 'pointer' : 'not-allowed',
          transition: 'all 0.2s ease',
          boxShadow: validTtl && !creating ? '0 4px 16px rgba(249,115,22,0.2)' : 'none',
        }}
      >
        {creating ? <><Loader size={14} style={{ animation: 'bar-spin 0.8s linear infinite' }} /> Creating…</> : <><Flame size={14} /> Create Burn Chat</>}
      </button>
    </div>
  );
}
