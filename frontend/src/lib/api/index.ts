import client from './client';
import { API_PATHS } from '@/lib/constants';
import type {
  ApiResponse,
  PaginatedResponse,
  PageParams,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  User,
  Kline,
  FundingRate,
  MarketAggregation,
  Strategy,
  StrategyVersion,
  VisualStrategy,
  BacktestConfig,
  BacktestTask,
  BacktestReport,
  TradingAccount,
  Position,
  Order,
  Trade,
  RiskEvent,
  RiskRuleConfig,
  MeltdownStatus,
  StrategyHealth,
  MarketState,
  AttributionResult,
  ParamSensitivity,
  AltcoinCorrelation,
  OptimizationSuggestion,
  AdaptiveModeConfig,
  Notification,
  NotificationPreference,
  PriceAlert,
  DataDownloadRequest,
  DownloadTask,
  Webhook,
  SystemHealth,
  ServiceStatus,
  ExchangeStatus,
  SystemTask,
  BacktestQueueItem,
  SystemAlertRule,
} from '@/lib/types';

// ========== Auth ==========

export const authApi = {
  login: (data: LoginRequest) => client.post<ApiResponse<LoginResponse>>(API_PATHS.LOGIN, data),
  register: (data: RegisterRequest) => client.post<ApiResponse<null>>(API_PATHS.REGISTER, data),
  logout: (refreshToken: string) => client.post<ApiResponse<null>>(API_PATHS.LOGOUT, null, { params: { refresh_token: refreshToken } }),
  refreshToken: (refreshToken: string) => client.post<ApiResponse<LoginResponse>>(API_PATHS.REFRESH_TOKEN, null, { params: { refresh_token: refreshToken } }),
  getSessions: () => client.get<ApiResponse<unknown[]>>(API_PATHS.SESSIONS),
  revokeSession: (id: string) => client.delete<ApiResponse<null>>(API_PATHS.REVOKE_SESSION.replace('{id}', id)),
};

// ========== Users ==========

export const userApi = {
  getMe: () => client.get<ApiResponse<User>>(API_PATHS.USER_ME),
  changePassword: (oldPassword: string, newPassword: string) =>
    client.put<ApiResponse<null>>(API_PATHS.USER_CHANGE_PASSWORD, null, { params: { old_password: oldPassword, new_password: newPassword } }),
  getAuditLogs: (params?: PageParams & { action?: string }) =>
    client.get<PaginatedResponse<unknown>>(API_PATHS.USER_AUDIT_LOGS, { params }),
};

// ========== Data（行情 + 下载）==========

export const dataApi = {
  getExchanges: () => client.get<ApiResponse<unknown>>(API_PATHS.DATA_EXCHANGES),
  getTicker: (exchange: string, symbol: string) =>
    client.get<ApiResponse<unknown>>(API_PATHS.DATA_TICKER.replace('{exchange}', exchange).replace('{symbol}', symbol)),
  getOrderBook: (exchange: string, symbol: string, depth = 20) =>
    client.get<ApiResponse<unknown>>(API_PATHS.DATA_ORDERBOOK.replace('{exchange}', exchange).replace('{symbol}', symbol), { params: { depth } }),
  getKlines: (exchange: string, symbol: string, interval = '1h', limit = 500) =>
    client.get<ApiResponse<{ bars: Kline[]; count: number }>>(API_PATHS.DATA_KLINES.replace('{exchange}', exchange).replace('{symbol}', symbol), { params: { interval, limit } }),
  getFundingRate: (exchange: string, symbol: string) =>
    client.get<ApiResponse<FundingRate>>(API_PATHS.DATA_FUNDING_RATE.replace('{exchange}', exchange).replace('{symbol}', symbol)),
  getAggregated: (symbol: string) =>
    client.get<ApiResponse<MarketAggregation>>(API_PATHS.DATA_AGGREGATED.replace('{symbol}', symbol)),
  download: (params: {
    exchange: string; symbol: string; interval?: string; start_date: string; end_date: string; format?: string;
  }) => client.post<ApiResponse<unknown>>(API_PATHS.DATA_DOWNLOAD, null, { params }),
};

