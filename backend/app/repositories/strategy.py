"""
策略仓储层
==========
策略与策略版本的专用查询与操作方法。
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import func, select

from app.models.trading import Strategy, StrategyVersion
from app.repositories import BaseRepository


class StrategyRepository(BaseRepository[Strategy]):
    """策略仓储"""

    def __init__(self, db):
        super().__init__(db, Strategy)

    async def list_by_user(
        self,
        user_id: str,
        page: int = 1,
        page_size: int = 20,
        status: Optional[str] = None,
        strategy_type: Optional[str] = None,
        search: Optional[str] = None,
    ) -> tuple[list[Strategy], int]:
        """查询用户策略列表（排除已删除）"""
        filters = [
            Strategy.user_id == user_id,
            Strategy.is_deleted == False,
        ]
        if status:
            filters.append(Strategy.status == status)
        if strategy_type:
            filters.append(Strategy.strategy_type == strategy_type)
        if search:
            filters.append(Strategy.name.ilike(f"%{search}%"))

        return await self.list(
            *filters,
            page=page,
            page_size=page_size,
            order_by=Strategy.updated_at.desc(),
        )

    async def soft_delete(self, id: UUID) -> Optional[Strategy]:
        """软删除策略"""
        instance = await self.get(id)
        if instance is None:
            return None
        instance.is_deleted = True
        instance.deleted_at = datetime.utcnow()
        await self.db.flush()
        return instance

    async def list_templates(self) -> list[Strategy]:
        """查询所有系统模板（user_id IS NULL）"""
        stmt = (
            select(Strategy)
            .where(
                Strategy.user_id.is_(None),
                Strategy.is_deleted == False,
            )
            .order_by(Strategy.name)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())


class StrategyVersionRepository(BaseRepository[StrategyVersion]):
    """策略版本仓储"""

    def __init__(self, db):
        super().__init__(db, StrategyVersion)

    async def list_by_strategy(
        self, strategy_id: str, page: int = 1, page_size: int = 20
    ) -> tuple[list[StrategyVersion], int]:
        """查询某个策略的版本历史"""
        filters = [StrategyVersion.strategy_id == strategy_id]
        return await self.list(
            *filters,
            page=page,
            page_size=page_size,
            order_by=StrategyVersion.version.desc(),
        )

    async def get_version(
        self, strategy_id: str, version: int
    ) -> Optional[StrategyVersion]:
        """按策略ID+版本号查询"""
        stmt = select(StrategyVersion).where(
            StrategyVersion.strategy_id == strategy_id,
            StrategyVersion.version == version,
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_latest_version_number(self, strategy_id: str) -> int:
        """获取策略最新版本号"""
        stmt = (
            select(func.max(StrategyVersion.version))
            .where(StrategyVersion.strategy_id == strategy_id)
        )
        result = await self.db.scalar(stmt)
        return result or 0
