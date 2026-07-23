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

/* ─────────────────────────────────────────────────────────────
   DESIGN TOKENS
   Updated to match index.css and App.jsx token system.
   Key changes: textT #404040→#636363, textD #292929→#505050
───────────────────────────────────────────────────────────── */
const T = {
  orange:       '#C4461A',
  orangeD:      '#9A3612',
  orangeDim:    'rgba(196,70,26,0.09)',
  orangeBorder: 'rgba(196,70,26,0.28)',
  green:        '#3F7D3A',
  greenDim:     'rgba(63,125,58,0.10)',
  greenBorder:  'rgba(63,125,58,0.28)',
  red:          '#B33A2E',
  gold:         '#B4791E',
  goldDim:      'rgba(180,121,30,0.12)',
  goldBorder:   'rgba(180,121,30,0.32)',

  /* Backgrounds — cream paper */
  bg:       '#EDE3CE',
  surface0: '#FAF4E6',
  surface1: '#FFFDF6',
  surface2: '#F1E8D3',

  /* Text — ink on cream */
  textPrimary:   '#2A2018',
  textSecondary: '#55483A',
  textTertiary:  '#857358',
  textDim:       '#A2916F',

  /* Borders — pencil lines */
  border:      'rgba(60,45,20,0.16)',
  borderHover: 'rgba(60,45,20,0.30)',

  /* Fonts */
  mono: "'JetBrains Mono', monospace",
  hand: "'Caveat', 'Patrick Hand', cursive",
  print: "'Patrick Hand', cursive",

  /* Navbar height token */
  navbarHeight: 56,
};

const EASE = [0.16, 1, 0.3, 1];
const fadeUp = (delay = 0) => ({
  initial:    { opacity: 0, y: 18 },
  animate:    { opacity: 1, y: 0  },
  transition: { duration: 0.6, ease: EASE, delay },
});

/* ─────────────────────────────────────────────────────────────
   FEATURE DATA
───────────────────────────────────────────────────────────── */
const FEATURES = [
  {
    icon:  Flame,
    color: T.orange,
    title: 'Auto-Destructs',
    desc:  'The entire session — messages, participants, history — is permanently erased when the timer hits zero.',
  },
  {
    icon:  Lock,
    color: T.green,
    title: 'End-to-End Encrypted',
    desc:  'Messages are encrypted in your browser using AES-GCM-256 before leaving your device. The server only relays ciphertext.',
  },
  {
    icon:  Zap,
    color: '#8F5E16',
    title: 'Real-Time',
    desc:  'Powered by WebSockets. Messages appear instantly across all participants with no polling.',
  },
  {
    icon:  Shield,
    color: '#2C4A6E',
    title: 'Key Fingerprint',
    desc:  'A 6-char session code lets you verify the encryption key out-of-band. If codes differ across participants, leave immediately.',
  },
];