// ========== Strategies ==========

export const strategyApi = {
  getList: (params?: PageParams & { status?: string; strategy_type?: string; search?: string }) =>
    client.get<PaginatedResponse<Strategy>>(API_PATHS.STRATEGIES, { params }),
  getDetail: (id: string) => client.get<ApiResponse<Strategy>>(API_PATHS.STRATEGY_DETAIL.replace('{id}', id)),
  create: (data: Record<string, unknown>) => client.post<ApiResponse<Strategy>>(API_PATHS.STRATEGIES, data),
  update: (id: string, data: Record<string, unknown>) => client.put<ApiResponse<Strategy>>(API_PATHS.STRATEGY_DETAIL.replace('{id}', id), data),
  delete: (id: string) => client.delete<ApiResponse<null>>(API_PATHS.STRATEGY_DETAIL.replace('{id}', id)),
  clone: (id: string, name?: string) => client.post<ApiResponse<Strategy>>(API_PATHS.STRATEGY_CLONE.replace('{id}', id), name ? { name } : {}),
  getVersions: (id: string, params?: PageParams) =>
    client.get<PaginatedResponse<StrategyVersion>>(API_PATHS.STRATEGY_VERSIONS.replace('{id}', id), { params }),
  rollback: (id: string, version: number) =>
    client.post<ApiResponse<Strategy>>(API_PATHS.STRATEGY_ROLLBACK.replace('{id}', id).replace('{v}', String(version))),
  exportCode: (id: string) => client.post<ApiResponse<{ python_code: string }>>(API_PATHS.STRATEGY_EXPORT_CODE.replace('{id}', id)),
  getTemplates: () => client.get<ApiResponse<Strategy[]>>(API_PATHS.STRATEGY_TEMPLATES),
};

// ========== Backtest ==========

export const backtestApi = {
  getList: (params?: PageParams & { status?: string }) =>
    client.get<PaginatedResponse<BacktestTask>>(API_PATHS.BACKTESTS, { params }),
  create: (config: Record<string, unknown>) => client.post<ApiResponse<BacktestTask>>(API_PATHS.BACKTESTS, config),
  getDetail: (id: string) => client.get<ApiResponse<BacktestTask>>(API_PATHS.BACKTEST_DETAIL.replace('{id}', id)),
  cancel: (id: string) => client.post<ApiResponse<null>>(API_PATHS.BACKTEST_CANCEL.replace('{id}', id)),
  getReport: (id: string) => client.get<ApiResponse<BacktestReport>>(API_PATHS.BACKTEST_REPORT.replace('{id}', id)),
  // Parameter optimization
  createOptimization: (config: Record<string, unknown>) => client.post<ApiResponse<unknown>>(API_PATHS.BACKTEST_OPTIMIZE, config),
  getOptimizations: (params?: PageParams) => client.get<PaginatedResponse<unknown>>(API_PATHS.BACKTEST_OPTIMIZE, { params }),
  getOptimizationDetail: (id: string) => client.get<ApiResponse<unknown>>(API_PATHS.BACKTEST_OPTIMIZE_DETAIL.replace('{id}', id)),
};

// ========== Simulation ==========

