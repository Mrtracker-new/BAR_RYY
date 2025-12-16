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
          className={`border-2 border-dashed rounded-xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-300 relative overflow-hidden group ${isDragging
            ? 'border-amber-500 bg-amber-500/5'
            : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/30 hover:bg-zinc-900/50'
            }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileInput}
          />

          <div className={`inline-flex p-4 rounded-xl mb-4 transition-all duration-300 ${isDragging ? 'bg-amber-500/20 text-amber-500' : 'bg-zinc-800 text-zinc-400 group-hover:bg-zinc-700'
            }`}>
            <Upload size={32} />
          </div>

          <h3 className="text-lg mb-2 text-white font-semibold">
            {isDragging ? 'Drop to Encrypt' : 'Click to Upload'}
          </h3>

          <p className="text-sm text-zinc-500 mb-6 max-w-sm mx-auto">
            Drag & drop your file here or browse.
          </p>

          <div className="inline-flex gap-2 justify-center flex-wrap">
            {['Images', 'PDF', 'Docs', 'Archives'].map((type) => (
              <span key={type} className="px-2.5 py-1 rounded-md bg-zinc-800 border border-zinc-700 text-[10px] text-zinc-400 uppercase tracking-wider font-medium">
                {type}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-zinc-900/80 border border-white/10 rounded-xl p-6 relative overflow-hidden">

          <div className="flex items-center justify-between gap-4 relative z-10">
            <div className="flex items-center space-x-4 min-w-0 flex-1">
              <div className="p-3 bg-zinc-800 rounded-lg border border-white/5 shrink-0">
                <File className="text-amber-500" size={24} />
              </div>
              <div className="min-w-0 flex-1 space-y-0.5">
                <h4 className="font-medium text-white truncate">{uploadedFile.name}</h4>
                <p className="text-xs text-zinc-500 font-mono">{formatFileSize(uploadedFile.size)}</p>
              </div>
            </div>

            <button
              onClick={() => {
                onRemove();
                setPreviewUrl(null);
              }}
              className="p-2 hover:bg-red-500/10 text-zinc-500 hover:text-red-500 rounded-lg transition-colors"
              title="Remove file"
            >
              <X size={20} />
            </button>
          </div>

          {/* Minimal Preview Section */}
          {(filePreview || previewUrl) && (
            <div className="mt-4 border-t border-white/5 pt-4">
              <div className="rounded-lg overflow-hidden border border-white/5 bg-black/20">
                {filePreview ? (
                  <img src={filePreview} alt="Preview" className="w-full max-h-64 object-contain" />
                ) : previewUrl?.type === 'image' ? (
                  <img src={previewUrl.url} alt="Preview" className="w-full max-h-64 object-contain" />
                ) : (
                  <div className="p-6 text-center">
                    <p className="text-zinc-500 text-sm">Preview available for this file type</p>
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