function fmtSecs(s) {
  if (s < 60)    return `${s}s`;
  if (s < 3600)  return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

/* ─────────────────────────────────────────────────────────────
   NAVBAR
   Fixed. Height 56px (matches --navbar-height token).
   maxWidth raised from 800 → 1100 to match AppNav.
───────────────────────────────────────────────────────────── */
function Navbar({ onBack }) {
  return (
    <>
      <style>{`
        .bc-navbar {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          height: ${T.navbarHeight}px;
          display: flex; align-items: center;
          background: rgba(250,244,230,0.92);
          backdrop-filter: blur(22px) saturate(160%);
          -webkit-backdrop-filter: blur(22px) saturate(160%);
          border-bottom: 1px solid rgba(60,45,20,0.24);
        }
        @media (min-width: 768px) {
          .bc-navbar { height: 60px; }
        }
        .bc-back-btn {
          display: inline-flex; align-items: center; gap: 0.375rem;
          /* 40px min — secondary action touch target */
          min-height: 40px;
          padding: 0.4375rem 1rem;
          font-family: inherit;
          font-size: 0.875rem; font-weight: 500; letter-spacing: -0.01em;
          color: ${T.textTertiary};
          background: transparent;
          border: 1px solid ${T.border};
          border-radius: 999px; cursor: pointer;
          transition: color 0.18s ease, border-color 0.18s ease;
        }
        .bc-back-btn:hover {
          color: ${T.textPrimary};
          border-color: ${T.borderHover};
        }
      `}</style>

      <nav className="bc-navbar" role="navigation" aria-label="Burn Chat navigation">
        <div
          style={{
            /* maxWidth raised from 800 → 1100 to match AppNav/LandingPage */
            maxWidth: 1100, margin: '0 auto',
            padding: '0 clamp(1rem, 4vw, 1.5rem)',
            width: '100%', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', gap: '0.75rem',
          }}
        >
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            <div
              style={{
                width: 30, height: 30, borderRadius: '0.45rem',
                background: T.orangeDim, border: `1px solid ${T.orangeBorder}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Flame size={15} style={{ color: T.orange }} />
            </div>
            <span
              style={{
                fontFamily: T.hand,
                fontSize: '1.5rem',
                fontWeight: 700,
                letterSpacing: '0.01em',
                color: T.textPrimary,
                lineHeight: 1,
              }}
            >
              Burn<span style={{ color: T.orange, fontWeight: 400 }}>Chat</span>
            </span>
          </div>

          {/* Back button */}
          <button onClick={onBack} className="bc-back-btn" aria-label="Back to BAR Web">
            <ArrowLeft size={13} />
            BAR Web
          </button>
        </div>
      </nav>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   FEATURE CARD
   Changes:
   - flex: '1 1 180px' → CSS grid (auto-fit, minmax(220px, 1fr))
     applied at parent level — each card now fills grid cell
   - icon box: 36×36 → 40×40
   - icon: size={16} → size={18}
   - title: 0.875rem → 1rem (T.textPrimary)
   - desc: 0.8rem → 0.875rem (14px minimum)
───────────────────────────────────────────────────────────── */
function FeatureCard({ icon: Icon, color, title, desc, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay: 0.55 + index * 0.08 }}
      style={{
        padding: '1.25rem',                    /* slightly increased from 1.125rem */
        borderRadius: '0.875rem',
        border: `1px solid ${T.border}`,
        background: T.surface0,
        display: 'flex', flexDirection: 'column', gap: '0.75rem',
        minWidth: 0,                            /* prevent overflow in grid */
      }}
    >
      {/* Icon box: 40×40 (raised from 36×36) */}
      <div
        style={{
          width: 40, height: 40, borderRadius: '0.5rem', flexShrink: 0,  /* raised from 36×36 */
          background: `${color}12`, border: `1px solid ${color}28`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Icon size={18} style={{ color }} />    {/* raised from size={16} */}
      </div>

      {/* Title: 1rem / T.textPrimary (raised from 0.875rem / #d0d0d0) */}
      <p
        style={{
          fontSize: '1rem',                     /* raised from 0.875rem */
          fontWeight: 600, letterSpacing: '-0.02em',
          color: T.textPrimary,                 /* raised from #d0d0d0 */
          lineHeight: 1.3,
        }}
      >
        {title}
      </p>

      {/* Description: 0.875rem (14px) / T.textSecondary (raised from 0.8rem / T.textS) */}
      <p
        style={{
          fontSize: '0.875rem',                 /* raised from 0.8rem — below 14px minimum */
          color: T.textSecondary,               /* #a0a0a0 — raised from #888888 */
          lineHeight: 1.65, margin: 0,
        }}
      >
        {desc}
      </p>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────
   CREATE FORM CARD
   Changes:
   - padding: '1.75rem 2rem' → '1.5rem clamp(1rem, 4vw, 2rem)'
     On 320px: 1.5rem top + 16px sides = 288px content width ✓
───────────────────────────────────────────────────────────── */
function CreateCard({ onCreated }) {
  return (
    <motion.div
      {...fadeUp(0.3)}
      style={{
        background: T.surface0,
        border: '1px solid rgba(196,70,26,0.18)',
        borderRadius: '1.25rem',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(196,70,26,0.06)',
      }}
    >
      {/* Orange accent top border */}
      <div
        style={{
          height: '1px',
          background: 'linear-gradient(90deg, rgba(196,70,26,0.65) 0%, rgba(196,70,26,0.15) 55%, transparent 100%)',
        }}
      />

      {/* Card body — responsive padding */}
      <div
        style={{
          padding: '1.5rem clamp(1rem, 4vw, 2rem)',  /* was '1.75rem 2rem' — too cramped on 320px */
          display: 'flex', flexDirection: 'column', gap: '1.25rem',
        }}
      >
        {/* Card header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div
            style={{
              width: 38, height: 38, borderRadius: '0.5rem', flexShrink: 0,
              background: T.orangeDim, border: `1px solid ${T.orangeBorder}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Flame size={17} style={{ color: T.orange }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                fontSize: '0.9375rem', fontWeight: 700,
                color: T.textPrimary, letterSpacing: '-0.025em',
                lineHeight: 1.3,
              }}
            >
              Configure Session
            </p>
            <p style={{ fontSize: '0.8125rem', color: T.textSecondary, marginTop: '0.1rem' }}>
              Set how long before this chat self-destructs
            </p>
          </div>
        </div>

        <CreateSessionForm onCreated={onCreated} />
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────
   RESULT CARD
   Changes:
   - padding: '1.75rem 2rem' → '1.5rem clamp(1rem, 4vw, 2rem)'
   - PIN font: 1.75rem letterSpacing 0.2em
     → clamp(1.25rem, 4vw, 1.75rem) letterSpacing 0.15em
     On 320px: 20px font, 0.15em tracking = fits 6 digits
   - Share link input: 0.8125rem → 0.875rem (14px minimum)
   - Share link label: raised to T.textTertiary
   - PIN warning text: T.textS → T.textSecondary (better contrast)
───────────────────────────────────────────────────────────── */
function ResultCard({ result, ttlSeconds }) {
  const [copied, setCopied]         = useState('');
  const [copyFailed, setCopyFailed] = useState(false);
  const [pinVisible, setPinVisible] = useState(true);
  const pinTimerRef                 = useRef(null);
  const shareUrl = `${window.location.origin}/chat/${result.token}`;

  /* Auto-hide PIN after 30 s */
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
        background: T.surface0,
        border: `1px solid ${T.greenBorder}`,
        borderRadius: '1.25rem',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(63,125,58,0.06)',
      }}
    >
      {/* Green accent top border */}
      <div
        style={{
          height: '1px',
          background: 'linear-gradient(90deg, rgba(63,125,58,0.55) 0%, rgba(63,125,58,0.12) 55%, transparent 100%)',
        }}
      />

      {/* Card body — responsive padding */}
      <div
        style={{
          padding: '1.5rem clamp(1rem, 4vw, 2rem)',   /* was '1.75rem 2rem' */
          display: 'flex', flexDirection: 'column', gap: '1.25rem',
        }}
      >
        {/* ── Success header ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
              background: T.greenDim, border: `1px solid ${T.greenBorder}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <CheckCircle2 size={20} style={{ color: T.green }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                fontSize: '1rem', fontWeight: 700,
                color: T.textPrimary, letterSpacing: '-0.025em',
              }}
            >
              Session Created
            </p>
            <p style={{ fontSize: '0.8125rem', color: T.textSecondary }}>
              Burns in <strong style={{ color: T.orange }}>{fmtSecs(ttlSeconds)}</strong>
            </p>
          </div>
        </div>

        {/* ── Creator PIN box ── */}
        <div
          style={{
            borderRadius: '0.75rem',
            border: '1px solid rgba(196,70,26,0.25)',
            background: 'rgba(196,70,26,0.05)',
            padding: '1rem clamp(0.875rem, 3vw, 1.125rem)',
          }}
        >
          {/* Header row: label + eye toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.625rem' }}>
            <Shield size={13} style={{ color: T.orange, flexShrink: 0 }} />
            <span
              style={{
                fontSize: '0.6875rem', fontWeight: 700,
                letterSpacing: '0.07em', textTransform: 'uppercase',
                color: T.orange,
              }}
            >
              Creator PIN — shown once
            </span>
            <button
              onClick={togglePin}
              title={pinVisible ? 'Hide PIN' : 'Reveal PIN'}
              aria-label={pinVisible ? 'Hide PIN' : 'Reveal PIN'}
              style={{
                marginLeft: 'auto', background: 'none', border: 'none',
                cursor: 'pointer', color: T.textTertiary,
                display: 'flex', alignItems: 'center', padding: '0.1rem',
                flexShrink: 0,
              }}
            >
              {pinVisible ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>

          {/* PIN value row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
            <span
              style={{
                fontFamily: T.mono,
                /* Fluid: 20px on 320px → 28px on 560px+ (was hardcoded 1.75rem = 28px) */
                fontSize: 'clamp(1.25rem, 4vw, 1.75rem)',
                fontWeight: 700,
                /* tighter tracking on narrow screens (was 0.2em — cramped at 20px) */
                letterSpacing: '0.15em',
                color: pinVisible ? T.textPrimary : T.textTertiary,
                userSelect: pinVisible ? 'text' : 'none',
                transition: 'color 0.2s ease',
                minWidth: 0,
              }}
            >
              {pinVisible ? result.creator_pin : '••••••'}
            </span>

            {/* Copy PIN button */}
            <button
              onClick={() => pinVisible && copy(result.creator_pin, 'pin')}
              title={pinVisible ? 'Copy PIN' : 'Reveal PIN to copy'}
              aria-label="Copy creator PIN"
              disabled={!pinVisible}
              style={{
                marginLeft: 'auto', flexShrink: 0,
                width: 34, height: 34, borderRadius: '0.5rem',
                background: copied === 'pin'
                  ? T.greenDim
                  : copyFailed ? 'rgba(179,58,46,0.08)' : T.orangeDim,
                border: `1px solid ${copied === 'pin'
                  ? T.greenBorder
                  : copyFailed ? 'rgba(179,58,46,0.20)' : T.orangeBorder}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: pinVisible ? 'pointer' : 'not-allowed',
                color: copied === 'pin' ? T.green : copyFailed ? T.red : pinVisible ? T.orange : T.textTertiary,
                opacity: pinVisible ? 1 : 0.4,
                transition: 'all 0.18s ease',
              }}
            >
              {copied === 'pin'
                ? <CheckCircle2 size={14} />
                : copyFailed ? <AlertCircle size={14} /> : <Copy size={14} />}
            </button>
          </div>

          {/* Warning text — raised from T.textS to T.textSecondary */}
          <p style={{ fontSize: '0.75rem', color: T.textSecondary, marginTop: '0.5rem', lineHeight: 1.55 }}>
            Enter this PIN when joining to claim the creator role.{' '}
            <strong style={{ color: T.orange }}>It cannot be recovered once you leave this page.</strong>
          </p>
        </div>

        {/* ── Share link block ── */}
        <div
          style={{
            borderRadius: '0.75rem', border: `1px solid ${T.border}`,
            background: T.surface2, overflow: 'hidden',
          }}
        >
          {/* Label */}
          <p
            style={{
              fontSize: 'var(--text-2xs)',         /* 11px UPPERCASE label */
              fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: T.textTertiary,               /* raised from T.textT (#404040) */
              padding: '0.625rem 1rem 0.25rem',
            }}
          >
            Share Link
          </p>

          {/* Input + copy button */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 1rem 0.75rem', gap: '0.5rem' }}>
            <input
              readOnly
              value={shareUrl}
              aria-label="Session share URL"
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                fontSize: '0.875rem',              /* raised from 0.8125rem (13px < minimum) */
                color: T.textSecondary,
                fontFamily: T.mono,               /* monospace for URLs */
                minWidth: 0,
              }}
            />
            <button
              onClick={() => copy(shareUrl, 'url')}
              title="Copy share link"
              aria-label="Copy session link"
              style={{
                flexShrink: 0, width: 32, height: 32, borderRadius: '0.5rem',
                background: copied === 'url'
                  ? T.greenDim
                  : copyFailed ? 'rgba(179,58,46,0.08)' : T.goldDim,
                border: `1px solid ${copied === 'url'
                  ? T.greenBorder
                  : copyFailed ? 'rgba(179,58,46,0.18)' : T.goldBorder}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                color: copied === 'url' ? T.green : copyFailed ? T.red : T.gold,
                transition: 'all 0.18s ease',
              }}
            >
              {copied === 'url'
                ? <CheckCircle2 size={13} />
                : copyFailed ? <AlertCircle size={13} /> : <Copy size={13} />}
            </button>
          </div>
        </div>

        {/* Copy-failed inline alert */}
        {copyFailed && (
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.625rem 0.875rem', borderRadius: '0.625rem',
              background: 'rgba(179,58,46,0.07)', border: '1px solid rgba(179,58,46,0.15)',
            }}
          >
            <AlertCircle size={14} style={{ color: T.red, flexShrink: 0 }} />
            <p style={{ fontSize: '0.8125rem', color: '#fca5a5' }}>
              Copy failed — please select and copy the link manually.
            </p>
          </div>
        )}

        {/* Open Burn Chat primary CTA */}
        <a
          href={shareUrl}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.625rem',
            /* 52px height — primary CTA deserves more weight */
            padding: '0.9375rem 1rem',
            borderRadius: '0.75rem', textDecoration: 'none',
            background: 'linear-gradient(160deg, #C4461A 0%, #9A3612 100%)',
            color: '#FFF8EA', fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.015em',
            boxShadow: '0 6px 24px rgba(196,70,26,0.28)',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          }}
          onMouseOver={e => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 8px 28px rgba(196,70,26,0.36)';
          }}
          onMouseOut={e => {
            e.currentTarget.style.transform = '';
            e.currentTarget.style.boxShadow = '0 6px 24px rgba(196,70,26,0.28)';
          }}
        >
          <Flame size={16} />
          Open Burn Chat
          <ArrowRight size={15} />
        </a>
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────
   MAIN PAGE — BurnChatLandingPage
