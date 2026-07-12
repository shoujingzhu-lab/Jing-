"""
模拟交易 API
============
模块四：模拟账户 CRUD、资金管理、暂停/恢复、交易记录、实盘准入检查、模拟引擎控制。
"""

from decimal import Decimal
from typing import TYPE_CHECKING

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_main_db
from app.core.deps import get_current_user_id
from app.schemas.base import APIResponse, PaginatedData, PaginatedResponse
from app.services.simulation import SimulationService

if TYPE_CHECKING:
    from app.engine.simulation import SimulationEngine

router = APIRouter()


@router.post(
    "/accounts",
    response_model=APIResponse,
    status_code=201,
    summary="创建模拟账户",
    description="""SIM-001: 创建模拟交易账户。

- **name**: 账户名称
- **account_type**: spot（现货）/ perpetual（永续合约）
- **initial_capital**: 初始资金（USDT），默认 10,000
    """,
)
async def create_sim_account(
    name: str = Query(..., description="账户名称"),
    account_type: str = Query("spot", description="账户类型: spot/perpetual"),
    initial_capital: Decimal = Query(10000, gt=0, description="初始资金（USDT）"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    svc = SimulationService(db, user_id)
    acct = await svc.create_account(name, account_type, initial_capital)
    return APIResponse(code=201, message="模拟账户已创建", data={
        "id": str(acct.id),
        "name": acct.name,
    })


@router.get(
    "/accounts",
    response_model=PaginatedResponse,
    summary="模拟账户列表",
    description="SIM-003: 查看当前用户的所有模拟账户（含净值/运行状态）。",
)
async def list_sim_accounts(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    svc = SimulationService(db, user_id)
    accounts = await svc.list_accounts()
    return PaginatedResponse(data=PaginatedData(
        items=[{
            "id": str(a.id),
            "name": a.name,
            "type": a.account_type,
            "equity": float(a.current_equity),
            "is_running": a.is_running,
            "created_at": a.created_at.isoformat(),
        } for a in accounts],
        total=len(accounts), page=1, page_size=100, total_pages=1,
    ))


@router.get(
    "/accounts/{account_id}",
    response_model=APIResponse,
    summary="模拟账户详情",
    description="SIM-003: 查看指定模拟账户的详细信息。",
)
async def get_sim_account(
    account_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    svc = SimulationService(db, user_id)
    a = await svc.get_account(account_id)
    return APIResponse(data={
        "id": str(a.id),
        "name": a.name,
        "type": a.account_type,
        "initial_capital": float(a.initial_capital),
        "equity": float(a.current_equity),
        "available_cash": float(a.available_cash),
        "is_running": a.is_running,
    })


@router.post(
    "/accounts/{account_id}/reset",
    response_model=APIResponse,
    summary="重置模拟账户",
    description="SIM-002: 重置模拟账户至初始状态（清零所有持仓和交易记录）。",
)
async def reset_sim_account(
    account_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    await SimulationService(db, user_id).reset_account(account_id)
    return APIResponse(message="账户已重置")


@router.delete(
    "/accounts/{account_id}",
    response_model=APIResponse,
    summary="删除模拟账户",
    description="SIM-002: 删除指定模拟账户及其所有关联数据。",
)
async def delete_sim_account(
    account_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    await SimulationService(db, user_id).delete_account(account_id)
    return APIResponse(message="账户已删除")


@router.post(
    "/accounts/{account_id}/pause",
    response_model=APIResponse,
    summary="暂停模拟",
    description="SIM-009: 暂停指定模拟账户的策略运行。",
)
async def pause_simulation(
    account_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    await SimulationService(db, user_id).pause(account_id)
    return APIResponse(message="已暂停")


@router.post(
    "/accounts/{account_id}/resume",
    response_model=APIResponse,
    summary="恢复模拟",
    description="SIM-009: 恢复指定模拟账户的策略运行。",
)
async def resume_simulation(
    account_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    await SimulationService(db, user_id).resume(account_id)
    return APIResponse(message="已恢复")


@router.get(
    "/accounts/{account_id}/trades",
    response_model=PaginatedResponse,
    summary="模拟交易记录",
    description="SIM-011: 查看模拟账户的交易记录（分页）。",
)
async def list_sim_trades(
    account_id: str,
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页条数"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    svc = SimulationService(db, user_id)
    trades, total = await svc.list_trades(account_id, page, page_size)
    total_pages = max(1, (total + page_size - 1) // page_size)
    return PaginatedResponse(data=PaginatedData(
        items=[{
            "id": str(t.id),
            "symbol": t.symbol,
            "side": t.side,
            "price": float(t.price),
            "amount": float(t.amount),
            "pnl": float(t.pnl) if t.pnl else None,
            "time": t.created_at.isoformat(),
        } for t in trades],
        total=total, page=page, page_size=page_size, total_pages=total_pages,
    ))


@router.get(
    "/accounts/{account_id}/live-readiness",
    response_model=APIResponse,
    summary="实盘准入检查",
    description="""SIM-012: 检查模拟账户是否满足实盘交易准入条件。

准入标准：
- 模拟运行 ≥ 30 天
- 夏普比率 ≥ 1.0
- 最大回撤 ≤ 30%
- 胜率 ≥ 40%
- 累计收益率 > 0
    """,
)
async def check_live_readiness(
    account_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    svc = SimulationService(db, user_id)
    result = await svc.check_live_readiness(account_id)
    return APIResponse(data=result)


# ============================================================
# 模拟引擎控制
# ============================================================

# 内存中的引擎实例（生产环境应使用 Redis 等外部存储）
_active_engines: dict[str, "SimulationEngine"] = {}


@router.post(
    "/accounts/{account_id}/start",
    response_model=APIResponse,
    summary="启动模拟交易",
    description="""SIM-005: 在指定模拟账户上启动策略模拟运行。

要求提供策略定义（JSON 节点图）和运行参数（交易对/交易所/K线周期）。
引擎将在后台异步运行，使用实时行情驱动策略执行。
    """,
)
async def start_simulation(
    account_id: str,
    strategy_id: str = Query(..., description="策略 ID"),
    symbol: str = Query("BTCUSDT", description="交易对"),
    exchange: str = Query("binance", description="交易所"),
    kline_interval: str = Query("1h", description="K线周期: 1m/5m/15m/1h/4h/1d"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    # 获取策略定义
    from app.services.strategy import StrategyService
    import json

    strategy_svc = StrategyService(db, user_id)
    strategy = await strategy_svc.get(strategy_id)
    definition = json.loads(strategy.definition) if isinstance(strategy.definition, str) else strategy.definition

    svc = SimulationService(db, user_id)
    engine = await svc.start_engine(
        account_id=account_id,
        strategy_id=strategy_id,
        strategy_definition=definition,
        symbol=symbol,
        exchange=exchange,
        kline_interval=kline_interval,
    )
    _active_engines[account_id] = engine

    return APIResponse(
        message=f"模拟引擎已启动（{symbol} {kline_interval}）",
        data=engine.status,
    )


@router.post(
    "/accounts/{account_id}/stop",
    response_model=APIResponse,
    summary="停止模拟交易",
    description="SIM-009: 停止指定账户的模拟策略运行。",
)
async def stop_simulation(
    account_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    engine = _active_engines.pop(account_id, None)
    svc = SimulationService(db, user_id)
    await svc.stop_engine(account_id, engine)
    return APIResponse(message="模拟引擎已停止")


@router.get(
    "/accounts/{account_id}/status",
    response_model=APIResponse,
    summary="模拟引擎状态",
    description="查看模拟账户的策略运行状态和统计。",
)
async def get_simulation_status(
    account_id: str,
    user_id: str = Depends(get_current_user_id),
):
    engine = _active_engines.get(account_id)
    if engine is None:
        return APIResponse(data={"running": False, "message": "无活跃模拟引擎"})
    return APIResponse(data=engine.status)
