import React from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Shield, Zap, Lock, Clock,
  PackageOpen, ArrowRight, Github, ExternalLink,
} from "lucide-react";
import WakeUpButton from "./WakeUpButton";

/* ─────────────────────────────────────────────
   Animation helpers
───────────────────────────────────────────── */
const EASE = [0.16, 1, 0.3, 1];
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.65, ease: EASE, delay },
});
const fadeIn = (delay = 0) => ({
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.5, ease: EASE, delay },
});

/* ─────────────────────────────────────────────
   Feature data
───────────────────────────────────────────── */
const FEATURES = [
  {
    icon: Shield,
    accentColor: "#22C55E",
    title: "AES-256 Encryption",
    description:
      "Military-grade symmetric encryption. Your data is sealed before it ever leaves your browser.",
  },
  {
    icon: Zap,
    accentColor: "#E8A020",
    title: "Self-Destruct",
    description:
      "Files vanish permanently after the view limit or expiry window is reached. No traces remain.",
  },
  {
    icon: Lock,
    accentColor: "#C8893A",
    title: "Zero Knowledge",
    description:
      "We never see your data. Only the recipient possesses the decryption key.",
  },
  {
    icon: Clock,
    accentColor: "#888888",
    title: "Custom Expiry",
    description:
      "Define exact time-to-live windows. Minutes, hours, or days — your rules.",
  },
];

const TRUST_ITEMS = [
  "AES-256 Encrypted",
  "Zero Server Logs",
  "Self-Destructing",
  "Open Source",
];

/* ─────────────────────────────────────────────
   Navbar
───────────────────────────────────────────── */
function Navbar({ onLaunch }) {
  return (
    <nav
      style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        height: 52,
        display: "flex", alignItems: "center",
        background: "rgba(7,7,7,0.90)",
        backdropFilter: "blur(20px) saturate(150%)",
        WebkitBackdropFilter: "blur(20px) saturate(150%)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="container-app" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {/* Logo */}
        <button
          onClick={onLaunch}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}
        >
          <div
            style={{
              width: 28, height: 28, borderRadius: "0.4rem",
              background: "rgba(232,160,32,0.10)", border: "1px solid rgba(232,160,32,0.20)",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.25s ease",
            }}
          >
            <PackageOpen size={14} style={{ color: "#E8A020" }} />
          </div>
          <span
            style={{
              fontSize: "0.9rem", fontWeight: 600, letterSpacing: "-0.025em", color: "#d0d0d0",
              transition: "color 0.25s ease",
            }}
          >
            BAR Web
          </span>
        </button>

        {/* Nav links */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.125rem" }}>
          <a
            href="https://github.com/Mrtracker-new/BAR_RYY"
            target="_blank" rel="noreferrer"
            style={{
              display: "flex", alignItems: "center", gap: "0.375rem",
              padding: "0.375rem 0.75rem", fontSize: "0.8125rem", fontWeight: 500,
              color: "#555555", borderRadius: "0.5rem",
              transition: "color 0.2s ease", textDecoration: "none",
            }}
            onMouseOver={e => { e.currentTarget.style.color = "#aaaaaa"; }}
            onMouseOut={e => { e.currentTarget.style.color = "#555555"; }}
          >
            <Github size={13} />
            GitHub
          </a>
          <a
            href="https://rolan-rnr.netlify.app"
            target="_blank" rel="noreferrer"
            style={{
              display: "flex", alignItems: "center", gap: "0.375rem",
              padding: "0.375rem 0.75rem", fontSize: "0.8125rem", fontWeight: 500,
              color: "#555555", borderRadius: "0.5rem",
              transition: "color 0.2s ease", textDecoration: "none",
            }}
            onMouseOver={e => { e.currentTarget.style.color = "#aaaaaa"; }}
            onMouseOut={e => { e.currentTarget.style.color = "#555555"; }}
          >
            <ExternalLink size={13} />
            Portfolio
          </a>
        </div>
      </div>
    </nav>
  );
}

