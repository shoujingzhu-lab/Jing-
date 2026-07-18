"""
交易相关模型
============
对应需求模块五：实盘交易 + 模块二：策略引擎
- TRADE-001 ~ TRADE-025
- STG-001 ~ STG-018
"""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin, AuditMixin, SoftDeleteMixin


class ApiKey(Base, UUIDMixin, TimestampMixin):
    """交易所 API Key (TRADE-002 ~ TRADE-005)"""

    __tablename__ = "api_keys"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    exchange: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="交易所 (binance/okx/bybit/gateio)"
    )
    label: Mapped[str] = mapped_column(
        String(200), nullable=False, comment="备注名称"
    )
    access_key: Mapped[str] = mapped_column(
        String(500), nullable=False, comment="Access Key (AES-256-GCM 加密)"
    )
    secret_key_encrypted: Mapped[str] = mapped_column(
        String(1000), nullable=False, comment="Secret Key (AES-256-GCM 加密)"
    )
    passphrase_encrypted: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True, comment="Passphrase (OKX 需要, AES-256-GCM 加密)"
    )
    permissions: Mapped[Optional[str]] = mapped_column(
        String(200), nullable=True, comment="API 权限: read,trade,withdraw"
    )
    has_withdraw_permission: Mapped[bool] = mapped_column(
        default=False, nullable=False, comment="是否开启了提币权限"
    )
    is_active: Mapped[bool] = mapped_column(
        default=True, nullable=False, comment="是否启用"
    )
    last_sync_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="上次账户信息同步时间"
    )

    # 关联
    user: Mapped["User"] = relationship(back_populates="api_keys")
    trading_accounts: Mapped[list["TradingAccount"]] = relationship(
        back_populates="api_key", lazy="selectin"
    )

    __table_args__ = (
        Index("idx_apikeys_user_active", "user_id", "is_active"),
        Index("idx_apikeys_exchange_active", "exchange", "is_active"),
    )

    def __repr__(self) -> str:
        return f"<ApiKey {self.exchange}:{self.label}>"


class TradingAccount(Base, UUIDMixin, TimestampMixin):
    """交易账户同步信息 (TRADE-004)"""

    __tablename__ = "trading_accounts"

    api_key_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("api_keys.id", ondelete="CASCADE"), nullable=False, index=True
    )
    total_equity_usdt: Mapped[Decimal] = mapped_column(
        Numeric(24, 8), default=0, nullable=False, comment="总权益 (USDT)"
    )
    available_balance_usdt: Mapped[Decimal] = mapped_column(
        Numeric(24, 8), default=0, nullable=False, comment="可用余额 (USDT)"
    )
    margin_used_usdt: Mapped[Decimal] = mapped_column(
        Numeric(24, 8), default=0, nullable=False, comment="已用保证金 (USDT)"
    )
    unrealized_pnl_usdt: Mapped[Decimal] = mapped_column(
        Numeric(24, 8), default=0, nullable=False, comment="未实现盈亏 (USDT)"
    )
    synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, comment="同步时间"
    )

    api_key: Mapped["ApiKey"] = relationship(back_populates="trading_accounts")


