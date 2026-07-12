import { create } from 'zustand';
import type { WsConnectionState } from '@/lib/types';
import type { Exchange } from '@/lib/types';

interface ExchangeConnection {
  exchange: Exchange;
  status: WsConnectionState;
  latency: number;
}

interface AppState {
  // WebSocket 连接状态
  wsStatus: WsConnectionState;
  marketLatency: number;
  exchangeConnections: ExchangeConnection[];

  // 全局 UI
  globalLoading: boolean;
  globalLoadingTip: string;

  // Actions
  setWsStatus: (status: WsConnectionState) => void;
  setMarketLatency: (latency: number) => void;
  setExchangeConnections: (connections: ExchangeConnection[]) => void;
  updateExchangeConnection: (exchange: Exchange, updates: Partial<ExchangeConnection>) => void;
  setGlobalLoading: (loading: boolean, tip?: string) => void;

  // 系统时间
  currentUtcTime: string;
  setCurrentUtcTime: (time: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  wsStatus: 'disconnected',
  marketLatency: 0,
  exchangeConnections: [
    { exchange: 'binance', status: 'disconnected', latency: 0 },
    { exchange: 'okx', status: 'disconnected', latency: 0 },
    { exchange: 'bybit', status: 'disconnected', latency: 0 },
    { exchange: 'gate', status: 'disconnected', latency: 0 },
  ],
  globalLoading: false,
  globalLoadingTip: '',
  currentUtcTime: '',

  setWsStatus: (wsStatus) => set({ wsStatus }),
  setMarketLatency: (marketLatency) => set({ marketLatency }),
  setExchangeConnections: (exchangeConnections) => set({ exchangeConnections }),
  updateExchangeConnection: (exchange, updates) =>
    set((state) => ({
      exchangeConnections: state.exchangeConnections.map((c) =>
        c.exchange === exchange ? { ...c, ...updates } : c
      ),
    })),
  setGlobalLoading: (globalLoading, globalLoadingTip = '') =>
    set({ globalLoading, globalLoadingTip }),
  setCurrentUtcTime: (currentUtcTime) => set({ currentUtcTime }),
}));
