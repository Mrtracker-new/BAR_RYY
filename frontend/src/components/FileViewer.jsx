import React, { useState, useEffect } from 'react';
import { X, Eye, Download, AlertTriangle } from 'lucide-react';

const FileViewer = ({ fileData, fileName, fileType, onClose, allowDownload = true }) => {
  const [dataUrl, setDataUrl] = useState(null);

  useEffect(() => {
    if (fileData) {
      // Create blob URL for the file
      const blob = new Blob([fileData], { type: fileType || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      setDataUrl(url);

      return () => URL.revokeObjectURL(url);
    }
  }, [fileData, fileType]);

  const getFileCategory = () => {
    const ext = fileName.toLowerCase().split('.').pop();
    
    if (['txt', 'md', 'json', 'xml', 'csv', 'log'].includes(ext)) return 'text';
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext)) return 'image';
    if (['mp4', 'webm', 'ogg', 'mov'].includes(ext)) return 'video';
    if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) return 'audio';
    if (ext === 'pdf') return 'pdf';
    
    return 'other';
  };

  const renderContent = () => {
    const category = getFileCategory();
    
    switch (category) {
      case 'text':
        return (
          <div className="bg-dark-900 rounded-lg p-6 overflow-auto max-h-[600px]">
            <pre className="text-gray-300 whitespace-pre-wrap font-mono text-sm">
              {new TextDecoder().decode(fileData)}
            </pre>
          </div>
        );

      case 'image':
        return (
          <div className="flex justify-center items-center bg-dark-900 rounded-lg p-6">
            <img 
              src={dataUrl} 
              alt={fileName}
              className="max-w-full max-h-[600px] object-contain rounded"
            />
          </div>
        );

      case 'video':
        return (
          <div className="bg-dark-900 rounded-lg p-6">
            <video 
              src={dataUrl} 
              controls 
              className="w-full max-h-[600px] rounded"
            >
              Your browser does not support video playback.
            </video>
          </div>
        );

      case 'audio':
        return (
          <div className="bg-dark-900 rounded-lg p-6">
            <audio src={dataUrl} controls className="w-full">
              Your browser does not support audio playback.
            </audio>
            <div className="mt-4 text-center">
              <p className="text-gray-400">🎵 {fileName}</p>
            </div>
          </div>
        );

      case 'pdf':
        return (
          <div className="bg-dark-900 rounded-lg overflow-hidden">
            <iframe 
              src={dataUrl} 
              className="w-full h-[700px] border-0"
              title={fileName}
            />
          </div>
        );

      default:
        return (
          <div className="bg-dark-900 rounded-lg p-12 text-center">
            <AlertTriangle className="mx-auto mb-4 text-yellow-500" size={64} />
            <h3 className="text-xl font-semibold text-gray-300 mb-2">
              Preview Not Available
            </h3>
            <p className="text-gray-500 mb-6">
              This file type cannot be previewed in the browser.
            </p>
            {allowDownload && (
              <button
                onClick={handleDownload}
                className="px-6 py-3 bg-gold-500 hover:bg-gold-600 text-black font-semibold rounded-lg transition-all"
              >
                Download File Instead
              </button>
            )}
          </div>
        );
    }
  };

  const handleDownload = () => {
    if (!allowDownload) {
      alert('Downloads are disabled for this file. View-only mode is active.');
      return;
    }

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 border border-dark-700 rounded-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-700">
          <div className="flex items-center space-x-3">
            <Eye className="text-gold-500" size={24} />
            <div>
              <h2 className="text-xl font-bold text-gold-500">File Viewer</h2>
              <p className="text-sm text-gray-400 font-mono">{fileName}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {allowDownload && (
              <button
                onClick={handleDownload}
                className="px-4 py-2 bg-gold-500/20 hover:bg-gold-500/30 text-gold-500 rounded-lg transition-all flex items-center space-x-2"
              >
                <Download size={18} />
                <span>Download</span>
              </button>
            )}
            {!allowDownload && (
              <span className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg flex items-center space-x-2">
                <Eye size={18} />
                <span>View Only</span>
              </span>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-dark-600 rounded-lg transition-all"
            >
              <X className="text-gray-400 hover:text-white" size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {renderContent()}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-dark-700 bg-dark-900">
          <div className="flex items-center justify-between text-sm">
            <p className="text-gray-500">
              {allowDownload ? (
                '✅ Download allowed'
              ) : (
                '⚠️ View-only mode: Downloads disabled for security'
              )}
            </p>
            <p className="text-gray-600">
              Size: {(fileData.byteLength / 1024).toFixed(2)} KB
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileViewer;
