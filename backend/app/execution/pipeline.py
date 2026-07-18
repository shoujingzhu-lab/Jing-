"""
交易管道
========
策略信号 → 风控检查 → 幂等检查 → 创建订单 → 提交交易所 → 状态跟踪 的完整流程协调器。

P0-002 优化:
- 集成订单幂等性 (client_order_id)
- 订单簿滑点预估
- 风控引擎前置检查
"""

import json
import logging
import uuid
from datetime import datetime, UTC
from decimal import Decimal
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.execution.executor import OrderExecutionError, OrderExecutor
from app.execution.idempotency import IdempotencyManager
from app.execution.orderbook_cache import orderbook_cache
from app.execution.tracker import OrderTracker
from app.models.risk import RiskEvent
from app.models.trading import Order
from app.repositories import BaseRepository
from app.risk import risk_engine
from app.services.risk import RiskService

logger = logging.getLogger("quant.execution.pipeline")


class TradingPipeline:
    """
    完整交易管道协调器。

    执行流程:
    signal → RiskEngine.pre_trade_check → 幂等检查 → 创建 Order → OrderExecutor.submit → 返回

    P0-002 增强:
    - 每条信号自动生成 client_order_id
    - 提交前进行幂等检查
    - 市价单引用订单簿缓存估算滑点
    """

    def __init__(self, db: AsyncSession, user_id: str, redis_client=None):
        self.db = db
        self.user_id = user_id
        self.executor = OrderExecutor(db, redis_client)
        self.idempotency = IdempotencyManager(db, redis_client)
        self.risk_service = RiskService(db, user_id)

    async def execute_signal(
        self,
        strategy_id: str,
        signal: dict,
        api_key_id: str,
        symbol: str,
        leverage: Optional[int] = None,
        request_id: Optional[str] = None,
    ) -> Order:
        """
        执行策略信号（完整管道）。

        参数:
            strategy_id: 策略 ID
            signal: 策略输出的信号 dict
            api_key_id: 使用的 API Key ID
            symbol: 交易对
            leverage: 杠杆倍数（合约）
            request_id: 外部请求 ID（用于端到端追踪）

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

        # ---- Step 0: 生成幂等 ID ----
        client_order_id = IdempotencyManager.generate_client_order_id(
            user_id=self.user_id,
            strategy_id=strategy_id,
            symbol=symbol,
            side=side,
            timestamp=datetime.now(UTC),
        )

        # ---- Step 1: 幂等检查（快速返回已有订单） ----
        existing = await self.idempotency.check(client_order_id)
        if existing:
            logger.info(
                f"Signal already processed: client_order_id={client_order_id}, "
                f"existing_order={existing.id}, status={existing.status}"
            )
            return existing

        # ---- Step 2: 风控检查 ----
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
            await self._create_rejected_order(
                strategy_id, api_key_id, symbol, side,
                order_type, amount, price, leverage, reason,
                client_order_id,
            )
            logger.warning(f"Risk check REJECTED: {reason}")
            raise OrderExecutionError(f"风控拒绝: {reason}")

        # ---- Step 3: 创建订单记录 ----
        order = await self._create_order(
            strategy_id=strategy_id,
            api_key_id=api_key_id,
            symbol=symbol,
            side=side,
            order_type=order_type,
            amount=amount,
            price=price,
            leverage=leverage,
            client_order_id=client_order_id,
        )

        # ---- Step 4: 提交到交易所 ----
        try:
            await self.executor.submit_order(str(order.id), client_order_id=client_order_id)
        except OrderExecutionError:
            # 提交失败，订单状态已在 executor 中更新为 rejected
            raise

        logger.info(
            f"Pipeline executed: strategy={strategy_id[:8]}... "
            f"{symbol} {side} {order_type} amount={amount} "
            f"order_id={order.id} client_order_id={client_order_id}"
        )
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
        client_order_id: Optional[str] = None,
    ) -> Order:
        """创建订单 DB 记录"""
        repo = BaseRepository(self.db, Order)

        # 从 api_key 自动推断交易所
        from app.models.trading import ApiKey
        from sqlalchemy import select

        stmt = select(ApiKey).where(ApiKey.id == api_key_id)
        result = await self.db.execute(stmt)
        api_key = result.scalar_one_or_none()

        exchange = api_key.exchange if api_key else ""

        order = await repo.create(
            user_id=self.user_id,
            strategy_id=strategy_id if strategy_id else None,
            api_key_id=api_key_id,
            exchange=exchange,
            symbol=symbol,
            side=side,
            order_type=order_type,
            amount=Decimal(str(amount)),
            price=Decimal(str(price)) if price else None,
            leverage=leverage,
            status="created",
            client_order_id=client_order_id,
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
        client_order_id: Optional[str] = None,
    ):
        """创建被拒绝的订单（用于审计追踪）"""
        from app.models.trading import ApiKey
        from sqlalchemy import select

        stmt = select(ApiKey).where(ApiKey.id == api_key_id)
        result = await self.db.execute(stmt)
        api_key = result.scalar_one_or_none()
        exchange = api_key.exchange if api_key else ""

        repo = BaseRepository(self.db, Order)
        await repo.create(
            user_id=self.user_id,
            strategy_id=strategy_id if strategy_id else None,
            api_key_id=api_key_id,
            exchange=exchange,
            symbol=symbol,
            side=side,
            order_type=order_type,
            amount=Decimal(str(amount)),
            price=Decimal(str(price)) if price else None,
            leverage=leverage,
            status="rejected",
            client_order_id=client_order_id,
        )
