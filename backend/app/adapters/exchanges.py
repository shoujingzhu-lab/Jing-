"""
交易所适配器实现
================
基于 CCXT 统一接口层，封装 Binance / OKX / Bybit / Gate.io。
所有 CCXT 实例通过 HTTP_PROXY 连接境外交易所。
"""

import asyncio
from typing import Optional

import ccxt.async_support as ccxt

from app.adapters.base import BaseExchangeAdapter
from app.core.config import settings


def _ccxt_proxies() -> dict:
    """构建 CCXT proxies 配置"""
    proxies = {}
    if settings.HTTP_PROXY:
        proxies["http"] = settings.HTTP_PROXY
    if settings.HTTPS_PROXY:
        proxies["https"] = settings.HTTPS_PROXY
    return proxies


def _ccxt_config(extra: Optional[dict] = None) -> dict:
    """构建带代理的 CCXT 配置"""
    config = {"enableRateLimit": True}
    proxies = _ccxt_proxies()
    if proxies:
        config["proxies"] = proxies
    if extra:
        config.update(extra)
    return config


class BinanceAdapter(BaseExchangeAdapter):
    """Binance 交易所适配器 (现货 + U本位合约)"""

    _exchange_name = "binance"

    def __init__(self, api_key: str = "", secret: str = "", passphrase: Optional[str] = None, testnet: bool = False):
        super().__init__(api_key, secret, passphrase, testnet)
        self._exchange_name = "binance"
        self._spot: Optional[ccxt.binance] = None
        self._futures: Optional[ccxt.binanceusdm] = None

    async def _get_spot(self) -> ccxt.binance:
        if self._spot is None:
            config = _ccxt_config({"apiKey": self.api_key, "secret": self.secret, "options": {"defaultType": "spot"}})
            if self.testnet:
                config["urls"] = {"api": "https://testnet.binance.vision/api"}
            self._spot = ccxt.binance(config)
        return self._spot

    async def _get_futures(self) -> ccxt.binanceusdm:
        if self._futures is None:
            config = _ccxt_config({"apiKey": self.api_key, "secret": self.secret})
            if self.testnet:
                config["urls"] = {"api": "https://testnet.binancefuture.com/fapi"}
            self._futures = ccxt.binanceusdm(config)
        return self._futures

    async def fetch_ticker(self, symbol: str) -> dict:
        ex = await self._get_spot()
        ticker = await ex.fetch_ticker(self.normalize_symbol(symbol))
        return {
            "symbol": symbol,
            "last": ticker["last"],
            "bid": ticker["bid"],
            "ask": ticker["ask"],
            "high_24h": ticker["high"],
            "low_24h": ticker["low"],
            "volume_24h": ticker["baseVolume"],
            "quote_volume_24h": ticker["quoteVolume"],
            "change_pct_24h": ticker["percentage"],
            "timestamp": ticker["timestamp"],
        }

    async def fetch_orderbook(self, symbol: str, depth: int = 20) -> dict:
        ex = await self._get_spot()
        ob = await ex.fetch_order_book(self.normalize_symbol(symbol), depth)
        return {
            "symbol": symbol,
            "bids": ob["bids"][:depth],
            "asks": ob["asks"][:depth],
            "best_bid": ob["bids"][0][0] if ob["bids"] else 0,
            "best_ask": ob["asks"][0][0] if ob["asks"] else 0,
            "spread": (ob["asks"][0][0] - ob["bids"][0][0]) if ob["bids"] and ob["asks"] else 0,
            "timestamp": ob["timestamp"],
        }

    async def fetch_klines(
        self, symbol: str, interval: str = "1h", limit: int = 500,
        since: Optional[int] = None,
    ) -> list[dict]:
        ex = await self._get_spot()
        ohlcv = await ex.fetch_ohlcv(
            self.normalize_symbol(symbol), interval, since=since, limit=limit,
        )
        return [
            {
                "open_time": bar[0],
                "open": bar[1],
                "high": bar[2],
                "low": bar[3],
                "close": bar[4],
                "volume": bar[5],
            }
            for bar in ohlcv
        ]

    async def fetch_funding_rate(self, symbol: str) -> dict:
        ex = await self._get_futures()
        fr = await ex.fetch_funding_rate(self.normalize_symbol(symbol))
        return {
            "symbol": symbol,
            "rate": fr["fundingRate"],
            "next_rate": fr.get("nextFundingRate"),
            "timestamp": fr["timestamp"],
        }

    async def create_order(
        self, symbol: str, side: str, order_type: str, amount: float,
        price: Optional[float] = None, params: Optional[dict] = None,
    ) -> dict:
        ex = await self._get_spot()
        order = await ex.create_order(
            self.normalize_symbol(symbol), order_type, side, amount, price, params or {},
        )
        return {"order_id": order["id"], "status": order["status"], **order}

    async def cancel_order(self, order_id: str, symbol: str) -> dict:
        ex = await self._get_spot()
        return await ex.cancel_order(order_id, self.normalize_symbol(symbol))

    async def fetch_open_orders(self, symbol: Optional[str] = None) -> list[dict]:
        ex = await self._get_spot()
        return await ex.fetch_open_orders(
            self.normalize_symbol(symbol) if symbol else None
        )

    async def fetch_positions(self, symbols: Optional[list[str]] = None) -> list[dict]:
        ex = await self._get_futures()
        positions = await ex.fetch_positions(symbols)
        return positions

    async def fetch_balance(self) -> dict:
        ex = await self._get_spot()
        balance = await ex.fetch_balance()
        return balance.get("total", {})


