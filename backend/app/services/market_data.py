"""
行情数据服务
============
模块一业务逻辑：多交易所行情获取、聚合、历史数据管理。

缓存层级（优先级从高到低）:
1. Redis 缓存 — 多进程共享，重启不丢，30-120s TTL
2. 本地 TTL 缓存 — 进程内极速，asyncio Lock 保护，30-120s TTL
3. CCXT 实时 — 穿透境外交易所，~500ms

数据流:
Broadcaster(1s) → market_data_service.get_ticker() → CCXT → Redis + 本地缓存
REST API       → market_data_service.get_ticker() → Redis → 本地缓存 → CCXT
"""

import asyncio
import json
import time
import logging
from datetime import datetime, timedelta
from typing import Optional

from app.adapters.exchanges import create_adapter
from app.adapters.base import BaseExchangeAdapter
from app.services.redis_cache import redis_cache as _redis

logger = logging.getLogger("quant.market_data")


class _TTLCache:
    """简易异步安全 TTL 缓存（asyncio Lock 保护）"""

    def __init__(self):
        self._store: dict[str, tuple[float, any]] = {}
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> Optional[any]:
        """读取缓存，过期返回 None"""
        async with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            expires_at, value = entry
            if time.monotonic() > expires_at:
                del self._store[key]
                return None
            return value

    async def set(self, key: str, value: any, ttl: float):
        """写入缓存"""
        async with self._lock:
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
    # ticker/orderbook: 60s — 广播器每 1s 刷新，重启后 Redis 存活
    # klines: 300s — 广播器每 60s 刷新，长 TTL 保证重启命中
    # funding_rate: 600s — 费率每 8h 才变
    TTL_TICKER = 60.0
    TTL_ORDERBOOK = 60.0
    TTL_KLINES = 300.0
    TTL_FUNDING_RATE = 600.0

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
        """DATA-002: 获取实时 Ticker。

        缓存优先级: Redis → 本地 TTL → CCXT 实时
        """
        # 1. Redis 缓存（跨进程共享）
        cached = await _redis.get_ticker(exchange, symbol)
        if cached is not None:
            # 同步到本地缓存（加速后续同进程内的访问）
            await self._cache.set(self._key("ticker", exchange, symbol), cached, self.TTL_TICKER)
            return cached

        # 2. 本地 TTL 缓存（进程内极速）
        cache_key = self._key("ticker", exchange, symbol)
        local = await self._cache.get(cache_key)
        if local is not None:
            return local

        # 3. CCXT 实时（穿透交易所）
        adapter = self._get_adapter(exchange)
        ticker = await adapter.fetch_ticker(symbol)

        # 写入两层缓存
        await self._cache.set(cache_key, ticker, self.TTL_TICKER)
        await _redis.set_ticker(exchange, symbol, ticker, int(self.TTL_TICKER))
        return ticker

    async def get_orderbook(self, exchange: str, symbol: str, depth: int = 20) -> dict:
        """DATA-002: 获取订单簿。

        缓存优先级: Redis → 本地 TTL → CCXT 实时
        """
        # 1. Redis
        cached = await _redis.get_orderbook(exchange, symbol, depth)
        if cached is not None:
            await self._cache.set(self._key("ob", exchange, symbol, str(depth)), cached, self.TTL_ORDERBOOK)
            return cached

        # 2. 本地 TTL
        cache_key = self._key("ob", exchange, symbol, str(depth))
        local = await self._cache.get(cache_key)
        if local is not None:
            return local

        # 3. CCXT
        adapter = self._get_adapter(exchange)
        ob = await adapter.fetch_orderbook(symbol, depth)
        await self._cache.set(cache_key, ob, self.TTL_ORDERBOOK)
        await _redis.set_orderbook(exchange, symbol, depth, ob, int(self.TTL_ORDERBOOK))
        return ob

    async def get_klines(
        self, exchange: str, symbol: str, interval: str = "1h",
        limit: int = 500, since: Optional[int] = None,
    ) -> list[dict]:
        """获取 K 线数据。

        缓存优先级: Redis → 本地 TTL → CCXT 实时
        """
        # 1. Redis
        cached = await _redis.get_klines(exchange, symbol, interval, limit)
        if cached is not None:
            await self._cache.set(self._key("kline", exchange, symbol, interval, str(limit)), cached, self.TTL_KLINES)
            return cached

        # 2. 本地 TTL
        cache_key = self._key("kline", exchange, symbol, interval, str(limit))
        local = await self._cache.get(cache_key)
        if local is not None:
            return local

        # 3. CCXT
        adapter = self._get_adapter(exchange)
        klines = await adapter.fetch_klines(symbol, interval, limit, since)
        await self._cache.set(cache_key, klines, self.TTL_KLINES)
        await _redis.set_klines(exchange, symbol, interval, limit, klines, int(self.TTL_KLINES))
        return klines

    async def get_funding_rate(self, exchange: str, symbol: str) -> dict:
        """DATA-009: 获取资金费率。

        缓存优先级: Redis → 本地 TTL → CCXT 实时
        """
        # 1. Redis
        cached = await _redis.get_funding_rate(exchange, symbol)
        if cached is not None:
            await self._cache.set(self._key("fr", exchange, symbol), cached, self.TTL_FUNDING_RATE)
            return cached

        # 2. 本地 TTL
        cache_key = self._key("fr", exchange, symbol)
        local = await self._cache.get(cache_key)
        if local is not None:
            return local

        # 3. CCXT
        adapter = self._get_adapter(exchange)
        fr = await adapter.fetch_funding_rate(symbol)
        await self._cache.set(cache_key, fr, self.TTL_FUNDING_RATE)
        await _redis.set_funding_rate(exchange, symbol, fr, int(self.TTL_FUNDING_RATE))
        return fr

    # ---- 聚合（复用 ticker 缓存） ----

    async def get_aggregated_ticker(self, symbol: str) -> dict:
        """DATA-003: 多交易所行情聚合。

        同时获取多个交易所的报价，找出最优买卖价和跨所价差。
        聚合结果不单独缓存 — 各交易所 ticker 已有独立 TTL 缓存。

        超时策略: 总等待时间不超过 3s，防止慢交易所阻塞整体响应。
        """
        # 按交易所名创建 task 映射
        task_map = {}
        for exchange in self.SUPPORTED_EXCHANGES:
            task_map[exchange] = asyncio.ensure_future(
                self._safe_fetch(exchange, symbol)
            )

        # asyncio.wait: 有结果就收，不等慢的
        done, pending = await asyncio.wait(
            task_map.values(),
            timeout=3.0,
        )
        for p in pending:
            p.cancel()

        # 按交易所名收集结果
        tickers = {}
        for exchange, task in task_map.items():
            if task in done and not task.cancelled() and task.exception() is None:
                result = task.result()
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
        """缓存优先获取行情（不阻塞，单交易所失败不影响整体）。

        - 缓存命中 → 即时返回
        - 缓存未命中且交易所是 OKX → 实时拉取（3s 超时）
        - 缓存未命中且交易所是 Gate.io → 直接返回 None（不阻塞，等 WS 后台刷新）
        """
        cache_key = self._key("ticker", exchange, symbol)
        cached = await self._cache.get(cache_key)
        if cached is not None:
            return cached

        # Gate.io 走代理极慢（20-30s），不在 REST 请求中实时拉取
        # WebSocket 广播器在后台 1s 轮询，会自动填充缓存
        if exchange == "gateio":
            return None

        # OKX 可以实时拉取（~0.6s）
        try:
            return await asyncio.wait_for(
                self.get_ticker(exchange, symbol),
                timeout=3.0,
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
