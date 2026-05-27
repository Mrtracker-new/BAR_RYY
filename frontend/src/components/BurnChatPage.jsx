import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Flame, Send, Users, Copy, CheckCircle2, Shield, AlertTriangle, ArrowLeft, Clock, X, Lock, Unlock, PlusCircle } from 'lucide-react';
import { copyToClipboard } from '../utils/clipboard';
import axios from '../config/axios';
import BurningAnimation from './BurningAnimation';
import SEO from './SEO';

const T = {
  gold: '#E8A020', green: '#22C55E', red: '#EF4444', orange: '#F97316',
  bg: '#070707', s0: '#0d0d0d', s1: '#111111', s2: '#161616',
  border: 'rgba(255,255,255,0.06)', text: '#efefef', textS: '#888888', textT: '#404040',
  mono: "'JetBrains Mono', monospace",
};

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
    <div style={{ minHeight:'100vh', background:T.bg, display:'flex', alignItems:'center', justifyContent:'center', padding:'1.5rem' }}>
      <div style={{ width:'100%', maxWidth:380 }}>
        <div style={{ textAlign:'center', marginBottom:'2rem' }}>
          <div style={{ width:56, height:56, borderRadius:'50%', background:'rgba(249,115,22,0.1)', border:'1px solid rgba(249,115,22,0.2)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 1rem' }}>
            <Flame size={24} style={{ color:T.orange }} />
          </div>
          <h1 style={{ fontSize:'1.375rem', fontWeight:700, letterSpacing:'-0.03em', color:T.text, marginBottom:'0.375rem' }}>Join Burn Chat</h1>
          <p style={{ fontSize:'0.8125rem', color:T.textS }}>Messages vanish when the timer expires.</p>
          <code style={{ fontSize:'0.6875rem', color:T.textT, fontFamily:T.mono, display:'block', marginTop:'0.5rem' }}>{token}</code>
        </div>

        {/* Session info strip */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'center', gap:'1rem',
          marginBottom:'1rem', minHeight:28,
        }}>
          {infoState === 'loading' && (
            <div style={{ height:8, width:120, borderRadius:4, background:'rgba(255,255,255,0.06)', animation:'pulse 1.4s ease-in-out infinite' }} />
          )}
          {infoState === 'ok' && joinSecsLeft !== null && (
            <>
              <div style={{ display:'flex', alignItems:'center', gap:'0.35rem', padding:'0.25rem 0.7rem', borderRadius:'999px', background:'rgba(255,255,255,0.04)', border:`1px solid ${tColor}30` }}>
                <Clock size={12} style={{ color:tColor }} />
                <span style={{ fontSize:'0.8rem', fontWeight:700, color:tColor, fontFamily:T.mono }}>
                  {fmtTime(joinSecsLeft)}
                </span>
              </div>
              {joinParticipants > 0 && (
                <div style={{ display:'flex', alignItems:'center', gap:'0.3rem' }}>
                  <Users size={12} style={{ color:T.textS }} />
                  <span style={{ fontSize:'0.8rem', color:T.textS }}>
                    {joinParticipants} {joinParticipants === 1 ? 'person' : 'people'} inside
                  </span>
                </div>
              )}
            </>
          )}
          {infoState === 'expired' && (
            <span style={{ fontSize:'0.8rem', color:T.red }}>This session has already burned.</span>
          )}
          {infoState === 'error' && (
            <span style={{ fontSize:'0.8rem', color:T.textS }}>Could not load session info.</span>
          )}
        </div>

        <div style={{ background:T.s0, border:`1px solid ${T.border}`, borderRadius:'1rem', padding:'1.5rem', display:'flex', flexDirection:'column', gap:'1rem' }}>
          <div>
            <label style={{ fontSize:'0.75rem', fontWeight:600, color:T.textS, display:'block', marginBottom:'0.375rem' }}>Display name</label>
            <input className="input-field" placeholder="Your name…" value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&canJoin&&onJoin(name.trim(),isCreator?pin:null)} maxLength={30} />
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.625rem 0.75rem', borderRadius:'0.5rem', background:'rgba(255,255,255,0.02)', border:`1px solid ${T.border}`, cursor:'pointer' }} onClick={()=>setIsCreator(v=>!v)}>
            <input type="checkbox" id="creator-chk" checked={isCreator} onChange={()=>setIsCreator(v=>!v)} style={{ cursor:'pointer' }} />
            <label htmlFor="creator-chk" style={{ fontSize:'0.8125rem', color:T.textS, cursor:'pointer', display:'flex', alignItems:'center', gap:'0.375rem' }}>
              <Shield size={13} style={{ color:T.orange }} /> I'm the creator (have PIN)
            </label>
          </div>

          {isCreator && (
            <div>
              <label style={{ fontSize:'0.75rem', fontWeight:600, color:T.textS, display:'block', marginBottom:'0.375rem' }}>Creator PIN</label>
              <input className="input-field" placeholder="XXXXXX" value={pin} onChange={e=>setPin(e.target.value.toUpperCase().slice(0,6))} maxLength={6} style={{ fontFamily:T.mono, letterSpacing:'0.2em', fontSize:'1.125rem' }} />
            </div>
          )}

          {error && (
            <div style={{ display:'flex', gap:'0.5rem', padding:'0.75rem', borderRadius:'0.5rem', background:'rgba(239,68,68,0.07)', border:'1px solid rgba(239,68,68,0.15)' }}>
              <AlertTriangle size={14} style={{ color:T.red, flexShrink:0 }} />
              <p style={{ fontSize:'0.8125rem', color:'#fca5a5' }}>{error}</p>
            </div>
          )}

          <button
            onClick={() => canJoin && onJoin(name.trim(), isCreator ? pin : null)}
            disabled={!canJoin}
            style={{
              padding:'0.875rem', borderRadius:'0.625rem', border:'none', fontWeight:700, fontSize:'0.9375rem',
              cursor: canJoin ? 'pointer' : 'not-allowed', transition:'all 0.2s',
              background: canJoin ? 'linear-gradient(160deg,#F97316 0%,#C05010 100%)' : 'rgba(255,255,255,0.06)',
              color: canJoin ? '#fff' : T.textT, display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem',
              boxShadow: canJoin ? '0 4px 16px rgba(249,115,22,0.2)' : 'none',
            }}
          >
            <Flame size={14} /> Join Session
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Destroyed screen ──────────────────────────────────────── */
function DestroyedScreen() {
  return (
    <div style={{ minHeight:'100vh', background:T.bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ textAlign:'center', padding:'2rem' }}>
        <div style={{ width:72, height:72, borderRadius:'50%', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 1.5rem' }}>
          <Flame size={32} style={{ color:T.red }} />
        </div>
        <h2 style={{ fontSize:'1.5rem', fontWeight:700, color:T.text, letterSpacing:'-0.03em', marginBottom:'0.5rem' }}>Session Burned</h2>
        <p style={{ color:T.textS, fontSize:'0.875rem', maxWidth:'28ch', margin:'0 auto 2rem' }}>All messages have been permanently erased. No trace remains.</p>
        <a href="/" style={{ display:'inline-flex', alignItems:'center', gap:'0.5rem', padding:'0.75rem 1.25rem', borderRadius:'0.625rem', background:'rgba(255,255,255,0.05)', border:`1px solid ${T.border}`, color:T.textS, textDecoration:'none', fontSize:'0.875rem', fontWeight:500 }}>
          <ArrowLeft size={13} /> Back to BAR Web
        </a>
      </div>
    </div>
  );
}

/* ── Message bubble ────────────────────────────────────────── */
function Bubble({ msg, myName }) {
  const isMe = msg.sender_name === myName;
  if (msg.type === 'system') return (
    <div style={{ textAlign:'center', padding:'0.25rem 0' }}>
      <span style={{ fontSize:'0.6875rem', color:T.textT, background:'rgba(255,255,255,0.03)', padding:'0.2rem 0.75rem', borderRadius:'999px', border:`1px solid ${T.border}` }}>{msg.text}</span>
    </div>
  );
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:isMe?'flex-end':'flex-start', marginBottom:'0.125rem' }}>
      {!isMe && (
        <span style={{ fontSize:'0.6875rem', color:msg.is_creator?T.orange:T.textT, fontWeight:600, marginBottom:'0.2rem', marginLeft:'0.25rem' }}>
          {msg.sender_name}{msg.is_creator?' 👑':''}
        </span>
      )}
      <div style={{
        maxWidth:'75%', padding:'0.625rem 0.875rem', borderRadius:isMe?'1rem 1rem 0.25rem 1rem':'1rem 1rem 1rem 0.25rem',
        background:isMe?'rgba(249,115,22,0.15)':'rgba(255,255,255,0.05)',
        border:`1px solid ${isMe?'rgba(249,115,22,0.25)':T.border}`,
        fontSize:'0.875rem', color:T.text, lineHeight:1.5,
        wordBreak:'break-word',
      }}>
        {msg.text}
      </div>
      <span style={{ fontSize:'0.625rem', color:T.textT, marginTop:'0.2rem', padding:'0 0.25rem' }}>{relTime(msg.sent_at)}</span>
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
              border: `1px solid ${roomLocked ? 'rgba(249,115,22,0.3)' : T.border}`,
              background: roomLocked ? 'rgba(249,115,22,0.07)' : 'rgba(255,255,255,0.03)',
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
              background: 'rgba(255,255,255,0.03)',
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
              background: p.ws_id === myWsId ? 'rgba(249,115,22,0.05)' : 'transparent',
            }}
          >
            {/* Avatar initial */}
            <div style={{
              width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
              background: p.is_creator ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${p.is_creator ? 'rgba(249,115,22,0.25)' : T.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.65rem', fontWeight: 700,
              color: p.is_creator ? T.orange : T.textS,
            }}>
              {p.name.charAt(0).toUpperCase()}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontSize: '0.8rem', fontWeight: 600,
                color: p.ws_id === myWsId ? T.orange : p.is_creator ? T.gold : T.text,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {p.name}
                {p.is_creator && ' 👑'}
                {p.ws_id === myWsId && <span style={{ color: T.textT, fontWeight: 400, fontSize: '0.7rem' }}> (you)</span>}
              </p>
            </div>

            {/* Kick button — creator sees it on everyone except themselves */}
            {isCreator && p.ws_id !== myWsId && (
              <button
                onClick={() => onKick(p.ws_id)}
                title={`Remove ${p.name}`}
                style={{
                  width: 20, height: 20, borderRadius: 4,
                  border: '1px solid rgba(239,68,68,0.2)',
                  background: 'transparent', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'rgba(239,68,68,0.5)', flexShrink: 0,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = T.red; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(239,68,68,0.5)'; }}
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

  const shareUrl = `${window.location.origin}/chat/${token}`;

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

    _connectWs(name, pin);
  }, [token, addSysMsg]); // eslint-disable-line react-hooks/exhaustive-deps

  function _connectWs(name, pin) {
    clearInterval(pingRef.current);
    joinedRef.current = false;
    setConnStatus('connecting');

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
        case 'joined':
          joinedRef.current = true;
          myWsIdRef.current = data.ws_id ?? null; // server may include ws_id in future
          reconnectRef.current.count = 0;
          setConnStatus('connected');
          setIsCreator(data.is_creator);
          setSecsLeft(data.seconds_remaining);
          setParticipants(data.participant_count);
          if (data.participant_list) setParticipantList(data.participant_list);
          if (data.locked !== undefined) setRoomLocked(data.locked);
          setPhase('chat');
          pingRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'ping' }));
            }
          }, PING_INTERVAL_MS);
          break;
        case 'message':
          setMessages(prev => [...prev, data]);
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
          if (!joinedRef.current) {
            setJoinError(data.text);
          } else {
            setWsError(data.text);
          }
          break;
        case 'pong':
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

  const sendMessage = () => {
    const text = input.trim();
    if (!text || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({ type: 'send', text }));
    setInput('');
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
    <BurningAnimation onComplete={() => setPhase('destroyed')} />
  );

  if (phase === 'destroyed') return <DestroyedScreen />;

  /* ── Chat UI ───────────────────────────────────────────── */
  const tColor = timerColor(secsLeft ?? 999);
  const urgent = secsLeft !== null && secsLeft <= 60;

  return (
    <>
      <SEO title={`Burn Chat — BAR Web`} description="Ephemeral encrypted chat that self-destructs." />
      <div style={{ height:'100dvh', display:'flex', flexDirection:'column', background:T.bg, color:T.text, overflow:'hidden' }}>

        {/* Top bar */}
        <div style={{ flexShrink:0, padding:'0 1rem', height:52, display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(7,7,7,0.92)', backdropFilter:'blur(20px)', borderBottom:`1px solid ${T.border}`, zIndex:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
            <Flame size={16} style={{ color:T.orange }} />
            <span style={{ fontSize:'0.875rem', fontWeight:700, letterSpacing:'-0.02em', color:T.text }}>Burn Chat</span>
            {isCreator && (
              <span style={{ fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:T.orange, background:'rgba(249,115,22,0.1)', border:'1px solid rgba(249,115,22,0.2)', borderRadius:'999px', padding:'0.15rem 0.45rem' }}>Creator</span>
            )}
            {roomLocked && (
              <span style={{ fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:T.textS, background:'rgba(255,255,255,0.04)', border:`1px solid ${T.border}`, borderRadius:'999px', padding:'0.15rem 0.45rem', display:'flex', alignItems:'center', gap:'0.2rem' }}>
                <Lock size={8} /> Locked
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
                background: panelOpen ? 'rgba(249,115,22,0.08)' : 'transparent',
                border: panelOpen ? '1px solid rgba(249,115,22,0.2)' : '1px solid transparent',
                borderRadius:'0.375rem', padding:'0.2rem 0.4rem',
                cursor:'pointer', transition:'all 0.15s',
              }}
            >
              <Users size={12} style={{ color: panelOpen ? T.orange : T.textS }} />
              <span style={{ fontSize:'0.8125rem', color: panelOpen ? T.orange : T.textS, fontFamily:T.mono }}>{participants}</span>
            </button>

            {/* Countdown */}
            {secsLeft !== null && (
              <div style={{
                display:'flex', alignItems:'center', gap:'0.375rem',
                padding:'0.25rem 0.625rem', borderRadius:'999px',
                background: urgent ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${urgent ? 'rgba(239,68,68,0.25)' : T.border}`,
                animation: urgent && secsLeft <= 10 ? 'pulse 1s ease-in-out infinite' : 'none',
              }}>
                <div style={{ width:6, height:6, borderRadius:'50%', background:tColor, boxShadow:`0 0 6px ${tColor}` }} />
                <span style={{ fontFamily:T.mono, fontSize:'0.8125rem', fontWeight:700, color:tColor }}>
                  {fmtTime(secsLeft)}
                </span>
              </div>
            )}

            {/* Copy link */}
            <button onClick={copy} title="Copy share link" style={{ width:28, height:28, borderRadius:'0.375rem', background:'rgba(255,255,255,0.04)', border:`1px solid ${copyFailed ? 'rgba(239,68,68,0.4)' : T.border}`, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:copied ? T.green : copyFailed ? T.red : T.textS }}>
              {copied ? <CheckCircle2 size={13} /> : copyFailed ? <AlertTriangle size={13} /> : <Copy size={13} />}
            </button>
          </div>
        </div>

        {/* Copy-failed toast */}
        {copyFailed && (
          <div style={{ flexShrink:0, padding:'0.4rem 1rem', background:'rgba(239,68,68,0.07)', borderBottom:'1px solid rgba(239,68,68,0.15)', display:'flex', alignItems:'center', gap:'0.5rem' }}>
            <AlertTriangle size={13} style={{ color:T.red, flexShrink:0 }} />
            <p style={{ fontSize:'0.8125rem', color:'#fca5a5' }}>Copy failed — please select and copy the link manually.</p>
          </div>
        )}

        {/* Warning bar when &lt; 60s */}
        {urgent && secsLeft > 0 && (
          <div style={{ flexShrink:0, padding:'0.5rem 1rem', background:'rgba(239,68,68,0.08)', borderBottom:'1px solid rgba(239,68,68,0.15)', display:'flex', alignItems:'center', gap:'0.5rem' }}>
            <AlertTriangle size={13} style={{ color:T.red }} />
            <p style={{ fontSize:'0.8125rem', color:'#fca5a5' }}>
              ⚠️ Session burns in {secsLeft}s — save anything important now.
            </p>
          </div>
        )}

        {/* Reconnecting banner */}
        {connStatus === 'reconnecting' && (
          <div style={{ flexShrink:0, padding:'0.4rem 1rem', background:'rgba(249,115,22,0.07)', borderBottom:'1px solid rgba(249,115,22,0.15)', display:'flex', alignItems:'center', gap:'0.5rem' }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:T.orange, animation:'pulse 1s ease-in-out infinite' }} />
            <p style={{ fontSize:'0.8125rem', color:T.orange }}>Reconnecting… (attempt {reconnectRef.current.count} of 3)</p>
          </div>
        )}

        {/* WS error */}
        {wsError && (
          <div style={{ flexShrink:0, padding:'0.5rem 1rem', background:'rgba(239,68,68,0.07)', borderBottom:'1px solid rgba(239,68,68,0.15)' }}>
            <p style={{ fontSize:'0.8125rem', color:'#fca5a5' }}>{wsError}</p>
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
            {messages.map(m => <Bubble key={m.id} msg={m} myName={myName} />)}
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

        {/* Input bar */}
        <div style={{ flexShrink:0, padding:'0.75rem 1rem', borderTop:`1px solid ${T.border}`, background:'rgba(7,7,7,0.8)', display:'flex', gap:'0.5rem', alignItems:'flex-end' }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Message… (Enter to send)"
            maxLength={2000}
            rows={1}
            style={{
              flex:1, background:T.s2, border:`1px solid ${T.border}`, borderRadius:'0.625rem',
              padding:'0.625rem 0.875rem', color:T.text, fontSize:'0.9375rem', fontFamily:'inherit',
              resize:'none', outline:'none', lineHeight:1.5, maxHeight:120, overflowY:'auto',
            }}
            onFocus={e=>e.target.style.borderColor='rgba(249,115,22,0.4)'}
            onBlur={e=>e.target.style.borderColor=T.border}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim()}
            style={{
              width:42, height:42, borderRadius:'0.625rem', border:'none',
              background:input.trim()?'linear-gradient(160deg,#F97316 0%,#C05010 100%)':'rgba(255,255,255,0.06)',
              color:input.trim()?'#fff':T.textT, display:'flex', alignItems:'center', justifyContent:'center',
              cursor:input.trim()?'pointer':'not-allowed', flexShrink:0, transition:'all 0.15s',
              boxShadow:input.trim()?'0 2px 8px rgba(249,115,22,0.25)':'none',
            }}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </>
  );
}
