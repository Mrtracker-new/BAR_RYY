import React, { useState } from "react";
import {
  Shield, Lock, Eye, Clock, Zap, FileCheck,
  Flame, MessageSquare, ChevronDown, ChevronUp,
  ShieldOff, KeyRound,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────
   SEO CONTENT
   Rendered below the fold on /app. Serves two purposes:
   1. SEO signal — rich structured copy for search crawlers
   2. User education — collapsible sections anyone can open

   Copy principles applied throughout:
   • Accurate — every technical claim maps to actual behaviour
   • Specific — prefer "AES-256 with PBKDF2-100k" over "military-grade"
   • Professional — no pop-culture references, no hype
   • Dual-product — File Sealing and Burn Chat both covered
───────────────────────────────────────────────────────────── */
const SEOContent = () => {
  const [openSection, setOpenSection] = useState(null);

  const toggleSection = (section) => {
    setOpenSection(openSection === section ? null : section);
  };

  return (
    <div className="max-w-7xl mx-auto mt-16 space-y-8">

      {/* ── Hero / Main SEO Content ── */}
      <section className="bg-gradient-to-br from-dark-800 to-dark-900 rounded-2xl p-8 border border-dark-700 shadow-2xl">
        {/*
          This heading sits inside the app view — it is intentionally
          NOT an <h1>. The page-level h1 lives in the navbar/logo area.
          Using <h2> avoids a duplicate h1 on /app.
        */}
        <h2 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-gold-400 via-gold-500 to-gold-600 bg-clip-text text-transparent mb-6">
          BAR — Burn After Reading: Secure Self-Destructing Files &amp; Ephemeral Chat
        </h2>
        <p className="text-lg text-gray-300 leading-relaxed mb-6">
          <strong>BAR (Burn After Reading)</strong> is a dual-feature privacy platform — seal
          files that self-destruct after viewing, or open a <strong>Burn Chat</strong> session
          whose messages are permanently erased the moment its countdown expires. Whether you
          need to transmit confidential business documents or hold a sensitive conversation with
          no stored record, BAR applies AES-256 encryption for files and end-to-end AES-GCM-256
          with ECDH P-256 key exchange for chat — under a strict zero-knowledge, zero-log
          architecture.
        </p>
        <p className="text-lg text-gray-300 leading-relaxed">
          Unlike conventional file transfer or messaging services, BAR is purpose-built for{" "}
          <strong>temporary, self-destructing data</strong>. Configure view limits, add password
          protection with PBKDF2 key derivation, and set time-based expiry for files. Or spin up
          a Burn Chat room whose entire history — messages, keys, participants — is wiped clean
          the instant the timer reaches zero. No accounts required. No logs kept. Nothing
          recoverable after destruction.
        </p>
      </section>

      {/* ── Features Grid — Collapsible ── */}
      <section className="bg-gradient-to-br from-dark-800 to-dark-900 rounded-2xl border border-dark-700 shadow-2xl overflow-hidden">
        <button
          onClick={() => toggleSection('features')}
          className="w-full p-6 flex items-center justify-between hover:bg-dark-700/50 transition-all"
          aria-expanded={openSection === 'features'}
          aria-controls="features-panel"
        >
          <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent text-left">
            Why Choose BAR for Secure File Sharing &amp; Ephemeral Chat?
          </h2>
          {openSection === 'features' ? (
            <ChevronUp className="text-purple-400 flex-shrink-0" size={28} />
          ) : (
            <ChevronDown className="text-purple-400 flex-shrink-0" size={28} />
          )}
        </button>

        {openSection === 'features' && (
          <div id="features-panel" className="p-6 pt-0 grid md:grid-cols-2 lg:grid-cols-3 gap-6">

            {/* 1 — AES-256 Zero-Knowledge Encryption */}
            <div className="bg-gradient-to-br from-dark-800 to-dark-900 rounded-xl p-6 border border-gold-500/30 hover:border-gold-500/60 transition-all">
              <div className="p-3 bg-gold-500/20 rounded-lg w-fit mb-4">
                <Lock className="text-gold-500" size={28} />
              </div>
              <h3 className="text-xl font-bold text-gold-400 mb-3">AES-256 Zero-Knowledge Encryption</h3>
              <p className="text-gray-300 text-sm leading-relaxed">
                Every file is encrypted client-side with AES-256 before it leaves your browser.
                The decryption key is derived from your password using PBKDF2 (100,000 iterations,
                SHA-256) and never transmitted to the server — so even we cannot read your files.
              </p>
            </div>

            {/* 2 — Self-Destructing Files */}
            <div className="bg-gradient-to-br from-dark-800 to-dark-900 rounded-xl p-6 border border-purple-500/30 hover:border-purple-500/60 transition-all">
              <div className="p-3 bg-purple-500/20 rounded-lg w-fit mb-4">
                <Eye className="text-purple-400" size={28} />
              </div>
              <h3 className="text-xl font-bold text-purple-400 mb-3">Self-Destructing Files</h3>
              <p className="text-gray-300 text-sm leading-relaxed">
                Set a maximum view count — one, two, or any number. The moment the limit is
                reached the server permanently deletes the encrypted payload, making the link
                dead for all future access. View limits are enforced server-side and cannot be
                bypassed by the recipient.
              </p>
            </div>

            {/* 3 — Time-Based Auto-Expiry */}
            <div className="bg-gradient-to-br from-dark-800 to-dark-900 rounded-xl p-6 border border-green-500/30 hover:border-green-500/60 transition-all">
              <div className="p-3 bg-green-500/20 rounded-lg w-fit mb-4">
                <Clock className="text-green-400" size={28} />
              </div>
              <h3 className="text-xl font-bold text-green-400 mb-3">Time-Based Auto-Expiry</h3>
              <p className="text-gray-300 text-sm leading-relaxed">
                Configure files to expire after a custom duration — minutes, hours, or days.
                Expiry is enforced on the server regardless of whether the file has been viewed.
                Once the window closes, access is revoked and the stored data is deleted.
              </p>
            </div>

            {/* 4 — Password Protection */}
            <div className="bg-gradient-to-br from-dark-800 to-dark-900 rounded-xl p-6 border border-blue-500/30 hover:border-blue-500/60 transition-all">
              <div className="p-3 bg-blue-500/20 rounded-lg w-fit mb-4">
                <KeyRound className="text-blue-400" size={28} />
              </div>
              <h3 className="text-xl font-bold text-blue-400 mb-3">Password Protection</h3>
              <p className="text-gray-300 text-sm leading-relaxed">
                Protect files with a password that is never sent to the server. The password
                is used locally to derive an AES-256 key via PBKDF2 (100,000 iterations).
                Optionally enable email OTP two-factor authentication so only pre-authorised
                addresses can open the file.
              </p>
            </div>

            {/* 5 — Brute Force Protection */}
            <div className="bg-gradient-to-br from-dark-800 to-dark-900 rounded-xl p-6 border border-red-500/30 hover:border-red-500/60 transition-all">
              <div className="p-3 bg-red-500/20 rounded-lg w-fit mb-4">
                <ShieldOff className="text-red-400" size={28} />
              </div>
              <h3 className="text-xl font-bold text-red-400 mb-3">Brute Force Protection</h3>
              <p className="text-gray-300 text-sm leading-relaxed">
                Password-protected files are guarded against automated attacks. Progressive
                delays and automatic access lockouts trigger after repeated failed attempts,
                preventing brute-force tools from cycling through password lists.
              </p>
            </div>

            {/* 6 — Secure File Deletion */}
            <div className="bg-gradient-to-br from-dark-800 to-dark-900 rounded-xl p-6 border border-yellow-500/30 hover:border-yellow-500/60 transition-all">
              <div className="p-3 bg-yellow-500/20 rounded-lg w-fit mb-4">
                <FileCheck className="text-yellow-400" size={28} />
              </div>
              <h3 className="text-xl font-bold text-yellow-400 mb-3">Secure File Deletion</h3>
              <p className="text-gray-300 text-sm leading-relaxed">
                When a file expires or its view limit is reached, it is permanently deleted from
                the server. No residual copies, no soft-deletes. The shareable link is immediately
                invalidated — any subsequent access attempt returns a 404.
              </p>
            </div>

            {/* 7 — Burn Chat */}
            <div className="bg-gradient-to-br from-dark-800 to-dark-900 rounded-xl p-6 border border-orange-500/30 hover:border-orange-500/60 transition-all md:col-span-2 lg:col-span-1">
              <div className="p-3 bg-orange-500/20 rounded-lg w-fit mb-4">
                <Flame className="text-orange-400" size={28} />
              </div>
              <h3 className="text-xl font-bold text-orange-400 mb-3">Burn Chat — E2E Encrypted Ephemeral Messaging</h3>
              <p className="text-gray-300 text-sm leading-relaxed">
                Create an ephemeral chat room that self-destructs on a countdown. Messages are
                encrypted end-to-end in your browser using ECDH P-256 key exchange and
                AES-GCM-256 — the server only ever relays ciphertext, never plaintext. When the
                timer expires, the server destroys the session and every message is permanently
                erased from all participants' screens. No chat history is ever stored.
              </p>
            </div>

          </div>
        )}
      </section>

      {/* ── Use Cases — Collapsible ── */}
      <section className="bg-gradient-to-br from-dark-800 to-dark-900 rounded-2xl border border-dark-700 shadow-2xl overflow-hidden">
        <button
          onClick={() => toggleSection('usecases')}
          className="w-full p-6 flex items-center justify-between hover:bg-dark-700/50 transition-all"
          aria-expanded={openSection === 'usecases'}
          aria-controls="usecases-panel"
        >
          <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gold-400 to-gold-600 bg-clip-text text-transparent text-left">
            Perfect Use Cases for BAR
          </h2>
          {openSection === 'usecases' ? (
            <ChevronUp className="text-gold-400 flex-shrink-0" size={28} />
          ) : (
            <ChevronDown className="text-gold-400 flex-shrink-0" size={28} />
          )}
        </button>

        {openSection === 'usecases' && (
          <div id="usecases-panel" className="p-6 pt-0 grid md:grid-cols-2 gap-6">

            <div>
              <h3 className="text-xl font-semibold text-gold-400 mb-3">🏢 Business &amp; Enterprise</h3>
              <ul className="space-y-2 text-gray-300 text-sm">
                <li>• Share confidential contracts and NDAs that expire after signing</li>
                <li>• Distribute temporary access credentials with single-use view limits</li>
                <li>• Send sensitive financial reports with automatic deletion after review</li>
                <li>• Share proprietary designs or prototypes with time-locked access</li>
                <li>• Hold confidential deal discussions in a Burn Chat with no stored transcript</li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-purple-400 mb-3">👤 Personal &amp; Private</h3>
              <ul className="space-y-2 text-gray-300 text-sm">
                <li>• Send passwords, API keys, or recovery codes that disappear after reading</li>
                <li>• Share private photos or documents that self-destruct after one view</li>
                <li>• Transfer medical documents with time-limited, password-protected access</li>
                <li>• Move personal files without leaving permanent copies on third-party servers</li>
                <li>• Start a Burn Chat for private conversations that vanish when you're done</li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-green-400 mb-3">⚖️ Legal &amp; Compliance</h3>
              <ul className="space-y-2 text-gray-300 text-sm">
                <li>• Distribute case files and evidence with controlled, auditable access</li>
                <li>• Share compliance reports that automatically delete after review</li>
                <li>• Send privileged documents with view limits and password gates</li>
                <li>• Conduct attorney-client Burn Chat sessions with no stored transcript</li>
                <li>• Transmit sensitive court documents that expire on a known deadline</li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-blue-400 mb-3">🔬 Development &amp; Research</h3>
              <ul className="space-y-2 text-gray-300 text-sm">
                <li>• Share environment secrets and SSH keys that self-destruct after first read</li>
                <li>• Distribute research findings with time-boxed collaborative access</li>
                <li>• Transmit pre-release builds or designs without permanent cloud copies</li>
                <li>• Send database credentials securely to temporary contractors</li>
                <li>• Run a Burn Chat debrief after a security incident with no permanent record</li>
              </ul>
            </div>

          </div>
        )}
      </section>

      {/* ── How It Works — Collapsible ── */}
      <section className="bg-gradient-to-br from-dark-800 to-dark-900 rounded-2xl border border-dark-700 shadow-2xl overflow-hidden">
        <button
          onClick={() => toggleSection('howto')}
          className="w-full p-6 flex items-center justify-between hover:bg-dark-700/50 transition-all"
          aria-expanded={openSection === 'howto'}
          aria-controls="howto-panel"
        >
          <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent text-left">
            How BAR's Self-Destructing File Sharing Works
          </h2>
          {openSection === 'howto' ? (
            <ChevronUp className="text-purple-400 flex-shrink-0" size={28} />
          ) : (
            <ChevronDown className="text-purple-400 flex-shrink-0" size={28} />
          )}
        </button>

        {openSection === 'howto' && (
          <div id="howto-panel" className="p-6 pt-0 space-y-6 text-gray-300">

            {/* File sealing flow */}
            <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">
              File Sealing
            </p>
            <div className="space-y-5">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-8 h-8 bg-gold-500 text-black rounded-full flex items-center justify-center font-bold text-sm">1</div>
                <div>
                  <h3 className="text-base font-semibold text-gold-400 mb-1">Upload &amp; Configure</h3>
                  <p className="text-sm leading-relaxed">
                    Select your file (up to 100 MB) and choose security settings: storage mode
                    (server-side shareable link or downloadable .BAR), optional password, view
                    limit, and expiry duration.
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-8 h-8 bg-gold-500 text-black rounded-full flex items-center justify-center font-bold text-sm">2</div>
                <div>
                  <h3 className="text-base font-semibold text-gold-400 mb-1">Encrypt &amp; Seal</h3>
                  <p className="text-sm leading-relaxed">
                    BAR encrypts your file with AES-256 and applies HMAC-SHA256 tamper detection
                    in your browser. Only the encrypted ciphertext reaches the server — plaintext
                    never leaves your device.
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-8 h-8 bg-gold-500 text-black rounded-full flex items-center justify-center font-bold text-sm">3</div>
                <div>
                  <h3 className="text-base font-semibold text-gold-400 mb-1">Share Securely</h3>
                  <p className="text-sm leading-relaxed">
                    Copy the generated link or .BAR file and share it through any channel.
                    Password-protected files require the correct key; OTP-gated files verify the
                    recipient's email before granting access.
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-8 h-8 bg-gold-500 text-black rounded-full flex items-center justify-center font-bold text-sm">4</div>
                <div>
                  <h3 className="text-base font-semibold text-gold-400 mb-1">Auto-Destruct</h3>
                  <p className="text-sm leading-relaxed">
                    Once the view limit is reached or the expiry window closes, the server
                    permanently deletes the stored ciphertext. The link is immediately invalidated
                    — no recovery is possible by anyone, including us.
                  </p>
                </div>
              </div>
            </div>

            {/* Burn Chat flow */}
            <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold pt-4">
              Burn Chat
            </p>
            <div className="space-y-5">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold text-sm">1</div>
                <div>
                  <h3 className="text-base font-semibold text-orange-400 mb-1">Create a Session</h3>
                  <p className="text-sm leading-relaxed">
                    Set a countdown timer (minutes, hours, or days) and generate a session. You
                    receive a Creator PIN and a shareable link. The PIN gives you moderator access
                    — it is shown once and cannot be recovered.
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold text-sm">2</div>
                <div>
                  <h3 className="text-base font-semibold text-orange-400 mb-1">Participants Join</h3>
                  <p className="text-sm leading-relaxed">
                    Share the link through any channel. Each participant's browser generates a
                    unique ECDH P-256 key pair. Keys are exchanged to derive a shared AES-GCM-256
                    session key — the server never sees plaintext at any stage.
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold text-sm">3</div>
                <div>
                  <h3 className="text-base font-semibold text-orange-400 mb-1">Chat in Real Time</h3>
                  <p className="text-sm leading-relaxed">
                    Messages are encrypted before transmission and decrypted locally on each device.
                    The server relays encrypted WebSocket frames only. All messages are in-memory
                    — nothing is written to disk.
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold text-sm">4</div>
                <div>
                  <h3 className="text-base font-semibold text-orange-400 mb-1">Session Burns</h3>
                  <p className="text-sm leading-relaxed">
                    When the timer expires, the server destroys the session entirely. All in-memory
                    data is purged, every participant is disconnected, and the session cannot be
                    resumed. No history, no transcript, no recovery path.
                  </p>
                </div>
              </div>
            </div>

          </div>
        )}
      </section>

      {/* ── FAQ — Collapsible ── */}
      <section className="bg-gradient-to-br from-dark-800 to-dark-900 rounded-2xl border border-dark-700 shadow-2xl overflow-hidden">
        <button
          onClick={() => toggleSection('faq')}
          className="w-full p-6 flex items-center justify-between hover:bg-dark-700/50 transition-all"
          aria-expanded={openSection === 'faq'}
          aria-controls="faq-panel"
        >
          <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gold-400 to-gold-600 bg-clip-text text-transparent text-left">
            Frequently Asked Questions About BAR
          </h2>
          {openSection === 'faq' ? (
            <ChevronUp className="text-gold-400 flex-shrink-0" size={28} />
          ) : (
            <ChevronDown className="text-gold-400 flex-shrink-0" size={28} />
          )}
        </button>

        {openSection === 'faq' && (
          <div id="faq-panel" className="p-6 pt-0 space-y-6">

            <div>
              <h3 className="text-xl font-semibold text-gold-400 mb-2">What does BAR stand for?</h3>
              <p className="text-gray-300 text-sm leading-relaxed">
                BAR stands for "Burn After Reading" — the concept of information that is consumed
                once and then permanently destroyed. BAR applies this principle to digital file
                sharing and real-time messaging with strong cryptographic guarantees rather than
                just policy promises.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-gold-400 mb-2">What is Burn Chat?</h3>
              <p className="text-gray-300 text-sm leading-relaxed">
                Burn Chat is BAR's ephemeral encrypted messaging feature. Create a session with a
                countdown timer and share the link with participants. All messages are encrypted
                end-to-end in each participant's browser using ECDH P-256 key exchange and
                AES-GCM-256 — the server only ever relays ciphertext. When the timer expires the
                server destroys the session; every message is permanently purged from all screens.
                No chat history is stored anywhere — not on the server, not in any log.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-gold-400 mb-2">How is Burn Chat different from file sharing?</h3>
              <p className="text-gray-300 text-sm leading-relaxed">
                File sharing lets you transmit a static encrypted payload — a document, image, or
                any file — that self-destructs after a configured number of views or a time window.
                Burn Chat is a live, real-time conversation where participants exchange messages
                (all encrypted in their browsers) and the entire session is destroyed when the
                countdown hits zero. Think of file sharing as a sealed envelope that burns after
                being opened, and Burn Chat as a secure call where the recording is destroyed the
                moment you hang up.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-gold-400 mb-2">How secure is BAR's encryption?</h3>
              <p className="text-gray-300 text-sm leading-relaxed">
                File sealing uses AES-256 with keys derived via PBKDF2 (SHA-256, 100,000
                iterations) and HMAC-SHA256 for tamper detection — all computed client-side.
                Burn Chat uses ECDH P-256 for key exchange and AES-GCM-256 for message
                encryption, also computed in the browser. In both cases the server only ever
                stores or relays ciphertext. Without the correct password or session key,
                decryption is computationally infeasible.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-gold-400 mb-2">Does BAR log anything?</h3>
              <p className="text-gray-300 text-sm leading-relaxed">
                BAR operates under a zero-log policy. No IP addresses, access timestamps, or
                user identities are retained after a request completes. File metadata and
                encrypted payloads are stored only for the duration of the configured expiry
                window and are deleted on destruction. Burn Chat sessions are fully in-memory
                and leave no database trace after the session ends.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-gold-400 mb-2">Can I recover a file after it self-destructs?</h3>
              <p className="text-gray-300 text-sm leading-relaxed">
                No. Once a file reaches its view limit or expiry time, it is permanently deleted
                from the server. The shareable link is immediately invalidated. There is no
                soft-delete, no backup, and no recovery path — by design.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-gold-400 mb-2">Is BAR free to use?</h3>
              <p className="text-gray-300 text-sm leading-relaxed">
                Yes. BAR is completely free — file sealing, Burn Chat, AES-256 encryption,
                password protection, view limits, time-based expiry, and email OTP are all
                included at no cost. There are no accounts, no premium tiers, and no feature walls.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-gold-400 mb-2">What is the difference between client-side and server-side storage?</h3>
              <p className="text-gray-300 text-sm leading-relaxed">
                <strong>Server-side</strong> storage encrypts and uploads the file to BAR's
                server, generating a shareable link with strictly enforced view limits and
                automatic deletion — recommended for sensitive files.{" "}
                <strong>Client-side</strong> storage generates a self-contained encrypted .BAR
                file you distribute via any channel, but view limits cannot be server-enforced
                since BAR never holds the payload.
              </p>
            </div>

          </div>
        )}
      </section>

      {/* ── Keyword block — hidden visually, readable by search crawlers ── */}
      {/*
        sr-only visually hides this block but keeps it in the DOM and accessible
        to screen readers and crawlers. Do NOT add aria-hidden here — that would
        hide it from screen readers, which is the opposite of sr-only's intent.
      */}
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

export default SEOContent;
