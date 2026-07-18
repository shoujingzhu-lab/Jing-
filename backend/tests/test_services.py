"""
交易服务单元测试
================
P2-007: 测试策略验证器、回测引擎、风控引擎状态管理。
"""

import json
import uuid

import pytest

from app.risk import RiskEngine


TEST_USER_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"


# ============================================================
# RiskEngine State Management
# ============================================================
class TestRiskEngineState:
    @pytest.fixture
    def engine(self):
        eng = RiskEngine()
        return eng

    async def test_reset_user_state_clears_daily_pnl(self, engine):
        engine._daily_pnl["test-user:2026-01-01"] = -500
        engine.reset_user_state("test-user")
        assert "test-user:2026-01-01" not in engine._daily_pnl

    async def test_reset_user_state_clears_consecutive_losses(self, engine):
        key = "test-user:strat-1"
        engine._consecutive_losses[key] = 3
        engine.reset_user_state("test-user")
        assert key not in engine._consecutive_losses

    async def test_reset_user_state_clears_equity(self, engine):
        engine._peak_equity["test-user"] = 10000
        engine._current_equity["test-user"] = 8000
        engine.reset_user_state("test-user")
        assert "test-user" not in engine._peak_equity
        assert "test-user" not in engine._current_equity

    async def test_on_trade_filled_updates_peak_equity(self, engine):
        await engine.on_trade_filled(
            "user-1", "strat-1",
            {"symbol": "BTC", "side": "buy", "pnl": 100, "price": 50000, "amount": 0.1},
        )
        assert engine._peak_equity.get("user-1", 0) == 100
        assert engine._current_equity.get("user-1", 0) == 100

    async def test_on_trade_filled_updates_peak_only_when_higher(self, engine):
        engine._peak_equity["user-1"] = 500
        engine._current_equity["user-1"] = 500
        await engine.on_trade_filled(
            "user-1", "strat-1",
            {"symbol": "BTC", "side": "buy", "pnl": -100, "price": 50000, "amount": 0.1},
        )
        # Peak should remain 500, current drops to 400
        assert engine._peak_equity["user-1"] == 500
        assert engine._current_equity["user-1"] == 400

    async def test_consecutive_loss_reset_on_profit(self, engine):
        key = "user-1:strat-1"
        engine._consecutive_losses[key] = 5
        await engine.on_trade_filled(
            "user-1", "strat-1",
            {"symbol": "BTC", "side": "buy", "pnl": 50, "price": 50000, "amount": 0.1},
        )
        assert engine._consecutive_losses[key] == 0


