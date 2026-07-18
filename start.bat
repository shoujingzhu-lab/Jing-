@echo off
chcp 65001 >nul
REM ============================================
REM 量化交易系统 — 一键启动 (Windows)
REM 后端: FastAPI :8000
REM 前端: Vite :3000
REM ============================================

setlocal enabledelayedexpansion

echo ============================================
echo   量化交易系统 — 启动菜单
echo ============================================
echo.
echo   [1] 启动后端 (FastAPI  :8000)
echo   [2] 启动前端 (Vite     :3000)
echo   [3] 启动全部 (后端 + 前端)
echo   [0] 退出
echo.
set /p CHOICE="请选择 [0-3]: "

if "%CHOICE%"=="0" exit /b 0
if "%CHOICE%"=="1" goto start_backend
if "%CHOICE%"=="2" goto start_frontend
if "%CHOICE%"=="3" goto start_all
echo 无效选择
pause
exit /b 1

:start_backend
echo.
echo ============================================
echo   启动后端...
echo ============================================
call "%~dp0start_backend.bat"
goto :eof

:start_frontend
echo.
echo ============================================
echo   启动前端...
echo ============================================
call :run_frontend
goto :eof

:start_all
echo.
echo ============================================
echo   启动全部服务...
echo ============================================
echo [!] 后端将在新窗口启动
start "量化-后端" cmd /c "%~dp0start_backend.bat"
timeout /t 3 >nul
echo [>] 启动前端...
call :run_frontend
goto :eof

:run_frontend
set "FRONTEND_DIR=%~dp0frontend"

where node >nul 2>&1 || (echo [X] 未找到 Node.js && pause && exit /b 1)
echo [OK] Node.js

cd /d "%FRONTEND_DIR%" || (echo [X] 无法进入 frontend 目录 && pause && exit /b 1)

if not exist "node_modules\" (
    echo [>] 安装前端依赖...
    call npm install || (echo [X] 安装失败 && pause && exit /b 1)
) else (
    echo [OK] node_modules 已存在
)

echo [>] 启动 Vite...
echo    前端: http://localhost:3000/
echo    按 Ctrl+C 停止
echo ============================================
call npx vite --host
goto :eof
