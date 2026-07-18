"""
内存订单簿缓存
==============
低延迟订单簿访问 — 避免每次查询都走 exchange API。

设计:
- 每个交易对维护一个本地订单簿副本 (bids/asks)
- 通过 WebSocket 增量更新保持同步
- 支持 get_best_bid / get_best_ask / get_mid_price / get_vwap
- 支持模拟撮合 (模拟下单时的价格估算)
"""

import asyncio
import logging
import time
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger("quant.execution.orderbook")


@dataclass
class OrderBookLevel:
    """订单簿档位"""
    price: float
    amount: float


@dataclass
class OrderBook:
    """单交易对订单簿"""

    symbol: str
    exchange: str
    bids: list[OrderBookLevel] = field(default_factory=list)   # 买盘: 价格从高到低
    asks: list[OrderBookLevel] = field(default_factory=list)   # 卖盘: 价格从低到高
    timestamp: float = 0.0
    last_update: float = 0.0
    sequence: int = 0

    @property
    def best_bid(self) -> Optional[float]:
        return self.bids[0].price if self.bids else None

    @property
    def best_ask(self) -> Optional[float]:
        return self.asks[0].price if self.asks else None

    @property
    def mid_price(self) -> Optional[float]:
        if self.best_bid and self.best_ask:
            return (self.best_bid + self.best_ask) / 2
        return None

    @property
    def spread(self) -> Optional[float]:
        if self.best_bid and self.best_ask:
            return self.best_ask - self.best_bid
        return None

    @property
    def spread_pct(self) -> Optional[float]:
        if self.best_bid and self.best_ask and self.mid_price:
            return (self.spread / self.mid_price) * 100
        return None

    @property
    def age_ms(self) -> float:
        """距上次更新的毫秒数"""
        return (time.time() - self.last_update) * 1000

    def get_vwap(self, depth: float) -> Optional[float]:
        """
        计算加权平均价 (VWAP) 至指定深度。

        depth: 累计成交量 (base currency)
        返回: 加权平均价
        """
        cumulative = 0.0
        total_cost = 0.0

        # 从卖盘计算（买方向）
        for level in self.asks:
            take = min(level.amount, depth - cumulative)
            total_cost += take * level.price
            cumulative += take
            if cumulative >= depth:
                break

        if cumulative == 0:
            return None
        return total_cost / cumulative

    def estimate_slippage(self, side: str, amount: float) -> dict:
        """
        估算滑点。

        side: "buy" 或 "sell"
        amount: 交易量 (base currency)
        返回: {"avg_price", "slippage_pct", "levels_consumed"}
        """
        book_side = self.asks if side == "buy" else self.bids
        best = self.best_ask if side == "buy" else self.best_bid
        if not best:
            return {"avg_price": 0, "slippage_pct": 0, "levels_consumed": 0}

        cumulative = 0.0
        total_cost = 0.0
        levels = 0

        for level in book_side:
            take = min(level.amount, amount - cumulative)
            total_cost += take * level.price
            cumulative += take
            levels += 1
            if cumulative >= amount:
                break

        if cumulative == 0:
            return {"avg_price": best, "slippage_pct": 0, "levels_consumed": 0}

        avg_price = total_cost / cumulative
        slippage = abs(avg_price - best) / best * 100

        return {
            "avg_price": round(avg_price, 8),
            "slippage_pct": round(slippage, 4),
            "levels_consumed": levels,
        }