class OKXAdapter(BaseExchangeAdapter):
    """OKX 交易所适配器"""

    _exchange_name = "okx"

    def __init__(self, api_key: str = "", secret: str = "", passphrase: Optional[str] = None, testnet: bool = False):
        super().__init__(api_key, secret, passphrase, testnet)
        self._exchange_name = "okx"
        self._ex: Optional[ccxt.okx] = None

    async def _get(self) -> ccxt.okx:
        if self._ex is None:
            config = _ccxt_config({"apiKey": self.api_key, "secret": self.secret, "password": self.passphrase or ""})
            if self.testnet:
                config["urls"] = {"api": "https://www.okx.com/api/v5"}
            self._ex = ccxt.okx(config)
        return self._ex

    async def fetch_ticker(self, symbol: str) -> dict:
        ex = await self._get()
        ticker = await ex.fetch_ticker(self.normalize_symbol(symbol))
        return {
            "symbol": symbol, "last": ticker["last"],
            "bid": ticker["bid"], "ask": ticker["ask"],
            "high_24h": ticker["high"], "low_24h": ticker["low"],
            "volume_24h": ticker["baseVolume"],
            "quote_volume_24h": ticker["quoteVolume"],
            "change_pct_24h": ticker["percentage"],
            "timestamp": ticker["timestamp"],
        }

    async def fetch_orderbook(self, symbol: str, depth: int = 20) -> dict:
        ex = await self._get()
        ob = await ex.fetch_order_book(self.normalize_symbol(symbol), depth)
        return {
            "symbol": symbol,
            "bids": ob["bids"][:depth],
            "asks": ob["asks"][:depth],
            "best_bid": ob["bids"][0][0] if ob["bids"] else 0,
            "best_ask": ob["asks"][0][0] if ob["asks"] else 0,
            "spread": (ob["asks"][0][0] - ob["bids"][0][0]) if ob["bids"] and ob["asks"] else 0,
            "timestamp": ob["timestamp"],
        }

    async def fetch_klines(
        self, symbol: str, interval: str = "1h", limit: int = 500,
        since: Optional[int] = None,
    ) -> list[dict]:
        ex = await self._get()
        ohlcv = await ex.fetch_ohlcv(
            self.normalize_symbol(symbol), interval, since=since, limit=limit,
        )
        return [
            {"open_time": bar[0], "open": bar[1], "high": bar[2],
             "low": bar[3], "close": bar[4], "volume": bar[5]}
            for bar in ohlcv
        ]

    async def fetch_funding_rate(self, symbol: str) -> dict:
        ex = await self._get()
        fr = await ex.fetch_funding_rate(self.normalize_symbol(symbol))
        return {"symbol": symbol, "rate": fr["fundingRate"], "timestamp": fr["timestamp"]}

    async def create_order(self, symbol: str, side: str, order_type: str, amount: float,
                           price: Optional[float] = None, params: Optional[dict] = None) -> dict:
        ex = await self._get()
        order = await ex.create_order(
            self.normalize_symbol(symbol), order_type, side, amount, price, params or {})
        return {"order_id": order["id"], "status": order["status"], **order}

    async def cancel_order(self, order_id: str, symbol: str) -> dict:
        ex = await self._get()
        return await ex.cancel_order(order_id, self.normalize_symbol(symbol))

    async def fetch_open_orders(self, symbol: Optional[str] = None) -> list[dict]:
        ex = await self._get()
        return await ex.fetch_open_orders(self.normalize_symbol(symbol) if symbol else None)

    async def fetch_positions(self, symbols: Optional[list[str]] = None) -> list[dict]:
        ex = await self._get()
        return await ex.fetch_positions(symbols)

    async def fetch_balance(self) -> dict:
        ex = await self._get()
        balance = await ex.fetch_balance()
        return balance.get("total", {})


