"""
订单执行器
==========
解密 API Key → 创建交易所适配器 → 幂等检查 → 提交订单 → 更新订单状态。

P0-002 优化:
- 幂等性保护: 基于 client_order_id 防重
- 订单簿缓存: 市价单预估成交价
- 重试策略: 指数退避 (exponential backoff)
- 连接复用: 适配器实例缓存
"""

import asyncio
import logging
import uuid
from datetime import datetime, UTC
from decimal import Decimal
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters import adapter_cache, create_adapter
from app.core.security import decrypt_api_secret
from app.execution.idempotency import IdempotencyManager
from app.execution.orderbook_cache import orderbook_cache
from app.models.trading import ApiKey, Order

logger = logging.getLogger("quant.execution.executor")

# 重试配置
MAX_RETRIES = 3
BASE_DELAY_SECONDS = 0.5
MAX_DELAY_SECONDS = 5.0


class OrderExecutor:
    """
    订单执行器 — 将 DB 订单提交到真实交易所。

    增强功能 (P0-002):
    - client_order_id 幂等性
    - 市价单滑点预估算
    - 指数退避重试
    """

    def __init__(self, db: AsyncSession, redis_client=None):
        self.db = db
        self.redis = redis_client
        self.idempotency = IdempotencyManager(db, redis_client)

    async def submit_order(
        self,
        order_id: str,
        client_order_id: Optional[str] = None,
    ) -> Order:
        """
        提交订单到交易所。

        流程:
        1. 加载订单（验证状态为 created）
        2. 幂等检查（client_order_id）
        3. 加载 API Key 并解密
        4. 市价单预估滑点（使用内存订单簿）
        5. 创建交易所适配器
        6. 提交订单（带重试）
        7. 更新订单状态和交易所返回的 order_id
        """
        # 1. 加载订单
        order = await self._get_order(order_id)
        if order is None:
            raise OrderExecutionError("订单不存在", order_id)
        if order.status != "created":
            raise OrderExecutionError(f"订单状态 '{order.status}' 不允许提交", order_id)

        # 2. 幂等检查
        cid = client_order_id or order.client_order_id
        if cid:
            existing = await self.idempotency.check(str(cid))
            if existing and str(existing.id) != order_id:
                logger.warning(
                    f"Duplicate order detected: client_order_id={cid}, "
                    f"existing={existing.id}, current={order_id}"
                )
                # 返回已有订单（不重复提交）
                return existing

        # 3. 加载并解密 API Key
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

        # 4. 市价单滑点预估（仅供参考，不影响执行）
        if order.order_type == "market" and order.amount:
            slippage_info = await orderbook_cache.simulate_fill(
                exchange=api_key.exchange,
                symbol=order.symbol,
                side=order.side,
                amount=float(order.amount),
            )
            if slippage_info:
                logger.info(
                    f"Estimated slippage for {order.symbol} {order.side} "
                    f"amount={order.amount}: {slippage_info['slippage_pct']}% "
                    f"avg_price={slippage_info['avg_price']}"
                )

        # 5. 获取适配器（使用连接缓存，避免重复创建 ccxt 实例）
        adapter = await adapter_cache.get(
            exchange=api_key.exchange,
            api_key=api_key.access_key,
            secret=secret,
            passphrase=passphrase,
        )

        # 6. 提交到交易所（带重试）
        exchange_order = await self._submit_with_retry(
            adapter=adapter,
            symbol=order.symbol,
            side=order.side,
            order_type=order.order_type,
            amount=float(order.amount),
            price=float(order.price) if order.price else None,
            client_order_id=cid,
        )

        # 7. 更新订单
        exchange_order_id = exchange_order.get("id", "")
        order.exchange_order_id = str(exchange_order_id)
        order.status = "submitted"
        if cid and not order.client_order_id:
            order.client_order_id = cid
        await self.db.flush()

        # 注册幂等缓存
        if order.client_order_id:
            await self.idempotency.register(order)

        logger.info(
            f"Order submitted: {order.symbol} {order.side} {order.order_type} "
            f"amount={order.amount} → exchange_id={exchange_order_id}"
        )

        # 推送 WebSocket 事件
        try:
            from app.ws.event_emitter import emit_order_update
            await emit_order_update(
                str(order.user_id),
                {
                    "id": str(order.id),
                    "exchange": order.exchange,
                    "symbol": order.symbol,
                    "side": order.side,
                    "order_type": order.order_type,
                    "amount": float(order.amount),
                    "price": float(order.price) if order.price else None,
                    "status": order.status,
                    "exchange_order_id": exchange_order_id,
                    "client_order_id": order.client_order_id,
                },
            )
        except Exception:
            pass  # WebSocket 事件失败不影响核心交易

        return order

    async def _submit_with_retry(
        self,
        adapter,
        symbol: str,
        side: str,
        order_type: str,
        amount: float,
        price: Optional[float] = None,
        client_order_id: Optional[str] = None,
        max_retries: int = MAX_RETRIES,
    ) -> dict:
        """
        带指数退避重试的订单提交。

        重试策略:
        - 网络错误: 重试
        - 交易所速率限制: 等待后重试
        - 订单已存在 (duplicate): 返回已有订单信息
        """
        last_error = None

        for attempt in range(max_retries + 1):
            try:
                return await adapter.create_order(
                    symbol=symbol,
                    side=side,
                    order_type=order_type,
                    amount=amount,
                    price=price,
                    params={"clientOrderId": client_order_id} if client_order_id else None,
                )
            except Exception as e:
                last_error = e
                error_msg = str(e).lower()

                # 判断是否可重试
                is_retryable = any(
                    kw in error_msg
                    for kw in ("timeout", "connection", "rate limit", "too many requests", "503", "502")
                )

                # 订单已存在的特殊处理
                if "duplicate" in error_msg or "already exists" in error_msg:
                    logger.warning(f"Order already exists on exchange (client_order_id={client_order_id})")
                    # 查询已有订单（从交易所侧）
                    try:
                        open_orders = await adapter.fetch_open_orders(symbol=symbol)
                        for o in open_orders:
                            if o.get("clientOrderId") == client_order_id:
                                return o
                    except Exception:
                        pass
                    raise OrderExecutionError(f"订单可能已存在于交易所: {e}", "")

                if attempt < max_retries and is_retryable:
                    delay = min(BASE_DELAY_SECONDS * (2 ** attempt), MAX_DELAY_SECONDS)
                    logger.warning(
                        f"Order submit retry {attempt + 1}/{max_retries} "
                        f"after {delay:.1f}s (error: {e})"
                    )
                    await asyncio.sleep(delay)
                else:
                    break

        # 所有重试均失败
        raise OrderExecutionError(
            f"交易所提交失败 (retried {max_retries}x): {last_error}", ""
        )

    async def submit_pending_orders(self, user_id: str = None) -> dict:
        """
        批量提交所有 'created' 状态的订单。

        返回: {"succeeded": N, "failed": N, "total": N}
        """
        filters = [Order.status == "created"]
        if user_id:
            filters.append(Order.user_id == user_id)

        stmt = select(Order).where(*filters).order_by(Order.created_at)
        result = await self.db.execute(stmt)
        orders = list(result.scalars().all())

        succeeded = 0
        failed = 0
        for order in orders:
            try:
                await self.submit_order(str(order.id))
                succeeded += 1
            except OrderExecutionError as e:
                logger.error(f"Failed to submit order {order.id}: {e}")
                failed += 1

        return {"succeeded": succeeded, "failed": failed, "total": len(orders)}

    # ---- 内部 ----

    async def _get_order(self, order_id: str) -> Optional[Order]:
        stmt = select(Order).where(Order.id == order_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def _get_api_key(self, key_id: str) -> Optional[ApiKey]:
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
