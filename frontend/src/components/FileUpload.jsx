import React, { useState, useRef } from 'react';
import { Upload, File, X, FileText, Image, Film, Music, Archive } from 'lucide-react';

/* ─────────────────────────────────────────────
   File type → icon + label
───────────────────────────────────────────── */
function getFileIcon(file) {
  if (!file) return { Icon: File, label: 'File', color: '#888888' };
  const t = file.type;
  if (t.startsWith('image/'))       return { Icon: Image,    label: 'Image',    color: '#38BDF8' };
  if (t.startsWith('video/'))       return { Icon: Film,     label: 'Video',    color: '#A78BFA' };
  if (t.startsWith('audio/'))       return { Icon: Music,    label: 'Audio',    color: '#34D399' };
  if (t === 'application/pdf')      return { Icon: FileText, label: 'PDF',      color: '#FB7185' };
  if (t.includes('zip') || t.includes('rar') || t.includes('archive'))
    return { Icon: Archive, label: 'Archive', color: '#FBBF24' };
  if (t.includes('document') || t.includes('word') || t.includes('text'))
    return { Icon: FileText, label: 'Document', color: '#60A5FA' };
  return { Icon: File, label: 'File', color: '#888888' };
}

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round((bytes / Math.pow(k, i)) * 10) / 10} ${sizes[i]}`;
}

/* ─────────────────────────────────────────────
   FileUpload component
───────────────────────────────────────────── */
const FileUpload = ({ onFileSelect, uploadedFile, onRemove, filePreview }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) { generatePreview(files[0]); onFileSelect(files[0]); }
  };

  const handleFileInput = (e) => {
    const files = e.target.files;
    if (files.length > 0) { generatePreview(files[0]); onFileSelect(files[0]); }
  };

  const generatePreview = (file) => {
    if (!file) return;
    const t = file.type;
    if (t.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreviewUrl({ type: 'image', url: e.target.result });
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null);
    }
  };

  const { Icon, label, color } = getFileIcon(uploadedFile);

  /* ── Drop zone (no file yet) ── */
  if (!uploadedFile) {
    return (
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`upload-zone${isDragging ? ' dragging' : ''}`}
        style={{
          padding: '2.5rem 1.5rem',
          textAlign: 'center',
          userSelect: 'none',
          transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={handleFileInput}
        />

        {/* Icon ring */}
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            border: `1px solid ${isDragging ? 'rgba(232,160,32,0.4)' : 'rgba(255,255,255,0.08)'}`,
            background: isDragging ? 'rgba(232,160,32,0.08)' : 'rgba(255,255,255,0.03)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem',
            transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <Upload
            size={22}
            style={{
              color: isDragging ? '#E8A020' : '#444444',
              transition: 'color 0.25s ease',
            }}
          />
        </div>

        <p
          style={{
            fontSize: '0.9375rem',
            fontWeight: 600,
            letterSpacing: '-0.01em',
            color: isDragging ? '#E8A020' : '#cccccc',
            marginBottom: '0.375rem',
            transition: 'color 0.25s ease',
          }}
        >
          {isDragging ? 'Drop to encrypt' : 'Drop file or click to browse'}
        </p>
        <p style={{ fontSize: '0.8125rem', color: '#444444', marginBottom: '1.5rem' }}>
          Images, PDFs, documents, archives — any file type
        </p>

        {/* Type tags */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', justifyContent: 'center' }}>
          {['Images', 'PDF', 'Docs', 'Archives', 'Video', 'Audio'].map((t) => (
            <span
              key={t}
              style={{
                padding: '0.1875rem 0.625rem',
                borderRadius: '999px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
                fontSize: '0.6875rem',
                fontWeight: 500,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: '#555555',
              }}
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    );
  }

  /* ── File selected state ── */
  return (
    <div
      style={{
        borderRadius: '0.875rem',
        border: '1px solid rgba(232,160,32,0.18)',
        background: 'rgba(232,160,32,0.04)',
        overflow: 'hidden',
      }}
    >
      {/* File info row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.875rem',
          padding: '1rem 1.125rem',
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: 40,
            height: 40,
            minWidth: 40,
            borderRadius: '0.5rem',
            background: `${color}14`,
            border: `1px solid ${color}25`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={18} style={{ color }} />
        </div>

        {/* File details */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#e0e0e0',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              letterSpacing: '-0.01em',
            }}
          >
            {uploadedFile.name}
          </p>
          <p
            style={{
              fontSize: '0.75rem',
              color: '#555555',
              marginTop: '0.125rem',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {label} · {formatFileSize(uploadedFile.size)}
          </p>
        </div>

        {/* Remove */}
        <button
          onClick={() => { onRemove(); setPreviewUrl(null); }}
          style={{
            width: 30,
            height: 30,
            minWidth: 30,
            borderRadius: '0.375rem',
            background: 'transparent',
            border: '1px solid transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#555555',
            transition: 'background 0.2s ease, color 0.2s ease, border-color 0.2s ease',
          }}
          className="hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20"
          title="Remove file"
        >
          <X size={15} />
        </button>
      </div>

      {/* Status bar */}
      <div
        style={{
          padding: '0.5rem 1.125rem',
          borderTop: '1px solid rgba(232,160,32,0.10)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#22C55E',
            boxShadow: '0 0 6px #22C55E',
            animation: 'pulse 2s infinite',
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: '0.75rem', color: '#666666', fontWeight: 500 }}>
          Uploaded — ready to configure and seal
        </span>
      </div>

      {/* Image preview */}
      {(filePreview || previewUrl?.type === 'image') && (
        <div style={{ borderTop: '1px solid rgba(232,160,32,0.10)' }}>
          <img
            src={filePreview || previewUrl.url}
            alt="Preview"
            style={{
              width: '100%',
              maxHeight: 200,
              objectFit: 'contain',
              background: '#0a0a0a',
              display: 'block',
            }}
          />
        </div>
      )}
    </div>
  );
};

export default FileUpload;
