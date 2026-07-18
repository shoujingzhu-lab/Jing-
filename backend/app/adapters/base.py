"""
交易所适配器基类
================
定义统一接口，所有交易所实现必须遵守。
"""

from abc import ABC, abstractmethod
from typing import Optional


class BaseExchangeAdapter(ABC):
    """交易所适配器抽象基类"""

    def __init__(
        self,
        api_key: str = "",
        secret: str = "",
        passphrase: Optional[str] = None,
        testnet: bool = False,
    ):
        self.api_key = api_key
        self.secret = secret
        self.passphrase = passphrase
        self.testnet = testnet
        self._exchange_name: str = "base"

    @property
    def name(self) -> str:
        return self._exchange_name

    # ---- 行情接口 ----

    @abstractmethod
    async def fetch_ticker(self, symbol: str) -> dict:
        """获取实时 Ticker"""
        ...

    @abstractmethod
    async def fetch_orderbook(self, symbol: str, depth: int = 20) -> dict:
        """获取订单簿"""
        ...

    @abstractmethod
    async def fetch_klines(
        self, symbol: str, interval: str = "1h", limit: int = 500,
        since: Optional[int] = None,
    ) -> list[dict]:
        """获取 K 线数据"""
        ...

    @abstractmethod
    async def fetch_funding_rate(self, symbol: str) -> dict:
        """获取当前资金费率"""
        ...

    # ---- 交易接口 ----

    @abstractmethod
    async def create_order(
        self, symbol: str, side: str, order_type: str, amount: float,
        price: Optional[float] = None, params: Optional[dict] = None,
    ) -> dict:
        """创建订单"""
        ...

    @abstractmethod
    async def cancel_order(self, order_id: str, symbol: str) -> dict:
        """撤销订单"""
        ...

    @abstractmethod
    async def fetch_open_orders(self, symbol: Optional[str] = None) -> list[dict]:
        """查询挂单"""
        ...

    @abstractmethod
    async def fetch_positions(self, symbols: Optional[list[str]] = None) -> list[dict]:
        """查询持仓"""
        ...

    @abstractmethod
    async def fetch_balance(self) -> dict:
        """查询账户余额"""
        ...

    # ---- 工具 ----

    @staticmethod
    def normalize_symbol(symbol: str) -> str:
        """标准化交易对格式（CCXT 格式：BTC/USDT）

        支持输入: BTC/USDT, BTC-USDT, BTC_USDT, BTCUSDT
        """
        # 已有 CCXT 斜杠格式
        if "/" in symbol:
            return symbol
        # 用 - 或 _ 分隔
        if "-" in symbol or "_" in symbol:
            return symbol.replace("-", "/").replace("_", "/")
        # 无分隔符格式: 按常见计价货币自动分割
        common_quotes = ["USDT", "USDC", "USD", "BTC", "ETH", "BNB",
                        "BUSD", "TUSD", "DAI", "UST", "TRY", "EUR",
                        "JPY", "GBP", "AUD", "RUB", "UAH", "NGN",
                        "IDRT", "ZAR", "BRL", "ARS", "COP"]
        symbol_upper = symbol.upper()
        for quote in common_quotes:
            if symbol_upper.endswith(quote) and len(symbol_upper) > len(quote):
                base = symbol[:-len(quote)]
                return f"{base}/{quote}"
        # 回退：在中间位置插入 /
        mid = len(symbol) // 2
        return f"{symbol[:mid]}/{symbol[mid:]}"
