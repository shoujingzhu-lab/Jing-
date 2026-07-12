"""
数据库配置模块
============
异步 SQLAlchemy 引擎 + 会话管理 + Base 声明式基类。
支持 PostgreSQL（主库）+ TimescaleDB（时序数据）。
"""

from typing import AsyncGenerator, Optional

from sqlalchemy import NullPool, text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


class Base(DeclarativeBase):
    """SQLAlchemy 声明式基类 — 所有 ORM 模型继承此类"""
    pass


# ============================================================
# 主库引擎 (PostgreSQL — 业务数据)
# ============================================================
main_engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DATABASE_ECHO,
    pool_size=settings.DATABASE_POOL_SIZE,
    max_overflow=settings.DATABASE_MAX_OVERFLOW,
    pool_pre_ping=True,
    pool_recycle=3600,
)

main_async_session = async_sessionmaker(
    main_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


# ============================================================
# 时序库引擎 (TimescaleDB — K线、订单簿、逐笔成交)
# ============================================================
timescale_engine = create_async_engine(
    settings.TIMESCALE_URL,
    echo=settings.DATABASE_ECHO,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    pool_recycle=3600,
)

timescale_async_session = async_sessionmaker(
    timescale_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


# ============================================================
# 依赖注入 — 获取数据库会话
# ============================================================
async def get_main_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI 依赖：注入主库会话"""
    async with main_async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def get_timescale_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI 依赖：注入时序库会话"""
    async with timescale_async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def check_database_connection() -> dict:
    """检查数据库连接状态"""
    result = {"main": "unknown", "timescale": "unknown"}
    try:
        async with main_engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
            result["main"] = "connected"
    except Exception as e:
        result["main"] = f"error: {e}"

    try:
        async with timescale_engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
            result["timescale"] = "connected"
    except Exception as e:
        result["timescale"] = f"error: {e}"

    return result


async def close_database_connections():
    """关闭所有数据库连接（应用关闭时调用）"""
    await main_engine.dispose()
    await timescale_engine.dispose()
