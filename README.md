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
- **🌟 Zero-Knowledge Password Protection**: 🔒 **NEW!** True password-derived encryption
  - Encryption key is **NEVER stored** in the .BAR file
  - Uses PBKDF2 with 100,000 iterations (military-grade)
  - Without the password, the file is **completely useless**
  - Same security as 1Password, Bitwarden, Signal
- **Time Bombs**: Set files to expire after minutes, hours, or days
- **View-Only Mode**: Let people preview files in-browser without downloading
- **Screenshot Protection**: Watermarks and blur-on-unfocus to discourage sneaky screenshots
- **AES-256 Encryption**: Industry-standard encryption (Fernet)
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
- **Smart Content Protection**: Watermarks show up in screenshots, content blurs when you switch windows
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
│   │   │   ├── FileUpload.jsx       # Drag-n-drop upload
│   │   │   ├── FileViewer.jsx       # Rich file preview (50+ formats)
│   │   │   ├── ContentProtection.jsx # Screenshot protection (watermark + blur)
│   │   │   ├── RulesPanel.jsx       # Security rules configuration
│   │   │   ├── SharePage.jsx        # Server-side file access
│   │   │   └── DecryptPage.jsx      # Client-side file decryption
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

#### 🔒 Password-Derived Encryption (NEW!)
When you protect a file with a password, we use **true zero-knowledge encryption**:

1. **Salt Generation**: Random 32-byte salt is generated
2. **Key Derivation**: PBKDF2-HMAC-SHA256 with 100,000 iterations derives encryption key from password + salt
3. **File Encryption**: File is encrypted with derived key using AES-256 (Fernet)
4. **Storage**: Only the **salt** is stored in the .BAR file (NOT the key!)
5. **Decryption**: Key must be re-derived from password every time

**Why this is super secure:**
- ❌ Without the password, the .BAR file is **useless** (even to us!)
- ❌ No key leakage - key only exists in memory during encryption/decryption
- ❌ Resistant to rainbow table attacks (salt) and brute-force (100k iterations)
- ✅ Military-grade security (same as password managers)

**Two Encryption Modes:**
- **password_derived**: 🔐 For password-protected files (zero-knowledge, key NOT stored)
- **key_stored**: For non-password files (key stored in file, backward compatible)

See `PASSWORD_DERIVED_ENCRYPTION.md` for full technical details.

#### Traditional Encryption
- **AES-256 (Fernet)**: Symmetric encryption for file data
- **Random Key Generation**: Cryptographically secure keys for non-password mode
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

## Screenshot Protection 📸

We know screenshots are tricky. While we can't completely prevent them (even Netflix with DRM can't), we've added layers of defense:

### What Works
✅ **Watermarks**: Always visible in screenshots - traces back to the viewer  
✅ **Blur on focus loss**: Content automatically blurs when you switch apps (Alt+Tab)  
✅ **Blur on mouse leave**: Content blurs when your cursor leaves the browser  
✅ **Mobile support**: Works on iOS/Android with app-switch detection  

### What Doesn't Work
❌ **Win+Shift+S detection**: Windows Snipping Tool freezes the screen before JavaScript can react  
❌ **100% prevention**: Determined users can still screenshot (physical cameras, OS tools, etc.)  

**Bottom line**: The watermark is your best defense - it's always there, even in sneaky screenshots.

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
