import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import axios from '../config/axios';
import {
  Flame, Copy, Clock, AlertCircle, CheckCircle2,
  Loader, ArrowRight, Shield, ArrowLeft, Zap, Lock, PackageOpen,
} from 'lucide-react';
import SEO from './SEO';
import { copyToClipboard } from '../utils/clipboard';

/* ── Design tokens ───────────────────────────────────────────── */
const T = {
  orange: '#F97316', orangeD: '#C05010',
  green: '#22C55E', red: '#EF4444', gold: '#E8A020',
  bg: '#070707', s0: '#0d0d0d', s1: '#111111', s2: '#161616',
  border: 'rgba(255,255,255,0.06)', borderH: 'rgba(255,255,255,0.11)',
  text: '#efefef', textS: '#888888', textT: '#404040', textD: '#292929',
  mono: "'JetBrains Mono', monospace",
};

const EASE = [0.16, 1, 0.3, 1];
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: EASE, delay },
});

const PRESETS = [
  { label: '5 min',  secs: 300 },
  { label: '15 min', secs: 900 },
  { label: '1 hr',   secs: 3600 },
  { label: '24 hr',  secs: 86400 },
];

const FEATURES = [
  {
    icon: Flame,
    color: T.orange,
    title: 'Auto-Destructs',
    desc: 'The entire session — messages, participants, history — is permanently erased when the timer hits zero.',
  },
  {
    icon: Lock,
    color: '#C8893A',
    title: 'Zero Persistence',
    desc: 'Messages exist only in server memory. Nothing is written to disk. No logs. No database rows.',
  },
  {
    icon: Zap,
    color: T.green,
    title: 'Real-Time',
    desc: 'Powered by WebSockets. Messages appear instantly across all participants with no polling.',
  },
];

function fmtSecs(s) {
  if (s < 60)    return `${s}s`;
  if (s < 3600)  return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

/* ── Navbar ──────────────────────────────────────────────────── */
function Navbar({ onBack }) {
  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      height: 52, display: 'flex', alignItems: 'center',
      background: 'rgba(7,7,7,0.92)',
      backdropFilter: 'blur(20px) saturate(160%)',
      WebkitBackdropFilter: 'blur(20px) saturate(160%)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{
        maxWidth: 800, margin: '0 auto', padding: '0 1.5rem',
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: 26, height: 26, borderRadius: '0.4rem',
            background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Flame size={12} style={{ color: T.orange }} />
          </div>
          <span style={{ fontSize: '0.9rem', fontWeight: 600, letterSpacing: '-0.025em', color: '#d0d0d0' }}>
            Burn<span style={{ color: '#303030', fontWeight: 400 }}> Chat</span>
          </span>
        </div>

        {/* Back */}
        <button
          onClick={onBack}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
            padding: '0.3125rem 0.75rem', fontSize: '0.8125rem', fontWeight: 500,
            color: T.textS, background: 'transparent',
            border: `1px solid ${T.border}`, borderRadius: '999px',
            cursor: 'pointer', transition: 'all 0.2s ease', letterSpacing: '-0.01em',
          }}
          onMouseOver={e => { e.currentTarget.style.color = T.text; e.currentTarget.style.borderColor = T.borderH; }}
          onMouseOut={e => { e.currentTarget.style.color = T.textS; e.currentTarget.style.borderColor = T.border; }}
        >
          <ArrowLeft size={11} /> BAR Web
        </button>
      </div>
    </nav>
  );
}

/* ── Feature card ────────────────────────────────────────────── */
function FeatureCard({ icon: Icon, color, title, desc, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay: 0.55 + index * 0.08 }}
      style={{
        flex: '1 1 180px',
        padding: '1.125rem',
        borderRadius: '0.875rem',
        border: `1px solid ${T.border}`,
        background: T.s0,
        display: 'flex', flexDirection: 'column', gap: '0.625rem',
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: '0.5rem',
        background: `${color}12`, border: `1px solid ${color}22`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={16} style={{ color }} />
      </div>
      <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#d0d0d0', letterSpacing: '-0.02em' }}>{title}</p>
      <p style={{ fontSize: '0.8rem', color: T.textS, lineHeight: 1.6 }}>{desc}</p>
    </motion.div>
  );
}

