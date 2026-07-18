@echo off
REM ============================================
REM Quant Trading System - Backend Quick Start
REM ============================================

setlocal enabledelayedexpansion

set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"

echo ============================================
echo   Quant Backend Launcher
echo ============================================

REM 1. Check Python
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [FAIL] Python not found. Install Python 3.11+
    pause
    exit /b 1
)
python --version
echo.

REM 2. Go to backend dir
cd /d "%BACKEND%"
if %errorlevel% neq 0 (
    echo [FAIL] Cannot enter: %BACKEND%
    pause
    exit /b 1
)
echo [OK] Working dir: %CD%
echo.

REM 3. Check .env
if not exist ".env" (
    if exist ".env.example" (
        echo [!] Creating .env from .env.example ...
        copy ".env.example" ".env" >nul
        echo [OK] .env created. Edit it for your DB settings.
    ) else (
        echo [!] No .env file found, using defaults
    )
) else (
    echo [OK] .env exists
)

REM 4. Check dependencies
pip show fastapi >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Installing dependencies...
    pip install -r requirements.txt
    if %errorlevel% neq 0 (
        echo [FAIL] pip install failed
        pause
        exit /b 1
    )
)
echo [OK] Dependencies ready
echo.

REM 5. Start server
echo ============================================
echo   Starting FastAPI on http://localhost:8000
echo   API Docs: http://localhost:8000/api/docs
echo   Health:   http://localhost:8000/health
echo   Press Ctrl+C to stop
echo ============================================
echo.

python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

pause
