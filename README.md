# 🔥 BAR Web - Burn After Reading

<div align="center">

![BAR Web Demo](BAR_web.gif)

**Mission Impossible-style file sharing that self-destructs** 💣

*Because some things are meant to disappear after you read them.*

[![Live Demo](https://img.shields.io/badge/🌐_Live_Demo-Try_It_Now-success?style=for-the-badge)](https://bar-rnr.vercel.app/)
[![GitHub](https://img.shields.io/badge/GitHub-Stars_Welcome-black?style=for-the-badge&logo=github)](https://github.com/Mrtracker-new/BAR_RYY)

</div>

---

## 🎬 The Story

You know that scene in every spy movie where the agent gets a message that goes *"This message will self-destruct in 5 seconds"*? Yeah, that's this. But for files. And it actually works.

Ever needed to:
- 🤐 Share a password without sending it through email (yikes)
- 💼 Send a contract that shouldn't stick around forever
- 🎁 Share something that should only be seen once
- 🕵️ Feel like a secret agent on a Tuesday afternoon

**BAR Web** is basically **Snapchat for files**, but with **actual military-grade encryption** and teeth sharp enough to bite back. No recovery tools, no "recycle bin", no second chances.

Upload → Encrypt → Share → *POOF* � Gone forever.

## ✨ What Can It Do?

Think of it as your own private self-destructing vault:

- 📤 **Upload Anything**: PDFs, cat photos, nuclear codes... up to 100MB
- 🔒 **Fort Knox Security**: AES-256 encryption (the same stuff your bank uses, probably)
- 🔑 **Zero-Knowledge**: Even *I* can't see your files (seriously, I tried)
- ⏱️ **Time Bombs**: Set files to expire in 5 minutes, 24 hours, or next Tuesday
- 👁️ **View Limits**: "Read this once and it's gone" - finally achievable IRL
- � **Two Ways to Share**:
  - Download a `.bar` file (trust issues mode)
  - Get a magic link (convenience mode)
- 🔔 **Webhook Alerts**: Get pinged on Discord/Slack when someone opens (or fails to open) your file
- 🛡️ **Anti-Hacker**: Brute-force protection that says "nice try, now go sit in timeout"
- 🎨 **Rich Previews**: See images, videos, code, PDFs right in the browser
- 🌙 **Dark Mode**: Because we're developers and it's always 3 AM

## 🌐 Try It Live!

**Don't just read about it, break it!**

➡️ **[Launch BAR Web](https://bar-rnr.vercel.app/)**

> **⚠️ First-time Loading?**
> 
> The backend runs on Render's free tier (thanks, budget constraints 💸). It sleeps when not in use and takes ~50 seconds to wake up, stretch, and brew its virtual coffee. After that? Lightning fast! ⚡
> 
> **💡 Pro Tip**: Use the **"Wake Server"** button on the homepage to manually wake up the backend before uploading files. It's the power icon button with a glassy look!
> 
> *Think of it as a really lazy security guard who naps between shifts.*


## 🔐 Security That Actually Matters

I didn't just slap some basic encryption on this and call it "secure". Oh no. This thing has **layers** like an ogre (or an onion, if you're less cultured).

### 🧅 Layer 1: Zero-Knowledge Encryption

*"I can't read your files even if you paid me"*

When you password-protect a file, the encryption key is **NEVER stored**. It's derived fresh from your password every time.

- 🔑 **Same tech as**: 1Password, Bitwarden, Signal
- 🛡️ **Translation**: Without the password, your file is just expensive random noise
- 💪 **Even if**: Someone steals the server, hacks the database, or threatens me with strongly-worded emails - they still can't read your file

### 🔒 Layer 2: Tamper Detection

*"Touch this and you'll know"*

Every `.bar` file is cryptographically signed with HMAC-SHA256:

- Change one byte? **Rejected** ❌
- Modify metadata? **Rejected** ❌
- Try to be sneaky? **Still rejected** ❌

It's like a digital wax seal. Break it, and the whole thing refuses to cooperate.

### 🚫 Layer 3: Brute-Force Protection

*"Wrong password? Enjoy the timeout corner"*

Try to guess the password? The app fights back:

1. **Progressive delays**: 1s → 2s → 4s → 8s... (getting slower than dial-up)
2. **IP-based lockout**: 5 wrong attempts? Sit out for 60 minutes
3. **No cheating**: Re-uploading the file doesn't reset the counter. Nice try though!

## 📦 Two Flavors of Paranoia

Pick your poison based on your trust issues:

| | 💾 Client-Side | 🌎 Server-Side |
|---|---|---|
| **Vibe** | "I trust no one" | "Here's a link, good luck" |
| **How it works** | Download encrypted `.bar` file | Get a shareable link |
| **View limits** | ❌ Digital honor system | ✅ STRICTLY ENFORCED |
| **Auto-destruct** | ❌ (You keep the file) | ✅ (We delete it) |
| **Right for you if** | You want full control | You want convenience |

**Honest UX™**: If you give someone a file, they can copy it. Physics is annoying that way. But if you give them a *link*, **WE** control when it disappears. Choose wisely! 🧙‍♂️

## � Nerdy Stats

Because numbers are impressive:

```
🔐 100,000  PBKDF2 iterations      🚫 60 mins   brute-force lockout
🔒 AES-256  encryption bits        🛡️ SHA-256  HMAC signatures  
⏱️ 5-∞ min  expiration options     👁️ 1-100     view limit range
💾 100 MB   max file size          💥 3 passes  secure deletion
📧 2FA      email OTP support      🪝 Webhooks  for Discord/Slack
```

## 🛠️ The Tech Behind The Magic

### Backend (The Brains) 🧠
```
FastAPI      → Because Python should be this fast
Cryptography → The heavy lifter (AES-256, PBKDF2, HMAC)
SQLite/PG    → Database that doesn't judge your secrets
Uvicorn      → ASGI server that doesn't crash (hopefully)
```

### Frontend (The Beauty) 💅
```
React 18     → Hooks and vibes
Vite         → Build tool that doesn't waste your time
Tailwind     → CSS without the trauma
Lucide       → Icons that spark joy
```

### Recent Upgrades 🎉
- ✅ **Refactored backend** from 1,236-line monolith → clean service layer (90% slimmer!)
- ✅ **Dependency injection** for testing (we're professional now)
- ✅ **Modular architecture** (no more god files!)

## 🚀 Run Your Own Spy Agency

### Prerequisites
- Python 3.8+ (for the serious stuff)
- Node.js 16+ (for the pretty stuff)
- Git (for the clone wars)

### 🪟 Easy Mode (Windows)

Scripts that do the thinking for you:

```bash
# 1. Acquire the goods
git clone https://github.com/Mrtracker-new/BAR_RYY.git
cd BAR_RYY

# 2. Setup (auto-installs everything)
setup.bat
# ☕ Grab coffee, this takes a minute

# 3. Launch
start.bat
# 🚀 Opens terminals and launches the app
```

**That's it.** Frontend at `http://localhost:5173`, Backend at `http://localhost:8000`

### 🤓 Manual Mode (For Control Freaks)

**Backend:**
```bash
cd backend
pip install -r requirements.txt
python run.py  # or python app.py
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## 🧪 Features Worth Flexing

### � Webhook Notifications
Get real-time alerts when:
- ✅ Someone accesses your file
- ❌ Someone fails the password
- 💥 File self-destructs
- 🚨 Tampering detected

Perfect for Discord/Slack integration. It's oddly satisfying.

### 📧 2FA Email OTP
Because passwords alone are *so* 2010:
- One-time codes sent via email
- 6-digit codes that expire
- Rate-limited to prevent spam

### 🗑️ Secure Deletion
When we say "delete", we mean **DELETE**:
- 3-pass overwrite with random data
- No recovery tools will save you
- The file is *gone* gone

### 🎨 Rich File Viewer
Preview 50+ file types in-browser:
- Images (PNG, JPG, WebP, etc.)
- Videos (MP4, WebM)
- PDFs (with zoom!)
- Code (with syntax highlighting)
- Documents (if we can render it, we will)

## 🐛 Common "Wait, What?" Moments

**"Why won't my file decrypt?"**
- Did it expire? Check the timer
- Wrong password? Caps lock is sneaky
- Wrong file? Check the filename
- Viewed too many times? *It's gone, friend* 💨

**"Port already in use?"**
- Kill whatever's on port 8000 or 5173
- Or edit the ports in the config files
- Or just reboot (it works, don't judge)

**"Screenshots still work despite protection?"**
- Yeah, Snipping Tool is stubborn
- But the watermarks will rat them out! 🏷️
- (Can't stop physical cameras though, sorry)

**"Backend taking forever to respond?"**
- Free tier sleeps 😴
- Give it 50 seconds to wake up
- After first request, it's fast!

## 🤝 Want to Contribute?

Found a bug? Want to add lasers? Here's how:

1. **Fork** this repo
2. **Fix/Add** your thing
3. **Test** it (please)
4. **PR** it with a funny commit message

I appreciate PRs that make this safer, faster, or just cooler. Bonus points for:
- 🧪 Adding tests
- 📝 Improving docs
- 🎨 Making the UI prettier
- 🔒 Finding security issues (responsibly)

## 📜 License

**MIT License** - Do whatever you want!

Use it, modify it, sell it, tattoo it on your cat (don't actually do that). Just:
- ✅ Keep the license intact
- ✅ Don't blame me if things go wrong
- ❌ Don't use it for evil (or if you do, at least be subtle)

## ⚠️ Legal Stuff (The Boring Part)

**This is educational software.**

I built this to:
- Learn about encryption and security
- Understand file handling and cryptography
- Practice building production-ready apps
- Have fun with spy movie aesthetics

Use it responsibly. I'm not responsible if you:
- Hide your secret cookie recipe from grandma 🍪
- Accidentally delete something important
- Get too paranoid about data security
- Start wearing sunglasses indoors

## 🎯 Roadmap (Maybe)

Ideas for future versions (PRs welcome!):
- [ ] E2E encrypted chat
- [ ] Mobile apps (iOS/Android)
- [ ] Self-hosted Docker image
- [ ] Anonymous file uploads
- [ ] Blockchain integration (jk, that's a joke)

## 💝 Support The Project

If this saved your bacon:
- ⭐ **Star the repo** (it's free dopamine)
- 🐛 **Report bugs** (help make it better)
- 💬 **Share it** (tell your paranoid friends)
- ☕ **Buy me coffee** (via GitHub Sponsors... someday)

---

<div align="center">

**Made with ☕, 🧠, and a healthy dose of paranoia about data security**

*"Because some files deserve to disappear"*

🔥 **Burn After Reading** 🔥

</div>
