// ========== 通用类型 ==========

export type Exchange = 'binance' | 'okx' | 'bybit' | 'gate';
export type MarketType = 'spot' | 'perpetual' | 'futures' | 'leveraged_token';
export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit' | 'stop_loss' | 'take_profit' | 'iceberg' | 'twap';
export type PositionSide = 'long' | 'short';
export type OrderStatus = 'created' | 'submitted' | 'partial_filled' | 'filled' | 'cancelled' | 'expired' | 'rejected';
export type StrategyStatus = 'draft' | 'backtesting' | 'simulating' | 'live' | 'paused' | 'archived';
export type StrategyType = 'visual' | 'code';
export type BacktestStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type KlinePeriod = '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w' | '1M';
export type RiskLevel = 'safe' | 'warning' | 'danger';
export type UserRole = 'user' | 'advanced_user' | 'strategy_reviewer' | 'admin';
export type NotificationType = 'alert' | 'system' | 'trade' | 'data';
export type NotificationChannel = 'site' | 'email' | 'telegram' | 'discord' | 'dingtalk';

// ========== 用户与认证 ==========

export interface User {
  id: string;
  email: string;
  phone?: string;
  nickname: string;
  avatar?: string;
  role: UserRole;
  twoFactorEnabled: boolean;
  createdAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: User;
}

export interface RegisterRequest {
  email: string;
  password: string;
  confirmPassword: string;
  agreeToTerms: boolean;
  captchaToken?: string;
}

export interface SessionInfo {
  id: string;
  device: string;
  ip: string;
  location: string;
  lastActive: string;
  isCurrent: boolean;
}

export interface LoginHistoryEntry {
  id: string;
  ip: string;
  location: string;
  device: string;
  time: string;
  success: boolean;
}

// ========== 行情数据 ==========

export interface Ticker {
  symbol: string;
  exchange: Exchange;
  lastPrice: number;
  change24h: number;
  changePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  quoteVolume24h: number;
  timestamp: number;
}

export interface OrderBookLevel {
  price: number;
  amount: number;
}

export interface OrderBook {
  symbol: string;
  exchange: Exchange;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  timestamp: number;
}

export interface TradeTick {
  id: string;
  symbol: string;
  exchange: Exchange;
  price: number;
  amount: number;
  side: OrderSide;
  timestamp: number;
}

export interface Kline {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
}

export interface FundingRate {
  symbol: string;
  exchange: Exchange;
  rate: number;
  predictedRate?: number;
  nextSettleTime: number;
  markPrice: number;
  indexPrice: number;
}

export interface MarketAggregation {
  symbol: string;
  exchanges: {
    exchange: Exchange;
    bid: number;
    ask: number;
    spread: number;
    spreadPercent: number;
  }[];
  bestBid: { exchange: Exchange; price: number };
  bestAsk: { exchange: Exchange; price: number };
  crossExchangeSpreadPercent: number;
}

// ========== 策略 ==========

export interface Strategy {
  id: string;
  name: string;
  description?: string;
  type: StrategyType;
  status: StrategyStatus;
  symbols: string[];
  exchange: Exchange;
  createdAt: string;
  updatedAt: string;
  version: number;
  lastBacktest?: BacktestSummary;
  runningDays: number;
  tags?: string[];
}

export interface StrategyNode {
  id: string;
  type: string;
  category: NodeCategory;
  position: { x: number; y: number };
  data: Record<string, unknown>;
  inputs: string[];
  outputs: string[];
}

export interface StrategyEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
}

export interface VisualStrategy {
  id: string;
  nodes: StrategyNode[];
  edges: StrategyEdge[];
}

export type NodeCategory =
  | 'indicator'
  | 'price_pattern'
  | 'volume'
  | 'orderbook'
  | 'derivatives'
  | 'math'
  | 'comparison'
  | 'logic'
  | 'action'
  | 'risk';

export interface StrategyVersion {
  version: number;
  timestamp: string;
  author: string;
  summary: string;
  tags: string[];
}

