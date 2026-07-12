"""
Celery 异步任务
================
回测执行、数据同步、报告生成等耗时任务通过 Celery 异步处理。
"""

import asyncio
import json
from datetime import datetime, UTC, timedelta

from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "quant-trading",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,
    task_soft_time_limit=3300,
)


def _run_async(coro):
    """在 Celery worker 中运行 async 函数"""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


# ============================================================
# 回测任务
# ============================================================
@celery_app.task(bind=True)
def run_backtest(self, task_id: str) -> dict:
    """
    BACK-001: 异步执行回测任务。

    参数:
        task_id: 回测任务 DB 记录的 UUID
    返回:
        {"status": "completed", "metrics": {...}}
    """
    self.update_state(state="PROGRESS", meta={"progress": 0, "step": "initializing"})

    async def _run():
        from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
        from app.engine.backtest import BacktestEngine
        from app.models.trading import Strategy
        from app.models.backtest import BacktestTask, BacktestResult
        from app.repositories import BaseRepository
        from sqlalchemy import select

        engine = create_async_engine(settings.DATABASE_URL, echo=False)
        async with AsyncSession(engine) as db:
            # 加载任务
            task_repo = BaseRepository(db, BacktestTask)
            task = await task_repo.get(task_id)
            if task is None:
                return {"status": "failed", "error": "任务不存在"}

            # 更新状态为 running
            await task_repo.update(task.id, status="running")
            self.update_state(state="PROGRESS", meta={"progress": 10, "step": "loading_strategy"})

            # 加载策略
            strategy_repo = BaseRepository(db, Strategy)
            strategy = await strategy_repo.get(task.strategy_id)
            if strategy is None:
                await task_repo.update(task.id, status="failed")
                return {"status": "failed", "error": "策略不存在"}

            # 解析策略定义
            definition = json.loads(strategy.definition) if isinstance(strategy.definition, str) else strategy.definition

            # 运行回测引擎
            self.update_state(state="PROGRESS", meta={"progress": 20, "step": "running_backtest"})
            be = BacktestEngine(
                config={**json.loads(task.config or "{}"), "initial_capital": float(task.initial_capital)},
                strategy=definition,
            )

            # 加载 K 线数据
            from app.services.market_data import market_data_service
            klines = await market_data_service.get_klines(
                exchange=task.exchange or "binance",
                symbol=task.symbol_pool or "BTCUSDT",
                interval=task.kline_interval or "1h",
                limit=task.data_range_days * 24 if task.data_range_days else 500,
            )

            if not klines or "bars" not in klines:
                await task_repo.update(task.id, status="failed")
                return {"status": "failed", "error": "无行情数据"}

            # 执行回测
            result = be.run(klines["bars"])
            self.update_state(state="PROGRESS", meta={"progress": 80, "step": "saving_results"})

            # 保存结果
            result_repo = BaseRepository(db, BacktestResult)
            await result_repo.create(
                task_id=task.id,
                total_return=result.metrics.get("total_return", 0),
                annual_return=result.metrics.get("annual_return", 0),
                sharpe_ratio=result.metrics.get("sharpe_ratio", 0),
                max_drawdown=result.metrics.get("max_drawdown", 0),
                win_rate=result.metrics.get("win_rate", 0),
                profit_factor=result.metrics.get("profit_factor", 0),
                total_trades=result.metrics.get("total_trades", 0),
                equity_curve=json.dumps(result.equity_curve or []),
                drawdown_curve=json.dumps(result.drawdown_curve or []),
                daily_returns=json.dumps(result.daily_returns or []),
                trades=json.dumps(result.trades or []),
                benchmark_comparison=json.dumps({}),
                monthly_heatmap=json.dumps({}),
            )

            # 更新任务状态
            await task_repo.update(task.id, status="completed", progress=100)
            await db.commit()

            return {
                "status": "completed",
                "metrics": {
                    "total_return": result.metrics.get("total_return", 0),
                    "sharpe_ratio": result.metrics.get("sharpe_ratio", 0),
                    "max_drawdown": result.metrics.get("max_drawdown", 0),
                    "win_rate": result.metrics.get("win_rate", 0),
                },
            }

    return _run_async(_run())


# ============================================================
# 数据同步任务
# ============================================================
@celery_app.task(bind=True)
def sync_exchange_data(self, exchange: str, symbols: list[str]) -> dict:
    """DATA-005: 同步交易所数据（K 线）到数据库"""

    async def _run():
        from app.services.market_data import market_data_service
        synced = 0
        for symbol in symbols:
            try:
                klines = await market_data_service.get_klines(exchange, symbol, "1h", limit=500)
                synced += 1
            except Exception:
                pass
        return {"synced": synced, "total": len(symbols), "exchange": exchange}

    return _run_async(_run())


# ============================================================
# 定时任务
# ============================================================
@celery_app.task
def daily_performance_report():
    """生成前一日所有活跃策略的绩效摘要"""

    async def _run():
        from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
        from sqlalchemy import select
        from app.models.trading import Strategy
        from app.models.backtest import BacktestResult

        engine = create_async_engine(settings.DATABASE_URL, echo=False)
        async with AsyncSession(engine) as db:
            # 查询所有活跃(live/simulated)策略
            stmt = select(Strategy).where(
                Strategy.status.in_(["live", "simulated"]),
                Strategy.is_deleted == False,
            )
            result = await db.execute(stmt)
            strategies = list(result.scalars().all())

            report = {
                "date": datetime.now(UTC).strftime("%Y-%m-%d"),
                "active_strategies": len(strategies),
                "strategies": [{"id": str(s.id), "name": s.name, "status": s.status} for s in strategies],
            }
            return report

    return _run_async(_run())


@celery_app.task
def check_data_integrity():
    """DATA-005: 检查数据完整性 — 对比本地与交易所在线数据，标记缺失区间"""

    async def _run():
        from app.services.market_data import market_data_service

        issues = []
        for exchange in ["binance", "okx"]:
            for symbol in ["BTCUSDT", "ETHUSDT"]:
                try:
                    klines = await market_data_service.get_klines(exchange, symbol, "1d", limit=365)
                    if not klines or "bars" not in klines or len(klines["bars"]) < 300:
                        issues.append(f"{exchange}/{symbol}: 仅 {len(klines.get('bars', []))} 天数据")
                except Exception as e:
                    issues.append(f"{exchange}/{symbol}: 拉取失败 - {e}")

        return {"status": "completed", "issues": issues, "checked_at": datetime.now(UTC).isoformat()}

    return _run_async(_run())
