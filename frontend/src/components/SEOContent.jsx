import React, { useState } from "react";
import {
  Shield, Lock, Eye, Clock, FileCheck,
  Flame, ChevronDown, ChevronUp,
  ShieldOff, KeyRound, Zap,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────
   DESIGN TOKENS — mirrors App.jsx / index.css
───────────────────────────────────────────────────────────── */
const T = {
  gold:        "#B4791E",
  goldLight:   "#CE9530",
  goldMuted:   "#8F5E16",
  goldDim:     "rgba(180,121,30,0.10)",
  goldBorder:  "rgba(180,121,30,0.28)",

  ember:       "#C4461A",
  emberDim:    "rgba(196,70,26,0.10)",
  emberBorder: "rgba(196,70,26,0.28)",

  green:       "#3F7D3A",
  greenDim:    "rgba(63,125,58,0.10)",
  greenBorder: "rgba(63,125,58,0.28)",

  slate:       "#2C4A6E",
  slateDim:    "rgba(44,74,110,0.10)",
  slateBorder: "rgba(44,74,110,0.28)",

  crimson:     "#B33A2E",
  crimsonDim:  "rgba(179,58,46,0.10)",
  crimsonBorder:"rgba(179,58,46,0.28)",

  violet:      "#6B3FA0",
  violetDim:   "rgba(107,63,160,0.10)",
  violetBorder:"rgba(107,63,160,0.28)",

  bg:       "#EDE3CE",
  surface0: "#FAF4E6",
  surface1: "#FFFDF6",
  surface2: "#F1E8D3",

  textPrimary:   "#2A2018",
  textSecondary: "#55483A",
  textTertiary:  "#857358",
  textDim:       "#A2916F",

  border:       "rgba(60,45,20,0.16)",
  borderHover:  "rgba(60,45,20,0.30)",
  borderStrong: "rgba(60,45,20,0.24)",

  mono: "'JetBrains Mono', monospace",
  hand: "'Caveat', 'Patrick Hand', cursive",
  print: "'Patrick Hand', cursive",
};

/* ─────────────────────────────────────────────────────────────
   SEO CONTENT
   Rendered below the fold on /app. Serves two purposes:
   1. SEO signal — rich structured copy for search crawlers
   2. User education — collapsible sections anyone can open

   Design: warm parchment/notebook aesthetic aligned with the
   rest of the BAR app. Gold accents, ink-on-paper typography,
   handwritten-style section headers, ruled-line dividers.
───────────────────────────────────────────────────────────── */
const SEOContent = () => {
  const [openSection, setOpenSection] = useState(null);

  const toggleSection = (section) => {
    setOpenSection(openSection === section ? null : section);
  };

  return (
    <div style={{ maxWidth: 820, margin: "0 auto 4rem", padding: "0 1rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>

      {/* ── Hero / Intro ── */}
      <section
        style={{
          background: T.surface0,
          border: `1px solid ${T.border}`,
          borderRadius: "10px 14px 12px 11px / 12px 11px 14px 10px",
          overflow: "hidden",
          boxShadow: "0 4px 12px rgba(60,45,20,0.12), 0 1px 3px rgba(60,45,20,0.08)",
        }}
      >
        {/* gold accent top bar */}
        <div style={{ height: 3, background: `linear-gradient(90deg, ${T.gold} 0%, ${T.goldLight} 40%, transparent 100%)` }} />

        <div style={{ padding: "2rem 2.25rem 2rem" }}>
          {/* Eyebrow */}
          <p
            style={{
              fontFamily: T.mono,
              fontSize: "0.6875rem",
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: T.gold,
              marginBottom: "0.875rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span style={{ display: "inline-block", width: 20, height: 1, background: T.goldBorder, verticalAlign: "middle" }} />
            About BAR
            <span style={{ display: "inline-block", width: 20, height: 1, background: T.goldBorder, verticalAlign: "middle" }} />
          </p>

          <h2
            style={{
              fontFamily: T.hand,
              fontSize: "clamp(1.75rem, 4vw, 2.375rem)",
              fontWeight: 700,
              color: T.textPrimary,
              lineHeight: 1.2,
              letterSpacing: "-0.01em",
              marginBottom: "1.25rem",
            }}
          >
            BAR — Burn After Reading: Secure Self-Destructing Files &amp; Ephemeral Chat
          </h2>

          {/* Ruled-line separator */}
          <div style={{ height: 1, background: `repeating-linear-gradient(90deg, ${T.border} 0 6px, transparent 6px 12px)`, marginBottom: "1.25rem", opacity: 0.6 }} />

          <p style={{ fontSize: "1rem", fontWeight: 500, color: "#1A140D", lineHeight: 1.85, marginBottom: "1rem" }}>
            <strong style={{ color: "#1A140D", fontWeight: 700 }}>BAR (Burn After Reading)</strong> is a dual-feature privacy platform — seal
            files that self-destruct after viewing, or open a <strong style={{ color: "#1A140D", fontWeight: 700 }}>Burn Chat</strong> session
            whose messages are permanently erased the moment its countdown expires. Whether you
            need to transmit confidential business documents or hold a sensitive conversation with
            no stored record, BAR applies AES-256 encryption for files and end-to-end AES-GCM-256
            with ECDH P-256 key exchange for chat — under a strict zero-knowledge, zero-log
            architecture.
          </p>
          <p style={{ fontSize: "1rem", fontWeight: 500, color: "#1A140D", lineHeight: 1.85, marginBottom: 0 }}>
            Unlike conventional file transfer or messaging services, BAR is purpose-built for{" "}
            <strong style={{ color: "#1A140D", fontWeight: 700 }}>temporary, self-destructing data</strong>. Configure view limits, add password
            protection with PBKDF2 key derivation, and set time-based expiry for files. Or spin up
            a Burn Chat room whose entire history — messages, keys, participants — is wiped clean
            the instant the timer reaches zero. No accounts required. No logs kept. Nothing
            recoverable after destruction.
          </p>
        </div>
      </section>

      {/* ── Shared accordion styles ── */}
      <style>{`
        .seo-accordion-btn {
          width: 100%;
          padding: 1.25rem 1.75rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          background: transparent;
          border: none;
          cursor: pointer;
          text-align: left;
          transition: background 0.18s ease;
        }
        .seo-accordion-btn:hover {
          background: rgba(60,45,20,0.04);
        }
        .seo-feature-card {
          background: ${T.surface1};
          border-radius: 8px 12px 10px 9px / 10px 9px 12px 8px;
          border: 1px solid ${T.border};
          padding: 1.25rem 1.25rem 1.25rem;
          transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
        }
        .seo-feature-card:hover {
          border-color: rgba(60,45,20,0.28);
          box-shadow: 0 4px 14px rgba(60,45,20,0.10);
          transform: translateY(-2px);
        }
        .seo-step-num-gold {
          flex-shrink: 0;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: ${T.goldDim};
          border: 1.5px solid ${T.goldBorder};
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: ${T.mono};
          font-size: 0.75rem;
          font-weight: 700;
          color: ${T.gold};
        }
        .seo-step-num-ember {
          flex-shrink: 0;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: ${T.emberDim};
          border: 1.5px solid ${T.emberBorder};
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: ${T.mono};
          font-size: 0.75rem;
          font-weight: 700;
          color: ${T.ember};
        }
      `}</style>

      {/* ── Features Grid — Collapsible ── */}
      <CollapsibleSection
        id="features"
        open={openSection === "features"}
        onToggle={() => toggleSection("features")}
        accentColor={T.violet}
        accentDim={T.violetDim}
        accentBorder={T.violetBorder}
        label="Why Choose BAR for Secure File Sharing &amp; Ephemeral Chat?"
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: "1rem",
            padding: "0 1.75rem 1.75rem",
          }}
        >
          {FEATURES.map((f) => (
            <div key={f.title} className="seo-feature-card" style={{ borderTopColor: f.accentBorder, borderTopWidth: 2 }}>
              <div
                style={{
                  width: 36, height: 36, borderRadius: "0.5rem",
                  background: f.accentDim, border: `1px solid ${f.accentBorder}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: "0.875rem",
                }}
              >
                <f.icon size={16} style={{ color: f.accentColor }} />
              </div>
              <h3 style={{ fontFamily: T.print, fontSize: "1rem", fontWeight: 400, color: f.accentColor, marginBottom: "0.5rem", lineHeight: 1.3 }}>
                {f.title}
              </h3>
              <p style={{ fontSize: "0.9375rem", fontWeight: 500, color: "#1A140D", lineHeight: 1.8, margin: 0 }}>
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* ── Use Cases — Collapsible ── */}
      <CollapsibleSection
        id="usecases"
        open={openSection === "usecases"}
        onToggle={() => toggleSection("usecases")}
        accentColor={T.gold}
        accentDim={T.goldDim}
        accentBorder={T.goldBorder}
        label="Perfect Use Cases for BAR"
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "1rem",
            padding: "0 1.75rem 1.75rem",
          }}
        >
          {USE_CASES.map((uc) => (
            <div key={uc.title} className="seo-feature-card">
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.875rem" }}>
                <span style={{ fontSize: "1.125rem" }}>{uc.emoji}</span>
                <h3 style={{ fontFamily: T.print, fontSize: "0.9375rem", fontWeight: 400, color: T.textPrimary, margin: 0 }}>
                  {uc.title}
                </h3>
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                {uc.items.map((item, i) => (
                  <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", fontSize: "0.9375rem", fontWeight: 500, color: "#1A140D", lineHeight: 1.75 }}>
                    <span style={{ color: T.gold, flexShrink: 0, marginTop: 1 }}>›</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* ── How It Works — Collapsible ── */}
      <CollapsibleSection
        id="howto"
        open={openSection === "howto"}
        onToggle={() => toggleSection("howto")}
        accentColor={T.ember}
        accentDim={T.emberDim}
        accentBorder={T.emberBorder}
        label="How BAR's Self-Destructing File Sharing Works"
      >
        <div style={{ padding: "0 1.75rem 1.75rem", display: "flex", flexDirection: "column", gap: "2rem" }}>

          {/* File sealing */}
          <div>
            <p
              style={{
                fontFamily: T.mono,
                fontSize: "0.6875rem",
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: T.gold,
                marginBottom: "1rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <span style={{ display: "inline-block", width: 16, height: 1, background: T.goldBorder }} />
              File Sealing
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              {FILE_STEPS.map((step, i) => (
                <div key={i} style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                  <div className="seo-step-num-gold">{i + 1}</div>
                  <div>
                    <h3 style={{ fontFamily: T.print, fontSize: "0.9375rem", fontWeight: 400, color: T.gold, marginBottom: "0.3rem" }}>
                      {step.title}
                    </h3>
                    <p style={{ fontSize: "0.9375rem", fontWeight: 500, color: "#1A140D", lineHeight: 1.8, margin: 0 }}>
                      {step.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Ruled divider */}
          <div style={{ height: 1, background: `repeating-linear-gradient(90deg, ${T.border} 0 6px, transparent 6px 12px)`, opacity: 0.5 }} />

          {/* Burn Chat */}
          <div>
            <p
              style={{
                fontFamily: T.mono,
                fontSize: "0.6875rem",
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: T.ember,
                marginBottom: "1rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <span style={{ display: "inline-block", width: 16, height: 1, background: T.emberBorder }} />
              Burn Chat
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              {CHAT_STEPS.map((step, i) => (
                <div key={i} style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                  <div className="seo-step-num-ember">{i + 1}</div>
                  <div>
                    <h3 style={{ fontFamily: T.print, fontSize: "0.9375rem", fontWeight: 400, color: T.ember, marginBottom: "0.3rem" }}>
                      {step.title}
                    </h3>
                    <p style={{ fontSize: "0.9375rem", fontWeight: 500, color: "#1A140D", lineHeight: 1.8, margin: 0 }}>
                      {step.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </CollapsibleSection>

      {/* ── FAQ — Collapsible ── */}
      <CollapsibleSection
        id="faq"
        open={openSection === "faq"}
        onToggle={() => toggleSection("faq")}
        accentColor={T.gold}
        accentDim={T.goldDim}
        accentBorder={T.goldBorder}
        label="Frequently Asked Questions About BAR"
      >
        <div style={{ padding: "0 1.75rem 1.75rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {FAQS.map((faq, i) => (
            <div
              key={i}
              style={{
                borderBottom: i < FAQS.length - 1 ? `1px solid ${T.border}` : "none",
                paddingBottom: i < FAQS.length - 1 ? "1.25rem" : 0,
              }}
            >
              <h3
                style={{
                  fontFamily: T.print,
                  fontSize: "0.9375rem",
                  fontWeight: 400,
                  color: T.textPrimary,
                  marginBottom: "0.5rem",
                  lineHeight: 1.4,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.5rem",
                }}
              >
                <span style={{ color: T.gold, flexShrink: 0, fontFamily: T.mono, fontSize: "0.75rem", fontWeight: 700, marginTop: 2 }}>Q</span>
                {faq.q}
              </h3>
              <p
                style={{
                  fontSize: "0.9375rem",
                  fontWeight: 500,
                  color: "#1A140D",
                  lineHeight: 1.85,
                  margin: 0,
                  paddingLeft: "1.25rem",
                  borderLeft: `2px solid ${T.goldBorder}`,
                }}
                dangerouslySetInnerHTML={{ __html: faq.a }}
              />
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* ── Keyword block — hidden visually, readable by crawlers ── */}
      <section className="sr-only">
        <p>
          Keywords: burn after reading, self-destruct files, secure file sharing, encrypted
          file transfer, temporary file sharing, confidential file sharing, auto-delete files,
          BAR encryption, zero-knowledge encryption, password protected files, AES-256
          encryption, PBKDF2 key derivation, HMAC-SHA256 tamper detection, self-destructing
          messages, burn chat, ephemeral chat, encrypted chat room, self-destruct messages,
          end-to-end encrypted chat, disappearing messages, ECDH P-256 key exchange, AES-GCM
          encryption, secure chat room, temporary chat, ephemeral messaging, no logs, no
          accounts, privacy-first file sharing
        </p>
      </section>

    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   COLLAPSIBLE SECTION
───────────────────────────────────────────────────────────── */
function CollapsibleSection({ id, open, onToggle, accentColor, accentBorder, label, children }) {
  return (
    <section
      style={{
        background: "#FAF4E6",
        border: `1px solid rgba(60,45,20,0.16)`,
        borderRadius: "10px 14px 12px 11px / 12px 11px 14px 10px",
        overflow: "hidden",
        boxShadow: "0 4px 12px rgba(60,45,20,0.10), 0 1px 3px rgba(60,45,20,0.07)",
      }}
    >
      <button
        className="seo-accordion-btn"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
      >
        <h2
          style={{
            fontFamily: "Inter, 'system-ui', sans-serif",
            fontSize: "clamp(0.9375rem, 2.5vw, 1.125rem)",
            fontWeight: 700,
            color: "#1A140D",
            margin: 0,
            lineHeight: 1.4,
            letterSpacing: "-0.02em",
          }}
          dangerouslySetInnerHTML={{ __html: label }}
        />
        <div
          style={{
            flexShrink: 0,
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: open ? accentColor : "rgba(60,45,20,0.06)",
            border: `1px solid ${open ? accentColor : "rgba(60,45,20,0.16)"}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 0.2s ease, border-color 0.2s ease",
          }}
        >
          {open
            ? <ChevronUp size={14} style={{ color: "#FAF4E6" }} />
            : <ChevronDown size={14} style={{ color: accentColor }} />}
        </div>
      </button>

      {open && (
        <>
          <div style={{ height: 1, background: `linear-gradient(90deg, ${accentColor}44 0%, ${accentColor}11 55%, transparent 100%)` }} />
          <div id={`${id}-panel`}>
            {children}
          </div>
        </>
      )}
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   DATA
───────────────────────────────────────────────────────────── */
const FEATURES = [
  {
    icon: Lock,
    accentColor: "#B4791E",
    accentDim:   "rgba(180,121,30,0.10)",
    accentBorder:"rgba(180,121,30,0.28)",
    title: "AES-256 Zero-Knowledge Encryption",
    description:
      "Every file is encrypted client-side with AES-256 before it leaves your browser. The key is derived via PBKDF2 (100,000 iterations, SHA-256) and never transmitted — we cannot read your files.",
  },
  {
    icon: Eye,
    accentColor: "#6B3FA0",
    accentDim:   "rgba(107,63,160,0.10)",
    accentBorder:"rgba(107,63,160,0.28)",
    title: "Self-Destructing Files",
    description:
      "Set a maximum view count. The moment the limit is reached the server permanently deletes the encrypted payload — the link is dead for all future access.",
  },
  {
    icon: Clock,
    accentColor: "#3F7D3A",
    accentDim:   "rgba(63,125,58,0.10)",
    accentBorder:"rgba(63,125,58,0.28)",
    title: "Time-Based Auto-Expiry",
    description:
      "Configure files to expire after minutes, hours, or days. Expiry is enforced server-side regardless of view count — once the window closes, the data is gone.",
  },
  {
    icon: KeyRound,
    accentColor: "#2C4A6E",
    accentDim:   "rgba(44,74,110,0.10)",
    accentBorder:"rgba(44,74,110,0.28)",
    title: "Password Protection",
    description:
      "Passwords never leave your device — they derive an AES-256 key locally via PBKDF2. Optionally pair with email OTP so only pre-authorised addresses can open the file.",
  },
  {
    icon: ShieldOff,
    accentColor: "#B33A2E",
    accentDim:   "rgba(179,58,46,0.10)",
    accentBorder:"rgba(179,58,46,0.28)",
    title: "Brute-Force Protection",
    description:
      "Progressive delays and automatic lockouts trigger after repeated failed password attempts, preventing automated tools from cycling through password lists.",
  },
  {
    icon: FileCheck,
    accentColor: "#8F5E16",
    accentDim:   "rgba(143,94,22,0.10)",
    accentBorder:"rgba(143,94,22,0.28)",
    title: "Secure File Deletion",
    description:
      "On expiry or view-limit hit the ciphertext is permanently removed. No soft-deletes, no backups. The shareable link returns 404 immediately.",
  },
  {
    icon: Flame,
    accentColor: "#C4461A",
    accentDim:   "rgba(196,70,26,0.10)",
    accentBorder:"rgba(196,70,26,0.28)",
    title: "Burn Chat — E2E Ephemeral Messaging",
    description:
      "Encrypted end-to-end via ECDH P-256 key exchange and AES-GCM-256. The server only ever relays ciphertext. When the timer expires every message is permanently erased — no history stored anywhere.",
  },
];

const USE_CASES = [
  {
    emoji: "🏢",
    title: "Business & Enterprise",
    items: [
      "Share confidential contracts and NDAs that expire after signing",
      "Distribute temporary credentials with single-use view limits",
      "Send sensitive financial reports with automatic deletion after review",
      "Share proprietary designs with time-locked access",
      "Hold deal discussions in Burn Chat with no stored transcript",
    ],
  },
  {
    emoji: "👤",
    title: "Personal & Private",
    items: [
      "Send passwords, API keys, or recovery codes that disappear after reading",
      "Share private files that self-destruct after one view",
      "Transfer medical documents with time-limited, password-protected access",
      "Move personal files without leaving copies on third-party servers",
      "Start a Burn Chat for conversations that vanish when you're done",
    ],
  },
  {
    emoji: "⚖️",
    title: "Legal & Compliance",
    items: [
      "Distribute case files with controlled, auditable access",
      "Share compliance reports that automatically delete after review",
      "Send privileged documents with view limits and password gates",
      "Conduct attorney-client Burn Chat sessions with no stored transcript",
      "Transmit sensitive documents that expire on a known deadline",
    ],
  },
  {
    emoji: "🔬",
    title: "Development & Research",
    items: [
      "Share environment secrets and SSH keys that self-destruct after first read",
      "Distribute research findings with time-boxed collaborative access",
      "Transmit pre-release builds without permanent cloud copies",
      "Send database credentials securely to temporary contractors",
      "Run a Burn Chat debrief after a security incident with no permanent record",
    ],
  },
];

const FILE_STEPS = [
  {
    title: "Upload & Configure",
    body:
      "Select your file (up to 100 MB) and choose security settings: storage mode (server-side shareable link or downloadable .BAR), optional password, view limit, and expiry duration.",
  },
  {
    title: "Encrypt & Seal",
    body:
      "BAR encrypts your file with AES-256 and applies HMAC-SHA256 tamper detection in your browser. Only the encrypted ciphertext reaches the server — plaintext never leaves your device.",
  },
  {
    title: "Share Securely",
    body:
      "Copy the generated link or .BAR file and share it through any channel. Password-protected files require the correct key; OTP-gated files verify the recipient's email before granting access.",
  },
  {
    title: "Auto-Destruct",
    body:
      "Once the view limit is reached or the expiry window closes, the server permanently deletes the stored ciphertext. The link is immediately invalidated — no recovery is possible by anyone, including us.",
  },
];

const CHAT_STEPS = [
  {
    title: "Create a Session",
    body:
      "Set a countdown timer (minutes, hours, or days) and generate a session. You receive a Creator PIN and a shareable link. The PIN grants moderator access — it is shown once and cannot be recovered.",
  },
  {
    title: "Participants Join",
    body:
      "Share the link through any channel. Each participant's browser generates a unique ECDH P-256 key pair. Keys are exchanged to derive a shared AES-GCM-256 session key — the server never sees plaintext.",
  },
  {
    title: "Chat in Real Time",
    body:
      "Messages are encrypted before transmission and decrypted locally on each device. The server relays encrypted WebSocket frames only. All messages are in-memory — nothing is written to disk.",
  },
  {
    title: "Session Burns",
    body:
      "When the timer expires, the server destroys the session entirely. All in-memory data is purged, every participant is disconnected, and the session cannot be resumed. No history, no transcript, no recovery path.",
  },
];

const FAQS = [
  {
    q: "What does BAR stand for?",
    a: "BAR stands for \"Burn After Reading\" — the concept of information that is consumed once and then permanently destroyed. BAR applies this principle to digital file sharing and real-time messaging with strong cryptographic guarantees rather than just policy promises.",
  },
  {
    q: "What is Burn Chat?",
    a: "Burn Chat is BAR's ephemeral encrypted messaging feature. Create a session with a countdown timer and share the link with participants. All messages are encrypted end-to-end in each participant's browser using ECDH P-256 key exchange and AES-GCM-256 — the server only ever relays ciphertext. When the timer expires the server destroys the session and every message is permanently purged. No chat history is stored anywhere.",
  },
  {
    q: "How is Burn Chat different from file sharing?",
    a: "File sharing lets you transmit a static encrypted payload — a document, image, or any file — that self-destructs after a configured number of views or a time window. Burn Chat is a live, real-time conversation where all messages are encrypted in participants' browsers and the entire session is destroyed when the countdown hits zero. Think of file sharing as a sealed envelope that burns after being opened, and Burn Chat as a secure call where the recording is destroyed the moment you hang up.",
  },
  {
    q: "How secure is BAR's encryption?",
    a: "File sealing uses AES-256 with keys derived via PBKDF2 (SHA-256, 100,000 iterations) and HMAC-SHA256 for tamper detection — all computed client-side. Burn Chat uses ECDH P-256 for key exchange and AES-GCM-256 for message encryption, also computed in the browser. In both cases the server only ever stores or relays ciphertext. Without the correct password or session key, decryption is computationally infeasible.",
  },
  {
    q: "Does BAR log anything?",
    a: "BAR operates under a zero-log policy. No IP addresses, access timestamps, or user identities are retained after a request completes. File metadata and encrypted payloads are stored only for the configured expiry window and deleted on destruction. Burn Chat sessions are fully in-memory and leave no database trace after the session ends.",
  },
  {
    q: "Can I recover a file after it self-destructs?",
    a: "No. Once a file reaches its view limit or expiry time, it is permanently deleted from the server. The shareable link is immediately invalidated. There is no soft-delete, no backup, and no recovery path — by design.",
  },
  {
    q: "Is BAR free to use?",
    a: "Yes. BAR is completely free — file sealing, Burn Chat, AES-256 encryption, password protection, view limits, time-based expiry, and email OTP are all included at no cost. There are no accounts, no premium tiers, and no feature walls.",
  },
  {
    q: "What is the difference between client-side and server-side storage?",
    a: "<strong>Server-side</strong> storage encrypts and uploads the file to BAR's server, generating a shareable link with strictly enforced view limits and automatic deletion — recommended for sensitive files. <strong>Client-side</strong> storage generates a self-contained encrypted .BAR file you distribute via any channel, but view limits cannot be server-enforced since BAR never holds the payload.",
  },
];

export default SEOContent;
