@echo off
setlocal

set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"

echo ============================================
echo   Quant Trading System - Backend
echo ============================================

where python >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python not found
    pause
    exit /b 1
)
python --version

cd /d "%BACKEND%"
if %errorlevel% neq 0 (
    echo ERROR: Cannot enter backend dir
    pause
    exit /b 1
)
echo Working dir: %CD%

if not exist ".env" (
    if exist ".env.example" (
        echo Creating .env from .env.example ...
        copy ".env.example" ".env" >nul
    )
)

pip show fastapi >nul 2>&1
if %errorlevel% neq 0 (
    echo Installing dependencies...
    pip install -r requirements.txt
)

echo.
echo ============================================
echo   FastAPI starting...
echo   http://localhost:8000
echo   Docs: http://localhost:8000/api/docs
echo   Ctrl+C to stop
echo ============================================
echo.

python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

pause
