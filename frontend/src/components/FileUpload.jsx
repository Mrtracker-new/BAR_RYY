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
          className={`border-3 border-dashed rounded-2xl p-10 sm:p-16 text-center cursor-pointer transition-all duration-300 relative overflow-hidden group ${
            isDragging
              ? 'border-gold-500 bg-gradient-to-br from-gold-500/20 to-gold-600/10 scale-105 shadow-2xl shadow-gold-500/30'
              : 'border-dark-600 hover:border-gold-500/60 bg-gradient-to-br from-dark-700/50 to-dark-800/50 hover:shadow-xl'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-gold-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileInput}
          />
          <div className={`inline-block p-4 rounded-2xl mb-4 ${
            isDragging ? 'bg-gold-500/30 animate-bounce' : 'bg-gold-500/10 group-hover:bg-gold-500/20'
          } transition-all duration-300`}>
            <Upload className={`${isDragging ? 'text-gold-400' : 'text-gold-500'}`} size={48} />
          </div>
          <p className="text-lg sm:text-xl mb-2 text-gray-200 font-semibold relative z-10">
            {isDragging ? '📥 Drop your file here' : '📁 Drag & drop your file here'}
          </p>
          <p className="text-sm text-gray-400 mb-4 relative z-10">or click to browse from your device</p>
          <div className="inline-block px-4 py-2 bg-dark-700/50 rounded-lg border border-dark-600 relative z-10">
            <p className="text-xs text-gray-400">Supports: 🖼️ Images, 🎥 Videos, 📄 PDF, 📝 DOCX, 🗄️ ZIP & more</p>
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/5 border-2 border-green-500/40 rounded-2xl p-5 sm:p-6 shadow-xl shadow-green-500/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-3xl"></div>
          <div className="flex items-center justify-between gap-3 relative z-10">
            <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
              <div className="p-3 bg-gradient-to-br from-green-500/30 to-emerald-500/20 rounded-xl shadow-lg shadow-green-500/20 shrink-0">
                <File className="text-green-400" size={28} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  <p className="text-xs text-green-400 font-semibold">READY TO SEAL</p>
                </div>
                <p className="text-base sm:text-lg font-bold text-white truncate">{uploadedFile.name}</p>
                <p className="text-xs sm:text-sm text-gray-400">📂 {formatFileSize(uploadedFile.size)}</p>
              </div>
            </div>
            <button
              onClick={() => {
                onRemove();
                setPreviewUrl(null);
              }}
              className="p-2.5 hover:bg-red-500/20 bg-red-500/10 rounded-xl transition-all duration-300 hover:scale-110 border border-red-500/30 hover:border-red-500 shrink-0"
              title="Remove file"
            >
              <X className="text-red-400" size={20} />
            </button>
          </div>
          
          {/* File Preview */}
          {(filePreview || previewUrl) && (
            <div className="mt-4 border-t border-dark-600 pt-4">
              <p className="text-sm text-gray-400 mb-2">Preview:</p>
              {filePreview ? (
                <img 
                  src={filePreview} 
                  alt="File preview" 
                  className="w-full max-h-64 object-contain rounded-lg border border-dark-600"
                />
              ) : previewUrl?.type === 'image' ? (
                <img 
                  src={previewUrl.url} 
                  alt="File preview" 
                  className="w-full max-h-64 object-contain rounded-lg border border-dark-600"
                />
              ) : previewUrl?.type === 'video' ? (
                <video 
                  src={previewUrl.url} 
                  controls 
                  className="w-full max-h-64 rounded-lg border border-dark-600"
                >
                  Your browser does not support video preview.
                </video>
              ) : previewUrl?.type === 'pdf' ? (
                <iframe 
                  src={previewUrl.url} 
                  className="w-full h-96 rounded-lg border border-dark-600"
                  title="PDF preview"
                />
              ) : previewUrl?.type === 'audio' ? (
                <div className="p-4 bg-dark-700 rounded-lg border border-dark-600">
                  <audio 
                    src={previewUrl.url} 
                    controls 
                    className="w-full"
                  >
                    Your browser does not support audio preview.
                  </audio>
                </div>
              ) : previewUrl?.type === 'document' ? (
                <div className="p-6 text-center bg-dark-700 rounded-lg border border-dark-600">
                  <div className="text-6xl mb-3">
                    {previewUrl.name.endsWith('.pdf') ? '📄' :
                     previewUrl.name.match(/\.(doc|docx)$/i) ? '📝' :
                     previewUrl.name.match(/\.(ppt|pptx)$/i) ? '📊' :
                     previewUrl.name.match(/\.(xls|xlsx)$/i) ? '📈' : '📄'}
                  </div>
                  <p className="text-sm text-gray-400">Document preview not available</p>
                  <p className="text-xs text-gray-500 mt-1">File will be encrypted and can be viewed after decryption</p>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FileUpload;
