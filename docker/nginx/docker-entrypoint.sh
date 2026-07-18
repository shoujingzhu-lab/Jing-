#!/bin/sh
set -e

# 运行时环境变量注入 — 替换 index.html 中的占位符
# 用于在 Docker 运行时动态设置 API 地址等配置
if [ -f /usr/share/nginx/html/index.html ]; then
    # API Base URL (默认 /api/v1，同域部署不需要修改)
    API_BASE_URL="${API_BASE_URL:-/api/v1}"
    export API_BASE_URL
fi

exec "$@"
