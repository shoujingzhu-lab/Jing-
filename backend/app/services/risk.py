"""
风险控制服务
============
模块六：策略级/账户级/全局风控、熔断、实时监控。

RiskService = 管理面（规则 CRUD + 事件查询）
RiskEngine  = 执行面（实时决策，由 RiskService 桥接调用）
"""

import json
from datetime import datetime, UTC
from typing import Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.risk import CircuitBreaker, RiskEvent, RiskRule
from app.repositories import BaseRepository
from app.risk import risk_engine


class RiskService:
    """风控服务 — CRUD + 引擎桥接"""

    def __init__(self, db: AsyncSession, user_id: str):
        self.db = db
        self.user_id = user_id
        self.rule_repo = BaseRepository(db, RiskRule)
        self.event_repo = BaseRepository(db, RiskEvent)
        self.breaker_repo = BaseRepository(db, CircuitBreaker)

    # ================================================================
    # 规则 CRUD
    # ================================================================

    async def create_rule(self, scope: str, rule_type: str, params: dict,
                          strategy_id: Optional[str] = None) -> RiskRule:
        return await self.rule_repo.create(
            user_id=self.user_id, strategy_id=strategy_id, scope=scope,
            rule_type=rule_type, params=json.dumps(params),
        )

    async def list_rules(self) -> list[RiskRule]:
        stmt = select(RiskRule).where(
            RiskRule.user_id == self.user_id, RiskRule.is_enabled == True
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def update_rule(self, rule_id: str, params: dict) -> RiskRule:
        rule = await self.rule_repo.get(UUID(rule_id))
        if rule is None or str(rule.user_id) != self.user_id:
            raise ValueError("Rule not found")
        return await self.rule_repo.update(UUID(rule_id), params=json.dumps(params))

    async def delete_rule(self, rule_id: str):
        rule = await self.rule_repo.get(UUID(rule_id))
        if rule and str(rule.user_id) == self.user_id:
            await self.rule_repo.update(UUID(rule_id), is_enabled=False)

    # ================================================================
    # 熔断器管理
    # ================================================================

    async def list_circuit_breakers(self) -> list[CircuitBreaker]:
        stmt = select(CircuitBreaker).where(
            CircuitBreaker.user_id == self.user_id, CircuitBreaker.is_active == True
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def resolve_breaker(self, breaker_id: str):
        breaker = await self.breaker_repo.get(UUID(breaker_id))
        if breaker and str(breaker.user_id) == self.user_id:
            await self.breaker_repo.update(
                UUID(breaker_id),
                is_active=False,
                resolved_by=self.user_id,
                resolved_at=datetime.now(UTC),
            )

    # ================================================================
    # 引擎桥接 — 交易前检查
    # ================================================================

    async def run_pre_trade_check(
        self, strategy_id: str, order: dict
    ) -> tuple[bool, str]:
        """
        执行完整的风控前置检查（7 层链）。

        参数:
            strategy_id: 策略 ID
            order: 订单字典 {"symbol", "side", "amount", "price", "leverage"}

        返回:
            (通过?, 拒绝原因)
        """
        rules = await self._get_active_rules()
        breakers = await self._get_active_breakers()
        blacklist = await self.get_blacklist()

        passed, reason = await risk_engine.pre_trade_check(
            user_id=self.user_id,
            strategy_id=strategy_id,
            order=order,
            active_rules=rules,
            active_breakers=breakers,
            blacklist=blacklist,
        )

        if not passed:
            # 记录拒绝事件
            await self._create_event(
                event_type="pre_trade_rejected",
                detail=json.dumps({"order": order, "reason": reason}),
                severity="warning",
            )

        return passed, reason

    # ================================================================
    # 引擎桥接 — 成交后更新
    # ================================================================

    async def on_order_filled(self, strategy_id: str, fill: dict) -> list[str]:
        """
        订单成交后更新风控状态。

        参数:
            fill: {"symbol", "side", "pnl", "price", "amount"}

        返回:
            触发的告警列表
        """
        alerts = await risk_engine.on_trade_filled(
            user_id=self.user_id,
            strategy_id=strategy_id,
            fill=fill,
        )

        # 成交后检查是否触发新的熔断
        pnl = float(fill.get("pnl", 0))
        if pnl < 0:
            rules = await self._get_active_rules()
            for rule in rules:
                if rule.rule_type == "daily_loss_limit":
                    params = json.loads(rule.params) if isinstance(rule.params, str) else rule.params
                    limit = float(params.get("limit", 0))
                    if limit > 0 and abs(pnl) >= limit * 0.8:
                        await self._trigger_breaker(
                            scope=rule.scope,
                            strategy_id=str(rule.strategy_id) if rule.strategy_id else None,
                            reason=f"接近每日亏损限额（当前亏损已到达限额的 80%）",
                        )

        # 记录成交事件
        await self._create_event(
            event_type="trade_filled",
            detail=json.dumps(fill),
            severity="info",
        )

        return alerts

    # ================================================================
    # 引擎桥接 — 仓位风险检查
    # ================================================================

    async def run_position_risk_check(self, position: dict) -> list[dict]:
        """
        检查单个仓位的风控状态。

        参数:
            position: {"symbol", "side", "entry_price", "mark_price", "amount",
                       "unrealized_pnl", "liquidation_price", "leverage", "margin_ratio"}

        返回:
            触发的风控动作列表
        """
        rules = await self._get_active_rules()
        actions = await risk_engine.check_position_risk(position, rules)

        # 记录带严重级别的动作
        for action in actions:
            severity = action.get("severity", "warning")
            await self._create_event(
                event_type=action.get("action", "risk_triggered"),
                detail=json.dumps(action),
                severity=severity,
                symbol=position.get("symbol"),
            )

        return actions

    # ================================================================
    # 仪表盘 & 事件 & 黑名单
    # ================================================================

    async def get_dashboard(self) -> dict:
        """RISK-014: 风控仪表盘"""
        breakers = await self.list_circuit_breakers()
        events, _ = await self.list_events(page=1, page_size=50)
        rules = await self.list_rules()

        return {
            "active_circuit_breakers": len(breakers),
            "recent_events": len(events),
            "active_rules": len(rules),
            "positions_at_risk": 0,  # 对接持仓服务后可实现
            "margin_usage_pct": 0.0,
            "current_drawdown_pct": 0.0,
        }

    async def list_events(
        self, page: int = 1, page_size: int = 20
    ) -> tuple[list[RiskEvent], int]:
        filters = [RiskEvent.user_id == self.user_id]
        count_stmt = select(func.count()).select_from(RiskEvent).where(*filters)
        total = await self.db.scalar(count_stmt) or 0
        stmt = (
            select(RiskEvent)
            .where(*filters)
            .order_by(RiskEvent.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all()), total

    async def get_blacklist(self) -> list[str]:
        """RISK-012: 高风险交易对黑名单"""
        return []  # Admin-managed, placeholder

    # ================================================================
    # 内部辅助
    # ================================================================

    async def _get_active_rules(self) -> list[RiskRule]:
        """获取当前用户所有启用的风控规则（含全局/账户/策略级）"""
        # 查询所有启用的规则：用户自己的 + 全局模板（user_id IS NULL）
        stmt = select(RiskRule).where(
            (RiskRule.user_id == self.user_id) | (RiskRule.user_id.is_(None)),
            RiskRule.is_enabled == True,
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def _get_active_breakers(self) -> list[CircuitBreaker]:
        """获取当前用户所有活跃的熔断器"""
        stmt = select(CircuitBreaker).where(
            (CircuitBreaker.user_id == self.user_id) | (CircuitBreaker.user_id.is_(None)),
            CircuitBreaker.is_active == True,
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def _create_event(
        self,
        event_type: str,
        detail: str = "",
        severity: str = "warning",
        symbol: Optional[str] = None,
        strategy_id: Optional[str] = None,
    ):
        """创建风控事件记录"""
        await self.event_repo.create(
            user_id=self.user_id,
            strategy_id=strategy_id,
            event_type=event_type,
            symbol=symbol,
            detail=detail,
            severity=severity,
        )

    async def _trigger_breaker(
        self,
        scope: str,
        strategy_id: Optional[str] = None,
        reason: str = "",
    ):
        """触发熔断器"""
        await self.breaker_repo.create(
            user_id=self.user_id,
            scope=scope,
            strategy_id=strategy_id,
            trigger_reason=reason,
            is_active=True,
        )
