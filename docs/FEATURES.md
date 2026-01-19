# ✨ Features Guide

A complete breakdown of everything BAR Web can do.

---

## 🔐 Security Features

### AES-256 Encryption
**What:** Military-grade encryption  
**Why:** Same tech banks and governments use  
**How:** Your files are scrambled into unreadable noise without the password

**Key Details:**
- 2^256 possible keys (more than atoms in the universe)
- PBKDF2 with 100,000 iterations (slows down hackers)
- HMAC signatures prevent tampering

**Translation:** Breaking this encryption would take longer than the universe has existed. You're safe. 🛡️

---

### Zero-Knowledge Architecture
**What:** We literally can't read your files  
**Why:** Encryption keys are NEVER stored  
**How:** Keys are derived from your password in real-time

**This Means:**
- Database leak? Your files stay encrypted ✅
- Server hack? Your files stay encrypted ✅
- We get lazy? Your files STILL stay encrypted ✅

Only the password holder can decrypt. No backdoors, no exceptions.

---

### Brute-Force Protection
**What:** Automatic lockouts for wrong passwords  
**Why:** Stops hackers from guessing

**How It Works:**
1. Wrong password → 1 second delay
2. 2nd wrong → 2 second delay
3. 3rd wrong → 4 second delay
4. 5th wrong → **60-minute lockout** 🚫

**Can't bypass by:**
- Refreshing the page
- Re-uploading the file
- Using a different browser

---

## 📦 Sharing Modes

### 💾 Client-Side (.bar file)

**How It Works:**
1. File encrypted in your browser
2. Download the `.bar` file
3. Share it however you want
4. Recipient uploads to decrypt

**Pros:**
- ✅ Full control (you hold the file)
- ✅ Works offline
- ✅ No server dependency
- ✅ Maximum privacy

**Cons:**
- ❌ No auto-destruct
- ❌ No view limits enforced
- ❌ Manual sharing required

**Best For:**
- Long-term encrypted storage
- Sharing with trusted people
- Maximum paranoia mode

---

### 🌎 Server-Side (Link)

**How It Works:**
1. File uploaded and stored encrypted
2. Get a shareable link
3. Share link + password
4. Auto-destructs based on rules

**Pros:**
- ✅ Auto-destruct timers
- ✅ Enforced view limits
- ✅ Webhook notifications
- ✅ Easy link sharing

**Cons:**
- ❌ Requires trust in server
- ❌ Needs internet
- ❌ Link sharing (anyone with link can try)

**Best For:**
- One-time shares
- Time-sensitive documents
- Convenience over paranoia

---

## ⏱️ Self-Destruct Options

### Time-Based Expiration

**Options:**
- 5 minutes
- 1 hour
- 24 hours
- 7 days
- Custom (any duration)

**When It Triggers:**
- File is **permanently deleted** after time expires
- Even if not viewed
- No recovery possible

**Use Cases:**
- Temporary passwords (5-30 min)
- Event tickets (24 hours)
- Contracts (7 days review period)

---

### View-Based Limits

**Options:**
- 1 view (burn after reading!)
- 5 views
- 10 views
- 100 views
- Unlimited

**How It Works:**
- Each successful decrypt = 1 view used
- Wrong password attempts don't count
- After limit → 💥 Auto-deleted

**Use Cases:**
- One-time secrets (1 view)
- Team documents (5-10 views)
- Public shares with limits (100 views)

---

## 🔔 Webhook Notifications

**What:** Get pinged when someone interacts with your file

**Supported Platforms:**
- Discord
- Slack
- Any custom HTTPS endpoint

**Events:**
- ✅ File accessed successfully
- ❌ Wrong password entered
- 💥 File self-destructed
- 🚨 Tampering detected

**How to Set Up:**

**Discord:**
1. Server Settings → Integrations → Webhooks
2. Create webhook → Copy URL
3. Paste in BAR Web "Advanced Options"

**Slack:**
1. Create incoming webhook
2. Copy URL
3. Paste in BAR Web

**Example Notification:**
```
🟢 File Accessed
File: contract.pdf
Time: 23:15:00
IP: 203.0.113.42
Remaining Views: 2
```

**Rate Limit:** Max 10 notifications per file

---

