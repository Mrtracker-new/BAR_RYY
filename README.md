# BAR — Burn After Reading

Upload. Encrypt. Share. Destroy.  
BAR is an ephemeral data exchange platform engineered to leave zero trace.

<div align="center">

![BAR Web Demo](BAR_web.gif)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python: 3.10+](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![Node.js: 18+](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![Live Demo](https://img.shields.io/badge/Demo-bar--rnr.vercel.app-success.svg)](https://bar-rnr.vercel.app/)

</div>

---

## What is BAR?

BAR solves a simple problem: **sensitive data lives too long.** Whether passing a production API token, sharing an NDA, or having a private conversation, BAR guarantees that once your criteria are met, your data is permanently gone.

The platform provides two distinct, non-overlapping security models:

| Dimension | Sealed File Containers (SEAD) | Burn Chat (E2EE) |
| :--- | :--- | :--- |
| **Model** | Server-Side Encrypted at Rest with Ephemeral Auto-Destruction | True Zero-Knowledge End-to-End Encryption |
| **Core Use Case** | Sharing files, credentials, and sensitive documents | Real-time confidential group messaging |
| **Key Custody** | Transient server memory; recipient holds password | Participant browser memory only (never reaches server) |
| **Storage Lifecycle** | AES-encrypted on disk until view limit or timer expires | Zero disk persistence (ephemeral in-memory WebSocket relay) |
| **Destruction** | Ciphertext unlinked, database wiped, memory freed | Instant room burn, sockets closed, RAM cleared |

---

## Core Capabilities

### 1. Sealed File Containers (SEAD)
* **Custom Auto-Destruct Rules:** Set hard view caps (e.g., burn after 1 view) and lifespan timers (5 minutes to 7 days).
* **Dual Export Modes:** Share via secure server link, or download an encrypted, standalone `.bar` container to transport offline.
* **Smart Refresh Protection:** Prevents accidental browser refreshes from consuming view limits within a configurable grace window.
* **Access Defense:** Progressive delay brute-force lockouts, optional Email OTP verification, and real-time Discord/Slack webhooks on access.

### 2. Burn Chat (E2EE)
* **Zero-Knowledge Architecture:** Messages are encrypted in-browser using AES-GCM-256 before transmission. The server relays opaque ciphertext and cannot read your messages.
* **ECDH P-256 Key Agreement:** Session keys are wrapped individually per participant using HKDF-SHA256 derived secrets.
* **Out-of-Band Fingerprint:** A 16-character hex session fingerprint (`SHA-256[0:8]`) enables peer verification against Man-in-the-Middle attacks.
* **Creator Controls & Synchronized Burn:** Room creators receive a one-time PIN to lock rooms, kick participants, or trigger instant room self-destruction.

---

## Quickstart

### Try the Live Platform
Access the hosted deployment: **[bar-rnr.vercel.app](https://bar-rnr.vercel.app/)**

> Note: The backend runs on a free-tier instance that spins down during inactivity. Use the "Wake Server" button on first access and allow ~50 seconds for cold start.

### Run Locally

#### Windows
```cmd
git clone https://github.com/Mrtracker-new/BAR_RYY.git
cd BAR_RYY
setup.bat
start.bat
```

#### Linux / macOS
```bash
# Backend
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python run.py

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Navigate to `http://localhost:5173`. The Vite dev server automatically proxies API and WebSocket requests to the backend at `http://localhost:8000`.

---

## Cryptography at a Glance

| Component | Standard / Algorithm | Details |
| :--- | :--- | :--- |
| **Password KDF** | PBKDF2-HMAC-SHA256 | 600,000 iterations, 32-byte salt |
| **Dual-Key Split** | `BarKey` (64 bytes derived) | Bytes 0-31: Fernet cipher / Bytes 32-63: HMAC integrity |
| **File Cipher** | Fernet (AES-128-CBC) | PKCS7 padding, random IV per file |
| **Container Integrity**| HMAC-SHA256 | Signed over canonical JSON (`sort_keys=True`) |
| **Chat Key Agreement** | ECDH Curve P-256 | Non-extractable Web Crypto keys |
| **Chat Key Wrap** | HKDF-SHA256 + AES-GCM | `BAR-BurnChat-WrapKey-v1`, RFC 5869 fallback |
| **Chat Message Cipher**| AES-GCM-256 | Fresh 12-byte random IV per message |

---

## Architecture & Documentation

For detailed technical references, deep dive into the `docs/` directory:

* [Architecture & Trust Boundaries](docs/ARCHITECTURE.md): Threat models, state flow, and memory lifecycles.
* [Cryptographic Specifications](docs/CRYPTOGRAPHY.md): Wire envelope specs, KDF derivations, and fallback details.
* [API & WebSocket Specifications](docs/API_SPECIFICATION.md): Endpoint contracts, payload schemas, and close codes.
* [Development & Deployment](docs/DEVELOPMENT.md): Vite proxy routing, FastAPI lifespan, and configuration.
* [Operations & Diagnostics](docs/OPERATIONS.md): Runbooks, proxy CIDR matching, and troubleshooting.

---

## License

BAR is open-source software licensed under the [MIT License](LICENSE).
