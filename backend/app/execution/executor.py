"""
订单执行器
==========
解密 API Key → 创建交易所适配器 → 提交订单 → 更新订单状态。
"""

import json
import uuid
from datetime import datetime, UTC
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters import create_adapter
from app.core.security import decrypt_api_secret
from app.models.trading import ApiKey, Order


class OrderExecutor:
    """订单执行器 — 将 DB 订单提交到真实交易所"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def submit_order(self, order_id: str) -> Order:
        """
        提交订单到交易所。

        流程：
        1. 加载订单（验证状态为 created）
        2. 加载 API Key 并解密
        3. 创建交易所适配器
        4. 调用适配器 create_order()
        5. 更新订单状态和交易所返回的 order_id
        """
        # 1. 加载订单
        order = await self._get_order(order_id)
        if order is None:
            raise OrderExecutionError("订单不存在", order_id)
        if order.status != "created":
            raise OrderExecutionError(f"订单状态 '{order.status}' 不允许提交", order_id)

        # 2. 加载并解密 API Key
        api_key = await self._get_api_key(str(order.api_key_id))
        if api_key is None:
            raise OrderExecutionError("API Key 不存在或已删除", order_id)

        try:
            secret = decrypt_api_secret(api_key.secret_key_encrypted)
            passphrase = (
                decrypt_api_secret(api_key.passphrase_encrypted)
                if api_key.passphrase_encrypted
                else None
            )
        except Exception as e:
            raise OrderExecutionError(f"API Key 解密失败: {e}", order_id)

        # 3. 创建适配器
        adapter = create_adapter(
            exchange=api_key.exchange,
            api_key=api_key.access_key,
            secret=secret,
            passphrase=passphrase,
        )

        # 4. 提交到交易所
        try:
            exchange_order = await adapter.create_order(
                symbol=order.symbol,
                side=order.side,
                order_type=order.order_type,
                amount=float(order.amount),
                price=float(order.price) if order.price else None,
            )
        except Exception as e:
            # 提交失败，标记为 rejected
            await self._update_status(order, "rejected")
            raise OrderExecutionError(f"交易所拒绝: {e}", order_id)

        # 5. 更新订单
        exchange_order_id = exchange_order.get("id", "")
        order.exchange_order_id = str(exchange_order_id)
        order.status = "submitted"
        await self.db.flush()

        return order

    async def submit_pending_orders(self, user_id: str = None) -> int:
        """批量提交所有 'created' 状态的订单。返回成功提交数。"""
        filters = [Order.status == "created"]
        if user_id:
            filters.append(Order.user_id == user_id)

        stmt = select(Order).where(*filters).order_by(Order.created_at)
        result = await self.db.execute(stmt)
        orders = list(result.scalars().all())

        count = 0
        for order in orders:
            try:
                await self.submit_order(str(order.id))
                count += 1
            except OrderExecutionError:
                pass  # 单个订单失败不影响其他
        return count

    # ---- 内部 ----

    async def _get_order(self, order_id: str) -> Order | None:
        stmt = select(Order).where(Order.id == order_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def _get_api_key(self, key_id: str) -> ApiKey | None:
        stmt = select(ApiKey).where(ApiKey.id == key_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def _update_status(self, order: Order, status: str):
        order.status = status
        await self.db.flush()


class OrderExecutionError(Exception):
    """订单执行异常"""

    def __init__(self, message: str, order_id: str = ""):
        self.message = message
        self.order_id = order_id
        super().__init__(message)
