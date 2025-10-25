# BAR Web - Burn After Reading 🔥

Hey there! 👋 

So I built this project because I thought it would be cool to have a way to share files that automatically self-destruct after being viewed. You know, like those spy movies where messages disappear after being read? Yeah, that's the vibe.

## What Does It Do?

Basically, you can:
- Upload a file and encrypt it
- Set how many times it can be viewed (like just once, or maybe 5 times)
- Add an expiration time if you want
- Protect it with a password
- Share the encrypted `.bar` file with someone
- Once they hit the view limit... BOOM! 💥 File's gone forever

Pretty neat, right?

## Cool Features I Added

### 🔐 Security Features
- **Dual Storage Modes**: Choose between Client-Side (download file) or Server-Side (shareable link)
- **Smart View Count Enforcement**: Server-side files enforce view limits; client-side files don't (honest UX!)
- **Self-Destruct**: Files actually destroy themselves after reaching the view limit (server-side only)
- **Secure File Deletion**: Data is overwritten multiple times before deletion to prevent recovery
- **Password Protection**: Lock your files with a password using PBKDF2 key derivation
- **Time Bombs**: Set files to expire after minutes, hours, or days
- **View-Only Mode**: Let people preview files in-browser without downloading
- **AES-256 Encryption**: Industry-standard encryption
- **File Integrity Checks**: SHA-256 hashes detect tampering
- **Webhook Alerts**: Get notified when someone views your file (coming soon)

### 🎨 UI/UX Features
- **Rich File Viewer**: Preview 50+ file types in-browser
  - Images (JPG, PNG, GIF, WebP, SVG, etc.)
  - Videos (MP4, WebM, AVI, MKV, etc.)
  - Audio (MP3, WAV, FLAC, AAC, etc.)
  - Documents (PDF)
  - Code files (JS, Python, Java, C++, Go, Rust, etc.)
  - Data files (JSON, XML, CSV, SQL)
  - Web files (HTML renders in iframe!)
  - Text files (Markdown, YAML, logs, etc.)
- **Dark Theme**: Easy on the eyes
- **Responsive Design**: Works on desktop and mobile
- **Real-time Metadata Display**: See file info, expiry, and access controls

## Tech I Used

**Backend:**
- FastAPI - High-performance async API framework
- Cryptography library - For AES-256 encryption and key derivation
- Uvicorn - ASGI server
- Python 3.8+ - Modern Python goodness

**Frontend:**
- React 18 - Modern UI library with hooks
- Vite - Lightning-fast build tool and dev server
- Tailwind CSS - Utility-first styling
- Axios - Promise-based HTTP client
- Lucide React - Beautiful icons

## What You'll Need

Before you start, make sure you have:
- Python 3.8 or newer
- Node.js (version 16 or higher) and npm
- Git (obviously)

## Getting Started

### For Windows Users (Easy Mode)

I made some batch files to make life easier:

1. **Clone this repo**
```bash
git clone https://github.com/Mrtracker-new/BAR_RYY.git
cd BAR-Web
```

2. **Run the setup**
```bash
setup.bat
```
This installs everything you need for both frontend and backend.

3. **Start it up**
```bash
start.bat
```
This opens two terminal windows - one for backend, one for frontend.

Then just go to:
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000`

### Manual Setup (If You Want More Control)

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

## How It's Organized

```
BAR-Web/
├── backend/                    # Python/FastAPI backend
│   ├── app.py                  # Main API routes
│   ├── crypto_utils.py         # Encryption/decryption utilities
│   ├── client_storage.py       # Client-side file handling (no view enforcement)
│   ├── server_storage.py       # Server-side file handling (full enforcement)
│   ├── requirements.txt        # Python dependencies
│   ├── uploads/                # Temporary upload storage
│   └── generated/              # Generated .bar files
├── frontend/                   # React frontend
│   ├── src/
│   │   ├── App.jsx             # Main app component
│   │   ├── components/
│   │   │   ├── FileUpload.jsx  # Drag-n-drop upload
│   │   │   ├── FileViewer.jsx  # Rich file preview (50+ formats)
│   │   │   ├── RulesPanel.jsx  # Security rules configuration
│   │   │   ├── SharePage.jsx   # Server-side file access
│   │   │   └── DecryptPage.jsx # Client-side file decryption
│   │   ├── main.jsx            # React entry point
│   │   └── index.css           # Global styles
│   ├── package.json            # NPM dependencies
│   └── vite.config.js          # Vite configuration
├── setup.bat                   # Windows setup script
├── start.bat                   # Windows start script
└── README.md                   # You are here!
```

## How Does It Work?

### You Get Two Options:

**Option 1: Client-Side (Download File)** 📥
1. Upload your file and set rules (expiry, password, etc.)
2. Download the encrypted `.bar` file
3. Share it however you want (email, USB, cloud storage)
4. Recipient uploads and decrypts it
5. ⚠️ Note: View limits can't be enforced here (people can keep copies)

**Option 2: Server-Side (Shareable Link)** 🔒
1. Upload your file and set rules + view count limit
2. Get a shareable link
3. Share the link (copy/paste)
4. Recipient clicks link to download
5. ✅ View limits are PROPERLY enforced! File auto-destructs after max views

### Why Two Modes?

I discovered that with client-side `.bar` files, people can just keep the original file and use it unlimited times (whoops 😅). So I added server-side mode where the file stays on the server and view counts actually work!

**TL;DR:**
- Need strict view limits? → Use **Server-Side**
- Want simple file sharing? → Use **Client-Side**

## The API (If You're Curious)

The backend has these main endpoints:

### File Upload & Encryption
- `POST /upload` - Upload your file to temporary storage
- `POST /seal` - Encrypt and create .bar file (supports both storage modes)
  - Client-side: Returns .bar file for download
  - Server-side: Returns shareable link with access token

### File Access
- `GET /download/{bar_id}` - Download encrypted .bar file (client-side)
- `POST /share/{token}` - Access server-side files with view tracking
- `POST /decrypt-upload` - Decrypt uploaded .bar file (client-side)

### Info & Utilities
- `GET /info/{bar_id}` - Get metadata about a .bar file
- `GET /storage-info` - Compare client-side vs server-side capabilities
- `GET /` - API info and available endpoints

**Interactive API Docs:**
Visit `http://localhost:8000/docs` when running for full Swagger documentation!

