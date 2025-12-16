import React, { useEffect } from 'react';
import { FileX, Trash2 } from 'lucide-react';

const BurningAnimation = ({ onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onComplete) onComplete();
    }, 3000); // Reduced to 3s for snappier experience

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 bg-zinc-950 flex items-center justify-center z-[9999]">
      <div className="flex flex-col items-center animate-fade-in text-center p-8">

        {/* Icon Animation */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-red-500/20 blur-3xl rounded-full animate-pulse-slow"></div>
          <FileX className="text-red-500 animate-bounce relative z-10" size={80} strokeWidth={1.5} />
        </div>

        {/* Text */}
        <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">
          File Destroyed
        </h2>
        <p className="text-zinc-400 max-w-xs mx-auto">
          This file has been permanently deleted and can no longer be accessed.
        </p>

        {/* Minimal loading bar */}
        <div className="w-48 h-1 bg-zinc-800 rounded-full mt-8 overflow-hidden">
          <div className="h-full bg-red-500 animate-progress-bar w-full origin-left"></div>
        </div>
      </div>
    </div>
  );
};

export default BurningAnimation;
