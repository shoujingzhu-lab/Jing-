"""
Pytest 全局配置与 Fixtures
==========================
"""

import uuid

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import NullPool, text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings
from app.core.database import get_main_db
from app.main import app


# ============================================================
# 测试数据库引擎 — NullPool 避免跨 test 缓存连接
# ============================================================
_test_engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    poolclass=NullPool,
)

_test_sessionmaker = async_sessionmaker(
    _test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def override_get_main_db():
    """测试用数据库会话（替换 app 依赖）"""
    async with _test_sessionmaker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# 覆盖 FastAPI 依赖注入
app.dependency_overrides[get_main_db] = override_get_main_db

TEST_USER_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"


# ============================================================
# Fixtures
# ============================================================
@pytest_asyncio.fixture(autouse=True)
async def seed_test_user():
    """在测试 DB 中播种测试用户数据"""
    async with _test_engine.begin() as conn:
        await conn.execute(
            text("""
                INSERT INTO users (id, email, username, hashed_password, is_active, is_verified,
                                   totp_enabled, failed_login_attempts, created_at, updated_at)
                VALUES (:id, 'test@test.com', 'testuser', 'hashed', true, true,
                        false, 0, now(), now())
                ON CONFLICT (id) DO NOTHING
            """),
            {"id": uuid.UUID(TEST_USER_ID)},
        )
    yield


@pytest_asyncio.fixture
async def async_client():
    """异步 HTTP 测试客户端"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
