import React, { useState } from 'react';
import axios from '../config/axios';
import { Download, AlertCircle, FileCheck, Mail, Shield, ChevronDown } from 'lucide-react';
import ContentProtection from './ContentProtection';
import BurningAnimation from './BurningAnimation';
import LoadingStages from './LoadingStages';
import SEO from './SEO';

/* ─────────────────────────────────────────────────────────────
   DESIGN TOKENS — consistent with index.css :root
───────────────────────────────────────────────────────────── */
const T = {
  gold:        '#B4791E',
  goldDim:     'rgba(180,121,30,0.10)',
  goldBorder:  'rgba(180,121,30,0.22)',
  green:       '#3F7D3A',
  greenDim:    'rgba(63,125,58,0.08)',
  greenBorder: 'rgba(63,125,58,0.20)',
  red:         '#B33A2E',
  redDim:      'rgba(179,58,46,0.07)',
  redBorder:   'rgba(179,58,46,0.18)',
  blue:        '#2C4A6E',
  blueDim:     'rgba(44,74,110,0.06)',
  blueBorder:  'rgba(44,74,110,0.18)',

  /* Backgrounds */
  bg:       '#EDE3CE',
  surface0: '#FAF4E6',
  surface1: '#FFFDF6',
  surface2: '#F1E8D3',

  /* Text */
  textPrimary:   '#2A2018',
  textSecondary: '#55483A',
  textTertiary:  '#857358',
  textDim:       '#857358',

  /* Borders */
  border:      'rgba(60,45,20,0.16)',
  borderHover: 'rgba(60,45,20,0.30)',

  /* Font */
  mono: "'JetBrains Mono', monospace",
};

