"""
WebSocket 路由处理器
===================
处理 WebSocket 连接、认证、频道订阅。
"""

import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from app.core.security import decode_token
from app.ws.manager import ws_manager

router = APIRouter()

# ================================================================
# 行情频道
# ================================================================


@router.websocket("/ws/market")
async def ws_market(
    ws: WebSocket,
    token: str = Query(..., description="JWT 访问令牌"),
):
    """行情 WebSocket：订阅 ticker / orderbook / klines"""
    user_id = _authenticate(token)
    if user_id is None:
        await ws.close(code=4001, reason="认证失败")
        return

    await ws_manager.connect(ws, user_id)

    try:
        while True:
            raw = await ws.receive_text()
            msg = json.loads(raw)

            action = msg.get("action")
            channel = msg.get("channel", "")

            if action == "subscribe" and channel:
                await ws_manager.subscribe(ws, channel)
            elif action == "unsubscribe" and channel:
                await ws_manager.unsubscribe(ws, channel)
            elif action == "ping":
                await ws_manager.send_personal(ws, {"pong": True}, "pong")
            else:
                await ws_manager.send_personal(
                    ws,
                    {"error": f"未知操作: {action}，支持 subscribe/unsubscribe/ping"},
                    "error",
                )
    except WebSocketDisconnect:
        pass
    finally:
        await ws_manager.disconnect(ws)


@router.websocket("/ws/user")
async def ws_user_events(
    ws: WebSocket,
    token: str = Query(..., description="JWT 访问令牌"),
):
    """
    用户事件 WebSocket：接收 position / order / risk / notification 推送。

    连接后自动订阅：
    - position:{user_id}, order:{user_id}, risk:{user_id}, notification:{user_id}
    """
    user_id = _authenticate(token)
    if user_id is None:
        await ws.close(code=4001, reason="认证失败")
        return

    await ws_manager.connect(ws, user_id)

    # 自动订阅用户相关频道
    for channel in ["position", "order", "risk", "notification"]:
        await ws_manager.subscribe(ws, f"{channel}:{user_id}")

    try:
        while True:
            raw = await ws.receive_text()
            msg = json.loads(raw)

            if msg.get("action") == "ping":
                await ws_manager.send_personal(ws, {"pong": True}, "pong")
    except WebSocketDisconnect:
        pass
    finally:
        await ws_manager.disconnect(ws)


# ================================================================
# 辅助函数
# ================================================================


def _authenticate(token: str) -> str | None:
    """验证 JWT 令牌，返回 user_id 或 None"""
    try:
        payload = decode_token(token)
        return payload.get("sub")
    except Exception:
        return None
