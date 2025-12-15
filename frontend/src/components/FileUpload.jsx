import React, { useState, useRef } from 'react';
import { Upload, File, X } from 'lucide-react';

const FileUpload = ({ onFileSelect, uploadedFile, onRemove, filePreview }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      generatePreview(files[0]);
      onFileSelect(files[0]);
    }
  };

  const handleFileInput = (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      generatePreview(files[0]);
      onFileSelect(files[0]);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const generatePreview = (file) => {
    if (!file) return;

    const fileType = file.type;
    // Generate preview for images, videos, PDFs, and audio
    if (fileType.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreviewUrl({ type: 'image', url: e.target.result });
      reader.readAsDataURL(file);
    } else if (fileType.startsWith('video/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreviewUrl({ type: 'video', url: e.target.result });
      reader.readAsDataURL(file);
    } else if (fileType === 'application/pdf') {
      const reader = new FileReader();
      reader.onload = (e) => setPreviewUrl({ type: 'pdf', url: e.target.result });
      reader.readAsDataURL(file);
    } else if (fileType.startsWith('audio/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreviewUrl({ type: 'audio', url: e.target.result });
      reader.readAsDataURL(file);
    } else if (fileType.includes('document') || fileType.includes('word') ||
      fileType.includes('presentation') || fileType.includes('powerpoint') ||
      fileType.includes('spreadsheet') || fileType.includes('excel')) {
      // For Office documents, show file type icon
      setPreviewUrl({ type: 'document', name: file.name });
    } else {
      setPreviewUrl(null);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (

    <div className="w-full">
      {!uploadedFile ? (
        <div
          className={`border-2 border-dashed rounded-2xl p-10 sm:p-16 text-center cursor-pointer transition-all duration-500 relative overflow-hidden group ${isDragging
            ? 'border-gold-500 bg-gold-500/10 shadow-[0_0_50px_-10px_rgba(245,158,11,0.2)]'
            : 'border-white/10 hover:border-gold-500/50 bg-white/5 hover:bg-white/10'
            }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
        >
          {/* Scanning Effect */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-gold-500/5 to-transparent translate-y-[-100%] group-hover:translate-y-[100%] transition-transform duration-[2s] ease-in-out"></div>

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileInput}
          />

          <div className={`inline-flex p-5 rounded-2xl mb-6 transition-all duration-300 ${isDragging ? 'bg-gold-500/20 scale-110' : 'bg-dark-800 border border-white/5 shadow-2xl'
            }`}>
            <Upload className={`${isDragging ? 'text-gold-400' : 'text-gray-400 group-hover:text-gold-500'}`} size={40} />
          </div>

          <h3 className="text-xl sm:text-2xl mb-3 text-white font-bold tracking-tight">
            {isDragging ? 'Drop to Encrypt' : 'Upload File'}
          </h3>

          <p className="text-sm text-gray-400 mb-6 max-w-sm mx-auto leading-relaxed">
            Drag & drop your file here or click to browse.
            <br className="hidden sm:block" />
            <span className="text-gray-500 text-xs">Max size: 100MB • AES-256 Encrypted</span>
          </p>

          <div className="inline-flex gap-3 justify-center">
            {['Images', 'PDF', 'Docs', 'Archives'].map((type) => (
              <span key={type} className="px-3 py-1 rounded-full bg-white/5 border border-white/5 text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
                {type}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-dark-800/80 backdrop-blur-md border border-gold-500/20 rounded-2xl p-6 shadow-2xl relative overflow-hidden group">
          {/* Glow Effect */}
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-gold-500/10 rounded-full blur-[80px] pointer-events-none"></div>

          <div className="flex items-center justify-between gap-4 relative z-10">
            <div className="flex items-center space-x-5 min-w-0 flex-1">
              <div className="p-4 bg-gradient-to-br from-dark-700 to-dark-800 rounded-xl border border-white/10 shadow-lg shrink-0">
                <File className="text-gold-500" size={32} />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  <span className="text-xs text-green-400 font-mono tracking-wider uppercase">Ready to Seal</span>
                </div>
                <h4 className="text-lg font-bold text-white truncate">{uploadedFile.name}</h4>
                <p className="text-xs text-gray-500 font-mono">{formatFileSize(uploadedFile.size)}</p>
              </div>
            </div>

            <button
              onClick={() => {
                onRemove();
                setPreviewUrl(null);
              }}
              className="p-3 hover:bg-red-500/10 text-gray-500 hover:text-red-400 rounded-xl transition-all duration-300 border border-transparent hover:border-red-500/20"
              title="Remove file"
            >
              <X size={20} />
            </button>
          </div>

          {/* Minimal Preview Section */}
          {(filePreview || previewUrl) && (
            <div className="mt-6 border-t border-white/5 pt-6 animate-fade-in-up">
              <div className="rounded-xl overflow-hidden border border-white/5 bg-dark-900/50">
                {/* (Preview rendering logic remains same, just wrapper styled) */}
                {filePreview ? (
                  <img src={filePreview} alt="Preview" className="w-full max-h-64 object-contain" />
                ) : previewUrl?.type === 'image' ? (
                  <img src={previewUrl.url} alt="Preview" className="w-full max-h-64 object-contain" />
                ) : (
                  // Simple Fallback for non-images in this view
                  <div className="p-8 text-center">
                    <p className="text-gray-500 italic">Preview available for this file type</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>

  );
};

export default FileUpload;
