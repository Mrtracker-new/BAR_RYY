@echo off
echo ================================================
echo  BAR-Web Server Restart Script
echo ================================================
echo.

echo [1/5] Stopping all Python processes...
taskkill /F /IM python.exe 2>nul
taskkill /F /IM python3.12.exe 2>nul
timeout /t 2 /nobreak >nul

echo [2/5] Stopping all Node processes...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

echo [3/5] Starting Backend Server...
start "BAR-Web Backend" cmd /k "cd /d %~dp0backend && python app.py"
timeout /t 3 /nobreak >nul

echo [4/5] Starting Frontend Server...
start "BAR-Web Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo [5/5] Done!
echo.
echo ================================================
echo  Servers are starting...
echo  - Backend: http://localhost:8000
echo  - Frontend: http://localhost:5173
echo ================================================
echo.
echo Press any key to close this window...
pause >nul
