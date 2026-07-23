import React, { useEffect } from 'react';
import { FileX, Flame } from 'lucide-react';

/**
 * BurningAnimation
 * ----------------
 * Full-screen destruction overlay shown immediately before the final
 * "destroyed" screen. Supports two visual modes:
 *
 *   mode="file"  (default) — FileX icon, red glow
 *   mode="chat"            — Flame icon, orange glow
 *
 * @param {'file' | 'chat'} [mode='file']
 * @param {() => void}      [onComplete]   Called after 3 s.
 */
const BurningAnimation = ({ mode = 'file', onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onComplete) onComplete();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  const isChat  = mode === 'chat';
  const color   = isChat ? '#C4461A' : '#B33A2E';
  const glowBg  = isChat ? 'rgba(196,70,26,0.18)' : 'rgba(179,58,46,0.18)';
  const heading = isChat ? 'Session Burned'   : 'File Destroyed';
  const body    = isChat
    ? 'All messages have been permanently erased. No trace remains.'
    : 'This file has been permanently deleted and can no longer be accessed.';

  return (
    <div style={{ position:'fixed', inset:0, background:'#EDE3CE', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999 }}>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', padding:'2rem' }}>

        <div style={{ position:'relative', marginBottom:'2rem' }}>
          <div style={{ position:'absolute', inset:0, background:glowBg, filter:'blur(40px)', borderRadius:'50%' }} />
          {isChat ? (
            <Flame size={80} strokeWidth={1.5} style={{ color, position:'relative', zIndex:1, animation:'bounce 1s infinite' }} />
          ) : (
            <FileX  size={80} strokeWidth={1.5} style={{ color, position:'relative', zIndex:1, animation:'bounce 1s infinite' }} />
          )}
        </div>

        <h2 style={{ fontSize:'1.875rem', fontWeight:700, color:'#2A2018', marginBottom:'0.5rem', letterSpacing:'-0.03em' }}>
          {heading}
        </h2>
        <p style={{ color:'#857358', maxWidth:'20rem', margin:'0 auto' }}>{body}</p>

        <div style={{ width:'12rem', height:'0.25rem', background:'rgba(60,45,20,0.12)', borderRadius:'9999px', marginTop:'2rem', overflow:'hidden' }}>
          <div style={{ height:'100%', background:color, animation:'progress-bar 3s linear forwards', transformOrigin:'left' }} />
        </div>

      </div>
    </div>
  );
};

export default BurningAnimation;
