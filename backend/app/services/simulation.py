"""
模拟交易服务
============
模块四：模拟账户管理、模拟交易执行、绩效跟踪。
"""

import json
import uuid
from datetime import datetime, UTC
from decimal import Decimal
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories import BaseRepository
from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin
from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship


# ---- Sim Account Model (inline for speed) ----
class SimAccount(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "sim_accounts"
    user_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    account_type: Mapped[str] = mapped_column(String(20), default="spot", comment="spot|perpetual")
    initial_capital: Mapped[Decimal] = mapped_column(Numeric(24, 8), nullable=False)
    current_equity: Mapped[Decimal] = mapped_column(Numeric(24, 8), nullable=False)
    available_cash: Mapped[Decimal] = mapped_column(Numeric(24, 8), nullable=False)
    is_running: Mapped[bool] = mapped_column(default=False)


class SimTrade(Base, UUIDMixin):
    __tablename__ = "sim_trades"
    account_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("sim_accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    strategy_id: Mapped[Optional[uuid.UUID]] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    symbol: Mapped[str] = mapped_column(String(50), nullable=False)
    side: Mapped[str] = mapped_column(String(10), nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(24, 8), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(24, 8), nullable=False)
    commission: Mapped[Decimal] = mapped_column(Numeric(24, 8), default=0)
    pnl: Mapped[Optional[Decimal]] = mapped_column(Numeric(24, 8), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default="now()", nullable=False)


class SimulationService:
    def __init__(self, db: AsyncSession, user_id: str):
        self.db = db
        self.user_id = user_id
        self.account_repo = BaseRepository(db, SimAccount)
        self.trade_repo = BaseRepository(db, SimTrade)

    async def create_account(self, name: str, account_type: str, initial_capital: Decimal) -> SimAccount:
        return await self.account_repo.create(
            user_id=self.user_id, name=name, account_type=account_type,
            initial_capital=initial_capital, current_equity=initial_capital,
            available_cash=initial_capital,
        )

    async def list_accounts(self) -> list[SimAccount]:
        from sqlalchemy import select
        stmt = select(SimAccount).where(SimAccount.user_id == self.user_id).order_by(SimAccount.created_at.desc())
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_account(self, account_id: str) -> SimAccount:
        acct = await self.account_repo.get(uuid.UUID(account_id))
        if acct is None or str(acct.user_id) != self.user_id:
            raise ValueError("Account not found")
        return acct

    async def reset_account(self, account_id: str) -> SimAccount:
        acct = await self.get_account(account_id)
        return await self.account_repo.update(
            uuid.UUID(account_id),
            current_equity=acct.initial_capital,
            available_cash=acct.initial_capital,
        )

    async def delete_account(self, account_id: str):
        await self.get_account(account_id)
        await self.account_repo.delete(uuid.UUID(account_id))

    async def pause(self, account_id: str):
        await self.get_account(account_id)
        await self.account_repo.update(uuid.UUID(account_id), is_running=False)

    async def resume(self, account_id: str):
        await self.get_account(account_id)
        await self.account_repo.update(uuid.UUID(account_id), is_running=True)

    async def list_trades(self, account_id: str, page: int = 1, page_size: int = 20):
        from sqlalchemy import func, select
        filters = [SimTrade.account_id == account_id]
        count_stmt = select(func.count()).select_from(SimTrade).where(*filters)
        total = await self.db.scalar(count_stmt) or 0
        stmt = select(SimTrade).where(*filters).order_by(SimTrade.created_at.desc()).offset((page-1)*page_size).limit(page_size)
        result = await self.db.execute(stmt)
        return list(result.scalars().all()), total

    async def check_live_readiness(self, account_id: str) -> dict:
        """SIM-012: 实盘准入条件评估"""
        trades, _ = await self.list_trades(account_id, page=1, page_size=1000)
        acct = await self.get_account(account_id)
        days_running = (datetime.now(UTC) - acct.created_at.replace(tzinfo=None)).days
        winning = [t for t in trades if t.pnl and t.pnl > 0]
        win_rate = len(winning) / len(trades) * 100 if trades else 0

        conditions = {
            "min_days_30": {"met": days_running >= 30, "current": days_running, "required": 30},
            "win_rate_40": {"met": win_rate >= 40, "current": round(win_rate, 1), "required": 40},
            "sharpe_1": {"met": False, "note": "需要运行模拟回测计算夏普比率"},
            "max_drawdown_30": {"met": True, "note": "需运行模拟回测确认"},
        }
        all_met = all(c["met"] for c in conditions.values())
        return {
            "ready": all_met,
            "recommendation": "建议可考虑实盘" if all_met else "暂不建议实盘",
            "conditions": conditions,
        }

    # ================================================================
    # 模拟引擎管理
    # ================================================================
    async def start_engine(
        self,
        account_id: str,
        strategy_id: str,
        strategy_definition: dict,
        symbol: str = "BTCUSDT",
        exchange: str = "binance",
        kline_interval: str = "1h",
    ):
        """启动模拟交易引擎"""
        from app.engine.simulation import SimulationEngine

        engine = SimulationEngine(
            db=self.db,
            user_id=self.user_id,
            account_id=account_id,
            strategy_id=strategy_id,
            strategy_definition=strategy_definition,
            symbol=symbol,
            exchange=exchange,
            kline_interval=kline_interval,
        )
        await engine.start()
        # 更新账户状态
        await self.account_repo.update(uuid.UUID(account_id), is_running=True)
        return engine

    async def stop_engine(self, account_id: str, engine=None):
        """停止模拟交易引擎"""
        if engine:
            await engine.stop()
        await self.account_repo.update(uuid.UUID(account_id), is_running=False)
