import React, { useState, useRef } from 'react';
import axios from '../config/axios';
import { Lock, Unlock, AlertCircle, Upload } from 'lucide-react';
import FileViewer from './FileViewer';
import Toast from './Toast';
import BurningAnimation from './BurningAnimation';

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
  const [showBurning, setShowBurning] = useState(false);

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

        showToast(`✅ File decrypted successfully!`, 'success');
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
      {/* Burning Animation */}
      {showBurning && (
        <BurningAnimation
          onComplete={() => {
            setShowBurning(false);
            showToast('⚠️ File destroyed! Do NOT use this .bar file again.', 'error');
          }}
        />
      )}

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
            className="text-sm sm:text-base text-zinc-400 hover:text-white transition-colors"
          >
            ← Back to Create
          </button>
        </div>

        <div className="border border-white/5 rounded-2xl p-6 sm:p-8 bg-zinc-900/50 backdrop-blur-sm shadow-xl">
          <div className="text-center mb-6 sm:mb-8">
            <div className="inline-block p-3 sm:p-4 bg-zinc-800 rounded-lg mb-3 sm:mb-4 border border-white/5">
              <Unlock className="text-amber-500" size={32} />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 tracking-tight">
              Decrypt .BAR File
            </h2>
            <p className="text-sm sm:text-base text-zinc-400">
              Upload your encrypted file to retrieve the original content
            </p>
          </div>

          {error && (
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start space-x-2 sm:space-x-3">
              <AlertCircle className="text-red-500 shrink-0" size={20} />
              <p className="text-sm sm:text-base text-red-200">{error}</p>
            </div>
          )}

          {/* File Upload */}
          <div className="mb-6">
            <input
              ref={fileInputRef}
              type="file"
              accept=".bar"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-zinc-700 hover:border-amber-500/50 rounded-xl p-8 text-center transition-all duration-300 hover:bg-zinc-800/50 group"
            >
              <Upload className="mx-auto mb-3 text-zinc-500 group-hover:text-amber-500 transition-colors" size={32} />
              <p className="text-base sm:text-lg text-zinc-300 mb-1 truncate px-2 font-medium">
                {barFile ? barFile.name : 'Click to select .bar file'}
              </p>
              <p className="text-xs sm:text-sm text-zinc-500">
                {barFile ? 'Click to change file' : 'Only .bar files accepted'}
              </p>
            </button>
          </div>

          {/* Metadata Display */}
          {metadata && (
            <div className="mb-6 bg-zinc-800/30 rounded-xl p-6 border border-white/5">
              <h3 className="text-base font-semibold text-white mb-4 flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-2"></span>
                File Information
              </h3>

              {/* File Preview Icon */}
              {previewUrl && (
                <div className="text-center mb-4">
                  <div className="text-4xl mb-2">{previewUrl}</div>
                </div>
              )}

              <div className="space-y-3 text-sm">
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                  <span className="text-zinc-500">Original Filename</span>
                  <span className="text-zinc-200 font-mono break-all bg-black/20 px-2 py-0.5 rounded">{metadata.filename}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">Created</span>
                  <span className="text-zinc-300">
                    {new Date(metadata.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
                {metadata.expires_at && (
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Expires</span>
                    <span className="text-zinc-300">
                      {new Date(metadata.expires_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">Storage Mode</span>
                  <span className="text-zinc-300 flex items-center">
                    {metadata.storage_mode === 'server' ? 'Server-Side' : 'Client-Side'}
                  </span>
                </div>
                {/* Only show view counts for SERVER-SIDE files */}
                {metadata.storage_mode === 'server' && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500">Max Views</span>
                      <span className="text-zinc-300">{metadata.max_views || 'Unlimited'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500">Current Views</span>
                      <span className="text-zinc-300">{metadata.current_views || 0}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-white/5 mt-2">
                  <span className="text-zinc-500">Password Protection</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${metadata.password_protected ? 'bg-amber-500/10 text-amber-500' : 'bg-green-500/10 text-green-500'}`}>
                    {metadata.password_protected ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Password Input */}
          {metadata?.password_protected && (
            <div className="mb-6">
              <label className="block text-sm text-zinc-400 mb-2">Password Required</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter decryption password"
                className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-lg text-white focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-all text-sm placeholder-zinc-600"
              />
            </div>
          )}

          {/* Decrypt Button */}
          <button
            onClick={handleDecrypt}
            disabled={!barFile || isDecrypting || (metadata?.password_protected && !password)}
            className={`w-full py-4 rounded-xl font-semibold text-base transition-all duration-300 ${barFile && !isDecrypting && (!metadata?.password_protected || password)
                ? 'bg-amber-500 hover:bg-amber-600 text-black shadow-lg shadow-amber-500/20 active:scale-[0.98]'
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-white/5'
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
            <div className="mt-6 p-4 bg-zinc-800/50 rounded-lg text-center">
              <p className="text-zinc-400 text-sm">
                Select a .bar file to view details
              </p>
            </div>
          )}
          {metadata?.storage_mode === 'server' ? (
            <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg text-center">
              <p className="text-amber-500/80 text-sm">
                <strong>Note:</strong> Decrypting counts as a view and may trigger self-destruct.
              </p>
            </div>
          ) : metadata ? (
            <div className="mt-6 p-4 bg-zinc-800/50 border border-transparent rounded-lg text-center">
              <p className="text-zinc-400 text-sm">
                Client-side files have no view limits.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
};

export default DecryptPage;