/* ── Create form card ────────────────────────────────────────── */
function CreateCard({ onCreated }) {
  const [unit, setUnit]         = useState('minutes');
  const [value, setValue]       = useState(15);
  const [creating, setCreating] = useState(false);
  const [error, setError]       = useState(null);

  const ttlSeconds = unit === 'seconds' ? value
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
    setCreating(true); setError(null);
    try {
      const { data } = await axios.post('/chat/create', { ttl_seconds: ttlSeconds });
      onCreated(data, ttlSeconds);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create session');
    } finally { setCreating(false); }
  };

  return (
    <motion.div {...fadeUp(0.3)} style={{
      background: T.s0,
      border: '1px solid rgba(249,115,22,0.18)',
      borderRadius: '1.25rem',
      overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(249,115,22,0.06)',
    }}>
      {/* Top accent */}
      <div style={{ height: '1px', background: 'linear-gradient(90deg, rgba(249,115,22,0.6) 0%, rgba(249,115,22,0.15) 55%, transparent 100%)' }} />

      <div style={{ padding: '1.75rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div style={{
            width: 36, height: 36, borderRadius: '0.5rem',
            background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Flame size={16} style={{ color: T.orange }} />
          </div>
          <div>
            <p style={{ fontSize: '0.9375rem', fontWeight: 700, color: T.text, letterSpacing: '-0.025em' }}>
              Configure Session
            </p>
            <p style={{ fontSize: '0.75rem', color: T.textS }}>Set how long before this chat self-destructs</p>
          </div>
        </div>

        {/* Preset chips */}
        <div>
          <p style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: T.textT, marginBottom: '0.625rem' }}>
            Quick presets
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {PRESETS.map(p => {
              const active = ttlSeconds === p.secs;
              return (
                <button key={p.secs} onClick={() => applyPreset(p.secs)} style={{
                  padding: '0.4rem 1rem', borderRadius: '999px',
                  fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  background: active ? 'rgba(249,115,22,0.14)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${active ? 'rgba(249,115,22,0.35)' : T.border}`,
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
          <p style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: T.textT, marginBottom: '0.625rem' }}>
            Custom timer
          </p>
          <div style={{ display: 'flex', gap: '0.625rem' }}>
            <input
              type="number" min={1} max={9999}
              value={value}
              onChange={e => setValue(Math.max(1, parseInt(e.target.value) || 1))}
              className="input-field"
              style={{ flex: 1, fontFamily: T.mono, fontSize: '1rem' }}
            />
            <select
              value={unit}
              onChange={e => setUnit(e.target.value)}
              className="input-field"
              style={{ width: 130 }}
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
          display: 'flex', alignItems: 'center', gap: '0.625rem',
          padding: '0.75rem 1rem', borderRadius: '0.625rem',
          background: 'rgba(249,115,22,0.05)', border: '1px solid rgba(249,115,22,0.12)',
        }}>
          <Clock size={14} style={{ color: T.orange, flexShrink: 0 }} />
          <p style={{ fontSize: '0.8125rem', color: T.textS, lineHeight: 1.5 }}>
            Session self-destructs in{' '}
            <strong style={{ color: T.orange }}>{fmtSecs(ttlSeconds)}</strong>.{' '}
            All messages vanish instantly — no recovery possible.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem 1rem', borderRadius: '0.625rem', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)' }}>
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
            padding: '1rem', borderRadius: '0.75rem', border: 'none',
            background: validTtl && !creating
              ? 'linear-gradient(160deg, #F97316 0%, #C05010 100%)'
              : 'rgba(255,255,255,0.06)',
            color: validTtl && !creating ? '#fff' : T.textT,
            fontWeight: 700, fontSize: '1rem',
            cursor: validTtl && !creating ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s ease',
            boxShadow: validTtl && !creating ? '0 6px 24px rgba(249,115,22,0.25)' : 'none',
            letterSpacing: '-0.015em',
          }}
        >
          {creating
            ? <><Loader size={15} style={{ animation: 'bar-spin 0.8s linear infinite' }} /> Creating session…</>
            : <><Flame size={15} /> Create Burn Chat</>
          }
        </button>
      </div>
    </motion.div>
  );
}

