@echo off
:: ===========================================================================
::  BAR Web — Quick Start Script
::  This fires up both the backend AND the frontend in separate windows.
::  Run setup.bat first if you haven't already — this assumes everything
::  is already installed and ready to go.
:: ===========================================================================

echo ========================================
echo  BAR Web - Quick Start
echo ========================================
echo.


:: ---------------------------------------------------------------------------
:: STEP 1 — Launch the Backend
:: Opens a NEW terminal window and starts the Python/FastAPI server.
:: The backend runs at http://localhost:8000 and handles all the file
:: encryption, sharing, expiry, and OTP logic.
::
:: "start cmd /k" = open a new window and keep it alive after the command
:: We wait 3 seconds after this so the backend gets a head start
:: before the frontend tries to talk to it.
:: ---------------------------------------------------------------------------
echo [1/2] Launching Backend Server... (new window will open)
echo.
start cmd /k "cd backend && .venv\Scripts\activate && python run.py"

:: Give the backend a 3-second head start to boot up before the frontend
:: tries to connect. Nothing worse than a frontend screaming into the void.
timeout /t 3 /nobreak > nul


:: ---------------------------------------------------------------------------
:: STEP 2 — Launch the Frontend
:: Opens ANOTHER new terminal window and starts the Vite dev server.
:: The frontend runs at http://localhost:5173 — that's your browser URL.
:: ---------------------------------------------------------------------------
echo [2/2] Launching Frontend Server... (new window will open)
echo.
start cmd /k "cd frontend && npm run dev"


:: ---------------------------------------------------------------------------
:: ALL DONE — Both servers are now spinning up in their own windows.
:: This window can be closed safely — it's just a launcher.
:: ---------------------------------------------------------------------------
echo.
echo ========================================
echo  Both servers are starting up!
echo ========================================
echo.
echo  Backend  ^(API^):      http://localhost:8000
echo  Frontend ^(App UI^):   http://localhost:5173
echo.
echo  Open your browser and go to: http://localhost:5173
echo.
echo  ^(You can close this launcher window now if you want^)
pause > nul
