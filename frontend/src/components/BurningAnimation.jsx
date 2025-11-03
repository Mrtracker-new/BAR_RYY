import React, { useEffect } from 'react';
import { File } from 'lucide-react';

const BurningAnimation = ({ onComplete }) => {
  useEffect(() => {
    console.log('🔥 BurningAnimation mounted!');
    // Auto-complete after animation finishes (5 seconds)
    const timer = setTimeout(() => {
      console.log('🔥 BurningAnimation complete!');
      if (onComplete) onComplete();
    }, 5000);

    return () => {
      console.log('🔥 BurningAnimation unmounted!');
      clearTimeout(timer);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-black via-gray-900 to-black flex items-center justify-center z-[9999]">
      {/* Background glow effect */}
      <div className="absolute inset-0 bg-gradient-radial from-orange-900/20 via-transparent to-transparent animate-pulse"></div>
      
      <div className="relative flex flex-col items-center w-full max-w-2xl px-8">
        {/* File icon with shake and burn animation */}
        <div className="relative z-20 mb-16 animate-shake-burn">
          <File size={96} className="text-gray-200 drop-shadow-2xl" strokeWidth={1.5} />
        </div>
        
        {/* Fire effect - multiple flames with better positioning */}
        <div className="flames absolute bottom-32 left-1/2 -translate-x-1/2 w-96 h-64 z-10">
          {[...Array(15)].map((_, i) => (
            <div
              key={i}
              className="flame absolute bottom-0"
              style={{
                left: `${(i * 100) / 14}%`,
                animationDelay: `${i * 0.15}s`,
                width: `${40 + Math.random() * 20}px`,
                height: `${80 + Math.random() * 40}px`,
                transform: `translateX(-50%)`
              }}
            />
          ))}
        </div>
        
        {/* Multiple smoke layers for depth */}
        <div className="smoke absolute top-0 left-1/2 -translate-x-1/2 w-80 h-80 opacity-70" />
        <div className="smoke absolute top-10 left-1/3 -translate-x-1/2 w-64 h-64 opacity-50" style={{ animationDelay: '0.5s' }} />
        <div className="smoke absolute top-5 left-2/3 -translate-x-1/2 w-72 h-72 opacity-60" style={{ animationDelay: '0.3s' }} />
        
        {/* Message with better styling */}
        <h2 className="text-5xl font-black text-red-500 mt-48 animate-fade-in text-shadow-fire z-30 tracking-tight">
          🔥 File Destroyed Forever
        </h2>
        <p className="text-xl text-gray-400 mt-4 animate-fade-in-delayed z-30 opacity-0">
          This file can never be recovered
        </p>
        
        {/* Enhanced embers with more variety */}
        <div className="embers absolute inset-0 pointer-events-none">
          {[...Array(30)].map((_, i) => {
            const size = 3 + Math.random() * 5;
            return (
              <div
                key={i}
                className="ember absolute rounded-full"
                style={{
                  left: `${20 + Math.random() * 60}%`,
                  top: `${40 + Math.random() * 30}%`,
                  width: `${size}px`,
                  height: `${size}px`,
                  animationDelay: `${Math.random() * 3}s`,
                  animationDuration: `${3 + Math.random() * 3}s`
                }}
              />
            );
          })}
        </div>
        
        {/* Heat distortion effect */}
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-full h-64 bg-gradient-to-t from-orange-600/10 to-transparent blur-2xl animate-pulse z-0"></div>
      </div>
    </div>
  );
};

export default BurningAnimation;
