"""
风控引擎测试
============
测试: RiskEngine 7 层检查链、RiskService 引擎桥接、API 端点。
"""

import json

import pytest
from httpx import AsyncClient

from app.core.security import create_access_token
from app.risk import RiskEngine
from app.models.risk import RiskRule, CircuitBreaker

TEST_USER_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"


# ============================================================
# Fixtures
# ============================================================
@pytest.fixture
def auth_headers() -> dict:
    token = create_access_token(subject=TEST_USER_ID)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def engine():
    """每次测试用全新引擎"""
    return RiskEngine()


@pytest.fixture
def sample_order() -> dict:
    return {"symbol": "BTCUSDT", "side": "buy", "amount": 0.1, "price": 50000, "leverage": 3}


@pytest.fixture
def sample_position() -> dict:
    return {
        "symbol": "BTCUSDT", "side": "long", "entry_price": 50000,
        "mark_price": 49000, "amount": 0.1, "unrealized_pnl": -100,
        "liquidation_price": 42000, "leverage": 3, "margin_ratio": 0.30,
    }


# ============================================================
# 辅助函数
# ============================================================
def _make_rule(scope="strategy", rule_type="daily_loss_limit", params=None, strategy_id=None, enabled=True):
    rule = RiskRule()
    rule.scope = scope
    rule.rule_type = rule_type
    rule.params = json.dumps(params or {})
    rule.is_enabled = enabled
    rule.user_id = TEST_USER_ID
    rule.strategy_id = strategy_id
    return rule


def _make_breaker(scope="global", reason="test", active=True, strategy_id=None):
    breaker = CircuitBreaker()
    breaker.scope = scope
    breaker.trigger_reason = reason
    breaker.is_active = active
    breaker.user_id = TEST_USER_ID
    breaker.strategy_id = strategy_id
    return breaker


# ============================================================
# 交易前检查 — 熔断器
# ============================================================
class TestCircuitBreaker:
    async def test_no_rules_passes(self, engine, sample_order):
        passed, reason = await engine.pre_trade_check(
            TEST_USER_ID, "strategy-1", sample_order, [], [], None,
        )
        assert passed is True
        assert reason == ""

    async def test_global_breaker_rejects(self, engine, sample_order):
        breaker = _make_breaker(scope="global", reason="系统全局熔断")
        passed, reason = await engine.pre_trade_check(
            TEST_USER_ID, "strategy-1", sample_order, [], [breaker], None,
        )
        assert passed is False
        assert "全局熔断" in reason

    async def test_account_breaker_rejects(self, engine, sample_order):
        breaker = _make_breaker(scope="account", reason="账户熔断")
        passed, reason = await engine.pre_trade_check(
            TEST_USER_ID, "strategy-1", sample_order, [], [breaker], None,
        )
        assert passed is False
        assert "账户熔断" in reason

    async def test_strategy_breaker_rejects_matching_strategy(self, engine, sample_order):
        breaker = _make_breaker(scope="strategy", reason="策略熔断", strategy_id="strategy-1")
        passed, reason = await engine.pre_trade_check(
            TEST_USER_ID, "strategy-1", sample_order, [], [breaker], None,
        )
        assert passed is False

    async def test_strategy_breaker_ignores_other_strategy(self, engine, sample_order):
        breaker = _make_breaker(scope="strategy", reason="策略熔断", strategy_id="strategy-2")
        passed, reason = await engine.pre_trade_check(
            TEST_USER_ID, "strategy-1", sample_order, [], [breaker], None,
        )
        assert passed is True


# ============================================================
# 交易前检查 — 规则
# ============================================================
class TestPreTradeRules:
    async def test_daily_loss_limit_exceeded(self, engine, sample_order):
        from datetime import datetime, UTC
        today = datetime.now(UTC).strftime("%Y-%m-%d")
        engine._daily_pnl[f"test-user:{today}"] = -600
        rule = _make_rule(scope="account", rule_type="daily_loss_limit", params={"limit": 500, "limit_type": "absolute"})
        passed, reason = await engine.pre_trade_check(
            "test-user", "strategy-1", sample_order, [rule], [], None,
        )
        assert passed is False
        assert "亏损" in reason

    async def test_daily_loss_within_limit(self, engine, sample_order):
        from datetime import datetime, UTC
        today = datetime.now(UTC).strftime("%Y-%m-%d")
        engine._daily_pnl[f"test-user:{today}"] = -100
        rule = _make_rule(scope="account", rule_type="daily_loss_limit", params={"limit": 500, "limit_type": "absolute"})
        passed, reason = await engine.pre_trade_check(
            "test-user", "strategy-1", sample_order, [rule], [], None,
        )
        assert passed is True

    async def test_consecutive_loss_exceeded(self, engine, sample_order):
        key = "test-user:strategy-1"
        engine._consecutive_losses[key] = 5
        rule = _make_rule(scope="account", rule_type="consecutive_loss_limit", params={"max_count": 5})
        passed, reason = await engine.pre_trade_check(
            "test-user", "strategy-1", sample_order, [rule], [], None,
        )
        assert passed is False
        assert "连续亏损" in reason

    async def test_max_drawdown_exceeded(self, engine, sample_order):
        engine._peak_equity["test-user"] = 10000
        engine._current_equity["test-user"] = 6000  # 40% drawdown
        rule = _make_rule(scope="account", rule_type="max_drawdown", params={"max_drawdown": 0.30})
        passed, reason = await engine.pre_trade_check(
            "test-user", "strategy-1", sample_order, [rule], [], None,
        )
        assert passed is False
        assert "回撤" in reason

    async def test_blacklist_rejects(self, engine, sample_order):
        passed, reason = await engine.pre_trade_check(
            "test-user", "strategy-1", sample_order, [], [], ["BTCUSDT"],
        )
        assert passed is False
        assert "黑名单" in reason

    async def test_strategy_scoped_rule_ignores_other_strategies(self, engine, sample_order):
        rule = _make_rule(scope="strategy", rule_type="daily_loss_limit",
                          params={"limit": 500}, strategy_id="strategy-2")
        engine._daily_pnl["test-user:2026-06-08"] = -1000
        # strategy-1 不受 strategy-2 的规则限制
        passed, reason = await engine.pre_trade_check(
            "test-user", "strategy-1", sample_order, [rule], [], None,
        )
        assert passed is True

    async def test_disabled_rule_ignored(self, engine, sample_order):
        rule = _make_rule(rule_type="consecutive_loss_limit",
                          params={"max_count": 3}, enabled=False)
        engine._consecutive_losses["test-user:strategy-1"] = 10
        passed, reason = await engine.pre_trade_check(
            "test-user", "strategy-1", sample_order, [rule], [], None,
        )
        assert passed is True


