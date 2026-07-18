"""
系统管理 API
============
模块九：服务健康监控、交易所连接状态、策略运行统计、全局参数配置。
"""

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import check_database_connection, get_main_db
from app.core.deps import get_current_user_id
from app.schemas.base import APIResponse
from app.models.trading import Strategy

router = APIRouter()


@router.get(
    "/health",
    response_model=APIResponse,
    summary="系统健康检查",
    description="ADMIN-001: 返回 API 服务、数据库、Redis 的连接状态。",
)
async def system_health():
    db_status = await check_database_connection()

    # Redis 健康检查
    redis_status = "unknown"
    try:
        import redis.asyncio as aioredis
        from app.core.config import settings

        r = aioredis.from_url(settings.REDIS_URL, socket_timeout=2)
        await r.ping()
        await r.close()
        redis_status = "connected"
    except Exception:
        redis_status = "disconnected"

    # WebSocket 状态
    from app.ws.manager import ws_manager
    from app.ws.broadcaster import data_broadcaster

    ws_status = {
        "active_connections": ws_manager.active_connections,
        "channels": ws_manager.channel_stats,
        "broadcaster_running": data_broadcaster._running,
    }

    all_ok = all(v == "connected" for v in db_status.values())

    return APIResponse(data={
        "status": "healthy" if all_ok else "degraded",
        "services": db_status,
        "redis": redis_status,
        "websocket": ws_status,
    })


@router.get(
    "/exchanges/status",
    response_model=APIResponse,
    summary="交易所连接状态",
    description="ADMIN-002: 查看各交易所的 API 连接状态（使用缓存 + 按需探测）。",
)
async def exchange_connections(user_id: str = Depends(get_current_user_id)):
    import asyncio
    from app.ws.broadcaster import data_broadcaster
    from datetime import datetime, UTC
    from app.services.market_data import market_data_service

    exchange_status = dict(data_broadcaster.exchange_status)

    # 对缺失状态的交易所主动探测（仅可用交易所，3s 超时）
    for ex in market_data_service.SUPPORTED_EXCHANGES:
        if ex not in exchange_status:
            try:
                await asyncio.wait_for(
                    market_data_service.get_ticker(ex, "BTC/USDT"),
                    timeout=3.0,
                )
                exchange_status[ex] = "connected"
            except Exception:
                exchange_status[ex] = "disconnected"

    return APIResponse(data={
        "exchanges": exchange_status,
        "timestamp": datetime.now(UTC).isoformat(),
    })


@router.get(
    "/strategies/running",
    response_model=APIResponse,
    summary="策略运行统计",
    description="ADMIN-003: 查询各状态策略数量和活跃用户数。",
)
async def running_strategies(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    # 按状态统计策略数量
    stmt = select(Strategy.status, func.count()).group_by(Strategy.status)
    result = await db.execute(stmt)
    status_counts = {row[0]: row[1] for row in result.all()}

    # 活跃用户数（有 live 状态策略的用户）
    active_stmt = select(func.count(func.distinct(Strategy.user_id))).where(
        Strategy.status == "live"
    )
    active_users = await db.scalar(active_stmt) or 0

    return APIResponse(data={
        "running": status_counts.get("live", 0),
        "paused": status_counts.get("paused", 0),
        "simulated": status_counts.get("simulated", 0),
        "backtested": status_counts.get("backtested", 0),
        "draft": status_counts.get("draft", 0),
        "active_users": active_users,
    })


@router.get(
    "/config",
    response_model=APIResponse,
    summary="全局参数配置",
    description="ADMIN-006: 获取系统全局配置参数。",
)
async def get_config(user_id: str = Depends(get_current_user_id)):
    from app.core.config import settings
    return APIResponse(data={
        "default_leverage": settings.DEFAULT_LEVERAGE,
        "default_max_position_pct": settings.DEFAULT_MAX_POSITION_PCT,
        "default_daily_loss_limit": settings.DEFAULT_DAILY_LOSS_LIMIT,
        "default_max_drawdown": settings.DEFAULT_MAX_DRAWDOWN,
        "data_retention": {
            "tick_days": settings.TICK_DATA_RETENTION_DAYS,
            "minute_kline_days": settings.MINUTE_KLINE_RETENTION_DAYS,
            "daily_kline_days": settings.DAILY_KLINE_RETENTION_DAYS,
        },
    })
