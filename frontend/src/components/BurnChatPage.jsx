import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Flame, Send, Users, Copy, CheckCircle2, Shield, AlertTriangle, ArrowLeft } from 'lucide-react';
import BurningAnimation from './BurningAnimation';
import SEO from './SEO';

const T = {
  gold: '#E8A020', green: '#22C55E', red: '#EF4444', orange: '#F97316',
  bg: '#070707', s0: '#0d0d0d', s1: '#111111', s2: '#161616',
  border: 'rgba(255,255,255,0.06)', text: '#efefef', textS: '#888888', textT: '#404040',
  mono: "'JetBrains Mono', monospace",
};

function fmtTime(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
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
function JoinScreen({ token, onJoin, error }) {
  const [name, setName]       = useState('');
  const [pin, setPin]         = useState('');
  const [isCreator, setIsCreator] = useState(false);

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

        <div style={{ background:T.s0, border:`1px solid ${T.border}`, borderRadius:'1rem', padding:'1.5rem', display:'flex', flexDirection:'column', gap:'1rem' }}>
          <div>
            <label style={{ fontSize:'0.75rem', fontWeight:600, color:T.textS, display:'block', marginBottom:'0.375rem' }}>Display name</label>
            <input className="input-field" placeholder="Your name…" value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&name.trim()&&onJoin(name.trim(),isCreator?pin:null)} maxLength={30} />
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

          <button onClick={()=>name.trim()&&onJoin(name.trim(),isCreator?pin:null)} disabled={!name.trim()} style={{
            padding:'0.875rem', borderRadius:'0.625rem', border:'none', fontWeight:700, fontSize:'0.9375rem',
            cursor:name.trim()?'pointer':'not-allowed', transition:'all 0.2s',
            background:name.trim()?'linear-gradient(160deg,#F97316 0%,#C05010 100%)':'rgba(255,255,255,0.06)',
            color:name.trim()?'#fff':T.textT, display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem',
            boxShadow:name.trim()?'0 4px 16px rgba(249,115,22,0.2)':'none',
          }}>
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

/* ── Main component ────────────────────────────────────────── */
export default function BurnChatPage({ token }) {
  const [phase, setPhase]         = useState('join'); // join | chat | burning | destroyed
  const [myName, setMyName]       = useState('');
  const [isCreator, setIsCreator] = useState(false);
  const [messages, setMessages]   = useState([]);
  const [participants, setParticipants] = useState(0);
  const [secsLeft, setSecsLeft]   = useState(null);
  const [input, setInput]         = useState('');
  const [joinError, setJoinError]     = useState(null);
  const [wsError, setWsError]         = useState(null);
  const [copied, setCopied]           = useState(false);
  const [reconnecting, setReconnecting] = useState(0); // attempt number, 0 = not reconnecting

  const wsRef         = useRef(null);
  const bottomRef     = useRef(null);
  const countRef      = useRef(null);      // local countdown interval
  const joinedRef     = useRef(false);     // true once the server confirms join
  const pingRef       = useRef(null);      // keepalive interval
  const reconnectRef  = useRef({           // reconnect state
    count: 0, name: null, pin: null, timeoutId: null,
  });

  const shareUrl = `${window.location.origin}/chat/${token}`;

  /* auto-scroll */
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }); }, [messages]);

  /* local countdown tick (UI-only, server is authoritative) */
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
    clearTimeout(reconnectRef.current.timeoutId);
    wsRef.current?.close();
  }, []);

  const handleJoin = useCallback((name, pin) => {
    setJoinError(null);
    setMyName(name);

    // Store credentials so the reconnect path can re-use them.
    reconnectRef.current.name = name;
    reconnectRef.current.pin  = pin;
    reconnectRef.current.count = 0;
    setReconnecting(0);

    _connectWs(name, pin);
  }, [token, addSysMsg]); // eslint-disable-line react-hooks/exhaustive-deps

  /* inner connection factory — called by handleJoin and the reconnect path */
  function _connectWs(name, pin) {
    clearInterval(pingRef.current);
    joinedRef.current = false;

    const PING_INTERVAL_MS    = 20_000;
    const RECONNECT_DELAYS_MS = [1_000, 2_000, 4_000];

    const wsBase = resolveWsUrl();
    const ws     = new WebSocket(`${wsBase}/chat/${token}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'join', display_name: name, ...(pin ? { pin } : {}) }));
    };

    ws.onmessage = (ev) => {
      let data;
      try { data = JSON.parse(ev.data); } catch { return; }

      switch (data.type) {
        case 'joined':
          joinedRef.current = true;
          reconnectRef.current.count = 0; // reset backoff counter on clean join
          setReconnecting(0);
          setIsCreator(data.is_creator);
          setSecsLeft(data.seconds_remaining);
          setParticipants(data.participant_count);
          setPhase('chat');
          // Start keepalive ping so firewalls/LBs don't close the idle connection.
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
          addSysMsg(data.text);
          break;
        case 'countdown':
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

      // 4xxx codes are deliberate server rejections — never reconnect.
      const isServerRejection = ev.code >= 4000 && ev.code < 5000;

      if (!joinedRef.current) {
        // Still in the handshake phase — surface the error on the join screen.
        if (ev.code === 4004) {
          setJoinError('Session not found or expired.');
        } else if (ev.code === 4029) {
          setJoinError('Too many failed PIN attempts — your IP is locked out of this session.');
        } else if (ev.code === 4003) {
          if (!joinError) setJoinError('Connection rejected — check your PIN and try again.');
        }
        return;
      }

      // Post-join unexpected close — attempt reconnect with exponential backoff.
      if (!isServerRejection) {
        const attempt = reconnectRef.current.count;
        if (attempt < RECONNECT_DELAYS_MS.length) {
          reconnectRef.current.count += 1;
          setReconnecting(attempt + 1);
          reconnectRef.current.timeoutId = setTimeout(() => {
            _connectWs(reconnectRef.current.name, reconnectRef.current.pin);
          }, RECONNECT_DELAYS_MS[attempt]);
          return;
        }
        // All retries exhausted.
        setReconnecting(0);
        setWsError('Connection lost — please refresh the page to rejoin.');
      }
    };
  }

  const sendMessage = () => {
    const text = input.trim();
    if (!text || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({ type: 'send', text }));
    setInput('');
  };

  const copy = () => { navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(()=>setCopied(false),2000); };

  /* ── Phases ────────────────────────────────────────────── */
  if (phase === 'join') return <JoinScreen token={token} onJoin={handleJoin} error={joinError} />;

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
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
            {/* Participant count */}
            <div style={{ display:'flex', alignItems:'center', gap:'0.3rem' }}>
              <Users size={12} style={{ color:T.textS }} />
              <span style={{ fontSize:'0.8125rem', color:T.textS, fontFamily:T.mono }}>{participants}</span>
            </div>

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
            <button onClick={copy} style={{ width:28, height:28, borderRadius:'0.375rem', background:'rgba(255,255,255,0.04)', border:`1px solid ${T.border}`, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:copied?T.green:T.textS }}>
              {copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
            </button>
          </div>
        </div>

        {/* Warning bar when < 60s */}
        {urgent && secsLeft > 0 && (
          <div style={{ flexShrink:0, padding:'0.5rem 1rem', background:'rgba(239,68,68,0.08)', borderBottom:'1px solid rgba(239,68,68,0.15)', display:'flex', alignItems:'center', gap:'0.5rem' }}>
            <AlertTriangle size={13} style={{ color:T.red }} />
            <p style={{ fontSize:'0.8125rem', color:'#fca5a5' }}>
              ⚠️ Session burns in {secsLeft}s — save anything important now.
            </p>
          </div>
        )}

        {/* Reconnecting banner */}
        {reconnecting > 0 && (
          <div style={{ flexShrink:0, padding:'0.4rem 1rem', background:'rgba(249,115,22,0.07)', borderBottom:'1px solid rgba(249,115,22,0.15)', display:'flex', alignItems:'center', gap:'0.5rem' }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:T.orange, animation:'pulse 1s ease-in-out infinite' }} />
            <p style={{ fontSize:'0.8125rem', color:T.orange }}>Reconnecting… (attempt {reconnecting} of 3)</p>
          </div>
        )}

        {/* WS error */}
        {wsError && (
          <div style={{ flexShrink:0, padding:'0.5rem 1rem', background:'rgba(239,68,68,0.07)', borderBottom:'1px solid rgba(239,68,68,0.15)' }}>
            <p style={{ fontSize:'0.8125rem', color:'#fca5a5' }}>{wsError}</p>
          </div>
        )}

        {/* Messages area */}
        <div style={{ flex:1, overflowY:'auto', padding:'1rem', display:'flex', flexDirection:'column', gap:'0.375rem' }}>
          {messages.length === 0 && (
            <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'0.75rem', opacity:0.4 }}>
              <Flame size={32} style={{ color:T.orange }} />
              <p style={{ fontSize:'0.875rem', color:T.textS }}>No messages yet. Be the first.</p>
            </div>
          )}
          {messages.map(m => <Bubble key={m.id} msg={m} myName={myName} />)}
          <div ref={bottomRef} />
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
