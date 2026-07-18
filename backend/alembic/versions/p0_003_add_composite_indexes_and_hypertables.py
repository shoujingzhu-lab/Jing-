"""P0-003: 添加复合索引 + TimescaleDB 超表分区

Revision ID: p0_003
Revises: d8f3ae802d7c
Create Date: 2026-07-18 00:00:00.000000

变更内容:
1. 业务表复合索引 (orders, positions, api_keys, risk_rules, risk_events, circuit_breakers)
2. 时序表 TimescaleDB hypertable 转换 (klines, orderbook_snapshots, ticker_data, funding_rates)
3. 时序数据自动分区策略 (chunk_time_interval)
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision: str = "p0_003"
down_revision: Union[str, None] = "d8f3ae802d7c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ================================================================
    # 1. orders 表 — 高频查询路径复合索引
    # ================================================================
    op.create_index(
        "idx_orders_user_status_created",
        "orders",
        ["user_id", "status", "created_at"],
    )
    op.create_index(
        "idx_orders_user_symbol_created",
        "orders",
        ["user_id", "symbol", "created_at"],
    )
    op.create_index(
        "idx_orders_strategy_status",
        "orders",
        ["strategy_id", "status"],
    )
    op.create_index(
        "idx_orders_exchange_status",
        "orders",
        ["exchange", "status"],
    )
    op.create_index(
        "idx_orders_client_order_id",
        "orders",
        ["client_order_id"],
    )

    # ================================================================
    # 2. positions 表 — 持仓查询优化
    # ================================================================
    op.create_index(
        "idx_positions_user_open",
        "positions",
        ["user_id", "is_open"],
    )
    op.create_index(
        "idx_positions_user_symbol",
        "positions",
        ["user_id", "symbol", "is_open"],
    )
    op.create_index(
        "idx_positions_exchange_symbol",
        "positions",
        ["exchange", "symbol", "is_open"],
    )

    # ================================================================
    # 3. api_keys 表 — 活跃密钥查询
    # ================================================================
    op.create_index(
        "idx_apikeys_user_active",
        "api_keys",
        ["user_id", "is_active"],
    )
    op.create_index(
        "idx_apikeys_exchange_active",
        "api_keys",
        ["exchange", "is_active"],
    )

    # ================================================================
    # 4. risk_rules 表 — 风控规则查询
    # ================================================================
    op.create_index(
        "idx_risk_rules_user_scope",
        "risk_rules",
        ["user_id", "scope", "is_enabled"],
    )
    op.create_index(
        "idx_risk_rules_strategy_type",
        "risk_rules",
        ["strategy_id", "rule_type"],
    )

    # ================================================================
    # 5. risk_events 表 — 风控事件查询
    # ================================================================
    op.create_index(
        "idx_risk_events_user_type_time",
        "risk_events",
        ["user_id", "event_type", "created_at"],
    )
    op.create_index(
        "idx_risk_events_user_severity",
        "risk_events",
        ["user_id", "severity", "created_at"],
    )
    op.create_index(
        "idx_risk_events_symbol",
        "risk_events",
        ["symbol", "created_at"],
    )

    # ================================================================
    # 6. circuit_breakers 表 — 熔断器状态查询
    # ================================================================
    op.create_index(
        "idx_circuit_breakers_active",
        "circuit_breakers",
        ["is_active", "scope"],
    )
    op.create_index(
        "idx_circuit_breakers_user_active",
        "circuit_breakers",
        ["user_id", "is_active"],
    )

    # ================================================================
    # 7. klines 表 — 时序索引优化
    # ================================================================
    op.create_index(
        "idx_klines_exchange_time",
        "klines",
        ["exchange", "open_time"],
    )

    # ================================================================
    # 8. TimescaleDB 超表转换（仅在 TimescaleDB 环境下执行）
    # ================================================================
    # 注意: 以下 SQL 需要 TimescaleDB extension 已安装。
    # 如果尚未安装，可手动执行: CREATE EXTENSION IF NOT EXISTS timescaledb;

    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_extension WHERE extname = 'timescaledb'
            ) THEN
                -- klines 超表（按 open_time 7 天分区）
                PERFORM create_hypertable('klines', 'open_time',
                    chunk_time_interval => INTERVAL '7 days',
                    if_not_exists => TRUE
                );

                -- orderbook_snapshots 超表（按 timestamp 1 天分区）
                PERFORM create_hypertable('orderbook_snapshots', 'timestamp',
                    chunk_time_interval => INTERVAL '1 day',
                    if_not_exists => TRUE
                );

                -- ticker_data 超表（按 timestamp 1 天分区）
                PERFORM create_hypertable('ticker_data', 'timestamp',
                    chunk_time_interval => INTERVAL '1 day',
                    if_not_exists => TRUE
                );

                -- funding_rates 超表（按 timestamp 30 天分区）
                PERFORM create_hypertable('funding_rates', 'timestamp',
                    chunk_time_interval => INTERVAL '30 days',
                    if_not_exists => TRUE
                );

                -- 启用压缩（对旧数据自动压缩以节省存储）
                -- klines: 7 天后自动压缩
                PERFORM add_compression_policy('klines',
                    compress_after => INTERVAL '7 days',
                    if_not_exists => TRUE
                );

                -- ticker_data: 1 天后自动压缩
                PERFORM add_compression_policy('ticker_data',
                    compress_after => INTERVAL '1 day',
                    if_not_exists => TRUE
                );

                -- 自动数据保留策略
                -- ticker_data: 保留 90 天
                PERFORM add_retention_policy('ticker_data',
                    drop_after => INTERVAL '90 days',
                    if_not_exists => TRUE
                );

                -- orderbook_snapshots: 保留 30 天
                PERFORM add_retention_policy('orderbook_snapshots',
                    drop_after => INTERVAL '30 days',
                    if_not_exists => TRUE
                );
            END IF;
        END $$;
    """)


def downgrade() -> None:
    # ================================================================
    # 移除复合索引
    # ================================================================
    op.drop_index("idx_circuit_breakers_user_active", table_name="circuit_breakers")
    op.drop_index("idx_circuit_breakers_active", table_name="circuit_breakers")

    op.drop_index("idx_risk_events_symbol", table_name="risk_events")
    op.drop_index("idx_risk_events_user_severity", table_name="risk_events")
    op.drop_index("idx_risk_events_user_type_time", table_name="risk_events")

    op.drop_index("idx_risk_rules_strategy_type", table_name="risk_rules")
    op.drop_index("idx_risk_rules_user_scope", table_name="risk_rules")

    op.drop_index("idx_apikeys_exchange_active", table_name="api_keys")
    op.drop_index("idx_apikeys_user_active", table_name="api_keys")

    op.drop_index("idx_positions_exchange_symbol", table_name="positions")
    op.drop_index("idx_positions_user_symbol", table_name="positions")
    op.drop_index("idx_positions_user_open", table_name="positions")

    op.drop_index("idx_orders_client_order_id", table_name="orders")
    op.drop_index("idx_orders_exchange_status", table_name="orders")
    op.drop_index("idx_orders_strategy_status", table_name="orders")
    op.drop_index("idx_orders_user_symbol_created", table_name="orders")
    op.drop_index("idx_orders_user_status_created", table_name="orders")

    op.drop_index("idx_klines_exchange_time", table_name="klines")

    # NOTE: TimescaleDB hypertable 转换在 downgrade 中不自动回退，
    # 因为 hypertable 不能直接 "unmake"。如需回退，需重建表。
