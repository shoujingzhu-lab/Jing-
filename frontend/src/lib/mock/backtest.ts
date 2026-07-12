import type {
  BacktestTask,
  BacktestReport,
  BacktestMetrics,
  TradeDetail,
  DrawdownPeriod,
  BacktestConfig,
  PortfolioReport,
  ParamOptimizationResult,
  WalkForwardResult,
  SampleValidationResult,
  BenchmarkComparison,
} from '@/lib/types';

// ========== 回测任务列表 ==========

export function mockBacktestTasks(): BacktestTask[] {
  return [
    {
      id: 'bt-001',
      strategyId: 'strat-001',
      strategyName: 'EMA金叉策略',
      symbols: ['BTC/USDT'],
      period: '2025-01-01 ~ 2026-06-01',
      status: 'completed',
      submittedAt: '2026-06-05T10:30:00Z',
      duration: 124500,
      progress: 100,
    },
    {
      id: 'bt-002',
      strategyId: 'strat-002',
      strategyName: 'RSI超卖反弹',
      symbols: ['ETH/USDT', 'SOL/USDT'],
      period: '2025-03-01 ~ 2026-05-31',
      status: 'running',
      submittedAt: '2026-06-07T08:15:00Z',
      progress: 67,
      estimatedTimeRemaining: 180,
    },
    {
      id: 'bt-003',
      strategyId: 'strat-003',
      strategyName: '布林带突破',
      symbols: ['BNB/USDT'],
      period: '2025-06-01 ~ 2026-06-01',
      status: 'queued',
      submittedAt: '2026-06-07T11:00:00Z',
    },
    {
      id: 'bt-004',
      strategyId: 'strat-004',
      strategyName: 'MACD背离策略',
      symbols: ['XRP/USDT', 'DOGE/USDT'],
      period: '2025-01-01 ~ 2025-12-31',
      status: 'failed',
      submittedAt: '2026-06-06T14:20:00Z',
      duration: 89000,
    },
    {
      id: 'bt-005',
      strategyId: 'strat-005',
      strategyName: '多因子选币',
      symbols: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'],
      period: '2025-01-01 ~ 2026-06-01',
      status: 'completed',
      submittedAt: '2026-06-04T09:00:00Z',
      duration: 256000,
      progress: 100,
    },
    {
      id: 'bt-006',
      strategyId: 'strat-001',
      strategyName: 'EMA金叉策略',
      symbols: ['ETH/USDT'],
      period: '2025-09-01 ~ 2026-05-31',
      status: 'cancelled',
      submittedAt: '2026-06-03T16:45:00Z',
      progress: 42,
    },
  ];
}

// ========== 回测指标 ==========

export function mockBacktestMetrics(): BacktestMetrics {
  return {
    totalReturn: 0.3845,
    annualizedReturn: 0.267,
    sharpeRatio: 1.85,
    maxDrawdown: 0.152,
    winRate: 0.623,
    profitFactor: 1.94,
    calmarRatio: 1.76,
    totalTrades: 247,
    avgTradeDuration: '4h 32m',
    avgWinAmount: 158.3,
    avgLossAmount: 92.7,
  };
}

// ========== 回测报告 ==========

export function mockBacktestReport(taskId: string): BacktestReport {
  const equityCurve = generateEquityCurve();
  return {
    id: `report-${taskId}`,
    taskId,
    metrics: mockBacktestMetrics(),
    equityCurve,
    monthlyReturns: generateMonthlyReturns(),
    trades: mockTradeDetails(),
    drawdownPeriods: mockDrawdownPeriods(),
    paramOptimization: mockParamOptimization(),
    walkForwardResult: mockWalkForwardResult(),
    sampleValidation: mockSampleValidation(),
    benchmarkComparison: mockBenchmarkComparison(),
  };
}

function generateEquityCurve(): { time: string; equity: number; drawdown: number }[] {
  const points = 180;
  const data: { time: string; equity: number; drawdown: number }[] = [];
  let equity = 10000;
  let peak = 10000;

  for (let i = 0; i < points; i++) {
    const date = new Date('2025-01-01');
    date.setDate(date.getDate() + i);
    const change = (Math.random() - 0.48) * 0.04 * equity;
    equity += change;
    if (equity < 8000) equity = 8000 + Math.random() * 500;
    if (equity > peak) peak = equity;
    const drawdown = peak > 0 ? (peak - equity) / peak : 0;

    data.push({
      time: date.toISOString().split('T')[0],
      equity: Math.round(equity * 100) / 100,
      drawdown: Math.round(drawdown * 10000) / 100,
    });
  }
  return data;
}

function generateMonthlyReturns(): { month: string; return: number }[] {
  const months = [
    '2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06',
    '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12',
    '2026-01', '2026-02', '2026-03', '2026-04', '2026-05',
  ];
  return months.map((month) => ({
    month,
    return: Math.round((Math.random() * 0.2 - 0.05) * 10000) / 100,
  }));
}

