@echo off
chcp 65001 >nul
REM ============================================
REM 量化程序前端 — 一键启动脚本 (Windows)
REM 项目: Vite + React + TypeScript
REM 端口: 3000
REM ============================================

setlocal enabledelayedexpansion

set "FRONTEND_DIR=%~dp0frontend"

echo ============================================
echo   量化程序前端 — 启动脚本
echo ============================================

REM 1. 检查 Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 未找到 Node.js，请先安装 Node.js ^(>=18^)
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do echo ✅ Node.js %%i

REM 2. 检查 npm
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 未找到 npm
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('npm -v') do echo ✅ npm %%i

REM 3. 进入前端目录
cd /d "%FRONTEND_DIR%"
if %errorlevel% neq 0 (
    echo ❌ 无法进入 frontend 目录: %FRONTEND_DIR%
    pause
    exit /b 1
)

REM 4. 检查并安装依赖
if not exist "node_modules\" (
    echo.
    echo 📦 node_modules 不存在，正在安装依赖...
    call npm install
    if %errorlevel% neq 0 (
        echo ❌ 依赖安装失败
        pause
        exit /b 1
    )
    echo ✅ 依赖安装完成
) else (
    echo ✅ node_modules 已存在，跳过安装
)

REM 5. 启动开发服务器
echo.
echo 🚀 启动 Vite 开发服务器...
echo    本地访问: http://localhost:3000/
echo    按 Ctrl+C 停止服务
echo ============================================
echo.

call npx vite --host

pause
