"""
交易执行模块
============
P0-002 优化: 异步 CCXT + 低延迟订单簿 + 幂等性 + 重试策略。

模块组成:
- OrderExecutor: 订单提交到交易所（幂等 + 重试 + 滑点估算）
- TradingPipeline: 策略信号 → 风控 → 下单 完整管道
- OrderTracker: 后台订单状态同步
- IdempotencyManager: 订单幂等性保护 (client_order_id)
- OrderBookCache: 内存订单簿缓存（低延迟访问）
"""

from app.execution.executor import OrderExecutionError, OrderExecutor
from app.execution.idempotency import IdempotencyManager, idempotency_manager
from app.execution.orderbook_cache import OrderBookCache, orderbook_cache
from app.execution.pipeline import TradingPipeline
from app.execution.tracker import OrderTracker

__all__ = [
    "OrderExecutor",
    "OrderExecutionError",
    "TradingPipeline",
    "OrderTracker",
    "IdempotencyManager",
    "idempotency_manager",
    "OrderBookCache",
    "orderbook_cache",
]
