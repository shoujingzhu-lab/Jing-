"""
HTTP 中间件集合
===============
Request ID 注入 + 请求体大小限制 + SlowAPI 限流工具。
"""

import logging
import time
import uuid
from contextvars import ContextVar

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.core.config import settings

# ContextVar: 在请求生命周期内共享 request_id
request_id_var: ContextVar[str] = ContextVar("request_id", default="-")

logger = logging.getLogger("quant.middleware")


class RequestIDMiddleware(BaseHTTPMiddleware):
    """
    为每个 HTTP 请求注入唯一 request_id。

    - 从请求头 X-Request-ID 中读取（如果客户端已提供）
    - 否则自动生成 UUID4
    - 写入响应头 X-Request-ID
    - 注入到日志 ContextVar 中
    - 注入到 Request.state 中
    """

    async def dispatch(self, request: Request, call_next):
        # 尝试从请求头获取，否则生成
        req_id = request.headers.get(
            settings.REQUEST_ID_HEADER,
            str(uuid.uuid4()),
        )
        request_id_var.set(req_id)
        request.state.request_id = req_id

        # 处理请求
        start_time = time.time()
        response = await call_next(request)
        elapsed_ms = (time.time() - start_time) * 1000

        # 在响应头中返回
        response.headers[settings.REQUEST_ID_HEADER] = req_id
        response.headers["X-Response-Time-Ms"] = f"{elapsed_ms:.2f}"

        # 结构化日志
        logger.info(
            f"{request.method} {request.url.path} -> {response.status_code} ({elapsed_ms:.1f}ms)",
            extra={
                "request_id": req_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "elapsed_ms": elapsed_ms,
            },
        )

        return response


class RequestBodySizeMiddleware(BaseHTTPMiddleware):
    """
    限制请求体大小。

    FastAPI 默认不做大小限制；此中间件在大文件上传前提前拒绝。
    """

    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                size = int(content_length)
                if size > settings.MAX_REQUEST_BODY_SIZE:
                    return JSONResponse(
                        status_code=413,
                        content={
                            "success": False,
                            "code": 413,
                            "message": f"Request body too large. Max: {settings.MAX_REQUEST_BODY_SIZE // (1024*1024)} MB",
                        },
                    )
            except ValueError:
                pass
        return await call_next(request)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    添加安全相关 HTTP 响应头。

    - X-Content-Type-Options: nosniff
    - X-Frame-Options: DENY
    - X-XSS-Protection: 1; mode=block
    - Strict-Transport-Security (生产环境)
    - Cache-Control (API 响应默认不缓存)
    """

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"

        if settings.is_production:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        return response