export const simApi = {
  getAccounts: () => client.get<ApiResponse<TradingAccount[]>>(API_PATHS.SIM_ACCOUNTS),
  createAccount: (params: { name: string; account_type?: string; initial_capital?: number }) =>
    client.post<ApiResponse<null>>(API_PATHS.SIM_ACCOUNTS, null, { params }),
  getAccount: (id: string) => client.get<ApiResponse<TradingAccount>>(API_PATHS.SIM_ACCOUNT_DETAIL.replace('{id}', id)),
  deleteAccount: (id: string) => client.delete<ApiResponse<null>>(API_PATHS.SIM_ACCOUNT_DETAIL.replace('{id}', id)),
  resetAccount: (id: string) => client.post<ApiResponse<null>>(API_PATHS.SIM_ACCOUNT_RESET.replace('{id}', id)),
  pause: (id: string) => client.post<ApiResponse<null>>(API_PATHS.SIM_ACCOUNT_PAUSE.replace('{id}', id)),
  resume: (id: string) => client.post<ApiResponse<null>>(API_PATHS.SIM_ACCOUNT_RESUME.replace('{id}', id)),
  /** SIM-006: 启动模拟引擎 */
  start: (id: string, params: { strategy_id: string; symbol: string; exchange: string; kline_interval: string }) =>
    client.post<ApiResponse<unknown>>(API_PATHS.SIM_ACCOUNT_START.replace('{id}', id), null, { params }),
  stop: (id: string) => client.post<ApiResponse<null>>(API_PATHS.SIM_ACCOUNT_STOP.replace('{id}', id)),
  getStatus: (id: string) => client.get<ApiResponse<unknown>>(API_PATHS.SIM_ACCOUNT_STATUS.replace('{id}', id)),
  getTrades: (id: string, params?: PageParams) =>
    client.get<PaginatedResponse<Trade>>(API_PATHS.SIM_ACCOUNT_TRADES.replace('{id}', id), { params }),
  /** 实盘准入检查 */
  checkLiveReadiness: (id: string) =>
    client.get<ApiResponse<unknown>>(API_PATHS.SIM_LIVE_READINESS.replace('{id}', id)),
};

// ========== Trading ==========

export const tradingApi = {
  // API Keys
  getApiKeys: () => client.get<ApiResponse<unknown[]>>(API_PATHS.TRADING_API_KEYS),
  bindApiKey: (params: { exchange: string; label: string; access_key: string; secret_key: string; passphrase?: string }) =>
    client.post<ApiResponse<unknown>>(API_PATHS.TRADING_API_KEYS, null, { params }),
  deleteApiKey: (id: string) => client.delete<ApiResponse<null>>(API_PATHS.TRADING_API_KEY_DETAIL.replace('{id}', id)),
  // Orders
  createOrder: (params: { api_key_id: string; symbol: string; side: string; amount: number; order_type?: string; price?: number; leverage?: number; strategy_id?: string }) =>
    client.post<ApiResponse<unknown>>(API_PATHS.TRADING_ORDERS, null, { params }),
  getOrders: (params?: PageParams & { status?: string }) =>
    client.get<PaginatedResponse<Order>>(API_PATHS.TRADING_ORDERS, { params }),
  submitOrder: (id: string) => client.post<ApiResponse<unknown>>(API_PATHS.TRADING_ORDER_SUBMIT.replace('{id}', id)),
  cancelOrder: (id: string) => client.delete<ApiResponse<null>>(API_PATHS.TRADING_ORDER_DETAIL.replace('{id}', id)),
  // Positions
  getPositions: () => client.get<ApiResponse<Position[]>>(API_PATHS.TRADING_POSITIONS),
  // Logs
  getLogs: (params?: PageParams & { symbol?: string; strategy_id?: string }) =>
    client.get<PaginatedResponse<Trade>>(API_PATHS.TRADING_LOGS, { params }),
};

// ========== Risk ==========

export const riskApi = {
  getRules: () => client.get<ApiResponse<unknown[]>>(API_PATHS.RISK_RULES),
  createRule: (params: { scope: string; rule_type: string; params?: string; strategy_id?: string }) =>
    client.post<ApiResponse<unknown>>(API_PATHS.RISK_RULES, null, { params }),
  deleteRule: (id: string) => client.delete<ApiResponse<null>>(API_PATHS.RISK_RULE_DETAIL.replace('{id}', id)),
  getCircuitBreakers: () => client.get<ApiResponse<unknown[]>>(API_PATHS.RISK_CIRCUIT_BREAKERS),
  resolveBreaker: (id: string) => client.post<ApiResponse<null>>(API_PATHS.RISK_RESOLVE_BREAKER.replace('{id}', id)),
  /** 交易前风控检查 */
  preCheck: (params: { strategy_id: string; symbol: string; side: string; amount: number; price: number; leverage: number }) =>
    client.post<ApiResponse<{ passed: boolean; reason: string }>>(API_PATHS.RISK_PRE_CHECK, null, { params }),
  checkPosition: (params: { symbol: string; position_id: string }) =>
    client.post<ApiResponse<unknown>>(API_PATHS.RISK_CHECK_POSITION, null, { params }),
  getDashboard: () => client.get<ApiResponse<unknown>>(API_PATHS.RISK_DASHBOARD),
  getEvents: (params?: PageParams) => client.get<PaginatedResponse<RiskEvent>>(API_PATHS.RISK_EVENTS, { params }),
  getBlacklist: () => client.get<ApiResponse<unknown>>(API_PATHS.RISK_BLACKLIST),
};

