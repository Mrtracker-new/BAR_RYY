@echo off
:: ===========================================================================
::  BAR Web - Setup Script
::  Run this ONCE to get everything ready before you launch the app.
::  Think of it as the "plug everything in" step before the party starts.
:: ===========================================================================
setlocal

echo ========================================
echo  BAR Web - Setup Script
echo ========================================
echo.


:: ---------------------------------------------------------------------------
:: STEP 0 - Pre-flight checks
:: Before we do anything, let's make sure the tools we need actually exist.
:: ---------------------------------------------------------------------------
echo Checking prerequisites...

:: Does Python exist on this machine?
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] Python not found!
    echo  We need Python 3.8+ to run the backend.
    echo  Grab it here: https://www.python.org/
    echo  Make sure to tick "Add Python to PATH" during installation.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('python --version 2^>^&1') do echo   Found %%v

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
for /f "tokens=*" %%v in ('node --version 2^>^&1') do echo   Found Node %%v
for /f "tokens=*" %%v in ('npm --version 2^>^&1') do echo   Found npm %%v

echo  All prerequisites found. Let's go!
echo.


:: ---------------------------------------------------------------------------
:: STEP 1 - Backend Setup
:: The backend is the brain of BAR - it handles all the secure file logic,
:: expiry, passwords, and OTPs. We set it up inside an isolated Python
:: virtual environment (.venv) so it doesn't mess with anything else on
:: your machine. Clean and tidy.
:: ---------------------------------------------------------------------------
echo [1/2] Setting up Backend (Python / FastAPI)...

:: Safety check - make sure the 'backend' folder actually exists
if not exist "backend" (
    echo.
    echo  [ERROR] Cannot find the 'backend' folder!
    echo  Are you running this from the project root directory?
    pause
    exit /b 1
)

:: Jump into the backend folder
pushd backend

    :: Create or reuse Python virtual environment in backend\.venv
    if exist ".venv\Scripts\activate.bat" (
        echo  Virtual environment already exists in backend\.venv.
    ) else (
        echo  Creating Python virtual environment in backend\.venv...
        python -m venv .venv
        if %errorlevel% neq 0 (
            echo  [ERROR] Failed to create virtual environment. Aborting.
            popd
            pause
            exit /b 1
        )
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

    :: Upgrade pip first
    echo  Upgrading pip...
    python -m pip install --upgrade pip

    :: Install all backend Python packages from requirements.txt
    echo  Installing/verifying backend Python packages from requirements.txt...
    python -m pip install -r requirements.txt
    if %errorlevel% neq 0 (
        echo  [ERROR] Backend package installation failed!
        echo  Check requirements.txt or your internet connection.
        call deactivate 2>nul
        popd
        pause
        exit /b 1
    )

    :: Deactivate the venv - we're done with it for now
    call deactivate 2>nul

:: Step back out to the project root
popd

echo  Backend is all set up!
echo.


:: ---------------------------------------------------------------------------
:: STEP 2 - Frontend Setup
:: The frontend is what users actually see and interact with - the React/Vite
:: app. Node.js manages its packages via npm and stores them in node_modules.
:: ---------------------------------------------------------------------------
echo [2/2] Setting up Frontend (Node.js / Vite)...

:: Safety check - make sure the 'frontend' folder actually exists
if not exist "frontend" (
    echo.
    echo  [ERROR] Cannot find the 'frontend' folder!
    echo  Are you running this from the project root directory?
    pause
    exit /b 1
)

:: Jump into the frontend folder
pushd frontend

    :: Install/verify all frontend JS packages listed in package.json
    if exist "node_modules" (
        echo  node_modules found. Verifying and updating packages with npm install...
    ) else (
        echo  Installing frontend packages from package.json...
    )
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
:: ALL DONE - Here's a recap of what just happened and how to launch next.
:: ---------------------------------------------------------------------------
echo ========================================
echo  Setup Complete! You're ready to roll.
echo ========================================
echo.
echo  What was verified / prepared:
echo    - backend\.venv          ^<-- Python virtual environment (backend packages)
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
