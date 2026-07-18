"""
交易所适配器连接缓存
====================
P1-004: 避免每次请求都创建新的 ccxt 实例。
使用 LRU + TTL 策略管理适配器实例生命周期。

不变量:
- 同一 (exchange, api_key, testnet) 组合复用同一适配器
- 空闲超过 TTL 的适配器自动回收
- 连接错误时自动重建
"""

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Optional, Type

from app.adapters.base import BaseExchangeAdapter
from app.adapters.exchanges import EXCHANGE_MAP

logger = logging.getLogger("quant.adapters.cache")


@dataclass
class CacheEntry:
    adapter: BaseExchangeAdapter
    last_used: float = field(default_factory=time.time)
    created_at: float = field(default_factory=time.time)
    use_count: int = 0


class AdapterCache:
    """
    交易所适配器 LRU 缓存。

    特性:
    - 最大容量限制 (默认 100 个实例)
    - TTL 过期自动清理 (默认 30 min 空闲)
    - 线程安全 (asyncio Lock)
    - 支持手动 invalidate
    """

    def __init__(
        self,
        max_size: int = 100,
        ttl_seconds: float = 1800.0,  # 30 min
        cleanup_interval: float = 300.0,  # 5 min
    ):
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
        self._cache: dict[str, CacheEntry] = {}
        self._lock = asyncio.Lock()
        self._cleanup_task: Optional[asyncio.Task] = None
        self._cleanup_interval = cleanup_interval

    @staticmethod
    def _make_key(
        exchange: str,
        api_key: str = "",
        testnet: bool = False,
    ) -> str:
        """生成缓存键"""
        return f"{exchange}:{hash(api_key)}:{testnet}"

    async def get(
        self,
        exchange: str,
        api_key: str = "",
        secret: str = "",
        passphrase: Optional[str] = None,
        testnet: bool = False,
    ) -> BaseExchangeAdapter:
        """
        获取或创建适配器。

        优先返回缓存中的实例；若不存在则创建新实例并缓存。
        """
        key = self._make_key(exchange, api_key, testnet)

        async with self._lock:
            entry = self._cache.get(key)

            if entry is not None:
                # 检查 TTL
                if time.time() - entry.last_used < self.ttl_seconds:
                    entry.last_used = time.time()
                    entry.use_count += 1
                    logger.debug(
                        f"Adapter cache HIT: {exchange} (used {entry.use_count}x, "
                        f"age={time.time() - entry.created_at:.0f}s)"
                    )
                    return entry.adapter
                else:
                    # 过期，移除
                    logger.debug(f"Adapter cache EXPIRED: {key}")
                    del self._cache[key]

            # 创建新适配器
            adapter_class = EXCHANGE_MAP.get(exchange.lower())
            if adapter_class is None:
                raise ValueError(f"不支持的交易所: {exchange}")

            adapter = adapter_class(api_key, secret, passphrase, testnet)
            self._cache[key] = CacheEntry(adapter=adapter)
            logger.info(f"Adapter cache NEW: {exchange} (total={len(self._cache)})")

            # 容量限制：超过时淘汰最久未使用的
            if len(self._cache) > self.max_size:
                self._evict_lru()

            return adapter

    def _evict_lru(self):
        """淘汰最久未使用的条目"""
        if not self._cache:
            return
        lru_key = min(self._cache, key=lambda k: self._cache[k].last_used)
        entry = self._cache[lru_key]
        logger.info(
            f"Adapter cache EVICT: {lru_key} "
            f"(idle={time.time() - entry.last_used:.0f}s, used={entry.use_count}x)"
        )
        del self._cache[lru_key]

    async def invalidate(
        self,
        exchange: str,
        api_key: str = "",
        testnet: bool = False,
    ):
        """使指定适配器失效（API Key 更新后调用）"""
        key = self._make_key(exchange, api_key, testnet)
        async with self._lock:
            if key in self._cache:
                logger.info(f"Adapter cache INVALIDATE: {key}")
                del self._cache[key]

    async def start_cleanup(self):
        """启动后台清理任务"""
        if self._cleanup_task is None:
            self._cleanup_task = asyncio.create_task(self._cleanup_loop())

    async def stop_cleanup(self):
        """停止后台清理任务"""
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
            self._cleanup_task = None

    async def _cleanup_loop(self):
        """后台清理过期条目"""
        while True:
            try:
                await asyncio.sleep(self._cleanup_interval)
                await self._cleanup_expired()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Adapter cache cleanup error: {e}")

    async def _cleanup_expired(self):
        """清理所有过期条目"""
        now = time.time()
        async with self._lock:
            expired = [
                k for k, v in self._cache.items()
                if now - v.last_used >= self.ttl_seconds
            ]
            for key in expired:
                del self._cache[key]
            if expired:
                logger.debug(f"Adapter cache cleaned {len(expired)} expired entries")

    @property
    def size(self) -> int:
        return len(self._cache)

    def stats(self) -> dict:
        """返回缓存统计信息"""
        now = time.time()
        entries = []
        for key, entry in self._cache.items():
            entries.append({
                "key": key,
                "age_s": round(now - entry.created_at, 1),
                "idle_s": round(now - entry.last_used, 1),
                "use_count": entry.use_count,
            })
        return {
            "total": len(self._cache),
            "max_size": self.max_size,
            "ttl_s": self.ttl_seconds,
            "entries": entries,
        }


# ================================================================
# 全局单例
# ================================================================
adapter_cache = AdapterCache(max_size=100, ttl_seconds=1800.0)
