"""
策略服务层
==========
模块二核心业务逻辑：CRUD、版本管理、克隆、代码导出、模板查询。
"""

import json
from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.trading import Strategy, StrategyVersion
from app.repositories.strategy import StrategyRepository, StrategyVersionRepository
from app.schemas.base import StrategyStatus, StrategyType
from app.schemas.strategy import (
    StrategyCreate,
    StrategyExportCodeResponse,
    StrategyUpdate,
)
from app.services.strategy_validator import validate_visual_graph
from app.services.strategy_codegen import generate_python_code


# ============================================================
# 自定义异常
# ============================================================
class StrategyError(Exception):
    """策略模块基类异常"""

    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code


class StrategyNotFoundError(StrategyError):
    """策略不存在 (404)"""

    def __init__(self, strategy_id: str = ""):
        super().__init__(
            f"策略 {strategy_id} 不存在或已删除" if strategy_id else "策略不存在",
            status_code=404,
        )


class StrategyPermissionDenied(StrategyError):
    """权限不足 (403)"""

    def __init__(self):
        super().__init__("没有权限访问该策略", status_code=403)


class StrategyValidationError(StrategyError):
    """策略验证失败 (422)"""

    def __init__(self, errors: list[str]):
        self.errors = errors
        super().__init__(
            f"策略验证失败: {'; '.join(errors[:3])}",
            status_code=422,
        )


# ============================================================
# 生命周期状态转换规则
# ============================================================
VALID_STATUS_TRANSITIONS: dict[str, set[str]] = {
    StrategyStatus.DRAFT: {StrategyStatus.BACKTESTED},
    StrategyStatus.BACKTESTED: {
        StrategyStatus.DRAFT,
        StrategyStatus.SIMULATED,
    },
    StrategyStatus.SIMULATED: {
        StrategyStatus.DRAFT,
        StrategyStatus.BACKTESTED,
        StrategyStatus.LIVE,
    },
    StrategyStatus.LIVE: {StrategyStatus.PAUSED},
    StrategyStatus.PAUSED: {
        StrategyStatus.LIVE,
        StrategyStatus.ARCHIVED,
    },
    StrategyStatus.ARCHIVED: set(),  # 终态，不可转换
}


