"""
FastAPI 应用入口
================
虚拟货币量化交易系统 — 后端服务主入口。
"""

from contextlib import asynccontextmanager
from datetime import datetime, UTC
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.database import check_database_connection, close_database_connections
from app.api import api_router
from app.ws.handlers import router as ws_router
from app.ws.broadcaster import data_broadcaster


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
    # 启动时
    print(f"[START] {settings.APP_NAME} v{settings.APP_VERSION} starting...")
    print(f"   Environment: {settings.APP_ENV}")
    print(f"   Debug: {settings.DEBUG}")

    # 检查数据库连接
    db_status = await check_database_connection()
    for db_name, status in db_status.items():
        icon = "[OK]" if status == "connected" else "[FAIL]"
        print(f"   {icon} {db_name} database: {status}")

    # 启动 WebSocket 数据广播器
    await data_broadcaster.start()
    print(f"   [OK] WebSocket broadcaster started")

    yield

    # 关闭时
    print("[STOP] Shutting down...")
    await data_broadcaster.stop()
    print("   [OK] WebSocket broadcaster stopped")
    await close_database_connections()
    print("   Database connections closed.")


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
    docs_url="/api/docs" if settings.DEBUG else None,
    redoc_url="/api/redoc" if settings.DEBUG else None,
    openapi_url="/api/openapi.json" if settings.DEBUG else None,
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
# 中间件
# ============================================================

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# 全局异常处理
# ============================================================

# 策略模块异常 → HTTP 响应
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


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """全局未捕获异常处理"""
    import traceback

    error_detail = traceback.format_exc() if settings.DEBUG else "Internal server error"
    return JSONResponse(
        status_code=500,
        content={
            "error": "internal_server_error",
            "message": str(exc) if settings.DEBUG else "An unexpected error occurred",
            "detail": error_detail if settings.DEBUG else None,
        },
    )


# ============================================================
# 注册路由
# ============================================================
app.include_router(api_router, prefix="/api/v1")
app.include_router(ws_router)  # WebSocket 路由


# ============================================================
# 健康检查
# ============================================================
@app.get("/health", tags=["Health"])
async def health_check():
    """服务健康检查端点"""
    db_status = await check_database_connection()
    all_ok = all(v == "connected" for v in db_status.values())
    return {
        "status": "healthy" if all_ok else "degraded",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.APP_ENV,
        "databases": db_status,
    }


@app.get("/", tags=["Root"])
async def root():
    """API 根路径"""
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/api/docs",
        "health": "/health",
    }
