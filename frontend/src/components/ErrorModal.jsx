import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, X } from 'lucide-react';

const ErrorModal = ({ error, onClose }) => {
  // Auto-dismiss after 8 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(onClose, 8000);
      return () => clearTimeout(timer);
    }
  }, [error, onClose]);

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e) => { if (e.key === 'Escape') onClose(); };
    if (error) {
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [error, onClose]);

  return (
    <AnimatePresence>
      {error && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0, zIndex: 200,
              background: 'rgba(60,45,20,0.12)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '1rem',
            }}
          >
            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ type: 'spring', duration: 0.4, bounce: 0.2 }}
              onClick={e => e.stopPropagation()}
              style={{
                position: 'relative', width: '100%', maxWidth: 400,
                background: '#FAF4E6',
                border: '1px solid rgba(179,58,46,0.22)',
                borderRadius: '1rem',
                overflow: 'hidden',
                boxShadow: '0 8px 40px rgba(60,45,20,0.12)',
              }}
            >
              {/* Top accent */}
              <div
                style={{
                  height: '1px',
                  background: 'linear-gradient(90deg, rgba(179,58,46,0.55) 0%, rgba(179,58,46,0.15) 55%, transparent 100%)',
                }}
              />

              <div style={{ padding: '1.75rem 1.5rem' }}>
                {/* Close button */}
                <button
                  onClick={onClose}
                  aria-label="Close"
                  style={{
                    position: 'absolute', top: '1rem', right: '1rem',
                    width: 28, height: 28,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'transparent',
                    border: '1px solid transparent',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    color: 'rgba(60,45,20,0.45)',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseOver={e => {
                    e.currentTarget.style.color = 'rgba(60,45,20,0.80)';
                    e.currentTarget.style.background = 'rgba(60,45,20,0.08)';
                    e.currentTarget.style.borderColor = 'rgba(60,45,20,0.16)';
                  }}
                  onMouseOut={e => {
                    e.currentTarget.style.color = 'rgba(60,45,20,0.45)';
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderColor = 'transparent';
                  }}
                >
                  <X size={14} />
                </button>

                {/* Icon */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.125rem' }}>
                  <div
                    style={{
                      width: 44, height: 44, borderRadius: '50%',
                      background: 'rgba(179,58,46,0.08)',
                      border: '1px solid rgba(179,58,46,0.18)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <AlertCircle size={20} style={{ color: '#B33A2E' }} />
                  </div>
                </div>

                {/* Title */}
                <h3
                  style={{
                    fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.025em',
                    color: '#2A2018', textAlign: 'center', marginBottom: '0.875rem',
                  }}
                >
                  Something went wrong
                </h3>

                {/* Error message */}
                <div
                  style={{
                    padding: '0.75rem 1rem', borderRadius: '0.625rem',
                    background: 'rgba(179,58,46,0.06)',
                    border: '1px solid rgba(179,58,46,0.14)',
                    marginBottom: '1.25rem',
                  }}
                >
                  <p
                    style={{
                      /* Raised from 0.8125rem/#888888 — WCAG AA requires 4.5:1 */
                      fontSize: '0.875rem', color: '#55483A',
                      textAlign: 'center', lineHeight: 1.6,
                    }}
                  >
                    {error}
                  </p>
                </div>

                {/* Dismiss button */}
                <button
                  onClick={onClose}
                  style={{
                    width: '100%',
                    /* 44px touch target */
                    minHeight: 44,
                    padding: '0 1rem',
                    borderRadius: '0.625rem',
                    border: '1px solid rgba(60,45,20,0.16)',
                    background: 'rgba(60,45,20,0.06)',
                    /* Raised from 0.8125rem/#888888 */
                    color: '#55483A', fontSize: '0.875rem', fontWeight: 500,
                    cursor: 'pointer', textAlign: 'center',
                    /* Specific transition — more performant than 'all' */
                    transition: 'background 0.15s ease, color 0.15s ease',
                    letterSpacing: '-0.01em',
                    fontFamily: 'inherit',
                  }}
                  onMouseOver={e => {
                    e.currentTarget.style.background = 'rgba(60,45,20,0.16)';
                    e.currentTarget.style.color = '#e0e0e0';
                  }}
                  onMouseOut={e => {
                    e.currentTarget.style.background = 'rgba(60,45,20,0.06)';
                    e.currentTarget.style.color = '#55483A';
                  }}
                >
                  Got it
                </button>

                <p
                  style={{
                    textAlign: 'center',
                    /* Raised from 0.625rem (10px) / #2a2a2a (near-invisible on dark bg) */
                    fontSize: '0.75rem',
                    color: '#857358',
                    marginTop: '0.75rem',
                    letterSpacing: '0.02em',
                  }}
                >
                  Auto-dismisses in 8s · ESC to close
                </p>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ErrorModal;
