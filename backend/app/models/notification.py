"""
通知与告警模型
==============
对应需求模块十：通知与告警
- NOTI-001 ~ NOTI-009
"""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class NotificationRule(Base, UUIDMixin, TimestampMixin):
    """告警规则 (NOTI-001 ~ NOTI-003)"""

    __tablename__ = "notification_rules"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True, comment="用户 ID"
    )
    strategy_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True, comment="策略 ID（空=系统级/价格告警）"
    )
    rule_type: Mapped[str] = mapped_column(
        String(30), nullable=False,
        comment="规则类型: strategy_alert | system_alert | price_alert",
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False, comment="规则名称")
    conditions: Mapped[str] = mapped_column(Text, nullable=False, comment="触发条件 (JSON)")
    channels: Mapped[str] = mapped_column(
        String(500), nullable=False,
        comment="通知渠道 (JSON): ['in_app','email','telegram','discord','dingtalk']",
    )
    cooldown_seconds: Mapped[int] = mapped_column(
        default=300, nullable=False, comment="冷却时间（秒），防止频繁通知"
    )
    is_enabled: Mapped[bool] = mapped_column(default=True, nullable=False)


class Notification(Base, UUIDMixin):
    """通知记录 (NOTI-004)"""

    __tablename__ = "notifications"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True, comment="接收用户 ID"
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False, comment="通知标题")
    body: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="通知正文")
    category: Mapped[str] = mapped_column(
        String(30), nullable=False, index=True,
        comment="分类: strategy | system | price | risk | account | general",
    )
    severity: Mapped[str] = mapped_column(
        String(20), default="info", comment="严重程度: info | warning | error | critical"
    )
    channel: Mapped[str] = mapped_column(
        String(30), nullable=False,
        comment="送达渠道: in_app | email | telegram | discord | dingtalk",
    )
    is_read: Mapped[bool] = mapped_column(default=False, nullable=False, index=True)
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", nullable=False, index=True
    )


class UserNotificationPreference(Base, UUIDMixin, TimestampMixin):
    """用户通知偏好 (NOTI-009)"""

    __tablename__ = "user_notification_preferences"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, unique=True, index=True
    )
    preferences: Mapped[str] = mapped_column(
        Text, nullable=False,
        comment="通知偏好 (JSON): {category: {channels: [...], quiet_hours: {...}}}",
    )
