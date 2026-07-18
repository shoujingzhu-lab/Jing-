"""
行情数据服务
============
模块一业务逻辑：多交易所行情获取、聚合、历史数据管理。

缓存策略:
- Ticker: 2s TTL（WebSocket 每 1s 刷新，REST API 命中缓存 <1ms）
- Orderbook: 2s TTL
- Klines: 60s TTL（WebSocket 每 60s 刷新）
- Funding Rate: 30s TTL（费率每 8h 才变一次）
- Aggregated: 无独立缓存（复用 ticker 缓存）
"""

import asyncio
import json
import time
import logging
from datetime import datetime, timedelta
from typing import Optional

from app.adapters.exchanges import create_adapter
from app.adapters.base import BaseExchangeAdapter

logger = logging.getLogger("quant.market_data")


class _TTLCache:
    """简易异步安全 TTL 缓存"""

    def __init__(self):
        self._store: dict[str, tuple[float, any]] = {}

    def get(self, key: str) -> Optional[any]:
        """读取缓存，过期返回 None"""
        entry = self._store.get(key)
        if entry is None:
            return None
        expires_at, value = entry
        if time.monotonic() > expires_at:
            del self._store[key]
            return None
        return value

    def set(self, key: str, value: any, ttl: float):
        """写入缓存"""
        self._store[key] = (time.monotonic() + ttl, value)

    def stats(self) -> dict:
        """缓存统计"""
        now = time.monotonic()
        active = sum(1 for exp, _ in self._store.values() if now <= exp)
        return {"total_entries": len(self._store), "active_entries": active}


