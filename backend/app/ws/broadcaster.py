"""
WebSocket 数据广播器
===================
后台 asyncio task：定时轮询 MarketDataService，向订阅频道广播真实数据。
"""

import asyncio
import logging
from datetime import datetime, UTC
from typing import Optional

from app.services.market_data import market_data_service
from app.ws.manager import ws_manager

logger = logging.getLogger("quant.ws.broadcaster")


class DataBroadcaster:
    """
    后台数据广播器。

    定时轮询行情数据并推送给已订阅的 WebSocket 客户端。
    支持按频道类型配置不同轮询间隔。

    连接状态:
    - exchange_available: 交易所连接正常，推送实时数据
    - exchange_unavailable: 交易所不可用（如网络限制），通知客户端
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

        # 交易所连接状态追踪
        self._exchange_available: dict[str, bool] = {}
        self._last_status_broadcast: float = 0

    async def start(self):
        """启动所有广播任务"""
        if self._running:
            return
        self._running = True

        self._tasks.append(asyncio.create_task(self._broadcast_ticker_loop()))
        self._tasks.append(asyncio.create_task(self._broadcast_orderbook_loop()))
        self._tasks.append(asyncio.create_task(self._broadcast_kline_loop()))
        self._tasks.append(asyncio.create_task(self._broadcast_status_loop()))

        logger.info(
            f"DataBroadcaster started: ticker={self._ticker_interval}s, "
            f"orderbook={self._orderbook_interval}s, kline={self._kline_interval}s"
        )

    async def stop(self):
        """停止所有广播任务"""
        self._running = False
        for task in self._tasks:
            task.cancel()
        await asyncio.gather(*self._tasks, return_exceptions=True)
        self._tasks.clear()
        logger.info("DataBroadcaster stopped")

    @property
    def exchange_status(self) -> dict:
        """各交易所的连接状态"""
        return dict(self._exchange_available)

    async def _broadcast_ticker_loop(self):
        """Ticker 广播循环"""
        while self._running:
            try:
                for channel in list(ws_manager._channels.keys()):
                    if not channel.startswith("ticker:"):
                        continue
                    parts = channel.split(":", 2)
                    if len(parts) < 3:
                        continue
                    exchange, symbol = parts[1], parts[2]
                    try:
                        ticker = await market_data_service.get_ticker(exchange, symbol)
                        await ws_manager.broadcast(channel, ticker)
                        self._exchange_available[exchange] = True
                    except Exception:
                        self._exchange_available[exchange] = False
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Ticker broadcast error: {e}")
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
                        self._exchange_available[exchange] = True
                    except Exception:
                        self._exchange_available[exchange] = False
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Orderbook broadcast error: {e}")
            await asyncio.sleep(self._orderbook_interval)

    async def _broadcast_kline_loop(self):
        """K 线广播循环"""
        while self._running:
            try:
                for channel in list(ws_manager._channels.keys()):
                    if not channel.startswith("klines:"):
                        continue
                    parts = channel.split(":", 3)
                    if len(parts) < 4:
                        continue
                    exchange, symbol, interval = parts[1], parts[2], parts[3]
                    try:
                        klines = await market_data_service.get_klines(
                            exchange, symbol, interval, limit=5,
                        )
                        await ws_manager.broadcast(channel, klines)
                        self._exchange_available[exchange] = True
                    except Exception:
                        self._exchange_available[exchange] = False
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Kline broadcast error: {e}")
            await asyncio.sleep(self._kline_interval)

    async def _broadcast_status_loop(self):
        """每 30 秒广播一次交易所连接状态给所有已连接的行情客户端"""
        while self._running:
            try:
                # 构建状态消息
                status = {
                    "type": "exchange_status",
                    "data": {
                        "exchanges": self.exchange_status,
                        "active_connections": ws_manager.active_connections,
                        "channel_stats": ws_manager.channel_stats,
                        "timestamp": datetime.now(UTC).isoformat(),
                    },
                }

                # 向所有行情频道广播状态
                all_status_sent = set()
                for channel in ws_manager._channels:
                    prefix = channel.split(":")[0]
                    if prefix in ("ticker", "orderbook", "klines") and prefix not in all_status_sent:
                        all_status_sent.add(prefix)

                # 广播给所有已连接用户
                if ws_manager._user_connections:
                    for user_id in list(ws_manager._user_connections.keys()):
                        await ws_manager.send_to_user(user_id, status["data"], "exchange_status")

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Status broadcast error: {e}")
            await asyncio.sleep(30)


# ================================================================
# 全局单例
# ================================================================
data_broadcaster = DataBroadcaster(
    ticker_interval=1.0,
    orderbook_interval=1.0,
    kline_interval=60.0,
)
