"""
通知分发器
==========
根据通知的 channels 配置，将消息分发到相应的渠道发送器。
"""

from app.notification.channels.base import BaseNotificationSender, NullSender
from app.notification.channels.telegram import TelegramSender
from app.notification.channels.email_sender import EmailSender
from app.notification.channels.webhook import DiscordSender, DingTalkSender


class NotificationDispatcher:
    """
    多渠道通知分发器。

    使用方式：
        dispatcher = NotificationDispatcher()
        await dispatcher.dispatch(
            channels=["telegram", "email"],
            recipient="user123",
            title="风控告警",
            body="BTC 价格突破止损线",
            severity="warning",
        )
    """

    def __init__(self):
        self._senders: dict[str, BaseNotificationSender] = {
            "telegram": TelegramSender(),
            "email": EmailSender(),
            "discord": DiscordSender(),
            "dingtalk": DingTalkSender(),
            "in_app": NullSender(),  # in_app 由 DB 记录处理，无需外部发送
        }

    async def dispatch(
        self,
        channels: list[str],
        recipient: str = "",
        title: str = "",
        body: str = "",
        severity: str = "info",
    ) -> dict[str, bool]:
        """
        向指定渠道发送通知。

        返回:
            {"telegram": True, "email": False, ...} — 每个渠道的发送结果
        """
        results: dict[str, bool] = {}

        for channel in channels:
            sender = self._senders.get(channel)
            if sender is None:
                results[channel] = False
                continue
            try:
                results[channel] = await sender.send(
                    recipient=recipient,
                    title=title,
                    body=body,
                    severity=severity,
                )
            except Exception:
                results[channel] = False

        return results

    def register_sender(self, channel: str, sender: BaseNotificationSender):
        """注册自定义渠道发送器"""
        self._senders[channel] = sender


# ================================================================
# 全局单例
# ================================================================
notification_dispatcher = NotificationDispatcher()