# ============================================================
# RiskEngine — Edge Cases
# ============================================================
class TestRiskEngineEdgeCases:
    @pytest.fixture
    def engine(self):
        return RiskEngine()

    async def test_daily_loss_zero_limit_passes(self, engine, sample_order):
        from app.models.risk import RiskRule
        rule = RiskRule()
        rule.scope = "account"
        rule.rule_type = "daily_loss_limit"
        rule.params = json.dumps({"limit": 0, "limit_type": "absolute"})
        rule.is_enabled = True
        rule.user_id = "test-user"

        engine._daily_pnl["test-user:2026-01-01"] = -10000
        passed, reason = await engine.pre_trade_check(
            "test-user", "strat-1", sample_order, [rule], [], None,
        )
        assert passed is True  # Zero limit = disabled

    async def test_max_position_no_price_estimation(self, engine, sample_order):
        from app.models.risk import RiskRule
        rule = RiskRule()
        rule.scope = "account"
        rule.rule_type = "max_position_pct"
        rule.params = json.dumps({"max_pct": 0.10})
        rule.is_enabled = True
        rule.user_id = "test-user"

        # No price in order → can't calculate position value
        order_no_price = {"symbol": "BTCUSDT", "side": "buy", "amount": 100}
        passed, reason = await engine.pre_trade_check(
            "test-user", "strat-1", order_no_price, [rule], [], None,
        )
        assert passed is True  # Safe default when can't calculate

    async def test_max_drawdown_no_equity_data_passes(self, engine, sample_order):
        from app.models.risk import RiskRule
        rule = RiskRule()
        rule.scope = "account"
        rule.rule_type = "max_drawdown"
        rule.params = json.dumps({"max_drawdown": 0.10})
        rule.is_enabled = True
        rule.user_id = "test-user"

        # No equity tracking data → pass
        passed, reason = await engine.pre_trade_check(
            "test-user", "strat-1", sample_order, [rule], [], None,
        )
        assert passed is True

    async def test_stop_loss_price_trigger(self, engine):
        from app.models.risk import RiskRule
        rule = RiskRule()
        rule.rule_type = "stop_loss"
        rule.params = json.dumps({"type": "price", "value": 45000})

        position = {
            "symbol": "BTCUSDT", "side": "long",
            "entry_price": 50000, "mark_price": 44000,
            "amount": 0.1, "unrealized_pnl": -600,
            "liquidation_price": 30000, "leverage": 3, "margin_ratio": 0.30,
        }
        actions = await engine.check_position_risk(position, [rule])
        assert any("止损" in a["reason"] for a in actions)

    async def test_take_profit_price_trigger(self, engine):
        from app.models.risk import RiskRule
        rule = RiskRule()
        rule.rule_type = "take_profit"
        rule.params = json.dumps({"type": "price", "value": 55000})

        position = {
            "symbol": "BTCUSDT", "side": "long",
            "entry_price": 50000, "mark_price": 56000,
            "amount": 0.1, "unrealized_pnl": 600,
            "liquidation_price": 30000, "leverage": 3, "margin_ratio": 0.40,
        }
        actions = await engine.check_position_risk(position, [rule])
        assert any("止盈" in a["reason"] for a in actions)

    async def test_short_position_stop_loss(self, engine):
        from app.models.risk import RiskRule
        rule = RiskRule()
        rule.rule_type = "stop_loss"
        rule.params = json.dumps({"type": "percent", "value": 0.05})

        position = {
            "symbol": "BTCUSDT", "side": "short",
            "entry_price": 50000, "mark_price": 53000,  # 6% against
            "amount": 0.1, "unrealized_pnl": -300,
            "liquidation_price": 60000, "leverage": 3, "margin_ratio": 0.25,
        }
        actions = await engine.check_position_risk(position, [rule])
        assert any("止损" in a["reason"] for a in actions)

    async def test_trailing_stop_long(self, engine):
        from app.models.risk import RiskRule
        rule = RiskRule()
        rule.rule_type = "trailing_stop"
        rule.params = json.dumps({
            "trail_percent": 0.05,
            "_highest_price": 55000,
        })

        position = {
            "symbol": "BTCUSDT", "side": "long",
            "entry_price": 50000, "mark_price": 52000,  # Dropped from 55000
            "amount": 0.1, "unrealized_pnl": 200,
            "liquidation_price": 30000, "leverage": 3, "margin_ratio": 0.40,
        }
        actions = await engine.check_position_risk(position, [rule])
        # 55000 * 0.95 = 52250, mark=52000 < 52250 → triggered
        assert len(actions) > 0
        assert any("移动止损" in a["reason"] for a in actions)

    async def test_margin_limit_check(self, engine, sample_order):
        from app.models.risk import RiskRule
        rule = RiskRule()
        rule.scope = "account"
        rule.rule_type = "margin_limit"
        rule.params = json.dumps({"margin_used": 8000, "margin_max": 10000})
        rule.is_enabled = True
        rule.user_id = "test-user"

        passed, reason = await engine.pre_trade_check(
            "test-user", "strat-1", sample_order, [rule], [], None,
        )
        assert passed is True  # Within margin limit

        rule2 = RiskRule()
        rule2.scope = "account"
        rule2.rule_type = "margin_limit"
        rule2.params = json.dumps({"margin_used": 12000, "margin_max": 10000})
        rule2.is_enabled = True
        rule2.user_id = "test-user"

        passed2, reason2 = await engine.pre_trade_check(
            "test-user", "strat-1", sample_order, [rule2], [], None,
        )
        assert passed2 is False
        assert "保证金" in reason2


# ============================================================
# Fixtures
# ============================================================
@pytest.fixture
def sample_order() -> dict:
    return {"symbol": "BTCUSDT", "side": "buy", "amount": 0.1, "price": 50000, "leverage": 3}
