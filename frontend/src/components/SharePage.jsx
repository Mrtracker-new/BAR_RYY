import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Lock, Download, AlertCircle, FileCheck } from 'lucide-react';

const SharePage = ({ token }) => {
  const [password, setPassword] = useState('');
  const [metadata, setMetadata] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fileData, setFileData] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [viewsRemaining, setViewsRemaining] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const handleDownload = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Call backend API at /api/share (not /share which is a frontend route)
      const url = `http://localhost:8000/share/${token}${password ? `?password=${encodeURIComponent(password)}` : ''}`;
      
      const response = await axios.get(url, {
        responseType: 'arraybuffer'
      });

      // Get metadata from headers (axios lowercases header names)
      console.log('Response headers:', response.headers);
      const retrievedFileName = response.headers['x-bar-filename'];
      const retrievedViewsRemaining = response.headers['x-bar-views-remaining'] || '0';
      const shouldDestroy = response.headers['x-bar-should-destroy'] === 'true';
      const viewOnly = response.headers['x-bar-view-only'] === 'true';
      
      console.log('View Only:', viewOnly);
      console.log('File Name:', retrievedFileName);
      console.log('Views Remaining:', retrievedViewsRemaining);

      setFileName(retrievedFileName);
      setViewsRemaining(retrievedViewsRemaining);
      setIsViewOnly(viewOnly);

      // Check if view-only mode
      if (viewOnly) {
        // Display the file instead of downloading
        const fileBlob = new Blob([response.data]);
        const fileUrl = URL.createObjectURL(fileBlob);
        setFileData(fileUrl);
        setSuccessMessage(`File loaded successfully. ${retrievedViewsRemaining} view(s) remaining.`);
      } else {
        // Download the file
        const blob = new Blob([response.data], { type: 'application/octet-stream' });
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = retrievedFileName || 'decrypted_file';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);

        // Show success message
        if (shouldDestroy) {
          setSuccessMessage('✅ File downloaded! ⚠️ This was the last view. The file has been destroyed.');
        } else {
          setSuccessMessage(`✅ File downloaded! ${retrievedViewsRemaining} view(s) remaining.`);
        }
      }

    } catch (err) {
      console.error('Download error:', err);
      let errorMsg = 'Failed to download file: ';
      
      if (err.response?.status === 404) {
        errorMsg = '🚫 File not found or already destroyed';
      } else if (err.response?.status === 403) {
        errorMsg = '🚫 Access denied: ' + (err.response?.data?.detail || 'Invalid password or view limit reached');
      } else if (err.response?.data?.detail) {
        errorMsg += err.response.data.detail;
      } else {
        errorMsg += err.message;
      }
      
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-900 text-white flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="border-2 border-gold-500 rounded-xl p-8 bg-dark-800 terminal-glow">
          <div className="text-center space-y-6">
            <div className="inline-block p-6 bg-gold-500/20 rounded-full">
              <FileCheck className="text-gold-500" size={48} />
            </div>
            
            <div>
              <h1 className="text-3xl font-bold text-gold-500 text-shadow-gold mb-2">
                Secure File Access
              </h1>
              <p className="text-gray-400">
                This is a one-time shareable link
              </p>
            </div>

            {error && (
              <div className="p-4 bg-red-500/20 border border-red-500 rounded-lg flex items-center space-x-3">
                <AlertCircle className="text-red-500" size={24} />
                <p className="text-red-300 text-sm text-left">{error}</p>
              </div>
            )}

            {successMessage && (
              <div className="p-4 bg-green-500/20 border border-green-500 rounded-lg flex items-center space-x-3">
                <FileCheck className="text-green-500" size={24} />
                <p className="text-green-300 text-sm text-left">{successMessage}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 mb-2 text-left">Password (if protected)</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleDownload()}
                  placeholder="Enter password or leave empty"
                  className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white focus:border-gold-500 focus:outline-none"
                />
              </div>

              {/* Only show download button if not already viewing a file */}
              {!fileData && (
                <button
                  onClick={handleDownload}
                  disabled={isLoading}
                  className={`w-full py-4 rounded-lg font-bold text-lg transition-all duration-300 ${
                    isLoading
                      ? 'bg-dark-600 text-gray-500 cursor-not-allowed'
                      : 'bg-gold-500 hover:bg-gold-600 text-black hover:scale-105'
                  }`}
                >
                {isLoading ? (
                  <span className="flex items-center justify-center space-x-2">
                    <Lock className="animate-spin" size={20} />
                    <span>Downloading...</span>
                  </span>
                ) : (
                  <span className="flex items-center justify-center space-x-2">
                    <Download size={20} />
                    <span>Download File</span>
                  </span>
                )}
                </button>
              )}
            </div>

            {!fileData && (
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-yellow-400 text-sm">
                  ⚠️ <strong>Warning:</strong> This link may have limited views. Once the view limit is reached, the file will be permanently destroyed.
                </p>
              </div>
            )}

            {/* File Viewer for View-Only Mode */}
            {fileData && isViewOnly && (
              <div className="mt-6 border-2 border-gold-500 rounded-lg overflow-hidden bg-dark-900">
                <div className="bg-gold-500/20 p-3 border-b border-gold-500">
                  <p className="text-gold-500 font-semibold text-sm">
                    📄 Viewing: {fileName}
                  </p>
                  <p className="text-gray-400 text-xs mt-1">
                    View-Only Mode - Downloads Disabled
                  </p>
                </div>
                <div className="p-4 max-h-96 overflow-auto">
                  {fileName && (
                    fileName.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) ? (
                      <img src={fileData} alt={fileName} className="max-w-full h-auto mx-auto" />
                    ) : fileName.match(/\.(mp4|webm|ogg)$/i) ? (
                      <video controls className="max-w-full h-auto mx-auto">
                        <source src={fileData} />
                      </video>
                    ) : fileName.match(/\.(mp3|wav|ogg)$/i) ? (
                      <audio controls className="w-full">
                        <source src={fileData} />
                      </audio>
                    ) : fileName.match(/\.pdf$/i) ? (
                      <iframe src={fileData} className="w-full h-96" title={fileName} />
                    ) : fileName.match(/\.(txt|md|json|xml|csv)$/i) ? (
                      <iframe src={fileData} className="w-full h-96 bg-white" title={fileName} />
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-gray-400">
                          Cannot preview this file type ({fileName.split('.').pop()}).
                        </p>
                        <p className="text-gray-500 text-sm mt-2">
                          This file is view-only and cannot be downloaded.
                        </p>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="text-center mt-6">
          <a href="/" className="text-gold-500 hover:text-gold-400 transition-colors">
            ← Back to BAR Web
          </a>
        </div>
      </div>
    </div>
  );
};

export default SharePage;