class OrderBookCache:
    """
    全局订单簿缓存（内存）。

    特性:
    - 支持 snapshot 全量更新 + delta 增量更新
    - 自动过期（超过 TTL 的订单簿标记为 stale）
    - 线程安全（asyncio Lock per symbol）
    """

    def __init__(self, max_age_seconds: float = 30.0):
        self._books: dict[str, OrderBook] = {}
        self._locks: dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)
        self.max_age_seconds = max_age_seconds

    def _key(self, exchange: str, symbol: str) -> str:
        return f"{exchange}:{symbol}"

    async def update_snapshot(
        self,
        exchange: str,
        symbol: str,
        bids: list[list[float]],
        asks: list[list[float]],
        timestamp: Optional[float] = None,
    ):
        """全量更新订单簿（初始化或重同步时使用）"""
        key = self._key(exchange, symbol)
        async with self._locks[key]:
            book = self._books.get(key)
            if book is None:
                book = OrderBook(symbol=symbol, exchange=exchange)
                self._books[key] = book

            book.bids = [OrderBookLevel(price=b[0], amount=b[1]) for b in bids]
            book.asks = [OrderBookLevel(price=a[0], amount=a[1]) for a in asks]
            book.timestamp = timestamp or time.time()
            book.last_update = time.time()
            book.sequence += 1

    async def update_delta(
        self,
        exchange: str,
        symbol: str,
        bids_updates: list[list[float]],
        asks_updates: list[list[float]],
        sequence: Optional[int] = None,
    ):
        """
        增量更新订单簿。

        bids_updates: [[price, amount], ...] — amount=0 表示删除该档位
        asks_updates: [[price, amount], ...]
        """
        key = self._key(exchange, symbol)
        async with self._locks[key]:
            book = self._books.get(key)
            if book is None:
                logger.warning(f"Delta update on non-existent orderbook: {key}")
                return

            if sequence is not None and sequence != book.sequence + 1:
                logger.warning(
                    f"Sequence mismatch for {key}: expected {book.sequence + 1}, got {sequence}"
                )

            # 更新买盘
            self._apply_delta(book.bids, bids_updates, is_bid=True)
            # 更新卖盘
            self._apply_delta(book.asks, asks_updates, is_bid=False)

            book.last_update = time.time()
            book.sequence = sequence or book.sequence + 1

    def _apply_delta(
        self,
        levels: list[OrderBookLevel],
        updates: list[list[float]],
        is_bid: bool,
    ):
        """应用增量更新到单个方向"""
        for update in updates:
            price, amount = float(update[0]), float(update[1])

            # 查找是否存在该价位
            found = False
            for i, level in enumerate(levels):
                if abs(level.price - price) < 1e-12:
                    if amount <= 0:
                        levels.pop(i)  # 删除该档位
                    else:
                        level.amount = amount  # 更新数量
                    found = True
                    break

            if not found and amount > 0:
                # 新增档位
                new_level = OrderBookLevel(price=price, amount=amount)
                levels.append(new_level)

        # 重新排序
        levels.sort(key=lambda x: x.price, reverse=is_bid)  # bids 从高到低，asks 从低到高

    async def get(self, exchange: str, symbol: str) -> Optional[OrderBook]:
        """获取订单簿"""
        key = self._key(exchange, symbol)
        book = self._books.get(key)
        if book is None:
            return None
        if book.age_ms / 1000 > self.max_age_seconds:
            logger.warning(f"OrderBook for {key} is stale ({book.age_ms:.0f}ms old)")
        return book

    async def get_best_bid_ask(self, exchange: str, symbol: str) -> tuple:
        """快速获取最优买卖价"""
        book = await self.get(exchange, symbol)
        if book is None:
            return None, None
        return book.best_bid, book.best_ask

    async def get_mid_price(self, exchange: str, symbol: str) -> Optional[float]:
        """快速获取中间价"""
        book = await self.get(exchange, symbol)
        if book is None:
            return None
        return book.mid_price

    async def simulate_fill(
        self,
        exchange: str,
        symbol: str,
        side: str,
        amount: float,
    ) -> Optional[dict]:
        """
        模拟成交（用于估算市价单的成交价格）。

        返回: {"avg_price", "slippage_pct", "levels_consumed"}
        """
        book = await self.get(exchange, symbol)
        if book is None:
            return None
        return book.estimate_slippage(side, amount)

    def get_all_symbols(self) -> list[str]:
        """获取所有已缓存的交易对"""
        return list(self._books.keys())

    def remove(self, exchange: str, symbol: str):
        """移除订单簿"""
        key = self._key(exchange, symbol)
        self._books.pop(key, None)

    def clear(self):
        """清空所有缓存"""
        self._books.clear()

    @property
    def size(self) -> int:
        return len(self._books)


# ================================================================
# 全局单例
# ================================================================
orderbook_cache = OrderBookCache(max_age_seconds=30.0)