class Strategy(Base, AuditMixin, SoftDeleteMixin):
    """策略定义 (STG-001 ~ STG-018)"""

    __tablename__ = "strategies"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(
        String(200), nullable=False, comment="策略名称"
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="策略描述"
    )
    strategy_type: Mapped[str] = mapped_column(
        String(20), nullable=False, comment="策略类型: visual | python"
    )
    definition: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="策略定义 (JSON 节点图 或 Python 代码)"
    )
    status: Mapped[str] = mapped_column(
        String(20), default="draft", nullable=False, index=True,
        comment="生命周期: draft | backtested | simulated | live | paused | archived"
    )
    version: Mapped[int] = mapped_column(
        default=1, nullable=False, comment="当前版本号"
    )
    tags: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True, comment="标签 (JSON 数组)"
    )

    # 运行配置
    trade_type: Mapped[str] = mapped_column(
        String(20), default="spot", nullable=False, comment="交易类型: spot | perpetual | futures"
    )
    symbol_pool: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="交易对池配置 (JSON)"
    )
    kline_interval: Mapped[str] = mapped_column(
        String(10), default="1h", nullable=False, comment="K线周期: 1m/5m/15m/1h/4h/1d"
    )

    # 关联
    user: Mapped["User"] = relationship(back_populates="strategies")
    versions: Mapped[list["StrategyVersion"]] = relationship(
        back_populates="strategy",
        lazy="selectin",
        order_by="StrategyVersion.version.desc()",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Strategy {self.name} v{self.version} [{self.status}]>"


class StrategyVersion(Base, UUIDMixin):
    """策略版本记录 (STG-015 ~ STG-017)"""

    __tablename__ = "strategy_versions"

    strategy_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("strategies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version: Mapped[int] = mapped_column(nullable=False, comment="版本号")
    definition: Mapped[str] = mapped_column(Text, nullable=False, comment="该版本定义快照")
    change_summary: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True, comment="修改摘要"
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, comment="修改人用户 ID"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", nullable=False
    )

    # 关联
    strategy: Mapped["Strategy"] = relationship(back_populates="versions")

    def __repr__(self) -> str:
        return f"<StrategyVersion {self.strategy_id[:8]}... v{self.version}>"


class Order(Base, AuditMixin):
    """订单记录 (TRADE-006 ~ TRADE-013)"""

    __tablename__ = "orders"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True, comment="用户 ID"
    )
    strategy_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True, comment="策略 ID（手动下单则为空）"
    )
    api_key_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("api_keys.id", ondelete="RESTRICT"), nullable=False
    )
    exchange: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="交易所"
    )
    exchange_order_id: Mapped[Optional[str]] = mapped_column(
        String(200), nullable=True, comment="交易所返回的订单 ID"
    )
    client_order_id: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, unique=True, comment="客户端订单 ID"
    )

    # 订单参数
    symbol: Mapped[str] = mapped_column(String(50), nullable=False, comment="交易对")
    side: Mapped[str] = mapped_column(
        String(10), nullable=False, comment="方向: buy | sell"
    )
    order_type: Mapped[str] = mapped_column(
        String(30), nullable=False, comment="类型: market | limit | stop_market | stop_limit | iceberg | twap"
    )
    price: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(24, 8), nullable=True, comment="限价（市价单为空）"
    )
    amount: Mapped[Decimal] = mapped_column(
        Numeric(24, 8), nullable=False, comment="数量（基础币）"
    )
    filled_amount: Mapped[Decimal] = mapped_column(
        Numeric(24, 8), default=0, nullable=False, comment="已成交数量"
    )
    avg_fill_price: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(24, 8), nullable=True, comment="成交均价"
    )
    status: Mapped[str] = mapped_column(
        String(20), default="created", nullable=False, index=True,
        comment="created | submitted | partially_filled | filled | cancelled | expired | rejected"
    )
    commission: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(24, 8), nullable=True, comment="手续费"
    )
    commission_asset: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True, comment="手续费币种"
    )

    # 风控相关
    leverage: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True, comment="杠杆倍数"
    )
    margin_mode: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True, comment="保证金模式: cross | isolated"
    )

    __table_args__ = (
        # P0-003: 复合索引 — 高频查询路径
        Index("idx_orders_user_status_created", "user_id", "status", "created_at"),
        Index("idx_orders_user_symbol_created", "user_id", "symbol", "created_at"),
        Index("idx_orders_strategy_status", "strategy_id", "status"),
        Index("idx_orders_exchange_status", "exchange", "status"),
        Index("idx_orders_client_order_id", "client_order_id"),
    )

    def __repr__(self) -> str:
        return f"<Order {self.symbol} {self.side} {self.status}>"


class Position(Base, UUIDMixin, TimestampMixin):
    """持仓记录 (TRADE-014 ~ TRADE-019)"""

    __tablename__ = "positions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True, comment="用户 ID"
    )
    api_key_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("api_keys.id", ondelete="RESTRICT"), nullable=False
    )
    exchange: Mapped[str] = mapped_column(String(50), nullable=False)
    symbol: Mapped[str] = mapped_column(String(50), nullable=False)

    side: Mapped[str] = mapped_column(
        String(10), nullable=False, comment="方向: long | short"
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(24, 8), nullable=False, comment="持仓数量")
    entry_price: Mapped[Decimal] = mapped_column(
        Numeric(24, 8), nullable=False, comment="开仓均价"
    )
    mark_price: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(24, 8), nullable=True, comment="标记价格"
    )
    liquidation_price: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(24, 8), nullable=True, comment="强平价格"
    )
    unrealized_pnl: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(24, 8), nullable=True, comment="未实现盈亏"
    )
    realized_pnl: Mapped[Decimal] = mapped_column(
        Numeric(24, 8), default=0, nullable=False, comment="已实现盈亏"
    )
    leverage: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    margin_mode: Mapped[str] = mapped_column(
        String(20), default="isolated", nullable=False
    )
    margin_used: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(24, 8), nullable=True, comment="占用保证金"
    )

    # 止盈止损
    stop_loss_price: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(24, 8), nullable=True, comment="止损价"
    )
    take_profit_price: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(24, 8), nullable=True, comment="止盈价"
    )

    # 状态
    is_open: Mapped[bool] = mapped_column(default=True, nullable=False, index=True)
    closed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    def __repr__(self) -> str:
        return f"<Position {self.symbol} {self.side} x{self.leverage}>"

    __table_args__ = (
        Index("idx_positions_user_open", "user_id", "is_open"),
        Index("idx_positions_user_symbol", "user_id", "symbol", "is_open"),
        Index("idx_positions_exchange_symbol", "exchange", "symbol", "is_open"),
    )