# ============================================================
# StrategyService
# ============================================================
class StrategyService:
    """策略业务服务"""

    def __init__(self, db: AsyncSession, user_id: str):
        self.db = db
        self.user_id = user_id
        self.repo = StrategyRepository(db)
        self.version_repo = StrategyVersionRepository(db)

    # ---- 查询 ----

    async def list_by_user(
        self,
        page: int = 1,
        page_size: int = 20,
        status: Optional[str] = None,
        strategy_type: Optional[str] = None,
        search: Optional[str] = None,
    ) -> tuple[list[Strategy], int]:
        """查询当前用户的策略列表"""
        return await self.repo.list_by_user(
            user_id=self.user_id,
            page=page,
            page_size=page_size,
            status=status,
            strategy_type=strategy_type,
            search=search,
        )

    async def get(self, strategy_id: str) -> Strategy:
        """获取策略详情（含所有权校验）"""
        strategy = await self._get_or_404(strategy_id)
        self._check_ownership(strategy)
        return strategy

    async def list_templates(self) -> list[Strategy]:
        """获取系统策略模板"""
        return await self.repo.list_templates()

    async def list_versions(
        self, strategy_id: str, page: int = 1, page_size: int = 20
    ) -> tuple[list[StrategyVersion], int]:
        """获取策略版本历史"""
        strategy = await self._get_or_404(strategy_id)
        self._check_ownership(strategy)
        return await self.version_repo.list_by_strategy(strategy_id, page, page_size)

    # ---- 创建 ----

    async def create(self, data: StrategyCreate) -> Strategy:
        """创建新策略。

        - visual 类型：校验节点图
        - python 类型：跳过图校验
        - 自动创建 v1 版本记录
        """
        definition_json: Optional[str] = None
        if data.definition is not None:
            if data.strategy_type == StrategyType.VISUAL:
                errors, _warnings = validate_visual_graph(data.definition)
                if errors:
                    raise StrategyValidationError(errors)
            definition_json = json.dumps(data.definition, ensure_ascii=False)

        strategy = await self.repo.create(
            user_id=self.user_id,
            name=data.name,
            description=data.description,
            strategy_type=data.strategy_type.value,
            definition=definition_json,
            trade_type=data.trade_type.value,
            symbol_pool=(
                json.dumps(data.symbol_pool, ensure_ascii=False)
                if data.symbol_pool
                else None
            ),
            kline_interval=(
                data.kline_interval.value
                if hasattr(data.kline_interval, "value")
                else data.kline_interval
            ),
            tags=(
                json.dumps(data.tags, ensure_ascii=False)
                if data.tags
                else None
            ),
            status=StrategyStatus.DRAFT.value,
            version=1,
        )

        # 创建初始版本记录
        await self.version_repo.create(
            strategy_id=str(strategy.id),
            version=1,
            definition=definition_json or "{}",
            change_summary="初始版本",
            created_by=self.user_id,
        )

        return strategy

    # ---- 更新 ----

    async def update(self, strategy_id: str, data: StrategyUpdate) -> Strategy:
        """更新策略。

        - definition 变更时：校验 → 版本号+1 → 创建版本记录
        - status 变更时：校验状态转换合法性
        """
        strategy = await self._get_or_404(strategy_id)
        self._check_ownership(strategy)

        update_kwargs: dict = {}
        version_bump = False

        # ---- 逐字段处理 ----
        if data.name is not None:
            update_kwargs["name"] = data.name
        if data.description is not None:
            update_kwargs["description"] = data.description

        if data.definition is not None:
            if strategy.strategy_type == StrategyType.VISUAL.value:
                errors, _warnings = validate_visual_graph(data.definition)
                if errors:
                    raise StrategyValidationError(errors)
            update_kwargs["definition"] = json.dumps(data.definition, ensure_ascii=False)
            version_bump = True

        if data.trade_type is not None:
            update_kwargs["trade_type"] = data.trade_type.value
        if data.symbol_pool is not None:
            update_kwargs["symbol_pool"] = json.dumps(data.symbol_pool, ensure_ascii=False)
        if data.kline_interval is not None:
            update_kwargs["kline_interval"] = (
                data.kline_interval.value
                if hasattr(data.kline_interval, "value")
                else data.kline_interval
            )
        if data.tags is not None:
            update_kwargs["tags"] = json.dumps(data.tags, ensure_ascii=False)

        if data.status is not None:
            self._validate_status_transition(
                strategy.status, data.status.value
            )
            update_kwargs["status"] = data.status.value

        # ---- 执行更新 ----
        new_version = strategy.version
        if version_bump:
            new_version = strategy.version + 1
            update_kwargs["version"] = new_version

        updated = await self.repo.update(UUID(strategy_id), **update_kwargs)
        if updated is None:
            raise StrategyNotFoundError(strategy_id)

        # ---- 版本记录 ----
        if version_bump:
            await self.version_repo.create(
                strategy_id=strategy_id,
                version=new_version,
                definition=update_kwargs["definition"],
                change_summary=data.change_summary or f"更新至 v{new_version}",
                created_by=self.user_id,
            )

        return updated

    # ---- 删除 ----

    async def soft_delete(self, strategy_id: str) -> None:
        """软删除策略"""
        strategy = await self._get_or_404(strategy_id)
        self._check_ownership(strategy)
        await self.repo.soft_delete(UUID(strategy_id))

    # ---- 克隆 ----

    async def clone(
        self, strategy_id: str, name: Optional[str] = None
    ) -> Strategy:
        """克隆策略（来自用户策略或系统模板）"""
        source = await self.repo.get(UUID(strategy_id))
        if source is None or source.is_deleted:
            raise StrategyNotFoundError(strategy_id)

        # 用户可克隆自己的策略或系统模板
        if source.user_id is not None and str(source.user_id) != self.user_id:
            raise StrategyPermissionDenied()

        clone_name = name or f"{source.name} (Copy)"

        return await self.repo.create(
            user_id=self.user_id,
            name=clone_name,
            description=source.description,
            strategy_type=source.strategy_type,
            definition=source.definition,
            trade_type=source.trade_type,
            symbol_pool=source.symbol_pool,
            kline_interval=source.kline_interval,
            tags=source.tags,
            status=StrategyStatus.DRAFT.value,
            version=1,
        )

    # ---- 版本回滚 ----

    async def rollback(self, strategy_id: str, target_version: int) -> Strategy:
        """回滚到指定版本"""
        strategy = await self._get_or_404(strategy_id)
        self._check_ownership(strategy)

        version_record = await self.version_repo.get_version(
            strategy_id, target_version
        )
        if version_record is None:
            raise StrategyNotFoundError(f"版本 v{target_version}")

        # 校验回滚目标的 definition
        if strategy.strategy_type == StrategyType.VISUAL.value:
            definition = json.loads(version_record.definition) if version_record.definition else {}
            errors, _warnings = validate_visual_graph(definition)
            if errors:
                raise StrategyValidationError(errors)

        new_version = strategy.version + 1

        await self.repo.update(
            UUID(strategy_id),
            definition=version_record.definition,
            version=new_version,
        )

        await self.version_repo.create(
            strategy_id=strategy_id,
            version=new_version,
            definition=version_record.definition,
            change_summary=f"回滚至 v{target_version}",
            created_by=self.user_id,
        )

        updated = await self.repo.get(UUID(strategy_id))
        if updated is None:
            raise StrategyNotFoundError(strategy_id)
        return updated

    # ---- 代码导出 ----

    async def export_code(self, strategy_id: str) -> StrategyExportCodeResponse:
        """STG-014: 将可视化策略导出为 Python 代码"""
        strategy = await self._get_or_404(strategy_id)
        self._check_ownership(strategy)

        if strategy.strategy_type != StrategyType.VISUAL.value:
            raise StrategyError("只有可视化策略支持导出为代码", 400)

        definition = json.loads(strategy.definition) if strategy.definition else {}
        code, warning = generate_python_code(definition, strategy.name.replace(" ", ""))

        return StrategyExportCodeResponse(
            strategy_id=UUID(str(strategy.id)),
            strategy_name=strategy.name,
            strategy_type=strategy.strategy_type,
            python_code=code,
            warning=warning,
        )

    # ---- 内部辅助 ----

    async def _get_or_404(self, strategy_id: str) -> Strategy:
        """按 ID 获取策略，不存在或被删除则抛 404"""
        strategy = await self.repo.get(UUID(strategy_id))
        if strategy is None or strategy.is_deleted:
            raise StrategyNotFoundError(strategy_id)
        return strategy

    def _check_ownership(self, strategy: Strategy) -> None:
        """校验所有权：当前用户拥有策略 或 策略为系统模板"""
        if strategy.user_id is not None and str(strategy.user_id) != self.user_id:
            raise StrategyPermissionDenied()

    def _validate_status_transition(
        self, current: str, target: str
    ) -> None:
        """校验生命周期状态转换合法性"""
        allowed = VALID_STATUS_TRANSITIONS.get(current, set())
        if target not in allowed:
            raise StrategyError(
                f"不允许从 '{current}' 转换到 '{target}'。"
                f"允许的转换: {', '.join(sorted(allowed)) if allowed else '无（终态）'}",
                status_code=400,
            )
