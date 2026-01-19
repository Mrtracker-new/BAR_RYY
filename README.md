# 🔥 BAR Web - Burn After Reading

<div align="center">

![BAR Web Demo](BAR_web.gif)

**Mission Impossible-style file sharing that self-destructs** 💣

*Because some things are meant to disappear after you read them.*

[![Live Demo](https://img.shields.io/badge/🌐_Live_Demo-Try_It_Now-success?style=for-the-badge)](https://bar-rnr.vercel.app/)
[![GitHub](https://img.shields.io/badge/GitHub-Stars_Welcome-black?style=for-the-badge&logo=github)](https://github.com/Mrtracker-new/BAR_RYY)

</div>

---

## 🎬 What Is This?

**BAR Web** is basically **Snapchat for files**, but with **military-grade encryption** and real teeth. 

Upload → Encrypt → Share → *POOF* 💨 Gone forever.

Perfect for:
- 🤐 Sharing passwords without email trails
- 💼 Sending contracts that shouldn't stick around
- 🎁 One-time file shares
- 🕵️ Feeling like a secret agent on a Tuesday

---

## ✨ Key Features

- 🔒 **AES-256 Encryption** - Bank-level security
- 🔑 **Zero-Knowledge** - We literally can't read your files
- ⏱️ **Auto-Destruct** - Set timers or view limits
- 💾 **Two Modes** - Client-side (.bar file) or Server-side (link)
- 🔔 **Webhooks** - Get notified on Discord/Slack
- 📧 **2FA Support** - Email OTP for extra security
- 🛡️ **Brute-Force Protection** - 5 fails = 60 min lockout
- 🎨 **Rich Previews** - View 50+ file types in-browser

---

## 🚀 Quick Start

### Use the Live Demo
👉 **[Launch BAR Web](https://bar-rnr.vercel.app/)**

> ⏰ **First-time?** Backend sleeps when idle (~50s wake time). Click the "Wake Server" button to speed things up!

### Run Locally (Windows)
```bash
git clone https://github.com/Mrtracker-new/BAR_RYY.git
cd BAR_RYY
setup.bat   # Auto-installs everything
start.bat   # Launches both servers
```

**Done!** Open http://localhost:5173

---

## � Documentation

Everything you need to know, organized nicely:

- **[Setup Guide](./docs/SETUP.md)** - Installation & first use
- **[Features](./docs/FEATURES.md)** - Deep dive into all features
- **[Troubleshooting](./docs/TROUBLESHOOTING.md)** - Fix common issues

---

## 🔐 How Secure Is It?

**Encryption:** AES-256 (same as banks & governments)  
**Key Derivation:** PBKDF2 with 100,000 iterations  
**Brute-Force Time:** Longer than the age of the universe 🌌

**Zero-Knowledge:** We never store encryption keys. Without the password, your file is just expensive random noise.

**Translation:** Even if someone steals the server, hacks the database, or threatens us with strongly-worded emails - they still can't read your files.

---

## � Client-Side vs 🌎 Server-Side

**Client-Side (.bar file):**
- ✅ Full control (you hold the file)
- ✅ Works offline
- ❌ No auto-destruct

**Server-Side (Link):**
- ✅ Auto-destruct timers
- ✅ Enforced view limits
- ✅ Webhook notifications
- ❌ Requires server trust

[Full comparison →](./docs/FEATURES.md#-sharing-modes)

---

## �️ Tech Stack

**Backend:** FastAPI, SQLite/PostgreSQL, Cryptography (AES-256)  
**Frontend:** React 18, Vite, Tailwind CSS, Lucide Icons  
**Security:** PBKDF2, HMAC-SHA256, CSPRNG

---

## 🤝 Contributing

Found a bug? Want to add lasers? 

1. Fork this repo
2. Make your changes
3. Test them (please!)
4. Submit a PR with a funny commit message

Bonus points for: 🧪 tests, 📝 docs, 🎨 UI improvements, 🔒 security fixes

---

## 📜 License

**MIT License** - Do whatever you want!

Use it, modify it, sell it. Just:
- ✅ Keep the license intact
- ✅ Don't blame us if things go wrong
- ❌ Don't use it for evil (or at least be subtle)

---

## ⚠️ Legal Disclaimer

This is **educational software** built to:
- Learn about encryption & security
- Practice production-ready app development
- Have fun with spy movie aesthetics

Use responsibly. Not responsible if you:
- Hide cookie recipes from grandma 🍪
- Accidentally delete something important
- Get too paranoid about data security
- Start wearing sunglasses indoors

---

## 💝 Support

If this saved your bacon:
- ⭐ **Star the repo** (free dopamine!)
- 🐛 **Report bugs** ([GitHub Issues](https://github.com/Mrtracker-new/BAR_RYY/issues))
- 💬 **Share it** with your paranoid friends
- ☕ **Buy me coffee** (GitHub Sponsors... someday)

---

<div align="center">

**Made with ☕, 🧠, and a healthy dose of paranoia**

*"Because some files deserve to disappear"*

🔥 **Burn After Reading** 🔥

</div>
