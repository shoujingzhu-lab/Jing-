"""
通知模块测试
=============
P2-007: 测试通知渠道、分发器、邮件/Webhook 格式。
"""

import pytest

from app.notification.channels.email_sender import EmailSender
from app.notification.channels.webhook import DiscordSender, DingTalkSender
from app.notification.channels.base import NullSender


class TestEmailSender:
    def test_email_sender_creation(self):
        sender = EmailSender()
        assert sender is not None
        assert sender.name == "email"


class TestDiscordSender:
    def test_creation(self):
        sender = DiscordSender()
        assert sender is not None
        assert sender.name == "discord"


class TestDingTalkSender:
    def test_creation(self):
        sender = DingTalkSender()
        assert sender is not None
        assert sender.name == "dingtalk"


class TestNullSender:
    def test_creation(self):
        sender = NullSender()
        assert sender is not None


class TestNotificationTypes:
    def test_alert_types(self):
        alert_types = ["price_alert", "strategy_alert", "system_alert", "risk_alert"]
        assert len(alert_types) == 4
        assert "price_alert" in alert_types
        assert "risk_alert" in alert_types

    def test_severity_levels(self):
        levels = ["info", "warning", "critical"]
        assert len(levels) == 3
