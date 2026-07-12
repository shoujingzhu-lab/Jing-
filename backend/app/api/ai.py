"""
智能分析决策 API
================
模块七：策略健康度评估、市场状态分类、策略-市场适配、关联分析、参数建议、资金分配。
"""

from fastapi import APIRouter, Depends, Query

from app.core.deps import get_current_user_id
from app.schemas.base import APIResponse
from app.services.ai_service import AIService

router = APIRouter()


@router.get(
    "/strategies/{strategy_id}/health-score",
    response_model=APIResponse,
    summary="策略健康度评分",
    description="""AI-001: 评估指定策略的综合健康度。

返回指标包括：夏普比率、最大回撤、胜率、盈亏比、过拟合风险评分等。
    """,
)
async def get_health_score(
    strategy_id: str,
    user_id: str = Depends(get_current_user_id),
):
    result = await AIService(user_id).compute_health_score(strategy_id)
    return APIResponse(data=result)


@router.get(
    "/strategies/{strategy_id}/overfit-risk",
    response_model=APIResponse,
    summary="过拟合风险检测",
    description="""AI-002: 检测策略是否过拟合。

通过样本内/样本外表现对比、参数敏感性分析判断过拟合风险。
    """,
)
async def get_overfit_risk(
    strategy_id: str,
    user_id: str = Depends(get_current_user_id),
):
    result = await AIService(user_id).detect_overfitting(strategy_id)
    return APIResponse(data=result)


@router.get(
    "/market/state",
    response_model=APIResponse,
    summary="市场状态分类",
    description="""AI-006: 对当前市场状态进行分类。

分类维度：趋势强度、波动率水平、成交量活跃度、市场情绪。
    """,
)
async def get_market_state(user_id: str = Depends(get_current_user_id)):
    result = await AIService(user_id).classify_market_state()
    return APIResponse(data=result)


@router.get(
    "/strategies/{strategy_id}/market-fit",
    response_model=APIResponse,
    summary="策略-市场适配矩阵",
    description="""AI-007: 评估策略在不同市场状态下的适配程度。

返回各市场状态下策略的预期表现评分。
    """,
)
async def get_strategy_market_fit(
    strategy_id: str,
    user_id: str = Depends(get_current_user_id),
):
    result = await AIService(user_id).get_strategy_market_fit(strategy_id)
    return APIResponse(data=result)


@router.get(
    "/strategies/{strategy_id}/param-suggestions",
    response_model=APIResponse,
    summary="参数优化建议",
    description="""AI-011: 基于历史数据为策略参数提供优化建议。

分析参数敏感性并推荐最优参数组合。
    """,
)
async def get_param_suggestions(
    strategy_id: str,
    user_id: str = Depends(get_current_user_id),
):
    result = await AIService(user_id).generate_param_suggestions(strategy_id)
    return APIResponse(data=result)


@router.get(
    "/market/correlation",
    response_model=APIResponse,
    summary="山寨币关联分析",
    description="""AI-009: 获取主流山寨币与 BTC 的相关性矩阵。

用于评估分散化投资效果和系统性风险。
    """,
)
async def get_correlation(user_id: str = Depends(get_current_user_id)):
    result = await AIService(user_id).get_correlation_matrix()
    return APIResponse(data=result)


@router.get(
    "/portfolio/allocation",
    response_model=APIResponse,
    summary="资金分配建议",
    description="""AI-014: 基于策略历史表现提供多策略资金分配建议。

参数 `strategy_ids` 为逗号分隔的策略 ID 列表。
    """,
)
async def get_allocation(
    strategy_ids: str = Query("", description="逗号分隔的策略 ID 列表"),
    user_id: str = Depends(get_current_user_id),
):
    ids = [s.strip() for s in strategy_ids.split(",") if s.strip()]
    result = await AIService(user_id).get_allocation_suggestion(ids)
    return APIResponse(data=result)
