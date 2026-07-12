import { create } from 'zustand';
import type { Position, Order, TradingAccount } from '@/lib/types';

interface TradeState {
  // 模拟账户
  simAccounts: TradingAccount[];
  simPositions: Record<string, Position[]>;
  simOrders: Record<string, Order[]>;

  // 实盘
  liveAccounts: TradingAccount[];
  livePositions: Position[];
  liveOrders: Order[];

  // 当前选中
  selectedAccountId: string | null;
  isLiveMode: boolean;

  // Actions
  setSimAccounts: (accounts: TradingAccount[]) => void;
  setLiveAccounts: (accounts: TradingAccount[]) => void;
  setLivePositions: (positions: Position[]) => void;
  updatePosition: (id: string, updates: Partial<Position>) => void;
  setLiveOrders: (orders: Order[]) => void;
  updateOrder: (id: string, updates: Partial<Order>) => void;
  setSimPositions: (accountId: string, positions: Position[]) => void;
  setSimOrders: (accountId: string, orders: Order[]) => void;
  setSelectedAccountId: (id: string | null) => void;
  setIsLiveMode: (live: boolean) => void;
}

export const useTradeStore = create<TradeState>((set) => ({
  simAccounts: [],
  simPositions: {},
  simOrders: {},
  liveAccounts: [],
  livePositions: [],
  liveOrders: [],
  selectedAccountId: null,
  isLiveMode: false,

  setSimAccounts: (simAccounts) => set({ simAccounts }),
  setLiveAccounts: (liveAccounts) => set({ liveAccounts }),

  setLivePositions: (livePositions) => set({ livePositions }),
  updatePosition: (id, updates) =>
    set((state) => ({
      livePositions: state.livePositions.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    })),

  setLiveOrders: (liveOrders) => set({ liveOrders }),
  updateOrder: (id, updates) =>
    set((state) => ({
      liveOrders: state.liveOrders.map((o) =>
        o.id === id ? { ...o, ...updates } : o
      ),
    })),

  setSimPositions: (accountId, positions) =>
    set((state) => ({
      simPositions: { ...state.simPositions, [accountId]: positions },
    })),

  setSimOrders: (accountId, orders) =>
    set((state) => ({
      simOrders: { ...state.simOrders, [accountId]: orders },
    })),

  setSelectedAccountId: (selectedAccountId) => set({ selectedAccountId }),
  setIsLiveMode: (isLiveMode) => set({ isLiveMode }),
}));
