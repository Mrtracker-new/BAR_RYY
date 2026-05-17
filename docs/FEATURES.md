# ✨ BAR Web — Features Guide

> A complete, easy-to-read breakdown of everything BAR Web can do.

---

## 📋 Table of Contents

1. [🔥 Burn Chat](#-burn-chat) ← New!
2. [🔐 Security](#-security)
3. [📦 Sharing Modes](#-sharing-modes)
4. [⏱️ Self-Destruct](#️-self-destruct)
5. [🔔 Webhook Notifications](#-webhook-notifications)
6. [📧 Email 2FA / OTP](#-email-2fa--otp)
7. [🎨 File Preview](#-file-preview)
8. [🔄 Smart Refresh Control](#-smart-refresh-control)
9. [🚀 Wake Server](#-wake-server)
10. [🎯 Use Cases](#-use-cases)
11. [🔒 Best Practices](#-best-practices)
12. [📊 Tech Stack](#-tech-stack)

---

## 🔥 Burn Chat

> **Real-time ephemeral messaging. When the timer hits zero — the entire room, all messages, everyone in it — gone forever.**

### How It Works

```
Creator visits /burn-chat
        ↓
Sets a timer (5 min – 24 hr)
        ↓
Gets a shareable link + secret Creator PIN
        ↓
Shares link with participants
        ↓
Everyone joins, chats in real time
        ↓
Timer expires → 💥 Session permanently destroyed
```

### Key Features

| Feature | Details |
|---|---|
| ⚡ Real-Time | WebSocket-powered — messages appear instantly |
| 💣 Auto-Destruct | Timer is set at creation. No extensions, no mercy |
| 👑 Creator PIN | One-time PIN shown at creation. Grants moderator role |
| 🚫 Zero Persistence | Nothing written to disk or database. Memory only |
| 🔗 Shareable Link | Share the `/chat/:token` link with anyone |
| 🔥 Burn Animation | Dramatic visual when session is destroyed |
| ⚠️ Urgent Warning | Red warning bar when < 60 seconds remain |

### Timer Options

| Preset | Good For |
|---|---|
| 5 minutes | Quick one-time codes or secrets |
| 15 minutes | Short private conversations |
| 1 hour | Team check-ins or brief meetings |
| 24 hours | Day-long project discussions |
| Custom | Any duration from 30 seconds to 72 hours |

### What "Zero Persistence" Actually Means

- ✅ Messages are held **in server RAM only** — never written to a file or database row
- ✅ Session expires → memory is freed → data is unrecoverable by anyone, including us
- ✅ No logs, no audit trails, no history
- ❌ Not end-to-end encrypted (messages are decrypted on the server for relay) — use for ephemeral convenience, not classified secrets

### Joining a Session

1. Open the shared link (`/chat/:token`)
2. Enter a display name
3. Optional: check "I'm the creator" and enter your PIN to claim the moderator role
4. Press Join → start chatting

---

## 🔐 Security

### AES-256 Encryption

The gold standard for symmetric encryption — the same algorithm used by banks, governments, and intelligence agencies.

| Detail | Value |
|---|---|
| Algorithm | AES-256-CBC |
| Key Derivation | PBKDF2-HMAC-SHA256 |
| Iterations | 100,000 |
| Tamper Detection | HMAC-SHA256 signatures |

**In plain English:** 2²⁵⁶ possible keys. More combinations than atoms in the observable universe. Brute-forcing this would take longer than the age of the universe. You're safe. 🛡️

---

### Zero-Knowledge Architecture

We never see your data — not because we're nice, but because the architecture makes it impossible.

- Keys are derived from your password **in real-time** and never stored
- Database leak? Files stay encrypted ✅
- Server breach? Files stay encrypted ✅
- Court order? We have nothing to hand over ✅

Only the person with the password can decrypt. No backdoors. No master keys.

---

### Brute-Force Protection

Wrong password attempts are punished with exponentially increasing delays:

| Attempt | Penalty |
|---|---|
| 1st wrong | 1-second delay |
| 2nd wrong | 2-second delay |
| 3rd wrong | 4-second delay |
| 5th wrong | **60-minute lockout** 🚫 |

Can't bypass by refreshing, re-uploading, or switching browsers.

---

### Secure Deletion

When a file is deleted (expiry, view limit, or manual), it's a 3-pass wipe:

1. Overwrite with random data (pass 1)
2. Overwrite with random data (pass 2)
3. Overwrite with zeros (pass 3)
4. Remove database entries + file metadata

**Gone is GONE.** No recovery tools will help. 💀

---

## 📦 Sharing Modes

### 💾 Client-Side (`.bar` File)

Best for maximum privacy. The file never leaves your control.

**Flow:** Browser encrypts → you download a `.bar` file → share it however you like → recipient uploads to decrypt

| ✅ Pros | ❌ Cons |
|---|---|
| You hold the file | No auto-destruct |
| Works offline | No view limits enforced |
| No server dependency | Manual sharing |
| Maximum privacy | Larger file sizes |

**Best for:** Long-term storage, highly sensitive files, maximum paranoia.

---

### 🌐 Server-Side (Link)

Best for convenience. File is stored encrypted on the server with automatic rules.

**Flow:** Upload → get a shareable link → share link + password → auto-destructs per your rules

| ✅ Pros | ❌ Cons |
|---|---|
| Auto-destruct timers | Requires server trust |
| Enforced view limits | Needs internet |
| Webhook notifications | Link exposure risk |
| QR code sharing | — |

**Best for:** One-time shares, time-sensitive documents, team collaboration.

---

## ⏱️ Self-Destruct

### Time-Based Expiry

Set a window. When time's up, the file is permanently deleted — even if nobody viewed it.

**Presets:** 5 min · 1 hr · 24 hrs · 7 days · Custom (any duration)

**Use cases:**
- Temporary passwords → 5–30 minutes
- Event passes → 24 hours
- Contract review periods → 7 days

---

### View-Based Limits

Each successful decrypt counts as one view. Hit the limit → file is deleted.

**Options:** 1 · 5 · 10 · 100 · Unlimited

> 💡 Wrong password attempts don't count as views.

**Use cases:**
- One-time secrets → 1 view
- Team documents → 5–10 views
- Public shares with a cap → 100 views

---

## 🔔 Webhook Notifications

Get pinged in real-time when someone interacts with your file.

**Supported platforms:** Discord · Slack · Any HTTPS endpoint

**Events that trigger a notification:**

| Event | Emoji |
|---|---|
| File accessed successfully | ✅ |
| Wrong password entered | ❌ |
| File self-destructed | 💥 |
| Tampering detected | 🚨 |

**Setup — Discord:**
1. Server Settings → Integrations → Webhooks → Create webhook
2. Copy the webhook URL
3. Paste it into BAR Web under "Advanced Options"

**Setup — Slack:**
1. Create an incoming webhook in your Slack workspace
2. Copy the URL → paste into BAR Web

**Example notification:**
```
✅ File Accessed
File: contract.pdf  |  Time: 23:15:00
IP: 203.0.113.42    |  Views remaining: 2
```

> ⚠️ Rate limit: max 10 notifications per file to prevent spam.

---

## 📧 Email 2FA / OTP

Add a second layer of protection beyond the password.

**Flow:**
1. Recipient enters the correct password
2. A 6-digit OTP is emailed to the pre-approved address
3. Recipient enters the code
4. File is decrypted

**When to use it:**
- Extra-sensitive documents (medical, legal, financial)
- Sharing with someone you can't fully verify by password alone
- Paranoia level: Maximum 🔐

**Configuration:** Set approved email addresses when sealing the file. Recipients must match exactly.

---

## 🎨 File Preview

View files directly in the browser — no download required.

| Type | Formats |
|---|---|
| 🖼️ Images | PNG, JPG, WebP, GIF, SVG, BMP |
| 🎥 Video | MP4, WebM, OGV |
| 📄 Documents | PDF (with zoom), TXT, Markdown |
| 💻 Code | Python, JS, JSON, HTML, CSS — syntax highlighted |
| 🎵 Audio | MP3, WAV, OGG |
| 📁 Everything else | Download button fallback |

---

## 🔄 Smart Refresh Control

Choose how page refreshes interact with your view count. Pick **one** of two modes:

### Mode 1 — View Refresh Threshold

Prevents accidental refreshes from eating up views. Same user refreshing within the window = still counts as 1 view.

| Option | Behaviour |
|---|---|
| 0 min (default) | Every refresh = new view |
| 1–5 min | Recommended for most cases |
| 10–30 min | For reviewers who might scroll around |
| 1 hour | Very forgiving |

> **Example:** Set 5 min → user refreshes 3×  in 4 minutes → counts as 1 view 🎯

---

### Mode 2 — Auto-Refresh Interval

Force the page to reload automatically, consuming a view each time.

| Option | Use Case |
|---|---|
| 10 seconds | Extra paranoid access codes |
| 30 seconds | Recommended for time-limited secrets |
| 1–5 minutes | Longer review with forced expiry |

> **Example:** Set 30 sec → user has 30 seconds per view → page reloads → eventually consumed 💨

> 💡 You can only enable one mode at a time.

---

## 🚀 Wake Server

The backend is hosted on Render's free tier, which spins down after 15 minutes of inactivity.

**The Wake Server button:**
- Sends a health check ping to the backend
- Shows a live countdown while waiting
- Rate-limited to once per 30 seconds
- Cooldown persists across page refreshes

**When to use it:** Before uploading a file or creating a Burn Chat session after a long idle period. Wait ~50 seconds for the server to fully wake up.

---

## 🎯 Use Cases

### 🔑 Sharing a Password
- Write password to a `.txt` file
- Upload with 1 view limit + 24 hr expiry
- Share link and password via different channels
- Recipient opens → reads → 💥 gone

### 📄 Confidential Documents
- Upload contract or NDA
- 7-day expiry + webhook to Discord
- Get notified when it's viewed
- Auto-deleted after the review window

### 💬 Sensitive Conversation
- Open `/burn-chat` → set 15-min timer
- Share link privately
- Chat with zero record
- Session burns when done 🔥

### ⏰ Temporary Access Codes
- OTP codes, API keys, 2FA backup codes
- 5-minute expiry + 1 view limit
- Absolute zero trace

### 👥 Team File Sharing
- Presentations, design assets, internal docs
- 10 view limit + webhook tracking
- Auto-cleanup after project ends

---

## 🔒 Best Practices

### Passwords
- ✅ 12+ characters minimum
- ✅ Mix letters, numbers, symbols
- ✅ Use passphrases: `correct-horse-battery-staple`
- ❌ Don't reuse passwords from other sites
- ❌ Don't use `Password123`

### Sharing
- ✅ Send the link and password via **different channels**
- ✅ Always set an expiry time
- ✅ Set view limits for sensitive files
- ❌ Don't paste both link and password in the same message

### File Names
- ✅ Use generic names: `document.pdf`, `notes.txt`
- ❌ Avoid self-incriminating names: `nuclear_launch_codes.pdf`

### Choosing a Mode
- ✅ **Client-side** for maximum privacy (you control the file)
- ✅ **Server-side** for convenience and auto-destruct
- ✅ **Burn Chat** for conversations that should leave no trace
- ✅ **Self-hosted** for zero trust in any third party

---

## 📊 Tech Stack

### Backend
- **FastAPI** — Python web framework
- **WebSockets** — Real-time Burn Chat connections
- **SQLite / PostgreSQL** — Encrypted file metadata
- **Cryptography** — AES-256, PBKDF2, HMAC
- **Uvicorn** — ASGI server

### Frontend
- **React 18** — UI framework
- **Vite** — Build tool
- **Framer Motion** — Animations
- **Lucide Icons** — Icon set

### Deployment
- **Vercel** — Frontend (CDN, global edge)
- **Render** — Backend (Python/FastAPI)

---

*"Features are cool. Security is cooler. Things that disappear are coolest."* 🔥
