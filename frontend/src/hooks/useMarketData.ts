import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Ticker, Kline, OrderBook, TradeTick, FundingRate } from '@/lib/types';
import { useMarketStore } from '@/stores/marketStore';
import { dataApi } from '@/lib/api';

/** 默认行情列表 */
const DEFAULT_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT',
  'ADAUSDT', 'AVAXUSDT', 'DOTUSDT', 'MATICUSDT', 'LINKUSDT', 'UNIUSDT',
  'ATOMUSDT', 'LTCUSDT', 'ETCUSDT', 'OPUSDT', 'ARBUSDT', 'APTUSDT',
  'FILUSDT', 'NEARUSDT', 'INJUSDT', 'RUNEUSDT', 'FTMUSDT', 'AAVEUSDT',
  'ALGOUSDT', 'GRTUSDT', 'SANDUSDT', 'MANAUSDT', 'ENJUSDT', 'GALAUSDT',
];

/** 默认交易所（Binance 在中国受限，使用 OKX） */
const DEFAULT_EXCHANGE = 'okx';

// ========== useMarketOverview ==========

/** 将聚合数据转为 Ticker 格式 */
function parseAggregatedTicker(d: unknown, symbol: string): Ticker | null {
  const obj = d as Record<string, unknown> | null;
  if (!obj) return null;
  const exchanges = obj.exchanges as Record<string, Record<string, unknown>> | undefined;
  const firstEx = exchanges ? Object.values(exchanges)[0] : null;
  if (!firstEx) return null;
  return {
    symbol,
    exchange: DEFAULT_EXCHANGE,
    lastPrice: (firstEx.last ?? obj.last_price ?? obj.price ?? 0) as number,
    change24h: (firstEx.change_24h ?? obj.change_24h ?? obj.change ?? 0) as number,
    changePercent24h: (firstEx.change_pct_24h ?? obj.change_percent_24h ?? obj.change_percent ?? 0) as number,
    high24h: (firstEx.high_24h ?? obj.high_24h ?? obj.high ?? 0) as number,
    low24h: (firstEx.low_24h ?? obj.low_24h ?? obj.low ?? 0) as number,
    volume24h: (firstEx.volume_24h ?? obj.volume_24h ?? obj.volume ?? 0) as number,
    quoteVolume24h: (firstEx.quote_volume_24h ?? obj.quote_volume_24h ?? 0) as number,
    timestamp: Date.now(),
  };
}

export function useMarketOverview() {
  const batchUpdateTickers = useMarketStore((s) => s.batchUpdateTickers);

  const query = useQuery({
    queryKey: ['market', 'overview'],
    queryFn: async () => {
      const results = await Promise.allSettled(
        DEFAULT_SYMBOLS.map((symbol) =>
          dataApi.getAggregated(symbol).catch(() => null)
        )
      );
      const tickerList: Ticker[] = [];
      results.forEach((r, i) => {
        if (r.status === 'fulfilled' && r.value) {
          const ticker = parseAggregatedTicker(r.value.data, DEFAULT_SYMBOLS[i]);
          if (ticker) tickerList.push(ticker);
        }
      });
      if (tickerList.length > 0) batchUpdateTickers(tickerList);
      return tickerList;
    },
    staleTime: 5_000,              // 行情5秒过期
    refetchInterval: 15_000,       // 每15秒自动刷新
  });

  return {
    tickers: query.data || [],
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refresh: () => query.refetch(),
  };
}

// ========== useSymbolDetail ==========

