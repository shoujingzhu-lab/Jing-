/**
 * WebSocket 实时行情推送 Hook
 * 市场行情通过 WebSocket 推送，数据到达后立即更新 marketStore
 */
import { useEffect } from 'react';
import { wsManager } from '@/lib/ws/manager';
import { useMarketStore } from '@/stores/marketStore';
import type { Ticker } from '@/lib/types';

/** 通过 WebSocket 订阅的行情对 */
const SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT',
  'ADAUSDT', 'AVAXUSDT', 'DOTUSDT', 'MATICUSDT', 'LINKUSDT', 'UNIUSDT',
  'ATOMUSDT', 'LTCUSDT', 'ETCUSDT', 'OPUSDT', 'ARBUSDT', 'APTUSDT',
  'FILUSDT', 'NEARUSDT',
];

/**
 * 解析 WebSocket 推送的 ticker 数据
 * 后端推送格式: { type: "data", channel: "ticker:okx:BTCUSDT", data: { symbol, last, bid, ask, high_24h, low_24h, volume_24h, change_pct_24h, ... } }
 */
function parseWsTicker(channel: string, raw: Record<string, unknown>): { symbol: string; ticker: Ticker } | null {
  // channel 格式: "ticker:okx:BTCUSDT"
  const parts = channel.split(':');
  const symbol = parts[2]; // BTCUSDT
  const exchange = parts[1]; // okx

  if (!symbol || !raw.last) return null;

  return {
    symbol,
    ticker: {
      symbol,
      exchange,
      lastPrice: (raw.last ?? raw.last_price ?? 0) as number,
      change24h: 0,
      changePercent24h: (raw.change_pct_24h ?? 0) as number,
      high24h: (raw.high_24h ?? 0) as number,
      low24h: (raw.low_24h ?? 0) as number,
      volume24h: (raw.volume_24h ?? 0) as number,
      quoteVolume24h: (raw.quote_volume_24h ?? 0) as number,
      timestamp: Date.now(),
    },
  };
}

/**
 * 订阅 WebSocket 实时行情
 * 调用后自动订阅指定交易所的所有交易对行情，数据直接写入 marketStore
 */
export function useRealtimeMarket(exchange = 'okx') {
  const updateTicker = useMarketStore((s) => s.updateTicker);

  useEffect(() => {
    // 用同一个 handler 处理所有 ticker 推送
    const handler = (message: { type?: string; channel?: string; data?: Record<string, unknown> }) => {
      if (message.type !== 'data' || !message.channel || !message.data) return;
      if (!message.channel.startsWith('ticker:')) return;

      const result = parseWsTicker(message.channel, message.data);
      if (result) {
        updateTicker(result.symbol, result.ticker);
      }
    };

    // 订阅所有交易对的行情
    SYMBOLS.forEach((symbol) => {
      wsManager.subscribe('market', `ticker:${exchange}:${symbol}`, handler);
    });

    return () => {
      // cleanup 在组件卸载时不做，因为 wsManager 是全局单例，需要保持连接
    };
  }, [exchange, updateTicker]);
}
