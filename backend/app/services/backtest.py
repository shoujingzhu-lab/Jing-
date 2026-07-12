"""
回测服务层
==========
模块三业务逻辑：创建回测任务、执行回测、查询结果、参数优化。
"""

import json
from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.backtest import (
    BacktestResult,
    BacktestTask,
    ParameterOptimizationTask,
)
from app.models.trading import Strategy
from app.repositories import BaseRepository


# ============================================================
# Repositories
# ============================================================
class BacktestTaskRepository(BaseRepository[BacktestTask]):
    def __init__(self, db: AsyncSession):
        super().__init__(db, BacktestTask)

    async def list_by_user(
        self, user_id: str, page: int = 1, page_size: int = 20,
        status: Optional[str] = None,
    ) -> tuple[list[BacktestTask], int]:
        filters = [BacktestTask.user_id == user_id]
        if status:
            filters.append(BacktestTask.status == status)
        return await self.list(
            *filters, page=page, page_size=page_size,
            order_by=BacktestTask.created_at.desc(),
        )


class BacktestResultRepository(BaseRepository[BacktestResult]):
    def __init__(self, db: AsyncSession):
        super().__init__(db, BacktestResult)

    async def get_by_task_id(self, task_id: str) -> Optional[BacktestResult]:
        from sqlalchemy import select
        stmt = select(BacktestResult).where(BacktestResult.task_id == task_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()


class ParamOptRepository(BaseRepository[ParameterOptimizationTask]):
    def __init__(self, db: AsyncSession):
        super().__init__(db, ParameterOptimizationTask)

    async def list_by_user(
        self, user_id: str, page: int = 1, page_size: int = 20,
    ) -> tuple[list[ParameterOptimizationTask], int]:
        filters = [ParameterOptimizationTask.user_id == user_id]
        return await self.list(
            *filters, page=page, page_size=page_size,
            order_by=ParameterOptimizationTask.created_at.desc(),
        )


# ============================================================
# Exceptions
# ============================================================
class BacktestError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code


class BacktestNotFoundError(BacktestError):
    def __init__(self, task_id: str = ""):
        super().__init__(f"回测任务 {task_id} 不存在", 404)


# ============================================================
# Service
# ============================================================
class BacktestService:
    """回测业务服务"""

    def __init__(self, db: AsyncSession, user_id: str):
        self.db = db
        self.user_id = user_id
        self.task_repo = BacktestTaskRepository(db)
        self.result_repo = BacktestResultRepository(db)
        self.param_repo = ParamOptRepository(db)
        self.strategy_repo = BaseRepository(db, Strategy)

    async def create_task(self, data) -> BacktestTask:
        """BACK-001: 创建回测任务"""
        # 如果传了 strategy_id，加载策略定义
        definition = data.definition
        if data.strategy_id and not definition:
            strategy = await self.strategy_repo.get(data.strategy_id)
            if strategy and strategy.definition:
                definition = json.loads(strategy.definition)

        task = await self.task_repo.create(
            user_id=self.user_id,
            strategy_id=str(data.strategy_id) if data.strategy_id else None,
            name=data.name,
            symbols=json.dumps(data.symbols),
            exchange=data.exchange,
            kline_interval=data.kline_interval.value if hasattr(data.kline_interval, "value") else data.kline_interval,
            start_date=data.start_date,
            end_date=data.end_date,
            initial_capital=data.initial_capital,
            commission_rate=data.commission_rate,
            slippage=data.slippage,
            fill_mode=data.fill_mode,
            status="pending",
        )

        # 存储 definition 到 task 的元数据（通过策略关联）
        if definition:
            task.strategy_id = task.strategy_id or str(task.id)

        return task

    async def get_task(self, task_id: str) -> BacktestTask:
        task = await self.task_repo.get(UUID(task_id))
        if task is None:
            raise BacktestNotFoundError(task_id)
        if str(task.user_id) != self.user_id:
            raise BacktestError("无权限访问", 403)
        return task

    async def list_tasks(
        self, page: int = 1, page_size: int = 20, status: Optional[str] = None,
    ) -> tuple[list[BacktestTask], int]:
        return await self.task_repo.list_by_user(
            self.user_id, page, page_size, status,
        )

    async def get_result(self, task_id: str) -> Optional[BacktestResult]:
        task = await self.get_task(task_id)
        return await self.result_repo.get_by_task_id(task_id)

    async def execute_backtest(self, task_id: str, klines_data: dict) -> BacktestResult:
        """执行回测并保存结果"""
        from app.engine.backtest import BacktestEngine
        from app.engine.interpreter import VisualStrategyInterpreter

        task = await self.get_task(task_id)

        # 获取策略定义
        definition = None
        if task.strategy_id:
            strategy = await self.strategy_repo.get(UUID(task.strategy_id))
            if strategy and strategy.definition:
                try:
                    definition = json.loads(strategy.definition)
                except (json.JSONDecodeError, TypeError):
                    definition = {"nodes": [], "edges": []}

        if not definition:
            raise BacktestError("策略定义缺失", 400)

        # 更新状态为运行中
        await self.task_repo.update(UUID(task_id), status="running", progress=0)

        try:
            # 运行回测引擎
            engine = BacktestEngine({
                "symbols": json.loads(task.symbols) if isinstance(task.symbols, str) else task.symbols,
                "initial_capital": float(task.initial_capital),
                "commission_rate": task.commission_rate,
                "slippage": task.slippage,
                "fill_mode": task.fill_mode,
                "trade_type": "spot",
            })
            engine.load_data(klines_data)

            interpreter = VisualStrategyInterpreter(definition)
            engine.run(interpreter)
            report = engine.generate_report()

            await self.task_repo.update(UUID(task_id), progress=50)

            # 保存结果
            result = await self.result_repo.create(
                task_id=task_id,
                total_return_pct=report["total_return_pct"],
                annual_return_pct=report["annual_return_pct"],
                annual_volatility_pct=report["annual_volatility_pct"],
                sharpe_ratio=report["sharpe_ratio"],
                max_drawdown_pct=report["max_drawdown_pct"],
                calmar_ratio=report["calmar_ratio"],
                win_rate_pct=report["win_rate_pct"],
                profit_loss_ratio=report["profit_loss_ratio"],
                avg_hold_hours=report["avg_hold_hours"],
                total_trades=report["total_trades"],
                max_consecutive_losses=report["max_consecutive_losses"],
                initial_capital=Decimal(str(report["initial_capital"])),
                final_equity=Decimal(str(report["final_equity"])),
                total_commission=Decimal(str(report["total_commission"])),
                total_funding_fee=Decimal(str(report["total_funding_fee"])),
                equity_curve=json.dumps(report["equity_curve"]),
                drawdown_curve=json.dumps(report["drawdown_curve"]),
                daily_returns=json.dumps(report["daily_returns"]),
                trades=json.dumps(report["trades"]),
            )

            await self.task_repo.update(UUID(task_id), status="completed", progress=100)
            return result

        except Exception as e:
            await self.task_repo.update(
                UUID(task_id),
                status="failed",
                error_message=str(e),
            )
            raise BacktestError(f"回测执行失败: {e}", 500)

    async def cancel_task(self, task_id: str):
        task = await self.get_task(task_id)
        if task.status not in ("pending", "running"):
            raise BacktestError("只能取消 pending 或 running 的任务", 400)
        await self.task_repo.update(UUID(task_id), status="cancelled")

    # --- 参数优化 ---

    async def create_optimization(self, data) -> ParameterOptimizationTask:
        task = await self.param_repo.create(
            user_id=self.user_id,
            strategy_id=str(data.strategy_id),
            name=data.name,
            param_grid=json.dumps(data.param_grid),
            optimization_method=data.optimization_method,
            metric=data.metric,
            symbols=json.dumps(data.symbols),
            exchange=data.exchange,
            kline_interval=data.kline_interval.value if hasattr(data.kline_interval, "value") else data.kline_interval,
            start_date=data.start_date,
            end_date=data.end_date,
            initial_capital=data.initial_capital,
            train_ratio=data.train_ratio,
            status="pending",
        )

        # 计算参数组合数
        total = 1
        for key, cfg in data.param_grid.items():
            n = int((cfg.get("max", 10) - cfg.get("min", 1)) / cfg.get("step", 1)) + 1
            total *= n
        await self.param_repo.update(task.id, total_combinations=total)

        return task

    async def get_optimization(self, task_id: str) -> ParameterOptimizationTask:
        task = await self.param_repo.get(UUID(task_id))
        if task is None:
            raise BacktestError(f"优化任务 {task_id} 不存在", 404)
        if str(task.user_id) != self.user_id:
            raise BacktestError("无权限访问", 403)
        return task

    async def list_optimizations(
        self, page: int = 1, page_size: int = 20,
    ) -> tuple[list[ParameterOptimizationTask], int]:
        return await self.param_repo.list_by_user(self.user_id, page, page_size)
