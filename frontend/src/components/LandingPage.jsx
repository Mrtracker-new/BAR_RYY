import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Shield,
  Zap,
  Lock,
  Clock,
  PackageOpen,
  ArrowRight,
  Github,
  ExternalLink,
  Power,
} from "lucide-react";
import WakeUpButton from "./WakeUpButton";

/* ─────────────────────────────────────────────
   Animation variants
───────────────────────────────────────────── */
const EASE = [0.16, 1, 0.3, 1];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
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
    accentColor: "#8B5CF6",
    title: "Zero Knowledge",
    description:
      "We never see your data. Only the recipient possesses the decryption key.",
  },
  {
    icon: Clock,
    accentColor: "#38BDF8",
    title: "Custom Expiry",
    description:
      "Define exact time-to-live windows. Minutes, hours, or days — your rules.",
  },
];

const STATS = [
  { label: "AES-256 Encrypted" },
  { label: "Zero Server Logs" },
  { label: "Self-Destructing" },
  { label: "Open Source" },
];

/* ─────────────────────────────────────────────
   Sub-components
───────────────────────────────────────────── */

function Navbar({ onLaunch }) {
  return (
    <nav className="navbar">
      <div className="container-app w-full flex items-center justify-between mx-auto">
        {/* Logo */}
        <button
          onClick={onLaunch}
          className="flex items-center gap-2.5 group"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
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
              color: "#f0f0f0",
              transition: "color 0.25s ease",
            }}
            className="group-hover:text-white"
          >
            BAR Web
          </span>
        </button>

        {/* Nav links */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <a
            href="https://github.com/Mrtracker-new/BAR_RYY"
            target="_blank"
            rel="noreferrer"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
              padding: "0.375rem 0.75rem",
              fontSize: "0.8125rem",
              fontWeight: 500,
              color: "#666666",
              borderRadius: "0.5rem",
              transition: "color 0.2s ease, background 0.2s ease",
              textDecoration: "none",
            }}
            className="hover:text-white hover:bg-white/5"
          >
            <Github size={14} />
            GitHub
          </a>
          <a
            href="https://rolan-rnr.netlify.app"
            target="_blank"
            rel="noreferrer"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
              padding: "0.375rem 0.75rem",
              fontSize: "0.8125rem",
              fontWeight: 500,
              color: "#666666",
              borderRadius: "0.5rem",
              transition: "color 0.2s ease, background 0.2s ease",
              textDecoration: "none",
            }}
            className="hover:text-white hover:bg-white/5"
          >
            <ExternalLink size={14} />
            Portfolio
          </a>
        </div>
      </div>
    </nav>
  );
}

function HeroBadge() {
  return (
    <motion.div {...fadeIn(0.1)} style={{ display: "flex", justifyContent: "center", marginBottom: "2rem" }}>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.3125rem 0.875rem",
          borderRadius: "999px",
          background: "rgba(232,160,32,0.08)",
          border: "1px solid rgba(232,160,32,0.18)",
          fontSize: "0.75rem",
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "#E8A020",
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
        Secure File Transmission
      </div>
    </motion.div>
  );
}