export function mockTradeDetails(): TradeDetail[] {
  const trades: TradeDetail[] = [];
  const symbols = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'];
  for (let i = 0; i < 30; i++) {
    const side = Math.random() > 0.5 ? 'buy' : 'sell';
    const isWin = Math.random() > 0.38;
    const entryPrice = Math.random() * 3000 + 200;
    const exitMultiplier = isWin ? 1 + Math.random() * 0.1 : 1 - Math.random() * 0.05;
    const pnlPercent = (exitMultiplier - 1) * 100;
    const quantity = Math.random() * 100;
    const pnl = entryPrice * quantity * (exitMultiplier - 1);

    const openDate = new Date('2026-05-01');
    openDate.setDate(openDate.getDate() + Math.floor(Math.random() * 60));
    const closeDate = new Date(openDate);
    closeDate.setHours(closeDate.getHours() + Math.floor(Math.random() * 48));

    trades.push({
      id: `trade-${String(i + 1).padStart(3, '0')}`,
      openTime: openDate.toISOString(),
      closeTime: closeDate.toISOString(),
      side,
      entryPrice: Math.round(entryPrice * 100) / 100,
      exitPrice: Math.round(entryPrice * exitMultiplier * 100) / 100,
      quantity: Math.round(quantity * 100) / 100,
      pnl: Math.round(pnl * 100) / 100,
      pnlPercent: Math.round(pnlPercent * 100) / 100,
      holdingDuration: `${Math.floor(Math.random() * 48)}h ${Math.floor(Math.random() * 60)}m`,
      reason: side === 'buy' ? 'EMA金叉信号' : '止盈触发',
    });
  }
  return trades;
}

export function mockDrawdownPeriods(): DrawdownPeriod[] {
  return [
    {
      startDate: '2025-03-15',
      endDate: '2025-04-02',
      recoveryDate: '2025-04-28',
      drawdown: 0.12,
      recoveryDays: 26,
      eventLabel: 'BTC 大盘回调',
    },
    {
      startDate: '2025-08-10',
      endDate: '2025-08-25',
      recoveryDate: '2025-09-15',
      drawdown: 0.08,
      recoveryDays: 21,
    },
    {
      startDate: '2026-01-20',
      endDate: '2026-02-05',
      recoveryDate: '2026-02-20',
      drawdown: 0.152,
      recoveryDays: 15,
      eventLabel: '宏观利率政策冲击',
    },
  ];
}

export function mockParamOptimization(): ParamOptimizationResult {
  const heatmap: { x: number; y: number; value: number }[][] = [];
  for (let i = 0; i < 10; i++) {
    const row: { x: number; y: number; value: number }[] = [];
    for (let j = 0; j < 10; j++) {
      row.push({ x: i, y: j, value: Math.round((Math.random() * 1.5 + 0.5) * 100) / 100 });
    }
    heatmap.push(row);
  }

  return {
    method: 'grid',
    heatmap,
    optimalParams: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
    elapsedTime: 342.5,
  };
}

export function mockWalkForwardResult(): WalkForwardResult {
  return {
    windows: Array.from({ length: 6 }, (_, i) => {
      const date = new Date('2025-01-01');
      date.setMonth(date.getMonth() + i * 3);
      const trainStart = date.toISOString().split('T')[0];
      const trainEnd = new Date(date.getTime() + 60 * 86400000).toISOString().split('T')[0];
      const testStart = new Date(date.getTime() + 61 * 86400000).toISOString().split('T')[0];
      const testEnd = new Date(date.getTime() + 90 * 86400000).toISOString().split('T')[0];
      return {
        trainStart,
        trainEnd,
        testStart,
        testEnd,
        return: Math.round((Math.random() * 0.3 - 0.05) * 10000) / 100,
        sharpe: Math.round((Math.random() * 1.5 + 0.5) * 100) / 100,
        optimalParams: { fastPeriod: 10 + i * 2, slowPeriod: 25 + i, signalPeriod: 9 },
      };
    }),
  };
}

export function mockSampleValidation(): SampleValidationResult {
  return {
    inSampleReturn: 0.42,
    outSampleReturn: 0.28,
    inSampleSharpe: 2.1,
    outSampleSharpe: 1.5,
    overfittingScore: 0.33,
    overfittingLevel: 'low',
  };
}

export function mockBenchmarkComparison(): BenchmarkComparison {
  return {
    benchmark: 'BTC/USDT Buy & Hold',
    benchmarkReturn: 0.215,
    strategyReturn: 0.3845,
    alpha: 0.1695,
    beta: 0.72,
    trackingError: 0.085,
  };
}

// ========== 组合回测 ==========

export function mockPortfolioReport(): PortfolioReport {
  return {
    id: 'portfolio-001',
    strategies: [
      { strategyId: 'strat-001', name: 'EMA金叉', weight: 0.4, return: 0.385, sharpe: 1.85 },
      { strategyId: 'strat-002', name: 'RSI超卖反弹', weight: 0.35, return: 0.28, sharpe: 1.42 },
      { strategyId: 'strat-005', name: '多因子选币', weight: 0.25, return: 0.32, sharpe: 1.65 },
    ],
    totalReturn: 0.336,
    sharpeRatio: 1.78,
    maxDrawdown: 0.118,
    winRate: 0.645,
    equityCurves: generateEquityCurve(),
    strategyContribution: [
      { strategyId: 'strat-001', name: 'EMA金叉', contribution: 0.154 },
      { strategyId: 'strat-002', name: 'RSI超卖反弹', contribution: 0.098 },
      { strategyId: 'strat-005', name: '多因子选币', contribution: 0.084 },
    ],
    correlation: [
      { strategyA: 'EMA金叉', strategyB: 'RSI超卖反弹', correlation: 0.32 },
      { strategyA: 'EMA金叉', strategyB: '多因子选币', correlation: 0.45 },
      { strategyA: 'RSI超卖反弹', strategyB: '多因子选币', correlation: 0.28 },
    ],
  };
}

// ========== 模拟延迟 ==========

export function mockDelay<T>(data: T, ms = 400): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}
