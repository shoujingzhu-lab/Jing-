import type {
  StrategyHealth,
  MarketState,
  AttributionResult,
  ParamSensitivity,
  AltcoinCorrelation,
  OptimizationSuggestion,
  AdaptiveModeConfig,
} from '@/lib/types';

// ========== 策略健康度列表 ==========

export function mockStrategyHealthList(): StrategyHealth[] {
  return [
    {
      strategyId: 'strat-001',
      strategyName: 'EMA金叉策略',
      score: 82,
      dimensions: {
        profitability: 85,
        risk: 75,
        stability: 80,
        overfittingRisk: 72,
        adaptability: 78,
      },
      issues: ['参数对短期波动敏感', '震荡市中胜率下降'],
    },
    {
      strategyId: 'strat-002',
      strategyName: 'RSI超卖反弹',
      score: 65,
      dimensions: {
        profitability: 70,
        risk: 60,
        stability: 65,
        overfittingRisk: 55,
        adaptability: 62,
      },
      issues: ['趋势市中假信号频发', '需优化超卖阈值', '过拟合风险中等'],
    },
    {
      strategyId: 'strat-003',
      strategyName: '布林带突破',
      score: 78,
      dimensions: {
        profitability: 80,
        risk: 72,
        stability: 75,
        overfittingRisk: 85,
        adaptability: 74,
      },
      issues: ['参数稳定性良好'],
    },
    {
      strategyId: 'strat-005',
      strategyName: '多因子选币',
      score: 88,
      dimensions: {
        profitability: 90,
        risk: 82,
        stability: 88,
        overfittingRisk: 90,
        adaptability: 85,
      },
      issues: [],
    },
  ];
}

// ========== 市场状态 ==========

export function mockMarketState(): MarketState {
  return {
    currentState: '震荡偏多',
    confidence: 0.72,
    transitionProbabilities: [
      { state: '趋势上涨', probability: 0.15 },
      { state: '震荡偏多', probability: 0.45 },
      { state: '横盘', probability: 0.20 },
      { state: '震荡偏空', probability: 0.12 },
      { state: '趋势下跌', probability: 0.08 },
    ],
    btcDominance: 0.485,
    fearGreedIndex: 62,
    altcoinSeasonIndex: 35,
  };
}

// ========== 收益归因 ==========

export function mockAttribution(): AttributionResult {
  return {
    categories: {
      beta: 0.215,
      alpha: 0.1695,
      fundingFee: -0.008,
      tradingFee: -0.012,
    },
    feeErosionPercent: 5.6,
    feeErosionWarning: false,
  };
}

// ========== 参数敏感性 ==========

export function mockParamSensitivity(): ParamSensitivity[] {
  return [
    {
      paramName: 'fastPeriod',
      paramValues: [6, 8, 10, 12, 14, 16, 18, 20],
      sharpeValues: [1.2, 1.5, 1.7, 1.85, 1.75, 1.6, 1.45, 1.3],
      drawdownValues: [0.18, 0.16, 0.15, 0.152, 0.16, 0.17, 0.19, 0.21],
    },
    {
      paramName: 'slowPeriod',
      paramValues: [20, 22, 24, 26, 28, 30, 32, 34],
      sharpeValues: [1.5, 1.65, 1.78, 1.85, 1.8, 1.7, 1.55, 1.4],
      drawdownValues: [0.17, 0.16, 0.153, 0.152, 0.155, 0.16, 0.18, 0.2],
    },
    {
      paramName: 'signalPeriod',
      paramValues: [5, 7, 9, 11, 13, 15],
      sharpeValues: [1.6, 1.75, 1.85, 1.78, 1.65, 1.5],
      drawdownValues: [0.16, 0.155, 0.152, 0.158, 0.17, 0.19],
    },
  ];
}

// ========== 山寨币关联分析 ==========