# ============================================================
# 成交后更新
# ============================================================
class TestOnTradeFilled:
    async def test_profitable_trade_resets_loss_counter(self, engine):
        key = "test-user:strategy-1"
        engine._consecutive_losses[key] = 3
        await engine.on_trade_filled("test-user", "strategy-1",
                                     {"symbol": "BTC", "side": "buy", "pnl": 50, "price": 50000, "amount": 0.1})
        assert engine._consecutive_losses[key] == 0

    async def test_losing_trade_increments_counter(self, engine):
        key = "test-user:strategy-1"
        engine._consecutive_losses[key] = 1
        await engine.on_trade_filled("test-user", "strategy-1",
                                     {"symbol": "BTC", "side": "buy", "pnl": -20, "price": 50000, "amount": 0.1})
        assert engine._consecutive_losses[key] == 2

    async def test_updates_daily_pnl(self, engine):
        await engine.on_trade_filled("test-user", "strategy-1",
                                     {"symbol": "BTC", "side": "buy", "pnl": -30, "price": 50000, "amount": 0.1})
        # daily_pnl should have an entry for today
        from datetime import datetime, UTC
        today = datetime.now(UTC).strftime("%Y-%m-%d")
        key = f"test-user:{today}"
        assert engine._daily_pnl.get(key, 0) == -30


# ============================================================
# 仓位风险检查
# ============================================================
class TestPositionRisk:
    async def test_no_rules_no_actions(self, engine, sample_position):
        actions = await engine.check_position_risk(sample_position, [])
        assert len(actions) == 0

    async def test_stop_loss_percent_triggered(self, engine, sample_position):
        # entry=50000 → 亏损 $2500 = 5%
        position = {**sample_position, "entry_price": 50000, "mark_price": 45000,
                    "unrealized_pnl": -2500, "side": "long"}
        rule = _make_rule(rule_type="stop_loss", params={"type": "percent", "value": 0.04})
        actions = await engine.check_position_risk(position, [rule])
        assert len(actions) >= 1
        assert any("止损" in a["reason"] for a in actions)

    async def test_take_profit_triggered(self, engine, sample_position):
        # entry=50000 → 盈利 $1000 = 2%
        position = {**sample_position, "entry_price": 50000, "mark_price": 56000,
                    "unrealized_pnl": 1000, "side": "long"}
        rule = _make_rule(rule_type="take_profit", params={"type": "percent", "value": 0.01})
        actions = await engine.check_position_risk(position, [rule])
        assert len(actions) >= 1
        assert any("止盈" in a["reason"] for a in actions)

    async def test_liquidation_warning(self, engine, sample_position):
        position = {**sample_position, "liquidation_price": 48100, "mark_price": 48500, "side": "long"}
        actions = await engine.check_position_risk(position, [])
        # 强平价 48100，现价 48500，距强平仅 400/48100 ≈ 0.8%
        assert any("强平" in a["reason"] for a in actions)

    async def test_low_margin_warning(self, engine, sample_position):
        position = {**sample_position, "margin_ratio": 0.10}
        actions = await engine.check_position_risk(position, [])
        assert any("保证金" in a["reason"] for a in actions)


# ============================================================
# API 集成测试
# ============================================================
class TestRiskAPI:
    async def test_create_and_list_rule(self, async_client: AsyncClient, auth_headers: dict, seed_test_user):
        resp = await async_client.post(
            "/api/v1/risk/rules",
            params={
                "scope": "global",
                "rule_type": "daily_loss_limit",
                "params": '{"limit": 1000, "limit_type": "absolute"}',
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201

        # list
        resp2 = await async_client.get("/api/v1/risk/rules", headers=auth_headers)
        assert resp2.status_code == 200

    async def test_pre_check_endpoint(self, async_client: AsyncClient, auth_headers: dict, seed_test_user):
        resp = await async_client.post(
            "/api/v1/risk/pre-check",
            params={
                "strategy_id": "00000000-0000-0000-0000-000000000001",
                "symbol": "BTCUSDT",
                "side": "buy",
                "amount": 0.1,
                "price": 50000,
            },
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["data"]["passed"] is True

    async def test_check_position_endpoint(self, async_client: AsyncClient, auth_headers: dict, seed_test_user):
        resp = await async_client.post(
            "/api/v1/risk/check-position",
            params={
                "symbol": "BTCUSDT",
                "side": "long",
                "entry_price": 50000,
                "mark_price": 49000,
                "amount": 0.1,
                "unrealized_pnl": -100,
            },
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        # 无规则时应该 safe
        assert data["data"]["safe"] is True