export interface VersionDiff {
  versionA: number;
  versionB: number;
  addedNodes: StrategyNode[];
  removedNodes: StrategyNode[];
  modifiedNodes: { node: StrategyNode; changes: Record<string, { old: unknown; new: unknown }> }[];
  addedEdges: StrategyEdge[];
  removedEdges: StrategyEdge[];
}

// ========== 回测 ==========

export interface BacktestConfig {
  strategyId: string;
  symbols: string[];
  klinePeriod: KlinePeriod;
  startDate: string;
  endDate: string;
  initialCapital: number;
  feeRate: number;
  slippage: number;
  // 高级设置
  matchMode?: 'next_open' | 'current_close' | 'vwap' | 'counterparty';
  marginMode?: 'cross' | 'isolated';
  leverage?: number;
  // 样本外验证
  trainTestSplit?: { train: number; test: number };
  // Walk-Forward
  walkForward?: { windowSize: number; stepSize: number };
  // 参数优化
  optimization?: {
    method: 'grid' | 'bayesian' | 'genetic';
    params: OptimizationParam[];
    iterations?: number;
    populationSize?: number;
    generations?: number;
    mutationRate?: number;
  };
}

export interface OptimizationParam {
  name: string;
  min: number;
  max: number;
  step: number;
}

export interface BacktestTask {
  id: string;
  strategyId: string;
  strategyName: string;
  symbols: string[];
  period: string;
  status: BacktestStatus;
  submittedAt: string;
  duration?: number;
  progress?: number;
  estimatedTimeRemaining?: number;
}

export interface BacktestReport {
  id: string;
  taskId: string;
  metrics: BacktestMetrics;
  equityCurve: { time: string; equity: number; drawdown: number }[];
  monthlyReturns: { month: string; return: number }[];
  trades: TradeDetail[];
  drawdownPeriods: DrawdownPeriod[];
  paramOptimization?: ParamOptimizationResult;
  walkForwardResult?: WalkForwardResult;
  sampleValidation?: SampleValidationResult;
  benchmarkComparison?: BenchmarkComparison;
}

export interface BacktestMetrics {
  totalReturn: number;
  annualizedReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  calmarRatio: number;
  totalTrades: number;
  avgTradeDuration: string;
  avgWinAmount: number;
  avgLossAmount: number;
}

export interface BacktestSummary {
  id: string;
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  completedAt: string;
}

export interface TradeDetail {
  id: string;
  openTime: string;
  closeTime: string;
  side: OrderSide;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  pnlPercent: number;
  holdingDuration: string;
  reason: string;
}

export interface DrawdownPeriod {
  startDate: string;
  endDate: string;
  recoveryDate: string;
  drawdown: number;
  recoveryDays: number;
  eventLabel?: string;
}

export interface ParamOptimizationResult {
  method: 'grid' | 'bayesian' | 'genetic';
  heatmap: { x: number; y: number; value: number }[][];
  optimalParams: Record<string, number>;
  elapsedTime: number;
}

export interface WalkForwardResult {
  windows: {
    trainStart: string;
    trainEnd: string;
    testStart: string;
    testEnd: string;
    return: number;
    sharpe: number;
    optimalParams: Record<string, number>;
  }[];
}

export interface SampleValidationResult {
  inSampleReturn: number;
  outSampleReturn: number;
  inSampleSharpe: number;
  outSampleSharpe: number;
  overfittingScore: number;
  overfittingLevel: 'low' | 'medium' | 'high';
}

export interface BenchmarkComparison {
  benchmark: string;
  benchmarkReturn: number;
  strategyReturn: number;
  alpha: number;
  beta: number;
  trackingError: number;
}

// 策略组合回测
export interface PortfolioBacktestConfig {
  strategies: { strategyId: string; weight: number }[];
  config: Omit<BacktestConfig, 'strategyId'>;
}

export interface PortfolioReport {
  id: string;
  strategies: { strategyId: string; name: string; weight: number; return: number; sharpe: number }[];
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  equityCurves: { time: string; equity: number }[];
  strategyContribution: { strategyId: string; name: string; contribution: number }[];
  correlation: { strategyA: string; strategyB: string; correlation: number }[];
}

