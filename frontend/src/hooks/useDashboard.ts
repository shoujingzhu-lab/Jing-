import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Ticker, Strategy, Position, Trade } from '@/lib/types';
import { strategyApi, tradingApi, dataApi } from '@/lib/api';
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

function calcRunningDays(createdAt: string): number {
  const created = new Date(createdAt);
  const now = new Date();
  return Math.max(1, Math.floor((now.getTime() - created.getTime()) / 86400000));
}

function mapStrategies(list: Strategy[]): StrategyStatusItem[] {
  return list.map((s) => ({
    id: s.id,
    name: s.name,
    symbol: (s as Record<string, unknown>).symbol_pool
      ? ((s as Record<string, unknown>).symbol_pool as string[])[0] || '--'
      : '--',
    status: s.status,
    todayReturn: 0,
    totalReturn: 0,
    runningDays: calcRunningDays(
      (s as Record<string, unknown>).created_at as string
      || (s as Record<string, unknown>).updated_at as string
      || new Date().toISOString()
    ),
  }));
}

function mapRecentTrades(trades: Trade[]): RecentTradeItem[] {
  return trades.slice(0, 10).map((t) => ({
    id: t.id,
    symbol: t.symbol,
    side: t.side as 'buy' | 'sell',
    price: typeof t.entryPrice === 'number' ? t.entryPrice : (t as Record<string, unknown>).price as number ?? 0,
    quantity: (t as Record<string, unknown>).amount as number ?? (t as Record<string, unknown>).quantity as number ?? 0,
    time: (t as Record<string, unknown>).filledAt as string || (t as Record<string, unknown>).closedAt as string || (t as Record<string, unknown>).createdAt as string || new Date().toISOString(),
  }));
}

function calcPortfolio(positions: Position[]): { totalAsset: number; todayPnl: number; todayPnlPercent: number; winRate: number } {
  const totalAsset = positions.reduce((sum, p) => sum + ((p.notionalValue ?? p.marketValue ?? (p.size ?? 0) * (p.markPrice ?? p.avgPrice ?? 0)) as number), 0);
  const todayPnl = positions.reduce((sum, p) => sum + ((p.unrealizedPnl ?? p.pnl ?? 0) as number), 0);
  const totalCost = positions.reduce((sum, p) => sum + ((p.costBasis ?? p.avgPrice ?? 0) as number) * ((p.size ?? 0) as number), 0);
  const todayPnlPercent = totalCost > 0 ? (todayPnl / totalCost) * 100 : 0;
  const winningPositions = positions.filter((p) => ((p.unrealizedPnl ?? p.pnl ?? 0) as number) > 0).length;
  const winRate = positions.length > 0 ? (winningPositions / positions.length) * 100 : 0;
  return { totalAsset, todayPnl, todayPnlPercent, winRate };
}

const DEFAULT_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT'];

export function useDashboard() {
  const batchUpdateTickers = useMarketStore((s) => s.batchUpdateTickers);

  // 策略列表 — 缓存 60s
  const strategiesQuery = useQuery({
    queryKey: ['dashboard', 'strategies'],
    queryFn: async () => {
      const res = await strategyApi.getList({ page_size: 100 });
      const data = res.data as unknown as { items?: Strategy[] };
      return data?.items || [];
    },
    staleTime: 30_000,             // 策略列表变化少，30秒过期
  });

  // 持仓 — 10s 过期，后台刷新
  const positionsQuery = useQuery({
    queryKey: ['dashboard', 'positions'],
    queryFn: async () => {
      const res = await tradingApi.getPositions();
      const data = res.data as unknown as { items?: Position[] };
      return data?.items || [];
    },
    staleTime: 3_000,              // 持仓3秒过期
    refetchInterval: 10_000,       // 每10秒轮询
  });

  // 最近交易 — 3s 过期
  const tradesQuery = useQuery({
    queryKey: ['dashboard', 'trades'],
    queryFn: async () => {
      const res = await tradingApi.getLogs({ page_size: 10 });
      const data = res.data as unknown as { items?: Trade[] };
      return data?.items || [];
    },
    staleTime: 3_000,
    refetchInterval: 10_000,
  });

  // 行情快照 — 5s 过期，15s 自动刷新
  const tickersQuery = useQuery({
    queryKey: ['dashboard', 'tickers'],
    queryFn: async () => {
      const results = await Promise.allSettled(
        DEFAULT_SYMBOLS.map((symbol) => dataApi.getAggregated(symbol).catch(() => null))
      );
      const snapshot: Ticker[] = [];
      results.forEach((r, i) => {
        if (r.status === 'fulfilled' && r.value) {
          const d = r.value.data as unknown as Record<string, unknown>;
          if (d) {
            const exchanges = d.exchanges as Record<string, Record<string, unknown>> | undefined;
            const firstEx = exchanges ? Object.values(exchanges)[0] : null;
            snapshot.push({
              symbol: DEFAULT_SYMBOLS[i],
              exchange: 'binance',
              lastPrice: (firstEx?.last ?? 0) as number,
              change24h: 0,
              changePercent24h: (firstEx?.change_pct_24h ?? 0) as number,
              high24h: (firstEx?.high_24h ?? 0) as number,
              low24h: (firstEx?.low_24h ?? 0) as number,
              volume24h: (firstEx?.volume_24h ?? 0) as number,
              quoteVolume24h: (firstEx?.quote_volume_24h ?? 0) as number,
              timestamp: Date.now(),
            });
          }
        }
      });
      if (snapshot.length > 0) batchUpdateTickers(snapshot);
      return snapshot;
    },
    staleTime: 5_000,              // 行情5秒过期
    refetchInterval: 15_000,       // 每15秒自动刷新行情
  });

  // isLoading: 首次加载（无任何缓存数据时）
  const loading = strategiesQuery.isLoading && positionsQuery.isLoading && tradesQuery.isLoading;
  // isFetching: 后台刷新中（有缓存数据，静默更新）
  const isRefreshing = !loading && (strategiesQuery.isFetching || positionsQuery.isFetching || tradesQuery.isFetching || tickersQuery.isFetching);
  const error = strategiesQuery.error || positionsQuery.error || tradesQuery.error
    ? '部分数据加载失败' : null;

  const data = useMemo<DashboardData | null>(() => {
    const strategies = strategiesQuery.data || [];
    const positions = positionsQuery.data || [];
    const trades = tradesQuery.data || [];
    const marketSnapshot = tickersQuery.data || [];

    const { totalAsset, todayPnl, todayPnlPercent, winRate } = calcPortfolio(positions);

    return {
      totalAsset,
      todayPnl,
      todayPnlPercent,
      winRate,
      activeStrategies: strategies.filter((s) => s.status !== 'archived').length,
      equityCurve: [],
      strategies: mapStrategies(strategies),
      recentTrades: mapRecentTrades(trades),
      marketSnapshot,
      hasStrategies: strategies.length > 0,
      hasTrades: trades.length > 0,
    };
  }, [strategiesQuery.data, positionsQuery.data, tradesQuery.data, tickersQuery.data]);

  const refresh = () => {
    strategiesQuery.refetch();
    positionsQuery.refetch();
    tradesQuery.refetch();
    tickersQuery.refetch();
  };

  return { data, loading, error, refresh };
}