/* ─────────────────────────────────────────────────────────────
   SUB-COMPONENTS — Alert blocks (replaces ad-hoc Tailwind blocks)
───────────────────────────────────────────────────────────── */
function AlertBlock({ variant = 'error', icon: Icon, children }) {
  const variantMap = {
    error:   { bg: T.redDim,   border: T.redBorder,   color: T.red,   textColor: '#8A2B22' },
    success: { bg: T.greenDim, border: T.greenBorder,  color: T.green, textColor: '#2F5E2C' },
    info:    { bg: T.blueDim,  border: T.blueBorder,   color: T.blue,  textColor: '#22406A' },
    warning: { bg: T.goldDim,  border: T.goldBorder,   color: T.gold,  textColor: '#8F5E16' },
  };
  const v = variantMap[variant] || variantMap.error;

  return (
    <div
      style={{
        display: 'flex', alignItems: 'flex-start', gap: '0.625rem',
        padding: '0.875rem 1rem',
        background: v.bg, border: `1px solid ${v.border}`,
        borderRadius: '0.75rem',
      }}
    >
      {Icon && (
        <Icon size={16} style={{ color: v.color, flexShrink: 0, marginTop: '0.1rem' }} />
      )}
      <p style={{ fontSize: '0.875rem', color: v.textColor, lineHeight: 1.6, margin: 0 }}>
        {children}
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   SHAREPAGE
───────────────────────────────────────────────────────────── */
const SharePage = ({ token }) => {
  const [password, setPassword]               = useState('');
  const [isLoading, setIsLoading]             = useState(false);
  const [error, setError]                     = useState(null);
  const [fileData, setFileData]               = useState(null);
  const [fileName, setFileName]               = useState(null);
  const [isViewOnly, setIsViewOnly]           = useState(false);
  const [viewsRemaining, setViewsRemaining]   = useState(null);
  const [successMessage, setSuccessMessage]   = useState(null);
  const [otpSent, setOtpSent]                 = useState(false);
  const [otpVerified, setOtpVerified]         = useState(false);
  const [otpCode, setOtpCode]                 = useState('');
  const [otpInfo, setOtpInfo]                 = useState(null);
  const [otpPanelOpen, setOtpPanelOpen]       = useState(false);
  const [recipientEmail, setRecipientEmail]   = useState('');
  const [emailError, setEmailError]           = useState('');
  const [showBurning, setShowBurning]         = useState(false);
  const [loadingStage, setLoadingStage]       = useState(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [estimatedTime, setEstimatedTime]     = useState(null);
  const [requestStartTime, setRequestStartTime] = useState(null);

  const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  /* ── OTP request ── */
  const handleRequestOtp = async () => {
    const email = recipientEmail.trim();
    if (!email)                    { setEmailError('Please enter your email address'); return; }
    if (!EMAIL_RE.test(email))     { setEmailError('Please enter a valid email address'); return; }
    setEmailError('');
    setIsLoading(true); setError(null);
    try {
      const response = await axios.post(
        `/request-otp/${token}`,
        { email },
        { headers: { 'Content-Type': 'application/json' } }
      );
      setOtpSent(true);
      setOtpInfo(response.data);
      setSuccessMessage(response.data.message);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send OTP');
    } finally {
      setIsLoading(false);
    }
  };

  /* ── OTP verify ── */
  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.length !== 6) { setError('Please enter a valid 6-digit OTP code'); return; }
    setIsLoading(true); setError(null);
    try {
      const formData = new FormData();
      formData.append('otp_code', otpCode);
      await axios.post(`/verify-otp/${token}`, formData);
      setOtpVerified(true);
      setOtpPanelOpen(false);
      setSuccessMessage('✅ Identity verified — accessing your file…');
      await new Promise(r => setTimeout(r, 100));
      await handleDownload();
    } catch (err) {
      setError(err.response?.data?.detail || 'OTP verification failed');
      setIsLoading(false);
    }
  };

  /* ── File download ── */
  const handleDownload = async () => {
    setIsLoading(true); setError(null); setSuccessMessage(null);
    setLoadingStage('connecting'); setLoadingProgress(0);
    const startTime = Date.now();
    setRequestStartTime(startTime);

    try {
      setTimeout(() => {
        if (loadingStage !== null) { setLoadingStage('authenticating'); setLoadingProgress(25); }
      }, 300);

      const response = await axios.post(
        `/share/${token}`,
        { password: password || null },
        { responseType: 'arraybuffer' }
      );

      const responseTime = (Date.now() - startTime) / 1000;
      if (responseTime > 3) setEstimatedTime(15);

      setLoadingStage('decrypting');  setLoadingProgress(50);
      setLoadingStage('rendering');   setLoadingProgress(75);

      const retrievedFileName      = response.headers['x-bar-filename'];
      const retrievedViewsRemaining = response.headers['x-bar-views-remaining'] || '0';
      const shouldDestroy           = response.headers['x-bar-should-destroy'] === 'true';
      const viewOnly                = response.headers['x-bar-view-only'] === 'true';

      setFileName(retrievedFileName);
      setViewsRemaining(retrievedViewsRemaining);
      setIsViewOnly(viewOnly);
      setLoadingProgress(100);

      if (viewOnly) {
        const contentType = response.headers['content-type'] || 'application/octet-stream';
        const fileBlob    = new Blob([response.data], { type: contentType });
        setFileData(URL.createObjectURL(fileBlob));
        setSuccessMessage(`File loaded successfully. ${retrievedViewsRemaining} view(s) remaining.`);
      } else {
        const blob        = new Blob([response.data], { type: 'application/octet-stream' });
        const downloadUrl = URL.createObjectURL(blob);
        const link        = document.createElement('a');
        link.href = downloadUrl; link.download = retrievedFileName || 'decrypted_file';
        document.body.appendChild(link); link.click();
        document.body.removeChild(link); URL.revokeObjectURL(downloadUrl);
        if (shouldDestroy) {
          setShowBurning(true);
        } else {
          setSuccessMessage(`✅ File downloaded! ${retrievedViewsRemaining} view(s) remaining.`);
        }
      }

      const autoRefreshSeconds = parseInt(response.headers['x-bar-auto-refresh-seconds'] || '0');
      if (autoRefreshSeconds > 0) {
        setTimeout(() => window.location.reload(), autoRefreshSeconds * 1000);
      }

    } catch (err) {
      let errorMsg = 'Failed to download file: ';
      if (err.response?.status === 404) {
        errorMsg = '🚫 File not found or already destroyed';
      } else if (err.response?.status === 410) {
        errorMsg = '🔥 File has been destroyed — maximum views reached';
      } else if (err.response?.status === 403) {
        let detail = 'Unknown error';
        if (err.response?.data) {
          if (err.response.data instanceof ArrayBuffer) {
            try {
              const text = new TextDecoder().decode(err.response.data);
              const json = JSON.parse(text);
              detail = json.detail || text;
            } catch (e) {
              try { detail = new TextDecoder().decode(err.response.data); } catch {}
            }
          } else if (typeof err.response.data === 'string') {
            detail = err.response.data;
          } else if (err.response.data.detail) {
            detail = err.response.data.detail;
          } else if (typeof err.response.data === 'object') {
            detail = JSON.stringify(err.response.data);
          }
        }
        if (detail.includes('2FA') || detail.includes('OTP')) {
          setOtpPanelOpen(true);
          errorMsg = detail;
        } else {
          errorMsg = '🚫 Access denied: ' + detail;
        }
      } else if (err.response?.data?.detail) {
        errorMsg += err.response.data.detail;
      } else {
        errorMsg += err.message;
      }
      setError(errorMsg);
    } finally {
      setIsLoading(false);
      setLoadingStage(null); setLoadingProgress(0); setEstimatedTime(null);
    }
  };

  return (
    <>
      <SEO
        title="Secure File Access — BAR Web"
        description="You have a secure, encrypted file waiting. One-time access protected by AES-256 encryption. The file permanently self-destructs after viewing — open it before it's gone."
        ogImageAlt="Secure encrypted file — BAR by Rolan"
        url={`${window.location.origin}/share/${token}`}
        noIndex={true}
      />

      {showBurning && (
        <BurningAnimation
          onComplete={() => {
            setShowBurning(false);
            setSuccessMessage('🔥 File permanently destroyed — this link is no longer valid.');
          }}
        />
      )}

      {/*
        Full-screen centered layout.
        Uses design-system tokens instead of Tailwind zinc-950, zinc-900 etc.
        which were inconsistent with the rest of the app.
      */}
      <div
        style={{
          minHeight: '100vh',
          background: '#EDE3CE',
          color: T.textPrimary,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          /* p-5 sm:p-7 → fluid padding: tighter on phones */
          padding: 'clamp(1.25rem, 4vw, 1.75rem)',
        }}
      >
        <div style={{ width: '100%', maxWidth: 448 }}>

          {/* ── Main card ── */}
          <div
            style={{
              border: `1px solid rgba(60,45,20,0.16)`,
              borderRadius: '1rem',
              /* p-5 sm:p-7 — fluid padding (was p-8 = 32px fixed, cramped on 375px) */
              padding: 'clamp(1.25rem, 5vw, 1.75rem)',
              background: 'rgba(250,244,230,0.88)',
              backdropFilter: 'blur(20px) saturate(140%)',
              WebkitBackdropFilter: 'blur(20px) saturate(140%)',
              boxShadow: '0 24px 64px rgba(60,45,20,0.12)',
            }}
          >
            <div style={{ textAlign: 'center' }}>

              {/* ── File icon ── */}
              {/* p-4 → p-3 sm:p-4 — fluid icon container */}
              <div
                style={{
                  display: 'inline-block',
                  padding: 'clamp(0.75rem, 2.5vw, 1rem)',
                  background: T.surface2,
                  borderRadius: '1rem',
                  border: `1px solid ${T.border}`,
                  marginBottom: '1.25rem',
                  boxShadow: 'inset 0 1px 0 rgba(60,45,20,0.06)',
                }}
              >
                <FileCheck size={40} style={{ color: T.gold }} />
              </div>

              {/* ── Heading ── */}
              <h1
                style={{
                  fontSize: '1.5rem', fontWeight: 700,
                  color: T.textPrimary, marginBottom: '0.5rem', letterSpacing: '-0.035em',
                }}
              >
                Secure File Access
              </h1>
              <p style={{ fontSize: '0.875rem', color: T.textSecondary, marginBottom: '1.5rem' }}>
                This link allows one-time access to a secure file.
              </p>

              {/* ── Error / Success alerts ── */}
              {error && (
                <div style={{ marginBottom: '1rem', textAlign: 'left' }}>
                  <AlertBlock variant="error" icon={AlertCircle}>{error}</AlertBlock>
                </div>
              )}
              {successMessage && (
                <div style={{ marginBottom: '1rem', textAlign: 'left' }}>
                  <AlertBlock variant="success" icon={FileCheck}>{successMessage}</AlertBlock>
                </div>
              )}

              {/* ── Form fields ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', textAlign: 'left' }}>

                {/* Password field */}
                <div>
                  <label
                    style={{
                      display: 'block', fontSize: '0.875rem',
                      color: T.textSecondary, fontWeight: 500, marginBottom: '0.5rem',
                    }}
                  >
                    Password Protection
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !otpPanelOpen && handleDownload()}
                    placeholder="Enter password if required…"
                    className="input-field"
                    style={{ width: '100%' }}
                    aria-label="Container password"
                  />
                </div>

                {/* ── 2FA Accordion ── */}
                {!otpVerified && (
                  <div>
                    {/* Accordion header — always visible */}
                    <button
                      type="button"
                      onClick={() => setOtpPanelOpen(v => !v)}
                      aria-expanded={otpPanelOpen}
                      aria-controls="otp-panel"
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between',
                        /* py-3 → 44px touch target (was py-2.5 = ~40px) */
                        padding: '0.75rem 1rem',
                        borderRadius: '0.625rem',
                        border: `1px solid ${T.border}`,
                        background: 'rgba(60,45,20,0.04)',
                        color: T.textTertiary,
                        fontSize: '0.875rem', fontWeight: 500,
                        cursor: 'pointer', textAlign: 'left',
                        transition: 'border-color 0.18s ease, color 0.18s ease',
                        fontFamily: 'inherit',
                      }}
                      onMouseOver={e => {
                        e.currentTarget.style.borderColor = T.borderHover;
                        e.currentTarget.style.color = T.textSecondary;
                      }}
                      onMouseOut={e => {
                        e.currentTarget.style.borderColor = T.border;
                        e.currentTarget.style.color = T.textTertiary;
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Shield size={14} style={{ color: T.blue, flexShrink: 0 }} />
                        Requires 2-factor authentication?
                      </span>
                      <ChevronDown
                        size={14}
                        style={{
                          flexShrink: 0,
                          transform: otpPanelOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.2s ease',
                        }}
                      />
                    </button>

                    {/* Accordion body */}
                    {otpPanelOpen && (
                      <div id="otp-panel" style={{ marginTop: '0.5rem' }}>
                        {!otpSent ? (
                          /* Email entry */
                          <div
                            style={{
                              background: T.blueDim,
                              border: `1px solid ${T.blueBorder}`,
                              borderRadius: '0.75rem',
                              padding: 'clamp(1rem, 3vw, 1.25rem)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                              <Shield size={16} style={{ color: T.blue, flexShrink: 0 }} />
                              <p style={{ fontSize: '0.875rem', fontWeight: 600, color: T.blue }}>
                                2FA Verification
                              </p>
                            </div>
                            <p style={{ fontSize: '0.8125rem', color: T.textSecondary, marginBottom: '0.875rem', lineHeight: 1.6 }}>
                              Enter your email address to receive a one-time code.
                            </p>

                            <input
                              type="email"
                              value={recipientEmail}
                              onChange={e => { setRecipientEmail(e.target.value); setEmailError(''); }}
                              onKeyDown={e => e.key === 'Enter' && handleRequestOtp()}
                              placeholder="your@email.com"
                              className="input-field"
                              style={{ width: '100%', marginBottom: emailError ? '0.25rem' : '0.625rem' }}
                              aria-label="Your email address for OTP"
                            />

                            {emailError && (
                              <p style={{ fontSize: '0.8125rem', color: T.red, marginBottom: '0.625rem' }}>
                                {emailError}
                              </p>
                            )}

                            <button
                              onClick={handleRequestOtp}
                              disabled={isLoading}
                              style={{
                                width: '100%',
                                /* 44px touch target */
                                minHeight: 44, padding: '0 1rem',
                                background: '#3B82F6',
                                color: '#fff', fontWeight: 600,
                                fontSize: '0.875rem',
                                border: 'none', borderRadius: '0.5rem',
                                cursor: isLoading ? 'not-allowed' : 'pointer',
                                opacity: isLoading ? 0.6 : 1,
                                transition: 'opacity 0.18s ease, background 0.18s ease',
                                fontFamily: 'inherit',
                              }}
                              onMouseOver={e => { if (!isLoading) e.currentTarget.style.background = '#2563EB'; }}
                              onMouseOut={e  => { e.currentTarget.style.background = '#3B82F6'; }}
                            >
                              {isLoading ? 'Sending…' : 'Send Verification Code'}
                            </button>
                          </div>
                        ) : (
                          /* OTP code entry */
                          <div
                            style={{
                              background: 'rgba(60,45,20,0.04)',
                              border: `1px solid ${T.border}`,
                              borderRadius: '0.75rem',
                              padding: 'clamp(1rem, 3vw, 1.25rem)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                              <Mail size={16} style={{ color: T.green, flexShrink: 0 }} />
                              <p style={{ fontSize: '0.875rem', fontWeight: 600, color: T.green }}>Code Sent</p>
                            </div>
                            <p style={{ fontSize: '0.8125rem', color: T.textSecondary, textAlign: 'center', marginBottom: '0.25rem' }}>
                              Enter the 6-digit code sent to your email.
                            </p>
                            {otpInfo?.message && (
                              <p style={{ fontSize: '0.8125rem', color: T.textTertiary, textAlign: 'center', fontFamily: T.mono, marginBottom: '0.25rem' }}>
                                {otpInfo.message}
                              </p>
                            )}
                            {otpInfo && (
                              <p style={{ fontSize: '0.75rem', color: T.textDim, textAlign: 'center', marginBottom: '0.875rem' }}>
                                ({otpInfo.max_attempts} attempts remaining)
                              </p>
                            )}

                            {/* OTP code input */}
                            <input
                              type="text"
                              value={otpCode}
                              onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                              onKeyDown={e => e.key === 'Enter' && handleVerifyOtp()}
                              placeholder="000 000"
                              maxLength={6}
                              aria-label="6-digit OTP code"
                              style={{
                                width: '100%',
                                padding: '0.75rem 1rem',
                                background: 'rgba(60,45,20,0.12)',
                                border: `1px solid ${T.border}`,
                                borderRadius: '0.5rem',
                                color: T.textPrimary, outline: 'none',
                                textAlign: 'center',
                                fontSize: '1.5rem', fontWeight: 700,
                                fontFamily: T.mono,
                                /* tracking-[0.35em] — less cramped than 0.5em on mobile */
                                letterSpacing: '0.35em',
                                marginBottom: '0.75rem',
                                transition: 'border-color 0.18s ease',
                              }}
                            />

                            <button
                              onClick={handleVerifyOtp}
                              disabled={isLoading || otpCode.length !== 6}
                              style={{
                                width: '100%', minHeight: 44,
                                padding: '0 1rem',
                                borderRadius: '0.5rem',
                                border: 'none',
                                fontFamily: 'inherit',
                                fontWeight: 700, fontSize: '0.9375rem',
                                cursor: (otpCode.length === 6 && !isLoading) ? 'pointer' : 'not-allowed',
                                background: (otpCode.length === 6 && !isLoading)
                                  ? 'linear-gradient(160deg, #CE9530 0%, #B4791E 100%)'
                                  : T.surface2,
                                color: (otpCode.length === 6 && !isLoading) ? '#2A2018' : T.textTertiary,
                                transition: 'all 0.18s ease',
                              }}
                            >
                              {isLoading ? 'Verifying…' : 'Verify & Unlock'}
                            </button>

                            {/* Change email / Resend row */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem' }}>
                              <button
                                onClick={() => { setOtpSent(false); setOtpCode(''); setSuccessMessage(null); }}
                                disabled={isLoading}
                                style={{
                                  background: 'none', border: 'none', cursor: 'pointer',
                                  fontSize: '0.8125rem', color: T.textDim,
                                  transition: 'color 0.15s ease', fontFamily: 'inherit',
                                }}
                                onMouseOver={e => { e.currentTarget.style.color = T.textSecondary; }}
                                onMouseOut={e  => { e.currentTarget.style.color = T.textDim; }}
                              >
                                ← Change email
                              </button>
                              <button
                                onClick={handleRequestOtp}
                                disabled={isLoading}
                                style={{
                                  background: 'none', border: 'none', cursor: 'pointer',
                                  fontSize: '0.8125rem', color: T.textTertiary,
                                  transition: 'color 0.15s ease', fontFamily: 'inherit',
                                }}
                                onMouseOver={e => { e.currentTarget.style.color = T.textPrimary; }}
                                onMouseOut={e  => { e.currentTarget.style.color = T.textTertiary; }}
                              >
                                Resend Code
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Access File button ── */}
                {!fileData && (
                  <>
                    {isLoading && loadingStage ? (
                      <LoadingStages
                        currentStage={loadingStage}
                        progress={loadingProgress}
                        estimatedTime={estimatedTime}
                      />
                    ) : (
                      <button
                        onClick={handleDownload}
                        disabled={isLoading}
                        className={isLoading ? '' : 'btn-primary'}
                        style={{
                          width: '100%',
                          justifyContent: 'center',
                          /* Match btn-primary 48px */
                          minHeight: 48,
                          ...(isLoading ? {
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            gap: '0.5rem',
                            background: T.surface1,
                            color: T.textTertiary,
                            border: `1px solid ${T.border}`,
                            borderRadius: '0.75rem',
                            fontFamily: 'inherit',
                            fontSize: '0.9375rem', fontWeight: 600,
                            cursor: 'not-allowed',
                          } : {}),
                        }}
                      >
                        <Download size={16} />
                        Access File
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* ── Notice strip ── */}
              {!fileData && (
                <div
                  style={{
                    marginTop: '1rem',
                    padding: '0.625rem 0.875rem',
                    background: T.goldDim,
                    border: `1px solid ${T.goldBorder}`,
                    borderRadius: '0.5rem',
                  }}
                >
                  <p style={{ fontSize: '0.8125rem', color: 'rgba(180,121,30,0.75)', textAlign: 'left' }}>
                    <strong>Notice:</strong> This file may self-destruct after viewing.
                  </p>
                </div>
              )}

              {/* ── File Viewer for View-Only Mode ── */}
              {fileData && isViewOnly && (
                <ContentProtection enabled={true} watermarkText={`View-Only • ${token.substring(0, 8)}`}>
                  <div
                    style={{
                      marginTop: '1.5rem',
                      border: `1px solid ${T.border}`,
                      borderRadius: '0.75rem', overflow: 'hidden',
                      background: 'rgba(60,45,20,0.12)',
                    }}
                  >
                    {/* File viewer toolbar */}
                    <div
                      style={{
                        background: T.surface1,
                        padding: '0.625rem 0.875rem',
                        borderBottom: `1px solid ${T.border}`,
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <p
                        style={{
                          fontSize: '0.8125rem', color: T.textSecondary,
                          fontWeight: 500, overflow: 'hidden',
                          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          minWidth: 0, flex: 1,
                        }}
                      >
                        {fileName}
                      </p>
                      {/* View-Only badge: raised from text-[10px] → 12px */}
                      <span
                        style={{
                          flexShrink: 0,
                          fontSize: '0.75rem',         /* raised from 10px — below 11px minimum */
                          fontWeight: 600, letterSpacing: '0.02em',
                          padding: '0.15rem 0.5rem', borderRadius: '0.25rem',
                          background: T.goldDim,
                          color: T.gold,
                          border: `1px solid ${T.goldBorder}`,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        View-Only
                      </span>
                    </div>

                    {/* File content area — max-h-[60vh] viewport-relative */}
                    <div style={{ padding: '1rem', maxHeight: '60vh', overflowY: 'auto' }}>
                      {fileName && (
                        fileName.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) ? (
                          <img
                            src={fileData} alt={fileName}
                            style={{ maxWidth: '100%', height: 'auto', display: 'block', margin: '0 auto', borderRadius: '0.5rem', pointerEvents: 'none' }}
                            draggable={false}
                          />
                        ) : fileName.match(/\.(mp4|webm|ogg)$/i) ? (
                          <video
                            controls controlsList="nodownload" disablePictureInPicture
                            style={{ maxWidth: '100%', height: 'auto', display: 'block', margin: '0 auto', borderRadius: '0.5rem' }}
                            onContextMenu={e => e.preventDefault()}
                          >
                            <source src={fileData} />
                          </video>
                        ) : fileName.match(/\.(mp3|wav|ogg)$/i) ? (
                          <audio
                            controls controlsList="nodownload"
                            style={{ width: '100%' }}
                            onContextMenu={e => e.preventDefault()}
                          >
                            <source src={fileData} />
                          </audio>
                        ) : fileName.match(/\.pdf$/i) ? (
                          <iframe
                            src={fileData} title={fileName}
                            style={{ width: '100%', height: '24rem', borderRadius: '0.5rem', border: `1px solid ${T.border}` }}
                          />
                        ) : fileName.match(/\.(txt|md|json|xml|csv)$/i) ? (
                          <iframe
                            src={fileData} title={fileName}
                            style={{ width: '100%', height: '24rem', background: '#fff', borderRadius: '0.5rem' }}
                          />
                        ) : (
                          /* Cannot preview — improved empty state */
                          <div
                            style={{
                              padding: '2.5rem 1rem', textAlign: 'center',
                              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
                            }}
                          >
                            <AlertCircle size={24} style={{ color: T.textTertiary }} />
                            <p style={{ fontSize: '0.875rem', color: T.textSecondary }}>
                              Cannot preview this file type (.{fileName.split('.').pop()})
                            </p>
                            <p style={{ fontSize: '0.8125rem', color: T.textTertiary }}>
                              Downloads are disabled for this sensitive file.
                            </p>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </ContentProtection>
              )}
            </div>
          </div>

          {/* ── Footer link ── */}
          {/* Raised from text-xs uppercase tracking-widest → 14px */}
          <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            <a
              href="/"
              style={{
                fontSize: '0.875rem',              /* raised from text-xs (12px) */
                color: T.textTertiary,
                fontWeight: 500,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                textDecoration: 'none',
                transition: 'color 0.18s ease',
              }}
              onMouseOver={e => { e.currentTarget.style.color = T.textPrimary; }}
              onMouseOut={e  => { e.currentTarget.style.color = T.textTertiary; }}
            >
              Powered by BAR Web
            </a>
          </div>
        </div>
      </div>
    </>
  );
};

export default SharePage;
