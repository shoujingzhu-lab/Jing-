"""
Webhook 通知渠道
================
Discord / DingTalk 通过 Webhook URL 发送消息。
"""

import httpx

from app.notification.channels.base import BaseNotificationSender


class DiscordSender(BaseNotificationSender):
    """Discord Webhook 发送器"""

    name = "discord"

    def __init__(self, webhook_url: str = ""):
        super().__init__(cooldown_seconds=2.0)
        self.webhook_url = webhook_url

    async def send(
        self,
        recipient: str = "",
        title: str = "",
        body: str = "",
        severity: str = "info",
    ) -> bool:
        url = recipient or self.webhook_url
        if not url:
            return False

        severity_colors = {"info": 3447003, "warning": 16705372, "critical": 15548997, "error": 15158332}
        color = severity_colors.get(severity, 0)

        payload = {
            "embeds": [{
                "title": title,
                "description": body,
                "color": color,
                "timestamp": "",
            }]
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, json=payload)
                return resp.status_code in (200, 204)
        except Exception:
            return False


class DingTalkSender(BaseNotificationSender):
    """钉钉机器人 Webhook 发送器"""

    name = "dingtalk"

    def __init__(self, webhook_url: str = ""):
        super().__init__(cooldown_seconds=2.0)
        self.webhook_url = webhook_url

    async def send(
        self,
        recipient: str = "",
        title: str = "",
        body: str = "",
        severity: str = "info",
    ) -> bool:
        url = recipient or self.webhook_url
        if not url:
            return False

        payload = {
            "msgtype": "markdown",
            "markdown": {
                "title": title,
                "text": f"## {title}\n\n{body}\n\n> 发送自 {severity} 级别告警",
            },
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, json=payload)
                result = resp.json()
                return result.get("errcode") == 0
        except Exception:
            return False
