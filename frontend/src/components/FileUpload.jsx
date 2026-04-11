import React, { useState, useRef } from 'react';
import { Upload, File, X, FileText, Image, Film, Music, Archive, Lock } from 'lucide-react';

/* ── File type → icon + accent color ── */
function getFileType(file) {
  if (!file) return { Icon: File, label: 'File', color: '#555' };
  const t = file.type;
  if (t.startsWith('image/'))  return { Icon: Image,    label: 'Image',    color: '#38BDF8' };
  if (t.startsWith('video/'))  return { Icon: Film,     label: 'Video',    color: '#A78BFA' };
  if (t.startsWith('audio/'))  return { Icon: Music,    label: 'Audio',    color: '#34D399' };
  if (t === 'application/pdf') return { Icon: FileText, label: 'PDF',      color: '#FB7185' };
  if (t.includes('zip') || t.includes('rar') || t.includes('archive'))
    return { Icon: Archive, label: 'Archive', color: '#FBBF24' };
  if (t.includes('document') || t.includes('word') || t.includes('text'))
    return { Icon: FileText, label: 'Document', color: '#60A5FA' };
  return { Icon: File, label: 'File', color: '#666' };
}

function fmtSize(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round((bytes / Math.pow(k, i)) * 10) / 10} ${sizes[i]}`;
}

const TYPE_PILLS = [
  { label: 'Images', color: '#38BDF8' },
  { label: 'PDF',    color: '#FB7185' },
  { label: 'Docs',   color: '#60A5FA' },
  { label: 'Archives', color: '#FBBF24' },
];

/* ── Component ── */
const FileUpload = ({ onFileSelect, uploadedFile, onRemove, filePreview }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [localPreview, setLocalPreview] = useState(null);
  const inputRef = useRef(null);

  const handleDragOver  = e => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = e => { e.preventDefault(); setIsDragging(false); };

  const processFile = (file) => {
    if (!file) return;
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = e => setLocalPreview(e.target.result);
      reader.readAsDataURL(file);
    } else {
      setLocalPreview(null);
    }
    onFileSelect(file);
  };

  const handleDrop = e => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleInput = e => {
    const file = e.target.files[0];
    if (file) processFile(file);
  };

  const { Icon, label, color } = getFileType(uploadedFile);

  /* ── Empty drop zone ── */
  if (!uploadedFile) {
    return (
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className="upload-zone"
        style={{
          padding: '3rem 1.5rem',
          textAlign: 'center',
          userSelect: 'none',
          borderColor: isDragging ? 'rgba(232,160,32,0.45)' : undefined,
          background: isDragging ? 'rgba(232,160,32,0.03)' : undefined,
        }}
      >
        <input ref={inputRef} type="file" style={{ display: 'none' }} onChange={handleInput} />

        {/* Upload icon — square */}
        <div
          style={{
            width: 44, height: 44, borderRadius: '0.625rem',
            border: `1px solid ${isDragging ? 'rgba(232,160,32,0.35)' : 'rgba(255,255,255,0.07)'}`,
            background: isDragging ? 'rgba(232,160,32,0.08)' : 'rgba(255,255,255,0.03)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem',
            transition: 'all 0.2s ease',
          }}
        >
          <Upload
            size={16}
            style={{
              color: isDragging ? '#E8A020' : '#3a3a3a',
              transition: 'color 0.2s ease',
            }}
          />
        </div>

        <p
          style={{
            fontSize: '0.9375rem', fontWeight: 600, letterSpacing: '-0.02em',
            color: isDragging ? '#E8A020' : '#999',
            marginBottom: '0.3rem', transition: 'color 0.2s ease',
          }}
        >
          {isDragging ? 'Release to encrypt' : 'Drop file or click to browse'}
        </p>
        <p
          style={{
            fontSize: '0.8125rem', color: '#313131',
            marginBottom: '1.5rem', letterSpacing: '-0.01em',
          }}
        >
          Any file type supported
        </p>

        {/* Type pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', justifyContent: 'center' }}>
          {TYPE_PILLS.map(({ label: t, color: c }) => (
            <span
              key={t}
              style={{
                padding: '0.1875rem 0.5625rem', borderRadius: '999px',
                background: `${c}09`, border: `1px solid ${c}16`,
                fontSize: '0.625rem', fontWeight: 600,
                letterSpacing: '0.07em', textTransform: 'uppercase',
                color: `${c}88`,
              }}
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    );
  }

  /* ── File selected ── */
  return (
    <div
      style={{
        borderRadius: '0.625rem',
        border: '1px solid rgba(232,160,32,0.18)',
        background: 'rgba(232,160,32,0.03)',
        overflow: 'hidden',
      }}
    >
      {/* File row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 1rem' }}>
        {/* File type icon */}
        <div
          style={{
            width: 36, height: 36, minWidth: 36, borderRadius: '0.4375rem',
            background: `${color}10`, border: `1px solid ${color}20`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Icon size={15} style={{ color }} />
        </div>

        {/* Name + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: '0.875rem', fontWeight: 600, color: '#ddd',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              letterSpacing: '-0.015em', marginBottom: '0.125rem',
            }}
          >
            {uploadedFile.name}
          </p>
          <p style={{ fontSize: '0.6875rem', color: '#3a3a3a', fontFamily: "'JetBrains Mono', monospace" }}>
            {label} · {fmtSize(uploadedFile.size)}
          </p>
        </div>

        {/* Remove */}
        <button
          onClick={() => { onRemove(); setLocalPreview(null); }}
          title="Remove file"
          className="btn-icon"
          style={{ width: 28, height: 28 }}
          onMouseOver={e => {
            e.currentTarget.style.background = 'rgba(239,68,68,0.08)';
            e.currentTarget.style.borderColor = 'rgba(239,68,68,0.2)';
            e.currentTarget.style.color = '#f87171';
          }}
          onMouseOut={e => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.borderColor = 'transparent';
            e.currentTarget.style.color = 'var(--text-tertiary)';
          }}
        >
          <X size={12} />
        </button>
      </div>

      {/* Status bar */}
      <div
        style={{
          padding: '0.4375rem 1rem',
          borderTop: '1px solid rgba(232,160,32,0.10)',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          background: 'rgba(232,160,32,0.03)',
        }}
      >
        <Lock size={10} style={{ color: '#E8A020', flexShrink: 0 }} />
        <span style={{ fontSize: '0.6875rem', color: '#3a3a3a', fontWeight: 500, letterSpacing: '-0.01em' }}>
          Ready to seal — configure rules and encrypt
        </span>
      </div>

      {/* Image preview */}
      {(filePreview || localPreview) && (
        <div style={{ borderTop: '1px solid rgba(232,160,32,0.08)' }}>
          <img
            src={filePreview || localPreview}
            alt="Preview"
            style={{
              width: '100%', maxHeight: 180,
              objectFit: 'contain',
              background: '#090909', display: 'block',
            }}
          />
        </div>
      )}
    </div>
  );
};

export default FileUpload;