function HeroTitle() {
  return (
    <motion.div {...fadeUp(0.2)} style={{ textAlign: "center", marginBottom: "1.5rem" }}>
      <h1
        style={{
          fontSize: "clamp(3rem, 9vw, 7rem)",
          fontWeight: 800,
          letterSpacing: "-0.05em",
          lineHeight: 0.92,
          color: "#f0f0f0",
        }}
      >
        <span
          className="glow-text"
          style={{
            display: "block",
            background: "linear-gradient(135deg, #FBBF24 0%, #E8A020 45%, #D08000 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Burn After
        </span>
        <span style={{ display: "block", color: "#333333", marginTop: "0.05em" }}>
          Reading
        </span>
      </h1>
    </motion.div>
  );
}

function HeroSubtitle() {
  return (
    <motion.p
      {...fadeUp(0.3)}
      style={{
        textAlign: "center",
        fontSize: "clamp(1rem, 2.5vw, 1.125rem)",
        fontWeight: 400,
        lineHeight: 1.7,
        color: "#666666",
        maxWidth: "26rem",
        margin: "0 auto 2.5rem",
      }}
    >
      The most secure way to share sensitive documents.{" "}
      <span style={{ color: "#999999" }}>Encrypted, anonymous, designed to disappear.</span>
    </motion.p>
  );
}

function HeroCTA({ onLaunch }) {
  return (
    <motion.div
      {...fadeUp(0.4)}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "1rem",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.625rem",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <motion.button
          onClick={onLaunch}
          className="btn-primary"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          style={{ padding: "0.8125rem 2rem", fontSize: "0.9375rem" }}
        >
          Start Sealing
          <ArrowRight size={16} />
        </motion.button>
        {/* WakeUpButton — wrapped to control sizing */}
        <div style={{ flexShrink: 0 }}>
          <WakeUpButton compact />
        </div>
      </div>

      <p
        style={{
          fontSize: "0.7188rem",
          color: "#3a3a3a",
          textAlign: "center",
          maxWidth: "24rem",
          lineHeight: 1.5,
        }}
      >
        💤 Server may be sleeping (free tier). "Wake Server" takes ~50s.
      </p>
    </motion.div>
  );
}

function StatsBar() {
  return (
    <motion.div
      {...fadeIn(0.5)}
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: "0.25rem 1.5rem",
        marginTop: "4rem",
        paddingTop: "3rem",
        borderTop: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      {STATS.map((s, i) => (
        <React.Fragment key={i}>
          {i > 0 && (
            <span
              style={{
                width: 3,
                height: 3,
                borderRadius: "50%",
                background: "#2a2a2a",
                alignSelf: "center",
                display: "none",
              }}
              className="hidden sm:block"
            />
          )}
          <span
            style={{
              fontSize: "0.8125rem",
              fontWeight: 500,
              color: "#444444",
              letterSpacing: "-0.01em",
            }}
          >
            {s.label}
          </span>
        </React.Fragment>
      ))}
    </motion.div>
  );
}

function FeatureCard({ icon: Icon, title, description, accentColor, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.6, ease: EASE, delay: index * 0.08 }}
      className="feature-card"
      style={{ "--accent": accentColor }}
    >
      {/* Icon */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "0.625rem",
          background: `${accentColor}14`,
          border: `1px solid ${accentColor}25`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "1.125rem",
          transition: "background 0.3s ease, border-color 0.3s ease",
        }}
      >
        <Icon size={18} style={{ color: accentColor }} />
      </div>

      <h3
        style={{
          fontSize: "0.9375rem",
          fontWeight: 600,
          letterSpacing: "-0.01em",
          color: "#dedede",
          marginBottom: "0.5rem",
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: "0.8125rem",
          lineHeight: 1.65,
          color: "#555555",
        }}
      >
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
        minHeight: "100vh",
        background: "#080808",
        color: "#f0f0f0",
        overflowX: "hidden",
        position: "relative",
      }}
    >
      {/* Ambient background */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        {/* Grid */}
        <div
          className="bg-grid"
          style={{ position: "absolute", inset: 0, opacity: 0.6 }}
        />

        {/* Radial amber glow — top center */}
        <div
          style={{
            position: "absolute",
            top: "-20%",
            left: "50%",
            transform: "translateX(-50%)",
            width: "60vw",
            height: "60vw",
            maxWidth: 800,
            maxHeight: 800,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(232,160,32,0.07) 0%, transparent 65%)",
            animation: "glow-pulse 5s ease-in-out infinite",
          }}
        />

        {/* Soft violet — bottom left */}
        <div
          style={{
            position: "absolute",
            bottom: "10%",
            left: "-10%",
            width: "40vw",
            height: "40vw",
            maxWidth: 600,
            maxHeight: 600,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 65%)",
          }}
        />
      </div>

      {/* Navbar */}
      <Navbar onLaunch={() => navigate("/app")} />

      {/* Main content */}
      <main style={{ position: "relative", zIndex: 1 }}>
        {/* ── Hero ─────────────── */}
        <section
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "7rem 1.25rem 4rem",
          }}
        >
          <div style={{ width: "100%", maxWidth: "42rem", margin: "0 auto" }}>
            <HeroBadge />
            <HeroTitle />
            <HeroSubtitle />
            <HeroCTA onLaunch={() => navigate("/app")} />
            <StatsBar />
          </div>
        </section>

        {/* ── Features ─────────── */}
        <section
          style={{
            padding: "5rem 1.25rem 7rem",
            borderTop: "1px solid rgba(255,255,255,0.04)",
          }}
        >
          <div className="container-app" style={{ margin: "0 auto" }}>
            {/* Section header */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: EASE }}
              style={{ textAlign: "center", marginBottom: "3rem" }}
            >
              <p
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#E8A020",
                  marginBottom: "0.75rem",
                }}
              >
                Why BAR Web
              </p>
              <h2
                style={{
                  fontSize: "clamp(1.5rem, 3.5vw, 2.25rem)",
                  fontWeight: 700,
                  letterSpacing: "-0.03em",
                  color: "#d0d0d0",
                  lineHeight: 1.15,
                }}
              >
                Built for security-first sharing
              </h2>
            </motion.div>

            {/* Cards grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "1rem",
              }}
              className="sm:grid-cols-2 lg:grid-cols-4"
            >
              {FEATURES.map((f, i) => (
                <FeatureCard key={i} {...f} index={i} />
              ))}
            </div>
          </div>
        </section>

        {/* ── Footer ───────────── */}
        <footer
          style={{
            borderTop: "1px solid rgba(255,255,255,0.04)",
            padding: "1.75rem 1.25rem",
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: "0.8125rem", color: "#333333" }}>
            © 2025{" "}
            <span style={{ color: "#E8A020", fontWeight: 600 }}>BAR Web</span>
            {" "}— Built for privacy.
          </p>
        </footer>
      </main>
    </div>
  );
};

export default LandingPage;
