"""
实盘交易 API
============
模块五：API Key 管理、手动下单（市价/限价/止损）、订单追踪与撤单、持仓管理、交易日志查询。
"""

from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_main_db
from app.core.deps import get_current_user_id
from app.schemas.base import APIResponse, PaginatedData, PaginatedResponse
from app.services.trading_service import TradingService

router = APIRouter()


# ============================================================
# API Key 管理
# ============================================================

@router.post(
    "/api-keys",
    response_model=APIResponse,
    status_code=201,
    summary="绑定 API Key",
    description="""TRADE-002: 绑定交易所 API Key（AES-256-GCM 加密存储）。

支持交易所：binance / okx / bybit / gateio。
OKX 需要额外提供 passphrase。
    """,
)
async def bind_api_key(
    exchange: str = Query(..., description="交易所: binance/okx/bybit/gateio"),
    label: str = Query(..., description="备注名称"),
    access_key: str = Query(..., description="交易所 Access Key"),
    secret_key: str = Query(..., description="交易所 Secret Key"),
    passphrase: Optional[str] = Query(None, description="OKX Passphrase（可选）"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    key = await TradingService(db, user_id).bind_api_key(
        exchange, label, access_key, secret_key, passphrase,
    )
    return APIResponse(code=201, message="API Key 已绑定", data={"id": str(key.id)})


@router.get(
    "/api-keys",
    response_model=PaginatedResponse,
    summary="API Key 列表",
    description="TRADE-002: 查看当前用户已绑定的所有 API Key。",
)
async def list_api_keys(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    keys = await TradingService(db, user_id).list_api_keys()
    return PaginatedResponse(data=PaginatedData(
        items=[{
            "id": str(k.id),
            "exchange": k.exchange,
            "label": k.label,
            "created_at": k.created_at.isoformat(),
        } for k in keys],
        total=len(keys), page=1, page_size=100, total_pages=1,
    ))


@router.delete(
    "/api-keys/{key_id}",
    response_model=APIResponse,
    summary="删除 API Key",
    description="TRADE-002: 删除已绑定的 API Key（同时删除关联的加密凭证）。",
)
async def delete_api_key(
    key_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    await TradingService(db, user_id).delete_api_key(key_id)
    return APIResponse(message="API Key 已删除")


# ============================================================
# 订单管理
# ============================================================

@router.post(
    "/orders",
    response_model=APIResponse,
    status_code=201,
    summary="创建订单",
    description="""TRADE-007: 手动创建交易订单。

- **side**: buy / sell
- **order_type**: market / limit / stop_market / stop_limit
- **amount**: 基础币数量
- **price**: 限价单需提供价格
- **leverage**: 合约杠杆倍数（可选）
    """,
)
async def create_order(
    api_key_id: str = Query(..., description="使用的 API Key ID"),
    symbol: str = Query(..., description="交易对，如 BTCUSDT"),
    side: str = Query(..., description="方向: buy/sell"),
    order_type: str = Query("market", description="类型: market/limit/stop_market/stop_limit"),
    amount: Decimal = Query(..., description="下单数量（基础币）"),
    price: Optional[Decimal] = Query(None, description="限价（市价单为空）"),
    leverage: Optional[int] = Query(None, description="杠杆倍数"),
    strategy_id: Optional[str] = Query(None, description="关联策略 ID"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    order = await TradingService(db, user_id).create_order(
        strategy_id, api_key_id, symbol, side, order_type, amount, price, leverage,
    )
    return APIResponse(
        code=201, message="订单已创建",
        data={"id": str(order.id), "status": order.status},
    )


@router.get(
    "/orders",
    response_model=PaginatedResponse,
    summary="订单列表",
    description="TRADE-009: 查看订单列表，支持按状态筛选和分页。",
)
async def list_orders(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页条数"),
    status: Optional[str] = Query(None, description="按状态筛选: created/submitted/partially_filled/filled/cancelled/expired/rejected"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    orders, total = await TradingService(db, user_id).list_orders(page, page_size, status)
    total_pages = max(1, (total + page_size - 1) // page_size)
    return PaginatedResponse(data=PaginatedData(
        items=[{
            "id": str(o.id),
            "symbol": o.symbol,
            "side": o.side,
            "type": o.order_type,
            "amount": float(o.amount),
            "price": float(o.price) if o.price else None,
            "status": o.status,
            "created_at": o.created_at.isoformat(),
        } for o in orders],
        total=total, page=page, page_size=page_size, total_pages=total_pages,
    ))


@router.post(
    "/orders/{order_id}/submit",
    response_model=APIResponse,
    summary="提交订单到交易所",
    description="""TRADE-006: 将已创建的订单（status=created）提交到交易所执行。

执行前自动进行风控检查。提交成功后订单状态变为 submitted，exchange_order_id 更新。
    """,
)
async def submit_order(
    order_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    try:
        svc = TradingService(db, user_id)
        order = await svc.submit_order(order_id)
        return APIResponse(
            message="订单已提交",
            data={
                "id": str(order.id),
                "exchange_order_id": order.exchange_order_id,
                "status": order.status,
            },
        )
    except Exception as e:
        return APIResponse(success=False, code=500, message=f"提交失败: {e}")


@router.delete(
    "/orders/{order_id}",
    response_model=APIResponse,
    summary="撤销订单",
    description="TRADE-010: 撤销指定订单（仅限未成交或部分成交）。",
)
async def cancel_order(
    order_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    await TradingService(db, user_id).cancel_order(order_id)
    return APIResponse(message="订单已撤销")


# ============================================================
# 持仓 & 日志
# ============================================================

@router.get(
    "/positions",
    response_model=PaginatedResponse,
    summary="持仓列表",
    description="TRADE-014: 查看当前用户的所有持仓（含未实现盈亏）。",
)
async def list_positions(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    positions = await TradingService(db, user_id).list_positions()
    return PaginatedResponse(data=PaginatedData(
        items=[{
            "id": str(p.id),
            "symbol": p.symbol,
            "side": p.side,
            "amount": float(p.amount),
            "entry_price": float(p.entry_price),
            "unrealized_pnl": float(p.unrealized_pnl) if p.unrealized_pnl else None,
        } for p in positions],
        total=len(positions), page=1, page_size=100, total_pages=1,
    ))


@router.get(
    "/logs",
    response_model=PaginatedResponse,
    summary="交易日志",
    description="TRADE-024: 查看已成交的交易日志，支持按交易对和策略筛选。",
)
async def list_trade_logs(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页条数"),
    symbol: Optional[str] = Query(None, description="按交易对筛选"),
    strategy_id: Optional[str] = Query(None, description="按策略 ID 筛选"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_main_db),
):
    logs, total = await TradingService(db, user_id).list_trade_logs(
        page, page_size, symbol, strategy_id,
    )
    total_pages = max(1, (total + page_size - 1) // page_size)
    return PaginatedResponse(data=PaginatedData(
        items=[{
            "id": str(l.id),
            "symbol": l.symbol,
            "side": l.side,
            "amount": float(l.amount),
            "price": float(l.avg_fill_price) if l.avg_fill_price else None,
            "commission": float(l.commission) if l.commission else 0,
            "created_at": l.created_at.isoformat(),
        } for l in logs],
        total=total, page=page, page_size=page_size, total_pages=total_pages,
    ))
