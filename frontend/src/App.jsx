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
  CheckCircle2,
  ArrowLeft,
  Github,
  ExternalLink,
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
import ErrorModal from "./components/ErrorModal";

/* ─────────────────────────────────────────────
   Constants
───────────────────────────────────────────── */
const EASE = [0.16, 1, 0.3, 1];

/* ─────────────────────────────────────────────
   Route wrapper
───────────────────────────────────────────── */
const SharePageWrapper = () => {
  const { token } = useParams();
  return <SharePage token={token} />;
};

/* ─────────────────────────────────────────────
   Shared Navbar
───────────────────────────────────────────── */
function AppNav({ showDecrypt, onToggleDecrypt }) {
  return (
    <nav className="navbar">
      <div
        className="container-app"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          margin: "0 auto",
        }}
      >
        {/* Logo */}
        <a
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.625rem",
            textDecoration: "none",
            color: "inherit",
          }}
          className="group"
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "0.5rem",
              background: "rgba(232,160,32,0.1)",
              border: "1px solid rgba(232,160,32,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.25s ease",
            }}
            className="group-hover:bg-amber-500/20"
          >
            <PackageOpen size={16} style={{ color: "#E8A020" }} />
          </div>
          <span
            style={{
              fontSize: "0.9375rem",
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: "#d0d0d0",
            }}
          >
            BAR Web
          </span>
        </a>

        {/* Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <button
            onClick={onToggleDecrypt}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
              padding: "0.375rem 0.875rem",
              fontSize: "0.8125rem",
              fontWeight: 500,
              color: showDecrypt ? "#E8A020" : "#888888",
              background: showDecrypt ? "rgba(232,160,32,0.08)" : "transparent",
              border: `1px solid ${showDecrypt ? "rgba(232,160,32,0.25)" : "rgba(255,255,255,0.07)"}`,
              borderRadius: "0.5rem",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            className="hover:text-white hover:bg-white/5 hover:border-white/10"
          >
            {showDecrypt ? (
              <>
                <ArrowLeft size={13} />
                Create
              </>
            ) : (
              <>
                <Lock size={13} />
                Decrypt
              </>
            )}
          </button>
        </div>
      </div>
    </nav>
  );
}

/* ─────────────────────────────────────────────
   Section label
───────────────────────────────────────────── */
function SectionLabel({ icon: Icon, label, color = "#E8A020" }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        marginBottom: "1rem",
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "0.375rem",
          background: `${color}14`,
          border: `1px solid ${color}22`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={13} style={{ color }} />
      </div>
      <span
        style={{
          fontSize: "0.8125rem",
          fontWeight: 600,
          color: "#888888",
          letterSpacing: "-0.01em",
        }}
      >
        {label}
      </span>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Preview / container info card
───────────────────────────────────────────── */
function ContainerPreview({ uploadedFile, rules }) {
  const rows = [
    {
      label: "Status",
      value: <span style={{ color: "#22C55E", fontWeight: 600, fontSize: "0.8125rem" }}>Ready to seal</span>,
    },
    { label: "File", value: uploadedFile?.name, truncate: true },
    {
      label: "Storage",
      value: rules.storageMode === "server" ? "Server-Side" : "Client-Side",
    },
    {
      label: "Expiry",
      value:
        rules.expiryMinutes > 0
          ? `${rules.expiryValue} ${rules.expiryUnit}`
          : "Never",
    },
    {
      label: "Password",
      value: rules.password ? "Protected ✓" : "None",
    },
    ...(rules.storageMode === "server"
      ? [
          {
            label: "Max Views",
            value: rules.maxViews,
          },
        ]
      : []),
  ];

  return (
    <div
      style={{
        borderRadius: "0.875rem",
        border: "1px solid rgba(255,255,255,0.07)",
        background: "#0f0f0f",
        overflow: "hidden",
        marginTop: "1rem",
      }}
    >
      <div
        style={{
          padding: "0.875rem 1rem",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "#22C55E",
            boxShadow: "0 0 6px #22C55E",
            animation: "pulse 2s infinite",
          }}
        />
        <span
          style={{
            fontSize: "0.75rem",
            fontWeight: 600,
            color: "#666666",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Container Preview
        </span>
      </div>
      <div style={{ padding: "0.625rem 0" }}>
        {rows.map(({ label, value, truncate }) => (
          <div
            key={label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "0.4375rem 1rem",
              gap: "0.5rem",
            }}
          >
            <span style={{ fontSize: "0.75rem", color: "#444444", flexShrink: 0 }}>
              {label}
            </span>
            <span
              style={{
                fontSize: "0.8125rem",
                color: "#aaaaaa",
                fontFamily: "'JetBrains Mono', monospace",
                ...(truncate
                  ? {
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: "60%",
                    }
                  : {}),
              }}
            >
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Seal button
───────────────────────────────────────────── */
function SealButton({ onClick, disabled, isSealing }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="btn-primary"
      style={{
        width: "100%",
        padding: "0.875rem",
        fontSize: "0.9375rem",
        borderRadius: "0.75rem",
        justifyContent: "center",
        marginTop: "1.25rem",
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        transform: "none",
      }}
    >
      {isSealing ? (
        <>
          <Loader size={16} style={{ animation: "spin 1s linear infinite" }} />
          Sealing container…
        </>
      ) : (
        <>
          <Lock size={16} />
          Seal &amp; Generate .BAR
        </>
      )}
    </button>
  );
}

/* ─────────────────────────────────────────────
   Success / result card
───────────────────────────────────────────── */
function ResultCard({ barResult, onDownload, onAnalytics, onReset, showToast }) {
  const isServer = barResult.storage_mode === "server";
  const shareUrl = `${window.location.origin}/share/${barResult.access_token}`;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: EASE }}
      style={{
        maxWidth: 520,
        margin: "0 auto",
        borderRadius: "1rem",
        border: "1px solid rgba(34,197,94,0.15)",
        background: "#0f0f0f",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "1.75rem 1.5rem 1.25rem",
          textAlign: "center",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: "rgba(34,197,94,0.1)",
            border: "1px solid rgba(34,197,94,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 1rem",
          }}
        >
          <CheckCircle2 size={22} style={{ color: "#22C55E" }} />
        </div>
        <h2
          style={{
            fontSize: "1.125rem",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "#e0e0e0",
            marginBottom: "0.25rem",
          }}
        >
          Container sealed
        </h2>
        <p style={{ fontSize: "0.8125rem", color: "#555555" }}>
          {isServer
            ? "Your file is secured on the server. Share the link below."
            : "Download your .BAR file and send it to the recipient."}
        </p>
      </div>

      {/* Metadata */}
      <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem 1.5rem" }}>
          <div>
            <p style={{ fontSize: "0.6875rem", color: "#444444", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
              Mode
            </p>
            <p style={{ fontSize: "0.8125rem", color: isServer ? "#22C55E" : "#E8A020", fontWeight: 600 }}>
              {isServer ? "Server-Side" : "Client-Side"}
            </p>
          </div>
          <div>
            <p style={{ fontSize: "0.6875rem", color: "#444444", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
              Created
            </p>
            <p style={{ fontSize: "0.8125rem", color: "#888888", fontFamily: "'JetBrains Mono', monospace" }}>
              {new Date(barResult.metadata.created_at).toLocaleString()}
            </p>
          </div>
          {isServer && (
            <div>
              <p style={{ fontSize: "0.6875rem", color: "#444444", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
                Max Views
              </p>
              <p style={{ fontSize: "0.8125rem", color: "#aaaaaa", fontFamily: "'JetBrains Mono', monospace" }}>
                {barResult.metadata.max_views}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ padding: "1.125rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.625rem" }}>
        {isServer ? (
          <>
            {/* Share link */}
            <div
              style={{
                borderRadius: "0.625rem",
                border: "1px solid rgba(255,255,255,0.07)",
                background: "#0c0c0c",
                overflow: "hidden",
              }}
            >
              <p
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "#444444",
                  padding: "0.625rem 0.875rem 0.375rem",
                }}
              >
                Shareable Link
              </p>
              <div style={{ display: "flex", alignItems: "center", padding: "0 0.875rem 0.625rem", gap: "0.5rem" }}>
                <input
                  readOnly
                  value={shareUrl}
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    fontSize: "0.8125rem",
                    color: "#888888",
                    fontFamily: "'JetBrains Mono', monospace",
                    minWidth: 0,
                  }}
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(shareUrl);
                    showToast("Link copied!", "success");
                  }}
                  style={{
                    flexShrink: 0,
                    width: 30,
                    height: 30,
                    borderRadius: "0.375rem",
                    background: "rgba(232,160,32,0.1)",
                    border: "1px solid rgba(232,160,32,0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    color: "#E8A020",
                    transition: "background 0.2s ease",
                  }}
                  className="hover:bg-amber-500/20"
                >
                  <Copy size={13} />
                </button>
              </div>
            </div>

            {/* QR Code */}
            {barResult.qr_code && (
              <div style={{ display: "flex", justifyContent: "center", paddingTop: "0.25rem" }}>
                <img
                  src={barResult.qr_code}
                  alt="QR Code"
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: "0.5rem",
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "#fff",
                  }}
                />
              </div>
            )}

            {/* Analytics */}
            <button
              onClick={onAnalytics}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                padding: "0.6875rem",
                borderRadius: "0.625rem",
                border: "1px solid rgba(139,92,246,0.2)",
                background: "rgba(139,92,246,0.06)",
                color: "#A78BFA",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: "pointer",
                transition: "background 0.2s ease",
              }}
              className="hover:bg-violet-500/10"
            >
              <BarChart3 size={15} />
              View Analytics
            </button>
          </>
        ) : (
          <button onClick={onDownload} className="btn-primary" style={{ padding: "0.8125rem", justifyContent: "center" }}>
            <Download size={16} />
            Download .BAR File
          </button>
        )}

        {/* Reset */}
        <button
          onClick={onReset}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#444444",
            fontSize: "0.8125rem",
            fontWeight: 500,
            padding: "0.5rem",
            transition: "color 0.2s ease",
            textAlign: "center",
          }}
          className="hover:text-zinc-300"
        >
          Seal another file
        </button>
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
   Main App
