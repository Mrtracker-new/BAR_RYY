@echo off
:: ===========================================================================
::  BAR Web — Setup Script
::  Run this ONCE to get everything ready before you launch the app.
::  Think of it as the "plug everything in" step before the party starts.
:: ===========================================================================
setlocal

echo ========================================
echo  BAR Web - Setup Script
echo ========================================
echo.


:: ---------------------------------------------------------------------------
:: STEP 0 — Pre-flight checks
:: Before we do anything, let's make sure the tools we need actually exist.
:: No Python? No party. No Node? No way.
:: ---------------------------------------------------------------------------
echo Checking prerequisites...

:: Does Python exist on this machine?
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] Python not found!
    echo  We need Python 3.8+ to run the backend.
    echo  Grab it here: https://www.python.org/
    echo  (Make sure to tick "Add Python to PATH" during install!)
    pause
    exit /b 1
)

:: Does npm (Node.js) exist on this machine?
call npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] Node.js / npm not found!
    echo  We need Node.js to power the frontend.
    echo  Grab it here: https://nodejs.org/
    pause
    exit /b 1
)

echo  All prerequisites found. Let's go!
echo.


:: ---------------------------------------------------------------------------
:: STEP 1 — Backend Setup
:: The backend is the brain of BAR — it handles all the secure file logic,
:: expiry, passwords, and OTPs. We set it up inside an isolated Python
:: virtual environment (.venv) so it doesn't mess with anything else on
:: your machine. Clean and tidy.
:: ---------------------------------------------------------------------------
echo [1/2] Setting up Backend (Python / FastAPI)...

:: Safety check — make sure the 'backend' folder actually exists
if not exist "backend" (
    echo.
    echo  [ERROR] Cannot find the 'backend' folder!
    echo  Are you running this from the project root directory?
    pause
    exit /b 1
)

:: Jump into the backend folder
pushd backend

    :: Create a fresh Python virtual environment in backend\.venv
    :: This is like a private sandbox for backend Python packages.
    echo  Creating Python virtual environment...
    python -m venv .venv
    if %errorlevel% neq 0 (
        echo  [ERROR] Failed to create virtual environment. Aborting.
        popd
        pause
        exit /b 1
    )

    :: Activate the virtual environment so pip installs go INTO it, not globally
    echo  Activating virtual environment...
    call .venv\Scripts\activate.bat
    if %errorlevel% neq 0 (
        echo  [ERROR] Failed to activate virtual environment. Aborting.
        popd
        pause
        exit /b 1
    )

    :: Upgrade pip first — always a good idea, old pip can cause weird issues
    echo  Upgrading pip (just in case it's ancient)...
    python -m pip install --upgrade pip

    :: Install all backend Python packages from requirements.txt
    :: This pulls in FastAPI, cryptography libs, everything listed there.
    echo  Installing backend Python packages from requirements.txt...
    python -m pip install -r requirements.txt
    if %errorlevel% neq 0 (
        echo  [ERROR] Backend package installation failed!
        echo  Check requirements.txt or your internet connection.
        call deactivate
        popd
        pause
        exit /b 1
    )

    :: Deactivate the venv — we're done with it for now
    call deactivate

:: Step back out to the project root
popd

echo  Backend is all set up!
echo.


:: ---------------------------------------------------------------------------
:: STEP 2 — Frontend Setup
:: The frontend is what users actually see and interact with — the React/Vite
:: app. Node.js manages its packages via npm and stores them in node_modules.
:: ---------------------------------------------------------------------------
echo [2/2] Setting up Frontend (Node.js / Vite)...

:: Safety check — make sure the 'frontend' folder actually exists
if not exist "frontend" (
    echo.
    echo  [ERROR] Cannot find the 'frontend' folder!
    echo  Are you running this from the project root directory?
    pause
    exit /b 1
)

:: Jump into the frontend folder
pushd frontend

    :: Install all frontend JS packages listed in package.json
    :: This might take a minute — npm is grabbing the whole internet (basically).
    echo  Running npm install...
    call npm install
    if %errorlevel% neq 0 (
        echo  [ERROR] Frontend package installation failed!
        echo  Check package.json or your internet connection.
        popd
        pause
        exit /b 1
    )

:: Step back out to the project root
popd

echo  Frontend is all set up!
echo.


:: ---------------------------------------------------------------------------
:: ALL DONE — Here's a recap of what just happened and how to launch next.
:: ---------------------------------------------------------------------------
echo ========================================
echo  Setup Complete! You're ready to roll.
echo ========================================
echo.
echo  What was created:
echo    - backend\.venv    ^<-- Python virtual environment (backend packages)
echo    - frontend\node_modules  ^<-- npm packages (frontend packages)
echo.
echo  To launch the app, just run:
echo    start.bat
echo.
echo  Or, if you prefer doing it manually in two terminals:
echo    Terminal 1 ^(Backend^):   cd backend ^&^& .venv\Scripts\activate ^&^& python run.py
echo    Terminal 2 ^(Frontend^):  cd frontend ^&^& npm run dev
echo.
pause
