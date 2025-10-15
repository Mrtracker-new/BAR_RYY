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

- **Self-Destruct**: Files actually destroy themselves after reaching the view limit (I fixed a bug where this wasn't working properly 😅)
- **Password Protection**: Lock your files with a password for extra security
- **Time Bombs**: Set files to expire after a certain time
- **View-Only Mode**: Let people see the file but not download it
- **AES-256 Encryption**: Because we're doing this properly
- **Webhook Alerts**: Get notified when someone views your file

## Tech I Used

**Backend:**
- FastAPI (it's really fast, hence the name)
- Python cryptography libraries
- Some other Python stuff

**Frontend:**
- React (because everyone uses React)
- Vite (super fast build tool)
- Tailwind CSS (makes things look pretty without much effort)
- Axios for API calls

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
├── backend/          # Python/FastAPI stuff
│   ├── app.py              # Main API
│   ├── crypto_utils.py     # All the encryption magic
│   └── requirements.txt    # Python packages
├── frontend/         # React app
│   ├── src/                # React components
│   ├── package.json        # NPM packages
│   └── vite.config.js      # Build config
├── setup.bat         # Run this first
└── start.bat         # Run this to start everything
```

## How Does It Work?

1. **Upload Your File**: Drag and drop whatever you want to secure
2. **Set Your Rules**: 
   - How many times can it be viewed?
   - Should it expire after some time?
   - Need a password?
   - View-only mode?
3. **Seal It**: The app encrypts everything and creates a `.bar` file
4. **Share**: Download the `.bar` file and send it to whoever
5. **They Open It**: They upload the `.bar` file, enter password (if you set one), and boom - they get the file
6. **Self-Destruct**: Once view limit is hit or time expires, the file destroys itself

Each time someone views the file, it gets updated with a new view count. So you can't just keep using the same `.bar` file over and over (I learned that the hard way when fixing a bug 😂)

## The API (If You're Curious)

The backend has a few endpoints:
- `POST /upload` - Upload your file
- `POST /seal` - Encrypt it and create the .bar file
- `GET /download/{bar_id}` - Download the .bar file
- `POST /decrypt-upload` - Decrypt a .bar file (this is what the frontend uses)

You can check out the full API docs at `http://localhost:8000/docs` when running.

## Security Stuff

I'm using:
- **AES-256 encryption** (the good stuff)
- **PBKDF2** for password-based keys
- **SHA-256** for file integrity checks
- Cryptographically secure random keys

Basically, it's secure. I didn't just use `password123` as the encryption key or anything like that 😅

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
- Make sure you're using the LATEST .bar file (it updates after each view)
- Check if the password is correct
- Maybe you hit the view limit already?

## Contributing

Found a bug? Want to add a feature? PRs are welcome! Just fork it and send a pull request.

## License

MIT License - do whatever you want with it!

## Disclaimer

This is a project I made for learning and fun. Use it responsibly and make sure you're following your local laws about encryption. I'm not responsible if you use this for something sketchy 😉

---

**Made with ☕ and a lot of debugging**
