#!/bin/bash
# ============================================
# 量化程序前端 — 一键启动脚本
# 项目: Vite + React + TypeScript
# 端口: 3000
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

echo "============================================"
echo "  量化程序前端 — 启动脚本"
echo "============================================"

# 1. 检查 Node.js
if ! command -v node &>/dev/null; then
  echo "❌ 未找到 Node.js，请先安装 Node.js (>=18)"
  exit 1
fi
echo "✅ Node.js $(node -v)"

# 2. 检查 npm
if ! command -v npm &>/dev/null; then
  echo "❌ 未找到 npm"
  exit 1
fi
echo "✅ npm $(npm -v)"

# 3. 进入前端目录
cd "$FRONTEND_DIR"

# 4. 检查并安装依赖
if [ ! -d "node_modules" ]; then
  echo ""
  echo "📦 node_modules 不存在，正在安装依赖..."
  npm install
  echo "✅ 依赖安装完成"
else
  echo "✅ node_modules 已存在，跳过安装"
fi

# 5. 检查 package.json 是否比 node_modules 新（依赖有更新）
PACKAGE_TIME=$(stat -c %Y package.json 2>/dev/null || stat -f %m package.json 2>/dev/null)
MODULES_TIME=$(stat -c %Y node_modules/.package-lock.json 2>/dev/null || stat -f %m node_modules/.package-lock.json 2>/dev/null)
if [ "$PACKAGE_TIME" -gt "$MODULES_TIME" ] 2>/dev/null; then
  echo "⚠️  package.json 有更新，重新安装依赖..."
  npm install
  echo "✅ 依赖更新完成"
fi

# 6. 启动开发服务器
echo ""
echo "🚀 启动 Vite 开发服务器..."
echo "   本地访问: http://localhost:3000/"
echo "   按 Ctrl+C 停止服务"
echo "============================================"
echo ""

npx vite --host
