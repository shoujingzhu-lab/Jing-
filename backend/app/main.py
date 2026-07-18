"""
FastAPI 应用入口
================
虚拟货币量化交易系统 — 后端服务主入口。
集成: Sentry, Prometheus, Rate Limiting, Request ID, 安全头.
"""

from contextlib import asynccontextmanager
from datetime import datetime, UTC
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from app.core.config import settings
from app.core.database import check_database_connection, close_database_connections
from app.core.logging import setup_logging, setup_sentry, get_logger
from app.core.monitoring import init_metrics, get_metrics, PrometheusMiddleware
from app.core.middleware import (
    RequestIDMiddleware,
    RequestBodySizeMiddleware,
    SecurityHeadersMiddleware,
)
from app.api import api_router
from app.ws.handlers import router as ws_router
from app.ws.broadcaster import data_broadcaster

# 初始化日志（最早调用）
setup_logging()
logger = get_logger("main")


# ============================================================
# OpenAPI Tags 元数据
# ============================================================
TAGS_METADATA = [
    {
        "name": "Auth | 认证",
        "description": "用户注册、登录、登出、会话管理。支持 JWT 双令牌机制（access + refresh）。",
    },
    {
        "name": "Users | 用户",
        "description": "用户信息管理、角色分配、个人资料编辑。",
    },
    {
        "name": "Data | 数据中心",
        "description": "多交易所行情查询、K线数据、订单簿深度、资金费率、多交易所聚合行情、历史数据下载。",
    },
    {
        "name": "Strategies | 策略引擎",
        "description": "可视化/代码策略的创建、编辑、删除、克隆、版本管理、回滚、代码导出、系统模板库。策略生命周期：draft → backtested → simulated → live → paused → archived。",
    },
    {
        "name": "Backtest | 回测系统",
        "description": "单策略回测、批量回测、参数优化（网格搜索）、回测报告（净值曲线/回撤/夏普/月度热力图）、基准对比、报告导出。",
    },
    {
        "name": "Simulation | 模拟交易",
        "description": "模拟账户创建与管理、资金充值/重置、绩效查看、实盘准入条件检查。",
    },
    {
        "name": "Trading | 实盘交易",
        "description": "API Key 管理、手动下单（市价/限价/止损）、订单追踪与撤单、持仓管理、交易日志查询。",
    },
    {
        "name": "Risk | 风险控制",
        "description": "风控规则 CRUD、熔断机制、全局熔断与恢复、风控事件日志、风控仪表盘。",
    },
    {
        "name": "AI | 智能分析",
        "description": "策略健康度评估、市场状态分类、策略-市场适配矩阵、山寨币关联分析、参数建议、资金分配建议。",
    },
    {
        "name": "Admin | 系统管理",
        "description": "服务健康监控（DB/Redis）、交易所连接状态、策略运行统计、全局参数配置。",
    },
    {
        "name": "Notifications | 通知告警",
        "description": "策略告警规则、系统告警、价格告警、站内消息（已读/未读）、通知偏好设置。",
    },
]


# ============================================================
# 应用生命周期
# ============================================================
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """应用启动/关闭时的生命周期事件"""
    # ---- 启动 ----
    logger.info(
        f"Starting {settings.APP_NAME} v{settings.APP_VERSION}",
        extra={"environment": settings.APP_ENV, "debug": settings.DEBUG},
    )

    # 初始化 Sentry（必须在 logging 之后）
    if settings.SENTRY_DSN:
        setup_sentry()

    # 初始化 Prometheus 指标
    init_metrics()

    # 检查数据库连接
    db_status = await check_database_connection()
    for db_name, status in db_status.items():
        log_fn = logger.info if status == "connected" else logger.error
        log_fn(f"Database [{db_name}]: {status}")

    # 播种策略模板（首次启动时写入 15 个系统模板到数据库）
    if db_status.get("main") == "connected":
        try:
            from app.services.template_seeder import seed_templates
            from app.core.database import main_async_session

            async with main_async_session() as session:
                count = await seed_templates(session)
                if count > 0:
                    logger.info(f"Seeded {count} strategy templates")
        except Exception as e:
            logger.warning(f"Template seeding skipped: {e}")

    # 启动 WebSocket 数据广播器
    await data_broadcaster.start()
    logger.info("WebSocket broadcaster started")

    # 预热行情缓存（减少前端首次请求延迟）
    from app.services.market_data import market_data_service
    await market_data_service.warmup(["BTC/USDT", "ETH/USDT"])
    logger.info("Market data cache warmed up")

    yield

    # ---- 关闭 ----
    logger.info("Shutting down...")
    await data_broadcaster.stop()
    logger.info("WebSocket broadcaster stopped")
    await close_database_connections()
    logger.info("Database connections closed")


