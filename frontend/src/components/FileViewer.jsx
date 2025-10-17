import React, { useState, useEffect } from 'react';
import { X, Eye, Download, AlertTriangle } from 'lucide-react';

const FileViewer = ({ fileData, fileName, fileType, onClose, allowDownload = true }) => {
  const [dataUrl, setDataUrl] = useState(null);

  // Function to get the correct MIME type from filename
  const getMimeType = () => {
    const ext = fileName.toLowerCase().split('.').pop();
    
    const mimeTypes = {
      // Images
      'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'gif': 'image/gif',
      'bmp': 'image/bmp', 'webp': 'image/webp', 'svg': 'image/svg+xml', 'ico': 'image/x-icon',
      
      // Videos
      'mp4': 'video/mp4', 'webm': 'video/webm', 'ogg': 'video/ogg', 'mov': 'video/quicktime',
      'avi': 'video/x-msvideo', 'mkv': 'video/x-matroska',
      
      // Audio
      'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'm4a': 'audio/mp4', 'flac': 'audio/flac',
      'aac': 'audio/aac',
      
      // Documents
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      
      // Text
      'txt': 'text/plain', 'html': 'text/html', 'htm': 'text/html', 'css': 'text/css',
      'js': 'text/javascript', 'json': 'application/json', 'xml': 'application/xml',
      'csv': 'text/csv', 'md': 'text/markdown'
    };
    
    return mimeTypes[ext] || fileType || 'application/octet-stream';
  };

  useEffect(() => {
    if (fileData) {
      // Create blob URL with the correct MIME type
      const correctMimeType = getMimeType();
      const blob = new Blob([fileData], { type: correctMimeType });
      const url = URL.createObjectURL(blob);
      setDataUrl(url);

      return () => URL.revokeObjectURL(url);
    }
  }, [fileData, fileName]);

  const getFileCategory = () => {
    const ext = fileName.toLowerCase().split('.').pop();
    
    // Text-based files (plain text, markdown, logs, config)
    if (['txt', 'md', 'log', 'ini', 'cfg', 'conf', 'yaml', 'yml', 'toml'].includes(ext)) return 'text';
    
    // Code files (programming languages)
    if (['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'cs', 'php', 'rb', 'go', 'rs', 'swift', 'kt', 'dart', 'sh', 'bash', 'ps1'].includes(ext)) return 'code';
    
    // Data files (JSON, XML, CSV, SQL)
    if (['json', 'xml', 'csv', 'sql', 'graphql'].includes(ext)) return 'data';
    
    // Web files (HTML, CSS)
    if (['html', 'htm', 'css', 'scss', 'sass', 'less'].includes(ext)) return 'web';
    
    // Images
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico'].includes(ext)) return 'image';
    
    // Videos
    if (['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'].includes(ext)) return 'video';
    
    // Audio
    if (['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(ext)) return 'audio';
    
    // PDF
    if (ext === 'pdf') return 'pdf';
    
    // Office documents (use Google Docs Viewer)
    if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp'].includes(ext)) return 'office';
    
    return 'other';
  };

  const renderContent = () => {
    const category = getFileCategory();
    const ext = fileName.toLowerCase().split('.').pop();
    
    switch (category) {
      case 'text':
        return (
          <div className="bg-dark-900 rounded-lg p-6 overflow-auto max-h-[600px]">
            <pre className="text-gray-300 whitespace-pre-wrap font-mono text-sm">
              {new TextDecoder().decode(fileData)}
            </pre>
          </div>
        );
      
      case 'code':
        return (
          <div className="bg-dark-900 rounded-lg p-6 overflow-auto max-h-[600px]">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-dark-700">
              <span className="text-gold-500 text-sm font-mono">.{ext}</span>
              <span className="text-gray-500 text-xs">Code File</span>
            </div>
            <pre className="text-gray-300 whitespace-pre-wrap font-mono text-sm">
              {new TextDecoder().decode(fileData)}
            </pre>
          </div>
        );
      
      case 'data':
        return (
          <div className="bg-dark-900 rounded-lg p-6 overflow-auto max-h-[600px]">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-dark-700">
              <span className="text-gold-500 text-sm font-mono">.{ext}</span>
              <span className="text-gray-500 text-xs">Data File</span>
            </div>
            <pre className="text-gray-300 whitespace-pre-wrap font-mono text-sm">
              {new TextDecoder().decode(fileData)}
            </pre>
          </div>
        );
      
      case 'web':
        return (
          <div className="bg-dark-900 rounded-lg overflow-hidden">
            <div className="bg-dark-800 p-3 border-b border-dark-700">
              <span className="text-gold-500 text-sm font-mono">{fileName}</span>
            </div>
            {ext === 'html' || ext === 'htm' ? (
              <iframe 
                srcDoc={new TextDecoder().decode(fileData)}
                className="w-full h-[600px] bg-white"
                title={fileName}
                sandbox="allow-same-origin"
              />
            ) : (
              <div className="p-6 overflow-auto max-h-[600px]">
                <pre className="text-gray-300 whitespace-pre-wrap font-mono text-sm">
                  {new TextDecoder().decode(fileData)}
                </pre>
              </div>
            )}
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
      
      case 'office':
        return (
          <div className="bg-dark-900 rounded-lg p-12 text-center">
            <div className="inline-block p-6 bg-blue-500/20 rounded-full mb-4">
              📄
            </div>
            <h3 className="text-xl font-semibold text-gray-300 mb-2">
              Office Document Detected
            </h3>
            <p className="text-gray-500 mb-4">
              {fileName} (.{ext})
            </p>
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6 max-w-md mx-auto">
              <p className="text-blue-400 text-sm">
                ℹ️ Office documents (Word, Excel, PowerPoint) cannot be previewed directly in the browser for security reasons.
              </p>
            </div>
            {allowDownload && (
              <button
                onClick={handleDownload}
                className="px-6 py-3 bg-gold-500 hover:bg-gold-600 text-black font-semibold rounded-lg transition-all"
              >
                Download to Open in Office
              </button>
            )}
          </div>
        );

      default:
        return (
          <div className="bg-dark-900 rounded-lg p-12 text-center">
            <AlertTriangle className="mx-auto mb-4 text-yellow-500" size={64} />
            <h3 className="text-xl font-semibold text-gray-300 mb-2">
              Preview Not Available
            </h3>
            <p className="text-gray-500 mb-4">
              This file type (.{ext}) cannot be previewed in the browser.
            </p>
            <p className="text-gray-600 text-sm mb-6">
              📝 Supported formats: Images, Videos, Audio, PDF, Office docs, Code files, HTML, and more
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