## Security Architecture

### Encryption
- **AES-256 (Fernet)**: Symmetric encryption for file data
- **Random Key Generation**: Cryptographically secure keys for non-password mode
- **PBKDF2-HMAC-SHA256**: Password-derived keys with 100,000 iterations
- **Base64 Encoding**: Safe text representation of binary data

### Integrity & Authentication
- **SHA-256 Hashing**: Detect file tampering
- **Password Hashing**: SHA-256 hashes stored (not plaintext)
- **Metadata Signing**: Included in encrypted .bar file

### Access Control
- **Server-Side Enforcement**: View counts tracked on server, can't be bypassed
- **Client-Side Validation**: Expiry and password checked (but copyable)
- **Time-Based Expiry**: UTC timestamps prevent timezone manipulation

### Storage Separation
We use separate modules for different security contexts:
- `client_storage.py` - Handles downloadable files (honest about limitations)
- `server_storage.py` - Handles server-hosted files (full enforcement)

This separation ensures we're **honest** about what can and can't be enforced!

### Secure Deletion
- **Multi-Pass Overwrite**: Files are overwritten with random data 3 times before deletion
- **Zero-Fill Final Pass**: Final overwrite with zeros to ensure data is unrecoverable
- **Forced Disk Sync**: Uses `fsync` to ensure data is written to physical disk
- **Server-Side Only**: Only works for files stored on the server (not client-downloaded files)
- **Automatic**: All file deletions use secure deletion automatically

## 🚀 Deploying to Production

Want to deploy this app for free? Check out **[DEPLOYMENT.md](DEPLOYMENT.md)** for a complete guide!

**Quick summary:**
- **Frontend**: Vercel (free forever)
- **Backend**: Render (free forever, sleeps after 15min)
- **Database**: Supabase PostgreSQL (free forever, 500MB)
- **Total cost**: $0/month! 🎉

The deployment guide includes step-by-step instructions, troubleshooting tips, and environment variable setup.

## If You Run Into Issues

**"Port already in use" error:**
- Someone's already using port 8000 or 5173
- Either close that other app, or change the ports in `app.py` (backend) and `vite.config.js` (frontend)

**"Python not found":**
- Install Python from [python.org](https://www.python.org/)
- Make sure to check "Add to PATH" during installation

**"Node/NPM not found":**
- Install Node.js from [nodejs.org](https://nodejs.org/)
- It comes with npm included

**File won't decrypt:**
- **Server-side files**: View limit might be reached (they're destroyed automatically)
- **Client-side files**: Check password or expiry time
- Make sure you're using a valid .bar file (not corrupted)

**PDF/Files not previewing:**
- Refresh the browser page
- Check browser console for errors (F12)
- Some file types need download to open (Office docs)

**View count not working:**
- Client-side files DON'T enforce view limits (by design)
- Switch to server-side mode if you need view count enforcement

## Future Features (Ideas)

Things I'm thinking about adding:
- 📧 Email/SMS notifications on file access
- 📊 Analytics dashboard for server-side files
- 🔐 Two-factor authentication for sensitive files
- 📱 QR code generation for easy mobile sharing
- 🎨 Toast notifications (instead of alerts)
- ⏱️ Live countdown timers for expiring files
- 🌐 Geolocation restrictions
- 🛡️ Rate limiting and CAPTCHA
- 💧 Watermarking for view-only files

## Contributing

Found a bug? Want to add a feature? PRs are welcome!

1. Fork the repo
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

**Code Style:**
- Backend: Follow PEP 8
- Frontend: Use Prettier for formatting
- Add comments for complex logic

## License

MIT License - do whatever you want with it!

## Disclaimer

This is a project I made for learning and fun. Use it responsibly and make sure you're following your local laws about encryption. I'm not responsible if you use this for something sketchy 😉

---

**Made with ☕ and a lot of debugging**
