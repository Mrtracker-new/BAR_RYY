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
} from "lucide-react";
import FileUpload from "./components/FileUpload";
import RulesPanel from "./components/RulesPanel";
import ContainerAnimation from "./components/ContainerAnimation";
import SharePage from "./components/SharePage";
import AnalyticsDashboard from "./components/AnalyticsDashboard";
import Toast from "./components/Toast";
import DecryptPage from "./components/DecryptPage";

// Wrapper component for share page route
const SharePageWrapper = () => {
  const { token } = useParams();
  return <SharePage token={token} />;
};

// Main app component
function MainApp() {
  const [uploadedFile, setUploadedFile] = useState(null);
  const [fileInfo, setFileInfo] = useState(null);
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
    } catch (err) {
      setError(
        "Failed to upload file: " + (err.response?.data?.detail || err.message)
      );
    }
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    setFileInfo(null);
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
        webhook_url: rules.webhookUrl || null,
        view_only: rules.viewOnly || false,
        storage_mode: rules.storageMode || "client",
        require_otp: rules.requireOtp || false,
        otp_email: rules.otpEmail || null,
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
    <div className="min-h-screen bg-dark-900 text-white">
      <ContainerAnimation isSealing={isSealing} />

      {/* Header */}
      <header className="border-b border-dark-700 bg-dark-800/50 backdrop-blur">
        <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center space-x-3 sm:space-x-4">
              <PackageOpen className="text-gold-500" size={32} />
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gold-500 text-shadow-gold">
                  BAR Web
                </h1>
                <p className="text-gray-400 text-xs sm:text-sm hidden sm:block">
                  Burn After Reading - Secure File Encryption
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowDecrypt(!showDecrypt)}
              className="px-4 sm:px-6 py-2 text-sm sm:text-base bg-gold-500/20 hover:bg-gold-500/30 text-gold-500 rounded-lg transition-all duration-300 border border-gold-500/30 hover:border-gold-500 whitespace-nowrap"
            >
              {showDecrypt ? "📦 Create" : "🔓 Decrypt"}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-12">
        {showDecrypt ? (
          <DecryptPage onBack={() => setShowDecrypt(false)} />
        ) : (
          <>
            {error && (
              <div className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded-lg flex items-center space-x-3">
                <AlertCircle className="text-red-500" size={24} />
                <p className="text-red-300">{error}</p>
              </div>
            )}

            {!barResult ? (
              <div className="grid lg:grid-cols-2 gap-6 sm:gap-8">
                {/* Left Column - File Upload */}
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-gold-500 text-shadow-gold mb-4">
                      Upload File
                    </h2>
                    <FileUpload
                      onFileSelect={handleFileSelect}
                      uploadedFile={uploadedFile}
                      onRemove={handleRemoveFile}
                    />
                  </div>

                  {uploadedFile && (
                    <div className="border border-dark-700 rounded-lg p-4 sm:p-6 bg-dark-800">
                      <h3 className="text-base sm:text-lg font-semibold text-gold-500 mb-4">
                        Container Preview
                      </h3>
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

                {/* Right Column - Rules Panel */}
                <div className="border border-dark-700 rounded-lg p-4 sm:p-6 bg-dark-800">
                  <RulesPanel rules={rules} onRulesChange={setRules} />

                  <button
                    onClick={handleSealContainer}
                    disabled={!uploadedFile || isSealing}
                    className={`w-full mt-6 sm:mt-8 py-3 sm:py-4 rounded-lg font-bold text-base sm:text-lg transition-all duration-300 ${
                      uploadedFile && !isSealing
                        ? "bg-gold-500 hover:bg-gold-600 text-black hover:scale-105 animate-glow"
                        : "bg-dark-600 text-gray-500 cursor-not-allowed"
                    }`}
                  >
                    {isSealing ? "Sealing..." : "🔒 Seal & Generate .BAR"}
                  </button>
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
      <Route path="/" element={<MainApp />} />
      <Route path="/share/:token" element={<SharePageWrapper />} />
    </Routes>
  );
}

export default App;
