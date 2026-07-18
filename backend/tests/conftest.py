"""
Pytest 全局配置与 Fixtures
==========================
每次测试用 NullPool + 可选数据库连接。
- 无 DB 环境: 行为测试（安全/风控引擎/适配器 Mock）正常运行
- 有 DB 环境: 数据库集成测试 + API 测试完整运行
"""

import os
import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

# 在没有真实数据库时跳过 DB-dependent 测试
_has_db = os.environ.get("DATABASE_URL") and os.environ.get("DATABASE_URL", "").startswith("postgresql")

TEST_USER_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"

# ============================================================
# 可选: 数据库 & FastAPI 依赖覆盖
# ============================================================
if _has_db:
    from sqlalchemy import NullPool, text
    from sqlalchemy.ext.asyncio import (
        AsyncSession,
        async_sessionmaker,
        create_async_engine,
    )
    from app.core.config import settings
    from app.core.database import get_main_db
    from app.main import app

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

    app.dependency_overrides[get_main_db] = override_get_main_db

    @pytest_asyncio.fixture
    async def seed_test_user():
        """种子用户数据（仅 DB 测试需要）"""
        async with _test_engine.begin() as conn:
            await conn.execute(
                text("""
                    INSERT INTO users (id, email, username, hashed_password, is_active, is_verified,
                                       totp_enabled, failed_login_attempts, created_at, updated_at)
                    VALUES (:id, 'test@test.com', 'testuser', '$2b$12$LJ3m4ys3GZfnYGfkKHeD.OHg1zUq0VlS3JYIhGm8b3JkWpGqJGZSe',
                            true, true, false, 0, now(), now())
                    ON CONFLICT (id) DO NOTHING
                """),
                {"id": uuid.UUID(TEST_USER_ID)},
            )
        yield

    @pytest_asyncio.fixture
    async def async_client():
        """异步 HTTP 测试客户端（需要真实数据库）"""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            yield client
else:
    # 无 DB 时 mock async_client 为 None（DB-dependent 测试可通过检查是否为 None 来选择跳过）
    @pytest_asyncio.fixture
    async def seed_test_user():
        """无数据库环境 — 跳过"""
        pytest.skip("No database available")

    @pytest_asyncio.fixture
    async def async_client():
        """无数据库环境 — 跳过"""
        pytest.skip("No database available")
