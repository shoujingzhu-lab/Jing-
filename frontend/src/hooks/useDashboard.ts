import { useState, useEffect, useCallback } from 'react';
import type { Ticker } from '@/lib/types';
import { useMarketStore } from '@/stores/marketStore';

interface DashboardData {
  totalAsset: number;
  todayPnl: number;
  todayPnlPercent: number;
  winRate: number;
  activeStrategies: number;
  equityCurve: { time: string; equity: number; drawdown: number }[];
  strategies: StrategyStatusItem[];
  recentTrades: RecentTradeItem[];
  marketSnapshot: Ticker[];
  hasStrategies: boolean;
  hasTrades: boolean;
}

export interface StrategyStatusItem {
  id: string;
  name: string;
  symbol: string;
  status: string;
  todayReturn: number;
  totalReturn: number;
  runningDays: number;
}

export interface RecentTradeItem {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  price: number;
  quantity: number;
  time: string;
}

/** 模拟数据 */
const MOCK_DASHBOARD: DashboardData = {
  totalAsset: 125430.50,
  todayPnl: 2340.80,
  todayPnlPercent: 1.92,
  winRate: 62.5,
  activeStrategies: 3,
  equityCurve: generateMockEquityCurve(),
  strategies: [
    { id: '1', name: '均线交叉策略', symbol: 'BTC/USDT', status: 'live', todayReturn: 1.25, totalReturn: 32.56, runningDays: 45 },
    { id: '2', name: '网格震荡策略', symbol: 'ETH/USDT', status: 'live', todayReturn: -0.38, totalReturn: 18.20, runningDays: 30 },
    { id: '3', name: '动量突破策略', symbol: 'SOL/USDT', status: 'simulating', todayReturn: 2.15, totalReturn: 8.75, runningDays: 15 },
  ],
  recentTrades: [
    { id: 't1', symbol: 'BTC/USDT', side: 'buy', price: 67200.50, quantity: 0.15, time: new Date(Date.now() - 120000).toISOString() },
    { id: 't2', symbol: 'ETH/USDT', side: 'sell', price: 3420.80, quantity: 2.5, time: new Date(Date.now() - 300000).toISOString() },
    { id: 't3', symbol: 'BTC/USDT', side: 'sell', price: 67450.00, quantity: 0.08, time: new Date(Date.now() - 600000).toISOString() },
    { id: 't4', symbol: 'SOL/USDT', side: 'buy', price: 128.75, quantity: 20, time: new Date(Date.now() - 900000).toISOString() },
    { id: 't5', symbol: 'ETH/USDT', side: 'buy', price: 3395.30, quantity: 1.8, time: new Date(Date.now() - 1200000).toISOString() },
  ],
  marketSnapshot: [
    { symbol: 'BTC/USDT', lastPrice: 67230.50, change24h: 1250.30, changePercent24h: 1.89, high24h: 68100, low24h: 65800, volume24h: 24500, quoteVolume24h: 1.64e9, exchange: 'binance', timestamp: Date.now() },
    { symbol: 'ETH/USDT', lastPrice: 3425.20, change24h: -35.80, changePercent24h: -1.03, high24h: 3500, low24h: 3380, volume24h: 180000, quoteVolume24h: 6.16e8, exchange: 'binance', timestamp: Date.now() },
    { symbol: 'SOL/USDT', lastPrice: 129.15, change24h: 5.20, changePercent24h: 4.19, high24h: 132, low24h: 122, volume24h: 3500000, quoteVolume24h: 4.52e8, exchange: 'binance', timestamp: Date.now() },
    { symbol: 'BNB/USDT', lastPrice: 592.30, change24h: 8.50, changePercent24h: 1.46, high24h: 598, low24h: 580, volume24h: 480000, quoteVolume24h: 2.84e8, exchange: 'binance', timestamp: Date.now() },
    { symbol: 'XRP/USDT', lastPrice: 0.6275, change24h: -0.0125, changePercent24h: -1.95, high24h: 0.645, low24h: 0.618, volume24h: 45000000, quoteVolume24h: 2.82e7, exchange: 'binance', timestamp: Date.now() },
    { symbol: 'DOGE/USDT', lastPrice: 0.1685, change24h: 0.0085, changePercent24h: 5.31, high24h: 0.172, low24h: 0.158, volume24h: 120000000, quoteVolume24h: 2.02e7, exchange: 'binance', timestamp: Date.now() },
  ],
  hasStrategies: true,
  hasTrades: true,
};

function generateMockEquityCurve() {
  const points = 90;
  const data: { time: string; equity: number; drawdown: number }[] = [];
  let equity = 100000;
  let peak = 100000;
  const now = Date.now();

  for (let i = points; i >= 0; i--) {
    const date = new Date(now - i * 86400000);
    const change = (Math.random() - 0.48) * 3000; // 微偏正
    equity += change;
    if (equity > peak) peak = equity;
    const drawdown = ((peak - equity) / peak) * 100;

    data.push({
      time: date.toISOString().split('T')[0],
      equity: Math.round(equity * 100) / 100,
      drawdown: Math.round(drawdown * 100) / 100,
    });
  }
  return data;
}

export function useDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const batchUpdateTickers = useMarketStore((s) => s.batchUpdateTickers);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      // TODO: 实际 API 调用
      await new Promise((r) => setTimeout(r, silent ? 200 : 600));
      const mock = { ...MOCK_DASHBOARD };

      // 微调价格模拟实时性
      mock.marketSnapshot = mock.marketSnapshot.map((t) => ({
        ...t,
        lastPrice: t.lastPrice * (1 + (Math.random() - 0.5) * 0.001),
        changePercent24h: t.changePercent24h + (Math.random() - 0.5) * 0.1,
        timestamp: Date.now(),
      }));

      batchUpdateTickers(mock.marketSnapshot);
      setData(mock);
    } catch (err) {
      if (!silent) setError((err as Error).message || '加载失败');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [batchUpdateTickers]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refresh: fetchData };
}