// ========== AI（智能分析）==========

export const aiApi = {
  getHealthScore: (strategyId: string) =>
    client.get<ApiResponse<StrategyHealth>>(API_PATHS.AI_HEALTH_SCORE.replace('{id}', strategyId)),
  getOverfitRisk: (strategyId: string) =>
    client.get<ApiResponse<unknown>>(API_PATHS.AI_OVERFIT_RISK.replace('{id}', strategyId)),
  getMarketFit: (strategyId: string) =>
    client.get<ApiResponse<unknown>>(API_PATHS.AI_MARKET_FIT.replace('{id}', strategyId)),
  getParamSuggestions: (strategyId: string) =>
    client.get<ApiResponse<unknown>>(API_PATHS.AI_PARAM_SUGGESTIONS.replace('{id}', strategyId)),
  getMarketState: () => client.get<ApiResponse<MarketState>>(API_PATHS.AI_MARKET_STATE),
  getCorrelation: () => client.get<ApiResponse<unknown>>(API_PATHS.AI_CORRELATION),
  getAllocation: (strategyIds?: string) =>
    client.get<ApiResponse<unknown>>(API_PATHS.AI_ALLOCATION, { params: { strategy_ids: strategyIds || '' } }),
};

// ========== Notifications ==========

export const notificationApi = {
  // Alert rules
  getRules: () => client.get<ApiResponse<unknown[]>>(API_PATHS.NOTIFICATIONS_RULES),
  createRule: (params: { rule_type: string; name: string; conditions?: string; channels?: string; strategy_id?: string }) =>
    client.post<ApiResponse<unknown>>(API_PATHS.NOTIFICATIONS_RULES, null, { params }),
  deleteRule: (id: string) => client.delete<ApiResponse<null>>(API_PATHS.NOTIFICATIONS_RULE_DETAIL.replace('{id}', id)),
  // Messages
  getMessages: (params?: PageParams & { category?: string; unread_only?: boolean }) =>
    client.get<PaginatedResponse<Notification>>(API_PATHS.NOTIFICATIONS_MESSAGES, { params }),
  markRead: (id: string) => client.put<ApiResponse<null>>(API_PATHS.NOTIFICATIONS_MESSAGE_READ.replace('{id}', id)),
  markAllRead: () => client.post<ApiResponse<null>>(API_PATHS.NOTIFICATIONS_READ_ALL),
  // Preferences
  getPreferences: () => client.get<ApiResponse<NotificationPreference[]>>(API_PATHS.NOTIFICATIONS_PREFERENCES),
  updatePreferences: (preferences: string) =>
    client.put<ApiResponse<unknown>>(API_PATHS.NOTIFICATIONS_PREFERENCES, null, { params: { preferences } }),
};

// ========== Admin ==========

export const adminApi = {
  getHealth: () => client.get<ApiResponse<SystemHealth>>(API_PATHS.ADMIN_HEALTH),
  getExchangeStatus: () => client.get<ApiResponse<ExchangeStatus[]>>(API_PATHS.ADMIN_EXCHANGE_STATUS),
  getRunningStrategies: () => client.get<ApiResponse<unknown>>(API_PATHS.ADMIN_STRATEGIES_RUNNING),
  getConfig: () => client.get<ApiResponse<Record<string, unknown>>>(API_PATHS.ADMIN_CONFIG),
};