# ============================================================
# 创建 FastAPI 应用
# ============================================================
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="""
## 虚拟货币量化交易系统 API

支持多交易所（Binance / OKX / Bybit / Gate.io）的加密货币量化交易平台。

### 核心功能
- 📊 **数据中心** — 多交易所实时行情、K线、订单簿、资金费率
- 🧠 **策略引擎** — 可视化节点图 + Python 代码双模式，15+ 系统模板
- ⏮️ **回测系统** — 事件驱动引擎，5 种撮合模式，完整绩效报告
- 🎯 **模拟交易** — 模拟账户管理，实盘准入评估
- 💹 **实盘交易** — API Key 加密管理，手动/自动下单
- 🛡️ **风险控制** — 多维度风控规则，熔断机制
- 🤖 **智能分析** — 策略健康度、市场状态、关联分析
- 🔔 **通知告警** — 策略/价格/系统告警，多渠道推送

### 认证方式
Bearer Token (JWT)：在请求头中添加 `Authorization: Bearer <token>`

### 通用响应格式
```json
{
  "success": true,
  "code": 200,
  "message": "操作成功",
  "data": { ... },
  "timestamp": "2026-06-08T00:00:00Z"
}
```

### 分页响应格式
```json
{
  "success": true,
  "data": {
    "items": [ ... ],
    "total": 100,
    "page": 1,
    "page_size": 20,
    "total_pages": 5
  }
}
```
    """,
    docs_url="/api/docs" if settings.should_show_docs else None,
    redoc_url="/api/redoc" if settings.should_show_docs else None,
    openapi_url="/api/openapi.json" if settings.should_show_docs else None,
    lifespan=lifespan,
    openapi_tags=TAGS_METADATA,
    contact={
        "name": "Quant Trading Team",
        "email": "dev@quant-trading.com",
    },
    license_info={
        "name": "Proprietary",
        "url": "https://quant-trading.com/license",
    },
)

# ============================================================
# 中间件（按添加顺序执行 — 后添加的先执行）
# ============================================================

# 1. CORS（最早添加，最后执行）
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Prometheus 指标收集
if settings.PROMETHEUS_ENABLED:
    app.add_middleware(PrometheusMiddleware)

# 3-5. 自定义中间件
app.add_middleware(RequestBodySizeMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestIDMiddleware)

# ============================================================
# Rate Limiting (SlowAPI)
# ============================================================
if settings.RATE_LIMIT_ENABLED:
    try:
        from slowapi import Limiter, _rate_limit_exceeded_handler
        from slowapi.util import get_remote_address
        from slowapi.errors import RateLimitExceeded

        limiter = Limiter(
            key_func=get_remote_address,
            default_limits=[settings.RATE_LIMIT_DEFAULT],
        )
        app.state.limiter = limiter
        app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
        logger.info(
            f"Rate limiting enabled: default={settings.RATE_LIMIT_DEFAULT}, "
            f"auth={settings.RATE_LIMIT_AUTH}, trading={settings.RATE_LIMIT_TRADING}"
        )
    except ImportError:
        logger.warning("slowapi not installed, rate limiting disabled")
        limiter = None

# ============================================================
# 全局异常处理
# ============================================================

from app.services.strategy import StrategyError
from app.services.backtest import BacktestError


