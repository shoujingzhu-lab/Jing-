"""
数据模型包
=========
导入所有模型以便 Alembic 自动发现和建表。
"""

from app.core.database import Base
from app.models.user import AuditLog, Role, Session, User, user_roles
from app.models.trading import (
    ApiKey,
    Order,
    Position,
    Strategy,
    StrategyVersion,
    TradingAccount,
)
from app.models.risk import CircuitBreaker, RiskEvent, RiskRule
from app.models.notification import Notification, NotificationRule, UserNotificationPreference
from app.models.backtest import BacktestTask, BacktestResult, ParameterOptimizationTask
from app.services.simulation import SimAccount, SimTrade
from app.models.market_data import (
    FundingRate,
    Kline,
    OrderBookSnapshot,
    TickerData,
)

# 所有模型列表 — Alembic metadata 自动拾取
__all__ = [
    # Base
    "Base",
    # 用户与权限
    "User",
    "Role",
    "Session",
    "AuditLog",
    "user_roles",
    # 交易
    "ApiKey",
    "TradingAccount",
    "Strategy",
    "StrategyVersion",
    "Order",
    "Position",
    # 风控
    "RiskRule",
    "RiskEvent",
    "CircuitBreaker",
    # 通知
    "NotificationRule",
    "Notification",
    "UserNotificationPreference",
    # 模拟交易
    "SimAccount",
    "SimTrade",
    # 回测
    "BacktestTask",
    "BacktestResult",
    "ParameterOptimizationTask",
    # 行情数据 (TimescaleDB)
    "Kline",
    "OrderBookSnapshot",
    "FundingRate",
    "TickerData",
]