export function useSymbolDetail(symbol: string, klineInterval = '1h') {
  const [klines, setKlines] = useState<Kline[]>([]);
  const [orderBook, setOrderBook] = useState<OrderBook | null>(null);
  const [trades, setTrades] = useState<TradeTick[]>([]);
  const [ticker, setTicker] = useState<Ticker | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    setError(null);
    try {
      const [klinesRes, orderbookRes, tickerRes] = await Promise.allSettled([
        dataApi.getKlines(DEFAULT_EXCHANGE, symbol.replace('/', ''), klineInterval, 200),
        dataApi.getOrderBook(DEFAULT_EXCHANGE, symbol.replace('/', '')),
        dataApi.getAggregated(symbol.replace('/', '')),
      ]);

      if (klinesRes.status === 'fulfilled') {
        const raw = klinesRes.value.data as unknown as { bars?: Array<Record<string, unknown>> };
        const bars = raw?.bars || [];
        setKlines(bars.map((b: Record<string, unknown>) => ({
          openTime: (b.open_time as number) || (b.openTime as number) || 0,
          open: (b.open as number) || 0,
          high: (b.high as number) || 0,
          low: (b.low as number) || 0,
          close: (b.close as number) || 0,
          volume: (b.volume as number) || 0,
          closeTime: ((b.open_time as number) || (b.openTime as number) || 0) + 3599999,
        })));
      }

      if (orderbookRes.status === 'fulfilled') {
        const raw = orderbookRes.value.data as unknown as Record<string, unknown>;
        if (raw) {
          setOrderBook({
            symbol,
            exchange: DEFAULT_EXCHANGE,
            asks: (raw.asks as Array<[number, number]>)?.map(([price, amount]) => ({ price, amount })) || [],
            bids: (raw.bids as Array<[number, number]>)?.map(([price, amount]) => ({ price, amount })) || [],
            timestamp: Date.now(),
          });
        }
      }

      // 从聚合数据中提取行情快照
      if (tickerRes.status === 'fulfilled') {
        const d = tickerRes.value.data as unknown as Record<string, unknown>;
        if (d) {
          const exchanges = d.exchanges as Record<string, Record<string, unknown>> | undefined;
          const firstEx = exchanges ? Object.values(exchanges)[0] : null;
          if (firstEx) {
            setTicker({
              symbol,
              exchange: DEFAULT_EXCHANGE,
              lastPrice: (firstEx.last ?? 0) as number,
              change24h: (firstEx.change_24h ?? 0) as number,
              changePercent24h: (firstEx.change_pct_24h ?? 0) as number,
              high24h: (firstEx.high_24h ?? 0) as number,
              low24h: (firstEx.low_24h ?? 0) as number,
              volume24h: (firstEx.volume_24h ?? 0) as number,
              quoteVolume24h: (firstEx.quote_volume_24h ?? 0) as number,
              timestamp: Date.now(),
            });
          }
        }
      }
    } catch (err) {
      setError((err as Error).message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [symbol, klineInterval]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // 订单簿+行情每1秒刷新
  useEffect(() => {
    if (!symbol) return;
    const timer = setInterval(async () => {
      try {
        const [obRes, tickerRes] = await Promise.allSettled([
          dataApi.getOrderBook(DEFAULT_EXCHANGE, symbol.replace('/', '')),
          dataApi.getAggregated(symbol.replace('/', '')),
        ]);
        if (obRes.status === 'fulfilled') {
          const raw = obRes.value.data as unknown as Record<string, unknown>;
          if (raw) {
            setOrderBook({
              symbol,
              exchange: DEFAULT_EXCHANGE,
              asks: (raw.asks as Array<[number, number]>)?.map(([price, amount]) => ({ price, amount })) || [],
              bids: (raw.bids as Array<[number, number]>)?.map(([price, amount]) => ({ price, amount })) || [],
              timestamp: Date.now(),
            });
          }
        }
        if (tickerRes.status === 'fulfilled') {
          const d = tickerRes.value.data as unknown as Record<string, unknown>;
          if (d) {
            const exchanges = d.exchanges as Record<string, Record<string, unknown>> | undefined;
            const firstEx = exchanges ? Object.values(exchanges)[0] : null;
            if (firstEx) {
              setTicker({
                symbol,
                exchange: DEFAULT_EXCHANGE,
                lastPrice: (firstEx.last ?? 0) as number,
                change24h: 0,
                changePercent24h: (firstEx.change_pct_24h ?? 0) as number,
                high24h: (firstEx.high_24h ?? 0) as number,
                low24h: (firstEx.low_24h ?? 0) as number,
                volume24h: (firstEx.volume_24h ?? 0) as number,
                quoteVolume24h: (firstEx.quote_volume_24h ?? 0) as number,
                timestamp: Date.now(),
              });
            }
          }
        }
      } catch { /* 静默失败 */ }
    }, 200);
    return () => clearInterval(timer);
  }, [symbol]);

  // 实时更新：用聚合数据轮询（OKX/GateIO 在中国可用）
  useEffect(() => {
    if (!symbol) return;
    const timer = setInterval(async () => {
      try {
        const res = await dataApi.getAggregated(symbol.replace('/', ''));
        const d = res.data as unknown as Record<string, unknown>;
        if (d) {
          const exchanges = d.exchanges as Record<string, Record<string, unknown>> | undefined;
          const firstEx = exchanges ? Object.values(exchanges)[0] : null;
          if (firstEx) {
            const newTrade: TradeTick = {
              id: `t${Date.now()}`,
              symbol,
              exchange: DEFAULT_EXCHANGE,
              price: (firstEx.last ?? 0) as number,
              amount: Math.random(),
              side: 'buy',
              timestamp: Date.now(),
            };
            setTrades((prev) => [newTrade, ...prev.slice(0, 49)]);
          }
        }
      } catch {
        // 静默失败
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [symbol]);

  return { klines, orderBook, trades, ticker, loading, error, refresh: fetchDetail };
}

// ========== useFundingRates ==========

export function useFundingRates() {
  const [rates, setRates] = useState<FundingRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const symbols = DEFAULT_SYMBOLS.slice(0, 15);
      const results = await Promise.allSettled(
        symbols.map((s) =>
          dataApi.getFundingRate(DEFAULT_EXCHANGE, s).catch(() => null)
        )
      );

      const rateList: FundingRate[] = [];
      results.forEach((r, i) => {
        if (r.status === 'fulfilled' && r.value) {
          const d = (r.value.data as unknown as { data: FundingRate })?.data
            || (r.value.data as unknown as FundingRate);
          if (d) {
            rateList.push(d);
          }
        }
      });

      setRates(rateList);
    } catch (err) {
      setError((err as Error).message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  return { rates, loading, error, refresh: fetchRates };
}
