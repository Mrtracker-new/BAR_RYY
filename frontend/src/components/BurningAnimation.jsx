import React, { useEffect } from 'react';
import { FileX, Flame } from 'lucide-react';

/**
 * BurningAnimation
 * ----------------
 * Full-screen destruction overlay shown immediately before the final
 * "destroyed" screen. Supports two visual modes:
 *
 *   mode="file"  (default)
 *     Icon    : FileX (red)
 *     Heading : "File Destroyed"
 *     Body    : "This file has been permanently deleted and can no longer be accessed."
 *     Glow    : red
 *
 *   mode="chat"
 *     Icon    : Flame (orange)
 *     Heading : "Session Burned"
 *     Body    : "All messages have been permanently erased. No trace remains."
 *     Glow    : orange
 *
 * Props
 * -----
 * @param {'file' | 'chat'} [mode='file']  Visual / copy variant.
 * @param {() => void}      [onComplete]   Called after the animation finishes (3 s).
 */
const BurningAnimation = ({ mode = 'file', onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onComplete) onComplete();
    }, 3000); // 3 s — snappy yet long enough for the animation to register

    return () => clearTimeout(timer);
  }, [onComplete]);

  const isChat = mode === 'chat';

  /* ── Mode-specific values ───────────────────────────────── */
  const glowColor  = isChat ? 'bg-orange-500/20' : 'bg-red-500/20';
  const barColor   = isChat ? 'bg-orange-500'    : 'bg-red-500';
  const heading    = isChat ? 'Session Burned'   : 'File Destroyed';
  const body       = isChat
    ? 'All messages have been permanently erased. No trace remains.'
    : 'This file has been permanently deleted and can no longer be accessed.';

  return (
    <div className="fixed inset-0 bg-zinc-950 flex items-center justify-center z-[9999]">
      <div className="flex flex-col items-center animate-fade-in text-center p-8">

        {/* Icon — file-specific vs chat-specific */}
        <div className="relative mb-8">
          <div className={`absolute inset-0 ${glowColor} blur-3xl rounded-full animate-pulse-slow`} />

          {isChat ? (
            <Flame
              className="text-orange-500 animate-bounce relative z-10"
              size={80}
              strokeWidth={1.5}
            />
          ) : (
            <FileX
              className="text-red-500 animate-bounce relative z-10"
              size={80}
              strokeWidth={1.5}
            />
          )}
        </div>

        {/* Copy */}
        <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">
          {heading}
        </h2>
        <p className="text-zinc-400 max-w-xs mx-auto">
          {body}
        </p>

        {/* Progress bar */}
        <div className="w-48 h-1 bg-zinc-800 rounded-full mt-8 overflow-hidden">
          <div className={`h-full ${barColor} animate-progress-bar w-full origin-left`} />
        </div>

      </div>
    </div>
  );
};

export default BurningAnimation;