## 📧 2FA Email OTP

**What:** Extra security beyond password

**How It Works:**
1. User enters password
2. Email sent with 6-digit code
3. User enters code
4. File decrypts

**When to Use:**
- Extra sensitive files
- High-value documents
- Paranoia level: Maximum

**Configuration:**
- Email SMTP required
- Set `REQUIRE_2FA=true` to force it globally

---

## 🎨 Rich File Preview

**Preview 50+ file types in-browser:**

**Images:**
- PNG, JPG, JPEG, WebP, GIF, SVG, BMP

**Videos:**
- MP4, WebM, OGV

**Documents:**
- PDF (with zoom!)
- TXT, MD (markdown)

**Code:**
- Python, JavaScript, JSON, HTML, CSS
- Syntax highlighting included

**Audio:**
- MP3, WAV, OGG

**Fallback:**
- Download button for unsupported types

---

## 🛡️ Screenshot Protection

**What We Do:**
- Dynamic watermarks (shows recipient info)
- Blur protection (makes screenshots harder to read)
- View limits (can't keep accessing)

**What We CAN'T Do:**
- Stop physical cameras
- Block OS-level screenshot tools (Snipping Tool)
- Prevent screen recording 100%

**Reality:** If pixels are on screen, they can be captured. Perfect screenshot protection is impossible. Use legal agreements (NDAs) for serious stuff.

---

## 🗑️ Secure Deletion

**What:** When we delete, we REALLY delete

**How:**
- 3-pass overwrite with random data
- File metadata wiped
- Database entries removed

**Result:** No recovery tools will save you. Gone is GONE. 💀

---

## 🔍 File Metadata

**What's Visible:**
- File name (not encrypted)
- File size
- Upload timestamp

**What's Hidden:**
- File contents (encrypted)
- Passwords (never stored)
- Encryption keys (derived on-the-fly)

**Pro Tip:** Use generic names like `document.pdf` instead of `secret_nuclear_codes.pdf`

---

## 🚀 Wake Server Button

**What:** Manually wake up sleeping backend

**Why:** Free tier backends sleep after inactivity

**Features:**
- Direct backend health check
- 30-second rate limiting (prevents spam)
- Live countdown timer
- Cooldown persists across refreshes

**When to Use:**
- Before uploading (ensures backend is ready)
- After long idle periods

---

## 📊 Tech Stack

**Backend:**
- FastAPI (Python web framework)
- SQLite/PostgreSQL (database)
- Cryptography (AES-256, PBKDF2, HMAC)
- Uvicorn (ASGI server)

**Frontend:**
- React 18 (UI framework)
- Vite (build tool)
- Tailwind CSS (styling)
- Lucide Icons (pretty icons)

**Security:**
- AES-256-CBC encryption
- PBKDF2-HMAC-SHA256 key derivation
- HMAC-SHA256 signatures
- CSPRNG random generation

---

## 🎯 Use Cases

### 1. Sharing Passwords
- Create text file with password
- 1 view limit + 24 hour expiration
- Share link + password separately
- Recipient views → 💥 Gone

### 2. Confidential Documents
- Upload contract/NDA
- 7-day expiration + webhook
- Get notified when viewed
- Auto-delete after review period

### 3. Temporary Access Codes
- OTP codes, API keys, tokens
- 5-minute expiration
- View once only
- No traces left

### 4. Team File Sharing
- Design assets, presentations
- 10 view limit
- Track who accessed via webhooks
- Auto-cleanup after project

---

## 🔒 Best Practices

**Passwords:**
- ✅ Use 12+ characters
- ✅ Mix letters, numbers, symbols
- ✅ Use passphrases: `correct-horse-battery-staple`
- ❌ Don't reuse from other sites
- ❌ Don't use `Password123`

**Sharing:**
- ✅ Send link and password via different channels
- ✅ Use expiration times
- ✅ Set view limits
- ❌ Don't paste both in same message

**File Names:**
- ✅ Use generic names (`document.pdf`)
- ❌ Avoid obvious names (`nuclear_codes.pdf`)

**Trust:**
- ✅ Use client-side for max privacy
- ✅ Use server-side for convenience
- ✅ Run your own server for zero trust

---

*"Features are cool, but security is cooler."* 🔥
