"""
交易管道
========
策略信号 → 风控检查 → 创建订单 → 提交交易所 → 状态跟踪 的完整流程协调器。
"""

import json
import uuid
from datetime import datetime, UTC
from decimal import Decimal
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.execution.executor import OrderExecutor, OrderExecutionError
from app.execution.tracker import OrderTracker
from app.models.risk import RiskEvent
from app.models.trading import Order
from app.repositories import BaseRepository
from app.risk import risk_engine
from app.services.risk import RiskService


class TradingPipeline:
    """
    完整交易管道协调器。

    执行流程：
    signal → RiskEngine.pre_trade_check → 创建 Order → OrderExecutor.submit → 返回
    """

    def __init__(self, db: AsyncSession, user_id: str):
        self.db = db
        self.user_id = user_id
        self.executor = OrderExecutor(db)
        self.risk_service = RiskService(db, user_id)

    async def execute_signal(
        self,
        strategy_id: str,
        signal: dict,
        api_key_id: str,
        symbol: str,
        leverage: Optional[int] = None,
    ) -> Order:
        """
        执行策略信号（完整管道）。

        参数:
            strategy_id: 策略 ID
            signal: 策略输出的信号 dict
            api_key_id: 使用的 API Key ID
            symbol: 交易对
            leverage: 杠杆倍数（合约）

        返回:
            创建的 Order 对象

        抛出:
            OrderExecutionError: 风控拒绝或交易所错误
        """
        # 解析信号
        side = signal.get("action", signal.get("side", "buy"))
        order_type = signal.get("order_type", "market")
        amount = signal.get("amount", 0)
        price = signal.get("price")

        # ---- Step 1: 风控检查 ----
        order_for_check = {
            "symbol": symbol,
            "side": side,
            "amount": amount,
            "price": price,
            "leverage": leverage,
        }
        passed, reason = await self.risk_service.run_pre_trade_check(
            strategy_id, order_for_check,
        )
        if not passed:
            # 创建拒绝事件
            await self._create_rejected_order(strategy_id, api_key_id, symbol, side,
                                              order_type, amount, price, leverage, reason)
            raise OrderExecutionError(f"风控拒绝: {reason}")

        # ---- Step 2: 创建订单记录 ----
        order = await self._create_order(
            strategy_id=strategy_id,
            api_key_id=api_key_id,
            symbol=symbol,
            side=side,
            order_type=order_type,
            amount=amount,
            price=price,
            leverage=leverage,
        )

        # ---- Step 3: 提交到交易所 ----
        try:
            await self.executor.submit_order(str(order.id))
        except OrderExecutionError as e:
            # 风控拒绝事件已在 pre_trade_check 中创建
            raise

        return order

    async def _create_order(
        self,
        strategy_id: str,
        api_key_id: str,
        symbol: str,
        side: str,
        order_type: str,
        amount: float,
        price: Optional[float] = None,
        leverage: Optional[int] = None,
    ) -> Order:
        """创建订单 DB 记录"""
        repo = BaseRepository(self.db, Order)
        order = await repo.create(
            user_id=self.user_id,
            strategy_id=strategy_id if strategy_id else None,
            api_key_id=api_key_id,
            exchange="",  # 从 api_key 自动获取
            symbol=symbol,
            side=side,
            order_type=order_type,
            amount=Decimal(str(amount)),
            price=Decimal(str(price)) if price else None,
            leverage=leverage,
            status="created",
        )
        return order

    async def _create_rejected_order(
        self,
        strategy_id: str,
        api_key_id: str,
        symbol: str,
        side: str,
        order_type: str,
        amount: float,
        price: Optional[float],
        leverage: Optional[int],
        reason: str,
    ):
        """创建被拒绝的订单（用于审计追踪）"""
        repo = BaseRepository(self.db, Order)
        await repo.create(
            user_id=self.user_id,
            strategy_id=strategy_id if strategy_id else None,
            api_key_id=api_key_id,
            exchange="",
            symbol=symbol,
            side=side,
            order_type=order_type,
            amount=Decimal(str(amount)),
            price=Decimal(str(price)) if price else None,
            leverage=leverage,
            status="rejected",
        )
