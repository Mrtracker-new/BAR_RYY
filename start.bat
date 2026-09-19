@echo off
:: ===========================================================================
::  BAR Web - Quick Start Script
::  Fires up both the backend and frontend in dedicated windows,
::  verifies prerequisites, and opens your browser to http://localhost:5173.
:: ===========================================================================
setlocal

echo ========================================
echo  BAR Web - Quick Start
echo ========================================
echo.

:: ---------------------------------------------------------------------------
:: STEP 0 - Safety & Dependency Checks
:: Make sure setup.bat was run before attempting to boot up servers.
:: ---------------------------------------------------------------------------
if not exist "%~dp0backend\.venv\Scripts\activate.bat" (
    echo [WARNING] backend\.venv not found!
    echo It looks like setup.bat has not been run yet.
    echo Please run setup.bat first to set up the backend virtual environment.
    echo.
    echo Running setup.bat now...
    call "%~dp0setup.bat"
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] setup.bat did not complete successfully. Aborting start.
        pause
        exit /b 1
    )
)

if not exist "%~dp0frontend\node_modules" (
    echo [WARNING] frontend\node_modules not found!
    echo Running npm install in frontend...
    pushd "%~dp0frontend"
    call npm install
    popd
)

:: ---------------------------------------------------------------------------
:: STEP 1 - Launch the Backend
:: Opens a dedicated terminal window with title "BAR Backend (FastAPI)"
:: Runs at http://localhost:8000
:: ---------------------------------------------------------------------------
echo [1/2] Launching Backend Server... (new window will open)
start "BAR Backend (FastAPI)" cmd /k "title BAR Backend (FastAPI) && cd /d "%~dp0backend" && call .venv\Scripts\activate.bat && python run.py"

:: Give the backend a 2-second head start to boot up
timeout /t 2 /nobreak > nul

:: ---------------------------------------------------------------------------
:: STEP 2 - Launch the Frontend
:: Opens a dedicated terminal window with title "BAR Frontend (Vite)"
:: Runs at http://localhost:5173
:: ---------------------------------------------------------------------------
echo [2/2] Launching Frontend Server... (new window will open)
start "BAR Frontend (Vite)" cmd /k "title BAR Frontend (Vite) && cd /d "%~dp0frontend" && npm run dev"

:: Give the dev server a moment to spin up
timeout /t 2 /nobreak > nul

:: Open the default browser to the web app
start http://localhost:5173

:: ---------------------------------------------------------------------------
:: ALL DONE
:: ---------------------------------------------------------------------------
echo.
echo ========================================
echo  Both servers are running!
echo ========================================
echo.
echo  Backend  (API):      http://localhost:8000
echo  Frontend (App UI):   http://localhost:5173
echo.
echo  Browser opened to:   http://localhost:5173
echo.
echo  To stop the servers, close their individual terminal windows.
echo  (You can close this launcher window now)
echo.
timeout /t 5 > nul
