import React from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Shield, Zap, Lock, Clock,
  PackageOpen, ArrowRight, Github, ExternalLink, Flame,
  MessageSquare, CheckCircle,
} from "lucide-react";
import WakeUpButton from "./WakeUpButton";

/* ─────────────────────────────────────────────────────────────
   Animation presets
   Spring easing matches the CSS --ease-spring token.
───────────────────────────────────────────────────────────── */
const EASE = [0.16, 1, 0.3, 1];

const fadeUp = (delay = 0) => ({
  initial:    { opacity: 0, y: 20 },
  animate:    { opacity: 1, y: 0  },
  transition: { duration: 0.65, ease: EASE, delay },
});

const fadeIn = (delay = 0) => ({
  initial:    { opacity: 0 },
  animate:    { opacity: 1 },
  transition: { duration: 0.55, ease: EASE, delay },
});

const scaleIn = (delay = 0) => ({
  initial:    { opacity: 0, scale: 0.96 },
  animate:    { opacity: 1, scale: 1    },
  transition: { duration: 0.5, ease: EASE, delay },
});

/* ─────────────────────────────────────────────────────────────
   Feature data
   accentColor drives icon, border, and top-border gradient.
───────────────────────────────────────────────────────────── */
const FEATURES = [
  {
    icon:        Shield,
    accentColor: "#22C55E",
    title:       "AES-256 Encryption",
    description: "Military-grade symmetric encryption. Your data is sealed before it ever leaves your browser — the server only ever holds ciphertext.",
  },
  {
    icon:        Zap,
    accentColor: "#E8A020",
    title:       "Self-Destruct",
    description: "Files vanish permanently after the view limit or expiry window is reached. No traces remain on disk or in memory.",
  },
  {
    icon:        Lock,
    accentColor: "#C8893A",
    title:       "Zero Knowledge",
    description: "We never see your data. The decryption key lives only with the recipient — we cannot access or recover it.",
  },
  {
    icon:        Clock,
    accentColor: "#6B7FD4",
    title:       "Custom Expiry",
    description: "Define exact time-to-live windows. Minutes, hours, or days — your rules, fully enforced server-side.",
  },
];

/* ─────────────────────────────────────────────────────────────
   BURN CHAT FEATURE DATA
   Mirrors the feature set in BurnChatLandingPage.jsx but is
   declared independently here — the landing page has a different
   rendering context and should not import from a sibling page.
   Orange accent palette throughout, matching the BurnChat brand.
───────────────────────────────────────────────────────────── */
const BURN_CHAT_FEATURES = [
  {
    icon:        Flame,
    accentColor: "#F97316",
    title:       "Auto-Destructs",
    description: "The entire session — messages, participants, history — is permanently erased when the timer hits zero. No recovery, by anyone.",
  },
  {
    icon:        Lock,
    accentColor: "#22C55E",
    title:       "End-to-End Encrypted",
    description: "Messages are encrypted in your browser using AES-GCM-256 before leaving your device. The server only ever relays ciphertext.",
  },
  {
    icon:        Zap,
    accentColor: "#C8893A",
    title:       "Real-Time",
    description: "Powered by WebSockets. Messages appear instantly across all participants — no polling, no delay, no missed messages.",
  },
  {
    icon:        Shield,
    accentColor: "#6B7FD4",
    title:       "Key Fingerprint",
    description: "A 6-char session code lets participants verify the encryption key out-of-band. Mismatched codes mean compromised sessions.",
  },
];

const TRUST_ITEMS = [
  { label: "AES-256 Encrypted",  dot: true  },
  { label: "Zero Server Logs",   dot: true  },
  { label: "Self-Destructing",   dot: true  },
  { label: "Open Source",        dot: false },
];

/* ─────────────────────────────────────────────────────────────
   Inline style constants
   These reference the CSS custom property values directly
   so the JSX tokens stay in sync with index.css.
───────────────────────────────────────────────────────────── */
const T = {
  /* text colours — identical to CSS :root */
  textPrimary:   "#f0f0f0",
  textSecondary: "#a0a0a0",
  textTertiary:  "#636363",
  textDim:       "#424242",
  textMuted:     "#2a2a2a",

  /* gold */
  gold:        "#E8A020",
  goldLight:   "#F5BA3A",
  goldMuted:   "#C8893A",
  goldBorder:  "rgba(232,160,32,0.22)",
  goldDim:     "rgba(232,160,32,0.10)",

  /* orange — BurnChat only */
  orange:       "#F97316",
  orangeDim:    "rgba(249,115,22,0.09)",
  orangeBorder: "rgba(249,115,22,0.22)",
  orangeHover:  "rgba(249,115,22,0.16)",
  orangeBorderHover: "rgba(249,115,22,0.40)",

  /* surfaces */
  bg:       "#070707",
  surface0: "#0e0e0e",

  /* borders */
  border:       "rgba(255,255,255,0.07)",
  borderStrong: "rgba(255,255,255,0.10)",

  /* navbar */
  navbarBg:   "rgba(7,7,7,0.92)",
  navbarBlur: "blur(22px) saturate(160%)",
};

