"""
通知与告警 API
==============
模块十：告警规则 CRUD、站内消息（已读/未读/全部已读）、通知偏好设置。
"""

import json
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_main_db
from app.core.deps import get_current_user_id
from app.schemas.base import APIResponse, PaginatedData, PaginatedResponse
from app.services.notification_service import NotificationService

router = APIRouter()


@router.post(
    "/rules",
    response_model=APIResponse,
    status_code=201,
    summary="创建告警规则",
    description="""NOTI-001~003: 创建策略/系统/价格告警规则。

- **rule_type**: strategy_alert / system_alert / price_alert
- **conditions**: JSON 格式触发条件
- **channels**: JSON 数组，通知渠道 (in_app/email/telegram/discord)
    """,
)
async def create_alert_rule(
    rule_type: str = Query(..., description="告警类型: strategy_alert/system_alert/price_alert"),
    name: str = Query(..., description="规则名称"),
    conditions: str = Query("{}", description="JSON 格式触发条件"),
    channels: str = Query('["in_app"]', description="通知渠道 JSON 数组"),
    strategy_id: str = Query(None, description="绑定的策略 ID"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    rule = await NotificationService(db, user_id).create_rule(
        rule_type, name, json.loads(conditions), json.loads(channels), strategy_id,
    )
    return APIResponse(code=201, message="告警规则已创建", data={"id": str(rule.id)})


@router.get(
    "/rules",
    response_model=PaginatedResponse,
    summary="告警规则列表",
    description="NOTI-001: 查看当前用户的所有告警规则。",
)
async def list_rules(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    rules = await NotificationService(db, user_id).list_rules()
    return PaginatedResponse(data=PaginatedData(
        items=[{
            "id": str(r.id),
            "name": r.name,
            "type": r.rule_type,
            "enabled": r.is_enabled,
        } for r in rules],
        total=len(rules), page=1, page_size=100, total_pages=1,
    ))


@router.delete(
    "/rules/{rule_id}",
    response_model=APIResponse,
    summary="删除告警规则",
    description="NOTI-001: 删除指定告警规则。",
)
async def delete_rule(
    rule_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    await NotificationService(db, user_id).delete_rule(rule_id)
    return APIResponse(message="规则已删除")


@router.get(
    "/messages",
    response_model=PaginatedResponse,
    summary="站内消息列表",
    description="NOTI-004: 查看站内消息，支持按类别和已读/未读筛选。",
)
async def list_messages(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页条数"),
    category: Optional[str] = Query(None, description="消息类别筛选"),
    unread_only: bool = Query(False, description="仅显示未读"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    msgs, total = await NotificationService(db, user_id).list_messages(
        page, page_size, category, unread_only,
    )
    total_pages = max(1, (total + page_size - 1) // page_size)
    return PaginatedResponse(data=PaginatedData(
        items=[{
            "id": str(m.id),
            "title": m.title,
            "category": m.category,
            "severity": m.severity,
            "is_read": m.is_read,
            "channel": m.channel,
            "created_at": m.created_at.isoformat(),
        } for m in msgs],
        total=total, page=page, page_size=page_size, total_pages=total_pages,
    ))


@router.put(
    "/messages/{message_id}/read",
    response_model=APIResponse,
    summary="标记已读",
    description="NOTI-004: 将指定消息标记为已读。",
)
async def mark_read(
    message_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    await NotificationService(db, user_id).mark_as_read(message_id)
    return APIResponse(message="已标记为已读")


@router.post(
    "/messages/read-all",
    response_model=APIResponse,
    summary="全部已读",
    description="NOTI-004: 将当前用户的所有未读消息标记为已读。",
)
async def mark_all_read(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    await NotificationService(db, user_id).mark_all_read()
    return APIResponse(message="全部已读")


@router.get(
    "/preferences",
    response_model=APIResponse,
    summary="通知偏好",
    description="NOTI-009: 查看当前用户的通知偏好设置（渠道开关/免打扰时间等）。",
)
async def get_preferences(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    prefs = await NotificationService(db, user_id).get_preferences()
    return APIResponse(data=prefs)


@router.put(
    "/preferences",
    response_model=APIResponse,
    summary="更新通知偏好",
    description="NOTI-009: 更新当前用户的通知偏好设置。",
)
async def update_preferences(
    preferences: str = Query("{}", description="JSON 格式偏好配置"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    await NotificationService(db, user_id).update_preferences(json.loads(preferences))
    return APIResponse(message="偏好已更新")
