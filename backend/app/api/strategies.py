"""
策略引擎 API
============
模块二完整实现：CRUD、版本管理、克隆、代码导出、模板库。
"""

from typing import Optional

from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_main_db
from app.core.deps import get_current_user_id
from app.schemas.base import APIResponse, PaginatedData, PaginatedResponse
from app.schemas.strategy import (
    StrategyCloneRequest,
    StrategyCreate,
    StrategyExportCodeResponse,
    StrategyListResponse,
    StrategyResponse,
    StrategyUpdate,
    StrategyVersionResponse,
)
from app.services.strategy import (
    StrategyService,
)

router = APIRouter()


# ============================================================
# 策略 CRUD
# ============================================================

@router.get(
    "/",
    response_model=PaginatedResponse[StrategyListResponse],
    summary="策略列表",
)
async def list_strategies(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页条数"),
    status: Optional[str] = Query(
        None, description="按状态筛选 (draft/backtested/simulated/live/paused/archived)"
    ),
    strategy_type: Optional[str] = Query(
        None, description="按类型筛选 (visual/python)"
    ),
    search: Optional[str] = Query(
        None, max_length=100, description="搜索策略名称"
    ),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    """STG-018: 查看当前用户的策略列表，支持分页/筛选/搜索。"""
    service = StrategyService(db, user_id)
    items, total = await service.list_by_user(
        page=page,
        page_size=page_size,
        status=status,
        strategy_type=strategy_type,
        search=search,
    )
    total_pages = max(1, (total + page_size - 1) // page_size)
    return PaginatedResponse(
        data=PaginatedData(
            items=[StrategyListResponse.model_validate(s) for s in items],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        ),
    )


@router.post(
    "/",
    response_model=APIResponse[StrategyResponse],
    status_code=201,
    summary="创建策略",
)
async def create_strategy(
    data: StrategyCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    """STG-001: 创建新策略。

    - visual 类型需要提供有效的节点图 JSON
    - python 类型直接存储代码字符串
    """
    service = StrategyService(db, user_id)
    strategy = await service.create(data)
    return APIResponse(
        code=201,
        message="策略创建成功",
        data=StrategyResponse.model_validate(strategy),
    )


@router.get(
    "/templates",
    response_model=APIResponse[list[StrategyListResponse]],
    summary="策略模板库",
)
async def list_templates(
    db: AsyncSession = Depends(get_main_db),
    user_id: str = Depends(get_current_user_id),
):
    """STG-007: 获取 15+ 个系统内置策略模板。"""
    service = StrategyService(db, user_id)
    templates = await service.list_templates()
    return APIResponse(
        message=f"共 {len(templates)} 个模板",
        data=[StrategyListResponse.model_validate(t) for t in templates],
    )


@router.get(
    "/{strategy_id}",
    response_model=APIResponse[StrategyResponse],
    summary="策略详情",
)
async def get_strategy(
    strategy_id: str = Path(..., description="策略 UUID"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    """获取策略完整详情（含 definition）。"""
    service = StrategyService(db, user_id)
    strategy = await service.get(strategy_id)
    return APIResponse(data=StrategyResponse.model_validate(strategy))


@router.put(
    "/{strategy_id}",
    response_model=APIResponse[StrategyResponse],
    summary="更新策略",
)
async def update_strategy(
    data: StrategyUpdate,
    strategy_id: str = Path(..., description="策略 UUID"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    """STG-008/015: 更新策略。

    - definition 变更时自动生成新版本记录
    - status 变更时校验合法状态转换
    """
    service = StrategyService(db, user_id)
    strategy = await service.update(strategy_id, data)
    return APIResponse(
        message=f"策略已更新至 v{strategy.version}",
        data=StrategyResponse.model_validate(strategy),
    )


@router.delete(
    "/{strategy_id}",
    response_model=APIResponse,
    summary="删除策略",
)
async def delete_strategy(
    strategy_id: str = Path(..., description="策略 UUID"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    """软删除策略（标记 is_deleted=True）。"""
    service = StrategyService(db, user_id)
    await service.soft_delete(strategy_id)
    return APIResponse(message=f"策略 {strategy_id} 已删除")


# ============================================================
# 克隆
# ============================================================

@router.post(
    "/{strategy_id}/clone",
    response_model=APIResponse[StrategyResponse],
    status_code=201,
    summary="克隆策略",
)
async def clone_strategy(
    data: Optional[StrategyCloneRequest] = None,
    strategy_id: str = Path(..., description="源策略 UUID"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    """STG-007: 从模板或已有策略克隆。

    源策略可以是自己的策略或系统模板。
    """
    clone_data = data or StrategyCloneRequest()
    service = StrategyService(db, user_id)
    strategy = await service.clone(strategy_id, clone_data.name)
    return APIResponse(
        code=201,
        message=f"已克隆为 '{strategy.name}'",
        data=StrategyResponse.model_validate(strategy),
    )


# ============================================================
# 版本管理
# ============================================================

@router.get(
    "/{strategy_id}/versions",
    response_model=PaginatedResponse[StrategyVersionResponse],
    summary="版本历史",
)
async def list_versions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    strategy_id: str = Path(..., description="策略 UUID"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    """STG-015: 查看策略的版本历史记录。"""
    service = StrategyService(db, user_id)
    items, total = await service.list_versions(strategy_id, page, page_size)
    total_pages = max(1, (total + page_size - 1) // page_size)
    return PaginatedResponse(
        data=PaginatedData(
            items=[StrategyVersionResponse.model_validate(v) for v in items],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        ),
    )


@router.post(
    "/{strategy_id}/versions/{version}/rollback",
    response_model=APIResponse[StrategyResponse],
    summary="版本回滚",
)
async def rollback_version(
    strategy_id: str = Path(..., description="策略 UUID"),
    version: int = Path(..., ge=1, description="目标版本号"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    """STG-017: 将策略回滚到指定历史版本。

    回滚会创建一个新版本（记录回滚操作），而非删除中间版本。
    """
    service = StrategyService(db, user_id)
    strategy = await service.rollback(strategy_id, version)
    return APIResponse(
        message=f"已回滚至 v{version}（当前版本: v{strategy.version}）",
        data=StrategyResponse.model_validate(strategy),
    )


# ============================================================
# 代码导出
# ============================================================

@router.post(
    "/{strategy_id}/export-code",
    response_model=APIResponse[StrategyExportCodeResponse],
    summary="导出 Python 代码",
)
async def export_to_code(
    strategy_id: str = Path(..., description="策略 UUID"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    """STG-014: 将可视化策略导出为可执行的 Python 代码。

    仅支持 strategy_type='visual' 的策略。
    """
    service = StrategyService(db, user_id)
    result = await service.export_code(strategy_id)
    return APIResponse(
        message="代码已生成",
        data=result,
    )
