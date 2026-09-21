import React, { useState, useRef } from 'react';
import { Upload, File, X, FileText, Image, Film, Music, Archive, Lock, AlertCircle } from 'lucide-react';
import { validateFile } from '../utils/fileValidation';

/* ── File type → icon + accent color ── */
function getFileType(file) {
  if (!file) return { Icon: File, label: 'File', color: '#857358' };
  const t = file.type || '';
  const name = (file.name || '').trim();
  const ext = name.slice(name.lastIndexOf('.')).toLowerCase();

  if (t.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'].includes(ext))
    return { Icon: Image,    label: 'Image',    color: '#38BDF8' };
  if (t.startsWith('video/') || ['.mp4', '.avi', '.mov', '.mkv'].includes(ext))
    return { Icon: Film,     label: 'Video',    color: '#A78BFA' };
  if (t.startsWith('audio/') || ['.mp3', '.wav'].includes(ext))
    return { Icon: Music,    label: 'Audio',    color: '#34D399' };
  if (t === 'application/pdf' || ext === '.pdf')
    return { Icon: FileText, label: 'PDF',      color: '#FB7185' };
  if (t.includes('zip') || t.includes('rar') || t.includes('archive') || ['.zip', '.rar', '.7z', '.tar', '.gz'].includes(ext))
    return { Icon: Archive, label: 'Archive', color: '#FBBF24' };
  if (t.includes('presentation') || t.includes('powerpoint') || ['.ppt', '.pptx', '.key'].includes(ext))
    return { Icon: FileText, label: 'Presentation', color: '#F97316' };
  if (t.includes('spreadsheet') || t.includes('excel') || ['.xlsx', '.xls', '.csv'].includes(ext))
    return { Icon: FileText, label: 'Spreadsheet', color: '#10B981' };
  if (t.includes('document') || t.includes('word') || ['.doc', '.docx', '.rtf', '.odt'].includes(ext))
    return { Icon: FileText, label: 'Document', color: '#2C4A6E' };
  if (t === 'application/json' || t === 'application/xml' || t === 'text/xml' || ['.json', '.xml'].includes(ext))
    return { Icon: FileText, label: 'Data', color: '#6366F1' };
  if (t.startsWith('text/') || ['.txt', '.md'].includes(ext))
    return { Icon: FileText, label: 'Document', color: '#2C4A6E' };
  return { Icon: File, label: 'File', color: '#666' };
}

function fmtSize(bytes) {
  if (!bytes || bytes <= 0 || isNaN(bytes)) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${Math.round((bytes / Math.pow(k, i)) * 10) / 10} ${sizes[i]}`;
}

const TYPE_PILLS = [
  { label: 'Images', color: '#38BDF8' },
  { label: 'PDF',    color: '#FB7185' },
  { label: 'Docs',   color: '#2C4A6E' },
  { label: 'Archives', color: '#FBBF24' },
];

/* ── Component ── */
const FileUpload = ({ onFileSelect, uploadedFile, onRemove, filePreview, onError }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [localPreview, setLocalPreview] = useState(null);
  const [validationError, setValidationError] = useState(null);
  const inputRef = useRef(null);

  const handleDragOver  = e => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = e => { e.preventDefault(); setIsDragging(false); };

  const processFile = async (file) => {
    if (!file) return;
    setValidationError(null);

    // Validate file extension, MIME type, and initial magic bytes (4–8 bytes) before encryption
    const validation = await validateFile(file);
    if (!validation.isValid) {
      setValidationError(validation.error);
      onError?.(validation.error);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    const isImage = (file.type && file.type.startsWith('image/')) ||
                    /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(file.name || '');
    if (isImage) {
      const reader = new FileReader();
      reader.onload = e => setLocalPreview(e.target.result);
      reader.onerror = () => setLocalPreview(null);
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
    // Reset input value so re-selecting the same file fires onChange
    if (e.target) e.target.value = '';
  };

  const { Icon, label, color } = getFileType(uploadedFile);

  /* ── Empty drop zone ── */
  if (!uploadedFile) {
    return (
      <div
        key="drop-zone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`upload-zone ${isDragging ? 'dragging' : ''}`}
        style={{
          padding: '2.5rem 1.5rem',
          textAlign: 'center',
          userSelect: 'none',
          borderColor: isDragging ? 'rgba(180,121,30,0.45)' : undefined,
          background: isDragging ? 'rgba(180,121,30,0.03)' : undefined,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          width: '100%',
          boxSizing: 'border-box',
          minHeight: '280px',
          transition: 'all 0.2s ease',
        }}
      >
        <input ref={inputRef} type="file" style={{ display: 'none' }} onChange={handleInput} />

        {/* Upload icon — square */}
        <div
          style={{
            width: 44, height: 44, borderRadius: '0.625rem',
            border: `1px solid ${isDragging ? 'rgba(180,121,30,0.35)' : 'rgba(60,45,20,0.16)'}`,
            background: isDragging ? 'rgba(180,121,30,0.08)' : 'rgba(60,45,20,0.04)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem',
            transition: 'all 0.2s ease',
          }}
        >
          <Upload
            size={16}
            style={{
              color: isDragging ? '#B4791E' : '#857358',
              transition: 'color 0.2s ease',
            }}
          />
        </div>

        <p
          style={{
            fontSize: '0.9375rem', fontWeight: 600, letterSpacing: '-0.02em',
            color: isDragging ? '#B4791E' : '#857358',
            marginBottom: '0.3rem', transition: 'color 0.2s ease',
          }}
        >
          {isDragging ? 'Release to encrypt' : 'Drop file or click to browse'}
        </p>
        <p
          style={{
            fontSize: '0.8125rem', color: '#A2916F',
            marginBottom: validationError ? '1rem' : '1.5rem', letterSpacing: '-0.01em',
          }}
        >
          Any file type supported
        </p>

        {/* Validation error alert */}
        {validationError && (
          <div
            role="alert"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem',
              background: 'rgba(179, 58, 46, 0.08)',
              border: '1px solid rgba(179, 58, 46, 0.25)',
              color: '#b33a2e',
              fontSize: '0.75rem',
              fontWeight: 500,
              maxWidth: '90%',
              marginBottom: '1rem',
              textAlign: 'left',
            }}
          >
            <AlertCircle size={14} style={{ flexShrink: 0 }} />
            <span>{validationError}</span>
          </div>
        )}

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
      key="file-selected"
      style={{
        borderRadius: '0.625rem',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'rgba(180,121,30,0.18)',
        background: 'rgba(180,121,30,0.03)',
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
              fontSize: '0.875rem', fontWeight: 600, color: '#2A2018',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              letterSpacing: '-0.015em', marginBottom: '0.125rem',
            }}
          >
            {uploadedFile.name}
          </p>
          <p style={{ fontSize: '0.6875rem', color: '#857358', fontFamily: "'JetBrains Mono', monospace" }}>
            {label} · {fmtSize(uploadedFile.size)}
          </p>
        </div>

        {/* Remove */}
        <button
          onClick={() => { onRemove(); setLocalPreview(null); setValidationError(null); if (inputRef.current) inputRef.current.value = ''; }}
          title="Remove file"
          className="btn-icon"
          style={{ width: 28, height: 28 }}
          onMouseOver={e => {
            e.currentTarget.style.background = 'rgba(179,58,46,0.08)';
            e.currentTarget.style.borderColor = 'rgba(179,58,46,0.2)';
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
          borderTop: '1px solid rgba(180,121,30,0.10)',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          background: 'rgba(180,121,30,0.03)',
        }}
      >
        <Lock size={10} style={{ color: '#B4791E', flexShrink: 0 }} />
        <span style={{ fontSize: '0.6875rem', color: '#857358', fontWeight: 500, letterSpacing: '-0.01em' }}>
          Ready to seal — configure rules and encrypt
        </span>
      </div>

      {/* Image preview */}
      {(filePreview || localPreview) && (
        <div style={{ borderTop: '1px solid rgba(180,121,30,0.08)' }}>
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
