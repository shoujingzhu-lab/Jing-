"""
Alembic 迁移环境配置
===================
使用异步 SQLAlchemy 引擎自动生成迁移脚本。
"""

import asyncio
import os
import sys
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import create_async_engine

# 确保 backend 目录在 Python 路径中
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.core.config import settings
from app.core.database import Base
from app.models import *  # noqa: F401, F403 — 导入所有模型以便 autogenerate 发现

# Alembic Config 对象
config = context.config

# 日志配置
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 元数据目标（autogenerate 使用）
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """
    离线模式迁移 — 生成 SQL 脚本而不连接数据库。
    """
    url = settings.DATABASE_URL
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    """在数据库连接上执行迁移"""
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """
    在线模式迁移 — 连接数据库并执行。
    """
    connectable = create_async_engine(
        settings.DATABASE_URL,
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """运行在线迁移（同步入口）"""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
