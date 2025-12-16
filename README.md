# BAR Web - Burn After Reading 🔥

> **Mission Impossible-style file sharing** - Files that self-destruct after reading. No traces. No recovery. Just like the movies. 🕵️

Hey there! 👋 

Ever wanted to share something *super* secret? Like, "hidden folder on your desktop" level secret? Or maybe "I need to send this password but I don't trust email" secret?

That's exactly what I built here. **BAR Web** lets you upload a file, set it to self-destruct after it's been viewed (once, twice, or never again), and—*poof*—it's gone forever. No recovery tools, no "recycle bin", no traces.

Think of it as **Snapchat for files**, but with **military-grade encryption** and actual teeth. 💪

## 🎯 What Does It Do?

It's basically your own private, self-destructing vault. Here's what you can do:

- 📤 **Upload Anything**: PDFs, images, videos, secrets... up to 100MB.
- 🔒 **Fort Knox Encryption**: AES-256 (the same stuff banks use).
- 🔑 **"Trust No One" Security**: Zero-knowledge password protection. Even I can't see your files.
- ⏱️ **Time Bombs**: Set files to expire in 5 minutes, 24 hours, or whenever.
- 👁️ **View Limits**: "This file will self-destruct in 5 seconds..." (or 1 view).
- 🚀 **Share Your Way**: Send a downloadable `.bar` file or a magic link.
- � **Get Pinged**: Webhook support for Discord/Slack so you know *exactly* when someone tries to peek.
- � **Stop Hackers**: Brute-force protection that locks people out if they guess wrong too many times.

## 🌐 Try It Live!

Want to break things? Go ahead!

**➡️ [BAR Web Live Demo](https://bar-rnr.vercel.app/)** - Frontend (Vercel)

> [!NOTE]  
> **🐢 "Why is it loading?"**  
> The backend runs on **Render's Free Tier**, so it goes to sleep when nobody's using it. If it takes a moment to respond, give it about **50 seconds** to wake up, drink its coffee, and get ready. After that, it's fast! ⚡

No installation needed. Just click, upload, and feel like a secret agent. All the cool security stuff (encryption, 2FA, webhooks) works in production.

### 📈 By The Numbers

Because we all love stats:
```
🔐 100,000  iterations (PBKDF2)        🚫 60 minutes  lockout time
🔒 AES-256  encryption strength       🛡️ SHA-256   HMAC signatures  
⏱️ 5-60 min  typical expiration        👁️ 1-∞ views  configurable limits
💾 100 MB   max file size             💥 3 passes  secure deletion
```

---

## ✨ What Makes This Special?

(aka "Why you should trust this with your secrets")

### 🔒 Fort Knox-Level Security

I didn't just slap some basic encryption on this and call it a day. This bad boy has **THREE layers of protection**:

#### 🅑 **Layer 1: Zero-Knowledge Encryption**
> *"I can't read your files even if I wanted to."*

When you password-protect a file, the encryption key is **NEVER stored anywhere**. It's derived from your password every single time.
- 🔑 Used by: 1Password, Bitwarden, Signal.
- 🛡️ **Translation**: Without the password, your file is literally just random noise. Even a supercomputer would give up.

#### 🅒 **Layer 2: Tamper Detection**
> *"Don't touch my stuff."*

Every `.bar` file is cryptographically signed.
- Modify one byte? **Detected.**
- Change the metadata? **Detected.**
- Try to hold the door open? **Detected.**

It's like a digital wax seal. If it's broken, the file rejects itself.

#### 🅓 **Layer 3: Brute Force Protection**
> *"Wrong password? Go sit in the corner."*

Try to guess the password? Good luck.
1. **Delays**: 1s → 2s → 4s... (it gets slow *fast*).
2. **Lockout**: 5 wrong tries? Locked out for 60 minutes.
3. **No Cheating**: Can't just re-upload the file to reset the counter.

---

### 📦 Dual Storage Modes

**"How do you want to share this?"**

| Feature | Client-Side 💾 | Server-Side 🌎 |
|---------|----------------|----------------|
| **Vibe** | "I'll hold onto this." | "Here's a link, good luck." |
| **Distribution** | Download `.bar` file | Shareable Link |
| **View Limits** | ❌ Digital honor system | ✅ STRICTLY ENFORCED |
| **Auto-Destruct** | ❌ (User keeps file) | ✅ Yes (We delete it) |
| **Security** | 🔒 Military Grade | 🔒 Military Grade |

**Honest UX**: If you give someone a file, they can copy it. If you give them a link, WE control when it disappears. Choose wisely! 🧙‍♂️

---

### 🚨 Other Cool Stuff

- **Self-Destruct** 💥: Files go *poof* after limits are reached.
- **Secure Deletion** 🗑️: We overwrite data 3 times with random noise before deleting. No recovery possible.
- **Screenshot Protection** 📸: Watermarks everywhere + auto-blur. (We can't stop physical cameras, but we try our best!)
- **Webhook Alerts** 🔔: Get a Discord notification when someone fails a password or destroys a file. It's oddly satisfying.

### 🎨 UI/UX Features
- **Rich File Viewer**: Preview 50+ file types (Images, Videos, Code, PDFs) right in the browser.
- **Dark Mode**: Because we're developers, obviously.
- **Responsive**: Hacking on the go? Works on mobile too.

---

## 🛠️ The Tech Stack

What's powering this madness?

**Backend (The Brains):**
- **FastAPI**: Super fast Python API.
- **Cryptography**: The heavy lifter for AES-256.
- **Uvicorn**: Keeps the server spinning.

**Frontend (The Beauty):**
- **React 18**: Smooth, snappy UI.
- **Vite**: Because nobody likes waiting for builds.
- **Tailwind CSS**: Looking good without the headache.
- **Lucide React**: Icons that don't suck.

---

## 🚀 Getting Started

Ready to run your own spy agency?

### Prerequisites
- Python 3.8+
- Node.js 16+
- Git

### Easy Mode (Windows) 🪟

I made scripts so you don't have to type much:

1. **Clone it:**
   ```bash
   git clone https://github.com/Mrtracker-new/BAR_RYY.git
   cd BAR-Web
   ```

2. **Setup:**
   ```bash
   setup.bat
   ```
   (Go grab a coffee ☕, this installs all the things.)

3. **Run:**
   ```bash
   start.bat
   ```
   (Opens the terminals and launches the app!)

---

### Manual Mode (for the Control Freaks) 🤓

**Backend:**
```bash
cd backend
pip install -r requirements.txt
python app.py
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

---

## 🐞 Troubleshooting

**"Port in use?"**
- Kill whatever is using port `8000` or `5173`. Or just change the ports in `app.py`.

**"File won't decrypt?"**
- Did it expire?
- Did you type the password wrong?
- Is it the right file?
- (If Server-Side): Did you view it too many times? It might be gone! 😱

**"Screenshots still work?"**
- Yeah, the Snipping Tool is robust. But hey, the watermark will catch them red-handed!

---

## 🤝 Contributing

Found a bug? Want to add a feature?
1. Fork it.
2. Fix it.
3. PR it.

I accept PRs that make the code cleaner, safer, or just cooler.

## 📜 License

**MIT License**. Do whatever you want with it. Just don't use it for evil (or if you do, don't blame me).

## ⚠️ Disclaimer

**This is for educational purposes.**

I built this to learn about encryption and security. Use it responsibly. I'm not responsible if you use this to hide your secret cookie recipe from your grandma. 🍪

---

**Made with ☕, �, and a healthy paranoia about data security.**
