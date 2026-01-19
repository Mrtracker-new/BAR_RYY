@echo off
echo ========================================
echo  BAR Web - Quick Start Script
echo ========================================
echo.

echo [1/2] Starting Backend Server...
echo.
start cmd /k "cd backend && .venv\Scripts\activate && python run.py"
timeout /t 3 /nobreak > nul

echo [2/2] Starting Frontend Server...
echo.
start cmd /k "cd frontend && npm run dev"

echo.
echo ========================================
echo  Both servers are starting!
echo ========================================
echo.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:5173
echo.
echo Press any key to exit this window...
pause > nul
