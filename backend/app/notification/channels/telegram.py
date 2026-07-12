"""
Telegram 通知渠道
=================
通过 Telegram Bot API 发送消息。
"""

import httpx

from app.core.config import settings
from app.notification.channels.base import BaseNotificationSender


class TelegramSender(BaseNotificationSender):
    """Telegram Bot 发送器"""

    name = "telegram"

    def __init__(self, bot_token: str = "", default_chat_id: str = ""):
        super().__init__(cooldown_seconds=1.0)
        self.bot_token = bot_token or settings.TELEGRAM_BOT_TOKEN or ""
        self.default_chat_id = default_chat_id or settings.TELEGRAM_DEFAULT_CHAT_ID or ""

    async def send(
        self,
        recipient: str = "",
        title: str = "",
        body: str = "",
        severity: str = "info",
    ) -> bool:
        if not self.bot_token:
            return False

        chat_id = recipient or self.default_chat_id
        if not chat_id:
            return False

        # 构建消息文本
        severity_emoji = {"info": "ℹ️", "warning": "⚠️", "critical": "🚨", "error": "❌"}
        emoji = severity_emoji.get(severity, "📢")
        text = f"{emoji} *{title}*\n\n{body}"

        url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, json={
                    "chat_id": chat_id,
                    "text": text,
                    "parse_mode": "Markdown",
                    "disable_web_page_preview": True,
                })
                return resp.status_code == 200
        except Exception:
            return False
