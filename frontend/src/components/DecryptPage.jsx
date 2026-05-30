import React, { useState, useRef } from 'react';
import axios from '../config/axios';
import { Lock, Unlock, AlertCircle, Upload } from 'lucide-react';
import FileViewer from './FileViewer';
import Toast from './Toast';
import BurningAnimation from './BurningAnimation';

/* ─────────────────────────────────────────────────────────────
   DESIGN TOKENS — consistent with index.css :root
───────────────────────────────────────────────────────────── */
const T = {
  gold:        '#E8A020',
  goldDim:     'rgba(232,160,32,0.08)',
  goldBorder:  'rgba(232,160,32,0.20)',

  /* Text */
  textPrimary:   '#f0f0f0',
  textSecondary: '#a0a0a0',
  textTertiary:  '#636363',
  textDim:       '#505050',

  /* Surfaces */
  surface0: '#0e0e0e',
  surface1: '#141414',
  surface2: '#1a1a1a',

  /* Status */
  red:       '#EF4444',
  redDim:    'rgba(239,68,68,0.08)',
  redBorder: 'rgba(239,68,68,0.18)',
  green:     '#22C55E',

  /* Borders */
  border:      'rgba(255,255,255,0.07)',
  borderHover: 'rgba(255,255,255,0.13)',

  /* Font */
  mono: "'JetBrains Mono', monospace",
};

