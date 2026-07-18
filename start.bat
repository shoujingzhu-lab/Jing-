@echo off
REM ============================================
REM Quant Trading System - Launcher
REM [1] Backend (FastAPI :8000)
REM [2] Frontend (Vite :3000)
REM [3] Both
REM ============================================

setlocal

echo ============================================
echo   Quant Trading System - Launcher
echo ============================================
echo.
echo   [1] Backend  (FastAPI  :8000)
echo   [2] Frontend (Vite     :3000)
echo   [3] Both     (Backend + Frontend)
echo   [0] Exit
echo.
set /p CHOICE="Select [0-3]: "

if "%CHOICE%"=="0" exit /b 0
if "%CHOICE%"=="1" goto start_backend
if "%CHOICE%"=="2" goto start_frontend
if "%CHOICE%"=="3" goto start_all
echo Invalid choice
pause
exit /b 1

:start_backend
echo.
echo === Starting Backend ===
call "%~dp0start_backend.bat"
goto :eof

:start_frontend
echo.
echo === Starting Frontend ===
call :run_frontend
goto :eof

:start_all
echo.
echo === Starting Both ===
start "Quant-Backend" cmd /c "%~dp0start_backend.bat"
timeout /t 4 >nul
call :run_frontend
goto :eof

:run_frontend
set "FRONTEND_DIR=%~dp0frontend"
where node >nul 2>&1 || (echo [FAIL] Node.js not found & pause & exit /b 1)
echo [OK] Node.js

cd /d "%FRONTEND_DIR%" || (echo [FAIL] frontend dir not found & pause & exit /b 1)

if not exist "node_modules\" (
    echo [!] Installing npm packages...
    call npm install || (echo [FAIL] npm install failed & pause & exit /b 1)
)

echo [>] Starting Vite + opening browser...
echo     http://localhost:3000/
echo     Press Ctrl+C to stop
echo ============================================
call npx vite --host --open
goto :eof