// ========== 交易（模拟 + 实盘） ==========

export interface TradingAccount {
  id: string;
  name: string;
  type: 'spot' | 'contract';
  isSim: boolean;
  exchange: Exchange;
  initialCapital: number;
  currentEquity: number;
  availableMargin: number;
  usedMargin: number;
  unrealizedPnl: number;
  realizedPnl: number;
  todayPnl: number;
  totalReturn: number;
  totalReturnPercent: number;
  activeStrategies: number;
  createdAt: string;
}

export interface Position {
  id: string;
  symbol: string;
  exchange: Exchange;
  side: PositionSide;
  quantity: number;
  entryPrice: number;
  markPrice: number;
  liquidationPrice: number;
  leverage: number;
  margin: number;
  unrealizedPnl: number;
  realizedPnl: number;
  stopLoss?: number;
  takeProfit?: number;
  marginRatio: number;
  riskLevel: RiskLevel;
}

export interface Order {
  id: string;
  symbol: string;
  exchange: Exchange;
  side: OrderSide;
  type: OrderType;
  price?: number;
  quantity: number;
  filledQuantity: number;
  status: OrderStatus;
  strategyId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Trade {
  id: string;
  orderId: string;
  symbol: string;
  exchange: Exchange;
  side: OrderSide;
  price: number;
  quantity: number;
  fee: number;
  feeCurrency: string;
  realizedPnl: number;
  time: string;
}

// 订单路由
export interface OrderRoutingRule {
  id: string;
  name: string;
  strategyId?: string;
  exchanges: Exchange[];
  strategy: 'best_price' | 'lowest_fee' | 'designated_priority' | 'smart';
  failoverEnabled: boolean;
  symbols: string[];
  enabled: boolean;
}

// 资金费率保护
export interface FundingRateProtection {
  enabled: boolean;
  defaultAction: 'close' | 'hold' | 'close_if_positive';
  minutesBeforeSettle: number;
  perSymbolOverrides: Record<string, { action: 'close' | 'hold' | 'close_if_positive' }>;
}

// ========== 风控 ==========

export interface RiskOverview {
  totalExposure: number;
  marginUsageRatio: number;
  currentDrawdown: number;
  activeAlerts: number;
  riskLevel: RiskLevel;
}

export interface StrategyRisk {
  strategyId: string;
  strategyName: string;
  status: StrategyStatus;
  todayPnl: number;
  dailyLossLimit: number;
  dailyLossUsed: number;
  consecutiveLosses: number;
  maxConsecutiveLosses: number;
  nextMeltdownCondition: string;
}

export interface RiskEvent {
  id: string;
  type: 'stop_loss' | 'take_profit' | 'meltdown' | 'liquidation_warning' | 'margin_call';
  strategyId?: string;
  symbol?: string;
  message: string;
  time: string;
  severity: 'info' | 'warning' | 'danger';
}

export interface MeltdownStatus {
  isActive: boolean;
  triggeredAt?: string;
  reason?: string;
  cooldownEnd?: string;
  affectedStrategies: string[];
}

export interface RiskRuleConfig {
  defaultStopLoss: number;
  defaultTakeProfit: number;
  dailyLossLimit: number;
  maxConsecutiveLosses: number;
  maxDrawdownLimit: number;
  maxLeverage: number;
}

// ========== 智能分析 ==========

export interface StrategyHealth {
  strategyId: string;
  strategyName: string;
  score: number;
  dimensions: {
    profitability: number;
    risk: number;
    stability: number;
    overfittingRisk: number;
    adaptability: number;
  };
  issues: string[];
}

export interface MarketState {
  currentState: string;
  confidence: number;
  transitionProbabilities: { state: string; probability: number }[];
  btcDominance: number;
  fearGreedIndex: number;
  altcoinSeasonIndex: number;
}

export interface StrategyAdaptation {
  strategyId: string;
  strategyName: string;
  marketStates: Record<string, { fitness: number; recommendation: string }>;
}

export interface AttributionResult {
  categories: {
    beta: number;
    alpha: number;
    fundingFee: number;
    tradingFee: number;
  };
  feeErosionPercent: number;
  feeErosionWarning: boolean;
}

export interface ParamSensitivity {
  paramName: string;
  paramValues: number[];
  sharpeValues: number[];
  drawdownValues: number[];
}

export interface AltcoinCorrelation {
  symbol: string;
  name: string;
  btcCorrelation: number;
  ethCorrelation: number;
  marketCap: number;
  beta: number;
}

export interface OptimizationSuggestion {
  id: string;
  type: 'parameter' | 'market_adaptation' | 'risk_control';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  currentValue?: string;
  suggestedValue?: string;
}

export interface AdaptiveModeConfig {
  enabled: boolean;
  adjustableParams: string[];
  paramRanges: Record<string, { min: number; max: number }>;
  adjustFrequency: 'daily' | 'weekly' | 'monthly';
}

// ========== 通知 ==========

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  summary: string;
  content: string;
  time: string;
  read: boolean;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  label: string;
  action: string;
  payload?: unknown;
}

