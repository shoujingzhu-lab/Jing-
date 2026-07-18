"""
Redis 行情缓存层
================
多进程共享的行情数据缓存，基于 Redis。

特性:
- Ticker/Orderbook/Klines/FundingRate 统一存取
- 带 TTL 自动过期
- JSON 序列化，可被任何进程读取
- 服务重启不丢数据（Redis 持久化）
- 零代码侵入 — market_data_service 无缝切换

Key 格式:
    quant:ticker:{exchange}:{symbol}
    quant:ob:{exchange}:{symbol}:{depth}
    quant:kline:{exchange}:{symbol}:{interval}:{limit}
    quant:fr:{exchange}:{symbol}
"""

import json
import logging
from typing import Optional

import redis.asyncio as aioredis

from app.core.config import settings

logger = logging.getLogger("quant.redis_cache")


class RedisMarketCache:
    """Redis 行情缓存服务"""

    def __init__(self, redis_url: Optional[str] = None, default_ttl: int = 60):
        self._redis: Optional[aioredis.Redis] = None
        self._redis_url = redis_url or settings.REDIS_URL
        self._default_ttl = default_ttl  # 60s，匹配 TICKER_TTL

    async def _get_client(self) -> aioredis.Redis:
        """获取或创建 Redis 连接（懒加载 + 连接复用）"""
        if self._redis is None:
            self._redis = aioredis.from_url(
                self._redis_url,
                decode_responses=True,
                socket_keepalive=True,
                health_check_interval=30,
            )
            await self._redis.ping()
            logger.info(f"Redis cache connected: {self._redis_url}")
        return self._redis

    # ---- Key 生成 ----

    @staticmethod
    def _ticker_key(exchange: str, symbol: str) -> str:
        return f"quant:ticker:{exchange}:{symbol}"

    @staticmethod
    def _ob_key(exchange: str, symbol: str, depth: int) -> str:
        return f"quant:ob:{exchange}:{symbol}:{depth}"

    @staticmethod
    def _kline_key(exchange: str, symbol: str, interval: str, limit: int) -> str:
        return f"quant:kline:{exchange}:{symbol}:{interval}:{limit}"

    @staticmethod
    def _fr_key(exchange: str, symbol: str) -> str:
        return f"quant:fr:{exchange}:{symbol}"

    # ---- Ticker ----

    async def get_ticker(self, exchange: str, symbol: str) -> Optional[dict]:
        """从 Redis 读取 Ticker"""
        try:
            r = await self._get_client()
            data = await r.get(self._ticker_key(exchange, symbol))
            return json.loads(data) if data else None
        except Exception as e:
            logger.error(f"Redis get_ticker failed: {e}")
            return None

    async def set_ticker(self, exchange: str, symbol: str, data: dict, ttl: int = 30):
        """写入 Ticker 到 Redis"""
        try:
            r = await self._get_client()
            await r.setex(
                self._ticker_key(exchange, symbol),
                ttl,
                json.dumps(data, ensure_ascii=False),
            )
        except Exception as e:
            logger.error(f"Redis set_ticker failed: {e}")

    # ---- Orderbook ----

    async def get_orderbook(self, exchange: str, symbol: str, depth: int) -> Optional[dict]:
        try:
            r = await self._get_client()
            data = await r.get(self._ob_key(exchange, symbol, depth))
            return json.loads(data) if data else None
        except Exception as e:
            logger.error(f"Redis get_orderbook failed: {e}")
            return None

    async def set_orderbook(self, exchange: str, symbol: str, depth: int, data: dict, ttl: int = 30):
        try:
            r = await self._get_client()
            await r.setex(
                self._ob_key(exchange, symbol, depth),
                ttl,
                json.dumps(data, ensure_ascii=False),
            )
        except Exception as e:
            logger.error(f"Redis set_orderbook failed: {e}")

    # ---- Klines ----

    async def get_klines(self, exchange: str, symbol: str, interval: str, limit: int) -> Optional[list]:
        try:
            r = await self._get_client()
            data = await r.get(self._kline_key(exchange, symbol, interval, limit))
            return json.loads(data) if data else None
        except Exception as e:
            logger.error(f"Redis get_klines failed: {e}")
            return None

    async def set_klines(self, exchange: str, symbol: str, interval: str, limit: int, data: list, ttl: int = 120):
        try:
            r = await self._get_client()
            await r.setex(
                self._kline_key(exchange, symbol, interval, limit),
                ttl,
                json.dumps(data, ensure_ascii=False),
            )
        except Exception as e:
            logger.error(f"Redis set_klines failed: {e}")

    # ---- Funding Rate ----

    async def get_funding_rate(self, exchange: str, symbol: str) -> Optional[dict]:
        try:
            r = await self._get_client()
            data = await r.get(self._fr_key(exchange, symbol))
            return json.loads(data) if data else None
        except Exception as e:
            logger.error(f"Redis get_funding_rate failed: {e}")
            return None

    async def set_funding_rate(self, exchange: str, symbol: str, data: dict, ttl: int = 300):
        try:
            r = await self._get_client()
            await r.setex(
                self._fr_key(exchange, symbol),
                ttl,
                json.dumps(data, ensure_ascii=False),
            )
        except Exception as e:
            logger.error(f"Redis set_funding_rate failed: {e}")

    # ---- 批量操作 ----

    async def get_multi_tickers(self, exchange: str, symbols: list[str]) -> dict[str, Optional[dict]]:
        """批量读取多个交易对的 Ticker（一次 Pipeline）"""
        try:
            r = await self._get_client()
            keys = [self._ticker_key(exchange, s) for s in symbols]
            results = await r.mget(keys)
            return {
                sym: json.loads(data) if data else None
                for sym, data in zip(symbols, results)
            }
        except Exception as e:
            logger.error(f"Redis get_multi_tickers failed: {e}")
            return {s: None for s in symbols}

    async def close(self):
        """关闭 Redis 连接"""
        if self._redis:
            await self._redis.close()
            self._redis = None
            logger.info("Redis cache connection closed")

    @property
    async def is_healthy(self) -> bool:
        """健康检查"""
        try:
            r = await self._get_client()
            return await r.ping()
        except Exception:
            return False


# ============================================================
# 全局单例
# ============================================================
redis_cache = RedisMarketCache()
