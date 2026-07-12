"""
基础模型 Mixins
==============
提供所有 ORM 模型共用的字段与行为。
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column


class UUIDMixin:
    """UUID 主键 Mixin"""
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        comment="主键 UUID",
    )


class TimestampMixin:
    """创建/更新时间戳 Mixin"""
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="创建时间",
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        comment="更新时间",
    )


class SoftDeleteMixin:
    """软删除 Mixin"""
    is_deleted: Mapped[bool] = mapped_column(
        default=False,
        nullable=False,
        comment="是否已删除（软删除标记）",
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="删除时间",
    )


class AuditMixin(UUIDMixin, TimestampMixin):
    """审计字段组合 — 大部分业务表继承此基类"""
    pass
