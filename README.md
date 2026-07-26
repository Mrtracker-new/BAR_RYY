# BAR — Burn After Reading (⌐■_■)

<div align="center">

![BAR Web Demo](BAR_web.gif)

**Highly Secure, Ephemeral File Sharing and Messaging System.**
*Upload. Encrypt. Share. Destroy. [>_<]*

[![Live Demo](https://img.shields.io/badge/Live_Demo-Try_It_Now-success?style=for-the-badge)](https://bar-rnr.vercel.app/)
[![GitHub](https://img.shields.io/badge/GitHub-Stars_Welcome-black?style=for-the-badge&logo=github)](https://github.com/Mrtracker-new/BAR_RYY)

</div>

---

## Overview 

**BAR (Burn After Reading)** is a production-ready, zero-knowledge file sharing and ephemeral messaging platform. Designed with stringent security protocols, it allows users to securely transmit sensitive information that self-destructs after viewing. 

Whether sharing passwords, sensitive contracts, or engaging in confidential discussions, BAR ensures that your data leaves no trace once the conditions are met. (o_O)

---

## Core Capabilities [-_-]

### Sealed File Containers

| Feature | Details |
|---|---|
| **[x] AES-256 Encryption** | Industry-standard encryption securing your files. |
| **[x] Zero-Knowledge Architecture** | The server cannot access or decrypt your data. |
| **[x] Auto-Destruction Mechanism** | Configurable timer-based or view-count based deletion. |
| **[x] Dual Share Modes** | Client-side `.bar` file or a secure server-side link. |
| **[x] Smart Refresh Control** | Prevents accidental consumption of view-based limits. |
| **[x] Webhook Integrations** | Real-time notifications (Discord/Slack) upon access. |
| **[x] Email OTP Verification** | Secondary authentication layer before file decryption. |
| **[x] Brute-Force Protection** | Automatic lockout after successive incorrect password attempts. |
| **[x] Rich File Preview** | Securely view over 50 file types directly in the browser. |

### Burn Chat

| Feature | Details |
|---|---|
| **[x] End-to-End Encryption** | Messages encrypted in-browser via **AES-GCM-256** prior to transmission. |
| **[x] ECDH Key Exchange** | Sessions utilize **ECDH P-256** key agreement; shared secrets never reach the server. |
| **[x] Session Fingerprint** | 6-character verification code to prevent Man-in-the-Middle (MITM) attacks. |
| **[x] Ephemeral Messaging** | Real-time WebSocket communication with zero server-side persistence. |
| **[x] Self-Destruct Timer** | Configurable lifespan from 5 minutes up to 24 hours. |
| **[x] Creator PIN** | Secure moderator role assignment via one-time PIN. |
| **[x] Instant Destruction** | Synchronized deletion sequence for all participants. |

---

## Quick Start Guide (^-^)

### Option A: Online Platform

Access the live environment directly:
-> **[bar-rnr.vercel.app](https://bar-rnr.vercel.app/)**

> **Note:** The backend sleeps during periods of inactivity. Please initialize the "Wake Server" function and allow approximately 50 seconds for the initial cold start. (T_T)

### Option B: Local Deployment (Windows)

For developers and self-hosted environments:

```bash
git clone https://github.com/Mrtracker-new/BAR_RYY.git
cd BAR_RYY
setup.bat    # Initializes dependencies
start.bat    # Launches frontend and backend servers
```

Once running, navigate to **http://localhost:5173** in your browser. \o/

---

## Application Architecture & Routes

| Route | Function |
|---|---|
| `/` | Application landing page |
| `/app` | Primary file sealing workspace |
| `/burn-chat` | Session creation interface for Burn Chat |
| `/chat/:token` | Active Burn Chat session room |
| `/share/:token` | Interface for accessing a sealed file container |

---

## Security Implementation Specifications {-_-}

### File Containers
BAR employs **AES-256** encryption combined with **PBKDF2** key derivation (100,000 iterations) and **HMAC-SHA256** for tamper detection. Decryption keys are strictly client-side, ensuring complete zero-knowledge privacy.

### Burn Chat Protocol
The Burn Chat module enforces true end-to-end encryption:

- **Key Agreement:** `ECDH P-256`. Client devices generate keypairs; private keys remain non-extractable.
- **Session Key:** Encrypted per-peer with the ECDH shared secret using `AES-GCM-256`, securely relayed through the server.
- **Message Integrity:** Each message uses a newly generated 12-byte random IV.
- **Session Fingerprint:** Derived from `SHA-256(raw session key)[0:3]`, allowing participants to verbally confirm connection integrity.
- **Data Degradation:** If accessed via non-TLS environments (`crypto.subtle` unavailable), the system falls back to TLS-only protection with an active warning banner.

---

## Contributing \^_^/

Contributions are welcome for enhancing system security, improving documentation, or adding core features.

1. Fork the repository
2. Implement and test your modifications
3. Submit a comprehensive Pull Request detailing the changes

Priority is given to security enhancements, comprehensive test coverage, and documentation improvements. :-)

---

## License

Licensed under the **MIT License**.

- Use it, modify it, and deploy it.
- Provided "as is", without warranty of any kind.

---

<div align="center">

**Burn After Reading**  
*Secure, Ephemeral, Uncompromising.*  
(⌐■_■)

</div>