/* ── Result card ─────────────────────────────────────────────── */
function ResultCard({ result, ttlSeconds }) {
  const [copied, setCopied]         = useState('');
  const [copyFailed, setCopyFailed] = useState(false);
  const shareUrl = `${window.location.origin}/chat/${result.token}`;

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

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      style={{
        background: T.s0,
        border: '1px solid rgba(34,197,94,0.2)',
        borderRadius: '1.25rem',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(34,197,94,0.06)',
      }}
    >
      <div style={{ height: '1px', background: 'linear-gradient(90deg, rgba(34,197,94,0.5) 0%, rgba(34,197,94,0.12) 55%, transparent 100%)' }} />

      <div style={{ padding: '1.75rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* Success header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <CheckCircle2 size={18} style={{ color: T.green }} />
          </div>
          <div>
            <p style={{ fontSize: '1rem', fontWeight: 700, color: T.text, letterSpacing: '-0.025em' }}>
              Session Created
            </p>
            <p style={{ fontSize: '0.75rem', color: T.textS }}>
              Burns in <strong style={{ color: T.orange }}>{fmtSecs(ttlSeconds)}</strong>
            </p>
          </div>
        </div>

        {/* Creator PIN */}
        <div style={{
          borderRadius: '0.75rem', border: '1px solid rgba(249,115,22,0.25)',
          background: 'rgba(249,115,22,0.05)', padding: '1rem 1.125rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.625rem' }}>
            <Shield size={13} style={{ color: T.orange }} />
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: T.orange }}>
              Creator PIN — shown once
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontFamily: T.mono, fontSize: '1.75rem', fontWeight: 700, color: T.text, letterSpacing: '0.2em' }}>
              {result.creator_pin}
            </span>
            <button
              onClick={() => copy(result.creator_pin, 'pin')}
              title="Copy PIN"
              style={{
                marginLeft: 'auto', width: 32, height: 32, borderRadius: '0.5rem',
                background: copied === 'pin' ? 'rgba(34,197,94,0.1)' : copyFailed ? 'rgba(239,68,68,0.08)' : 'rgba(249,115,22,0.1)',
                border: `1px solid ${copied === 'pin' ? 'rgba(34,197,94,0.2)' : copyFailed ? 'rgba(239,68,68,0.2)' : 'rgba(249,115,22,0.2)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: copied === 'pin' ? T.green : copyFailed ? T.red : T.orange,
                transition: 'all 0.2s',
              }}
            >
              {copied === 'pin' ? <CheckCircle2 size={13} /> : copyFailed ? <AlertCircle size={13} /> : <Copy size={13} />}
            </button>
          </div>
          <p style={{ fontSize: '0.6875rem', color: T.textS, marginTop: '0.5rem' }}>
            Enter this PIN when joining to claim the creator role. Keep it private.
          </p>
        </div>

        {/* Share link */}
        <div style={{
          borderRadius: '0.75rem', border: `1px solid ${T.border}`,
          background: T.s2, overflow: 'hidden',
        }}>
          <p style={{
            fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: T.textT,
            padding: '0.625rem 1rem 0.25rem',
          }}>
            Share Link
          </p>
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 1rem 0.75rem', gap: '0.5rem' }}>
            <input
              readOnly value={shareUrl}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                fontSize: '0.8125rem', color: T.textS, fontFamily: T.mono, minWidth: 0,
              }}
            />
            <button
              onClick={() => copy(shareUrl, 'url')}
              title="Copy share link"
              style={{
                flexShrink: 0, width: 30, height: 30, borderRadius: '0.5rem',
                background: copied === 'url' ? 'rgba(34,197,94,0.08)' : copyFailed ? 'rgba(239,68,68,0.08)' : 'rgba(232,160,32,0.08)',
                border: `1px solid ${copied === 'url' ? 'rgba(34,197,94,0.18)' : copyFailed ? 'rgba(239,68,68,0.18)' : 'rgba(232,160,32,0.18)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: copied === 'url' ? T.green : copyFailed ? T.red : T.gold,
                transition: 'all 0.2s',
              }}
            >
              {copied === 'url' ? <CheckCircle2 size={12} /> : copyFailed ? <AlertCircle size={12} /> : <Copy size={12} />}
            </button>
          </div>
        </div>

        {/* Copy-failed toast */}
        {copyFailed && (
          <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.625rem 0.875rem', borderRadius:'0.625rem', background:'rgba(239,68,68,0.07)', border:'1px solid rgba(239,68,68,0.15)' }}>
            <AlertCircle size={13} style={{ color: T.red, flexShrink: 0 }} />
            <p style={{ fontSize:'0.8125rem', color:'#fca5a5' }}>Copy failed — please select and copy the link manually.</p>
          </div>
        )}

        {/* Open button */}
        <a
          href={shareUrl}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.625rem',
            padding: '1rem', borderRadius: '0.75rem', textDecoration: 'none',
            background: 'linear-gradient(160deg, #F97316 0%, #C05010 100%)',
            color: '#fff', fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.015em',
            boxShadow: '0 6px 24px rgba(249,115,22,0.28)',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          }}
          onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(249,115,22,0.35)'; }}
          onMouseOut={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 6px 24px rgba(249,115,22,0.28)'; }}
        >
          <Flame size={16} />
          Open Burn Chat
          <ArrowRight size={15} />
        </a>
      </div>
    </motion.div>
  );
}

