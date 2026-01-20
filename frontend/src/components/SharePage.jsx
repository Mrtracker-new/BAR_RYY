import React, { useState, useEffect } from 'react';
import axios from '../config/axios';
import { Lock, Download, AlertCircle, FileCheck, Mail, Shield } from 'lucide-react';
import ContentProtection from './ContentProtection';
import BurningAnimation from './BurningAnimation';
import SEO from './SEO';

const SharePage = ({ token }) => {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fileData, setFileData] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [viewsRemaining, setViewsRemaining] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpInfo, setOtpInfo] = useState(null);
  const [showOtpUI, setShowOtpUI] = useState(false);
  const [showBurning, setShowBurning] = useState(false);

  const handleRequestOtp = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
      const response = await axios.post(`${backendUrl}/request-otp/${token}`);

      setOtpSent(true);
      setOtpInfo(response.data);
      setSuccessMessage(response.data.message);
    } catch (err) {
      console.error('OTP request error:', err);
      setError(err.response?.data?.detail || 'Failed to send OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.length !== 6) {
      setError('Please enter a valid 6-digit OTP code');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
      const formData = new FormData();
      formData.append('otp_code', otpCode);

      const response = await axios.post(`${backendUrl}/verify-otp/${token}`, formData);

      setOtpVerified(true);
      setSuccessMessage(response.data.message);
    } catch (err) {
      console.error('OTP verification error:', err);
      setError(err.response?.data?.detail || 'OTP verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Call backend API with POST (axios config will add base URL in production)
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
      const response = await axios.post(`${backendUrl}/share/${token}`,
        { password: password || null },
        { responseType: 'arraybuffer' }
      );

      // Get metadata from headers (axios lowercases header names)
      const retrievedFileName = response.headers['x-bar-filename'];
      const retrievedViewsRemaining = response.headers['x-bar-views-remaining'] || '0';
      const shouldDestroy = response.headers['x-bar-should-destroy'] === 'true';
      const viewOnly = response.headers['x-bar-view-only'] === 'true';

      setFileName(retrievedFileName);
      setViewsRemaining(retrievedViewsRemaining);
      setIsViewOnly(viewOnly);

      // Check if view-only mode
      if (viewOnly) {
        // Display the file instead of downloading
        // Get MIME type from response or guess from filename
        const contentType = response.headers['content-type'] || 'application/octet-stream';

        const fileBlob = new Blob([response.data], { type: contentType });
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
          setShowBurning(true);
        } else {
          setSuccessMessage(`✅ File downloaded! ${retrievedViewsRemaining} view(s) remaining.`);
        }
      }

      // Setup auto-refresh if configured
      const autoRefreshSeconds = parseInt(response.headers['x-bar-auto-refresh-seconds'] || '0');
      if (autoRefreshSeconds > 0) {
        setTimeout(() => {
          window.location.reload();
        }, autoRefreshSeconds * 1000);
      }

    } catch (err) {
      console.error('Download error:', err);

      let errorMsg = 'Failed to download file: ';

      if (err.response?.status === 404) {
        errorMsg = '🚫 File not found or already destroyed';
      } else if (err.response?.status === 403) {
        // Get the actual error message from backend
        let detail = 'Unknown error';

        if (err.response?.data) {
          // Response data is arraybuffer due to responseType setting
          if (err.response.data instanceof ArrayBuffer) {
            try {
              const text = new TextDecoder().decode(err.response.data);
              const json = JSON.parse(text);
              detail = json.detail || text;
            } catch (e) {
              try {
                detail = new TextDecoder().decode(err.response.data);
              } catch (e2) {
                console.error('Failed to decode as text:', e2);
              }
            }
          } else if (typeof err.response.data === 'string') {
            detail = err.response.data;
          } else if (err.response.data.detail) {
            detail = err.response.data.detail;
          } else if (typeof err.response.data === 'object') {
            detail = JSON.stringify(err.response.data);
          }
        }

        // Check if it's a 2FA error
        if (detail.includes('2FA') || detail.includes('OTP')) {
          setShowOtpUI(true);  // Show OTP UI when 2FA is required
          errorMsg = detail;
        } else {
          errorMsg = '🚫 Access denied: ' + detail;
        }
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
    <>
      <SEO
        title="Secure File Access - BAR Web"
        description="Access your encrypted file securely. Military-grade AES-256 encryption with self-destruct capabilities."
        url={`https://bar-rnr.vercel.app/share/${token}`}
      />
      {/* Burning Animation */}
      {showBurning && (
        <BurningAnimation
          onComplete={() => {
            setShowBurning(false);
            setSuccessMessage('⚠️ File destroyed! This link is no longer valid.');
          }}
        />
      )}

      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <div className="border border-white/5 rounded-2xl p-8 bg-zinc-900/50 backdrop-blur-md shadow-2xl">
            <div className="text-center space-y-6">
              <div className="inline-block p-4 bg-zinc-800 rounded-2xl border border-white/5 shadow-inner">
                <FileCheck className="text-amber-500" size={40} />
              </div>

              <div>
                <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">
                  Secure File Access
                </h1>
                <p className="text-zinc-400 text-sm">
                  This link allows one-time access to a secure file.
                </p>
              </div>

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start space-x-3 text-left">
                  <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
                  <p className="text-red-200 text-sm leading-relaxed">{error}</p>
                </div>
              )}

              {successMessage && (
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-start space-x-3 text-left">
                  <FileCheck className="text-green-500 shrink-0 mt-0.5" size={18} />
                  <p className="text-green-200 text-sm leading-relaxed">{successMessage}</p>
                </div>
              )}

              <div className="space-y-4">
                {/* Step 1: Always show password field first */}
                <div className="text-left">
                  <label className="block text-zinc-400 text-sm mb-2 font-medium">Password Protection</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !showOtpUI && handleDownload()}
                    placeholder="Enter password if required..."
                    className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-all text-sm placeholder-zinc-600"
                  />
                </div>

                {/* Step 2: Show OTP UI only after 2FA error */}
                {showOtpUI && !otpVerified ? (
                  <div className="animate-fade-in-down">
                    {/* OTP Request Section */}
                    {!otpSent ? (
                      <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-5 text-left">
                        <div className="flex items-center space-x-2 mb-3">
                          <Shield className="text-blue-400" size={18} />
                          <p className="text-blue-400 font-semibold text-sm">2FA Verification</p>
                        </div>
                        <p className="text-zinc-400 text-xs mb-4 leading-relaxed">
                          Dual-factor authentication is enabled. Request a code to your email.
                        </p>
                        <button
                          onClick={handleRequestOtp}
                          disabled={isLoading}
                          className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-all text-sm shadow-lg shadow-blue-500/20"
                        >
                          {isLoading ? 'Sending...' : 'Send Verification Code'}
                        </button>
                      </div>
                    ) : (
                      /* OTP Verification Section */
                      <div className="bg-zinc-800/50 border border-white/10 rounded-xl p-5">
                        <div className="flex items-center justify-center space-x-2 mb-4">
                          <Mail className="text-green-500" size={18} />
                          <p className="text-green-500 font-medium text-sm">Code Sent</p>
                        </div>
                        <p className="text-zinc-500 text-xs mb-4 text-center">
                          Enter the 6-digit code sent to your email.
                          {otpInfo && <span className="block mt-1">({otpInfo.max_attempts} attempts remaining)</span>}
                        </p>
                        <input
                          type="text"
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          onKeyPress={(e) => e.key === 'Enter' && handleVerifyOtp()}
                          placeholder="000 000"
                          maxLength={6}
                          className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-lg text-white text-center text-2xl font-mono tracking-[0.5em] focus:border-amber-500/50 focus:outline-none mb-4 placeholder-zinc-700"
                        />
                        <button
                          onClick={handleVerifyOtp}
                          disabled={isLoading || otpCode.length !== 6}
                          className={`w-full py-3 rounded-lg font-bold transition-all ${otpCode.length === 6 && !isLoading
                            ? 'bg-amber-500 hover:bg-amber-600 text-black shadow-lg shadow-amber-500/20'
                            : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                            }`}
                        >
                          {isLoading ? 'Verifying...' : 'Verify & Unlock'}
                        </button>
                        <button
                          onClick={handleRequestOtp}
                          disabled={isLoading}
                          className="w-full mt-3 text-xs text-zinc-500 hover:text-white transition-colors"
                        >
                          Resend Code
                        </button>
                      </div>
                    )}
                  </div>
                ) : null}

                {/* Step 3: Show download button (if no OTP UI showing, or after OTP verified) */}
                {(!showOtpUI || otpVerified) && !fileData && (
                  <button
                    onClick={handleDownload}
                    disabled={isLoading}
                    className={`w-full py-4 rounded-xl font-bold text-base transition-all duration-300 ${isLoading
                      ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-white/5'
                      : 'bg-amber-500 hover:bg-amber-600 text-black shadow-lg shadow-amber-500/20 active:scale-[0.98]'
                      }`}
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center space-x-2">
                        <Lock className="animate-spin" size={18} />
                        <span>Processing...</span>
                      </span>
                    ) : (
                      <span className="flex items-center justify-center space-x-2">
                        <Download size={18} />
                        <span>Access File</span>
                      </span>
                    )}
                  </button>
                )}
              </div>

              {!fileData && (
                <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-lg">
                  <p className="text-amber-500/60 text-xs">
                    <strong>Notice:</strong> This file may self-destruct after viewing.
                  </p>
                </div>
              )}

              {/* File Viewer for View-Only Mode */}
              {fileData && isViewOnly && (
                <ContentProtection enabled={true} watermarkText={`View-Only • ${token.substring(0, 8)}`}>
                  <div className="mt-8 border border-white/10 rounded-xl overflow-hidden bg-black/40">
                    <div className="bg-zinc-900/80 p-3 border-b border-white/10 flex justify-between items-center">
                      <p className="text-zinc-300 font-medium text-xs truncate max-w-[200px]">
                        {fileName}
                      </p>
                      <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-500 font-medium border border-amber-500/20">
                        View-Only
                      </span>
                    </div>
                    <div className="p-4 max-h-[500px] overflow-auto">
                      {fileName && (
                        fileName.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) ? (
                          <img
                            src={fileData}
                            alt={fileName}
                            className="max-w-full h-auto mx-auto rounded-lg shadow-lg"
                            draggable={false}
                            style={{ pointerEvents: 'none' }}
                          />
                        ) : fileName.match(/\.(mp4|webm|ogg)$/i) ? (
                          <video
                            controls
                            controlsList="nodownload"
                            disablePictureInPicture
                            className="max-w-full h-auto mx-auto rounded-lg"
                            onContextMenu={(e) => e.preventDefault()}
                          >
                            <source src={fileData} />
                          </video>
                        ) : fileName.match(/\.(mp3|wav|ogg)$/i) ? (
                          <audio
                            controls
                            controlsList="nodownload"
                            className="w-full"
                            onContextMenu={(e) => e.preventDefault()}
                          >
                            <source src={fileData} />
                          </audio>
                        ) : fileName.match(/\.pdf$/i) ? (
                          <iframe src={fileData} className="w-full h-96 rounded-lg border border-white/10" title={fileName} />
                        ) : fileName.match(/\.(txt|md|json|xml|csv)$/i) ? (
                          <iframe src={fileData} className="w-full h-96 bg-white rounded-lg" title={fileName} />
                        ) : (
                          <div className="text-center py-12">
                            <p className="text-zinc-500 text-sm">
                              Cannot preview this file type ({fileName.split('.').pop()}).
                            </p>
                            <p className="text-zinc-600 text-xs mt-2">
                              Downloads are disabled for this sensitive file.
                            </p>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </ContentProtection>
              )}
            </div>
          </div>

          <div className="text-center mt-8">
            <a href="/" className="text-xs text-zinc-500 hover:text-white transition-colors uppercase tracking-widest font-medium">
              Powered by BAR Web
            </a>
          </div>
        </div>
      </div>
    </>
  );
};

export default SharePage;
