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
  FileCheck,
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

/*──────────────────────────────────────────────
  Constants
──────────────────────────────────────────────*/
const EASE = [0.16, 1, 0.3, 1];

/*──────────────────────────────────────────────
  Design tokens (single source of truth)
──────────────────────────────────────────────*/
const T = {
  gold: "#E8A020",
  goldM: "#C8893A",
  green: "#22C55E",
  bg: "#070707",
  s0: "#0d0d0d",
  s1: "#111111",
  s2: "#161616",
  border: "rgba(255,255,255,0.06)",
  borderH: "rgba(255,255,255,0.11)",
  text: "#efefef",
  textS: "#888888",
  textT: "#404040",
  textD: "#292929",
  mono: "'JetBrains Mono', monospace",
};

const shadow = "0 2px 8px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.5)";

/*──────────────────────────────────────────────
  Route wrapper
──────────────────────────────────────────────*/
const SharePageWrapper = () => {
  const { token } = useParams();
  return <SharePage token={token} />;
};

/*──────────────────────────────────────────────
  Navbar
──────────────────────────────────────────────*/
function AppNav({ showDecrypt, onToggleDecrypt }) {
  return (
    <nav
      style={{
        position: "fixed",
        top: 0, left: 0, right: 0,
        zIndex: 100,
        height: 52,
        display: "flex",
        alignItems: "center",
        background: "rgba(7,7,7,0.92)",
        backdropFilter: "blur(20px) saturate(160%)",
        WebkitBackdropFilter: "blur(20px) saturate(160%)",
        borderBottom: `1px solid ${T.border}`,
      }}
    >
      <div
        style={{
          maxWidth: 1100, margin: "0 auto", padding: "0 1.5rem",
          width: "100%", display: "flex", alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Logo */}
        <a
          href="/"
          style={{
            display: "flex", alignItems: "center", gap: "0.5rem",
            textDecoration: "none",
          }}
        >
          <div
            style={{
              width: 26, height: 26,
              borderRadius: "0.4rem",
              background: `rgba(232,160,32,0.1)`,
              border: `1px solid rgba(232,160,32,0.20)`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <PackageOpen size={12} style={{ color: T.gold }} />
          </div>
          <span style={{ fontSize: "0.9rem", fontWeight: 600, letterSpacing: "-0.025em", color: "#d0d0d0" }}>
            BAR<span style={{ color: "#303030", fontWeight: 400 }}>.web</span>
          </span>
        </a>

        {/* Nav button */}
        <button
          onClick={onToggleDecrypt}
          style={{
            display: "inline-flex", alignItems: "center", gap: "0.375rem",
            padding: "0.3125rem 0.75rem",
            fontSize: "0.8125rem", fontWeight: 500,
            color: showDecrypt ? T.gold : T.textS,
            background: showDecrypt ? "rgba(232,160,32,0.08)" : "transparent",
            border: `1px solid ${showDecrypt ? "rgba(232,160,32,0.20)" : T.border}`,
            borderRadius: "var(--r-full)",
            cursor: "pointer",
            transition: "all 0.2s ease",
            letterSpacing: "-0.01em",
          }}
        >
          {showDecrypt ? (
            <><ArrowLeft size={11} /> Create</>
          ) : (
            <><Lock size={11} /> Decrypt</>
          )}
        </button>
      </div>
    </nav>
  );
}

/*──────────────────────────────────────────────
  Card: unified surface component
──────────────────────────────────────────────*/
function Card({ children, accentColor, style = {} }) {
  return (
    <div
      style={{
        borderRadius: "1rem",
        border: `1px solid ${T.border}`,
        background: T.s0,
        overflow: "hidden",
        boxShadow: shadow,
        ...style,
      }}
    >
      {accentColor && (
        <div style={{
          height: "1px",
          background: `linear-gradient(90deg, ${accentColor}55 0%, ${accentColor}18 55%, transparent 100%)`,
        }} />
      )}
      {children}
    </div>
  );
}

/*──────────────────────────────────────────────
  Card header
──────────────────────────────────────────────*/
function CardHeader({ icon: Icon, label, color = T.gold, children }) {
  return (
    <div
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0.875rem 1.25rem",
        borderBottom: `1px solid ${T.border}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <div
          style={{
            width: 26, height: 26, borderRadius: "0.375rem",
            background: `${color}14`,
            border: `1px solid ${color}20`,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon size={12} style={{ color }} />
        </div>
        <span
          style={{
            fontSize: "0.8125rem", fontWeight: 600,
            color: "#c0c0c0", letterSpacing: "-0.02em",
          }}
        >
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

/*──────────────────────────────────────────────
  Container preview card
──────────────────────────────────────────────*/
function ContainerPreview({ uploadedFile, rules }) {
  const rows = [
    { label: "File", value: uploadedFile?.name, truncate: true },
    { label: "Storage", value: rules.storageMode === "server" ? "Server-Side" : "Client-Side" },
    { label: "Expiry", value: rules.expiryMinutes > 0 ? `${rules.expiryValue} ${rules.expiryUnit}` : "None" },
    { label: "Password", value: rules.password ? "Set ✓" : "None" },
    ...(rules.storageMode === "server" ? [{ label: "Max Views", value: String(rules.maxViews) }] : []),
  ];

  return (
    <Card accentColor={T.green}>
      <CardHeader icon={FileCheck} label="Container Preview" color={T.green}>
        <span
          style={{
            display: "inline-flex", alignItems: "center", gap: "0.3rem",
            fontSize: "0.6875rem", fontWeight: 600, color: T.green,
            background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.18)",
            borderRadius: "var(--r-full)", padding: "0.15rem 0.5rem",
          }}
        >
          <span
            style={{
              width: 5, height: 5, borderRadius: "50%", background: T.green,
              animation: "bar-pulse 2s ease-in-out infinite",
            }}
          />
          Ready
        </span>
      </CardHeader>
      <div>
        {rows.map(({ label, value, truncate }, i) => (
          <div
            key={label}
            style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "0.5625rem 1.25rem",
              background: i % 2 === 1 ? "rgba(255,255,255,0.015)" : "transparent",
              borderBottom: i < rows.length - 1 ? `1px solid rgba(255,255,255,0.035)` : "none",
            }}
          >
            <span style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: T.textT }}>
              {label}
            </span>
            <span
              style={{
                fontSize: "0.8125rem", color: T.textS, fontFamily: T.mono,
                ...(truncate ? {
                  whiteSpace: "nowrap", overflow: "hidden",
                  textOverflow: "ellipsis", maxWidth: "58%",
                } : {}),
              }}
            >
              {value}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/*──────────────────────────────────────────────
  Seal button
──────────────────────────────────────────────*/
function SealButton({ onClick, disabled, isSealing }) {
  return (
    <div style={{ padding: "1rem 1.25rem", borderTop: `1px solid ${T.border}` }}>
      <button
        onClick={onClick}
        disabled={disabled}
        className="btn-primary"
        style={{
          width: "100%",
          padding: "0.875rem 1.25rem",
          fontSize: "0.9375rem",
          fontWeight: 700,
          borderRadius: "0.625rem",
          justifyContent: "center",
          letterSpacing: "-0.015em",
          opacity: disabled ? 0.3 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
          transition: "opacity 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease",
        }}
      >
        {isSealing ? (
          <>
            <Loader size={14} style={{ animation: "bar-spin 0.8s linear infinite" }} />
            Sealing container…
          </>
        ) : (
          <>
            <Lock size={13} />
            Seal & Generate .BAR
          </>
        )}
      </button>
      {!isSealing && (
        <p
          style={{
            marginTop: "0.5rem", textAlign: "center",
            fontSize: "0.6875rem", color: T.textD, letterSpacing: "0.02em",
          }}
        >
          {disabled ? "Upload a file to continue" : "End-to-end encrypted · Zero-knowledge"}
        </p>
      )}
    </div>
  );
}

/*──────────────────────────────────────────────
  Result card (success state)
──────────────────────────────────────────────*/
function ResultCard({ barResult, onDownload, onAnalytics, onReset, showToast }) {
  const isServer = barResult.storage_mode === "server";
  const shareUrl = `${window.location.origin}/share/${barResult.access_token}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      style={{ maxWidth: 480, margin: "3rem auto 0" }}
    >
      <Card accentColor={T.green}>
        {/* Success header */}
        <div style={{ padding: "2rem 1.5rem 1.5rem", textAlign: "center" }}>
          {/* Pulse ring icon */}
          <div style={{ position: "relative", width: 52, height: 52, margin: "0 auto 1.25rem" }}>
            <div
              style={{
                position: "absolute", inset: 0, borderRadius: "50%",
                border: "2px solid rgba(34,197,94,0.3)",
                animation: "pulse-ring 2.5s ease-out infinite",
              }}
            />
            <div
              style={{
                width: 52, height: 52, borderRadius: "50%",
                background: "rgba(34,197,94,0.08)",
                border: "1px solid rgba(34,197,94,0.18)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <CheckCircle2 size={20} style={{ color: T.green }} />
            </div>
          </div>
          <h2
            style={{
              fontSize: "1.125rem", fontWeight: 700,
              letterSpacing: "-0.03em", color: T.text, marginBottom: "0.375rem",
            }}
          >
            Container sealed
          </h2>
          <p style={{ fontSize: "0.8125rem", color: T.textS, lineHeight: 1.6 }}>
            {isServer
              ? "Your file is secured on the server. Share the link below."
              : "Download your .BAR file and share it with the recipient."}
          </p>
        </div>

        {/* Metadata row */}
        <div
          style={{
            padding: "0.875rem 1.5rem",
            borderTop: `1px solid rgba(255,255,255,0.04)`,
            borderBottom: `1px solid rgba(255,255,255,0.04)`,
            display: "flex", gap: "2rem",
            background: "rgba(255,255,255,0.015)",
          }}
        >
          <div>
            <p style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: T.textT, marginBottom: 4 }}>Mode</p>
            <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: isServer ? T.green : T.gold }}>
              {isServer ? "Server-Side" : "Client-Side"}
            </p>
          </div>
          <div>
            <p style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: T.textT, marginBottom: 4 }}>Created</p>
            <p style={{ fontSize: "0.8125rem", color: T.textS, fontFamily: T.mono }}>
              {new Date(barResult.metadata.created_at).toLocaleString()}
            </p>
          </div>
          {isServer && (
            <div>
              <p style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: T.textT, marginBottom: 4 }}>Max Views</p>
              <p style={{ fontSize: "0.8125rem", color: T.textS, fontFamily: T.mono }}>{barResult.metadata.max_views}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          {isServer ? (
            <>
              {/* Share link */}
              <div
                style={{
                  borderRadius: "0.625rem",
                  border: `1px solid ${T.border}`,
                  background: T.s2,
                  overflow: "hidden",
                }}
              >
                <p
                  style={{
                    fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.08em",
                    textTransform: "uppercase", color: T.textT,
                    padding: "0.5625rem 0.875rem 0.25rem",
                  }}
                >
                  Shareable Link
                </p>
                <div style={{ display: "flex", alignItems: "center", padding: "0 0.875rem 0.625rem", gap: "0.5rem" }}>
                  <input
                    readOnly
                    value={shareUrl}
                    style={{
                      flex: 1, background: "transparent", border: "none", outline: "none",
                      fontSize: "0.8125rem", color: T.textS, fontFamily: T.mono, minWidth: 0,
                    }}
                  />
                  <button
                    onClick={() => { navigator.clipboard.writeText(shareUrl); showToast("Link copied!", "success"); }}
                    style={{
                      flexShrink: 0, width: 28, height: 28,
                      borderRadius: "0.375rem",
                      background: "rgba(232,160,32,0.08)",
                      border: "1px solid rgba(232,160,32,0.16)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", color: T.gold,
                      transition: "background 0.2s ease",
                    }}
                  >
                    <Copy size={11} />
                  </button>
                </div>
              </div>

              {/* QR — section */}
              {barResult.qr_code && (
                <div
                  style={{
                    borderRadius: "0.625rem",
                    border: `1px solid rgba(255,255,255,0.06)`,
                    background: "rgba(255,255,255,0.025)",
                    overflow: "hidden",
                  }}
                >
                  {/* Section label row */}
                  <div
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "0.5625rem 0.875rem 0.375rem",
                    }}
                  >
                    <p style={{ fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: T.textT, margin: 0 }}>
                      Scan to open
                    </p>
                    <span style={{ fontSize: "0.625rem", color: T.textD, letterSpacing: "0.04em" }}>Point camera at code</span>
                  </div>

                  {/* QR viewport */}
                  <div style={{ padding: "0 0.875rem 0.875rem", display: "flex", justifyContent: "center" }}>
                    <div style={{ position: "relative", display: "inline-flex" }}>
                      {/* Corner finder marks */}
                      {[
                        { top: 0, left: 0, borderWidth: "2px 0 0 2px" },
                        { top: 0, right: 0, borderWidth: "2px 2px 0 0" },
                        { bottom: 0, left: 0, borderWidth: "0 0 2px 2px" },
                        { bottom: 0, right: 0, borderWidth: "0 2px 2px 0" },
                      ].map((pos, i) => (
                        <div
                          key={i}
                          style={{
                            position: "absolute",
                            width: 14, height: 14,
                            borderStyle: "solid",
                            borderColor: T.gold,
                            borderRadius: i === 0 ? "3px 0 0 0" : i === 1 ? "0 3px 0 0" : i === 2 ? "0 0 0 3px" : "0 0 3px 0",
                            zIndex: 2,
                            ...pos,
                          }}
                        />
                      ))}
                      {/* White canvas — tight padding, sized to code */}
                      <div
                        style={{
                          padding: "0.625rem",
                          background: "#ffffff",
                          borderRadius: "0.375rem",
                          lineHeight: 0,
                        }}
                      >
                        <img
                          src={barResult.qr_code}
                          alt="QR Code — scan to open the share link"
                          style={{
                            width: 160,
                            height: 160,
                            display: "block",
                            imageRendering: "pixelated",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Analytics */}
              <button
                onClick={onAnalytics}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                  padding: "0.6875rem", borderRadius: "0.625rem",
                  border: `1px solid ${T.border}`,
                  background: "rgba(255,255,255,0.03)",
                  color: T.textS, fontSize: "0.8125rem", fontWeight: 500,
                  cursor: "pointer", transition: "all 0.2s ease",
                }}
                onMouseOver={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = T.text; }}
                onMouseOut={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.color = T.textS; }}
              >
                <BarChart3 size={13} />
                View Analytics
              </button>
            </>
          ) : (
            <button onClick={onDownload} className="btn-primary" style={{ padding: "0.8125rem", justifyContent: "center" }}>
              <Download size={13} />
              Download .BAR File
            </button>
          )}

          <button
            onClick={onReset}
            className="btn-ghost"
            style={{ padding: "0.625rem", fontSize: "0.8125rem" }}
          >
            <ArrowLeft size={12} />
            Seal another file
          </button>
        </div>
      </Card>
    </motion.div>
  );
}

