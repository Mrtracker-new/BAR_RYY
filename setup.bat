@echo off
setlocal
echo ========================================
echo  BAR Web - Setup Script
echo ========================================
echo.

:: --- Pre-checks ---
echo Checking prerequisites...

python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python is not installed or not in PATH.
    echo Please install Python 3.8+ from https://www.python.org/
    pause
    exit /b 1
)

call npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js/npm is not installed or not in PATH.
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)
echo Prerequisites OK.
echo.

:: --- Backend Setup ---
echo [1/2] Setting up Backend...
if not exist "backend" (
    echo ERROR: 'backend' directory not found!
    pause
    exit /b 1
)

pushd backend
echo Creating virtual environment in backend folder...
python -m venv .venv
if %errorlevel% neq 0 (
    echo ERROR: Failed to create backend virtual environment!
    popd
    pause
    exit /b 1
)

echo Activating backend virtual environment...
call .venv\Scripts\activate.bat
if %errorlevel% neq 0 (
    echo ERROR: Failed to activate backend virtual environment!
    popd
    pause
    exit /b 1
)

echo Installing backend dependencies...
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo ERROR: Backend installation failed!
    call deactivate
    popd
    pause
    exit /b 1
)
call deactivate
popd
echo Backend setup complete.
echo.

:: --- Frontend Setup ---
echo [2/2] Setting up Frontend...
if not exist "frontend" (
    echo ERROR: 'frontend' directory not found!
    pause
    exit /b 1
)

pushd frontend
echo Installing frontend dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Frontend installation failed!
    popd
    pause
    exit /b 1
)
popd
echo Frontend setup complete.
echo.

echo ========================================
echo  Setup Complete!
echo ========================================
echo.
echo Virtual environment created:
echo   - Backend: backend\.venv (Python virtual environment)
echo   - Frontend: node_modules (npm packages)
echo.
echo To start the application:
echo   - Run: start.bat
echo   - Or manually:
echo     Terminal 1: cd backend ^&^& .venv\Scripts\activate ^&^& python app.py
echo     Terminal 2: cd frontend ^&^& npm run dev
echo.
pause
