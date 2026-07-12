"""
用户与权限模型
==============
对应需求模块八：用户与权限管理
- USER-001 ~ USER-009
"""

from datetime import datetime
from typing import Optional

import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Table, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin


# ============================================================
# 用户角色关联表（多对多）
# ============================================================
user_roles = Table(
    "user_roles",
    Base.metadata,
    Column("user_id", UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("role_id", UUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
)


class User(Base, UUIDMixin, TimestampMixin):
    """用户表 (USER-001 ~ USER-005)"""

    __tablename__ = "users"

    # 基本信息
    email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True, comment="邮箱"
    )
    phone: Mapped[Optional[str]] = mapped_column(
        String(20), unique=True, nullable=True, comment="手机号"
    )
    username: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False, index=True, comment="用户名"
    )
    hashed_password: Mapped[str] = mapped_column(
        String(255), nullable=False, comment="bcrypt 哈希密码"
    )

    # 安全
    is_active: Mapped[bool] = mapped_column(
        default=True, nullable=False, comment="账户是否启用"
    )
    is_verified: Mapped[bool] = mapped_column(
        default=False, nullable=False, comment="邮箱/手机是否已验证"
    )
    totp_secret: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True, comment="TOTP 二步验证密钥"
    )
    totp_enabled: Mapped[bool] = mapped_column(
        default=False, nullable=False, comment="是否已启用 2FA"
    )

    # 登录保护
    failed_login_attempts: Mapped[int] = mapped_column(
        default=0, nullable=False, comment="连续登录失败次数"
    )
    locked_until: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="锁定截止时间"
    )
    last_login_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="上次登录时间"
    )
    last_login_ip: Mapped[Optional[str]] = mapped_column(
        String(45), nullable=True, comment="上次登录 IP"
    )

    # 关联
    roles: Mapped[list["Role"]] = relationship(
        secondary=user_roles, back_populates="users", lazy="selectin"
    )
    api_keys: Mapped[list["ApiKey"]] = relationship(
        back_populates="user", lazy="selectin", cascade="all, delete-orphan"
    )
    strategies: Mapped[list["Strategy"]] = relationship(
        back_populates="user", lazy="selectin", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<User {self.username} ({self.email})>"


class Role(Base, UUIDMixin, TimestampMixin):
    """角色表 (USER-006)"""

    __tablename__ = "roles"

    name: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False, comment="角色名称"
    )
    description: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True, comment="角色描述"
    )
    permissions: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="权限点列表 (JSON)"
    )

    users: Mapped[list["User"]] = relationship(
        secondary=user_roles, back_populates="roles", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<Role {self.name}>"


class Session(Base, UUIDMixin):
    """用户会话表 (USER-004)"""

    __tablename__ = "user_sessions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True, comment="关联用户 ID"
    )
    refresh_token: Mapped[str] = mapped_column(
        String(500), unique=True, nullable=False, comment="Refresh Token"
    )
    device_info: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True, comment="设备信息 (User-Agent)"
    )
    ip_address: Mapped[Optional[str]] = mapped_column(
        String(45), nullable=True, comment="登录 IP"
    )
    is_active: Mapped[bool] = mapped_column(
        default=True, nullable=False, comment="会话是否有效"
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, comment="过期时间"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", nullable=False
    )

    def __repr__(self) -> str:
        return f"<Session {self.id[:8]}...>"


class AuditLog(Base, UUIDMixin):
    """操作审计日志 (USER-008 ~ USER-009)"""

    __tablename__ = "audit_logs"

    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True, comment="操作用户 ID"
    )
    username: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, comment="操作用户名"
    )
    action: Mapped[str] = mapped_column(
        String(200), nullable=False, index=True, comment="操作类型"
    )
    resource: Mapped[Optional[str]] = mapped_column(
        String(200), nullable=True, comment="操作资源"
    )
    detail: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="操作详情 (JSON)"
    )
    ip_address: Mapped[Optional[str]] = mapped_column(
        String(45), nullable=True, comment="操作 IP"
    )
    user_agent: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True, comment="User-Agent"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", nullable=False, index=True
    )

    def __repr__(self) -> str:
        return f"<AuditLog {self.action} by {self.username}>"
