"""
行情数据服务
============
模块一业务逻辑：多交易所行情获取、聚合、历史数据管理。
"""

import asyncio
import json
from datetime import datetime, timedelta
from typing import Optional

from app.adapters.exchanges import create_adapter
from app.adapters.base import BaseExchangeAdapter


class MarketDataService:
    """行情数据服务 — 封装多交易所行情获取与聚合"""

    # 支持的交易所
    SUPPORTED_EXCHANGES = ["binance", "okx", "bybit", "gateio"]

    def __init__(self):
        self._adapters: dict[str, BaseExchangeAdapter] = {}

    def _get_adapter(self, exchange: str) -> BaseExchangeAdapter:
        """获取或创建交易所适配器（只读，无需 API Key）"""
        if exchange not in self._adapters:
            self._adapters[exchange] = create_adapter(exchange)
        return self._adapters[exchange]

    async def get_ticker(self, exchange: str, symbol: str) -> dict:
        """DATA-002: 获取实时 Ticker"""
        adapter = self._get_adapter(exchange)
        return await adapter.fetch_ticker(symbol)

    async def get_orderbook(self, exchange: str, symbol: str, depth: int = 20) -> dict:
        """DATA-002: 获取订单簿"""
        adapter = self._get_adapter(exchange)
        return await adapter.fetch_orderbook(symbol, depth)

    async def get_klines(
        self, exchange: str, symbol: str, interval: str = "1h",
        limit: int = 500, since: Optional[int] = None,
    ) -> list[dict]:
        """获取 K 线数据"""
        adapter = self._get_adapter(exchange)
        return await adapter.fetch_klines(symbol, interval, limit, since)

    async def get_funding_rate(self, exchange: str, symbol: str) -> dict:
        """DATA-009: 获取资金费率"""
        adapter = self._get_adapter(exchange)
        return await adapter.fetch_funding_rate(symbol)

    async def get_aggregated_ticker(self, symbol: str) -> dict:
        """DATA-003: 多交易所行情聚合。

        同时获取多个交易所的报价，找出最优买卖价和跨所价差。
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

    async def download_history(
        self, exchange: str, symbol: str, interval: str,
        start_date: datetime, end_date: datetime,
    ) -> list[dict]:
        """DATA-004: 下载历史数据（支持大时间范围自动分批）"""
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
        """安全获取行情（单交易所失败不影响整体）"""
        try:
            return await self.get_ticker(exchange, symbol)
        except Exception:
            return None


# ============================================================
# 全局单例
# ============================================================
market_data_service = MarketDataService()
