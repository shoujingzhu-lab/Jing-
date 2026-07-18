#!/bin/bash
# ============================================
# 量化交易系统后端 — 一键启动 (Linux/Mac)
# ============================================
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"

echo "============================================"
echo "  量化交易系统 — 后端启动"
echo "============================================"

# 1. 检查 Python
if ! command -v python3 &>/dev/null && ! command -v python &>/dev/null; then
  echo "[X] 未找到 Python，请安装 Python 3.11+"
  exit 1
fi
PYTHON=$(command -v python3 || command -v python)
echo "[OK] $($PYTHON --version)"

# 2. 进入后端目录
cd "$BACKEND_DIR"

# 3. 检查 .env
if [ ! -f ".env" ]; then
  if [ -f ".env.example" ]; then
    echo "[!] 复制 .env.example → .env"
    cp .env.example .env
    echo "[OK] 已创建 .env，请编辑配置数据库"
  fi
fi

# 4. 检查并安装依赖
$PYTHON -c "import fastapi" 2>/dev/null || {
  echo "[>] 安装依赖..."
  pip install -r requirements.txt
  echo "[OK] 依赖安装完成"
}
echo "[OK] 依赖已就绪"

# 5. 启动
echo ""
echo "[>] 启动 FastAPI 服务..."
echo "    API 文档: http://localhost:8000/api/docs"
echo "    健康检查: http://localhost:8000/health"
echo "    按 Ctrl+C 停止"
echo "============================================"
echo ""

$PYTHON -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
