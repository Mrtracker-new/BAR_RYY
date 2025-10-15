@echo off
echo ========================================
echo  BAR Web - Setup Script
echo ========================================
echo.

echo Installing Backend Dependencies...
cd backend
python -m pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Backend installation failed!
    echo Please make sure Python 3.8+ is installed.
    pause
    exit /b 1
)
cd ..

echo.
echo Installing Frontend Dependencies...
cd frontend
call npm install
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Frontend installation failed!
    echo Please make sure Node.js and npm are installed.
    pause
    exit /b 1
)
cd ..

echo.
echo ========================================
echo  Setup Complete!
echo ========================================
echo.
echo To start the application:
echo   - Run: start.bat
echo   - Or manually:
echo     Terminal 1: cd backend ^&^& python app.py
echo     Terminal 2: cd frontend ^&^& npm run dev
echo.
pause
