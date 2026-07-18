"""
Schema 验证测试
================
P2-007: 测试 Pydantic 请求/响应模型的验证逻辑。
"""

import pytest
from datetime import datetime, UTC

from app.schemas.base import (
    APIResponse, APIError, PaginatedResponse, StrategyType,
    StrategyStatus, OrderStatus, ExchangeType, TradeType,
)
from app.schemas.strategy import StrategyCreate, StrategyUpdate


class TestAPIResponse:
    def test_success_response(self):
        resp = APIResponse(
            success=True,
            code=200,
            message="OK",
            data={"key": "value"},
            timestamp=datetime.now(UTC),
        )
        assert resp.success is True
        assert resp.code == 200
        assert resp.data == {"key": "value"}

    def test_error_response(self):
        resp = APIResponse(
            success=False,
            code=400,
            message="Bad Request",
            data=None,
            timestamp=datetime.now(UTC),
        )
        assert resp.success is False
        assert resp.code == 400


class TestPaginatedResponse:
    def test_creation(self):
        from app.schemas.base import PaginatedData
        pd = PaginatedData(
            items=[1, 2, 3],
            total=100,
            page=1,
            page_size=20,
            total_pages=5,
        )
        assert pd.total == 100
        assert pd.total_pages == 5


class TestEnums:
    def test_strategy_type(self):
        # StrategyType is a StrEnum with "python" and "visual" values
        assert StrategyType("python") == "python" or hasattr(StrategyType, "python")
        assert StrategyType("visual") == "visual" or hasattr(StrategyType, "visual")

    def test_strategy_status(self):
        statuses = ["draft", "backtested", "simulated", "live", "paused", "archived"]
        for s in statuses:
            assert StrategyStatus(s) is not None

    def test_order_status(self):
        statuses = ["created", "submitted", "partially_filled", "filled", "cancelled", "expired", "rejected"]
        for s in statuses:
            assert OrderStatus(s) is not None

    def test_exchange_types(self):
        for ex in ["binance", "okx", "bybit", "gateio"]:
            assert ExchangeType(ex) is not None

    def test_trade_type(self):
        for tt in ["spot", "perpetual", "futures"]:
            assert TradeType(tt) is not None


class TestStrategySchema:
    def test_create_minimal(self):
        s = StrategyCreate(
            name="test-strategy",
            strategy_type="python",
            definition={"code": "def on_bar(bar): pass"},
            trade_type="spot",
            kline_interval="1h",
        )
        assert s.name == "test-strategy"
        assert s.strategy_type == "python"

    def test_create_with_description(self):
        s = StrategyCreate(
            name="EMA Crossover",
            description="双均线交叉策略",
            strategy_type="python",
            definition={"code": "def on_bar(bar):\n    return {'action': 'buy'}"},
            trade_type="spot",
            kline_interval="1h",
        )
        assert s.description == "双均线交叉策略"

    def test_strategy_update(self):
        s = StrategyUpdate(name="Updated Name")
        assert s.name == "Updated Name"
        # description 应为可选
        assert s.description is None


class TestConfigModels:
    def test_production_configs_exist(self):
        from app.core.config import settings
        assert hasattr(settings, "SENTRY_DSN")
        assert hasattr(settings, "PROMETHEUS_ENABLED")
        assert hasattr(settings, "RATE_LIMIT_ENABLED")
        assert hasattr(settings, "REQUEST_ID_HEADER")
        assert hasattr(settings, "HEALTH_CHECK_TIMEOUT")
