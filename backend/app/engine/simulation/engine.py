"""
模拟交易执行引擎
================
实时/回放模拟执行引擎。

引擎循环：
1. 拉取最新 K 线 → 2. 运行策略解释器 → 3. 风控检查 → 4. 执行模拟交易 → 5. 更新账户

依赖：VisualStrategyInterpreter + RiskEngine + MarketDataService
"""

import asyncio
import json
import uuid
from datetime import datetime, UTC
from decimal import Decimal
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.engine.interpreter import VisualStrategyInterpreter
from app.risk import risk_engine
from app.services.market_data import market_data_service


class SimulationEngine:
    """
    模拟交易执行引擎。

    在模拟账户上运行可视化策略，使用实时（或回放）行情数据驱动。
    """

    def __init__(
        self,
        db: AsyncSession,
        user_id: str,
        account_id: str,
        strategy_id: str,
        strategy_definition: dict,
        symbol: str = "BTCUSDT",
        exchange: str = "binance",
        kline_interval: str = "1h",
        trade_type: str = "spot",
    ):
        self.db = db
        self.user_id = user_id
        self.account_id = account_id
        self.strategy_id = strategy_id
        self.symbol = symbol
        self.exchange = exchange
        self.kline_interval = kline_interval
        self.trade_type = trade_type

        # 初始化策略解释器
        self._interpreter = VisualStrategyInterpreter(strategy_definition)

        # 运行状态
        self._running = False
        self._paused = False
        self._task: Optional[asyncio.Task] = None

        # 追踪
        self._trade_count = 0
        self._total_pnl = Decimal("0")
        self._started_at: Optional[datetime] = None
        self._last_bar_time: Optional[str] = None

    # ================================================================
    # 生命周期
    # ================================================================

    async def start(self):
        """启动模拟引擎"""
        if self._running:
            return
        self._running = True
        self._paused = False
        self._started_at = datetime.now(UTC)
        self._task = asyncio.create_task(self._run_loop())

    async def stop(self):
        """停止模拟引擎"""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    async def pause(self):
        """暂停模拟"""
        self._paused = True

    async def resume(self):
        """恢复模拟"""
        self._paused = False

    @property
    def is_running(self) -> bool:
        return self._running and not self._paused

    @property
    def status(self) -> dict:
        return {
            "running": self._running,
            "paused": self._paused,
            "started_at": self._started_at.isoformat() if self._started_at else None,
            "trade_count": self._trade_count,
            "total_pnl": float(self._total_pnl),
            "symbol": self.symbol,
            "interval": self.kline_interval,
            "last_bar_time": self._last_bar_time,
        }

    # ================================================================
    # 主循环
    # ================================================================

    async def _run_loop(self):
        """主模拟循环"""
        poll_seconds = self._interval_to_seconds(self.kline_interval)

        while self._running:
            try:
                if not self._paused:
                    await self._tick()
                await asyncio.sleep(poll_seconds)
            except asyncio.CancelledError:
                break
            except Exception:
                # 单次 tick 失败不退出循环
                await asyncio.sleep(5)

    async def _tick(self):
        """执行一个模拟周期"""
        # 1. 拉取最新 K 线
        klines_data = await market_data_service.get_klines(
            self.exchange, self.symbol, self.kline_interval, limit=100,
        )
        if not klines_data or "bars" not in klines_data:
            return

        bars = klines_data["bars"]
        if len(bars) < 2:
            return

        # 检查是否有新 K 线
        latest = bars[-1]
        bar_time = latest.get("open_time", "")
        if bar_time == self._last_bar_time:
            return  # 没有新 K 线，跳过
        self._last_bar_time = bar_time

        # 2. 构建 klines dict 供解释器使用
        klines = self._build_klines_dict(bars)
        prev_klines = self._build_klines_dict(bars[:-1])

        # 3. 运行策略解释器
        signal = self._interpreter.evaluate(klines, prev_klines)
        if signal is None:
            return

        # 4. 风控检查（使用模拟规则的简化版本）
        order = {
            "symbol": self.symbol,
            "side": signal.get("action", signal.get("side", "buy")),
            "amount": signal.get("amount", 0),
            "price": float(latest.get("close", 0)),
        }
        passed, reason = await risk_engine.pre_trade_check(
            user_id=self.user_id,
            strategy_id=self.strategy_id,
            order=order,
            active_rules=[],
            active_breakers=[],
            blacklist=[],
        )
        if not passed:
            return

        # 5. 执行模拟交易
        await self._execute_trade(signal, latest)

    async def _execute_trade(self, signal: dict, kline: dict):
        """执行模拟交易（更新账户 + 创建交易记录）"""
        from decimal import Decimal
        from app.services.simulation import SimTrade

        action = signal.get("action", signal.get("side", "buy"))
        amount = Decimal(str(signal.get("amount", 0)))
        price = Decimal(str(kline.get("close", 0)))

        if amount <= 0 or price <= 0:
            return

        # 读取当前账户
        from app.services.simulation import SimAccount
        from sqlalchemy import select

        stmt = select(SimAccount).where(SimAccount.id == self.account_id)
        result = await self.db.execute(stmt)
        account = result.scalar_one_or_none()
        if account is None:
            return

        cost = amount * price
        commission = cost * Decimal("0.001")  # 0.1% 模拟手续费

        # 更新账户
        current_equity = Decimal(str(account.current_equity))
        current_cash = Decimal(str(account.available_cash))

        # 假设市价单（简化版本——完全成交）
        pnl = Decimal("0")
        if action in ("buy", "long_entry"):
            # 做多：用现金买币
            if current_cash < cost + commission:
                return
            new_cash = current_cash - cost - commission
            # 暂时简化：equity = cash（不持有虚拟头寸时）
            new_equity = current_equity - commission
        elif action in ("sell", "close_long"):
            new_cash = current_cash + cost - commission
            new_equity = current_equity - commission
            pnl = Decimal(str(signal.get("pnl", 0)))
        elif action in ("short_entry",):
            new_cash = current_cash + cost - commission
            new_equity = current_equity - commission
        elif action in ("close_short",):
            new_cash = current_cash - cost - commission
            new_equity = current_equity - commission
            pnl = Decimal(str(signal.get("pnl", 0)))
        else:
            return

        # 更新数据库
        from app.repositories import BaseRepository
        repo = BaseRepository(self.db, SimAccount)
        await repo.update(
            uuid.UUID(self.account_id),
            current_equity=new_equity,
            available_cash=new_cash,
        )

        # 创建交易记录
        trade_repo = BaseRepository(self.db, SimTrade)
        await trade_repo.create(
            account_id=uuid.UUID(self.account_id),
            strategy_id=uuid.UUID(self.strategy_id) if self.strategy_id else None,
            symbol=self.symbol,
            side=action,
            price=price,
            amount=amount,
            commission=commission,
            pnl=pnl,
        )

        self._trade_count += 1
        self._total_pnl += pnl

    # ================================================================
    # 辅助
    # ================================================================

    @staticmethod
    def _build_klines_dict(bars: list) -> dict:
        """将 bar 列表转为解释器需要的 dict-of-list 格式"""
        if not bars:
            return {}
        keys = ["open", "high", "low", "close", "volume"]
        result = {k: [] for k in keys}
        for bar in bars:
            for k in keys:
                result[k].append(float(bar.get(k, 0)))
        return result

    @staticmethod
    def _interval_to_seconds(interval: str) -> int:
        """将 K 线周期转为秒数"""
        mapping = {
            "1m": 60, "3m": 180, "5m": 300, "15m": 900,
            "30m": 1800, "1h": 3600, "4h": 14400, "1d": 86400,
        }
        return mapping.get(interval, 3600)
