"""
开发环境启动入口
================
直接运行此文件启动后端服务。
"""

import uvicorn

from app.core.config import settings


def main():
    """启动 Uvicorn 开发服务器"""
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower(),
        reload_dirs=["app"] if settings.DEBUG else None,
    )


if __name__ == "__main__":
    main()
