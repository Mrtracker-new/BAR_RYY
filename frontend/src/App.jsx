import React, { useState } from "react";
import { Routes, Route, useParams } from "react-router-dom";
import axios from "./config/axios";
import {
  Download,
  PackageOpen,
  AlertCircle,
  Link2,
  Copy,
  BarChart3,
  Upload,
  Shield,
  Lock,
  Clock,
  Zap,
} from "lucide-react";
import FileUpload from "./components/FileUpload";
import RulesPanel from "./components/RulesPanel";
import ContainerAnimation from "./components/ContainerAnimation";
import SharePage from "./components/SharePage";
import AnalyticsDashboard from "./components/AnalyticsDashboard";
import Toast from "./components/Toast";
import DecryptPage from "./components/DecryptPage";
import SEO from "./components/SEO";
import SEOContent from "./components/SEOContent";
import LandingPage from "./components/LandingPage";

// Wrapper component for share page route
const SharePageWrapper = () => {
  const { token } = useParams();
  return <SharePage token={token} />;
};

// Main app component
function MainApp() {
  const [uploadedFile, setUploadedFile] = useState(null);
  const [fileInfo, setFileInfo] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [rules, setRules] = useState({
    storageMode: "client", // 'client' or 'server'
    maxViews: 1,
    expiryMinutes: 0,
    expiryValue: 0,
    expiryUnit: "minutes",
    password: "",
    webhookUrl: "",
    viewOnly: false,
    requireOtp: false, // 2FA
    otpEmail: "", // Recipient's email for OTP
  });
  const [barResult, setBarResult] = useState(null);
  const [isSealing, setIsSealing] = useState(false);
  const [toast, setToast] = useState(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showDecrypt, setShowDecrypt] = useState(false);
  const [error, setError] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
  };

  const handleFileSelect = async (file) => {
    setError(null);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setUploadedFile(file);
      setFileInfo(response.data);
      setFilePreview(response.data.preview || null);
    } catch (err) {
      setError(
        "Failed to upload file: " + (err.response?.data?.detail || err.message)
      );
    }
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    setFileInfo(null);
    setFilePreview(null);
    setBarResult(null);
    setError(null);
  };

  const handleSealContainer = async () => {
    if (!fileInfo) {
      setError("No file uploaded");
      return;
    }

    setIsSealing(true);
    setError(null);

    try {
      // Simulate sealing delay for better UX
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const sealData = {
        filename: fileInfo.filename,
        max_views: rules.maxViews,
        expiry_minutes: rules.expiryMinutes,
        password: rules.password || null,
        webhook_url: (rules.webhookUrl && rules.webhookUrl.trim()) || null,
        view_only: rules.viewOnly || false,
        storage_mode: rules.storageMode || "client",
        require_otp: rules.requireOtp || false,
        otp_email: (rules.otpEmail && rules.otpEmail.trim()) || null,
      };

      const response = await axios.post("/seal", sealData);
      setBarResult(response.data);

      // Clear uploaded file state after successful seal
      setUploadedFile(null);
      setFileInfo(null);
    } catch (err) {
      setError(
        "Failed to seal container: " +
        (err.response?.data?.detail || err.message)
      );
    } finally {
      setIsSealing(false);
    }
  };

  const handleDownloadBar = () => {
    if (barResult && barResult.bar_data) {
      // Decode base64 bar data
      const binaryString = atob(barResult.bar_data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Create blob and download
      const blob = new Blob([bytes], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = barResult.bar_filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const handleReset = () => {
    setBarResult(null);
    setUploadedFile(null);
    setFileInfo(null);
    setError(null);
    setRules({
      storageMode: "client",
      maxViews: 1,
      expiryMinutes: 0,
      expiryValue: 0,
      expiryUnit: "minutes",
      password: "",
      webhookUrl: "",
      viewOnly: false,
      requireOtp: false,
      otpEmail: "",
    });
  };

  return (
    <div className="min-h-screen bg-dark-900 text-white font-sans selection:bg-gold-500/30 selection:text-gold-200 overflow-x-hidden relative">
      <SEO />
      <ContainerAnimation isSealing={isSealing} />

      {/* Ambient Background Effects */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50rem] h-[50rem] bg-gold-500/5 rounded-full blur-[100px] animate-pulse-slow" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[40rem] h-[40rem] bg-gold-600/5 rounded-full blur-[100px] animate-pulse-slow delay-1000" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
      </div>

      {/* Grid Pattern */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#F59E0B0A_1px,transparent_1px),linear-gradient(to_bottom,#F59E0B0A_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none z-0"></div>

      {/* Header */}
      <header className="fixed top-0 w-full z-50 border-b border-white/5 bg-dark-900/80 backdrop-blur-md">
        <div className="container mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center space-x-3 sm:space-x-4 cursor-pointer" onClick={() => window.location.href = '/'}>
              <div className="p-2 bg-gradient-to-br from-gold-500 to-gold-600 rounded-lg shadow-lg shadow-gold-500/20">
                <PackageOpen className="text-black" size={24} />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                  BAR Web
                </h1>
                <p className="text-gray-500 text-xs hidden sm:block font-medium tracking-wide">
                  SECURE FILE TRANSMISSION
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowDecrypt(!showDecrypt)}
              className="px-5 py-2 text-sm font-semibold bg-white/5 hover:bg-white/10 text-gold-500 border border-gold-500/20 hover:border-gold-500/50 rounded-lg transition-all duration-300 shadow-[0_0_15px_-5px_rgba(245,158,11,0.1)] hover:shadow-[0_0_20px_-5px_rgba(245,158,11,0.3)]"
            >
              {showDecrypt ? "📦 Create New" : "🔓 Decrypt File"}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
        {showDecrypt ? (
          <DecryptPage onBack={() => setShowDecrypt(false)} />
        ) : (
          <div className="relative">
            <AnimatePresence mode="wait">
              <motion.div
                key="upload-mode"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
              >
                {error && (
                  <div className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded-lg flex items-center space-x-3">
                    <AlertCircle className="text-red-500" size={24} />
                    <p className="text-red-300">{error}</p>
                  </div>
                )}

                {!barResult ? (
                  <div className="grid lg:grid-cols-5 gap-6 sm:gap-8 max-w-7xl mx-auto">
                    {/* Left Column - File Upload (3/5 width on desktop, full on mobile/tablet) */}
                    <div className="lg:col-span-3 space-y-6">
                      <div className="bg-dark-900/50 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-white/5 shadow-2xl relative">
                        {/* Decorative corner accents */}
                        <div className="absolute top-0 left-0 w-6 sm:w-8 h-6 sm:h-8 border-t-2 border-l-2 border-gold-500/30 rounded-tl-2xl"></div>
                        <div className="absolute top-0 right-0 w-6 sm:w-8 h-6 sm:h-8 border-t-2 border-r-2 border-gold-500/30 rounded-tr-2xl"></div>
                        <div className="absolute bottom-0 left-0 w-6 sm:w-8 h-6 sm:h-8 border-b-2 border-l-2 border-gold-500/30 rounded-bl-2xl"></div>
                        <div className="absolute bottom-0 right-0 w-6 sm:w-8 h-6 sm:h-8 border-b-2 border-r-2 border-gold-500/30 rounded-br-2xl"></div>

                        <div className="flex items-center space-x-3 mb-5">
                          <div className="p-2 bg-gold-500/10 rounded-lg border border-gold-500/20">
                            <Upload className="text-gold-500" size={20} />
                          </div>
                          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                            Encrypted Upload
                          </h2>
                        </div>

                        <FileUpload
                          onFileSelect={handleFileSelect}
                          uploadedFile={uploadedFile}
                          onRemove={handleRemoveFile}
                          filePreview={filePreview}
                        />
                      </div>

                      {!uploadedFile && (
                        <div className="bg-gradient-to-br from-dark-800 to-dark-900 rounded-2xl p-6 border border-dark-700 shadow-2xl">
                          <h3 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-gold-400 to-gold-600 bg-clip-text text-transparent mb-4">
                            ✨ Key Features
                          </h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="flex items-start space-x-3 p-3 bg-dark-700/50 rounded-lg border border-dark-600">
                              <Shield className="text-green-400 flex-shrink-0 mt-0.5" size={20} />
                              <div>
                                <h4 className="font-semibold text-green-400 text-sm">AES-256 Encryption</h4>
                                <p className="text-gray-400 text-xs mt-1">Military-grade security for your files</p>
                              </div>
                            </div>
                            <div className="flex items-start space-x-3 p-3 bg-dark-700/50 rounded-lg border border-dark-600">
                              <Zap className="text-yellow-400 flex-shrink-0 mt-0.5" size={20} />
                              <div>
                                <h4 className="font-semibold text-yellow-400 text-sm">Self-Destruct</h4>
                                <p className="text-gray-400 text-xs mt-1">Files auto-delete after viewing</p>
                              </div>
                            </div>
                            <div className="flex items-start space-x-3 p-3 bg-dark-700/50 rounded-lg border border-dark-600">
                              <Lock className="text-purple-400 flex-shrink-0 mt-0.5" size={20} />
                              <div>
                                <h4 className="font-semibold text-purple-400 text-sm">Password Protection</h4>
                                <p className="text-gray-400 text-xs mt-1">Zero-knowledge encryption</p>
                              </div>
                            </div>
                            <div className="flex items-start space-x-3 p-3 bg-dark-700/50 rounded-lg border border-dark-600">
                              <Clock className="text-blue-400 flex-shrink-0 mt-0.5" size={20} />
                              <div>
                                <h4 className="font-semibold text-blue-400 text-sm">Time-Based Expiry</h4>
                                <p className="text-gray-400 text-xs mt-1">Set custom expiration times</p>
                              </div>
                            </div>
                          </div>
                          <div className="mt-4 p-4 bg-gold-500/10 border border-gold-500/30 rounded-lg">
                            <p className="text-sm text-gray-300">
                              💡 <strong>Pro Tip:</strong> Use <span className="text-gold-400 font-semibold">Server-Side</span> storage mode for strictly enforced view limits and automatic file deletion!
                            </p>
                          </div>
                        </div>
                      )}

                      {uploadedFile && (
                        <div className="bg-gradient-to-br from-dark-800 to-dark-900 rounded-2xl p-6 border border-gold-500/30 shadow-2xl shadow-gold-500/10">
                          <div className="flex items-center space-x-2 mb-5">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <h3 className="text-base sm:text-lg font-bold bg-gradient-to-r from-gold-400 to-gold-600 bg-clip-text text-transparent">
                              📦 Container Preview
                            </h3>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-400">Status:</span>
                              <span className="text-green-500 font-semibold">
                                Ready to Seal
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Storage:</span>
                              <span className="text-white">
                                {rules.storageMode === "server"
                                  ? "🔒 Server-Side"
                                  : "📥 Client-Side"}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">File:</span>
                              <span className="text-white">
                                {uploadedFile.name}
                              </span>
                            </div>
                            {rules.storageMode === "server" && (
                              <div className="flex justify-between">
                                <span className="text-gray-400">Max Views:</span>
                                <span className="text-white">{rules.maxViews}</span>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span className="text-gray-400">Expiry:</span>
                              <span className="text-white">
                                {rules.expiryMinutes > 0
                                  ? `${rules.expiryValue} ${rules.expiryUnit}`
                                  : "Never"}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Password:</span>
                              <span className="text-white">
                                {rules.password ? "Protected" : "None"}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">View Only:</span>
                              <span
                                className={
                                  rules.viewOnly
                                    ? "text-yellow-500"
                                    : "text-gray-500"
                                }
                              >
                                {rules.viewOnly ? "Enabled" : "Disabled"}
                              </span>
                            </div>
                            {rules.storageMode === "server" && (
                              <div className="flex justify-between">
                                <span className="text-gray-400">2FA (OTP):</span>
                                <span
                                  className={
                                    rules.requireOtp
                                      ? "text-green-500"
                                      : "text-gray-500"
                                  }
                                >
                                  {rules.requireOtp ? "✅ Enabled" : "Disabled"}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right Column - Rules Panel (2/5 width on desktop, full on mobile/tablet) */}
                    <div className="lg:col-span-2 bg-dark-900/50 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-white/5 shadow-2xl relative h-fit">
                      <div className="absolute -z-10 bg-gradient-to-b from-gold-500/5 to-transparent inset-0 rounded-3xl pointer-events-none"></div>
                      <div className="flex items-center space-x-3 mb-5">
                        <div className="p-2 bg-purple-500/20 rounded-lg">
                          <AlertCircle className="text-purple-400" size={24} />
                        </div>
                        <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                          Control Center
                        </h2>
                      </div>

                      <RulesPanel
                        rules={rules}
                        onRulesChange={setRules}
                      />

                      <div className="mt-8 pt-6 border-t border-white/5">
                        <button
                          onClick={handleSealContainer}
                          disabled={isSealing || !uploadedFile}
                          className="w-full bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-400 hover:to-gold-500 text-black font-bold py-4 rounded-xl shadow-lg shadow-gold-500/20 transform transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 group"
                        >
                          {isSealing ? (
                            <>
                              <span className="animate-spin">⚙️</span>
                              <span>Sealing Container...</span>
                            </>
                          ) : (
                            <>
                              <span>🔒</span>
                              <span>Seal & Generate .BAR</span>
                            </>
                          )}
                        </button>
                        <p className="text-center text-xs text-gray-500 mt-4 font-mono">
                          AES-256 ENCRYPTION • ZERO KNOWLEDGE
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-2xl mx-auto">
                    <div className="border-2 border-gold-500 rounded-xl p-6 sm:p-8 bg-dark-800 terminal-glow">
                      <div className="text-center space-y-6">
                        <div className="inline-block p-6 bg-gold-500/20 rounded-full">
                          <PackageOpen className="text-gold-500" size={64} />
                        </div>

                        <h2 className="text-2xl sm:text-3xl font-bold text-gold-500 text-shadow-gold">
                          Container Sealed Successfully!
                        </h2>

                        <div className="bg-dark-900 rounded-lg p-4 sm:p-6 space-y-3">
                          {barResult.storage_mode === "server" ? (
                            <>
                              <div className="flex justify-between text-xs sm:text-sm flex-wrap gap-2">
                                <span className="text-gray-400">Storage Mode:</span>
                                <span className="text-green-500 font-semibold text-right">
                                  🔒 Server-Side
                                </span>
                              </div>
                              <div className="flex justify-between text-xs sm:text-sm">
                                <span className="text-gray-400">Max Views:</span>
                                <span className="text-white">
                                  {barResult.metadata.max_views}
                                </span>
                              </div>
                              <div className="flex justify-between text-xs sm:text-sm flex-wrap gap-2">
                                <span className="text-gray-400">Created:</span>
                                <span className="text-white text-right">
                                  {new Date(
                                    barResult.metadata.created_at
                                  ).toLocaleString("en-IN", {
                                    timeZone: "Asia/Kolkata",
                                    dateStyle: "short",
                                    timeStyle: "short",
                                  })}{" "}
                                  IST
                                </span>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex justify-between text-xs sm:text-sm flex-wrap gap-2">
                                <span className="text-gray-400">Storage Mode:</span>
                                <span className="text-yellow-500 font-semibold text-right">
                                  📥 Client-Side
                                </span>
                              </div>
                              <div className="flex flex-col sm:flex-row sm:justify-between text-xs sm:text-sm gap-1 sm:gap-0">
                                <span className="text-gray-400">Filename:</span>
                                <span className="text-white font-mono break-all">
                                  {barResult.bar_filename}
                                </span>
                              </div>
                              <div className="flex justify-between text-xs sm:text-sm flex-wrap gap-2">
                                <span className="text-gray-400">Created:</span>
                                <span className="text-white text-right">
                                  {new Date(
                                    barResult.metadata.created_at
                                  ).toLocaleString("en-IN", {
                                    timeZone: "Asia/Kolkata",
                                    dateStyle: "short",
                                    timeStyle: "short",
                                  })}{" "}
                                  IST
                                </span>
                              </div>
                            </>
                          )}
                        </div>

                        {barResult.storage_mode === "server" ? (
                          <>
                            <div className="bg-dark-700 border border-gold-500/30 rounded-lg p-3 sm:p-4">
                              <label className="text-xs sm:text-sm text-gray-400 mb-2 block">
                                Shareable Link:
                              </label>
                              <div className="flex items-center space-x-2">
                                <input
                                  type="text"
                                  value={`${window.location.origin}/share/${barResult.access_token}`}
                                  readOnly
                                  className="flex-1 px-2 sm:px-3 py-2 bg-dark-600 border border-dark-500 rounded text-white text-xs sm:text-sm font-mono"
                                />
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(
                                      `${window.location.origin}/share/${barResult.access_token}`
                                    );
                                    showToast(
                                      "Link copied to clipboard!",
                                      "success"
                                    );
                                  }}
                                  className="p-2 bg-gold-500 hover:bg-gold-600 text-black rounded transition-all shrink-0"
                                  title="Copy link"
                                >
                                  <Copy size={18} className="sm:w-5 sm:h-5" />
                                </button>
                              </div>
                              {/* 🟢 Added this new QR Code GEN section and additional code */}
                              {barResult.qr_code && (
                                <div className="mt-4 text-center">
                                  <p className="text-xs sm:text-sm text-gray-400 mb-2">
                                    QR Code:
                                  </p>
                                  <img
                                    src={barResult.qr_code}
                                    alt="QR Code"
                                    className="mx-auto w-40 h-40 rounded-lg border border-gold-500/30 shadow-md"
                                  />
                                </div>
                              )}
                            </div>

                            {/* Analytics Button */}
                            <button
                              onClick={() => setShowAnalytics(true)}
                              className="w-full py-3 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 text-purple-400 font-semibold rounded-lg transition-all duration-300 flex items-center justify-center space-x-2"
                            >
                              <BarChart3 size={20} />
                              <span>View Analytics Dashboard</span>
                            </button>

                            <p className="text-sm text-gray-400 text-center">
                              Share this link with anyone. View limits will be
                              properly enforced! 🔐
                            </p>
                          </>
                        ) : (
                          <button
                            onClick={handleDownloadBar}
                            className="w-full py-3 sm:py-4 bg-gold-500 hover:bg-gold-600 text-black font-bold text-base sm:text-lg rounded-lg transition-all duration-300 hover:scale-105 flex items-center justify-center space-x-2 sm:space-x-3"
                          >
                            <Download size={20} className="sm:w-6 sm:h-6" />
                            <span>Download .BAR File</span>
                          </button>
                        )}

                        <button
                          onClick={handleReset}
                          className="w-full py-3 border border-dark-600 hover:border-gold-500 text-gray-300 hover:text-gold-500 font-semibold rounded-lg transition-all duration-300"
                        >
                          Create Another Container
                        </button>

                        {barResult.storage_mode === "server" ? (
                          <div className="mt-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                            <p className="text-green-400 text-sm">
                              ✅ <strong>Server-Side Storage:</strong> View limits
                              are properly enforced! The file will auto-destruct
                              after {barResult.metadata.max_views} view(s) or when
                              it expires.
                            </p>
                          </div>
                        ) : (
                          <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                            <p className="text-yellow-400 text-sm">
                              ⚠️ <strong>Client-Side Storage:</strong> View limits
                              cannot be enforced (users can keep copies). For proper
                              security, use Server-Side storage mode instead.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* SEO Content Section */}
                {!barResult && !showDecrypt && (
                  <SEOContent />
                )}
              </>
        )}
            </main>

            {/* Toast Notifications */}
            {toast && (
              <Toast
                message={toast.message}
                type={toast.type}
                onClose={() => setToast(null)}
              />
            )}

            {/* Analytics Dashboard */}
            {showAnalytics && barResult && barResult.analytics_token && (
              <AnalyticsDashboard
                token={barResult.analytics_token}
                onClose={() => setShowAnalytics(false)}
              />
            )}

            {/* Footer */}
            <footer className="border-t border-dark-700 mt-12 sm:mt-20">
              <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 text-center text-gray-500 text-xs sm:text-sm">
                <p>BAR Web - Burn After Reading © 2025</p>
                <p className="mt-1 sm:mt-2">
                  Secure file encryption with self-destruct capabilities
                </p>
              </div>
            </footer>
          </div>
        );
}

        // App with routing
        function App() {
  return (
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/app" element={<MainApp />} />
          <Route path="/share/:token" element={<SharePageWrapper />} />
        </Routes>
        );
}

        export default App;