@app.exception_handler(StrategyError)
async def strategy_error_handler(request: Request, exc: StrategyError):
    """将 StrategyService 异常映射为 HTTP 响应"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "code": exc.status_code,
            "message": exc.message,
            "detail": getattr(exc, "errors", None),
            "timestamp": datetime.now(UTC).isoformat(),
        },
    )


@app.exception_handler(BacktestError)
async def backtest_error_handler(request: Request, exc: BacktestError):
    """将 BacktestService 异常映射为 HTTP 响应"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "code": exc.status_code,
            "message": exc.message,
            "timestamp": datetime.now(UTC).isoformat(),
        },
    )


# 全局 Sentry 集成 — 未捕获异常上报到 Sentry
if settings.SENTRY_DSN:
    try:
        from sentry_sdk.integrations.starlette import StarletteIntegration
    except ImportError:
        pass


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """全局未捕获异常处理 — 区分开发/生产环境"""
    import traceback

    logger.error(
        f"Unhandled exception: {type(exc).__name__}: {exc}",
        exc_info=True,
        extra={"path": str(request.url.path), "method": request.method},
    )

    if settings.DEBUG or settings.is_development:
        return JSONResponse(
            status_code=500,
            content={
                "error": "internal_server_error",
                "message": str(exc),
                "detail": traceback.format_exc(),
                "request_id": getattr(request.state, "request_id", "-"),
            },
        )

    # 生产环境不泄露错误细节
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "code": 500,
            "message": "An unexpected error occurred",
            "request_id": getattr(request.state, "request_id", "-"),
        },
    )


# ============================================================
# 注册路由
# ============================================================
app.include_router(api_router, prefix="/api/v1")
app.include_router(ws_router)  # WebSocket 路由

# ============================================================
# Prometheus 指标端点
# ============================================================
@app.get("/metrics", tags=["Monitoring"])
async def prometheus_metrics():
    """Prometheus 指标采集端点"""
    if not settings.PROMETHEUS_ENABLED:
        return Response(content="Prometheus metrics disabled", status_code=404)
    return Response(content=get_metrics(), media_type="text/plain; charset=utf-8")


# ============================================================
# 健康检查（增强版）
# ============================================================
@app.get("/health", tags=["Monitoring"])
async def health_check():
    """
    增强版服务健康检查。

    返回:
    - 应用状态
    - 数据库连接状态
    - Redis 连接状态（如已配置）
    - 版本信息
    """
    import asyncio

    db_status = await check_database_connection()

    # Redis 健康检查
    redis_status = "unknown"
    try:
        import redis.asyncio as aioredis

        r = aioredis.from_url(settings.REDIS_URL, socket_timeout=2)
        await r.ping()
        await r.close()
        redis_status = "connected"
    except Exception:
        redis_status = "disconnected"

    all_db_ok = all(v == "connected" for v in db_status.values())
    all_ok = all_db_ok and redis_status == "connected"

    return {
        "status": "healthy" if all_ok else "degraded",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.APP_ENV,
        "uptime_seconds": (
            round(
                __import__("time").time()
                - getattr(
                    __import__("app.core.monitoring", fromlist=["_app_start_time"]),
                    "_app_start_time",
                    __import__("time").time(),
                ),
                1,
            )
        ),
        "databases": db_status,
        "redis": redis_status,
        "timestamp": datetime.now(UTC).isoformat(),
    }


@app.get("/health/live", tags=["Monitoring"])
async def liveness_check():
    """Kubernetes Liveness Probe"""
    return {"status": "alive"}


@app.get("/health/ready", tags=["Monitoring"])
async def readiness_check():
    """Kubernetes Readiness Probe"""
    db_status = await check_database_connection()
    all_ok = all(v == "connected" for v in db_status.values())
    if not all_ok:
        return JSONResponse(
            status_code=503,
            content={"status": "not ready", "databases": db_status},
        )
    return {"status": "ready"}


# ============================================================
# 根路径
# ============================================================
@app.get("/", tags=["Root"])
async def root():
    """API 根路径"""
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.APP_ENV,
        "docs": "/api/docs" if settings.should_show_docs else None,
        "health": "/health",
        "metrics": "/metrics",
    }
