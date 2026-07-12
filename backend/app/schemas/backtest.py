"""
回测系统 Schema
===============
模块三：回测系统 — 请求/响应模型
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.base import KlineInterval


# ============================================================
# 请求模型
# ============================================================
class BacktestCreate(BaseModel):
    """BACK-001: 创建回测任务"""

    strategy_id: Optional[UUID] = Field(None, description="策略 ID（可选，可直接传 definition）")
    definition: Optional[dict] = Field(None, description="策略定义（不绑定策略时使用）")
    name: str = Field(..., min_length=1, max_length=200, examples=["EMA策略回测"])
    symbols: list[str] = Field(..., min_length=1, examples=[["BTCUSDT", "ETHUSDT"]])
    exchange: str = Field(default="binance", max_length=20)
    kline_interval: KlineInterval = Field(default=KlineInterval.HOUR_1)
    start_date: datetime = Field(..., description="回测开始时间")
    end_date: datetime = Field(..., description="回测结束时间")
    initial_capital: Decimal = Field(..., gt=0, examples=[10000], description="初始资金 USDT")
    commission_rate: float = Field(default=0.0004, ge=0, le=0.01, description="手续费率")
    slippage: float = Field(default=0.0005, ge=0, le=0.05, description="滑点")
    fill_mode: str = Field(
        default="next_open",
        description="撮合模式: next_open | close | limit | vwap | counterparty",
    )

    @field_validator("end_date")
    @classmethod
    def end_after_start(cls, v: datetime, info) -> datetime:
        if "start_date" in info.data and v <= info.data["start_date"]:
            raise ValueError("结束时间必须在开始时间之后")
        return v


class BacktestBatchCreate(BaseModel):
    """BACK-003: 批量回测"""

    strategy_id: Optional[UUID] = None
    definition: Optional[dict] = None
    name_prefix: str = "Batch"
    symbols: list[str] = Field(..., min_length=1)
    exchange: str = "binance"
    kline_interval: KlineInterval = KlineInterval.HOUR_1
    start_date: datetime
    end_date: datetime
    initial_capital: Decimal = Field(default=10000, gt=0)
    commission_rate: float = 0.0004
    fill_mode: str = "next_open"


class ParameterOptimizationCreate(BaseModel):
    """BACK-018: 参数优化"""

    strategy_id: UUID
    name: str = Field(..., max_length=200)
    param_grid: dict = Field(..., description="参数网格定义")
    optimization_method: str = Field(default="grid_search", description="grid_search | bayesian | genetic | walk_forward")
    metric: str = Field(default="sharpe_ratio", description="优化目标")
    symbols: list[str] = Field(..., min_length=1)
    exchange: str = "binance"
    kline_interval: KlineInterval = KlineInterval.HOUR_1
    start_date: datetime
    end_date: datetime
    initial_capital: Decimal = Field(default=10000, gt=0)
    train_ratio: float = Field(default=0.7, ge=0.5, le=0.9)


# ============================================================
# 响应模型
# ============================================================
class BacktestTaskResponse(BaseModel):
    """回测任务响应"""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: str
    strategy_id: Optional[str] = None
    name: str
    symbols: list[str] = []
    exchange: str
    kline_interval: str
    start_date: datetime
    end_date: datetime
    initial_capital: Decimal
    commission_rate: float
    slippage: float
    fill_mode: str
    status: str
    progress: float
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class BacktestResultResponse(BaseModel):
    """BACK-011~017: 回测结果响应"""

    model_config = ConfigDict(from_attributes=True)

    task_id: UUID
    total_return_pct: float
    annual_return_pct: float
    annual_volatility_pct: float
    sharpe_ratio: float
    max_drawdown_pct: float
    calmar_ratio: float
    win_rate_pct: float
    profit_loss_ratio: float
    avg_hold_hours: float
    total_trades: int
    max_consecutive_losses: int
    initial_capital: Decimal
    final_equity: Decimal
    total_commission: Decimal
    total_funding_fee: Decimal
    # 时间序列（大 JSON，前端请求时再展开）
    equity_curve: Optional[list] = None
    drawdown_curve: Optional[list] = None
    daily_returns: Optional[list] = None
    # 交易明细
    trades: Optional[list] = None
    # 基准对比
    benchmark_return_pct: Optional[float] = None
    excess_return_pct: Optional[float] = None
    beta: Optional[float] = None
    information_ratio: Optional[float] = None
    created_at: datetime


class ParameterOptimizationResponse(BaseModel):
    """参数优化结果响应"""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    strategy_id: Optional[str] = None
    name: str
    param_grid: dict = {}
    optimization_method: str
    metric: str
    status: str
    progress: float
    total_combinations: int
    completed_combinations: int
    best_params: Optional[dict] = None
    best_score: Optional[float] = None
    all_results: Optional[list] = None
    overfitting_warning: Optional[str] = None
    created_at: datetime
    updated_at: datetime
