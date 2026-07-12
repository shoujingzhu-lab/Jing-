import { create } from 'zustand';
import type { Ticker, OrderBook } from '@/lib/types';

interface MarketState {
  tickers: Record<string, Ticker>;
  orderbooks: Record<string, OrderBook>;
  watchlist: string[];
  selectedSymbol: string | null;

  // Ticker
  updateTicker: (symbol: string, ticker: Ticker) => void;
  batchUpdateTickers: (tickers: Ticker[]) => void;

  // OrderBook
  updateOrderBook: (symbol: string, orderbook: OrderBook) => void;

  // Watchlist
  setWatchlist: (symbols: string[]) => void;
  addToWatchlist: (symbol: string) => void;
  removeFromWatchlist: (symbol: string) => void;
  isWatched: (symbol: string) => boolean;

  // Selection
  setSelectedSymbol: (symbol: string | null) => void;
}

export const useMarketStore = create<MarketState>((set, get) => ({
  tickers: {},
  orderbooks: {},
  watchlist: [],
  selectedSymbol: null,

  updateTicker: (symbol, ticker) =>
    set((state) => ({
      tickers: { ...state.tickers, [symbol]: ticker },
    })),

  batchUpdateTickers: (tickers) =>
    set((state) => {
      const newTickers = { ...state.tickers };
      tickers.forEach((t) => {
        newTickers[t.symbol] = t;
      });
      return { tickers: newTickers };
    }),

  updateOrderBook: (symbol, orderbook) =>
    set((state) => ({
      orderbooks: { ...state.orderbooks, [symbol]: orderbook },
    })),

  setWatchlist: (watchlist) => set({ watchlist }),
  addToWatchlist: (symbol) =>
    set((state) => ({
      watchlist: state.watchlist.includes(symbol)
        ? state.watchlist
        : [...state.watchlist, symbol],
    })),
  removeFromWatchlist: (symbol) =>
    set((state) => ({
      watchlist: state.watchlist.filter((s) => s !== symbol),
    })),
  isWatched: (symbol) => get().watchlist.includes(symbol),

  setSelectedSymbol: (selectedSymbol) => set({ selectedSymbol }),
}));
