import React, { useState, useEffect } from 'react';
import axios from '../config/axios';
import { Lock, Download, AlertCircle, FileCheck, Mail, Shield } from 'lucide-react';
import ContentProtection from './ContentProtection';

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
  const [requireOtp, setRequireOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpInfo, setOtpInfo] = useState(null);

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
        // Get MIME type from response or guess from filename
        const contentType = response.headers['content-type'] || 'application/octet-stream';
        console.log('Content-Type:', contentType);
        
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
          setSuccessMessage('✅ File downloaded! ⚠️ This was the last view. The file has been destroyed.');
        } else {
          setSuccessMessage(`✅ File downloaded! ${retrievedViewsRemaining} view(s) remaining.`);
        }
      }

    } catch (err) {
      console.error('Download error:', err);
      console.error('Error response:', err.response);
      
      let errorMsg = 'Failed to download file: ';
      
      if (err.response?.status === 404) {
        errorMsg = '🚫 File not found or already destroyed';
      } else if (err.response?.status === 403) {
        // Get the actual error message from backend
        let detail = 'Unknown error';
        if (err.response?.data) {
          if (typeof err.response.data === 'string') {
            detail = err.response.data;
          } else if (err.response.data.detail) {
            detail = err.response.data.detail;
          }
        }
        
        // Check if it's a 2FA error
        if (detail.includes('2FA') || detail.includes('OTP')) {
          setRequireOtp(true);
          errorMsg = detail;
        } else {
          errorMsg = '🚫 Access denied: ' + detail;
        }
      } else if (err.response?.data?.detail) {
        errorMsg += err.response.data.detail;
      } else {
        errorMsg += err.message;
      }
      
      console.error('Error message:', errorMsg);
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
              {/* Check if OTP is required */}
              {requireOtp && !otpVerified ? (
                <>
                  {/* OTP Request Section */}
                  {!otpSent ? (
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                      <div className="flex items-center space-x-2 mb-3">
                        <Shield className="text-blue-400" size={20} />
                        <p className="text-blue-400 font-semibold">2FA Required</p>
                      </div>
                      <p className="text-gray-300 text-sm mb-4">
                        This file requires email verification. Click below to receive a 6-digit code.
                      </p>
                      <button
                        onClick={handleRequestOtp}
                        disabled={isLoading}
                        className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-lg transition-all"
                      >
                        {isLoading ? 'Sending...' : '📧 Send OTP to Email'}
                      </button>
                    </div>
                  ) : (
                    /* OTP Verification Section */
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                      <div className="flex items-center space-x-2 mb-3">
                        <Mail className="text-green-400" size={20} />
                        <p className="text-green-400 font-semibold">OTP Sent!</p>
                      </div>
                      <p className="text-gray-300 text-sm mb-4">
                        Check your email for the 6-digit code. {otpInfo && `(${otpInfo.max_attempts} attempts)`}
                      </p>
                      <input
                        type="text"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        onKeyPress={(e) => e.key === 'Enter' && handleVerifyOtp()}
                        placeholder="Enter 6-digit code"
                        maxLength={6}
                        className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white text-center text-2xl font-bold tracking-widest focus:border-gold-500 focus:outline-none mb-3"
                      />
                      <button
                        onClick={handleVerifyOtp}
                        disabled={isLoading || otpCode.length !== 6}
                        className={`w-full py-3 rounded-lg font-bold transition-all ${
                          otpCode.length === 6 && !isLoading
                            ? 'bg-gold-500 hover:bg-gold-600 text-black'
                            : 'bg-dark-600 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        {isLoading ? 'Verifying...' : '✅ Verify OTP'}
                      </button>
                      <button
                        onClick={handleRequestOtp}
                        disabled={isLoading}
                        className="w-full mt-2 py-2 text-sm text-gray-400 hover:text-gold-400 transition-colors"
                      >
                        Didn't receive? Resend OTP
                      </button>
                    </div>
                  )}
                </>
              ) : (
                /* Password and Download Section (shown after OTP verification or if no OTP required) */
                <>
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
                </>
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
              <ContentProtection enabled={true} watermarkText={`View-Only • ${token.substring(0, 8)}`}>
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
                      <img 
                        src={fileData} 
                        alt={fileName} 
                        className="max-w-full h-auto mx-auto"
                        draggable={false}
                        style={{ pointerEvents: 'none' }}
                      />
                    ) : fileName.match(/\.(mp4|webm|ogg)$/i) ? (
                      <video 
                        controls 
                        controlsList="nodownload"
                        disablePictureInPicture
                        className="max-w-full h-auto mx-auto"
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
              </ContentProtection>
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
