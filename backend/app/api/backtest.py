"""
回测系统 API
============
模块三完整实现：任务管理、报告查询、参数优化。
"""

from typing import Optional

from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_main_db
from app.core.deps import get_current_user_id
from app.schemas.base import APIResponse, PaginatedData, PaginatedResponse
from app.schemas.backtest import (
    BacktestCreate,
    BacktestResultResponse,
    BacktestTaskResponse,
    ParameterOptimizationCreate,
    ParameterOptimizationResponse,
)
from app.services.backtest import BacktestService

router = APIRouter()


# ============================================================
# 回测任务
# ============================================================
@router.post(
    "/",
    response_model=APIResponse[BacktestTaskResponse],
    status_code=201,
    summary="创建回测任务",
    description="""BACK-001: 创建单策略回测任务。

支持配置：回测时间范围、初始资金、撮合模式、手续费率、滑点、杠杆、现货/合约模式等。
创建后任务进入 pending 状态，由后台引擎拾取执行。
    """,
)
async def create_backtest(
    data: BacktestCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    service = BacktestService(db, user_id)
    task = await service.create_task(data)
    return APIResponse(
        code=201, message="回测任务已创建（待执行）",
        data=BacktestTaskResponse.model_validate(task),
    )


@router.get(
    "/",
    response_model=PaginatedResponse[BacktestTaskResponse],
    summary="回测任务列表",
    description="BACK-004: 查看回测任务历史，支持按状态筛选和分页。",
)
async def list_backtests(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页条数"),
    status: Optional[str] = Query(None, description="按状态筛选: pending/running/completed/failed/cancelled"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    service = BacktestService(db, user_id)
    items, total = await service.list_tasks(page, page_size, status)
    total_pages = max(1, (total + page_size - 1) // page_size)
    return PaginatedResponse(
        data=PaginatedData(
            items=[BacktestTaskResponse.model_validate(t) for t in items],
            total=total, page=page, page_size=page_size, total_pages=total_pages,
        ),
    )


@router.get(
    "/{task_id}",
    response_model=APIResponse[BacktestTaskResponse],
    summary="回测任务详情",
    description="BACK-002: 查看回测任务的实时进度和状态。progress 字段返回 0~100 的完成百分比。",
)
async def get_backtest(
    task_id: str = Path(..., description="回测任务 ID"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    service = BacktestService(db, user_id)
    task = await service.get_task(task_id)
    return APIResponse(data=BacktestTaskResponse.model_validate(task))


@router.post(
    "/{task_id}/cancel",
    response_model=APIResponse,
    summary="取消回测任务",
    description="取消 pending 或 running 状态的回测任务。已完成/已失败的任务不可取消。",
)
async def cancel_backtest(
    task_id: str = Path(..., description="回测任务 ID"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    service = BacktestService(db, user_id)
    await service.cancel_task(task_id)
    return APIResponse(message=f"回测任务 {task_id} 已取消")


@router.get(
    "/{task_id}/report",
    response_model=APIResponse[BacktestResultResponse],
    summary="回测报告",
    description="""BACK-011~017: 获取完整回测报告。

报告内容：
- **核心指标**：累计/年化收益率、夏普比率、最大回撤、卡玛比率、胜率、盈亏比、平均持仓时间
- **图表数据**：净值曲线、回撤曲线、日收益、月度热力图
- **交易明细**：逐笔记录（时间/方向/价格/数量/手续费/盈亏）
- **基准对比**：相对 BTC 持有的超额收益、Beta、信息比率
    """,
)
async def get_report(
    task_id: str = Path(..., description="回测任务 ID"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    service = BacktestService(db, user_id)
    result = await service.get_result(task_id)
    if result is None:
        return APIResponse(message="回测尚未完成或无结果")

    resp = BacktestResultResponse.model_validate(result)

    # 反序列化 JSON 字段
    if result.equity_curve:
        import json
        resp.equity_curve = json.loads(result.equity_curve)
    if result.drawdown_curve:
        import json
        resp.drawdown_curve = json.loads(result.drawdown_curve)
    if result.daily_returns:
        import json
        resp.daily_returns = json.loads(result.daily_returns)
    if result.trades:
        import json
        resp.trades = json.loads(result.trades)

    return APIResponse(data=resp)


# ============================================================
# 参数优化
# ============================================================
@router.post(
    "/optimize",
    response_model=APIResponse[ParameterOptimizationResponse],
    status_code=201,
    summary="创建参数优化",
    description="""BACK-018~022: 创建参数优化任务。

支持的优化方法：网格搜索（grid_search）、贝叶斯优化（bayesian）、遗传算法（genetic）。

需指定参数搜索空间（每个参数的 min/max/step）和目标函数（夏普比率/总收益/卡玛比率等）。
    """,
)
async def create_optimization(
    data: ParameterOptimizationCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    service = BacktestService(db, user_id)
    task = await service.create_optimization(data)
    return APIResponse(
        code=201,
        message=f"参数优化任务已创建（{task.total_combinations} 个组合）",
        data=ParameterOptimizationResponse.model_validate(task),
    )


@router.get(
    "/optimize",
    response_model=PaginatedResponse[ParameterOptimizationResponse],
    summary="参数优化历史",
)
async def list_optimizations(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    """查看参数优化任务列表。"""
    service = BacktestService(db, user_id)
    items, total = await service.list_optimizations(page, page_size)
    total_pages = max(1, (total + page_size - 1) // page_size)
    return PaginatedResponse(
        data=PaginatedData(
            items=[ParameterOptimizationResponse.model_validate(t) for t in items],
            total=total, page=page, page_size=page_size, total_pages=total_pages,
        ),
    )


@router.get(
    "/optimize/{task_id}",
    response_model=APIResponse[ParameterOptimizationResponse],
    summary="参数优化详情",
)
async def get_optimization(
    task_id: str = Path(...),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    """查看参数优化任务详情和结果。"""
    service = BacktestService(db, user_id)
    task = await service.get_optimization(task_id)
    resp = ParameterOptimizationResponse.model_validate(task)
    if task.all_results:
        import json
        resp.all_results = json.loads(task.all_results)
    if task.best_params:
        import json
        resp.best_params = json.loads(task.best_params)
    return APIResponse(data=resp)
