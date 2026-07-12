"""
数据仓储层
==========
泛型异步 CRUD 基类 + 各模块 Repository。
"""

from typing import Generic, Optional, TypeVar
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

ModelType = TypeVar("ModelType")


class BaseRepository(Generic[ModelType]):
    """泛型异步 CRUD 仓储基类"""

    def __init__(self, db: AsyncSession, model: type[ModelType]):
        self.db = db
        self.model = model

    async def get(self, id: UUID) -> Optional[ModelType]:
        """按主键查询单条记录"""
        stmt = select(self.model).where(self.model.id == id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list(
        self,
        *filters,
        page: int = 1,
        page_size: int = 20,
        order_by=None,
    ) -> tuple[list[ModelType], int]:
        """分页查询，返回 (items, total)"""
        # 计数
        count_stmt = select(func.count()).select_from(self.model).where(*filters)
        total = await self.db.scalar(count_stmt) or 0

        # 获取分页数据
        stmt = select(self.model).where(*filters)
        if order_by is not None:
            stmt = stmt.order_by(order_by)
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)
        result = await self.db.execute(stmt)
        items = list(result.scalars().all())

        return items, total

    async def create(self, **kwargs) -> ModelType:
        """创建记录（需调用方 flush/commit）"""
        instance = self.model(**kwargs)
        self.db.add(instance)
        await self.db.flush()
        return instance

    async def update(self, id: UUID, **kwargs) -> Optional[ModelType]:
        """部分更新记录"""
        instance = await self.get(id)
        if instance is None:
            return None
        for key, value in kwargs.items():
            if value is not None:
                setattr(instance, key, value)
        await self.db.flush()
        # 刷新实例以获取服务端生成的值（如 onupdate 时间戳），
        # 避免 Pydantic model_validate 时触发 MissingGreenlet
        await self.db.refresh(instance)
        return instance

    async def delete(self, id: UUID) -> bool:
        """硬删除记录"""
        instance = await self.get(id)
        if instance is None:
            return False
        await self.db.delete(instance)
        await self.db.flush()
        return True
