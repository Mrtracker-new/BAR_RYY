import React, { useState, useRef } from 'react';
import axios from '../config/axios';
import { Lock, Unlock, FileDown, AlertCircle, Upload } from 'lucide-react';
import FileViewer from './FileViewer';
import Toast from './Toast';

const DecryptPage = ({ onBack }) => {
  const [barFile, setBarFile] = useState(null);
  const [password, setPassword] = useState('');
  const [metadata, setMetadata] = useState(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [error, setError] = useState(null);
  const [showViewer, setShowViewer] = useState(false);
  const [decryptedData, setDecryptedData] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.bar')) {
      setError('Please select a .bar file');
      return;
    }

    setBarFile(file);
    setError(null);
    setMetadata(null);
    setPreviewUrl(null);

    // Try to read metadata without decrypting
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const text = event.target.result;
          // Skip "BAR_FILE_V1\n" header
          const jsonStart = text.indexOf('\n') + 1;
          const obfuscatedData = text.substring(jsonStart);
          
          // Decode base64 to get the JSON
          const decodedJson = atob(obfuscatedData);
          const jsonData = JSON.parse(decodedJson);
          setMetadata(jsonData.metadata);
          
          // Generate preview icon based on file type
          generateFileTypePreview(jsonData.metadata.filename);
        } catch (err) {
          console.error('Could not read metadata:', err);
        }
      };
      reader.readAsText(file);
    } catch (err) {
      console.error('Error reading file:', err);
    }
  };

  const generateFileTypePreview = (filename) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
    const videoExts = ['mp4', 'avi', 'mov', 'mkv', 'webm'];
    const audioExts = ['mp3', 'wav', 'ogg', 'flac', 'm4a'];
    const docExts = ['pdf', 'doc', 'docx', 'txt', 'md'];
    const zipExts = ['zip', 'rar', '7z', 'tar', 'gz'];
    
    if (imageExts.includes(ext)) {
      setPreviewUrl('🖼️');
    } else if (videoExts.includes(ext)) {
      setPreviewUrl('🎥');
    } else if (audioExts.includes(ext)) {
      setPreviewUrl('🎵');
    } else if (docExts.includes(ext)) {
      setPreviewUrl('📄');
    } else if (zipExts.includes(ext)) {
      setPreviewUrl('📦');
    } else {
      setPreviewUrl('📎');
    }
  };

  const handleDecrypt = async () => {
    if (!barFile) {
      setError('Please select a .bar file');
      return;
    }

    setIsDecrypting(true);
    setError(null);

    try {
      // Upload .bar file to backend for proper decryption and view tracking
      const formData = new FormData();
      formData.append('file', barFile);
      // Always append password field (empty string if no password)
      formData.append('password', password || '');

      const response = await axios.post('/decrypt-upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        responseType: 'arraybuffer'
      });

      // Get metadata from headers
      const viewOnly = response.headers['x-bar-view-only'] === 'true';
      const fileName = response.headers['x-bar-filename'];
      const viewsRemaining = response.headers['x-bar-views-remaining'];
      const shouldDestroy = response.headers['x-bar-should-destroy'] === 'true';
      const metadataJson = response.headers['x-bar-metadata'];
      const metadataObj = JSON.parse(metadataJson);

      // Get decrypted file data
      const decryptedBytes = new Uint8Array(response.data);

      // Show view count info
      if (viewsRemaining > 0) {
        console.log(`Views remaining: ${viewsRemaining}`);
      }
      if (shouldDestroy) {
        showToast('⚠️ This was the last view! File destroyed. Do NOT use this .bar file again.', 'error');
      }

      // Check if view-only mode is enabled
      if (viewOnly) {
        // Show in viewer without download option
        setDecryptedData(decryptedBytes);
        setMetadata(metadataObj);
        setShowViewer(true);
      } else {
        // Allow download
        const blob = new Blob([decryptedBytes], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName || 'decrypted_file';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        const msg = shouldDestroy 
          ? '✅ File decrypted! This was the last view. ⚠️ DO NOT use this .bar file again!' 
          : `✅ File decrypted! ${viewsRemaining} view(s) remaining.`;
        showToast(msg, shouldDestroy ? 'error' : 'success');
      }

    } catch (err) {
      console.error('Decryption error:', err);
      let errorMsg = 'Failed to decrypt: ';
      
      if (err.response?.status === 403) {
        errorMsg = '🚫 Access Denied: ' + (err.response?.data?.detail || 'Maximum views reached or file expired');
      } else if (err.response?.data?.detail) {
        errorMsg += err.response.data.detail;
      } else {
        errorMsg += err.message;
      }
      
      setError(errorMsg);
    } finally {
      setIsDecrypting(false);
    }
  };

  return (
    <>
    {/* Toast Notifications */}
    {toast && (
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(null)}
      />
    )}

    {showViewer && decryptedData && metadata && (
      <FileViewer
        fileData={decryptedData}
        fileName={metadata.filename}
        fileType="application/octet-stream"
        onClose={() => {
          setShowViewer(false);
          setDecryptedData(null);
        }}
        allowDownload={!metadata.view_only}
      />
    )}
    <div className="max-w-3xl mx-auto">
      <div className="mb-4 sm:mb-6">
        <button
          onClick={onBack}
          className="text-sm sm:text-base text-gold-500 hover:text-gold-400 transition-colors"
        >
          ← Back to Create
        </button>
      </div>

      <div className="border border-dark-700 rounded-xl p-6 sm:p-8 bg-dark-800">
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-block p-3 sm:p-4 bg-gold-500/20 rounded-full mb-3 sm:mb-4">
            <Unlock className="text-gold-500" size={40} />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gold-500 text-shadow-gold mb-2">
            Decrypt .BAR File
          </h2>
          <p className="text-sm sm:text-base text-gray-400">
            Upload your .bar file to decrypt and retrieve the original file
          </p>
        </div>

        {error && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-500/20 border border-red-500 rounded-lg flex items-start space-x-2 sm:space-x-3">
            <AlertCircle className="text-red-500 shrink-0" size={20} />
            <p className="text-sm sm:text-base text-red-300">{error}</p>
          </div>
        )}

        {/* File Upload */}
        <div className="mb-4 sm:mb-6">
          <input
            ref={fileInputRef}
            type="file"
            accept=".bar"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full border-2 border-dashed border-dark-600 hover:border-gold-500 rounded-lg p-6 sm:p-8 text-center transition-all duration-300 hover:bg-dark-700"
          >
            <Upload className="mx-auto mb-2 sm:mb-3 text-gray-400" size={36} />
            <p className="text-base sm:text-lg text-gray-300 mb-1 truncate px-2">
              {barFile ? barFile.name : 'Click to select .bar file'}
            </p>
            <p className="text-xs sm:text-sm text-gray-500">
              {barFile ? 'Click to change file' : 'Only .bar files accepted'}
            </p>
          </button>
        </div>

        {/* Metadata Display */}
        {metadata && (
          <div className="mb-4 sm:mb-6 bg-dark-900 rounded-lg p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-gold-500 mb-3 sm:mb-4">File Information</h3>
            
            {/* File Preview Icon */}
            {previewUrl && (
              <div className="text-center mb-4">
                <div className="text-6xl mb-2">{previewUrl}</div>
                <p className="text-xs text-gray-500">File Type Preview</p>
              </div>
            )}
            
            <div className="space-y-2 text-xs sm:text-sm">
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                <span className="text-gray-400">Original Filename:</span>
                <span className="text-white font-mono break-all">{metadata.filename}</span>
              </div>
              <div className="flex justify-between flex-wrap gap-2">
                <span className="text-gray-400">Created:</span>
                <span className="text-white text-right">
                  {new Date(metadata.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' })} IST
                </span>
              </div>
              {metadata.expires_at && (
                <div className="flex justify-between flex-wrap gap-2">
                  <span className="text-gray-400">Expires:</span>
                  <span className="text-white text-right">
                    {new Date(metadata.expires_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' })} IST
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-400">Storage Mode:</span>
                <span className="text-white">
                  {metadata.storage_mode === 'server' ? '🔒 Server-Side' : '📥 Client-Side'}
                  {!metadata.storage_mode && <span className="text-xs text-gray-500 ml-2">(legacy file)</span>}
                </span>
              </div>
              {/* Only show view counts for SERVER-SIDE files */}
              {metadata.storage_mode === 'server' && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Max Views:</span>
                    <span className="text-white">{metadata.max_views || 'Unlimited'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Current Views:</span>
                    <span className="text-white">{metadata.current_views || 0}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between">
                <span className="text-gray-400">Password Protected:</span>
                <span className={metadata.password_protected ? 'text-yellow-500' : 'text-green-500'}>
                  {metadata.password_protected ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Password Input */}
        {metadata?.password_protected && (
          <div className="mb-4 sm:mb-6">
            <label className="block text-sm sm:text-base text-gray-300 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password to decrypt"
              className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base bg-dark-700 border border-dark-600 rounded-lg text-white focus:border-gold-500 focus:outline-none"
            />
          </div>
        )}

        {/* Decrypt Button */}
        <button
          onClick={handleDecrypt}
          disabled={!barFile || isDecrypting || (metadata?.password_protected && !password)}
          className={`w-full py-3 sm:py-4 rounded-lg font-bold text-base sm:text-lg transition-all duration-300 ${
            barFile && !isDecrypting && (!metadata?.password_protected || password)
              ? 'bg-gold-500 hover:bg-gold-600 text-black hover:scale-105'
              : 'bg-dark-600 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isDecrypting ? (
            <span className="flex items-center justify-center space-x-2">
              <Lock className="animate-spin" size={18} />
              <span>Decrypting...</span>
            </span>
          ) : (
            <span className="flex items-center justify-center space-x-2">
              <Unlock size={18} />
              <span>Decrypt & Download</span>
            </span>
          )}
        </button>

        {/* Show different warnings based on storage mode */}
        {barFile && !metadata && (
          <div className="mt-6 p-4 bg-gray-500/10 border border-gray-500/30 rounded-lg">
            <p className="text-gray-400 text-sm">
              📄 Select a .bar file to see its information
            </p>
          </div>
        )}
        {metadata?.storage_mode === 'server' ? (
          <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <p className="text-yellow-400 text-sm">
              ⚠️ <strong>Server-Side File:</strong> Decrypting counts as a view and could trigger self-destruct if the limit is reached.
            </p>
          </div>
        ) : metadata ? (
          <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <p className="text-blue-400 text-sm">
              ℹ️ <strong>Client-Side File:</strong> View limits are not enforced. You can decrypt this file as many times as you want.
            </p>
          </div>
        ) : null}
      </div>
    </div>
    </>
  );
};

export default DecryptPage;
