"""
数据中心 API
============
模块一完整实现：行情查询、聚合、历史下载、数据导出。

符号格式: 支持 BTC/USDT, BTC-USDT, BTC_USDT, BTCUSDT
- path 参数: /ticker/okx/BTC-USDT（用 "-" 替代 "/"）
- query 参数: /ticker/okx?symbol=BTC/USDT（支持 "/" 符号）
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import PlainTextResponse

from app.adapters.base import BaseExchangeAdapter
from app.core.deps import get_current_user_id, get_optional_user_id
from app.core.logging import get_logger
from app.schemas.base import APIResponse
from app.services.market_data import market_data_service

logger = get_logger("data_api")
router = APIRouter()


def _norm(symbol: str) -> str:
    """将 URL 安全的交易对格式转为 CCXT 标准格式 (BTC/USDT)。
    支持: BTC-USDT, BTC_USDT, BTCUSDT, BTC/USDT.
    """
    return BaseExchangeAdapter.normalize_symbol(symbol)


# ============================================================
# 公开行情接口（无需认证）
# ============================================================

@router.get("/exchanges", response_model=APIResponse)
async def list_exchanges():
    """DATA-001: 查看支持的交易所和行情源（公开接口）"""
    return APIResponse(
        data={
            "exchanges": [
                {"name": "binance", "products": ["spot", "usdm_futures", "coin_futures"]},
                {"name": "okx", "products": ["spot", "perpetual", "futures"]},
                {"name": "bybit", "products": ["spot", "perpetual"]},
                {"name": "gateio", "products": ["spot", "perpetual"]},
            ]
        }
    )


# --- Ticker（两个路由：path param + query param） ---

@router.get("/ticker/{exchange}/{symbol}", response_model=APIResponse)
async def get_ticker_path(
    exchange: str,
    symbol: str,
    user_id: Optional[str] = Depends(get_optional_user_id),
):
    """DATA-002: 获取实时行情 — path 参数（symbol 中用 - 替代 /）"""
    return await _get_ticker(exchange, symbol)


@router.get("/ticker/{exchange}", response_model=APIResponse)
async def get_ticker_query(
    exchange: str,
    symbol: str = Query(..., description="交易对，如 BTC/USDT 或 BTC-USDT"),
    user_id: Optional[str] = Depends(get_optional_user_id),
):
    """DATA-002: 获取实时行情 — query 参数（支持 BTC/USDT）"""
    return await _get_ticker(exchange, symbol)


async def _get_ticker(exchange: str, symbol: str):
    sym = _norm(symbol)
    try:
        ticker = await market_data_service.get_ticker(exchange, sym)
        return APIResponse(data=ticker)
    except Exception as e:
        logger.error(f"Ticker 获取失败 exchange={exchange} symbol={sym}: {e}")
        return APIResponse(success=False, code=502, message=f"行情获取失败: {e}")


# --- Orderbook ---

@router.get("/orderbook/{exchange}/{symbol}", response_model=APIResponse)
async def get_orderbook_path(
    exchange: str,
    symbol: str,
    depth: int = Query(20, ge=1, le=100),
    user_id: Optional[str] = Depends(get_optional_user_id),
):
    """DATA-002: 获取订单簿深度 — path 参数"""
    return await _get_orderbook(exchange, symbol, depth)


@router.get("/orderbook/{exchange}", response_model=APIResponse)
async def get_orderbook_query(
    exchange: str,
    symbol: str = Query(..., description="交易对"),
    depth: int = Query(20, ge=1, le=100),
    user_id: Optional[str] = Depends(get_optional_user_id),
):
    """DATA-002: 获取订单簿深度 — query 参数"""
    return await _get_orderbook(exchange, symbol, depth)


async def _get_orderbook(exchange: str, symbol: str, depth: int):
    sym = _norm(symbol)
    try:
        ob = await market_data_service.get_orderbook(exchange, sym, depth)
        return APIResponse(data=ob)
    except Exception as e:
        logger.error(f"Orderbook 获取失败 exchange={exchange} symbol={sym}: {e}")
        return APIResponse(success=False, code=502, message=f"订单簿获取失败: {e}")


# --- Klines ---

@router.get("/klines/{exchange}/{symbol}", response_model=APIResponse)
async def get_klines_path(
    exchange: str,
    symbol: str,
    interval: str = Query("1h", description="K线周期: 1m/5m/15m/1h/4h/1d"),
    limit: int = Query(500, ge=1, le=1000),
    user_id: Optional[str] = Depends(get_optional_user_id),
):
    """获取 K 线历史数据 — path 参数"""
    return await _get_klines(exchange, symbol, interval, limit)


@router.get("/klines/{exchange}", response_model=APIResponse)
async def get_klines_query(
    exchange: str,
    symbol: str = Query(..., description="交易对"),
    interval: str = Query("1h", description="K线周期: 1m/5m/15m/1h/4h/1d"),
    limit: int = Query(500, ge=1, le=1000),
    user_id: Optional[str] = Depends(get_optional_user_id),
):
    """获取 K 线历史数据 — query 参数"""
    return await _get_klines(exchange, symbol, interval, limit)


async def _get_klines(exchange: str, symbol: str, interval: str, limit: int):
    sym = _norm(symbol)
    try:
        klines = await market_data_service.get_klines(exchange, sym, interval, limit)
        return APIResponse(data={"bars": klines, "count": len(klines)})
    except Exception as e:
        logger.error(f"K线 获取失败 exchange={exchange} symbol={sym}: {e}")
        return APIResponse(success=False, code=502, message=f"K线获取失败: {e}")


# --- Funding Rate ---

@router.get("/funding-rate/{exchange}/{symbol}", response_model=APIResponse)
async def get_funding_rate_path(
    exchange: str,
    symbol: str,
    user_id: Optional[str] = Depends(get_optional_user_id),
):
    """DATA-009: 获取当前资金费率 — path 参数"""
    return await _get_funding_rate(exchange, symbol)


@router.get("/funding-rate/{exchange}", response_model=APIResponse)
async def get_funding_rate_query(
    exchange: str,
    symbol: str = Query(..., description="交易对"),
    user_id: Optional[str] = Depends(get_optional_user_id),
):
    """DATA-009: 获取当前资金费率 — query 参数"""
    return await _get_funding_rate(exchange, symbol)


async def _get_funding_rate(exchange: str, symbol: str):
    sym = _norm(symbol)
    try:
        fr = await market_data_service.get_funding_rate(exchange, sym)
        return APIResponse(data=fr)
    except Exception as e:
        logger.error(f"资金费率 获取失败 exchange={exchange} symbol={sym}: {e}")
        return APIResponse(success=False, code=502, message=f"资金费率获取失败: {e}")


# --- Aggregated ---

@router.get("/aggregated/{symbol}", response_model=APIResponse)
async def get_aggregated(
    symbol: str,
    user_id: Optional[str] = Depends(get_optional_user_id),
):
    """DATA-003: 多交易所行情聚合（公开接口）— 最优买卖价 + 跨所价差"""
    sym = _norm(symbol)
    result = await market_data_service.get_aggregated_ticker(sym)
    return APIResponse(data=result)


@router.post("/download", response_model=APIResponse)
async def download_history(
    exchange: str = Query(..., description="交易所"),
    symbol: str = Query(..., description="交易对"),
    interval: str = Query("1h", description="K线周期"),
    start_date: datetime = Query(..., description="开始时间 ISO8601"),
    end_date: datetime = Query(..., description="结束时间 ISO8601"),
    format: str = Query("json", description="导出格式: json | csv"),
    user_id: str = Depends(get_current_user_id),
):
    """DATA-004: 下载历史数据"""
    bars = await market_data_service.download_history(
        exchange, symbol, interval, start_date, end_date,
    )

    if format == "csv":
        csv_lines = ["open_time,open,high,low,close,volume"]
        for bar in bars:
            csv_lines.append(
                f"{bar['open_time']},{bar['open']},{bar['high']},{bar['low']},"
                f"{bar['close']},{bar['volume']}"
            )
        return PlainTextResponse(
            content="\n".join(csv_lines),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={symbol}_{interval}.csv"},
        )

    return APIResponse(
        message=f"下载完成（{len(bars)} 条数据）",
        data={"symbol": symbol, "interval": interval, "bars": bars, "count": len(bars)},
    )