class MarketDataService:
    """行情数据服务 — 封装多交易所行情获取与聚合（带 TTL 缓存）"""

    # 支持的交易所（仅已验证可用的）
    SUPPORTED_EXCHANGES = ["okx", "gateio"]
    # 完整列表: ["binance", "okx", "bybit", "gateio"]
    # Binance/Bybit 当前被地理封锁，排除以避免超时

    # TTL 配置（秒）
    # ticker/orderbook: 5s — 足够覆盖聚合请求耗时，避免缓存穿透
    # klines: 60s — WebSocket 每 60s 刷新
    # funding_rate: 300s — 费率每 8h 才变
    TTL_TICKER = 5.0
    TTL_ORDERBOOK = 5.0
    TTL_KLINES = 60.0
    TTL_FUNDING_RATE = 300.0

    def __init__(self):
        self._adapters: dict[str, BaseExchangeAdapter] = {}
        self._cache = _TTLCache()

    # ---- 缓存 key 生成 ----

    @staticmethod
    def _key(*parts: str) -> str:
        return ":".join(parts)

    # ---- 适配器管理 ----

    def _get_adapter(self, exchange: str) -> BaseExchangeAdapter:
        """获取或创建交易所适配器（只读，无需 API Key）"""
        if exchange not in self._adapters:
            self._adapters[exchange] = create_adapter(exchange)
        return self._adapters[exchange]

    # ---- 行情接口（带缓存） ----

    async def get_ticker(self, exchange: str, symbol: str) -> dict:
        """DATA-002: 获取实时 Ticker（TTL 缓存）"""
        cache_key = self._key("ticker", exchange, symbol)
        cached = self._cache.get(cache_key)
        if cached is not None:
            return cached

        adapter = self._get_adapter(exchange)
        ticker = await adapter.fetch_ticker(symbol)
        self._cache.set(cache_key, ticker, self.TTL_TICKER)
        return ticker

    async def get_orderbook(self, exchange: str, symbol: str, depth: int = 20) -> dict:
        """DATA-002: 获取订单簿（TTL 缓存，按 depth 分别缓存）"""
        cache_key = self._key("ob", exchange, symbol, str(depth))
        cached = self._cache.get(cache_key)
        if cached is not None:
            return cached

        adapter = self._get_adapter(exchange)
        ob = await adapter.fetch_orderbook(symbol, depth)
        self._cache.set(cache_key, ob, self.TTL_ORDERBOOK)
        return ob

    async def get_klines(
        self, exchange: str, symbol: str, interval: str = "1h",
        limit: int = 500, since: Optional[int] = None,
    ) -> list[dict]:
        """获取 K 线数据（TTL 缓存，按 interval+limit 分别缓存）"""
        cache_key = self._key("kline", exchange, symbol, interval, str(limit))
        cached = self._cache.get(cache_key)
        if cached is not None:
            return cached

        adapter = self._get_adapter(exchange)
        klines = await adapter.fetch_klines(symbol, interval, limit, since)
        self._cache.set(cache_key, klines, self.TTL_KLINES)
        return klines

    async def get_funding_rate(self, exchange: str, symbol: str) -> dict:
        """DATA-009: 获取资金费率（TTL 缓存）"""
        cache_key = self._key("fr", exchange, symbol)
        cached = self._cache.get(cache_key)
        if cached is not None:
            return cached

        adapter = self._get_adapter(exchange)
        fr = await adapter.fetch_funding_rate(symbol)
        self._cache.set(cache_key, fr, self.TTL_FUNDING_RATE)
        return fr

    # ---- 聚合（复用 ticker 缓存） ----

    async def get_aggregated_ticker(self, symbol: str) -> dict:
        """DATA-003: 多交易所行情聚合。

        同时获取多个交易所的报价，找出最优买卖价和跨所价差。
        聚合结果不单独缓存 — 各交易所 ticker 已有独立 TTL 缓存。
        """
        tasks = []
        for exchange in self.SUPPORTED_EXCHANGES:
            tasks.append(self._safe_fetch(exchange, symbol))

        results = await asyncio.gather(*tasks)

        tickers = {}
        for exchange, result in zip(self.SUPPORTED_EXCHANGES, results):
            if result is not None:
                tickers[exchange] = result

        if not tickers:
            return {"symbol": symbol, "exchanges": {}, "error": "所有交易所均获取失败"}

        # 最优价
        best_bid_ex = max(tickers.items(), key=lambda x: x[1].get("bid", 0))
        best_ask_ex = min(tickers.items(), key=lambda x: x[1].get("ask", float("inf")))

        # 价差
        prices = [(ex, t["last"]) for ex, t in tickers.items() if t.get("last")]
        max_price = max(prices, key=lambda x: x[1]) if prices else (None, 0)
        min_price = min(prices, key=lambda x: x[1]) if prices else (None, 0)

        spread_pct = 0
        if min_price[1] and max_price[1] and min_price[1] > 0:
            spread_pct = (max_price[1] - min_price[1]) / min_price[1] * 100

        return {
            "symbol": symbol,
            "exchanges": tickers,
            "best_bid": {"exchange": best_bid_ex[0], "price": best_bid_ex[1].get("bid")},
            "best_ask": {"exchange": best_ask_ex[0], "price": best_ask_ex[1].get("ask")},
            "spread_pct": round(spread_pct, 4),
            "highest_price": {"exchange": max_price[0], "price": max_price[1]},
            "lowest_price": {"exchange": min_price[0], "price": min_price[1]},
        }

    @property
    def cache_stats(self) -> dict:
        """返回缓存统计信息"""
        return self._cache.stats()

    async def warmup(self, symbols: Optional[list[str]] = None):
        """
        预热缓存 — 在启动时预加载常用交易对的行情数据。

        用于减少前端首次请求的冷启动延迟。
        """
        if symbols is None:
            symbols = ["BTC/USDT", "ETH/USDT"]

        logger.info(f"Warming up cache for {len(symbols)} symbols across {len(self.SUPPORTED_EXCHANGES)} exchanges...")
        tasks = []
        for symbol in symbols:
            for exchange in self.SUPPORTED_EXCHANGES:
                tasks.append(self._warmup_one(exchange, symbol))

        results = await asyncio.gather(*tasks, return_exceptions=True)
        success = sum(1 for r in results if r is True)
        logger.info(f"Cache warmup complete: {success}/{len(tasks)} successful")

    # ---- 历史数据（不缓存 — 每次请求不同时间范围） ----

    async def download_history(
        self, exchange: str, symbol: str, interval: str,
        start_date: datetime, end_date: datetime,
    ) -> list[dict]:
        """DATA-004: 下载历史数据（支持大时间范围自动分批，不缓存）"""
        adapter = self._get_adapter(exchange)
        all_bars = []

        # 将时间范围转为毫秒时间戳
        since_ms = int(start_date.timestamp() * 1000)
        end_ms = int(end_date.timestamp() * 1000)

        while since_ms < end_ms:
            batch = await adapter.fetch_klines(
                symbol, interval, limit=1000, since=since_ms,
            )
            if not batch:
                break

            all_bars.extend(batch)
            # 下一批从最后一根 K 线之后开始
            since_ms = batch[-1]["open_time"] + 1

            # 避免请求过快
            await asyncio.sleep(0.05)

        return all_bars

    async def _safe_fetch(self, exchange: str, symbol: str) -> Optional[dict]:
        """安全获取行情（单交易所失败不影响整体，5s 超时保护）"""
        try:
            return await asyncio.wait_for(
                self.get_ticker(exchange, symbol),
                timeout=5.0,
            )
        except (asyncio.TimeoutError, Exception):
            return None

    async def _warmup_one(self, exchange: str, symbol: str) -> bool:
        """预热单个交易对/交易所组合"""
        try:
            await asyncio.wait_for(
                self.get_ticker(exchange, symbol),
                timeout=10.0,
            )
            return True
        except Exception as e:
            logger.debug(f"Warmup failed {exchange}/{symbol}: {e}")
            return False


# ============================================================
# 全局单例
# ============================================================
market_data_service = MarketDataService()
