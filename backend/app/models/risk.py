"""
风控模型
========
对应需求模块六：风险控制
- RISK-001 ~ RISK-016
"""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class RiskRule(Base, UUIDMixin, TimestampMixin):
    """风控规则配置"""

    __tablename__ = "risk_rules"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True, comment="用户 ID"
    )
    strategy_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True, comment="策略 ID（空=账户级/全局级）"
    )
    scope: Mapped[str] = mapped_column(
        String(20), nullable=False, comment="作用域: strategy | account | global"
    )

    rule_type: Mapped[str] = mapped_column(
        String(50), nullable=False,
        comment="规则类型: stop_loss | take_profit | trailing_stop | daily_loss_limit "
                "| consecutive_loss_limit | max_drawdown | max_position_pct | margin_limit",
    )
    params: Mapped[str] = mapped_column(
        Text, nullable=False, comment="规则参数 (JSON)"
    )
    is_enabled: Mapped[bool] = mapped_column(default=True, nullable=False)


class RiskEvent(Base, UUIDMixin):
    """风控事件记录 (RISK-016)"""

    __tablename__ = "risk_events"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True, comment="用户 ID"
    )
    strategy_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True, comment="策略 ID"
    )
    event_type: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True,
        comment="事件类型: stop_loss_triggered | take_profit_triggered | position_liquidated "
                "| daily_loss_halt | max_drawdown_halt | global_circuit_breaker",
    )
    symbol: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True, comment="相关交易对"
    )
    detail: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="事件详情 (JSON)"
    )
    severity: Mapped[str] = mapped_column(
        String(20), default="warning", comment="严重程度: info | warning | critical"
    )
    is_resolved: Mapped[bool] = mapped_column(default=False, nullable=False)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", nullable=False, index=True
    )


class CircuitBreaker(Base, UUIDMixin):
    """熔断状态记录 (RISK-010 ~ RISK-011)"""

    __tablename__ = "circuit_breakers"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True, comment="用户 ID"
    )
    scope: Mapped[str] = mapped_column(
        String(20), nullable=False, comment="熔断范围: strategy | account | global"
    )
    trigger_reason: Mapped[str] = mapped_column(
        Text, nullable=False, comment="触发原因"
    )
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False, index=True)
    triggered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", nullable=False
    )
    resolved_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True, comment="解除人"
    )
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
