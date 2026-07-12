"""
FastAPI 依赖注入
================
认证依赖、权限校验、数据库会话等可复用依赖。
"""

from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_main_db
from app.core.security import decode_token

# Bearer Token 提取器
bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> str:
    """
    解析 JWT Token 获取当前用户 ID。
    未登录返回 HTTP 401。
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = decode_token(credentials.credentials)
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        return user_id
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


async def get_optional_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> Optional[str]:
    """
    可选认证 — 如果提供了 Token 就解析，否则返回 None。
    用于既可登录也可匿名访问的端点。
    """
    if credentials is None:
        return None

    try:
        payload = decode_token(credentials.credentials)
        return payload.get("sub")
    except ValueError:
        return None


# ============================================================
# 权限校验（RBAC）
# ============================================================
class PermissionChecker:
    """权限校验器 — 按角色/权限点校验用户"""

    def __init__(self, required_roles: list[str]):
        self.required_roles = required_roles

    async def __call__(
        self,
        user_id: str = Depends(get_current_user_id),
        db: AsyncSession = Depends(get_main_db),
    ) -> str:
        """
        校验当前用户是否拥有所需角色。

        从 user_roles + roles 表联合查询用户角色，
        比对 required_roles 列表。
        """
        from app.models.user import User

        # 查询用户及其角色
        stmt = select(User).where(User.id == user_id)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()

        if user is None:
            raise HTTPException(status_code=401, detail="用户不存在")

        user_roles = {r.name for r in (user.roles or [])}

        for required in self.required_roles:
            if required in user_roles:
                return user_id

        raise HTTPException(
            status_code=403,
            detail=f"需要以下角色之一: {', '.join(self.required_roles)}",
        )


# 常用权限依赖快捷方式
require_admin = PermissionChecker(["admin"])
require_advanced_user = PermissionChecker(["advanced_user"])
require_reviewer = PermissionChecker(["strategy_reviewer"])
