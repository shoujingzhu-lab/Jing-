"""
监控与可观测性模块
==================
Prometheus 指标定义 + Middleware 集成。
提供:
- HTTP 请求指标 (延迟、状态码、路径)
- 交易指标 (订单数、成交额、错误率)
- 数据库连接池指标
- WebSocket 连接指标
"""

import time
from typing import Callable

from prometheus_client import Counter, Gauge, Histogram, generate_latest, CollectorRegistry, REGISTRY
from fastapi import Request, Response
from starlette.types import ASGIApp, Scope, Receive, Send

from app.core.config import settings

# ================================================================
# 自定义 Registry（避免与全局冲突）
# ================================================================
_metrics_registry = REGISTRY

# ================================================================
# HTTP 请求指标
# ================================================================
http_requests_total = Counter(
    "http_requests_total",
    "HTTP 请求总数",
    ["method", "path", "status_code"],
    registry=_metrics_registry,
)


http_request_duration_seconds = Histogram(
    "http_request_duration_seconds",
    "HTTP 请求延迟 (秒)",
    ["method", "path"],
    buckets=[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
    registry=_metrics_registry,
)


http_requests_in_progress = Gauge(
    "http_requests_in_progress",
    "当前正在处理的 HTTP 请求数",
    ["method"],
    registry=_metrics_registry,
)


# ================================================================
# 交易指标
# ================================================================
trading_orders_total = Counter(
    "trading_orders_total",
    "订单总数",
    ["exchange", "side", "type", "status"],
    registry=_metrics_registry,
)


trading_volume_total = Counter(
    "trading_volume_total",
    "总成交额 (USDT)",
    ["exchange"],
    registry=_metrics_registry,
)


trading_errors_total = Counter(
    "trading_errors_total",
    "交易错误总数",
    ["exchange", "error_type"],
    registry=_metrics_registry,
)


# ================================================================
# 风控指标
# ================================================================
risk_checks_total = Counter(
    "risk_checks_total",
    "风控检查总数",
    ["result"],  # passed | rejected
    registry=_metrics_registry,
)


circuit_breaker_active = Gauge(
    "circuit_breaker_active",
    "活跃熔断器数量",
    ["scope"],  # strategy | account | global
    registry=_metrics_registry,
)


# ================================================================
# 数据库指标
# ================================================================
db_pool_size = Gauge(
    "db_pool_size",
    "数据库连接池大小",
    ["database"],  # main | timescale
    registry=_metrics_registry,
)


db_pool_checked_out = Gauge(
    "db_pool_checked_out",
    "数据库连接池已借出连接数",
    ["database"],
    registry=_metrics_registry,
)


# ================================================================
# WebSocket 指标
# ================================================================
ws_connections_active = Gauge(
    "ws_connections_active",
    "活跃 WebSocket 连接数",
    registry=_metrics_registry,
)


ws_messages_sent = Counter(
    "ws_messages_sent",
    "WebSocket 消息发送总数",
    ["channel"],
    registry=_metrics_registry,
)


# ================================================================
# 应用指标
# ================================================================
app_info = Gauge(
    "app_info",
    "应用信息",
    ["version", "environment"],
    registry=_metrics_registry,
)


app_uptime_seconds = Gauge(
    "app_uptime_seconds",
    "应用运行时长 (秒)",
    registry=_metrics_registry,
)


# ================================================================
# 初始化
# ================================================================
_app_start_time: float = 0.0


def init_metrics():
    """初始化指标（在应用启动时调用）"""
    global _app_start_time
    _app_start_time = time.time()
    app_info.labels(version=settings.APP_VERSION, environment=settings.APP_ENV).set(1)


def update_uptime():
    """更新运行时长指标"""
    if _app_start_time > 0:
        app_uptime_seconds.set(time.time() - _app_start_time)


def get_metrics() -> bytes:
    """获取所有指标（Prometheus scrape 端点）"""
    update_uptime()
    return generate_latest(_metrics_registry)


# ================================================================
# 中间件 — Prometheus 指标收集
# ================================================================
class PrometheusMiddleware:
    """
    ASGI 中间件：自动收集所有 HTTP 请求的 Prometheus 指标。

    用法:
        app.add_middleware(PrometheusMiddleware)
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        method = scope.get("method", "UNKNOWN")
        path = scope.get("path", "/")

        # 跳过 metrics 端点自身
        if path in ("/metrics", "/api/v1/metrics"):
            await self.app(scope, receive, send)
            return

        http_requests_in_progress.labels(method=method).inc()
        start_time = time.time()

        status_code = 0

        async def send_wrapper(message):
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message.get("status", 0)
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        except Exception:
            status_code = 500
            raise
        finally:
            elapsed = time.time() - start_time
            http_requests_in_progress.labels(method=method).dec()
            http_requests_total.labels(method=method, path=path, status_code=str(status_code)).inc()
            http_request_duration_seconds.labels(method=method, path=path).observe(elapsed)


# ================================================================
# 便捷装饰器
# ================================================================
def track_trading_metrics(exchange: str):
    """装饰器：自动记录交易指标"""

    def decorator(func: Callable):
        async def wrapper(*args, **kwargs):
            try:
                result = await func(*args, **kwargs)
                # 从结果中提取 side/type 注册到指标
                trading_orders_total.labels(
                    exchange=exchange,
                    side=getattr(result, "side", "unknown"),
                    type=getattr(result, "order_type", "unknown"),
                    status="success",
                ).inc()
                return result
            except Exception as e:
                trading_errors_total.labels(
                    exchange=exchange,
                    error_type=type(e).__name__,
                ).inc()
                raise

        return wrapper

    return decorator
