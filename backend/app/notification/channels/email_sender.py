"""
Email 通知渠道
==============
通过 SMTP 发送邮件通知。
"""

import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.core.config import settings
from app.notification.channels.base import BaseNotificationSender


class EmailSender(BaseNotificationSender):
    """SMTP 邮件发送器"""

    name = "email"

    def __init__(self):
        super().__init__(cooldown_seconds=5.0)

    async def send(
        self,
        recipient: str = "",
        title: str = "",
        body: str = "",
        severity: str = "info",
    ) -> bool:
        if not all([settings.SMTP_HOST, settings.SMTP_USER, settings.SMTP_PASSWORD]):
            return False

        to_email = recipient or settings.SMTP_USER
        if not to_email:
            return False

        # 构建邮件
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"[{severity.upper()}] {title}"
        msg["From"] = settings.SMTP_FROM
        msg["To"] = to_email

        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif;">
            <h2 style="color: {"#e74c3c" if severity == "critical" else "#f39c12" if severity == "warning" else "#3498db"}">
                {title}
            </h2>
            <p>{body}</p>
            <hr>
            <p style="color: #888; font-size: 12px;">
                Sent by {settings.APP_NAME} Notification System
            </p>
        </body>
        </html>
        """
        msg.attach(MIMEText(html_body, "html"))

        # 发送
        try:
            context = ssl.create_default_context()
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                server.ehlo()
                server.starttls(context=context)
                server.ehlo()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_FROM, to_email, msg.as_string())
            return True
        except Exception:
            return False