class BybitAdapter(BaseExchangeAdapter):
    """Bybit 交易所适配器"""

    _exchange_name = "bybit"

    def __init__(self, api_key: str = "", secret: str = "", passphrase: Optional[str] = None, testnet: bool = False):
        super().__init__(api_key, secret, passphrase, testnet)
        self._exchange_name = "bybit"
        self._ex: Optional[ccxt.bybit] = None

    async def _get(self) -> ccxt.bybit:
        if self._ex is None:
            config = _ccxt_config({"apiKey": self.api_key, "secret": self.secret})
            if self.testnet:
                config["urls"] = {"api": "https://api-testnet.bybit.com"}
            self._ex = ccxt.bybit(config)
        return self._ex

    async def fetch_ticker(self, symbol: str) -> dict:
        ex = await self._get()
        ticker = await ex.fetch_ticker(self.normalize_symbol(symbol))
        return {
            "symbol": symbol, "last": ticker["last"],
            "bid": ticker["bid"], "ask": ticker["ask"],
            "high_24h": ticker["high"], "low_24h": ticker["low"],
            "volume_24h": ticker["baseVolume"],
            "quote_volume_24h": ticker["quoteVolume"],
            "change_pct_24h": ticker["percentage"],
            "timestamp": ticker["timestamp"],
        }

    async def fetch_orderbook(self, symbol: str, depth: int = 20) -> dict:
        ex = await self._get()
        ob = await ex.fetch_order_book(self.normalize_symbol(symbol), depth)
        return {
            "symbol": symbol, "bids": ob["bids"][:depth], "asks": ob["asks"][:depth],
            "best_bid": ob["bids"][0][0] if ob["bids"] else 0,
            "best_ask": ob["asks"][0][0] if ob["asks"] else 0,
            "spread": (ob["asks"][0][0] - ob["bids"][0][0]) if ob["bids"] and ob["asks"] else 0,
            "timestamp": ob["timestamp"],
        }

    async def fetch_klines(
        self, symbol: str, interval: str = "1h", limit: int = 500,
        since: Optional[int] = None,
    ) -> list[dict]:
        ex = await self._get()
        ohlcv = await ex.fetch_ohlcv(
            self.normalize_symbol(symbol), interval, since=since, limit=limit)
        return [
            {"open_time": bar[0], "open": bar[1], "high": bar[2],
             "low": bar[3], "close": bar[4], "volume": bar[5]}
            for bar in ohlcv
        ]

    async def fetch_funding_rate(self, symbol: str) -> dict:
        ex = await self._get()
        fr = await ex.fetch_funding_rate(self.normalize_symbol(symbol))
        return {"symbol": symbol, "rate": fr["fundingRate"], "timestamp": fr["timestamp"]}

    async def create_order(self, symbol: str, side: str, order_type: str, amount: float,
                           price: Optional[float] = None, params: Optional[dict] = None) -> dict:
        ex = await self._get()
        order = await ex.create_order(
            self.normalize_symbol(symbol), order_type, side, amount, price, params or {})
        return {"order_id": order["id"], "status": order["status"], **order}

    async def cancel_order(self, order_id: str, symbol: str) -> dict:
        ex = await self._get()
        return await ex.cancel_order(order_id, self.normalize_symbol(symbol))

    async def fetch_open_orders(self, symbol: Optional[str] = None) -> list[dict]:
        ex = await self._get()
        return await ex.fetch_open_orders(self.normalize_symbol(symbol) if symbol else None)

    async def fetch_positions(self, symbols: Optional[list[str]] = None) -> list[dict]:
        ex = await self._get()
        return await ex.fetch_positions(symbols)

    async def fetch_balance(self) -> dict:
        ex = await self._get()
        balance = await ex.fetch_balance()
        return balance.get("total", {})


