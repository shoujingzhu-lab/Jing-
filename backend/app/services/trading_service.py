"""
实盘交易服务
============
模块五：交易所对接、订单管理、仓位管理、资金费率、交易日志。
"""

import json
from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.trading import ApiKey, Order, Position, TradingAccount
from app.repositories import BaseRepository


class TradingService:
    def __init__(self, db: AsyncSession, user_id: str):
        self.db = db
        self.user_id = user_id
        self.apikey_repo = BaseRepository(db, ApiKey)
        self.order_repo = BaseRepository(db, Order)
        self.position_repo = BaseRepository(db, Position)

    async def bind_api_key(self, exchange: str, label: str, access_key: str, secret_key: str,
                           passphrase: Optional[str] = None) -> ApiKey:
        from app.core.security import encrypt_api_secret
        return await self.apikey_repo.create(
            user_id=self.user_id, exchange=exchange, label=label,
            access_key=encrypt_api_secret(access_key),
            secret_key_encrypted=encrypt_api_secret(secret_key),
            passphrase_encrypted=encrypt_api_secret(passphrase) if passphrase else None,
            has_withdraw_permission=False,
        )

    async def list_api_keys(self) -> list[ApiKey]:
        stmt = select(ApiKey).where(ApiKey.user_id == self.user_id, ApiKey.is_active == True)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def delete_api_key(self, key_id: str):
        key = await self.apikey_repo.get(UUID(key_id))
        if key and key.user_id == self.user_id:
            await self.apikey_repo.update(UUID(key_id), is_active=False)

    async def create_order(self, strategy_id: Optional[str], api_key_id: str,
                           symbol: str, side: str, order_type: str, amount: Decimal,
                           price: Optional[Decimal] = None, leverage: Optional[int] = None,
                           auto_submit: bool = False) -> Order:
        order = await self.order_repo.create(
            user_id=self.user_id, strategy_id=strategy_id, api_key_id=api_key_id,
            exchange="binance", symbol=symbol, side=side, order_type=order_type,
            price=price, amount=amount, leverage=leverage, status="created",
        )
        if auto_submit:
            from app.execution import OrderExecutor
            executor = OrderExecutor(self.db)
            try:
                order = await executor.submit_order(str(order.id))
            except Exception:
                order.status = "rejected"
                await self.db.flush()
        return order

    async def submit_order(self, order_id: str) -> Order:
        """将已创建的订单提交到交易所"""
        from app.execution import OrderExecutor
        executor = OrderExecutor(self.db)
        return await executor.submit_order(order_id)

    async def list_orders(self, page: int = 1, page_size: int = 20, status: Optional[str] = None):
        filters = [Order.user_id == self.user_id]
        if status:
            filters.append(Order.status == status)
        count_stmt = select(func.count()).select_from(Order).where(*filters)
        total = await self.db.scalar(count_stmt) or 0
        stmt = select(Order).where(*filters).order_by(Order.created_at.desc()).offset((page-1)*page_size).limit(page_size)
        result = await self.db.execute(stmt)
        return list(result.scalars().all()), total

    async def get_order(self, order_id: str) -> Order:
        order = await self.order_repo.get(UUID(order_id))
        if order is None or str(order.user_id) != self.user_id:
            raise ValueError("Order not found")
        return order

    async def cancel_order(self, order_id: str):
        order = await self.get_order(order_id)
        if order.status not in ("created", "submitted", "partially_filled"):
            raise ValueError(f"Cannot cancel order in '{order.status}' state")
        await self.order_repo.update(UUID(order_id), status="cancelled")

    async def list_positions(self) -> list[Position]:
        stmt = select(Position).where(Position.user_id == self.user_id, Position.is_open == True)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_funding_rates(self, exchange: str = "binance") -> list[dict]:
        # Placeholder - would call exchange adapter
        return []

    async def list_trade_logs(self, page: int = 1, page_size: int = 20,
                              symbol: Optional[str] = None, strategy_id: Optional[str] = None):
        # Returns filled/completed orders as trade log
        filters = [Order.user_id == self.user_id, Order.status == "filled"]
        if symbol:
            filters.append(Order.symbol == symbol)
        if strategy_id:
            filters.append(Order.strategy_id == strategy_id)
        count_stmt = select(func.count()).select_from(Order).where(*filters)
        total = await self.db.scalar(count_stmt) or 0
        stmt = select(Order).where(*filters).order_by(Order.created_at.desc()).offset((page-1)*page_size).limit(page_size)
        result = await self.db.execute(stmt)
        return list(result.scalars().all()), total
