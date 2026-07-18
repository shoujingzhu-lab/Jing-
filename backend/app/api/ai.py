"""
智能分析决策 API
================
模块七：策略健康度评估、市场状态分类、策略-市场适配、关联分析、参数建议、资金分配。
所有分析基于真实数据源（DB 回测结果 + 实时交易所行情）。
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user_id
from app.core.database import get_main_db
from app.schemas.base import APIResponse
from app.services.ai_service import AIService

router = APIRouter()


@router.get(
    "/strategies/{strategy_id}/health-score",
    response_model=APIResponse,
    summary="策略健康度评分",
    description="""AI-001: 评估指定策略的综合健康度。

基于数据库中最近一次回测的真实指标计算：夏普比率、最大回撤、胜率、盈亏比、交易次数等。
如策略尚未运行回测，将返回提示信息。
    """,
)
async def get_health_score(
    strategy_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    result = await AIService(db, user_id).compute_health_score(strategy_id)
    return APIResponse(data=result)


@router.get(
    "/strategies/{strategy_id}/overfit-risk",
    response_model=APIResponse,
    summary="过拟合风险检测",
    description="""AI-002: 检测策略是否过拟合。

优先使用参数优化结果的样本内外对比，其次使用多次回测的趋势分析。
    """,
)
async def get_overfit_risk(
    strategy_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    result = await AIService(db, user_id).detect_overfitting(strategy_id)
    return APIResponse(data=result)


@router.get(
    "/market/state",
    response_model=APIResponse,
    summary="市场状态分类",
    description="""AI-006: 对当前市场状态进行分类。

从 Binance 获取 BTCUSDT 实时行情，基于真实涨跌幅、波动率和资金费率进行市场状态识别。
    """,
)
async def get_market_state(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    result = await AIService(db, user_id).classify_market_state()
    return APIResponse(data=result)


@router.get(
    "/strategies/{strategy_id}/market-fit",
    response_model=APIResponse,
    summary="策略-市场适配矩阵",
    description="""AI-007: 评估策略在不同市场状态下的适配程度。

基于策略真实回测指标推导各市场状态下的预期表现，结合当前市场状态给出建议。
    """,
)
async def get_strategy_market_fit(
    strategy_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    result = await AIService(db, user_id).get_strategy_market_fit(strategy_id)
    return APIResponse(data=result)


@router.get(
    "/strategies/{strategy_id}/param-suggestions",
    response_model=APIResponse,
    summary="参数优化建议",
    description="""AI-011: 基于历史回测数据为策略参数提供优化建议。

优先使用参数优化任务的最优结果，其次分析多次回测的趋势变化给出调参建议。
    """,
)
async def get_param_suggestions(
    strategy_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    result = await AIService(db, user_id).generate_param_suggestions(strategy_id)
    return APIResponse(data=result)


@router.get(
    "/market/correlation",
    response_model=APIResponse,
    summary="山寨币关联分析",
    description="""AI-009: 获取主流山寨币与 BTC 的相关性矩阵。

基于 Binance 最近 7 天 1 小时 K 线真实数据计算皮尔逊相关系数。
    """,
)
async def get_correlation(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    result = await AIService(db, user_id).get_correlation_matrix()
    return APIResponse(data=result)


@router.get(
    "/portfolio/allocation",
    response_model=APIResponse,
    summary="资金分配建议",
    description="""AI-014: 基于策略历史表现提供多策略资金分配建议。

使用风险平价方法，从各策略真实回测波动率计算权重分配。
参数 `strategy_ids` 为逗号分隔的策略 ID 列表。
    """,
)
async def get_allocation(
    strategy_ids: str = Query("", description="逗号分隔的策略 ID 列表"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    ids = [s.strip() for s in strategy_ids.split(",") if s.strip()]
    result = await AIService(db, user_id).get_allocation_suggestion(ids)
    return APIResponse(data=result)