/* ── Main page ───────────────────────────────────────────────── */
export default function BurnChatLandingPage() {
  const navigate = useNavigate();
  const [result, setResult]       = useState(null);
  const [ttlSeconds, setTtlSecs]  = useState(null);

  const handleCreated = (data, secs) => {
    setResult(data);
    setTtlSecs(secs);
  };

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text, overflowX: 'hidden', position: 'relative' }}>
      <SEO
        title="Burn Chat — Ephemeral Zero-Trace Messaging | BAR Web"
        description="Create an encrypted, ephemeral chat session that permanently self-destructs when the timer expires. No logs, no history, no traces."
      />

      {/* Ambient background */}
      <div aria-hidden="true" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div className="bg-grid" style={{ position: 'absolute', inset: 0, opacity: 0.3 }} />
        <div style={{
          position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)',
          width: '50vw', height: '50vw', maxWidth: 600, maxHeight: 600, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(249,115,22,0.06) 0%, transparent 65%)',
        }} />
      </div>

      <Navbar onBack={() => navigate('/')} />

      <main style={{ position: 'relative', zIndex: 1, paddingTop: '52px' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '3.5rem 1.25rem 5rem' }}>

          {/* Hero text */}
          <motion.div {...fadeUp(0.05)} style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            {/* Badge */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.3125rem 0.875rem', borderRadius: '999px',
                background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)',
                fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: T.orange,
              }}>
                <span style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: T.orange, boxShadow: '0 0 6px rgba(249,115,22,0.8)',
                  animation: 'pulse 2s infinite',
                }} />
                Ephemeral · Zero Trace
              </span>
            </div>

            <h1 style={{
              fontSize: 'clamp(2.5rem, 7vw, 4rem)',
              fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 0.95,
              marginBottom: '1rem',
            }}>
              <span style={{
                display: 'block',
                background: 'linear-gradient(135deg, #FB923C 0%, #F97316 45%, #EA6010 100%)',
                WebkitBackgroundClip: 'text', backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                Burn Chat
              </span>
              <span style={{ display: 'block', color: '#282828', marginTop: '0.04em' }}>
                Burns When Done
              </span>
            </h1>

            <p style={{
              fontSize: 'clamp(0.9rem, 2vw, 1rem)',
              color: T.textS, lineHeight: 1.7, maxWidth: '34ch', margin: '0 auto',
            }}>
              Zero-trace encrypted messaging. The entire session —
              every message, every participant — is permanently destroyed when the timer ends.
            </p>
          </motion.div>

          {/* Form or Result */}
          {result
            ? <ResultCard result={result} ttlSeconds={ttlSeconds} />
            : <CreateCard onCreated={handleCreated} />
          }

          {/* Feature cards */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '2rem' }}>
            {FEATURES.map((f, i) => <FeatureCard key={i} {...f} index={i} />)}
          </div>

          {/* Footer note */}
          <motion.p
            {...fadeUp(0.7)}
            style={{
              textAlign: 'center', marginTop: '2.5rem',
              fontSize: '0.75rem', color: T.textD, lineHeight: 1.6,
            }}
          >
            Share the link with participants. Only the creator who holds the PIN has moderator access.
            Once the timer expires the room cannot be recovered by anyone — including us.
          </motion.p>
        </div>
      </main>
    </div>
  );
}
