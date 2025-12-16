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
  Loader,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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

      {/* Modern Subtle Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-amber-500/5 to-transparent opacity-60" />
      </div>
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none z-0"></div>

      {/* Header */}
      <header className="fixed top-0 w-full z-50 border-b border-white/5 bg-[#0d0d0d]/80 backdrop-blur-md">
        <div className="container mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center space-x-3 cursor-pointer group" onClick={() => window.location.href = '/'}>
              <div className="p-2 bg-amber-500/10 rounded-lg group-hover:bg-amber-500/20 transition-colors">
                <PackageOpen className="text-amber-500" size={24} />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                  BAR Web
                </h1>
              </div>
            </div>
            <button
              onClick={() => setShowDecrypt(!showDecrypt)}
              className="px-4 py-2 text-sm font-medium bg-white/5 hover:bg-white/10 text-amber-500 border border-amber-500/20 hover:border-amber-500/50 rounded-lg transition-all"
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
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center space-x-3">
                <AlertCircle className="text-red-500" size={20} />
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {!barResult ? (
              <div className="grid lg:grid-cols-5 gap-6 sm:gap-8 max-w-7xl mx-auto">
                {/* Left Column */}
                <div className="lg:col-span-3 space-y-6">
                  <div className="bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-6 border border-white/5 relative">
                    <div className="flex items-center space-x-3 mb-5">
                      <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
                        <Upload className="text-amber-500" size={20} />
                      </div>
                      <h2 className="text-lg font-semibold text-white">
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
                    <div className="bg-zinc-900/30 rounded-2xl p-6 border border-white/5">
                      <h3 className="text-lg font-semibold text-zinc-300 mb-4">
                        Key Features
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex items-start space-x-3 p-3 bg-white/5 rounded-lg border border-white/5">
                          <Shield className="text-green-500/80 flex-shrink-0 mt-0.5" size={20} />
                          <div>
                            <h4 className="font-medium text-zinc-200 text-sm">AES-256 Encryption</h4>
                            <p className="text-zinc-500 text-xs mt-1">Military-grade protection</p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-3 p-3 bg-white/5 rounded-lg border border-white/5">
                          <Zap className="text-amber-500/80 flex-shrink-0 mt-0.5" size={20} />
                          <div>
                            <h4 className="font-medium text-zinc-200 text-sm">Self-Destruct</h4>
                            <p className="text-zinc-500 text-xs mt-1">Auto-delete after viewing</p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-3 p-3 bg-white/5 rounded-lg border border-white/5">
                          <Lock className="text-purple-500/80 flex-shrink-0 mt-0.5" size={20} />
                          <div>
                            <h4 className="font-medium text-zinc-200 text-sm">Pass Protection</h4>
                            <p className="text-zinc-500 text-xs mt-1">Zero-knowledge access</p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-3 p-3 bg-white/5 rounded-lg border border-white/5">
                          <Clock className="text-blue-500/80 flex-shrink-0 mt-0.5" size={20} />
                          <div>
                            <h4 className="font-medium text-zinc-200 text-sm">Time Expiry</h4>
                            <p className="text-zinc-500 text-xs mt-1">Set custom time limits</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {uploadedFile && (
                    <div className="bg-zinc-900/50 rounded-2xl p-6 border border-amber-500/20 shadow-lg shadow-amber-500/5">
                      <div className="flex items-center space-x-2 mb-5">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <h3 className="text-base font-bold text-amber-500">
                          Container Preview
                        </h3>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between py-1 border-b border-white/5">
                          <span className="text-zinc-500">Status</span>
                          <span className="text-green-500 font-medium">Ready to Seal</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-white/5">
                          <span className="text-zinc-500">Storage</span>
                          <span className="text-zinc-200">
                            {rules.storageMode === "server" ? "Server-Side" : "Client-Side"}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-white/5">
                          <span className="text-zinc-500">File</span>
                          <span className="text-zinc-200 truncate max-w-[200px]">{uploadedFile.name}</span>
                        </div>
                        {rules.storageMode === "server" && (
                          <div className="flex justify-between py-1 border-b border-white/5">
                            <span className="text-zinc-500">Max Views</span>
                            <span className="text-zinc-200">{rules.maxViews}</span>
                          </div>
                        )}
                        <div className="flex justify-between py-1 border-b border-white/5">
                          <span className="text-zinc-500">Expiry</span>
                          <span className="text-zinc-200">
                            {rules.expiryMinutes > 0 ? `${rules.expiryValue} ${rules.expiryUnit}` : "Never"}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-white/5">
                          <span className="text-zinc-500">Pass Protected</span>
                          <span className="text-zinc-200">{rules.password ? "Yes" : "No"}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column - Rules */}
                <div className="lg:col-span-2 bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-6 border border-white/5 h-fit">
                  <div className="flex items-center space-x-3 mb-5">
                    <div className="p-2 bg-purple-500/10 rounded-lg">
                      <AlertCircle className="text-purple-400" size={20} />
                    </div>
                    <h2 className="text-lg font-semibold text-white">
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
                      className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-3.5 rounded-xl shadow-lg shadow-amber-500/10 transform transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                    >
                      {isSealing ? (
                        <>
                          <Loader className="animate-spin" size={18} />
                          <span>Sealing...</span>
                        </>
                      ) : (
                        <>
                          <Lock size={18} />
                          <span>Seal & Generate .BAR</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="max-w-2xl mx-auto">
                <div className="border border-amber-500/30 rounded-2xl p-8 bg-zinc-900/80 backdrop-blur-sm shadow-2xl">
                  <div className="text-center space-y-6">
                    <div className="inline-block p-4 bg-amber-500/10 rounded-full mb-2">
                      <PackageOpen className="text-amber-500" size={48} />
                    </div>

                    <h2 className="text-2xl font-bold text-white">
                      Container Sealed Successfully!
                    </h2>

                    <div className="bg-black/40 rounded-xl p-6 space-y-3 border border-white/5 text-left">
                      {barResult.storage_mode === "server" ? (
                        <>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-zinc-500">Storage Mode</span>
                            <span className="text-green-500 font-medium bg-green-500/10 px-2 py-0.5 rounded text-xs">Server-Side</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-zinc-500">Max Views</span>
                            <span className="text-zinc-200 font-mono">{barResult.metadata.max_views}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-zinc-500">Storage Mode</span>
                            <span className="text-amber-500 font-medium bg-amber-500/10 px-2 py-0.5 rounded text-xs">Client-Side</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-zinc-500">Filename</span>
                            <span className="text-zinc-200 font-mono text-xs">{barResult.bar_filename}</span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-zinc-500">Created At</span>
                        <span className="text-zinc-400 text-xs">
                          {new Date(barResult.metadata.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {barResult.storage_mode === "server" ? (
                      <>
                        <div className="bg-zinc-800/50 border border-white/10 rounded-xl p-4 text-left">
                          <label className="text-xs text-zinc-500 mb-2 block font-medium uppercase tracking-wider">
                            Shareable Link
                          </label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="text"
                              value={`${window.location.origin}/share/${barResult.access_token}`}
                              readOnly
                              className="flex-1 px-3 py-2 bg-black/50 border border-white/10 rounded text-zinc-300 text-sm font-mono focus:outline-none focus:border-amber-500/50"
                            />
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(`${window.location.origin}/share/${barResult.access_token}`);
                                showToast("Link copied to clipboard!", "success");
                              }}
                              className="p-2 bg-amber-500 hover:bg-amber-400 text-black rounded transition-colors"
                            >
                              <Copy size={18} />
                            </button>
                          </div>

                          {barResult.qr_code && (
                            <div className="mt-4 flex justify-center">
                              <img src={barResult.qr_code} alt="QR Code" className="w-32 h-32 rounded-lg border border-white/10" />
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => setShowAnalytics(true)}
                          className="w-full py-3 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-400 font-medium rounded-xl transition-all flex items-center justify-center space-x-2"
                        >
                          <BarChart3 size={18} />
                          <span>View Analytics</span>
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={handleDownloadBar}
                        className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-lg rounded-xl transition-all shadow-lg flex items-center justify-center space-x-2"
                      >
                        <Download size={20} />
                        <span>Download .BAR File</span>
                      </button>
                    )}

                    <button
                      onClick={handleReset}
                      className="w-full py-3 text-zinc-500 hover:text-white transition-colors"
                    >
                      Create Another Container
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* SEO Content Section - Only show when not in sealed state */}
            {!barResult && !showDecrypt && (
              <div className="mt-20 opacity-60 hover:opacity-100 transition-opacity duration-500">
                <SEOContent />
              </div>
            )}
          </div>
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
