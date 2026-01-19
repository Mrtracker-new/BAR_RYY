# 🐛 Troubleshooting: When Things Go Wrong

Because even the best spy gadgets sometimes jam. Here's how to fix common issues!

---

## 🔴 "Why Won't My File Decrypt?"

### Symptom
Click "Decrypt" but nothing happens, or you get an error.

### Possible Causes & Fixes

#### 1️⃣ Wrong Password
**Check:**
- Is Caps Lock on? (rookiest mistake)
- Did you copy-paste with extra spaces?
- Is the password *exactly* what you set?

**Fix:** Try again with correct password

---

#### 2️⃣ File Expired
**Check:** Did the file have an expiration time?

**Fix:** None. It's gone forever. 💨 (That's the point!)

---

#### 3️⃣ View Limit Reached
**Check:** Was there a "view once" or "view 5 times" limit?

**Fix:** None. Once the limit is hit, the file self-destructs.

---

#### 4️⃣ File Corrupted/Tampered
**Check:** Did you download/upload the right file?

**Symptoms:**
- "HMAC verification failed"
- "Invalid file format"
- "Decryption error"

**Fix:** Re-download the original `.bar` file and try again

---

#### 5️⃣ Browser Issues
**Symptoms:**
- Page freezes
- Infinite loading spinner
- No error message

**Fix:**
1. Hard refresh: `Ctrl + Shift + R` (or `Cmd + Shift + R` on Mac)
2. Clear browser cache
3. Try a different browser (Chrome, Firefox, Edge)
4. Disable browser extensions (especially ad blockers)

---

## ⚙️ "Port Already in Use"

### Symptom
```
Error: Port 8000 is already in use
```

or

```
Error: Port 5173 is already in use
```

### Fix Options

**Option 1: Kill the Process**

**Windows:**
```bash
# Find what's using port 8000
netstat -ano | findstr :8000

# Kill it (replace PID with the number you found)
taskkill /PID <PID> /F
```

**Linux/Mac:**
```bash
# Find the process
lsof -i :8000

# Kill it (replace PID)
kill -9 <PID>
```

**Option 2: Change the Port**

**Backend:**
Edit `backend/run.py`:
```python
uvicorn.run(app, host="0.0.0.0", port=8001)  # Changed from 8000
```

**Frontend:**
Edit `frontend/vite.config.js`:
```javascript
server: {
  port: 5174,  // Changed from 5173
}
```

---

## 🌐 "Backend Taking Forever to Respond"

### Symptom
Uploading a file shows a loading spinner that never finishes.

### Causes

#### 1️⃣ Free Tier Sleep (Live Demo)
The Render backend sleeps after 15 minutes of inactivity.

**Fix:**
- Click the **"Wake Server"** button on the homepage
- Wait ~50 seconds for the server to wake up
- Try your action again

#### 2️⃣ Network Issues
**Check:**
- Is your internet working?
- Try opening http://localhost:8000/health (local setup)
- Try opening the live backend URL in a browser

**Fix:**
- Check firewall settings
- Disable VPN temporarily
- Restart the backend server

#### 3️⃣ Backend Crashed
**Symptoms:**
- `ERR_CONNECTION_REFUSED`
- `Network Error`

**Fix (Local Setup):**
```bash
# Restart the backend
cd backend
python run.py
```

**Fix (Live Demo):**
- Report it! [Open an issue](https://github.com/Mrtracker-new/BAR_RYY/issues)

---

## 📁 "File Too Large" Error

### Symptom
```
Error: File size exceeds limit
```

### Cause
Files larger than **100MB** are rejected.

### Fix
- Compress the file (use ZIP, 7z, etc.)
- Split into multiple smaller files
- Use a different service for huge files

**Why 100MB?**
Free hosting tiers have limits. Running your own server? You can increase this limit in `backend/app.py`.

---

## 🔒 "Brute-Force Lockout"

### Symptom
```
Too many failed attempts. Try again in 60 minutes.
```

### Cause
You (or someone) entered the wrong password 5+ times.

### Fix
- **Wait 60 minutes** (yes, really)
- Double-check the correct password
- Try again after lockout expires

**Can't wait?**
If you're running locally, you can clear the lockout:
```bash
# Delete the rate limit database
rm backend/rate_limit.db
```

⚠️ Only do this on your own server!

---

## 📸 "Screenshots Still Work?!"

### Symptom
Despite watermarks, someone can still screenshot the file.

### Reality Check
**Yes, screenshots are technically unstoppable.**

Physics > Software. If pixels are on a screen, they can be photographed.

### What We Do
- Add **watermarks** with recipient info (so you know who leaked it)
- Use **blur protection** (doesn't stop screenshots, but makes them blurry)
- **View limits** ensure the file can't be accessed repeatedly

### What You Can Do
- Educate recipients about not sharing
- Use legal agreements (NDAs)
- Accept that perfect screenshot protection is impossible

---

## 🚨 "Webhook Not Firing"

### Symptom
You configured a webhook, but you're not getting notifications.

### Checks

#### 1️⃣ Is the URL Correct?
Copy-paste errors happen. Double-check the URL.

#### 2️⃣ Is It HTTPS?
HTTP webhooks are rejected for security. Use HTTPS only.

#### 3️⃣ Did You Hit the Rate Limit?
Max 10 webhook deliveries per file. After that, they're auto-disabled.

#### 4️⃣ Discord/Slack Specific
- Is the webhook deleted?
- Does the bot have permission to post?
- Is the channel archived?

### Fix
- Test the webhook URL manually (use Postman or curl)
- Check logs for errors
- Create a new webhook and try again

---

## 💻 "Module Not Found" Errors

### Symptom
```
ModuleNotFoundError: No module named 'fastapi'
```

### Cause
Dependencies not installed.

### Fix

**Backend:**
```bash
cd backend
pip install -r requirements.txt
```

**Frontend:**
```bash
cd frontend
npm install
```

**Still not working?**
- Make sure you're in a virtual environment (Python)
- Try deleting `node_modules/` and running `npm install` again

---

## 🌙 "Dark Mode Not Working"

### Symptom
Page stays in light mode.

### Fix
BAR Web is **dark mode by default**. There's no toggle (yet).

If it's showing light mode:
1. Check browser extensions (some force themes)
2. Clear browser cache
3. Hard refresh

**Want to add a theme toggle?** PRs welcome! 😊

---

## 🔄 Still Stuck?

If none of these fixes work:

1. **Check the logs:**
   - Backend: Terminal running `run.py`
   - Frontend: Browser console (`F12` → Console tab)

2. **Search existing issues:**
   [GitHub Issues](https://github.com/Mrtracker-new/BAR_RYY/issues)

3. **Create a new issue:**
   Include:
   - What you tried to do
   - What happened instead
   - Error messages (screenshots help!)
   - Browser/OS info

4. **Panic:** Just kidding. Take a break, come back fresh. 🍵

---

*"99% of bugs are either caching issues or user error. The other 1% are cosmic rays flipping bits."*
