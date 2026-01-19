# 🚀 Setup & Installation

Get BAR Web running in under 5 minutes!

---

## Option 1: Use the Live Demo (Zero Setup!)

Don't want to install anything? Just use the hosted version:

👉 **[Launch BAR Web](https://bar-rnr.vercel.app/)**

> **⏰ Note:** Backend runs on Render's free tier and sleeps when idle. First load takes ~50 seconds. Click the **"Wake Server"** button to speed things up!

---

## Option 2: Run Locally

### Prerequisites

- **Python 3.8+** (backend)
- **Node.js 16+** (frontend)
- **Git** (for cloning)

---

### 🪟 Windows - Easy Mode

```bash
# 1. Clone the repo
git clone https://github.com/Mrtracker-new/BAR_RYY.git
cd BAR_RYY

# 2. Auto-setup (installs everything)
setup.bat

# 3. Start both servers
start.bat
```

**Done!** Open http://localhost:5173 🎉

---

### 🐧 Linux/Mac - Manual Setup

**Backend:**
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python run.py
```

**Frontend** (new terminal):
```bash
cd frontend
npm install
npm run dev
```

**Access:** http://localhost:5173

---

## Your First Sealed File

### 1. Upload a File
- Click **"Start Sealing"**
- Drag & drop (or click to browse)
- Max size: 100MB

### 2. Configure Settings
- **Password** (required): Make it strong!
- **Expiration** (optional): 5 min, 1 hour, 24 hours, etc.
- **View Limit** (optional): 1, 5, 10, 100 views
- **2FA** (optional): Require email verification
- **Webhook** (optional): Get notified on Discord/Slack

### 3. Choose Mode

**💾 Client-Side (.bar file):**
- Download encrypted file
- Share it manually (email, USB, etc.)
- No auto-destruct (you control it)
- Works offline

**🌎 Server-Side (Link):**
- Get a shareable link
- Auto-destruct on expiry/view limit
- Webhook notifications
- Needs internet

### 4. Share It
- **Client-Side:** Send the `.bar` file + password
- **Server-Side:** Share the link + password (separately!)

### 5. Recipient Decrypts
- Upload `.bar` file OR click link
- Enter password
- View/download
- 💥 Auto-destruct (if configured)

---

## Environment Variables (Optional)

For production deployments, create a `.env` file:

```env
# Backend (.env in backend/)
DATABASE_URL=postgresql://...  # Default: SQLite
SECRET_KEY=your-secret-key-here
REQUIRE_2FA=false              # Set to true to force 2FA

# Frontend (.env in frontend/)
VITE_BACKEND_URL=https://your-backend.com  # Production backend URL
```

---

## Port Configuration

**Default Ports:**
- Backend: `8000`
- Frontend: `5173`

**Change Backend Port:**
Edit `backend/run.py`:
```python
uvicorn.run(app, host="0.0.0.0", port=8001)
```

**Change Frontend Port:**
Edit `frontend/vite.config.js`:
```javascript
server: { port: 5174 }
```

---

## Deployment

### Backend (Render/Railway/Fly.io)
1. Connect GitHub repo
2. Set environment variables
3. Deploy!

### Frontend (Vercel/Netlify)
1. Connect GitHub repo
2. Set `VITE_BACKEND_URL` environment variable
3. Build command: `npm run build`
4. Output directory: `dist`

---

## Example Use Case

**Sharing a Wi-Fi Password:**

1. Create `wifi.txt` with password
2. Upload with:
   - Password: `super-secret-phrase`
   - Expiration: 24 hours
   - View limit: 1 view
3. Share link via Discord
4. Share password via WhatsApp (different channel!)
5. Guest views it once → 💥 Auto-deleted

**Result:** Secure, zero traces!

---

## Next Steps

- [Explore all features](./FEATURES.md)
- [Fix common issues](./TROUBLESHOOTING.md)

---

*"Setup is the boring part. Making files disappear is the fun part."* 🔥
