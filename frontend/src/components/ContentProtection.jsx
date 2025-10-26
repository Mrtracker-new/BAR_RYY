import { useEffect, useState } from 'react';

const ContentProtection = ({ children, enabled = true, watermarkText = '' }) => {
  const [isBlurred, setIsBlurred] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    let blurTimeout;

    // Blur content when window loses focus
    const handleVisibilityChange = () => {
      console.log('Visibility changed:', document.hidden);
      setIsBlurred(document.hidden);
    };

    const handleBlur = () => {
      console.log('Window blur event triggered');
      setIsBlurred(true);
    };

    const handleFocus = () => {
      console.log('Window focus event triggered');
      setIsBlurred(false);
      if (blurTimeout) clearTimeout(blurTimeout);
    };

    // Additional blur detection using Page Visibility API
    const handlePageHide = () => {
      console.log('Page hide event');
      setIsBlurred(true);
    };

    // Detect when mouse leaves the window (possible screenshot attempt)
    const handleMouseLeave = () => {
      setIsBlurred(true);
    };

    const handleMouseEnter = () => {
      setIsBlurred(false);
      if (blurTimeout) clearTimeout(blurTimeout);
    };

    // Mobile: Detect screenshot attempts via visibility API
    // On some Android devices, taking a screenshot briefly hides the page
    const handleVisibilityBlur = () => {
      if (document.hidden) {
        setIsBlurred(true);
        // On mobile, keep blurred for 2 seconds after screenshot
        blurTimeout = setTimeout(() => {
          if (!document.hidden) setIsBlurred(false);
        }, 2000);
      }
    };

    // Listen for visibility changes and focus events
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('visibilitychange', handleVisibilityBlur);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('pagehide', handleBlur); // iOS screenshot detection
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('visibilitychange', handleVisibilityBlur);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pagehide', handleBlur);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
      if (blurTimeout) clearTimeout(blurTimeout);
    };
  }, [enabled]);

  if (!enabled) {
    return children;
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Blur overlay when window loses focus */}
      {isBlurred && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backdropFilter: 'blur(20px)',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '24px',
            fontWeight: 'bold'
          }}
        >
          🔒 Content Hidden
        </div>
      )}

      {/* Watermark overlay */}
      {watermarkText && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: 'none',
            zIndex: 9998,
            overflow: 'hidden',
            width: '100%',
            height: '100%'
          }}
        >
          {/* Create repeating watermark pattern */}
          {Array.from({ length: 50 }).map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: `${(i * 150) % 800}px`,
                left: `${(i * 300) % 1200}px`,
                transform: 'rotate(-45deg)',
                color: 'rgba(255, 215, 0, 0.15)',
                fontSize: '20px',
                fontWeight: 'bold',
                whiteSpace: 'nowrap',
                userSelect: 'none',
                textShadow: '0 0 10px rgba(255, 215, 0, 0.3)'
              }}
            >
              {watermarkText}
            </div>
          ))}
        </div>
      )}

      {/* Main content */}
      <div
        style={{
          userSelect: 'none',
          WebkitUserSelect: 'none',
          MozUserSelect: 'none',
          msUserSelect: 'none'
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default ContentProtection;
