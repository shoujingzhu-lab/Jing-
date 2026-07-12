"""
回测系统模型
============
对应需求模块三：回测系统
- BACK-001 ~ BACK-022
"""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Float, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class BacktestTask(Base, UUIDMixin, TimestampMixin):
    """回测任务 (BACK-001)"""

    __tablename__ = "backtest_tasks"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True, comment="用户 ID"
    )
    strategy_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("strategies.id", ondelete="SET NULL"),
        nullable=True, index=True, comment="策略 ID"
    )
    name: Mapped[str] = mapped_column(
        String(200), nullable=False, comment="回测任务名称"
    )

    # 回测参数
    symbols: Mapped[str] = mapped_column(
        Text, nullable=False, comment="交易对列表 (JSON): ['BTCUSDT','ETHUSDT']"
    )
    exchange: Mapped[str] = mapped_column(
        String(20), default="binance", nullable=False
    )
    kline_interval: Mapped[str] = mapped_column(
        String(10), default="1h", nullable=False
    )
    start_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, comment="回测开始时间"
    )
    end_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, comment="回测结束时间"
    )
    initial_capital: Mapped[Decimal] = mapped_column(
        Numeric(24, 8), nullable=False, comment="初始资金 (USDT)"
    )
    commission_rate: Mapped[float] = mapped_column(
        Float, default=0.0004, nullable=False, comment="手续费率 (Taker 0.04%)"
    )
    slippage: Mapped[float] = mapped_column(
        Float, default=0.0005, nullable=False, comment="滑点 (0.05%)"
    )
    fill_mode: Mapped[str] = mapped_column(
        String(20), default="next_open",
        comment="撮合模式: next_open | close | limit | vwap | counterparty"
    )

    # 状态与进度
    status: Mapped[str] = mapped_column(
        String(20), default="pending", nullable=False, index=True,
        comment="pending | running | completed | failed | cancelled"
    )
    progress: Mapped[float] = mapped_column(
        Float, default=0.0, nullable=False, comment="进度 (0-100)"
    )
    error_message: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="失败原因"
    )

    # 与回测结果关联
    result: Mapped[Optional["BacktestResult"]] = relationship(
        back_populates="task", uselist=False, cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<BacktestTask {self.name} [{self.status}]>"


class BacktestResult(Base, UUIDMixin):
    """回测结果 (BACK-011 ~ BACK-017)"""

    __tablename__ = "backtest_results"

    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("backtest_tasks.id", ondelete="CASCADE"),
        nullable=False, unique=True, index=True
    )

    # 核心指标
    total_return_pct: Mapped[float] = mapped_column(Float, nullable=False, comment="累计收益率(%)")
    annual_return_pct: Mapped[float] = mapped_column(Float, nullable=False, comment="年化收益率(%)")
    annual_volatility_pct: Mapped[float] = mapped_column(Float, nullable=False, comment="年化波动率(%)")
    sharpe_ratio: Mapped[float] = mapped_column(Float, nullable=False, comment="夏普比率")
    max_drawdown_pct: Mapped[float] = mapped_column(Float, nullable=False, comment="最大回撤(%)")
    calmar_ratio: Mapped[float] = mapped_column(Float, nullable=False, comment="卡玛比率")
    win_rate_pct: Mapped[float] = mapped_column(Float, nullable=False, comment="胜率(%)")
    profit_loss_ratio: Mapped[float] = mapped_column(Float, nullable=False, comment="盈亏比")
    avg_hold_hours: Mapped[float] = mapped_column(Float, nullable=False, comment="平均持仓时间(小时)")
    total_trades: Mapped[int] = mapped_column(Integer, nullable=False, comment="总交易次数")
    max_consecutive_losses: Mapped[int] = mapped_column(Integer, nullable=False, comment="最大连续亏损次数")

    # 资金相关
    initial_capital: Mapped[Decimal] = mapped_column(Numeric(24, 8), nullable=False)
    final_equity: Mapped[Decimal] = mapped_column(Numeric(24, 8), nullable=False, comment="最终权益")
    total_commission: Mapped[Decimal] = mapped_column(Numeric(24, 8), nullable=False, comment="总手续费")
    total_funding_fee: Mapped[Decimal] = mapped_column(Numeric(24, 8), default=0, nullable=False, comment="总资金费率")

    # 时间序列（JSON 大文本）
    equity_curve: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="净值曲线 (JSON): [{time, equity}, ...]"
    )
    drawdown_curve: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="回撤曲线 (JSON)"
    )
    daily_returns: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="日收益率 (JSON)"
    )
    monthly_heatmap: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="月度收益热力图数据 (JSON)"
    )

    # 交易明细（JSON）
    trades: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="交易明细 (JSON): [{entry_time, exit_time, symbol, side, entry_price, exit_price, amount, pnl, commission, ...}]"
    )

    # 基准对比
    benchmark_return_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True, comment="基准(BTC)收益率(%)")
    excess_return_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True, comment="超额收益(%)")
    beta: Mapped[Optional[float]] = mapped_column(Float, nullable=True, comment="Beta")
    information_ratio: Mapped[Optional[float]] = mapped_column(Float, nullable=True, comment="信息比率")

    # 关联
    task: Mapped["BacktestTask"] = relationship(back_populates="result")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", nullable=False
    )


class ParameterOptimizationTask(Base, UUIDMixin, TimestampMixin):
    """参数优化任务 (BACK-018 ~ BACK-022)"""

    __tablename__ = "param_optimization_tasks"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    strategy_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("strategies.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)

    # 优化参数
    param_grid: Mapped[str] = mapped_column(
        Text, nullable=False,
        comment="参数网格 (JSON): {'ema_fast_period': {'min':5,'max':30,'step':1}, ...}"
    )
    optimization_method: Mapped[str] = mapped_column(
        String(30), default="grid_search",
        comment="优化方法: grid_search | bayesian | genetic | walk_forward"
    )
    metric: Mapped[str] = mapped_column(
        String(30), default="sharpe_ratio",
        comment="优化目标: sharpe_ratio | total_return | calmar_ratio"
    )

    # 回测范围
    symbols: Mapped[str] = mapped_column(Text, nullable=False)
    exchange: Mapped[str] = mapped_column(String(20), default="binance")
    kline_interval: Mapped[str] = mapped_column(String(10), default="1h")
    start_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    initial_capital: Mapped[Decimal] = mapped_column(Numeric(24, 8), nullable=False)

    # 样本外验证
    train_ratio: Mapped[float] = mapped_column(
        Float, default=0.7, nullable=False, comment="训练集比例"
    )

    # 状态
    status: Mapped[str] = mapped_column(
        String(20), default="pending", nullable=False, index=True
    )
    progress: Mapped[float] = mapped_column(Float, default=0.0)

    # 结果
    total_combinations: Mapped[int] = mapped_column(Integer, default=0)
    completed_combinations: Mapped[int] = mapped_column(Integer, default=0)
    best_params: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="最优参数 (JSON)"
    )
    best_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    all_results: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="所有参数组合结果 (JSON)"
    )
    overfitting_warning: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="过拟合风险提示"
    )
