import React, { useState, useEffect, useRef } from 'react';
import { copyToClipboard } from '../utils/clipboard';
import { Flame, Copy, AlertCircle, CheckCircle2, ArrowRight, Shield, Eye, EyeOff } from 'lucide-react';
import CreateSessionForm, { fmtSecs } from './CreateSessionForm';

/* ── Design tokens (match App.jsx) ────────────────────────── */
const T = {
  gold: '#E8A020', green: '#22C55E', red: '#EF4444',
  bg: '#070707', s0: '#0d0d0d', s1: '#111111', s2: '#161616',
  border: 'rgba(255,255,255,0.06)', borderH: 'rgba(255,255,255,0.11)',
  text: '#efefef', textS: '#888888', textT: '#404040', textD: '#292929',
  mono: "'JetBrains Mono', monospace",
  orange: '#F97316',
};


export default function BurnChatCreate({ onCreated }) {
  const [result, setResult]         = useState(null);
  const [ttlSeconds, setTtlSeconds] = useState(900);
  const [copied, setCopied]         = useState('');
  const [copyFailed, setCopyFailed] = useState(false);
  const [pinVisible, setPinVisible] = useState(true);
  const pinTimerRef = useRef(null);

  useEffect(() => {
    if (!result) return;
    pinTimerRef.current = setTimeout(() => setPinVisible(false), 30_000);
    return () => clearTimeout(pinTimerRef.current);
  }, [result]);

  const togglePin = () => {
    clearTimeout(pinTimerRef.current);
    setPinVisible(v => !v);
  };

  const handleCreated = (data, secs) => {
    setTtlSeconds(secs);
    setResult(data);
    if (onCreated) onCreated(data);
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
          <Flame size={13} style={{ color: '#F97316' }} />
        </div>
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#c0c0c0', letterSpacing: '-0.02em' }}>
          Burn Chat
        </span>
        <span style={{
          marginLeft: 'auto', fontSize: '0.625rem', fontWeight: 700,
          letterSpacing: '0.06em', textTransform: 'uppercase',
          color: '#F97316', background: 'rgba(249,115,22,0.08)',
          border: '1px solid rgba(249,115,22,0.16)', borderRadius: '999px',
          padding: '0.15rem 0.5rem',
        }}>Ephemeral</span>
      </div>

      <p style={{ fontSize: '0.8125rem', color: '#888888', lineHeight: 1.6 }}>
        Messages exist only in memory. When the timer expires everything is gone — no logs, no traces.
      </p>

      <CreateSessionForm onCreated={handleCreated} compact />
    </div>
  );
}
