"""
用户管理 API
============
模块八：个人资料查看、密码修改、审计日志查询。
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_main_db
from app.core.deps import get_current_user_id
from app.schemas.base import APIResponse, PaginatedData, PaginatedResponse
from app.services.auth import AuthService

router = APIRouter()


@router.get(
    "/me",
    response_model=APIResponse,
    summary="查看个人信息",
    description="获取当前登录用户的个人资料（用户名/邮箱/注册时间/2FA状态）。",
)
async def get_current_user(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    user = await AuthService(db).get_user(user_id)
    if user is None:
        return APIResponse(success=False, code=404, message="用户不存在")
    return APIResponse(data={
        "id": str(user.id),
        "username": user.username,
        "email": user.email,
        "is_verified": user.is_verified,
        "totp_enabled": user.totp_enabled,
        "created_at": user.created_at.isoformat(),
    })


@router.put(
    "/me/password",
    response_model=APIResponse,
    summary="修改密码",
    description="验证旧密码后更新为新密码。新密码至少 8 个字符。",
)
async def change_password(
    old_password: str = Query(..., description="当前密码"),
    new_password: str = Query(..., min_length=8, description="新密码（≥8字符）"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    try:
        await AuthService(db).change_password(user_id, old_password, new_password)
        return APIResponse(message="密码已修改")
    except ValueError as e:
        return APIResponse(success=False, code=400, message=str(e))


@router.get(
    "/audit-logs",
    response_model=PaginatedResponse,
    summary="审计日志",
    description="USER-009: 查看当前用户的操作审计日志，支持按操作类型筛选。",
)
async def list_audit_logs(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页条数"),
    action: str = Query(None, description="按操作类型筛选"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    logs, total = await AuthService(db).list_audit_logs(
        page, page_size, user_id=user_id, action=action,
    )
    total_pages = max(1, (total + page_size - 1) // page_size)
    return PaginatedResponse(data=PaginatedData(
        items=[{
            "id": str(l.id),
            "action": l.action,
            "resource": l.resource,
            "detail": l.detail,
            "ip": l.ip_address,
            "created_at": l.created_at.isoformat(),
        } for l in logs],
        total=total, page=page, page_size=page_size, total_pages=total_pages,
    ))
