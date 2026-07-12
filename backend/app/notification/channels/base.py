"""
通知渠道基类
============
所有渠道发送器必须实现此接口。
"""

import asyncio
from abc import ABC, abstractmethod
from typing import Optional


class BaseNotificationSender(ABC):
    """通知发送器抽象基类"""

    name: str = "base"

    def __init__(self, cooldown_seconds: float = 1.0):
        self._cooldown = cooldown_seconds
        self._last_send: dict[str, float] = {}  # recipient → last send timestamp

    @abstractmethod
    async def send(
        self,
        recipient: str,
        title: str,
        body: str,
        severity: str = "info",
    ) -> bool:
        """
        发送通知。

        返回:
            True 表示发送成功，False 表示失败。
        """
        ...

    async def send_with_cooldown(
        self,
        recipient: str,
        title: str,
        body: str,
        severity: str = "info",
    ) -> bool:
        """带冷却时间的发送"""
        import time
        now = time.monotonic()
        if recipient in self._last_send:
            elapsed = now - self._last_send[recipient]
            if elapsed < self._cooldown:
                return False
        self._last_send[recipient] = now
        return await self.send(recipient, title, body, severity)


class NullSender(BaseNotificationSender):
    """空发送器 — 仅记录日志，用于未配置的渠道"""

    name = "null"

    async def send(self, recipient, title, body, severity="info") -> bool:
        return True
