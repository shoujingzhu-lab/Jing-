"""
策略引擎 & 回测引擎
===================
- 可视化策略执行器
- Python 代码策略沙箱
- 事件驱动回测引擎
"""

from abc import ABC, abstractmethod
from typing import Optional


class BaseStrategy(ABC):
    """用户策略基类 — 所有代码策略必须继承此类"""

    def __init__(self, config: dict):
        self.config = config
        self.name: str = config.get("name", "unnamed")

    @abstractmethod
    def on_bar(self, kline: dict) -> Optional[dict]:
        """
        K 线回调 — 每根 K 线收盘时触发。

        Args:
            kline: 当前 K 线数据 (dict with open, high, low, close, volume, ...)

        Returns:
            交易信号 dict 或 None: {"action": "buy"/"sell"/"close", "amount": 0.01, "price": 50000}
        """
        ...

    def on_tick(self, tick: dict) -> Optional[dict]:
        """逐笔成交回调"""
        return None

    def on_orderbook(self, orderbook: dict) -> Optional[dict]:
        """订单簿更新回调"""
        return None

    def on_signal(self, signal: dict) -> bool:
        """外部信号回调（Webhook 等）"""
        return False