───────────────────────────────────────────── */
function MainApp() {
  const [uploadedFile, setUploadedFile] = useState(null);
  const [fileInfo, setFileInfo] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [rules, setRules] = useState({
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
    viewRefreshMinutes: 0,
    autoRefreshSeconds: 0,
  });
  const [barResult, setBarResult] = useState(null);
  const [isSealing, setIsSealing] = useState(false);
  const [toast, setToast] = useState(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showDecrypt, setShowDecrypt] = useState(false);
  const [error, setError] = useState(null);

  const showToast = (message, type = "success") => setToast({ message, type });

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
      let errorMessage = "Failed to upload file";
      if (err.response?.data?.detail) {
        const detail = err.response.data.detail;
        errorMessage = Array.isArray(detail)
          ? detail.map((e) => e.msg).join("; ")
          : detail;
      } else if (err.message) {
        errorMessage += ": " + err.message;
      }
      setError(errorMessage);
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
    if (!fileInfo) { setError("No file uploaded"); return; }
    setIsSealing(true);
    setError(null);
    try {
      await new Promise((r) => setTimeout(r, 1800));
      const sealData = {
        temp_filename: fileInfo.temp_filename,
        max_views: rules.maxViews,
        expiry_minutes: rules.expiryMinutes,
        password: rules.password || null,
        webhook_url: (rules.webhookUrl && rules.webhookUrl.trim()) || null,
        view_only: rules.viewOnly || false,
        storage_mode: rules.storageMode || "client",
        require_otp: rules.requireOtp || false,
        otp_email: (rules.otpEmail && rules.otpEmail.trim()) || null,
        view_refresh_minutes: rules.viewRefreshMinutes || 0,
        auto_refresh_seconds: rules.autoRefreshSeconds || 0,
      };
      const response = await axios.post("/seal", sealData);
      setBarResult(response.data);
      setUploadedFile(null);
      setFileInfo(null);
    } catch (err) {
      let errorMessage = "Failed to seal container";
      if (err.response?.data?.detail) {
        const detail = err.response.data.detail;
        errorMessage = Array.isArray(detail)
          ? detail.map((e) => e.msg).join("; ")
          : detail;
      } else if (err.message) {
        errorMessage += ": " + err.message;
      }
      setError(errorMessage);
    } finally {
      setIsSealing(false);
    }
  };

  const handleDownloadBar = () => {
    if (barResult?.bar_data) {
      const binaryString = atob(barResult.bar_data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
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
      viewRefreshMinutes: 0,
      autoRefreshSeconds: 0,
    });
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#080808",
        color: "#f0f0f0",
        overflowX: "hidden",
        position: "relative",
      }}
    >
      <SEO />
      <ContainerAnimation isSealing={isSealing} />

      {/* Subtle ambient background */}
      <div
        aria-hidden="true"
        style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}
      >
        <div
          className="bg-grid"
          style={{ position: "absolute", inset: 0, opacity: 0.5 }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "80vw",
            height: "40vh",
            background:
              "radial-gradient(ellipse at top, rgba(232,160,32,0.04) 0%, transparent 60%)",
          }}
        />
      </div>

      {/* Navbar */}
      <AppNav
        showDecrypt={showDecrypt}
        onToggleDecrypt={() => setShowDecrypt((v) => !v)}
      />

      {/* Error modal */}
      <ErrorModal error={error} onClose={() => setError(null)} />

      {/* Main */}
      <main
        style={{
          position: "relative",
          zIndex: 1,
          paddingTop: "5rem",
          paddingBottom: "4rem",
        }}
      >
        <div className="container-app" style={{ margin: "0 auto" }}>
          {showDecrypt ? (
            <DecryptPage onBack={() => setShowDecrypt(false)} />
          ) : barResult ? (
            /* ── SUCCESS STATE ── */
            <div style={{ paddingTop: "2rem" }}>
              <ResultCard
                barResult={barResult}
                onDownload={handleDownloadBar}
                onAnalytics={() => setShowAnalytics(true)}
                onReset={handleReset}
                showToast={showToast}
              />
            </div>
          ) : (
            /* ── MAIN FORM ── */
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE }}
            >
              {/* Page title row */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                  marginBottom: "1.75rem",
                  paddingTop: "1rem",
                }}
              >
                <div>
                  <p
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#E8A020",
                      marginBottom: "0.25rem",
                    }}
                  >
                    Encrypt &amp; Seal
                  </p>
                  <h1
                    style={{
                      fontSize: "clamp(1.25rem, 3vw, 1.75rem)",
                      fontWeight: 700,
                      letterSpacing: "-0.03em",
                      color: "#d0d0d0",
                      lineHeight: 1.2,
                    }}
                  >
                    Create a sealed container
                  </h1>
                </div>
              </div>

              {/* Two-column layout */}
              <div
                style={{
                  display: "grid",
                  gap: "1rem",
                }}
                className="grid-cols-1 lg:grid-cols-[3fr_2fr]"
              >
                {/* ── Left column ── */}
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {/* Upload card */}
                  <div
                    style={{
                      borderRadius: "0.875rem",
                      border: "1px solid rgba(255,255,255,0.07)",
                      background: "#0f0f0f",
                      padding: "1.25rem",
                    }}
                  >
                    <SectionLabel icon={Upload} label="File Upload" />
                    <FileUpload
                      onFileSelect={handleFileSelect}
                      uploadedFile={uploadedFile}
                      onRemove={handleRemoveFile}
                      filePreview={filePreview}
                    />
                  </div>

                  {/* Container preview — shows when file is selected */}
                  <AnimatePresence>
                    {uploadedFile && (
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.4, ease: EASE }}
                      >
                        <ContainerPreview uploadedFile={uploadedFile} rules={rules} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* ── Right column ── */}
                <div
                  style={{
                    borderRadius: "0.875rem",
                    border: "1px solid rgba(255,255,255,0.07)",
                    background: "#0f0f0f",
                    padding: "1.25rem",
                    height: "fit-content",
                    position: "sticky",
                    top: "4.5rem",
                  }}
                >
                  <SectionLabel icon={Shield} label="Security Configuration" color="#8B5CF6" />
                  <RulesPanel rules={rules} onRulesChange={setRules} />

                  {/* Seal button */}
                  <SealButton
                    onClick={handleSealContainer}
                    disabled={isSealing || !uploadedFile}
                    isSealing={isSealing}
                  />
                </div>
              </div>

              {/* SEO content */}
              {!barResult && (
                <div style={{ marginTop: "4rem", opacity: 0.5 }}>
                  <SEOContent />
                </div>
              )}
            </motion.div>
          )}
        </div>
      </main>

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Analytics */}
      {showAnalytics && barResult?.access_token && barResult?.analytics_key && (
        <AnalyticsDashboard
          token={barResult.access_token}
          analyticsKey={barResult.analytics_key}
          onClose={() => setShowAnalytics(false)}
        />
      )}

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid rgba(255,255,255,0.04)",
          padding: "1.25rem",
          textAlign: "center",
          position: "relative",
          zIndex: 1,
        }}
      >
        <p
          style={{
            fontSize: "0.8125rem",
            color: "#2a2a2a",
          }}
        >
          BAR Web © 2025 — Secure file encryption with self-destruct
        </p>
      </footer>
    </div>
  );
}

/* ─────────────────────────────────────────────
   App with routing
───────────────────────────────────────────── */
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
