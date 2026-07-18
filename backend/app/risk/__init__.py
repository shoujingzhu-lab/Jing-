"""
风控引擎
========
实时风险监控、熔断、止损止盈执行。

RiskEngine 作为有状态单例引擎：
- pre_trade_check: 下单前 7 层风控检查链
- on_trade_filled: 成交后更新 PnL 追踪
- check_position_risk: 仓位级别止盈止损/强平预警

与 RiskService (DB CRUD) 分离——Engine 负责实时决策，Service 负责规则管理。
"""

import json
from datetime import datetime, UTC
from typing import Optional

from app.models.risk import CircuitBreaker, RiskEvent, RiskRule


class RiskEngine:
    """风控引擎 — 交易前/中/后全链路风险检查"""

    def __init__(self):
        # 内存状态追踪（避免每次检查都查 DB）
        self._daily_pnl: dict[str, float] = {}  # key: f"{user_id}:{date}" → PnL
        self._consecutive_losses: dict[str, int] = {}  # key: f"{user_id}:{strategy_id}" → count
        self._peak_equity: dict[str, float] = {}  # key: user_id → peak equity
        self._current_equity: dict[str, float] = {}  # key: user_id → current equity

    # ================================================================
    # 交易前检查（7 层检查链）
    # ================================================================

    async def pre_trade_check(
        self,
        user_id: str,
        strategy_id: str,
        order: dict,
        active_rules: list[RiskRule],
        active_breakers: list[CircuitBreaker],
        blacklist: list[str] | None = None,
    ) -> tuple[bool, str]:
        """
        交易前风控检查（7 层检查链）。

        参数:
            user_id: 用户 ID
            strategy_id: 策略 ID
            order: 订单字典 {"symbol", "side", "amount", "price", "leverage"}
            active_rules: 该用户/策略/全局的所有启用规则
            active_breakers: 该用户/策略/全局的所有活跃熔断器
            blacklist: 黑名单交易对列表

        返回:
            (通过?, 拒绝原因)
        """
        symbol = order.get("symbol", "")

        # ---- 第 1 层：全局熔断器 ----
        for breaker in active_breakers:
            if breaker.scope == "global" and breaker.is_active:
                return False, f"全局熔断已触发: {breaker.trigger_reason}"

        # ---- 第 2 层：账户级熔断器 ----
        for breaker in active_breakers:
            if breaker.scope == "account" and breaker.is_active:
                return False, f"账户熔断已触发: {breaker.trigger_reason}"

        # ---- 第 3 层：策略级熔断器 ----
        for breaker in active_breakers:
            if breaker.scope == "strategy" and str(breaker.strategy_id) == strategy_id and breaker.is_active:
                return False, f"策略熔断已触发: {breaker.trigger_reason}"

        # ---- 第 4-7 层：规则检查 ----
        for rule in active_rules:
            if not rule.is_enabled:
                continue

            # 按 scope 过滤：global/account 级别对所有生效；strategy 级别只对绑定策略生效
            if rule.scope == "strategy" and str(rule.strategy_id or "") != strategy_id:
                continue

            params = self._parse_params(rule.params)

            if rule.rule_type == "stop_loss":
                # 止损规则在 pre_trade 中不直接拒绝，由 check_position_risk 处理
                continue

            elif rule.rule_type == "take_profit":
                continue  # 同上

            elif rule.rule_type == "trailing_stop":
                continue  # 同上

            elif rule.rule_type == "daily_loss_limit":
                passed, reason = self._check_daily_loss(user_id, params)
                if not passed:
                    return False, reason

            elif rule.rule_type == "consecutive_loss_limit":
                key = f"{user_id}:{strategy_id}"
                max_losses = int(params.get("max_count", 5))
                if self._consecutive_losses.get(key, 0) >= max_losses:
                    return False, f"连续亏损已达 {max_losses} 次，暂停交易"

            elif rule.rule_type == "max_drawdown":
                passed, reason = self._check_max_drawdown(user_id, params)
                if not passed:
                    return False, reason

            elif rule.rule_type == "max_position_pct":
                passed, reason = self._check_max_position(user_id, order, params)
                if not passed:
                    return False, reason

            elif rule.rule_type == "margin_limit":
                passed, reason = self._check_margin(user_id, params)
                if not passed:
                    return False, reason

        # ---- 第 7 层：黑名单交易对 ----
        if blacklist and symbol in blacklist:
            return False, f"交易对 {symbol} 在风控黑名单中"

        return True, ""

    # ================================================================
    # 交易成交后更新
    # ================================================================

    async def on_trade_filled(
        self,
        user_id: str,
        strategy_id: str,
        fill: dict,
    ) -> list[str]:
        """
        交易成交后更新风控状态。

        参数:
            fill: {"symbol", "side", "pnl", "price", "amount"}

        返回:
            触发的告警列表
        """
        alerts: list[str] = []
        pnl = float(fill.get("pnl", 0))

        # 更新每日 PnL
        today = datetime.now(UTC).strftime("%Y-%m-%d")
        daily_key = f"{user_id}:{today}"
        self._daily_pnl[daily_key] = self._daily_pnl.get(daily_key, 0.0) + pnl

        # 更新连续盈亏计数
        loss_key = f"{user_id}:{strategy_id}"
        if pnl < 0:
            self._consecutive_losses[loss_key] = self._consecutive_losses.get(loss_key, 0) + 1
        else:
            self._consecutive_losses[loss_key] = 0

        # 更新权益追踪
        self._current_equity[user_id] = self._current_equity.get(user_id, 0.0) + pnl
        current = self._current_equity[user_id]
        # 初始峰值从 0 开始比较，确保首笔盈利交易能设置峰值
        peak = self._peak_equity.get(user_id, 0)
        if current > peak:
            self._peak_equity[user_id] = current

        return alerts

    # ================================================================
    # 仓位风险检查
    # ================================================================

    async def check_position_risk(
        self,
        position: dict,
        active_rules: list[RiskRule],
    ) -> list[dict]:
        """
        检查单个仓位的风控状态。

        参数:
            position: {"symbol", "side", "entry_price", "mark_price", "amount",
                       "unrealized_pnl", "liquidation_price", "leverage", "margin_ratio"}
            active_rules: 启用的风控规则列表

        返回:
            触发的风控动作列表 [{"action": "close_long"/"close_short", "reason": "..."}]
        """
        actions: list[dict] = []
        symbol = position.get("symbol", "")
        entry_price = float(position.get("entry_price", 0))
        mark_price = float(position.get("mark_price", 0))
        side = position.get("side", "long")
        unrealized_pnl = float(position.get("unrealized_pnl", 0))
        liquidation_price = float(position.get("liquidation_price", 0))
        margin_ratio = float(position.get("margin_ratio", 1.0))

        for rule in active_rules:
            if not rule.is_enabled:
                continue

            params = self._parse_params(rule.params)

            if rule.rule_type == "stop_loss":
                result = self._eval_stop_loss(entry_price, mark_price, side, unrealized_pnl, params)
                if result:
                    actions.append(result)

            elif rule.rule_type == "take_profit":
                result = self._eval_take_profit(entry_price, mark_price, side, unrealized_pnl, params)
                if result:
                    actions.append(result)

            elif rule.rule_type == "trailing_stop":
                result = self._eval_trailing_stop(entry_price, mark_price, side, params)
                if result:
                    actions.append(result)

        # 强平预警（与规则无关，始终检查）
        if liquidation_price > 0:
            if side == "long" and mark_price <= liquidation_price * 1.05:
                actions.append({
                    "action": "close_long",
                    "reason": f"接近强平价格 {liquidation_price}，当前 {mark_price}",
                    "severity": "critical",
                })
            elif side == "short" and mark_price >= liquidation_price * 0.95:
                actions.append({
                    "action": "close_short",
                    "reason": f"接近强平价格 {liquidation_price}，当前 {mark_price}",
                    "severity": "critical",
                })

        # 保证金率预警
        if margin_ratio < 0.15:
            actions.append({
                "action": "reduce_position",
                "reason": f"保证金率仅 {margin_ratio:.1%}，面临强平风险",
                "severity": "critical",
            })
        elif margin_ratio < 0.25:
            actions.append({
                "action": "warning",
                "reason": f"保证金率偏低 {margin_ratio:.1%}",
                "severity": "warning",
            })

        return actions

    # ================================================================
    # 重置追踪状态
    # ================================================================

    def reset_user_state(self, user_id: str):
        """重置用户的风控追踪状态（用于测试或手动重置）"""
        keys_to_del = []
        for key in self._daily_pnl:
            if key.startswith(f"{user_id}:"):
                keys_to_del.append(key)
        for key in keys_to_del:
            del self._daily_pnl[key]

        keys_to_del = []
        for key in self._consecutive_losses:
            if key.startswith(f"{user_id}:"):
                keys_to_del.append(key)
        for key in keys_to_del:
            del self._consecutive_losses[key]

        self._peak_equity.pop(user_id, None)
        self._current_equity.pop(user_id, None)

    # ================================================================
    # 内部检查方法
    # ================================================================

    def _check_daily_loss(self, user_id: str, params: dict) -> tuple[bool, str]:
        """检查每日亏损限额"""
        limit = float(params.get("limit", 0))
        limit_type = params.get("limit_type", "absolute")  # absolute | percent
        if limit <= 0:
            return True, ""

        today = datetime.now(UTC).strftime("%Y-%m-%d")
        daily_key = f"{user_id}:{today}"
        loss = abs(min(0, self._daily_pnl.get(daily_key, 0.0)))

        if limit_type == "absolute":
            if loss >= limit:
                return False, f"当日亏损 ${loss:.2f} 已超过限额 ${limit:.2f}"
        elif limit_type == "percent":
            equity = self._current_equity.get(user_id, 10000)
            loss_pct = loss / max(equity, 1)
            if loss_pct >= limit:
                return False, f"当日亏损 {loss_pct:.2%} 已超过限额 {limit:.2%}"

        return True, ""

    def _check_max_drawdown(self, user_id: str, params: dict) -> tuple[bool, str]:
        """检查最大回撤"""
        max_dd = float(params.get("max_drawdown", 0.30))
        peak = self._peak_equity.get(user_id)
        current = self._current_equity.get(user_id)

        if peak is None or current is None or peak <= 0:
            return True, ""

        drawdown = (peak - current) / peak
        if drawdown >= max_dd:
            return False, f"当前回撤 {drawdown:.2%} 已超过限额 {max_dd:.2%}"

        return True, ""

    def _check_max_position(self, user_id: str, order: dict, params: dict) -> tuple[bool, str]:
        """检查最大仓位百分比"""
        max_pct = float(params.get("max_pct", 0.10))
        amount = float(order.get("amount", 0))
        equity = self._current_equity.get(user_id, 10000)

        # 简化估算：假设 order["price"] 存在
        price = float(order.get("price", 0))
        if price > 0 and equity > 0:
            position_value = amount * price
            pct = position_value / equity
            if pct > max_pct:
                return False, f"仓位 {pct:.2%} 超过上限 {max_pct:.2%}"

        return True, ""

    def _check_margin(self, user_id: str, params: dict) -> tuple[bool, str]:
        """检查保证金使用率"""
        margin_used = float(params.get("margin_used", 0))
        margin_max = float(params.get("margin_max", 0))
        if margin_max > 0 and margin_used > margin_max:
            return False, f"保证金使用 {margin_used:.2f} 超过上限 {margin_max:.2f}"
        return True, ""

    def _eval_stop_loss(
        self, entry_price: float, mark_price: float, side: str,
        unrealized_pnl: float, params: dict,
    ) -> dict | None:
        """评估止损触发"""
        sl_type = params.get("type", "percent")
        if sl_type == "percent":
            sl_pct = float(params.get("value", 0.05))
            if side == "long" and unrealized_pnl < 0:
                loss_pct = abs(unrealized_pnl) / (entry_price * 1)
                if loss_pct >= sl_pct:
                    return {"action": "close_long", "reason": f"止损触发（{loss_pct:.2%}）"}
            elif side == "short" and unrealized_pnl < 0:
                loss_pct = abs(unrealized_pnl) / (entry_price * 1)
                if loss_pct >= sl_pct:
                    return {"action": "close_short", "reason": f"止损触发（{loss_pct:.2%}）"}
        elif sl_type == "price":
            sl_price = float(params.get("value", 0))
            if sl_price > 0:
                if side == "long" and mark_price <= sl_price:
                    return {"action": "close_long", "reason": f"止损价 {sl_price} 触发"}
                elif side == "short" and mark_price >= sl_price:
                    return {"action": "close_short", "reason": f"止损价 {sl_price} 触发"}
        return None

    def _eval_take_profit(
        self, entry_price: float, mark_price: float, side: str,
        unrealized_pnl: float, params: dict,
    ) -> dict | None:
        """评估止盈触发"""
        tp_type = params.get("type", "percent")
        if tp_type == "percent":
            tp_pct = float(params.get("value", 0.10))
            if unrealized_pnl > 0:
                gain_pct = unrealized_pnl / (entry_price * 1)
                if gain_pct >= tp_pct:
                    if side == "long":
                        return {"action": "close_long", "reason": f"止盈触发（{gain_pct:.2%}）"}
                    else:
                        return {"action": "close_short", "reason": f"止盈触发（{gain_pct:.2%}）"}
        elif tp_type == "price":
            tp_price = float(params.get("value", 0))
            if tp_price > 0:
                if side == "long" and mark_price >= tp_price:
                    return {"action": "close_long", "reason": f"止盈价 {tp_price} 触发"}
                elif side == "short" and mark_price <= tp_price:
                    return {"action": "close_short", "reason": f"止盈价 {tp_price} 触发"}
        return None

    def _eval_trailing_stop(
        self, entry_price: float, mark_price: float, side: str, params: dict,
    ) -> dict | None:
        """评估移动止损触发"""
        trail_pct = float(params.get("trail_percent", 0.05))
        if side == "long":
            # 移动止损：从最高点回落 N%
            highest = float(params.get("_highest_price", entry_price))
            stop_price = highest * (1 - trail_pct)
            if mark_price <= stop_price:
                return {"action": "close_long", "reason": f"移动止损触发（从 {highest} 回落 {trail_pct:.2%}）"}
        elif side == "short":
            lowest = float(params.get("_lowest_price", entry_price))
            stop_price = lowest * (1 + trail_pct)
            if mark_price >= stop_price:
                return {"action": "close_short", "reason": f"移动止损触发（从 {lowest} 反弹 {trail_pct:.2%}）"}
        return None

    @staticmethod
    def _parse_params(params) -> dict:
        """安全解析规则参数（可能是 JSON 字符串或已解析的 dict）"""
        if isinstance(params, dict):
            return params
        if isinstance(params, str):
            try:
                return json.loads(params)
            except (json.JSONDecodeError, TypeError):
                return {}
        return {}


# ================================================================
# 全局单例
# ================================================================
risk_engine = RiskEngine()