export interface NotificationPreference {
  type: NotificationType;
  channels: NotificationChannel[];
  enabled: boolean;
}

export interface PriceAlert {
  id: string;
  symbol: string;
  condition: 'gte' | 'lte';
  targetPrice: number;
  currentPrice: number;
  channels: NotificationChannel[];
  enabled: boolean;
  expiresAt?: string;
  triggeredAt?: string;
}

// ========== 数据中心 ==========

export interface DataDownloadRequest {
  exchange: Exchange;
  symbols: string[];
  dataType: 'kline' | 'orderbook' | 'trade' | 'funding_rate';
  period?: KlinePeriod;
  startDate: string;
  endDate: string;
  format: 'csv' | 'json' | 'parquet';
}

export interface DownloadTask {
  id: string;
  request: DataDownloadRequest;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  progress?: number;
  downloadUrl?: string;
  createdAt: string;
  completedAt?: string;
}

export interface Webhook {
  id: string;
  name: string;
  url: string;
  secret?: string;
  symbols: string[];
  eventTypes: WebhookEventType[];
  rateLimit: number;
  enabled: boolean;
  lastTriggeredAt?: string;
}

export type WebhookEventType = 'price_breakout' | 'large_trade' | 'funding_rate_settle' | 'strategy_signal' | 'risk_event';

// ========== 系统管理 ==========

export interface SystemHealth {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  onlineUsers: number;
  todayOrders: number;
  anomalyEvents: number;
  activeAlerts: number;
}

export interface ServiceStatus {
  name: string;
  status: 'online' | 'degraded' | 'offline';
  uptime: string;
  cpuUsage: number;
  memoryUsage: number;
}

export interface ExchangeStatus {
  exchange: Exchange;
  restLatency: number;
  wsStatus: 'connected' | 'reconnecting' | 'disconnected';
  successRate24h: number;
  rateLimitUsage: number;
  lastAnomaly?: string;
}

export interface SystemTask {
  id: string;
  name: string;
  description: string;
  cronExpression: string;
  lastRunTime?: string;
  lastDuration?: number;
  nextRunTime?: string;
  status: 'running' | 'paused' | 'failed';
}

export interface BacktestQueueItem {
  id: string;
  userId: string;
  userName: string;
  strategyName: string;
  params: string;
  submittedAt: string;
  queueTime: string;
  estimatedDuration: string;
  status: BacktestStatus;
  priority: number;
}

export interface SystemAlertRule {
  id: string;
  name: string;
  condition: string;
  severity: 'info' | 'warning' | 'serious' | 'critical';
  notifyTarget: string;
  cooldown: number;
  enabled: boolean;
}

// ========== WebSocket ==========

export interface WsMessage {
  channel: string;
  type: string;
  data: unknown;
  timestamp: number;
}

export type WsConnectionState = 'connected' | 'reconnecting' | 'disconnected';

// ========== API 通用响应 ==========

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export interface PaginatedResponse<T> {
  code: number;
  message: string;
  data: {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
  };
}

export interface PageParams {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
