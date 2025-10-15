import React, { useState, useRef } from 'react';
import { Upload, File, X } from 'lucide-react';

const FileUpload = ({ onFileSelect, uploadedFile, onRemove }) => {
  const [isDragging, setIsDragging] = useState(false);
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
      onFileSelect(files[0]);
    }
  };

  const handleFileInput = (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      onFileSelect(files[0]);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
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
          className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all duration-300 ${
            isDragging
              ? 'border-gold-500 bg-gold-500/10 scale-105'
              : 'border-dark-600 hover:border-gold-500/50 hover:bg-dark-800'
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
          <Upload className={`mx-auto mb-4 ${isDragging ? 'text-gold-500 animate-bounce' : 'text-gray-400'}`} size={48} />
          <p className="text-lg mb-2 text-gray-300">
            {isDragging ? 'Drop your file here' : 'Drag & drop your file here'}
          </p>
          <p className="text-sm text-gray-500">or click to browse</p>
          <p className="text-xs text-gray-600 mt-4">Supports: PDF, TXT, DOCX, ZIP, and more</p>
        </div>
      ) : (
        <div className="border border-gold-500/30 rounded-lg p-6 bg-dark-800 terminal-glow">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-gold-500/20 rounded-lg">
                <File className="text-gold-500" size={32} />
              </div>
              <div>
                <p className="text-lg font-semibold text-gold-500">{uploadedFile.name}</p>
                <p className="text-sm text-gray-400">{formatFileSize(uploadedFile.size)}</p>
              </div>
            </div>
            <button
              onClick={onRemove}
              className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
            >
              <X className="text-red-400" size={24} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