export function mockAltcoinCorrelation(): AltcoinCorrelation[] {
  return [
    { symbol: 'ETH/USDT', name: 'Ethereum', btcCorrelation: 0.82, ethCorrelation: 1.0, marketCap: 380e9, beta: 1.12 },
    { symbol: 'SOL/USDT', name: 'Solana', btcCorrelation: 0.75, ethCorrelation: 0.78, marketCap: 85e9, beta: 1.35 },
    { symbol: 'BNB/USDT', name: 'BNB', btcCorrelation: 0.68, ethCorrelation: 0.65, marketCap: 92e9, beta: 0.95 },
    { symbol: 'XRP/USDT', name: 'Ripple', btcCorrelation: 0.55, ethCorrelation: 0.52, marketCap: 35e9, beta: 0.82 },
    { symbol: 'DOGE/USDT', name: 'Dogecoin', btcCorrelation: 0.48, ethCorrelation: 0.45, marketCap: 18e9, beta: 1.55 },
    { symbol: 'AVAX/USDT', name: 'Avalanche', btcCorrelation: 0.72, ethCorrelation: 0.75, marketCap: 14e9, beta: 1.28 },
    { symbol: 'LINK/USDT', name: 'Chainlink', btcCorrelation: 0.65, ethCorrelation: 0.68, marketCap: 12e9, beta: 1.05 },
    { symbol: 'MATIC/USDT', name: 'Polygon', btcCorrelation: 0.62, ethCorrelation: 0.70, marketCap: 9e9, beta: 1.18 },
    { symbol: 'UNI/USDT', name: 'Uniswap', btcCorrelation: 0.58, ethCorrelation: 0.64, marketCap: 7e9, beta: 1.22 },
    { symbol: 'ATOM/USDT', name: 'Cosmos', btcCorrelation: 0.52, ethCorrelation: 0.55, marketCap: 5e9, beta: 0.98 },
    { symbol: 'APT/USDT', name: 'Aptos', btcCorrelation: 0.68, ethCorrelation: 0.62, marketCap: 4e9, beta: 1.42 },
    { symbol: 'ARB/USDT', name: 'Arbitrum', btcCorrelation: 0.55, ethCorrelation: 0.72, marketCap: 3e9, beta: 1.15 },
  ];
}

// ========== 优化建议 ==========

export function mockSuggestions(): OptimizationSuggestion[] {
  return [
    {
      id: 'sug-001',
      type: 'parameter',
      title: '调低 fastPeriod 参数',
      description: '当前 fastPeriod=14，回测显示 fastPeriod=12 时 Sharpe 比率提升 8%',
      impact: 'medium',
      currentValue: '14',
      suggestedValue: '12',
    },
    {
      id: 'sug-002',
      type: 'market_adaptation',
      title: '震荡市自动降频',
      description: '当前市场处于震荡偏多状态，建议启用自适应降频模式以减少假信号',
      impact: 'high',
    },
    {
      id: 'sug-003',
      type: 'risk_control',
      title: '增加最大回撤限制',
      description: '当前无最大回撤限制，建议设置 25% 回撤上限以保护本金',
      impact: 'high',
    },
    {
      id: 'sug-004',
      type: 'parameter',
      title: '优化止损比例',
      description: '当前止损 5%，数据显示调整至 3.5% 可提高盈亏比 12%',
      impact: 'medium',
      currentValue: '5%',
      suggestedValue: '3.5%',
    },
  ];
}

// ========== 自适应配置 ==========

export function mockAdaptiveMode(): AdaptiveModeConfig {
  return {
    enabled: false,
    adjustableParams: ['fastPeriod', 'slowPeriod', 'stopLoss', 'takeProfit'],
    paramRanges: {
      fastPeriod: { min: 6, max: 20 },
      slowPeriod: { min: 20, max: 40 },
      stopLoss: { min: 0.02, max: 0.08 },
      takeProfit: { min: 0.05, max: 0.2 },
    },
    adjustFrequency: 'weekly',
  };
}

// ========== 策略完整诊断数据 ==========

export function mockStrategyDiagnosis(strategyId: string) {
  return {
    health: mockStrategyHealthList().find((h) => h.strategyId === strategyId) || mockStrategyHealthList()[0],
    attribution: mockAttribution(),
    paramSensitivity: mockParamSensitivity(),
    suggestions: mockSuggestions(),
    adaptiveMode: mockAdaptiveMode(),
  };
}
