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
import BurnChatPage from "./components/BurnChatPage";
import BurnChatLandingPage from "./components/BurnChatLandingPage";
import DynamicQRCode from "./components/DynamicQRCode";

/* ─────────────────────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────────────────────── */
const EASE = [0.16, 1, 0.3, 1];

/* ─────────────────────────────────────────────────────────────
   DESIGN TOKENS
   Aligned with index.css :root custom properties.
   Any update here MUST also update index.css and vice-versa.
───────────────────────────────────────────────────────────── */
const T = {
  /* Brand accent — wax-seal gold on paper */
  gold:        "#B4791E",
  goldLight:   "#CE9530",
  goldMuted:   "#8F5E16",
  goldDim:     "rgba(180,121,30,0.12)",
  goldBorder:  "rgba(180,121,30,0.32)",
  goldGlow:    "rgba(180,121,30,0.20)",

  /* Semantic */
  green:       "#3F7D3A",
  greenDim:    "rgba(63,125,58,0.10)",
  greenBorder: "rgba(63,125,58,0.28)",

  /* Backgrounds — cream paper */
  bg:       "#EDE3CE",
  surface0: "#FAF4E6",
  surface1: "#FFFDF6",
  surface2: "#F1E8D3",

  /* Text — ink on cream (contrast vs #EDE3CE) */
  textPrimary:   "#2A2018",   /* ~13:1  AAA */
  textSecondary: "#55483A",   /*  ~7:1  AA  */
  textTertiary:  "#857358",   /* ~4.8:1 AA  */
  textDim:       "#A2916F",   /* decorative only */

  /* Borders — pencil/ink lines */
  border:       "rgba(60,45,20,0.16)",
  borderHover:  "rgba(60,45,20,0.30)",
  borderStrong: "rgba(60,45,20,0.24)",
  borderFocus:  "rgba(180,121,30,0.60)",

  /* Fonts */
  mono: "'JetBrains Mono', monospace",
  hand: "'Caveat', 'Patrick Hand', cursive",
  print: "'Patrick Hand', cursive",

  /* Navbar height — matches --navbar-height CSS token */
  navbarHeight: 56,
};

const shadow = "0 4px 12px rgba(60,45,20,0.14), 0 1px 3px rgba(60,45,20,0.10)";

/* ─────────────────────────────────────────────────────────────
   ROUTE WRAPPERS
───────────────────────────────────────────────────────────── */
const SharePageWrapper = () => {
  const { token } = useParams();
  return <SharePage token={token} />;
};

const BurnChatWrapper = () => {
  const { token } = useParams();
  return <BurnChatPage token={token} />;
};