/*──────────────────────────────────────────────
  Main App
──────────────────────────────────────────────*/
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
      let msg = "Failed to upload file";
      if (err.response?.data?.detail) {
        const d = err.response.data.detail;
        msg = Array.isArray(d) ? d.map(e => e.msg).join("; ") : d;
      } else if (err.message) msg += ": " + err.message;
      setError(msg);
    }
  };

  const handleRemoveFile = () => {
    setUploadedFile(null); setFileInfo(null); setFilePreview(null); setBarResult(null); setError(null);
  };

  const handleSealContainer = async () => {
    if (!fileInfo) { setError("No file uploaded"); return; }
    setIsSealing(true); setError(null);
    try {
      await new Promise(r => setTimeout(r, 1800));
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
      setUploadedFile(null); setFileInfo(null);
    } catch (err) {
      let msg = "Failed to seal container";
      if (err.response?.data?.detail) {
        const d = err.response.data.detail;
        msg = Array.isArray(d) ? d.map(e => e.msg).join("; ") : d;
      } else if (err.message) msg += ": " + err.message;
      setError(msg);
    } finally { setIsSealing(false); }
  };

  const handleDownloadBar = () => {
    if (barResult?.bar_data) {
      const binaryString = atob(barResult.bar_data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = barResult.bar_filename;
      document.body.appendChild(link); link.click();
      document.body.removeChild(link); URL.revokeObjectURL(url);
    }
  };

  const handleReset = () => {
    setBarResult(null); setUploadedFile(null); setFileInfo(null); setError(null);
    setRules({
      storageMode: "client", maxViews: 1, expiryMinutes: 0,
      expiryValue: 0, expiryUnit: "minutes", password: "", webhookUrl: "",
      viewOnly: false, requireOtp: false, otpEmail: "", viewRefreshMinutes: 0, autoRefreshSeconds: 0,
    });
  };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, overflowX: "hidden", position: "relative" }}>
      <SEO />
      <ContainerAnimation isSealing={isSealing} />

      {/* Fixed ambient background */}
      <div aria-hidden="true" style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div className="bg-grid" style={{ position: "absolute", inset: 0, opacity: 0.3 }} />
        <div
          style={{
            position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
            width: "55vw", height: "24vh",
            background: "radial-gradient(ellipse at top, rgba(232,160,32,0.05) 0%, transparent 70%)",
          }}
        />
      </div>

      <AppNav showDecrypt={showDecrypt} onToggleDecrypt={() => setShowDecrypt(v => !v)} />
      <ErrorModal error={error} onClose={() => setError(null)} />

      <main style={{ position: "relative", zIndex: 1, paddingTop: "52px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 1.5rem" }}>
          {showDecrypt ? (
            <div style={{ paddingTop: "2.5rem" }}>
              <DecryptPage onBack={() => setShowDecrypt(false)} />
            </div>
          ) : barResult ? (
            <ResultCard
              barResult={barResult}
              onDownload={handleDownloadBar}
              onAnalytics={() => setShowAnalytics(true)}
              onReset={handleReset}
              showToast={showToast}
            />
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: EASE }}
            >
              {/* ── Page header ── */}
              <div style={{ padding: "2.25rem 0 1.75rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                  <span
                    style={{
                      fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.08em",
                      textTransform: "uppercase", color: T.gold,
                      background: "rgba(232,160,32,0.08)", border: "1px solid rgba(232,160,32,0.16)",
                      borderRadius: "999px", padding: "0.1875rem 0.625rem",
                    }}
                  >
                    Encrypt & Seal
                  </span>
                </div>
                <h1
                  style={{
                    fontSize: "clamp(1.5rem, 2.5vw, 1.875rem)",
                    fontWeight: 700, letterSpacing: "-0.04em",
                    color: T.text, lineHeight: 1.15, marginBottom: "0.5rem",
                  }}
                >
                  Create a sealed container
                </h1>
                <p style={{ fontSize: "0.875rem", color: T.textS, letterSpacing: "-0.01em", lineHeight: 1.6, maxWidth: "38ch" }}>
                  Upload any file, configure security rules, generate an encrypted .BAR container.
                </p>
                {/* Hairline accent */}
                <div
                  style={{
                    height: "1px", marginTop: "1.5rem",
                    background: "linear-gradient(90deg, rgba(232,160,32,0.18) 0%, transparent 60%)",
                  }}
                />
              </div>

              {/* ── Two-column app grid ── */}
              <div className="app-grid">

                {/* LEFT: upload + preview */}
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

                  {/* Upload card */}
                  <Card accentColor={T.gold}>
                    <CardHeader icon={Upload} label="File Upload" color={T.gold}>
                      <span
                        style={{
                          fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.04em",
                          textTransform: "uppercase", color: T.textT,
                        }}
                      >
                        Any type
                      </span>
                    </CardHeader>
                    <div style={{ padding: "1.125rem" }}>
                      <FileUpload
                        onFileSelect={handleFileSelect}
                        uploadedFile={uploadedFile}
                        onRemove={handleRemoveFile}
                        filePreview={filePreview}
                      />
                    </div>
                  </Card>

                  {/* Container preview — animated */}
                  <AnimatePresence>
                    {uploadedFile && (
                      <motion.div
                        key="preview"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.3, ease: EASE }}
                      >
                        <ContainerPreview uploadedFile={uploadedFile} rules={rules} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* RIGHT: security config + seal */}
                <div
                  className="app-grid-sidebar"
                  style={{
                    borderRadius: "1rem",
                    border: `1px solid ${T.border}`,
                    background: T.s0,
                    overflow: "hidden",
                    boxShadow: shadow,
                  }}
                >
                  <div
                    style={{
                      height: "1px",
                      background: `linear-gradient(90deg, rgba(232,160,32,0.45) 0%, rgba(232,160,32,0.14) 55%, transparent 100%)`,
                    }}
                  />
                  <CardHeader icon={Shield} label="Security Configuration" color={T.gold} />
                  <div style={{ padding: "1.125rem" }}>
                    <RulesPanel rules={rules} onRulesChange={setRules} />
                  </div>
                  <SealButton
                    onClick={handleSealContainer}
                    disabled={isSealing || !uploadedFile}
                    isSealing={isSealing}
                  />
                </div>
              </div>

              {/* SEO section */}
              <div style={{ marginTop: "5rem", opacity: 0.35 }}>
                <SEOContent />
              </div>
            </motion.div>
          )}
        </div>
      </main>

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Analytics modal */}
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
          borderTop: `1px solid rgba(255,255,255,0.04)`,
          position: "relative", zIndex: 1, marginTop: "4rem",
        }}
      >
        <div
          style={{
            maxWidth: 1100, margin: "0 auto", padding: "1.125rem 1.5rem",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexWrap: "wrap", gap: "0.5rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
            <PackageOpen size={11} style={{ color: T.textD }} />
            <span style={{ fontSize: "0.75rem", color: T.textD, letterSpacing: "-0.01em" }}>
              BAR Web — Encrypted file containers with self-destruct
            </span>
          </div>
          <span style={{ fontSize: "0.6875rem", color: T.textD }}>© 2025</span>
        </div>
      </footer>
    </div>
  );
}

/*──────────────────────────────────────────────
  App root with routing
──────────────────────────────────────────────*/
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
