"""
认证 API — 注册/登录/2FA/会话
============================
模块八：用户注册、JWT 登录、登出、会话管理。
"""

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_main_db
from app.core.deps import get_current_user_id
from app.schemas.base import APIResponse
from app.services.auth import AuthService

router = APIRouter()


class RegisterRequest(BaseModel):
    """USER-001: 注册请求"""
    email: str = Field(..., description="邮箱地址", examples=["user@example.com"])
    username: str = Field(..., min_length=2, max_length=50, description="用户名", examples=["trader01"])
    password: str = Field(..., min_length=8, max_length=128, description="密码（8-128字符）", examples=["SecureP@ss1"])


class LoginRequest(BaseModel):
    """USER-002: 登录请求"""
    email: str = Field(..., description="注册邮箱", examples=["user@example.com"])
    password: str = Field(..., description="登录密码", examples=["SecureP@ss1"])


@router.post(
    "/register",
    response_model=APIResponse,
    status_code=201,
    summary="用户注册",
    description="""USER-001: 创建新账号。

- 邮箱作为唯一标识
- 密码使用 bcrypt 哈希存储
- 注册成功返回用户 ID
    """,
)
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_main_db)):
    svc = AuthService(db)
    try:
        user = await svc.register(data.email, data.username, data.password)
        return APIResponse(code=201, message="注册成功", data={"user_id": str(user.id)})
    except ValueError as e:
        return APIResponse(success=False, code=400, message=str(e))


@router.post(
    "/login",
    response_model=APIResponse,
    summary="用户登录",
    description="""USER-002: 邮箱+密码登录，返回 JWT 令牌对。

- access_token: 访问令牌（默认 60 分钟有效）
- refresh_token: 刷新令牌（30 天有效）
- 登录失败 5 次后账户临时锁定
    """,
)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_main_db)):
    svc = AuthService(db)
    try:
        result = await svc.login(data.email, data.password)
        return APIResponse(message="登录成功", data=result)
    except ValueError as e:
        return APIResponse(success=False, code=401, message=str(e))


@router.post(
    "/refresh",
    response_model=APIResponse,
    summary="刷新令牌",
    description="USER-002: 用有效的 refresh_token 换取新的 access_token，无需重新登录。",
)
async def refresh_token(
    refresh_token: str = Query(..., description="有效的刷新令牌"),
    db: AsyncSession = Depends(get_main_db),
):
    try:
        result = await AuthService(db).refresh_token(refresh_token)
        return APIResponse(message="令牌已刷新", data=result)
    except ValueError as e:
        return APIResponse(success=False, code=401, message=str(e))


@router.post(
    "/logout",
    response_model=APIResponse,
    summary="用户登出",
    description="USER-004: 使指定的 refresh_token 失效，后续无法用该令牌刷新。",
)
async def logout(
    refresh_token: str = Query(..., description="要失效的刷新令牌"),
    db: AsyncSession = Depends(get_main_db),
):
    await AuthService(db).logout(refresh_token)
    return APIResponse(message="已登出")


@router.get(
    "/sessions",
    response_model=APIResponse,
    summary="查看活跃会话",
    description="USER-004: 查看当前用户的所有活跃登录会话（设备/IP/登录时间）。",
)
async def list_sessions(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    sessions = await AuthService(db).list_sessions(user_id)
    return APIResponse(data=[{
        "id": str(s.id),
        "device": s.device_info,
        "ip": s.ip_address,
        "created_at": s.created_at.isoformat(),
    } for s in sessions])


@router.delete(
    "/sessions/{session_id}",
    response_model=APIResponse,
    summary="踢出会话",
    description="USER-004: 强制使指定会话失效（远程登出）。",
)
async def revoke_session(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    await AuthService(db).revoke_session(session_id)
    return APIResponse(message="会话已失效")
