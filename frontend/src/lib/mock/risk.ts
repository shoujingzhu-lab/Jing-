import type {
  RiskOverview,
  StrategyRisk,
  RiskEvent,
  RiskRuleConfig,
  MeltdownStatus,
  Position,
} from '@/lib/types';

// ========== 风控概览 ==========

export function mockRiskOverview(): RiskOverview {
  return {
    totalExposure: 45678.5,
    marginUsageRatio: 0.42,
    currentDrawdown: 0.065,
    activeAlerts: 2,
    riskLevel: 'warning',
  };
}

// ========== 策略风控列表 ==========

export function mockStrategyRisks(): StrategyRisk[] {
  return [
    {
      strategyId: 'strat-001',
      strategyName: 'EMA金叉策略',
      status: 'live',
      todayPnl: 234.5,
      dailyLossLimit: 1000,
      dailyLossUsed: 120,
      consecutiveLosses: 1,
      maxConsecutiveLosses: 5,
      nextMeltdownCondition: '连续亏损达5次 / 日亏损达$1000',
    },
    {
      strategyId: 'strat-002',
      strategyName: 'RSI超卖反弹',
      status: 'simulating',
      todayPnl: -340.2,
      dailyLossLimit: 800,
      dailyLossUsed: 340.2,
      consecutiveLosses: 3,
      maxConsecutiveLosses: 5,
      nextMeltdownCondition: '连续亏损达5次 / 日亏损达$800',
    },
    {
      strategyId: 'strat-003',
      strategyName: '布林带突破',
      status: 'live',
      todayPnl: 1520.8,
      dailyLossLimit: 2000,
      dailyLossUsed: 0,
      consecutiveLosses: 0,
      maxConsecutiveLosses: 4,
      nextMeltdownCondition: '连续亏损达4次 / 日亏损达$2000',
    },
    {
      strategyId: 'strat-004',
      strategyName: 'MACD背离策略',
      status: 'paused',
      todayPnl: 0,
      dailyLossLimit: 1500,
      dailyLossUsed: 0,
      consecutiveLosses: 6,
      maxConsecutiveLosses: 5,
      nextMeltdownCondition: '已触发熔断 — 连续亏损超限',
    },
  ];
}

// ========== 持仓风险明细 ==========

export function mockRiskPositions(): Position[] {
  return [
    {
      id: 'pos-001',
      symbol: 'BTC/USDT',
      exchange: 'binance',
      side: 'long',
      quantity: 0.15,
      entryPrice: 45200,
      markPrice: 46800,
      liquidationPrice: 38500,
      leverage: 5,
      margin: 1356,
      unrealizedPnl: 240,
      realizedPnl: 0,
      stopLoss: 44200,
      takeProfit: 49000,
      marginRatio: 0.35,
      riskLevel: 'safe',
    },
    {
      id: 'pos-002',
      symbol: 'ETH/USDT',
      exchange: 'okx',
      side: 'long',
      quantity: 5,
      entryPrice: 3200,
      markPrice: 3150,
      liquidationPrice: 2850,
      leverage: 3,
      margin: 5333,
      unrealizedPnl: -250,
      realizedPnl: 0,
      stopLoss: 3050,
      marginRatio: 0.55,
      riskLevel: 'warning',
    },
    {
      id: 'pos-003',
      symbol: 'SOL/USDT',
      exchange: 'bybit',
      side: 'short',
      quantity: 50,
      entryPrice: 185,
      markPrice: 192,
      liquidationPrice: 210,
      leverage: 4,
      margin: 2312,
      unrealizedPnl: -350,
      realizedPnl: 0,
      marginRatio: 0.72,
      riskLevel: 'warning',
    },
    {
      id: 'pos-004',
      symbol: 'DOGE/USDT',
      exchange: 'binance',
      side: 'long',
      quantity: 50000,
      entryPrice: 0.085,
      markPrice: 0.078,
      liquidationPrice: 0.072,
      leverage: 10,
      margin: 425,
      unrealizedPnl: -350,
      realizedPnl: 0,
      marginRatio: 0.88,
      riskLevel: 'danger',
    },
  ];
}

// ========== 风控事件 ==========

export function mockRiskEvents(): RiskEvent[] {
  return [
    {
      id: 'evt-001',
      type: 'stop_loss',
      strategyId: 'strat-001',
      symbol: 'BTC/USDT',
      message: 'BTC/USDT 触发止损，价格触及 $44,200',
      time: '2026-06-07T09:15:00Z',
      severity: 'warning',
    },
    {
      id: 'evt-002',
      type: 'margin_call',
      strategyId: 'strat-004',
      symbol: 'DOGE/USDT',
      message: 'DOGE/USDT 保证金率降至 12%，接近强平线',
      time: '2026-06-07T08:30:00Z',
      severity: 'danger',
    },
    {
      id: 'evt-003',
      type: 'meltdown',
      strategyId: 'strat-004',
      message: 'MACD背离策略触发熔断：连续亏损 6 次，超过上限 5 次',
      time: '2026-06-06T22:10:00Z',
      severity: 'danger',
    },
    {
      id: 'evt-004',
      type: 'take_profit',
      strategyId: 'strat-003',
      symbol: 'BNB/USDT',
      message: 'BNB/USDT 触发止盈，盈利 $1,520.80',
      time: '2026-06-07T06:45:00Z',
      severity: 'info',
    },
    {
      id: 'evt-005',
      type: 'liquidation_warning',
      symbol: 'DOGE/USDT',
      message: 'DOGE/USDT 强平预警：距强平价仅 7.7%',
      time: '2026-06-07T09:30:00Z',
      severity: 'danger',
    },
  ];
}

// ========== 风控规则 ==========

export function mockRiskRules(): RiskRuleConfig {
  return {
    defaultStopLoss: 0.05,
    defaultTakeProfit: 0.15,
    dailyLossLimit: 2000,
    maxConsecutiveLosses: 5,
    maxDrawdownLimit: 0.25,
    maxLeverage: 10,
  };
}

// ========== 熔断状态 ==========

export function mockMeltdownStatus(): MeltdownStatus {
  return {
    isActive: true,
    triggeredAt: '2026-06-06T22:10:00Z',
    reason: 'MACD背离策略连续亏损 6 次，超过上限 5 次',
    cooldownEnd: '2026-06-07T10:10:00Z',
    affectedStrategies: ['strat-004'],
  };
}
