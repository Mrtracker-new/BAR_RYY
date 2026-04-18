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

Great for:
- 🤐 Sharing passwords without leaving an email trail
- 💼 Sending contracts that shouldn't stick around
- 🕵️ Feeling like a spy on a completely normal Tuesday
- 🍪 Hiding cookie recipes from grandma (hey, no judgment)

---

## ✨ What it can do

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

---

## 🚀 Get started in 60 seconds

### Option A — Just use it online
👉 **[bar-rnr.vercel.app](https://bar-rnr.vercel.app/)**

> ⏰ **Heads up:** The backend sleeps when idle. Hit **"Wake Server"** and wait ~50s on first load.

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

## 🔐 Security in plain English

**AES-256** encryption. **PBKDF2** key derivation with 100,000 iterations. **HMAC-SHA256** tamper detection.

What does that mean for you?

> Even if someone hacks the server, steals the database, or threatens us with strongly-worded emails — they still can't read your files. The key lives only in your head (and in the URL you share).

We never store encryption keys. Without the password, your file is expensive random noise.

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
