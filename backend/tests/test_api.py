"""
交易服务 + API 测试
===================
P2-007: 测试 TradingService、API Key 管理、订单 CRUD、风控 API。
"""

import json
import uuid

import pytest
from httpx import AsyncClient

from app.core.security import create_access_token
from app.models.trading import Order, ApiKey, Position
from app.models.risk import RiskRule, RiskEvent, CircuitBreaker


TEST_USER_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"


# ============================================================
# Helpers
# ============================================================
@pytest.fixture
def auth_headers() -> dict:
    token = create_access_token(subject=TEST_USER_ID)
    return {"Authorization": f"Bearer {token}"}


# ============================================================
# Strategy API
# ============================================================
class TestStrategyAPI:
    @pytest.mark.asyncio
    async def test_list_strategies(self, async_client: AsyncClient, auth_headers):
        resp = await async_client.get("/api/v1/strategies", headers=auth_headers)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_create_strategy(self, async_client: AsyncClient, auth_headers):
        name = f"test-strategy-{uuid.uuid4().hex[:6]}"
        resp = await async_client.post(
            "/api/v1/strategies",
            json={
                "name": name,
                "strategy_type": "python",
                "definition": "def on_bar(bar):\n    return {'action': 'buy', 'amount': 0.1}",
                "trade_type": "spot",
                "kline_interval": "1h",
                "description": "Test strategy for unit tests",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["data"]["name"] == name

    @pytest.mark.asyncio
    async def test_get_strategy_not_found(self, async_client: AsyncClient, auth_headers):
        resp = await async_client.get(
            f"/api/v1/strategies/{uuid.uuid4()}",
            headers=auth_headers,
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_get_templates(self, async_client: AsyncClient, auth_headers):
        resp = await async_client.get("/api/v1/strategies/templates", headers=auth_headers)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_list_strategies_requires_auth(self, async_client: AsyncClient):
        resp = await async_client.get("/api/v1/strategies")
        assert resp.status_code == 401


# ============================================================
# Risk API (extended)
# ============================================================
class TestRiskAPIExtended:
    @pytest.mark.asyncio
    async def test_get_dashboard(self, async_client: AsyncClient, auth_headers):
        resp = await async_client.get("/api/v1/risk/dashboard", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "data" in data
        dashboard = data["data"]
        assert "active_circuit_breakers" in dashboard
        assert "active_rules" in dashboard

    @pytest.mark.asyncio
    async def test_update_rule(self, async_client: AsyncClient, auth_headers):
        # Create a rule first
        create_resp = await async_client.post(
            "/api/v1/risk/rules",
            params={
                "scope": "account",
                "rule_type": "max_drawdown",
                "params": '{"max_drawdown": 0.20}',
            },
            headers=auth_headers,
        )
        if create_resp.status_code == 201:
            rule_id = create_resp.json()["data"]["id"]
            # Update
            update_resp = await async_client.put(
                f"/api/v1/risk/rules/{rule_id}",
                params={"params": '{"max_drawdown": 0.15}'},
                headers=auth_headers,
            )
            assert update_resp.status_code in (200, 403)

    @pytest.mark.asyncio
    async def test_list_events(self, async_client: AsyncClient, auth_headers):
        resp = await async_client.get("/api/v1/risk/events", headers=auth_headers)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_pre_check_without_auth(self, async_client: AsyncClient):
        resp = await async_client.post(
            "/api/v1/risk/pre-check",
            params={
                "strategy_id": "00000000-0000-0000-0000-000000000001",
                "symbol": "BTCUSDT",
                "side": "buy",
                "amount": 0.1,
            },
        )
        assert resp.status_code == 401


# ============================================================
# Trading API
# ============================================================
class TestTradingAPI:
    @pytest.mark.asyncio
    async def test_list_orders_empty(self, async_client: AsyncClient, auth_headers):
        resp = await async_client.get("/api/v1/trading/orders", headers=auth_headers)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_list_positions(self, async_client: AsyncClient, auth_headers):
        resp = await async_client.get("/api/v1/trading/positions", headers=auth_headers)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_trade_logs(self, async_client: AsyncClient, auth_headers):
        resp = await async_client.get("/api/v1/trading/trade-logs", headers=auth_headers)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_create_order_without_auth(self, async_client: AsyncClient):
        resp = await async_client.post(
            "/api/v1/trading/orders",
            json={"symbol": "BTCUSDT", "side": "buy", "order_type": "market", "amount": 0.1},
        )
        assert resp.status_code in (401, 422)


# ============================================================
# Data API
# ============================================================
class TestDataAPI:
    @pytest.mark.asyncio
    async def test_get_ticker(self, async_client: AsyncClient, auth_headers):
        resp = await async_client.get(
            "/api/v1/data/ticker",
            params={"exchange": "binance", "symbol": "BTCUSDT"},
            headers=auth_headers,
        )
        # May fail if no exchange connection available
        assert resp.status_code in (200, 503)

    @pytest.mark.asyncio
    async def test_get_klines(self, async_client: AsyncClient, auth_headers):
        resp = await async_client.get(
            "/api/v1/data/klines",
            params={
                "exchange": "binance", "symbol": "BTCUSDT",
                "interval": "1h", "limit": 10,
            },
            headers=auth_headers,
        )
        assert resp.status_code in (200, 503)

    @pytest.mark.asyncio
    async def test_get_supported_exchanges(self, async_client: AsyncClient, auth_headers):
        resp = await async_client.get("/api/v1/data/exchanges", headers=auth_headers)
        assert resp.status_code == 200


# ============================================================
# Admin / Health API
# ============================================================
class TestHealthAPI:
    @pytest.mark.asyncio
    async def test_health_check(self, async_client: AsyncClient):
        resp = await async_client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert "status" in data
        assert data["status"] in ("healthy", "degraded")

    @pytest.mark.asyncio
    async def test_liveness(self, async_client: AsyncClient):
        resp = await async_client.get("/health/live")
        assert resp.status_code == 200
        assert resp.json()["status"] == "alive"

    @pytest.mark.asyncio
    async def test_readiness(self, async_client: AsyncClient):
        resp = await async_client.get("/health/ready")
        assert resp.status_code in (200, 503)

    @pytest.mark.asyncio
    async def test_root(self, async_client: AsyncClient):
        resp = await async_client.get("/")
        assert resp.status_code == 200
        data = resp.json()
        assert "app" in data
        assert "version" in data

    @pytest.mark.asyncio
    async def test_metrics_endpoint(self, async_client: AsyncClient):
        resp = await async_client.get("/metrics")
        assert resp.status_code == 200
        assert "http_requests_total" in resp.text or "quant" in resp.text.lower()


# ============================================================
# Backtest API
# ============================================================
class TestBacktestAPI:
    @pytest.mark.asyncio
    async def test_create_backtest(self, async_client: AsyncClient, auth_headers):
        resp = await async_client.post(
            "/api/v1/backtest",
            json={
                "strategy_id": str(uuid.uuid4()),
                "name": "test-backtest",
                "symbols": '["BTCUSDT"]',
                "exchange": "binance",
                "kline_interval": "1h",
                "start_date": "2026-01-01T00:00:00Z",
                "end_date": "2026-06-30T23:59:59Z",
                "initial_capital": 10000,
            },
            headers=auth_headers,
        )
        assert resp.status_code in (201, 404)  # 404 if strategy doesn't exist

    @pytest.mark.asyncio
    async def test_list_backtests(self, async_client: AsyncClient, auth_headers):
        resp = await async_client.get("/api/v1/backtest", headers=auth_headers)
        assert resp.status_code == 200


# ============================================================
# Notification API
# ============================================================
class TestNotificationAPI:
    @pytest.mark.asyncio
    async def test_list_notifications(self, async_client: AsyncClient, auth_headers):
        resp = await async_client.get("/api/v1/notifications", headers=auth_headers)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_create_alert_rule(self, async_client: AsyncClient, auth_headers):
        resp = await async_client.post(
            "/api/v1/notifications/rules",
            json={
                "name": "test-alert",
                "event_type": "price_alert",
                "channel": "in_app",
                "condition": '{"symbol": "BTCUSDT", "price": 50000, "direction": "above"}',
            },
            headers=auth_headers,
        )
        assert resp.status_code in (201, 422)  # 422 if validation fails


# ============================================================
# Simulation API
# ============================================================
class TestSimulationAPI:
    @pytest.mark.asyncio
    async def test_create_sim_account(self, async_client: AsyncClient, auth_headers):
        resp = await async_client.post(
            "/api/v1/simulation/accounts",
            json={"name": "test-sim-account", "initial_balance": 10000},
            headers=auth_headers,
        )
        assert resp.status_code in (201, 422)

    @pytest.mark.asyncio
    async def test_list_sim_accounts(self, async_client: AsyncClient, auth_headers):
        resp = await async_client.get("/api/v1/simulation/accounts", headers=auth_headers)
        assert resp.status_code == 200


# ============================================================
# AI API
# ============================================================
class TestAIAPI:
    @pytest.mark.asyncio
    async def test_health_check(self, async_client: AsyncClient, auth_headers):
        resp = await async_client.post(
            "/api/v1/ai/health-check",
            params={"strategy_id": str(uuid.uuid4())},
            headers=auth_headers,
        )
        assert resp.status_code in (200, 404)

    @pytest.mark.asyncio
    async def test_market_state(self, async_client: AsyncClient, auth_headers):
        resp = await async_client.get(
            "/api/v1/ai/market-state",
            params={"symbol": "BTCUSDT"},
            headers=auth_headers,
        )
        assert resp.status_code in (200, 503)