───────────────────────────────────────────────────────────── */
export default function BurnChatLandingPage() {
  const navigate = useNavigate();
  const [result, setResult]      = useState(null);
  const [ttlSeconds, setTtlSecs] = useState(null);

  const handleCreated = (data, secs) => {
    setResult(data);
    setTtlSecs(secs);
  };

  return (
    <div
      style={{
        minHeight: '100vh', background: T.bg,
        color: T.textPrimary, overflowX: 'hidden', position: 'relative',
      }}
    >
      <SEO
        title="Burn Chat — E2E Encrypted Ephemeral Messaging | BAR Web"
        description="End-to-end encrypted, ephemeral chat that permanently self-destructs when the timer expires. Messages are encrypted in your browser — the server never sees plaintext. No logs, no history, no traces."
      />

      {/* Ambient background */}
      <div aria-hidden="true" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div className="bg-grid" style={{ position: 'absolute', inset: 0, opacity: 0.3 }} />
        <div
          style={{
            position: 'absolute', top: '-12%', left: '50%', transform: 'translateX(-50%)',
            width: 'clamp(280px, 55vw, 650px)', height: 'clamp(280px, 55vw, 650px)',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(196,70,26,0.07) 0%, transparent 65%)',
          }}
        />
      </div>

      <Navbar onBack={() => navigate('/')} />

      <main
        style={{
          position: 'relative', zIndex: 1,
          paddingTop: `${T.navbarHeight}px`,   /* 56px — matches --navbar-height */
        }}
      >
        {/*
          Container: max-width 560px but width: min(560px,100%) prevents
          content clipping on 320px screens (was just maxWidth: 560).
          Padding: clamp() for both vertical and horizontal breathing room.
        */}
        <div
          style={{
            maxWidth: 560,
            width: 'min(560px, 100%)',          /* mobile-safe: was missing this */
            margin: '0 auto',
            /* Vertical: clamp(2.5rem,5vw,3.5rem) | Horizontal: clamp(1rem,4vw,1.5rem) */
            padding: 'clamp(2.5rem, 5vw, 3.5rem) clamp(1rem, 4vw, 1.5rem) 5rem',
          }}
        >
          {/* ── Hero text ── */}
          <motion.div {...fadeUp(0.05)} style={{ textAlign: 'center', marginBottom: '2.5rem' }}>

            {/* Badge */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <span
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.375rem 1rem', borderRadius: '999px',
                  background: T.greenDim, border: `1px solid ${T.greenBorder}`,
                  fontSize: 'var(--text-2xs)', fontWeight: 700,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: T.green,
                }}
              >
                <span
                  style={{
                    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                    background: T.green, boxShadow: '0 0 6px rgba(63,125,58,0.85)',
                    animation: 'pulse 2s ease-in-out infinite',
                  }}
                />
                Ephemeral · E2E Encrypted
              </span>
            </div>

            {/* h1 — reduced max to prevent 320px overflow */}
            <h1
              style={{
                /* Was clamp(2.5rem, 7vw, 4rem) — at 320px = 40px = 2 lines wrapping badly */
                fontSize: 'clamp(2.25rem, 6.5vw, 3.75rem)',
                fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 0.96,
                marginBottom: '1rem',
                /* Override global h1 — this is a display heading */
                color: 'inherit',
              }}
            >
              <span
                style={{
                  display: 'block',
                  background: 'linear-gradient(135deg, #D2591F 0%, #C4461A 45%, #9A3612 100%)',
                  WebkitBackgroundClip: 'text', backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Burn Chat
              </span>
              {/* Decorative "Burns When Done" — kept purposefully dim */}
              <span style={{ display: 'block', color: '#303030', marginTop: '0.04em' }}>
                Burns When Done
              </span>
            </h1>

            {/* Subtitle — raised to 0.9375rem minimum (was clamp 0.9rem → could be 14.4px) */}
            <p
              style={{
                fontSize: '0.9375rem',           /* 15px — safe minimum */
                color: T.textSecondary,           /* #a0a0a0 — raised from T.textS #888888 */
                lineHeight: 1.72,
                maxWidth: 'min(34ch, 100%)',      /* mobile-safe */
                margin: '0 auto',
              }}
            >
              End-to-end encrypted ephemeral messaging. Your browser encrypts every message
              before it leaves your device — the server only relays ciphertext.
              Everything is permanently destroyed when the timer ends.
            </p>
          </motion.div>

          {/* Form OR Result */}
          {result
            ? <ResultCard result={result} ttlSeconds={ttlSeconds} />
            : <CreateCard onCreated={handleCreated} />
          }

          {/* ── Feature grid ──
              Changed from flexbox (flex: '1 1 180px') to CSS grid.
              auto-fit + minmax(220px, 1fr) → 2-col on ≥460px, 1-col below.
              Cards never go below 220px and never overflow their container.
          */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '0.75rem',
              marginTop: '2rem',
            }}
          >
            {FEATURES.map((f, i) => <FeatureCard key={f.title} {...f} index={i} />)}
          </div>

          {/* Footer note — raised from 12px #292929 to 12px #505050 */}
          <motion.p
            {...fadeUp(0.7)}
            style={{
              textAlign: 'center', marginTop: '2.5rem',
              fontSize: '0.75rem',              /* 12px — unchanged size */
              color: T.textDim,                 /* #505050 — raised from #292929 (near-invisible) */
              lineHeight: 1.65,
            }}
          >
            Share the link with participants. Only the creator who holds the PIN has moderator access.
            Once the timer expires the room cannot be recovered by anyone — including us.
          </motion.p>

          {/* E2E trust note — raised from 0.7rem → 0.75rem, color #505050 */}
          <motion.p
            {...fadeUp(0.8)}
            style={{
              textAlign: 'center', marginTop: '0.75rem',
              fontSize: '0.75rem',              /* raised from 0.7rem — below 11px floor */
              color: T.textDim,                 /* #505050 — raised from #292929 */
              lineHeight: 1.65,
            }}
          >
            🔐 Messages are encrypted in your browser using{' '}
            <strong style={{ color: T.textTertiary }}>AES-GCM-256</strong>{' '}with keys exchanged via{' '}
            <strong style={{ color: T.textTertiary }}>ECDH P-256</strong>.{' '}
            The server never sees plaintext. Requires HTTPS.
          </motion.p>
        </div>
      </main>
    </div>
  );
}
