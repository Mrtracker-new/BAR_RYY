# BAR Web - Burn After Reading

A secure file encryption and sharing application with self-destruct capabilities. BAR Web allows you to encrypt files with configurable access controls, including view limits, expiration times, and password protection.

## 🔥 Features

- **Self-Destruct Files**: Set maximum view counts (1-N views) before automatic deletion
- **Time-Based Expiry**: Configure expiration times (in minutes) for files
- **Password Protection**: Optional password encryption for sensitive files
- **Secure Encryption**: AES-256 encryption with cryptographic best practices
- **View-Only Mode**: Prevent file downloads while allowing viewing
- **Webhook Notifications**: Get notified when files are accessed
- **BAR Container Format**: Encrypted `.bar` files with embedded metadata

## 🛠️ Tech Stack

### Backend
- **FastAPI**: High-performance Python web framework
- **Uvicorn**: ASGI server
- **Cryptography**: Industry-standard encryption library
- **Pydantic**: Data validation

### Frontend
- **React**: UI library
- **Vite**: Fast build tool
- **Tailwind CSS**: Utility-first CSS framework
- **Axios**: HTTP client
- **Lucide React**: Icon library

## 📋 Prerequisites

- Python 3.8 or higher
- Node.js 16+ and npm
- Git

## 🚀 Quick Start

### Windows

1. **Clone the repository**
```bash
git clone <repository-url>
cd BAR-Web
```

2. **Run setup script**
```bash
setup.bat
```

3. **Start the application**
```bash
start.bat
```

The backend will start on `http://localhost:8000` and the frontend on `http://localhost:5173`.

### Manual Setup

#### Backend Setup
```bash
cd backend
python -m pip install -r requirements.txt
python app.py
```

#### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

## 📁 Project Structure

```
BAR-Web/
├── backend/
│   ├── app.py                 # FastAPI application
│   ├── crypto_utils.py        # Encryption utilities
│   ├── crypto_utils_v2.py     # Enhanced crypto functions
│   ├── decrypt_bar.py         # BAR file decryption
│   ├── decrypt_upload.py      # Upload decryption
│   └── requirements.txt       # Python dependencies
├── frontend/
│   ├── src/                   # React source code
│   ├── index.html             # Entry HTML
│   ├── package.json           # Node dependencies
│   ├── vite.config.js         # Vite configuration
│   └── tailwind.config.js     # Tailwind configuration
├── setup.bat                  # Windows setup script
├── start.bat                  # Windows start script
└── README.md                  # This file
```

## 🔐 How It Works

1. **Upload**: Upload a file through the web interface
2. **Configure**: Set security parameters:
   - Maximum view count
   - Expiration time
   - Password protection (optional)
   - View-only mode
   - Webhook URL (optional)
3. **Seal**: The file is encrypted and packaged into a `.bar` container
4. **Share**: Download and share the `.bar` file
5. **Access**: Recipients decrypt the file with proper credentials
6. **Burn**: After reaching view limit or expiration, the file is destroyed

## 🔑 API Endpoints

### `POST /upload`
Upload a file for encryption

### `POST /seal`
Seal uploaded file with encryption and access rules
```json
{
  "filename": "document.pdf",
  "max_views": 1,
  "expiry_minutes": 60,
  "password": "optional_password",
  "webhook_url": "https://example.com/webhook",
  "view_only": false
}
```

### `GET /download/{bar_id}`
Download the generated `.bar` file

### `POST /decrypt/{bar_id}`
Decrypt and retrieve the original file
```json
{
  "password": "optional_password"
}
```

## 🛡️ Security Features

- **AES-256 Encryption**: Military-grade encryption standard
- **Key Derivation**: PBKDF2 for password-based encryption
- **File Integrity**: SHA-256 hash verification
- **Secure Random**: Cryptographically secure random key generation
- **Metadata Protection**: Encrypted metadata within BAR container

## 📝 Development

### Frontend Development
```bash
cd frontend
npm run dev      # Start dev server
npm run build    # Build for production
npm run preview  # Preview production build
```

### Backend Development
```bash
cd backend
python app.py    # Start FastAPI server
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is open source and available under the MIT License.

## ⚠️ Disclaimer

This tool is designed for secure file sharing. Users are responsible for compliance with applicable laws and regulations regarding encryption and data protection in their jurisdiction.

## 🐛 Troubleshooting

### Port Already in Use
If port 8000 or 5173 is already in use, modify the port in:
- Backend: `app.py` (uvicorn port parameter)
- Frontend: `vite.config.js`

### Python Not Found
Ensure Python is installed and added to PATH. Download from [python.org](https://www.python.org/)

### Node/NPM Not Found
Ensure Node.js is installed. Download from [nodejs.org](https://nodejs.org/)

## 📧 Support

For issues and questions, please open an issue on GitHub.

---

**Built with 🔒 for secure, private file sharing**
