"""
订单追踪器
==========
后台轮询未成交订单，从交易所同步状态更新到 DB。
"""

import asyncio
from datetime import datetime, UTC
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters import create_adapter
from app.core.security import decrypt_api_secret
from app.models.trading import ApiKey, Order


class OrderTracker:
    """订单状态追踪器 — 同步交易所订单状态"""

    def __init__(self, db: AsyncSession, poll_interval: float = 5.0):
        self.db = db
        self.poll_interval = poll_interval
        self._running = False
        self._task: asyncio.Task | None = None

    async def start(self):
        """启动后台追踪"""
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._poll_loop())

    async def stop(self):
        """停止后台追踪"""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    async def sync_order(self, order_id: str) -> Order | None:
        """同步单个订单的状态"""
        stmt = select(Order).where(Order.id == order_id)
        result = await self.db.execute(stmt)
        order = result.scalar_one_or_none()
        if order is None or not order.exchange_order_id:
            return None

        return await self._sync_single(order)

    async def _poll_loop(self):
        """轮询循环 — 同步所有 open 状态的订单"""
        while self._running:
            try:
                # 查找需要同步的订单
                stmt = select(Order).where(
                    Order.status.in_(["submitted", "partially_filled"])
                ).order_by(Order.updated_at)
                result = await self.db.execute(stmt)
                orders = list(result.scalars().all())

                for order in orders:
                    try:
                        await self._sync_single(order)
                    except Exception:
                        pass  # 单个订单同步失败不影响其他
            except asyncio.CancelledError:
                break
            except Exception:
                pass
            await asyncio.sleep(self.poll_interval)

    async def _sync_single(self, order: Order) -> Order:
        """同步单个订单：查交易所 → 更新 DB"""
        # 加载 API Key
        stmt = select(ApiKey).where(ApiKey.id == order.api_key_id)
        result = await self.db.execute(stmt)
        api_key = result.scalar_one_or_none()
        if api_key is None:
            return order

        try:
            secret = decrypt_api_secret(api_key.secret_key_encrypted)
        except Exception:
            return order

        adapter = create_adapter(
            exchange=api_key.exchange,
            api_key=api_key.access_key,
            secret=secret,
        )

        # 查询交易所挂单状态
        try:
            open_orders = await adapter.fetch_open_orders(symbol=order.symbol)
        except Exception:
            return order  # 网络错误等，下次重试

        # 在挂单列表中查找匹配的订单
        exchange_order = None
        target_id = str(order.exchange_order_id)
        for o in open_orders:
            if str(o.get("id", "")) == target_id:
                exchange_order = o
                break

        if exchange_order is None:
            # 不在挂单中，可能已成交/取消
            # 保守处理：保持当前状态，等下次轮询确认
            return order

        # 映射状态
        status_map = {
            "open": "submitted",
            "closed": "filled",
            "canceled": "cancelled",
            "expired": "expired",
            "rejected": "rejected",
        }
        new_status = status_map.get(
            exchange_order.get("status", ""), order.status
        )

        # 更新字段
        if new_status != order.status:
            order.status = new_status
        if exchange_order.get("filled"):
            order.filled_amount = Decimal(str(exchange_order["filled"]))
        if exchange_order.get("average"):
            order.avg_fill_price = Decimal(str(exchange_order["average"]))
        if exchange_order.get("cost"):
            order.commission = Decimal(str(exchange_order.get("cost", 0)))

        await self.db.flush()
        return order