/* ─────────────────────────────────────────────
   Hero badge
───────────────────────────────────────────── */
function HeroBadge() {
  return (
    <motion.div {...fadeIn(0.1)} style={{ display: "flex", justifyContent: "center", marginBottom: "2rem" }}>
      <div
        style={{
          display: "inline-flex", alignItems: "center", gap: "0.5rem",
          padding: "0.3125rem 0.875rem", borderRadius: "999px",
          background: "rgba(232,160,32,0.07)", border: "1px solid rgba(232,160,32,0.16)",
          fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em",
          textTransform: "uppercase", color: "#C8893A",
        }}
      >
        <span
          style={{
            width: 5, height: 5, borderRadius: "50%",
            background: "#22C55E", boxShadow: "0 0 5px rgba(34,197,94,0.8)",
            animation: "pulse 2s infinite",
          }}
        />
        Secure File Transmission
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
   Hero title
───────────────────────────────────────────── */
function HeroTitle() {
  return (
    <motion.div {...fadeUp(0.2)} style={{ textAlign: "center", marginBottom: "1.625rem" }}>
      <h1
        style={{
          fontSize: "clamp(3.25rem, 9vw, 7.5rem)",
          fontWeight: 800, letterSpacing: "-0.055em", lineHeight: 0.91,
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
        <span style={{ display: "block", color: "#2e2e2e", marginTop: "0.06em" }}>
          Reading
        </span>
      </h1>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
   Hero subtitle
───────────────────────────────────────────── */
function HeroSubtitle() {
  return (
    <motion.p
      {...fadeUp(0.3)}
      style={{
        textAlign: "center",
        fontSize: "clamp(0.9375rem, 2vw, 1.0625rem)",
        fontWeight: 400, lineHeight: 1.7,
        color: "#555555",
        maxWidth: "25rem", margin: "0 auto 2.5rem",
      }}
    >
      The most secure way to share sensitive documents —
      {" "}<span style={{ color: "#7a7a7a" }}>encrypted, anonymous, and designed to disappear.</span>
    </motion.p>
  );
}

/* ─────────────────────────────────────────────
   Hero CTA
───────────────────────────────────────────── */
function HeroCTA({ onLaunch }) {
  return (
    <motion.div
      {...fadeUp(0.4)}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}
    >
      <div
        style={{
          display: "flex", flexWrap: "wrap", gap: "0.625rem",
          justifyContent: "center", alignItems: "center",
        }}
      >
        <button
          onClick={onLaunch}
          className="btn-primary"
          style={{ padding: "0.875rem 2.25rem", fontSize: "0.9375rem" }}
        >
          Start Sealing
          <ArrowRight size={15} />
        </button>
        <div style={{ flexShrink: 0 }}>
          <WakeUpButton compact />
        </div>
      </div>

      <p
        style={{
          fontSize: "0.6875rem", color: "#303030",
          textAlign: "center", maxWidth: "22rem", lineHeight: 1.5,
        }}
      >
        💤 Server may be sleeping (free tier). "Wake Server" takes ~50s.
      </p>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
   Trust bar
───────────────────────────────────────────── */
function TrustBar() {
  return (
    <motion.div
      {...fadeIn(0.55)}
      style={{
        display: "flex", flexWrap: "wrap",
        justifyContent: "center", alignItems: "center",
        gap: "0 1.75rem", marginTop: "3.5rem", paddingTop: "2.5rem",
        borderTop: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      {TRUST_ITEMS.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && (
            <span
              style={{
                width: 3, height: 3, borderRadius: "50%",
                background: "#202020", display: "block",
              }}
            />
          )}
          <span
            style={{
              fontSize: "0.8125rem", fontWeight: 500,
              color: "#363636", letterSpacing: "-0.01em",
            }}
          >
            {item}
          </span>
        </React.Fragment>
      ))}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
   Feature card
───────────────────────────────────────────── */
function FeatureCard({ icon: Icon, title, description, accentColor, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.6, ease: EASE, delay: index * 0.07 }}
      className="feature-card"
    >
      {/* Accent top border */}
      <div
        style={{
          position: "absolute", top: -1, left: 0, right: 0, height: "1px",
          background: `linear-gradient(90deg, ${accentColor}55 0%, ${accentColor}18 50%, transparent 100%)`,
        }}
      />

      {/* Icon */}
      <div
        style={{
          width: 40, height: 40, borderRadius: "0.625rem",
          background: `${accentColor}10`, border: `1px solid ${accentColor}22`,
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: "1.125rem",
          transition: "background 0.3s ease, border-color 0.3s ease",
        }}
      >
        <Icon size={17} style={{ color: accentColor }} />
      </div>

      <h3
        style={{
          fontSize: "0.9375rem", fontWeight: 600, letterSpacing: "-0.02em",
          color: "#d8d8d8", marginBottom: "0.5rem",
        }}
      >
        {title}
      </h3>
      <p style={{ fontSize: "0.8125rem", lineHeight: 1.65, color: "#484848" }}>
        {description}
      </p>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
   Main LandingPage
───────────────────────────────────────────── */
const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: "100vh", background: "#070707",
        color: "#efefef", overflowX: "hidden", position: "relative",
      }}
    >
      {/* Ambient background */}
      <div
        aria-hidden="true"
        style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}
      >
        {/* Grid */}
        <div className="bg-grid" style={{ position: "absolute", inset: 0, opacity: 0.5 }} />

        {/* Radial amber glow — top center */}
        <div
          style={{
            position: "absolute", top: "-15%", left: "50%",
            transform: "translateX(-50%)",
            width: "55vw", height: "55vw",
            maxWidth: 750, maxHeight: 750, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(232,160,32,0.06) 0%, transparent 65%)",
            animation: "glow-pulse 6s ease-in-out infinite",
          }}
        />

        {/* Soft warm tint — bottom right */}
        <div
          style={{
            position: "absolute", bottom: "5%", right: "0%",
            width: "30vw", height: "30vw", maxWidth: 400, maxHeight: 400,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(200,137,58,0.035) 0%, transparent 65%)",
          }}
        />
      </div>

      {/* Navbar */}
      <Navbar onLaunch={() => navigate("/app")} />

      {/* Main content */}
      <main style={{ position: "relative", zIndex: 1 }}>
        {/* ── Hero ── */}
        <section
          style={{
            minHeight: "100vh",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            padding: "8rem 1.25rem 5rem",
          }}
        >
          <div style={{ width: "100%", maxWidth: "40rem", margin: "0 auto" }}>
            <HeroBadge />
            <HeroTitle />
            <HeroSubtitle />
            <HeroCTA onLaunch={() => navigate("/app")} />
            <TrustBar />
          </div>
        </section>

        {/* ── Features ── */}
        <section
          style={{
            padding: "5rem 1.25rem 7rem",
            borderTop: "1px solid rgba(255,255,255,0.04)",
          }}
        >
          <div className="container-app" style={{ margin: "0 auto" }}>
            {/* Section header */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: EASE }}
              style={{ textAlign: "center", marginBottom: "3rem" }}
            >
              <p
                style={{
                  fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.09em",
                  textTransform: "uppercase", color: "rgba(232,160,32,0.7)", marginBottom: "0.75rem",
                }}
              >
                Why BAR Web
              </p>
              <h2
                style={{
                  fontSize: "clamp(1.5rem, 3.5vw, 2.125rem)",
                  fontWeight: 700, letterSpacing: "-0.03em",
                  color: "#c8c8c8", lineHeight: 1.15,
                }}
              >
                Built for security-first sharing
              </h2>
            </motion.div>

            {/* 2×2 cards grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "1rem",
              }}
            >
              {FEATURES.map((f, i) => (
                <FeatureCard key={i} {...f} index={i} />
              ))}
            </div>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer
          style={{
            borderTop: "1px solid rgba(255,255,255,0.04)",
            padding: "1.5rem 1.25rem",
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: "0.8125rem", color: "#2a2a2a", letterSpacing: "-0.01em" }}>
            © 2025{" "}
            <span style={{ color: "#C8893A", fontWeight: 600 }}>BAR Web</span>
            {" "}— Built for privacy.
          </p>
        </footer>
      </main>
    </div>
  );
};

export default LandingPage;
