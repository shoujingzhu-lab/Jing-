import { useState, useEffect, useCallback } from 'react';
import type { Ticker, Kline, OrderBook, TradeTick, FundingRate } from '@/lib/types';
import { useMarketStore } from '@/stores/marketStore';

// ========== 模拟行情数据 ==========

const SYMBOLS_BASE = [
  'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT', 'DOGE/USDT',
  'ADA/USDT', 'AVAX/USDT', 'DOT/USDT', 'MATIC/USDT', 'LINK/USDT', 'UNI/USDT',
  'ATOM/USDT', 'LTC/USDT', 'ETC/USDT', 'OP/USDT', 'ARB/USDT', 'APT/USDT',
  'FIL/USDT', 'NEAR/USDT', 'INJ/USDT', 'RUNE/USDT', 'FTM/USDT', 'AAVE/USDT',
  'ALGO/USDT', 'GRT/USDT', 'SAND/USDT', 'MANA/USDT', 'ENJ/USDT', 'GALA/USDT',
];

const EXCHANGES = ['binance', 'okx', 'bybit', 'gate'] as const;

function generateTickers(): Ticker[] {
  return SYMBOLS_BASE.map((symbol) => {
    const basePrice = symbol.startsWith('BTC') ? 67000 + Math.random() * 2000 :
      symbol.startsWith('ETH') ? 3400 + Math.random() * 200 :
      symbol.startsWith('SOL') ? 128 + Math.random() * 10 :
      symbol.startsWith('BNB') ? 590 + Math.random() * 30 :
      symbol.endsWith('USDT') ? 1 + Math.random() * 100 :
      Math.random() * 500;

    const changePercent = (Math.random() - 0.48) * 8;
    return {
      symbol,
      exchange: EXCHANGES[Math.floor(Math.random() * EXCHANGES.length)],
      lastPrice: Math.round(basePrice * 100) / 100,
      change24h: Math.round(basePrice * changePercent / 100 * 100) / 100,
      changePercent24h: Math.round(changePercent * 100) / 100,
      high24h: Math.round(basePrice * 1.03 * 100) / 100,
      low24h: Math.round(basePrice * 0.97 * 100) / 100,
      volume24h: Math.round(Math.random() * 500000),
      quoteVolume24h: Math.round(Math.random() * 2e9),
      timestamp: Date.now(),
    };
  });
}

function generateKlines(length = 200): Kline[] {
  const data: Kline[] = [];
  let price = 67200;
  const now = Date.now();

  for (let i = length; i >= 0; i--) {
    const openTime = now - i * 3600000;
    const open = price;
    const close = open + (Math.random() - 0.5) * 800;
    const high = Math.max(open, close) + Math.random() * 400;
    const low = Math.min(open, close) - Math.random() * 400;
    const volume = Math.random() * 500;

    data.push({
      openTime,
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume: Math.round(volume * 100) / 100,
      closeTime: openTime + 3599999,
    });
    price = close;
  }
  return data;
}

function generateOrderBook(basePrice: number): OrderBook {
  const asks: { price: number; amount: number }[] = [];
  const bids: { price: number; amount: number }[] = [];

  for (let i = 0; i < 20; i++) {
    asks.push({
      price: Math.round((basePrice * (1 + (i + 1) * 0.0001)) * 100) / 100,
      amount: Math.round(Math.random() * 10 * 100) / 100,
    });
    bids.push({
      price: Math.round((basePrice * (1 - (i + 1) * 0.0001)) * 100) / 100,
      amount: Math.round(Math.random() * 10 * 100) / 100,
    });
  }

  return {
    symbol: 'BTC/USDT',
    exchange: 'binance',
    asks,
    bids,
    timestamp: Date.now(),
  };
}

function generateTradeHistory(length = 30): TradeTick[] {
  const basePrice = 67200;
  return Array.from({ length }, (_, i) => ({
    id: `t${Date.now()}-${i}`,
    symbol: 'BTC/USDT',
    exchange: 'binance',
    price: Math.round((basePrice + (Math.random() - 0.5) * 50) * 100) / 100,
    amount: Math.round(Math.random() * 2 * 1000) / 1000,
    side: Math.random() > 0.5 ? 'buy' as const : 'sell' as const,
    timestamp: Date.now() - i * 2000,
  }));
}

// ========== Hooks ==========

export function useMarketOverview() {
  const [tickers, setTickers] = useState<Ticker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const batchUpdateTickers = useMarketStore((s) => s.batchUpdateTickers);

  const fetchTickers = useCallback(async () => {
    try {
      setLoading(true);
      // TODO: 实际 API 调用
      await new Promise((r) => setTimeout(r, 300));
      const data = generateTickers();
      batchUpdateTickers(data);
      setTickers(data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [batchUpdateTickers]);

  useEffect(() => {
    fetchTickers();
  }, [fetchTickers]);

  return { tickers, loading, error, refresh: fetchTickers };
}

export function useSymbolDetail(symbol: string) {
  const [klines, setKlines] = useState<Kline[]>([]);
  const [orderBook, setOrderBook] = useState<OrderBook | null>(null);
  const [trades, setTrades] = useState<TradeTick[]>([]);
  const [loading, setLoading] = useState(true);

  const basePrice = symbol.startsWith('BTC') ? 67200 :
    symbol.startsWith('ETH') ? 3420 :
    symbol.startsWith('SOL') ? 129 : 100;

  useEffect(() => {
    setLoading(true);
    // 模拟加载
    const timer = setTimeout(() => {
      setKlines(generateKlines());
      setOrderBook(generateOrderBook(basePrice));
      setTrades(generateTradeHistory());
      setLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [symbol, basePrice]);

  // 模拟实时更新
  useEffect(() => {
    const timer = setInterval(() => {
      setTrades((prev) => {
        const newTrade: TradeTick = {
          id: `t${Date.now()}`,
          symbol,
          exchange: 'binance',
          price: Math.round((basePrice + (Math.random() - 0.5) * 30) * 100) / 100,
          amount: Math.round(Math.random() * 2 * 1000) / 1000,
          side: Math.random() > 0.5 ? 'buy' : 'sell',
          timestamp: Date.now(),
        };
        return [newTrade, ...prev.slice(0, 29)];
      });
    }, 2000);

    return () => clearInterval(timer);
  }, [symbol, basePrice]);

  return { klines, orderBook, trades, loading };
}

export function useFundingRates() {
  const [rates, setRates] = useState<FundingRate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setRates(
        SYMBOLS_BASE.slice(0, 15).map((symbol) => ({
          symbol,
          exchange: 'binance',
          rate: (Math.random() - 0.5) * 0.001,
          predictedRate: (Math.random() - 0.5) * 0.001,
          nextSettleTime: Date.now() + Math.floor(Math.random() * 8 * 3600000),
          markPrice: 67000 + Math.random() * 2000,
          indexPrice: 67000 + Math.random() * 2000,
        }))
      );
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  return { rates, loading, refresh: () => {} };
}