/* ─────────────────────────────────────────────────────────────
   NAVBAR
   Fixed, full-width. 56px on mobile, 60px on desktop via CSS.
   Left:  logo (icon + wordmark)
   Right: GitHub · Portfolio  |  Launch App (CTA pill)
   ─────────────────────────────────────────────────────────────
   Design decisions:
   • GitHub + Portfolio are secondary ghost links — visually
     demoted with lower opacity so they don't compete with the
     primary CTA.
   • Labels ("GitHub", "Portfolio") appear at ≥640px via CSS so
     these links feel intentional, not like stray icon buttons.
   • A thin vertical divider separates the ghost-link group from
     the CTA pill — clear visual hierarchy without adding any
     extra interactive element.
   • "Launch App" label hides below 480px (icon-only) — the
     icon itself is still a 40px touch target.
───────────────────────────────────────────────────────────── */
function Navbar({ onLaunch }) {
  return (
    <>
      <style>{`
        /* ── Navbar shell ── */
        .lp-navbar {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          height: 56px;
          display: flex; align-items: center;
          background: ${T.navbarBg};
          backdrop-filter: ${T.navbarBlur};
          -webkit-backdrop-filter: ${T.navbarBlur};
          border-bottom: 1px solid ${T.borderStrong};
          transition: height 0.2s ease;
        }
        @media (min-width: 768px) {
          .lp-navbar { height: 60px; }
        }

        /* ── Secondary ghost links (GitHub, Portfolio) ── */
        .lp-nav-link {
          display: inline-flex; align-items: center; gap: 0.375rem;
          /* 36px min-height — secondary action, not primary CTA */
          min-height: 36px;
          padding: 0.3125rem 0.625rem;
          font-size: 0.8125rem; font-weight: 500; letter-spacing: -0.01em;
          /* Visually demoted: tertiary colour at 0.7 opacity so they
             don't compete with the gold CTA pill */
          color: ${T.textTertiary};
          opacity: 0.70;
          border-radius: 0.5rem;
          text-decoration: none;
          white-space: nowrap;
          transition: color 0.18s ease, background 0.18s ease, opacity 0.18s ease;
        }
        .lp-nav-link:hover {
          color: ${T.textPrimary};
          background: rgba(255,255,255,0.06);
          opacity: 1;
        }
        /* Icon sits at a fixed size; it must not shrink */
        .lp-nav-link svg { flex-shrink: 0; }

        /* Label text — hidden on mobile, shown at ≥640px so the
           links are clearly labelled on any real screen estate    */
        .lp-nav-link-label {
          display: none;
        }
        @media (min-width: 640px) {
          .lp-nav-link-label { display: inline; }
        }

        /* ── Divider between ghost group and CTA pill ── */
        .lp-nav-divider {
          width: 1px;
          height: 20px;
          background: ${T.borderStrong};
          flex-shrink: 0;
          margin: 0 0.375rem;
          /* Subtly fade the divider so it guides without distracting */
          opacity: 0.55;
        }

        /* ── Primary CTA pill — "Launch App" ── */
        .lp-nav-launch {
          display: inline-flex; align-items: center; gap: 0.4rem;
          /* 36px min-height on mobile, 38px text on desktop via padding */
          min-height: 36px;
          padding: 0.4375rem 1.0625rem;
          font-family: inherit;
          font-size: 0.875rem; font-weight: 700; letter-spacing: -0.02em;
          color: #000;
          background: linear-gradient(160deg, ${T.goldLight} 0%, ${T.gold} 100%);
          border: none; border-radius: 999px; cursor: pointer;
          box-shadow: 0 2px 10px rgba(232,160,32,0.25);
          transition: transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .lp-nav-launch:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 18px rgba(232,160,32,0.35);
        }
        .lp-nav-launch:active {
          transform: translateY(0);
          box-shadow: 0 2px 8px rgba(232,160,32,0.22);
        }
        /* Hide "Launch App" label below 480px — icon alone is clear enough
           at that breakpoint and prevents label overflow on tiny phones     */
        .lp-nav-launch-label { display: none; }
        @media (min-width: 480px) {
          .lp-nav-launch-label { display: inline; }
        }
      `}</style>

      <nav className="lp-navbar" role="navigation" aria-label="Main navigation">
        <div
          className="container-app"
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}
        >
          {/* ── Logo ── */}
          <button
            onClick={onLaunch}
            aria-label="Go to BAR Web home"
            style={{
              background: "none", border: "none", cursor: "pointer", padding: 0,
              display: "flex", alignItems: "center", gap: "0.5rem",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 30, height: 30, borderRadius: "0.45rem",
                background: T.goldDim, border: `1px solid ${T.goldBorder}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background 0.22s ease",
              }}
            >
              <PackageOpen size={15} style={{ color: T.gold }} />
            </div>
            <span
              style={{
                fontSize: "1rem", fontWeight: 700, letterSpacing: "-0.03em",
                color: T.textPrimary,
              }}
            >
              BAR<span style={{ color: T.textDim, fontWeight: 400 }}>.web</span>
            </span>
          </button>

          {/* ── Right rail ── */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.125rem", flexShrink: 0 }}>

            {/* Ghost link — GitHub */}
            <a
              href="https://github.com/Mrtracker-new/BAR_RYY"
              target="_blank"
              rel="noreferrer"
              className="lp-nav-link"
              title="View source on GitHub"
              aria-label="View source on GitHub"
            >
              <Github size={14} />
              <span className="lp-nav-link-label">GitHub</span>
            </a>

            {/* Ghost link — Portfolio */}
            <a
              href="https://rolan-rnr.netlify.app"
              target="_blank"
              rel="noreferrer"
              className="lp-nav-link"
              title="Visit creator portfolio"
              aria-label="Visit creator portfolio"
            >
              <ExternalLink size={14} />
              <span className="lp-nav-link-label">Portfolio</span>
            </a>

            {/* Visual divider — separates secondary links from the primary CTA */}
            <div className="lp-nav-divider" aria-hidden="true" />

            {/* Primary CTA — Launch App */}
            <button
              onClick={onLaunch}
              className="lp-nav-launch"
              aria-label="Launch BAR Web app"
            >
              <ArrowRight size={13} />
              <span className="lp-nav-launch-label">Launch App</span>
            </button>

          </div>
        </div>
      </nav>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   HERO BADGE
   Pill with pulsing green dot. Eyebrow above the main headline.
───────────────────────────────────────────────────────────── */
function HeroBadge() {
  return (
    <motion.div {...fadeIn(0.1)} style={{ display: "flex", justifyContent: "center", marginBottom: "1.875rem" }}>
      <div
        style={{
          display: "inline-flex", alignItems: "center", gap: "0.5rem",
          padding: "0.375rem 1rem", borderRadius: "999px",
          background: "rgba(232,160,32,0.08)", border: `1px solid ${T.goldBorder}`,
          fontSize: "var(--text-2xs)", fontWeight: 700, letterSpacing: "0.09em",
          textTransform: "uppercase", color: T.goldMuted,
        }}
      >
        <span
          style={{
            width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
            background: "#22C55E",
            boxShadow: "0 0 6px rgba(34,197,94,0.85)",
            animation: "pulse 2s ease-in-out infinite",
          }}
        />
        Secure File Transmission
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────
   HERO TITLE
   "Burn After" — gold gradient
   "Reading"    — near-invisible, creates depth contrast
   Max 6.5rem prevents overflow at 1280px viewports.
───────────────────────────────────────────────────────────── */
function HeroTitle() {
  return (
    <motion.div {...fadeUp(0.18)} style={{ textAlign: "center", marginBottom: "1.5rem" }}>
      <h1
        style={{
          fontSize: "clamp(2.75rem, 8vw, 6.5rem)",
          fontWeight: 800,
          letterSpacing: "-0.055em",
          lineHeight: 0.92,
          /* Override the global h1 colour — this is a display element */
          color: "inherit",
        }}
      >
        <span
          className="glow-text"
          style={{
            display: "block",
            background: "linear-gradient(135deg, #F5BA3A 0%, #E8A020 45%, #B87820 100%)",
            WebkitBackgroundClip: "text", backgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Burn After
        </span>
        {/* "Reading" is intentionally dimmed — typographic depth, not body text */}
        <span
          style={{
            display: "block",
            color: "#3a3a3a",           /* raised from #2e2e2e — still dramatic but not invisible */
            marginTop: "0.05em",
          }}
        >
          Reading
        </span>
      </h1>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────
   HERO SUBTITLE
   min(28rem, 100%) prevents clip on 320px screens.
   Color raised to --text-secondary (#a0a0a0) — was #555555.
───────────────────────────────────────────────────────────── */
function HeroSubtitle() {
  return (
    <motion.p
      {...fadeUp(0.3)}
      style={{
        textAlign: "center",
        fontSize: "var(--text-sm)",      /* 14px enforced — was clamp(0.9375rem…) which could be > 15px on wide screens but 14px on small */
        fontWeight: 400, lineHeight: 1.75,
        color: T.textSecondary,           /* #a0a0a0 — 6.3:1 contrast ✓ AA */
        maxWidth: "min(28rem, 100%)",     /* clips safely at 320px */
        margin: "0 auto 2.5rem",
      }}
    >
      The most secure way to share sensitive documents —{" "}
      <span style={{ color: T.textTertiary }}>
        encrypted, anonymous, and designed to disappear.
      </span>
    </motion.p>
  );
}

/* ─────────────────────────────────────────────────────────────
   HERO CTA
   Three interactive elements:
     1. "Start Sealing" — primary gold CTA (btn-primary class, 48px touch target)
     2. "🔥 Burn Chat"  — orange ghost pill
     3. WakeUpButton    — server wake utility (compact)
   Below: sleep notice, raised to 12px + --text-tertiary.
───────────────────────────────────────────────────────────── */
function HeroCTA({ onLaunch, onBurnChat }) {
  return (
    <motion.div
      {...fadeUp(0.42)}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}
    >
      {/* Button row */}
      <div
        style={{
          display: "flex", flexWrap: "wrap", gap: "0.75rem",
          justifyContent: "center", alignItems: "center",
        }}
      >
        {/* Primary CTA */}
        <button
          onClick={onLaunch}
          className="btn-primary"
          style={{ padding: "0.8125rem 2rem", fontSize: "var(--text-base)" }}
        >
          Start Sealing
          <ArrowRight size={16} />
        </button>

        {/* BurnChat secondary CTA */}
        <button
          onClick={onBurnChat}
          style={{
            display: "inline-flex", alignItems: "center", gap: "0.5rem",
            /* min-height matches btn-primary 48px */
            minHeight: 48,
            padding: "0.8125rem 1.625rem",
            fontSize: "var(--text-base)", fontWeight: 600, letterSpacing: "-0.015em",
            color: T.orange,
            background: T.orangeDim,
            border: `1px solid ${T.orangeBorder}`,
            borderRadius: "var(--r-full)",
            cursor: "pointer",
            transition: "background 0.2s ease, border-color 0.2s ease, color 0.2s ease, transform 0.2s ease",
            whiteSpace: "nowrap",
          }}
          onMouseOver={e => {
            e.currentTarget.style.background = T.orangeHover;
            e.currentTarget.style.borderColor = T.orangeBorderHover;
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseOut={e => {
            e.currentTarget.style.background = T.orangeDim;
            e.currentTarget.style.borderColor = T.orangeBorder;
            e.currentTarget.style.transform = "";
          }}
        >
          <Flame size={16} />
          Burn Chat
        </button>

        {/* Wake server utility */}
        <div style={{ flexShrink: 0 }}>
          <WakeUpButton compact />
        </div>
      </div>

      {/* Sleep notice — raised from 11px #303030 to 12px --text-tertiary */}
      <p
        style={{
          fontSize: "var(--text-xs)",     /* 12px */
          color: T.textTertiary,           /* #636363 — 4.9:1 contrast ✓ AA */
          textAlign: "center",
          maxWidth: "min(22rem, 100%)",
          lineHeight: 1.55,
        }}
      >
        💤 Server may be sleeping (free tier). &quot;Wake Server&quot; takes ~50s.
      </p>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────
   TRUST BAR
   Security signals below the CTA.
   Items raised to 14px / --text-tertiary (#636363).
   Dot separators raised to #424242 (visible but not distracting).
───────────────────────────────────────────────────────────── */
function TrustBar() {
  return (
    <motion.div
      {...fadeIn(0.6)}
      style={{
        display: "flex", flexWrap: "wrap",
        justifyContent: "center", alignItems: "center",
        gap: "0.5rem 1.5rem",
        marginTop: "3.5rem", paddingTop: "2rem",
        borderTop: `1px solid rgba(255,255,255,0.06)`,
      }}
    >
      {TRUST_ITEMS.map(({ label, dot }, i) => (
        <React.Fragment key={label}>
          {dot && i > 0 && (
            <span
              aria-hidden="true"
              style={{
                width: 3, height: 3, borderRadius: "50%",
                background: "#424242",              /* raised from #202020 */
                flexShrink: 0, display: "block",
              }}
            />
          )}
          <span
            style={{
              fontSize: "var(--text-sm)",           /* 14px — raised from 13px */
              fontWeight: 500,
              color: T.textTertiary,                /* #636363 — raised from #363636 */
              letterSpacing: "-0.01em",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </span>
        </React.Fragment>
      ))}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────
   FEATURE CARD
   Each card:
     • Accent top-border gradient in the feature's colour
     • 44×44 icon box (raised from 40×40)
     • Title: 1rem / --text-primary (raised from 0.9375rem / #d8d8d8)
     • Description: 14px / --text-secondary (raised from 13px / #484848 — fails AA)
     • whileInView scroll trigger with staggered delay
───────────────────────────────────────────────────────────── */
function FeatureCard({ icon: Icon, title, description, accentColor, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.6, ease: EASE, delay: index * 0.08 }}
      className="feature-card"
    >
      {/* Accent top-border gradient */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute", top: -1, left: 0, right: 0, height: "1px",
          background: `linear-gradient(90deg, ${accentColor}66 0%, ${accentColor}1A 55%, transparent 100%)`,
          borderRadius: "inherit",
        }}
      />

      {/* Icon container — 44×44, raised from 40×40 */}
      <div
        style={{
          width: 44, height: 44, borderRadius: "0.625rem", flexShrink: 0,
          background: `${accentColor}12`,
          border: `1px solid ${accentColor}28`,
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: "1.25rem",
          transition: "background 0.3s ease, border-color 0.3s ease",
        }}
      >
        <Icon size={20} style={{ color: accentColor }} />
      </div>

      {/* Title — 1rem / --text-primary (was 0.9375rem / #d8d8d8) */}
      <h3
        style={{
          fontSize: "var(--text-base)",       /* 1rem */
          fontWeight: 600, letterSpacing: "-0.02em",
          color: T.textPrimary,                /* #f0f0f0 — 15.8:1 ✓ AAA */
          marginBottom: "0.625rem",
          lineHeight: 1.3,
        }}
      >
        {title}
      </h3>

      {/* Description — 14px / #a0a0a0 (was 13px / #484848 — fails WCAG AA) */}
      <p
        style={{
          fontSize: "var(--text-sm)",          /* 14px */
          lineHeight: 1.7,
          color: T.textSecondary,               /* #a0a0a0 — 6.3:1 ✓ AA */
        }}
      >
        {description}
      </p>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────
   SECTION HEADER — generic, reused for both feature sub-sections
   Props:
     eyebrow      — UPPERCASE label above the heading
     heading      — main h2 / h3 text
     subtext      — supporting paragraph
     accentColor  — eyebrow + accent tint (gold for file, orange for chat)
     as           — heading element to render ('h2' | 'h3'), default 'h2'
───────────────────────────────────────────────────────────── */
function SectionHeader({ eyebrow, heading, subtext, accentColor = T.gold, as: Tag = "h2" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.6, ease: EASE }}
      style={{ textAlign: "center", marginBottom: "3rem" }}
    >
      {/* UPPERCASE eyebrow label — intentionally small, acts as a category signal */}
      <p
        style={{
          fontSize: "var(--text-2xs)",   /* 11px — UPPERCASE label, acceptable at this size */
          fontWeight: 700, letterSpacing: "0.10em",
          textTransform: "uppercase",
          color: accentColor,
          opacity: 0.85,
          marginBottom: "0.875rem",
        }}
      >
        {eyebrow}
      </p>

      {/* Primary section heading */}
      <Tag
        style={{
          fontSize: "clamp(1.625rem, 3.5vw, 2.25rem)",
          fontWeight: 700, letterSpacing: "-0.035em",
          color: T.textPrimary,
          lineHeight: 1.15,
        }}
      >
        {heading}
      </Tag>

      {/* Supporting description */}
      {subtext && (
        <p
          style={{
            fontSize: "var(--text-sm)",   /* 14px */
            color: T.textSecondary,
            maxWidth: "min(38rem, 100%)",
            margin: "0.875rem auto 0",
            lineHeight: 1.72,
          }}
        >
          {subtext}
        </p>
      )}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────
   BURN CHAT HIGHLIGHT
   A full-bleed card that introduces BurnChat as a product.
   Sits between the file-sealing feature grid and the bottom CTA.

   Visual design:
     • Orange accent top-border gradient (mirrors BurnChat brand)
     • Surface-0 background with orange perimeter border glow
     • Left: tagline + bullet list of differentiators
     • Right: 2×2 mini feature grid (BURN_CHAT_FEATURES cards)
     • Bottom: "Try Burn Chat →" CTA — orange gradient pill

   Responsiveness:
     • ≥ 768px: two-column layout (text | mini-grid)
     • < 768px: single column, text above mini-grid
───────────────────────────────────────────────────────────── */
function BurnChatHighlight({ onBurnChat }) {
  const BULLETS = [
    "Sessions self-destruct — nothing persists after the timer",
    "AES-GCM-256 encryption happens in your browser, never on the server",
    "Real-time via WebSockets — instant across all participants",
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.65, ease: EASE }}
      style={{ position: "relative", overflow: "hidden" }}
    >
      {/* Card shell — orange perimeter glow */}
      <div
        style={{
          borderRadius: "1.25rem",
          border: `1px solid rgba(249,115,22,0.20)`,
          background: T.surface0,
          boxShadow: "0 0 0 1px rgba(249,115,22,0.06), 0 16px 48px rgba(249,115,22,0.07)",
          overflow: "hidden",
        }}
      >
        {/* Orange accent top-border gradient */}
        <div
          aria-hidden="true"
          style={{
            height: "1px",
            background: "linear-gradient(90deg, rgba(249,115,22,0.75) 0%, rgba(249,115,22,0.25) 50%, transparent 100%)",
          }}
        />

        {/* Card body */}
        <div
          style={{
            padding: "clamp(1.75rem, 4vw, 2.5rem)",
            display: "grid",
            /* Two columns on ≥768px, stacked on mobile */
            gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))",
            gap: "clamp(1.5rem, 3vw, 2.5rem)",
            alignItems: "center",
          }}
        >
          {/* ── Left: product intro text ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

            {/* Product badge */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
              <div
                style={{
                  width: 40, height: 40, borderRadius: "0.625rem",
                  background: "rgba(249,115,22,0.10)",
                  border: "1px solid rgba(249,115,22,0.25)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Flame size={20} style={{ color: T.orange }} />
              </div>
              <div>
                <p
                  style={{
                    fontSize: "var(--text-2xs)", fontWeight: 700,
                    letterSpacing: "0.09em", textTransform: "uppercase",
                    color: T.orange, opacity: 0.85,
                    marginBottom: "0.1rem",
                  }}
                >
                  Also in BAR Web
                </p>
                <p
                  style={{
                    fontSize: "1.125rem", fontWeight: 700,
                    letterSpacing: "-0.03em", color: T.textPrimary,
                    lineHeight: 1.2,
                  }}
                >
                  Burn Chat
                </p>
              </div>
            </div>

            {/* Tagline */}
            <p
              style={{
                fontSize: "clamp(1.25rem, 2.5vw, 1.625rem)",
                fontWeight: 700, letterSpacing: "-0.03em",
                color: T.textPrimary, lineHeight: 1.25,
              }}
            >
              Secure conversations
              <span
                style={{
                  display: "block",
                  background: "linear-gradient(135deg, #FB923C 0%, #F97316 45%, #EA6010 100%)",
                  WebkitBackgroundClip: "text", backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                that vanish.
              </span>
            </p>

            {/* Differentiator bullets */}
            <ul
              style={{
                listStyle: "none", padding: 0, margin: 0,
                display: "flex", flexDirection: "column", gap: "0.625rem",
              }}
            >
              {BULLETS.map((bullet) => (
                <li
                  key={bullet}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: "0.625rem",
                    fontSize: "var(--text-sm)", color: T.textSecondary,
                    lineHeight: 1.6,
                  }}
                >
                  <CheckCircle
                    size={15}
                    style={{ color: T.orange, flexShrink: 0, marginTop: "0.15em" }}
                  />
                  {bullet}
                </li>
              ))}
            </ul>

            {/* CTA */}
            <div>
              <button
                onClick={onBurnChat}
                style={{
                  display: "inline-flex", alignItems: "center", gap: "0.5rem",
                  minHeight: 48,
                  padding: "0.75rem 1.75rem",
                  fontSize: "var(--text-base)", fontWeight: 700,
                  letterSpacing: "-0.015em",
                  color: "#fff",
                  background: "linear-gradient(160deg, #FB923C 0%, #F97316 50%, #EA6010 100%)",
                  border: "none", borderRadius: "999px", cursor: "pointer",
                  boxShadow: "0 4px 20px rgba(249,115,22,0.30)",
                  transition: "transform 0.18s ease, box-shadow 0.18s ease",
                  whiteSpace: "nowrap",
                }}
                onMouseOver={e => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 6px 28px rgba(249,115,22,0.40)";
                }}
                onMouseOut={e => {
                  e.currentTarget.style.transform = "";
                  e.currentTarget.style.boxShadow = "0 4px 20px rgba(249,115,22,0.30)";
                }}
              >
                <Flame size={16} />
                Try Burn Chat
                <ArrowRight size={15} />
              </button>
            </div>
          </div>

          {/* ── Right: mini feature card grid ── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "0.75rem",
            }}
          >
            {BURN_CHAT_FEATURES.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-20px" }}
                  transition={{ duration: 0.5, ease: EASE, delay: i * 0.07 }}
                  style={{
                    padding: "1rem",
                    borderRadius: "0.875rem",
                    border: `1px solid rgba(255,255,255,0.07)`,
                    background: "rgba(255,255,255,0.025)",
                    display: "flex", flexDirection: "column", gap: "0.625rem",
                    /* Subtle hover lift — pure CSS via transition */
                    transition: "border-color 0.2s ease, background 0.2s ease",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = `${feature.accentColor}35`;
                    e.currentTarget.style.background = `${feature.accentColor}06`;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)";
                    e.currentTarget.style.background = "rgba(255,255,255,0.025)";
                  }}
                >
                  {/* Icon box */}
                  <div
                    style={{
                      width: 36, height: 36, borderRadius: "0.5rem",
                      background: `${feature.accentColor}12`,
                      border: `1px solid ${feature.accentColor}28`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={17} style={{ color: feature.accentColor }} />
                  </div>

                  {/* Title */}
                  <p
                    style={{
                      fontSize: "var(--text-sm)", fontWeight: 600,
                      letterSpacing: "-0.02em", color: T.textPrimary,
                      lineHeight: 1.3,
                    }}
                  >
                    {feature.title}
                  </p>

                  {/* Description */}
                  <p
                    style={{
                      fontSize: "var(--text-xs)",   /* 12px — compact for mini-cards */
                      color: T.textSecondary,
                      lineHeight: 1.6, margin: 0,
                    }}
                  >
                    {feature.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────
   MAIN — LandingPage
───────────────────────────────────────────────────────────── */
const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="page-wrapper">

      {/* ── Ambient background (fixed, pointer-events off) ── */}
      <div aria-hidden="true" style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        {/* Dot grid */}
        <div className="bg-grid" style={{ position: "absolute", inset: 0, opacity: 0.45 }} />

        {/* Radial gold glow — top-center */}
        <div
          style={{
            position: "absolute", top: "-18%", left: "50%",
            transform: "translateX(-50%)",
            width: "clamp(320px, 60vw, 800px)",
            height: "clamp(320px, 60vw, 800px)",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(232,160,32,0.07) 0%, transparent 65%)",
            animation: "glow-pulse 7s ease-in-out infinite",
          }}
        />

        {/* Warm tint — bottom right corner */}
        <div
          style={{
            position: "absolute", bottom: "0%", right: "-5%",
            width: "clamp(200px, 35vw, 480px)",
            height: "clamp(200px, 35vw, 480px)",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(200,137,58,0.04) 0%, transparent 65%)",
          }}
        />

        {/* Cool blue accent — bottom left */}
        <div
          style={{
            position: "absolute", bottom: "10%", left: "-8%",
            width: "clamp(160px, 25vw, 360px)",
            height: "clamp(160px, 25vw, 360px)",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(107,127,212,0.03) 0%, transparent 65%)",
          }}
        />
      </div>

      {/* ── Navbar ── */}
      <Navbar onLaunch={() => navigate("/app")} />

      {/* ── Main content ── */}
      <main className="main-content" style={{ position: "relative", zIndex: 1 }}>

        {/* ════════════════════════════════════════════
            HERO SECTION
            minHeight: 100vh + justifyContent: center is the
            source of truth for vertical centering — flexbox
            handles it, padding does NOT.

            padding-top must only clear the fixed navbar:
              mobile : 56px navbar + ~16px gap = ~4.5rem
              desktop: 60px navbar + ~28px gap = ~5.5rem
            clamp(4.5rem, 7vw, 5.5rem) covers this range.

            Avoid large top padding values (e.g. 9rem, 10vw)
            — they stack on top of the navbar offset and create
            a dead zone before the headline on large viewports.
        ════════════════════════════════════════════ */}
        <section
          style={{
            minHeight: "100vh",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            /*
             * top:    clamp(4.5rem, 7vw, 5.5rem)
             *   min 72px → clears 56px navbar + breathing room on phones
             *   max 88px → clears 60px navbar + comfortable gap on desktop
             *   10vw/9rem (old) = up to 144px — excessive, created dead zone
             *
             * inline: clamp(1rem, 4vw, 1.5rem) — unchanged, correct
             *
             * bottom: clamp(2.5rem, 4vw, 4rem)
             *   keeps the trust-bar from being flush with the next section
             *   on tall viewports where flex centering leaves extra space
             */
            padding: "clamp(4.5rem, 7vw, 5.5rem) clamp(1rem, 4vw, 1.5rem) clamp(2.5rem, 4vw, 4rem)",
          }}
        >
          <div style={{ width: "100%", maxWidth: "min(40rem, 100%)", margin: "0 auto" }}>
            <HeroBadge />
            <HeroTitle />
            <HeroSubtitle />
            <HeroCTA
              onLaunch={()  => navigate("/app")}
              onBurnChat={() => navigate("/burn-chat")}
            />
            <TrustBar />
          </div>
        </section>

        {/* ════════════════════════════════════════════
            FEATURES SECTION
            2×2 grid on md+, 1-col on mobile.
            Uses .feature-grid from index.css for
            auto-fit responsive columns.
        ════════════════════════════════════════════ */}
        <section
          style={{
            padding: "clamp(4rem, 7vw, 7rem) 0 clamp(4rem, 7vw, 8rem)",
            borderTop: `1px solid ${T.border}`,
          }}
        >
          <div className="container-app">
            {/* ── File sealing section header ── */}
            <SectionHeader
              eyebrow="Why BAR Web"
              heading="Built for security-first sharing"
              subtext="Every feature exists to minimise trust and maximise privacy. No accounts, no logs, no exceptions."
              accentColor={T.gold}
            />

            {/* File-sealing feature cards — 2×2 grid on md+, 1-col on mobile */}
            <div className="feature-grid">
              {FEATURES.map((feature, i) => (
                <FeatureCard key={feature.title} {...feature} index={i} />
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════
            BURN CHAT SECTION
            Positioned between file features and the
            bottom CTA to naturally guide the visitor
            from "file sealing" → "real-time chat".
            Both are products on this platform — this
            section gives BurnChat its own narrative.
        ════════════════════════════════════════════ */}
        <section
          style={{
            padding: "0 0 clamp(4rem, 7vw, 7rem)",
          }}
        >
          <div className="container-app">
            <BurnChatHighlight onBurnChat={() => navigate("/burn-chat")} />
          </div>
        </section>

        {/* ════════════════════════════════════════════
            BOTTOM CTA STRIP
            Encourages conversion from features scroll.
        ════════════════════════════════════════════ */}
        <section
          style={{
            padding: "clamp(3rem, 5vw, 5rem) clamp(1rem, 4vw, 2rem)",
            borderTop: `1px solid ${T.border}`,
            display: "flex", flexDirection: "column",
            alignItems: "center", gap: "1.25rem",
            textAlign: "center",
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, ease: EASE }}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1.25rem" }}
          >
            <h2
              style={{
                fontSize: "clamp(1.25rem, 3vw, 1.75rem)",
                fontWeight: 700, letterSpacing: "-0.03em",
                color: T.textPrimary, lineHeight: 1.2,
              }}
            >
              Ready to seal your first file?
            </h2>
            <p style={{ fontSize: "var(--text-sm)", color: T.textSecondary, maxWidth: "min(26rem, 100%)", lineHeight: 1.7 }}>
              No account required. Encrypt, share, and let it disappear — in under 30 seconds.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", justifyContent: "center" }}>
              <button
                onClick={() => navigate("/app")}
                className="btn-primary"
                style={{ padding: "0.8125rem 2rem" }}
              >
                Start Sealing
                <ArrowRight size={16} />
              </button>
              <button
                onClick={() => navigate("/burn-chat")}
                style={{
                  display: "inline-flex", alignItems: "center", gap: "0.5rem",
                  minHeight: 48, padding: "0.8125rem 1.625rem",
                  fontSize: "var(--text-base)", fontWeight: 600, letterSpacing: "-0.015em",
                  color: T.orange,
                  background: T.orangeDim,
                  border: `1px solid ${T.orangeBorder}`,
                  borderRadius: "var(--r-full)", cursor: "pointer",
                  transition: "background 0.2s ease, border-color 0.2s ease, transform 0.2s ease",
                  whiteSpace: "nowrap",
                }}
                onMouseOver={e => {
                  e.currentTarget.style.background = T.orangeHover;
                  e.currentTarget.style.borderColor = T.orangeBorderHover;
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseOut={e => {
                  e.currentTarget.style.background = T.orangeDim;
                  e.currentTarget.style.borderColor = T.orangeBorder;
                  e.currentTarget.style.transform = "";
                }}
              >
                <Flame size={16} />
                Try Burn Chat
              </button>
            </div>
          </motion.div>
        </section>

        {/* ════════════════════════════════════════════
            FOOTER
            Color raised: #2a2a2a → --text-tertiary (#636363)
            Font raised:  13px → 14px
            Year: auto-updated via new Date().getFullYear()
        ════════════════════════════════════════════ */}
        <footer
          style={{
            borderTop: `1px solid ${T.border}`,
            padding: "1.5rem clamp(1rem, 4vw, 2rem)",
            display: "flex", flexWrap: "wrap",
            alignItems: "center", justifyContent: "space-between",
            gap: "0.75rem",
          }}
        >
          {/* Copyright */}
          <p
            style={{
              fontSize: "var(--text-sm)",        /* 14px — raised from 13px */
              color: T.textTertiary,              /* #636363 — raised from #2a2a2a (invisible) */
              letterSpacing: "-0.01em",
              lineHeight: 1.5,
            }}
          >
            © {new Date().getFullYear()}{" "}
            <span style={{ color: T.goldMuted, fontWeight: 600 }}>BAR Web</span>
            {" "}— Built for privacy.
          </p>

          {/* Footer links */}
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <a
              href="https://github.com/Mrtracker-new/BAR_RYY"
              target="_blank" rel="noreferrer"
              style={{
                fontSize: "var(--text-xs)",      /* 12px — fine for footer links */
                color: T.textDim,
                display: "inline-flex", alignItems: "center", gap: "0.3rem",
                transition: "color 0.18s ease",
              }}
              onMouseOver={e => { e.currentTarget.style.color = T.textSecondary; }}
              onMouseOut={e  => { e.currentTarget.style.color = T.textDim; }}
            >
              <Github size={12} />
              Source
            </a>
            <a
              href="https://rolan-rnr.netlify.app"
              target="_blank" rel="noreferrer"
              style={{
                fontSize: "var(--text-xs)",
                color: T.textDim,
                display: "inline-flex", alignItems: "center", gap: "0.3rem",
                transition: "color 0.18s ease",
              }}
              onMouseOver={e => { e.currentTarget.style.color = T.textSecondary; }}
              onMouseOut={e  => { e.currentTarget.style.color = T.textDim; }}
            >
              <ExternalLink size={12} />
              Portfolio
            </a>
          </div>
        </footer>

      </main>
    </div>
  );
};

export default LandingPage;
