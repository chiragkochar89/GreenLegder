@echo off
title GreenLedger Setup
color 0A
echo.
echo  ==========================================
echo    GreenLedger - Carbon Credit Platform
echo    Setup Script for Windows
echo  ==========================================
echo.

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Download from https://www.python.org/downloads/
    pause & exit /b 1
)
echo [OK] Python found

:: Check MongoDB
sc query MongoDB >nul 2>&1
if errorlevel 1 (
    echo [WARN] MongoDB service not detected.
    echo        Download from: https://www.mongodb.com/try/download/community
    echo        Install with default settings, then re-run this script.
    pause & exit /b 1
)
echo [OK] MongoDB running

:: Install Python deps
echo.
echo [1/4] Installing Python dependencies...
cd backend
pip install -r requirements.txt
if errorlevel 1 ( echo [ERROR] pip install failed & pause & exit /b 1 )
echo [OK] Dependencies installed

:: Train model
echo.
echo [2/4] Training AI carbon estimation model...
python model\train_model.py
if errorlevel 1 ( echo [ERROR] Model training failed & pause & exit /b 1 )
echo [OK] Model trained

:: Seed database
echo.
echo [3/4] Seeding demo data into MongoDB...
python seed_db.py
if errorlevel 1 ( echo [ERROR] Seed failed & pause & exit /b 1 )
echo [OK] Database seeded

:: Start backend in new window
echo.
echo [4/4] Starting Flask API server...
start "GreenLedger API" cmd /k "python app.py"
cd ..

:: Start frontend server
echo.
echo Starting frontend server...
start "GreenLedger Frontend" cmd /k "cd frontend && python -m http.server 8080"

:: Wait a moment then open browser
timeout /t 3 /nobreak >nul
start http://localhost:8080

echo.
echo  ==========================================
echo    GreenLedger is running!
echo    Dashboard : http://localhost:8080
echo    API       : http://localhost:5000
echo    API Health: http://localhost:5000/api/health
echo  ==========================================
echo.
echo  Press any key to exit this window.
echo  (The API and frontend windows keep running)
pause >nul
