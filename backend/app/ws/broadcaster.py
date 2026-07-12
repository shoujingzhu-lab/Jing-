"""
WebSocket 数据广播器
===================
后台 asyncio task：定时轮询 MarketDataService，向订阅频道广播数据。
"""

import asyncio
from typing import Optional

from app.services.market_data import market_data_service
from app.ws.manager import ws_manager


class DataBroadcaster:
    """
    后台数据广播器。

    定时轮询行情数据并推送给已订阅的 WebSocket 客户端。
    支持按频道类型配置不同轮询间隔。
    """

    def __init__(
        self,
        ticker_interval: float = 1.0,
        orderbook_interval: float = 1.0,
        kline_interval: float = 60.0,
    ):
        self._ticker_interval = ticker_interval
        self._orderbook_interval = orderbook_interval
        self._kline_interval = kline_interval
        self._tasks: list[asyncio.Task] = []
        self._running = False

    async def start(self):
        """启动所有广播任务"""
        if self._running:
            return
        self._running = True

        self._tasks.append(asyncio.create_task(self._broadcast_ticker_loop()))
        self._tasks.append(asyncio.create_task(self._broadcast_orderbook_loop()))
        # K 线轮询间隔较长，独立任务
        self._tasks.append(asyncio.create_task(self._broadcast_kline_loop()))

    async def stop(self):
        """停止所有广播任务"""
        self._running = False
        for task in self._tasks:
            task.cancel()
        # 等待任务完成取消
        await asyncio.gather(*self._tasks, return_exceptions=True)
        self._tasks.clear()

    async def _broadcast_ticker_loop(self):
        """Ticker 广播循环"""
        while self._running:
            try:
                # 遍历所有 ticker 频道并推送数据
                for channel in list(ws_manager._channels.keys()):
                    if not channel.startswith("ticker:"):
                        continue
                    parts = channel.split(":", 2)  # ticker:exchange:symbol
                    if len(parts) < 3:
                        continue
                    exchange, symbol = parts[1], parts[2]
                    try:
                        ticker = await market_data_service.get_ticker(exchange, symbol)
                        await ws_manager.broadcast(channel, ticker)
                    except Exception:
                        pass  # 单个交易对失败不影响其他
            except asyncio.CancelledError:
                break
            except Exception:
                pass
            await asyncio.sleep(self._ticker_interval)

    async def _broadcast_orderbook_loop(self):
        """订单簿广播循环"""
        while self._running:
            try:
                for channel in list(ws_manager._channels.keys()):
                    if not channel.startswith("orderbook:"):
                        continue
                    parts = channel.split(":", 2)
                    if len(parts) < 3:
                        continue
                    exchange, symbol = parts[1], parts[2]
                    try:
                        ob = await market_data_service.get_orderbook(exchange, symbol, depth=20)
                        await ws_manager.broadcast(channel, ob)
                    except Exception:
                        pass
            except asyncio.CancelledError:
                break
            except Exception:
                pass
            await asyncio.sleep(self._orderbook_interval)

    async def _broadcast_kline_loop(self):
        """K 线广播循环"""
        while self._running:
            try:
                for channel in list(ws_manager._channels.keys()):
                    if not channel.startswith("klines:"):
                        continue
                    parts = channel.split(":", 3)  # klines:exchange:symbol:interval
                    if len(parts) < 4:
                        continue
                    exchange, symbol, interval = parts[1], parts[2], parts[3]
                    try:
                        klines = await market_data_service.get_klines(
                            exchange, symbol, interval, limit=5,
                        )
                        await ws_manager.broadcast(channel, klines)
                    except Exception:
                        pass
            except asyncio.CancelledError:
                break
            except Exception:
                pass
            await asyncio.sleep(self._kline_interval)


# ================================================================
# 全局单例
# ================================================================
data_broadcaster = DataBroadcaster(
    ticker_interval=1.0,
    orderbook_interval=1.0,
    kline_interval=60.0,
)
