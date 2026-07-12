"""
WebSocket 连接管理器
===================
频道订阅模式：管理所有活跃 WebSocket 连接，按频道/用户分组广播。
"""

import asyncio
import json
from typing import Any

from fastapi import WebSocket


class ConnectionManager:
    """
    WebSocket 连接管理器（单例模式）。

    频道类型：
    - ticker:{exchange}:{symbol}
    - orderbook:{exchange}:{symbol}
    - klines:{exchange}:{symbol}:{interval}
    - position:{user_id}
    - order:{user_id}
    - risk:{user_id}
    - notification:{user_id}
    """

    def __init__(self):
        # 频道 → WebSocket 连接集合
        self._channels: dict[str, set[WebSocket]] = {}
        # 用户 → WebSocket 连接集合（用于用户级推送）
        self._user_connections: dict[str, set[WebSocket]] = {}
        # WebSocket → {user_id, subscriptions}
        self._ws_info: dict[WebSocket, dict] = {}

    async def connect(self, ws: WebSocket, user_id: str):
        """接受 WebSocket 连接并记录用户信息"""
        await ws.accept()
        self._user_connections.setdefault(user_id, set()).add(ws)
        self._ws_info[ws] = {"user_id": user_id, "subscriptions": set()}
        # 发送欢迎消息
        await self._send_safe(ws, {
            "type": "connected",
            "data": {"user_id": user_id, "message": "WebSocket 连接已建立"},
        })

    async def disconnect(self, ws: WebSocket):
        """断开 WebSocket 连接并清理所有订阅"""
        info = self._ws_info.pop(ws, {})
        user_id = info.get("user_id")
        if user_id and user_id in self._user_connections:
            self._user_connections[user_id].discard(ws)
            if not self._user_connections[user_id]:
                del self._user_connections[user_id]

        # 从所有频道移除
        for channel in info.get("subscriptions", set()):
            if channel in self._channels:
                self._channels[channel].discard(ws)
                if not self._channels[channel]:
                    del self._channels[channel]

    async def subscribe(self, ws: WebSocket, channel: str):
        """订阅指定频道"""
        self._channels.setdefault(channel, set()).add(ws)
        if ws in self._ws_info:
            self._ws_info[ws].setdefault("subscriptions", set()).add(channel)
        await self._send_safe(ws, {
            "type": "subscribed",
            "data": {"channel": channel},
        })

    async def unsubscribe(self, ws: WebSocket, channel: str):
        """取消订阅指定频道"""
        if channel in self._channels:
            self._channels[channel].discard(ws)
            if not self._channels[channel]:
                del self._channels[channel]
        if ws in self._ws_info:
            self._ws_info[ws].get("subscriptions", set()).discard(channel)

    async def broadcast(self, channel: str, data: Any):
        """向指定频道的所有连接广播消息"""
        if channel not in self._channels:
            return
        message = {"type": "data", "channel": channel, "data": data}
        dead: list[WebSocket] = []
        for ws in self._channels[channel]:
            if not await self._send_safe(ws, message):
                dead.append(ws)
        for ws in dead:
            await self.disconnect(ws)

    async def send_to_user(self, user_id: str, data: Any, event_type: str = "event"):
        """向指定用户的所有连接发送消息"""
        if user_id not in self._user_connections:
            return
        message = {"type": event_type, "data": data}
        dead: list[WebSocket] = []
        for ws in self._user_connections[user_id]:
            if not await self._send_safe(ws, message):
                dead.append(ws)
        for ws in dead:
            await self.disconnect(ws)

    async def send_personal(self, ws: WebSocket, data: Any, msg_type: str = "message"):
        """向单个连接发送消息"""
        await self._send_safe(ws, {"type": msg_type, "data": data})

    @property
    def active_connections(self) -> int:
        """当前活跃连接数"""
        return len(self._ws_info)

    @property
    def channel_stats(self) -> dict:
        """各频道订阅统计"""
        return {ch: len(conns) for ch, conns in self._channels.items()}

    async def _send_safe(self, ws: WebSocket, message: dict) -> bool:
        """安全发送消息，捕获异常并返回是否成功"""
        try:
            await ws.send_text(json.dumps(message, ensure_ascii=False, default=str))
            return True
        except Exception:
            return False


# ================================================================
# 全局单例
# ================================================================
ws_manager = ConnectionManager()
