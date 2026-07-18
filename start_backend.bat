@echo off
chcp 65001 >nul
REM ============================================
REM 量化交易系统后端 — 一键启动 (Windows)
REM ============================================

setlocal enabledelayedexpansion

set "BACKEND_DIR=%~dp0backend"

echo ============================================
echo   量化交易系统 — 后端启动
echo ============================================

REM 1. 检查 Python
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [X] 未找到 Python，请先安装 Python 3.11+
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('python --version') do echo [OK] %%i

REM 2. 进入后端目录
cd /d "%BACKEND_DIR%"
if %errorlevel% neq 0 (
    echo [X] 无法进入 backend 目录
    pause
    exit /b 1
)

REM 3. 检查 .env 文件
if not exist ".env" (
    echo [!] .env 文件不存在，从 .env.example 复制...
    if exist ".env.example" (
        copy .env.example .env >nul
        echo [OK] 已创建 .env，请编辑配置数据库连接
    ) else (
        echo [X] 没有 .env.example，请手动创建 .env
    )
)

REM 4. 检查依赖
pip show fastapi >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [>] 依赖未安装，正在安装...
    pip install -r requirements.txt
    if %errorlevel% neq 0 (
        echo [X] 依赖安装失败
        pause
        exit /b 1
    )
    echo [OK] 依赖安装完成
) else (
    echo [OK] 依赖已安装
)

REM 5. 启动后端
echo.
echo [>] 启动 FastAPI 服务...
echo     API 文档: http://localhost:8000/api/docs
echo     健康检查: http://localhost:8000/health
echo     按 Ctrl+C 停止
echo ============================================
echo.

python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

pause