class GateIOAdapter(BaseExchangeAdapter):
    """Gate.io 交易所适配器"""

    _exchange_name = "gateio"

    def __init__(self, api_key: str = "", secret: str = "", passphrase: Optional[str] = None, testnet: bool = False):
        super().__init__(api_key, secret, passphrase, testnet)
        self._exchange_name = "gateio"
        self._ex: Optional[ccxt.gate] = None

    async def _get(self) -> ccxt.gate:
        if self._ex is None:
            self._ex = ccxt.gate(_ccxt_config({"apiKey": self.api_key, "secret": self.secret}))
        return self._ex

    async def fetch_ticker(self, symbol: str) -> dict:
        ex = await self._get()
        ticker = await ex.fetch_ticker(self.normalize_symbol(symbol))
        return {
            "symbol": symbol, "last": ticker["last"],
            "bid": ticker["bid"], "ask": ticker["ask"],
            "high_24h": ticker["high"], "low_24h": ticker["low"],
            "volume_24h": ticker["baseVolume"],
            "quote_volume_24h": ticker["quoteVolume"],
            "change_pct_24h": ticker["percentage"],
            "timestamp": ticker["timestamp"],
        }

    async def fetch_orderbook(self, symbol: str, depth: int = 20) -> dict:
        ex = await self._get()
        ob = await ex.fetch_order_book(self.normalize_symbol(symbol), depth)
        return {
            "symbol": symbol, "bids": ob["bids"][:depth], "asks": ob["asks"][:depth],
            "best_bid": ob["bids"][0][0] if ob["bids"] else 0,
            "best_ask": ob["asks"][0][0] if ob["asks"] else 0,
            "spread": (ob["asks"][0][0] - ob["bids"][0][0]) if ob["bids"] and ob["asks"] else 0,
            "timestamp": ob["timestamp"],
        }

    async def fetch_klines(
        self, symbol: str, interval: str = "1h", limit: int = 500,
        since: Optional[int] = None,
    ) -> list[dict]:
        ex = await self._get()
        ohlcv = await ex.fetch_ohlcv(
            self.normalize_symbol(symbol), interval, since=since, limit=limit)
        return [
            {"open_time": bar[0], "open": bar[1], "high": bar[2],
             "low": bar[3], "close": bar[4], "volume": bar[5]}
            for bar in ohlcv
        ]

    async def fetch_funding_rate(self, symbol: str) -> dict:
        ex = await self._get()
        fr = await ex.fetch_funding_rate(self.normalize_symbol(symbol))
        return {"symbol": symbol, "rate": fr["fundingRate"], "timestamp": fr["timestamp"]}

    async def create_order(self, symbol: str, side: str, order_type: str, amount: float,
                           price: Optional[float] = None, params: Optional[dict] = None) -> dict:
        ex = await self._get()
        order = await ex.create_order(
            self.normalize_symbol(symbol), order_type, side, amount, price, params or {})
        return {"order_id": order["id"], "status": order["status"], **order}

    async def cancel_order(self, order_id: str, symbol: str) -> dict:
        ex = await self._get()
        return await ex.cancel_order(order_id, self.normalize_symbol(symbol))

    async def fetch_open_orders(self, symbol: Optional[str] = None) -> list[dict]:
        ex = await self._get()
        return await ex.fetch_open_orders(self.normalize_symbol(symbol) if symbol else None)

    async def fetch_positions(self, symbols: Optional[list[str]] = None) -> list[dict]:
        ex = await self._get()
        return await ex.fetch_positions(symbols)

    async def fetch_balance(self) -> dict:
        ex = await self._get()
        balance = await ex.fetch_balance()
        return balance.get("total", {})


# ============================================================
# 交易所工厂
# ============================================================
EXCHANGE_MAP = {
    "binance": BinanceAdapter,
    "okx": OKXAdapter,
    "bybit": BybitAdapter,
    "gateio": GateIOAdapter,
    "gate": GateIOAdapter,
}


def create_adapter(
    exchange: str,
    api_key: str = "",
    secret: str = "",
    passphrase: Optional[str] = None,
    testnet: bool = False,
) -> BaseExchangeAdapter:
    """工厂方法：创建交易所适配器"""
    adapter_class = EXCHANGE_MAP.get(exchange.lower())
    if adapter_class is None:
        raise ValueError(f"不支持的交易所: {exchange}. 支持: {list(EXCHANGE_MAP)}")
    return adapter_class(api_key=api_key, secret=secret, passphrase=passphrase, testnet=testnet)
