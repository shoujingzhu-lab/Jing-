import type { WsMessage, WsConnectionState } from '@/lib/types';
import { CONFIG } from '@/lib/constants';

type MessageHandler = (message: WsMessage) => void;

interface WsConnection {
  ws: WebSocket;
  url: string;
  state: WsConnectionState;
  handlers: Map<string, Set<MessageHandler>>;
  subscriptions: Set<string>;
  reconnectAttempts: number;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  heartbeatTimer: ReturnType<typeof setInterval> | null;
}

class WebSocketManager {
  private connections: Map<string, WsConnection> = new Map();
  private stateChangeListeners: Set<(state: WsConnectionState) => void> = new Set();

  /** 建立连接 */
  connect(name: string, url: string): void {
    const existing = this.connections.get(name);
    if (existing?.state === 'connected') return;
    if (existing) {
      this.disconnect(name);
    }

    const conn: WsConnection = {
      ws: null!,
      url,
      state: 'disconnected',
      handlers: new Map(),
      subscriptions: new Set(),
      reconnectAttempts: 0,
      reconnectTimer: null,
      heartbeatTimer: null,
    };

    this.connections.set(name, conn);
    this.createSocket(name, conn);
  }

  private createSocket(name: string, conn: WsConnection): void {
    try {
      const ws = new WebSocket(conn.url);
      conn.ws = ws;

      ws.onopen = () => {
        conn.state = 'connected';
        conn.reconnectAttempts = 0;
        this.notifyStateChange(name, 'connected');
        this.startHeartbeat(name, conn);
        // 重订阅
        conn.subscriptions.forEach((channel) => {
          this.send(name, { type: 'subscribe', channel });
        });
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const message: WsMessage = JSON.parse(event.data as string);
          const channel = message.channel;
          const handlers = conn.handlers.get(channel);
          if (handlers) {
            handlers.forEach((handler) => handler(message));
          }
        } catch {
          console.warn('[WS] Failed to parse message:', event.data);
        }
      };

      ws.onclose = (event: CloseEvent) => {
        conn.state = 'disconnected';
        this.stopHeartbeat(conn);
        this.notifyStateChange(name, 'disconnected');

        // 非正常关闭，尝试重连
        if (!event.wasClean && conn.reconnectAttempts < 10) {
          this.scheduleReconnect(name, conn);
        }
      };

      ws.onerror = () => {
        conn.state = 'disconnected';
        this.notifyStateChange(name, 'disconnected');
      };
    } catch {
      conn.state = 'disconnected';
      this.notifyStateChange(name, 'disconnected');
      this.scheduleReconnect(name, conn);
    }
  }

  private scheduleReconnect(name: string, conn: WsConnection): void {
    const delay = Math.min(
      CONFIG.WS_RECONNECT_BASE_MS * Math.pow(2, conn.reconnectAttempts),
      CONFIG.WS_RECONNECT_MAX_MS
    );
    conn.reconnectAttempts++;
    conn.state = 'reconnecting';
    this.notifyStateChange(name, 'reconnecting');

    conn.reconnectTimer = setTimeout(() => {
      this.createSocket(name, conn);
    }, delay);
  }

  private startHeartbeat(name: string, conn: WsConnection): void {
    this.stopHeartbeat(conn);
    conn.heartbeatTimer = setInterval(() => {
      if (conn.ws?.readyState === WebSocket.OPEN) {
        conn.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, CONFIG.WS_HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(conn: WsConnection): void {
    if (conn.heartbeatTimer) {
      clearInterval(conn.heartbeatTimer);
      conn.heartbeatTimer = null;
    }
  }

  /** 断开连接 */
  disconnect(name: string): void {
    const conn = this.connections.get(name);
    if (!conn) return;

    this.stopHeartbeat(conn);
    if (conn.reconnectTimer) {
      clearTimeout(conn.reconnectTimer);
    }
    if (conn.ws?.readyState === WebSocket.OPEN || conn.ws?.readyState === WebSocket.CONNECTING) {
      conn.ws.close(1000, 'Client disconnect');
    }
    this.connections.delete(name);
  }

  /** 断开所有连接 */
  disconnectAll(): void {
    this.connections.forEach((_, name) => this.disconnect(name));
  }

  /** 发送消息 */
  send(name: string, data: Record<string, unknown>): void {
    const conn = this.connections.get(name);
    if (conn?.ws?.readyState === WebSocket.OPEN) {
      conn.ws.send(JSON.stringify(data));
    }
  }

  /** 订阅频道 */
  subscribe(name: string, channel: string, handler: MessageHandler): () => void {
    const conn = this.connections.get(name);
    if (!conn) return () => {};

    conn.subscriptions.add(channel);

    if (!conn.handlers.has(channel)) {
      conn.handlers.set(channel, new Set());
    }
    conn.handlers.get(channel)!.add(handler);

    // 已连接时发送订阅
    if (conn.state === 'connected') {
      this.send(name, { type: 'subscribe', channel });
    }

    // 返回取消订阅函数
    return () => {
      const handlers = conn.handlers.get(channel);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          conn.handlers.delete(channel);
          conn.subscriptions.delete(channel);
          this.send(name, { type: 'unsubscribe', channel });
        }
      }
    };
  }

  /** 获取连接状态 */
  getState(name: string): WsConnectionState {
    return this.connections.get(name)?.state ?? 'disconnected';
  }

  /** 监听状态变化 */
  onStateChange(listener: (state: WsConnectionState) => void): () => void {
    this.stateChangeListeners.add(listener);
    return () => {
      this.stateChangeListeners.delete(listener);
    };
  }

  private notifyStateChange(_name: string, state: WsConnectionState): void {
    this.stateChangeListeners.forEach((listener) => listener(state));
  }
}

// 全局单例
export const wsManager = new WebSocketManager();
export default WebSocketManager;