/* ─────────────────────────────────────────────────────────────
   APP NAVBAR
   Fixed, full-width. Height: 56px (CSS token var(--navbar-height)).
   Left:  BAR.web logo
   Right: Decrypt / ← Create toggle pill
───────────────────────────────────────────────────────────── */
function AppNav({ showDecrypt, onToggleDecrypt }) {
  return (
    <>
      <style>{`
        .app-navbar {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          height: ${T.navbarHeight}px;
          display: flex; align-items: center;
          background:
            linear-gradient(180deg, rgba(250,244,230,0.94), rgba(244,236,216,0.90));
          backdrop-filter: blur(18px) saturate(150%);
          -webkit-backdrop-filter: blur(18px) saturate(150%);
          /* stitched notebook-binding underline */
          border-bottom: 1px solid ${T.borderStrong};
          box-shadow: 0 2px 0 rgba(180,121,30,0.18), 0 4px 10px rgba(60,45,20,0.10);
        }
        .app-navbar::after {
          content: ''; position: absolute; left: 0; right: 0; bottom: -1px; height: 2px;
          background: repeating-linear-gradient(90deg, ${T.goldMuted} 0 8px, transparent 8px 16px);
          opacity: 0.35; pointer-events: none;
        }
        .app-nav-toggle {
          display: inline-flex; align-items: center; gap: 0.375rem;
          /* 40px min-height — safe touch target for a secondary action */
          min-height: 40px;
          padding: 0.4375rem 1rem;
          font-family: inherit;
          font-size: 0.875rem; font-weight: 500; letter-spacing: -0.01em;
          border-radius: 999px; cursor: pointer;
          transition: color 0.18s ease, background 0.18s ease, border-color 0.18s ease;
          white-space: nowrap;
        }
        .app-nav-toggle.decrypt {
          color: ${T.gold};
          background: ${T.goldDim};
          border: 1px solid ${T.goldBorder};
        }
        .app-nav-toggle.create {
          color: ${T.textSecondary};
          background: transparent;
          border: 1px solid ${T.border};
        }
        .app-nav-toggle:hover {
          opacity: 0.85;
          transform: translateY(-1px);
        }
      `}</style>

      <nav className="app-navbar" role="navigation" aria-label="App navigation">
        <div
          style={{
            maxWidth: 1100, margin: "0 auto",
            padding: "0 clamp(1rem, 4vw, 1.5rem)",
            width: "100%", display: "flex", alignItems: "center",
            justifyContent: "space-between", gap: "0.75rem",
          }}
        >
          {/* ── Logo ── */}
          <a
            href="/"
            style={{ display: "flex", alignItems: "center", gap: "0.5rem", textDecoration: "none", flexShrink: 0 }}
            aria-label="BAR Web home"
          >
            <div
              style={{
                width: 30, height: 30, borderRadius: "0.45rem",
                background: T.goldDim, border: `1px solid ${T.goldBorder}`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <PackageOpen size={14} style={{ color: T.gold }} />
            </div>
            <span
              style={{
                fontFamily: T.hand,
                fontSize: "1.5rem",
                fontWeight: 700,
                letterSpacing: "0.01em",
                color: T.textPrimary,
                lineHeight: 1,
              }}
            >
              BAR<span style={{ color: T.gold, fontWeight: 400 }}>.web</span>
            </span>
          </a>

          {/* ── Toggle: Create ↔ Decrypt ── */}
          <div style={{ flexShrink: 0 }}>
            <button
              onClick={onToggleDecrypt}
              className={`app-nav-toggle ${showDecrypt ? "decrypt" : "create"}`}
              aria-label={showDecrypt ? "Switch to Create mode" : "Switch to Decrypt mode"}
            >
              {showDecrypt ? (
                <><ArrowLeft size={13} /> Create</>
              ) : (
                <><Lock size={13} /> Decrypt</>
              )}
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   CARD — unified surface component
   accentColor → renders a 1px gradient top-border
───────────────────────────────────────────────────────────── */
function Card({ children, accentColor, style = {} }) {
  return (
    <div
      style={{
        borderRadius: "10px 14px 12px 11px / 12px 11px 14px 10px",  /* hand-cut page */
        border: `1px solid ${T.border}`,
        background: T.surface0,
        overflow: "hidden",
        boxShadow: shadow,
        ...style,
      }}
    >
      {accentColor && (
        <div
          style={{
            height: "1px",
            background: `linear-gradient(90deg, ${accentColor}66 0%, ${accentColor}1A 55%, transparent 100%)`,
          }}
        />
      )}
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   CARD HEADER — icon + label row
───────────────────────────────────────────────────────────── */
function CardHeader({ icon: Icon, label, color = T.gold, children }) {
  return (
    <div
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0.9375rem 1.25rem",
        borderBottom: `1px solid ${T.border}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <div
          style={{
            width: 28, height: 28, borderRadius: "0.375rem",
            background: `${color}14`,
            border: `1px solid ${color}22`,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon size={14} style={{ color }} />
        </div>
        <span
          style={{
            fontFamily: T.print,
            fontSize: "1.05rem",
            fontWeight: 400,
            color: T.textPrimary,
            letterSpacing: "0.01em",
          }}
        >
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   CONTAINER PREVIEW CARD
   Shows file + rules summary as key/value rows.
───────────────────────────────────────────────────────────── */
function ContainerPreview({ uploadedFile, rules }) {
  const rows = [
    { label: "File",      value: uploadedFile?.name, truncate: true },
    { label: "Storage",   value: rules.storageMode === "server" ? "Server-Side" : "Client-Side" },
    { label: "Expiry",    value: rules.expiryMinutes > 0 ? `${rules.expiryValue} ${rules.expiryUnit}` : "None" },
    { label: "Password",  value: rules.password ? "Set ✓" : "None" },
    ...(rules.storageMode === "server" ? [{ label: "Max Views", value: String(rules.maxViews) }] : []),
  ];

  return (
    <Card accentColor={T.green}>
      <CardHeader icon={FileCheck} label="Container Preview" color={T.green}>
        {/* "Ready" status badge */}
        <span
          style={{
            display: "inline-flex", alignItems: "center", gap: "0.3rem",
            fontSize: "var(--text-2xs)",    /* 11px UPPERCASE label — ok */
            fontWeight: 700, letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: T.green,
            background: T.greenDim, border: `1px solid ${T.greenBorder}`,
            borderRadius: "var(--r-full)", padding: "0.15rem 0.5rem",
          }}
        >
          <span
            style={{
              width: 5, height: 5, borderRadius: "50%",
              background: T.green, flexShrink: 0,
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
              padding: "0.625rem 1.25rem",
              background: i % 2 === 1 ? "rgba(60,45,20,0.04)" : "transparent",
              borderBottom: i < rows.length - 1 ? `1px solid rgba(60,45,20,0.08)` : "none",
              gap: "1rem",
            }}
          >
            {/* UPPERCASE label — 11px intentional */}
            <span
              style={{
                fontSize: "var(--text-2xs)", fontWeight: 700,
                letterSpacing: "0.08em", textTransform: "uppercase",
                color: T.textTertiary, flexShrink: 0,
              }}
            >
              {label}
            </span>
            {/* Value — raised to 14px, mono */}
            <span
              style={{
                fontSize: "var(--text-sm)",  /* 14px — raised from 13px */
                color: T.textSecondary, fontFamily: T.mono,
                minWidth: 0,
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

/* ─────────────────────────────────────────────────────────────
   SEAL BUTTON
   Full-width CTA inside the rules panel card.
───────────────────────────────────────────────────────────── */
function SealButton({ onClick, disabled, isSealing }) {
  return (
    <div style={{ padding: "1rem 1.25rem", borderTop: `1px solid ${T.border}` }}>
      <button
        onClick={onClick}
        disabled={disabled}
        className="btn-primary"
        style={{
          width: "100%",
          justifyContent: "center",
          fontSize: "var(--text-base)",    /* 16px */
          fontWeight: 700,
          borderRadius: "var(--r3)",       /* 12px */
          letterSpacing: "-0.015em",
          opacity: disabled ? 0.3 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
          pointerEvents: disabled ? "none" : "auto",
        }}
      >
        {isSealing ? (
          <>
            <Loader size={14} style={{ animation: "bar-spin 0.8s linear infinite" }} />
            Sealing container…
          </>
        ) : (
          <>
            <Lock size={14} />
            Seal &amp; Generate .BAR
          </>
        )}
      </button>
      {!isSealing && (
        <p
          style={{
            marginTop: "0.5rem", textAlign: "center",
            fontSize: "var(--text-xs)",    /* 12px */
            color: T.textDim,              /* decorative — ok at 3.6:1 */
            letterSpacing: "0.01em",
          }}
        >
          {disabled ? "Upload a file to continue" : "End-to-end encrypted · Zero-knowledge"}
        </p>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   RESULT CARD
   Shown after a successful seal operation.
   Handles both Server-Side (share link + QR + analytics)
   and Client-Side (download .BAR) flows.
───────────────────────────────────────────────────────────── */
function ResultCard({ barResult, onDownload, onAnalytics, onReset, showToast }) {
  const isServer = barResult.storage_mode === "server";
  const shareUrl = `${window.location.origin}/share/${barResult.access_token}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      style={{
        maxWidth: "min(480px, 100%)",       /* prevents overflow on 320px */
        margin: "3rem auto 0",
        width: "100%",
      }}
    >
      <Card accentColor={T.green}>

        {/* ── Success header ── */}
        <div style={{ padding: "2rem 1.5rem 1.5rem", textAlign: "center" }}>
          {/* Pulse-ring check icon */}
          <div style={{ position: "relative", width: 56, height: 56, margin: "0 auto 1.25rem" }}>
            <div
              aria-hidden="true"
              style={{
                position: "absolute", inset: 0, borderRadius: "50%",
                border: "2px solid rgba(63,125,58,0.28)",
                animation: "pulse-ring 2.5s ease-out infinite",
              }}
            />
            <div
              style={{
                width: 56, height: 56, borderRadius: "50%",
                background: T.greenDim, border: `1px solid ${T.greenBorder}`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <CheckCircle2 size={22} style={{ color: T.green }} />
            </div>
          </div>

          <h2
            style={{
              fontSize: "var(--text-xl)",  /* 22px — raised from 18px for success emphasis */
              fontWeight: 700, letterSpacing: "-0.03em",
              color: T.textPrimary, marginBottom: "0.375rem", lineHeight: 1.2,
            }}
          >
            Container sealed
          </h2>
          <p
            style={{
              fontSize: "var(--text-sm)",  /* 14px — raised from 13px */
              color: T.textSecondary, lineHeight: 1.6,
            }}
          >
            {isServer
              ? "Your file is secured on the server. Share the link below."
              : "Download your .BAR file and share it with the recipient."}
          </p>
        </div>

        {/* ── Metadata row ── */}
        <div
          style={{
            padding: "0.875rem 1.5rem",
            borderTop: `1px solid rgba(60,45,20,0.06)`,
            borderBottom: `1px solid rgba(60,45,20,0.06)`,
            display: "flex", flexWrap: "wrap", gap: "1.5rem",
            background: "rgba(60,45,20,0.04)",
          }}
        >
          {/* Mode */}
          <div>
            <p
              style={{
                fontSize: "var(--text-2xs)", fontWeight: 700,
                letterSpacing: "0.08em", textTransform: "uppercase",
                color: T.textTertiary, marginBottom: 5,
              }}
            >
              Mode
            </p>
            <p
              style={{
                fontSize: "var(--text-sm)",  /* 14px — raised from 13px */
                fontWeight: 600,
                color: isServer ? T.green : T.gold,
              }}
            >
              {isServer ? "Server-Side" : "Client-Side"}
            </p>
          </div>

          {/* Created */}
          <div>
            <p
              style={{
                fontSize: "var(--text-2xs)", fontWeight: 700,
                letterSpacing: "0.08em", textTransform: "uppercase",
                color: T.textTertiary, marginBottom: 5,
              }}
            >
              Created
            </p>
            <p
              style={{
                fontSize: "var(--text-sm)",  /* 14px — raised from 13px */
                color: T.textSecondary, fontFamily: T.mono,
              }}
            >
              {new Date(barResult.metadata.created_at).toLocaleString()}
            </p>
          </div>

          {/* Max Views — server only */}
          {isServer && (
            <div>
              <p
                style={{
                  fontSize: "var(--text-2xs)", fontWeight: 700,
                  letterSpacing: "0.08em", textTransform: "uppercase",
                  color: T.textTertiary, marginBottom: 5,
                }}
              >
                Max Views
              </p>
              <p style={{ fontSize: "var(--text-sm)", color: T.textSecondary, fontFamily: T.mono }}>
                {barResult.metadata.max_views}
              </p>
            </div>
          )}
        </div>

        {/* ── Actions ── */}
        <div style={{ padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "0.625rem" }}>

          {isServer ? (
            <>
              {/* Share link input block */}
              <div
                style={{
                  borderRadius: "var(--r3)",
                  border: `1px solid ${T.border}`,
                  background: T.surface2,
                  overflow: "hidden",
                }}
              >
                {/* "Shareable Link" UPPERCASE label */}
                <p
                  style={{
                    fontSize: "var(--text-2xs)",  /* 11px UPPERCASE label */
                    fontWeight: 700, letterSpacing: "0.08em",
                    textTransform: "uppercase", color: T.textTertiary,
                    padding: "0.625rem 0.875rem 0.25rem",
                  }}
                >
                  Shareable Link
                </p>
                <div
                  style={{
                    display: "flex", alignItems: "center",
                    padding: "0 0.875rem 0.75rem", gap: "0.5rem",
                  }}
                >
                  <input
                    readOnly
                    value={shareUrl}
                    aria-label="Share URL"
                    style={{
                      flex: 1, background: "transparent", border: "none", outline: "none",
                      fontSize: "var(--text-sm)",   /* 14px — raised from 13px */
                      color: T.textSecondary,
                      fontFamily: T.mono,           /* monospace for URLs */
                      minWidth: 0,
                      lineHeight: 1.5,
                    }}
                  />
                  <button
                    onClick={() => { navigator.clipboard.writeText(shareUrl); showToast("Link copied!", "success"); }}
                    aria-label="Copy share link"
                    style={{
                      flexShrink: 0,
                      /* 32px — visible icon button, not primary CTA so 32px ok */
                      width: 32, height: 32,
                      borderRadius: "var(--r2)",
                      background: T.goldDim,
                      border: `1px solid ${T.goldBorder}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", color: T.gold,
                      transition: "background 0.18s ease",
                    }}
                    onMouseOver={e => { e.currentTarget.style.background = "rgba(180,121,30,0.18)"; }}
                    onMouseOut={e  => { e.currentTarget.style.background = T.goldDim; }}
                  >
                    <Copy size={13} />
                  </button>
                </div>
              </div>

              {/* QR code section — generated client-side so the URL always
                 matches the host the user is currently on (LAN IP, localhost,
                 or production domain). */}
              {isServer && (
                <div
                  style={{
                    borderRadius: "var(--r3)",
                    border: `1px solid rgba(60,45,20,0.16)`,
                    background: "rgba(60,45,20,0.04)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "0.625rem 0.875rem 0.375rem",
                    }}
                  >
                    <p
                      style={{
                        fontSize: "var(--text-2xs)", fontWeight: 700,
                        letterSpacing: "0.08em", textTransform: "uppercase",
                        color: T.textTertiary, margin: 0,
                      }}
                    >
                      Scan to open
                    </p>
                    <span style={{ fontSize: "var(--text-xs)", color: T.textDim, letterSpacing: "0.03em" }}>
                      Point camera at code
                    </span>
                  </div>

                  <div style={{ padding: "0 0.875rem 0.875rem", display: "flex", justifyContent: "center" }}>
                    <div style={{ position: "relative", display: "inline-flex" }}>
                      {/* Corner finder marks */}
                      {[
                        { top: 0,    left: 0,    borderWidth: "2px 0 0 2px",   borderRadius: "3px 0 0 0" },
                        { top: 0,    right: 0,   borderWidth: "2px 2px 0 0",   borderRadius: "0 3px 0 0" },
                        { bottom: 0, left: 0,    borderWidth: "0 0 2px 2px",   borderRadius: "0 0 0 3px" },
                        { bottom: 0, right: 0,   borderWidth: "0 2px 2px 0",   borderRadius: "0 0 3px 0" },
                      ].map((pos, i) => (
                        <div
                          key={i}
                          aria-hidden="true"
                          style={{
                            position: "absolute",
                            width: 14, height: 14,
                            borderStyle: "solid", borderColor: T.gold,
                            zIndex: 2,
                            ...pos,
                          }}
                        />
                      ))}
                      <div style={{ padding: "0.625rem", background: "#fff", borderRadius: "0.375rem", lineHeight: 0 }}>
                        <DynamicQRCode
                          path={`/share/${barResult.access_token}`}
                          size={160}
                          alt="QR Code — scan to open the share link"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Analytics button */}
              <button
                onClick={onAnalytics}
                aria-label="View analytics"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                  /* 44px min-height — WCAG touch target */
                  minHeight: 44,
                  padding: "0 1rem",
                  borderRadius: "var(--r3)",
                  border: `1px solid ${T.border}`,
                  background: "rgba(60,45,20,0.04)",
                  color: T.textSecondary,
                  fontSize: "var(--text-sm)",  /* 14px — raised from 13px */
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "background 0.18s ease, color 0.18s ease, border-color 0.18s ease",
                }}
                onMouseOver={e => {
                  e.currentTarget.style.background = "rgba(60,45,20,0.16)";
                  e.currentTarget.style.color = T.textPrimary;
                  e.currentTarget.style.borderColor = T.borderHover;
                }}
                onMouseOut={e => {
                  e.currentTarget.style.background = "rgba(60,45,20,0.04)";
                  e.currentTarget.style.color = T.textSecondary;
                  e.currentTarget.style.borderColor = T.border;
                }}
              >
                <BarChart3 size={15} />
                View Analytics
              </button>
            </>
          ) : (
            /* Client-side: download button */
            <button
              onClick={onDownload}
              className="btn-primary"
              style={{ justifyContent: "center" }}
            >
              <Download size={15} />
              Download .BAR File
            </button>
          )}

          {/* Reset — always shown */}
          <button
            onClick={onReset}
            className="btn-ghost"
            aria-label="Seal another file"
            style={{ fontSize: "var(--text-sm)", minHeight: 44 }}  /* 44px touch target */
          >
            <ArrowLeft size={13} />
            Seal another file
          </button>
        </div>
      </Card>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────
   MAIN APP
   The core encrypt/seal interface.
───────────────────────────────────────────────────────────── */
function MainApp() {
  const [uploadedFile, setUploadedFile]     = useState(null);
  const [fileInfo, setFileInfo]             = useState(null);
  const [filePreview, setFilePreview]       = useState(null);
  const [rules, setRules]                   = useState({
    storageMode:        "client",
    maxViews:           1,
    expiryMinutes:      0,
    expiryValue:        0,
    expiryUnit:         "minutes",
    password:           "",
    webhookUrl:         "",
    viewOnly:           false,
    requireOtp:         false,
    otpEmails:          [],
    viewRefreshMinutes: 0,
    autoRefreshSeconds: 0,
  });
  const [barResult, setBarResult]           = useState(null);
  const [isSealing, setIsSealing]           = useState(false);
  const [toast, setToast]                   = useState(null);
  const [showAnalytics, setShowAnalytics]   = useState(false);
  const [showDecrypt, setShowDecrypt]       = useState(false);
  const [error, setError]                   = useState(null);

  const showToast = (message, type = "success") => setToast({ message, type });

  /* ── File upload ── */
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
    setUploadedFile(null); setFileInfo(null); setFilePreview(null);
    setBarResult(null); setError(null);
  };

  /* ── Seal container ── */
  const handleSealContainer = async () => {
    if (!fileInfo) { setError("No file uploaded"); return; }
    setIsSealing(true); setError(null);
    try {
      await new Promise(r => setTimeout(r, 1800));
      const sealData = {
        temp_filename:        fileInfo.temp_filename,
        max_views:            rules.maxViews,
        expiry_minutes:       rules.expiryMinutes,
        password:             rules.password || null,
        webhook_url:          (rules.webhookUrl && rules.webhookUrl.trim()) || null,
        view_only:            rules.viewOnly || false,
        storage_mode:         rules.storageMode || "client",
        require_otp:          rules.requireOtp || false,
        otp_emails:           (rules.otpEmails && rules.otpEmails.length > 0) ? rules.otpEmails : null,
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
    } finally {
      setIsSealing(false);
    }
  };

  /* ── Download .BAR ── */
  const handleDownloadBar = () => {
    if (barResult?.bar_data) {
      const binaryString = atob(barResult.bar_data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/octet-stream" });
      const url  = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = barResult.bar_filename;
      document.body.appendChild(link); link.click();
      document.body.removeChild(link); URL.revokeObjectURL(url);
    }
  };

  /* ── Reset ── */
  const handleReset = () => {
    setBarResult(null); setUploadedFile(null); setFileInfo(null); setError(null);
    setRules({
      storageMode: "client", maxViews: 1, expiryMinutes: 0,
      expiryValue: 0, expiryUnit: "minutes", password: "", webhookUrl: "",
      viewOnly: false, requireOtp: false, otpEmails: [],
      viewRefreshMinutes: 0, autoRefreshSeconds: 0,
    });
  };

  return (
    <div
      style={{
        minHeight: "100vh", background: T.bg,
        color: T.textPrimary, overflowX: "hidden", position: "relative",
      }}
    >
      <SEO />
      <ContainerAnimation isSealing={isSealing} />

      {/* Fixed ambient background */}
      <div aria-hidden="true" style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div className="bg-grid" style={{ position: "absolute", inset: 0, opacity: 0.28 }} />
        <div
          style={{
            position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
            width: "60vw", height: "22vh",
            background: "radial-gradient(ellipse at top, rgba(180,121,30,0.05) 0%, transparent 70%)",
          }}
        />
      </div>

      <AppNav showDecrypt={showDecrypt} onToggleDecrypt={() => setShowDecrypt(v => !v)} />
      <ErrorModal error={error} onClose={() => setError(null)} />

      {/* ── Main content ── */}
      <main
        style={{
          position: "relative", zIndex: 1,
          paddingTop: `${T.navbarHeight}px`,  /* 56px — matches --navbar-height */
        }}
      >
        <div
          style={{
            maxWidth: 1100, margin: "0 auto",
            /* Fluid horizontal padding: 16px on 320px → 24px on 800px+ */
            padding: "0 clamp(1rem, 4vw, 1.5rem)",
          }}
        >
          {/* ── DECRYPT VIEW ── */}
          {showDecrypt ? (
            <div style={{ paddingTop: "2.5rem" }}>
              <DecryptPage onBack={() => setShowDecrypt(false)} />
            </div>

          /* ── RESULT VIEW ── */
          ) : barResult ? (
            <ResultCard
              barResult={barResult}
              onDownload={handleDownloadBar}
              onAnalytics={() => setShowAnalytics(true)}
              onReset={handleReset}
              showToast={showToast}
            />

          /* ── CREATE VIEW ── */
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: EASE }}
            >
              {/* ── Page header ── */}
              <div style={{ padding: "2.25rem 0 1.75rem" }}>
                {/* Eyebrow badge */}
                <div style={{ marginBottom: "0.875rem" }}>
                  <span
                    style={{
                      fontSize: "var(--text-2xs)",   /* 11px UPPERCASE badge */
                      fontWeight: 700, letterSpacing: "0.09em",
                      textTransform: "uppercase", color: T.gold,
                      background: T.goldDim, border: `1px solid ${T.goldBorder}`,
                      borderRadius: "var(--r-full)", padding: "0.2rem 0.625rem",
                      display: "inline-flex", alignItems: "center",
                    }}
                  >
                    Encrypt &amp; Seal
                  </span>
                </div>

                <h1
                  style={{
                    fontSize: "clamp(1.5rem, 2.5vw, 1.875rem)",
                    fontWeight: 700, letterSpacing: "-0.04em",
                    color: T.textPrimary, lineHeight: 1.15, marginBottom: "0.5rem",
                  }}
                >
                  Create a sealed container
                </h1>

                {/* Description — maxWidth changed to min(38ch,100%) for mobile safety */}
                <p
                  style={{
                    fontSize: "var(--text-sm)",       /* 14px */
                    color: T.textSecondary,
                    letterSpacing: "-0.01em", lineHeight: 1.65,
                    maxWidth: "min(38ch, 100%)",       /* was 38ch — clipped at 320px */
                  }}
                >
                  Upload any file, configure security rules, generate an encrypted .BAR container.
                </p>

                {/* Hairline gold accent */}
                <div
                  style={{
                    height: "1px", marginTop: "1.5rem",
                    background: "linear-gradient(90deg, rgba(180,121,30,0.20) 0%, transparent 60%)",
                  }}
                />
              </div>

              {/* ── Two-column app grid ── */}
              <div className="app-grid">

                {/* LEFT COLUMN — upload + preview */}
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem", minWidth: 0 }}>
                  {/* Upload card */}
                  <Card accentColor={T.gold}>
                    <CardHeader icon={Upload} label="File Upload" color={T.gold}>
                      <span
                        style={{
                          fontSize: "var(--text-2xs)", fontWeight: 600,
                          letterSpacing: "0.05em", textTransform: "uppercase",
                          color: T.textTertiary,
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

                  {/* Container preview — animates in when file is selected */}
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

                {/* RIGHT COLUMN — rules panel + seal button */}
                <div
                  className="app-grid-sidebar"
                  style={{
                    borderRadius: "var(--r4)",
                    border: `1px solid ${T.border}`,
                    background: T.surface0,
                    overflow: "hidden",
                    boxShadow: shadow,
                    minWidth: 0,
                  }}
                >
                  {/* Gold accent line */}
                  <div
                    style={{
                      height: "1px",
                      background: "linear-gradient(90deg, rgba(180,121,30,0.48) 0%, rgba(180,121,30,0.14) 55%, transparent 100%)",
                    }}
                  />
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

              {/* SEO content — dimmed, below the fold */}
              <div style={{ marginTop: "5rem", opacity: 0.35 }}>
                <SEOContent />
              </div>
            </motion.div>
          )}
        </div>
      </main>

      {/* Toast notification */}
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
          borderTop: `1px solid ${T.border}`,
          position: "relative", zIndex: 1, marginTop: "4rem",
          background: `linear-gradient(180deg, transparent, rgba(216,201,166,0.35))`,
        }}
      >
        <div
          style={{
            maxWidth: 1100, margin: "0 auto",
            padding: "1.125rem clamp(1rem, 4vw, 1.5rem)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexWrap: "wrap", gap: "0.5rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
            <PackageOpen size={12} style={{ color: T.textDim }} />
            <span
              style={{
                fontSize: "var(--text-xs)",  /* 12px — footer is ok at 12px */
                color: T.textTertiary,        /* raised from T.textD (#424242) */
                letterSpacing: "-0.01em",
              }}
            >
              BAR Web — Encrypted file containers with self-destruct
            </span>
          </div>
          <span
            style={{
              fontSize: "var(--text-xs)",
              color: T.textDim,              /* decorative — ok at this size */
            }}
          >
            © {new Date().getFullYear()}
          </span>
        </div>
      </footer>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   APP ROOT — routing
───────────────────────────────────────────────────────────── */
function App() {
  return (
    <Routes>
      <Route path="/"              element={<LandingPage />} />
      <Route path="/app"           element={<MainApp />} />
      <Route path="/burn-chat"     element={<BurnChatLandingPage />} />
      <Route path="/share/:token"  element={<SharePageWrapper />} />
      <Route path="/chat/:token"   element={<BurnChatWrapper />} />
    </Routes>
  );
}

export default App;
