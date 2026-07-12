"""
风险控制 API
============
模块六：风控规则 CRUD、熔断管理、风控事件日志、风控仪表盘、黑名单查询。
"""

import json

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_main_db
from app.core.deps import get_current_user_id
from app.schemas.base import APIResponse, PaginatedData, PaginatedResponse
from app.services.risk import RiskService

router = APIRouter()


@router.post(
    "/rules",
    response_model=APIResponse,
    status_code=201,
    summary="创建风控规则",
    description="""RISK-001~005: 创建一条风控规则。

- **scope**: 规则作用域 (global / strategy / position)
- **rule_type**: 规则类型 (stop_loss / take_profit / daily_loss_limit / max_drawdown / consecutive_loss)
- **params**: JSON 格式的规则参数
- **strategy_id**: 若 scope 为 strategy，指定目标策略 ID
    """,
)
async def create_rule(
    scope: str = Query(..., description="作用域: global/strategy/position"),
    rule_type: str = Query(..., description="规则类型: stop_loss/take_profit/daily_loss_limit/max_drawdown/consecutive_loss"),
    params: str = Query("{}", description="JSON 格式规则参数"),
    strategy_id: str = Query(None, description="绑定的策略 ID"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    rule = await RiskService(db, user_id).create_rule(
        scope, rule_type, json.loads(params), strategy_id,
    )
    return APIResponse(code=201, message="风控规则已创建", data={"id": str(rule.id)})


@router.get(
    "/rules",
    response_model=PaginatedResponse,
    summary="风控规则列表",
    description="RISK-001: 查看当前用户的所有风控规则。",
)
async def list_rules(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    rules = await RiskService(db, user_id).list_rules()
    return PaginatedResponse(data=PaginatedData(
        items=[{
            "id": str(r.id),
            "scope": r.scope,
            "rule_type": r.rule_type,
            "is_enabled": r.is_enabled,
        } for r in rules],
        total=len(rules), page=1, page_size=100, total_pages=1,
    ))


@router.delete(
    "/rules/{rule_id}",
    response_model=APIResponse,
    summary="删除风控规则",
    description="RISK-001: 删除指定风控规则。",
)
async def delete_rule(
    rule_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    await RiskService(db, user_id).delete_rule(rule_id)
    return APIResponse(message="规则已删除")


@router.get(
    "/circuit-breakers",
    response_model=APIResponse,
    summary="熔断器列表",
    description="RISK-010: 查看当前用户的所有熔断器状态。",
)
async def list_breakers(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    breakers = await RiskService(db, user_id).list_circuit_breakers()
    return APIResponse(data=[{
        "id": str(b.id),
        "reason": b.trigger_reason,
        "triggered_at": b.triggered_at.isoformat(),
    } for b in breakers])


@router.post(
    "/circuit-breakers/{breaker_id}/resolve",
    response_model=APIResponse,
    summary="解除熔断",
    description="RISK-011: 手动解除指定熔断器，恢复正常交易。",
)
async def resolve_breaker(
    breaker_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    await RiskService(db, user_id).resolve_breaker(breaker_id)
    return APIResponse(message="熔断已解除")


@router.get(
    "/dashboard",
    response_model=APIResponse,
    summary="风控仪表盘",
    description="RISK-014: 查看风控概览数据（规则数量、活跃熔断、近期事件）。",
)
async def risk_dashboard(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    data = await RiskService(db, user_id).get_dashboard()
    return APIResponse(data=data)


@router.get(
    "/events",
    response_model=PaginatedResponse,
    summary="风控事件日志",
    description="RISK-016: 查看风控事件历史（触发/恢复/熔断/解除）。",
)
async def list_events(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页条数"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    events, total = await RiskService(db, user_id).list_events(page, page_size)
    total_pages = max(1, (total + page_size - 1) // page_size)
    return PaginatedResponse(data=PaginatedData(
        items=[{
            "id": str(e.id),
            "type": e.event_type,
            "severity": e.severity,
            "detail": e.detail,
            "created_at": e.created_at.isoformat(),
        } for e in events],
        total=total, page=page, page_size=page_size, total_pages=total_pages,
    ))


@router.post(
    "/pre-check",
    response_model=APIResponse,
    summary="交易前风控检查",
    description="""对拟提交的订单执行 7 层风控检查链，不实际提交订单。

检查顺序：全局熔断 → 账户熔断 → 策略熔断 → 每日亏损限额 → 连续亏损限额 → 最大回撤 → 最大仓位 → 保证金 → 黑名单。

返回 `passed: true/false` 及拒绝原因。
    """,
)
async def pre_trade_check(
    strategy_id: str = Query(..., description="策略 ID"),
    symbol: str = Query(..., description="交易对"),
    side: str = Query("buy", description="方向: buy/sell"),
    amount: float = Query(..., gt=0, description="下单数量"),
    price: float = Query(None, description="限价"),
    leverage: int = Query(None, description="杠杆倍数"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    order = {
        "symbol": symbol,
        "side": side,
        "amount": amount,
        "price": price,
        "leverage": leverage,
    }
    svc = RiskService(db, user_id)
    passed, reason = await svc.run_pre_trade_check(strategy_id, order)
    return APIResponse(
        message="检查通过" if passed else reason,
        data={"passed": passed, "reason": reason},
    )


@router.post(
    "/check-position",
    response_model=APIResponse,
    summary="仓位风险检查",
    description="""检查单个仓位的风控状态（止损/止盈/移动止损/强平预警/保证金率）。

返回触发的风控动作列表（如有）。
    """,
)
async def check_position_risk(
    symbol: str = Query(..., description="交易对"),
    side: str = Query("long", description="方向: long/short"),
    entry_price: float = Query(..., description="开仓均价"),
    mark_price: float = Query(..., description="当前标记价格"),
    amount: float = Query(..., gt=0, description="持仓数量"),
    unrealized_pnl: float = Query(0, description="未实现盈亏"),
    liquidation_price: float = Query(0, description="强平价格"),
    leverage: int = Query(1, description="杠杆倍数"),
    margin_ratio: float = Query(1.0, description="保证金率"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    position = {
        "symbol": symbol,
        "side": side,
        "entry_price": entry_price,
        "mark_price": mark_price,
        "amount": amount,
        "unrealized_pnl": unrealized_pnl,
        "liquidation_price": liquidation_price,
        "leverage": leverage,
        "margin_ratio": margin_ratio,
    }
    svc = RiskService(db, user_id)
    actions = await svc.run_position_risk_check(position)
    return APIResponse(
        message=f"发现 {len(actions)} 个风控动作" if actions else "仓位安全",
        data={"actions": actions, "safe": len(actions) == 0},
    )


@router.get(
    "/blacklist",
    response_model=APIResponse,
    summary="黑名单交易对",
    description="RISK-012: 查看当前风控黑名单中的交易对。",
)
async def get_blacklist(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    bl = await RiskService(db, user_id).get_blacklist()
    return APIResponse(data=bl)
