import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Flame, Copy, AlertCircle, CheckCircle2,
  ArrowRight, Shield, ArrowLeft, Zap, Lock, PackageOpen,
  Eye, EyeOff,
} from 'lucide-react';
import SEO from './SEO';
import { copyToClipboard } from '../utils/clipboard';
import CreateSessionForm from './CreateSessionForm';

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
    color: T.green,
    title: 'End-to-End Encrypted',
    desc: 'Messages are encrypted in your browser using AES-GCM-256 before leaving your device. The server only relays ciphertext — it cannot read your messages.',
  },
  {
    icon: Zap,
    color: '#C8893A',
    title: 'Real-Time',
    desc: 'Powered by WebSockets. Messages appear instantly across all participants with no polling.',
  },
  {
    icon: Shield,
    color: '#6B7FD4',
    title: 'Key Fingerprint',
    desc: 'A 6-char session code lets you verify the encryption key out-of-band. If codes differ across participants, leave immediately.',
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
  return (
    <motion.div {...fadeUp(0.3)} style={{
      background: T.s0,
      border: '1px solid rgba(249,115,22,0.18)',
      borderRadius: '1.25rem',
      overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(249,115,22,0.06)',
    }}>
      <div style={{ height: '1px', background: 'linear-gradient(90deg, rgba(249,115,22,0.6) 0%, rgba(249,115,22,0.15) 55%, transparent 100%)' }} />

      <div style={{ padding: '1.75rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

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

        <CreateSessionForm onCreated={onCreated} />
      </div>
    </motion.div>
  );
}


/* ── Result card ─────────────────────────────────────────────── */
function ResultCard({ result, ttlSeconds }) {
  const [copied, setCopied]         = useState('');
  const [copyFailed, setCopyFailed] = useState(false);
  const [pinVisible, setPinVisible] = useState(true);
  const pinTimerRef = useRef(null);
  const shareUrl = `${window.location.origin}/chat/${result.token}`;

  // Auto-hide the PIN after 30 s. Cancelled if user hides manually.
  useEffect(() => {
    pinTimerRef.current = setTimeout(() => setPinVisible(false), 30_000);
    return () => clearTimeout(pinTimerRef.current);
  }, []);

  const togglePin = () => {
    clearTimeout(pinTimerRef.current);
    setPinVisible(v => !v);
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
          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.625rem' }}>
            <Shield size={13} style={{ color: T.orange }} />
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
              {pinVisible ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>

          {/* PIN value */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span
              style={{
                fontFamily: T.mono, fontSize: '1.75rem', fontWeight: 700,
                letterSpacing: '0.2em', color: pinVisible ? T.text : T.textT,
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
                marginLeft: 'auto', width: 32, height: 32, borderRadius: '0.5rem',
                background: copied === 'pin' ? 'rgba(34,197,94,0.1)' : copyFailed ? 'rgba(239,68,68,0.08)' : 'rgba(249,115,22,0.1)',
                border: `1px solid ${copied === 'pin' ? 'rgba(34,197,94,0.2)' : copyFailed ? 'rgba(239,68,68,0.2)' : 'rgba(249,115,22,0.2)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: pinVisible ? 'pointer' : 'not-allowed',
                color: copied === 'pin' ? T.green : copyFailed ? T.red : pinVisible ? T.orange : T.textT,
                opacity: pinVisible ? 1 : 0.4,
                transition: 'all 0.2s',
              }}
            >
              {copied === 'pin' ? <CheckCircle2 size={13} /> : copyFailed ? <AlertCircle size={13} /> : <Copy size={13} />}
            </button>
          </div>

          {/* Warning */}
          <p style={{ fontSize: '0.6875rem', color: T.textS, marginTop: '0.5rem' }}>
            Enter this PIN when joining to claim the creator role.{' '}
            <strong style={{ color: T.orange }}>It cannot be recovered once you leave this page.</strong>
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
        title="Burn Chat — E2E Encrypted Ephemeral Messaging | BAR Web"
        description="End-to-end encrypted, ephemeral chat that permanently self-destructs when the timer expires. Messages are encrypted in your browser — the server never sees plaintext. No logs, no history, no traces."
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
                background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
                fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: T.green,
              }}>
                <span style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: T.green, boxShadow: '0 0 6px rgba(34,197,94,0.8)',
                  animation: 'pulse 2s infinite',
                }} />
                Ephemeral · E2E Encrypted
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
              End-to-end encrypted ephemeral messaging. Your browser encrypts every message
              before it leaves your device — the server only relays ciphertext.
              Everything is permanently destroyed when the timer ends.
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

          {/* E2E trust note */}
          <motion.p
            {...fadeUp(0.8)}
            style={{
              textAlign: 'center', marginTop: '0.75rem',
              fontSize: '0.7rem', color: T.textD, lineHeight: 1.6,
            }}
          >
            🔐 Messages are encrypted in your browser using{' '}
            <strong style={{ color: T.textT }}>AES-GCM-256</strong>{' '}with keys exchanged via{' '}
            <strong style={{ color: T.textT }}>ECDH P-256</strong>.{' '}
            The server never sees plaintext. Requires HTTPS.
          </motion.p>
        </div>
      </main>
    </div>
  );
}