/* ─────────────────────────────────────────────────────────────
   DECRYPT PAGE
   Changes:
   - Removed max-w-3xl outer constraint — let it breathe inside app-grid
   - Upload zone: p-8 → p-6 sm:p-8 via clamp (mobile breathing room)
   - Upload icon: size={32} kept, consistent
   - Metadata panel: p-6 → p-5 sm:p-6 via clamp
   - Error block: consistent token-based styling (replaces Tailwind zinc)
   - All text colors now use T.text* tokens for system consistency
───────────────────────────────────────────────────────────── */
const DecryptPage = ({ onBack }) => {
  const [barFile, setBarFile]           = useState(null);
  const [password, setPassword]         = useState('');
  const [metadata, setMetadata]         = useState(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [error, setError]               = useState(null);
  const [showViewer, setShowViewer]     = useState(false);
  const [decryptedData, setDecryptedData] = useState(null);
  const [previewUrl, setPreviewUrl]     = useState(null);
  const fileInputRef                    = useRef(null);
  const [toast, setToast]               = useState(null);
  const [showBurning, setShowBurning]   = useState(false);

  const showToast = (message, type = 'success') => setToast({ message, type });

  /* ── File selection & metadata read ── */
  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.bar')) { setError('Please select a .bar file'); return; }

    setBarFile(file); setError(null); setMetadata(null); setPreviewUrl(null);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const text         = event.target.result;
          const jsonStart    = text.indexOf('\n') + 1;
          const obfuscated   = text.substring(jsonStart);
          const decoded      = atob(obfuscated);
          const jsonData     = JSON.parse(decoded);
          setMetadata(jsonData.metadata);
          generateFileTypePreview(jsonData.metadata.filename);
        } catch (err) {
          console.error('Could not read metadata:', err);
        }
      };
      reader.readAsText(file);
    } catch (err) {
      console.error('Error reading file:', err);
    }
  };

  /* ── File type emoji preview ── */
  const generateFileTypePreview = (filename) => {
    const ext       = filename.split('.').pop()?.toLowerCase();
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
    const videoExts = ['mp4', 'avi', 'mov', 'mkv', 'webm'];
    const audioExts = ['mp3', 'wav', 'ogg', 'flac', 'm4a'];
    const docExts   = ['pdf', 'doc', 'docx', 'txt', 'md'];
    const zipExts   = ['zip', 'rar', '7z', 'tar', 'gz'];

    if (imageExts.includes(ext))      setPreviewUrl('🖼️');
    else if (videoExts.includes(ext)) setPreviewUrl('🎥');
    else if (audioExts.includes(ext)) setPreviewUrl('🎵');
    else if (docExts.includes(ext))   setPreviewUrl('📄');
    else if (zipExts.includes(ext))   setPreviewUrl('📦');
    else                              setPreviewUrl('📎');
  };

  /* ── Decrypt ── */
  const handleDecrypt = async () => {
    if (!barFile) { setError('Please select a .bar file'); return; }
    setIsDecrypting(true); setError(null);

    try {
      const formData = new FormData();
      formData.append('file', barFile);
      formData.append('password', password || '');

      const response = await axios.post('/decrypt-upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        responseType: 'arraybuffer',
      });

      const viewOnly      = response.headers['x-bar-view-only'] === 'true';
      const fileName      = response.headers['x-bar-filename'];
      const viewsRemaining = response.headers['x-bar-views-remaining'];
      const shouldDestroy = response.headers['x-bar-should-destroy'] === 'true';

      let metadataObj = metadata;
      const metadataJson = response.headers['x-bar-metadata'];
      if (metadataJson) {
        try { metadataObj = JSON.parse(metadataJson); } catch (e) {}
      }

      const decryptedBytes = new Uint8Array(response.data);

      if (viewOnly) {
        setDecryptedData(decryptedBytes);
        setMetadata(metadataObj);
        setShowViewer(true);
      } else {
        const blob = new Blob([decryptedBytes], { type: 'application/octet-stream' });
        const url  = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = fileName || 'decrypted_file';
        document.body.appendChild(link); link.click();
        document.body.removeChild(link); URL.revokeObjectURL(url);
        showToast('✅ File decrypted successfully!', 'success');
      }

    } catch (err) {
      console.error('Decryption error:', err);
      let errorMsg = 'Failed to decrypt';
      if (err.response) {
        let detail = null;
        try {
          const text = new TextDecoder().decode(err.response.data);
          const json = JSON.parse(text);
          detail = json?.detail || null;
        } catch {}

        if (err.response.status === 403) {
          errorMsg = '🚫 Access Denied: ' + (detail || 'Maximum views reached or file expired');
        } else if (err.response.status === 429) {
          errorMsg = '⏳ Rate Limited: ' + (detail || 'Too many attempts. Please wait before trying again.');
        } else if (err.response.status === 400) {
          errorMsg = '⚠️ Bad Request: ' + (detail || 'Invalid file or request');
        } else if (detail) {
          errorMsg = 'Failed to decrypt: ' + detail;
        } else {
          errorMsg = `Failed to decrypt (HTTP ${err.response.status})`;
        }
      } else {
        errorMsg = 'Failed to decrypt: ' + (err.message || 'Network error');
      }
      setError(errorMsg);
    } finally {
      setIsDecrypting(false);
    }
  };

  /* ── Decrypt button enabled state ── */
  const canDecrypt = barFile && !isDecrypting && (!metadata?.password_protected || password);

  return (
    <>
      {showBurning && (
        <BurningAnimation
          onComplete={() => {
            setShowBurning(false);
            showToast('⚠️ File destroyed! Do NOT use this .bar file again.', 'error');
          }}
        />
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {showViewer && decryptedData && metadata && (
        <FileViewer
          fileData={decryptedData}
          fileName={metadata.filename}
          fileType="application/octet-stream"
          onClose={() => { setShowViewer(false); setDecryptedData(null); }}
          allowDownload={!metadata.view_only}
        />
      )}

      {/*
        Removed max-w-3xl outer constraint — DecryptPage lives inside
        the app-grid sidebar column. Adding its own max-width fights
        the parent grid and causes misalignment.
      */}
      <div>
        {/* ── Back link ── */}
        <div style={{ marginBottom: '1.25rem' }}>
          <button
            onClick={onBack}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: '0.875rem',             /* 14px */
              color: T.textSecondary,
              display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
              transition: 'color 0.18s ease',
              padding: 0,
            }}
            onMouseOver={e => { e.currentTarget.style.color = T.textPrimary; }}
            onMouseOut={e  => { e.currentTarget.style.color = T.textSecondary; }}
          >
            ← Back to Create
          </button>
        </div>

        {/* ── Card ── */}
        <div
          style={{
            border: `1px solid rgba(255,255,255,0.06)`,
            borderRadius: '1rem',
            /* p-5 sm:p-8 → fluid: 20px on 320px → 32px on 800px+ */
            padding: 'clamp(1.25rem, 4vw, 2rem)',
            background: 'rgba(14,14,14,0.70)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
          }}
        >
          {/* ── Header ── */}
          <div style={{ textAlign: 'center', marginBottom: 'clamp(1.25rem, 4vw, 2rem)' }}>
            <div
              style={{
                display: 'inline-block',
                /* p-3 sm:p-4 → fluid */
                padding: 'clamp(0.75rem, 2vw, 1rem)',
                background: T.surface2, borderRadius: '0.75rem',
                border: `1px solid ${T.border}`,
                marginBottom: '0.875rem',
              }}
            >
              <Unlock size={32} style={{ color: T.gold }} />
            </div>

            <h2
              style={{
                fontSize: 'clamp(1.5rem, 4vw, 1.875rem)',
                fontWeight: 700, color: T.textPrimary,
                marginBottom: '0.5rem', letterSpacing: '-0.035em',
                lineHeight: 1.15,
              }}
            >
              Decrypt .BAR File
            </h2>
            <p style={{ fontSize: '0.875rem', color: T.textSecondary }}>
              Upload your encrypted file to retrieve the original content
            </p>
          </div>

          {/* ── Error block — token-based (replaces Tailwind zinc) ── */}
          {error && (
            <div
              style={{
                marginBottom: '1.25rem',
                display: 'flex', alignItems: 'flex-start', gap: '0.625rem',
                padding: '0.875rem 1rem',
                background: T.redDim, border: `1px solid ${T.redBorder}`,
                borderRadius: '0.75rem',
              }}
            >
              <AlertCircle size={18} style={{ color: T.red, flexShrink: 0, marginTop: '0.05rem' }} />
              <p style={{ fontSize: '0.875rem', color: '#fca5a5', lineHeight: 1.6, margin: 0 }}>
                {error}
              </p>
            </div>
          )}

          {/* ── File upload drop zone ── */}
          <div style={{ marginBottom: '1.25rem' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".bar"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: '100%',
                /* p-6 sm:p-8 → fluid: 24px on 320px → 32px on 800px+ */
                padding: 'clamp(1.5rem, 4vw, 2rem)',
                borderRadius: '0.875rem',
                border: `2px dashed ${barFile ? T.goldBorder : T.border}`,
                background: barFile ? T.goldDim : 'rgba(255,255,255,0.015)',
                cursor: 'pointer', textAlign: 'center',
                transition: 'border-color 0.2s ease, background 0.2s ease',
                fontFamily: 'inherit',
              }}
              onMouseOver={e => {
                if (!barFile) {
                  e.currentTarget.style.borderColor = T.goldBorder;
                  e.currentTarget.style.background  = T.goldDim;
                }
              }}
              onMouseOut={e => {
                if (!barFile) {
                  e.currentTarget.style.borderColor = T.border;
                  e.currentTarget.style.background  = 'rgba(255,255,255,0.015)';
                }
              }}
            >
              <Upload
                size={32}
                style={{
                  display: 'block', margin: '0 auto 0.75rem',
                  color: barFile ? T.gold : T.textTertiary,
                  transition: 'color 0.2s ease',
                }}
              />
              <p
                style={{
                  fontSize: '0.9375rem', fontWeight: 600,
                  color: T.textPrimary, marginBottom: '0.25rem',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  padding: '0 0.5rem',
                }}
              >
                {barFile ? barFile.name : 'Click to select .bar file'}
              </p>
              <p style={{ fontSize: '0.8125rem', color: T.textSecondary }}>
                {barFile ? 'Click to change file' : 'Only .bar files accepted'}
              </p>
            </button>
          </div>

          {/* ── Metadata panel ── */}
          {metadata && (
            <div
              style={{
                marginBottom: '1.25rem',
                background: 'rgba(255,255,255,0.025)',
                borderRadius: '0.875rem',
                /* p-5 sm:p-6 → fluid */
                padding: 'clamp(1rem, 3vw, 1.5rem)',
                border: `1px solid ${T.border}`,
              }}
            >
              {/* Panel heading */}
              <h3
                style={{
                  fontSize: '0.9375rem', fontWeight: 600,
                  color: T.textPrimary, marginBottom: '1rem',
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                }}
              >
                <span
                  style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: T.gold, flexShrink: 0,
                  }}
                />
                File Information
              </h3>

              {/* File type emoji */}
              {previewUrl && (
                <div style={{ textAlign: 'center', marginBottom: '0.875rem' }}>
                  <div style={{ fontSize: '2.5rem', lineHeight: 1 }}>{previewUrl}</div>
                </div>
              )}

              {/* Metadata rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {/* Filename */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: T.textTertiary }}>
                    Original Filename
                  </span>
                  <span
                    style={{
                      fontSize: '0.875rem', color: T.textPrimary,
                      fontFamily: T.mono, wordBreak: 'break-all',
                      background: 'rgba(0,0,0,0.2)',
                      padding: '0.2rem 0.5rem', borderRadius: '0.25rem',
                      display: 'inline-block',
                    }}
                  >
                    {metadata.filename}
                  </span>
                </div>

                {/* Created */}
                <MetaRow
                  label="Created"
                  value={new Date(metadata.created_at).toLocaleString('en-IN', {
                    timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short',
                  })}
                />

                {/* Expires */}
                {metadata.expires_at && (
                  <MetaRow
                    label="Expires"
                    value={new Date(metadata.expires_at).toLocaleString('en-IN', {
                      timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short',
                    })}
                  />
                )}

                {/* Storage mode */}
                <MetaRow
                  label="Storage Mode"
                  value={metadata.storage_mode === 'server' ? 'Server-Side' : 'Client-Side'}
                />

                {/* Server-only view counts */}
                {metadata.storage_mode === 'server' && (
                  <>
                    <MetaRow label="Max Views"     value={metadata.max_views || 'Unlimited'} />
                    <MetaRow label="Current Views" value={metadata.current_views || 0} />
                  </>
                )}

                {/* Password protection badge */}
                <div
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    paddingTop: '0.625rem', borderTop: `1px solid rgba(255,255,255,0.06)`,
                    marginTop: '0.25rem',
                  }}
                >
                  <span style={{ fontSize: '0.8125rem', color: T.textSecondary }}>
                    Password Protection
                  </span>
                  <span
                    style={{
                      fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.03em',
                      padding: '0.15rem 0.5rem', borderRadius: '0.25rem',
                      ...(metadata.password_protected
                        ? { background: T.goldDim, color: T.gold, border: `1px solid ${T.goldBorder}` }
                        : { background: 'rgba(34,197,94,0.08)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.18)' }
                      ),
                    }}
                  >
                    {metadata.password_protected ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── Password input ── */}
          {metadata?.password_protected && (
            <div style={{ marginBottom: '1.25rem' }}>
              <label
                style={{
                  display: 'block', fontSize: '0.875rem',
                  color: T.textSecondary, fontWeight: 500, marginBottom: '0.5rem',
                }}
              >
                Password Required
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && canDecrypt && handleDecrypt()}
                placeholder="Enter decryption password"
                className="input-field"
                style={{ width: '100%' }}
                aria-label="Decryption password"
              />
            </div>
          )}

          {/* ── Decrypt button ── */}
          <button
            onClick={handleDecrypt}
            disabled={!canDecrypt}
            className={canDecrypt ? 'btn-primary' : ''}
            style={{
              width: '100%',
              justifyContent: 'center',
              /* Minimum 48px touch target */
              minHeight: 48,
              ...(canDecrypt ? {} : {
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: '0.5rem', fontFamily: 'inherit',
                background: T.surface2, color: T.textTertiary,
                border: `1px solid ${T.border}`, borderRadius: '0.75rem',
                cursor: 'not-allowed', fontSize: '0.9375rem', fontWeight: 600,
              }),
            }}
          >
            {isDecrypting ? (
              <>
                <Lock size={16} style={{ animation: 'bar-spin 0.8s linear infinite' }} />
                Decrypting…
              </>
            ) : (
              <>
                <Unlock size={16} />
                Decrypt &amp; Download
              </>
            )}
          </button>

          {/* ── Notice / warning strips ── */}
          {barFile && !metadata && (
            <div
              style={{
                marginTop: '1rem', padding: '0.75rem 1rem',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: '0.625rem', textAlign: 'center',
              }}
            >
              <p style={{ fontSize: '0.875rem', color: T.textSecondary }}>
                Select a .bar file to view details
              </p>
            </div>
          )}

          {metadata?.storage_mode === 'server' ? (
            <div
              style={{
                marginTop: '1rem', padding: '0.75rem 1rem',
                background: T.goldDim, border: `1px solid ${T.goldBorder}`,
                borderRadius: '0.625rem', textAlign: 'center',
              }}
            >
              <p style={{ fontSize: '0.875rem', color: 'rgba(232,160,32,0.85)' }}>
                <strong>Note:</strong> Decrypting counts as a view and may trigger self-destruct.
              </p>
            </div>
          ) : metadata ? (
            <div
              style={{
                marginTop: '1rem', padding: '0.75rem 1rem',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: '0.625rem', textAlign: 'center',
              }}
            >
              <p style={{ fontSize: '0.875rem', color: T.textSecondary }}>
                Client-side files have no view limits.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
};

/* ── Helper: metadata key/value row ── */
function MetaRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
      <span
        style={{
          fontSize: '0.8125rem', color: '#636363',
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: '0.875rem',          /* raised: metadata values now at 14px */
          color: '#e0e0e0',
          textAlign: 'right',
          minWidth: 0,
        }}
      >
        {value}
      </span>
    </div>
  );
}

export default DecryptPage;
