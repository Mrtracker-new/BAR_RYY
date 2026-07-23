import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Flame, Send, Users, Copy, CheckCircle2, Shield, AlertTriangle, ArrowLeft, Clock, X, Lock, Unlock, PlusCircle } from 'lucide-react';
import { copyToClipboard } from '../utils/clipboard';
import axios from '../config/axios';
import BurningAnimation from './BurningAnimation';
import SEO from './SEO';
import * as E2E from '../crypto/burnChatE2E';

const T = {
  gold: '#B4791E', green: '#3F7D3A', red: '#B33A2E', orange: '#C4461A',
  bg: '#EDE3CE', s0: '#FAF4E6', s1: '#FFFDF6', s2: '#F1E8D3',
  border: 'rgba(60,45,20,0.16)', borderH: 'rgba(60,45,20,0.30)',
  /* Text — ink on cream */
  text:  '#2A2018',
  textS: '#55483A',
  textT: '#857358',
  textD: '#A2916F',
  mono: "'JetBrains Mono', monospace",
};

/** Cap in-memory messages to prevent OOM in long-lived sessions. */
const MAX_MESSAGES = 500;

function fmtTime(s) {
  const n = Number.isFinite(s) ? Math.max(0, Math.floor(s)) : 0;
  const h = Math.floor(n / 3600), m = Math.floor((n % 3600) / 60), sec = n % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

function timerColor(secs) {
  if (secs > 300) return T.green;
  if (secs > 60)  return T.gold;
  if (secs > 0)   return T.red;
  return T.red;
}

/**
 * Build a WebSocket base URL from the configured backend origin.
 *
 * Security guarantee: if the *page* is served over https://, the returned URL
 * always uses wss:// — even when VITE_BACKEND_URL is set to an http:// value.
 * This prevents a misconfigured staging/CI environment from silently
 * downgrading an https page to an unencrypted ws:// connection.
 *
 * @param {string} [backendUrl] - Override for testing; defaults to VITE_BACKEND_URL
 *                                or window.location.origin.
 * @param {string} [pageProtocol] - Override for testing; defaults to
 *                                  window.location.protocol.
 * @returns {string} Base URL with wss:// or ws:// scheme, no trailing slash.
 */
export function resolveWsUrl(
  backendUrl  = import.meta.env.VITE_BACKEND_URL || window.location.origin,
  pageProtocol = window.location.protocol,
) {
  const origin = backendUrl.replace(/\/+$/, '');   // strip trailing slashes
  const pageIsSecure = pageProtocol === 'https:';

  // Replace the HTTP scheme with the appropriate WS scheme.
  // Always upgrade to wss:// when the page itself is secure.
  return origin
    .replace(/^https:\/\//, 'wss://')
    .replace(/^http:\/\//, pageIsSecure ? 'wss://' : 'ws://');
}

function relTime(iso) {
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 5)  return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  return new Date(iso).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
}

/* ── Join screen ───────────────────────────────────────────── */
function JoinScreen({ token, onJoin, error, infoState, joinSecsLeft, joinParticipants }) {
  const [name, setName]           = useState('');
  const [pin, setPin]             = useState('');
  const [isCreator, setIsCreator] = useState(false);

  const canJoin = name.trim() && infoState !== 'loading' && infoState !== 'expired';
  const tColor  = joinSecsLeft !== null ? timerColor(joinSecsLeft) : T.textS;

  return (
    <>
      {/*
        SEO injected here so crawlers (WhatsApp, Telegram, Twitter, Google)
        that hit /chat/:token see Burn Chat-specific meta tags even before
        the user has filled in their name or JavaScript has hydrated the page.
        noIndex keeps ephemeral session URLs out of search engine indexes.
      */}
      <SEO
        title="Join Burn Chat — Encrypted Ephemeral Session | BAR Web"
        description="You've been invited to a Burn Chat — end-to-end encrypted, ephemeral messaging that permanently self-destructs when the timer expires. No logs, no history, no traces."
        keywords="burn chat, join burn chat, encrypted chat, ephemeral chat, self-destruct chat, e2e encrypted messaging, BAR burn chat, secure chat room, disappearing messages"
        url={`https://bar-rnr.vercel.app/chat/${token}`}
        type="article"
        ogImageAlt="Burn Chat — End-to-End Encrypted Ephemeral Chat | BAR Web"
        noIndex={true}
      />
      <div style={{ minHeight:'100vh', background:'#EDE3CE', display:'flex', alignItems:'center', justifyContent:'center', padding:'clamp(1rem, 4vw, 1.5rem)' }}>
        <div style={{ width:'100%', maxWidth:380 }}>
        <div style={{ textAlign:'center', marginBottom:'2rem' }}>
          <div style={{ width:56, height:56, borderRadius:'50%', background:'rgba(196,70,26,0.1)', border:'1px solid rgba(196,70,26,0.2)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 1rem' }}>
            <Flame size={24} style={{ color:T.orange }} />
          </div>
          <h1 style={{ fontSize:'1.375rem', fontWeight:700, letterSpacing:'-0.03em', color:T.text, marginBottom:'0.375rem' }}>Join Burn Chat</h1>
          <p style={{ fontSize:'0.875rem', color:T.textS }}>End-to-end encrypted. Messages vanish when the timer expires.</p>
          {/* Token code — 11px acceptable for monospace identifier display */}
          <code style={{ fontSize:'0.6875rem', color:T.textT, fontFamily:T.mono, display:'block', marginTop:'0.5rem', letterSpacing:'0.04em' }}>{token}</code>
        </div>

        {/* Session info strip */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'center', gap:'1rem',
          marginBottom:'1rem', minHeight:28,
        }}>
          {infoState === 'loading' && (
            <div style={{ height:8, width:120, borderRadius:4, background:'rgba(60,45,20,0.08)', animation:'pulse 1.4s ease-in-out infinite' }} />
          )}
          {infoState === 'ok' && joinSecsLeft !== null && (
            <>
              <div style={{ display:'flex', alignItems:'center', gap:'0.35rem', padding:'0.25rem 0.7rem', borderRadius:'999px', background:'rgba(60,45,20,0.06)', border:`1px solid ${tColor}30` }}>
                <Clock size={12} style={{ color:tColor }} />
                <span style={{ fontSize:'0.875rem', fontWeight:700, color:tColor, fontFamily:T.mono }}>
                  {fmtTime(joinSecsLeft)}
                </span>
              </div>
              {joinParticipants > 0 && (
                <div style={{ display:'flex', alignItems:'center', gap:'0.3rem' }}>
                  <Users size={12} style={{ color:T.textS }} />
                  <span style={{ fontSize:'0.875rem', color:T.textS }}>
                    {joinParticipants} {joinParticipants === 1 ? 'person' : 'people'} inside
                  </span>
                </div>
              )}
            </>
          )}
          {infoState === 'expired' && (
            <span style={{ fontSize:'0.875rem', color:T.red }}>This session has already burned.</span>
          )}
          {infoState === 'error' && (
            <span style={{ fontSize:'0.875rem', color:T.textS }}>Could not load session info.</span>
          )}
        </div>

        <div style={{ background:T.s0, border:`1px solid ${T.border}`, borderRadius:'1rem', padding:'1.5rem', display:'flex', flexDirection:'column', gap:'1rem' }}>
          <div>
            <label style={{ fontSize:'0.875rem', fontWeight:600, color:T.textS, display:'block', marginBottom:'0.375rem' }}>Display name</label>
            <input className="input-field" placeholder="Your name…" value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&canJoin&&onJoin(name.trim(),isCreator?pin:null)} maxLength={30} style={{ fontSize:'var(--text-sm)' }} />
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.625rem 0.75rem', borderRadius:'0.5rem', background:'rgba(60,45,20,0.04)', border:`1px solid ${T.border}`, cursor:'pointer' }} onClick={()=>setIsCreator(v=>!v)}>
            <input type="checkbox" id="creator-chk" checked={isCreator} onChange={()=>setIsCreator(v=>!v)} style={{ cursor:'pointer' }} />
            <label htmlFor="creator-chk" style={{ fontSize:'0.875rem', color:T.textS, cursor:'pointer', display:'flex', alignItems:'center', gap:'0.375rem' }}>
              <Shield size={13} style={{ color:T.orange }} /> I'm the creator (have PIN)
            </label>
          </div>

          {isCreator && (
            <div>
              <label style={{ fontSize:'0.875rem', fontWeight:600, color:T.textS, display:'block', marginBottom:'0.375rem' }}>Creator PIN</label>
              <input className="input-field" placeholder="XXXXXX" value={pin} onChange={e=>setPin(e.target.value.toUpperCase().slice(0,6))} maxLength={6} style={{ fontFamily:T.mono, letterSpacing:'0.15em', fontSize:'1.125rem' }} />
            </div>
          )}

          {error && (
            <div style={{ display:'flex', gap:'0.5rem', padding:'0.75rem', borderRadius:'0.5rem', background:'rgba(179,58,46,0.07)', border:'1px solid rgba(179,58,46,0.15)' }}>
              <AlertTriangle size={14} style={{ color:T.red, flexShrink:0 }} />
              <p style={{ fontSize:'0.875rem', color:'#B33A2E' }}>{error}</p>
            </div>
          )}

          <button
            onClick={() => canJoin && onJoin(name.trim(), isCreator ? pin : null)}
            disabled={!canJoin}
            style={{
              /* 48px — primary CTA touch target */
              minHeight: 48,
              padding:'0 1rem', borderRadius:'0.625rem', border:'none', fontWeight:700, fontSize:'0.9375rem',
              fontFamily:'inherit',
              cursor: canJoin ? 'pointer' : 'not-allowed',
              transition: 'background 0.18s ease, box-shadow 0.18s ease, transform 0.15s ease',
              background: canJoin ? 'linear-gradient(160deg,#C4461A 0%,#9A3612 100%)' : 'rgba(60,45,20,0.08)',
              color: canJoin ? '#fff' : T.textT, display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem',
              boxShadow: canJoin ? '0 4px 16px rgba(196,70,26,0.22)' : 'none',
            }}
            onMouseOver={e => { if (canJoin) { e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 6px 20px rgba(196,70,26,0.30)'; } }}
            onMouseOut={e  => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow=canJoin?'0 4px 16px rgba(196,70,26,0.22)':'none'; }}
          >
            <Flame size={14} /> Join Session
          </button>
        </div>
      </div>
    </div>
    </>
  );
}

/* ── Destroyed screen ──────────────────────────────────────── */
function DestroyedScreen() {
  return (
    <div style={{ minHeight:'100vh', background:'#EDE3CE', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ textAlign:'center', padding:'2rem' }}>
        <div style={{ width:72, height:72, borderRadius:'50%', background:'rgba(179,58,46,0.1)', border:'1px solid rgba(179,58,46,0.2)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 1.5rem' }}>
          <Flame size={32} style={{ color:T.red }} />
        </div>
        <h2 style={{ fontSize:'1.5rem', fontWeight:700, color:T.text, letterSpacing:'-0.03em', marginBottom:'0.5rem' }}>Session Burned</h2>
        <p style={{ color:T.textS, fontSize:'0.875rem', maxWidth:'28ch', margin:'0 auto 2rem' }}>All messages have been permanently erased. No trace remains.</p>
        <a href="/" style={{ display:'inline-flex', alignItems:'center', gap:'0.5rem', padding:'0.75rem 1.25rem', borderRadius:'0.625rem', background:'rgba(60,45,20,0.06)', border:`1px solid ${T.border}`, color:T.textS, textDecoration:'none', fontSize:'0.875rem', fontWeight:500 }}>
          <ArrowLeft size={13} /> Back to BAR Web
        </a>
      </div>
    </div>
  );
}

/* ── Message bubble ────────────────────────────────────────── */
/**
 * Renders one chat message.
 *
 * E2E decrypt lifecycle:
 *   1. msg.text present          → plaintext path, render immediately.
 *   2. msg.ciphertext present
 *        sessionKey null         → show 🔒 Awaiting key (pending state).
 *        sessionKey available    → decrypt in useEffect, render plaintext.
 *        decryption throws       → show ⚠️ Could not decrypt (tampered / wrong key).
 *
 * When sessionKey changes (creator reconnect, late key delivery) the effect
 * re-runs for every mounted bubble that holds an undecrypted ciphertext.
 */
function Bubble({ msg, myName, sessionKey }) {
  // null  = not yet attempted / pending key
  // false = decryption failed
  // string = decrypted plaintext
  const [plaintext, setPlaintext] = useState(
    msg.text !== undefined ? msg.text : null,
  );

  useEffect(() => {
    // Nothing to decrypt — plaintext message or no key available yet.
    if (!msg.ciphertext || !sessionKey) return;
    // Already successfully decrypted — don't redo on the same key instance.
    // But DO retry if the key changed (reconnect with new session key).
    if (typeof plaintext === 'string') return;

    let cancelled = false;
    E2E.decryptMessage(msg.ciphertext, msg.iv, sessionKey)
      .then(text  => { if (!cancelled) setPlaintext(text); })
      .catch(_err => {
        // AES-GCM auth tag failed — ciphertext tampered or mismatched key.
        // On reconnect a new sessionKey arrives; if this bubble is still
        // mounted we want to retry, so we set null (pending) not false (fatal),
        // unless sessionKey is the definitive final key (e2eReady is already
        // true before this effect fires in that case).
        if (!cancelled) setPlaintext(false);
      });

    return () => { cancelled = true; };
  // Re-run when the session key is delivered, replaced (reconnect), or removed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey]);

  const isMe = msg.sender_name === myName;

  if (msg.type === 'system') return (
    <div style={{ textAlign:'center', padding:'0.25rem 0' }}>
      {/* System pill — 12px acceptable for inline contextual system messages */}
      <span style={{ fontSize:'0.75rem', color:T.textT, background:'rgba(60,45,20,0.04)', padding:'0.2rem 0.75rem', borderRadius:'999px', border:`1px solid ${T.border}` }}>{msg.text}</span>
    </div>
  );

  // ── Determine display content ───────────────────────────────────────────
  let bodyContent;
  if (msg.ciphertext) {
    if (plaintext === null) {
      // Key not yet available — show a soft pending indicator.
      bodyContent = (
        <span style={{ fontStyle:'italic', color:T.textT, fontSize:'0.875rem', display:'flex', alignItems:'center', gap:'0.35rem' }}>
          🔒 <span>Awaiting key…</span>
        </span>
      );
    } else if (plaintext === false) {
      // Decryption failed — could be tampered or wrong key.
      bodyContent = (
        <span style={{ fontStyle:'italic', color:T.red, fontSize:'0.875rem', display:'flex', alignItems:'center', gap:'0.35rem' }}>
          ⚠️ <span>Could not decrypt</span>
        </span>
      );
    } else {
      bodyContent = plaintext;
    }
  } else {
    // Plaintext path (TLS-only or legacy message).
    bodyContent = msg.text;
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:isMe?'flex-end':'flex-start', marginBottom:'0.125rem' }}>
      {!isMe && (
        /* Sender name — 12px acceptable (compact chat sender label) */
        <span style={{ fontSize:'0.75rem', color:msg.is_creator?T.orange:T.textT, fontWeight:600, marginBottom:'0.2rem', marginLeft:'0.25rem' }}>
          {msg.sender_name}{msg.is_creator?' 👑':''}
        </span>
      )}
      <div style={{
        maxWidth:'75%', padding:'0.625rem 0.875rem', borderRadius:isMe?'1rem 1rem 0.25rem 1rem':'1rem 1rem 1rem 0.25rem',
        background:isMe?'rgba(196,70,26,0.15)':'rgba(60,45,20,0.06)',
        border:`1px solid ${isMe?'rgba(196,70,26,0.25)':T.border}`,
        /* Message text: 0.9375rem (15px) minimum per spec */
        fontSize:'0.9375rem', color:T.text, lineHeight:1.55,
        wordBreak:'break-word',
      }}>
        {bodyContent}
      </div>
      {/* Timestamp: 0.75rem (12px) minimum — raised from 0.625rem (10px) */}
      <span style={{ fontSize:'0.75rem', color:T.textT, marginTop:'0.2rem', padding:'0 0.25rem' }}>{relTime(msg.sent_at)}</span>
    </div>
  );
}

/* ── Participant panel ───────────────────────────────────────── */
function ParticipantPanel({ participantList, myWsId, isCreator, roomLocked, onKick, onToggleLock, onExtendTtl, onClose }) {
  return (
    <div style={{
      width: 240, flexShrink: 0,
      borderLeft: `1px solid ${T.border}`,
      background: T.s0,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Panel header */}
      <div style={{
        flexShrink: 0, padding: '0 0.875rem', height: 44,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `1px solid ${T.border}`,
      }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: T.textS, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Participants
        </span>
        <button
          onClick={onClose}
          style={{ width: 22, height: 22, borderRadius: 4, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textT }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Creator controls */}
      {isCreator && (
        <div style={{
          flexShrink: 0, padding: '0.625rem 0.875rem',
          borderBottom: `1px solid ${T.border}`,
          display: 'flex', flexDirection: 'column', gap: '0.4rem',
        }}>
          <button
            onClick={onToggleLock}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.4rem 0.65rem', borderRadius: '0.4rem',
              border: `1px solid ${roomLocked ? 'rgba(196,70,26,0.3)' : T.border}`,
              background: roomLocked ? 'rgba(196,70,26,0.07)' : 'rgba(60,45,20,0.04)',
              cursor: 'pointer', width: '100%', transition: 'all 0.15s',
              fontSize: '0.75rem', fontWeight: 600,
              color: roomLocked ? T.orange : T.textS,
            }}
          >
            {roomLocked ? <Unlock size={12} /> : <Lock size={12} />}
            {roomLocked ? 'Unlock room' : 'Lock room'}
          </button>
          <button
            onClick={onExtendTtl}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.4rem 0.65rem', borderRadius: '0.4rem',
              border: `1px solid ${T.border}`,
              background: 'rgba(60,45,20,0.04)',
              cursor: 'pointer', width: '100%', transition: 'all 0.15s',
              fontSize: '0.75rem', fontWeight: 600, color: T.textS,
            }}
          >
            <PlusCircle size={12} /> +30 min
          </button>
        </div>
      )}

      {/* Participant list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0' }}>
        {participantList.map(p => (
          <div
            key={p.ws_id}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.375rem 0.875rem',
              background: p.ws_id === myWsId ? 'rgba(196,70,26,0.05)' : 'transparent',
            }}
          >
            {/* Avatar initial */}
            <div style={{
              width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
              background: p.is_creator ? 'rgba(196,70,26,0.15)' : 'rgba(60,45,20,0.08)',
              border: `1px solid ${p.is_creator ? 'rgba(196,70,26,0.25)' : T.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.65rem', fontWeight: 700,
              color: p.is_creator ? T.orange : T.textS,
            }}>
              {p.name.charAt(0).toUpperCase()}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontSize: '0.875rem',         /* raised from 0.8rem — below 14px minimum */
                fontWeight: 600,
                color: p.ws_id === myWsId ? T.orange : p.is_creator ? T.gold : T.text,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {p.name}
                {p.is_creator && ' 👑'}
                {/* (you) label — 11px acceptable for inline parenthetical */}
                {p.ws_id === myWsId && <span style={{ color: T.textT, fontWeight: 400, fontSize: '0.6875rem' }}> (you)</span>}
              </p>
            </div>

            {/* Kick button — creator sees it on everyone except themselves */}
            {isCreator && p.ws_id !== myWsId && (
              <button
                onClick={() => onKick(p.ws_id)}
                title={`Remove ${p.name}`}
                style={{
                  width: 20, height: 20, borderRadius: 4,
                  border: '1px solid rgba(179,58,46,0.2)',
                  background: 'transparent', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'rgba(179,58,46,0.5)', flexShrink: 0,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(179,58,46,0.1)'; e.currentTarget.style.color = T.red; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(179,58,46,0.5)'; }}
              >
                <X size={10} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Connection status dot ─────────────────────────────────── */
const CONN_DOT = {
  idle:         { color: T.textT,  label: 'Idle',         pulse: false },
  connecting:   { color: '#FBBF24', label: 'Connecting…',  pulse: true  },
  connected:    { color: T.green,  label: 'Connected',     pulse: false },
  reconnecting: { color: '#FBBF24', label: 'Reconnecting…', pulse: true  },
  disconnected: { color: T.red,    label: 'Disconnected',  pulse: false },
};

function ConnStatusDot({ status }) {
  const { color, label, pulse } = CONN_DOT[status] ?? CONN_DOT.idle;
  return (
    <div
      aria-label={label}
      title={label}
      style={{
        width: 7, height: 7, borderRadius: '50%',
        background: color,
        boxShadow: status === 'connected' ? `0 0 6px ${color}` : 'none',
        flexShrink: 0,
        transition: 'background 0.4s ease, box-shadow 0.4s ease',
        animation: pulse ? 'pulse 1s ease-in-out infinite' : 'none',
      }}
    />
  );
}

/* ── Main component ────────────────────────────────────────── */
export default function BurnChatPage({ token }) {
  const [phase, setPhase]         = useState('join'); // join | chat | burning | destroyed
  const [myName, setMyName]       = useState('');
  const [isCreator, setIsCreator] = useState(false);
  const [messages, setMessages]   = useState([]);
  const [participants, setParticipants] = useState(0);
  const [secsLeft, setSecsLeft]   = useState(null);
  const [input, setInput]         = useState('');
  const [joinError, setJoinError]       = useState(null);
  const [wsError, setWsError]           = useState(null);
  const [copied, setCopied]             = useState(false);
  const [copyFailed, setCopyFailed]     = useState(false);
  const [connStatus, setConnStatus]     = useState('idle');
  const [infoState, setInfoState]           = useState('loading');
  const [joinSecsLeft, setJoinSecsLeft]     = useState(null);
  const [joinParticipants, setJoinParticipants] = useState(0);
  const [participantList, setParticipantList]   = useState([]);  // [{ws_id, name, is_creator}]
  const [roomLocked, setRoomLocked]             = useState(false);
  const [panelOpen, setPanelOpen]               = useState(false);

  // ── E2E encryption state ─────────────────────────────────────────────────
  const [e2eReady, setE2eReady]               = useState(false);   // session key held + fingerprint set
  const [e2eFingerprint, setE2eFingerprint]   = useState(null);    // '2FA3C1' — 6 uppercase hex chars
  const [cryptoAvailable, setCryptoAvailable] = useState(true);    // false → insecure context banner
  const [e2eSessionKey, setE2eSessionKey]     = useState(null);    // mirrors e2eRef.sessionKey for re-renders

  const wsRef         = useRef(null);
  const myWsIdRef     = useRef(null);         // own ws_id from 'joined'
  const bottomRef     = useRef(null);
  const countRef      = useRef(null);
  const joinCountRef  = useRef(null);
  const joinedRef     = useRef(false);
  const pingRef       = useRef(null);
  const reconnectRef  = useRef({
    count: 0, name: null, pin: null, timeoutId: null,
  });

  /**
   * Mutable E2E ref — holds CryptoKey objects and Maps that must NOT trigger
   * re-renders when updated. setE2eSessionKey / setE2eReady / setE2eFingerprint
   * are the React-visible mirrors that drive the UI.
   *
   * pendingSessionKey: {fromWsId, wrappedKey} stored when a 'session_key'
   * message arrives before the creator's pubkey has been received — retried
   * once the creator pubkey is stored (race-condition guard).
   */
  const e2eRef = useRef({
    keyPair:           null,        // { publicKey, privateKey } — ECDH P-256
    sessionKey:        null,        // AES-GCM-256 CryptoKey (creator-generated)
    pubkeys:           new Map(),   // ws_id → base64-JWK pubkey for all known peers
    keyedPeers:        new Set(),   // ws_ids the creator has already sent session_key to
    pendingSessionKey: null,        // { fromWsId, wrappedKey } — held during pubkey race
  });

  // Share URL — routes through the server-rendered OG preview page so
  // WhatsApp / Telegram / Twitter crawlers see Burn Chat-specific meta tags
  // (og:title, og:image, og:description) instead of the generic SPA defaults.
  //
  // Real browsers follow the 0-second meta-refresh on the OG page and land on
  // /chat/:token with no visible delay. Social bots stop at the meta tags.
  //
  // Direct SPA URL (if OG preview is not needed): /chat/${token}
  const shareUrl = `${window.location.origin}/og/chat/${token}`;

  /* auto-scroll */
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }); }, [messages]);

  /* fetch session info once on mount — fast-path expired sessions */
  useEffect(() => {
    let cancelled = false;
    axios.get(`/chat/${token}/info`)
      .then(({ data }) => {
        if (cancelled) return;
        setInfoState('ok');
        const secs = data.seconds_remaining;
        setJoinSecsLeft(Number.isFinite(secs) ? Math.max(0, Math.floor(secs)) : null);
        setJoinParticipants(data.participant_count ?? 0);
      })
      .catch(err => {
        if (cancelled) return;
        if (err.response?.status === 410) {
          setInfoState('expired');
          setPhase('destroyed');
        } else {
          setInfoState('error');
        }
      });
    return () => { cancelled = true; };
  }, [token]);

  /* pre-join local countdown — stops when user joins (joinCountRef cleared) */
  useEffect(() => {
    if (joinSecsLeft === null || joinSecsLeft <= 0) return;
    joinCountRef.current = setInterval(() => {
      setJoinSecsLeft(s => {
        if (s <= 1) {
          clearInterval(joinCountRef.current);
          setInfoState('expired');
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(joinCountRef.current);
  }, [joinSecsLeft !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  /* local countdown tick for in-chat timer (server is authoritative) */
  useEffect(() => {
    if (secsLeft === null || secsLeft <= 0) return;
    countRef.current = setInterval(() => setSecsLeft(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(countRef.current);
  }, [secsLeft !== null]);

  const addSysMsg = useCallback((text) => {
    setMessages(prev => [...prev, { type:'system', text, sent_at: new Date().toISOString(), id: Math.random().toString(36) }]);
  }, []);

  /* clear all timers on unmount */
  useEffect(() => () => {
    clearInterval(pingRef.current);
    clearInterval(joinCountRef.current);
    clearTimeout(reconnectRef.current.timeoutId);
    wsRef.current?.close();
  }, []);

  const handleJoin = useCallback((name, pin) => {
    setJoinError(null);
    setMyName(name);
    setConnStatus('connecting');
    clearInterval(joinCountRef.current); // hand off countdown to WS

    reconnectRef.current.name  = name;
    reconnectRef.current.pin   = pin;
    reconnectRef.current.count = 0;

    // Detect insecure context before attempting E2E.
    // crypto.subtle is undefined on plain http:// — surface the banner now.
    setCryptoAvailable(E2E.isAvailable());

    _connectWs(name, pin);
  }, [token, addSysMsg]); // eslint-disable-line react-hooks/exhaustive-deps

  function _connectWs(name, pin) {
    clearInterval(pingRef.current);
    joinedRef.current = false;
    setConnStatus('connecting');

    // ── Reset all E2E state for this (re)connection ───────────────────────────
    // This is critical on reconnect: stale keypairs, keyedPeers sets, and
    // session keys from the previous connection must be discarded.  If they
    // survive, the creator won't re-issue session keys (keyedPeers still
    // populated) and participants keep an invalid key — every message
    // after reconnect would show ⚠️ Could not decrypt.
    e2eRef.current = {
      keyPair:           null,
      sessionKey:        null,
      pubkeys:           new Map(),
      keyedPeers:        new Set(),
      pendingSessionKey: null,
    };
    setE2eReady(false);
    setE2eFingerprint(null);
    setE2eSessionKey(null);

    const PING_INTERVAL_MS    = 20_000;
    const RECONNECT_DELAYS_MS = [1_000, 2_000, 4_000];

    const wsBase = resolveWsUrl();
    const ws     = new WebSocket(`${wsBase}/chat/${token}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      // Still 'connecting' until the server confirms via 'joined'.
      ws.send(JSON.stringify({ type: 'join', display_name: name, ...(pin ? { pin } : {}) }));
    };

    ws.onmessage = (ev) => {
      let data;
      try { data = JSON.parse(ev.data); } catch { return; }

      switch (data.type) {

        case 'joined': {
          joinedRef.current     = true;
          myWsIdRef.current     = data.ws_id ?? null;
          reconnectRef.current.count = 0;
          setConnStatus('connected');
          setIsCreator(data.is_creator);
          setSecsLeft(data.seconds_remaining);
          setParticipants(data.participant_count);
          if (data.participant_list) setParticipantList(data.participant_list);
          if (data.locked !== undefined) setRoomLocked(data.locked);
          setPhase('chat');
          pingRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN)
              ws.send(JSON.stringify({ type: 'ping' }));
          }, PING_INTERVAL_MS);

          // ── E2E key exchange bootstrap ───────────────────────────────────
          if (!E2E.isAvailable()) break; // insecure context — skip silently, banner shown

          // ── CRITICAL: seed pubkeys map from participant_list BEFORE any async ops.
          //
          // The server now stores each participant's ECDH public key and delivers
          // it in participant_list inside the 'joined' payload.  By populating the
          // map here (synchronously, before the async keypair generation starts),
          // we guarantee that when session_key arrives later the creator's pubkey
          // is already present — no race, no pendingSessionKey fallback needed for
          // the normal single-creator flow.
          //
          // This also handles the case where a participant joins an already-active
          // room: all existing peers' pubkeys land in the map before we begin.
          (data.participant_list ?? []).forEach(p => {
            if (p.ws_id && p.public_key) {
              e2eRef.current.pubkeys.set(p.ws_id, p.public_key);
            }
          });

          (async () => {
            try {
              // 1. Generate our ECDH keypair (private key extractable:false).
              const keyPair = await E2E.generateKeyPair();
              e2eRef.current.keyPair = keyPair;

              // 2. Export and broadcast our own public key to all peers.
              //    The server will also store it so future joiners see it.
              const pubKeyB64 = await E2E.exportPublicKey(keyPair.publicKey);
              // Store our own pubkey keyed by our ws_id.  The creator needs this
              // so participants can verify the wrap-key derivation later.
              e2eRef.current.pubkeys.set(data.ws_id, pubKeyB64);
              ws.send(JSON.stringify({ type: 'pubkey', public_key: pubKeyB64 }));

              if (data.is_creator) {
                // 3a. Creator: generate the shared AES-GCM-256 session key.
                const sk = await E2E.generateSessionKey();
                e2eRef.current.sessionKey = sk;

                // 4a. Compute and display fingerprint.
                const fp = await E2E.sessionFingerprint(sk);
                setE2eFingerprint(fp);
                setE2eSessionKey(sk);
                setE2eReady(true);

                // 5a. Wrap and unicast session key to every peer already in the
                //     room whose pubkey is already known (from the seeded map).
                //     Peers who join later are handled reactively in 'pubkey' handler.
                const { keyedPeers } = e2eRef.current;
                const existingPeers = (data.participant_list ?? [])
                  .filter(p => p.ws_id !== data.ws_id && p.public_key);

                for (const peer of existingPeers) {
                  if (keyedPeers.has(peer.ws_id)) continue;
                  try {
                    const theirPub = await E2E.importPublicKey(peer.public_key);
                    const wrapKey  = await E2E.deriveWrapKey(keyPair.privateKey, theirPub);
                    const wrapped  = await E2E.wrapSessionKey(sk, wrapKey);
                    keyedPeers.add(peer.ws_id);
                    ws.send(JSON.stringify({
                      type:        'session_key',
                      for_ws_id:   peer.ws_id,
                      wrapped_key: wrapped,
                    }));
                  } catch (err) {
                    console.error('[E2E] Failed to wrap for existing peer:', peer.ws_id, err);
                  }
                }
              }
              // Participant path: session key arrives via 'session_key' message.
              // By the time it arrives, the creator's pubkey is already seeded above.
            } catch (err) {
              console.error('[E2E] Key bootstrap failed:', err);
            }
          })();
          break;
        }

        case 'pubkey': {
          // Relay from server: a peer has broadcast their ECDH public key.
          const { ws_id: peerWsId, public_key: peerPubKeyB64 } = data;
          if (!peerWsId || !peerPubKeyB64) break;

          // Store in the pubkey map for this peer.
          e2eRef.current.pubkeys.set(peerWsId, peerPubKeyB64);

          // Also store our own pubkey (keyed by our ws_id) so
          // participants can find the creator's pubkey for wrap-key derivation.
          // (We stored it already in the 'joined' handler above.)

          // ── Creator: wrap and unicast the session key to the new peer ────
          const { keyPair, sessionKey: sk, keyedPeers } = e2eRef.current;
          const amCreator = joinedRef.current && !!sk;

          if (amCreator && keyPair && sk && !keyedPeers.has(peerWsId)) {
            (async () => {
              try {
                const theirPub  = await E2E.importPublicKey(peerPubKeyB64);
                const wrapKey   = await E2E.deriveWrapKey(keyPair.privateKey, theirPub);
                const wrapped   = await E2E.wrapSessionKey(sk, wrapKey);
                keyedPeers.add(peerWsId);
                ws.send(JSON.stringify({
                  type:        'session_key',
                  for_ws_id:   peerWsId,
                  wrapped_key: wrapped,
                }));
              } catch (err) {
                console.error('[E2E] Failed to wrap session key for peer:', peerWsId, err);
              }
            })();
          }

          // ── Participant: resolve a pending session_key that arrived before
          //                this pubkey (race-condition guard) ───────────────
          const pending = e2eRef.current.pendingSessionKey;
          if (pending && pending.fromWsId === peerWsId) {
            e2eRef.current.pendingSessionKey = null;
            const { fromWsId, wrappedKey } = pending;
            (async () => {
              try {
                const { keyPair: kp } = e2eRef.current;
                if (!kp) return;
                const creatorPub  = await E2E.importPublicKey(peerPubKeyB64);
                const wrapKey     = await E2E.deriveWrapKey(kp.privateKey, creatorPub);
                const resolvedKey = await E2E.unwrapSessionKey(wrappedKey, wrapKey);
                const fp          = await E2E.sessionFingerprint(resolvedKey);
                e2eRef.current.sessionKey = resolvedKey;
                setE2eSessionKey(resolvedKey);
                setE2eFingerprint(fp);
                setE2eReady(true);
              } catch (err) {
                console.error('[E2E] Failed to resolve pending session_key after pubkey arrived:', err);
              }
            })();
          }
          break;
        }

        case 'session_key': {
          // Creator unicast: contains our wrapped AES-GCM session key.
          const { from_ws_id: fromWsId, wrapped_key: wrappedKey } = data;
          if (!fromWsId || !wrappedKey) break;

          const { keyPair, pubkeys } = e2eRef.current;
          if (!keyPair) break; // keypair not yet generated — should not happen

          const creatorPubKeyB64 = pubkeys.get(fromWsId);

          if (!creatorPubKeyB64) {
            // Race: creator's pubkey hasn't arrived yet — park this message.
            // The 'pubkey' handler will detect and resolve it.
            e2eRef.current.pendingSessionKey = { fromWsId, wrappedKey };
            break;
          }

          (async () => {
            try {
              const creatorPub  = await E2E.importPublicKey(creatorPubKeyB64);
              const wrapKey     = await E2E.deriveWrapKey(keyPair.privateKey, creatorPub);
              const resolvedKey = await E2E.unwrapSessionKey(wrappedKey, wrapKey);
              const fp          = await E2E.sessionFingerprint(resolvedKey);
              e2eRef.current.sessionKey = resolvedKey;
              setE2eSessionKey(resolvedKey);
              setE2eFingerprint(fp);
              setE2eReady(true);
            } catch (err) {
              console.error('[E2E] Failed to unwrap session key:', err);
            }
          })();
          break;
        }

        case 'message':
          setMessages(prev => {
            const next = [...prev, data];
            return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
          });
          break;

        case 'system':
          setParticipants(data.participant_count ?? 0);
          if (data.participant_list) setParticipantList(data.participant_list);
          addSysMsg(data.text);
          break;

        case 'countdown':
          setSecsLeft(data.seconds_remaining);
          break;

        case 'room_locked':
          setRoomLocked(data.locked);
          break;

        case 'ttl_extended':
          setSecsLeft(data.seconds_remaining);
          break;

        case 'destroyed':
          clearInterval(pingRef.current);
          clearInterval(countRef.current);
          setPhase('burning');
          break;

        case 'error':
          if (!joinedRef.current) setJoinError(data.text);
          else setWsError(data.text);
          break;

        case 'pong':
          break;

        default:
          break;
      }
    };

    ws.onerror = () => {
      if (!joinedRef.current) setJoinError('Could not connect — session may have expired.');
    };

    ws.onclose = (ev) => {
      clearInterval(pingRef.current);

      const isServerRejection = ev.code >= 4000 && ev.code < 5000;

      if (!joinedRef.current) {
        setConnStatus('disconnected');
        if (ev.code === 4004) {
          setJoinError('Session not found or expired.');
        } else if (ev.code === 4029) {
          setJoinError('Too many failed PIN attempts — your IP is locked out of this session.');
        } else if (ev.code === 4003) {
          if (!joinError) setJoinError('Connection rejected — check your PIN and try again.');
        }
        return;
      }

      if (!isServerRejection) {
        const attempt = reconnectRef.current.count;
        if (attempt < RECONNECT_DELAYS_MS.length) {
          reconnectRef.current.count += 1;
          setConnStatus('reconnecting');
          reconnectRef.current.timeoutId = setTimeout(() => {
            _connectWs(reconnectRef.current.name, reconnectRef.current.pin);
          }, RECONNECT_DELAYS_MS[attempt]);
          return;
        }
        setConnStatus('disconnected');
        setWsError('Connection lost — please refresh the page to rejoin.');
      } else {
        setConnStatus('disconnected');
      }
    };
  }

  // True when crypto is supported but the E2E session key hasn't been
  // established yet — we MUST NOT allow sending in this window.
  const e2ePending = cryptoAvailable && !e2eReady;

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || wsRef.current?.readyState !== WebSocket.OPEN) return;
    // Do NOT clear input yet — clear only after successful send so the
    // user's message is preserved if encryption or the WS send throws.

    const { sessionKey } = e2eRef.current;

    if (sessionKey) {
      // ── E2E path: encrypt client-side; server relays opaque ciphertext ──
      try {
        const { ciphertext, iv } = await E2E.encryptMessage(text, sessionKey);
        // Guard again: WS might have closed during the async encrypt.
        if (wsRef.current?.readyState !== WebSocket.OPEN) return;
        wsRef.current.send(JSON.stringify({ type: 'send', ciphertext, iv }));
        setInput(''); // clear only after successful send
      } catch (err) {
        console.error('[E2E] Encryption failed:', err);
        // Message text intentionally preserved in <textarea> so user can retry.
        setWsError('Encryption failed — message not sent. Please try again.');
      }
    } else if (!cryptoAvailable) {
      // ── Plaintext path: TLS-only (insecure context, no SubtleCrypto) ──
      wsRef.current.send(JSON.stringify({ type: 'send', text }));
      setInput('');
    } else {
      // Crypto is available but key not ready — refuse to send.
      // This branch should be unreachable because the UI disables the
      // send button, but guard defensively.
      console.warn('[E2E] Send blocked — session key not yet established.');
    }
  };

  const sendWs = useCallback((payload) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  }, []);

  const kick = useCallback((targetWsId) => {
    sendWs({ type: 'kick', target_ws_id: targetWsId });
  }, [sendWs]);

  const toggleLock = useCallback(() => {
    sendWs({ type: 'lock_room', locked: !roomLocked });
  }, [sendWs, roomLocked]);

  const extendTtl = useCallback(() => {
    sendWs({ type: 'extend_ttl', extra_seconds: 1800 }); // 30 min
  }, [sendWs]);

  const copy = async () => {
    const ok = await copyToClipboard(shareUrl);
    if (ok) {
      setCopied(true);
      setCopyFailed(false);
      setTimeout(() => setCopied(false), 2000);
    } else {
      setCopyFailed(true);
      setTimeout(() => setCopyFailed(false), 4000);
    }
  };

  /* ── Phases ────────────────────────────────────────────── */
  if (phase === 'join') return (
    <JoinScreen
      token={token}
      onJoin={handleJoin}
      error={joinError}
      infoState={infoState}
      joinSecsLeft={joinSecsLeft}
      joinParticipants={joinParticipants}
    />
  );

  if (phase === 'burning') return (
    <BurningAnimation mode="chat" onComplete={() => setPhase('destroyed')} />
  );

  if (phase === 'destroyed') return <DestroyedScreen />;

  /* ── Chat UI ───────────────────────────────────────────── */
  const tColor = timerColor(secsLeft ?? 999);
  const urgent = secsLeft !== null && secsLeft <= 60;

  return (
    <>
      {/*
        Active-session SEO — token-specific canonical URL so each session
        has its own distinct OG card when shared mid-chat.
        noIndex prevents search engines indexing individual session URLs.
      */}
      <SEO
        title="Burn Chat — Encrypted Ephemeral Session | BAR Web"
        description="You've been invited to a Burn Chat session — end-to-end encrypted, ephemeral messaging that permanently self-destructs when the timer expires. No logs, no history, no traces."
        keywords="burn chat, encrypted chat, ephemeral chat, self-destruct chat, e2e encrypted messaging, BAR burn chat, secure chat room, disappearing messages"
        url={`https://bar-rnr.vercel.app/chat/${token}`}
        type="article"
        ogImageAlt="Burn Chat — End-to-End Encrypted Ephemeral Chat | BAR Web"
        noIndex={true}
      />
      <div style={{ height:'100dvh', display:'flex', flexDirection:'column', background:'#EDE3CE', color:T.text, overflow:'hidden' }}>

        {/* Top bar — 56px (matches --navbar-height token) */}
        <div style={{ flexShrink:0, padding:'0 1rem', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(250,244,230,0.92)', backdropFilter:'blur(22px) saturate(160%)', WebkitBackdropFilter:'blur(22px) saturate(160%)', borderBottom:`1px solid rgba(60,45,20,0.18)`, zIndex:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
            <Flame size={16} style={{ color:T.orange }} />
            <span style={{ fontSize:'1rem', fontWeight:700, letterSpacing:'-0.03em', color:T.text }}>Burn Chat</span>
            {/* Creator badge pill — 10px is acceptable for a single-word identifier badge */}
            {isCreator && (
              <span style={{ fontSize:'0.625rem', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:T.orange, background:'rgba(196,70,26,0.1)', border:'1px solid rgba(196,70,26,0.22)', borderRadius:'999px', padding:'0.175rem 0.5rem' }}>Creator</span>
            )}
            {roomLocked && (
              <span style={{ fontSize:'0.625rem', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:T.textS, background:'rgba(60,45,20,0.06)', border:`1px solid ${T.border}`, borderRadius:'999px', padding:'0.175rem 0.5rem', display:'flex', alignItems:'center', gap:'0.25rem' }}>
                <Lock size={9} /> Locked
              </span>
            )}

            {/* E2E status badge — 10px acceptable for compact indicator pill */}
            {!cryptoAvailable ? (
              <span
                title="E2E encryption unavailable — page is not served over HTTPS. Messages are protected by TLS only."
                style={{
                  fontSize:'0.625rem', fontWeight:700, letterSpacing:'0.04em',
                  color:'#B33A2E', background:'rgba(179,58,46,0.09)',
                  border:'1px solid rgba(179,58,46,0.25)', borderRadius:'999px',
                  padding:'0.175rem 0.5rem', cursor:'help',
                  display:'flex', alignItems:'center', gap:'0.25rem',
                }}
              >
                ⚠️ No E2E
              </span>
            ) : e2eReady && e2eFingerprint ? (
              <span
                title={`E2E encrypted — server cannot read messages.\n\nSession code: ${e2eFingerprint}\nAll participants should see the same code. If someone's code differs, the server may be substituting keys — leave immediately.`}
                style={{
                  fontSize:'0.625rem', fontWeight:700, letterSpacing:'0.06em',
                  color:T.green, background:'rgba(63,125,58,0.08)',
                  border:'1px solid rgba(63,125,58,0.22)', borderRadius:'999px',
                  padding:'0.175rem 0.5rem', cursor:'help', fontFamily:T.mono,
                  display:'flex', alignItems:'center', gap:'0.3rem',
                  transition:'opacity 0.3s ease',
                }}
              >
                🔐 {e2eFingerprint}
              </span>
            ) : (
              <span
                title="E2E key exchange in progress…"
                style={{
                  fontSize:'0.625rem', fontWeight:700, letterSpacing:'0.04em',
                  color:T.gold, background:'rgba(180,121,30,0.08)',
                  border:'1px solid rgba(180,121,30,0.22)', borderRadius:'999px',
                  padding:'0.175rem 0.5rem', cursor:'help',
                  display:'flex', alignItems:'center', gap:'0.25rem',
                  animation:'pulse 1.4s ease-in-out infinite',
                }}
              >
                🔓 Securing…
              </span>
            )}
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
            {/* Connection status dot */}
            <ConnStatusDot status={connStatus} />

            {/* Participant count — click to open panel */}
            <button
              onClick={() => setPanelOpen(v => !v)}
              title="Participants"
              style={{
                display:'flex', alignItems:'center', gap:'0.3rem',
                background: panelOpen ? 'rgba(196,70,26,0.08)' : 'transparent',
                border: panelOpen ? '1px solid rgba(196,70,26,0.2)' : '1px solid transparent',
                borderRadius:'0.375rem', padding:'0.2rem 0.4rem',
                cursor:'pointer', transition:'all 0.15s',
              }}
            >
              <Users size={12} style={{ color: panelOpen ? T.orange : T.textS }} />
              <span style={{ fontSize:'0.875rem', color: panelOpen ? T.orange : T.textS, fontFamily:T.mono }}>{participants}</span>
            </button>

            {/* Countdown — fluid font: 1rem → 1.5rem per spec */}
            {secsLeft !== null && (
              <div style={{
                display:'flex', alignItems:'center', gap:'0.375rem',
                padding:'0.25rem 0.75rem', borderRadius:'999px',
                background: urgent ? 'rgba(179,58,46,0.10)' : 'rgba(60,45,20,0.06)',
                border: `1px solid ${urgent ? 'rgba(179,58,46,0.28)' : T.border}`,
                animation: urgent && secsLeft <= 10 ? 'pulse 1s ease-in-out infinite' : 'none',
              }}>
                <div style={{ width:6, height:6, borderRadius:'50%', background:tColor, boxShadow:`0 0 6px ${tColor}`, flexShrink:0 }} />
                {/* clamp(1rem,3vw,1.5rem) — readable on all screen sizes */}
                <span style={{ fontFamily:T.mono, fontSize:'clamp(1rem, 3vw, 1.5rem)', fontWeight:700, color:tColor, lineHeight:1 }}>
                  {fmtTime(secsLeft)}
                </span>
              </div>
            )}

            {/* Copy link */}
            <button onClick={copy} title="Copy share link" style={{ width:28, height:28, borderRadius:'0.375rem', background:'rgba(60,45,20,0.06)', border:`1px solid ${copyFailed ? 'rgba(179,58,46,0.4)' : T.border}`, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:copied ? T.green : copyFailed ? T.red : T.textS }}>
              {copied ? <CheckCircle2 size={13} /> : copyFailed ? <AlertTriangle size={13} /> : <Copy size={13} />}
            </button>
          </div>
        </div>

        {/* Copy-failed toast */}
        {copyFailed && (
          <div style={{ flexShrink:0, padding:'0.5rem 1rem', background:'rgba(179,58,46,0.07)', borderBottom:'1px solid rgba(179,58,46,0.15)', display:'flex', alignItems:'center', gap:'0.5rem' }}>
            <AlertTriangle size={14} style={{ color:T.red, flexShrink:0 }} />
            <p style={{ fontSize:'0.875rem', color:'#B33A2E' }}>Copy failed — please select and copy the link manually.</p>
          </div>
        )}

        {/* E2E degradation banner — only when crypto.subtle is unavailable (http:// context) */}
        {!cryptoAvailable && (
          <div style={{
            flexShrink:0, padding:'0.45rem 1rem',
            background:'rgba(179,58,46,0.07)', borderBottom:'1px solid rgba(179,58,46,0.18)',
            display:'flex', alignItems:'center', gap:'0.5rem',
          }}>
            <AlertTriangle size={14} style={{ color:T.red, flexShrink:0 }} />
            <p style={{ fontSize:'0.875rem', color:'#B33A2E', lineHeight:1.5 }}>
              <strong>E2E encryption unavailable</strong> — page must be served over HTTPS.
              {' '}Messages are protected by TLS only.
            </p>
          </div>
        )}

        {/* Warning bar when &lt; 60s */}
        {urgent && secsLeft > 0 && (
          <div style={{ flexShrink:0, padding:'0.5rem 1rem', background:'rgba(179,58,46,0.08)', borderBottom:'1px solid rgba(179,58,46,0.16)', display:'flex', alignItems:'center', gap:'0.5rem' }}>
            <AlertTriangle size={14} style={{ color:T.red }} />
            <p style={{ fontSize:'0.875rem', color:'#B33A2E' }}>
              ⚠️ Session burns in {secsLeft}s — save anything important now.
            </p>
          </div>
        )}

        {/* Reconnecting banner */}
        {connStatus === 'reconnecting' && (
          <div style={{ flexShrink:0, padding:'0.5rem 1rem', background:'rgba(196,70,26,0.07)', borderBottom:'1px solid rgba(196,70,26,0.15)', display:'flex', alignItems:'center', gap:'0.5rem' }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background:T.orange, flexShrink:0, animation:'pulse 1s ease-in-out infinite' }} />
            <p style={{ fontSize:'0.875rem', color:T.orange }}>Reconnecting… (attempt {reconnectRef.current.count} of 3)</p>
          </div>
        )}

        {/* WS error */}
        {wsError && (
          <div style={{ flexShrink:0, padding:'0.5rem 1rem', background:'rgba(179,58,46,0.07)', borderBottom:'1px solid rgba(179,58,46,0.15)', display:'flex', alignItems:'center', gap:'0.5rem' }}>
            <AlertTriangle size={14} style={{ color:T.red, flexShrink:0 }} />
            <p style={{ fontSize:'0.875rem', color:'#B33A2E' }}>{wsError}</p>
          </div>
        )}

        {/* Body: messages + optional participants panel */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Messages area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {messages.length === 0 && (
              <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'0.75rem', opacity:0.4 }}>
                <Flame size={32} style={{ color:T.orange }} />
                <p style={{ fontSize:'0.875rem', color:T.textS }}>No messages yet. Be the first.</p>
              </div>
            )}
            {messages.map(m => (
              <Bubble
                key={m.id}
                msg={m}
                myName={myName}
                sessionKey={e2eSessionKey}
              />
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Participant panel — slide in when panelOpen */}
          {panelOpen && (
            <ParticipantPanel
              participantList={participantList}
              myWsId={myWsIdRef.current}
              isCreator={isCreator}
              roomLocked={roomLocked}
              onKick={kick}
              onToggleLock={toggleLock}
              onExtendTtl={extendTtl}
              onClose={() => setPanelOpen(false)}
            />
          )}
        </div>

        {/* Input bar
             min-height 44px ensures WCAG 2.5.5 touch target.
             padding-bottom env(safe-area-inset-bottom) handles iOS home bar.
        */}
        <div
          style={{
            flexShrink:0,
            padding:'0.625rem 1rem',
            paddingBottom:'max(0.625rem, env(safe-area-inset-bottom))',
            borderTop:`1px solid ${T.border}`,
            background:'rgba(250,244,230,0.90)',
            backdropFilter:'blur(12px)',
            WebkitBackdropFilter:'blur(12px)',
            display:'flex', gap:'0.5rem', alignItems:'flex-end',
          }}
        >
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!e2ePending) sendMessage(); } }}
            placeholder={e2ePending ? '⏳ Waiting for encryption…' : 'Message… (Enter to send)'}
            maxLength={2000}
            rows={1}
            aria-label="Chat message"
            style={{
              flex:1,
              /* min-height 44px — WCAG touch target via padding + line-height */
              minHeight:44,
              background:T.s2, border:`1px solid ${T.border}`, borderRadius:'0.75rem',
              padding:'0.6875rem 0.875rem',
              color:T.text,
              /* var(--text-sm) = 14px minimum; message input at 15px for comfort */
              fontSize:'0.9375rem',
              fontFamily:'inherit',
              resize:'none', outline:'none', lineHeight:1.5, maxHeight:120, overflowY:'auto',
              /* Specific transition — more performant than 'all' */
              transition:'border-color 0.18s ease, box-shadow 0.18s ease',
            }}
            onFocus={e => {
              e.target.style.borderColor='rgba(196,70,26,0.45)';
              e.target.style.boxShadow='0 0 0 3px rgba(196,70,26,0.12)';
            }}
            onBlur={e => {
              e.target.style.borderColor=T.border;
              e.target.style.boxShadow='none';
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || e2ePending}
            aria-label={e2ePending ? 'Waiting for encryption' : 'Send message'}
            style={{
              /* 44×44px — WCAG 2.5.5 touch target (was 42×42) */
              width:44, height:44,
              minWidth:44, minHeight:44,
              borderRadius:'0.75rem', border:'none',
              background:e2ePending?'rgba(180,121,30,0.12)':input.trim()?'linear-gradient(160deg,#C4461A 0%,#9A3612 100%)':'rgba(60,45,20,0.08)',
              color:e2ePending?T.gold:input.trim()?'#fff':T.textT,
              display:'flex', alignItems:'center', justifyContent:'center',
              cursor:(input.trim() && !e2ePending)?'pointer':'not-allowed', flexShrink:0,
              /* Specific properties — more performant than 'all 0.15s' */
              transition:'background 0.18s ease, box-shadow 0.18s ease, transform 0.15s ease',
              boxShadow:input.trim() && !e2ePending?'0 2px 10px rgba(196,70,26,0.28)':'none',
            }}
            onMouseOver={e => { if (input.trim()) { e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 4px 14px rgba(196,70,26,0.38)'; } }}
            onMouseOut={e  => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow=input.trim()?'0 2px 10px rgba(196,70,26,0.28)':'none'; }}
          >
            <Send size={17} />
          </button>
        </div>
      </div>
    </>
  );
}
