"""
交易所适配层
===========
对接各交易所 API (Binance / OKX / Bybit / Gate.io)。
使用 CCXT 统一接口。
"""

from app.adapters.base import BaseExchangeAdapter
from app.adapters.cache import AdapterCache, adapter_cache
from app.adapters.exchanges import (
    EXCHANGE_MAP,
    BinanceAdapter,
    BybitAdapter,
    GateIOAdapter,
    OKXAdapter,
    create_adapter,
)

__all__ = [
    "BaseExchangeAdapter",
    "BinanceAdapter",
    "OKXAdapter",
    "BybitAdapter",
    "GateIOAdapter",
    "EXCHANGE_MAP",
    "create_adapter",
    "AdapterCache",
    "adapter_cache",
]
