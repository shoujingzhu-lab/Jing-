"""
订单幂等性模块
==============
确保同一订单不会因网络超时/重试而被重复提交到交易所。

策略:
1. client_order_id (客户端生成唯一 ID) + DB UNIQUE 约束 → 数据库层面防重
2. Redis 幂等键 (TTL 24h) → 缓存层面快速检查
3. 交易所返回的 exchange_order_id → 用于关联已有订单
"""

import hashlib
import logging
from datetime import datetime, UTC
from typing import Optional

from app.models.trading import Order

logger = logging.getLogger("quant.execution.idempotency")


class IdempotencyManager:
    """
    订单幂等性管理器。

    使用方式:
        mgr = IdempotencyManager(db, redis)
        existing = await mgr.check(order_dict)
        if existing:
            return existing  # 已存在，避免重复
        order = await mgr.register(new_order)
    """

    def __init__(self, db_session=None, redis_client=None):
        self._db = db_session
        self._redis = redis_client

    @staticmethod
    def generate_client_order_id(
        user_id: str,
        strategy_id: str,
        symbol: str,
        side: str,
        timestamp: Optional[datetime] = None,
    ) -> str:
        """
        生成幂等客户端订单 ID。

        格式: {prefix}-{hash_slice}
        prefix = 当前日期 + 用户ID前8位
        hash  = SHA256(user_id | strategy_id | symbol | side | timestamp)
        """
        ts = timestamp or datetime.now(UTC)
        prefix = f"{ts.strftime('%Y%m%d')}-{user_id[:8]}"

        raw = f"{user_id}|{strategy_id}|{symbol}|{side}|{ts.isoformat()}"
        hash_hex = hashlib.sha256(raw.encode()).hexdigest()[:12]

        return f"{prefix}-{hash_hex}"

    async def check(self, client_order_id: str) -> Optional[Order]:
        """
        检查是否已有相同 client_order_id 的订单。

        先查 Redis 缓存（快速），再查 DB（权威）。
        """
        # 1. Redis 缓存检查
        if self._redis:
            try:
                exists = await self._redis.exists(f"order:idem:{client_order_id}")
                if exists:
                    cached_order_id = await self._redis.get(f"order:idem:{client_order_id}")
                    if cached_order_id:
                        logger.debug(f"Idempotency HIT (redis): {client_order_id}")
                        return await self._load_order(cached_order_id.decode())
            except Exception:
                pass  # Redis 不可用时不影响功能

        # 2. DB 检查
        if self._db:
            from sqlalchemy import select

            stmt = select(Order).where(Order.client_order_id == client_order_id)
            result = await self._db.execute(stmt)
            order = result.scalar_one_or_none()
            if order:
                # 回填 Redis 缓存
                await self._cache_order(client_order_id, str(order.id))
                logger.info(f"Idempotency HIT (db): {client_order_id} → order={order.id}")
                return order

        return None

    async def register(self, order: Order):
        """
        注册新订单到幂等性缓存。

        调用时机: 订单成功写入 DB 后。
        """
        if not order.client_order_id:
            return

        await self._cache_order(order.client_order_id, str(order.id))

    async def _cache_order(self, client_order_id: str, order_id: str):
        """写入 Redis 缓存"""
        if self._redis:
            try:
                key = f"order:idem:{client_order_id}"
                await self._redis.setex(key, 86400, order_id)  # 24h TTL
            except Exception as e:
                logger.warning(f"Failed to cache idempotency key: {e}")

    async def _load_order(self, order_id: str) -> Optional[Order]:
        """从 DB 加载订单"""
        if not self._db:
            return None
        from sqlalchemy import select

        stmt = select(Order).where(Order.id == order_id)
        result = await self._db.execute(stmt)
        return result.scalar_one_or_none()


# 全局单例（延迟初始化，在应用启动时注入 DB/Redis）
idempotency_manager = IdempotencyManager()
