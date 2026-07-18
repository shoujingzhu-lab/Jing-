"""
行情数据模型 (TimescaleDB)
==========================
对应需求模块一：数据管理中心
- DATA-001 ~ DATA-014
存储在 TimescaleDB 时序数据库中，使用超表 (hypertable) 自动分区。
"""

from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Numeric, String, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Kline(Base):
    """K 线数据 — 超表 (DATA-007)"""

    __tablename__ = "klines"

    exchange: Mapped[str] = mapped_column(
        String(20), primary_key=True, nullable=False, comment="交易所"
    )
    symbol: Mapped[str] = mapped_column(
        String(50), primary_key=True, nullable=False, comment="交易对"
    )
    interval: Mapped[str] = mapped_column(
        String(10), primary_key=True, nullable=False, comment="K线周期: 1m/5m/15m/30m/1h/4h/1d/1w"
    )
    open_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), primary_key=True, nullable=False, comment="开盘时间"
    )
    open: Mapped[Decimal] = mapped_column(Numeric(24, 8), nullable=False)
    high: Mapped[Decimal] = mapped_column(Numeric(24, 8), nullable=False)
    low: Mapped[Decimal] = mapped_column(Numeric(24, 8), nullable=False)
    close: Mapped[Decimal] = mapped_column(Numeric(24, 8), nullable=False)
    volume: Mapped[Decimal] = mapped_column(Numeric(24, 8), nullable=False, comment="成交量(基础币)")
    quote_volume: Mapped[Decimal] = mapped_column(Numeric(24, 8), nullable=False, comment="成交额(计价币)")
    trades_count: Mapped[int] = mapped_column(nullable=False, comment="成交笔数")
    taker_buy_volume: Mapped[Decimal] = mapped_column(Numeric(24, 8), nullable=False, comment="主动买入量")
    taker_buy_quote_volume: Mapped[Decimal] = mapped_column(Numeric(24, 8), nullable=False, comment="主动买入额")

    __table_args__ = (
        Index("idx_klines_symbol_interval_time", "symbol", "interval", "open_time"),
        Index("idx_klines_exchange_symbol", "exchange", "symbol", "interval"),
        Index("idx_klines_exchange_time", "exchange", "open_time"),
        {"comment": "K线数据 — 建议在 TimescaleDB 中转为 hypertable: SELECT create_hypertable('klines', 'open_time');"},
    )

    def __repr__(self) -> str:
        return f"<Kline {self.exchange}:{self.symbol} {self.interval} @{self.open_time}>"


class OrderBookSnapshot(Base):
    """订单簿快照 (DATA-008)"""

    __tablename__ = "orderbook_snapshots"

    exchange: Mapped[str] = mapped_column(String(20), primary_key=True, nullable=False)
    symbol: Mapped[str] = mapped_column(String(50), primary_key=True, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), primary_key=True, nullable=False, comment="快照时间"
    )
    bids: Mapped[str] = mapped_column(nullable=False, comment="买盘 (JSON: [[price, qty], ...])")
    asks: Mapped[str] = mapped_column(nullable=False, comment="卖盘 (JSON: [[price, qty], ...])")
    best_bid: Mapped[Decimal] = mapped_column(Numeric(24, 8), nullable=False)
    best_ask: Mapped[Decimal] = mapped_column(Numeric(24, 8), nullable=False)
    spread: Mapped[Decimal] = mapped_column(Numeric(24, 8), nullable=False, comment="买卖价差")

    __table_args__ = (
        Index("idx_ob_snapshot_symbol_time", "symbol", "timestamp"),
    )


class FundingRate(Base):
    """资金费率历史 (DATA-009)"""

    __tablename__ = "funding_rates"

    exchange: Mapped[str] = mapped_column(String(20), primary_key=True, nullable=False)
    symbol: Mapped[str] = mapped_column(String(50), primary_key=True, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), primary_key=True, nullable=False, comment="结算时间"
    )
    rate: Mapped[Decimal] = mapped_column(Numeric(18, 10), nullable=False, comment="资金费率")
    next_rate: Mapped[Decimal | None] = mapped_column(
        Numeric(18, 10), nullable=True, comment="预测下一期费率"
    )

    __table_args__ = (
        Index("idx_funding_symbol_time", "symbol", "timestamp"),
    )


class TickerData(Base):
    """实时 Ticker 数据 (DATA-002)"""

    __tablename__ = "ticker_data"

    exchange: Mapped[str] = mapped_column(String(20), primary_key=True, nullable=False)
    symbol: Mapped[str] = mapped_column(String(50), primary_key=True, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), primary_key=True, nullable=False
    )
    last_price: Mapped[Decimal] = mapped_column(Numeric(24, 8), nullable=False)
    bid: Mapped[Decimal] = mapped_column(Numeric(24, 8), nullable=False)
    ask: Mapped[Decimal] = mapped_column(Numeric(24, 8), nullable=False)
    high_24h: Mapped[Decimal] = mapped_column(Numeric(24, 8), nullable=False)
    low_24h: Mapped[Decimal] = mapped_column(Numeric(24, 8), nullable=False)
    volume_24h: Mapped[Decimal] = mapped_column(Numeric(24, 8), nullable=False)
    quote_volume_24h: Mapped[Decimal] = mapped_column(Numeric(24, 8), nullable=False)
    change_pct_24h: Mapped[Decimal | None] = mapped_column(Numeric(10, 4), nullable=True)
    open_interest: Mapped[Decimal | None] = mapped_column(
        Numeric(24, 8), nullable=True, comment="未平仓合约量 (合约)"
    )
    mark_price: Mapped[Decimal | None] = mapped_column(
        Numeric(24, 8), nullable=True, comment="标记价格 (合约)"
    )
    index_price: Mapped[Decimal | None] = mapped_column(
        Numeric(24, 8), nullable=True, comment="指数价格 (合约)"
    )

    __table_args__ = (
        Index("idx_ticker_symbol_time", "symbol", "timestamp"),
    )
