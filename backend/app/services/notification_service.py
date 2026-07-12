"""
通知与告警服务
==============
模块十：告警规则、通知推送、渠道管理。
"""

import json
from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification, NotificationRule, UserNotificationPreference
from app.repositories import BaseRepository


class NotificationService:
    def __init__(self, db: AsyncSession, user_id: str):
        self.db = db
        self.user_id = user_id
        self.rule_repo = BaseRepository(db, NotificationRule)
        self.notif_repo = BaseRepository(db, Notification)
        self.pref_repo = BaseRepository(db, UserNotificationPreference)

    async def create_rule(self, rule_type: str, name: str, conditions: dict,
                          channels: list[str], strategy_id: Optional[str] = None) -> NotificationRule:
        return await self.rule_repo.create(
            user_id=self.user_id, strategy_id=strategy_id, rule_type=rule_type,
            name=name, conditions=json.dumps(conditions),
            channels=json.dumps(channels),
        )

    async def list_rules(self) -> list[NotificationRule]:
        stmt = select(NotificationRule).where(
            NotificationRule.user_id == self.user_id,
            NotificationRule.is_enabled == True,
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def update_rule(self, rule_id: str, **kwargs):
        await self.rule_repo.update(UUID(rule_id), **kwargs)

    async def delete_rule(self, rule_id: str):
        await self.rule_repo.update(UUID(rule_id), is_enabled=False)

    async def list_messages(self, page: int = 1, page_size: int = 20,
                            category: Optional[str] = None, unread_only: bool = False):
        from sqlalchemy import func
        filters = [Notification.user_id == self.user_id]
        if category:
            filters.append(Notification.category == category)
        if unread_only:
            filters.append(Notification.is_read == False)
        count_stmt = select(func.count()).select_from(Notification).where(*filters)
        total = await self.db.scalar(count_stmt) or 0
        stmt = select(Notification).where(*filters).order_by(Notification.created_at.desc()).offset((page-1)*page_size).limit(page_size)
        result = await self.db.execute(stmt)
        return list(result.scalars().all()), total

    async def mark_as_read(self, message_id: str):
        await self.notif_repo.update(UUID(message_id), is_read=True, read_at=datetime.utcnow())

    async def mark_all_read(self):
        stmt = select(Notification).where(
            Notification.user_id == self.user_id,
            Notification.is_read == False,
        )
        result = await self.db.execute(stmt)
        for n in result.scalars().all():
            await self.notif_repo.update(n.id, is_read=True, read_at=datetime.utcnow())

    async def get_preferences(self) -> dict:
        stmt = select(UserNotificationPreference).where(
            UserNotificationPreference.user_id == self.user_id)
        result = await self.db.execute(stmt)
        pref = result.scalar_one_or_none()
        return json.loads(pref.preferences) if pref else {"default_channels": ["in_app"]}

    async def update_preferences(self, preferences: dict):
        stmt = select(UserNotificationPreference).where(
            UserNotificationPreference.user_id == self.user_id)
        result = await self.db.execute(stmt)
        existing = result.scalar_one_or_none()
        if existing:
            await self.pref_repo.update(existing.id, preferences=json.dumps(preferences))
        else:
            await self.pref_repo.create(
                user_id=self.user_id, preferences=json.dumps(preferences),
            )

    async def send_notification(
        self,
        title: str,
        body: str,
        category: str,
        severity: str = "info",
        channels: Optional[list[str]] = None,
    ):
        """
        发送通知（DB 记录 + 实时渠道推送）。

        参数:
            channels: 目标渠道列表，默认 ["in_app"]。支持: in_app, telegram, email, discord, dingtalk
        """
        channel_list = channels or ["in_app"]

        # 1. 写入 DB（in_app 消息）
        if "in_app" in channel_list:
            await self.notif_repo.create(
                user_id=self.user_id, title=title, body=body,
                category=category, severity=severity, channel="in_app",
            )

        # 2. 分发到外部渠道
        external = [c for c in channel_list if c != "in_app"]
        if external:
            from app.notification.dispatcher import notification_dispatcher
            from app.ws.manager import ws_manager

            # 外部渠道推送
            await notification_dispatcher.dispatch(
                channels=external,
                recipient=self.user_id,
                title=title,
                body=body,
                severity=severity,
            )

            # WebSocket 实时推送
            await ws_manager.send_to_user(
                self.user_id,
                {"title": title, "body": body, "category": category, "severity": severity},
                event_type="notification",
            )
