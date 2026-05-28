# 🔥 BAR — Burn After Reading

<div align="center">

![BAR Web Demo](BAR_web.gif)

**Mission Impossible-style file sharing. It self-destructs. No drama.**

*Upload. Encrypt. Share. Poof. 💨*

[![Live Demo](https://img.shields.io/badge/🌐_Live_Demo-Try_It_Now-success?style=for-the-badge)](https://bar-rnr.vercel.app/)
[![GitHub](https://img.shields.io/badge/GitHub-Stars_Welcome-black?style=for-the-badge&logo=github)](https://github.com/Mrtracker-new/BAR_RYY)

</div>

---

## 🤔 What is this thing?

Think **Snapchat for files**, but actually secure.

You drop a file in. It gets encrypted. You get a link. The other person opens it, reads it, and — depending on what you set — it's gone forever. No copy. No trace. No drama.

Now also with **Burn Chat** — ephemeral real-time messaging that self-destructs when the timer runs out.

Great for:
- 🤐 Sharing passwords without leaving an email trail
- 💼 Sending contracts that shouldn't stick around
- 💬 Having a conversation that disappears on its own
- 🕵️ Feeling like a spy on a completely normal Tuesday
- 🍪 Hiding cookie recipes from grandma (hey, no judgment)

---

## ✨ What it can do

### 📦 Sealed File Containers

| Feature | Details |
|---|---|
| 🔒 AES-256 Encryption | Same stuff banks use |
| 🔑 Zero-Knowledge | We literally can't read your files |
| 💣 Auto-Destruct | Timer-based or view-count based |
| 💾 Two Share Modes | Client-side `.bar` file *or* server-side link |
| 🔄 Smart Refresh Control | Stops accidental view-count burns |
| 🔔 Webhooks | Discord/Slack ping when someone opens it |
| 📧 Email OTP | 2FA before the file is revealed |
| 🛡️ Brute-Force Lockout | 5 wrong passwords = 60-minute timeout |
| 🎨 Rich File Preview | View 50+ file types without downloading |

### 🔥 Burn Chat *(New!)*

| Feature | Details |
|---|---|
| 🔐 End-to-End Encrypted | Messages encrypted in-browser with **AES-GCM-256** before leaving your device. Server only sees ciphertext |
| 🤝 ECDH Key Exchange | Each session uses **ECDH P-256** key agreement — no shared secret ever touches the server |
| 🔏 Session Fingerprint | 6-char code derived from the shared key. Verify it matches across all participants to detect MITM |
| 💬 Ephemeral Messaging | Real-time chat over WebSockets — nothing stored server-side |
| ⏱️ Self-Destruct Timer | Set 5 min → 24 hr. When it hits zero, it's all gone |
| 👑 Creator PIN | Claim the moderator role with a one-time PIN |
| 🚫 Zero Persistence | Messages exist only in server memory — no disk, no DB |
| 🔗 Shareable Session Link | Send the link to anyone. They join, you chat, it burns |
| ⚡ Instant Destroy | All participants see the burn animation simultaneously |

---

## 🚀 Get started in 60 seconds

### Option A — Just use it online
👉 **[bar-rnr.vercel.app](https://bar-rnr.vercel.app/)**

> ⏰ **Heads up:** The backend sleeps when idle. Hit **"Wake Server"** and wait ~50s on first load. This applies to both file sealing and Burn Chat.

---

### Option B — Run it yourself (Windows)

```bash
git clone https://github.com/Mrtracker-new/BAR_RYY.git
cd BAR_RYY
setup.bat    # installs everything
start.bat    # fires up both servers
```

Then open → **http://localhost:5173** 🎉

---

## 🗺️ Page Routes

| Route | What it does |
|---|---|
| `/` | Landing page — choose Seal or Burn Chat |
| `/app` | File sealing workspace |
| `/burn-chat` | Create a Burn Chat session |
| `/chat/:token` | Join an active Burn Chat room |
| `/share/:token` | Open a sealed file container |

---

## 🔐 Security in plain English

### File Containers
**AES-256** encryption. **PBKDF2** key derivation with 100,000 iterations. **HMAC-SHA256** tamper detection.

> Even if someone hacks the server, steals the database, or threatens us with strongly-worded emails — they still can't read your files. The key lives only in your head (and in the URL you share).

### Burn Chat
Burn Chat goes further with **true end-to-end encryption**:

- **Key agreement:** `ECDH P-256` — each participant generates a keypair in their browser. Private keys never leave the device (`extractable: false`).
- **Session key:** Creator generates a random `AES-GCM-256` key, wraps it per-peer using the ECDH shared secret, and delivers it via the server (as opaque ciphertext the server cannot read).
- **Message encryption:** Every message is encrypted client-side with a fresh 12-byte random IV before it's sent. The server relays ciphertext only.
- **Session fingerprint:** A 6-character hex code derived from `SHA-256(raw session key)[0:3]`. All participants can compare it verbally to confirm no key substitution occurred.
- **Zero server residue:** The server never holds plaintext, session keys, or private keys — only relays opaque base64 blobs.
- **Degradation:** If the page is served over plain HTTP (`crypto.subtle` unavailable), a warning banner is shown and messages fall back to TLS-only protection.

---

## 🤝 Want to contribute?

Found a bug? Have a brilliant idea? Pull requests are very welcome.

1. Fork it
2. Make your changes
3. Test them (please 🙏)
4. PR with a decent description (and maybe a funny commit message)

Bonus points for: `🧪 tests` · `📝 docs` · `🔒 security catches` · `🎨 UI magic`

---

## 📜 License

**MIT** — do whatever you want with it.

✅ Use it · ✅ Modify it · ✅ Deploy it  
❌ Blame us if it breaks · ❌ Use it for evil *(or at least be subtle)*

---

<div align="center">

**Made with ☕, paranoia, and questionable late-night energy**

*"Because some files deserve to disappear."*

🔥 **Burn After Reading** 🔥

</div>
