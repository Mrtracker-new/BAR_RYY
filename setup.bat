@echo off
echo ========================================
echo  BAR Web - Setup Script
echo ========================================
echo.

echo [1/2] Setting up Backend...
echo Creating virtual environment in backend folder...
cd backend
python -m venv .venv
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Failed to create backend virtual environment!
    echo Please make sure Python 3.8+ is installed.
    pause
    exit /b 1
)

echo Activating backend virtual environment...
call .venv\Scripts\activate.bat
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Failed to activate backend virtual environment!
    pause
    exit /b 1
)

echo Installing backend dependencies...
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Backend installation failed!
    call deactivate
    cd ..
    pause
    exit /b 1
)
call deactivate
cd ..

echo.
echo [2/2] Setting up Frontend...
cd frontend
echo Installing frontend dependencies...
call npm install
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Frontend installation failed!
    echo Please make sure Node.js and npm are installed.
    cd ..
    pause
    exit /b 1
)
cd ..

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
