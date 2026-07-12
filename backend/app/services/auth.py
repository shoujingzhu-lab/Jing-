"""
认证与用户服务
==============
模块八：注册、登录、2FA、会话管理、RBAC。
"""

import uuid
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, create_refresh_token, hash_password, verify_password
from app.models.user import AuditLog, Role, Session, User
from app.repositories import BaseRepository


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.user_repo = BaseRepository(db, User)
        self.session_repo = BaseRepository(db, Session)

    async def register(self, email: str, username: str, password: str) -> User:
        stmt = select(User).where((User.email == email) | (User.username == username))
        result = await self.db.execute(stmt)
        existing = result.scalar_one_or_none()
        if existing:
            raise ValueError("邮箱或用户名已被注册")

        return await self.user_repo.create(
            email=email, username=username,
            hashed_password=hash_password(password),
        )

    async def login(self, email: str, password: str, ip_address: Optional[str] = None,
                    device_info: Optional[str] = None) -> dict:
        stmt = select(User).where(User.email == email)
        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()

        if user is None or not verify_password(password, user.hashed_password):
            # 登录失败：递增失败计数
            if user is not None:
                attempts = user.failed_login_attempts + 1
                locked = datetime.utcnow() + timedelta(minutes=30) if attempts >= 5 else None
                await self.user_repo.update(
                    user.id,
                    failed_login_attempts=attempts,
                    locked_until=locked,
                )
            raise ValueError("邮箱或密码错误")

        if not user.is_active:
            raise ValueError("账户已被禁用")

        if user.locked_until and user.locked_until > datetime.utcnow():
            raise ValueError("账户已被临时锁定，请稍后再试")

        # 生成 Tokens
        access = create_access_token(str(user.id))
        refresh = create_refresh_token(str(user.id))

        # 创建会话
        await self.session_repo.create(
            user_id=str(user.id), refresh_token=refresh,
            device_info=device_info, ip_address=ip_address,
            is_active=True, expires_at=datetime.utcnow() + timedelta(days=30),
        )

        # 更新登录记录
        await self.user_repo.update(
            user.id,
            last_login_at=datetime.utcnow(),
            last_login_ip=ip_address,
            failed_login_attempts=0,
        )

        return {
            "access_token": access,
            "refresh_token": refresh,
            "user": {"id": str(user.id), "username": user.username, "email": user.email},
        }

    async def refresh_token(self, refresh_token: str) -> dict:
        """用 refresh_token 换取新的 access_token"""
        stmt = select(Session).where(
            Session.refresh_token == refresh_token,
            Session.is_active == True,
        )
        result = await self.db.execute(stmt)
        session = result.scalar_one_or_none()
        if session is None:
            raise ValueError("无效或已过期的刷新令牌")
        if session.expires_at and session.expires_at < datetime.utcnow():
            raise ValueError("刷新令牌已过期")

        # 生成新的 access token
        new_access = create_access_token(str(session.user_id))
        return {"access_token": new_access}

    async def logout(self, refresh_token: str):
        stmt = select(Session).where(Session.refresh_token == refresh_token)
        result = await self.db.execute(stmt)
        session = result.scalar_one_or_none()
        if session:
            await self.session_repo.update(session.id, is_active=False)

    async def list_sessions(self, user_id: str) -> list[Session]:
        stmt = select(Session).where(Session.user_id == user_id, Session.is_active == True)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def revoke_session(self, session_id: str):
        await self.session_repo.update(UUID(session_id), is_active=False)

    async def get_user(self, user_id: str) -> Optional[User]:
        return await self.user_repo.get(UUID(user_id))

    async def change_password(self, user_id: str, old_password: str, new_password: str):
        user = await self.user_repo.get(UUID(user_id))
        if user is None or not verify_password(old_password, user.hashed_password):
            raise ValueError("原密码错误")
        await self.user_repo.update(UUID(user_id), hashed_password=hash_password(new_password))

    async def log_audit(self, user_id: Optional[str], username: Optional[str],
                        action: str, resource: Optional[str] = None, detail: Optional[str] = None,
                        ip_address: Optional[str] = None, user_agent: Optional[str] = None):
        audit = AuditLog(
            user_id=user_id, username=username, action=action,
            resource=resource, detail=detail, ip_address=ip_address, user_agent=user_agent,
        )
        self.db.add(audit)
        await self.db.flush()

    async def list_audit_logs(self, page: int = 1, page_size: int = 20,
                              user_id: Optional[str] = None, action: Optional[str] = None):
        from sqlalchemy import func
        filters = []
        if user_id:
            filters.append(AuditLog.user_id == user_id)
        if action:
            filters.append(AuditLog.action == action)
        count_stmt = select(func.count()).select_from(AuditLog).where(*filters)
        total = await self.db.scalar(count_stmt) or 0
        stmt = select(AuditLog).where(*filters).order_by(AuditLog.created_at.desc()).offset((page-1)*page_size).limit(page_size)
        result = await self.db.execute(stmt)
        return list(result.scalars().all()), total
