"""
WebSocket 事件发射器
==================
统一的 WebSocket 事件推送模块。所有服务模块通过此模块向 WebSocket 客户端推送实时事件。

频道映射:
- position:{user_id}   — 持仓变更
- order:{user_id}      — 订单状态更新
- risk:{user_id}       — 风控事件 / 熔断触发
- notification:{user_id} — 通知消息
- ticker:{exchange}:{symbol}
- orderbook:{exchange}:{symbol}
- klines:{exchange}:{symbol}:{interval}
"""

import logging
from datetime import datetime, UTC
from typing import Any, Optional

from app.ws.manager import ws_manager

logger = logging.getLogger("quant.ws.event_emitter")


# ================================================================
# 用户事件频道 (position / order / risk / notification)
# ================================================================

async def emit_order_update(user_id: str, order_data: dict):
    """推送订单状态变更到 WebSocket 客户端。

    在以下时机调用:
    - 订单创建 (status=created)
    - 订单提交到交易所 (status=submitted)
    - 订单成交 (status=filled)
    - 订单部分成交 (status=partially_filled)
    - 订单取消 (status=cancelled)
    - 订单被拒 (status=rejected)
    """
    channel = f"order:{user_id}"
    payload = {
        "event": "order_update",
        "order": order_data,
        "timestamp": datetime.now(UTC).isoformat(),
    }
    await ws_manager.broadcast(channel, payload)
    logger.debug(f"Order update emitted to {channel}: {order_data.get('id', '?')}")


async def emit_position_update(user_id: str, position_data: dict):
    """推送持仓变更到 WebSocket 客户端。

    在以下时机调用:
    - 新开仓位
    - 平仓
    - 仓位盈亏更新
    - 保证金比率变化
    """
    channel = f"position:{user_id}"
    payload = {
        "event": "position_update",
        "position": position_data,
        "timestamp": datetime.now(UTC).isoformat(),
    }
    await ws_manager.broadcast(channel, payload)
    logger.debug(f"Position update emitted to {channel}: {position_data.get('symbol', '?')}")


async def emit_risk_event(user_id: str, event_data: dict):
    """推送风控事件到 WebSocket 客户端。

    在以下时机调用:
    - 交易前检查被拒绝
    - 风控规则触发
    - 熔断器激活
    - 熔断器恢复
    - 仓位风险告警
    """
    channel = f"risk:{user_id}"
    payload = {
        "event": event_data.get("event_type", "risk_event"),
        "data": event_data,
        "timestamp": datetime.now(UTC).isoformat(),
    }
    await ws_manager.broadcast(channel, payload)
    logger.info(
        f"Risk event emitted to {channel}: "
        f"{event_data.get('event_type', '?')} severity={event_data.get('severity', '?')}"
    )


async def emit_notification(user_id: str, notification_data: dict):
    """推送通知到 WebSocket 客户端。

    在以下时机调用:
    - 策略告警触发
    - 价格告警触发
    - 系统通知
    - 风控告警
    """
    channel = f"notification:{user_id}"
    payload = {
        "event": "notification",
        "data": notification_data,
        "timestamp": datetime.now(UTC).isoformat(),
    }
    await ws_manager.broadcast(channel, payload)
    logger.debug(f"Notification emitted to {channel}: {notification_data.get('title', '?')}")


# ================================================================
# 行情频道 (ticker / orderbook / klines)
# ================================================================

async def emit_ticker(exchange: str, symbol: str, ticker_data: dict):
    """推送 Ticker 数据"""
    channel = f"ticker:{exchange}:{symbol}"
    await ws_manager.broadcast(channel, ticker_data)


async def emit_orderbook(exchange: str, symbol: str, orderbook_data: dict):
    """推送订单簿数据"""
    channel = f"orderbook:{exchange}:{symbol}"
    await ws_manager.broadcast(channel, orderbook_data)


async def emit_klines(exchange: str, symbol: str, interval: str, klines_data: list):
    """推送 K 线数据"""
    channel = f"klines:{exchange}:{symbol}:{interval}"
    await ws_manager.broadcast(channel, klines_data)
